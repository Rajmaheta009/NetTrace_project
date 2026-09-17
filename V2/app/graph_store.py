"""
Module 4 - Graph Construction & In-Memory Store (PRD section 11)

Holds ONE networkx.MultiGraph for the running backend session (PRD section 10/13:
no dedicated DB server, the graph itself is the data store).
Also owns entity de-duplication by normalized name or shared phone number.
"""

import uuid
from threading import Lock
from typing import Dict, List, Optional

import networkx as nx

from app.models import Entity, EntityType, GraphLinkOut, GraphNodeOut, GraphResponse, Relationship


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


class GraphStore:
    """Single global store - matches the PRD's one-process, in-memory design (no per-case split)."""

    def __init__(self) -> None:
        self.entities: Dict[str, Entity] = {}
        self.relationships: Dict[str, Relationship] = {}
        self._lock = Lock()

    def reset(self) -> None:
        with self._lock:
            self.entities = {}
            self.relationships = {}

    # ---- dedup -------------------------------------------------------------

    def find_duplicate(self, candidate: Entity) -> Optional[str]:
        """Returns the id of an existing entity that matches by ID, normalized name, phone, or alias, else None."""
        if candidate.id in self.entities:
            return candidate.id

        cand_name = _normalize(candidate.name)
        cand_phone = _normalize(candidate.attributes.get("phone", "")) if candidate.attributes.get("phone") else None

        for existing in self.entities.values():
            # Match if identical type
            if existing.type == candidate.type:
                if _normalize(existing.name) == cand_name:
                    return existing.id
                # Check if candidate name is in existing aliases
                existing_aliases = {_normalize(a) for a in existing.aliases}
                if cand_name in existing_aliases:
                    return existing.id
                # Or candidate has aliases matching existing name
                cand_aliases = {_normalize(a) for a in candidate.aliases}
                if _normalize(existing.name) in cand_aliases:
                    return existing.id
                # For PhoneNumber entities, match by normalized number
                if candidate.type == EntityType.PHONE_NUMBER and cand_phone:
                    existing_phone = existing.attributes.get("phone") or existing.name
                    if existing_phone and _normalize(existing_phone) == cand_phone:
                        return existing.id
                # For Vehicle entities, match by normalized plate
                if candidate.type == EntityType.VEHICLE:
                    cand_plate = candidate.attributes.get("plate") or candidate.name
                    exist_plate = existing.attributes.get("plate") or existing.name
                    if cand_plate and exist_plate and _normalize(exist_plate) == _normalize(cand_plate):
                        return existing.id
        return None

    def upsert_entities(self, candidates: List[Entity]) -> Dict[str, str]:
        """
        Adds new entities or intelligently merges into existing duplicates.
        Ensures existing attributes are preserved without destruction, and new attributes are merged.
        """
        id_map: Dict[str, str] = {}
        with self._lock:
            for cand in candidates:
                dup_id = self.find_duplicate(cand)
                if dup_id:
                    existing = self.entities[dup_id]
                    # Merge aliases cleanly
                    existing.aliases = sorted((set(existing.aliases) | set(cand.aliases) | {cand.name}) - {existing.name})
                    
                    # Intelligently merge attributes without destroying existing data
                    merged_attrs = dict(existing.attributes)
                    for k, v in cand.attributes.items():
                        if k not in merged_attrs or merged_attrs[k] in (None, ""):
                            merged_attrs[k] = v
                        elif isinstance(merged_attrs[k], list) and isinstance(v, list):
                            merged_attrs[k] = sorted(set(merged_attrs[k]) | set(v))
                        elif isinstance(merged_attrs[k], str) and isinstance(v, str) and merged_attrs[k] != v:
                            # If different string attributes, combine them if useful
                            if v not in merged_attrs[k]:
                                merged_attrs[k] = f"{merged_attrs[k]}, {v}"
                    existing.attributes = merged_attrs
                    existing.source_refs = sorted(set(existing.source_refs) | set(cand.source_refs))
                    id_map[cand.id] = dup_id
                else:
                    final_id = cand.id if cand.id not in self.entities else str(uuid.uuid4())
                    self.entities[final_id] = cand.model_copy(update={"id": final_id})
                    id_map[cand.id] = final_id
        return id_map

    def find_duplicate_relationship(self, candidate: Relationship) -> Optional[Relationship]:
        """Finds existing relationship connecting same pair with same relation_type (undirected)."""
        cand_pair = {candidate.source, candidate.target}
        for existing in self.relationships.values():
            if existing.relation_type == candidate.relation_type:
                if cand_pair == {existing.source, existing.target}:
                    return existing
        return None

    def add_relationships(self, relationships: List[Relationship]) -> None:
        """Adds relationships without creating duplicate multi-edges between identical pairs."""
        with self._lock:
            for rel in relationships:
                existing_rel = self.find_duplicate_relationship(rel)
                if existing_rel:
                    # Intelligently merge evidence, weights, and attributes
                    existing_rel.evidence = sorted(set(existing_rel.evidence) | set(rel.evidence))
                    existing_rel.weight = max(existing_rel.weight, rel.weight)
                    if rel.event_id and rel.event_id not in (existing_rel.event_id or ""):
                        if existing_rel.event_id:
                            existing_rel.event_id = f"{existing_rel.event_id}; {rel.event_id}"
                        else:
                            existing_rel.event_id = rel.event_id
                    for ak, av in rel.attributes.items():
                        if ak not in existing_rel.attributes or existing_rel.attributes[ak] in (None, ""):
                            existing_rel.attributes[ak] = av
                else:
                    self.relationships[rel.id] = rel

    # ---- graph construction --------------------------------------------------

    def build_graph(self) -> nx.MultiGraph:
        """
        Instantiates an undirected MultiGraph (PRD section 16: two entities may be linked
        by more than one relation type at once, e.g. KNOWS and CALLED).
        """
        graph = nx.MultiGraph()

        for entity in self.entities.values():
            graph.add_node(
                entity.id,
                type=entity.type.value,
                name=entity.name,
                aliases=entity.aliases,
                attributes=entity.attributes,
                source_refs=entity.source_refs,
            )

        for rel in self.relationships.values():
            # Critical guard: only add an edge if both endpoints are confirmed entities.
            if rel.source in self.entities and rel.target in self.entities:
                graph.add_edge(
                    rel.source,
                    rel.target,
                    key=rel.id,
                    rel_id=rel.id,
                    relation_type=rel.relation_type.value,
                    weight=rel.weight,
                    evidence=rel.evidence,
                    event_id=rel.event_id,
                    attributes=rel.attributes,
                )

        return graph

    def to_node_link(self, centrality: Dict[str, Dict[str, float]]) -> GraphResponse:
        nodes = [
            GraphNodeOut(
                id=e.id,
                type=e.type,
                name=e.name,
                aliases=e.aliases,
                attributes=e.attributes,
                centrality=centrality.get(e.id, {"degree": 0.0, "betweenness": 0.0}),
                source_refs=e.source_refs,
            )
            for e in self.entities.values()
        ]
        links = [
            GraphLinkOut(
                source=r.source,
                target=r.target,
                relation_type=r.relation_type,
                weight=r.weight,
                evidence=r.evidence,
                event_id=r.event_id,
                attributes=r.attributes,
            )
            for r in self.relationships.values()
            if r.source in self.entities and r.target in self.entities
        ]
        return GraphResponse(nodes=nodes, links=links)


