"""
Criminal Network Analysis - FastAPI entrypoint

Implements exactly the API surface from PRD section 14:
  POST /api/import
  GET  /api/graph
  GET  /api/graph/centrality
  GET  /api/graph/patterns
  GET  /api/graph/entity/{id}
  GET  /api/graph/summary
  POST /api/graph/reset

Thin routing layer only - business logic lives in the module files.
"""

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analytics import compute_centrality, ranked_entities
from app.config import CORS_ORIGINS, GROQ_API_KEY, GROQ_MODEL, MAX_UPLOAD_BYTES
from app.graph_store import store
from app.import_module import ImportValidationError
from app.models import (
    CentralityEntry,
    ConnectionOut,
    EntityDetailResponse,
    GraphResponse,
    ImportRequest,
    ImportResponse,
    PatternFlag,
    SummaryResponse,
)
from app.patterns import detect_all_patterns
from app.pipeline import reset_and_load_sample, run_import
from app.summary import generate_summary

app = FastAPI(
    title="Criminal Network Analysis API",
    description="AI + Graph Analytics for Investigative Intelligence - hackathon prototype backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.audit_logger import record_audit, get_audit_trail
from pydantic import BaseModel

class AuditLogRequest(BaseModel):
    user_id: str = "Analyst_Agent_01"
    action: str
    details: str = ""

@app.post("/api/audit/log")
def log_activity(req: AuditLogRequest):
    """Record user activity in the persistent security audit log file."""
    return record_audit(req.user_id, req.action, req.details)

@app.get("/api/audit/trail")
def view_audit_trail(limit: int = 100):
    """Retrieve the recent immutable security audit log entries."""
    return get_audit_trail(limit=limit)


@app.get("/health")
def health():
    g = store.build_graph()
    return {
        "status": "ok",
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "groq_configured": bool(GROQ_API_KEY),
        "groq_model": GROQ_MODEL,
    }



@app.post("/api/import", response_model=ImportResponse)
def import_data(request: ImportRequest):
    """Import a CSV/JSON file or pasted text; runs extraction and rebuilds the graph."""
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")
    try:
        res = run_import(request)
        record_audit("Analyst_User", "import_data", f"type={res.detected_input_type} entities={res.imported_entities} rels={res.imported_relationships}")
        return res
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/import/file", response_model=ImportResponse)
async def import_file(file: UploadFile = File(...), source_label: str = Form(None)):
    """
    Import a raw uploaded file (csv/json/txt/log/etc) via multipart/form-data.
    No `type` is declared by the caller - app.data_classifier auto-detects
    structured/semi-structured/unstructured and routes accordingly, same as
    omitting `type` on POST /api/import.

    Text-based files only. PDFs, DOCX, and images are out of this hackathon
    prototype's scope (would need extra parsing/OCR libraries) - convert to
    plain text before uploading if your source file isn't already text.
    """
    # Check upload size limit before memory exhaustion (DoS protection)

    raw_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed upload size of {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if _looks_binary(raw_bytes):
        raise HTTPException(
            status_code=400,
            detail=(
                "This looks like a binary file (PDF, DOCX, image, etc), which this "
                "prototype does not parse. Convert it to plain text (.txt/.csv/.json) "
                "and re-upload."
            ),
        )

    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = raw_bytes.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not decode file as text. This prototype only accepts "
                    "text-based files (csv, json, txt, log). PDF/DOCX/image files "
                    "are not supported - convert to plain text and re-upload."
                ),
            )

    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file has no readable content.")

    label = source_label or file.filename or "uploaded_file"
    request = ImportRequest(type=None, content=text, source_label=label)
    try:
        res = run_import(request)
        record_audit("Analyst_User", "import_data", f"type={res.detected_input_type} entities={res.imported_entities} rels={res.imported_relationships}")
        return res
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/graph", response_model=GraphResponse)
def get_graph():
    """Return the full graph as node-link JSON for visualization."""
    graph = store.build_graph()
    centrality = compute_centrality(graph)
    return store.to_node_link(centrality)


@app.get("/api/graph/centrality", response_model=list[CentralityEntry])
def get_centrality():
    """Return entities ranked by degree and betweenness centrality."""
    graph = store.build_graph()
    centrality = compute_centrality(graph)
    rows = ranked_entities(graph, centrality)
    return [CentralityEntry(id=r[0], name=r[1], degree=r[2], betweenness=r[3]) for r in rows]


