"""
NetTrace Enterprise - Comprehensive Full System QA & Verification Suite
========================================================================
Covers the full production acceptance test matrix:
1. Security Response Headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
2. Rate Limiting Protection (HTTP 429 after 30 rapid attempts on /api/auth/login)
3. Upload Security, Filename Sanitization & Path Traversal Guards (.exe, .sh, .bat, ../ traversal)
4. Global Exception & Information Leak Protection (No stack traces, internal paths, or credentials in responses)
5. Full RBAC Authorization Matrix (SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER)
6. End-to-End Investigation Lifecycle (Login -> Create Case -> Upload Evidence -> Graph Analytics -> Lead Detection -> Human Review/Validation -> Notes -> Audit Verification -> Case Delete)
7. PostgreSQL 16 Relational Persistence & Durability across DB Connection Resets
8. Large-Scale Synthetic Graph Analytics & Clique Cutoff Performance Guard
9. SHA-256 Tamper-Evident Audit Ledger Cryptographic Verification & Tamper Detection
"""

import hashlib
import io
import json
import os
import sys
import time
import unittest
from datetime import datetime

# Ensure V2 directory is in python search path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app.main import app, _rate_limit_records, _rate_limit_lock
from app.database import (
    SessionLocal,
    UserDB,
    CaseDB,
    EntityDB,
    RelationshipDB,
    EvidenceDB,
    AuditLogDB,
    PatternFindingDB,
    ValidationRecordDB,
    NoteDB,
    InvestigationLeadDB,
)
from app.audit_logger import verify_audit_integrity, record_audit
from app.case_store import case_manager
from app.models import UserRole
from app.auth import set_active_session_role

client = TestClient(app)


