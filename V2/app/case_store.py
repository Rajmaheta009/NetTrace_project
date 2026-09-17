"""
Module: Case Management and Case-Isolated Storage
Encapsulates graph stores per case to ensure investigation data from different
cases never mix, while providing evidence-weighted relationship confidence scoring
and validation queues.
"""

import hashlib
import uuid
from datetime import datetime
from threading import Lock
from typing import Dict, List, Optional, Tuple, Any

import networkx as nx

from app.models import (
    Case,
    CaseStatus,
    Entity,
    EntityType,
    Evidence,
    EvidenceSourceType,
    EvidenceStatus,
    GraphLinkOut,
    GraphNodeOut,
    GraphResponse,
    Note,
    Relationship,
    RelationType,
    ValidationRecord,
    ValidationStatus,
)


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


def compute_relationship_confidence(
    rel: Relationship,
    source_entity: Optional[Entity] = None,
    target_entity: Optional[Entity] = None,
) -> Tuple[float, str, List[str]]:
    """
    Configurable evidence-based relationship confidence score (0.0 to 1.0).
    Separate from graph centrality.
    Formula:
      +0.30 : Same phone / direct telecom link
      +0.25 : Same vehicle / fleet link
      +0.20 : Direct communication (CALLED, CONTACTED, MESSAGED)
      +0.10 : Same location / physical co-presence (MET_AT, LOCATED_AT)
      +0.15 : Repeated co-occurrence / multiple independent records
      +0.10 : Corroborated evidence citation quote
    """
    score = 0.10  # Base recorded link observation
    reasons = ["Direct recorded observation in source data (+0.10)"]
    rel_type_str = rel.relation_type.value if hasattr(rel.relation_type, "value") else str(rel.relation_type)

    # 1. Direct communication
    if rel_type_str in ("CALLED", "MESSAGED", "CONTACTED", "COMMUNICATED_WITH"):
        score += 0.20
        reasons.append("Direct telecommunications intercept (+0.20)")

    # 2. Vehicle association
    if rel_type_str in ("OWNS_VEHICLE", "DRIVES", "SEEN_IN_VEHICLE") or (
        (source_entity and source_entity.type == EntityType.VEHICLE) or (target_entity and target_entity.type == EntityType.VEHICLE)
    ):
        score += 0.25
        reasons.append("Motor vehicle registration or surveillance sighting (+0.25)")

    # 3. Location co-presence
    if rel_type_str in ("MET_AT", "LOCATED_AT", "SEEN_AT", "VISITED"):
        score += 0.10
        reasons.append("Physical co-presence at surveillance site (+0.10)")

    # 4. Same phone / shared identifier
    if rel.attributes.get("phone") or (
        source_entity and source_entity.attributes.get("phone") and target_entity and target_entity.attributes.get("phone") and
        source_entity.attributes.get("phone") == target_entity.attributes.get("phone")
    ):
        score += 0.30
        reasons.append("Shared telecom line / burner SIM correlation (+0.30)")

    # 5. Repeated co-occurrence / multi-event corroboration
    if rel.weight > 1 or len(rel.evidence) > 1 or rel.event_id or rel.occurrences > 1:
        score += 0.15
        occ = max(rel.weight, len(rel.evidence), rel.occurrences)
        reasons.append(f"Repeated co-occurrence across {occ} corroborating events (+0.15)")

    # 6. Formal corporate or financial ledger link
    if rel_type_str in ("TRANSFERRED", "PAID", "MEMBER_OF", "HAWALA", "FUNDED"):
        score += 0.15
        reasons.append("Financial conduit or corporate registry documentation (+0.15)")

    final_score = round(min(1.0, max(0.15, score)), 2)

    if final_score >= 0.90:
        label = "Very Strong"
    elif final_score >= 0.70:
        label = "Strong"
    elif final_score >= 0.50:
        label = "Moderate"
    elif final_score >= 0.30:
        label = "Possible"
    else:
        label = "Weak"

    return final_score, label, reasons


