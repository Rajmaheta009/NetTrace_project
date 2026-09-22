"""
NetTrace Enterprise - Production & Deployment Automated Test Suite
==================================================================
Validates:
1. PostgreSQL 16 primary database connectivity and connection pool status.
2. Real JWT token authentication, bcrypt verification, token refresh, and logout revocation.
3. 6-Role authorization matrix (SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER).
4. System-role hierarchy protections (Admin cannot modify/suspend Super Admin).
5. Fine-grained case-level authorization (case_users).
6. Relational PostgreSQL persistence and SHA-256 cryptographic audit integrity chaining.
"""

import sys
import os
sys.path.insert(0, os.path.abspath("."))

import unittest
from fastapi.testclient import TestClient
from app.main import app

from app.database import SessionLocal, UserDB, CaseDB, CaseUserDB, RoleDB, PermissionDB, AuditLogDB

client = TestClient(app)

class TestNetTraceProductionDeployment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Authenticate all 6 demo accounts and store tokens
        cls.tokens = {}
        cls.refresh_tokens = {}
        demo_accounts = [
            ("SUPER_ADMIN", "superadmin", "SuperAdmin123!"),
            ("ADMIN", "admin", "Admin123!"),
            ("INVESTIGATOR", "investigator", "Investigator123!"),
            ("ANALYST", "analyst", "Analyst123!"),
            ("REVIEWER", "reviewer", "Reviewer123!"),
            ("VIEWER", "viewer", "Viewer123!"),
        ]
        for role_key, username, password in demo_accounts:
            res = client.post("/api/auth/login", json={"username_or_email": username, "password": password})
            assert res.status_code == 200, f"Failed to login demo account {username}: {res.text}"
            data = res.json()
            cls.tokens[role_key] = data["access_token"]
            cls.refresh_tokens[role_key] = data["refresh_token"]

    def auth_header(self, role_key: str):
        return {"Authorization": f"Bearer {self.tokens[role_key]}"}

    # -------------------------------------------------------------
    # 1. Database Health, Dialect & Connection Pooling
    # -------------------------------------------------------------
    def test_01_database_health_and_pooling(self):
        # Unauthenticated health probe
        res = client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("database", data)
        self.assertEqual(data["database"]["status"], "healthy")
        self.assertEqual(data["database"]["dialect"], "postgresql")

        # Dedicated database health endpoint
        res_db = client.get("/health/db")
        self.assertEqual(res_db.status_code, 200)
        db_data = res_db.json()
        self.assertEqual(db_data["status"], "healthy")
        self.assertEqual(db_data["dialect"], "postgresql")
        self.assertIn("pool", db_data)
        self.assertGreaterEqual(db_data["pool"]["size"], 1)

    # -------------------------------------------------------------
    # 2. Authentication Flow: JWT, Bcrypt, Refresh & Revocation
    # -------------------------------------------------------------
    def test_02_authentication_lifecycle(self):
        # 2a. Invalid password -> 401
        res_bad_pw = client.post("/api/auth/login", json={
            "username_or_email": "investigator",
            "password": "WrongPassword123!"
        })
        self.assertEqual(res_bad_pw.status_code, 401)
        self.assertIn("Invalid", res_bad_pw.json()["detail"])

        # 2b. Non-existent user -> 401
        res_no_user = client.post("/api/auth/login", json={
            "username_or_email": "ghost_officer",
            "password": "AnyPassword123!"
        })
        self.assertEqual(res_no_user.status_code, 401)

        # 2c. Valid login creates tokens
        res_login = client.post("/api/auth/login", json={
            "username_or_email": "analyst",
            "password": "Analyst123!"
        })
        self.assertEqual(res_login.status_code, 200)
        login_data = res_login.json()
        tok = login_data["access_token"]
        ref_tok = login_data["refresh_token"]
        self.assertTrue(len(tok) > 20)
        self.assertTrue(len(ref_tok) > 20)
        self.assertEqual(login_data["token_type"], "bearer")

        # 2d. Refresh token flow
        res_refresh = client.post("/api/auth/refresh", json={"refresh_token": ref_tok})
        self.assertEqual(res_refresh.status_code, 200)
        refresh_data = res_refresh.json()
        new_tok = refresh_data["access_token"]
        new_ref_tok = refresh_data["refresh_token"]
        self.assertNotEqual(ref_tok, new_ref_tok)

        # 2e. Reusing old revoked refresh token -> 401
        res_reuse = client.post("/api/auth/refresh", json={"refresh_token": ref_tok})
        self.assertEqual(res_reuse.status_code, 401)

        # 2f. Logout revokes token
        res_logout = client.post(
            "/api/auth/logout",
            json={"refresh_token": new_ref_tok},
            headers={"Authorization": f"Bearer {new_tok}"}
        )
        self.assertEqual(res_logout.status_code, 200)

        # Trying to use logged out refresh token -> 401
        res_after_logout = client.post("/api/auth/refresh", json={"refresh_token": new_ref_tok})
        self.assertEqual(res_after_logout.status_code, 401)

    # -------------------------------------------------------------
    # 3. Six-Role Authorization Matrix
    # -------------------------------------------------------------
    def test_03_role_viewer_permissions_and_restrictions(self):
        hdr = self.auth_header("VIEWER")
        # Allowed: view cases, graph, leads
        self.assertEqual(client.get("/api/cases", headers=hdr).status_code, 200)
        self.assertEqual(client.get("/api/graph", headers=hdr).status_code, 200)

        # Forbidden: import data -> 403
        res_imp = client.post("/api/import", json={"content": "dummy", "type": "csv"}, headers=hdr)
        self.assertEqual(res_imp.status_code, 403)

        # Forbidden: merge entities -> 403
        res_merge = client.post(
            "/api/cases/case-001/entities/merge",
            json={"source_entity_id": "ent_1", "target_entity_id": "ent_2"},
            headers=hdr
        )
        self.assertEqual(res_merge.status_code, 403)

        # Forbidden: clear graph -> 403
        res_clear = client.post("/api/cases/case-001/clear-graph", headers=hdr)
        self.assertEqual(res_clear.status_code, 403)

        # Forbidden: admin panel -> 403
        self.assertEqual(client.get("/api/admin/users", headers=hdr).status_code, 403)
        self.assertEqual(client.get("/api/admin/roles", headers=hdr).status_code, 403)

    def test_04_role_analyst_permissions(self):
        hdr = self.auth_header("ANALYST")
        # Allowed: explore graph, notes, leads, pattern review
        self.assertEqual(client.get("/api/graph", headers=hdr).status_code, 200)
        self.assertEqual(client.get("/api/cases/case-001/leads", headers=hdr).status_code, 200)

        # Allowed: create field note
        res_note = client.post("/api/cases/case-001/notes", json={"note_text": "Analyst strategic observation"}, headers=hdr)
        self.assertEqual(res_note.status_code, 200)

        # Forbidden: import data -> 403
        res_imp = client.post("/api/import", json={"content": "dummy", "type": "csv"}, headers=hdr)
        self.assertEqual(res_imp.status_code, 403)

        # Forbidden: merge entities -> 403
        res_merge = client.post(
            "/api/cases/case-001/entities/merge",
            json={"source_entity_id": "ent_1", "target_entity_id": "ent_2"},
            headers=hdr
        )
        self.assertEqual(res_merge.status_code, 403)

        # Forbidden: admin endpoints -> 403
        self.assertEqual(client.get("/api/admin/users", headers=hdr).status_code, 403)

    def test_05_role_reviewer_validation_workflow(self):
        hdr = self.auth_header("REVIEWER")
        # Seed or get a validation item
        val_records = client.get("/api/cases/case-001/validation", headers=hdr).json()
        if not val_records:
            # Ingest item as investigator first
            inv_hdr = self.auth_header("INVESTIGATOR")
            client.post("/api/import", json={
                "type": "csv",
                "content": "id,type,name\nrev_ent_01,Person,Review Target",
                "case_id": "case-001"
            }, headers=inv_hdr)
            val_records = client.get("/api/cases/case-001/validation", headers=hdr).json()

        if val_records:
            rec_id = val_records[0]["record_id"]
            # Reviewer can accept/reject/correct
            res_rev = client.post(
                f"/api/cases/case-001/validation/{rec_id}/review",
                json={"action": "ACCEPT"},
                headers=hdr
            )
            self.assertEqual(res_rev.status_code, 200)

        # Reviewer cannot import raw data -> 403
        self.assertEqual(client.post("/api/import", json={"content": "x"}, headers=hdr).status_code, 403)

        # Reviewer cannot delete case -> 403
        self.assertEqual(client.delete("/api/cases/case-001", headers=hdr).status_code, 403)

    def test_06_role_investigator_capabilities(self):
        hdr = self.auth_header("INVESTIGATOR")
        # Investigator can ingest data
        res_imp = client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": "id,type,name\ninv_test_01,Person,Rajesh Investigator Test",
                "case_id": "case-001"
            },
            headers=hdr
        )
        self.assertEqual(res_imp.status_code, 200)

        # Investigator can create notes
        res_note = client.post("/api/cases/case-001/notes", json={"note_text": "Investigator field lead"}, headers=hdr)
        self.assertEqual(res_note.status_code, 200)

        # Investigator cannot access admin user panel -> 403
        self.assertEqual(client.get("/api/admin/users", headers=hdr).status_code, 403)

    def test_07_role_admin_and_system_role_protections(self):
        admin_hdr = self.auth_header("ADMIN")
        sadmin_hdr = self.auth_header("SUPER_ADMIN")

        # Admin can view admin users and roles
        res_u = client.get("/api/admin/users", headers=admin_hdr)
        self.assertEqual(res_u.status_code, 200)
        self.assertTrue(len(res_u.json()) >= 6)

        # Admin CANNOT modify or demote Super Admin account -> 403 Forbidden
        res_demote = client.put(
            "/api/admin/users/USR-SADMIN-01/status",
            json={"status": "SUSPENDED"},
            headers=admin_hdr
        )
        self.assertEqual(res_demote.status_code, 403)
        self.assertIn("Super Admin", res_demote.json()["detail"])

        # Admin CANNOT assign SUPER_ADMIN role -> 403 Forbidden
        res_assign = client.post(
            "/api/admin/users/USR-INV-01/roles",
            json={"roles": ["SUPER_ADMIN"]},
            headers=admin_hdr
        )
        self.assertEqual(res_assign.status_code, 403)

        # Super Admin CAN modify account
        res_ok_update = client.put(
            "/api/admin/users/USR-INV-01",
            json={"designation": "Lead Senior Detective"},
            headers=sadmin_hdr
        )
        self.assertEqual(res_ok_update.status_code, 200)
        self.assertEqual(res_ok_update.json()["designation"], "Lead Senior Detective")

    # -------------------------------------------------------------
    # 4. Case-Level Authorization & Assignment Enforcement
    # -------------------------------------------------------------
    def test_08_case_level_authorization_enforcement(self):
        sadmin_hdr = self.auth_header("SUPER_ADMIN")
        anl_hdr = self.auth_header("ANALYST")

        # 4a. Create a restricted private case as Super Admin
        res_case = client.post(
            "/api/cases",
            json={
                "case_name": "Classified Project Falcon",
                "description": "Restricted operational workspace",
                "priority": "Critical"
            },
            headers=sadmin_hdr
        )
        self.assertEqual(res_case.status_code, 200)
        private_case_id = res_case.json()["case_id"]

        # 4b. Analyst is NOT assigned to this private case -> 403 Forbidden
        res_denied = client.get(f"/api/cases/{private_case_id}", headers=anl_hdr)
        self.assertEqual(res_denied.status_code, 403)
        self.assertIn("not assigned", res_denied.json()["detail"].lower())

        # 4c. Assign Analyst to the private case
        res_assign = client.post(
            f"/api/cases/{private_case_id}/users",
            json={"user_id": "USR-ANA-01", "case_role": "ANALYST"},
            headers=sadmin_hdr
        )
        self.assertEqual(res_assign.status_code, 200)

        # 4d. Analyst can now access the private case -> 200 OK
        res_allowed = client.get(f"/api/cases/{private_case_id}", headers=anl_hdr)
        self.assertEqual(res_allowed.status_code, 200)
        self.assertEqual(res_allowed.json()["case_id"], private_case_id)

    # -------------------------------------------------------------
    # 5. Database Relational Persistence & Integrity
    # -------------------------------------------------------------
    def test_09_relational_database_persistence(self):
        db = SessionLocal()
        try:
            # Query PostgreSQL tables directly
            user_count = db.query(UserDB).count()
            case_count = db.query(CaseDB).count()
            role_count = db.query(RoleDB).count()
            perm_count = db.query(PermissionDB).count()
            audit_count = db.query(AuditLogDB).count()

            self.assertGreaterEqual(user_count, 6)
            self.assertGreaterEqual(case_count, 1)
            self.assertGreaterEqual(role_count, 6)
            self.assertGreaterEqual(perm_count, 35)
            self.assertGreaterEqual(audit_count, 1)
        finally:
            db.close()

    # -------------------------------------------------------------
    # 6. Cryptographic Audit Log Integrity Verification
    # -------------------------------------------------------------
    def test_10_cryptographic_audit_ledger_chain(self):
        admin_hdr = self.auth_header("ADMIN")
        res = client.get("/api/audit/integrity", headers=admin_hdr)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["valid"])
        self.assertIsNone(data["broken_at"])
        self.assertGreater(data["total_records"], 0)
        self.assertEqual(data["total_records"], data["verified_records"])

    # -------------------------------------------------------------
    # 7. Directional vs Symmetric Edge Correctness
    # -------------------------------------------------------------
    def test_11_directional_vs_symmetric_edges(self):
        inv_hdr = self.auth_header("INVESTIGATOR")
        # Ensure working in case-001
        client.post("/api/cases/case-001/switch", headers=inv_hdr)
        # First ingest entities so relationship resolution succeeds
        e_res = client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": (
                    "id,type,name\n"
                    "person_sender_99,Person,Caller Alpha\n"
                    "person_receiver_99,Person,Receiver Bravo\n"
                ),
                "case_id": "case-001"
            },
            headers=inv_hdr
        )
        self.assertEqual(e_res.status_code, 200)

        # Ingest directional surveillance call
        res = client.post(
            "/api/import",
            json={
                "type": "csv",
                "content": (
                    "source,target,relation_type,duration\n"
                    "person_sender_99,person_receiver_99,CALLED,120\n"
                ),
                "case_id": "case-001"
            },
            headers=inv_hdr
        )
        self.assertEqual(res.status_code, 200)
        g_res = client.get("/api/graph", headers=inv_hdr).json()
        links = g_res.get("links", [])
        called_links = [
            l for l in links
            if (l.get("source") == "person_sender_99" or (isinstance(l.get("source"), dict) and l.get("source", {}).get("id") == "person_sender_99"))
            and (l.get("target") == "person_receiver_99" or (isinstance(l.get("target"), dict) and l.get("target", {}).get("id") == "person_receiver_99"))
            and l.get("relation_type") == "CALLED"
        ]
        self.assertGreaterEqual(len(called_links), 1)
        # Reverse edge must not exist because CALLED is directed
        reverse_links = [
            l for l in links
            if (l.get("source") == "person_receiver_99" or (isinstance(l.get("source"), dict) and l.get("source", {}).get("id") == "person_receiver_99"))
            and (l.get("target") == "person_sender_99" or (isinstance(l.get("target"), dict) and l.get("target", {}).get("id") == "person_sender_99"))
            and l.get("relation_type") == "CALLED"
        ]
        self.assertEqual(len(reverse_links), 0)

    # -------------------------------------------------------------
    # 8. False-Positive Pattern Review & Dismissal
    # -------------------------------------------------------------
    def test_12_false_positive_pattern_dismissal(self):
        anl_hdr = self.auth_header("ANALYST")
        patterns = client.get("/api/cases/case-001/patterns", headers=anl_hdr).json()
        if patterns:
            p_id = patterns[0]["id"]
            res = client.post(
                f"/api/cases/case-001/patterns/{p_id}/review",
                json={"action": "DISMISSED", "notes": "Legitimate business transactions identified"},
                headers=anl_hdr
            )
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["review_status"], "DISMISSED")
            notes_result = data.get("notes") or data.get("review_notes")
            self.assertEqual(notes_result, "Legitimate business transactions identified")


if __name__ == "__main__":
    unittest.main()
