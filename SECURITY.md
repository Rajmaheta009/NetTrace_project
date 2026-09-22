# NetTrace 2.0 — Security & Access Control Architecture

This document specifies the security controls, cryptographic primitives, role-based access control (RBAC) model, system role hierarchies, and forensic audit protections implemented in the **SIH SynerCloud NetTrace** platform.

---

## 1. Authentication Architecture

NetTrace enforces a dual-token authentication scheme utilizing industry-standard cryptographic primitives:

```
[User Login] ──> Bcrypt Verify ──> Access Token (JWT, 8 Hours)
                               └──> Refresh Token (Opaque UUID, 7 Days, Stored in DB)

[API Call]   ──> Bearer Access Token ──> Verified Server-Side (HS256)
[Token Exp]  ──> POST /api/auth/refresh ──> Validated in RefreshTokenDB ──> New Access Token
[Logout]     ──> POST /api/auth/logout ──> Revoked in DB (revoked = true)
```

### 1.1 Password Hashing
- **Algorithm**: `bcrypt` (adaptive key derivation with automatic salt generation).
- Plaintext passwords are never stored, logged, or serialized into responses.

### 1.2 Access Tokens
- **Format**: JSON Web Token (JWT) signed using `HS256` with a server-managed 256-bit secret key (`JWT_SECRET_KEY`).
- **Lifespan**: 480 minutes (8 hours) by default (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Payload**: Contains subject (`sub`), user ID (`uid`), username (`username`), system role (`role`), and expiration timestamp (`exp`).

### 1.3 Revocable Database-Backed Refresh Tokens
- **Format**: High-entropy opaque UUID strings.
- **Lifespan**: 7 days (`REFRESH_TOKEN_EXPIRE_DAYS`).
- **Storage**: Persisted in PostgreSQL table `refresh_tokens`.
- **Revocation**: Explicit logout immediately marks the token record as `revoked = true`. Subsequent refresh attempts with a revoked token are rejected with HTTP 401 Unauthorized.

---

## 2. Role-Based Access Control (RBAC)

NetTrace implements a strict 6-tier role model with 43 granular permissions enforced server-side on every FastAPI endpoint.

### 2.1 The 6 System Roles

| System Role | Code | Scope & Description |
|-------------|------|---------------------|
| **Super Admin** | `SUPER_ADMIN` | Top-tier authority. Full administration, role assignment, audit inspection, and user lifecycle control. Cannot be modified or deactivated by lower roles. |
| **Administrator** | `ADMIN` | System administrator. Manages standard users, system roles, and operational parameters. Protected by hierarchy checks. |
| **Investigator** | `INVESTIGATOR` | Sworn case officer / primary investigator. Manages cases, registers surveillance evidence, initiates imports, generates leads, author notes. |
| **Analyst** | `ANALYST` | Intelligence analyst. Inspects networks, executes graph queries, drafts field notes, views leads. Cannot delete cases or alter system configuration. |
| **Reviewer** | `REVIEWER` | Quality assurance officer. Validates unconfirmed extractions in the Data Quality Review Queue (Accept, Reject, Correct). |
| **Viewer** | `VIEWER` | Read-only auditor or judicial observer. Can inspect permitted cases and visualizations. Cannot modify, create, or import data. |

### 2.2 System Role Hierarchy Protections

To prevent privilege escalation and unauthorized administrative lockouts:
1. **Super Admin Immutability**: An `ADMIN` cannot modify, update the status of, or suspend a `SUPER_ADMIN`. Attempts return HTTP 403 Forbidden.
2. **Super Admin Assignment Restriction**: An `ADMIN` cannot assign the `SUPER_ADMIN` role to themselves or any other user. Only existing `SUPER_ADMIN` users can grant Super Admin privileges.
3. **Self-Demotion / Self-Deactivation Prevention**: System administrators cannot deactivate their own active accounts.

### 2.3 Granular Permissions Matrix (43 Permissions)

```
========================================================================================
Permission Category         Permission Name               Roles With Permission
========================================================================================
Case Management             cases:read                    SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            cases:create                  SUPER_ADMIN, ADMIN, INVESTIGATOR
                            cases:update                  SUPER_ADMIN, ADMIN, INVESTIGATOR
                            cases:delete                  SUPER_ADMIN, ADMIN
                            cases:assign_users            SUPER_ADMIN, ADMIN, INVESTIGATOR
                            cases:close                   SUPER_ADMIN, ADMIN, INVESTIGATOR
----------------------------------------------------------------------------------------
Data Ingestion & Evidence   evidence:read                 SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            evidence:create               SUPER_ADMIN, ADMIN, INVESTIGATOR
                            evidence:delete               SUPER_ADMIN, ADMIN
                            evidence:verify_hash          SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            import:structured             SUPER_ADMIN, ADMIN, INVESTIGATOR
                            import:unstructured           SUPER_ADMIN, ADMIN, INVESTIGATOR
----------------------------------------------------------------------------------------
Graph & Intelligence        graph:read                    SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            graph:edit                    SUPER_ADMIN, ADMIN, INVESTIGATOR
                            graph:clear                   SUPER_ADMIN, ADMIN
                            analytics:centrality          SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            analytics:communities         SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            analytics:paths               SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            patterns:detect               SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            patterns:dismiss              SUPER_ADMIN, ADMIN, INVESTIGATOR, REVIEWER
----------------------------------------------------------------------------------------
Human Validation            validation:read               SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            validation:review             SUPER_ADMIN, ADMIN, INVESTIGATOR, REVIEWER
                            validation:correct            SUPER_ADMIN, ADMIN, INVESTIGATOR, REVIEWER
                            entity:merge                  SUPER_ADMIN, ADMIN, INVESTIGATOR
----------------------------------------------------------------------------------------
Investigation Workflows     notes:read                    SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            notes:create                  SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST
                            notes:delete                  SUPER_ADMIN, ADMIN, INVESTIGATOR
                            leads:read                    SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            leads:generate                SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST
                            dossier:generate              SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
----------------------------------------------------------------------------------------
System Administration       users:read                    SUPER_ADMIN, ADMIN
                            users:create                  SUPER_ADMIN, ADMIN
                            users:update                  SUPER_ADMIN, ADMIN
                            users:delete                  SUPER_ADMIN, ADMIN
                            users:manage_roles            SUPER_ADMIN, ADMIN
                            audit:read                    SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            audit:verify                  SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
                            system:health                 SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER
========================================================================================
```

---

## 3. Case-Level Authorization (`case_users`)

In addition to system-wide roles, multi-tenant case confidentiality is enforced via the `case_users` table:
- Case Roles: `LEAD`, `CONTRIBUTOR`, `VIEWER`.
- System administrators and Super Admins have global visibility.
- Operational users (`INVESTIGATOR`, `ANALYST`, `REVIEWER`, `VIEWER`) can only access cases to which they are explicitly assigned.
- Endpoints enforce access server-side via `require_case_access()`:
  ```python
  @app.get("/api/cases/{case_id}", response_model=Case)
  def get_case(case_id: str, current_user: UserProfile = Depends(require_case_access("cases:read"))):
      ...
  ```

---

## 4. Cryptographic Audit Logging & Chain of Custody

NetTrace maintains an immutable, tamper-evident cryptographic audit ledger (`audit_logs` table):

### 4.1 SHA-256 Ledger Chaining
Each audit log entry contains:
- `entry_id`: Monotonically increasing sequence ID.
- `timestamp`: UTC ISO timestamp.
- `actor_id` & `actor_name`: Identity of the performing user.
- `actor_role`: System role of the user at the moment of action.
- `action`: Canonical event verb (`login`, `import_data`, `merge_entities`, `pattern_dismiss`).
- `details`: Human-readable and machine-parseable context.
- `prev_hash`: SHA-256 hash of the previous log record.
- `hash`: Current SHA-256 hash computed across `(entry_id, timestamp, actor_id, action, details, prev_hash)`.

### 4.2 Automated Tamper Detection
Calling `GET /api/audit/integrity` iterates over the entire ledger from genesis:
```json
{
  "chain_intact": true,
  "records_evaluated": 15,
  "broken_links": 0,
  "last_valid_hash": "a4f891b0c...",
  "verified_at": "2026-09-19T15:35:00Z"
}
```
Any manual database alteration, row deletion, or retroactive edit invalidates downstream hashes, returning `chain_intact: false` and highlighting the corrupted record index.

---

## 5. Evidence Lineage & Provenance

To satisfy legal evidentiary standards:
- Every uploaded document or stream receives a raw SHA-256 checksum stored in the `evidence` table.
- Entities extracted from files retain `evidence_id`, `source_file`, and `source_record`.
- Relationship edges (`relationships` table) preserve direct citations to their supporting evidence.
- Investigating officers can inspect `/api/cases/{case_id}/relationships/{relationship_id}/lineage` to trace any network link back to raw surveillance records.

---

## 6. Deterministic AI Boundary

1. **Extraction Only**: Large Language Models (Groq / Llama 3.3 70B) are strictly utilized for natural language entity extraction and bounded, neutral briefings.
2. **Deterministic Graph Analytics**: Network metrics (degree centrality, betweenness centrality, community clustering, pathfinding) are computed exclusively by deterministic Python algorithms and NetworkX `MultiDiGraph`.
3. **No Automated Guilt Attribution**: The system explicitly avoids accusatory terminology ("kingpin", "mastermind"). All entities are labeled neutrally ("Priority Entity", "High Centrality Actor", "Bridge").
