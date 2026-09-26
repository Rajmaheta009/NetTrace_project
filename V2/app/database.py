"""
Module: Persistent Database Architecture & SQLAlchemy Relational Schema
NetTrace Enterprise Persistence Layer (PostgreSQL Primary / SQLite Compatible)

PostgreSQL is the source of truth for all entities, relationships, evidence,
users, roles, permissions, case assignments, validation records, and audit logs.
NetworkX MultiDiGraph structures are reconstructed dynamically from persisted state.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

logger = logging.getLogger("nettrace.database")

# -------------------------------------------------------------
# Database Engine & Connection Pooling
# -------------------------------------------------------------

# PostgreSQL is the PRIMARY database. Fallback to SQLite if specified.
DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_FALLBACK = f"sqlite:///{(DB_DIR / 'nettrace.db').as_posix()}"

DEFAULT_PG_URL = "postgresql+psycopg2://postgres:postgres@localhost:5432/nettrace"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_PG_URL)

is_sqlite = DATABASE_URL.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args={"connect_timeout": 5},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Dependency for database sessions with automatic closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_health() -> Dict[str, Any]:
    """
    Checks database connection health, latency, pool status, and dialect.
    Returns structured health metadata without exposing internal credentials.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        pool = engine.pool
        pool_status = {
            "size": pool.size() if hasattr(pool, "size") else 1,
            "checkedin": pool.checkedin() if hasattr(pool, "checkedin") else 1,
            "checkedout": pool.checkedout() if hasattr(pool, "checkedout") else 0,
            "overflow": pool.overflow() if hasattr(pool, "overflow") else 0,
        }
        return {
            "status": "healthy",
            "database": "connected",
            "dialect": engine.dialect.name,
            "pool": pool_status,
        }
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "dialect": engine.dialect.name,
            "error": "Database connection unavailable or timeout",
        }


# -------------------------------------------------------------
# 1. Users, Roles & Permissions
# -------------------------------------------------------------

