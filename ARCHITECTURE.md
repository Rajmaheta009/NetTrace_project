# NetTrace 2.0: Architecture & Technical Design

## 1. System Overview
NetTrace is an AI-assisted digital investigation and network intelligence platform designed for law enforcement, cyber intelligence units, and forensic investigators. It assists human investigators in mapping criminal networks, analyzing phone/financial/vehicle conduits, verifying evidence integrity, and producing forensic dossiers.

## 2. Core Architectural Principles
1. **AI Boundary Compliance**:
   - AI (Groq / Gemini) is strictly utilized for natural language entity extraction and bounded, non-accusatory briefings.
   - AI NEVER calculates network centrality, detects communities, determines shortest paths, or assigns criminal guilt.
2. **Deterministic Graph Analytics**:
   - All network metrics (degree, betweenness centrality, shortest paths, modularity clustering) are executed via deterministic Python algorithms and NetworkX `MultiDiGraph`.
3. **Multi-Case Isolation**:
   - Each investigation case has an isolated in-memory store containing its own `MultiDiGraph`, evidence registry, validation queue, and field notes. Data never leaks across case files.
4. **Cryptographic Chain of Custody**:
   - Ingested surveillance artifacts receive an immutable SHA-256 hash.
   - Every relationship edge retains direct citations to its source file, evidence ID, and record index.
5. **Human-in-the-Loop Validation**:
   - Low-confidence or unconfirmed extractions are quarantined in the Data Quality Review Queue for human review (Accept, Reject, or Correct).

## 3. Technology Stack
- **Backend**:
  - Python 3.11+ / FastAPI
  - Graph Engine: NetworkX `MultiDiGraph` (preserving directional relationships like `CALLED`, `TRANSFERRED`, `OWNS_VEHICLE`)
  - AI Engine: Groq API client with strict JSON schema enforcement
  - Pydantic v2 data validation
- **Frontend**:
  - React 18 + Vite 5 + Tailwind CSS
  - 3D Visualization: Custom 3D Canvas matrix with depth scaling, specular lighting, dynamic wiretap pulses, and interactive orbit controls
  - Icons: Lucide React
  - Single-Page Architecture with responsive, collapsible sidebar navigation

## 4. Subsystem Layout
```
[Ingestion API] ──────> [Data Classifier] ──────> [Extraction Module]
                                                            │
                                                            ▼
                                                [Validation Queue]
                                                            │
                                                      (Human Review)
                                                            │
                                                            ▼
                                                   [CaseStore MultiDiGraph]
                                                            │
            ┌───────────────────┬───────────────────────────┼───────────────────────────┐
            ▼                   ▼                           ▼                           ▼
    [Centrality Metric]  [Modularity Clust]     [Shortest Path Finder]          [Pattern Heuristics]
            │                   │                           │                           │
            └───────────────────┴───────────────────────────┼───────────────────────────┘
                                                            ▼
                                              [Case Dossier Assembler]
                                                            ▼
                                              [React Investigator UI]
```
