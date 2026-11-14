"""Single Gemini entrypoint: JSON in, JSON out.
On quota (429) or overload (503) it moves to the next model in GEMINI_FALLBACK_MODELS (.env)."""
import json
import os
import time

from google import genai
from google.genai import types

from app import db  # noqa: F401  (loads .env)

_client = None
TRANSIENT = ("429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE")


def models() -> list[str]:
    extra = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "").split(",") if m.strip()]
    return [os.environ["GEMINI_MODEL"], *extra]


def ask_json(contents: list, schema):
    global _client
    _client = _client or genai.Client(http_options=types.HttpOptions(timeout=120_000))
    last = None
    for model in models():
        for attempt in range(2):  # one quick retry per model for a blip, then fall through to the next model
            try:
                resp = _client.models.generate_content(
                    model=model,
                    contents=contents,
                    config={"response_mime_type": "application/json", "response_schema": schema, "temperature": 0},
                )
                return json.loads(resp.text)
            except Exception as e:
                last = e
                msg = str(e).upper()
                if not any(k in msg for k in TRANSIENT):
                    raise
                if "PERDAY" in msg.replace("_", "") or attempt == 1:
                    break  # daily quota gone or still failing: next model
                time.sleep(2)
    raise last
