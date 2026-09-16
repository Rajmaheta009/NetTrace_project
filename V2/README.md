# NetTrace AI v2.0 — FastAPI Backend Service

This directory contains the Python FastAPI backend for **NetTrace AI v2.0**, providing deterministic graph analysis (NetworkX), AI entity extraction & narrative briefing (Groq Llama 3.3 70B), multi-modal data ingestion, and forensic security audit logging.

For complete project documentation, see the root [README.md](../README.md).

---

## Quick Setup & Run

```bash
# 1. Create and activate virtual environment
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and enter your GROQ_API_KEY

# 4. Start backend server
python -m uvicorn app.main:app --reload --port 8000
```

- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **OpenAPI JSON**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)
- **Healthcheck**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Production Web App**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/) (serves compiled `../frontend/dist`)

---

## Endpoints Overview

| Method | Path | Purpose |
|:---|:---|:---|
| `GET` | `/health` | Server health, active node/edge count, and Groq status |
| `POST` | `/api/audit/log` | Record officer activity in the immutable security audit log |
| `GET` | `/api/audit/trail` | Retrieve recent immutable audit trail records |
| `POST` | `/api/import` | Ingest CSV, JSON, or text with automated classifier triage |
| `POST` | `/api/import/file` | Multipart file upload with binary validation and triage |
| `GET` | `/api/graph` | Full graph as node-link JSON with computed centralities |
| `GET` | `/api/graph/centrality` | Actors ranked by degree and betweenness centrality |
| `GET` | `/api/graph/patterns` | Algorithmic suspicious pattern indicators |
| `GET` | `/api/graph/entity/{id}` | Suspect dossier, 1-hop neighborhood & evidence links |
| `GET` | `/api/graph/summary` | Groq AI generated narrative investigation briefing |
| `POST` | `/api/graph/reset` | Clear memory (empty diagram by default) |
| `POST` | `/api/graph/clear` | Clear memory (0 nodes, 0 edges) |
| `POST` | `/api/graph/load-demo` | Clear memory and load the Black Lotus sample syndicate |

---

## Module Architecture

| Module | File | Responsibility |
|:---|:---|:---|
| **API Layer** | `app/main.py` | FastAPI app, CORS, security validation, static mount |
| **Data Classifier** | `app/data_classifier.py` | Heuristic triage: structured, semi-structured, unstructured |
| **Import Engine** | `app/import_module.py` | Deterministic CSV/JSON parsers & schema validators |
| **Entity Extractor** | `app/extraction.py` | RegEx pre-pass + Groq Llama 3.3 NER + edge validator |
| **Graph Store** | `app/graph_store.py` | Thread-safe MultiGraph, attribute merging & de-duplication |
| **Analytics Engine** | `app/analytics.py` | Deterministic NetworkX degree & betweenness centrality |
| **Pattern Detector** | `app/patterns.py` | Brokers, dense cliques, shared infrastructure & co-occurrence |
| **Forensic Summary** | `app/summary.py` | Groq Llama 3.3 narrative synthesis & tactical recommendation |
| **LLM Client** | `app/ai_client.py` | Resilient Groq Cloud client wrapper with prompt shielding |
| **Audit Logger** | `app/audit_logger.py` | File-based append logger (`user_activity_audit.log`) |
| **Seed Data** | `app/sample_data.py` | Black Lotus Syndicate seed entities & relationships |

---

## Security & Deterministic AI Boundary

1. **Deterministic Analytics**: NetworkX handles 100% of mathematical centrality calculations and pattern detections. The AI never computes or modifies graph metrics.
2. **Referential Integrity**: Extracted relationships are rejected if source or target entities were not identified in the entity set.
3. **Audit Trail**: Every significant action writes to `logs/user_activity_audit.log` in format `username_or_id :- action details`.
4. **DoS Guard**: Uploads strictly limited to `MAX_UPLOAD_BYTES` (10 MB).
5. **Binary Rejection**: Magic-byte analysis rejects PDFs, DOCX, ZIPs, and images masquerading as text.
