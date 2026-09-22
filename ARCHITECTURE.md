# NetTrace 2.0 — Architecture & Technical Design

## 1. System Overview
**SIH SynerCloud NetTrace 2.0** is an enterprise-grade digital investigation and criminal intelligence platform engineered for law enforcement agencies, cybercrime task forces, forensic analysts, and judicial review bodies. It combines **deterministic mathematical graph analytics** (NetworkX MultiDiGraph), **AI-assisted entity extraction** (Groq / Llama 3.3 70B), **multi-modal evidence lineage**, and a **PostgreSQL 16 relational core** with **tamper-evident cryptographic audit chaining**.

---

## 2. Architectural Principles

1. **Deterministic AI Boundary**:
   - AI (Groq / Llama 3.3 70B) is strictly restricted to semi-structured/unstructured entity extraction and neutral intelligence briefings.
   - AI **never** calculates network centrality, detects community partitions, computes shortest path connections, or assigns legal guilt.
2. **Deterministic Graph Analytics**:
   - All network metrics (degree centrality, betweenness centrality, Louvain/modularity clustering, Dijkstra shortest paths, pattern heuristics) are executed using deterministic Python algorithms and NetworkX `MultiDiGraph`.
3. **Relational Persistence with PostgreSQL 16 & Alembic**:
   - All entities, relationships, cases, evidence files, audit logs, users, roles, permissions, and refresh tokens are stored in PostgreSQL 16.
   - Managed schema evolution via Alembic migrations (`alembic upgrade head`).
4. **Strict Role-Based Access Control (RBAC) & Hierarchy Protection**:
   - 6 canonical system roles (`SUPER_ADMIN`, `ADMIN`, `INVESTIGATOR`, `ANALYST`, `REVIEWER`, `VIEWER`) and 43 granular permissions.
   - System-role hierarchy protections prevent Administrators from modifying or demoting Super Admins.
   - Case-level authorization (`case_users`) isolates sensitive investigation cases among authorized personnel.
5. **Cryptographic Chain of Custody**:
   - Every ingested surveillance file is hashed with SHA-256 upon arrival.
   - Audit logs are chained together using previous-hash references, forming an immutable, tamper-evident ledger verified via `/api/audit/integrity`.
6. **Human-in-the-Loop Validation**:
   - Low-confidence or unconfirmed extractions are quarantined in the Data Quality Review Queue for human validation (Accept, Reject, Correct).

---

## 3. High-Level Subsystem Layout

```
                         ┌──────────────────────────────────────────────┐
                         │           React 18 + Vite Frontend           │
                         │  (3D Graph, Administration, Validation HUD)  │
                         └──────────────────────┬───────────────────────┘
                                                │ HTTPS / REST (JSON)
                                                ▼
                         ┌──────────────────────────────────────────────┐
                         │             FastAPI Backend (V2)             │
                         ├──────────────────────────────────────────────┤
                         │  [Auth & RBAC Middleware]                    │
                         │    ├── Bcrypt Password Verification          │
                         │    ├── JWT Access Tokens (8h, HS256)         │
                         │    └── Database-Backed Refresh Tokens (7d)   │
                         │                                              │
                         │  [Core Business Logic Engines]               │
                         │    ├── CaseManager (Multi-Case Isolation)    │
                         │    ├── Ingestion & Classifier Pipeline       │
                         │    ├── Graph Analytics (NetworkX MultiDiGraph│
                         │    ├── Human Validation Queue                │
                         │    ├── Cryptographic Audit Chainer (SHA-256) │
                         │    └── AI Boundary Gateway (Groq / Llama)    │
                         └──────────────────────┬───────────────────────┘
                                                │ SQLAlchemy (Pooled)
                                                ▼
                         ┌──────────────────────────────────────────────┐
                         │          PostgreSQL 16 Relational DB         │
                         ├──────────────────────────────────────────────┤
                         │  • users               • roles               │
                         │  • user_roles          • permissions         │
                         │  • role_permissions   • refresh_tokens      │
                         │  • cases               • case_users          │
                         │  • evidence            • entities            │
                         │  • relationships       • notes               │
                         │  • audit_logs          • pattern_findings    │
                         │  • entity_merges       • validation_records  │
                         └──────────────────────────────────────────────┘
```

---

## 4. Subsystem Specifications

### 4.1 Ingestion & Classification Pipeline
- **Auto-Detection**: `classify_and_normalize()` triages incoming streams into Structured, Semi-Structured, or Unstructured buckets.
- **MIME & DoS Guardrails**: Enforces 10 MB upload limits and inspects magic bytes to reject executable and binary payloads.
- **Provenance Registration**: Every import registers an `EvidenceDB` record with SHA-256 checksum, raw byte length, source label, and ingestion timestamp.

