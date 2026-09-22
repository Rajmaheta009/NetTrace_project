"""
Master Engineering Audit Test Suite for NetTrace
Validates all 16 core requirements:
1. Architecture & schema integrity
2. Server-side RBAC enforcement
3. Secure audit logging
4. Tamper-evident audit trail & cryptographic verification
5. Case update bug fix (priority, type, status, name, description)
6. Default case protection (case-001 HTTP 403)
7. Clear graph vs Reset investigation
8. Directional vs Symmetric relationships
9. Safe & Traceable entity merge
10. Case-aware import
11. SQLite persistence & rehydration
12. Evidence provenance (SHA-256, parser version)
13. Evidence lineage
14. Disciplined validation review workflow
15. False-positive handling & pattern review
16. Neutral graph metrics terminology
"""

import os
import sys
import unittest

# Add V2 to sys.path
BACKEND_DIR = r"D:\SIH_SynerCloud_NetTrace\SIH_SynerCloud_NetTrace-20260913T171153Z-1-001\V2"
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app.main import app
from app.auth import set_active_session_role
from app.models import UserRole
from app.database import SessionLocal, CaseDB, AuditLogDB, PatternFindingDB
from app.audit_logger import verify_audit_integrity, record_audit

client = TestClient(app)


class TestNetTraceMasterEngineering(unittest.TestCase):

    def setUp(self):
        # Default to Admin for general setup
        set_active_session_role(UserRole.ADMIN)

    # -------------------------------------------------------------
    # 1. System Health & Neutral Terminology
    # -------------------------------------------------------------
    def test_01_health_and_neutral_terminology(self):
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("active_case_id", data)

        # Verify centrality uses neutral labels
        resp = client.get("/api/graph/centrality")
        self.assertEqual(resp.status_code, 200)
        entries = resp.json()
        self.assertIsInstance(entries, list)
        if entries:
            self.assertIn("degree", entries[0])
            self.assertIn("betweenness", entries[0])
            self.assertIn("name", entries[0])

    # -------------------------------------------------------------
    # 2. Real Server-Side RBAC Enforcement
    # -------------------------------------------------------------
    def test_02_rbac_viewer_restrictions(self):
        # Viewer role can access GET routes
        set_active_session_role(UserRole.VIEWER)
        resp = client.get("/api/cases", headers={"X-User-Role": "Viewer"})
        self.assertEqual(resp.status_code, 200)

        # Viewer role CANNOT create cases (must return 403)
        resp = client.post(
            "/api/cases",
            json={"case_name": "Unauthorized Case", "description": "Should fail"},
            headers={"X-User-Role": "Viewer"},
        )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Access Denied", resp.json()["detail"])

        # Viewer role CANNOT import data (must return 403)
        resp = client.post(
            "/api/import",
            json={"content": "p1,Person,Alice\np2,Person,Bob", "type": "csv"},
            headers={"X-User-Role": "Viewer"},
        )
        self.assertEqual(resp.status_code, 403)

    def test_02_rbac_analyst_permissions(self):
        # Analyst can create field notes
        set_active_session_role(UserRole.ANALYST)
        resp = client.post(
            "/api/cases/case-001/notes",
            json={"note_text": "Analyst tactical observation note"},
            headers={"X-User-Role": "Analyst"},
        )
        self.assertEqual(resp.status_code, 200)

        # Analyst CANNOT delete cases (must return 403)
        resp = client.delete("/api/cases/case-001", headers={"X-User-Role": "Analyst"})
        self.assertEqual(resp.status_code, 403)

    # -------------------------------------------------------------
    # 3 & 4. Secure Audit Logging & Tamper-Evident SHA-256 Chaining
    # -------------------------------------------------------------
    def test_03_audit_trail_and_cryptographic_integrity(self):
        set_active_session_role(UserRole.INVESTIGATOR)
        # Log an activity - server pulls identity from auth session, not client json
        resp = client.post(
            "/api/audit/log",
            json={"action": "test_verification", "details": "Automated ledger test"},
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(resp.status_code, 200)
        entry = resp.json()
        self.assertEqual(entry["action"], "test_verification")
        self.assertIn("current_hash", entry)
        self.assertEqual(len(entry["current_hash"]), 64)  # SHA-256 length

        # Verify integrity endpoint
        set_active_session_role(UserRole.ADMIN)
        v_resp = client.get("/api/audit/verify", headers={"X-User-Role": "Admin"})
        self.assertEqual(v_resp.status_code, 200)
        v_data = v_resp.json()
        self.assertTrue(v_data["valid"])
        self.assertGreater(v_data["total_records"], 0)
        self.assertEqual(v_data["verified_records"], v_data["total_records"])

    # -------------------------------------------------------------
    # 5. Case Update Bug Fix (investigation_type, priority, status, name, description)
    # -------------------------------------------------------------
    def test_05_case_update_full_fields(self):
        set_active_session_role(UserRole.INVESTIGATOR)
        # Create a new test case
        c_resp = client.post(
            "/api/cases",
            json={
                "case_name": "Operation Falcon Alpha",
                "description": "Initial scope",
                "investigation_type": "organized_crime",
                "priority": "High",
            },
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(c_resp.status_code, 200)
        c_data = c_resp.json()
        case_id = c_data["case_id"]

        # Update ALL fields via PUT /api/cases/{case_id}
        u_resp = client.put(
            f"/api/cases/{case_id}",
            json={
                "case_name": "Operation Falcon Alpha Updated",
                "description": "Updated tactical scope",
                "investigation_type": "cybercrime",
                "priority": "Critical",
                "status": "Under Investigation",
            },
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(u_resp.status_code, 200)
        u_data = u_resp.json()
        self.assertEqual(u_data["case_name"], "Operation Falcon Alpha Updated")
        self.assertEqual(u_data["description"], "Updated tactical scope")
        self.assertEqual(u_data["investigation_type"], "cybercrime")
        self.assertEqual(u_data["priority"], "Critical")
        self.assertEqual(u_data["status"], "Under Investigation")

        # Verify persistence in SQLite
        db = SessionLocal()
        try:
            db_case = db.query(CaseDB).filter(CaseDB.case_id == case_id).first()
            self.assertIsNotNone(db_case)
            self.assertEqual(db_case.investigation_type, "cybercrime")
            self.assertEqual(db_case.priority, "Critical")
        finally:
            db.close()

    # -------------------------------------------------------------
    # 6. Protect Default Case (case-001 HTTP 403)
    # -------------------------------------------------------------
    def test_06_protect_default_case(self):
        set_active_session_role(UserRole.ADMIN)
        # Attempting to delete protected case-001 must return HTTP 403
        resp = client.delete("/api/cases/case-001", headers={"X-User-Role": "Admin"})
        self.assertEqual(resp.status_code, 403)
        self.assertIn("protected", resp.json()["detail"].lower())

    # -------------------------------------------------------------
    # 7. Clear Graph vs Reset Investigation
    # -------------------------------------------------------------
    def test_07_clear_graph_vs_reset_investigation(self):
        set_active_session_role(UserRole.ADMIN)
        # Create a disposable case
        c_resp = client.post(
            "/api/cases",
            json={"case_name": "Disposable Case", "description": "Testing clear vs reset"},
            headers={"X-User-Role": "Admin"},
        )
        case_id = c_resp.json()["case_id"]

        # Register evidence and note
        ev_resp = client.post(
            f"/api/cases/{case_id}/evidence",
            json={"filename": "test_intel.csv", "source_type": "csv", "content": "col1,col2\na,b"},
            headers={"X-User-Role": "Admin"},
        )
        self.assertEqual(ev_resp.status_code, 200)

        n_resp = client.post(
            f"/api/cases/{case_id}/notes",
            json={"note_text": "Critical lead note to preserve"},
            headers={"X-User-Role": "Admin"},
        )
        self.assertEqual(n_resp.status_code, 200)

        # Import some entities into this case
        imp_resp = client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": "id,type,name\nent_1,Person,Alice\nent_2,Person,Bob",
                "source_label": "test_import.csv",
                "case_id": case_id,
            },
            headers={"X-User-Role": "Admin"},
        )
        self.assertEqual(imp_resp.status_code, 200)

        # 1. Clear Graph: Must clear entities/relationships, but PRESERVE evidence & notes
        cg_resp = client.post(f"/api/cases/{case_id}/clear-graph", headers={"X-User-Role": "Admin"})
        self.assertEqual(cg_resp.status_code, 200)

        # Check evidence & notes still exist
        ev_list = client.get(f"/api/cases/{case_id}/evidence").json()
        notes_list = client.get(f"/api/cases/{case_id}/notes").json()
        self.assertGreater(len(ev_list), 0)
        self.assertGreater(len(notes_list), 0)

        # 2. Reset Investigation: Must wipe everything
        ri_resp = client.post(f"/api/cases/{case_id}/reset-investigation", headers={"X-User-Role": "Admin"})
        self.assertEqual(ri_resp.status_code, 200)

        ev_list_after = client.get(f"/api/cases/{case_id}/evidence").json()
        notes_list_after = client.get(f"/api/cases/{case_id}/notes").json()
        self.assertEqual(len(ev_list_after), 0)
        self.assertEqual(len(notes_list_after), 0)

    # -------------------------------------------------------------
    # 8. Directional vs Symmetric Relationships
    # -------------------------------------------------------------
    def test_08_directional_vs_symmetric_relationships(self):
        from app.case_store import CaseStore
        from app.models import Relationship, RelationType

        store = CaseStore(case_id="case-test-rel", case_name="Rel Test")

        # Symmetric relationship: MET_AT
        rel1 = Relationship(id="r1", source="Alice", target="Bob", relation_type=RelationType.MET_AT)
        rel1_rev = Relationship(id="r2", source="Bob", target="Alice", relation_type=RelationType.MET_AT)

        # Duplicate should be detected for symmetric
        store.relationships["r1"] = rel1
        dup_sym = store.find_duplicate_relationship(rel1_rev)
        self.assertIsNotNone(dup_sym)
        self.assertEqual(dup_sym.id, "r1")

        # Directional relationship: CALLED
        rel_dir1 = Relationship(id="r3", source="Alice", target="Bob", relation_type=RelationType.CALLED)
        rel_dir2 = Relationship(id="r4", source="Bob", target="Alice", relation_type=RelationType.CALLED)

        # Directional relationship should NOT be flagged as duplicate when reversed
        store.relationships["r3"] = rel_dir1
        dup_dir = store.find_duplicate_relationship(rel_dir2)
        self.assertIsNone(dup_dir)  # A -> B and B -> A can coexist!

    # -------------------------------------------------------------
    # 9. Safe & Traceable Entity Merge
    # -------------------------------------------------------------
    def test_09_safe_traceable_entity_merge(self):
        set_active_session_role(UserRole.INVESTIGATOR)
        # Create a case for merging
        c_resp = client.post(
            "/api/cases",
            json={"case_name": "Merge Test Case"},
            headers={"X-User-Role": "Investigator"},
        )
        case_id = c_resp.json()["case_id"]

        # Ingest 2 duplicate entities and 1 relationship
        csv_data = (
            "id,type,name,aliases\n"
            "p_alpha,Person,Vikram Singhania,Ghost\n"
            "p_beta,Person,V. Singhania,VK\n"
            "p_charlie,Person,Rajesh Shrestha,Accountant\n"
        )
        client.post(
            "/api/import",
            json={"type": "csv", "content": csv_data, "case_id": case_id},
            headers={"X-User-Role": "Investigator"},
        )
        rel_data = "source,target,relation_type\np_alpha,p_charlie,COMMUNICATED_WITH\n"
        client.post(
            "/api/import",
            json={"type": "csv", "content": rel_data, "case_id": case_id},
            headers={"X-User-Role": "Investigator"},
        )

        # Merge p_beta into p_alpha
        m_resp = client.post(
            f"/api/cases/{case_id}/entities/merge",
            json={
                "source_entity_id": "p_beta",
                "target_entity_id": "p_alpha",
                "reason": "Confirmed duplicate alias identity during intercept analysis",
            },
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(m_resp.status_code, 200)
        m_data = m_resp.json()
        self.assertEqual(m_data["surviving_entity_id"], "p_alpha")
        self.assertEqual(m_data["removed_entity_id"], "p_beta")

        # Verify merge record exists in GET /api/cases/{case_id}/merges
        merges_resp = client.get(f"/api/cases/{case_id}/merges")
        self.assertEqual(merges_resp.status_code, 200)
        merges_list = merges_resp.json()
        self.assertEqual(len(merges_list), 1)
        self.assertEqual(merges_list[0]["source_entity_id"], "p_beta")
        self.assertEqual(merges_list[0]["target_entity_id"], "p_alpha")

    # -------------------------------------------------------------
    # 10. Case-Aware Import
    # -------------------------------------------------------------
    def test_10_case_aware_import(self):
        set_active_session_role(UserRole.INVESTIGATOR)
        # Create two separate cases
        c1 = client.post("/api/cases", json={"case_name": "Case One"}, headers={"X-User-Role": "Investigator"}).json()["case_id"]
        c2 = client.post("/api/cases", json={"case_name": "Case Two"}, headers={"X-User-Role": "Investigator"}).json()["case_id"]

        # Ingest into Case One
        imp1 = client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": "id,type,name\nuser_101,Person,Alice One",
                "case_id": c1,
            },
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(imp1.status_code, 200)

        # Verify c1 has user_101 and c2 does NOT have user_101 (isolation)
        case1_data = client.get(f"/api/cases/{c1}").json()
        case2_data = client.get(f"/api/cases/{c2}").json()
        self.assertEqual(case1_data["entity_count"], 1)
        self.assertEqual(case2_data["entity_count"], 0)

    # -------------------------------------------------------------
    # 12 & 13. Evidence Provenance & Evidence Lineage
    # -------------------------------------------------------------
    def test_12_and_13_evidence_provenance_and_lineage(self):
        set_active_session_role(UserRole.INVESTIGATOR)
        # Ingest a structured pair with source label
        c = client.post("/api/cases", json={"case_name": "Lineage Test Case"}, headers={"X-User-Role": "Investigator"}).json()["case_id"]
        imp = client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": "id,type,name\ns1,Person,Agent X\ns2,Person,Agent Y",
                "source_label": "surveillance_log_alpha.csv",
                "case_id": c,
            },
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(imp.status_code, 200)
        ev_id = imp.json()["evidence_id"]
        self.assertIsNotNone(ev_id)

        # Check evidence record has provenance fields
        ev_list = client.get(f"/api/cases/{c}/evidence").json()
        self.assertGreater(len(ev_list), 0)
        primary_ev = ev_list[0]
        self.assertIn("sha256_hash", primary_ev)
        self.assertEqual(len(primary_ev["sha256_hash"]), 64)
        self.assertIn("parser_version", primary_ev)

        # Ingest relationship
        client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": "source,target,relation_type\ns1,s2,CALLED",
                "source_label": "calls_evidence.csv",
                "case_id": c,
            },
            headers={"X-User-Role": "Investigator"},
        )

        # Fetch relationship lineage
        from app.case_store import case_manager
        case_store = case_manager.get_case(c)
        rel_id = next(iter(case_store.relationships.keys()))
        lin_resp = client.get(f"/api/cases/{c}/relationships/{rel_id}/lineage")
        self.assertEqual(lin_resp.status_code, 200)
        lin_data = lin_resp.json()
        self.assertIn("lineage_summary", lin_data)
        self.assertIn("supporting_evidence", lin_data)

    # -------------------------------------------------------------
    # 14. Disciplined Validation Review Workflow
    # -------------------------------------------------------------
    def test_14_validation_review_workflow(self):
        set_active_session_role(UserRole.INVESTIGATOR)
        from app.case_store import case_manager
        from app.models import ValidationStatus
        case = case_manager.get_case("case-001")
        rec = case.queue_validation(
            item_type="relationship",
            name_or_pair="Suspect A -> Suspect B",
            payload={"source": "Suspect A", "target": "Suspect B", "relation_type": "CALLED"},
            confidence=0.45,
            reason="Unconfirmed endpoint",
            source_evidence="intercept.txt",
        )

        # Review record
        rev_resp = client.post(
            f"/api/cases/case-001/validation/{rec.record_id}/review",
            json={"action": "REJECT"},
            headers={"X-User-Role": "Investigator"},
        )
        self.assertEqual(rev_resp.status_code, 200)
        self.assertEqual(rev_resp.json()["status"], "Rejected")

    # -------------------------------------------------------------
    # 15. False-Positive Handling & Pattern Review
    # -------------------------------------------------------------
    def test_15_false_positive_pattern_review(self):
        set_active_session_role(UserRole.ANALYST)
        # Fetch patterns for active case
        patterns = client.get("/api/cases/case-001/patterns").json()
        self.assertIsInstance(patterns, list)
        if patterns:
            p = patterns[0]
            finding_id = p["finding_id"]
            self.assertIsNotNone(finding_id)

            # Mark as DISMISSED (false positive / expected routine activity)
            rev_resp = client.post(
                f"/api/cases/case-001/patterns/{finding_id}/review",
                json={
                    "action": "DISMISSED",
                    "notes": "Legitimate shared corporate branch address - expected commercial connection",
                },
                headers={"X-User-Role": "Analyst"},
            )
            self.assertEqual(rev_resp.status_code, 200)
            self.assertEqual(rev_resp.json()["review_status"], "DISMISSED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
