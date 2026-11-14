"""German doctor brief + translation of explanations (cached in memory)."""
import json

from pydantic import BaseModel

from app import db
from app.gemini import ask_json

LANGS = {"de": "German", "bn": "Bangla (Bengali script)", "tr": "Turkish"}


class Brief(BaseModel):
    de: str
    en: str


def translate_explanations(rid: int, results: list[dict], lang: str) -> list[str]:
    """results must be in db.get_results order (stable), returns same-length list."""
    src = [r["explanation_en"] for r in results]
    if lang not in LANGS or not src:
        return src
    key = f"tr:{rid}:{lang}"
    cached = db.cache_get(key)
    if cached:
        return json.loads(cached)
    out = ask_json(
            [f"Translate each sentence into plain, simple {LANGS[lang]}. Return a JSON array of strings "
             f"in the same order and of the same length ({len(src)}).\n{json.dumps(src, ensure_ascii=False)}"],
            list[str],
        )
    if len(out) != len(src):
        return src  # malformed answer: show English, don't cache
    db.cache_set(key, json.dumps(out, ensure_ascii=False))
    return out


def doctor_brief(uid: str, rid: int) -> dict:
    cached = db.cache_get(f"brief:{rid}")
    if cached:
        return json.loads(cached)
    report = db.get_report(uid, rid)
    abnormal = [r for r in db.get_results(uid, rid) if r["flag"] in ("low", "high")]
    facts = [{k: r[k] for k in ("name_en", "original_name", "value_text", "unit", "range_text", "flag")} for r in abnormal]
    if not facts:
        brief = {"de": "Alle Laborwerte dieses Befundes liegen im angegebenen Referenzbereich.",
                 "en": "All lab values in this report are within the printed reference range."}
    else:
        brief = ask_json(
            ["Write a short, formal German note (max 6 lines) a patient can show their doctor in Germany. "
             "Mention only these abnormal lab values with value, unit and the reference range printed on the report. "
             "Start with 'Sehr geehrte Ärztin, sehr geehrter Arzt,'. No diagnosis, no advice, no invented values. "
             "Also give an English translation in field 'en'.\n"
             f"Report: {report['lab_name']}, {report['city'] or report['country']}, {report['report_date']}\n"
             f"Abnormal values: {json.dumps(facts, ensure_ascii=False)}"],
            Brief,
        )
    db.cache_set(f"brief:{rid}", json.dumps(brief, ensure_ascii=False))
    return brief

