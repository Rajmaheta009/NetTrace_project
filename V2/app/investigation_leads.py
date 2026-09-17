"""
Module: Investigation Lead Prioritization Service (app/investigation_leads.py)
Calculates deterministic, transparent multi-factor Investigation Lead Scores (0-100)
for entities within an active case.
STRICT BOUNDARIES:
- Never determines guilt or criminality.
- Transparently breaks down all contributing graph observations and verifiable evidence citations.
- Includes mandatory investigative disclaimer.
"""

from typing import Dict, List, Optional, Any, Set
import networkx as nx
from app.models import Entity, Relationship, Evidence, InvestigationLeadOut
from app.crime_profiles import get_crime_profile, CrimeProfile


DISCLAIMER_TEXT = "This indicator supports investigative prioritization only. It is not a determination of guilt, criminality, or legal responsibility."


def compute_entity_lead_score(
    entity: Entity,
    graph: nx.MultiDiGraph,
    relationships: Dict[str, Relationship],
    evidence_registry: Dict[str, Evidence],
    profile: CrimeProfile,
    communities_map: Optional[Dict[str, str]] = None,
    betweenness_dict: Optional[Dict[str, float]] = None,
    degree_dict: Optional[Dict[str, float]] = None,
) -> InvestigationLeadOut:
    """
    Computes a transparent 0-100 Investigation Lead Score for a given entity,
    weighted by the active CrimeProfile.
    """
    weights = profile.lead_scoring_weights or {
        "evidence_support": 25.0,
        "relationship_repetition": 20.0,
        "timeline_correlation": 20.0,
        "cross_community": 15.0,
        "shared_attributes": 10.0,
        "graph_position": 10.0,
    }

    contributing_observations: List[str] = []
    supporting_evidence_set: Set[str] = set()
    factor_breakdown: Dict[str, float] = {}
    explanation: List[str] = []

    entity_id = entity.id

    # 1. Evidence Support (Max: weights["evidence_support"])
    # Cites evidence attached directly to entity or to incident relationships
    if entity.evidence_id:
        supporting_evidence_set.add(entity.evidence_id)

    # Inspect all incident edges connected to entity
    incident_rels = [
        r for r in relationships.values()
        if r.source == entity_id or r.target == entity_id
    ]

    for r in incident_rels:
        if r.evidence_id:
            supporting_evidence_set.add(r.evidence_id)
        for ev_ref in r.evidence:
            if ev_ref.startswith("EV-"):
                supporting_evidence_set.add(ev_ref)

    ev_count = len(supporting_evidence_set)
    # Normalized: 1 evidence -> 40%, 3+ evidence -> 100% of max evidence weight
    ev_factor = min(1.0, ev_count / 3.0) if ev_count > 0 else 0.0
    ev_score = round(ev_factor * weights.get("evidence_support", 25.0), 1)
    factor_breakdown["evidence_support"] = ev_score

    if ev_count > 0:
        contributing_observations.append(
            f"Corroborated by {ev_count} distinct evidence record(s) in case registry (+{ev_score} pts)"
        )
        explanation.append(
            f"Entity appears in or connects to {ev_count} documented evidence record(s) ({', '.join(sorted(supporting_evidence_set)[:3])})."
        )
    else:
        explanation.append("Entity has no direct evidence citations registered in the current case.")

    # 2. Relationship Repetition (Max: weights["relationship_repetition"])
    # Frequent multi-channel contact, multiple edge occurrences
    total_occurrences = sum(r.occurrences for r in incident_rels) if incident_rels else 0
    multi_channel_count = len(incident_rels)

    rep_factor = 0.0
    if multi_channel_count >= 1:
        rep_factor += 0.3
    if total_occurrences >= 2 or multi_channel_count >= 2:
        rep_factor += 0.4
    if total_occurrences >= 4 or multi_channel_count >= 4:
        rep_factor += 0.3
    rep_factor = min(1.0, rep_factor)
    rep_score = round(rep_factor * weights.get("relationship_repetition", 20.0), 1)
    factor_breakdown["relationship_repetition"] = rep_score

    if rep_score > 0:
        contributing_observations.append(
            f"Documented repeated interaction across {multi_channel_count} connection(s) with {total_occurrences} observed occurrences (+{rep_score} pts)"
        )
        counterparts = set()
        for r in incident_rels:
            other = r.target if r.source == entity_id else r.source
            counterparts.add(other)
        explanation.append(
            f"Entity maintains {multi_channel_count} direct connection(s) with {len(counterparts)} counterpart entity(ies)."
        )
    else:
        explanation.append("Entity has minimal or single isolated interactions documented.")

    # 3. Timeline Correlation (Max: weights["timeline_correlation"])
    # Presence in temporal event logs or timestamps
    timestamps_found = []
    for r in incident_rels:
        t = r.attributes.get("timestamp") or r.attributes.get("date") or r.attributes.get("time")
        if t:
            timestamps_found.append(str(t))

    time_count = len(timestamps_found)
    time_factor = min(1.0, time_count / 2.0) if time_count > 0 else (0.2 if incident_rels else 0.0)
    time_score = round(time_factor * weights.get("timeline_correlation", 20.0), 1)
    factor_breakdown["timeline_correlation"] = time_score

    if time_count > 0:
        contributing_observations.append(
            f"Chronologically anchored across {time_count} specific surveillance timestamp(s) (+{time_score} pts)"
        )
        explanation.append(
            f"{time_count} event(s) involving this entity occur within documented temporal timelines."
        )
    else:
        explanation.append("Entity interactions are active across general observation logs without precise timestamps.")

    # 4. Cross-Community Connection (Max: weights["cross_community"])
    # Checks if entity connects to multiple modularity communities
    communities_reached: Set[str] = set()
    my_comm = communities_map.get(entity_id) if communities_map else None
    if my_comm:
        communities_reached.add(my_comm)

    for r in incident_rels:
        other_id = r.target if r.source == entity_id else r.source
        if communities_map and other_id in communities_map:
            communities_reached.add(communities_map[other_id])

    comm_reach_count = len(communities_reached)
    comm_factor = 0.0
    if comm_reach_count > 1:
        comm_factor = min(1.0, (comm_reach_count - 1) / 2.0 + 0.5)
    elif comm_reach_count == 1:
        comm_factor = 0.2

    comm_score = round(comm_factor * weights.get("cross_community", 15.0), 1)
    factor_breakdown["cross_community"] = comm_score

    if comm_reach_count > 1:
        contributing_observations.append(
            f"Boundary-spanning bridge reaching across {comm_reach_count} distinct structural communities (+{comm_score} pts)"
        )
        explanation.append(
            f"Entity bridges {comm_reach_count} distinct network communities ({', '.join(sorted(communities_reached))})."
        )
    else:
        explanation.append(f"Entity is confined to a single structural community ({my_comm or 'Cluster 1'}).")

    # 5. Shared Attributes (Max: weights["shared_attributes"])
    # Phone, plate, imei, or address shared with others
    shared_attr_flags = 0
    phone = entity.attributes.get("phone")
    imei = entity.attributes.get("imei")
    plate = entity.attributes.get("plate")
    if phone and ("," in phone or "/" in phone or "shared" in entity.attributes.get("role", "").lower()):
        shared_attr_flags += 1
    if imei and ("," in imei or "shared" in entity.attributes.get("role", "").lower()):
        shared_attr_flags += 1
    if plate and "fleet" in entity.attributes.get("role", "").lower():
        shared_attr_flags += 1

    shared_factor = min(1.0, shared_attr_flags * 0.5) if shared_attr_flags > 0 else (0.2 if entity.aliases else 0.0)
    shared_score = round(shared_factor * weights.get("shared_attributes", 10.0), 1)
    factor_breakdown["shared_attributes"] = shared_score

    if shared_attr_flags > 0 or entity.aliases:
        alias_txt = f" with {len(entity.aliases)} known alias(es)" if entity.aliases else ""
        contributing_observations.append(
            f"Shared communication hardware, fleet assets, or multi-SIM identifiers detected{alias_txt} (+{shared_score} pts)"
        )

    # 6. Graph Position & Centrality (Max: weights["graph_position"])
    bw = betweenness_dict.get(entity_id, 0.0) if betweenness_dict else 0.0
    deg = degree_dict.get(entity_id, 0.0) if degree_dict else 0.0

    pos_factor = min(1.0, bw * 1.5 + deg * 0.5)
    pos_score = round(pos_factor * weights.get("graph_position", 10.0), 1)
    factor_breakdown["graph_position"] = pos_score

    if bw > 0.05 or deg > 0.1:
        contributing_observations.append(
            f"Significant network centrality (Betweenness: {bw:.3f}, Degree: {deg:.3f}) indicating structural influence (+{pos_score} pts)"
        )

    # Final Normalized Score (0 - 100)
    total_raw = ev_score + rep_score + time_score + comm_score + shared_score + pos_score
    final_score = int(min(100, max(0, round(total_raw))))

    # Determine Neutral Investigative Status
    if final_score >= 60:
        status = "REQUIRES FURTHER REVIEW"
    elif final_score >= 35:
        status = "ELEVATED INQUIRY"
    else:
        status = "STANDARD INQUIRY"

    return InvestigationLeadOut(
        entity_id=entity_id,
        entity_name=entity.name,
        entity_type=entity.type.value if hasattr(entity.type, "value") else str(entity.type),
        score=final_score,
        status=status,
        contributing_observations=contributing_observations,
        supporting_evidence=sorted(list(supporting_evidence_set)),
        factor_breakdown=factor_breakdown,
        explanation=explanation,
        disclaimer=DISCLAIMER_TEXT,
    )


