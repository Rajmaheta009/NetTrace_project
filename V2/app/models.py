"""
Criminal Network Analysis - Data models

Node/edge shapes and enums follow PRD section 13 (Database/Schema Design) and
section 16 (Graph Model & Algorithms) exactly.
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class EntityType(str, Enum):
    PERSON = "Person"
    ORGANIZATION = "Organization"
    LOCATION = "Location"
    VEHICLE = "Vehicle"
    PHONE_NUMBER = "PhoneNumber"
    EVENT = "Event"


class RelationType(str, Enum):
    KNOWS = "KNOWS"
    CALLED = "CALLED"
    MET_AT = "MET_AT"
    OWNS_VEHICLE = "OWNS_VEHICLE"
    MEMBER_OF = "MEMBER_OF"
    LOCATED_AT = "LOCATED_AT"
    PARTICIPATED_IN = "PARTICIPATED_IN"
    ASSOCIATED_WITH = "ASSOCIATED_WITH"


class Entity(BaseModel):
    id: str
    type: EntityType
    name: str
    aliases: List[str] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    source_refs: List[str] = Field(default_factory=list)


class Relationship(BaseModel):
    id: str  # internal id, not part of the PRD wire schema but needed to address individual edges
    source: str
    target: str
    relation_type: RelationType
    weight: int = 1
    evidence: List[str] = Field(default_factory=list)
    event_id: Optional[str] = None  # correlates co-occurrences across events


# ---- Request/response payloads --------------------------------------------------


class ImportRequest(BaseModel):
    type: Optional[Literal["csv", "json", "text"]] = None  # None = run data_classifier
    content: str
    source_label: Optional[str] = None


class ImportResponse(BaseModel):
    imported_entities: int
    imported_relationships: int
    rejected_relationships: List[str]
    warnings: List[str]
    node_count: int
    edge_count: int
    detected_input_type: Optional[str] = None  # "structured" | "semi_structured" | "unstructured"


class GraphNodeOut(BaseModel):
    id: str
    type: EntityType
    name: str
    aliases: List[str]
    attributes: Dict[str, Any]
    centrality: Dict[str, float]
    source_refs: List[str]


class GraphLinkOut(BaseModel):
    source: str
    target: str
    relation_type: RelationType
    weight: int
    evidence: List[str]
    event_id: Optional[str] = None


class GraphResponse(BaseModel):
    directed: bool = False
    multigraph: bool = True
    nodes: List[GraphNodeOut]
    links: List[GraphLinkOut]


class CentralityEntry(BaseModel):
    id: str
    name: str
    degree: float
    betweenness: float


class PatternFlag(BaseModel):
    pattern_type: str
    entities_involved: List[str]
    evidence: str
    severity: Literal["low", "medium", "high"]


class ConnectionOut(BaseModel):
    entity_id: str
    entity_name: str
    relation_type: RelationType
    evidence: List[str]


class EntityDetailResponse(BaseModel):
    entity: Entity
    centrality: Dict[str, float]
    connections: List[ConnectionOut]


class SummaryResponse(BaseModel):
    summary: str
    entities_to_watch: List[str]
