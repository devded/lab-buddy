"""Single Gemini entrypoint: JSON in, JSON out, with retry on rate limits."""
import json
import os
import time

from google import genai
from google.genai import types

from app import db  # noqa: F401  (loads .env)

_client = None


def ask_json(contents: list, schema):
    global _client
    _client = _client or genai.Client(http_options=types.HttpOptions(timeout=120_000))
    for attempt in range(4):
        try:
            resp = _client.models.generate_content(
                model=os.environ["GEMINI_MODEL"],
                contents=contents,
                config={"response_mime_type": "application/json", "response_schema": schema, "temperature": 0},
            )
            return json.loads(resp.text)
        except Exception as e:  # retry only transient errors
            msg = str(e).upper()
            if attempt < 3 and any(k in msg for k in ("429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE")):
                time.sleep(2 * 2**attempt)
                continue
            raise
