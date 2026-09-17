import networkx as nx
"""
Criminal Network Analysis & Digital Investigation Intelligence - FastAPI entrypoint

Expanded Investigative Surface:
  - Cases: List, Create, Switch, Delete, Detail
  - Evidence: List, Register, Hash Verification
  - Graph: Nodes, Links, Confidence, Direction, Centrality, Patterns
  - Communities: Modularity clustering with neutral labels
  - Connection Finder: Shortest path between any 2 entities with evidence steps
  - Data Quality / Validation Center: Human review queue (Accept / Reject / Correct)
  - Field Notes: Case, entity, and evidence-level investigative annotations
  - Forensic Dossier / Reports: Comprehensive case export
  - RBAC & Audit: User profiles, role switching, immutable audit trails
"""

from typing import Any, Dict, List, Optional
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.analytics import compute_centrality, ranked_entities
from app.audit_logger import get_audit_trail, record_audit
from app.case_store import CaseStore, case_manager
from app.community_detector import detect_communities
from app.crime_profiles import CrimeProfile, get_crime_profile, list_crime_profiles
from app.investigation_leads import compute_entity_lead_score, rank_case_investigation_leads
from app.config import CORS_ORIGINS, GROQ_API_KEY, GROQ_MODEL, MAX_UPLOAD_BYTES
from app.graph_store import store
from app.import_module import ImportValidationError
from app.models import (
    Case,
    CaseCreateRequest,
    CaseStatus,
    CaseUpdateRequest,
    CentralityEntry,
    CommunityOut,
    ConnectionOut,
    ConnectionPathResponse,
    EntityDetailResponse,
    Evidence,
    EvidenceCreateRequest,
    EvidenceSourceType,
    EvidenceStatus,
    GraphResponse,
    ImportRequest,
    ImportResponse,
    InvestigationReportResponse,
    Note,
    NoteCreateRequest,
    PatternFlag,
    SummaryResponse,
    UserProfile,
    UserRole,
    UserRoleSwitchRequest,
    ValidationRecord,
    ValidationReviewAction,
    ValidationStatus,
    InvestigationQuestionOut,
    InvestigationLeadOut,
    DeepEntityInspectionResponse,
    EntityMergeRequest,
)
from app.path_finder import find_connection_path
from app.patterns import detect_all_patterns
from app.pipeline import reset_and_load_sample, run_import
from app.report_generator import generate_case_report
from app.summary import generate_summary

