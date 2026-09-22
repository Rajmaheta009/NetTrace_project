import hashlib
import json
import logging
import re
import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import networkx as nx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.analytics import compute_centrality, ranked_entities
from app.audit_logger import get_audit_trail, record_audit, verify_audit_integrity
from app.auth import (
    AuthenticatedUser,
    DEFAULT_ROLE_PERMISSIONS,
    can_assign_roles,
    can_modify_user,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    get_current_user,
    hash_password,
    require_case_access,
    require_permission,
    require_role,
    revoke_refresh_token,
    set_active_session_role,
    verify_password,
    verify_refresh_token,
)
from app.case_store import CaseStore, case_manager
from app.community_detector import detect_communities
from app.config import CORS_ORIGINS, GROQ_API_KEY, GROQ_MODEL, MAX_UPLOAD_BYTES
from app.crime_inference import infer_crime_for_relationship
from app.crime_profiles import CrimeProfile, get_crime_profile, list_crime_profiles
from app.database import (
    CaseDB,
    CaseUserDB,
    PatternFindingDB,
    PermissionDB,
    RefreshTokenDB,
    RoleDB,
    RolePermissionDB,
    SessionLocal,
    UserDB,
    UserRoleDB,
    check_database_health,
)
from app.graph_store import store
from app.import_module import ImportValidationError
from app.investigation_leads import compute_entity_lead_score, rank_case_investigation_leads
from app.models import (
    AuditIntegrityResponse,
    Case,
    CaseCreateRequest,
    CaseStatus,
    CaseUpdateRequest,
    CaseUserAssignRequest,
    CaseUserOut,
    CentralityEntry,
    CommunityOut,
    ConnectionOut,
    ConnectionPathResponse,
    DbHealthResponse,
    DeepEntityInspectionResponse,
    EntityDetailResponse,
    EntityMergeRecordOut,
    EntityMergeRequest,
    Evidence,
    EvidenceCreateRequest,
    EvidenceSourceType,
    EvidenceStatus,
    GraphResponse,
    HealthResponse,
    ImportRequest,
    ImportResponse,
    InvestigationLeadOut,
    InvestigationQuestionOut,
    InvestigationReportResponse,
    LoginRequest,
    Note,
    NoteCreateRequest,
    PatternFlag,
    PatternReviewAction,
    PatternReviewStatus,
    PermissionOut,
    RefreshTokenRequest,
    RegisterRequest,
    RelationshipCrimeInferenceRequest,
    RelationshipCrimeInferenceResponse,
    RelationshipLineageResponse,
    RoleOut,
    SummaryResponse,
    TokenResponse,
    UserCreateRequest,
    UserOut,
    UserProfile,
    UserRole,
    UserRoleAssignRequest,
    UserRoleSwitchRequest,
    UserStatusUpdateRequest,
    UserUpdateRequest,
    ValidationRecord,
    ValidationReviewAction,
    ValidationStatus,
)
from app.path_finder import find_connection_path
from app.patterns import detect_all_patterns
from app.pipeline import reset_and_load_sample, run_import
from app.report_generator import generate_case_report
from app.summary import generate_summary

app = FastAPI(
    title="NetTrace - Entity Network Intelligence & Forensic Analysis API",
    description="Deterministic Graph Intelligence, Tamper-Evident Auditing, and Server-Enforced RBAC",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("nettrace")
_rate_limit_records: Dict[str, List[float]] = defaultdict(list)
_rate_limit_lock = threading.Lock()


@app.middleware("http")
async def add_security_headers_and_rate_limit(request: Request, call_next):
    # 1. Rate Limiting for sensitive routes (brute-force & DoS prevention)
    path = request.url.path
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Allow test runners to optionally bypass if header set, else apply limits
    bypass = request.headers.get("X-Test-Bypass-Rate-Limit") == "1"
    if not bypass:
        limit = None
        if path == "/api/auth/login":
            limit = (30, 60)  # 30 req / 60 sec
        elif path == "/api/auth/register":
            limit = (15, 60)
        elif path == "/api/auth/refresh":
            limit = (40, 60)
        elif path in ("/api/import", "/api/import/file"):
            limit = (40, 60)
        elif path == "/api/graph/summary":
            limit = (40, 60)

        if limit:
            max_req, window = limit
            key = f"{client_ip}:{path}"
            now = time.time()
            with _rate_limit_lock:
                timestamps = [t for t in _rate_limit_records[key] if now - t < window]
                if len(timestamps) >= max_req:
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": "Too Many Requests: Rate limit exceeded. Please wait before retrying."},
                        headers={"Retry-After": str(int(window - (now - timestamps[0])))}
                    )
                timestamps.append(now)
                _rate_limit_records[key] = timestamps

    response = await call_next(request)

    # 2. Hardened Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None) or {}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Incident logged for security audit."},
    )



class AuditLogRequest(BaseModel):
    action: str
    details: str = ""
    case_id: Optional[str] = None
    resource_id: Optional[str] = None


def _build_user_out(user: UserDB, db) -> UserOut:
    roles = [r.name for r in user.roles]
    if not roles and user.role:
        roles = [user.role]
    perm_codes: Set[str] = set()
    for r in user.roles:
        for p in r.permissions:
            perm_codes.add(p.code)
    if not perm_codes:
        for r_name in roles:
            perm_codes.update(DEFAULT_ROLE_PERMISSIONS.get(r_name.upper().replace(" ", "_"), []))
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        department=user.department or "Forensic Intelligence",
        designation=user.designation or "Investigator",
        status=user.status or "ACTIVE",
        roles=roles,
        permissions=sorted(list(perm_codes)),
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
    )


# -------------------------------------------------------------
# System & Health Endpoints
# -------------------------------------------------------------

@app.get("/health")
@app.get("/api/health")
def health():
    """Unauthenticated system health check for Docker, load balancers, and uptime monitors."""
    db_health = check_database_health()
    active_case = case_manager.get_active_case()
    g = active_case.build_graph() if active_case else None
    return {
        "status": "ok" if db_health.get("status") == "healthy" else "degraded",
        "database": db_health,
        "active_case_id": active_case.case_id if active_case else None,
        "active_case_name": active_case.case_name if active_case else None,
        "nodes": g.number_of_nodes() if g else 0,
        "edges": g.number_of_edges() if g else 0,
        "cases_total": len(case_manager.cases),
        "groq_configured": bool(GROQ_API_KEY),
        "groq_model": GROQ_MODEL,
        "version": "2.2.0",
        "environment": "production",
    }


@app.get("/health/db", response_model=DbHealthResponse)
@app.get("/api/health/db", response_model=DbHealthResponse)
def database_health():
    """Dedicated database connection, dialect, and connection-pool health check."""
    health_res = check_database_health()
    if health_res.get("status") != "healthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=health_res,
        )
    return health_res


@app.get("/api/graph/state")
def graph_state(current_user: AuthenticatedUser = Depends(get_current_user)):
    """State inspection of the active graph and user session context."""
    active_case = case_manager.get_active_case()
    g = active_case.build_graph() if active_case else None
    return {
        "status": "ok",
        "active_case_id": active_case.case_id if active_case else None,
        "active_case_name": active_case.case_name if active_case else None,
        "nodes": g.number_of_nodes() if g else 0,
        "edges": g.number_of_edges() if g else 0,
        "cases_total": len(case_manager.cases),
        "groq_configured": bool(GROQ_API_KEY),
        "groq_model": GROQ_MODEL,
        "current_user": current_user.to_user_profile().model_dump() if hasattr(current_user, "to_user_profile") else current_user,
    }


# -------------------------------------------------------------
# Security Audit Trail & Cryptographic Verification Endpoints
# -------------------------------------------------------------

