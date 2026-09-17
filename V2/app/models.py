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


# ---- Core Entities & Relationships ---------------------------------------------

class Entity(BaseModel):
    id: str
    type: EntityType
    name: str
    aliases: List[str] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    source_refs: List[str] = Field(default_factory=list)
    community_id: Optional[str] = None
    evidence_id: Optional[str] = None
    source_file: Optional[str] = None
    source_record: Optional[str] = None
    validation_status: Optional[str] = "Valid"


class Relationship(BaseModel):
    id: str  # internal id, not part of the PRD wire schema but needed to address individual edges
    source: str
    target: str
    relation_type: RelationType
    weight: int = 1
    evidence: List[str] = Field(default_factory=list)
    event_id: Optional[str] = None  # correlates co-occurrences across events
    attributes: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.5
    confidence_label: str = "Moderate"
    confidence_reasons: List[str] = Field(default_factory=list)
    evidence_id: Optional[str] = None
    source_file: Optional[str] = None
    source_record: Optional[str] = None
    validation_status: str = "Valid"
    occurrences: int = 1


# ---- Case Management Models ----------------------------------------------------

class CaseStatus(str, Enum):
    OPEN = "Open"
    UNDER_REVIEW = "Under Review"
    CLOSED = "Closed"
    ARCHIVED = "Archived"


class Case(BaseModel):
    case_id: str
    case_name: str
    description: str = ""
    investigation_type: str = "organized_crime"
    status: CaseStatus = CaseStatus.OPEN
    created_at: str
    updated_at: str
    created_by: str = "Officer Vikram"
    evidence_count: int = 0
    entity_count: int = 0
    relationship_count: int = 0


class CaseCreateRequest(BaseModel):
    case_name: str
    description: str = ""
    investigation_type: Optional[str] = "organized_crime"
    created_by: Optional[str] = "Officer Vikram"


class CaseUpdateRequest(BaseModel):
    case_name: Optional[str] = None
    description: Optional[str] = None
    investigation_type: Optional[str] = None
    status: Optional[CaseStatus] = None


# ---- Evidence Management Models ------------------------------------------------

class EvidenceSourceType(str, Enum):
    CSV = "CSV"
    JSON = "JSON"
    TEXT = "Text"
    REPORT = "Report"
    LOG = "Log"
    MANUAL_ENTRY = "Manual Entry"
    OTHER = "Other"


class EvidenceStatus(str, Enum):
    PROCESSING = "Processing"
    COMPLETED = "Completed"
    WARNING = "Warning"
    FAILED = "Failed"


class Evidence(BaseModel):
    evidence_id: str
    case_id: str
    filename: str
    source_type: EvidenceSourceType = EvidenceSourceType.OTHER
    uploaded_at: str
    uploaded_by: str = "Officer Vikram"
    file_type: str = "text/plain"
    record_count: int = 0
    processing_status: EvidenceStatus = EvidenceStatus.COMPLETED
    sha256_hash: str = ""
    description: str = ""
    original_source_ref: str = ""


# ---- Data Quality / Validation Center Models -----------------------------------

class ValidationStatus(str, Enum):
    VALID = "Valid"
    NEEDS_REVIEW = "Needs Review"
    REJECTED = "Rejected"


class ValidationRecord(BaseModel):
    record_id: str
    case_id: str
    item_type: Literal["entity", "relationship"]
    name_or_pair: str
    status: ValidationStatus = ValidationStatus.NEEDS_REVIEW
    confidence: float = 0.5
    reason: str = ""
    source_evidence: str = ""
    created_at: str = ""
    payload: Dict[str, Any] = Field(default_factory=dict)


class ValidationReviewAction(BaseModel):
    action: Literal["accept", "reject", "correct"]
    corrected_payload: Optional[Dict[str, Any]] = None
    reviewer_notes: Optional[str] = ""


# ---- Field Notes Models --------------------------------------------------------

class Note(BaseModel):
    note_id: str
    case_id: str
    entity_id: Optional[str] = None
    relationship_id: Optional[str] = None
    evidence_id: Optional[str] = None
    note_text: str
    created_by: str = "Officer Vikram"
    created_at: str
    updated_at: str


class NoteCreateRequest(BaseModel):
    entity_id: Optional[str] = None
    relationship_id: Optional[str] = None
    evidence_id: Optional[str] = None
    note_text: str
    created_by: Optional[str] = "Officer Vikram"


# ---- User & RBAC Models -------------------------------------------------------

class UserRole(str, Enum):
    ADMIN = "Admin"
    INVESTIGATOR = "Investigator"
    VIEWER = "Viewer"


class UserProfile(BaseModel):
    user_id: str
    name: str
    role: UserRole


class UserRoleSwitchRequest(BaseModel):
    role: UserRole


class EvidenceCreateRequest(BaseModel):
    filename: str
    source_type: EvidenceSourceType = EvidenceSourceType.OTHER
    content: str
    description: Optional[str] = ""
    uploaded_by: Optional[str] = "Officer Vikram"


