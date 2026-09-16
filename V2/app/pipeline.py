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

    if request.type == "csv":
        rows = parse_csv(request.content)
        entity_rows, relationship_rows = classify_csv_rows(rows)

        if entity_rows:
            entities, w = extract_from_structured_entities(entity_rows, request.source_label)
            warnings.extend(w)
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
            store.add_relationships(relationships)
            imported_relationships += len(relationships)
            rejected.extend([w for w in warnings if w.startswith("Rejected structured relationship")])

    elif request.type == "json":
        entity_rows, relationship_rows = parse_json(request.content)

        entities, w = extract_from_structured_entities(entity_rows, request.source_label)
        warnings.extend(w)
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

            id_map = store.upsert_entities(chunk_entities)
            imported_entities += len(chunk_entities)

            # remap relationship endpoints from this-chunk-local ids to final global ids
            remapped: List[Relationship] = []
            for rel in chunk_relationships:
                src = id_map.get(rel.source, rel.source)
                tgt = id_map.get(rel.target, rel.target)
                if src in store.entities and tgt in store.entities:
                    remapped.append(rel.model_copy(update={"source": src, "target": tgt}))
                else:
                    rejected.append(f"Rejected relationship after remap - unconfirmed entity: {rel}")
            store.add_relationships(remapped)
            imported_relationships += len(remapped)

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
    from app.models import ImportRequest as _ImportRequest
    from app.sample_data import SAMPLE_ENTITIES_CSV, SAMPLE_RELATIONSHIPS_CSV

    store.reset()
    r1 = run_import(_ImportRequest(type="csv", content=SAMPLE_ENTITIES_CSV, source_label="sample"))
    r2 = run_import(_ImportRequest(type="csv", content=SAMPLE_RELATIONSHIPS_CSV, source_label="sample"))

    graph = store.build_graph()
    return ImportResponse(
        imported_entities=r1.imported_entities + r2.imported_entities,
        imported_relationships=r1.imported_relationships + r2.imported_relationships,
        rejected_relationships=r1.rejected_relationships + r2.rejected_relationships,
        warnings=r1.warnings + r2.warnings,
        node_count=graph.number_of_nodes(),
        edge_count=graph.number_of_edges(),
    )