@app.post("/api/audit/log")
def log_activity(req: AuditLogRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Record user activity in the persistent security audit log.
    User identity is cryptographically bound to the authenticated server session.
    """
    return record_audit(
        actor_name=current_user.name,
        action=req.action,
        details=req.details,
        case_id=req.case_id,
        resource_id=req.resource_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )


@app.get("/api/audit/trail")
@app.get("/api/audit/logs")
def view_audit_trail(limit: int = 100, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Retrieve the recent tamper-evident security audit log entries."""
    return get_audit_trail(limit=limit)


@app.get("/api/audit/integrity", response_model=AuditIntegrityResponse)
@app.get("/api/audit/verify", response_model=AuditIntegrityResponse)
def verify_audit_trail_integrity(
    current_user: AuthenticatedUser = Depends(require_role(UserRole.ADMIN, UserRole.INVESTIGATOR, UserRole.SUPER_ADMIN))
):
    """
    Cryptographically verifies the SHA-256 hash chaining of all audit log records.
    Returns whether the ledger is authentic or flags where tampering occurred.
    """
    return verify_audit_integrity()


# -------------------------------------------------------------
# Authentication Endpoints (JWT Access + Refresh Tokens)
# -------------------------------------------------------------

@app.post("/api/auth/register", response_model=UserOut)
def register_user(req: RegisterRequest):
    """Self-registration for new intelligence officers with default Viewer access."""
    db = SessionLocal()
    try:
        existing = db.query(UserDB).filter(
            (UserDB.username == req.username) | (UserDB.email == req.email)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already registered",
            )
        now_str = datetime.now(timezone.utc).isoformat()
        user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
        hashed_pw = hash_password(req.password)
        target_role_str = (req.role or "VIEWER").strip().upper().replace(" ", "_")
        new_user = UserDB(
            id=user_id,
            username=req.username,
            email=req.email,
            password_hash=hashed_pw,
            full_name=req.full_name,
            department=req.department or "Forensic Intelligence",
            designation=req.designation or "Investigator",
            status="ACTIVE",
            created_at=now_str,
            updated_at=now_str,
            role=target_role_str,
        )
        db.add(new_user)
        db.flush()

        role_rec = db.query(RoleDB).filter(RoleDB.name == target_role_str).first()
        if not role_rec:
            role_rec = db.query(RoleDB).filter(RoleDB.name == "VIEWER").first()
        if role_rec:
            db.add(UserRoleDB(user_id=new_user.id, role_id=role_rec.id))

        db.commit()
        db.refresh(new_user)

        record_audit(
            actor_name=new_user.full_name,
            action="user_register",
            details=f"User {new_user.username} registered with role {role_rec.name if role_rec else 'VIEWER'}",
            actor_id=new_user.id,
            actor_role=role_rec.name if role_rec else "VIEWER",
        )

        return _build_user_out(new_user, db)
    finally:
        db.close()


@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """
    Authenticates user via username/email and bcrypt password verification.
    Issues JWT access token (8h expiry) and persistent revocable refresh token.
    """
    db = SessionLocal()
    try:
        user = db.query(UserDB).filter(
            (UserDB.username == req.username_or_email) | (UserDB.email == req.username_or_email)
        ).first()
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.status in ("INACTIVE", "SUSPENDED"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.status}. Please contact a NetTrace administrator.",
            )

        # Update last login timestamp
        user.last_login = datetime.now(timezone.utc).isoformat()
        db.commit()

        user_out = _build_user_out(user, db)
        primary_role = user_out.roles[0] if user_out.roles else "VIEWER"

        token_data = {
            "sub": user.id,
            "username": user.username,
            "role": primary_role,
            "roles": user_out.roles,
            "email": user.email,
        }
        access_token = create_access_token(token_data, expires_delta=timedelta(hours=8))
        refresh_token_str = create_refresh_token(user.id, db)

        record_audit(
            actor_name=user.full_name,
            action="user_login",
            details=f"User {user.username} authenticated successfully",
            actor_id=user.id,
            actor_role=primary_role,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            token_type="bearer",
            expires_in=28800,
            user=user_out.model_dump(),
        )
    finally:
        db.close()


@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh_access_token(req: RefreshTokenRequest):
    """Refreshes expired access token using valid database-backed refresh token."""
    db = SessionLocal()
    try:
        user = verify_refresh_token(req.refresh_token, db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or revoked refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.status in ("INACTIVE", "SUSPENDED"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.status}",
            )

        # Revoke old refresh token and generate new pair
        revoke_refresh_token(req.refresh_token, db)
        new_refresh = create_refresh_token(user.id, db)

        user_out = _build_user_out(user, db)
        primary_role = user_out.roles[0] if user_out.roles else "VIEWER"
        token_data = {
            "sub": user.id,
            "username": user.username,
            "role": primary_role,
            "roles": user_out.roles,
            "email": user.email,
        }
        new_access = create_access_token(token_data, expires_delta=timedelta(hours=8))

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            token_type="bearer",
            expires_in=28800,
            user=user_out.model_dump(),
        )
    finally:
        db.close()


