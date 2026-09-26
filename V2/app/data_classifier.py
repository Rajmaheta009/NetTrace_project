"""
Module 0 - Input Classification (PRD section 11 pre-processing gate)

Runs BEFORE the import pipeline decides how to parse anything. Classifies
raw uploaded content into one of three buckets:

  structured      - CSV or JSON that already matches the PRD's exact
                    entity/relationship schema. Goes straight to the
                    deterministic parsers (import_module.parse_csv/parse_json).
  semi_structured - Valid CSV/JSON, but an unknown/ad-hoc schema (different
                    column names, nested objects, ragged rows, etc). Flattened
                    into readable "key: value" text blocks and routed through
                    the text pipeline so the existing AI extraction can map it.
  unstructured    - Free-form prose, reports, logs. Routed through the text
                    pipeline unchanged.

AI Usage: None. This module is pure stdlib (json/csv) heuristics - per the
PRD's AI boundary, triage/routing decisions are not something the AI makes.
Both semi_structured and unstructured resolve to the same existing "text"
import type, so no new AI call site is introduced; they just get better,
more machine-readable input than raw bytes would give the LLM.
"""

import csv
import io
import json as json_lib
from dataclasses import dataclass
from typing import List, Literal, Tuple

Bucket = Literal["structured", "semi_structured", "unstructured"]
EffectiveType = Literal["csv", "json", "text"]

STRUCTURED_ENTITY_COLUMNS = {"id", "type", "name"}
STRUCTURED_RELATIONSHIP_COLUMNS = {"source", "target", "relation_type"}

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
    "suspect": "name",
    "person": "name",
    "subject": "name",
    "individual": "name",
    "source_id": "source",
    "src": "source",
    "from_id": "source",
    "from": "source",
    "caller": "source",
    "caller_id": "source",
    "sender": "source",
    "origin": "source",
    "target_id": "target",
    "dst": "target",
    "to_id": "target",
    "to": "target",
    "callee": "target",
    "callee_id": "target",
    "receiver": "target",
    "recipient": "target",
    "destination": "target",
    "spot": "name",
    "location": "name",
    "relationship": "relation_type",
    "relation": "relation_type",
    "edge_type": "relation_type",
    "rel_type": "relation_type",
    "link_type": "relation_type",
}


@dataclass
class ClassificationResult:
    bucket: Bucket
    effective_type: EffectiveType
    content: str  # possibly normalized/flattened, ready for the existing parsers


def classify_and_normalize(raw_content: str) -> ClassificationResult:
    content = raw_content.strip()
    if not content:
        return ClassificationResult("unstructured", "text", content)

    # 1. Try JSON.
    payload = None
    try:
        payload = json_lib.loads(content)
    except json_lib.JSONDecodeError:
        pass

    if payload is not None:
        if isinstance(payload, dict) and ("entities" in payload or "relationships" in payload):
            return ClassificationResult("structured", "json", content)
        return ClassificationResult("semi_structured", "text", _flatten_json_to_text(payload))

    # 2. Try CSV / other delimited text.
    rows = _try_parse_delimited(content)
    if rows and len(rows) >= 2:
        raw_header = [h.strip().lower() for h in rows[0]]
        header = {COLUMN_ALIASES.get(h, h) for h in raw_header}
        if STRUCTURED_ENTITY_COLUMNS.issubset(header) or STRUCTURED_RELATIONSHIP_COLUMNS.issubset(header):
            normalized_header = [COLUMN_ALIASES.get(h, h) for h in raw_header]
            padded_rows = [normalized_header]
            for r in rows[1:]:
                padded_r = r + [""] * (len(normalized_header) - len(r))
                padded_rows.append(padded_r[:len(normalized_header)])
            out_io = io.StringIO()
            csv.writer(out_io).writerows(padded_rows)
            return ClassificationResult("structured", "csv", out_io.getvalue())
        return ClassificationResult("semi_structured", "text", _flatten_rows_to_text(rows))

    # 3. Try XML / HTML.
    if content.startswith("<") and ("</" in content or "/>" in content):
        xml_text = _flatten_xml_to_text(content)
        if xml_text:
            return ClassificationResult("semi_structured", "text", xml_text)

    # 4. Key:value / log-like lines still count as semi-structured; everything
    #    else (paragraphs of prose) is unstructured. Both end up as "text" -
    #    this only affects the bucket label shown to the user, not routing.
    lines = [line for line in content.splitlines() if line.strip()]
    if lines:
        kv_like = sum(1 for line in lines if (":" in line or "=" in line) and len(line) < 200)
        if lines and kv_like / len(lines) > 0.6:
            return ClassificationResult("semi_structured", "text", content)

    return ClassificationResult("unstructured", "text", content)


def _flatten_xml_to_text(xml_content: str) -> str:
    import re
    import xml.etree.ElementTree as ET
    try:
        clean = xml_content.strip()
        try:
            root = ET.fromstring(clean)
        except ET.ParseError:
            root = ET.fromstring(f"<root>{clean}</root>")

        blocks = []
        for elem in root.iter():
            tag_name = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            pairs = []
            if elem.attrib:
                for k, v in elem.attrib.items():
                    pairs.append(f"{k}: {v}")
            text_val = (elem.text or "").strip()
            if text_val and len(text_val) > 1:
                pairs.append(f"{tag_name}: {text_val}")
            if pairs:
                blocks.append(", ".join(pairs))
        if blocks:
            return "\n\n".join(blocks[:500])
    except Exception:
        pass
    clean_text = re.sub(r"<[^>]+>", " ", xml_content)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()
    return clean_text


def _try_parse_delimited(content: str) -> List[List[str]]:
    try:
        dialect = csv.Sniffer().sniff(content[:4096], delimiters=",\t;|")
    except csv.Error:
        return []
    try:
        return list(csv.reader(io.StringIO(content), dialect))
    except csv.Error:
        return []


def _flatten_json_to_text(payload) -> str:
    records = payload if isinstance(payload, list) else [payload]
    blocks = []
    for rec in records:
        if isinstance(rec, dict):
            pairs = ", ".join(f"{k}: {v}" for k, v in rec.items() if v not in (None, ""))
            if pairs:
                blocks.append(pairs)
        elif rec not in (None, ""):
            blocks.append(str(rec))
    return "\n\n".join(blocks)


def _flatten_rows_to_text(rows: List[List[str]]) -> str:
    header, *data_rows = rows
    blocks = []
    for row in data_rows:
        pairs = ", ".join(f"{h.strip()}: {v.strip()}" for h, v in zip(header, row) if v and v.strip())
        if pairs:
            blocks.append(pairs)
    return "\n\n".join(blocks)
