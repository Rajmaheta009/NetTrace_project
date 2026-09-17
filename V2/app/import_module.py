"""
Module 1 - Data Import & Preprocessing (PRD section 11)

Parses CSV, JSON, or pasted free text into normalized records. Fully
deterministic - "AI Usage: None" per the PRD for this module.
"""

import io
import json as json_lib
from typing import Dict, List, Tuple

import pandas as pd


class ImportValidationError(Exception):
    pass


COLUMN_ALIASES = {
    "entity_id": "id",
    "node_id": "id",
    "uid": "id",
    "entity_type": "type",
    "category": "type",
    "label": "type",
    "entity_name": "name",
    "full_name": "name",
    "title": "name",
    "source_id": "source",
    "src": "source",
    "from_id": "source",
    "from": "source",
    "target_id": "target",
    "dst": "target",
    "to_id": "target",
    "to": "target",
    "relationship": "relation_type",
    "relation": "relation_type",
    "edge_type": "relation_type",
    "rel_type": "relation_type",
    "link_type": "relation_type",
}


def parse_csv(content: str) -> List[dict]:
    """
    Parses a single CSV blob into row dicts. Auto-detects whether it's an
    entities table (has an 'id' + 'type' column) or a relationships table
    (has 'source' + 'target' + 'relation_type'), since the PRD's sample data
    ships these as two separate CSV files under one `type: "csv"` import call.
    """
    if not content or not content.strip():
        return []
    try:
        df = pd.read_csv(io.StringIO(content), dtype=str, keep_default_na=False)
    except Exception as exc:
        raise ImportValidationError(f"Could not parse CSV: {exc}") from exc

    # Trim whitespace from all column headers and values
    df.columns = [str(c).strip() for c in df.columns]
    records = df.to_dict(orient="records")
    return [{str(k).strip(): str(v).strip() for k, v in row.items()} for row in records]


def classify_csv_rows(rows: List[dict]) -> Tuple[List[dict], List[dict]]:
    if not rows:
        return [], []

    # Normalize column names with aliases
    norm_rows = []
    for r in rows:
        norm_r = {}
        for k, v in r.items():
            clean_k = k.strip().lower()
            target_k = COLUMN_ALIASES.get(clean_k, k.strip())
            norm_r[target_k] = v
        norm_rows.append(norm_r)

    columns = set(norm_rows[0].keys())
    has_ent_cols = {"id", "type", "name"}.issubset(columns)
    has_rel_cols = {"source", "target", "relation_type"}.issubset(columns)

    # Support combined CSV files containing both entity and relationship specifications
    if has_ent_cols and has_rel_cols:
        entity_rows = []
        relationship_rows = []
        for r in norm_rows:
            rec_type = r.get("record_type", "").strip().lower()
            has_valid_rel = bool(r.get("source") and r.get("target") and r.get("relation_type"))
            has_valid_ent = bool(r.get("id") and r.get("type") and r.get("name"))

            if rec_type in ("relationship", "rel", "edge", "link") or (has_valid_rel and not has_valid_ent):
                relationship_rows.append(r)
            elif rec_type in ("entity", "ent", "node", "vertex") or (has_valid_ent and not has_valid_rel):
                entity_rows.append(r)
            elif has_valid_ent and has_valid_rel:
                entity_rows.append(r)
                relationship_rows.append(r)
            elif has_valid_ent:
                entity_rows.append(r)
            elif has_valid_rel:
                relationship_rows.append(r)

        return entity_rows, relationship_rows

    if has_ent_cols:
        return norm_rows, []
    if has_rel_cols:
        return [], norm_rows
    raise ImportValidationError(
        f"CSV columns {sorted(columns)} do not match either the entity schema "
        f"(id,type,name,...) or the relationship schema (source,target,relation_type,...)."
    )


def parse_json(content: str) -> Tuple[List[dict], List[dict]]:
    """Structured JSON import: expects {"entities": [...], "relationships": [...]}."""
    try:
        payload = json_lib.loads(content)
    except json_lib.JSONDecodeError as exc:
        raise ImportValidationError(f"Invalid JSON: {exc}") from exc

    entities = payload.get("entities", [])
    relationships = payload.get("relationships", [])
    if not isinstance(entities, list) or not isinstance(relationships, list):
        raise ImportValidationError('JSON import must contain "entities" and/or "relationships" arrays.')
    return entities, relationships


def split_text_into_chunks(text: str, max_chunk_chars: int = 2500) -> List[str]:
    """
    Splits pasted free text into report-sized chunks.
    Aggregates paragraphs or semi-structured records up to max_chunk_chars
    so that small rows/blocks do not produce dozens of single-line API requests,
    preventing rate-limiting (HTTP 429) and context fragmentation.
    """
    text = text.strip()
    if not text:
        return []
    raw_blocks = [c.strip() for c in text.split("\n\n") if c.strip()]
    if not raw_blocks:
        return [text]

    chunks: List[str] = []
    current_chunk: List[str] = []
    current_length = 0

    for block in raw_blocks:
        block_len = len(block)
        if block_len >= max_chunk_chars:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_length = 0
            chunks.append(block)
        elif current_length + block_len + 2 > max_chunk_chars:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
            current_chunk = [block]
            current_length = block_len
        else:
            current_chunk.append(block)
            current_length += block_len + 2

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks or [text]