@app.post("/api/auth/logout")
def logout(
    req: Optional[RefreshTokenRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Terminates session and revokes persistent refresh token."""
    db = SessionLocal()
    try:
        if req and req.refresh_token:
            revoke_refresh_token(req.refresh_token, db)
        record_audit(
            actor_name=current_user.name,
            action="user_logout",
            details=f"User {current_user.name} logged out",
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )
        return {"status": "ok", "message": "Successfully logged out"}
    finally:
        db.close()


@app.get("/api/auth/me", response_model=UserProfile)
def get_auth_me(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Returns the authenticated officer's identity profile, assigned roles, and granular permissions."""
    return current_user.to_user_profile()


@app.post("/api/auth/switch-role", response_model=UserProfile)
def switch_role(req: UserRoleSwitchRequest, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Quick demo role switch for evaluation environments."""
    new_user = set_active_session_role(req.role)
    record_audit(
        actor_name=new_user.name,
        action="switch_role",
        details=f"Role switched to {req.role.value}",
        actor_id=new_user.user_id,
        actor_role=new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role),
    )
    return new_user


# -------------------------------------------------------------
# Administration: User, Role & Permission Management
# -------------------------------------------------------------

@app.get("/api/admin/users", response_model=List[UserOut])
def admin_list_users(current_user: AuthenticatedUser = Depends(require_permission("USER_VIEW"))):
    """Lists all registered intelligence platform users."""
    db = SessionLocal()
    try:
        users = db.query(UserDB).order_by(UserDB.created_at.desc()).all()
        return [_build_user_out(u, db) for u in users]
    finally:
        db.close()


@app.post("/api/admin/users", response_model=UserOut)
def admin_create_user(
    req: UserCreateRequest,
    current_user: AuthenticatedUser = Depends(require_permission("USER_CREATE")),
):
    """Creates a new officer account with specified roles and credentials."""
    if not can_assign_roles(current_user, req.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign roles exceeding your administrative privilege level",
        )

    db = SessionLocal()
    try:
        existing = db.query(UserDB).filter(
            (UserDB.username == req.username) | (UserDB.email == req.email)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            )
        now_str = datetime.now(timezone.utc).isoformat()
        user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
        hashed_pw = hash_password(req.password)
        primary_role = req.roles[0] if req.roles else "INVESTIGATOR"
        new_user = UserDB(
            id=user_id,
            username=req.username,
            email=req.email,
            password_hash=hashed_pw,
            full_name=req.full_name,
            department=req.department or "Forensic Intelligence",
            designation=req.designation or "Investigator",
            status="ACTIVE",
            created_at=now_str,
            updated_at=now_str,
            role=primary_role.strip().upper().replace(" ", "_"),
        )
        db.add(new_user)
        db.flush()

        for r_name in req.roles:
            norm_r = r_name.strip().upper().replace(" ", "_")
            r_obj = db.query(RoleDB).filter(RoleDB.name == norm_r).first()
            if r_obj:
                db.add(UserRoleDB(user_id=new_user.id, role_id=r_obj.id))

        db.commit()
        db.refresh(new_user)

        record_audit(
            actor_name=current_user.name,
            action="admin_create_user",
            details=f"Created user account {new_user.username} ({new_user.id}) with roles {req.roles}",
            resource_id=new_user.id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )

        return _build_user_out(new_user, db)
    finally:
        db.close()


@app.put("/api/admin/users/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: str,
    req: UserUpdateRequest,
    current_user: AuthenticatedUser = Depends(require_permission("USER_UPDATE")),
):
    """Updates user profile metadata with system-role protection hierarchy."""
    db = SessionLocal()
    try:
        target = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if not can_modify_user(current_user, target):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Violation: Cannot modify a Super Admin user account",
            )

        if req.full_name is not None:
            target.full_name = req.full_name
        if req.department is not None:
            target.department = req.department
        if req.designation is not None:
            target.designation = req.designation
        if req.email is not None:
            other = db.query(UserDB).filter(UserDB.email == req.email, UserDB.id != user_id).first()
            if other:
                raise HTTPException(status_code=409, detail="Email already in use by another account")
            target.email = req.email

        target.updated_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        db.refresh(target)

        record_audit(
            actor_name=current_user.name,
            action="admin_update_user",
            details=f"Updated profile for user {target.username} ({user_id})",
            resource_id=user_id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )

        return _build_user_out(target, db)
    finally:
        db.close()


@app.put("/api/admin/users/{user_id}/status", response_model=UserOut)
def admin_update_user_status(
    user_id: str,
    req: UserStatusUpdateRequest,
    current_user: AuthenticatedUser = Depends(require_permission("USER_DEACTIVATE")),
):
    """Suspends, deactivates, or activates user accounts and revokes active tokens on deactivation."""
    db = SessionLocal()
    try:
        target = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if not can_modify_user(current_user, target):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Violation: Cannot deactivate or suspend a Super Admin user account",
            )

        new_status = req.status.upper()
        if new_status not in ("ACTIVE", "INACTIVE", "SUSPENDED"):
            raise HTTPException(status_code=400, detail="Invalid status value")

        target.status = new_status
        target.updated_at = datetime.now(timezone.utc).isoformat()

        if new_status in ("INACTIVE", "SUSPENDED"):
            db.query(RefreshTokenDB).filter(
                RefreshTokenDB.user_id == user_id,
                RefreshTokenDB.revoked == False,
            ).update({"revoked": True})

        db.commit()
        db.refresh(target)

        record_audit(
            actor_name=current_user.name,
            action="admin_user_status",
            details=f"Set status to {new_status} for user {target.username} ({user_id})",
            resource_id=user_id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )

        return _build_user_out(target, db)
    finally:
        db.close()


@app.post("/api/admin/users/{user_id}/roles", response_model=UserOut)
def admin_assign_user_roles(
    user_id: str,
    req: UserRoleAssignRequest,
    current_user: AuthenticatedUser = Depends(require_permission("ROLE_ASSIGN")),
):
    """Assigns or updates role authorizations for an officer account."""
    db = SessionLocal()
    try:
        target = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if not can_modify_user(current_user, target):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Violation: Cannot modify roles for a Super Admin user account",
            )

        if not can_assign_roles(current_user, req.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Violation: Only Super Admin can assign the Super Admin role",
            )

        db.query(UserRoleDB).filter(UserRoleDB.user_id == user_id).delete()

        for r_name in req.roles:
            norm_r = r_name.strip().upper().replace(" ", "_")
            r_obj = db.query(RoleDB).filter(RoleDB.name == norm_r).first()
            if r_obj:
                db.add(UserRoleDB(user_id=user_id, role_id=r_obj.id))

        if req.roles:
            target.role = req.roles[0].strip().upper().replace(" ", "_")

        target.updated_at = datetime.now(timezone.utc).isoformat()
        db.commit()
        db.refresh(target)

        record_audit(
            actor_name=current_user.name,
            action="admin_assign_roles",
            details=f"Updated roles for user {target.username} ({user_id}) to {req.roles}",
            resource_id=user_id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )

        return _build_user_out(target, db)
    finally:
        db.close()


@app.get("/api/admin/roles", response_model=List[RoleOut])
def admin_list_roles(current_user: AuthenticatedUser = Depends(require_permission("ROLE_VIEW"))):
    """Lists all defined system roles and their assigned permission mappings."""
    db = SessionLocal()
    try:
        roles = db.query(RoleDB).order_by(RoleDB.id).all()
        result = []
        for r in roles:
            perm_codes = [p.code for p in r.permissions]
            result.append(RoleOut(
                id=r.id,
                name=r.name,
                description=r.description or "",
                is_system_role=r.is_system_role,
                permissions=sorted(perm_codes),
            ))
        return result
    finally:
        db.close()


@app.get("/api/admin/permissions", response_model=List[PermissionOut])
def admin_list_permissions(current_user: AuthenticatedUser = Depends(require_permission("ROLE_VIEW"))):
    """Lists all 35+ granular system permissions."""
    db = SessionLocal()
    try:
        perms = db.query(PermissionDB).order_by(PermissionDB.category, PermissionDB.code).all()
        return [
            PermissionOut(
                id=p.id,
                code=p.code,
                description=p.description or "",
                category=p.category or "General",
            )
            for p in perms
        ]
    finally:
        db.close()


# -------------------------------------------------------------
# Case-Level User Access Management
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/users", response_model=List[CaseUserOut])
def get_case_users(
    case_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Lists officers assigned to a specific investigation case."""
    db = SessionLocal()
    try:
        case = db.query(CaseDB).filter(CaseDB.case_id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        if not (current_user.is_admin or current_user.has_permission("CASE_VIEW_ALL")):
            assignment = db.query(CaseUserDB).filter(
                CaseUserDB.case_id == case_id,
                CaseUserDB.user_id == current_user.user_id,
            ).first()
            if not assignment:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to case")

        records = (
            db.query(CaseUserDB, UserDB.username, UserDB.full_name)
            .outerjoin(UserDB, CaseUserDB.user_id == UserDB.id)
            .filter(CaseUserDB.case_id == case_id)
            .all()
        )

        result = []
        for cu, username, full_name in records:
            result.append(CaseUserOut(
                id=cu.id,
                case_id=cu.case_id,
                user_id=cu.user_id,
                username=username,
                full_name=full_name,
                case_role=cu.case_role,
                assigned_by=cu.assigned_by,
                assigned_at=cu.assigned_at,
            ))
        return result
    finally:
        db.close()


@app.post("/api/cases/{case_id}/users", response_model=CaseUserOut)
def assign_user_to_case(
    case_id: str,
    req: CaseUserAssignRequest,
    current_user: AuthenticatedUser = Depends(require_permission("CASE_ASSIGN")),
):
    """Assigns an officer to an investigation case with a designated case role."""
    db = SessionLocal()
    try:
        case = db.query(CaseDB).filter(CaseDB.case_id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        user = db.query(UserDB).filter(UserDB.id == req.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        now_str = datetime.now(timezone.utc).isoformat()
        cu = db.query(CaseUserDB).filter(
            CaseUserDB.case_id == case_id,
            CaseUserDB.user_id == req.user_id,
        ).first()

        if cu:
            cu.case_role = req.case_role
            cu.assigned_by = current_user.name
            cu.assigned_at = now_str
        else:
            cu = CaseUserDB(
                case_id=case_id,
                user_id=req.user_id,
                case_role=req.case_role,
                assigned_by=current_user.name,
                assigned_at=now_str,
            )
            db.add(cu)

        db.commit()
        db.refresh(cu)

        record_audit(
            actor_name=current_user.name,
            action="case_assign_user",
            details=f"Assigned user {user.username} ({user.id}) to case {case_id} with role {req.case_role}",
            case_id=case_id,
            resource_id=user.id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )

        return CaseUserOut(
            id=cu.id,
            case_id=cu.case_id,
            user_id=cu.user_id,
            username=user.username,
            full_name=user.full_name,
            case_role=cu.case_role,
            assigned_by=cu.assigned_by,
            assigned_at=cu.assigned_at,
        )
    finally:
        db.close()


@app.delete("/api/cases/{case_id}/users/{user_id}")
def remove_user_from_case(
    case_id: str,
    user_id: str,
    current_user: AuthenticatedUser = Depends(require_permission("CASE_ASSIGN")),
):
    """Removes an officer's assignment from a case."""
    db = SessionLocal()
    try:
        cu = db.query(CaseUserDB).filter(
            CaseUserDB.case_id == case_id,
            CaseUserDB.user_id == user_id,
        ).first()
        if not cu:
            raise HTTPException(status_code=404, detail="Case assignment not found")

        db.delete(cu)
        db.commit()

        record_audit(
            actor_name=current_user.name,
            action="case_remove_user",
            details=f"Removed user {user_id} from case {case_id}",
            case_id=case_id,
            resource_id=user_id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )

        return {"status": "ok", "message": f"User {user_id} unassigned from case {case_id}"}
    finally:
        db.close()


# -------------------------------------------------------------
# Case Management Endpoints
# -------------------------------------------------------------

@app.get("/api/cases", response_model=List[Case])
def list_cases(current_user: AuthenticatedUser = Depends(get_current_user)):
    """List all registered cases with their operational metrics, enforcing case-level authorization."""
    all_cases = case_manager.list_cases()
    if current_user.is_admin or current_user.has_permission("CASE_VIEW_ALL"):
        return all_cases
    db = SessionLocal()
    try:
        assigned_case_ids = {
            cu.case_id for cu in db.query(CaseUserDB.case_id).filter(
                CaseUserDB.user_id == current_user.user_id
            ).all()
        }
        return [c for c in all_cases if c.case_id in assigned_case_ids]
    finally:
        db.close()


@app.post("/api/cases", response_model=Case)
def create_case(
    req: CaseCreateRequest,
    current_user: AuthenticatedUser = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """Create a new isolated case file (Investigator / Admin only)."""
    case = case_manager.create_case(
        case_name=req.case_name,
        description=req.description or "",
        investigation_type=req.investigation_type or "organized_crime",
        priority=req.priority or "High",
        created_by=req.created_by or current_user.name,
    )
    # Automatically assign creator as CASE_OWNER
    db = SessionLocal()
    try:
        cu = CaseUserDB(
            case_id=case.case_id,
            user_id=current_user.user_id,
            case_role="CASE_OWNER",
            assigned_by="System",
            assigned_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(cu)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    record_audit(
        actor_name=current_user.name,
        action="create_case",
        details=f"Created case {case.case_id}: {case.case_name} (Priority: {case.priority})",
        case_id=case.case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return case.get_summary_model()


@app.get("/api/cases/active/current", response_model=Case)
@app.get("/api/cases/active", response_model=Case)
def get_active_case_info(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Return operational summary for the currently active case."""
    return case_manager.get_active_case().get_summary_model()


@app.get("/api/cases/{case_id}", response_model=Case)
def get_case(case_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if not (current_user.is_admin or current_user.has_permission("CASE_VIEW_ALL")):
        db = SessionLocal()
        try:
            assignment = db.query(CaseUserDB).filter(
                CaseUserDB.case_id == case_id,
                CaseUserDB.user_id == current_user.user_id,
            ).first()
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access Denied: You are not assigned to case '{case_id}'.",
                )
        finally:
            db.close()

    return case.get_summary_model()


@app.put("/api/cases/{case_id}", response_model=Case)
def update_case(
    case_id: str,
    req: CaseUpdateRequest,
    current_user: AuthenticatedUser = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """
    Updates case metadata including case_name, description, investigation_type, priority, and status.
    Synchronizes immediately to persistent database.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    updated_case = case_manager.update_case(
        case_id=case_id,
        case_name=req.case_name,
        description=req.description,
        investigation_type=req.investigation_type,
        priority=req.priority,
        status=req.status,
    )
    record_audit(
        actor_name=current_user.name,
        action="update_case",
        details=f"Updated case metadata for {case_id}: name={req.case_name}, type={req.investigation_type}, priority={req.priority}, status={req.status}",
        case_id=case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return updated_case.get_summary_model()


@app.post("/api/cases/{case_id}/switch")
def switch_active_case(case_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    """Switch active investigation case with assignment verification."""
    if not (current_user.is_admin or current_user.has_permission("CASE_VIEW_ALL")):
        db = SessionLocal()
        try:
            assignment = db.query(CaseUserDB).filter(
                CaseUserDB.case_id == case_id,
                CaseUserDB.user_id == current_user.user_id,
            ).first()
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access Denied: You are not assigned to case '{case_id}'.",
                )
        finally:
            db.close()

    case = case_manager.switch_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    record_audit(
        actor_name=current_user.name,
        action="switch_case",
        details=f"Switched working case to {case_id} ({case.case_name})",
        case_id=case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return {"status": "ok", "active_case_id": case_id, "case": case.get_summary_model()}


@app.delete("/api/cases/{case_id}")
def delete_case(
    case_id: str,
    current_user: UserProfile = Depends(require_role(UserRole.ADMIN)),
):
    """
    Deletes a case (Admin role required).
    Protected cases (e.g. system default case-001) are guarded and return HTTP 403 Forbidden.
    """
    success, msg = case_manager.delete_case(case_id)
    if not success:
        if "protected" in msg.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    record_audit(
        actor_name=current_user.name,
        action="delete_case",
        details=f"Archived/Deleted case {case_id}",
        case_id=case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return {"status": "ok", "deleted_case_id": case_id, "message": msg}


@app.post("/api/cases/{case_id}/clear-graph", response_model=ImportResponse)
def clear_case_graph(
    case_id: str,
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """
    Clear Graph: Removes graph entities and relationships.
    Evidence registry, validation queue, and investigator field notes are strictly PRESERVED.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.clear_graph()
    record_audit(
        actor_name=current_user.name,
        action="clear_graph",
        details=f"Cleared graph entities and relationships for case {case_id}; evidence registry and notes preserved",
        case_id=case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return ImportResponse(
        imported_entities=0,
        imported_relationships=0,
        rejected_relationships=[],
        warnings=[],
        node_count=0,
        edge_count=0,
        detected_input_type="graph_cleared",
    )


@app.post("/api/cases/{case_id}/reset-investigation", response_model=ImportResponse)
def reset_case_investigation(
    case_id: str,
    current_user: UserProfile = Depends(require_role(UserRole.ADMIN)),
):
    """
    Reset Investigation: Administrative wipe of entities, relationships, evidence,
    validation records, notes, and merges for the specified case.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.reset_investigation()
    record_audit(
        actor_name=current_user.name,
        action="reset_investigation",
        details=f"Administrative full wipe performed on case {case_id}",
        case_id=case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return ImportResponse(
        imported_entities=0,
        imported_relationships=0,
        rejected_relationships=[],
        warnings=[],
        node_count=0,
        edge_count=0,
        detected_input_type="investigation_reset",
    )


# -------------------------------------------------------------
# Evidence Registry & Lineage Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/evidence", response_model=List[Evidence])
def get_case_evidence(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return list(case.evidence.values())


@app.get("/api/evidence", response_model=List[Evidence])
def get_active_case_evidence(current_user: UserProfile = Depends(get_current_user)):
    active_case = case_manager.get_active_case()
    return list(active_case.evidence.values())


@app.post("/api/cases/{case_id}/evidence", response_model=Evidence)
def register_evidence(
    case_id: str,
    req: EvidenceCreateRequest,
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    ev = case.register_evidence(
        filename=req.filename,
        source_type=req.source_type,
        content=req.content,
        uploaded_by=req.uploaded_by or current_user.name,
        description=req.description or "",
    )
    record_audit(
        actor_name=current_user.name,
        action="register_evidence",
        details=f"Registered evidence {ev.evidence_id} ({ev.filename}) in case {case_id}",
        case_id=case_id,
        resource_id=ev.evidence_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return ev


@app.get("/api/cases/{case_id}/relationships/{relationship_id}/lineage", response_model=RelationshipLineageResponse)
def get_relationship_lineage(
    case_id: str,
    relationship_id: str,
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Evidence Lineage Trace:
    Traces a relationship back through its supporting Evidence record to the original source text/log/row snippet.
    Returns the complete forensic provenance chain.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    rel = case.relationships.get(relationship_id)
    if not rel:
        # Search by ID or composite key
        for r in case.relationships.values():
            if r.id == relationship_id:
                rel = r
                break
    if not rel:
        raise HTTPException(status_code=404, detail=f"Relationship '{relationship_id}' not found in case '{case_id}'")

    source_ent = case.entities.get(rel.source)
    target_ent = case.entities.get(rel.target)

    # Collect supporting evidence objects
    supporting_evidence_objs: List[Evidence] = []
    raw_records: List[str] = []

    evidence_candidates = set(rel.evidence)
    if rel.evidence_id:
        evidence_candidates.add(rel.evidence_id)

    for ev_ref in evidence_candidates:
        if ev_ref in case.evidence:
            supporting_evidence_objs.append(case.evidence[ev_ref])
        else:
            # Check by filename
            for ev in case.evidence.values():
                if ev.filename == ev_ref:
                    supporting_evidence_objs.append(ev)

    if rel.source_record:
        raw_records.append(rel.source_record)
    elif rel.attributes:
        raw_records.append(json.dumps(rel.attributes))

    source_name = source_ent.name if source_ent else rel.source
    target_name = target_ent.name if target_ent else rel.target
    rel_type_str = rel.relation_type.value if hasattr(rel.relation_type, "value") else str(rel.relation_type)

    if supporting_evidence_objs:
        primary_ev = supporting_evidence_objs[0]
        hash_short = primary_ev.sha256_hash[:12] if primary_ev.sha256_hash else "UNHASHED"
        lineage_summary = (
            f"Relationship '{source_name}' --[{rel_type_str}]--> '{target_name}' was extracted from evidence file "
            f"'{primary_ev.filename}' (SHA-256: {hash_short}...) acquired on {primary_ev.uploaded_at} "
            f"by {primary_ev.uploaded_by} using parser {primary_ev.parser_version}."
        )
    else:
        lineage_summary = (
            f"Relationship '{source_name}' --[{rel_type_str}]--> '{target_name}' recorded via direct field entry "
            f"or structural graph synthesis."
        )

    primary_ev = supporting_evidence_objs[0] if supporting_evidence_objs else None
    return RelationshipLineageResponse(
        relationship_id=rel.id,
        source_id=rel.source,
        source_name=source_name,
        target_id=rel.target,
        target_name=target_name,
        relation_type=rel_type_str,
        evidence_id=rel.evidence_id,
        source_file=rel.source_file,
        source_record=rel.source_record,
        evidence_citations=rel.evidence,
        confidence=rel.confidence,
        confidence_label=rel.confidence_label,
        validation_status=rel.validation_status or "Valid",
        parser_version=primary_ev.parser_version if primary_ev else "v2.2-deterministic",
        timestamp=primary_ev.uploaded_at if primary_ev else None,
        supporting_evidence=supporting_evidence_objs,
        raw_records=raw_records,
        lineage_summary=lineage_summary,
    )


# -------------------------------------------------------------
# Data Import Endpoints (Case-Aware Ingestion)
# -------------------------------------------------------------

@app.post("/api/import", response_model=ImportResponse)
def import_data(
    request: ImportRequest,
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """
    Import CSV, JSON, or unstructured text into a specified or active case.
    Validates case status and tags all entities and relationships with case and evidence provenance.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be empty")
    try:
        res = run_import(request)
        target_case_id = request.case_id or case_manager.active_case_id
        record_audit(
            actor_name=current_user.name,
            action="import_data",
            details=f"Ingested {res.imported_entities} entities, {res.imported_relationships} rels into case {target_case_id} ({res.detected_input_type})",
            case_id=target_case_id,
            resource_id=res.evidence_id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )
        return res
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/import/file", response_model=ImportResponse)
async def import_file(
    file: UploadFile = File(...),
    source_label: str = Form(None),
    case_id: Optional[str] = Form(None),
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """Import an uploaded file via multipart/form-data into the target or active case."""
    raw_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed upload size of {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if _looks_binary(raw_bytes):
        raise HTTPException(
            status_code=400,
            detail="Binary file format detected. Please provide plain text, CSV, JSON, or log files.",
        )

    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = raw_bytes.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Could not decode file as text.")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file has no readable content.")

    # Reject dangerous executable/script extensions
    ext = Path(file.filename or "").suffix.lower()
    if ext in (".exe", ".bat", ".cmd", ".sh", ".ps1", ".dll", ".so", ".bin", ".vbs"):
        raise HTTPException(
            status_code=400,
            detail="Executable or script files are strictly rejected for security integrity.",
        )

    raw_label = source_label or file.filename or "uploaded_file"
    clean_name = Path(raw_label).name
    clean_name = re.sub(r'[^\w\-_\.]', '_', clean_name)
    label = clean_name or "uploaded_file"
    request = ImportRequest(type=None, content=text, source_label=label, case_id=case_id)
    try:
        res = run_import(request)
        target_case_id = case_id or case_manager.active_case_id
        record_audit(
            actor_name=current_user.name,
            action="import_file",
            details=f"Ingested file '{label}' into case {target_case_id} (entities={res.imported_entities}, rels={res.imported_relationships})",
            case_id=target_case_id,
            resource_id=res.evidence_id,
            actor_id=current_user.user_id,
            actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        )
        return res
    except ImportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# -------------------------------------------------------------
# Graph, Centrality, Patterns Endpoints (Neutral Terminology)
# -------------------------------------------------------------

@app.get("/api/graph", response_model=GraphResponse)
def get_graph(current_user: UserProfile = Depends(get_current_user)):
    """Return the active case graph as node-link JSON for visualization."""
    active_case = case_manager.get_active_case()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    _, node_to_comm = detect_communities(undirected_g, centrality)
    return active_case.to_node_link(centrality, community_map=node_to_comm)


@app.get("/api/graph/centrality", response_model=List[CentralityEntry])
def get_centrality(current_user: UserProfile = Depends(get_current_user)):
    """Return Priority Entities ranked by degree and betweenness centrality."""
    active_case = case_manager.get_active_case()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    rows = ranked_entities(undirected_g, centrality)
    return [CentralityEntry(id=r[0], name=r[1], degree=r[2], betweenness=r[3]) for r in rows]


@app.get("/api/graph/patterns", response_model=List[PatternFlag])
@app.get("/api/cases/{case_id}/patterns", response_model=List[PatternFlag])
def get_patterns(case_id: Optional[str] = None, current_user: UserProfile = Depends(get_current_user)):
    """
    Return suspicious structural pattern flags detected in the network.
    Overlays false-positive review statuses (NEW, CONFIRMED, DISMISSED, CORRECTED) from SQLite persistence.
    """
    target_case = case_manager.get_case(case_id) if case_id else case_manager.get_active_case()
    if not target_case:
        raise HTTPException(status_code=404, detail="Case not found")

    graph = target_case.build_graph()
    undirected_g = target_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    raw_patterns = detect_all_patterns(graph, centrality)

    # Attach deterministic finding IDs and overlay review statuses
    db = SessionLocal()
    try:
        enriched_patterns: List[PatternFlag] = []
        for p in raw_patterns:
            f_sig = f"{target_case.case_id}:{p.pattern_type}:{sorted(p.entities_involved)}"
            finding_id = f"PAT-{hashlib.sha256(f_sig.encode()).hexdigest()[:10].upper()}"

            p_db = db.query(PatternFindingDB).filter(
                PatternFindingDB.finding_id == finding_id,
                PatternFindingDB.case_id == target_case.case_id,
            ).first()

            rev_status = PatternReviewStatus.NEW
            rev_by = None
            rev_at = None
            rev_notes = None

            if p_db:
                try:
                    rev_status = PatternReviewStatus(p_db.review_status)
                except Exception:
                    rev_status = PatternReviewStatus.NEW
                rev_by = p_db.reviewed_by
                rev_at = p_db.reviewed_at
                rev_notes = p_db.review_reason

            flag_copy = p.model_copy(
                update={
                    "finding_id": finding_id,
                    "case_id": target_case.case_id,
                    "review_status": rev_status,
                    "reviewed_by": rev_by,
                    "reviewed_at": rev_at,
                    "review_notes": rev_notes,
                }
            )
            enriched_patterns.append(flag_copy)
        return enriched_patterns
    finally:
        db.close()


@app.post("/api/cases/{case_id}/patterns/{finding_id}/review")
def review_pattern_finding(
    case_id: str,
    finding_id: str,
    req: PatternReviewAction,
    current_user: AuthenticatedUser = Depends(require_role(UserRole.ANALYST, UserRole.INVESTIGATOR, UserRole.ADMIN, UserRole.REVIEWER)),
):
    """
    False-Positive Handling:
    Allows Analysts and Investigators to mark pattern flags as DISMISSED (expected pattern / false positive),
    CONFIRMED, or CORRECTED with documented investigative notes.
    """
    from datetime import datetime
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    action_val = "DISMISSED"
    if req.action:
        action_val = req.action.value if hasattr(req.action, "value") else str(req.action)
    elif req.review_status:
        action_val = req.review_status.value if hasattr(req.review_status, "value") else str(req.review_status)
    notes_val = req.notes or req.review_reason or ""

    db = SessionLocal()
    try:
        p_db = db.query(PatternFindingDB).filter(
            PatternFindingDB.finding_id == finding_id,
            PatternFindingDB.case_id == case_id,
        ).first()

        if not p_db:
            p_db = PatternFindingDB(
                finding_id=finding_id,
                case_id=case_id,
                pattern_type="pattern_flag",
                entities_involved_json="[]",
                review_status=action_val,
                reviewed_by=current_user.name,
                reviewed_at=now,
                review_reason=notes_val,
            )
            db.add(p_db)
        else:
            p_db.review_status = action_val
            p_db.reviewed_by = current_user.name
            p_db.reviewed_at = now
            p_db.review_reason = notes_val or p_db.review_reason

        db.commit()
    finally:
        db.close()

    record_audit(
        actor_name=current_user.name,
        action="review_pattern",
        details=f"Pattern {finding_id} marked as {action_val}. Justification: {notes_val or 'Standard review'}",
        case_id=case_id,
        resource_id=finding_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )

    return {
        "status": "ok",
        "finding_id": finding_id,
        "case_id": case_id,
        "review_status": action_val,
        "reviewed_by": current_user.name,
        "reviewed_at": now,
        "notes": notes_val,
    }


@app.get("/api/graph/entity/{entity_id}", response_model=EntityDetailResponse)
def get_entity_detail(entity_id: str, current_user: UserProfile = Depends(get_current_user)):
    """Return an entity's 1-hop neighborhood, community, evidence, and notes."""
    active_case = case_manager.get_active_case()
    if entity_id not in active_case.entities:
        clean_target = entity_id.strip("'\"").strip().lower()
        for e in active_case.entities.values():
            if (
                e.id.lower() == clean_target
                or e.name.lower() == clean_target
                or any(clean_target == a.lower() for a in (e.aliases or []))
            ):
                entity_id = e.id
                break
    if entity_id not in active_case.entities:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found")

    graph = active_case.build_graph()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    _, node_to_comm = detect_communities(undirected_g, centrality)

    connections = []
    entity_obj = active_case.entities[entity_id]
    if entity_id in graph:
        for neighbor in graph.neighbors(entity_id):
            for _, edge_data in graph.get_edge_data(entity_id, neighbor).items():
                neighbor_obj = active_case.entities.get(neighbor)
                c_info = infer_crime_for_relationship(
                    relation_type=edge_data["relation_type"],
                    source_entity=entity_obj,
                    target_entity=neighbor_obj,
                    evidence=edge_data.get("evidence", []),
                    attributes=edge_data.get("attributes", {}),
                    case_profile=active_case.investigation_type or "organized_crime",
                )
                connections.append(
                    ConnectionOut(
                        entity_id=neighbor,
                        entity_name=graph.nodes[neighbor].get("name", neighbor),
                        relation_type=edge_data["relation_type"],
                        evidence=edge_data.get("evidence", []),
                        suspected_crime=c_info.get("suspected_crime"),
                        crime_category=c_info.get("crime_category"),
                        legal_statutes=c_info.get("legal_statutes", []),
                        crime_severity=c_info.get("crime_severity", "Moderate"),
                        crime_rationale=c_info.get("crime_rationale"),
                    )
                )
        if hasattr(graph, "predecessors"):
            for pred in graph.predecessors(entity_id):
                if pred not in graph.neighbors(entity_id):
                    for _, edge_data in graph.get_edge_data(pred, entity_id).items():
                        pred_obj = active_case.entities.get(pred)
                        c_info = infer_crime_for_relationship(
                            relation_type=edge_data["relation_type"],
                            source_entity=pred_obj,
                            target_entity=entity_obj,
                            evidence=edge_data.get("evidence", []),
                            attributes=edge_data.get("attributes", {}),
                            case_profile=active_case.investigation_type or "organized_crime",
                        )
                        connections.append(
                            ConnectionOut(
                                entity_id=pred,
                                entity_name=graph.nodes[pred].get("name", pred),
                                relation_type=edge_data["relation_type"],
                                evidence=edge_data.get("evidence", []),
                                suspected_crime=c_info.get("suspected_crime"),
                                crime_category=c_info.get("crime_category"),
                                legal_statutes=c_info.get("legal_statutes", []),
                                crime_severity=c_info.get("crime_severity", "Moderate"),
                                crime_rationale=c_info.get("crime_rationale"),
                            )
                        )

    entity_notes = [n for n in active_case.notes.values() if n.entity_id == entity_id]

    return EntityDetailResponse(
        entity=entity_obj,
        centrality=centrality.get(entity_id, {"degree": 0.0, "betweenness": 0.0}),
        connections=connections,
        community=node_to_comm.get(entity_id, entity_obj.community_id),
        evidence_refs=entity_obj.source_refs,
        notes=entity_notes,
    )


@app.get("/api/graph/summary", response_model=SummaryResponse)
def get_summary(current_user: UserProfile = Depends(get_current_user)):
    """Return the plain-English intelligence briefing summary for the active case."""
    active_case = case_manager.get_active_case()
    graph = active_case.build_graph()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    rows = ranked_entities(undirected_g, centrality)
    flags = detect_all_patterns(graph, centrality)
    result = generate_summary(rows, flags)
    return SummaryResponse(**result)


# -------------------------------------------------------------
# Community & Cluster Detection Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/communities", response_model=List[CommunityOut])
def get_case_communities(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    undirected_g = case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    communities, _ = detect_communities(undirected_g, centrality)
    return communities


@app.get("/api/graph/communities", response_model=List[CommunityOut])
@app.get("/api/communities", response_model=List[CommunityOut])
def get_active_communities(current_user: UserProfile = Depends(get_current_user)):
    active_case = case_manager.get_active_case()
    undirected_g = active_case.build_undirected_graph()
    centrality = compute_centrality(undirected_g)
    communities, _ = detect_communities(undirected_g, centrality)
    return communities


# -------------------------------------------------------------
# Connection Finder (Shortest Path & Evidence Trace) Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/connections", response_model=ConnectionPathResponse)
def get_case_connections(
    case_id: str,
    source_id: str = Query(...),
    target_id: str = Query(...),
    current_user: UserProfile = Depends(get_current_user),
):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return find_connection_path(case.build_graph(), case.entities, case.relationships, source_id, target_id)


@app.get("/api/graph/connections", response_model=ConnectionPathResponse)
def get_active_connections(
    source_id: str = Query(...),
    target_id: str = Query(...),
    current_user: UserProfile = Depends(get_current_user),
):
    active_case = case_manager.get_active_case()
    return find_connection_path(active_case.build_graph(), active_case.entities, active_case.relationships, source_id, target_id)


# -------------------------------------------------------------
# Relationship Crime Inference Endpoints
# -------------------------------------------------------------

@app.post("/api/graph/relationship/infer-crime", response_model=RelationshipCrimeInferenceResponse)
def infer_relationship_crime_endpoint(
    req: RelationshipCrimeInferenceRequest,
    current_user: UserProfile = Depends(get_current_user),
):
    """
    Infers suspected criminal offense, legal statutes, severity, and recommendations
    for any relationship or ad-hoc query.
    """
    active_case = case_manager.get_active_case()
    source_ent = active_case.entities.get(req.source) if req.source else None
    target_ent = active_case.entities.get(req.target) if req.target else None

    if not source_ent and (req.source_name or req.source_type):
        from app.models import Entity, EntityType
        try:
            e_type = EntityType(req.source_type)
        except Exception:
            e_type = EntityType.SUSPECT
        source_ent = Entity(
            id=req.source or "src-synth",
            name=req.source_name or req.source or "Source Entity",
            type=e_type,
            attributes={},
        )

    if not target_ent and (req.target_name or req.target_type):
        from app.models import Entity, EntityType
        try:
            e_type = EntityType(req.target_type)
        except Exception:
            e_type = EntityType.SUSPECT
        target_ent = Entity(
            id=req.target or "tgt-synth",
            name=req.target_name or req.target or "Target Entity",
            type=e_type,
            attributes={},
        )

    crime_info = infer_crime_for_relationship(
        relation_type=req.relation_type,
        source_entity=source_ent,
        target_entity=target_ent,
        evidence=req.evidence,
        attributes=req.attributes,
        case_profile=req.case_profile or active_case.investigation_type or "organized_crime",
    )
    return RelationshipCrimeInferenceResponse(**crime_info)


@app.get("/api/cases/{case_id}/relationships/{relationship_id}/crime-inference", response_model=RelationshipCrimeInferenceResponse)
def get_relationship_crime_inference(
    case_id: str,
    relationship_id: str,
    current_user: UserProfile = Depends(get_current_user),
):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    rel = case.relationships.get(relationship_id)
    if not rel:
        raise HTTPException(status_code=404, detail=f"Relationship '{relationship_id}' not found")

    src_ent = case.entities.get(rel.source)
    tgt_ent = case.entities.get(rel.target)
    crime_info = infer_crime_for_relationship(
        relation_type=rel.relation_type,
        source_entity=src_ent,
        target_entity=tgt_ent,
        evidence=rel.evidence,
        attributes=rel.attributes,
        case_profile=case.investigation_type or "organized_crime",
    )
    return RelationshipCrimeInferenceResponse(**crime_info)


# -------------------------------------------------------------
# Data Quality / Disciplined Validation Review Workflow Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/validation", response_model=List[ValidationRecord])
def get_case_validation(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return list(case.validation_records.values())


@app.get("/api/validation", response_model=List[ValidationRecord])
def get_active_validation(current_user: UserProfile = Depends(get_current_user)):
    active_case = case_manager.get_active_case()
    return list(active_case.validation_records.values())


@app.post("/api/cases/{case_id}/validation/{record_id}/review", response_model=ValidationRecord)
def review_case_validation(
    case_id: str,
    record_id: str,
    action_req: ValidationReviewAction,
    current_user: AuthenticatedUser = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN, UserRole.REVIEWER)),
):
    """
    Disciplined validation review:
    Accept, Reject, or Correct extraction flags.
    Confirms entity endpoints and prevents duplicate relationship creation upon commit.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    rec = case.review_validation(record_id, action_req.action, action_req.corrected_payload)
    if not rec:
        raise HTTPException(status_code=404, detail="Validation record not found")
    record_audit(
        actor_name=current_user.name,
        action="review_validation",
        details=f"Action {action_req.action} executed on review item {record_id} ({rec.name_or_pair})",
        case_id=case_id,
        resource_id=record_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return rec


# -------------------------------------------------------------
# Investigation Field Notes Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/notes", response_model=List[Note])
def get_case_notes(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return list(case.notes.values())


@app.get("/api/notes", response_model=List[Note])
def get_active_notes(current_user: UserProfile = Depends(get_current_user)):
    active_case = case_manager.get_active_case()
    return list(active_case.notes.values())


@app.post("/api/cases/{case_id}/notes", response_model=Note)
def create_case_note(
    case_id: str,
    req: NoteCreateRequest,
    current_user: AuthenticatedUser = Depends(require_role(UserRole.ANALYST, UserRole.INVESTIGATOR, UserRole.ADMIN, UserRole.REVIEWER)),
):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    note = case.create_note(
        note_text=req.note_text,
        entity_id=req.entity_id,
        relationship_id=req.relationship_id,
        evidence_id=req.evidence_id,
        created_by=req.created_by or current_user.name,
    )
    record_audit(
        actor_name=current_user.name,
        action="create_note",
        details=f"Created investigation field note {note.note_id} in case {case_id}",
        case_id=case_id,
        resource_id=note.note_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return note


@app.delete("/api/cases/{case_id}/notes/{note_id}")
def delete_case_note(
    case_id: str,
    note_id: str,
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    ok = case.delete_note(note_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Note not found")
    record_audit(
        actor_name=current_user.name,
        action="delete_note",
        details=f"Deleted field note {note_id} from case {case_id}",
        case_id=case_id,
        resource_id=note_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return {"status": "ok", "deleted_note_id": note_id}


# -------------------------------------------------------------
# Forensic Case Dossier / Report Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/report", response_model=InvestigationReportResponse)
def get_case_report_dossier(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return generate_case_report(case, generated_by=current_user.name)


@app.get("/api/graph/report", response_model=InvestigationReportResponse)
def get_active_report_dossier(current_user: UserProfile = Depends(get_current_user)):
    active_case = case_manager.get_active_case()
    return generate_case_report(active_case, generated_by=current_user.name)


# -------------------------------------------------------------
# Graph State Manipulation (Reset / Clear / Load-Demo)
# -------------------------------------------------------------

@app.post("/api/graph/reset", response_model=ImportResponse)
def reset_graph(
    load_sample: bool = False,
    current_user: UserProfile = Depends(require_role(UserRole.ADMIN)),
):
    """Admin-only reset of the active case graph."""
    active_case = case_manager.get_active_case()
    active_case.clear_graph()
    store.reset()
    record_audit(
        actor_name=current_user.name,
        action="reset_graph",
        details=f"Active case graph reset (load_sample={load_sample})",
        case_id=active_case.case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    if load_sample:
        return reset_and_load_sample()
    return ImportResponse(
        imported_entities=0,
        imported_relationships=0,
        rejected_relationships=[],
        warnings=[],
        node_count=0,
        edge_count=0,
        detected_input_type=None,
    )


@app.post("/api/graph/clear", response_model=ImportResponse)
def clear_graph_endpoint(
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """Clear entities and relationships from active case; preserves evidence and notes."""
    active_case = case_manager.get_active_case()
    active_case.clear_graph()
    store.reset()
    record_audit(
        actor_name=current_user.name,
        action="clear_graph",
        details="Active case graph cleared (evidence and notes preserved)",
        case_id=active_case.case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return ImportResponse(
        imported_entities=0,
        imported_relationships=0,
        rejected_relationships=[],
        warnings=[],
        node_count=0,
        edge_count=0,
        detected_input_type="graph_cleared",
    )


@app.post("/api/graph/load-demo", response_model=ImportResponse)
def load_demo(
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """Reloads multi-vector demonstration intelligence files into active case."""
    active_case = case_manager.get_active_case()
    res = reset_and_load_sample()
    record_audit(
        actor_name=current_user.name,
        action="load_demo",
        details=f"Reloaded demonstration multi-vector intelligence suite into case {active_case.case_id}",
        case_id=active_case.case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return res


# -------------------------------------------------------------
# Binary File Detection Utility
# -------------------------------------------------------------

_BINARY_MAGIC_PREFIXES = (
    b"%PDF-",
    b"PK\x03\x04",
    b"\x89PNG",
    b"\xff\xd8\xff",
    b"GIF8",
    b"\x00\x00\x01\x00",
)


def _looks_binary(raw_bytes: bytes) -> bool:
    if raw_bytes.startswith(_BINARY_MAGIC_PREFIXES):
        return True
    sample = raw_bytes[:2048]
    if b"\x00" in sample:
        return True
    non_printable = sum(1 for b in sample if b < 9 or (13 < b < 32))
    return len(sample) > 0 and (non_printable / len(sample)) > 0.1


# -------------------------------------------------------------
# Crime Profiles & Investigation Questions Endpoints
# -------------------------------------------------------------

@app.get("/api/crime-profiles", response_model=List[CrimeProfile])
def get_all_crime_profiles(current_user: UserProfile = Depends(get_current_user)):
    """List all 11 standardized digital investigation profiles."""
    return list_crime_profiles()


@app.get("/api/crime-profiles/{profile_id}", response_model=CrimeProfile)
def get_single_crime_profile(profile_id: str, current_user: UserProfile = Depends(get_current_user)):
    """Retrieve detailed configuration for a specific crime profile."""
    return get_crime_profile(profile_id)


@app.get("/api/cases/{case_id}/investigation-profile", response_model=CrimeProfile)
def get_case_investigation_profile(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    """Retrieve active crime profile configuration for the specified case."""
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return get_crime_profile(case.investigation_type)


@app.put("/api/cases/{case_id}/investigation-type", response_model=Case)
def update_case_investigation_type(
    case_id: str,
    payload: Dict[str, str],
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """
    Switch active investigation type for a case.
    Preserves 100% of underlying graph nodes, relationships, and evidence.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    new_type = payload.get("investigation_type")
    if not new_type:
        raise HTTPException(status_code=400, detail="Missing investigation_type in payload")
    profile = get_crime_profile(new_type)
    case.set_investigation_type(profile.id)
    record_audit(
        actor_name=current_user.name,
        action="switch_investigation_type",
        details=f"Switched investigation profile to '{profile.name}' for case {case_id}",
        case_id=case_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )
    return case.get_summary_model()


@app.get("/api/cases/{case_id}/investigation-questions", response_model=List[InvestigationQuestionOut])
def get_case_investigation_questions(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    """
    Retrieve hypothesis-driven, neutral investigative questions tailored
    to the case's active crime profile.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    profile = get_crime_profile(case.investigation_type)

    questions = []
    for idx, q_text in enumerate(profile.investigation_questions, 1):
        questions.append(
            InvestigationQuestionOut(
                index=idx,
                question=q_text,
                profile_id=profile.id,
                profile_name=profile.name,
                relevant_entity_types=profile.important_entity_types,
                relevant_relationship_types=profile.important_relationship_types,
            )
        )
    return questions


# -------------------------------------------------------------
# Investigation Leads Prioritization Endpoints
# -------------------------------------------------------------

@app.get("/api/cases/{case_id}/leads", response_model=List[InvestigationLeadOut])
def get_case_leads(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    """
    Computes and ranks all entities within a case by their Investigation Lead Score (0-100).
    Uses transparent, deterministic observations and active crime profile weighting.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return rank_case_investigation_leads(case)


@app.get("/api/graph/leads", response_model=List[InvestigationLeadOut])
@app.get("/api/leads", response_model=List[InvestigationLeadOut])
@app.get("/api/investigation-leads", response_model=List[InvestigationLeadOut])
def get_active_case_leads(current_user: UserProfile = Depends(get_current_user)):
    """Retrieve ranked investigation leads for the currently active working case."""
    case = case_manager.get_active_case()
    return rank_case_investigation_leads(case)


# -------------------------------------------------------------
# Deep Entity Inspection Endpoint
# -------------------------------------------------------------

@app.get("/api/entities/{entity_id}/deep-inspection", response_model=DeepEntityInspectionResponse)
def get_active_entity_deep_inspection(entity_id: str, current_user: UserProfile = Depends(get_current_user)):
    """Deep inspection for an entity within the currently active case."""
    active_case = case_manager.get_active_case()
    return get_deep_entity_inspection(active_case.case_id, entity_id, current_user)


@app.get("/api/cases/{case_id}/entities/{entity_id}/deep-inspection", response_model=DeepEntityInspectionResponse)
def get_deep_entity_inspection(case_id: str, entity_id: str, current_user: UserProfile = Depends(get_current_user)):
    """
    Full-spectrum forensic inspection of an entity across all analytical vectors:
    network position, relationships matrix, evidence traceability, chronological timeline,
    communities, heuristic patterns, attached notes, and transparent lead score.
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    entity = case.entities.get(entity_id)
    if not entity:
        clean_target = entity_id.strip("'\"").strip().lower()
        for e in case.entities.values():
            if (
                e.id.lower() == clean_target
                or e.name.lower() == clean_target
                or any(clean_target == a.lower() for a in (e.aliases or []))
            ):
                entity = e
                entity_id = e.id
                break
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found in case '{case_id}'")

    profile = get_crime_profile(case.investigation_type)
    G = case.build_graph()

    # Undirected projection for centralities
    undirected = nx.Graph()
    for u, v in G.edges():
        undirected.add_edge(u, v)

    betweenness = nx.betweenness_centrality(undirected) if len(undirected) > 1 else {n: 0.0 for n in G.nodes()}
    degree = nx.degree_centrality(undirected) if len(undirected) > 1 else {n: 0.0 for n in G.nodes()}

    # Community Detection & lookup
    communities_map: Dict[str, str] = {}
    my_comm_info: Dict[str, Any] = {
        "community_id": "comm-1",
        "name": "Community 1",
        "size": 1,
        "density": 0.0,
        "members": [{"id": entity.id, "name": entity.name, "type": str(entity.type)}],
        "internal_edges": 0,
    }

    try:
        comms = detect_communities(G)
        for c in comms:
            for m in c.members:
                communities_map[m["id"]] = c.name
                if m["id"] == entity_id:
                    my_comm_info = {
                        "community_id": c.community_id,
                        "name": c.name,
                        "size": c.size,
                        "density": c.density,
                        "members": c.members,
                        "internal_edges": c.internal_edges,
                    }
    except Exception:
        pass

    # Incident relationships
    incident_rels_out = []
    connected_entity_ids = set()
    supporting_ev_ids = set()
    if entity.evidence_id:
        supporting_ev_ids.add(entity.evidence_id)

    timeline_events = []

    for r in case.relationships.values():
        is_source = r.source == entity_id
        is_target = r.target == entity_id
        if is_source or is_target:
            other_id = r.target if is_source else r.source
            connected_entity_ids.add(other_id)
            other_entity = case.entities.get(other_id)
            other_name = other_entity.name if other_entity else other_id

            if r.evidence_id:
                supporting_ev_ids.add(r.evidence_id)
            for ev_ref in r.evidence:
                if ev_ref.startswith("EV-"):
                    supporting_ev_ids.add(ev_ref)

            rel_dict = {
                "id": r.id,
                "source": r.source,
                "source_name": entity.name if is_source else other_name,
                "relation_type": r.relation_type.value if hasattr(r.relation_type, "value") else str(r.relation_type),
                "target": r.target,
                "target_name": other_name if is_source else entity.name,
                "confidence": r.confidence,
                "confidence_label": r.confidence_label,
                "confidence_reasons": r.confidence_reasons,
                "occurrences": r.occurrences,
                "evidence_id": r.evidence_id or (r.evidence[0] if r.evidence else None),
                "validation_status": r.validation_status,
                "attributes": r.attributes,
                "evidentiary_sufficiency": r.evidentiary_sufficiency,
            }
            incident_rels_out.append(rel_dict)

            # Timeline event compilation
            ts = r.attributes.get("timestamp") or r.attributes.get("date") or r.attributes.get("time") or "Observed in Case Stream"
            timeline_events.append({
                "timestamp": str(ts),
                "source": r.source,
                "source_name": entity.name if is_source else other_name,
                "relation_type": rel_dict["relation_type"],
                "target": r.target,
                "target_name": other_name if is_source else entity.name,
                "evidence_id": rel_dict["evidence_id"],
                "confidence": r.confidence,
                "description": f"{entity.name if is_source else other_name} {rel_dict['relation_type']} {other_name if is_source else entity.name}",
            })

    # Supporting Evidence Ledger
    supporting_evidence_objs = []
    for ev_id in supporting_ev_ids:
        if ev_id in case.evidence:
            supporting_evidence_objs.append(case.evidence[ev_id])

    # Network Position
    communities_connected = set()
    for nb_id in connected_entity_ids:
        if nb_id in communities_map:
            communities_connected.add(communities_map[nb_id])

    network_pos = {
        "degree_centrality": round(degree.get(entity_id, 0.0), 4),
        "betweenness_centrality": round(betweenness.get(entity_id, 0.0), 4),
        "direct_connections_count": len(connected_entity_ids),
        "relationships_count": len(incident_rels_out),
        "community_id": my_comm_info["community_id"],
        "community_name": my_comm_info["name"],
        "communities_connected_count": len(communities_connected),
    }

    # Heuristic Patterns involving this entity
    entity_patterns = []
    try:
        from app.patterns import detect_all_patterns
        all_pats = detect_all_patterns(G, case.relationships, case.entities)
        for p in all_pats:
            if entity_id in p.entities or any(entity.name in ev for ev in p.evidence):
                entity_patterns.append({
                    "type": p.type,
                    "severity": p.severity,
                    "entities": p.entities,
                    "evidence": p.evidence,
                    "why": getattr(p, "why", f"Detected {p.type} structural signature in network."),
                    "source_evidence": getattr(p, "source_evidence", []),
                })
    except Exception:
        pass

    # Investigator Notes attached to entity or general case
    entity_notes = [
        n for n in case.notes.values()
        if n.entity_id == entity_id or n.target_entity_id == entity_id
    ]

    # Lead Prioritization Score
    lead_score = compute_entity_lead_score(
        entity=entity,
        graph=G,
        relationships=case.relationships,
        evidence_registry=case.evidence,
        profile=profile,
        communities_map=communities_map,
        betweenness_dict=betweenness,
        degree_dict=degree,
    )

    record_audit(
        actor_name=current_user.name,
        action="deep_inspect_entity",
        details=f"Investigator inspected entity '{entity.name}' ({entity_id}) in case {case_id}",
        case_id=case_id,
        resource_id=entity_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )

    return DeepEntityInspectionResponse(
        entity=entity,
        network_position=network_pos,
        relationships=incident_rels_out,
        evidence=supporting_evidence_objs,
        timeline=timeline_events,
        communities=my_comm_info,
        patterns=entity_patterns,
        investigator_notes=entity_notes,
        investigation_lead=lead_score,
        investigation_profile={
            "id": profile.id,
            "name": profile.name,
            "description": profile.description,
            "important_entity_types": profile.important_entity_types,
            "important_relationship_types": profile.important_relationship_types,
        },
        disclaimer="This indicator supports investigative prioritization only. It is not a determination of guilt, criminality, or legal responsibility.",
    )


# -------------------------------------------------------------
# Entity Resolution & Deduplication Merge Endpoints
# -------------------------------------------------------------

@app.post("/api/cases/{case_id}/entities/merge")
def merge_duplicate_entities(
    case_id: str,
    req: EntityMergeRequest,
    current_user: UserProfile = Depends(require_role(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    """
    Safe & Traceable Entity Merge:
    - Merges source entity into target entity
    - Preserves all aliases, non-empty attributes, and evidence citations
    - Re-routes relationships without creating self-loops
    - Creates immutable EntityMergeDB audit record
    - Updates case timestamp independently
    """
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        merge_rec = case.merge_entities(
            source_entity_id=req.source_entity_id,
            target_entity_id=req.target_entity_id,
            reason=req.reason or "Investigator verified duplicate entity resolution",
            performed_by=current_user.name,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    record_audit(
        actor_name=current_user.name,
        action="merge_entities",
        details=f"Merged entity '{merge_rec.source_entity_name}' ({merge_rec.source_entity_id}) into '{merge_rec.target_entity_name}' ({merge_rec.target_entity_id}). Reason: {req.reason}",
        case_id=case_id,
        resource_id=merge_rec.merge_id,
        actor_id=current_user.user_id,
        actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    )

    return {
        "status": "ok",
        "message": f"Successfully merged {merge_rec.source_entity_name} into {merge_rec.target_entity_name}",
        "surviving_entity_id": merge_rec.target_entity_id,
        "removed_entity_id": merge_rec.source_entity_id,
        "merge_record": merge_rec,
    }


@app.get("/api/cases/{case_id}/merges", response_model=List[EntityMergeRecordOut])
def get_case_entity_merges(case_id: str, current_user: UserProfile = Depends(get_current_user)):
    """Retrieve full traceable merge history for entities in the specified case."""
    case = case_manager.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case.merges


# -------------------------------------------------------------
# Optional Static Frontend Mount
# -------------------------------------------------------------

_DIST_CANDIDATES = [
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
]
for _candidate in _DIST_CANDIDATES:
    if _candidate.exists() and (_candidate / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(_candidate), html=True), name="frontend")
        break