class CaseStore:
    """Isolated storage, NetworkX graph, evidence, validation, and notes for a single case."""

    def __init__(self, case_id: str, case_name: str, description: str = "", investigation_type: str = "organized_crime", created_by: str = "Officer Vikram") -> None:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.case_id = case_id
        self.case_name = case_name
        self.description = description
        self.investigation_type = investigation_type
        self.status = CaseStatus.OPEN
        self.created_at = now
        self.updated_at = now
        self.created_by = created_by

        self.entities: Dict[str, Entity] = {}
        self.relationships: Dict[str, Relationship] = {}
        self.evidence: Dict[str, Evidence] = {}
        self.validation_records: Dict[str, ValidationRecord] = {}
        self.notes: Dict[str, Note] = {}
        self._lock = Lock()

    def get_summary_model(self) -> Case:
        return Case(
            case_id=self.case_id,
            case_name=self.case_name,
            description=self.description,
            investigation_type=self.investigation_type,
            status=self.status,
            created_at=self.created_at,
            updated_at=self.updated_at,
            created_by=self.created_by,
            evidence_count=len(self.evidence),
            entity_count=len(self.entities),
            relationship_count=len(self.relationships),
        )

    def set_investigation_type(self, inv_type: str) -> None:
        with self._lock:
            self.investigation_type = inv_type
            self.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def reset(self) -> None:
        with self._lock:
            self.entities = {}
            self.relationships = {}
            self.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ---- Evidence Management ------------------------------------------------

    def register_evidence(
        self,
        filename: str,
        source_type: EvidenceSourceType,
        content: str,
        record_count: int = 0,
        uploaded_by: str = "Officer Vikram",
        description: str = "",
    ) -> Evidence:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sha256_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"
        
        ev = Evidence(
            evidence_id=evidence_id,
            case_id=self.case_id,
            filename=filename,
            source_type=source_type,
            uploaded_at=now,
            uploaded_by=uploaded_by,
            file_type="text/plain",
            record_count=record_count,
            processing_status=EvidenceStatus.COMPLETED,
            sha256_hash=sha256_hash,
            description=description or f"Imported surveillance artifact {filename}",
            original_source_ref=filename,
        )
        with self._lock:
            self.evidence[evidence_id] = ev
            self.updated_at = now
        return ev

    # ---- Entity Resolution & Deduplication ----------------------------------

    def find_duplicate(self, candidate: Entity) -> Optional[str]:
        if candidate.id in self.entities:
            return candidate.id

        cand_name = _normalize(candidate.name)
        cand_phone = _normalize(candidate.attributes.get("phone", "")) if candidate.attributes.get("phone") else None

        for existing in self.entities.values():
            if existing.type == candidate.type:
                if _normalize(existing.name) == cand_name:
                    return existing.id
                existing_aliases = {_normalize(a) for a in existing.aliases}
                if cand_name in existing_aliases:
                    return existing.id
                cand_aliases = {_normalize(a) for a in candidate.aliases}
                if _normalize(existing.name) in cand_aliases:
                    return existing.id
                if candidate.type == EntityType.PHONE_NUMBER and cand_phone:
                    exist_phone = existing.attributes.get("phone") or existing.name
                    if exist_phone and _normalize(exist_phone) == cand_phone:
                        return existing.id
                if candidate.type == EntityType.VEHICLE:
                    cand_plate = candidate.attributes.get("plate") or candidate.name
                    exist_plate = existing.attributes.get("plate") or existing.name
                    if cand_plate and exist_plate and _normalize(exist_plate) == _normalize(cand_plate):
                        return existing.id
        return None

    def upsert_entities(self, candidates: List[Entity]) -> Dict[str, str]:
        id_map: Dict[str, str] = {}
        with self._lock:
            for cand in candidates:
                dup_id = self.find_duplicate(cand)
                if dup_id:
                    existing = self.entities[dup_id]
                    existing.aliases = sorted((set(existing.aliases) | set(cand.aliases) | {cand.name}) - {existing.name})
                    merged_attrs = dict(existing.attributes)
                    for k, v in cand.attributes.items():
                        if k not in merged_attrs or merged_attrs[k] in (None, ""):
                            merged_attrs[k] = v
                        elif isinstance(merged_attrs[k], list) and isinstance(v, list):
                            merged_attrs[k] = sorted(set(merged_attrs[k]) | set(v))
                        elif isinstance(merged_attrs[k], str) and isinstance(v, str) and merged_attrs[k] != v:
                            if v not in merged_attrs[k]:
                                merged_attrs[k] = f"{merged_attrs[k]}, {v}"
                    existing.attributes = merged_attrs
                    existing.source_refs = sorted(set(existing.source_refs) | set(cand.source_refs))
                    id_map[cand.id] = dup_id
                else:
                    final_id = cand.id if cand.id not in self.entities else str(uuid.uuid4())
                    self.entities[final_id] = cand.model_copy(update={"id": final_id})
                    id_map[cand.id] = final_id
            self.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return id_map

    # ---- Relationships & Confidence -----------------------------------------

    def find_duplicate_relationship(self, candidate: Relationship) -> Optional[Relationship]:
        cand_pair = {candidate.source, candidate.target}
        for existing in self.relationships.values():
            if existing.relation_type == candidate.relation_type:
                if cand_pair == {existing.source, existing.target}:
                    return existing
        return None

    def add_relationships(self, relationships: List[Relationship]) -> None:
        with self._lock:
            for rel in relationships:
                existing_rel = self.find_duplicate_relationship(rel)
                src_node = self.entities.get(rel.source)
                tgt_node = self.entities.get(rel.target)
                conf_score, conf_label, conf_reasons = compute_relationship_confidence(rel, src_node, tgt_node)

                if existing_rel:
                    existing_rel.evidence = sorted(set(existing_rel.evidence) | set(rel.evidence))
                    existing_rel.weight = max(existing_rel.weight, rel.weight)
                    existing_rel.occurrences += 1
                    if rel.event_id and rel.event_id not in (existing_rel.event_id or ""):
                        existing_rel.event_id = f"{existing_rel.event_id}; {rel.event_id}" if existing_rel.event_id else rel.event_id
                    for ak, av in rel.attributes.items():
                        if ak not in existing_rel.attributes or existing_rel.attributes[ak] in (None, ""):
                            existing_rel.attributes[ak] = av
                    # Recompute higher confidence upon multiple occurrences
                    re_score, re_label, re_reasons = compute_relationship_confidence(existing_rel, src_node, tgt_node)
                    existing_rel.confidence = re_score
                    existing_rel.confidence_label = re_label
                    existing_rel.confidence_reasons = re_reasons
                else:
                    rel.confidence = conf_score
                    rel.confidence_label = conf_label
                    rel.confidence_reasons = conf_reasons
                    self.relationships[rel.id] = rel
            self.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ---- Validation Queue ---------------------------------------------------

    def queue_validation(
        self,
        item_type: str,
        name_or_pair: str,
        payload: Dict[str, Any],
        status: ValidationStatus = ValidationStatus.NEEDS_REVIEW,
        confidence: float = 0.5,
        reason: str = "",
        source_evidence: str = "",
    ) -> ValidationRecord:
        record_id = f"VAL-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        rec = ValidationRecord(
            record_id=record_id,
            case_id=self.case_id,
            item_type=item_type,
            name_or_pair=name_or_pair,
            status=status,
            confidence=confidence,
            reason=reason,
            source_evidence=source_evidence,
            created_at=now,
            payload=payload,
        )
        with self._lock:
            self.validation_records[record_id] = rec
        return rec

    def review_validation(self, record_id: str, action: str, corrected_payload: Optional[Dict[str, Any]] = None) -> Optional[ValidationRecord]:
        with self._lock:
            rec = self.validation_records.get(record_id)
            if not rec:
                return None
            if action == "accept":
                rec.status = ValidationStatus.VALID
                if rec.item_type == "entity":
                    ent = Entity(**rec.payload)
                    self.entities[ent.id] = ent
                elif rec.item_type == "relationship":
                    rel = Relationship(**rec.payload)
                    self.relationships[rel.id] = rel
            elif action == "reject":
                rec.status = ValidationStatus.REJECTED
            elif action == "correct":
                rec.status = ValidationStatus.VALID
                payload = corrected_payload or rec.payload
                rec.payload = payload
                if rec.item_type == "entity":
                    ent = Entity(**payload)
                    self.entities[ent.id] = ent
                elif rec.item_type == "relationship":
                    rel = Relationship(**payload)
                    self.relationships[rel.id] = rel
            return rec

    # ---- Field Notes --------------------------------------------------------

    def create_note(
        self,
        note_text: str,
        entity_id: Optional[str] = None,
        relationship_id: Optional[str] = None,
        evidence_id: Optional[str] = None,
        created_by: str = "Officer Vikram",
    ) -> Note:
        note_id = f"NOTE-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        note = Note(
            note_id=note_id,
            case_id=self.case_id,
            entity_id=entity_id,
            relationship_id=relationship_id,
            evidence_id=evidence_id,
            note_text=note_text,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self.notes[note_id] = note
            self.updated_at = now
        return note

    def delete_note(self, note_id: str) -> bool:
        with self._lock:
            if note_id in self.notes:
                del self.notes[note_id]
                self.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                return True
        return False

    # ---- Graph Construction (MultiDiGraph) ----------------------------------

    def build_graph(self) -> nx.MultiDiGraph:
        """
        Builds a MultiDiGraph with explicit directional source -> target edges.
        """
        graph = nx.MultiDiGraph()
        for entity in self.entities.values():
            graph.add_node(
                entity.id,
                type=entity.type.value,
                name=entity.name,
                aliases=entity.aliases,
                attributes=entity.attributes,
                source_refs=entity.source_refs,
                community_id=entity.community_id,
            )
        for rel in self.relationships.values():
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
                    confidence=rel.confidence,
                    confidence_label=rel.confidence_label,
                    confidence_reasons=rel.confidence_reasons,
                    evidence_id=rel.evidence_id,
                    source_file=rel.source_file,
                    source_record=rel.source_record,
                    validation_status=rel.validation_status,
                    occurrences=rel.occurrences,
                )
        return graph

    def build_undirected_graph(self) -> nx.Graph:
        """Collapses multi-directed edges into a simple undirected graph for community & centrality metrics."""
        return nx.Graph(self.build_graph().to_undirected())

    def to_node_link(
        self,
        centrality: Dict[str, Dict[str, float]],
        community_map: Optional[Dict[str, str]] = None,
    ) -> GraphResponse:
        nodes = []
        for e in self.entities.values():
            comm_id = (community_map or {}).get(e.id, e.community_id)
            ev_count = max(1, len(e.source_refs))
            nodes.append(
                GraphNodeOut(
                    id=e.id,
                    type=e.type,
                    name=e.name,
                    aliases=e.aliases,
                    attributes=e.attributes,
                    centrality=centrality.get(e.id, {"degree": 0.0, "betweenness": 0.0}),
                    source_refs=e.source_refs,
                    community_id=comm_id,
                    evidence_count=ev_count,
                )
            )

        links = []
        for r in self.relationships.values():
            if r.source in self.entities and r.target in self.entities:
                links.append(
                    GraphLinkOut(
                        source=r.source,
                        target=r.target,
                        relation_type=r.relation_type,
                        weight=r.weight,
                        evidence=r.evidence,
                        event_id=r.event_id,
                        attributes=r.attributes,
                        confidence=r.confidence,
                        confidence_label=r.confidence_label,
                        confidence_reasons=r.confidence_reasons,
                        evidence_id=r.evidence_id,
                        source_file=r.source_file,
                        source_record=r.source_record,
                        validation_status=r.validation_status,
                        occurrences=r.occurrences,
                    )
                )

        return GraphResponse(directed=True, multigraph=True, nodes=nodes, links=links)


