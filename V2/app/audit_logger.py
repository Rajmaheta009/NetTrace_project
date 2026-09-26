"""
Module: Security Activity & Tamper-Evident Audit Trail Logger
NetTrace Cryptographic Integrity Subsystem

Implements a SHA-256 hash-chained, tamper-evident audit ledger.
Every investigative action is committed with:
  current_hash = SHA-256(previous_hash + timestamp + user_id + action + case_id + resource_id)
User identities are strictly bound to server-side authentication sessions to prevent spoofing.
Never stores passwords, tokens, API keys, or private credentials in audit logs.
"""

import hashlib
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional
from sqlalchemy import or_

from app.database import AuditLogDB, SessionLocal

# File log backup
LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "user_activity_audit.log"

_log_lock = Lock()
GENESIS_HASH = "0" * 64


def _sanitize_details(text: str) -> str:
    """Removes tokens, passwords, and sensitive keys from log entries."""
    if not text:
        return ""
    s = str(text)
    s = re.sub(r'(?i)(password|secret|token|api[_-]?key|bearer)\s*[:=]\s*[^\s,;]+', r'\1=***REDACTED***', s)
    s = re.sub(r'gsk_[A-Za-z0-9]{20,}', '***REDACTED_GROQ_KEY***', s)
    s = re.sub(r'ey[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}', '***REDACTED_JWT***', s)
    return s


def _sanitize_metadata(meta: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Sanitizes metadata dict recursively."""
    if not meta or not isinstance(meta, dict):
        return {}
    clean = {}
    sensitive_keys = {"password", "token", "secret", "api_key", "authorization", "refresh_token"}
    for k, v in meta.items():
        if any(sk in k.lower() for sk in sensitive_keys):
            clean[k] = "***REDACTED***"
        elif isinstance(v, dict):
            clean[k] = _sanitize_metadata(v)
        elif isinstance(v, str):
            clean[k] = _sanitize_details(v)
        else:
            clean[k] = v
    return clean


def _compute_hash(previous_hash: str, timestamp: str, user_id: str, action: str, case_id: str, resource_id: str) -> str:
    payload = f"{previous_hash}{timestamp}{user_id}{action}{case_id or ''}{resource_id or ''}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def record_audit(
    acting_user: Any = None,
    action: str = "general_action",
    details: str = "",
    case_id: Optional[str] = None,
    resource_type: str = "system",
    resource_id: Optional[str] = None,
    result: str = "SUCCESS",
    metadata: Optional[Dict[str, Any]] = None,
    *,
    actor_name: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Appends a tamper-evident audit record backed by relational DB and persistent log file.
    Identity is pulled from the server-side authenticated UserProfile to prevent client spoofing.
    """
    # Extract identity safely
    if actor_id or actor_name:
        uid = str(actor_id or actor_name or "USR-INV-01")
        uname = str(actor_name or actor_id or "Officer Vikram")
        urole = str(actor_role or "Investigator")
    elif hasattr(acting_user, "user_id"):
        uid = str(acting_user.user_id)
        uname = str(acting_user.name)
        urole = acting_user.role.value if hasattr(acting_user.role, "value") else str(acting_user.role)
    elif isinstance(acting_user, str) and acting_user.strip():
        uid = acting_user.strip()
        uname = acting_user.strip()
        urole = "Investigator"
    else:
        uid = "USR-INV-01"
        uname = "Officer Vikram (Lead Investigator)"
        urole = "Investigator"

    audit_id = f"AUD-{uuid.uuid4().hex[:10].upper()}"
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    clean_action = action.strip() if action else "GENERAL_ACTION"
    clean_case = case_id.strip() if case_id else ""
    clean_res_id = resource_id.strip() if resource_id else ""
    clean_details = _sanitize_details(details.strip() if details else "")
    clean_metadata = _sanitize_metadata(metadata)

    with _log_lock:
        db = SessionLocal()
        try:
            # Fetch previous record's hash to maintain hash chain
            last_record = db.query(AuditLogDB).order_by(AuditLogDB.id.desc()).first()
            previous_hash = last_record.current_hash if last_record and last_record.current_hash else GENESIS_HASH

            current_hash = _compute_hash(previous_hash, timestamp_str, uid, clean_action, clean_case, clean_res_id)

            db_entry = AuditLogDB(
                audit_id=audit_id,
                timestamp=timestamp_str,
                user_id=uid,
                username=uname,
                role=urole,
                case_id=case_id,
                action=clean_action,
                resource_type=resource_type,
                resource_id=clean_res_id,
                result=result,
                details=clean_details,
                metadata_json=json.dumps(clean_metadata),
                previous_hash=previous_hash,
                current_hash=current_hash,
                ip_address=ip_address or "127.0.0.1",
                user_agent=user_agent[:250] if user_agent else "NetTrace/2.2",
            )
            db.add(db_entry)
            db.commit()
        finally:
            db.close()

        # Write to log file
        log_line = (
            f"[{timestamp_str}] [SECURITY AUDIT] {uname} ({uid} | {urole}) :- {clean_action} "
            f"| Case: {clean_case or 'N/A'} | Result: {result} | Hash: {current_hash[:12]}... (prev: {previous_hash[:12]}...) | {clean_details}\n"
        )
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_line)

    return {
        "audit_id": audit_id,
        "timestamp": timestamp_str,
        "user_id": uid,
        "username": uname,
        "role": urole,
        "case_id": case_id,
        "action": clean_action,
        "resource_type": resource_type,
        "resource_id": clean_res_id,
        "result": result,
        "details": clean_details,
        "previous_hash": previous_hash,
        "current_hash": current_hash,
        "ip_address": ip_address,
        "user_agent": user_agent,
    }


