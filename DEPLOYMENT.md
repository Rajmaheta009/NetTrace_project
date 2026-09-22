# NetTrace 2.0 — Production Deployment & Operations Manual

This guide covers local native deployment, Docker Compose containerized deployment, database migration procedures, health monitoring, and environment configuration for the **SIH SynerCloud NetTrace** platform.

---

## 1. System Requirements & Architecture Overview

| Component | Minimum Requirement | Production Recommended |
|-----------|-------------------|------------------------|
| **Operating System** | Linux (Ubuntu 22.04+), macOS 13+, Windows 10/11 | Linux (Ubuntu 22.04 LTS / Debian 12) |
| **Python** | Python 3.11.x | Python 3.11 or 3.12 |
| **PostgreSQL** | PostgreSQL 15+ | PostgreSQL 16.x with connection pooling |
| **Node.js** | Node.js 18.x LTS | Node.js 20.x LTS + npm 10+ |
| **Docker** | Docker Engine 24.0+ | Docker Engine 26.x + Docker Compose v2 |
| **Memory / RAM** | 4 GB | 8 GB - 16 GB |
| **Disk Space** | 5 GB available storage | 20 GB+ SSD storage |

---

## 2. Local Native Deployment (Step-by-Step)

### Step 2.1: PostgreSQL 16 Setup
1. Ensure PostgreSQL 16 is installed and running on `localhost:5432`.
2. Create the target database:
   ```sql
   CREATE DATABASE nettrace;
   ```
3. Verify connection credentials:
   - Host: `localhost`
   - Port: `5432`
   - Database: `nettrace`
   - Username: `postgres`
   - Password: `postgres` (or as configured in `.env`)

### Step 2.2: Backend Service (FastAPI)
1. Navigate to the backend directory:
   ```bash
   cd V2
   ```
2. Create and activate a Python virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```
3. Install required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Confirm `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nettrace`.
5. Run Alembic database migrations:
   ```bash
   alembic upgrade head
   ```
   *This initializes all 20 relational database tables.*
6. Seed default system roles, granular permissions, demo accounts, and sample investigation cases:
   ```bash
   python scripts/seed_demo.py
   ```
7. Start the backend application server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Backend Swagger UI: `http://localhost:8000/docs`

### Step 2.3: Frontend Application (React + Vite)
1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Frontend App: `http://localhost:5173`

4. For production static build:
   ```bash
   npm run build
   ```
   *Artifacts are emitted to `frontend/dist/`.*

---

## 3. Containerized Deployment (Docker Compose)

The repository provides a complete production-grade containerization suite:
- `V2/Dockerfile`: Multi-stage Python 3.11-slim container with multi-worker Uvicorn and built-in health check.
- `frontend/Dockerfile`: Multi-stage Node.js 20 build + Nginx Alpine reverse proxy.
- `frontend/nginx.conf`: Production Nginx configuration with gzip compression, SPA history fallback, and reverse proxy routing `/api` and `/health` to backend.
- `docker-compose.yml`: Multi-container topology orchestrating PostgreSQL 16, backend, and frontend with shared internal network and persistent storage volumes.

### Step 3.1: Start All Services
From the project root:
```bash
docker compose up --build -d
```

### Step 3.2: Verify Container Status
```bash
docker compose ps
```
Expected output:
```text
NAME                 IMAGE                     STATUS                    PORTS
nettrace-db          postgres:16-alpine        Up (healthy)              0.0.0.0:5432->5432/tcp
nettrace-backend     nettrace-backend:latest   Up (healthy)              0.0.0.0:8000->8000/tcp
nettrace-frontend    nettrace-frontend:latest  Up (healthy)              0.0.0.0:80->80/tcp
```

### Step 3.3: Database Migrations & Seeding in Docker
When starting fresh containers, the backend automatically runs `alembic upgrade head` and `seed_demo.py` via entrypoint, or you can trigger them manually:
```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed_demo.py
```

### Step 3.4: Teardown & Maintenance
- Stop services:
  ```bash
  docker compose down
  ```
- Stop services and remove persistent volume data (complete clean slate):
  ```bash
  docker compose down -v
  ```

---

## 4. Health Check & Diagnostic Endpoints

The system exposes zero-dependency health monitoring endpoints for load balancers (Kubernetes, AWS ALB, Nginx):

| Endpoint | Method | Purpose | Response Sample |
|----------|--------|---------|-----------------|
| `/health` | `GET` | Core application liveness probe | `{"status": "ok", "app": "NetTrace V2", "version": "2.0.0", "ai_enabled": true}` |
| `/api/health` | `GET` | API alias for application liveness | `{"status": "ok", "app": "NetTrace V2", "version": "2.0.0"}` |
| `/health/db` | `GET` | PostgreSQL connection & pool readiness probe | `{"status": "healthy", "dialect": "postgresql", "pool_size": 10, "checked_in": 10, "checked_out": 0}` |
| `/api/health/db` | `GET` | API alias for database readiness | `{"status": "healthy", "dialect": "postgresql", ...}` |
| `/api/audit/integrity` | `GET` | Cryptographic SHA-256 chain verification | `{"chain_intact": true, "records_evaluated": 15, "broken_links": 0}` |

*If PostgreSQL is unreachable, `/health/db` responds with HTTP 503 Service Unavailable.*

---

## 5. Environment Variables Reference

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/nettrace` | PostgreSQL connection URI |
| `DB_POOL_SIZE` | `10` | SQLAlchemy connection pool size |
| `DB_MAX_OVERFLOW` | `20` | Max overflow connections beyond pool size |
| `DB_POOL_RECYCLE` | `1800` | Connection recycling timeout in seconds |
| `JWT_SECRET_KEY` | *(Set strong random secret in production)* | 256-bit secret key for HMAC-SHA256 JWT signing |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Access token lifespan (8 hours) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifespan (7 days) |
| `GROQ_API_KEY` | *(Optional Groq API key)* | LLM extraction and briefing acceleration |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | LLM model identifier |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:80` | Allowed CORS origins (comma-separated) |
| `MAX_UPLOAD_BYTES` | `10485760` | Maximum file import payload size (10 MB) |

---

## 6. Automated Testing & Verification

Execute the complete 25-test verification suite:

```bash
cd V2

# 1. Production Deployment Test Suite (12 tests)
python testing/test_production_deployment.py

# 2. Master Engineering Audit Test Suite (13 tests)
python testing/test_master_engineering_audit.py
```

Result: **25/25 Tests Passing (100% OK)**.
