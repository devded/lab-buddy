# Lab Buddy — MVP Spec for Claude Code

> Hackathon build (GDGoC SRH Berlin, Societal Impact track). Time budget: ~2.5 hours.
> Put this file in the repo root as `CLAUDE.md`, then run the phase prompts at the bottom one by one.

## 1. What we're building

A web app where an international student uploads a lab report (PDF or photo, **any language**) and gets:

1. Plain-language result cards in their chosen language, with abnormal values flagged
2. A short German "doctor brief" they can copy
3. A comparison of the same test across reports from different countries/languages
4. An MCP server so an AI assistant can read **only** abnormal results / the doctor brief, with every access logged and visible in the app

**One user:** international student in Berlin. **One core flow:** upload → cards. Everything else is secondary.

## 2. Rules for Claude Code

- Keep it simple. No auth, no Docker, no frameworks beyond those listed.
- Frontend uses **shadcn/ui** components. Use the shadcn CLI to add them; don't hand-write lookalikes.
- **Mobile-first**: design for 390px wide first, then scale up with `md:` / `lg:` breakpoints.
- Single user (`user_id = "demo"` hardcoded).
- Synthetic data only. Show the banner "Synthetic demo data. Not medical advice." on every page.
- Never invent lab values. Values come only from the extraction step.
- Always use the normal range printed on the report, never a generic one.
- Model name comes from `.env` (`GEMINI_MODEL`), never hardcoded.
- After each phase, run the app and verify the "Done when" check before moving on.

## 3. Stack

| Part | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| DB | SQLite via `sqlite3` stdlib (no ORM) |
| AI | Gemini API via `google-genai` SDK (PDF/image input, JSON schema output) |
| Frontend | Vite + React + TypeScript + Tailwind CSS + **shadcn/ui** (+ `lucide-react` icons, `sonner` toasts) |
| MCP | Official `mcp` Python SDK (`FastMCP`), stdio transport, same SQLite file |

Frontend talks to the backend via a Vite dev proxy (`/api` → `http://localhost:8000`), so no CORS setup is needed.

shadcn setup (follow the current Vite guide at ui.shadcn.com/docs/installation/vite if commands differ):
```
npm create vite@latest web -- --template react-ts
cd web && npm install && npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init
npx shadcn@latest add button card badge select dialog drawer sheet tabs progress skeleton alert scroll-area separator tooltip sonner
npm install lucide-react
```

`requirements.txt`: `fastapi uvicorn[standard] python-multipart google-genai python-dotenv mcp`

`.env`:
```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest   # check the current Flash model name in Google AI Studio
DB_PATH=labbuddy.db
```

## 4. File structure

```
lab-buddy/
├── CLAUDE.md
├── .env / .env.example
├── requirements.txt
├── app/                 # backend
│   ├── main.py          # FastAPI routes (API only)
│   ├── db.py            # schema + helper functions (shared with MCP)
│   ├── extractor.py     # Gemini call: file -> structured JSON
│   └── brief.py         # doctor brief + translation of explanations
├── web/                 # frontend (Vite + React + shadcn/ui)
│   ├── vite.config.ts   # proxy /api -> :8000
│   └── src/
│       ├── App.tsx
│       ├── lib/api.ts           # typed fetch helpers
│       ├── types.ts             # Report, Result, LogEntry
│       ├── components/ui/       # shadcn (generated)
│       └── components/
│           ├── Header.tsx
│           ├── UploadZone.tsx
│           ├── ReportTabs.tsx
│           ├── SummaryBar.tsx
│           ├── ResultCard.tsx
│           ├── RangeBar.tsx
│           ├── DoctorBrief.tsx
│           ├── CompareView.tsx
│           ├── AccessLog.tsx
│           └── EmptyState.tsx
├── mcp_server.py        # FastMCP server, imports app/db.py
├── samples/             # synthetic lab reports for the demo
└── README.md
```

## 5. Data model (SQLite)