class TestNetTraceFullSystemQA(unittest.TestCase):
    """Production Acceptance and Hardening QA Test Suite."""

    @classmethod
    def setUpClass(cls):
        # Authenticate all 6 demo accounts and store real JWT access tokens
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
            res = client.post(
                "/api/auth/login",
                json={"username_or_email": username, "password": password},
                headers={"X-Test-Bypass-Rate-Limit": "1"},
            )
            assert res.status_code == 200, f"Failed to login {username}: {res.text}"
            data = res.json()
            cls.tokens[role_key] = data["access_token"]
            cls.refresh_tokens[role_key] = data["refresh_token"]

    def auth_headers(self, role_key: str):
        """Helper to attach Bearer JWT and test bypass header."""
        return {
            "Authorization": f"Bearer {self.tokens[role_key]}",
            "X-Test-Bypass-Rate-Limit": "1",
        }

    # -------------------------------------------------------------
    # 1. Security Response Headers Verification
    # -------------------------------------------------------------
    def test_01_security_response_headers(self):
        """Verify presence of all enterprise HTTP security headers on endpoints."""
        endpoints = ["/health", "/api/cases"]
        for ep in endpoints:
            res = client.get(ep, headers={"X-Test-Bypass-Rate-Limit": "1"})
            self.assertEqual(
                res.headers.get("X-Content-Type-Options"),
                "nosniff",
                f"Missing or invalid X-Content-Type-Options on {ep}",
            )
            self.assertEqual(
                res.headers.get("X-Frame-Options"),
                "DENY",
                f"Missing or invalid X-Frame-Options on {ep}",
            )
            self.assertEqual(
                res.headers.get("Referrer-Policy"),
                "strict-origin-when-cross-origin",
                f"Missing or invalid Referrer-Policy on {ep}",
            )
            self.assertEqual(
                res.headers.get("Permissions-Policy"),
                "geolocation=(), microphone=(), camera=()",
                f"Missing or invalid Permissions-Policy on {ep}",
            )

    # -------------------------------------------------------------
    # 2. Sliding-Window Rate Limiting Protection
    # -------------------------------------------------------------
    def test_02_rate_limiting_enforcement(self):
        """Verify rapid repeated calls trigger HTTP 429 Too Many Requests."""
        # Clear existing rate limit records for a pristine test
        with _rate_limit_lock:
            _rate_limit_records.clear()

        # Route limit for /api/auth/login is 30 requests within 60s
        # Fire 32 requests without the bypass header
        status_codes = []
        for _ in range(32):
            res = client.post(
                "/api/auth/login",
                json={"username_or_email": "test_burst_user", "password": "DummyPassword123!"},
            )
            status_codes.append(res.status_code)

        # The 31st and 32nd requests must be rate-limited (HTTP 429)
        self.assertEqual(
            status_codes[-1],
            429,
            f"Expected HTTP 429 after 30 requests, got {status_codes[-1]}",
        )

        # Verify rate limit error message and Retry-After header
        res_429 = client.post(
            "/api/auth/login",
            json={"username_or_email": "test_burst_user", "password": "DummyPassword123!"},
        )
        self.assertEqual(res_429.status_code, 429)
        self.assertIn("detail", res_429.json())
        self.assertIn("Rate limit exceeded", res_429.json()["detail"])
        self.assertIn("Retry-After", res_429.headers)

        # Verify that providing X-Test-Bypass-Rate-Limit: 1 bypasses the limiter
        res_bypass = client.post(
            "/api/auth/login",
            json={"username_or_email": "test_burst_user", "password": "DummyPassword123!"},
            headers={"X-Test-Bypass-Rate-Limit": "1"},
        )
        # Should return 401 Unauthorized (user not found), NOT 429
        self.assertEqual(res_bypass.status_code, 401)

        # Clean up records after test
        with _rate_limit_lock:
            _rate_limit_records.clear()

    # -------------------------------------------------------------
    # 3. File Upload Security, Extension Rejection & Path Traversal Guard
    # -------------------------------------------------------------
    def test_03_file_upload_security_and_traversal(self):
        """Verify executable rejection, binary detection, and path traversal sanitization."""
        headers = self.auth_headers("INVESTIGATOR")
        # Remove Content-Type so requests can set multipart boundary properly
        headers.pop("Content-Type", None)

        # 3a. Dangerous executable extensions rejection (.exe, .bat, .sh, .ps1, .dll)
        dangerous_extensions = ["malware.exe", "exploit.bat", "reverse_shell.sh", "payload.ps1", "hook.dll"]
        for bad_filename in dangerous_extensions:
            file_payload = {"file": (bad_filename, io.BytesIO(b"echo Dangerous payload"), "application/octet-stream")}
            res = client.post(
                "/api/import/file",
                files=file_payload,
                headers=headers,
            )
            self.assertEqual(
                res.status_code,
                400,
                f"Failed to reject dangerous extension {bad_filename}: {res.text}",
            )
            self.assertIn("Executable or script files are strictly rejected", res.json()["detail"])

        # 3b. Binary file rejection
        binary_payload = {"file": ("corrupt_data.csv", io.BytesIO(b"\x00\x01\x02\x03\x04\x05\x00"), "text/csv")}
        res_bin = client.post(
            "/api/import/file",
            files=binary_payload,
            headers=headers,
        )
        self.assertEqual(res_bin.status_code, 400)
        self.assertIn("Binary file format detected", res_bin.json()["detail"])

        # 3c. Directory traversal attempt in filename (../../../../etc/passwd.csv)
        valid_csv = "entity_id,entity_type,entity_name\nQA-ENT-01,Person,SafeEntity\n"
        traversal_payload = {
            "file": ("../../../../etc/passwd.csv", io.BytesIO(valid_csv.encode("utf-8")), "text/csv")
        }
        res_trav = client.post(
            "/api/import/file",
            files=traversal_payload,
            data={"case_id": "case-001"},
            headers=headers,
        )
        self.assertEqual(res_trav.status_code, 200, f"Valid CSV payload with traversal name failed: {res_trav.text}")
        data = res_trav.json()
        self.assertGreaterEqual(data["imported_entities"], 1)
        self.assertIsNotNone(data["evidence_id"])
        # Verify evidence label in database has stripped path elements
        db = SessionLocal()
        try:
            ev = db.query(EvidenceDB).filter(EvidenceDB.evidence_id == data["evidence_id"]).first()
            self.assertIsNotNone(ev)
            self.assertNotIn("/", ev.filename)
            self.assertNotIn("\\", ev.filename)
            self.assertIn("passwd.csv", ev.original_filename)
        finally:
            db.close()

    # -------------------------------------------------------------
    # 4. Global Exception Handling & Information Leak Prevention
    # -------------------------------------------------------------
    def test_04_global_exception_handling(self):
        """Ensure unhandled errors and invalid routes return clean JSON without leaking stack traces."""
        # 4a. 404 for non-existent route
        res_404 = client.get("/api/non_existent_security_endpoint", headers={"X-Test-Bypass-Rate-Limit": "1"})
        self.assertEqual(res_404.status_code, 404)
        self.assertIn("detail", res_404.json())
        self.assertNotIn("Traceback", res_404.text)
        self.assertNotIn("postgresql://", res_404.text)

        # 4b. 422 for malformed body
        res_422 = client.post(
            "/api/auth/login",
            json={"invalid_key": 123},
            headers={"X-Test-Bypass-Rate-Limit": "1"},
        )
        self.assertEqual(res_422.status_code, 422)
        self.assertNotIn("Traceback", res_422.text)

    # -------------------------------------------------------------
    # 5. Role-Based Access Control (RBAC) 6-Role Matrix
    # -------------------------------------------------------------
    def test_05_rbac_enforcement_matrix(self):
        """Verify strict server-side RBAC authorization boundaries across all 6 roles."""
        # 5a. VIEWER: Read-only access
        viewer_headers = self.auth_headers("VIEWER")
        res_view_cases = client.get("/api/cases", headers=viewer_headers)
        self.assertEqual(res_view_cases.status_code, 200)

        res_view_create = client.post(
            "/api/cases",
            json={"case_name": "Viewer Forbidden Case", "description": "Should fail"},
            headers=viewer_headers,
        )
        self.assertEqual(res_view_create.status_code, 403)
        self.assertIn("Access Denied", res_view_create.json()["detail"])

        res_view_import = client.post(
            "/api/import",
            json={"content": "id,type,name\n1,Person,Alice", "type": "csv"},
            headers=viewer_headers,
        )
        self.assertEqual(res_view_import.status_code, 403)

        # 5b. ANALYST: Cannot delete cases, cannot manage users
        analyst_headers = self.auth_headers("ANALYST")
        res_analyst_del = client.delete("/api/cases/case-001", headers=analyst_headers)
        self.assertEqual(res_analyst_del.status_code, 403)

        res_analyst_users = client.get("/api/admin/users", headers=analyst_headers)
        self.assertEqual(res_analyst_users.status_code, 403)

        # 5c. INVESTIGATOR: Can create cases & import, cannot access admin panel
        inv_headers = self.auth_headers("INVESTIGATOR")
        res_inv_admin = client.get("/api/admin/users", headers=inv_headers)
        self.assertEqual(res_inv_admin.status_code, 403)

        # 5d. REVIEWER: Can view & review validation, cannot access admin user management
        rev_headers = self.auth_headers("REVIEWER")
        res_rev_admin = client.get("/api/admin/users", headers=rev_headers)
        self.assertEqual(res_rev_admin.status_code, 403)

        # 5e. ADMIN: Cannot modify or suspend SUPER_ADMIN account
        admin_headers = self.auth_headers("ADMIN")
        # Try to modify super_admin user
        db = SessionLocal()
        try:
            superadmin_user = db.query(UserDB).filter(UserDB.username == "superadmin").first()
            self.assertIsNotNone(superadmin_user)
            superadmin_id = superadmin_user.user_id
        finally:
            db.close()

        res_admin_modify_super = client.put(
            f"/api/admin/users/{superadmin_id}",
            json={"name": "Tampered Name"},
            headers=admin_headers,
        )
        self.assertEqual(res_admin_modify_super.status_code, 403)
        self.assertIn("Cannot modify a Super Admin", res_admin_modify_super.json()["detail"])

        # 5f. SUPER_ADMIN: Can access admin panel and view users
        super_headers = self.auth_headers("SUPER_ADMIN")
        res_super_users = client.get("/api/admin/users", headers=super_headers)
        self.assertEqual(res_super_users.status_code, 200)
        users = res_super_users.json()
        self.assertGreaterEqual(len(users), 6)

    # -------------------------------------------------------------
    # 6. End-to-End Investigation Lifecycle
    # -------------------------------------------------------------
    def test_06_end_to_end_investigation_lifecycle(self):
        """
        Executes a complete 10-step investigative lifecycle:
        1. Authenticate investigator
        2. Create a new case
        3. Ingest multi-vector evidence
        4. Query graph nodes and edges
        5. Run graph analytics & centrality
        6. Detect suspicious patterns
        7. Generate investigative leads
        8. Add investigative field note
        9. Validate entity via Reviewer role
        10. Verify audit trail and clean up
        """
        inv_headers = self.auth_headers("INVESTIGATOR")
        rev_headers = self.auth_headers("REVIEWER")

        # Step 1: Create a dedicated test case
        case_payload = {
            "case_name": f"QA_E2E_CASE_{int(time.time())}",
            "description": "End-to-End Production Acceptance Test Case",
            "priority": "HIGH",
            "case_type": "FINANCIAL_FRAUD",
        }
        res_create = client.post("/api/cases", json=case_payload, headers=inv_headers)
        self.assertEqual(res_create.status_code, 200, f"Case creation failed: {res_create.text}")
        case_data = res_create.json()
        case_id = case_data["case_id"]
        self.assertTrue(case_id.startswith("case-"))

        try:
            # Step 2: Ingest structured evidence CSV into this case
            csv_data = (
                "record_type,id,type,name,source,target,relation_type,weight\n"
                "entity,QA-P1,Person,Vikram Malhotra,,,,\n"
                "entity,QA-C1,Company,Nexus Shell LLC,,,,\n"
                "entity,QA-B1,Bank_Account,ACC-449911,,,,\n"
                "entity,QA-W1,Crypto_Wallet,WAL-BTC-007,,,,\n"
                "relationship,,,,QA-P1,QA-C1,DIRECTOR_OF,0.95\n"
                "relationship,,,,QA-C1,QA-B1,HOLDS_ACCOUNT,0.90\n"
                "relationship,,,,QA-B1,QA-W1,TRANSFERRED_FUNDS,0.85\n"
                "relationship,,,,QA-W1,QA-P1,BENEFICIARY_OF,0.88\n"
            )
            res_import = client.post(
                "/api/import",
                json={"content": csv_data, "type": "csv", "source_label": "e2e_evidence.csv", "case_id": case_id},
                headers=inv_headers,
            )
            self.assertEqual(res_import.status_code, 200, f"Evidence import failed: {res_import.text}")
            import_result = res_import.json()
            self.assertGreaterEqual(import_result["imported_entities"], 4)
            self.assertGreaterEqual(import_result["imported_relationships"], 4)
            self.assertIsNotNone(import_result["evidence_id"])

            # Switch active working case to the newly created case
            res_switch = client.post(f"/api/cases/{case_id}/switch", headers=inv_headers)
            self.assertEqual(res_switch.status_code, 200)

            # Step 3: Query graph nodes and relationships
            res_graph = client.get("/api/graph", headers=inv_headers)
            self.assertEqual(res_graph.status_code, 200)
            graph_data = res_graph.json()
            node_ids = [n["id"] for n in graph_data["nodes"]]
            self.assertIn("QA-P1", node_ids)
            self.assertIn("QA-C1", node_ids)
            self.assertIn("QA-B1", node_ids)
            self.assertIn("QA-W1", node_ids)

            # Step 4: Run graph centrality computation
            res_centrality = client.get("/api/graph/centrality", headers=inv_headers)
            self.assertEqual(res_centrality.status_code, 200)
            centrality_data = res_centrality.json()
            self.assertIsInstance(centrality_data, list)
            self.assertGreaterEqual(len(centrality_data), 4)

            # Step 5: Detect suspicious patterns (e.g., circular fund flow)
            res_patterns = client.get(f"/api/cases/{case_id}/patterns", headers=inv_headers)
            self.assertEqual(res_patterns.status_code, 200)
            patterns = res_patterns.json()
            self.assertIsInstance(patterns, list)

            # Step 6: Generate and verify investigative leads
            res_leads = client.get(f"/api/cases/{case_id}/leads", headers=inv_headers)
            self.assertEqual(res_leads.status_code, 200)
            leads = res_leads.json()
            self.assertIsInstance(leads, list)

            # Step 7: Add an investigative field note
            note_payload = {"note_text": "Investigative Lead Note: Identified circular transaction loop through Nexus Shell LLC."}
            res_note = client.post(f"/api/cases/{case_id}/notes", json=note_payload, headers=inv_headers)
            self.assertEqual(res_note.status_code, 200)
            note_data = res_note.json()
            self.assertEqual(note_data["note_text"], note_payload["note_text"])

            # Step 8: Verify notes retrieval
            res_get_notes = client.get(f"/api/cases/{case_id}/notes", headers=inv_headers)
            self.assertEqual(res_get_notes.status_code, 200)
            notes_list = res_get_notes.json()
            self.assertGreaterEqual(len(notes_list), 1)

            # Step 9: Reviewer validation workflow
            res_val = client.get(f"/api/cases/{case_id}/validation", headers=rev_headers)
            self.assertEqual(res_val.status_code, 200)
            val_records = res_val.json()
            if val_records:
                target_val = val_records[0]
                rec_id = target_val["record_id"]
                res_review = client.post(
                    f"/api/cases/{case_id}/validation/{rec_id}/review",
                    json={"action": "approve", "reviewer_notes": "Verified against banking registry."},
                    headers=rev_headers,
                )
                self.assertEqual(res_review.status_code, 200)
                self.assertEqual(res_review.json()["status"], "APPROVED")

        finally:
            # Step 10: Clean up test case and verify clean cascade deletion
            # Investigator cannot delete case (must be Admin)
            res_inv_del = client.delete(f"/api/cases/{case_id}", headers=inv_headers)
            self.assertEqual(res_inv_del.status_code, 403)

            # Admin can delete case
            admin_headers = self.auth_headers("ADMIN")
            res_del = client.delete(f"/api/cases/{case_id}", headers=admin_headers)
            self.assertEqual(res_del.status_code, 200)
            # Confirm case is no longer found
            res_check = client.get(f"/api/cases/{case_id}", headers=inv_headers)
            self.assertEqual(res_check.status_code, 404)

    # -------------------------------------------------------------
    # 7. PostgreSQL Persistence & Durability across Connection Resets
    # -------------------------------------------------------------
    def test_07_postgresql_durability(self):
        """Verify real relational PostgreSQL persistence survives session/connection closes."""
        db_first = SessionLocal()
        test_case_id = f"case-test-durability-{int(time.time())}"
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            # Create a test case directly in PostgreSQL
            new_case = CaseDB(
                case_id=test_case_id,
                case_name="PostgreSQL Durability Test",
                description="Testing durability across SQLAlchemy connection resets",
                priority="CRITICAL",
                status="ACTIVE",
                investigation_type="CORRUPTION",
                created_at=now_str,
                updated_at=now_str,
            )
            db_first.add(new_case)
            db_first.commit()
        finally:
            db_first.close()

        # Simulate complete connection reset / worker restart
        db_second = SessionLocal()
        try:
            persisted_case = db_second.query(CaseDB).filter(CaseDB.case_id == test_case_id).first()
            self.assertIsNotNone(persisted_case, "Failed to persist CaseDB in PostgreSQL across connection reset")
            self.assertEqual(persisted_case.case_name, "PostgreSQL Durability Test")
            self.assertEqual(persisted_case.priority, "CRITICAL")
            self.assertEqual(persisted_case.investigation_type, "CORRUPTION")

            # Clean up
            db_second.delete(persisted_case)
            db_second.commit()
        finally:
            db_second.close()

    # -------------------------------------------------------------
    # 8. High-Density Graph Analytics & Clique Cutoff Performance Guard
    # -------------------------------------------------------------
    def test_08_dense_graph_analytics_and_clique_guard(self):
        """
        Verify that a dense graph with >100 entities and >400 edges runs pattern detection
        in under 5 seconds without recursive Bron-Kerbosch exponential hang.
        """
        inv_headers = self.auth_headers("INVESTIGATOR")
        case_payload = {
            "case_name": f"QA_DENSE_TEST_{int(time.time())}",
            "description": "Performance and Clique Cutoff Stress Test",
            "priority": "MEDIUM",
            "case_type": "CYBER_FRAUD",
        }
        res_create = client.post("/api/cases", json=case_payload, headers=inv_headers)
        self.assertEqual(res_create.status_code, 200)
        case_id = res_create.json()["case_id"]

        try:
            # Generate synthetic dense graph CSV (120 nodes, ~480 edges)
            csv_lines = ["record_type,id,type,name,source,target,relation_type,weight"]
            for i in range(1, 121):
                csv_lines.append(f"entity,ST-ENT-{i},Person,Entity {i},,,,")
            for i in range(1, 121):
                target = (i % 120) + 1
                csv_lines.append(f"relationship,,,,ST-ENT-{i},ST-ENT-{target},COMMUNICATES_WITH,0.8")
                if i % 5 == 0:
                    for k in range(1, 6):
                        cross_target = ((i + k * 7) % 120) + 1
                        csv_lines.append(f"relationship,,,,ST-ENT-{i},ST-ENT-{cross_target},TRANSACTS_WITH,0.9")

            dense_csv = "\n".join(csv_lines)
            res_import = client.post(
                "/api/import",
                json={"content": dense_csv, "type": "csv", "case_id": case_id, "source_label": "dense_stress.csv"},
                headers=inv_headers,
            )
            self.assertEqual(res_import.status_code, 200)

            # Measure pattern detection latency
            t0 = time.time()
            res_patterns = client.get(f"/api/cases/{case_id}/patterns", headers=inv_headers)
            elapsed = time.time() - t0

            self.assertEqual(res_patterns.status_code, 200)
            self.assertLess(
                elapsed,
                5.0,
                f"Pattern detection took {elapsed:.2f}s (exceeded 5.0s limit; clique cutoff guard failed)",
            )
        finally:
            admin_headers = self.auth_headers("ADMIN")
            client.delete(f"/api/cases/{case_id}", headers=admin_headers)

    # -------------------------------------------------------------
    # 9. Cryptographic SHA-256 Audit Trail Integrity & Tamper Detection
    # -------------------------------------------------------------
    def test_09_cryptographic_audit_integrity_and_tamper_detection(self):
        """Verify audit hash chain verification passes and immediately detects injected tampering."""
        # 9a. Verify initial ledger state is cryptographically valid
        initial_check = verify_audit_integrity()
        self.assertTrue(initial_check["valid"], f"Audit trail failed initial integrity check: {initial_check}")

        # 9b. Add a known test audit entry
        test_audit = record_audit(
            actor_name="SuperAdmin QA Tester",
            action="QA_INTEGRITY_CHECKPOINT",
            details="Verifying cryptographic hash chain validity",
            case_id="case-001",
            actor_id="USR-QA-TEST",
            actor_role="SUPER_ADMIN",
        )
        self.assertTrue(test_audit["audit_id"].startswith("AUD-"))
        audit_id = test_audit["audit_id"]

        # 9c. Verify ledger remains valid
        post_add_check = verify_audit_integrity()
        self.assertTrue(post_add_check["valid"])

        # 9d. Tamper with the record content in PostgreSQL to simulate unauthorized database alteration
        db = SessionLocal()
        original_action = None
        try:
            tamper_rec = db.query(AuditLogDB).filter(AuditLogDB.audit_id == audit_id).first()
            self.assertIsNotNone(tamper_rec)
            original_action = tamper_rec.action
            # Tamper the action without updating the cryptographic hash
            tamper_rec.action = "TAMPERED_MALICIOUS_ACTION"
            db.commit()
        finally:
            db.close()

        # 9e. Verify audit verification detects the tampering
        tamper_check = verify_audit_integrity()
        self.assertFalse(tamper_check["valid"], "Audit integrity verification failed to detect record tampering!")
        self.assertEqual(tamper_check["broken_at"], audit_id)

        # 9f. Revert the tamper to restore pristine ledger state
        db = SessionLocal()
        try:
            revert_rec = db.query(AuditLogDB).filter(AuditLogDB.audit_id == audit_id).first()
            if revert_rec and original_action:
                revert_rec.action = original_action
                db.commit()
        finally:
            db.close()

        # 9g. Verify ledger is valid again
        restored_check = verify_audit_integrity()
        self.assertTrue(restored_check["valid"], "Audit trail remained invalid after restoring record.")


if __name__ == "__main__":
    unittest.main()
