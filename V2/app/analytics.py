"""
Module 5 - Graph Analytics Engine (PRD section 11 / section 16)

Pure NetworkX. No AI is used or permitted here - the PRD explicitly calls out
that asking an LLM to "calculate" importance would be slower and less reliable.
"""

from typing import Dict

import networkx as nx


def compute_centrality(graph: nx.MultiGraph) -> Dict[str, Dict[str, float]]:
    """Returns {node_id: {"degree": ..., "betweenness": ...}} normalized to 0-1."""
    if graph.number_of_nodes() == 0:
        return {}

    simple_graph = nx.Graph(graph)  # collapse multi-edges for the centrality algorithms

    degree = nx.degree_centrality(simple_graph)

    try:
        betweenness = nx.betweenness_centrality(simple_graph)
    except Exception:
        betweenness = {n: 0.0 for n in simple_graph.nodes}

    return {
        node: {
            "degree": round(degree.get(node, 0.0), 4),
            "betweenness": round(betweenness.get(node, 0.0), 4),
        }
        for node in simple_graph.nodes
    }


def ranked_entities(graph: nx.MultiGraph, centrality: Dict[str, Dict[str, float]]):
    """Sorted (by degree desc, then betweenness desc) list of (node_id, name, degree, betweenness)."""
    rows = []
    for node_id, data in graph.nodes(data=True):
        c = centrality.get(node_id, {"degree": 0.0, "betweenness": 0.0})
        rows.append((node_id, data.get("name", node_id), c["degree"], c["betweenness"]))
    rows.sort(key=lambda r: (r[2], r[3]), reverse=True)
    return rows
