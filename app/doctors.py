"""Find real doctors nearby (OpenStreetMap) whose specialty fits the report's abnormal tests.
Coordinates are only forwarded to OSM for the search; never stored or logged."""
import math
import re
from functools import lru_cache

import httpx

UA = {"User-Agent": "LabBuddy-demo/1.0 (hackathon prototype)"}
OVERPASS = "https://overpass-api.de/api/interpreter"
NOMINATIM = "https://nominatim.openstreetmap.org/search"

# key -> (English label, German label to ask for, OSM healthcare:speciality regex)
SPECIALTIES = {
    "general": ("General practitioner", "Hausarzt / Allgemeinmedizin", r"general|family|internal"),
    "endocrinology": ("Diabetology / Endocrinology", "Diabetologe / Endokrinologe", r"endocrin|diabet"),
    "nephrology": ("Nephrology (kidneys)", "Nephrologe", r"nephro"),
    "gastroenterology": ("Gastroenterology (liver)", "Gastroenterologe", r"gastro|hepat"),
    "cardiology": ("Cardiology (heart)", "Kardiologe", r"cardio"),
    "haematology": ("Haematology (blood)", "Hämatologe", r"haemato|hemato"),
}
# abnormal test (name_en, lowercase) -> specialist worth seeing besides the GP
TEST_SPECIALTY = {
    "hba1c": "endocrinology", "fasting glucose": "endocrinology", "glucose": "endocrinology",
    "tsh": "endocrinology", "free t4": "endocrinology", "free t3": "endocrinology",
    "creatinine": "nephrology", "egfr": "nephrology", "urea": "nephrology",
    "alt": "gastroenterology", "ast": "gastroenterology", "ggt": "gastroenterology", "bilirubin": "gastroenterology",
    "ldl cholesterol": "cardiology", "total cholesterol": "cardiology", "triglycerides": "cardiology",
    "platelets": "haematology",
}


def specialties_for(abnormal: list[dict]) -> list[dict]:
    """GP first (always), then specialists linked to the abnormal tests."""
    keys: dict[str, list[str]] = {"general": [r["name_en"] for r in abnormal]}
    for r in abnormal:
        k = TEST_SPECIALTY.get(r["name_en"].lower())
        if k:
            keys.setdefault(k, []).append(r["name_en"])
    return [{"key": k, "label_en": SPECIALTIES[k][0], "label_de": SPECIALTIES[k][1], "tests": t} for k, t in keys.items()]


def distance_m(lat1, lon1, lat2, lon2) -> int:
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return round(12_742_000 * math.asin(math.sqrt(a)))


def _doctor(tags: dict, lat: float, lon: float, osm_id: str, addr: dict | None = None) -> dict:
    addr = addr or {}
    street = " ".join(filter(None, [tags.get("addr:street") or addr.get("road"), tags.get("addr:housenumber") or addr.get("house_number")]))
    city = " ".join(filter(None, [tags.get("addr:postcode") or addr.get("postcode"), tags.get("addr:city") or addr.get("city") or addr.get("suburb")]))
    return {
        "id": osm_id,
        "name": tags.get("name") or "Doctor's practice",
        "speciality": tags.get("healthcare:speciality", ""),
        "address": ", ".join(filter(None, [street, city])),
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "website": tags.get("website") or tags.get("contact:website"),
        "opening_hours": tags.get("opening_hours"),
        "wheelchair": tags.get("wheelchair"),
        "languages": sorted(k.split(":", 1)[1] for k, v in tags.items() if k.startswith("language:") and v == "yes"),
        "lat": lat, "lon": lon,
    }


def _overpass(lat: float, lon: float, regex: str) -> list[dict]:
    q = (f'[out:json][timeout:10];nwr(around:3000,{lat},{lon})["amenity"="doctors"]'
         f'["healthcare:speciality"~"{regex}",i];out center tags 80;')
    r = httpx.post(OVERPASS, data={"data": q}, headers=UA, timeout=6)
    r.raise_for_status()
    out = []
    for e in r.json()["elements"]:
        c = e.get("center") or e
        out.append(_doctor(e.get("tags", {}), c["lat"], c["lon"], f"{e['type']}/{e['id']}"))
    return out


def _nominatim(lat: float, lon: float) -> list[dict]:
    # Overpass is often overloaded; Nominatim keyword search in a ~3 km box is the fallback.
    seen, out = set(), []
    for q in ("doctors", "Arzt"):
        r = httpx.get(NOMINATIM, headers=UA, timeout=12, params={
            "q": q, "format": "jsonv2", "limit": 40, "extratags": 1, "addressdetails": 1, "bounded": 1,
            "viewbox": f"{lon - 0.045},{lat + 0.03},{lon + 0.045},{lat - 0.03}"})
        r.raise_for_status()
        for e in r.json():
            oid = f"{e['osm_type']}/{e['osm_id']}"
            if e.get("type") != "doctors" or oid in seen:
                continue
            seen.add(oid)
            tags = {**(e.get("extratags") or {}), "name": e.get("name")}
            out.append(_doctor(tags, float(e["lat"]), float(e["lon"]), oid, e.get("address")))
    return out


@lru_cache(maxsize=128)  # ponytail: in-memory per process; keyed on ~100 m grid to respect OSM usage limits
def _search(lat: float, lon: float, keys: tuple[str, ...]) -> tuple[str, tuple]:
    regex = "|".join(SPECIALTIES[k][2] for k in keys)
    try:
        return "overpass", tuple(_overpass(lat, lon, regex))
    except Exception:
        return "nominatim", tuple(_nominatim(lat, lon))


def find_nearby(lat: float, lon: float, keys: list[str]) -> list[dict]:
    lat, lon = round(lat, 3), round(lon, 3)
    _, found = _search(lat, lon, tuple(sorted(keys)))
    out = []
    for d in found:
        match = next((k for k in keys if re.search(SPECIALTIES[k][2], d["speciality"], re.I)), None)
        if match:
            out.append({**d, "specialty_key": match, "distance_m": distance_m(lat, lon, d["lat"], d["lon"])})
    out.sort(key=lambda d: d["distance_m"])
    return out[:30]


def geocode(postcode: str = "", city: str = "") -> dict | None:
    """Structured lookup (postcode and/or city) — more precise than free text."""
    params = {"format": "jsonv2", "limit": 1, "countrycodes": "de"}  # ponytail: Germany-only (target users live here)
    if postcode:
        params["postalcode"] = postcode
    if city:
        params["city"] = city
    r = httpx.get(NOMINATIM, headers=UA, timeout=12, params=params)
    r.raise_for_status()
    hits = r.json()
    label = " ".join(filter(None, [postcode, city])) or hits[0]["display_name"] if hits else ""
    return {"lat": float(hits[0]["lat"]), "lon": float(hits[0]["lon"]), "label": label} if hits else None


if __name__ == "__main__":
    s = specialties_for([{"name_en": "HbA1c"}, {"name_en": "Vitamin D"}])
    assert [x["key"] for x in s] == ["general", "endocrinology"] and s[1]["tests"] == ["HbA1c"], s
    assert specialties_for([])[0]["key"] == "general"
    assert 1100 < distance_m(52.52, 13.405, 52.53, 13.405) < 1120
    assert re.search(SPECIALTIES["endocrinology"][2], "internal;diabetology", re.I)
    print("ok")