### 4.2 Graph Store & Case Isolation (`case_store.py`)
- **NetworkX MultiDiGraph**: Each active case maintains its dedicated in-memory and database-synchronized graph instance.
- **Directional vs. Symmetric Relationships**:
  - Directional types (`CALLED`, `TRANSFERRED_TO`, `OWNS_VEHICLE`, `SENT_TO`) preserve exact directed orientation (`source -> target`). Reverse edges are never fabricated.
  - Symmetric types (`KNOWS`, `MET_AT`, `ASSOCIATED_WITH`) create bidirectional associations.
- **Entity Resolution**: Canonical deduplication merges aliases, telephone numbers, and cross-source attributes while maintaining complete lineage records.

### 4.3 Deterministic Graph Intelligence Engine
- **Centrality Metrics** (`analytics.py`): Computes degree centrality (operational connectivity) and betweenness centrality (strategic broker / cut-point scoring).
- **Community Detection** (`community_detector.py`): Modularity-based partition clustering identifying sub-syndicates and isolated operational cells.
- **Connection Paths** (`path_finder.py`): Deterministic Dijkstra shortest paths and hop-bounded traversal between suspect nodes.
- **Pattern Radar** (`patterns.py`): Heuristic detection for Key Brokers, Dense Cliques, Shared Burner Devices, and Cross-Event Co-occurrences. Reviewers can flag false positives with review notes.

### 4.4 Authentication, RBAC & Case Security (`auth.py`)
- **Password Security**: Bcrypt with automatic salt rounds.
- **Dual-Token Scheme**:
  - JWT Access Tokens (8h lifespan) containing user identity, role, and expiration.
  - Database-backed Refresh Tokens (7d lifespan) stored in `RefreshTokenDB`. Explicit logout revokes tokens immediately.
- **6-Role Authorization Matrix**: `SUPER_ADMIN`, `ADMIN`, `INVESTIGATOR`, `ANALYST`, `REVIEWER`, `VIEWER` with 43 granular permissions.
- **System Role Hierarchy**: Enforces rules preventing lower-tier administrators from modifying, suspending, or granting `SUPER_ADMIN` privileges.
- **Case-Level Access Control**: Confidential investigations require explicit case assignments via `case_users` (`LEAD`, `CONTRIBUTOR`, `VIEWER`).

### 4.5 Cryptographic Audit Chaining (`audit_logger.py`)
- Every sensitive action (`login`, `import_data`, `merge_entities`, `pattern_dismiss`, `clear_graph`) creates an immutable record in `AuditLogDB`.
- Records are linked via SHA-256 hashes (`current_hash = SHA256(prev_hash + entry_id + timestamp + actor + action + details)`).
- Integrity endpoint (`GET /api/audit/integrity`) provides real-time verification of ledger continuity and detects unauthorized manual modifications.

---

## 5. Deployment Architecture

```
[Internet / LAN]
       │
       ▼ Port 80
┌─────────────────────────────────────────────────────────────┐
│ Nginx Reverse Proxy (Frontend Container)                     │
│   ├── Serves React 18 Production Bundle (Gzip, SPA history) │
│   ├── /api/*   ──> Proxy Pass to Backend:8000               │
│   └── /health* ──> Proxy Pass to Backend:8000               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ Port 8000
┌─────────────────────────────────────────────────────────────┐
│ FastAPI Application Server (Backend Container)              │
│   ├── Multi-worker Uvicorn                                  │
│   ├── Built-in Liveness & Database Readiness Probes         │
│   └── Python 3.11-slim runtime                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ Port 5432
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL 16 Database Server (nettrace-db Container)        │
│   ├── Persistent Named Volume (pgdata)                      │
│   ├── Managed Schema (Alembic)                              │
│   └── SQLAlchemy Connection Pool (10 base + 20 overflow)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Neutral Forensic Terminology Standards

To uphold judicial objectivity and ethical AI standards, the platform strictly uses non-prejudicial terminology:
- High degree nodes: **Priority Entities** / **Primary Communicators** (not "Kingpins").
- High betweenness nodes: **Key Brokers** / **Cut-Points** (not "Criminal Masterminds").
- Subgroups: **Operational Cells** / **Network Clusters** (not "Gangs").
- Pattern findings: **Heuristic Leads** / **Investigative Inferences** (not "Proof of Guilt").
