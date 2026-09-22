# NetTrace 2.0 — Comprehensive System QA Inventory & Architecture Audit

**Project:** SIH SynerCloud — NetTrace  
**Audit Date:** 2026-09-19  
**Scope:** Full repository audit across Frontend, Backend, Database, Authentication, RBAC, Graph Analytics, Ingestion, Auditing, AI Boundaries, Deployment, and Security.

---

## 1. Frontend System Inventory

### 1.1 Core Bootstrap & Layout
- **`src/main.jsx`**: DOM mount point, initializes React 18 root, imports global styles (`index.css`).
- **`src/App.jsx`**: Top-level application state orchestrator. Manages active tab routing, 3-mode theme state (`midnight`, `dark`, `light`), active case context, authenticated user session, graph datasets, and drawer/modal overlays.
- **`src/index.css`**: Tailwind CSS utility classes, cyberpunk dark mode tokens, scrollbar styling, and canvas animations.
- **`src/components/ErrorBoundary.jsx`**: React component lifecycle error boundary preventing full whiteouts on unhandled view crashes.
- **`src/components/ViewLoadingSkeleton.jsx`**: Animated tactical loading skeleton rendered during lazy component suspense.

### 1.2 Navigation & Controls
- **`src/components/Navbar.jsx`**: Sticky header with system logo, active case selector pill, history shortcut, Spotlight search trigger (`Ctrl+K`), `+ Insert Data` CTA, graph reset modal, demo loader, live backend status indicator, 3-mode theme selector, and user role/login badge button.
- **`src/components/Sidebar.jsx`**: Collapsible sidebar navigation categorized into *Command & Core* (Overview, 3D Orbit, Evidence, Data Quality, Cases, Administration), *Forensic Analytics* (Communities, Connection Finder, Timeline, Patterns), *Entity Intelligence* (Financial, Telecom, Vehicles, Locations), and *Dossiers* (Field Notes, Intelligence Summary, Case Dossier). Shows dynamic badge counters for validation queue, evidence items, notes, and patterns.
- **`src/components/CommandHUD.jsx`**: Fast global search dialog (`Ctrl+K`) indexing all case entities, relationships, vehicles, and quick actions.

### 1.3 View Components (Pages & Tabs)
1. **`src/components/DashboardOverview.jsx`**: Tactical executive summary with metrics (Entities, Relationships, Conduits, Validation status), Priority Entities list, and suspicious pattern summaries.
2. **`src/components/GraphView.jsx`**: 3D interactive force-directed graph canvas (Three.js + HTML5 Canvas) featuring orbital rotation, zoom HUD (`+`, `-`, `100%`), passive scroll isolation, silent node drag-and-drop, and double-click entity inspection.
3. **`src/components/EvidenceView.jsx`**: Cryptographic evidence registry displaying ingested artifacts, SHA-256 integrity checksums, MIME types, parser versions, and raw file viewing.
4. **`src/components/ValidationCenter.jsx`**: Human-in-the-loop Data Quality Review Queue for low-confidence entity/relationship extractions with Accept, Reject, and Correct controls.
5. **`src/components/CommunitiesView.jsx`**: Modularity-based Louvain community cluster partitions and sub-syndicate decomposition.
6. **`src/components/ConnectionFinderView.jsx`**: Deterministic Dijkstra shortest path analyzer between any two entities in the active case.
7. **`src/components/TimelineView.jsx`**: Chronological event tracker with date normalization, event IDs, and source file citations.
8. **`src/components/PatternsRadar.jsx`**: Algorithmic suspicious pattern radar (Brokers, Shared Conduits, Dense Cliques, Co-occurrences) with false-positive review and dismissal.
9. **`src/components/FinancialView.jsx`**: Financial flow conduits, transaction volume analysis, and organization/account link graphs.
10. **`src/components/TelecomView.jsx`**: Telecommunications intelligence, call records, tower triangulation, and burner handset detection.
11. **`src/components/VehiclesView.jsx`**: Vehicle registration conduits, license plate cross-linkages, and suspect ownership links.
12. **`src/components/LocationsView.jsx`**: Geographic meeting points, safehouses, and crime scene co-location analysis.
13. **`src/components/NotesView.jsx`**: Structured field notes authored by investigators and analysts, linked to entities, relationships, or evidence.
14. **`src/components/SummaryView.jsx`**: Investigation briefing synthesis combining Groq LLM intelligence with deterministic fallback narrative generation.
15. **`src/components/ReportsView.jsx`**: Automated forensic case dossier compiler ready for judicial review and PDF/print export.
16. **`src/components/CasesView.jsx`**: Multi-case management console for creating, updating, assigning users to, closing, or archiving cases.
17. **`src/components/AdminPanel.jsx`**: Enterprise administrative console with 4 operational tabs: User Management, Roles & Permissions Matrix, Cryptographic Audit Ledger, and Database Pool Health.
18. **`src/components/IngestPanel.jsx`**: Multi-modal data ingestion wizard supporting structured CSV, JSON, raw text, and file uploads with automatic classification triage.

