"""
Module: Connection Finder & Shortest Path Analysis
Finds deterministic connection paths between any two entities in the case network
using NetworkX, reconstructing all linking relationships, evidence citations,
and confidence scores along the path.
"""

from typing import Any, Dict, List, Optional
import networkx as nx

from app.models import ConnectionPathResponse, ConnectionPathStep, Entity


def find_connection_path(
    graph: nx.Graph,
    entities: Dict[str, Entity],
    relationships: Dict[str, Any],
    source_id: str,
    target_id: str,
) -> ConnectionPathResponse:
    """
    Computes shortest path between source_id and target_id.
    """
    if source_id not in entities or target_id not in entities:
        return ConnectionPathResponse(
            found=False,
            source_id=source_id,
            target_id=target_id,
            message="One or both selected entities do not exist in the active case.",
        )

    if source_id == target_id:
        src = entities[source_id]
        return ConnectionPathResponse(
            found=True,
            source_id=source_id,
            target_id=target_id,
            hops=0,
            path_nodes=[{"id": src.id, "name": src.name, "type": src.type.value}],
            path_edges=[],
            average_confidence=1.0,
            message="Source and target are the same entity.",
        )

    # Use undirected projection for pathfinding so navigation traverses both directions
    simple_g = nx.Graph(graph.to_undirected() if hasattr(graph, "to_undirected") else graph)

    if not simple_g.has_node(source_id) or not simple_g.has_node(target_id):
        return ConnectionPathResponse(
            found=False,
            source_id=source_id,
            target_id=target_id,
            message="No connection found in the current case data.",
        )

    try:
        node_path = nx.shortest_path(simple_g, source=source_id, target=target_id)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return ConnectionPathResponse(
            found=False,
            source_id=source_id,
            target_id=target_id,
            message="No connection found in the current case data.",
        )

    # Construct step-by-step path details
    path_nodes: List[Dict[str, Any]] = []
    for nid in node_path:
        ent = entities.get(nid)
        if ent:
            path_nodes.append({
                "id": ent.id,
                "name": ent.name,
                "type": ent.type.value,
                "attributes": ent.attributes,
            })
        else:
            path_nodes.append({"id": nid, "name": nid, "type": "Entity", "attributes": {}})

    path_edges: List[ConnectionPathStep] = []
    total_conf = 0.0

    for i in range(len(node_path) - 1):
        u = node_path[i]
        v = node_path[i + 1]

        # Find best matching relationship connecting u and v
        best_rel = None
        for r in relationships.values():
            if (r.source == u and r.target == v) or (r.source == v and r.target == u):
                if not best_rel or r.confidence > best_rel.confidence:
                    best_rel = r

        if best_rel:
            step_conf = best_rel.confidence
            step_label = best_rel.confidence_label
            step_ev = best_rel.evidence or ["Documented inter-entity connection"]
            step_rel_type = best_rel.relation_type.value if hasattr(best_rel.relation_type, "value") else str(best_rel.relation_type)
            ev_id = best_rel.evidence_id
            src_file = best_rel.source_file
        else:
            step_conf = 0.5
            step_label = "Moderate"
            step_ev = ["Derived network path link"]
            step_rel_type = "CONNECTED"
            ev_id = None
            src_file = None

        total_conf += step_conf
        src_name = entities[u].name if u in entities else u
        tgt_name = entities[v].name if v in entities else v

        path_edges.append(
            ConnectionPathStep(
                source_id=u,
                source_name=src_name,
                relation_type=step_rel_type,
                target_id=v,
                target_name=tgt_name,
                evidence=step_ev,
                confidence=step_conf,
                confidence_label=step_label,
                evidence_id=ev_id,
                source_file=src_file,
            )
        )

    hops = len(path_edges)
    avg_conf = round(total_conf / hops, 2) if hops > 0 else 1.0

    return ConnectionPathResponse(
        found=True,
        source_id=source_id,
        target_id=target_id,
        hops=hops,
        path_nodes=path_nodes,
        path_edges=path_edges,
        average_confidence=avg_conf,
        message=f"Connection path found across {hops} hop(s) with {avg_conf * 100:.0f}% average evidence confidence.",
    )