class CaseManager:
    """Singleton repository manager for multi-case digital investigations."""

    def __init__(self) -> None:
        self.cases: Dict[str, CaseStore] = {}
        self.active_case_id: str = "case-001"
        self._lock = Lock()
        self._initialize_default_cases()

    def _initialize_default_cases(self) -> None:
        # Case 1: Primary Operation Falcon Shadow
        case1 = CaseStore(
            case_id="case-001",
            case_name="Operation Falcon Shadow",
            description="Transnational gold smuggling, Hawala conduits, and port clearance racket operating across UAE and Mumbai.",
            investigation_type="smuggling",
            created_by="Officer Vikram (Lead)",
        )
        try:
            from app.sample_data import SAMPLE_ENTITIES_CSV, SAMPLE_RELATIONSHIPS_CSV
            from app.import_module import parse_csv, classify_csv_rows
            from app.extraction import extract_from_structured_entities, extract_from_structured_relationships
            
            ent_rows, _ = classify_csv_rows(parse_csv(SAMPLE_ENTITIES_CSV))
            entities, _ = extract_from_structured_entities(ent_rows, "seed_entities.csv")
            case1.upsert_entities(entities)
            
            raw_to_global = {e.id: e.id for e in case1.entities.values()}
            for e in case1.entities.values():
                raw_to_global[e.name] = e.id
                raw_to_global[e.name.lower()] = e.id
                for a in e.aliases:
                    raw_to_global[a] = e.id
                    raw_to_global[a.lower()] = e.id
            _, rel_rows = classify_csv_rows(parse_csv(SAMPLE_RELATIONSHIPS_CSV))
            rels, _ = extract_from_structured_relationships(rel_rows, raw_to_global, "seed_relationships.csv")
            case1.add_relationships(rels)
            
            # Register initial evidence items
            case1.register_evidence("seed_entities.csv", EvidenceSourceType.CSV, SAMPLE_ENTITIES_CSV, record_count=len(entities), description="Initial intelligence database export")
            case1.register_evidence("seed_relationships.csv", EvidenceSourceType.CSV, SAMPLE_RELATIONSHIPS_CSV, record_count=len(rels), description="Initial telecom intercept ledger")
        except Exception:
            pass

        self.cases["case-001"] = case1

        # Case 2: Cyber Hawala 2026
        case2 = CaseStore(
            case_id="case-002",
            case_name="Case Cyber Hawala 2026",
            description="Digital cryptocurrency laundering syndicate using mule accounts and offshore shell entities.",
            investigation_type="cybercrime",
            created_by="Director Sharma (Supervisory)",
        )
        self.cases["case-002"] = case2

    def get_active_case(self) -> CaseStore:
        with self._lock:
            if self.active_case_id not in self.cases:
                self.active_case_id = next(iter(self.cases.keys()), "case-001")
                if self.active_case_id not in self.cases:
                    self._initialize_default_cases()
            return self.cases[self.active_case_id]

    def get_case(self, case_id: str) -> Optional[CaseStore]:
        with self._lock:
            return self.cases.get(case_id)

    def switch_case(self, case_id: str) -> CaseStore:
        with self._lock:
            if case_id not in self.cases:
                raise KeyError(f"Case with ID {case_id} not found")
            self.active_case_id = case_id
            return self.cases[case_id]

    def create_case(self, case_name: str, description: str = "", investigation_type: str = "organized_crime", created_by: str = "Officer Vikram") -> CaseStore:
        with self._lock:
            case_id = f"case-{uuid.uuid4().hex[:6]}"
            new_store = CaseStore(
                case_id=case_id,
                case_name=case_name,
                description=description,
                investigation_type=investigation_type,
                created_by=created_by,
            )
            self.cases[case_id] = new_store
            self.active_case_id = case_id
            return new_store

    def update_case(
        self,
        case_id: str,
        case_name: Optional[str] = None,
        description: Optional[str] = None,
        investigation_type: Optional[str] = None,
        status: Optional[CaseStatus] = None,
    ) -> Optional[CaseStore]:
        with self._lock:
            c = self.cases.get(case_id)
            if not c:
                return None
            if case_name:
                c.case_name = case_name
            if description is not None:
                c.description = description
            if investigation_type:
                c.investigation_type = investigation_type
            if status:
                c.status = status
            c.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return c

    def delete_case(self, case_id: str) -> bool:
        with self._lock:
            if case_id in self.cases:
                del self.cases[case_id]
                if self.active_case_id == case_id:
                    self.active_case_id = next(iter(self.cases.keys()), "case-001")
                    if self.active_case_id not in self.cases:
                        self._initialize_default_cases()
                return True
            return False

    def list_cases(self) -> List[Case]:
        with self._lock:
            return [c.get_summary_model() for c in self.cases.values()]


case_manager = CaseManager()