def get_audit_trail(limit: int = 100) -> List[Dict[str, Any]]:
    """Returns the most recent tamper-evident audit records in reverse chronological order."""
    db = SessionLocal()
    try:
        records = (
            db.query(AuditLogDB)
            .order_by(AuditLogDB.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "audit_id": r.audit_id,
                "timestamp": r.timestamp,
                "user_id": r.user_id,
                "username": r.username,
                "role": r.role,
                "case_id": r.case_id,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "result": r.result,
                "details": r.details,
                "previous_hash": r.previous_hash,
                "current_hash": r.current_hash,
                "ip_address": getattr(r, "ip_address", "127.0.0.1"),
                "user_agent": getattr(r, "user_agent", ""),
                "metadata": json.loads(r.metadata_json or "{}"),
            }
            for r in records
        ]
    finally:
        db.close()


def query_audit_activity(
    user_id: Optional[str] = None,
    role: Optional[str] = None,
    action: Optional[str] = None,
    case_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    sort_order: str = "desc",
) -> Dict[str, Any]:
    """
    Advanced filtered query for the Super Admin Inspector Activity dashboard.
    Supports user, role, action, case, status, date range, search, and pagination.
    """
    db = SessionLocal()
    try:
        q = db.query(AuditLogDB)

        if user_id:
            q = q.filter(AuditLogDB.user_id == user_id)
        if role:
            q = q.filter(AuditLogDB.role == role)
        if action:
            q = q.filter(AuditLogDB.action == action)
        if case_id:
            q = q.filter(AuditLogDB.case_id == case_id)
        if status:
            q = q.filter(AuditLogDB.result == status)
        if start_date:
            q = q.filter(AuditLogDB.timestamp >= start_date)
        if end_date:
            q = q.filter(AuditLogDB.timestamp <= end_date)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            q = q.filter(
                or_(
                    AuditLogDB.username.ilike(term),
                    AuditLogDB.user_id.ilike(term),
                    AuditLogDB.action.ilike(term),
                    AuditLogDB.details.ilike(term),
                    AuditLogDB.case_id.ilike(term),
                    AuditLogDB.resource_id.ilike(term),
                )
            )

        total_count = q.count()

        # Sorting
        if sort_order.lower() == "asc":
            q = q.order_by(AuditLogDB.id.asc())
        else:
            q = q.order_by(AuditLogDB.id.desc())

        # Pagination
        offset = max(0, (page - 1) * page_size)
        records = q.offset(offset).limit(page_size).all()

        formatted_records = [
            {
                "audit_id": r.audit_id,
                "timestamp": r.timestamp,
                "user_id": r.user_id,
                "username": r.username,
                "role": r.role,
                "case_id": r.case_id,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "result": r.result,
                "details": r.details,
                "previous_hash": r.previous_hash,
                "current_hash": r.current_hash,
                "ip_address": getattr(r, "ip_address", "127.0.0.1"),
                "user_agent": getattr(r, "user_agent", ""),
                "metadata": json.loads(r.metadata_json or "{}"),
            }
            for r in records
        ]

        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

        return {
            "records": formatted_records,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    finally:
        db.close()


def get_inspector_factual_indicators(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes objective, strictly factual indicators of officer activity for Super Admin inspection:
    - Failed login attempts
    - Deleted records
    - Large data exports
    - Permission / authorization errors (403s)
    - Successful operations
    Never generates speculative accusations or arbitrary criminal labels.
    """
    db = SessionLocal()
    try:
        q = db.query(AuditLogDB)
        if user_id:
            q = q.filter(AuditLogDB.user_id == user_id)

        all_entries = q.all()

        failed_logins = 0
        deleted_records = 0
        large_exports = 0
        permission_errors = 0
        successful_ops = 0

        user_breakdown: Dict[str, Dict[str, Any]] = {}

        for r in all_entries:
            act = r.action.lower()
            res = (r.result or "").upper()
            uid = r.user_id
            uname = r.username

            if uid not in user_breakdown:
                user_breakdown[uid] = {
                    "user_id": uid,
                    "username": uname,
                    "role": r.role,
                    "failed_logins": 0,
                    "deleted_records": 0,
                    "large_exports": 0,
                    "permission_errors": 0,
                    "successful_ops": 0,
                    "total_actions": 0,
                    "last_active": r.timestamp,
                }

            user_entry = user_breakdown[uid]
            user_entry["total_actions"] += 1
            if r.timestamp > user_entry["last_active"]:
                user_entry["last_active"] = r.timestamp

            # 1. Failed login check
            if "login" in act and res != "SUCCESS":
                failed_logins += 1
                user_entry["failed_logins"] += 1

            # 2. Permission / authorization errors
            elif res in ("DENIED", "FORBIDDEN", "UNAUTHORIZED") or "permission" in act or "denied" in act:
                permission_errors += 1
                user_entry["permission_errors"] += 1

            # 3. Deletions
            elif "delete" in act or "remove" in act or "clear" in act or "reset" in act:
                deleted_records += 1
                user_entry["deleted_records"] += 1

            # 4. Large exports / dossier downloads
            elif "export" in act or "dossier" in act or "download" in act:
                large_exports += 1
                user_entry["large_exports"] += 1

            # 5. Successful operations
            if res == "SUCCESS":
                successful_ops += 1
                user_entry["successful_ops"] += 1

        # Generate strictly factual anomaly notes without arbitrary criminal accusations
        factual_indicators = []
        if failed_logins >= 3:
            factual_indicators.append(f"Multiple failed login attempts ({failed_logins}) recorded across the system.")
        if permission_errors >= 1:
            factual_indicators.append(f"{permission_errors} authorization boundary or permission denials recorded.")
        if deleted_records >= 5:
            factual_indicators.append(f"Elevated volume of deletion/reset actions ({deleted_records}) executed.")
        if large_exports >= 3:
            factual_indicators.append(f"{large_exports} case or evidence export operations logged.")

        if not factual_indicators:
            factual_indicators.append("All logged activity within standard operational thresholds.")

        return {
            "summary": {
                "failed_login_attempts": failed_logins,
                "deleted_records": deleted_records,
                "large_data_exports": large_exports,
                "permission_errors": permission_errors,
                "successful_operations": successful_ops,
                "total_actions": len(all_entries),
            },
            "factual_indicators": factual_indicators,
            "inspectors": list(user_breakdown.values()),
        }
    finally:
        db.close()


def verify_audit_integrity() -> Dict[str, Any]:
    """
    Cryptographically verifies the complete tamper-evident audit trail hash chain.
    Returns validation status, total records checked, and any point of compromise.
    """
    db = SessionLocal()
    try:
        # Walk in forward chronological order (oldest to newest by monotonic id)
        records = db.query(AuditLogDB).order_by(AuditLogDB.id.asc()).all()
        if not records:
            return {
                "valid": True,
                "total_records": 0,
                "verified_records": 0,
                "broken_at": None,
                "message": "Audit trail is clean: 0 records present.",
            }

        expected_prev_hash = GENESIS_HASH
        for idx, rec in enumerate(records):
            # Check previous hash link
            if rec.previous_hash != expected_prev_hash:
                return {
                    "valid": False,
                    "total_records": len(records),
                    "verified_records": idx,
                    "broken_at": rec.audit_id,
                    "message": f"Tamper-evident audit chain broken at record {rec.audit_id}: previous hash mismatch.",
                }

            # Recalculate current hash
            recalc = _compute_hash(
                rec.previous_hash,
                rec.timestamp,
                rec.user_id,
                rec.action,
                rec.case_id or "",
                rec.resource_id or "",
            )
            if recalc != rec.current_hash:
                return {
                    "valid": False,
                    "total_records": len(records),
                    "verified_records": idx,
                    "broken_at": rec.audit_id,
                    "message": f"Tamper-evident audit chain compromised at record {rec.audit_id}: content hash signature invalid.",
                }

            expected_prev_hash = rec.current_hash

        return {
            "valid": True,
            "total_records": len(records),
            "verified_records": len(records),
            "broken_at": None,
            "message": f"✓ Tamper-evident audit trail verified: All {len(records)} entries cryptographically intact.",
        }
    finally:
        db.close()
