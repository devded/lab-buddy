# Lab Buddy

Upload a lab report (PDF or photo, any language) → plain-language result cards, a German doctor brief,
cross-country comparison, and an MCP server whose every read shows up live in the app.

> Synthetic demo data. Not medical advice.

## Setup

```bash
cp .env.example .env            # set GEMINI_API_KEY, GEMINI_MODEL
uv venv -p 3.12 .venv && uv pip install -p .venv/bin/python -r requirements.txt
cd web && npm install
```

## Run

```bash
# terminal 1 – backend (port 8000; the Vite proxy expects it there)
.venv/bin/uvicorn app.main:app --reload --port 8000
# terminal 2 – frontend
cd web && npm run dev            # add --host to open it on your phone (same Wi-Fi)
```

Port 8000 busy? Run the backend on another port and point the proxy at it:
`API_URL=http://localhost:8001 npm run dev`.

## Auth

Username + password (scrypt-hashed, stored in SQLite), bearer token per session. Every `/api/*` route except
`/api/auth/register|login|logout` needs `Authorization: Bearer <token>`; all data is scoped per user.
A demo account `demo` / `demo` is created on startup. The MCP server acts for `LABBUDDY_USER` (default `demo`).

Reset the demo: stop the backend, `rm labbuddy.db`, start it again.
Sample PDFs live in `samples/` (`make_samples.py` regenerates them). The first "Try a sample report"
caches the extraction as `samples/*.json`, so later sample loads work without Gemini.

## MCP (Claude Desktop)

`~/.config/Claude/claude_desktop_config.json` (Linux) / `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{ "mcpServers": { "lab-buddy": {
    "command": "/home/thededar/Downloads/Winter 2026/LAB/.venv/bin/python",
    "args": ["/home/thededar/Downloads/Winter 2026/LAB/mcp_server.py"],
    "env": { "LABBUDDY_USER": "demo" } } } }
```

Tools: `get_abnormal_results`, `get_doctor_brief(report_id?)`, `compare_test(test_name)`. Each call is logged
(`actor="mcp"`) and flashes in the web access log. Normal results and filenames are never exposed.

## Demo script

1. Open the app (phone or projector). Banner: synthetic data.
2. Upload `samples/1_berlin_de.pdf` (or "Try a sample report") → cards, HbA1c HIGH + Vitamin D LOW first.
3. Switch language to Türkçe / বাংলা → explanations change, values stay.
4. Doctor brief → German note → Copy.
5. Upload `samples/2_istanbul_tr.pdf` → Compare: HbA1c 5.6 % normal (Istanbul 2025) → 6.1 % HIGH (Berlin 2026).
6. In Claude Desktop: "What was abnormal in my lab results?" → access log row flashes + toast.

## Layout

`app/` FastAPI + SQLite + Gemini (`extractor.py`, `brief.py`, `gemini.py`, `db.py`), `mcp_server.py`, `web/` Vite + React + shadcn/ui.
