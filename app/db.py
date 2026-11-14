"""SQLite schema + helpers, shared by the FastAPI app and the MCP server.
Every data helper takes the user id first, so one user can never read another's rows."""
import hashlib
import hmac
import os
import secrets
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
DB_PATH = str(ROOT / os.getenv("DB_PATH", "labbuddy.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  salt BLOB NOT NULL, pw_hash BLOB NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  filename TEXT, lab_name TEXT, country TEXT, city TEXT, report_date TEXT,
  source_language TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER REFERENCES reports(id),
  name_en TEXT, original_name TEXT,
  value REAL, value_text TEXT, unit TEXT,
  range_low REAL, range_high REAL, range_text TEXT,
  flag TEXT, explanation_en TEXT
);
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  actor TEXT, action TEXT, scope TEXT
);
"""

RESULT_FIELDS = ["name_en", "original_name", "value", "value_text", "unit",
                 "range_low", "range_high", "range_text", "flag", "explanation_en"]
REPORT_FIELDS = ["lab_name", "country", "city", "report_date", "source_language"]
FLAG_ORDER = {"high": 0, "low": 0, "unknown": 1, "normal": 2}


def conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


def rows(sql: str, args=()) -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute(sql, args)]


# ---------- auth ----------

def _hash_pw(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()  # only hashes are stored


def create_user(username: str, password: str) -> bool:
    salt = secrets.token_bytes(16)
    try:
        with conn() as c:
            c.execute("INSERT INTO users (username, salt, pw_hash) VALUES (?, ?, ?)",
                      (username, salt, _hash_pw(password, salt)))
        return True
    except sqlite3.IntegrityError:
        return False


def check_password(username: str, password: str) -> bool:
    u = rows("SELECT salt, pw_hash FROM users WHERE username = ?", (username,))
    if not u:
        _hash_pw(password, b"0" * 16)  # equalize timing for unknown users
        return False
    return hmac.compare_digest(_hash_pw(password, u[0]["salt"]), u[0]["pw_hash"])


def new_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    with conn() as c:
        c.execute("INSERT INTO sessions (token_hash, username) VALUES (?, ?)", (_hash_token(token), username))
    return token


def session_user(token: str) -> str | None:
    r = rows("SELECT username FROM sessions WHERE token_hash = ?", (_hash_token(token),))
    return r[0]["username"] if r else None


def end_session(token: str) -> None:
    with conn() as c:
        c.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def seed_demo_user() -> None:
    if not rows("SELECT 1 FROM users WHERE username = 'demo'"):
        create_user("demo", "demo")


# ---------- data (always scoped to uid) ----------

def save_report(uid: str, filename: str, data: dict) -> int:
    with conn() as c:
        cur = c.execute(
            f"INSERT INTO reports (user_id, filename, {', '.join(REPORT_FIELDS)}) VALUES (?, ?{', ?' * len(REPORT_FIELDS)})",
            [uid, filename] + [data.get(f) for f in REPORT_FIELDS],
        )
        rid = cur.lastrowid
        c.executemany(
            f"INSERT INTO results (report_id, {', '.join(RESULT_FIELDS)}) VALUES (?{', ?' * len(RESULT_FIELDS)})",
            [[rid] + [r.get(f) for f in RESULT_FIELDS] for r in data.get("results", [])],
        )
        return rid


def list_reports(uid: str) -> list[dict]:
    return rows("SELECT * FROM reports WHERE user_id = ? ORDER BY report_date, id", (uid,))


def get_report(uid: str, rid: int) -> dict | None:
    r = rows("SELECT * FROM reports WHERE id = ? AND user_id = ?", (rid, uid))
    return r[0] if r else None


def latest_report_id(uid: str) -> int | None:
    r = rows("SELECT id FROM reports WHERE user_id = ? ORDER BY report_date DESC, id DESC LIMIT 1", (uid,))
    return r[0]["id"] if r else None


def get_results(uid: str, rid: int) -> list[dict]:
    """Results in insertion order (stable for translation caching)."""
    return rows(
        """SELECT r.* FROM results r JOIN reports p ON p.id = r.report_id
           WHERE r.report_id = ? AND p.user_id = ? ORDER BY r.id""",
        (rid, uid),
    )


def abnormal_results(uid: str) -> list[dict]:
    # Never return normal results or filenames (MCP privacy scope).
    return rows(
        """SELECT r.name_en, r.value, r.value_text, r.unit, r.range_text, r.flag,
                  p.report_date, p.country, p.city
           FROM results r JOIN reports p ON p.id = r.report_id
           WHERE r.flag IN ('low', 'high') AND p.user_id = ? ORDER BY p.report_date DESC, r.id""",
        (uid,),
    )


def compare(uid: str, test: str) -> list[dict]:
    return rows(
        """SELECT p.id AS report_id, p.city, p.country, p.report_date, p.source_language,
                  r.value, r.value_text, r.unit, r.flag, r.range_text, r.range_low, r.range_high
           FROM results r JOIN reports p ON p.id = r.report_id
           WHERE lower(r.name_en) = lower(?) AND p.user_id = ? ORDER BY p.report_date, p.id""",
        (test, uid),
    )


def compare_tests(uid: str) -> list[str]:
    """Tests in 2+ reports; ones whose flag changed come first."""
    found = rows(
        """SELECT min(r.name_en) AS name, count(DISTINCT r.report_id) AS n, count(DISTINCT r.flag) AS flags
           FROM results r JOIN reports p ON p.id = r.report_id WHERE p.user_id = ?
           GROUP BY lower(r.name_en) HAVING n >= 2 ORDER BY flags DESC, min(r.id)""",
        (uid,),
    )
    return [f["name"] for f in found]


def cache_get(key: str) -> str | None:
    """Persistent cache for Gemini output (translations, briefs) so restarts don't burn API quota."""
    r = rows("SELECT value FROM cache WHERE key = ?", (key,))
    return r[0]["value"] if r else None


def cache_set(key: str, value: str) -> None:
    with conn() as c:
        c.execute("INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)", (key, value))


def log(uid: str, actor: str, action: str, scope: str) -> None:
    with conn() as c:
        c.execute("INSERT INTO access_log (user_id, actor, action, scope) VALUES (?, ?, ?, ?)",
                  (uid, actor, action, scope))


def access_log(uid: str, limit: int = 20) -> list[dict]:
    return rows("SELECT id, ts, actor, action, scope FROM access_log WHERE user_id = ? ORDER BY id DESC LIMIT ?",
                (uid, limit))


if __name__ == "__main__":
    import tempfile
    DB_PATH = os.path.join(tempfile.mkdtemp(), "t.db")
    assert create_user("a", "pw1") and not create_user("a", "x")
    assert check_password("a", "pw1") and not check_password("a", "nope") and not check_password("zz", "pw1")
    t = new_session("a")
    assert session_user(t) == "a" and session_user("bogus") is None
    end_session(t)
    assert session_user(t) is None
    rid = save_report("a", "f.pdf", {"results": [{"name_en": "HbA1c", "flag": "high"}]})
    assert get_report("b", rid) is None and get_results("b", rid) == [] and abnormal_results("b") == []
    assert len(abnormal_results("a")) == 1
    print("ok")