def rank_case_investigation_leads(
    case_store: Any,
    profile_id: Optional[str] = None,
) -> List[InvestigationLeadOut]:
    """
    Computes and ranks all entities within a CaseStore by their Investigation Lead Score.
    """
    profile = get_crime_profile(profile_id or case_store.investigation_type)
    G = case_store.build_graph()

    # Pre-calculate centralities on simple projection
    undirected = nx.Graph()
    for u, v in G.edges():
        undirected.add_edge(u, v)

    betweenness = nx.betweenness_centrality(undirected) if len(undirected) > 1 else {n: 0.0 for n in G.nodes()}
    degree = nx.degree_centrality(undirected) if len(undirected) > 1 else {n: 0.0 for n in G.nodes()}

    # Community detection
    communities_map: Dict[str, str] = {}
    try:
        from app.community_detector import detect_communities
        comms = detect_communities(G)
        for c in comms:
            for m in c.members:
                communities_map[m["id"]] = c.name
    except Exception:
        pass

    leads = []
    for entity in case_store.entities.values():
        lead = compute_entity_lead_score(
            entity=entity,
            graph=G,
            relationships=case_store.relationships,
            evidence_registry=case_store.evidence,
            profile=profile,
            communities_map=communities_map,
            betweenness_dict=betweenness,
            degree_dict=degree,
        )
        leads.append(lead)

    leads.sort(key=lambda x: x.score, reverse=True)
    return leads