### 1.4 Modals & Forensic Drawers
- **`src/components/EntityDrawer.jsx`**: Slide-out forensic dossier with 1-hop neighbor graphs, attribute tables, and evidence citations.
- **`src/components/DeepEntityInspection.jsx`**: Full-screen modal for deep-dive investigation into a specific entity.
- **`src/components/CaseRoleModals.jsx`**:
  - `CaseSwitcherModal`: Modal to switch active case or create new cases.
  - `RoleSwitcherModal`: Modal for fast role switching and full JWT account login with demo credentials.
- **`src/components/HistoryRecordsModal.jsx`**: Investigation historical records inspector.
- **`src/components/CrimeTypeSelector.jsx`**: Selector for 11 specific crime matrix profiles.
- **`src/components/InvestigationQuestions.jsx`**: Dynamically tailored investigative questions based on active crime profile.

### 1.5 Frontend Services & Utilities
- **`src/services/api.js`**: Centralized HTTP client wrapping all backend endpoints with automatic Bearer token and `X-User-Role` injection.
- **`src/utils/colors.js`**: Consistent tactical color mapping for entity types, relationship types, and risk levels.
- **`src/utils/crimeInference.js`**: Client-side helpers for crime profile tagging.

---

## 2. Backend & API System Inventory (`V2`)

### 2.1 Core Services & Architecture
- **`app/main.py`**: FastAPI application entrypoint (version 2.2.0), CORS middleware, routing, and static file mount.
- **`app/database.py`**: PostgreSQL 16 engine configuration, SQLAlchemy ORM models (20 tables), connection pooling, and `/health/db` readiness probe.
- **`app/auth.py`**: Authentication core with Bcrypt password hashing, JWT access token generation (HS256, 8h), revocable refresh tokens (7d), 6 system roles, 43 granular permissions, role hierarchy protections, and case-level authorization dependencies.
- **`app/case_store.py`**: Multi-case isolation manager (`CaseManager` / `CaseStore`), thread-safe `MultiDiGraph` storage, entity deduplication, relationship resolution, and database synchronization.
- **`app/analytics.py`**: Deterministic NetworkX normalized Degree and Betweenness Centrality calculations.
- **`app/patterns.py`**: Algorithmic suspicious pattern detection rules (Key Broker / Bridge, Shared Conduits, Dense Cliques, Repeated Co-occurrences).
- **`app/community_detector.py`**: Louvain / modularity-based partition clustering.
- **`app/path_finder.py`**: Dijkstra shortest path discovery with step-by-step evidence linkage.
- **`app/data_classifier.py`**: Automatic stream triage into structured, semi-structured, or unstructured data buckets.
- **`app/import_module.py`**: Deterministic CSV and JSON parsers with whitespace trimming and column alias normalization.
- **`app/extraction.py`**: RegEx pre-pass (phones, license plates) + Groq Llama 3.3 NER extraction + referential integrity validation.
- **`app/investigation_leads.py`**: Heuristic investigation lead generator ranking priority targets.
- **`app/crime_profiles.py`**: 11 domain crime profiles with recommended evidence types and guided questions.
- **`app/crime_inference.py`**: Rule-based inferencing engine mapping relationship attributes to penal code statutes.
- **`app/report_generator.py`**: Forensic case dossier assembler.
- **`app/summary.py`**: Natural language briefing synthesis using Groq with deterministic fallback.
- **`app/ai_client.py`**: Resilient Groq HTTP client with fallback model rotation and `AIUnavailableError` handling.
- **`app/audit_logger.py`**: Cryptographic SHA-256 chained audit ledger recorder and integrity validator.
- **`app/config.py`**: Environment variable loader and threshold configurations.
- **`app/models.py`**: Pydantic v2 schemas for all requests, responses, entities, relationships, and metadata.

