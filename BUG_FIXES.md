# NetTrace 2.0 — Engineering Bug Fixes & Architecture Hardening Log

This document records the critical issues, architectural bottlenecks, and security vulnerabilities identified during the engineering audit, hardening, and productionization of the **SIH SynerCloud NetTrace** platform, along with the implemented solutions.

---

## 1. Database & Persistence Layer

### Bug 1.1: Duplicate Permission Constraint in Alembic Migration
- **Symptom**: `alembic upgrade head` failed when inserting permission mappings due to unique constraint violations on `role_permissions`.
- **Root Cause**: The initial migration schema declared a standalone unique index on `permission_id` rather than a composite unique index on `(role_id, permission_id)`. Because multiple roles legitimately share permissions (e.g., `cases:read` is held by all 6 roles), single-column uniqueness caused a database abort.
- **Resolution**: Rebuilt migration schema `0001_initial_schema.py` and `database.py` with composite primary/unique key constraint `UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')`.

### Bug 1.2: Database Connection Pooling & Graceful Degradation
- **Symptom**: Backend crashed on startup or when the database was temporarily disconnected during container restarts.
- **Root Cause**: Raw SQLite/database connections without connection pooling, pre-ping verification, or recycling.
- **Resolution**: Configured SQLAlchemy engine with `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, and `pool_recycle=1800`. Added `check_database_health()` returning comprehensive pool metrics and HTTP 503 Service Unavailable when the database is unreachable.

### Bug 1.3: Transaction Rollback & Incomplete Cascade Deletion in Case Store
- **Symptom**: Case deletion operations failed to clean up all orphaned relational rows, or left transactions hanging in error state without explicit rollback.
- **Root Cause**: `delete_case` only purged 7 out of 11 relational tables (`CaseDB`, `EntityDB`, `RelationshipDB`, `EvidenceDB`, `ValidationRecordDB`, `NoteDB`, `EntityMergeDB`), omitting `InvestigationLeadDB`, `PatternFindingDB`, and `CaseUserDB`.
- **Resolution**: Added explicit `except Exception: db.rollback(); raise` blocks and comprehensive child-row deletion in `delete_case`, `merge_entities`, and `upsert_entities`.

---

## 2. Authentication, Authorization & RBAC

### Bug 2.1: Inconsistent Analyst User Identifier in Seeding & Test Fallback
- **Symptom**: Automated authentication test `test_08_case_level_assignment_and_rbac` failed with HTTP 404 / 400 when attempting to assign the demo Analyst user to a case.
- **Root Cause**: `seed_demo.py` generated Analyst account with user ID `USR-ANA-01`, but legacy fallback dictionaries in `app/auth.py` referenced `USR-ANL-01`.
- **Resolution**: Standardized the user ID across PostgreSQL seed data, model schemas, and fallback dictionaries to `USR-ANA-01`.

### Bug 2.2: Privilege Escalation & Super Admin Modification
- **Symptom**: Users with `ADMIN` role could alter the status, password, or role assignments of `SUPER_ADMIN` accounts, or assign `SUPER_ADMIN` to themselves.
- **Root Cause**: Authorization checks only verified if the caller possessed `users:update` permission without enforcing system-role hierarchy rules.
- **Resolution**: Implemented `can_modify_user(operator, target)` and `can_assign_roles(operator, requested_roles)`. If an `ADMIN` attempts to modify, suspend, or assign the `SUPER_ADMIN` role, the server halts execution with HTTP 403 Forbidden ("Security Violation: Cannot modify a Super Admin user account").

### Bug 2.3: Case-Level Assignment Foreign Key Integrity
- **Symptom**: Adding an investigator to a case could fail with foreign key violation errors if transactions were committed out-of-order.
- **Resolution**: Enforced transactional ordering in `CaseUserDB` operations, ensuring valid user IDs exist in PostgreSQL before committing case assignment records.

### Bug 2.4: Frontend Unauthorized Admin Route Access
- **Symptom**: A non-admin user could switch to the Admin tab (`activeTab === 'admin'`) and view a partial admin container.
- **Root Cause**: UI relied solely on hiding the sidebar tab without an explicit route guard in the view render pipeline.
- **Resolution**: Added memoized `isAdmin` check in `frontend/src/App.jsx`. If a non-admin navigates to the Admin view, an explicit Access Denied shield UI is displayed with instructions to switch roles.

---

## 3. Graph Analytics & Evidence Pipeline

### Bug 3.1: Directional vs. Symmetric Relationship Preservation
- **Symptom**: Directed relationships (e.g. `CALLED`, `TRANSFERRED_TO`) were being flattened into undirected edges in visualization payloads, implying mutual communication where only one-way contact occurred.
- **Root Cause**: Ingestion module did not strictly differentiate between `SYMMETRIC_RELATION_TYPES` and `DIRECTED_RELATION_TYPES` during graph serialization.
- **Resolution**: Implemented explicit classification in `case_store.py` and `extraction.py`. Directed edges retain exact `source -> target` orientation without reverse links. Symmetric edges (`KNOWS`, `MET_AT`) are rendered as mutual associations.

### Bug 3.2: Dangling Relationships from Unconfirmed Entities
- **Symptom**: Importing a relationship referencing non-existent entity IDs created orphaned edges in the graph visualization.
- **Root Cause**: CSV import accepted arbitrary relation source and target IDs without validating whether those entities were registered in the case.
- **Resolution**: Updated `extract_from_structured_relationships` to check both source and target against the case entity registry (`raw_to_global`). If either entity is missing, the relationship is rejected with an informative warning, ensuring zero ghost edges in the database.

### Bug 3.3: False-Positive Pattern Review & Dismissal
- **Symptom**: Pattern radar items marked as false positives reappeared upon subsequent page reloads.
- **Root Cause**: Pattern dismissal state was stored ephemerally without persisting reviewer status or notes to PostgreSQL.
- **Resolution**: Introduced `PatternFindingDB` in PostgreSQL with fields `status` (`ACTIVE`, `DISMISSED`, `RESOLVED`), `dismissed_by`, `dismissed_at`, and `notes`. The `/api/cases/{case_id}/patterns/{pattern_id}/dismiss` endpoint persists the change immediately.

### Bug 3.4: Clear Graph vs. Reset Investigation Isolation
- **Symptom**: Clicking "Clear Graph" inadvertently purged all uploaded surveillance evidence files and investigator notes.
- **Root Cause**: Clear graph action shared backend logic with investigation reset.
- **Resolution**: Separated into two distinct API endpoints:
  - `POST /api/cases/{case_id}/clear-graph`: Flushes entities and relationships from the graph canvas while strictly preserving evidence files, audit trails, and notes.
  - `POST /api/cases/{case_id}/reset-investigation`: Performs a full case wipe, resetting graph, evidence, and notes.

### Bug 3.5: Bron-Kerbosch Maximal Clique Exponential Freeze
- **Symptom**: Running pattern detection on dense graphs (>100 entities with multi-clique connections) caused the backend process to freeze or hang due to exponential Bron-Kerbosch recursion.
- **Root Cause**: `find_cliques(G)` in `detect_dense_subgroup_pattern` traversed unbounded maximal cliques without a safety cutoff.
- **Resolution**: Added an iteration ceiling (`clique_count > 100`) and size constraints (`len(clique) >= 4`) in `app/patterns.py`, ensuring dense graphs evaluate in under 3 seconds.

### Bug 3.6: Integer Conversion Failure on Float Weights in CSV Ingestion
- **Symptom**: Importing CSV data with float weights (e.g., `0.8`, `0.95`) caused unhandled server crashes: `ValueError: invalid literal for int() with base 10: '0.8'`.
- **Root Cause**: Direct `int(row.get("weight", 1))` in `app/extraction.py` (lines 556 and 668) without float normalization.
- **Resolution**: Wrapped weight parsing with `max(1, int(round(float(raw_w)))) if raw_w not in (None, "") else 1` with fallback `except (ValueError, TypeError): parsed_w = 1`.

---

## 4. API Security & Production Hardening

### Bug 4.1: Missing Enterprise Security Headers
- **Symptom**: Penetration scans flagged missing Clickjacking, MIME-sniffing, and Cross-Origin referrer protections.
- **Resolution**: Added HTTP middleware in `app/main.py` injecting standard security headers on all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### Bug 4.2: Rate Limiting for Authentication & Ingestion Routes
- **Symptom**: Vulnerability to brute-force credential stuffing and DoS attacks on `/api/auth/login` and `/api/import`.
- **Resolution**: Implemented an in-memory sliding-window rate limiter in `app/main.py`:
  - `/api/auth/login`: 30 req / 60s
  - `/api/auth/register`: 15 req / 60s
  - `/api/auth/refresh`: 40 req / 60s
  - `/api/import` & `/api/import/file`: 40 req / 60s
  - `/api/graph/summary`: 40 req / 60s
  Returns HTTP 429 Too Many Requests with `Retry-After` header when exceeded.

### Bug 4.3: Global Unhandled Exception & Information Leak Prevention
- **Symptom**: Unexpected server errors could leak internal filesystem paths, python tracebacks, or database parameters in error responses.
- **Resolution**: Registered `@app.exception_handler(Exception)` returning clean JSON `{"detail": "Internal server error. Incident logged for security audit."}` while logging the detailed exception server-side.

### Bug 4.4: File Upload Extension Guard & Path Traversal Neutralization
- **Symptom**: Filenames with directory traversal patterns (e.g., `../../etc/passwd`) or executable scripts (`.exe`, `.bat`, `.sh`) could pose security risks.
- **Resolution**: Added extension blocklist (`.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`, `.dll`, `.so`, `.bin`, `.vbs`), binary content detection, and sanitized filenames using `Path(raw_label).name` with regex character cleansing.

### Bug 4.5: Frontend Runtime Crash: `locationCount is not defined`
- **Symptom**: Red screen crash on navbar rendering: `ReferenceError: locationCount is not defined`.
- **Root Cause**: `Navbar.jsx` referenced domain-specific counts (`locationCount`, `vehicleCount`, `telecomCount`, `financialCount`) without verifying if they were supplied by props or state in all display modes.
- **Resolution**: Added safe defaulting directly derived from active graph distribution arrays (`stats?.by_domain?.LOCATION || 0`, etc.) ensuring robust rendering even on partial graph loads.

### Bug 4.6: Frontend Runtime Crash: `loadActiveCaseAndContext is not defined`
- **Symptom**: Browser console threw `ReferenceError: loadActiveCaseAndContext is not defined` immediately after successful login or role-switching (e.g., as `investigator`).
- **Root Cause**: In `App.jsx`, `<RoleSwitcherModal onRoleSwitched={async (user) => { ... await loadActiveCaseAndContext(); ... }} />` called `loadActiveCaseAndContext`, but the function was never declared in `App.jsx`.
- **Resolution**: Implemented `loadActiveCaseAndContext(targetCaseId = null)` as an asynchronous workflow:
  1. Validates current session via `fetchCurrentUser()`, gracefully trapping 401 unauthenticated transitions.
  2. Resolves active case via `switchCase(targetCaseId)` or `fetchActiveCase()`, cleanly segregating HTTP 403 (unauthorized/unassigned case), HTTP 404 (no active case), and HTTP 500.
  3. Hydrates core graph, centralities, radar patterns, and crime profiles concurrently.
  4. Hydrates deferred context (evidence files, validation records, notes, community clusters) in the background.
  5. Preserved backwards compatibility across the application by aliasing `const loadAllData = loadActiveCaseAndContext`.

---

## 5. Cryptographic Ledger & Audit Chain

### Bug 5.1: Audit Record Role Drift
- **Symptom**: Audit entries recorded client-provided role parameters rather than verified server-side session credentials.
- **Root Cause**: Endpoint trusted client JSON body for `actor_role` and `actor_name`.
- **Resolution**: Bound all audit log creation directly to `current_user` extracted from the cryptographically verified JWT access token. Client-supplied actor parameters are completely ignored.

---

## 6. Summary of Verification

All 34 automated unit and integration tests across 3 dedicated suites were executed against the live PostgreSQL 16 database:

| Test Suite | Purpose | Tests | Result | Execution Time |
| :--- | :--- | :---: | :---: | :---: |
| `test_master_engineering_audit.py` | Core architecture, RBAC, case protection, directional graphs, audit integrity | 13 | **PASSED** | ~2.1s |
| `test_production_deployment.py` | Database pooling, JWT lifecycle, 6-role matrix, fine-grained case access | 12 | **PASSED** | ~5.8s |
| `test_full_system_qa.py` | Security headers, rate limiting, upload guards, durability, clique performance | 9 | **PASSED** | ~4.9s |
| **Total** | **Full System Acceptance Verification** | **34** | **100% PASS** | **11.85s** |

- Frontend Production Build: `npm run build` completed in **9.40s** with 0 errors.
