import os
import sys
import unittest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app.main import app
from app.auth import set_active_session_role
from app.models import UserRole
from app.audit_logger import record_audit, get_inspector_factual_indicators

client = TestClient(app)

class TestFeaturesEnhancement(unittest.TestCase):
    def setUp(self):
        set_active_session_role(UserRole.SUPER_ADMIN)

    def test_01_graph_neighborhood_depth_1(self):
        resp = client.get("/api/graph/neighborhood?depth=1")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("nodes", data)
        self.assertIn("links", data)
        self.assertIn("focal_entity_id", data)
        self.assertEqual(data.get("depth"), 1)
        self.assertIn("total_case_nodes", data)

    def test_02_graph_neighborhood_depth_2_and_3(self):
        # Fetch focal node
        n1 = client.get("/api/graph/neighborhood?depth=1").json()
        focal_id = n1.get("focal_entity_id")
        if focal_id:
            resp2 = client.get(f"/api/graph/neighborhood?entity_id={focal_id}&depth=2")
            self.assertEqual(resp2.status_code, 200)
            data2 = resp2.json()
            self.assertEqual(data2.get("depth"), 2)
            self.assertGreaterEqual(len(data2.get("nodes", [])), len(n1.get("nodes", [])))

            resp3 = client.get(f"/api/graph/neighborhood?entity_id={focal_id}&depth=3")
            self.assertEqual(resp3.status_code, 200)
            self.assertEqual(resp3.json().get("depth"), 3)

    def test_03_audit_activity_paginated(self):
        resp = client.get("/api/audit/activity?page=1&page_size=10")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("records", data)
        self.assertIn("total", data)
        self.assertIn("page", data)
        self.assertEqual(data.get("page"), 1)

    def test_04_audit_inspector_indicators(self):
        # Record sample events to test factual indicators
        record_audit(
            actor_name="Test Officer",
            actor_id="USR-TEST-01",
            actor_role="INVESTIGATOR",
            action="login_failed",
            details="Bad password",
            result="FAILED",
        )
        record_audit(
            actor_name="Test Officer",
            actor_id="USR-TEST-01",
            actor_role="INVESTIGATOR",
            action="permission_denied",
            details="Denied role",
            result="DENIED",
        )
        record_audit(
            actor_name="Test Officer",
            actor_id="USR-TEST-01",
            actor_role="INVESTIGATOR",
            action="export_dossier",
            details="Exported case dossier",
            result="SUCCESS",
        )

        resp = client.get("/api/audit/inspector-indicators")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("summary", data)
        self.assertIn("factual_indicators", data)
        self.assertIn("inspectors", data)
        summary = data["summary"]
        self.assertGreaterEqual(summary["failed_login_attempts"], 1)
        self.assertGreaterEqual(summary["permission_errors"], 1)
        self.assertGreaterEqual(summary["large_data_exports"], 1)

    def test_05_failed_login_creates_audit_record(self):
        # Intentionally attempt invalid login
        client.post(
            "/api/auth/login",
            json={"username_or_email": "invalid_user_999", "password": "wrongpassword!"},
            headers={"X-Test-Bypass-Rate-Limit": "1"},
        )
        # Verify it appears in audit activity
        resp = client.get("/api/audit/activity?action=login_failed&status=FAILED")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["total"], 0)

if __name__ == "__main__":
    unittest.main()
