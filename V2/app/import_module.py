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
    if {"id", "type", "name"}.issubset(columns):
        return norm_rows, []
    if {"source", "target", "relation_type"}.issubset(columns):
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


def split_text_into_chunks(text: str) -> List[str]:
    """Splits pasted free text into report-sized chunks (blank-line separated, else whole text)."""
    text = text.strip()
    if not text:
        return []
    chunks = [c.strip() for c in text.split("\n\n") if c.strip()]
    return chunks or [text]
