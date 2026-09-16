# NetTrace AI v2.0 — FastAPI Backend Service Engine

[![Python Version](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.14-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Pydantic v2](https://img.shields.io/badge/Pydantic-v2.x-e92063.svg?logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)
[![NetworkX](https://img.shields.io/badge/NetworkX-3.x-orange.svg)](https://networkx.org/)
[![Groq Cloud](https://img.shields.io/badge/Groq%20Inference-Llama%203.3%2070B%20%2F%20GPT--OSS--120B-f55036.svg)](https://groq.com/)
[![Audit Logged](https://img.shields.io/badge/Security-Developer%20Audit%20Log%20on%20Disk-emerald.svg)](#security--developer-activity-audit-logger)

The **NetTrace AI v2.0 Backend** is a high-performance Python FastAPI service providing deterministic graph analytics, AI-assisted entity extraction, suspicious pattern detection, and forensic audit logging. Built in strict alignment with `Criminal_Network_Analysis_PRD` and verified against the 14-step integration test sequence in `NetTrace_Backend_Each_Page_Complete_Guide.docx`.

---

## Table of Contents

- [Architectural Philosophy: Deterministic AI Boundary](#architectural-philosophy-deterministic-ai-boundary)
- [Directory Layout](#directory-layout)
- [Module Responsibility Matrix](#module-responsibility-matrix)
- [Data Ingestion & Triage Pipeline](#data-ingestion--triage-pipeline)
- [Graph Construction & Non-Destructive Deduplication](#graph-construction--non-destructive-deduplication)
- [Deterministic Graph Analytics & Pattern Detection](#deterministic-graph-analytics--pattern-detection)
- [Complete API Reference (All 13 Endpoints)](#complete-api-reference-all-13-endpoints)
- [Security & Developer Activity Audit Logger](#security--developer-activity-audit-logger)
- [Environment Configuration (.env)](#environment-configuration-env)
- [Test Datasets & 14-Step PRD Verification Guide](#test-datasets--14-step-prd-verification-guide)
- [Troubleshooting & Diagnostic FAQ](#troubleshooting--diagnostic-faq)

---

## Architectural Philosophy: Deterministic AI Boundary

In mission-critical criminal syndicate intelligence, **algorithmic predictability and evidence provenance are paramount**. The backend maintains an ironclad boundary between deterministic code and generative LLMs:

```
[ Ingested Data ] 
       │
       ▼
[ Data Classifier (stdlib) ] ───► Structured CSV/JSON ──► Deterministic Parsers ──┐
       │                                                                         │
       ├─► Semi-Structured / Unstructured                                        │
       │          │                                                              │
       │          ▼                                                              │
       │   [ Regex Pre-Pass ] (Phones, Vehicle Plates)                           │
       │          │                                                              │
       │          ▼                                                              │
       │   [ Groq LLM NER ] (Entities & Relationships)                           │
       │          │                                                              │
       │          ▼                                                              │
       │   [ Referential Integrity Validator ] (Drop unconfirmed edges)         │
       │          │                                                              │
       └──────────┴──────────────────────────────────────────────────────────────┤
                                                                                 ▼
                                                                 [ GraphStore (NetworkX) ]
                                                                 - Safe attribute merging
                                                                 - Undirected edge dedup
                                                                                 │
                                                                                 ▼
                                                                 [ Pure NetworkX Analytics ]
                                                                 - Degree & Betweenness Centrality
                                                                 - 4 Pattern Detection Rules
                                                                                 │
                                                                                 ▼
                                                                 [ Groq Forensic Briefing ]
                                                                 - Plain-English synthesis
                                                                 - Zero metric computation
```

### Core Invariants
1. **AI Never Computes Metrics**: Degree centrality, betweenness centrality, articulation points, and pattern flags are calculated 100% deterministically by NetworkX. The LLM is never asked to calculate scores or assign guilt.
2. **Referential Integrity Enforcement**: Extracted relationships are rejected if either endpoint (`source` or `target`) is not in the confirmed entity set. Hallucinated ghost edges are dropped before touching the graph.
3. **Deterministic Pre-Parsing**: Phone numbers and license plates are extracted via RegEx before the LLM call, reducing LLM token consumption and eliminating hallucination risk for high-precision fields.
4. **Prompt Injection Hardening**: Ingested text is sent strictly as the `user` turn, never concatenated into the `system` instruction.

---

## Directory Layout

```text
V2/
│
├── .env                       # Local environment variables & secrets (gitignored)
├── .env.example               # Safe environment variable template
├── .gitignore                 # Backend-specific ignore rules
├── requirements.txt           # Python dependency requirements
├── README.md                  # This developer documentation
│
├── app/                       # Application source code
│   ├── __init__.py            # Package root marker
│   ├── main.py                # FastAPI app initialization, routes, & static mount
│   ├── config.py              # Environment variable loader & settings validation
│   ├── models.py              # Pydantic v2 schemas for requests, responses, & entities
│   ├── data_classifier.py     # Heuristic data triage (structured/semi-structured/unstructured)
│   ├── import_module.py       # Deterministic CSV/JSON parsers with whitespace & alias handling
│   ├── extraction.py          # RegEx pre-pass + Groq Llama 3.3 NER + edge validator
│   ├── graph_store.py         # Thread-safe NetworkX MultiGraph store & intelligent de-duplicator
│   ├── analytics.py           # NetworkX degree and betweenness centrality engine
│   ├── patterns.py            # Graph-theoretic pattern algorithms with semicolon event splitting
│   ├── summary.py             # Groq AI narrative investigation summary generator
│   ├── ai_client.py           # Resilient Groq HTTP client with fallback model rotation
│   ├── audit_logger.py        # File-based immutable security activity logger
│   └── sample_data.py         # Black Lotus syndicate sample seed fixtures
│
├── logs/                      # Runtime application logs
│   └── user_activity_audit.log# Developer-only immutable audit trail
│
└── testing/                   # Test fixtures & verification datasets
    ├── 01_entities.csv        # Structured suspect & asset table
    ├── 02_relationships.csv   # Structured interaction edge table
    ├── 03_combined_case.json  # Multi-entity mixed case JSON
    ├── 04_unstructured_case.txt # Free-text surveillance report for LLM NER
    ├── 05_repeated_events.txt # Temporal multi-meeting co-occurrence test
    ├── 06_shared_attribute_test.txt # Shared burner phone & vehicle bridge test
    ├── 07_invalid_relationship.json # Ghost node rejection test fixture
    ├── 08_simple_text.txt     # Minimal text extraction test
    ├── 10_syndicate_black_lotus.json # Full enterprise syndicate case (25+ nodes)
    ├── 11_syndicate_entities.csv # Syndicate entity roster
    ├── 12_syndicate_relationships.csv # Syndicate relational edge table
    ├── 13_syndicate_surveillance_brief.txt # Intercept logs & informant briefs
    ├── 1_structured_entities.csv # Normalized benchmark entity table
    ├── 2_semi_structured_contacts.csv # Benchmark contacts table (ad-hoc columns)
    └── 3_unstructured_report.txt # Field briefing benchmark text
```

---

## Module Responsibility Matrix

| Module | File | Responsibility | AI Dependency |
|:---|:---|:---|:---|
| **API Entrypoint** | `app/main.py` | FastAPI routing, CORS, file upload guards, static UI mount | None |
| **Data Models** | `app/models.py` | Pydantic v2 schemas (`Entity`, `Relationship`, `ImportResponse`, etc.) | None |
| **Configuration** | `app/config.py` | Reads `.env`, validates Groq keys, sets algorithm thresholds | None |
| **Data Classifier** | `app/data_classifier.py` | Triages input to structured, semi-structured, or unstructured | None (Pure stdlib) |
| **Import Module** | `app/import_module.py` | CSV/JSON parsing, whitespace trimming, column alias normalization | None |
| **Extraction Engine** | `app/extraction.py` | RegEx pre-pass + Groq Llama 3.3 NER + relationship validation | Groq (Llama 3.3 / GPT-OSS) |
| **Graph Store** | `app/graph_store.py` | In-memory NetworkX `MultiGraph`, attribute merging, edge de-duplication | None |
| **Analytics Engine** | `app/analytics.py` | NetworkX normalized Degree & Betweenness Centrality calculations | None |
| **Pattern Detector** | `app/patterns.py` | Broker, Shared Attribute, Dense Clique, Repeated Co-occurrence algorithms | None |
| **AI Summary** | `app/summary.py` | Translates pre-calculated metrics & pattern flags into narrative prose | Groq (Llama 3.3 / GPT-OSS) |
| **AI Client** | `app/ai_client.py` | HTTP client wrapper for Groq Cloud API with model fallback retry | Groq Client |
| **Audit Logger** | `app/audit_logger.py` | Thread-safe append logger writing to `logs/user_activity_audit.log` | None |
| **Seed Fixtures** | `app/sample_data.py` | Built-in seed data for `/api/graph/reset?load_sample=true` | None |

---

## Data Ingestion & Triage Pipeline

### 1. Triaging Incoming Data (`app/data_classifier.py`)
When `POST /api/import` or `POST /api/import/file` is called without an explicit `type`, `classify_and_normalize()` inspects the raw payload:
- **`structured`**: JSON containing `"entities"` or `"relationships"` keys, or CSV whose headers contain `{id, type, name}` or `{source, target, relation_type}`. Routed directly to deterministic parsers.
- **`semi_structured`**: Valid CSV or JSON with non-standard column names (`full_name`, `mobile_number`, `linked_person`). Flattened into key-value blocks and routed through the extraction pipeline.
- **`unstructured`**: Free-form text (surveillance logs, FIR transcripts). Sent directly to extraction.

### 2. Dual-Stage Extraction (`app/extraction.py`)
- **Stage 1 (RegEx Pre-Pass)**:
  - Phone numbers: `(\+?\d{1,3}[-\s]?\d{4,5}[-\s]?\d{4,6})` (E.164 and local).
  - Vehicle plates: `[A-Z]{2}-?\d{2}-?[A-Z]{1,2}-?\d{3,4}`.
  - Extracted entities receive typed `PhoneNumber` and `Vehicle` records deterministically.
- **Stage 2 (Groq AI Extraction)**:
  - The chunk is submitted to Groq in JSON mode with `EXTRACTION_SYSTEM_PROMPT`.
  - Returned entities and relationships are normalized into canonical Enums (`EntityType`, `RelationType`).
  - **Validation Guard**: Every relationship is checked against the confirmed entity set. If `source` or `target` is missing, the relationship is rejected and recorded in `rejected_relationships`.

---

## Graph Construction & Non-Destructive Deduplication

Managed by `GraphStore` in `app/graph_store.py`:

1. **Entity Upsert & Deduplication**:
   - Matching priority: Exact ID $ightarrow$ Normalized Name $ightarrow$ Shared Phone Number $ightarrow$ Aliases.
   - **Attribute Merging**: When a matching entity is imported, existing attributes are preserved. New attributes are merged rather than overwritten. Aliases and source references are unified.
2. **Undirected Relationship Deduplication**:
   - Criminal networks are undirected (`MultiGraph`). If edge $A \leftrightarrow B$ exists with relation `KNOWS`, importing $B \leftrightarrow A$ merges evidence quotes and takes the maximum weight rather than creating redundant parallel edges.
   - **Event ID Preservation**: Merged events are stored as semicolon-separated strings (e.g., `"EV_01; EV_02"`).
3. **Endpoint Resolution**:
   - Relationships can reference entities by primary UUID, display name, or alias. `pipeline.py` maps names and aliases to internal IDs automatically.

---

## Deterministic Graph Analytics & Pattern Detection

### Centrality Engine (`app/analytics.py`)
Multi-edges are collapsed into a simple graph for standard network theory metrics:
- **Degree Centrality ($C_D$)**: Measures direct connections normalized by $N-1$. Identifies high-visibility operational figures.
- **Betweenness Centrality ($C_B$)**: Measures the fraction of shortest paths passing through a node. Identifies strategic cut-points and information brokers.

### Pattern Detection Rules (`app/patterns.py`)
1. **Broker / Bridge**:
   - Identifies nodes whose betweenness is at or above the 80th percentile (`BROKER_BETWEENNESS_PERCENTILE = 0.80`), or that act as **articulation points** (nodes whose removal increases the number of connected components). Severity: `high` for articulation points, `medium` otherwise.
2. **Shared Attribute**:
   - Flags any `PhoneNumber`, `Vehicle`, or `Location` connected to 2 or more distinct `Person` entities. Indicates shared burner devices, co-travel, or common safehouses. Severity: `high`.
3. **Dense Subgroup**:
   - Detects connected subgraphs of size $\ge 3$ (`DENSE_SUBGROUP_MIN_SIZE`) with edge density $\ge 0.6$ (`DENSE_SUBGROUP_DENSITY_THRESHOLD`). Flags tightly knit operational cells. Severity: `medium`.
4. **Repeated Co-occurrence**:
   - Flags pairs of `Person` entities linked to the same `Event` or sharing edges with distinct `event_id` tags $\ge 2$ times (`REPEATED_COOCCURRENCE_MIN_EVENTS = 2`). Handles semicolon-separated merged event IDs cleanly. Severity: `medium`.

---

## Complete API Reference (All 13 Endpoints)

| Method | Path | Request Parameters / Body | Response Schema | Description |
|:---|:---|:---|:---|:---|
| `GET` | `/health` | None | `{"status": str, "nodes": int, "edges": int, "groq_configured": bool, "groq_model": str}` | System health, graph size, and Groq status. |
| `POST` | `/api/audit/log` | `{"user_id": str, "action": str, "details": str}` | `{"timestamp": str, "user_id": str, "action": str, "details": str, "raw": str}` | Appends user activity to `logs/user_activity_audit.log`. |
| `GET` | `/api/audit/trail` | Query: `limit: int = 100` | `list[dict]` (audit entries newest to oldest) | Returns recent immutable audit log entries (developer inspection). |
| `POST` | `/api/import` | `{"type": str\|null, "content": str, "source_label": str\|null}` | `ImportResponse` | Ingests CSV, JSON, or text with auto-classification triage. |
| `POST` | `/api/import/file` | Form: `file: UploadFile`, `source_label: str\|null` | `ImportResponse` | Multipart upload with magic-byte binary rejection and DoS size cap. |
| `GET` | `/api/graph` | None | `GraphResponse` (`nodes`, `links`, `multigraph: true`) | Returns full graph as node-link JSON with computed centralities. |
| `GET` | `/api/graph/centrality` | None | `list[CentralityEntry]` (`id`, `name`, `degree`, `betweenness`) | Entities ranked by degree desc, betweenness desc. |
| `GET` | `/api/graph/patterns` | None | `list[PatternFlag]` (`pattern_type`, `entities_involved`, `evidence`, `severity`) | Evaluates all 4 deterministic pattern rules. |
| `GET` | `/api/graph/entity/{id}` | Path: `entity_id: str` | `EntityDetailResponse` (`entity`, `centrality`, `connections`) | Single entity dossier, 1-hop neighbors, and evidence notes. |
| `GET` | `/api/graph/summary` | None | `SummaryResponse` (`summary`, `entities_to_watch`) | Groq Llama 3.3 narrative investigative synthesis. |
| `POST` | `/api/graph/reset` | Query: `load_sample: bool = false` | `ImportResponse` | Clears memory. If `load_sample=true`, seeds demo case. Default: empty. |
| `POST` | `/api/graph/clear` | None | `ImportResponse` (`node_count: 0`, `edge_count: 0`) | Completely wipes in-memory graph to empty state. |
| `POST` | `/api/graph/load-demo` | None | `ImportResponse` | Clears memory and loads the complete Black Lotus demo case. |

---

## Security & Developer Activity Audit Logger

### 1. Developer-Only Audit Log File (`logs/user_activity_audit.log`)
- **Design Intent**: Activity logging is implemented strictly for backend auditing and forensic verification on disk. **It is not exposed as a UI feature in the web app.**
- **Log Format**:
  ```text
  [2026-09-16 17:29:05] [SECURITY AUDIT] Analyst_User :- import_data | type=unstructured entities=10 rels=14
  [2026-09-16 17:30:12] [SECURITY AUDIT] Analyst_Officer_902 :- look3d graph | Rotated 3D camera to yaw=1.15, pitch=-0.65
  [2026-09-16 17:30:18] [SECURITY AUDIT] Analyst_Officer_902 :- double_click node info | Inspected full dossier for "Rakesh Verma" (Person)
  [2026-09-16 17:30:45] [SECURITY AUDIT] Analyst_User :- reset_graph | Memory wiped, diagram cleared
  ```
- **Thread Safety**: Appending uses a dedicated `threading.Lock` to guarantee atomic writes even under concurrent requests.

### 2. Denial-of-Service & Binary Rejection Guards
- **File Upload Cap**: `MAX_UPLOAD_BYTES = 10485760` (10 MB). Uploads exceeding this threshold are rejected with HTTP 413.
- **Magic-Byte Binary Scanner**: Inspects initial byte signatures. If `%PDF-`, `PK` (DOCX/ZIP), `PNG`, or `ÿØÿ` (JPEG) are detected, the request is rejected with HTTP 400.

---

## Environment Configuration (.env)

| Key | Default | Description |
|:---|:---|:---|
| `GROQ_API_KEY` | *(Required)* | Groq Cloud API authorization token. |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Target Groq model (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`). |
| `GROQ_API_URL` | `https://api.groq.com/openai/v1/chat/completions` | OpenAI-compatible completions endpoint. |
| `GROQ_TIMEOUT_SECONDS` | `30` | Timeout before triggering fallback model retry or graceful degradation. |
| `BROKER_BETWEENNESS_PERCENTILE` | `0.80` | Cutoff percentile for broker pattern detection. |
| `DENSE_SUBGROUP_MIN_SIZE` | `3` | Minimum component node count to qualify as a cell. |
| `DENSE_SUBGROUP_DENSITY_THRESHOLD` | `0.6` | Minimum edge density for dense subgroup detection. |
| `REPEATED_COOCCURRENCE_MIN_EVENTS` | `2` | Minimum co-occurrence count across distinct events. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:8000` | Allowed browser origins. |
| `MAX_UPLOAD_BYTES` | `10485760` | Maximum allowed file upload size (10 MB). |
| `MAX_TEXT_BYTES` | `5242880` | Maximum string payload size (5 MB). |

---

## Test Datasets & 14-Step PRD Verification Guide

The backend includes 15 benchmark fixtures in `testing/`. The entire stack has been verified with **100% pass rates**:
- **Automated Edge-Case Suite**: 25 / 25 tests passed.
- **PRD Integration Sequence**: 14 / 14 steps passed.

### Running the PRD 14-Step Test Sequence via cURL:

```bash
# 1. Healthcheck
curl http://127.0.0.1:8000/health

# 2. Reset and load sample seed
curl -X POST "http://127.0.0.1:8000/api/graph/reset?load_sample=true"

# 3. Verify graph nodes and links
curl http://127.0.0.1:8000/api/graph

# 4. Check centrality ranking (Rakesh Verma #1)
curl http://127.0.0.1:8000/api/graph/centrality

# 5. Check pattern detection flags
curl http://127.0.0.1:8000/api/graph/patterns

# 6. Inspect individual entity dossier
curl http://127.0.0.1:8000/api/graph/entity/e1

# 7. Clear memory to empty state
curl -X POST http://127.0.0.1:8000/api/graph/clear

# 8. Upload structured syndicate dataset (CSV)
curl -X POST http://127.0.0.1:8000/api/import/file -F "file=@testing/01_structured_syndicate.csv"

# 9. Re-verify graph connectivity and edge attributes
curl http://127.0.0.1:8000/api/graph

# 10. Upload semi-structured network dataset (JSON)
curl -X POST http://127.0.0.1:8000/api/import/file -F "file=@testing/02_semistructured_network.json"

# 11. Upload unstructured surveillance brief (TXT - AI/Heuristic NER)
curl -X POST http://127.0.0.1:8000/api/import/file -F "file=@testing/03_unstructured_case_report.txt"

# 12. Upload multi-vector tactical intercept logs (LOG)
curl -X POST http://127.0.0.1:8000/api/import/file -F "file=@testing/04_multivector_intercepts.log"

# 13. Generate plain-English AI investigation summary
curl http://127.0.0.1:8000/api/graph/summary

# 14. Inspect developer audit trail
curl "http://127.0.0.1:8000/api/audit/trail?limit=10"
```

---

## The 4 Comprehensive Test Datasets (`V2/testing/`)

The testing suite contains exactly 4 deep, multi-vector datasets covering all formats, schemas, and investigative operational dimensions:

| File | Format | Classification | Description & Coverage |
| :--- | :--- | :--- | :--- |
| **`01_structured_syndicate.csv`** | `.csv` | `structured` | Full tabular syndicate schema with dual entity & relationship support, Hawala transfers (`₹ 19.95 Cr`), CDR telecom pings (towers, duration), ANPR sightings, and cell cliques. |
| **`02_semistructured_network.json`** | `.json` | `structured` / `semi_structured` | Hierarchical JSON case containing complete node and edge attributes, Hawala layering paths, burner IMEIs, and multi-event co-occurrences. |
| **`03_unstructured_case_report.txt`** | `.txt` | `unstructured` | High-density narrative police intelligence dossier (`OPERATION FALCON SHADOW`) with suspects, corporate fronts, Port of Nhava Sheva drops, and bribery. |
| **`04_multivector_intercepts.log`** | `.log` | `semi_structured` / `text` | Tactical intercept event stream containing automated ANPR plate hits, CDR call logs, wiretaps, and Hawala recovery chits. |

---

## Troubleshooting & Diagnostic FAQ

### 1. `AI summary is unavailable right now`
- **Cause**: Invalid or expired `GROQ_API_KEY`, or model rate limit reached.
- **Remedy**: Verify your API key at [console.groq.com](https://console.groq.com/). The deterministic graph core (centrality, patterns, graph store, fallback extraction) continues to function normally even if the AI summary is unavailable.

### 2. `Rejected structured relationship - unconfirmed entity`
- **Cause**: A relationship row referenced a `source` or `target` ID that was not previously imported into the entity registry.
- **Remedy**: Ensure the entity records are included in the same file or imported prior to the relationships.

### 3. `Nodes > 0, Links == 0`
- **Cause**: Entities have been imported, but no relationship records have been supplied yet.
- **Remedy**: Import `01_structured_syndicate.csv` or `02_semistructured_network.json`.
