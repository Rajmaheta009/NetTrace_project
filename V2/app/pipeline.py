"""
Orchestrates the core pipeline (PRD section 6 / section 11):
Input -> normalization -> extraction -> graph -> centrality -> pattern detection.

This is the only place structured/unstructured import paths converge before
touching the shared GraphStore, and the only place entity-id remapping happens
after de-duplication - keeping the integrity guarantee ("no edge without both
confirmed endpoints") centralized rather than duplicated per import type.
"""

from typing import List, Tuple

from app.data_classifier import classify_and_normalize
from app.extraction import (
    extract_from_structured_entities,
    extract_from_structured_relationships,
    extract_from_text_chunk,
)
from app.graph_store import store
from app.import_module import (
    ImportValidationError,
    classify_csv_rows,
    parse_csv,
    parse_json,
    split_text_into_chunks,
)
from app.models import Entity, ImportRequest, ImportResponse, Relationship


def run_import(request: ImportRequest) -> ImportResponse:
    warnings: List[str] = []
    rejected: List[str] = []
    imported_entities = 0
    imported_relationships = 0
    detected_bucket = None

    if request.type is None:
        # Caller didn't declare a format - auto-detect structured vs
        # semi-structured vs unstructured before any parsing commits to an
        # interpretation (data_classifier.classify_and_normalize).
        result = classify_and_normalize(request.content)
        detected_bucket = result.bucket
        request = request.model_copy(update={"type": result.effective_type, "content": result.content})
        if result.bucket != "structured":
            warnings.append(
                f"Input auto-detected as {result.bucket.replace('_', '-')}; "
                f"normalized and routed through AI-assisted text extraction."
            )

    from app.case_store import case_manager
    from app.models import EvidenceSourceType, ValidationStatus
    active_case = case_manager.get_active_case()

    if request.type == "csv":
        source_type = EvidenceSourceType.CSV
    elif request.type == "json":
        source_type = EvidenceSourceType.JSON
    elif detected_bucket == "semi_structured":
        source_type = EvidenceSourceType.LOG
    else:
        source_type = EvidenceSourceType.TEXT
    ev_filename = request.source_label or f"import_{request.type or 'text'}"
    ev = active_case.register_evidence(
        filename=ev_filename,
        source_type=source_type,
        content=request.content,
        record_count=0,
        description=f"Surveillance ingestion via {request.source_label or 'direct upload'}"
    )

    if request.type == "csv":
        rows = parse_csv(request.content)
        entity_rows, relationship_rows = classify_csv_rows(rows)

        if entity_rows:
            entities, w = extract_from_structured_entities(entity_rows, request.source_label)
            warnings.extend(w)
            for ent in entities:
                ent.evidence_id = ev.evidence_id
                ent.source_file = ev.filename
            id_map = store.upsert_entities(entities)
            imported_entities += len(entities)
            # id_map keys are the entity.id we generated (== the CSV row id, since we pass it through)
        if relationship_rows:
            # Build a raw-id -> global-id map from whatever entities already exist in the store
            # (covers the common two-call pattern: import entities.csv, then relationships.csv).
            raw_to_global = {e.id: e.id for e in store.entities.values()}
            for e in store.entities.values():
                raw_to_global[e.name] = e.id
                raw_to_global[e.name.lower()] = e.id
                for a in e.aliases:
                    raw_to_global[a] = e.id
                    raw_to_global[a.lower()] = e.id
            relationships, w = extract_from_structured_relationships(
                relationship_rows, raw_to_global, request.source_label
            )
            warnings.extend(w)
            for rel in relationships:
                rel.evidence_id = ev.evidence_id
                rel.source_file = ev.filename
            store.add_relationships(relationships)
            imported_relationships += len(relationships)
            rejected.extend([w for w in warnings if w.startswith("Rejected structured relationship")])

    elif request.type == "json":
        entity_rows, relationship_rows = parse_json(request.content)

        entities, w = extract_from_structured_entities(entity_rows, request.source_label)
        warnings.extend(w)
        for ent in entities:
            ent.evidence_id = ev.evidence_id
            ent.source_file = ev.filename
        id_map = store.upsert_entities(entities)
        imported_entities += len(entities)

        raw_to_global = {**id_map, **{e.id: e.id for e in store.entities.values()}}
        for e in store.entities.values():
            raw_to_global[e.name] = e.id
            raw_to_global[e.name.lower()] = e.id
            for a in e.aliases:
                raw_to_global[a] = e.id
                raw_to_global[a.lower()] = e.id
        relationships, w = extract_from_structured_relationships(
            relationship_rows, raw_to_global, request.source_label
        )
        warnings.extend(w)
        for rel in relationships:
            rel.evidence_id = ev.evidence_id
            rel.source_file = ev.filename
        store.add_relationships(relationships)
        imported_relationships += len(relationships)
        rejected.extend([w for w in warnings if w.startswith("Rejected structured relationship")])

    elif request.type == "text":
        chunks = split_text_into_chunks(request.content)
        if not chunks:
            warnings.append("Empty text input - nothing to extract.")
        for i, chunk in enumerate(chunks):
            source_ref = f"{request.source_label}:chunk_{i}"
            chunk_entities, chunk_relationships, chunk_warnings = extract_from_text_chunk(chunk, source_ref)
            warnings.extend(chunk_warnings)
            rejected.extend([w for w in chunk_warnings if w.startswith("Rejected relationship")])

            for ent in chunk_entities:
                ent.evidence_id = ev.evidence_id
                ent.source_file = ev.filename
            id_map = store.upsert_entities(chunk_entities)
            imported_entities += len(chunk_entities)

            # remap relationship endpoints from this-chunk-local ids to final global ids
            remapped: List[Relationship] = []
            for rel in chunk_relationships:
                rel.evidence_id = ev.evidence_id
                rel.source_file = ev.filename
                src = id_map.get(rel.source, rel.source)
                tgt = id_map.get(rel.target, rel.target)
                if src in store.entities and tgt in store.entities:
                    remapped.append(rel.model_copy(update={"source": src, "target": tgt}))
                else:
                    rej_msg = f"Rejected relationship after remap - unconfirmed entity: {rel.relation_type} ({rel.source} -> {rel.target})"
                    rejected.append(rej_msg)
                    active_case.queue_validation(
                        item_type="relationship",
                        name_or_pair=f"{rel.source} -> {rel.target}",
                        payload=rel.model_dump(),
                        status=ValidationStatus.NEEDS_REVIEW,
                        confidence=0.40,
                        reason="Unconfirmed endpoint during text extraction",
                        source_evidence=ev.filename,
                    )
            store.add_relationships(remapped)
            imported_relationships += len(remapped)

    # Update evidence record count
    ev.record_count = imported_entities + imported_relationships

    graph = store.build_graph()
    return ImportResponse(
        imported_entities=imported_entities,
        imported_relationships=imported_relationships,
        rejected_relationships=rejected,
        warnings=warnings,
        node_count=graph.number_of_nodes(),
        edge_count=graph.number_of_edges(),
        detected_input_type=detected_bucket,
    )