@app.get("/api/graph/patterns", response_model=list[PatternFlag])
def get_patterns():
    """Return the list of suspicious-pattern flags."""
    graph = store.build_graph()
    centrality = compute_centrality(graph)
    return detect_all_patterns(graph, centrality)


@app.get("/api/graph/entity/{entity_id}", response_model=EntityDetailResponse)
def get_entity_detail(entity_id: str):
    """Return one entity's detail, 1-hop neighborhood, and evidence."""
    if entity_id not in store.entities:
        raise HTTPException(status_code=404, detail="Entity not found")

    graph = store.build_graph()
    centrality = compute_centrality(graph)

    connections = []
    if entity_id in graph:
        for neighbor in graph.neighbors(entity_id):
            for _, edge_data in graph.get_edge_data(entity_id, neighbor).items():
                connections.append(
                    ConnectionOut(
                        entity_id=neighbor,
                        entity_name=graph.nodes[neighbor].get("name", neighbor),
                        relation_type=edge_data["relation_type"],
                        evidence=edge_data.get("evidence", []),
                    )
                )

    return EntityDetailResponse(
        entity=store.entities[entity_id],
        centrality=centrality.get(entity_id, {"degree": 0.0, "betweenness": 0.0}),
        connections=connections,
    )


@app.get("/api/graph/summary", response_model=SummaryResponse)
def get_summary():
    """Return the AI-generated plain-English investigation summary."""
    graph = store.build_graph()
    centrality = compute_centrality(graph)
    rows = ranked_entities(graph, centrality)
    flags = detect_all_patterns(graph, centrality)
    result = generate_summary(rows, flags)
    return SummaryResponse(**result)


@app.post("/api/graph/reset", response_model=ImportResponse)
def reset_graph(load_sample: bool = False):
    """
    Clear the in-memory graph.
    If load_sample is False (default), all memory data is removed and diagram is empty.
    If load_sample is True, reloads the sample dataset.
    """
    store.reset()
    record_audit("Analyst_User", "reset_graph", "Memory wiped, diagram cleared")
    if load_sample:
        return reset_and_load_sample()
    return ImportResponse(
        imported_entities=0,
        imported_relationships=0,
        rejected_relationships=[],
        warnings=[],
        node_count=0,
        edge_count=0,
        detected_input_type=None,
    )


@app.post("/api/graph/clear", response_model=ImportResponse)
def clear_graph():
    """Completely wipe all entities and relationships from memory so diagram is empty."""
    store.reset()
    record_audit("Analyst_User", "reset_graph", "Memory wiped, diagram cleared")
    return ImportResponse(
        imported_entities=0,
        imported_relationships=0,
        rejected_relationships=[],
        warnings=[],
        node_count=0,
        edge_count=0,
        detected_input_type=None,
    )


@app.post("/api/graph/load-demo", response_model=ImportResponse)
def load_demo():
    """Clear in-memory graph and load the sample demo case."""
    record_audit("Analyst_User", "load_demo_case", "Reloaded sample crime syndicate seed")
    return reset_and_load_sample()


# Known binary-file magic numbers - checked before any decode attempt so PDFs/
# DOCX/ZIP/images get a clear rejection instead of "succeeding" as garbage text
# via the latin-1 fallback (latin-1 maps every byte 0-255, so it never raises).
_BINARY_MAGIC_PREFIXES = (
    b"%PDF-",  # PDF
    b"PK\x03\x04",  # DOCX/XLSX/PPTX/ZIP
    b"\x89PNG",  # PNG
    b"\xff\xd8\xff",  # JPEG
    b"GIF8",  # GIF
    b"\x00\x00\x01\x00",  # ICO
)


def _looks_binary(raw_bytes: bytes) -> bool:
    if raw_bytes.startswith(_BINARY_MAGIC_PREFIXES):
        return True
    sample = raw_bytes[:2048]
    if b"\x00" in sample:
        return True
    non_printable = sum(1 for b in sample if b < 9 or (13 < b < 32))
    return len(sample) > 0 and (non_printable / len(sample)) > 0.1


# -------------------------------------------------------------
# Optional Static Frontend Mount (serves production build at /)
# -------------------------------------------------------------
from pathlib import Path
from fastapi.staticfiles import StaticFiles

_DIST_CANDIDATES = [
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
]
for _candidate in _DIST_CANDIDATES:
    if _candidate.exists() and (_candidate / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(_candidate), html=True), name="frontend")
        break