```sql
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT, lab_name TEXT, country TEXT, report_date TEXT,
  source_language TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER REFERENCES reports(id),
  name_en TEXT,          -- normalized English name, e.g. "Hemoglobin"
  original_name TEXT,    -- as printed, e.g. "Hämoglobin"
  value REAL, value_text TEXT, unit TEXT,
  range_low REAL, range_high REAL, range_text TEXT,
  flag TEXT,             -- "low" | "normal" | "high" | "unknown"
  explanation_en TEXT    -- one plain sentence
);
CREATE TABLE access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  actor TEXT,            -- "web" | "mcp:<client>"
  action TEXT,           -- e.g. "get_abnormal_results"
  scope TEXT             -- what was returned, e.g. "3 abnormal results"
);
```

## 6. Extraction (the core)

One Gemini call per upload: send the file bytes (`application/pdf`, `image/jpeg`, `image/png`) and a prompt, with `response_mime_type="application/json"` and a response schema.

**Prompt:**
> You are reading a medical lab report. It may be in any language (German, Bangla, Turkish, English, Arabic, …).
> Extract every test result. For each test return: `name_en` (standard English test name), `original_name` (exactly as printed), `value` (number or null), `value_text` (as printed), `unit`, `range_low`, `range_high`, `range_text` (the reference range **as printed on this report**), `flag` (low/normal/high/unknown — compare value to this report's range), `explanation_en` (one short plain-English sentence on what this test measures; no diagnosis).
> Also return report-level: `lab_name`, `country`, `report_date` (YYYY-MM-DD if possible), `source_language`.
> Do not invent values. If something is unreadable, use null.

**Schema (top level):** `{ lab_name, country, report_date, source_language, results: [ ...fields above... ] }`

Post-processing in Python: if `value`, `range_low`, `range_high` are all numbers, recompute `flag` yourself (don't trust the model blindly).

## 7. API

| Method | Path | Does |
|---|---|---|
| POST | `/api/upload` | multipart file → extract → save → returns report + results |
| GET | `/api/reports` | list reports |
| GET | `/api/reports/{id}?lang=en` | report + results; if `lang != en`, translate `explanation_en` via one Gemini call (cache in memory) |
| GET | `/api/reports/{id}/brief` | German doctor brief (abnormal values only, short, formal German) |
| GET | `/api/compare?test=Hemoglobin` | that test across all reports, ordered by date |
| GET | `/api/access-log` | last 20 log rows |

## 8. Frontend UI spec (React + shadcn/ui, mobile-first)

Built in `web/`. Use shadcn components everywhere; style with Tailwind utility classes only. It must look polished on a **phone (390px)** first and on a **projector (1920px)**.

### 8.1 Look & feel
- shadcn theme: base color **Slate**, `--primary` set to blue `#1A73E8`. Light mode only.
- Font: Inter (Google Fonts) or system sans-serif.
- Status colors (use as Badge variants + left border on cards):
  - **HIGH** red `#D93025` · **LOW** blue `#1A73E8` · **NORMAL** green `#188038` · **UNKNOWN** slate grey
- Cards: shadcn `Card`, `rounded-2xl`, soft shadow, comfortable padding (`p-4` mobile, `p-5` desktop).
- Text sizes: values large (`text-3xl font-bold`), test name `text-lg font-semibold`, meta `text-sm text-muted-foreground`.
- Icons: `lucide-react` (`FlaskConical`, `Upload`, `Languages`, `Stethoscope`, `Copy`, `Check`, `Activity`, `ShieldCheck`, `TrendingUp`, `TrendingDown`).

### 8.2 Mobile-first layout

**Phone (default, < 768px)**: single column, thumb-friendly.
```
┌──────────────────────────────┐
│ 🧪 Lab Buddy        [EN ▾]   │  ← sticky header (h-14)
├──────────────────────────────┤
│ ⚠ Synthetic demo · not advice│  ← Alert, compact
│ ┌──────────────────────────┐ │
│ │ ⬆ Upload lab report      │ │  ← UploadZone (tap = file picker / camera)
│ │ PDF or photo · any lang  │ │
│ └──────────────────────────┘ │
│ [Berlin 26][Dhaka 25] →      │  ← Tabs, horizontal scroll
│ 2 need attention · 6 normal  │
│ ┌──────────────────────────┐ │
│ │▌HIGH  HbA1c        6.1 % │ │  ← ResultCard, full width
│ │ HbA1c · German           │ │
│ │ ━━━━━[green]━━━━●        │ │  ← RangeBar
│ │ Normal here: 4.0–5.6 %   │ │
│ │ Average blood sugar...   │ │
│ └──────────────────────────┘ │
│ ...more cards                │
│ Compare: [HbA1c ▾]           │
│  Dhaka 2025   5.6 %  normal  │
│  Berlin 2026  6.1 %  HIGH ↑  │
├──────────────────────────────┤
│ [🩺 Doctor brief] [🛡 AI log•]│  ← sticky bottom action bar
└──────────────────────────────┘
```
- **Doctor brief** opens a shadcn `Drawer` (bottom sheet) on mobile.
- **AI log** opens a shadcn `Sheet` (side="bottom") on mobile; the button shows a pulsing dot + count badge when new entries arrive.
- Bottom bar: `fixed bottom-0`, full width, two large buttons (min height 48px), with safe-area padding (`pb-[env(safe-area-inset-bottom)]`). Add bottom padding to the page so content isn't hidden behind it.

**Tablet (`md:` ≥ 768px)**: result cards in 2 columns, bottom bar stays.

**Desktop/projector (`lg:` ≥ 1024px)**: max width ~1200px, two-column layout:
- Left (`lg:col-span-8`): upload, tabs, summary, cards (3 columns at `xl:`), compare.
- Right (`lg:col-span-4`): **AccessLog always visible** in a sticky Card (`sticky top-20`). Doctor brief button moves into the SummaryBar; the bottom bar is hidden (`lg:hidden`).
- Doctor brief opens as a centered `Dialog` on desktop (use a `useMediaQuery("(min-width: 768px)")` hook: Dialog on desktop, Drawer on mobile, the standard shadcn responsive dialog pattern).

### 8.3 Components (shadcn mapping)

| Component | shadcn parts | Behaviour |
|---|---|---|
| `Header` | `Select`, `Button` | Sticky, blurred background (`backdrop-blur bg-background/80 border-b`). Logo icon + "Lab Buddy"; tagline hidden on mobile. Language `Select`: English, Deutsch, বাংলা, Türkçe. Changing it refetches with `?lang=` and re-renders explanations only. |
| Banner | `Alert` | "Synthetic demo data. Not medical advice." Amber, one line on mobile. |
| `UploadZone` | `Card`, `Button`, `Progress` | Dashed border, drag & drop on desktop, tap to pick on mobile. `<input type="file" accept=".pdf,image/*" capture="environment">` so phones can **take a photo of a report**. Loading: `Progress` (indeterminate) + rotating messages every 1.5s ("Reading your report…", "Translating test names…", "Checking normal ranges…"). Error: destructive `Alert` + Retry button. Success: `sonner` toast "Report added". |
| `ReportTabs` | `Tabs` (inside a horizontally scrollable row) | One tab per report: `City · year · LANG`. Active tab loads that report. |
| `SummaryBar` | `Badge`, `Button` | "**2** need attention · **6** normal". On desktop also the "Doctor brief (Deutsch)" button. |
| `ResultCard` | `Card`, `Badge`, `Tooltip` | Colored left border (`border-l-4`) + status Badge. Title `name_en`; subtitle `original_name · source language`; big value + unit; `RangeBar`; "Normal on this report: x–y unit"; explanation in the selected language. Abnormal first. Grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3`. |
| `RangeBar` | plain divs | Thin bar (h-2, rounded). Normal zone shaded green, a dot marks the value (red/blue if outside). Clamp the dot inside the bar. If the range is missing, hide the bar. |
| `DoctorBrief` | `Dialog` (desktop) / `Drawer` (mobile), `Button`, `ScrollArea` | Title "Für Ihren Arzt / For your doctor". German text in a readable box. "Show in English" toggle. **Copy** button → icon switches to `Check` + toast "Copied". |
| `CompareView` | `Card`, `Select`, `Badge` | Select lists tests found in 2+ reports; default to the first one whose flag changed (HbA1c in the demo). Rows by date: place + year + language, value, Badge, change vs previous (`TrendingUp`/`TrendingDown` + diff, red if it became abnormal). On mobile rows are stacked cards, not a wide table. |
| `AccessLog` | `Card` (desktop) / `Sheet` (mobile), `ScrollArea`, `Badge` | Title "AI access log" + pulsing green dot "live". Polls `/api/access-log` every 3s, newest first, max 10. Row: time · actor Badge (`MCP` purple, `WEB` grey) · action · scope. New rows flash a light yellow background for 2s **and** trigger a toast "AI read: get_abnormal_results" (key demo moment). Footer: "AI assistants can only see abnormal results and the doctor brief." |
| `EmptyState` | `Card`, `Button` | Icon + "Upload your first lab report" + **"Try a sample report"** button → `POST /api/load-sample/{n}` (stage backup). |
| Loading | `Skeleton` | Skeleton cards while a report loads. |

### 8.4 Mobile rules (must follow)
- Every tap target ≥ 44px tall; buttons full-width on mobile where it makes sense.
- No horizontal scrolling of the page (only the tabs row scrolls).
- Body text ≥ 16px on mobile (prevents iOS zoom on inputs).
- Test with Chrome DevTools at **390×844 (iPhone)** and **1920×1080**.
- Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Optional if time: make it installable (simple `manifest.json` + icon) so it can be "added to home screen" in the demo.

### 8.5 Behaviour rules
- UI labels stay in English; only explanations change language.
- Never show raw JSON or stack traces.
- Every fetch has loading (Skeleton/Progress) and error (Alert/toast) states.
- Keep state in `App.tsx` with `useState`/`useEffect`; no state library, no router.
- All API calls go through `src/lib/api.ts` with types from `src/types.ts`.

### 8.6 UI "done" checklist
- [ ] Looks great at 390px and 1920px; no horizontal page scroll on mobile
- [ ] Phone can upload by taking a photo
- [ ] Abnormal cards first, with Badge + colored border + RangeBar
- [ ] Language switch changes explanations without a page reload
- [ ] Doctor brief: Drawer on mobile, Dialog on desktop, Copy works
- [ ] Compare shows the HbA1c change across two languages
- [ ] Access log: sticky panel on desktop, bottom Sheet on mobile, flashes + toasts on MCP calls
- [ ] "Try a sample report" works

## 9. MCP server

`mcp_server.py` using `FastMCP("lab-buddy")`, stdio. Tools (each writes one row to `access_log` with `actor="mcp"`):

- `get_abnormal_results()` → list of abnormal results (name_en, value, unit, range_text, flag, report_date, country). **Never** returns normal results or filenames.
- `get_doctor_brief(report_id: int | None = None)` → German brief for the latest (or given) report.
- `compare_test(test_name: str)` → values for one test across reports.

Claude Desktop config (`claude_desktop_config.json`):
```json
{ "mcpServers": { "lab-buddy": {
    "command": "/ABS/PATH/lab-buddy/.venv/bin/python",
    "args": ["/ABS/PATH/lab-buddy/mcp_server.py"] } } }
```

## 10. Demo data

Create two synthetic reports in `samples/` (generate as PDFs with reportlab or as HTML printed to PDF):
1. **German** "Laborbefund", Berlin, 2026 — Hämoglobin, Leukozyten, Glukose (nüchtern), HbA1c, Kreatinin, TSH, Vitamin D, Ferritin. Make Vitamin D low, HbA1c slightly high.
2. **Home-country** report (e.g. Bangla or Turkish), 2025 — same tests in that language, HbA1c normal but borderline.
Story: HbA1c got worse between 2025 and 2026 → shows in compare view.
Note: for Bangla PDFs, embed a Bangla font (e.g. Noto Sans Bengali), or the text will render as boxes.

---

## Phase prompts (paste into Claude Code one at a time)

**Phase 0 — Setup (0:00–0:15)**
> Read CLAUDE.md. Set up the project structure from section 4: backend (requirements.txt, .env.example, venv, db.py with the schema from section 5) and frontend (`web/` with Vite + React + TS + Tailwind + shadcn/ui, components from section 3 installed, Vite proxy `/api` → :8000, Slate theme with blue primary). Add a tiny script that calls Gemini with "say hi" to verify the API key. Run it, and start the Vite dev server to confirm a shadcn Button renders.
Done when: Gemini replies and a shadcn Button shows in the browser.

**Phase 1 — Demo data (parallel, teammate)**
> Following section 10 of CLAUDE.md, generate the two synthetic lab report PDFs in samples/. Make them look like real lab printouts (header, lab name, patient "Demo Patient", table of tests).
Done when: both PDFs open and look realistic.

**Phase 2 — Extraction + upload (0:15–0:55)**
> Implement extractor.py (section 6) and POST /api/upload, GET /api/reports, GET /api/reports/{id} (section 7, English only for now). Test with curl on both sample PDFs and print the JSON.
Done when: both samples parse with correct values, ranges and flags; test names match across languages.

**Phase 3 — Frontend (0:55–1:30)**
> Build the frontend in web/ exactly per section 8, mobile-first, using shadcn components. Order: (a) types.ts + lib/api.ts; (b) Header, banner, UploadZone (loading/error/toast, camera capture), ReportTabs, EmptyState with "Try a sample report"; (c) SummaryBar + ResultCard + RangeBar, abnormal first, Skeleton loading; (d) language Select; (e) DoctorBrief (Drawer on mobile, Dialog on desktop) with copy; (f) CompareView; (g) sticky bottom action bar on mobile and the desktop 2-column layout. Leave AccessLog as a placeholder for Phase 4. Check at 390px and 1920px.
Done when: the section 8.6 checklist passes (except the access log item).

**Phase 4 — MCP + access log (1:30–2:00)**
> Implement mcp_server.py per section 9 and GET /api/access-log, plus the auto-refreshing access log panel. Web reads also log with actor="web". Print the Claude Desktop config with my absolute paths.
Build AccessLog per section 8.3 (sticky Card on desktop, bottom Sheet on mobile, flash + toast on new rows).
Done when: asking Claude Desktop "What was abnormal in my lab results?" returns the right values, and a new row flashes in the web log on both desktop and mobile.

**Phase 5 — Polish (2:00–2:15)**
> Polish the UI (spacing, empty states, error message if extraction fails, nice header). Write README.md with setup, run commands, and the demo script. Don't add new features.

**Phase 6 — Demo prep (2:15–2:30)**
Reset DB → upload German report → switch language → doctor brief → upload home report → compare HbA1c → Claude Desktop question → access log updates. Record a backup video.

## Run

```
# terminal 1 (backend)
uvicorn app.main:app --reload --port 8000
# terminal 2 (frontend)
cd web && npm run dev          # open the Vite URL; add --host to test on your phone on the same Wi-Fi
# MCP: launched by Claude Desktop, not by hand
```

## If something breaks

- Gemini misreads a report → try a clearer PDF, or set `GEMINI_MODEL` to a Pro model.
- shadcn init fails or is slow → use the current Vite steps from ui.shadcn.com; don't spend more than 15 min on setup.
- Running out of time → drop languages (keep EN + DE brief), drop compare. Never drop upload → cards.
- MCP not connecting → check absolute paths, restart Claude Desktop fully, check its MCP logs.
