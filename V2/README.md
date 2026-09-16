# Criminal Network Analysis — Backend (Hackathon Prototype)

FastAPI backend built exactly to `Criminal_Network_Analysis_PRD.docx` (sections 10-17).

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in GEMINI_API_KEY
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

## Endpoints (PRD section 14)

| Method | Path                        | Purpose |
|--------|-----------------------------|---------|
| POST   | `/api/import`               | Import CSV, JSON, or pasted text as a JSON body; runs extraction and merges into the graph |
| POST   | `/api/import/file`          | Import a real uploaded file (multipart/form-data) - same auto-detect logic |
| GET    | `/api/graph`                | Full graph as node-link JSON |
| GET    | `/api/graph/centrality`     | Entities ranked by degree + betweenness |
| GET    | `/api/graph/patterns`       | Suspicious-pattern flags |
| GET    | `/api/graph/entity/{id}`    | One entity's detail, 1-hop neighborhood, evidence |
| GET    | `/api/graph/summary`        | AI-generated plain-English investigation summary |
| POST   | `/api/graph/reset`          | Clear the graph and reload the section-18 sample dataset |

### `POST /api/import` body

```json
{ "type": "csv" | "json" | "text", "content": "...", "source_label": "report_03" }
```

`type` is now **optional**. If you omit it, `app/data_classifier.py` inspects `content`
and auto-detects one of three buckets before anything is parsed:

- **structured** — CSV or JSON that already matches the exact entity schema
  (`id,type,name,...`) or relationship schema (`source,target,relation_type,...`), or JSON
  shaped `{"entities": [...], "relationships": [...]}`. Goes straight to the deterministic
  parsers, same as declaring `type` explicitly.
- **semi_structured** — valid CSV/JSON with an unknown/ad-hoc shape (different column
  names, nested objects, key:value log lines), or well-formed CSV with unexpected columns.
  Flattened into readable `key: value` text blocks and routed through the AI-assisted text
  pipeline (regex pre-pass + LLM extraction + evidence validation — no new AI call site).
- **unstructured** — free-form prose/reports. Routed through the text pipeline unchanged.

The response includes `detected_input_type` (`"structured" | "semi_structured" |
"unstructured" | null`) so the frontend can show what was detected. Classification itself
is pure `csv`/`json` stdlib heuristics — **AI Usage: None**, consistent with the PRD's AI
boundary (the AI never decides how input gets routed).

### `POST /api/import/file` — real file uploads

For an actual file (not pasted text in a JSON body), use `multipart/form-data`:

```bash
curl -X POST localhost:8000/api/import/file \
  -F "file=@my_report.csv" \
  -F "source_label=case_042"
```

`source_label` is optional (defaults to the filename). The file's content is decoded as
text and run through the exact same auto-detect path as `POST /api/import` with `type`
omitted. Text-based files only (csv, json, txt, log) — PDFs, DOCX, and images aren't
supported in this prototype (would need extra parsing/OCR libraries, out of scope);
convert to plain text first.

- **csv**: one CSV blob per call. Auto-detected as an entity table (`id,type,name,...`) or a
  relationship table (`source,target,relation_type,event_id`) — matches the PRD's sample data,
  which ships `entities.csv` and `relationships.csv` as two separate files/calls.
- **json**: `{"entities": [...], "relationships": [...]}` — either or both keys.
- **text**: free-text report(s), split on blank lines into chunks. Each chunk gets a regex
  pre-pass (phone numbers, vehicle plates) followed by one combined Gemini extraction call.

## Try it against the PRD's own sample data

```bash
curl -X POST localhost:8000/api/graph/reset
curl localhost:8000/api/graph/centrality
curl localhost:8000/api/graph/patterns
curl localhost:8000/api/graph/summary
```

`/api/graph/centrality` should surface **Rakesh Verma** as the top-ranked (broker) entity —
this matches the exact numbers shown in PRD section 19.

## Module map (matches PRD section 11 exactly)

| PRD Module | File |
|---|---|
| 0. Input Classification (structured/semi-structured/unstructured triage) | `app/data_classifier.py` |
| 1. Data Import & Preprocessing | `app/import_module.py` |
| 2 & 3. Entity & Relationship Extraction | `app/extraction.py` |
| 4. Graph Construction & In-Memory Store | `app/graph_store.py` |
| 5. Graph Analytics Engine | `app/analytics.py` |
| 6. Suspicious Pattern Detection | `app/patterns.py` |
| 7. Interactive Network Graph & Entity Explorer | *(frontend — not built yet)* |
| 8. AI-Assisted Investigation Summary | `app/summary.py` |
| — | `app/pipeline.py` orchestrates 1→6; `app/ai_client.py` is the single outbound Gemini call site |

## How the AI boundary is enforced (PRD section 15/17), not just documented

- **Two AI call sites only**, both behind `app/ai_client.py`: combined entity+relationship
  extraction (`extraction.py`), and narrative summary generation (`summary.py`). Centrality
  (`analytics.py`) and pattern detection (`patterns.py`) are pure NetworkX/Python — the AI
  never sees the graph and is never asked to score or judge anything.
- **Regex pre-pass first.** Phone numbers and vehicle plates are extracted deterministically
  before the LLM call, cutting hallucination risk and LLM load for those high-precision fields.
- **Relationship validation.** A relationship is only kept if both its source and target ids
  are present in that same extraction batch's entity list — hallucinated nodes/edges are
  rejected before they ever touch the graph, and rejections are returned in the response
  (`rejected_relationships` / `warnings`) rather than silently dropped.
- **Prompt-injection guard.** Untrusted report text is always sent as the user turn, never
  concatenated into the system instruction (PRD section 17).
- **Graceful degradation.** If `GEMINI_API_KEY` is missing or the call fails/times out, the
  deterministic core (import, graph, centrality, patterns) keeps working; only extraction-
  from-text and the AI summary degrade, with the reason surfaced in `warnings` / `summary`
  instead of a broken request. Verified in testing: the section-18 free-text sample still
  yields its regex-extracted phone number and plate even with no API key configured.
- **Server-side only.** The Gemini key is read from `.env` and never touches a response body.

## Testing note

This sandbox has no network access, so `pip install fastapi/pydantic/httpx` couldn't be run
here to launch a live `uvicorn` server. I verified the entire deterministic core end-to-end
with a temporary offline test harness instead (not shipped — this is real project code only):
sample-dataset import → graph build → centrality → all four pattern rules → AI-unavailable
summary fallback, plus a synthetic multi-entity graph to confirm each of the four pattern
rules (broker, shared-attribute, dense-subgroup, repeated co-occurrence) fires correctly in
isolation. Please run `uvicorn app.main:app --reload` locally with your API key before a live
demo to confirm the two Gemini-backed endpoints (`/api/import` on text, `/api/graph/summary`).

## Deliberate scope cuts (per PRD "Out of Scope" / risk table)

No auth, no persistent DB, no microservices — single in-process `networkx.MultiGraph`,
reset via `/api/graph/reset`. FR-11 (offline spaCy NER fallback) and FR-12 (SQLite
persistence) are marked Optional in the PRD and were **not** built — say the word if you want
either added next, or if you'd like the React/Vite/Tailwind frontend (Module 7) scaffolded
against these exact endpoints.