### 2.2 Backend API Routes Inventory (50+ Endpoints)

| Category | Method | Path | Required Permission / Role |
|----------|--------|------|----------------------------|
| **Health** | `GET` | `/health`, `/api/health` | Public |
| **Health** | `GET` | `/health/db`, `/api/health/db` | Public |
| **Auth** | `POST` | `/api/auth/register` | Public (User Registration) |
| **Auth** | `POST` | `/api/auth/login` | Public (Credentials Verification) |
| **Auth** | `POST` | `/api/auth/refresh` | Public (Refresh Token Rotation) |
| **Auth** | `POST` | `/api/auth/logout` | Authenticated |
| **Auth** | `GET` | `/api/auth/me` | Authenticated |
| **Auth** | `POST` | `/api/auth/switch-role` | Authenticated |
| **Admin** | `GET` | `/api/admin/users` | `users:read` (Admin / Super Admin) |
| **Admin** | `POST` | `/api/admin/users` | `users:create` (Admin / Super Admin) |
| **Admin** | `PUT` | `/api/admin/users/{id}` | `users:update` (Admin / Super Admin) |
| **Admin** | `PUT` | `/api/admin/users/{id}/status`| `users:update` (Admin / Super Admin) |
| **Admin** | `POST` | `/api/admin/users/{id}/roles` | `users:manage_roles` (Admin / Super Admin) |
| **Admin** | `GET` | `/api/admin/roles` | `users:read` (Admin / Super Admin) |
| **Admin** | `GET` | `/api/admin/permissions` | `users:read` (Admin / Super Admin) |
| **Cases** | `GET` | `/api/cases` | `cases:read` |
| **Cases** | `POST` | `/api/cases` | `cases:create` (Investigator, Admin, Super Admin) |
| **Cases** | `GET` | `/api/cases/active` | `cases:read` |
| **Cases** | `GET` | `/api/cases/{case_id}` | `cases:read` + Case Access |
| **Cases** | `PUT` | `/api/cases/{case_id}` | `cases:update` + Case Access |
| **Cases** | `DELETE`| `/api/cases/{case_id}` | `cases:delete` (Admin, Super Admin) |
| **Cases** | `POST` | `/api/cases/{case_id}/switch` | `cases:read` + Case Access |
| **Cases** | `POST` | `/api/cases/{case_id}/clear-graph` | `graph:clear` (Admin, Super Admin) |
| **Cases** | `POST` | `/api/cases/{case_id}/reset-investigation`| `cases:delete` (Admin, Super Admin) |
| **Case Users**| `GET` | `/api/cases/{case_id}/users` | `cases:read` + Case Access |
| **Case Users**| `POST` | `/api/cases/{case_id}/users` | `cases:assign_users` |
| **Case Users**| `DELETE`| `/api/cases/{case_id}/users/{uid}` | `cases:assign_users` |
| **Evidence** | `GET` | `/api/cases/{case_id}/evidence` | `evidence:read` + Case Access |
| **Evidence** | `POST` | `/api/cases/{case_id}/evidence` | `evidence:create` + Case Access |
| **Evidence** | `GET` | `/api/cases/{case_id}/relationships/{id}/lineage` | `evidence:read` + Case Access |
| **Ingestion** | `POST` | `/api/import` | `import:structured` / `import:unstructured` |
| **Ingestion** | `POST` | `/api/import/file` | `import:structured` / `import:unstructured` |
| **Graph** | `GET` | `/api/graph` | `graph:read` |
| **Graph** | `GET` | `/api/graph/centrality` | `analytics:centrality` |
| **Graph** | `GET` | `/api/graph/patterns` | `patterns:detect` |
| **Graph** | `GET` | `/api/cases/{case_id}/patterns` | `patterns:detect` + Case Access |
| **Graph** | `POST` | `/api/cases/{case_id}/patterns/{id}/review` | `patterns:dismiss` (Reviewer, Investigator, Admin) |
| **Graph** | `POST` | `/api/cases/{case_id}/patterns/{id}/dismiss`| `patterns:dismiss` (Reviewer, Investigator, Admin) |
| **Graph** | `GET` | `/api/graph/entity/{entity_id}` | `graph:read` |
| **Graph** | `GET` | `/api/graph/summary` | `dossier:generate` |
| **Graph** | `GET` | `/api/cases/{case_id}/communities` | `analytics:communities` + Case Access |
| **Graph** | `GET` | `/api/cases/{case_id}/connections` | `analytics:paths` + Case Access |
| **Validation**| `GET` | `/api/cases/{case_id}/validation` | `validation:read` + Case Access |
| **Validation**| `POST` | `/api/cases/{case_id}/validation/{id}/review` | `validation:review` |
| **Entity Merge**| `POST`| `/api/cases/{case_id}/entities/merge` | `entity:merge` (Investigator, Admin, Super Admin) |
| **Notes** | `GET` | `/api/cases/{case_id}/notes` | `notes:read` + Case Access |
| **Notes** | `POST` | `/api/cases/{case_id}/notes` | `notes:create` (Analyst, Investigator, Admin) |
| **Notes** | `DELETE`| `/api/cases/{case_id}/notes/{id}` | `notes:delete` (Investigator, Admin) |
| **Leads** | `GET` | `/api/cases/{case_id}/leads` | `leads:read` + Case Access |
| **Dossier** | `GET` | `/api/cases/{case_id}/report` | `dossier:generate` + Case Access |
| **Audit** | `POST` | `/api/audit/log` | Authenticated |
| **Audit** | `GET` | `/api/audit/trail`, `/api/audit/logs` | `audit:read` |
| **Audit** | `GET` | `/api/audit/integrity`, `/api/audit/verify` | `audit:verify` (Admin, Super Admin) |