# ---- Graph & Analytics Payloads ------------------------------------------------

class ImportRequest(BaseModel):
    type: Optional[Literal["csv", "json", "text"]] = None  # None = run data_classifier
    content: str
    source_label: Optional[str] = None
    case_id: Optional[str] = None


class ImportResponse(BaseModel):
    imported_entities: int
    imported_relationships: int
    rejected_relationships: List[str]
    warnings: List[str]
    node_count: int
    edge_count: int
    detected_input_type: Optional[str] = None  # "structured" | "semi_structured" | "unstructured"
    evidence_id: Optional[str] = None


class GraphNodeOut(BaseModel):
    id: str
    type: EntityType
    name: str
    aliases: List[str]
    attributes: Dict[str, Any]
    centrality: Dict[str, float]
    source_refs: List[str]
    community_id: Optional[str] = None
    evidence_count: int = 1


class GraphLinkOut(BaseModel):
    source: str
    target: str
    relation_type: RelationType
    weight: int
    evidence: List[str]
    event_id: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.5
    confidence_label: str = "Moderate"
    confidence_reasons: List[str] = Field(default_factory=list)
    evidence_id: Optional[str] = None
    source_file: Optional[str] = None
    source_record: Optional[str] = None
    validation_status: str = "Valid"
    occurrences: int = 1


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
    why: Optional[str] = None
    graph_evidence: Optional[Dict[str, Any]] = None
    source_evidence: Optional[List[str]] = None


class ConnectionOut(BaseModel):
    entity_id: str
    entity_name: str
    relation_type: RelationType
    evidence: List[str]


class EntityDetailResponse(BaseModel):
    entity: Entity
    centrality: Dict[str, float]
    connections: List[ConnectionOut]
    community: Optional[str] = None
    evidence_refs: List[str] = Field(default_factory=list)
    notes: List[Note] = Field(default_factory=list)


class SummaryResponse(BaseModel):
    summary: str
    entities_to_watch: List[str]
    observed_facts: List[str] = Field(default_factory=list)
    graph_findings: List[str] = Field(default_factory=list)
    ai_interpretation: List[str] = Field(default_factory=list)


class CommunityOut(BaseModel):
    community_id: str
    name: str
    size: int
    members: List[Dict[str, str]]
    important_entities: List[Dict[str, Any]]
    internal_edges: int
    density: float


class ConnectionPathStep(BaseModel):
    source_id: str
    source_name: str
    relation_type: str
    target_id: str
    target_name: str
    evidence: List[str]
    confidence: float
    confidence_label: str
    evidence_id: Optional[str] = None
    source_file: Optional[str] = None


class ConnectionPathResponse(BaseModel):
    found: bool
    source_id: str
    target_id: str
    hops: int = 0
    path_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    path_edges: List[ConnectionPathStep] = Field(default_factory=list)
    average_confidence: float = 0.0
    message: Optional[str] = None


class InvestigationReportResponse(BaseModel):
    case_info: Case
    generated_at: str
    generated_by: str
    summary: SummaryResponse
    evidence_list: List[Evidence]
    entity_statistics: Dict[str, Any]
    relationship_statistics: Dict[str, Any]
    top_entities: List[CentralityEntry]
    detected_patterns: List[PatternFlag]
    communities: List[CommunityOut]
    timeline_events: List[Dict[str, Any]]
    validation_statistics: Dict[str, Any]
    notes: List[Note]
    audit_trail: List[Dict[str, Any]]


# ---- Crime Profile, Lead Prioritization & Deep Inspection Models ---------------

class InvestigationQuestionOut(BaseModel):
    index: int
    question: str
    profile_id: str
    profile_name: str
    relevant_entity_types: List[str] = Field(default_factory=list)
    relevant_relationship_types: List[str] = Field(default_factory=list)


class InvestigationLeadOut(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str
    score: int
    status: str
    contributing_observations: List[str] = Field(default_factory=list)
    supporting_evidence: List[str] = Field(default_factory=list)
    factor_breakdown: Dict[str, float] = Field(default_factory=dict)
    explanation: List[str] = Field(default_factory=list)
    disclaimer: str = "This indicator supports investigative prioritization only. It is not a determination of guilt, criminality, or legal responsibility."


class DeepEntityInspectionResponse(BaseModel):
    entity: Entity
    network_position: Dict[str, Any]
    relationships: List[Dict[str, Any]]
    evidence: List[Evidence]
    timeline: List[Dict[str, Any]]
    communities: Dict[str, Any]
    patterns: List[Dict[str, Any]]
    investigator_notes: List[Note]
    investigation_lead: Optional[InvestigationLeadOut] = None
    investigation_profile: Optional[Dict[str, Any]] = None
    disclaimer: str = "This indicator supports investigative prioritization only. It is not a determination of guilt, criminality, or legal responsibility."


class EntityMergeRequest(BaseModel):
    source_entity_id: str
    target_entity_id: str
    reason: Optional[str] = "Investigator verified duplicate identity"
