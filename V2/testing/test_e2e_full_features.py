import unittest
import io
import json
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db_and_seed
from app.auth import create_access_token

class TestFullFeaturesEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db_and_seed()
        cls.client = TestClient(app)
        
        # Super admin token with seeded User ID
        cls.super_admin_token = create_access_token(
            user_id="USR-SADMIN-01",
            username="superadmin",
            roles=["SUPER_ADMIN"],
            permissions=["all:manage", "users:manage", "roles:manage", "audit:view", "cases:read", "cases:write", "graph:write"]
        )
        cls.headers = {"Authorization": f"Bearer {cls.super_admin_token}"}

    def test_01_multi_format_file_uploads(self):
        """Test uploading CSV, JSON, TXT, and XML data to verify multi-format and AI extraction resilience."""
        test_case_id = "case-001"
        
        # 1. CSV File Upload with entities
        csv_content = b"id,type,name,phone\ne101,Person,Vikram Malhotra,+91-9876543210\ne102,Person,Rohit Sharma,+91-9876500000\n"
        res_csv = self.client.post(
            "/api/import/file",
            files={"file": ("entities.csv", io.BytesIO(csv_content), "text/csv")},
            data={"case_id": test_case_id, "source_label": "sample_entities.csv"},
            headers=self.headers,
        )
        self.assertEqual(res_csv.status_code, 200)
        data_csv = res_csv.json()
        self.assertGreater(data_csv["imported_entities"], 0)

        # 2. JSON via /api/import
        json_content = json.dumps({
            "entities": [
                {"name": "SafeHouse-Sector4", "type": "Location"}
            ],
            "relationships": [
                {"source": "Vikram Malhotra", "target": "SafeHouse-Sector4", "relation_type": "VISITED"}
            ]
        })
        res_json = self.client.post(
            "/api/import",
            json={"content": json_content, "source_type": "json", "case_id": test_case_id},
            headers=self.headers,
        )
        self.assertEqual(res_json.status_code, 200)

        # 3. Plain Text / Unstructured Narrative File Upload (Testing AI client resilience & fallback)
        txt_content = b"Suspect Vikram Malhotra was seen entering the warehouse on MG Road in a black sedan MH-12-AB-1234 accompanied by Ananya."
        res_txt = self.client.post(
            "/api/import/file",
            files={"file": ("surveillance_report.txt", io.BytesIO(txt_content), "text/plain")},
            data={"case_id": test_case_id, "source_label": "field_report"},
            headers=self.headers,
        )
        self.assertEqual(res_txt.status_code, 200)

        # 4. XML Upload via /api/import/file
        xml_content = b"<report><suspect>Rohit Sharma</suspect><location>Terminal 2 Airport</location></report>"
        res_xml = self.client.post(
            "/api/import/file",
            files={"file": ("airport_log.xml", io.BytesIO(xml_content), "text/xml")},
            data={"case_id": test_case_id, "source_label": "travel_log"},
            headers=self.headers,
        )
        self.assertEqual(res_xml.status_code, 200)

    def test_02_graph_neighborhood_depth_expansion(self):
        """Test lazy neighborhood loading at Depth 1, 2, and progressive expansion."""
        test_case_id = "case-001"

        # Depth 1: should return focal entity + depth 1 connections
        res_d1 = self.client.get(
            f"/api/graph/neighborhood?case_id={test_case_id}&depth=1&max_nodes=50",
            headers=self.headers,
        )
        self.assertEqual(res_d1.status_code, 200)
        data_d1 = res_d1.json()
        self.assertEqual(data_d1["depth"], 1)
        self.assertIsNotNone(data_d1["focal_entity_id"])
        self.assertGreaterEqual(len(data_d1["nodes"]), 1)
        focal_id = data_d1["focal_entity_id"]

        # Depth 2: expanding around the focal entity
        res_d2 = self.client.get(
            f"/api/graph/neighborhood?case_id={test_case_id}&entity_id={focal_id}&depth=2&max_nodes=50",
            headers=self.headers,
        )
        self.assertEqual(res_d2.status_code, 200)
        data_d2 = res_d2.json()
        self.assertEqual(data_d2["depth"], 2)
        self.assertEqual(data_d2["focal_entity_id"], focal_id)
        # Depth 2 nodes should be >= Depth 1 nodes
        self.assertGreaterEqual(len(data_d2["nodes"]), len(data_d1["nodes"]))

    def test_03_audit_activity_filtering_and_pagination(self):
        """Test audit activity log filtering by role, action, and pagination."""
        res = self.client.get(
            "/api/audit/activity?page=1&page_size=10&sort_order=desc",
            headers=self.headers,
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total", data)
        self.assertIn("records", data)
        self.assertIn("total_pages", data)
        self.assertEqual(data["page"], 1)
        self.assertLessEqual(len(data["records"]), 10)

        # Filter by status = SUCCESS
        res_succ = self.client.get(
            "/api/audit/activity?status=SUCCESS&page_size=5",
            headers=self.headers,
        )
        self.assertEqual(res_succ.status_code, 200)
        for log in res_succ.json().get("records", []):
            self.assertEqual(log["result"], "SUCCESS")

    def test_04_factual_indicators_view(self):
        """Test factual indicator summary for inspector accountability without subjective labels."""
        # Aggregate indicators
        res_agg = self.client.get(
            "/api/audit/inspector-indicators",
            headers=self.headers,
        )
        self.assertEqual(res_agg.status_code, 200)
        data_agg = res_agg.json()
        self.assertIn("summary", data_agg)
        self.assertIn("failed_login_attempts", data_agg["summary"])
        self.assertIn("deleted_records", data_agg["summary"])
        self.assertIn("large_data_exports", data_agg["summary"])
        self.assertIn("permission_errors", data_agg["summary"])
        self.assertIn("successful_operations", data_agg["summary"])
        self.assertIn("factual_indicators", data_agg)

        # Individual inspector indicators
        res_ind = self.client.get(
            "/api/audit/inspector-indicators?user_id=USR-INV-01",
            headers=self.headers,
        )
        self.assertEqual(res_ind.status_code, 200)
        data_ind = res_ind.json()
        self.assertIn("summary", data_ind)
        self.assertIn("failed_login_attempts", data_ind["summary"])
        self.assertIn("factual_indicators", data_ind)

if __name__ == "__main__":
    unittest.main()