class RolePermissionDB(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


class UserRoleDB(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )


class PermissionDB(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    description = Column(String(256), default="")
    category = Column(String(64), default="General", index=True)


class RoleDB(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, index=True, nullable=False)
    description = Column(String(256), default="")
    is_system_role = Column(Boolean, default=False)

    permissions = relationship("PermissionDB", secondary="role_permissions", backref="roles")


class UserDB(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    username = Column(String(128), unique=True, index=True, nullable=False)
    email = Column(String(256), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    full_name = Column(String(256), nullable=False)
    department = Column(String(128), default="Forensic Intelligence")
    designation = Column(String(128), default="Investigator")
    status = Column(String(32), default="ACTIVE", index=True)  # ACTIVE, INACTIVE, SUSPENDED
    created_at = Column(String(64), nullable=False, index=True)
    updated_at = Column(String(64), nullable=False)
    last_login = Column(String(64), nullable=True)

    # Backward compatibility aliases
    role = Column(String(64), default="INVESTIGATOR", nullable=False)
    api_token = Column(String(128), unique=True, index=True, nullable=True)

    roles = relationship("RoleDB", secondary="user_roles", backref="users")

    @property
    def user_id(self) -> str:
        return self.id


class RefreshTokenDB(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    expires_at = Column(String(64), nullable=False, index=True)
    revoked = Column(Boolean, default=False, index=True)
    created_at = Column(String(64), nullable=False)


# -------------------------------------------------------------
# 2. Cases & Case-Level Access
# -------------------------------------------------------------

class CaseDB(Base):
    __tablename__ = "cases"

    case_id = Column(String(64), primary_key=True, index=True)
    case_name = Column(String(256), nullable=False)
    description = Column(Text, default="")
    investigation_type = Column(String(128), default="organized_crime")
    status = Column(String(64), default="OPEN", index=True)  # DRAFT, OPEN, UNDER_REVIEW, SUSPENDED, CLOSED, ARCHIVED
    priority = Column(String(64), default="High")
    is_protected = Column(Boolean, default=False)
    created_at = Column(String(64), nullable=False, index=True)
    updated_at = Column(String(64), nullable=False)
    created_by = Column(String(128), default="Officer Vikram")


class CaseUserDB(Base):
    __tablename__ = "case_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    case_role = Column(String(64), default="INVESTIGATOR", nullable=False)  # CASE_OWNER, INVESTIGATOR, ANALYST, REVIEWER, OBSERVER
    assigned_by = Column(String(128), default="System Admin")
    assigned_at = Column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("case_id", "user_id", name="uq_case_user"),
    )


# -------------------------------------------------------------
# 3. Entities, Aliases & Relationships
# -------------------------------------------------------------

class EntityDB(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    type = Column(String(64), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    normalized_name = Column(String(256), index=True, nullable=True)
    phone = Column(String(64), index=True, nullable=True)
    email = Column(String(256), index=True, nullable=True)
    vehicle_plate = Column(String(64), index=True, nullable=True)
    aliases_json = Column(Text, default="[]")
    attributes_json = Column(Text, default="{}")
    source_refs_json = Column(Text, default="[]")
    community_id = Column(String(64), nullable=True)
    evidence_id = Column(String(64), nullable=True, index=True)
    source_file = Column(String(256), nullable=True)
    source_record = Column(String(128), nullable=True)
    validation_status = Column(String(64), default="Valid")
    is_merged = Column(Boolean, default=False)
    merged_into_id = Column(String(64), nullable=True)
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(64), nullable=False, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    __table_args__ = (
        UniqueConstraint("case_id", "entity_id", name="uq_case_entity"),
        Index("ix_entity_case_entity_id", "case_id", "entity_id"),
        Index("ix_entity_case_type", "case_id", "type"),
    )


class EntityAliasDB(Base):
    __tablename__ = "entity_aliases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    alias = Column(String(256), nullable=False)
    normalized_alias = Column(String(256), index=True, nullable=False)
    created_at = Column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("case_id", "entity_id", "normalized_alias", name="uq_case_entity_alias"),
    )


class RelationshipDB(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rel_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    source_id = Column(String(64), index=True, nullable=False)
    target_id = Column(String(64), index=True, nullable=False)
    relation_type = Column(String(128), index=True, nullable=False)
    is_directed = Column(Boolean, default=True)
    weight = Column(Integer, default=1)
    confidence = Column(Float, default=0.5)
    confidence_label = Column(String(64), default="Moderate")
    confidence_reasons_json = Column(Text, default="[]")
    evidence_json = Column(Text, default="[]")
    evidence_id = Column(String(64), index=True, nullable=True)
    source_file = Column(String(256), nullable=True)
    source_record = Column(String(128), nullable=True)
    event_id = Column(String(128), nullable=True)
    attributes_json = Column(Text, default="{}")
    validation_status = Column(String(64), default="Valid")
    occurrences = Column(Integer, default=1)
    suspected_crime = Column(String(256), nullable=True)
    crime_category = Column(String(128), nullable=True)
    legal_statutes_json = Column(Text, default="[]")
    crime_severity = Column(String(64), default="Moderate")
    crime_rationale = Column(Text, nullable=True)
    actionable_recommendations_json = Column(Text, default="[]")
    evidentiary_sufficiency = Column(String(64), default="Preliminary")
    created_at = Column(String(64), nullable=False, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at = Column(String(64), nullable=False, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    __table_args__ = (
        UniqueConstraint("case_id", "rel_id", name="uq_case_rel"),
        Index("ix_rel_case_source", "case_id", "source_id"),
        Index("ix_rel_case_target", "case_id", "target_id"),
        Index("ix_rel_case_endpoints", "case_id", "source_id", "target_id"),
    )


# -------------------------------------------------------------
# 4. Evidence & Evidence Records
# -------------------------------------------------------------

class EvidenceDB(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    evidence_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    filename = Column(String(256), nullable=False)
    original_filename = Column(String(256), nullable=False)
    source_type = Column(String(64), default="Other")
    mime_type = Column(String(128), default="text/plain")
    file_size = Column(Integer, default=0)
    sha256_hash = Column(String(128), index=True, nullable=False)
    uploaded_at = Column(String(64), nullable=False, index=True)
    uploaded_by = Column(String(128), default="Officer Vikram")
    source_system = Column(String(128), default="NetTrace Core Ingestion")
    acquisition_timestamp = Column(String(64), nullable=True)
    processing_timestamp = Column(String(64), nullable=True)
    parser_version = Column(String(64), default="v2.2-deterministic")
    ai_model_version = Column(String(64), nullable=True)
    record_count = Column(Integer, default=0)
    description = Column(Text, default="")
    processing_status = Column(String(64), default="Completed")
    raw_content = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("case_id", "evidence_id", name="uq_case_evidence"),
    )


class EvidenceRecordDB(Base):
    __tablename__ = "evidence_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    evidence_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    record_index = Column(Integer, default=0)
    raw_text = Column(Text, default="")
    parsed_json = Column(Text, default="{}")
    created_at = Column(String(64), nullable=False)


# -------------------------------------------------------------
# 5. Validation, Investigation Leads, Notes, Merges, Findings
# -------------------------------------------------------------

class ValidationRecordDB(Base):
    __tablename__ = "validation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    item_type = Column(String(64), nullable=False)
    name_or_pair = Column(String(256), nullable=False)
    status = Column(String(64), default="Needs Review")
    confidence = Column(Float, default=0.5)
    reason = Column(Text, default="")
    source_evidence = Column(Text, default="")
    created_at = Column(String(64), nullable=False, index=True)
    payload_json = Column(Text, default="{}")
    reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(String(64), nullable=True)
    reviewer_notes = Column(Text, default="")

    __table_args__ = (
        UniqueConstraint("case_id", "record_id", name="uq_case_valrec"),
    )


class InvestigationLeadDB(Base):
    __tablename__ = "investigation_leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    entity_id = Column(String(64), index=True, nullable=False)
    title = Column(String(256), nullable=False)
    score = Column(Float, default=0.0)
    score_category = Column(String(64), default="Priority")
    why_flagged_json = Column(Text, default="[]")
    metrics_json = Column(Text, default="{}")
    status = Column(String(32), default="ACTIVE")
    created_at = Column(String(64), nullable=False, index=True)
    updated_at = Column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("case_id", "lead_id", name="uq_case_lead"),
    )


class NoteDB(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    entity_id = Column(String(64), nullable=True, index=True)
    relationship_id = Column(String(64), nullable=True, index=True)
    evidence_id = Column(String(64), nullable=True, index=True)
    author = Column(String(128), nullable=False)
    role = Column(String(64), default="Investigator")
    note_text = Column(Text, nullable=False)
    timestamp = Column(String(64), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("case_id", "note_id", name="uq_case_note"),
    )


class EntityMergeDB(Base):
    __tablename__ = "entity_merges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    merge_id = Column(String(64), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    source_entity_id = Column(String(64), nullable=False)
    source_entity_name = Column(String(256), nullable=False)
    target_entity_id = Column(String(64), nullable=False)
    target_entity_name = Column(String(256), nullable=False)
    performed_by = Column(String(128), nullable=False)
    timestamp = Column(String(64), nullable=False, index=True)
    reason = Column(Text, default="")
    snapshot_json = Column(Text, default="{}")

    __table_args__ = (
        UniqueConstraint("case_id", "merge_id", name="uq_case_merge"),
    )


class PatternFindingDB(Base):
    __tablename__ = "pattern_findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    finding_id = Column(String(128), index=True, nullable=False)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), index=True, nullable=False)
    pattern_type = Column(String(128), nullable=False)
    severity = Column(String(32), default="medium")
    entities_involved_json = Column(Text, default="[]")
    evidence = Column(Text, default="")
    why = Column(Text, default="")
    review_status = Column(String(32), default="NEW")  # NEW, UNDER_REVIEW, CONFIRMED, DISMISSED, CORRECTED
    review_reason = Column(Text, nullable=True)
    reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("case_id", "finding_id", name="uq_case_pattern"),
    )


# -------------------------------------------------------------
# 6. Cryptographic Audit Logging & Integrity
# -------------------------------------------------------------

class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    audit_id = Column(String(64), unique=True, index=True)
    timestamp = Column(String(64), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    username = Column(String(128), nullable=False)
    role = Column(String(64), nullable=False)
    case_id = Column(String(64), nullable=True, index=True)
    action = Column(String(128), nullable=False, index=True)
    resource_type = Column(String(64), default="system")
    resource_id = Column(String(128), nullable=True)
    result = Column(String(32), default="SUCCESS")
    details = Column(Text, default="")
    metadata_json = Column(Text, default="{}")
    previous_hash = Column(String(128), default="0" * 64)
    current_hash = Column(String(128), nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(256), nullable=True)

    __table_args__ = (
        Index("ix_audit_user_timestamp", "user_id", "timestamp"),
        Index("ix_audit_case_timestamp", "case_id", "timestamp"),
        Index("ix_audit_action_status", "action", "result"),
    )


class AuditIntegrityDB(Base):
    __tablename__ = "audit_integrity"

    id = Column(Integer, primary_key=True, autoincrement=True)
    last_verified_at = Column(String(64), nullable=False)
    verified_by = Column(String(128), nullable=False)
    total_records = Column(Integer, default=0)
    is_valid = Column(Boolean, default=True)
    broken_record_id = Column(String(64), nullable=True)
    verification_notes = Column(Text, default="")


# -------------------------------------------------------------
# Initial DB Schema Creation Helper
# -------------------------------------------------------------

def init_db_and_seed():
    """Initializes tables using SQLAlchemy metadata and ensures column compatibility."""
    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64);"))
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(256);"))
    except Exception as exc:
        logger.debug(f"Schema compatibility notice: {exc}")
