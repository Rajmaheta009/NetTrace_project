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


def parse_csv(content: str) -> List[dict]:
    """
    Parses a single CSV blob into row dicts. Auto-detects whether it's an
    entities table (has an 'id' + 'type' column) or a relationships table
    (has 'source' + 'target' + 'relation_type'), since the PRD's sample data
    ships these as two separate CSV files under one `type: "csv"` import call.
    """
    df = pd.read_csv(io.StringIO(content), dtype=str, keep_default_na=False)
    return df.to_dict(orient="records")


def classify_csv_rows(rows: List[dict]) -> Tuple[List[dict], List[dict]]:
    if not rows:
        return [], []
    columns = set(rows[0].keys())
    if {"id", "type", "name"}.issubset(columns):
        return rows, []
    if {"source", "target", "relation_type"}.issubset(columns):
        return [], rows
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