---

## 3. Database Models & Schema Inventory (PostgreSQL 16)

All 20 relational database tables are managed via Alembic (`0001_initial_schema.py`):
1. **`users`**: System accounts (`id`, `username`, `email`, `password_hash`, `full_name`, `department`, `designation`, `status`, `created_at`, `updated_at`, `last_login`, `role`).
2. **`roles`**: System roles (`id`, `name`, `description`, `is_system_role`).
3. **`permissions`**: Granular system permissions (`id`, `code`, `description`, `category`).
4. **`user_roles`**: User-to-role assignment junction table with composite unique constraint `(user_id, role_id)`.
5. **`role_permissions`**: Role-to-permission mapping junction table with composite unique constraint `(role_id, permission_id)`.
6. **`refresh_tokens`**: Revocable refresh token store (`id`, `token_hash`, `user_id`, `expires_at`, `revoked`, `created_at`).
7. **`cases`**: Multi-case investigation files (`case_id`, `case_name`, `description`, `investigation_type`, `status`, `priority`, `is_protected`, `created_at`, `updated_at`, `created_by`).
8. **`case_users`**: Multi-tenant case-level authorization junction (`id`, `case_id`, `user_id`, `case_role`, `assigned_by`, `assigned_at`).
9. **`evidence`**: Ingested surveillance artifacts (`id`, `evidence_id`, `case_id`, `filename`, `original_filename`, `source_type`, `mime_type`, `file_size`, `sha256_hash`, `uploaded_at`, `uploaded_by`, `parser_version`, `record_count`, `processing_status`, `raw_content`).
10. **`evidence_records`**: Lineage chunks derived from evidence files (`id`, `evidence_id`, `case_id`, `record_index`, `raw_text`, `parsed_json`, `created_at`).
11. **`entities`**: Network nodes (`id`, `entity_id`, `case_id`, `type`, `name`, `normalized_name`, `phone`, `email`, `vehicle_plate`, `aliases_json`, `attributes_json`, `source_refs_json`, `community_id`, `evidence_id`, `source_file`, `validation_status`, `is_merged`, `merged_into_id`, `created_at`, `updated_at`).
12. **`entity_aliases`**: Alias lookup table (`id`, `entity_id`, `case_id`, `alias`, `normalized_alias`, `created_at`).
13. **`relationships`**: Directional and symmetric edges (`id`, `rel_id`, `case_id`, `source_id`, `target_id`, `relation_type`, `is_directed`, `weight`, `confidence`, `confidence_label`, `confidence_reasons_json`, `evidence_json`, `evidence_id`, `source_file`, `event_id`, `attributes_json`, `validation_status`, `occurrences`, `suspected_crime`, `crime_category`).
14. **`notes`**: Case field notes (`id`, `note_id`, `case_id`, `entity_id`, `relationship_id`, `evidence_id`, `author`, `role`, `note_text`, `timestamp`).
15. **`investigation_leads`**: Algorithmic target leads (`id`, `lead_id`, `case_id`, `entity_id`, `title`, `score`, `score_category`, `why_flagged_json`, `metrics_json`, `status`, `created_at`, `updated_at`).
16. **`audit_logs`**: Cryptographic SHA-256 chained audit ledger (`id`, `audit_id`, `timestamp`, `user_id`, `username`, `role`, `case_id`, `action`, `resource_type`, `resource_id`, `result`, `details`, `metadata_json`, `previous_hash`, `current_hash`).
17. **`audit_integrity`**: Audit verification snapshots (`id`, `last_verified_at`, `verified_by`, `total_records`, `is_valid`, `broken_record_id`, `verification_notes`).
18. **`pattern_findings`**: Suspicious pattern radar findings (`id`, `finding_id`, `case_id`, `pattern_type`, `severity`, `entities_involved_json`, `evidence`, `why`, `review_status`, `review_reason`, `reviewed_by`, `reviewed_at`).
19. **`entity_merges`**: Traceable entity merge audit records (`id`, `merge_id`, `case_id`, `source_entity_id`, `source_entity_name`, `target_entity_id`, `target_entity_name`, `performed_by`, `timestamp`, `reason`, `snapshot_json`).
20. **`validation_records`**: Human review items (`id`, `record_id`, `case_id`, `item_type`, `name_or_pair`, `status`, `confidence`, `reason`, `source_evidence`, `created_at`, `payload_json`, `reviewed_by`, `reviewed_at`, `reviewer_notes`).

