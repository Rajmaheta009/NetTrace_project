"""
Module: Investigation Report Generator
Compiles exhaustive forensic case dossiers including metadata, evidence index,
entity statistics, top influencers, communities, patterns, timeline, notes,
and audit verification.
"""

from datetime import datetime
from typing import Any, Dict, List

from app.analytics import compute_centrality, ranked_entities
from app.audit_logger import get_audit_trail
from app.case_store import CaseStore
from app.community_detector import detect_communities
from app.models import (
    CentralityEntry,
    CommunityOut,
    InvestigationReportResponse,
    PatternFlag,
    SummaryResponse,
)
from app.patterns import detect_all_patterns
from app.summary import generate_summary


def generate_case_report(case_store: CaseStore, generated_by: str = "Officer Vikram") -> InvestigationReportResponse:
    """
    Assembles a comprehensive investigation report for the specified case store.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    graph = case_store.build_graph()
    centrality = compute_centrality(graph)
    ranked = ranked_entities(graph, centrality)
    patterns = detect_all_patterns(graph, centrality)
    communities, _ = detect_communities(graph, centrality)
    raw_summary = generate_summary(ranked, patterns)

    # Observed facts vs Graph findings vs AI interpretation separation
    observed_facts = [
        f"{len(case_store.entities)} verified entities and {len(case_store.relationships)} relationship edges documented across {len(case_store.evidence)} surveillance artifacts.",
        f"{len([r for r in case_store.relationships.values() if r.confidence >= 0.7])} relationships possess strong or very strong corroborating evidence.",
    ]
    graph_findings = [
        f"Network clusters into {len(communities)} distinct operational communities via modularity analysis.",
        f"Highest betweenness broker identified: {ranked[0][1]} ({ranked[0][0]}) with centrality {ranked[0][3]:.3f}." if ranked else "Graph currently has 0 nodes.",
        f"{len(patterns)} suspicious network patterns algorithmically flagged by deterministic heuristics.",
    ]
    ai_interpretation = [
        raw_summary.get("summary", "Case network analysis completed.")
    ]

    summary_model = SummaryResponse(
        summary=raw_summary.get("summary", ""),
        entities_to_watch=raw_summary.get("entities_to_watch", []),
        observed_facts=observed_facts,
        graph_findings=graph_findings,
        ai_interpretation=ai_interpretation,
    )

    # Entity statistics by type
    etype_counts: Dict[str, int] = {}
    for e in case_store.entities.values():
        etype_counts[e.type.value] = etype_counts.get(e.type.value, 0) + 1

    # Relationship statistics by relation type & confidence
    rtype_counts: Dict[str, int] = {}
    conf_counts: Dict[str, int] = {}
    for r in case_store.relationships.values():
        rtype = r.relation_type.value if hasattr(r.relation_type, "value") else str(r.relation_type)
        rtype_counts[rtype] = rtype_counts.get(rtype, 0) + 1
        conf_counts[r.confidence_label] = conf_counts.get(r.confidence_label, 0) + 1

    # Top entities entries
    top_entries = [
        CentralityEntry(id=r[0], name=r[1], degree=r[2], betweenness=r[3])
        for r in ranked[:10]
    ]

    # Timeline events
    timeline_events: List[Dict[str, Any]] = []
    for r in case_store.relationships.values():
        ts = r.attributes.get("timestamp") or (f"Event {r.event_id}" if r.event_id else None)
        if ts:
            src_name = case_store.entities.get(r.source, None)
            tgt_name = case_store.entities.get(r.target, None)
            timeline_events.append({
                "timestamp": ts,
                "source": src_name.name if src_name else r.source,
                "action": r.relation_type.value if hasattr(r.relation_type, "value") else str(r.relation_type),
                "target": tgt_name.name if tgt_name else r.target,
                "confidence": r.confidence,
                "evidence": r.evidence[0] if r.evidence else "",
            })
    timeline_events.sort(key=lambda x: str(x["timestamp"]), reverse=True)

    # Validation stats
    valid_count = len([v for v in case_store.validation_records.values() if v.status == "Valid"])
    review_count = len([v for v in case_store.validation_records.values() if v.status == "Needs Review"])
    reject_count = len([v for v in case_store.validation_records.values() if v.status == "Rejected"])
    val_stats = {
        "total_evaluated": len(case_store.validation_records),
        "valid": valid_count,
        "needs_review": review_count,
        "rejected": reject_count,
    }

    # Audit trail filtered for this case
    all_audit = get_audit_trail(limit=50)
    case_audit = [a for a in all_audit if a.get("case_id") == case_store.case_id or not a.get("case_id")]

    return InvestigationReportResponse(
        case_info=case_store.get_summary_model(),
        generated_at=now,
        generated_by=generated_by,
        summary=summary_model,
        evidence_list=list(case_store.evidence.values()),
        entity_statistics={"total": len(case_store.entities), "by_type": etype_counts},
        relationship_statistics={"total": len(case_store.relationships), "by_type": rtype_counts, "by_confidence": conf_counts},
        top_entities=top_entries,
        detected_patterns=patterns,
        communities=communities,
        timeline_events=timeline_events,
        validation_statistics=val_stats,
        notes=list(case_store.notes.values()),
        audit_trail=case_audit[:20],
    )
