"""
Module: Case Management and Persistent Relational Storage
NetTrace Enterprise Persistence Layer (SQLite / PostgreSQL compatible)

Encapsulates transactional case stores, directional vs. symmetric relationship deduplication,
tamper-evident audit hooks, protected system case enforcement, safe entity merges,
and deterministic NetworkX graph construction.
"""

import hashlib
import json
import uuid
from datetime import datetime
from threading import Lock
import logging
from typing import Any, Dict, List, Optional, Tuple,Union

import networkx as nx

from app.database import (
    CaseDB,
    CaseUserDB,
    EntityDB,
    EntityMergeDB,
    EvidenceDB,
    InvestigationLeadDB,
    NoteDB, 
    PatternFindingDB,
    RelationshipDB,
    SessionLocal,
    ValidationRecordDB,
    init_db_and_seed,
)

logger = logging.getLogger("nettrace.case_store")
from app.models import (
    Case,
    CaseStatus,
    DIRECTED_RELATION_TYPES,
    SYMMETRIC_RELATION_TYPES,
    Entity,
    EntityType,
    EntityMergeRecordOut,
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
from app.crime_inference import infer_crime_for_relationship


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


def compute_relationship_confidence(
    rel: Relationship,
    source_entity: Optional[Entity] = None,
    target_entity: Optional[Entity] = None,
) -> Tuple[float, str, List[str]]:
    """
    Evidence-based relationship confidence score (0.0 to 1.0).
    Deterministic multi-factor scoring separate from graph centrality.
    """
    score = 0.10  # Base observation
    reasons = ["Direct recorded observation in source data (+0.10)"]
    rel_type_str = rel.relation_type.value if hasattr(rel.relation_type, "value") else str(rel.relation_type)

    if rel_type_str in ("CALLED", "MESSAGED", "CONTACTED", "COMMUNICATED_WITH"):
        score += 0.20
        reasons.append("Direct telecommunications intercept (+0.20)")

    if rel_type_str in ("OWNS_VEHICLE", "DRIVES", "SEEN_IN_VEHICLE") or (
        (source_entity and source_entity.type == EntityType.VEHICLE)
        or (target_entity and target_entity.type == EntityType.VEHICLE)
    ):
        score += 0.25
        reasons.append("Motor vehicle registration or surveillance sighting (+0.25)")

    if rel_type_str in ("MET_AT", "LOCATED_AT", "SEEN_AT", "VISITED"):
        score += 0.10
        reasons.append("Physical co-presence at surveillance site (+0.10)")

    if rel.attributes.get("phone") or (
        source_entity
        and source_entity.attributes.get("phone")
        and target_entity
        and target_entity.attributes.get("phone")
        and source_entity.attributes.get("phone") == target_entity.attributes.get("phone")
    ):
        score += 0.30
        reasons.append("Shared telecom line / burner SIM correlation (+0.30)")

    if rel.weight > 1 or len(rel.evidence) > 1 or rel.event_id or rel.occurrences > 1:
        score += 0.15
        occ = max(rel.weight, len(rel.evidence), rel.occurrences)
        reasons.append(f"Repeated co-occurrence across {occ} corroborating events (+0.15)")

    if rel_type_str in ("TRANSFERRED", "PAID", "MEMBER_OF", "HAWALA", "FUNDED", "FINANCIAL_TRANSACTION"):
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
    """Isolated transactional storage, NetworkX graph, evidence, validation, and notes for a single case."""

    def __init__(
        self,
        case_id: str,
        case_name: str,
        description: str = "",
        investigation_type: str = "organized_crime",
        status: CaseStatus = CaseStatus.OPEN,
        priority: str = "High",
        is_protected: bool = False,
        created_by: str = "Officer Vikram",
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None,
    ) -> None:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.case_id = case_id
        self.case_name = case_name
        self.description = description
        self.investigation_type = investigation_type
        self.status = status
        self.priority = priority
        self.is_protected = is_protected
        self.created_at = created_at or now
        self.updated_at = updated_at or now
        self.created_by = created_by

        self.entities: Dict[str, Entity] = {}
        self.relationships: Dict[str, Relationship] = {}
        self.evidence: Dict[str, Evidence] = {}
        self.validation_records: Dict[str, ValidationRecord] = {}
        self.notes: Dict[str, Note] = {}
        self.merges: List[EntityMergeRecordOut] = []
        self._lock = Lock()

    def get_summary_model(self) -> Case:
        return Case(
            case_id=self.case_id,
            case_name=self.case_name,
            description=self.description,
            investigation_type=self.investigation_type,
            status=self.status,
            priority=self.priority,
            is_protected=self.is_protected,
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
            self._sync_case_db()

    def _sync_case_db(self) -> None:
        """Persists current case metadata to SQLite database."""
        db = SessionLocal()
        try:
            c_db = db.query(CaseDB).filter(CaseDB.case_id == self.case_id).first()
            if not c_db:
                c_db = CaseDB(case_id=self.case_id, case_name=self.case_name, created_at=self.created_at)
                db.add(c_db)
            c_db.case_name = self.case_name
            c_db.description = self.description
            c_db.investigation_type = self.investigation_type
            c_db.status = self.status.value if hasattr(self.status, "value") else str(self.status)
            c_db.priority = self.priority
            c_db.is_protected = self.is_protected
            c_db.updated_at = self.updated_at
            c_db.created_by = self.created_by
            db.commit()
        finally:
            db.close()

    # ---- Clear Graph vs Reset Investigation ---------------------------------

    def clear_graph(self) -> None:
        """
        Removes graph-derived structures (entities, relationships).
        Evidence registry, validation records, and investigator notes are PRESERVED.
        """
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            self.entities = {}
            self.relationships = {}
            self.updated_at = now
            self._sync_case_db()

            db = SessionLocal()
            try:
                db.query(RelationshipDB).filter(RelationshipDB.case_id == self.case_id).delete()
                db.query(EntityDB).filter(EntityDB.case_id == self.case_id).delete()
                db.commit()
            finally:
                db.close()

    def reset_investigation(self) -> None:
        """
        Administrative wipe: Clears all entities, relationships, evidence,
        validation records, and field notes for this case.
        """
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            self.entities = {}
            self.relationships = {}
            self.evidence = {}
            self.validation_records = {}
            self.notes = {}
            self.merges = []
            self.updated_at = now
            self._sync_case_db()

            db = SessionLocal()
            try:
                db.query(RelationshipDB).filter(RelationshipDB.case_id == self.case_id).delete()
                db.query(EntityDB).filter(EntityDB.case_id == self.case_id).delete()
                db.query(EvidenceDB).filter(EvidenceDB.case_id == self.case_id).delete()
                db.query(ValidationRecordDB).filter(ValidationRecordDB.case_id == self.case_id).delete()
                db.query(NoteDB).filter(NoteDB.case_id == self.case_id).delete()
                db.query(EntityMergeDB).filter(EntityMergeDB.case_id == self.case_id).delete()
                db.commit()
            finally:
                db.close()

    # ---- Evidence Provenance & Registry -------------------------------------

    def register_evidence(
        self,
        filename: str,
        source_type: Union[EvidenceSourceType, str],
        content: str,
        record_count: int = 0,
        uploaded_by: str = "Officer Vikram",
        description: str = "",
        mime_type: str = "text/plain",
        parser_version: str = "v2.2-deterministic",
        ai_model_version: Optional[str] = None,
    ) -> Evidence:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sha256_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"

        # Normalize source_type
        if isinstance(source_type, str):
            st_low = source_type.strip().lower()
            if st_low == "csv":
                st_enum = EvidenceSourceType.CSV
            elif st_low == "json":
                st_enum = EvidenceSourceType.JSON
            elif st_low in ("text", "txt"):
                st_enum = EvidenceSourceType.TEXT
            elif st_low in ("report", "pdf"):
                st_enum = EvidenceSourceType.REPORT
            elif st_low in ("log", "cdr"):
                st_enum = EvidenceSourceType.LOG
            elif st_low in ("manual", "manual entry"):
                st_enum = EvidenceSourceType.MANUAL_ENTRY
            elif st_low == "other":
                st_enum = EvidenceSourceType.OTHER
            else:
                try:
                    st_enum = EvidenceSourceType(source_type)
                except Exception:
                    st_enum = EvidenceSourceType.OTHER
        else:
            st_enum = source_type or EvidenceSourceType.OTHER

        ev = Evidence(
            evidence_id=evidence_id,
            case_id=self.case_id,
            filename=filename,
            original_filename=filename,
            source_type=st_enum,
            mime_type=mime_type,
            file_size=len(content.encode("utf-8")),
            uploaded_at=now,
            uploaded_by=uploaded_by,
            source_system="NetTrace Core Ingestion",
            acquisition_timestamp=now,
            processing_timestamp=now,
            parser_version=parser_version,
            ai_model_version=ai_model_version,
            record_count=record_count,
            processing_status=EvidenceStatus.COMPLETED,
            sha256_hash=sha256_hash,
            description=description or f"Surveillance artifact: {filename}",
            original_source_ref=filename,
        )

        with self._lock:
            self.evidence[evidence_id] = ev
            self.updated_at = now
            self._sync_case_db()

            db = SessionLocal()
            try:
                ev_db = EvidenceDB(
                    evidence_id=ev.evidence_id,
                    case_id=self.case_id,
                    filename=ev.filename,
                    original_filename=ev.original_filename or ev.filename,
                    source_type=ev.source_type.value if hasattr(ev.source_type, "value") else str(ev.source_type),
                    mime_type=ev.mime_type,
                    file_size=ev.file_size,
                    sha256_hash=ev.sha256_hash,
                    uploaded_at=ev.uploaded_at,
                    uploaded_by=ev.uploaded_by,
                    source_system=ev.source_system,
                    acquisition_timestamp=ev.acquisition_timestamp,
                    processing_timestamp=ev.processing_timestamp,
                    parser_version=ev.parser_version,
                    ai_model_version=ev.ai_model_version,
                    record_count=ev.record_count,
                    description=ev.description,
                    processing_status=ev.processing_status.value if hasattr(ev.processing_status, "value") else str(ev.processing_status),
                    raw_content=content[:500000],  # Store original raw content immutably
                )
                db.add(ev_db)
                db.commit()
            finally:
                db.close()

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
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            db = SessionLocal()
            try:
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

                        # Update DB
                        e_db = db.query(EntityDB).filter(EntityDB.entity_id == dup_id, EntityDB.case_id == self.case_id).first()
                        if e_db:
                            e_db.aliases_json = json.dumps(existing.aliases)
                            e_db.attributes_json = json.dumps(existing.attributes)
                            e_db.source_refs_json = json.dumps(existing.source_refs)
                    else:
                        final_id = cand.id if cand.id not in self.entities else str(uuid.uuid4())
                        ent_obj = cand.model_copy(update={"id": final_id})
                        self.entities[final_id] = ent_obj
                        id_map[cand.id] = final_id

                        # Insert into DB
                        e_db = EntityDB(
                            entity_id=final_id,
                            case_id=self.case_id,
                            type=ent_obj.type.value if hasattr(ent_obj.type, "value") else str(ent_obj.type),
                            name=ent_obj.name,
                            aliases_json=json.dumps(ent_obj.aliases),
                            attributes_json=json.dumps(ent_obj.attributes),
                            source_refs_json=json.dumps(ent_obj.source_refs),
                            community_id=ent_obj.community_id,
                            evidence_id=ent_obj.evidence_id,
                            source_file=ent_obj.source_file,
                            source_record=ent_obj.source_record,
                            validation_status=ent_obj.validation_status or "Valid",
                        )
                        db.add(e_db)

                self.updated_at = now
                db.commit()
                self._sync_case_db()
            except Exception as exc:
                db.rollback()
                logger.error(f"Error during upsert_entities in case {self.case_id}: {exc}")
                raise
            finally:
                db.close()
        return id_map

    # ---- Directional vs. Symmetric Relationships ----------------------------

    def find_duplicate_relationship(self, candidate: Relationship) -> Optional[Relationship]:
        """
        Deduplicates relationships based on directionality configuration:
        - Symmetric: {A, B} == {source, target}
        - Directional: candidate.source == existing.source and candidate.target == existing.target
        """
        cand_type = candidate.relation_type.value if hasattr(candidate.relation_type, "value") else str(candidate.relation_type)
        is_symmetric = cand_type in SYMMETRIC_RELATION_TYPES
        cand_pair = {candidate.source, candidate.target}

        for existing in self.relationships.values():
            exist_type = existing.relation_type.value if hasattr(existing.relation_type, "value") else str(existing.relation_type)
            if exist_type == cand_type:
                if is_symmetric:
                    if cand_pair == {existing.source, existing.target}:
                        return existing
                else:
                    if candidate.source == existing.source and candidate.target == existing.target:
                        return existing
        return None

    def add_relationships(self, relationships: List[Relationship]) -> None:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            db = SessionLocal()
            try:
                for rel in relationships:
                    existing_rel = self.find_duplicate_relationship(rel)
                    src_node = self.entities.get(rel.source)
                    tgt_node = self.entities.get(rel.target)
                    conf_score, conf_label, conf_reasons = compute_relationship_confidence(rel, src_node, tgt_node)

                    cand_type = rel.relation_type.value if hasattr(rel.relation_type, "value") else str(rel.relation_type)
                    is_dir = cand_type not in SYMMETRIC_RELATION_TYPES

                    # Pre-calculate crime inference
                    crime_info = infer_crime_for_relationship(
                        relation_type=cand_type,
                        source_entity=src_node,
                        target_entity=tgt_node,
                        evidence=rel.evidence,
                        attributes=rel.attributes,
                        case_profile=self.investigation_type or "organized_crime",
                    )

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

                        r_db = db.query(RelationshipDB).filter(RelationshipDB.rel_id == existing_rel.id).first()
                        if r_db:
                            r_db.evidence_json = json.dumps(existing_rel.evidence)
                            r_db.weight = existing_rel.weight
                            r_db.occurrences = existing_rel.occurrences
                            r_db.confidence = existing_rel.confidence
                            r_db.confidence_label = existing_rel.confidence_label
                            r_db.confidence_reasons_json = json.dumps(existing_rel.confidence_reasons)
                            r_db.attributes_json = json.dumps(existing_rel.attributes)
                    else:
                        rel.confidence = conf_score
                        rel.confidence_label = conf_label
                        rel.confidence_reasons = conf_reasons
                        rel.suspected_crime = crime_info.get("suspected_crime")
                        rel.crime_category = crime_info.get("crime_category")
                        rel.legal_statutes = crime_info.get("legal_statutes", [])
                        rel.crime_severity = crime_info.get("crime_severity", "Moderate")
                        rel.crime_rationale = crime_info.get("crime_rationale")
                        rel.actionable_recommendations = crime_info.get("actionable_recommendations", [])
                        rel.indictment_readiness = crime_info.get("indictment_readiness", "Preliminary")
                        rel.evidentiary_sufficiency = rel.indictment_readiness

                        self.relationships[rel.id] = rel

                        r_db = RelationshipDB(
                            rel_id=rel.id,
                            case_id=self.case_id,
                            source_id=rel.source,
                            target_id=rel.target,
                            relation_type=cand_type,
                            is_directed=is_dir,
                            weight=rel.weight,
                            confidence=rel.confidence,
                            confidence_label=rel.confidence_label,
                            confidence_reasons_json=json.dumps(rel.confidence_reasons),
                            evidence_json=json.dumps(rel.evidence),
                            evidence_id=rel.evidence_id,
                            source_file=rel.source_file,
                            source_record=rel.source_record,
                            event_id=rel.event_id,
                            attributes_json=json.dumps(rel.attributes),
                            validation_status=rel.validation_status or "Valid",
                            occurrences=rel.occurrences,
                            suspected_crime=rel.suspected_crime,
                            crime_category=rel.crime_category,
                            legal_statutes_json=json.dumps(rel.legal_statutes),
                            crime_severity=rel.crime_severity,
                            crime_rationale=rel.crime_rationale,
                            actionable_recommendations_json=json.dumps(rel.actionable_recommendations),
                            evidentiary_sufficiency=rel.evidentiary_sufficiency,
                        )
                        db.add(r_db)

                self.updated_at = now
                db.commit()
                self._sync_case_db()
            finally:
                db.close()

    # ---- Safe & Traceable Entity Merging ------------------------------------

    def merge_entities(
        self,
        source_entity_id: str,
        target_entity_id: str,
        reason: str = "Investigator verified duplicate identity",
        performed_by: str = "Officer Vikram",
    ) -> EntityMergeRecordOut:
        """
        Merges duplicate Entity A into Entity B:
        - Preserves all aliases, non-empty attributes, and evidence citations
        - Re-routes relationships without creating self-loops
        - Records immutable merge history entry
        - Updates case timestamp independently (never copied from active case)
        """
        if source_entity_id == target_entity_id:
            raise ValueError("Source and target entity cannot be identical.")

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            src = self.entities.get(source_entity_id)
            tgt = self.entities.get(target_entity_id)
            if not src:
                raise KeyError(f"Source entity '{source_entity_id}' not found.")
            if not tgt:
                raise KeyError(f"Target entity '{target_entity_id}' not found.")

            # Preserve aliases & names
            existing_aliases = set(tgt.aliases)
            existing_aliases.add(src.name)
            existing_aliases.update(src.aliases)
            existing_aliases.discard(tgt.name)
            tgt.aliases = sorted(list(existing_aliases))

            # Preserve source evidence references
            tgt.source_refs = sorted(set(tgt.source_refs) | set(src.source_refs))

            # Merge attributes
            for k, v in src.attributes.items():
                if v and k not in tgt.attributes:
                    tgt.attributes[k] = v
                elif v and k in tgt.attributes and str(v) not in str(tgt.attributes[k]):
                    tgt.attributes[k] = f"{tgt.attributes[k]}, {v}"

            # Re-route relationships
            updated_rels: Dict[str, Relationship] = {}
            for r_id, r in list(self.relationships.items()):
                new_src = tgt.id if r.source == src.id else r.source
                new_tgt = tgt.id if r.target == src.id else r.target

                if new_src == new_tgt:
                    # Drop self-loops created by merge
                    continue

                r.source = new_src
                r.target = new_tgt
                updated_rels[r_id] = r

            self.relationships = updated_rels

            # Create merge history record
            merge_id = f"MRG-{uuid.uuid4().hex[:8].upper()}"
            snapshot = {
                "source_entity": src.model_dump(),
                "target_entity_before": tgt.model_dump(),
            }

            merge_rec = EntityMergeRecordOut(
                merge_id=merge_id,
                case_id=self.case_id,
                source_entity_id=src.id,
                source_entity_name=src.name,
                target_entity_id=tgt.id,
                target_entity_name=tgt.name,
                performed_by=performed_by,
                timestamp=now,
                reason=reason,
            )
            self.merges.append(merge_rec)

            # Remove merged entity from active entities
            del self.entities[src.id]
            self.updated_at = now
            self._sync_case_db()

            # Sync to DB
            db = SessionLocal()
            try:
                # Add merge audit record
                m_db = EntityMergeDB(
                    merge_id=merge_id,
                    case_id=self.case_id,
                    source_entity_id=src.id,
                    source_entity_name=src.name,
                    target_entity_id=tgt.id,
                    target_entity_name=tgt.name,
                    performed_by=performed_by,
                    timestamp=now,
                    reason=reason,
                    snapshot_json=json.dumps(snapshot),
                )
                db.add(m_db)

                # Delete merged entity from DB
                db.query(EntityDB).filter(EntityDB.entity_id == src.id, EntityDB.case_id == self.case_id).delete()

                # Update target entity in DB
                tgt_db = db.query(EntityDB).filter(EntityDB.entity_id == tgt.id, EntityDB.case_id == self.case_id).first()
                if tgt_db:
                    tgt_db.aliases_json = json.dumps(tgt.aliases)
                    tgt_db.attributes_json = json.dumps(tgt.attributes)
                    tgt_db.source_refs_json = json.dumps(tgt.source_refs)

                # Update relationships in DB
                db.query(RelationshipDB).filter(RelationshipDB.case_id == self.case_id).delete()
                for rel in self.relationships.values():
                    r_db = RelationshipDB(
                        rel_id=rel.id,
                        case_id=self.case_id,
                        source_id=rel.source,
                        target_id=rel.target,
                        relation_type=rel.relation_type.value if hasattr(rel.relation_type, "value") else str(rel.relation_type),
                        is_directed=True,
                        weight=rel.weight,
                        confidence=rel.confidence,
                        confidence_label=rel.confidence_label,
                        confidence_reasons_json=json.dumps(rel.confidence_reasons),
                        evidence_json=json.dumps(rel.evidence),
                        evidence_id=rel.evidence_id,
                        source_file=rel.source_file,
                        source_record=rel.source_record,
                        event_id=rel.event_id,
                        attributes_json=json.dumps(rel.attributes),
                        validation_status=rel.validation_status or "Valid",
                        occurrences=rel.occurrences,
                    )
                    db.add(r_db)

                db.commit()
            except Exception as exc:
                db.rollback()
                logger.error(f"Error during merge_entities ({source_entity_id} -> {target_entity_id}): {exc}")
                raise
            finally:
                db.close()

            return merge_rec

    # ---- Disciplined Validation Review Workflow -----------------------------

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
            db = SessionLocal()
            try:
                v_db = ValidationRecordDB(
                    record_id=record_id,
                    case_id=self.case_id,
                    item_type=item_type,
                    name_or_pair=name_or_pair,
                    status=status.value if hasattr(status, "value") else str(status),
                    confidence=confidence,
                    reason=reason,
                    source_evidence=source_evidence,
                    created_at=now,
                    payload_json=json.dumps(payload),
                )
                db.add(v_db)
                db.commit()
            finally:
                db.close()
        return rec

    def review_validation(
        self,
        record_id: str,
        action: str,
        corrected_payload: Optional[Dict[str, Any]] = None,
        reviewer: str = "Officer Vikram",
        reviewer_notes: str = "",
    ) -> Optional[ValidationRecord]:
        """
        Disciplined review workflow:
        Review -> Normalize -> Validate Endpoints -> Check Duplicate -> Compute Confidence -> Commit -> DB
        """
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._lock:
            rec = self.validation_records.get(record_id)
            if not rec:
                return None

            payload = corrected_payload or rec.payload
            act = action.strip().lower()

            if act in ("accept", "correct"):
                rec.status = ValidationStatus.VALID
                rec.payload = payload

                if rec.item_type == "entity":
                    ent = Entity(**payload)
                    self.upsert_entities([ent])
                elif rec.item_type == "relationship":
                    # Validate endpoints exist
                    src_id = payload.get("source")
                    tgt_id = payload.get("target")
                    if src_id in self.entities and tgt_id in self.entities:
                        rel = Relationship(**payload)
                        self.add_relationships([rel])

            elif act == "reject":
                rec.status = ValidationStatus.REJECTED

            self.updated_at = now
            self._sync_case_db()

            # Update DB
            db = SessionLocal()
            try:
                v_db = db.query(ValidationRecordDB).filter(ValidationRecordDB.record_id == record_id).first()
                if v_db:
                    v_db.status = rec.status.value if hasattr(rec.status, "value") else str(rec.status)
                    v_db.payload_json = json.dumps(rec.payload)
                    v_db.reviewed_by = reviewer
                    v_db.reviewed_at = now
                    v_db.reviewer_notes = reviewer_notes
                    db.commit()
            finally:
                db.close()

            return rec

    # ---- Field Notes --------------------------------------------------------

    def create_note(
        self,
        note_text: str,
        entity_id: Optional[str] = None,
        relationship_id: Optional[str] = None,
        evidence_id: Optional[str] = None,
        author: str = "Officer Vikram",
        role: str = "Investigator",
        created_by: Optional[str] = None,
    ) -> Note:
        note_id = f"NOTE-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        effective_author = created_by or author or "Officer Vikram"
        note = Note(
            note_id=note_id,
            case_id=self.case_id,
            entity_id=entity_id,
            relationship_id=relationship_id,
            evidence_id=evidence_id,
            note_text=note_text,
            created_by=effective_author,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self.notes[note_id] = note
            self.updated_at = now
            self._sync_case_db()

            db = SessionLocal()
            try:
                n_db = NoteDB(
                    note_id=note_id,
                    case_id=self.case_id,
                    entity_id=entity_id,
                    relationship_id=relationship_id,
                    evidence_id=evidence_id,
                    author=effective_author,
                    role=role,
                    note_text=note_text,
                    timestamp=now,
                )
                db.add(n_db)
                db.commit()
            finally:
                db.close()
        return note

    def delete_note(self, note_id: str) -> bool:
        with self._lock:
            if note_id in self.notes:
                del self.notes[note_id]
                self.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self._sync_case_db()

                db = SessionLocal()
                try:
                    db.query(NoteDB).filter(NoteDB.note_id == note_id).delete()
                    db.commit()
                finally:
                    db.close()
                return True
            return False

    # ---- Deterministic Graph Construction -----------------------------------

    def build_graph(self) -> nx.MultiDiGraph:
        """Reconstructs NetworkX MultiDiGraph dynamically from persisted entities and relationships."""
        graph = nx.MultiDiGraph()
        for entity in self.entities.values():
            graph.add_node(
                entity.id,
                type=entity.type.value if hasattr(entity.type, "value") else str(entity.type),
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
                    relation_type=rel.relation_type.value if hasattr(rel.relation_type, "value") else str(rel.relation_type),
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
                src_ent = self.entities[r.source]
                tgt_ent = self.entities[r.target]
                crime_info = infer_crime_for_relationship(
                    relation_type=r.relation_type,
                    source_entity=src_ent,
                    target_entity=tgt_ent,
                    evidence=r.evidence,
                    attributes=r.attributes,
                    case_profile=self.investigation_type or "organized_crime",
                )
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
                        suspected_crime=crime_info.get("suspected_crime"),
                        crime_category=crime_info.get("crime_category"),
                        legal_statutes=crime_info.get("legal_statutes", []),
                        crime_severity=crime_info.get("crime_severity", "Moderate"),
                        crime_rationale=crime_info.get("crime_rationale"),
                        actionable_recommendations=crime_info.get("actionable_recommendations", []),
                        indictment_readiness=crime_info.get("indictment_readiness", "Preliminary"),
                        evidentiary_sufficiency=crime_info.get("indictment_readiness", "Preliminary"),
                    )
                )

        return GraphResponse(directed=True, multigraph=True, nodes=nodes, links=links)


class CaseManager:
    """Singleton repository manager for multi-case digital investigations backed by SQLite."""

    def __init__(self) -> None:
        self.cases: Dict[str, CaseStore] = {}
        # The frontend and health endpoint expect a stable default case.
        # Do not assume that case-001 already exists in the database.
        self.active_case_id: str = "case-001"
        self._lock = Lock()
        self._initialize_from_database()

        # A fresh Render deployment can start with an empty database.
        # Always make sure the stable default case exists before the API
        # starts serving requests.
        if not self.cases:
            self._ensure_default_case()
        elif self.active_case_id not in self.cases:
            self.active_case_id = next(iter(self.cases))

    def _initialize_from_database(self) -> None:
        """Initializes database schema and re-hydrates cases from SQLite storage."""
        init_db_and_seed()
        db = SessionLocal()
        try:
            cases_db = db.query(CaseDB).all()
            for c_rec in cases_db:
                try:
                    c_status = CaseStatus(c_rec.status)
                except Exception:
                    c_status = CaseStatus.OPEN

                store = CaseStore(
                    case_id=c_rec.case_id,
                    case_name=c_rec.case_name,
                    description=c_rec.description or "",
                    investigation_type=c_rec.investigation_type or "organized_crime",
                    status=c_status,
                    priority=c_rec.priority or "High",
                    is_protected=bool(c_rec.is_protected),
                    created_by=c_rec.created_by or "Officer Vikram",
                    created_at=c_rec.created_at,
                    updated_at=c_rec.updated_at,
                )

                # Rehydrate entities
                entities_db = db.query(EntityDB).filter(EntityDB.case_id == c_rec.case_id).all()
                for e in entities_db:
                    try:
                        e_type = EntityType(e.type)
                    except Exception:
                        e_type = EntityType.PERSON
                    ent = Entity(
                        id=e.entity_id,
                        type=e_type,
                        name=e.name,
                        aliases=json.loads(e.aliases_json or "[]"),
                        attributes=json.loads(e.attributes_json or "{}"),
                        source_refs=json.loads(e.source_refs_json or "[]"),
                        community_id=e.community_id,
                        evidence_id=e.evidence_id,
                        source_file=e.source_file,
                        source_record=e.source_record,
                        validation_status=e.validation_status,
                        is_merged=bool(e.is_merged),
                        merged_into_id=e.merged_into_id,
                    )
                    store.entities[ent.id] = ent

                # Rehydrate relationships
                rels_db = db.query(RelationshipDB).filter(RelationshipDB.case_id == c_rec.case_id).all()
                for r in rels_db:
                    try:
                        r_type = RelationType(r.relation_type)
                    except Exception:
                        r_type = RelationType.ASSOCIATED_WITH
                    rel = Relationship(
                        id=r.rel_id,
                        source=r.source_id,
                        target=r.target_id,
                        relation_type=r_type,
                        weight=r.weight,
                        evidence=json.loads(r.evidence_json or "[]"),
                        event_id=r.event_id,
                        attributes=json.loads(r.attributes_json or "{}"),
                        confidence=r.confidence,
                        confidence_label=r.confidence_label,
                        confidence_reasons=json.loads(r.confidence_reasons_json or "[]"),
                        evidence_id=r.evidence_id,
                        source_file=r.source_file,
                        source_record=r.source_record,
                        validation_status=r.validation_status or "Valid",
                        occurrences=r.occurrences,
                        suspected_crime=r.suspected_crime,
                        crime_category=r.crime_category,
                        legal_statutes=json.loads(r.legal_statutes_json or "[]"),
                        crime_severity=r.crime_severity or "Moderate",
                        crime_rationale=r.crime_rationale,
                        actionable_recommendations=json.loads(r.actionable_recommendations_json or "[]"),
                        indictment_readiness=r.evidentiary_sufficiency or "Preliminary",
                        evidentiary_sufficiency=r.evidentiary_sufficiency or "Preliminary",
                    )
                    store.relationships[rel.id] = rel

                # Rehydrate evidence
                ev_db = db.query(EvidenceDB).filter(EvidenceDB.case_id == c_rec.case_id).all()
                for ev_rec in ev_db:
                    try:
                        stype = EvidenceSourceType(ev_rec.source_type)
                    except Exception:
                        stype = EvidenceSourceType.OTHER
                    ev = Evidence(
                        evidence_id=ev_rec.evidence_id,
                        case_id=ev_rec.case_id,
                        filename=ev_rec.filename,
                        original_filename=ev_rec.original_filename or ev_rec.filename,
                        source_type=stype,
                        mime_type=ev_rec.mime_type or "text/plain",
                        file_size=ev_rec.file_size or 0,
                        uploaded_at=ev_rec.uploaded_at,
                        uploaded_by=ev_rec.uploaded_by,
                        source_system=ev_rec.source_system or "NetTrace Core Ingestion",
                        acquisition_timestamp=ev_rec.acquisition_timestamp,
                        processing_timestamp=ev_rec.processing_timestamp,
                        parser_version=ev_rec.parser_version or "v2.2-deterministic",
                        ai_model_version=ev_rec.ai_model_version,
                        record_count=ev_rec.record_count or 0,
                        processing_status=EvidenceStatus.COMPLETED,
                        sha256_hash=ev_rec.sha256_hash,
                        description=ev_rec.description or "",
                        original_source_ref=ev_rec.filename,
                    )
                    store.evidence[ev.evidence_id] = ev

                # Rehydrate validation records
                vals_db = db.query(ValidationRecordDB).filter(ValidationRecordDB.case_id == c_rec.case_id).all()
                for v_rec in vals_db:
                    try:
                        v_stat = ValidationStatus(v_rec.status)
                    except Exception:
                        v_stat = ValidationStatus.NEEDS_REVIEW
                    val = ValidationRecord(
                        record_id=v_rec.record_id,
                        case_id=v_rec.case_id,
                        item_type=v_rec.item_type,
                        name_or_pair=v_rec.name_or_pair,
                        status=v_stat,
                        confidence=v_rec.confidence,
                        reason=v_rec.reason or "",
                        source_evidence=v_rec.source_evidence or "",
                        created_at=v_rec.created_at,
                        payload=json.loads(v_rec.payload_json or "{}"),
                    )
                    store.validation_records[val.record_id] = val

                # Rehydrate field notes
                notes_db = db.query(NoteDB).filter(NoteDB.case_id == c_rec.case_id).all()
                for n_rec in notes_db:
                    note = Note(
                        note_id=n_rec.note_id,
                        case_id=n_rec.case_id,
                        entity_id=n_rec.entity_id,
                        relationship_id=n_rec.relationship_id,
                        evidence_id=n_rec.evidence_id,
                        note_text=n_rec.note_text,
                        created_by=n_rec.author,
                        created_at=n_rec.timestamp,
                        updated_at=n_rec.timestamp,
                    )
                    store.notes[note.note_id] = note

                # Rehydrate merges
                merges_db = db.query(EntityMergeDB).filter(EntityMergeDB.case_id == c_rec.case_id).all()
                for m_rec in merges_db:
                    store.merges.append(
                        EntityMergeRecordOut(
                            merge_id=m_rec.merge_id,
                            case_id=m_rec.case_id,
                            source_entity_id=m_rec.source_entity_id,
                            source_entity_name=m_rec.source_entity_name,
                            target_entity_id=m_rec.target_entity_id,
                            target_entity_name=m_rec.target_entity_name,
                            performed_by=m_rec.performed_by,
                            timestamp=m_rec.timestamp,
                            reason=m_rec.reason,
                        )
                    )

                self.cases[store.case_id] = store

            # Seed default case data if case-001 has no entities
            if "case-001" in self.cases and len(self.cases["case-001"].entities) == 0:
                self._seed_case_one(self.cases["case-001"])

        finally:
            db.close()

    def _seed_case_one(self, case1: CaseStore) -> None:
        """Seeds initial data for Operation Falcon Shadow."""
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

            case1.register_evidence(
                "seed_entities.csv",
                EvidenceSourceType.CSV,
                SAMPLE_ENTITIES_CSV,
                record_count=len(entities),
                description="Initial intelligence database export",
            )
            case1.register_evidence(
                "seed_relationships.csv",
                EvidenceSourceType.CSV,
                SAMPLE_RELATIONSHIPS_CSV,
                record_count=len(rels),
                description="Initial telecom intercept ledger",
            )
        except Exception:
            pass

    def _ensure_default_case(self) -> CaseStore:
        """
        Ensure that the stable system case ``case-001`` exists.

        Render/production environments can have an empty or newly created
        database. Older code only set ``active_case_id`` to ``case-001`` and
        then indexed ``self.cases`` with that ID, which caused:

            KeyError: 'case-001'

        This method creates the case in memory and persists its metadata.
        It intentionally does not fail startup if sample-data seeding fails;
        the empty case is still a valid case and the API can start normally.
        """
        existing = self.cases.get("case-001")
        if existing is not None:
            return existing

        case1 = CaseStore(
            case_id="case-001",
            case_name="Operation Falcon Shadow",
            description="Default protected investigation case.",
            investigation_type="organized_crime",
            status=CaseStatus.OPEN,
            priority="High",
            is_protected=True,
            created_by="System",
        )

        self.cases[case1.case_id] = case1
        self.active_case_id = case1.case_id

        try:
            case1._sync_case_db()
        except Exception as exc:
            logger.exception("Unable to persist default case-001: %s", exc)

        # Seed demo/sample data when it is available. Any failure here must
        # not prevent the API from starting.
        try:
            if not case1.entities:
                self._seed_case_one(case1)
        except Exception as exc:
            logger.warning("Default case seeding skipped: %s", exc)

        return case1

    def get_active_case(self) -> CaseStore:
        with self._lock:
            # Normal path.
            active = self.cases.get(self.active_case_id)
            if active is not None:
                return active

            # The active ID can become stale after a fresh deploy, database
            # reset, or case deletion. Prefer an existing case if one exists.
            if self.cases:
                self.active_case_id = next(iter(self.cases))
                return self.cases[self.active_case_id]

            # Database may have been empty on a fresh Render instance. Create
            # the stable default case instead of raising KeyError.
            return self._ensure_default_case()

    def get_case(self, case_id: str) -> Optional[CaseStore]:
        with self._lock:
            return self.cases.get(case_id)

    def switch_case(self, case_id: str) -> CaseStore:
        with self._lock:
            if case_id not in self.cases:
                raise KeyError(f"Case with ID {case_id} not found")
            self.active_case_id = case_id
            return self.cases[case_id]

    def create_case(
        self,
        case_name: str,
        description: str = "",
        investigation_type: str = "organized_crime",
        priority: str = "High",
        created_by: str = "Officer Vikram",
    ) -> CaseStore:
        with self._lock:
            case_id = f"case-{uuid.uuid4().hex[:6]}"
            new_store = CaseStore(
                case_id=case_id,
                case_name=case_name,
                description=description,
                investigation_type=investigation_type,
                priority=priority,
                is_protected=False,
                created_by=created_by,
            )
            self.cases[case_id] = new_store
            self.active_case_id = case_id
            new_store._sync_case_db()
            return new_store

    def update_case(
        self,
        case_id: str,
        case_name: Optional[str] = None,
        description: Optional[str] = None,
        investigation_type: Optional[str] = None,
        status: Optional[CaseStatus] = None,
        priority: Optional[str] = None,
    ) -> Optional[CaseStore]:
        with self._lock:
            c = self.cases.get(case_id)
            if not c:
                return None
            if case_name is not None:
                c.case_name = case_name
            if description is not None:
                c.description = description
            if investigation_type is not None:
                c.investigation_type = investigation_type
            if status is not None:
                c.status = status
            if priority is not None:
                c.priority = priority
            c.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            c._sync_case_db()
            return c

    def delete_case(self, case_id: str) -> Tuple[bool, str]:
        """
        Deletes a non-protected case and its associated records.
        Returns (success: bool, message: str).
        """
        with self._lock:
            c = self.cases.get(case_id)
            if not c:
                return False, f"Case '{case_id}' does not exist."

            if c.is_protected:
                return False, f"Cannot delete protected system case '{c.case_name}'. Protected cases are preserved for system integrity."

            # Delete from DB with transaction rollback safety
            db = SessionLocal()
            try:
                db.query(RelationshipDB).filter(RelationshipDB.case_id == case_id).delete()
                db.query(EntityDB).filter(EntityDB.case_id == case_id).delete()
                db.query(EvidenceDB).filter(EvidenceDB.case_id == case_id).delete()
                db.query(ValidationRecordDB).filter(ValidationRecordDB.case_id == case_id).delete()
                db.query(NoteDB).filter(NoteDB.case_id == case_id).delete()
                db.query(InvestigationLeadDB).filter(InvestigationLeadDB.case_id == case_id).delete()
                db.query(PatternFindingDB).filter(PatternFindingDB.case_id == case_id).delete()
                db.query(CaseUserDB).filter(CaseUserDB.case_id == case_id).delete()
                db.query(EntityMergeDB).filter(EntityMergeDB.case_id == case_id).delete()
                db.query(CaseDB).filter(CaseDB.case_id == case_id).delete()
                db.commit()
            except Exception as exc:
                db.rollback()
                logger.error(f"Error during case deletion {case_id}: {exc}")
                return False, f"Database error during deletion: {str(exc)}"
            finally:
                db.close()

            del self.cases[case_id]
            if self.active_case_id == case_id:
                if self.cases:
                    self.active_case_id = next(iter(self.cases))
                else:
                    # Never leave active_case_id pointing to a non-existent
                    # case. Recreate the protected system case if the last
                    # user-created case was deleted.
                    self._ensure_default_case()
            return True, f"Case '{case_id}' successfully deleted."

    def list_cases(self) -> List[Case]:
        with self._lock:
            return [c.get_summary_model() for c in self.cases.values()]


case_manager = CaseManager()
