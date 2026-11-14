"""Seed synthetic historical lab reports for one user (default: demo).

    .venv/bin/python seed.py            # add 7 reports, 2021-2025, Dhaka / Istanbul / Berlin
    .venv/bin/python seed.py --reset    # wipe that user's reports first
    .venv/bin/python seed.py --user alice

Synthetic demo data only. Story: HbA1c creeps up over 5 years, Vitamin D dips every
winter, Ferritin slowly falls. Combined with the two sample PDFs (Istanbul 2025-04,
Berlin 2026-03) this gives a ~9-point history per test.
"""
import argparse
import json

from app import db
from app.extractor import recompute_flag

# name_en -> {lang: original_name}
NAMES = {
    "Hemoglobin": {"bn": "হিমোগ্লোবিন", "tr": "Hemoglobin", "de": "Hämoglobin"},
    "White Blood Cells": {"bn": "শ্বেত রক্তকণিকা", "tr": "Lökosit", "de": "Leukozyten"},
    "Fasting Glucose": {"bn": "খালি পেটে গ্লুকোজ", "tr": "Açlık Kan Şekeri", "de": "Glukose (nüchtern)"},
    "HbA1c": {"bn": "এইচবিএ১সি", "tr": "HbA1c", "de": "HbA1c"},
    "Creatinine": {"bn": "ক্রিয়েটিনিন", "tr": "Kreatinin", "de": "Kreatinin"},
    "TSH": {"bn": "টিএসএইচ", "tr": "TSH", "de": "TSH"},
    "Vitamin D": {"bn": "ভিটামিন ডি", "tr": "Vitamin D (25-OH)", "de": "25-OH-Vitamin D"},
    "Ferritin": {"bn": "ফেরিটিন", "tr": "Ferritin", "de": "Ferritin"},
}
# lab style -> name_en -> (unit, low, high)
RANGES = {
    "bn": {"Hemoglobin": ("g/dL", 12.0, 15.5), "White Blood Cells": ("10^3/µL", 4.0, 11.0),
           "Fasting Glucose": ("mg/dL", 70, 100), "HbA1c": ("%", 4.0, 5.7), "Creatinine": ("mg/dL", 0.6, 1.2),
           "TSH": ("µIU/mL", 0.5, 4.5), "Vitamin D": ("ng/mL", 30, 100), "Ferritin": ("ng/mL", 12, 150)},
    "tr": {"Hemoglobin": ("g/dL", 12.0, 16.0), "White Blood Cells": ("10^3/µL", 4.0, 10.0),
           "Fasting Glucose": ("mg/dL", 70, 100), "HbA1c": ("%", 4.0, 5.7), "Creatinine": ("mg/dL", 0.6, 1.1),
           "TSH": ("µIU/mL", 0.4, 4.0), "Vitamin D": ("ng/mL", 20, 100), "Ferritin": ("ng/mL", 13, 150)},
    "de": {"Hemoglobin": ("g/dl", 12.0, 16.0), "White Blood Cells": ("/nl", 3.9, 10.2),
           "Fasting Glucose": ("mg/dl", 70, 99), "HbA1c": ("%", 4.0, 5.6), "Creatinine": ("mg/dl", 0.5, 1.0),
           "TSH": ("mU/l", 0.27, 4.2), "Vitamin D": ("ng/ml", 30, 100), "Ferritin": ("ng/ml", 15, 150)},
}
REPORTS = [  # date, city, country, language, lab style, lab name
    ("2021-02-10", "Dhaka", "Bangladesh", "Bangla", "bn", "Dhaka Central Diagnostics (synthetic)"),
    ("2021-08-22", "Dhaka", "Bangladesh", "Bangla", "bn", "Dhaka Central Diagnostics (synthetic)"),
    ("2022-05-20", "Istanbul", "Turkey", "Turkish", "tr", "Anadolu Tıp Laboratuvarı"),
    ("2023-01-15", "Istanbul", "Turkey", "Turkish", "tr", "Anadolu Tıp Laboratuvarı"),
    ("2023-11-02", "Berlin", "Germany", "German", "de", "Labor Berlin-Mitte MVZ"),
    ("2024-06-18", "Berlin", "Germany", "German", "de", "Labor Berlin-Mitte MVZ"),
    ("2025-10-01", "Berlin", "Germany", "German", "de", "Labor Berlin-Mitte MVZ"),
]
VALUES = {  # one value per REPORTS row
    "Hemoglobin": [13.5, 13.9, 14.2, 13.7, 13.4, 14.0, 13.6],
    "White Blood Cells": [6.8, 7.4, 5.9, 8.1, 6.5, 5.7, 6.9],
    "Fasting Glucose": [86, 88, 90, 91, 94, 95, 97],
    "HbA1c": [5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.8],
    "Creatinine": [0.8, 0.8, 0.9, 0.8, 0.9, 0.9, 0.9],
    "TSH": [1.6, 1.8, 2.0, 1.7, 2.4, 2.2, 2.0],
    "Vitamin D": [19, 34, 31, 17, 21, 36, 24],
    "Ferritin": [82, 76, 68, 61, 54, 49, 47],
}


def explanations() -> dict[str, str]:
    """Reuse the explanations Gemini wrote for the sample PDFs (cached JSON)."""
    out = {}
    for f in sorted((db.ROOT / "samples").glob("*.json")):
        for r in json.loads(f.read_text())["results"]:
            out.setdefault(r["name_en"], r["explanation_en"])
    return out


def fmt(v: float, lang: str) -> str:
    s = str(v)  # keeps "4.0" as printed on real reports
    return s.replace(".", ",") if lang in ("de", "tr") else s


def build(i: int) -> dict:
    date, city, country, language, style, lab = REPORTS[i]
    expl = explanations()
    results = []
    for name, vals in VALUES.items():
        unit, lo, hi = RANGES[style][name]
        r = {"name_en": name, "original_name": NAMES[name][style], "value": vals[i], "value_text": fmt(vals[i], style),
             "unit": unit, "range_low": lo, "range_high": hi, "range_text": f"{fmt(lo, style)} – {fmt(hi, style)}",
             "explanation_en": expl.get(name, f"Measures {name} in the blood.")}
        r["flag"] = recompute_flag(r)
        results.append(r)
    return {"lab_name": lab, "country": country, "city": city, "report_date": date,
            "source_language": language, "results": results}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="demo")
    ap.add_argument("--reset", action="store_true")
    a = ap.parse_args()
    db.seed_demo_user()
    if a.reset:
        with db.conn() as c:
            c.execute("DELETE FROM results WHERE report_id IN (SELECT id FROM reports WHERE user_id = ?)", (a.user,))
            c.execute("DELETE FROM reports WHERE user_id = ?", (a.user,))
    for i in range(len(REPORTS)):
        db.save_report(a.user, f"synthetic_{REPORTS[i][0]}_{REPORTS[i][1].lower()}.pdf", build(i))
    db.log(a.user, "web", "seed", f"{len(REPORTS)} synthetic reports")
    hb = [build(i)["results"][3] for i in range(len(REPORTS))]
    assert [r["flag"] for r in hb] == ["normal"] * 6 + ["high"], hb  # HbA1c story holds
    print(f"seeded {len(REPORTS)} reports for {a.user}")