def reset_and_load_sample() -> ImportResponse:
    import os
    from pathlib import Path
    from app.models import ImportRequest as _ImportRequest

    store.reset()

    total_entities = 0
    total_relationships = 0
    total_rejected = []
    total_warnings = []

    # 1. Ingest baseline sample dataset
    from app.sample_data import SAMPLE_ENTITIES_CSV, SAMPLE_RELATIONSHIPS_CSV
    r1 = run_import(_ImportRequest(type="csv", content=SAMPLE_ENTITIES_CSV, source_label="sample_entities.csv"))
    r2 = run_import(_ImportRequest(type="csv", content=SAMPLE_RELATIONSHIPS_CSV, source_label="sample_relationships.csv"))
    total_entities += r1.imported_entities + r2.imported_entities
    total_relationships += r1.imported_relationships + r2.imported_relationships
    total_rejected.extend(r1.rejected_relationships + r2.rejected_relationships)
    total_warnings.extend(r1.warnings + r2.warnings)

    # 2. Ingest all multi-vector demo files from testing directory
    testing_dir = Path(__file__).resolve().parent.parent / "testing"
    demo_files = [
        "01_structured_syndicate.csv",
        "02_semistructured_network.json",
        "03_unstructured_case_report.txt",
        "04_multivector_intercepts.log",
        "syndicate_case_data.json",
    ]

    if testing_dir.exists() and testing_dir.is_dir():
        for fname in demo_files:
            fpath = testing_dir / fname
            if fpath.exists() and fpath.stat().st_size > 0:
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    resp = run_import(_ImportRequest(content=content, source_label=fname))
                    total_entities += resp.imported_entities
                    total_relationships += resp.imported_relationships
                    total_rejected.extend(resp.rejected_relationships)
                    total_warnings.extend(resp.warnings)
                except Exception as exc:
                    total_warnings.append(f"Failed to ingest {fname}: {exc}")

    graph = store.build_graph()
    return ImportResponse(
        imported_entities=total_entities,
        imported_relationships=total_relationships,
        rejected_relationships=total_rejected,
        warnings=total_warnings,
        node_count=graph.number_of_nodes(),
        edge_count=graph.number_of_edges(),
        detected_input_type="multi_vector_testing_suite",
    )
