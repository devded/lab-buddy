"""FastAPI routes (API only). Run: uvicorn app.main:app --reload --port 8000"""
import json
import logging
import re

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, UploadFile
from pydantic import BaseModel

from app import db
from app.brief import doctor_brief, translate_explanations
from app.extractor import extract
from app.doctors import find_nearby, geocode, specialties_for

log = logging.getLogger("labbuddy")
app = FastAPI(title="Lab Buddy")
SAMPLES = db.ROOT / "samples"
MIME = {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "webp": "image/webp", "heic": "image/heic", "heif": "image/heif"}
MAX_BYTES = 15 * 1024 * 1024
db.seed_demo_user()


# ---------- auth ----------

class Credentials(BaseModel):
    username: str
    password: str


def bearer(authorization: str = Header(default="")) -> str:
    return authorization.removeprefix("Bearer ").strip()


def current_user(token: str = Depends(bearer)) -> str:
    uid = db.session_user(token) if token else None
    if not uid:
        raise HTTPException(401, "Please sign in.")
    return uid


@app.post("/api/auth/register")
def register(c: Credentials):
    username = c.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username):
        raise HTTPException(422, "Username: 3–32 letters, digits, . _ -")
    if len(c.password) < 4:
        raise HTTPException(422, "Password must be at least 4 characters.")
    if not db.create_user(username, c.password):
        raise HTTPException(409, "That username is taken.")
    return {"token": db.new_session(username), "username": username}


@app.post("/api/auth/login")
def login(c: Credentials):
    username = c.username.strip().lower()
    if not db.check_password(username, c.password):
        raise HTTPException(401, "Wrong username or password.")
    return {"token": db.new_session(username), "username": username}


@app.post("/api/auth/logout")
def logout(token: str = Depends(bearer)):
    if token:
        db.end_session(token)
    return {"ok": True}


# ---------- data (all require a signed-in user) ----------

api = APIRouter(prefix="/api")


@api.get("/auth/me")
def me(uid: str = Depends(current_user)):
    return {"username": uid}


def detail(uid: str, rid: int, lang: str = "en") -> dict:
    report = db.get_report(uid, rid)
    if not report:
        raise HTTPException(404, "Report not found.")
    results = db.get_results(uid, rid)
    english = [r["explanation_en"] for r in results]
    try:
        texts = translate_explanations(rid, results, lang)
    except Exception:
        log.exception("translation failed")
        texts = english  # fall back to English, never fail the page
    for r, t in zip(results, texts):
        r["explanation"] = t
    results.sort(key=lambda r: db.FLAG_ORDER.get(r["flag"], 1))
    # Tell the client which language it actually got, so the UI can say "showing English" instead of lying.
    served = lang if lang == "en" or texts != english else "en"
    return {"report": report, "results": results, "lang": served}


def save_extracted(uid: str, filename: str, extracted: dict, action: str) -> dict:
    if not extracted.get("results"):
        raise HTTPException(422, "No lab results found in this file.")
    rid = db.save_report(uid, filename, extracted)
    db.log(uid, "web", action, f"{len(extracted['results'])} results from {filename}")
    return detail(uid, rid)


def safe_extract(data: bytes, mime: str) -> dict:
    try:
        return extract(data, mime)
    except Exception:
        log.exception("extraction failed")
        raise HTTPException(502, "We couldn't read this report. Try a clearer photo or PDF.")


@api.post("/upload")
async def upload(file: UploadFile, uid: str = Depends(current_user)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    mime = file.content_type if file.content_type in MIME.values() else MIME.get(ext)
    if not mime:
        raise HTTPException(415, "Please upload a PDF or a photo (JPG/PNG).")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is too large (max 15 MB).")
    return save_extracted(uid, file.filename or "upload", safe_extract(data, mime), "upload_report")


@api.post("/load-sample/{n}")
def load_sample(n: int, uid: str = Depends(current_user)):
    pdf = next(SAMPLES.glob(f"{n}_*.pdf"), None)
    if not pdf:
        raise HTTPException(404, "Sample not found.")
    cache = pdf.with_suffix(".json")  # stage backup: works offline after the first run
    if cache.exists():
        extracted = json.loads(cache.read_text())
    else:
        extracted = safe_extract(pdf.read_bytes(), "application/pdf")
        cache.write_text(json.dumps(extracted, ensure_ascii=False, indent=2))
    return save_extracted(uid, pdf.name, extracted, "load_sample")


@api.get("/reports")
def reports(uid: str = Depends(current_user)):
    return db.list_reports(uid)


@api.get("/reports/{rid}")
def report(rid: int, lang: str = "en", uid: str = Depends(current_user)):
    d = detail(uid, rid, lang)
    db.log(uid, "web", "view_report", f"report {rid}: {len(d['results'])} results ({lang})")
    return d


@api.get("/reports/{rid}/brief")
def brief(rid: int, uid: str = Depends(current_user)):
    if not db.get_report(uid, rid):
        raise HTTPException(404, "Report not found.")
    try:
        b = doctor_brief(uid, rid)
    except Exception:
        log.exception("brief failed")
        raise HTTPException(502, "Couldn't write the doctor brief right now. Please retry.")
    db.log(uid, "web", "get_doctor_brief", f"report {rid}")
    return b


@api.get("/reports/{rid}/doctors")
def doctors(rid: int, lat: float | None = None, lon: float | None = None, uid: str = Depends(current_user)):
    """Specialties that fit this report's abnormal values (+ real doctors nearby when lat/lon given)."""
    if not db.get_report(uid, rid):
        raise HTTPException(404, "Report not found.")
    specs = specialties_for([r for r in db.get_results(uid, rid) if r["flag"] in ("low", "high")])
    if lat is None or lon is None:
        return {"specialties": specs, "doctors": []}
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(422, "Invalid location.")
    try:
        found = find_nearby(lat, lon, [s["key"] for s in specs])
    except Exception:
        log.exception("doctor search failed")
        raise HTTPException(502, "Doctor search is busy right now. Please retry in a moment.")
    db.log(uid, "web", "find_doctors", f"report {rid}: {len(found)} practices nearby")  # no coordinates logged
    return {"specialties": specs, "doctors": found}


@api.get("/geocode")
def geocode_place(postcode: str = "", city: str = "", uid: str = Depends(current_user)):
    postcode, city = postcode.strip()[:20], city.strip()[:100]
    if not (postcode or city):
        raise HTTPException(422, "Enter a postcode or a city.")
    try:
        hit = geocode(postcode, city)
    except Exception:
        log.exception("geocode failed")
        raise HTTPException(502, "Location search is busy right now. Please retry.")
    if not hit:
        raise HTTPException(404, "Couldn't find that postcode/city. Check the spelling, e.g. 10115 + Berlin.")
    return hit


@api.get("/compare/tests")
def compare_tests(uid: str = Depends(current_user)):
    return db.compare_tests(uid)


@api.get("/compare")
def compare(test: str, uid: str = Depends(current_user)):
    return db.compare(uid, test)


@api.get("/history")
def history(uid: str = Depends(current_user)):
    """Every test seen in 2+ reports -> its values over time (for trend charts)."""
    return {t: db.compare(uid, t) for t in db.compare_tests(uid)}


@api.get("/access-log")
def access_log(uid: str = Depends(current_user)):
    return db.access_log(uid, 20)


app.include_router(api)
