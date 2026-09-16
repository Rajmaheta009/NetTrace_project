# NetTrace AI v2.0 - Criminal Network Intelligence & Syndicate Analysis

NetTrace AI is an investigative graph intelligence and crime syndicate analysis platform combining deterministic NetworkX graph theory (centrality, articulation bridges, shared resources, co-occurrence) with AI-driven entity extraction & forensic summarization.

---

## How to Run NetTrace AI

### 1. Start the Backend API (FastAPI)
From the V2 directory:
`ash
python -m uvicorn app.main:app --reload --port 8000
`
- **Backend API**: http://127.0.0.1:8000
- **Swagger Documentation**: http://127.0.0.1:8000/docs
- **Static Single-Page App**: http://127.0.0.1:8000/ (serves built React frontend directly)

### 2. Start the Development Frontend (Vite)
From the rontend directory:
`ash
npm run dev
`
- **Interactive UI**: http://localhost:5173

### 3. Rebuild Frontend Static Bundle
`ash
cd frontend
npm run build
`

---

## Key Capabilities & Features

1. **Interactive 3D Tactical Graph Orbit**:
   - **Tactical Zooming**: Mouse wheel scroll and trackpad pinch zoom the 3D camera smoothly. The outer browser page **will never zoom or scroll** while the cursor is inside the 3D diagram.
   - **Double-Click Node Inspection**: Double-clicking on any entity node opens its dossier and 1-hop connections.
   - **Silent Drag-Off**: Repositioning/dragging a node in 3D space does not pop open the info drawer when released.
   - **HUD Zoom Controls**: Dedicated + (Zoom In), - (Zoom Out), and percentage badge (click to reset to 100%) on the 3D toolbar.
   - **Full Memory Reset**: The Reset (Empty) button completely wipes in-memory data (0 nodes, 0 edges) and presents a tactical empty diagram overlay. A separate Demo Case button allows reloading sample syndicate data on demand.

2. **Security & Audit Trail Logger**:
   - Immutable activity audit logged to V2/logs/user_activity_audit.log in the standard format:
     username_or_id :- action details
   - Real-time **Audit Log** modal in the Navbar showing timestamped officer interactions (look3d graph, drag node, double_click node info, import_data, 
eset_graph).

3. **Intelligent Ingestion & De-duplication**:
   - Non-destructive attribute and alias merging when importing records with matching IDs, names, or phone numbers.
   - Relationship de-duplication: eliminates parallel duplicate edges and merges forensic evidence.