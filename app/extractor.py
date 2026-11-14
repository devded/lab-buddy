"""Gemini call: lab report file -> structured JSON (section 6 of CLAUDE.md)."""
from typing import Literal

from google.genai import types
from pydantic import BaseModel

from app.gemini import ask_json

PROMPT = """You are reading a medical lab report. It may be in any language (German, Bangla, Turkish, English, Arabic, ...).
Extract every test result. For each test return:
- name_en: standard English test name. Use these canonical names when they apply so reports in different languages match:
  Hemoglobin, White Blood Cells, Fasting Glucose, HbA1c, Creatinine, TSH, Vitamin D, Ferritin, Platelets, Red Blood Cells,
  Hematocrit, Total Cholesterol, LDL Cholesterol, HDL Cholesterol, Triglycerides, ALT, AST, CRP, Iron, Vitamin B12.
- original_name: exactly as printed
- value: number or null (convert decimal commas, e.g. "13,8" -> 13.8)
- value_text: as printed
- unit
- range_low, range_high: numbers from the reference range printed on THIS report (null if absent)
- range_text: the reference range as printed on this report
- flag: low/normal/high/unknown - compare value to this report's range
- explanation_en: one short plain-English sentence on what this test measures; no diagnosis.
Also return report-level: lab_name, country (English name), city (English name), report_date (YYYY-MM-DD if possible), source_language (English name of the language, e.g. "German").
Do not invent values. If something is unreadable, use null."""


class Result(BaseModel):
    name_en: str
    original_name: str
    value: float | None
    value_text: str | None
    unit: str | None
    range_low: float | None
    range_high: float | None
    range_text: str | None
    flag: Literal["low", "normal", "high", "unknown"]
    explanation_en: str


class Extraction(BaseModel):
    lab_name: str | None
    country: str | None
    city: str | None
    report_date: str | None
    source_language: str | None
    results: list[Result]


def recompute_flag(r: dict) -> str:
    v, lo, hi = r.get("value"), r.get("range_low"), r.get("range_high")
    if all(isinstance(x, (int, float)) for x in (v, lo, hi)):
        return "low" if v < lo else "high" if v > hi else "normal"
    return r.get("flag") or "unknown"


def extract(file_bytes: bytes, mime_type: str) -> dict:
    data = ask_json([types.Part.from_bytes(data=file_bytes, mime_type=mime_type), PROMPT], Extraction)
    for r in data["results"]:
        r["flag"] = recompute_flag(r)  # don't trust the model blindly
    return data


if __name__ == "__main__":
    assert recompute_flag({"value": 6.1, "range_low": 4.0, "range_high": 5.6}) == "high"
    assert recompute_flag({"value": 14, "range_low": 30, "range_high": 100}) == "low"
    assert recompute_flag({"value": 5.6, "range_low": 4.0, "range_high": 5.7}) == "normal"
    assert recompute_flag({"value": None, "range_low": 1, "range_high": 2, "flag": "high"}) == "high"
    assert recompute_flag({"value": 1, "range_low": None, "range_high": 2}) == "unknown"
    print("ok")