app = FastAPI(
    title="NetTrace - Digital Investigation & Intelligence Platform API",
    description="AI-Assisted Criminal Network Analysis and Forensic Intelligence Platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active User Profile Session
_current_user = UserProfile(
    user_id="USR-001",
    name="Officer Vikram (Lead Investigator)",
    role=UserRole.INVESTIGATOR,
)


class AuditLogRequest(BaseModel):
    user_id: str = "Analyst_Agent_01"
    action: str
    details: str = ""


# -------------------------------------------------------------
# System & Health Endpoints
# -------------------------------------------------------------

@app.get("/health")
@app.get("/api/health")
@app.get("/api/graph/state")
def health():
    active_case = case_manager.get_active_case()
    g = active_case.build_graph()
    return {
        "status": "ok",
        "active_case_id": active_case.case_id,
        "active_case_name": active_case.case_name,
        "nodes": g.number_of_nodes(),
        "edges": g.number_of_edges(),
        "cases_total": len(case_manager.cases),
        "groq_configured": bool(GROQ_API_KEY),
        "groq_model": GROQ_MODEL,
        "current_user": _current_user.model_dump(),
    }


# -------------------------------------------------------------
# Security Audit Trail Endpoints
# -------------------------------------------------------------

@app.post("/api/audit/log")
def log_activity(req: AuditLogRequest):
    """Record user activity in the persistent security audit log."""
    return record_audit(req.user_id, req.action, req.details)


@app.get("/api/audit/trail")
@app.get("/api/audit/logs")
def view_audit_trail(limit: int = 100):
    """Retrieve the recent immutable security audit log entries."""
    return get_audit_trail(limit=limit)


# -------------------------------------------------------------
# User Profile & RBAC Role Endpoints
# -------------------------------------------------------------

@app.get("/api/auth/me", response_model=UserProfile)
def get_current_user():
    return _current_user


@app.post("/api/auth/switch-role", response_model=UserProfile)
def switch_role(req: UserRoleSwitchRequest):
    global _current_user
    _current_user = UserProfile(
        user_id=_current_user.user_id,
        name=_current_user.name,
        role=req.role,
    )
    record_audit(_current_user.name, "switch_role", f"Role switched to {req.role.value}")
    return _current_user


# -------------------------------------------------------------
# Case Management Endpoints
# -------------------------------------------------------------

@app.get("/api/cases", response_model=List[Case])
def list_cases():
    """List all registered cases with their operational metrics."""
    return case_manager.list_cases()


@app.post("/api/cases", response_model=Case)
def create_case(req: CaseCreateRequest):
    """Create a new isolated case file."""
    case = case_manager.create_case(
        case_name=req.case_name,
        description=req.description,
        created_by=req.created_by or _current_user.name,
    )
    record_audit(_current_user.name, "create_case", f"Created case {case.case_id}: {case.case_name}")
    return case.get_summary_model()


@app.get("/api/cases/active/current", response_model=Case)
@app.get("/api/cases/active", response_model=Case)
def get_active_case_info():
    """Return operational summary for the currently active case."""
    return case_manager.get_active_case().get_summary_model()


@app.get("/api/cases/{case_id}", response_model=Case)
def get_case(case_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case.get_summary_model()


@app.put("/api/cases/{case_id}", response_model=Case)
def update_case(case_id: str, req: CaseUpdateRequest):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if req.case_name is not None:
        case.case_name = req.case_name
    if req.description is not None:
        case.description = req.description
    if req.status is not None:
        case.status = req.status
    record_audit(_current_user.name, "update_case", f"Updated case metadata for {case_id}")
    return case.get_summary_model()


@app.post("/api/cases/{case_id}/switch")
def switch_active_case(case_id: str):
    """Switch active investigation case."""
    case = case_manager.switch_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    record_audit(_current_user.name, "switch_case", f"Switched working case to {case_id} ({case.case_name})")
    return {"status": "ok", "active_case_id": case_id, "case": case.get_summary_model()}


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str):
    success = case_manager.delete_case(case_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete default or non-existent case")
    record_audit(_current_user.name, "delete_case", f"Archived/Deleted case {case_id}")
    return {"status": "ok", "deleted_case_id": case_id}


# -------------------------------------------------------------
# Evidence Registry Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/evidence", response_model=List[Evidence])
def get_case_evidence(case_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return list(case.evidence.values())


@app.get("/api/evidence", response_model=List[Evidence])
def get_active_case_evidence():
    active_case = case_manager.get_active_case()
    return list(active_case.evidence.values())


@app.post("/api/cases/{case_id}/evidence", response_model=Evidence)
def register_evidence(case_id: str, req: EvidenceCreateRequest):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    ev = case.register_evidence(
        filename=req.filename,
        source_type=req.source_type,
        content=req.content,
        uploaded_by=req.uploaded_by or _current_user.name,
        description=req.description or "",
    )
    record_audit(_current_user.name, "register_evidence", f"Registered evidence {ev.evidence_id} in {case_id}")
    return ev


# -------------------------------------------------------------
# Data Import Endpoints (Ingests to Active Case)
# -------------------------------------------------------------

@app.post("/api/import", response_model=ImportResponse)
def import_data(request: ImportRequest):
    """Import CSV/JSON or raw text into the active case."""
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")
    try:
        res = run_import(request)
        record_audit(_current_user.name, "import_data", f"type={res.detected_input_type} entities={res.imported_entities} rels={res.imported_relationships}")
        return res
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/import/file", response_model=ImportResponse)
async def import_file(file: UploadFile = File(...), source_label: str = Form(None)):
    """Import an uploaded file via multipart/form-data into the active case."""
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
                detail="Could not decode file as text. Upload plain text / CSV / JSON.",
            )

    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file has no readable content.")

    label = source_label or file.filename or "uploaded_file"
    request = ImportRequest(type=None, content=text, source_label=label)
    try:
        res = run_import(request)
        record_audit(_current_user.name, "import_file", f"file={label} entities={res.imported_entities} rels={res.imported_relationships}")
        return res
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# -------------------------------------------------------------
# Graph, Centrality, Patterns Endpoints (Active Case)
# -------------------------------------------------------------

@app.get("/api/graph", response_model=GraphResponse)
def get_graph():
    """Return the active case graph as node-link JSON for visualization."""
    active_case = case_manager.get_active_case()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    _, node_to_comm = detect_communities(undirected_g, centrality)
    return active_case.to_node_link(centrality, community_map=node_to_comm)


@app.get("/api/graph/centrality", response_model=List[CentralityEntry])
def get_centrality():
    """Return entities ranked by degree and betweenness centrality."""
    active_case = case_manager.get_active_case()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    rows = ranked_entities(undirected_g, centrality)
    return [CentralityEntry(id=r[0], name=r[1], degree=r[2], betweenness=r[3]) for r in rows]


@app.get("/api/graph/patterns", response_model=List[PatternFlag])
def get_patterns():
    """Return suspicious-pattern flags detected in the active case."""
    active_case = case_manager.get_active_case()
    graph = active_case.build_graph()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    return detect_all_patterns(graph, centrality)


@app.get("/api/graph/entity/{entity_id}", response_model=EntityDetailResponse)
def get_entity_detail(entity_id: str):
    """Return an entity's 1-hop neighborhood, community, evidence, and notes."""
    active_case = case_manager.get_active_case()
    if entity_id not in active_case.entities:
        clean_target = entity_id.strip("'\"").strip().lower()
        for e in active_case.entities.values():
            if (
                e.id.lower() == clean_target
                or e.name.lower() == clean_target
                or any(clean_target == a.lower() for a in (e.aliases or []))
            ):
                entity_id = e.id
                break
    if entity_id not in active_case.entities:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found")

    graph = active_case.build_graph()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    _, node_to_comm = detect_communities(undirected_g, centrality)

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
        if hasattr(graph, "predecessors"):
            for pred in graph.predecessors(entity_id):
                if pred not in graph.neighbors(entity_id):
                    for _, edge_data in graph.get_edge_data(pred, entity_id).items():
                        connections.append(
                            ConnectionOut(
                                entity_id=pred,
                                entity_name=graph.nodes[pred].get("name", pred),
                                relation_type=edge_data["relation_type"],
                                evidence=edge_data.get("evidence", []),
                            )
                        )

    entity_obj = active_case.entities[entity_id]
    entity_notes = [n for n in active_case.notes.values() if n.entity_id == entity_id]

    return EntityDetailResponse(
        entity=entity_obj,
        centrality=centrality.get(entity_id, {"degree": 0.0, "betweenness": 0.0}),
        connections=connections,
        community=node_to_comm.get(entity_id, entity_obj.community_id),
        evidence_refs=entity_obj.source_refs,
        notes=entity_notes,
    )


@app.get("/api/graph/summary", response_model=SummaryResponse)
def get_summary():
    """Return the AI-generated plain-English investigation summary for the active case."""
    active_case = case_manager.get_active_case()
    graph = active_case.build_graph()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    rows = ranked_entities(undirected_g, centrality)
    flags = detect_all_patterns(graph, centrality)
    result = generate_summary(rows, flags)
    return SummaryResponse(**result)


# -------------------------------------------------------------
# Community & Cluster Detection Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/communities", response_model=List[CommunityOut])
def get_case_communities(case_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    undirected_g = case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    communities, _ = detect_communities(undirected_g, centrality)
    return communities


@app.get("/api/graph/communities", response_model=List[CommunityOut])
@app.get("/api/communities", response_model=List[CommunityOut])
def get_active_communities():
    active_case = case_manager.get_active_case()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    communities, _ = detect_communities(undirected_g, centrality)
    return communities


# -------------------------------------------------------------
# Connection Finder (Shortest Path & Evidence Trace) Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/connections", response_model=ConnectionPathResponse)
def get_case_connections(case_id: str, source_id: str = Query(...), target_id: str = Query(...)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return find_connection_path(case.build_graph(), case.entities, case.relationships, source_id, target_id)


@app.get("/api/graph/connections", response_model=ConnectionPathResponse)
def get_active_connections(source_id: str = Query(...), target_id: str = Query(...)):
    active_case = case_manager.get_active_case()
    return find_connection_path(active_case.build_graph(), active_case.entities, active_case.relationships, source_id, target_id)


# -------------------------------------------------------------
# Data Quality / Validation Center Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/validation", response_model=List[ValidationRecord])
def get_case_validation(case_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return list(case.validation_records.values())


@app.get("/api/validation", response_model=List[ValidationRecord])
def get_active_validation():
    active_case = case_manager.get_active_case()
    return list(active_case.validation_records.values())


@app.post("/api/cases/{case_id}/validation/{record_id}/review", response_model=ValidationRecord)
def review_case_validation(case_id: str, record_id: str, action_req: ValidationReviewAction):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    rec = case.review_validation(record_id, action_req.action, action_req.corrected_payload)
    if not rec:
        raise HTTPException(status_code=404, detail="Validation record not found")
    record_audit(_current_user.name, "review_validation", f"Action {action_req.action} on {record_id} ({rec.name_or_pair})")
    return rec


# -------------------------------------------------------------
# Investigation Notes Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/notes", response_model=List[Note])
def get_case_notes(case_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return list(case.notes.values())


@app.get("/api/notes", response_model=List[Note])
def get_active_notes():
    active_case = case_manager.get_active_case()
    return list(active_case.notes.values())


@app.post("/api/cases/{case_id}/notes", response_model=Note)
def create_case_note(case_id: str, req: NoteCreateRequest):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    note = case.create_note(
        note_text=req.note_text,
        entity_id=req.entity_id,
        relationship_id=req.relationship_id,
        evidence_id=req.evidence_id,
        created_by=req.created_by or _current_user.name,
    )
    record_audit(_current_user.name, "create_note", f"Created note {note.note_id} in case {case_id}")
    return note


@app.delete("/api/cases/{case_id}/notes/{note_id}")
def delete_case_note(case_id: str, note_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    ok = case.delete_note(note_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Note not found")
    record_audit(_current_user.name, "delete_note", f"Deleted note {note_id} from case {case_id}")
    return {"status": "ok", "deleted_note_id": note_id}


# -------------------------------------------------------------
# Forensic Case Dossier / Report Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/report", response_model=InvestigationReportResponse)
def get_case_report_dossier(case_id: str):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return generate_case_report(case, generated_by=_current_user.name)


@app.get("/api/graph/report", response_model=InvestigationReportResponse)
def get_active_report_dossier():
    active_case = case_manager.get_active_case()
    return generate_case_report(active_case, generated_by=_current_user.name)


# -------------------------------------------------------------
# Graph State Manipulation (Reset / Clear / Load-Demo)
# -------------------------------------------------------------

@app.post("/api/graph/reset", response_model=ImportResponse)
def reset_graph(load_sample: bool = False):
    """Clear active case graph. If load_sample=True, reloads sample syndicate dataset."""
    store.reset()
    record_audit(_current_user.name, "reset_graph", "Active case graph reset")
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
    """Wipe all entities and relationships from active case."""
    store.reset()
    record_audit(_current_user.name, "clear_graph", "Active case graph cleared completely")
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
    """Reload sample crime syndicate seed into active case."""
    record_audit(_current_user.name, "load_demo", "Reloaded sample crime syndicate seed")
    return reset_and_load_sample()


# -------------------------------------------------------------
# Binary File Detection Utility
# -------------------------------------------------------------

_BINARY_MAGIC_PREFIXES = (
    b"%PDF-",
    b"PK\x03\x04",
    b"\x89PNG",
    b"\xff\xd8\xff",
    b"GIF8",
    b"\x00\x00\x01\x00",
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

# -------------------------------------------------------------
# Crime Profiles & Investigation Questions Endpoints
# -------------------------------------------------------------

@app.get("/api/crime-profiles", response_model=List[CrimeProfile])
def get_all_crime_profiles():
    """List all 11 standardized digital investigation profiles."""
    return list_crime_profiles()


@app.get("/api/crime-profiles/{profile_id}", response_model=CrimeProfile)
def get_single_crime_profile(profile_id: str):
    """Retrieve detailed configuration for a specific crime profile."""
    return get_crime_profile(profile_id)


@app.get("/api/cases/{case_id}/investigation-profile", response_model=CrimeProfile)
def get_case_investigation_profile(case_id: str):
    """Retrieve active crime profile configuration for the specified case."""
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return get_crime_profile(case.investigation_type)


@app.put("/api/cases/{case_id}/investigation-type", response_model=Case)
def update_case_investigation_type(case_id: str, payload: Dict[str, str]):
    """
    Switch active investigation type for a case.
    Preserves 100% of underlying graph nodes, relationships, and evidence.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    new_type = payload.get("investigation_type")
    if not new_type:
        raise HTTPException(status_code=400, detail="Missing investigation_type in payload")
    profile = get_crime_profile(new_type)
    case.set_investigation_type(profile.id)
    record_audit(_current_user.name, "switch_investigation_type", f"Switched investigation profile to '{profile.name}' for case {case_id}")
    return case.get_summary_model()


@app.get("/api/cases/{case_id}/investigation-questions", response_model=List[InvestigationQuestionOut])
def get_case_investigation_questions(case_id: str):
    """
    Retrieve hypothesis-driven, neutral investigative questions tailored
    to the case's active crime profile.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    profile = get_crime_profile(case.investigation_type)
    
    questions = []
    for idx, q_text in enumerate(profile.investigation_questions, 1):
        questions.append(
            InvestigationQuestionOut(
                index=idx,
                question=q_text,
                profile_id=profile.id,
                profile_name=profile.name,
                relevant_entity_types=profile.important_entity_types,
                relevant_relationship_types=profile.important_relationship_types,
            )
        )
    return questions


# -------------------------------------------------------------
# Investigation Leads Prioritization Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/leads", response_model=List[InvestigationLeadOut])
def get_case_leads(case_id: str):
    """
    Computes and ranks all entities within a case by their Investigation Lead Score (0-100).
    Uses transparent, deterministic observations and active crime profile weighting.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return rank_case_investigation_leads(case)


@app.get("/api/graph/leads", response_model=List[InvestigationLeadOut])
@app.get("/api/leads", response_model=List[InvestigationLeadOut])
@app.get("/api/investigation-leads", response_model=List[InvestigationLeadOut])
def get_active_case_leads():
    """Retrieve ranked investigation leads for the currently active working case."""
    case = case_manager.get_active_case()
    return rank_case_investigation_leads(case)


# -------------------------------------------------------------
# Deep Entity Inspection Endpoint
# -------------------------------------------------------------

@app.get("/api/entities/{entity_id}/deep-inspection", response_model=DeepEntityInspectionResponse)
def get_active_entity_deep_inspection(entity_id: str):
    """Deep inspection for an entity within the currently active case."""
    active_case = case_manager.get_active_case()
    return get_deep_entity_inspection(active_case.case_id, entity_id)


@app.get("/api/cases/{case_id}/entities/{entity_id}/deep-inspection", response_model=DeepEntityInspectionResponse)
def get_deep_entity_inspection(case_id: str, entity_id: str):
    """
    Full-spectrum forensic inspection of an entity across all analytical vectors:
    network position, relationships matrix, evidence traceability, chronological timeline,
    communities, heuristic patterns, attached notes, and transparent lead score.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    entity = case.entities.get(entity_id)
    if not entity:
        clean_target = entity_id.strip("'\"").strip().lower()
        for e in case.entities.values():
            if (
                e.id.lower() == clean_target
                or e.name.lower() == clean_target
                or any(clean_target == a.lower() for a in (e.aliases or []))
            ):
                entity = e
                entity_id = e.id
                break
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found in case '{case_id}'")

    profile = get_crime_profile(case.investigation_type)
    G = case.build_graph()

    # Undirected projection for centralities
    undirected = nx.Graph()
    for u, v in G.edges():
        undirected.add_edge(u, v)

    betweenness = nx.betweenness_centrality(undirected) if len(undirected) > 1 else {n: 0.0 for n in G.nodes()}
    degree = nx.degree_centrality(undirected) if len(undirected) > 1 else {n: 0.0 for n in G.nodes()}

    # Community Detection & lookup
    communities_map: Dict[str, str] = {}
    my_comm_info: Dict[str, Any] = {
        "community_id": "comm-1",
        "name": "Community 1",
        "size": 1,
        "density": 0.0,
        "members": [{"id": entity.id, "name": entity.name, "type": str(entity.type)}],
        "internal_edges": 0,
    }

    try:
        comms = detect_communities(G)
        for c in comms:
            for m in c.members:
                communities_map[m["id"]] = c.name
                if m["id"] == entity_id:
                    my_comm_info = {
                        "community_id": c.community_id,
                        "name": c.name,
                        "size": c.size,
                        "density": c.density,
                        "members": c.members,
                        "internal_edges": c.internal_edges,
                    }
    except Exception:
        pass

    # Incident relationships
    incident_rels_out = []
    connected_entity_ids = set()
    supporting_ev_ids = set()
    if entity.evidence_id:
        supporting_ev_ids.add(entity.evidence_id)

    timeline_events = []

    for r in case.relationships.values():
        is_source = r.source == entity_id
        is_target = r.target == entity_id
        if is_source or is_target:
            other_id = r.target if is_source else r.source
            connected_entity_ids.add(other_id)
            other_entity = case.entities.get(other_id)
            other_name = other_entity.name if other_entity else other_id

            if r.evidence_id:
                supporting_ev_ids.add(r.evidence_id)
            for ev_ref in r.evidence:
                if ev_ref.startswith("EV-"):
                    supporting_ev_ids.add(ev_ref)

            rel_dict = {
                "id": r.id,
                "source": r.source,
                "source_name": entity.name if is_source else other_name,
                "relation_type": r.relation_type.value if hasattr(r.relation_type, "value") else str(r.relation_type),
                "target": r.target,
                "target_name": other_name if is_source else entity.name,
                "confidence": r.confidence,
                "confidence_label": r.confidence_label,
                "confidence_reasons": r.confidence_reasons,
                "occurrences": r.occurrences,
                "evidence_id": r.evidence_id or (r.evidence[0] if r.evidence else None),
                "validation_status": r.validation_status,
                "attributes": r.attributes,
            }
            incident_rels_out.append(rel_dict)

            # Timeline event compilation
            ts = r.attributes.get("timestamp") or r.attributes.get("date") or r.attributes.get("time") or "Observed in Case Stream"
            timeline_events.append({
                "timestamp": str(ts),
                "source": r.source,
                "source_name": entity.name if is_source else other_name,
                "relation_type": rel_dict["relation_type"],
                "target": r.target,
                "target_name": other_name if is_source else entity.name,
                "evidence_id": rel_dict["evidence_id"],
                "confidence": r.confidence,
                "description": f"{entity.name if is_source else other_name} {rel_dict['relation_type']} {other_name if is_source else entity.name}",
            })

    # Supporting Evidence Ledger
    supporting_evidence_objs = []
    for ev_id in supporting_ev_ids:
        if ev_id in case.evidence:
            supporting_evidence_objs.append(case.evidence[ev_id])

    # Network Position
    communities_connected = set()
    for nb_id in connected_entity_ids:
        if nb_id in communities_map:
            communities_connected.add(communities_map[nb_id])

    network_pos = {
        "degree_centrality": round(degree.get(entity_id, 0.0), 4),
        "betweenness_centrality": round(betweenness.get(entity_id, 0.0), 4),
        "direct_connections_count": len(connected_entity_ids),
        "relationships_count": len(incident_rels_out),
        "community_id": my_comm_info["community_id"],
        "community_name": my_comm_info["name"],
        "communities_connected_count": len(communities_connected),
    }

    # Heuristic Patterns involving this entity
    entity_patterns = []
    try:
        from app.patterns import detect_all_patterns
        all_pats = detect_all_patterns(G, case.relationships, case.entities)
        for p in all_pats:
            if entity_id in p.entities or any(entity.name in ev for ev in p.evidence):
                entity_patterns.append({
                    "type": p.type,
                    "severity": p.severity,
                    "entities": p.entities,
                    "evidence": p.evidence,
                    "why": getattr(p, "why", f"Detected {p.type} pattern structural signature in network."),
                    "source_evidence": getattr(p, "source_evidence", []),
                })
    except Exception:
        pass

    # Investigator Notes attached to entity or general case
    entity_notes = [
        n for n in case.notes.values()
        if n.target_id == entity_id or n.target_entity_id == entity_id or n.target_type == "case"
    ]

    # Lead Prioritization Score
    lead_score = compute_entity_lead_score(
        entity=entity,
        graph=G,
        relationships=case.relationships,
        evidence_registry=case.evidence,
        profile=profile,
        communities_map=communities_map,
        betweenness_dict=betweenness,
        degree_dict=degree,
    )

    record_audit(_current_user.name, "deep_inspect_entity", f"Investigator initiated deep forensic inspection on entity '{entity.name}' ({entity_id}) in case {case_id}")

    return DeepEntityInspectionResponse(
        entity=entity,
        network_position=network_pos,
        relationships=incident_rels_out,
        evidence=supporting_evidence_objs,
        timeline=timeline_events,
        communities=my_comm_info,
        patterns=entity_patterns,
        investigator_notes=entity_notes,
        investigation_lead=lead_score,
        investigation_profile={
            "id": profile.id,
            "name": profile.name,
            "description": profile.description,
            "important_entity_types": profile.important_entity_types,
            "important_relationship_types": profile.important_relationship_types,
        },
        disclaimer="This indicator supports investigative prioritization only. It is not a determination of guilt, criminality, or legal responsibility.",
    )


# -------------------------------------------------------------
# Entity Resolution & Deduplication Merge Endpoint
# -------------------------------------------------------------

@app.post("/api/cases/{case_id}/entities/merge")
def merge_duplicate_entities(case_id: str, req: EntityMergeRequest):
    """
    Merges duplicate entity 'source_entity_id' into 'target_entity_id':
    - Preserves all aliases and non-empty attributes
    - Re-routes all relationships to target entity
    - Eliminates self-loops
    - Logs irreversible resolution action to immutable audit trail
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    src = case.entities.get(req.source_entity_id)
    tgt = case.entities.get(req.target_entity_id)

    if not src:
        raise HTTPException(status_code=404, detail=f"Source entity '{req.source_entity_id}' not found")
    if not tgt:
        raise HTTPException(status_code=404, detail=f"Target entity '{req.target_entity_id}' not found")
    if src.id == tgt.id:
        raise HTTPException(status_code=400, detail="Source and target entity cannot be identical")

    with case._lock:
        # Merge aliases
        existing_aliases = set(tgt.aliases)
        existing_aliases.add(src.name)
        existing_aliases.update(src.aliases)
        tgt.aliases = sorted(list(existing_aliases))

        # Merge attributes
        for k, v in src.attributes.items():
            if v and k not in tgt.attributes:
                tgt.attributes[k] = v
            elif v and k in tgt.attributes and str(v) not in str(tgt.attributes[k]):
                tgt.attributes[k] = f"{tgt.attributes[k]}, {v}"

        # Re-point relationships
        updated_rels = {}
        for r_id, r in case.relationships.items():
            new_source = tgt.id if r.source == src.id else r.source
            new_target = tgt.id if r.target == src.id else r.target

            # Drop self-loops created by merge
            if new_source == new_target:
                continue

            r.source = new_source
            r.target = new_target
            updated_rels[r_id] = r

        case.relationships = updated_rels

        # Delete source entity
        del case.entities[src.id]
        case.updated_at = case_manager.get_active_case().updated_at

    record_audit(
        _current_user.name,
        "merge_entities",
        f"Merged entity '{src.name}' ({src.id}) into '{tgt.name}' ({tgt.id}). Reason: {req.reason}"
    )

    return {
        "status": "ok",
        "message": f"Successfully merged {src.name} into {tgt.name}",
        "surviving_entity_id": tgt.id,
        "removed_entity_id": src.id,
    }


# Optional Static Frontend Mount
# -------------------------------------------------------------

_DIST_CANDIDATES = [
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
]
for _candidate in _DIST_CANDIDATES:
    if _candidate.exists() and (_candidate / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(_candidate), html=True), name="frontend")
        break
