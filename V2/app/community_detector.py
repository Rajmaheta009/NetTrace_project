"""
Module: Community & Cluster Detection
Uses deterministic NetworkX modularity-based algorithms to partition the network
into clusters. Assigns strictly neutral, non-accusatory group labels.
"""

from typing import Dict, List, Tuple, Any
import networkx as nx
from networkx.algorithms.community import greedy_modularity_communities

from app.models import CommunityOut


def detect_communities(
    graph: nx.Graph,
    centrality: Dict[str, Dict[str, float]],
) -> Tuple[List[CommunityOut], Dict[str, str]]:
    """
    Partitions the network into modularity communities.
    Returns (communities_list, node_to_community_map).
    """
    if graph.number_of_nodes() == 0:
        return [], {}

    # Ensure we work on a simple undirected graph
    simple_g = nx.Graph(graph.to_undirected() if hasattr(graph, "to_undirected") else graph)

    # If graph has no edges, treat each node as its own cluster
    if simple_g.number_of_edges() == 0:
        communities = [{n} for n in simple_g.nodes()]
    else:
        try:
            communities = list(greedy_modularity_communities(simple_g))
        except Exception:
            # Fallback to connected components
            communities = list(nx.connected_components(simple_g))

    result: List[CommunityOut] = []
    node_to_comm: Dict[str, str] = {}

    # Sort communities by size descending
    communities.sort(key=len, reverse=True)

    for idx, comm_nodes in enumerate(communities, start=1):
        comm_id = f"comm-{idx}"
        comm_name = f"Community {idx}"
        node_list = list(comm_nodes)

        # Record mapping
        for nid in node_list:
            node_to_comm[nid] = comm_name

        subgraph = simple_g.subgraph(node_list)
        internal_edges = subgraph.number_of_edges()
        n_count = len(node_list)
        max_possible = (n_count * (n_count - 1)) / 2 if n_count > 1 else 1
        density = round(internal_edges / max_possible, 3) if max_possible > 0 else 1.0

        # Extract members & top entities by betweenness / degree
        members_data = []
        for nid in node_list:
            data = simple_g.nodes.get(nid, {})
            name = data.get("name", nid)
            etype = data.get("type", "Entity")
            c = centrality.get(nid, {"degree": 0.0, "betweenness": 0.0})
            members_data.append({
                "id": nid,
                "name": name,
                "type": etype,
                "degree": c["degree"],
                "betweenness": c["betweenness"],
            })

        # Sort members by composite prominence
        members_data.sort(key=lambda m: (m["betweenness"], m["degree"]), reverse=True)
        top_entities = members_data[:5]

        result.append(
            CommunityOut(
                community_id=comm_id,
                name=comm_name,
                size=n_count,
                members=[{"id": m["id"], "name": m["name"], "type": m["type"]} for m in members_data],
                important_entities=top_entities,
                internal_edges=internal_edges,
                density=density,
            )
        )

    return result, node_to_comm