---

## 4. Discovered Gaps & Remediations Required

During the exhaustive architectural inspection, the following gaps and areas for remediation were identified:

1. **Security Headers Missing**: FastAPI was only mounting `CORSMiddleware`. Standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP) were absent.
2. **API Rate Limiting Absent**: Sensitive endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/import`, `/api/graph/summary`) lacked rate limiting against brute-force and resource exhaustion.
3. **Global Exception Handling**: Uncaught exceptions lacked a centralized handler returning structured, sanitised error responses without exposing internal paths or tracebacks.
4. **File Upload Filename Sanitization**: `import_file` accepted raw file names directly without path-traversal sanitization (`Path(filename).name`).
5. **Database Transaction Rollbacks**: Several database multi-step write operations in `case_store.py` (`delete_case`, `merge_entities`, `upsert_entities`) used `try...finally` without an explicit `except Exception: db.rollback()` block.
6. **Maximal Clique Search Limit**: `detect_dense_subgroup_pattern` used unconstrained `nx.find_cliques()`, which could hang on dense synthetic graphs of 1000+ nodes.
7. **Frontend Route Protection for Admin**: In `App.jsx`, when `activeTab === 'admin'`, the UI did not explicitly check `isAdmin` before mounting `<AdminPanel>`, relying only on sidebar hiding and downstream API 403s.
8. **End-to-End QA Test Coverage**: Automated test suites needed extension to explicitly cover all 74 prompt requirements (negative tests, token tampering, rate limit 429s, IDOR case boundaries, and large dataset processing).