from app.case_store import case_manager


class DelegatingGraphStore:
    """
    Delegates all graph operations to the currently active case in case_manager.
    Maintains 100% backward compatibility for all existing pipeline/API calls
    while guaranteeing strict case isolation.
    """

    @property
    def entities(self) -> Dict[str, Entity]:
        return case_manager.get_active_case().entities

    @entities.setter
    def entities(self, val: Dict[str, Entity]) -> None:
        case_manager.get_active_case().entities = val

    @property
    def relationships(self) -> Dict[str, Relationship]:
        return case_manager.get_active_case().relationships

    @relationships.setter
    def relationships(self, val: Dict[str, Relationship]) -> None:
        case_manager.get_active_case().relationships = val

    def reset(self) -> None:
        return case_manager.get_active_case().reset()

    def find_duplicate(self, candidate: Entity) -> Optional[str]:
        return case_manager.get_active_case().find_duplicate(candidate)

    def upsert_entities(self, candidates: List[Entity]) -> Dict[str, str]:
        return case_manager.get_active_case().upsert_entities(candidates)

    def find_duplicate_relationship(self, candidate: Relationship) -> Optional[Relationship]:
        return case_manager.get_active_case().find_duplicate_relationship(candidate)

    def add_relationships(self, relationships: List[Relationship]) -> None:
        return case_manager.get_active_case().add_relationships(relationships)

    def build_graph(self) -> nx.MultiGraph:
        return case_manager.get_active_case().build_graph()

    def build_undirected_graph(self) -> nx.Graph:
        return case_manager.get_active_case().build_undirected_graph()

    def to_node_link(self, centrality: Dict[str, Dict[str, float]], community_map: Optional[Dict[str, str]] = None) -> GraphResponse:
        return case_manager.get_active_case().to_node_link(centrality, community_map)


store = DelegatingGraphStore()
