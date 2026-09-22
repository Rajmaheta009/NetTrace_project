# NetTrace 2.0 — Enterprise Criminal Network Intelligence & Syndicate Analysis

[![Python Version](https://img.shields.io/badge/python-3.11%20%7C%203.12%20%7C%203.14-blue.svg)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20v2-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Alembic](https://img.shields.io/badge/Alembic-Migrations-red.svg)](https://alembic.sqlalchemy.org/)
[![Security](https://img.shields.io/badge/Security-Bcrypt%20%2B%20JWT%20%2B%20SHA--256%20Chain-success.svg)](#security-authentication--rbac)
[![Test Suite](https://img.shields.io/badge/Tests-25%2F25%20Passing%20(100%25)-brightgreen.svg)](#automated-testing-suite)

**NetTrace 2.0** is an enterprise-grade investigative graph intelligence and crime syndicate analysis platform engineered for law enforcement agencies, cybercrime divisions, forensic analysts, and judicial review bodies. It bridges **deterministic mathematical graph theory** (NetworkX MultiDiGraph) with **bounded Large Language Model intelligence** (Groq / Llama 3.3 70B), an interactive **3D Tactical Force-Directed Graph visualizer**, **PostgreSQL 16 relational persistence**, and a **tamper-evident cryptographic audit ledger**.

---

## 🔑 Judge-Ready Demo Credentials

The platform is seeded with 6 production accounts reflecting the complete 6-tier role hierarchy:

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| `superadmin` | `SuperAdmin123!` | `SUPER_ADMIN` | Full administrative control, role assignment, and audit ledger inspection. |
| `admin` | `Admin123!` | `ADMIN` | System administrator. Manages standard users and cases (protected by hierarchy). |
| `investigator`| `Investigator123!` | `INVESTIGATOR`| Lead case officer. Manages cases, imports evidence, authors notes, validates leads. |
| `analyst` | `Analyst123!` | `ANALYST` | Intelligence analyst. Inspects graphs, drafts field notes, reviews connections. |
| `reviewer` | `Reviewer123!` | `REVIEWER` | QA officer. Validates unconfirmed extractions in the Review Queue. |
| `viewer` | `Viewer123!` | `VIEWER` | Read-only judicial auditor. Inspects active cases without editing privileges. |

*All passwords are encrypted using `bcrypt` with automatic salting.*

---

## 🚀 Quickstart Guide

### Option A: Docker Compose Deployment (Recommended)

To run the complete production topology (PostgreSQL 16 + FastAPI Backend + React Nginx Frontend):

```bash
docker compose up --build -d
```

- **Frontend Application**: `http://localhost:80`
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`
- **Database**: PostgreSQL 16 on `localhost:5432`

---

### Option B: Local Native Setup (Step-by-Step)

#### 1. PostgreSQL Database
Ensure PostgreSQL 16 is running on `localhost:5432` with database `nettrace`:
```sql
CREATE DATABASE nettrace;
```

#### 2. Backend Service (FastAPI)
```bash
cd V2

# Install dependencies
pip install -r requirements.txt

# Run database migrations (20 tables)
alembic upgrade head

# Seed demo users, roles, 43 permissions, and default case
python scripts/seed_demo.py

# Start application server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Frontend Service (React 18 + Vite)
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Or build for production: npm run build
```
Frontend URL: `http://localhost:5173`

---

## 🛡️ Security, Authentication & RBAC

NetTrace implements defense-in-depth security engineered for judicial and forensic compliance:

1. **Dual-Token Authentication**:
   - Short-lived **JWT Access Tokens** (8 hours, HS256) for stateless, fast API authorization.
   - Database-backed **Refresh Tokens** (7 days) persisted in `refresh_tokens` table. Calling `/api/auth/logout` immediately revokes tokens.
2. **6 System Roles & 43 Granular Permissions**:
   - Enforced server-side via FastAPI dependency injection (`require_role`, `require_permission`, `require_case_access`).
   - Frontend UI dynamically adapts based on permissions (tabs, buttons, editing capabilities).
3. **Role Hierarchy Protections**:
   - Administrators cannot modify, suspend, or alter Super Admin accounts.
   - Administrators cannot assign Super Admin roles to themselves or others.
4. **Multi-Case Confidentiality (`case_users`)**:
   - Case assignments (`LEAD`, `CONTRIBUTOR`, `VIEWER`) restrict case visibility to authorized personnel.
5. **Cryptographic SHA-256 Audit Ledger**:
   - All investigator actions are chained via SHA-256 block hashing (`prev_hash`).
   - Tamper-evident ledger verification via `GET /api/audit/integrity`.
6. **Evidence Provenance & Lineage**:
   - Ingested files receive immutable SHA-256 checksums.
   - Graph links retain citations to raw source files and evidence IDs.

For complete security details, see [SECURITY.md](file:///D:/SIH_SynerCloud_NetTrace/SIH_SynerCloud_NetTrace-20260913T171153Z-1-001/SECURITY.md).

---

## 📊 Core Capabilities

### 1. Interactive 3D Tactical Graph Visualizer
- **3D Orbit & Force-Directed Layout**: Smooth Three.js rendering of complex syndicate networks.
- **Directional vs. Symmetric Relationships**: Directional links (`CALLED`, `TRANSFERRED_TO`) render strictly from source to target without fictitious reverse edges. Symmetric links (`KNOWS`, `MET_AT`) render mutual associations.
- **Tactical Zoom HUD**: Integrated zoom controls (`+`, `-`, `100%`) with event interception preventing page scrolling.
- **Double-Click Dossier Drawer**: Instant centering and forensic breakdown with 1-hop associate listings.

### 2. Algorithmic Graph Intelligence (Deterministic)
- **Centrality Ranking**: Degree centrality (operational hubs) and betweenness centrality (strategic cut-points / key brokers).
- **Community Detection**: Modularity-based clustering identifying sub-syndicates and operational cells.
- **Shortest Connection Paths**: Deterministic Dijkstra routing between suspects.
- **Pattern Radar**: Algorithmic detection of Shared Infrastructure (burner phones/vehicles), Dense Cliques, and Co-occurrences. Includes human reviewer dismissal of false positives with rationale logging.

### 3. Human-in-the-Loop Validation Queue
- Low-confidence or unconfirmed extractions are isolated in the Validation Center.
- Reviewers can Accept, Reject, or Correct extractions before inclusion in the primary case graph.

### 4. Enterprise Administration Panel
- Available exclusively to `ADMIN` and `SUPER_ADMIN` users.
- **User Management**: Create users, update statuses (Active/Suspended), and assign system roles.
- **Roles & Permissions Matrix**: Live interactive matrix of 6 roles and 43 permissions.
- **Cryptographic Audit Ledger**: Real-time inspection of chained SHA-256 audit blocks.
- **Database & Connection Pool Health**: Live telemetry of PostgreSQL pool size, checked-in/out connections, and dialect status.

---

## 🩺 Health Check & Diagnostic Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | `GET` | Core application liveness probe. |
| `/health/db` | `GET` | PostgreSQL readiness & connection pool telemetry (returns HTTP 503 if DB down). |
| `/api/health/db` | `GET` | API alias for database health check. |
| `/api/audit/integrity` | `GET` | Cryptographic SHA-256 ledger integrity verification. |

---

## 🧪 Automated Testing Suite

NetTrace includes 25 comprehensive automated tests verifying all deployment, authentication, graph analytics, and security features:

```bash
cd V2

# 1. Production Deployment & RBAC Test Suite (12 tests)
python testing/test_production_deployment.py

# 2. Master Engineering Audit Test Suite (13 tests)
python testing/test_master_engineering_audit.py
```

### Test Coverage Summary:
- ✅ Database health probe and connection pool telemetry.
- ✅ Bcrypt password verification and JWT access/refresh token cycle.
- ✅ Token revocation upon explicit logout.
- ✅ Role-based access control (Admin, Investigator, Analyst, Reviewer, Viewer).
- ✅ System-role hierarchy protections (Admin cannot modify or assign Super Admin).
- ✅ Case-level authorization and user assignments (`case_users`).
- ✅ Multi-case data isolation and default case (`case-001`) preservation.
- ✅ Directional vs. symmetric relationship integrity (`CALLED` vs `KNOWS`).
- ✅ False-positive pattern review and dismissal persistence.
- ✅ Safe traceable entity merge preserving alias history.
- ✅ Evidence provenance and SHA-256 chain of custody verification.
- ✅ Cryptographic SHA-256 audit ledger verification.

**Result**: **25/25 Tests Passing (100% OK)**.
**Frontend Production Build**: **Passed in 7.92s (0 errors)**.

---

## 📚 Technical Documentation Index

- [ARCHITECTURE.md](file:///D:/SIH_SynerCloud_NetTrace/SIH_SynerCloud_NetTrace-20260913T171153Z-1-001/ARCHITECTURE.md): Full system architecture, subsystem specifications, and component layout.
- [DEPLOYMENT.md](file:///D:/SIH_SynerCloud_NetTrace/SIH_SynerCloud_NetTrace-20260913T171153Z-1-001/DEPLOYMENT.md): Detailed local native and Docker Compose deployment instructions.
- [SECURITY.md](file:///D:/SIH_SynerCloud_NetTrace/SIH_SynerCloud_NetTrace-20260913T171153Z-1-001/SECURITY.md): RBAC model, 43 granular permissions matrix, and cryptographic ledger specification.
- [BUG_FIXES.md](file:///D:/SIH_SynerCloud_NetTrace/SIH_SynerCloud_NetTrace-20260913T171153Z-1-001/BUG_FIXES.md): Log of all resolved issues, root causes, and architectural hardening changes.
