"""
Module 8 - AI-Assisted Investigation Summary (PRD section 11 / section 15)

Input is the already-computed ranked entity list and pattern flags. The model
is explicitly told not to introduce any fact beyond what is provided - the
graph output is the source of truth, the AI only narrates it.
"""

import json
from typing import Dict, List
from app.ai_client import (AIUnavailableError,call_groq_json,)
from app.models import PatternFlag

SUMMARY_SYSTEM_PROMPT = """You are an investigative-briefing assistant.

You are given, as JSON: a ranked list of entities with their centrality scores, and a list
of deterministically-computed suspicious-pattern flags. These were computed by non-AI graph
algorithms - treat them as ground truth. Do not recompute, dispute, or add to them.

Write:
1. A concise plain-English investigative summary (150-250 words), referencing entities by name.
2. A short "entities_to_watch" list (entity names with a one-phrase reason each).

You must NOT introduce any entity, relationship, or fact not present in the input data, and
you must NOT make a guilt/threat determination about any individual - only describe what the
structural data shows and note that findings require human investigator verification.

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"summary": "...", "entities_to_watch": ["Name (reason)", "..."]}
"""


def generate_summary(
    ranked_entities: List[tuple], pattern_flags: List[PatternFlag]
) -> Dict:
    """ranked_entities: list of (id, name, degree, betweenness) tuples, already sorted."""
    if not ranked_entities:
        return {
            "summary": "Graph memory is empty. Insert CSV, JSON, or field notes via '+ Insert Data' to begin syndicate analysis.",
            "entities_to_watch": []
        }
    top_entities = [
        {"id": r[0], "name": r[1], "degree": r[2], "betweenness": r[3]} for r in ranked_entities[:10]
    ]
    payload = {
        "top_entities": top_entities,
        "pattern_flags": [f.model_dump() for f in pattern_flags],
    }

    try:
        raw = call_groq_json(SUMMARY_SYSTEM_PROMPT,json.dumps(payload, default=str))
    except AIUnavailableError as exc:
        return {
            "summary": (
                "AI summary is unavailable right now (" + str(exc) + "). "
                "The deterministic centrality rankings and pattern flags below are still accurate "
                "and were computed independently of the AI layer - please review them directly."
            ),
            "entities_to_watch": [e["name"] for e in top_entities[:3]],
        }

    try:
        parsed = json.loads(raw)
        return {
            "summary": str(parsed.get("summary", "")).strip(),
            "entities_to_watch": [str(x) for x in parsed.get("entities_to_watch", [])],
        }
    except json.JSONDecodeError:
        return {
            "summary": "AI summary returned malformed output; showing raw text below.\n\n" + raw,
            "entities_to_watch": [e["name"] for e in top_entities[:3]],
        }
