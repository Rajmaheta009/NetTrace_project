"""
Test Suite: Case-First Workflow & User-Friendly Case Management
Verifies:
1. Sequential automatic case numbering (CASE-{YEAR}-{NNNN})
2. Automatic creator assignment as CASE_OWNER
3. Strict validation: empty Case Name rejection (HTTP 400)
4. Multi-factor search, status, type, and priority filtering on GET /api/cases
5. Ingestion authorization check (HTTP 403 when unassigned)
6. GET /api/cases/active handles assigned vs unassigned users safely
"""

import unittest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.case_store import case_manager
from app.database import SessionLocal, UserDB, RoleDB, UserRoleDB, CaseUserDB, CaseDB
from app.auth import create_access_token, hash_password


class TestCaseFirstWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        now_str = datetime.now().isoformat()
        db = SessionLocal()
        try:
            # Create a dedicated investigator
            cls.inv_username = f"inv_casefirst_{datetime.now().strftime('%H%M%S')}"
            cls.inv_id = f"USR-{cls.inv_username.upper()}"
            inv_user = UserDB(
                id=cls.inv_id,
                username=cls.inv_username,
                email=f"{cls.inv_username}@nettrace.internal",
                password_hash=hash_password("InvestigatorPass!2026"),
                full_name="Inspector Ananya Sen",
                department="Cyber Forensics",
                designation="Senior Investigator",
                status="ACTIVE",
                role="INVESTIGATOR",
                created_at=now_str,
                updated_at=now_str,
            )
            db.add(inv_user)
            db.flush()

            role_rec = db.query(RoleDB).filter(RoleDB.name == "INVESTIGATOR").first()
            if role_rec:
                db.add(UserRoleDB(user_id=inv_user.id, role_id=role_rec.id))
            db.commit()

            cls.inv_token = create_access_token({
                "sub": cls.inv_id,
                "role": "INVESTIGATOR",
                "roles": ["INVESTIGATOR"],
                "name": "Inspector Ananya Sen",
            })
            cls.inv_headers = {"Authorization": f"Bearer {cls.inv_token}"}

            # Create a second investigator with no cases initially
            cls.fresh_username = f"fresh_user_{datetime.now().strftime('%H%M%S')}"
            cls.fresh_id = f"USR-{cls.fresh_username.upper()}"
            fresh_user = UserDB(
                id=cls.fresh_id,
                username=cls.fresh_username,
                email=f"{cls.fresh_username}@nettrace.internal",
                password_hash=hash_password("FreshUserPass!2026"),
                full_name="Officer Fresh Onboarding",
                department="General Intelligence",
                designation="Junior Investigator",
                status="ACTIVE",
                role="INVESTIGATOR",
                created_at=now_str,
                updated_at=now_str,
            )
            db.add(fresh_user)
            db.flush()
            if role_rec:
                db.add(UserRoleDB(user_id=fresh_user.id, role_id=role_rec.id))
            db.commit()

            cls.fresh_token = create_access_token({
                "sub": cls.fresh_id,
                "role": "INVESTIGATOR",
                "roles": ["INVESTIGATOR"],
                "name": "Officer Fresh Onboarding",
            })
            cls.fresh_headers = {"Authorization": f"Bearer {cls.fresh_token}"}

        finally:
            db.close()

    def test_01_automatic_sequential_case_numbering_and_owner_assignment(self):
        """Test sequential automatic case numbering CASE-YYYY-NNNN and CASE_OWNER role."""
        year = datetime.now().year

        # Create first case
        res1 = self.client.post(
            "/api/cases",
            json={
                "case_name": "Operation Golden Falcon",
                "description": "Cross-border illicit hawala network investigation",
                "investigation_type": "financial_fraud",
                "priority": "Critical",
            },
            headers=self.inv_headers,
        )
        self.assertEqual(res1.status_code, 200, res1.text)
        data1 = res1.json()
        case_id1 = data1["case_id"]

        self.assertTrue(
            case_id1.startswith(f"CASE-{year}-"),
            f"Expected ID starting with CASE-{year}-, got {case_id1}",
        )
        self.assertEqual(data1["case_name"], "Operation Golden Falcon")
        self.assertEqual(data1["priority"], "Critical")

        # Verify creator is recorded as CASE_OWNER in database
        db = SessionLocal()
        try:
            assignment = db.query(CaseUserDB).filter(
                CaseUserDB.case_id == case_id1,
                CaseUserDB.user_id == self.inv_id,
            ).first()
            self.assertIsNotNone(assignment, "Creator should be assigned to the new case")
            self.assertEqual(assignment.case_role, "CASE_OWNER")
        finally:
            db.close()

        # Create second case and verify sequence increments
        res2 = self.client.post(
            "/api/cases",
            json={
                "case_name": "Operation Silver Phoenix",
                "description": "Counter-narcotics syndicate tracking",
                "investigation_type": "drug_trafficking",
                "priority": "High",
            },
            headers=self.inv_headers,
        )
        self.assertEqual(res2.status_code, 200, res2.text)
        data2 = res2.json()
        case_id2 = data2["case_id"]

        self.assertTrue(case_id2.startswith(f"CASE-{year}-"))
        num1 = int(case_id1.split("-")[-1])
        num2 = int(case_id2.split("-")[-1])
        self.assertEqual(num2, num1 + 1, f"Expected sequential ID: {num1} -> {num2}")

    def test_02_case_name_validation(self):
        """Reject empty or whitespace-only Case Name with HTTP 400."""
        # Empty string
        res = self.client.post(
            "/api/cases",
            json={"case_name": "", "description": "No name"},
            headers=self.inv_headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Case Name is required", res.json()["detail"])

        # Whitespace only
        res2 = self.client.post(
            "/api/cases",
            json={"case_name": "   \t\n  ", "description": "Spaces"},
            headers=self.inv_headers,
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn("Case Name is required", res2.json()["detail"])

    def test_03_list_cases_search_and_filters(self):
        """Test multi-factor search, status, type, and priority filtering."""
        # Search by keyword
        res_search = self.client.get(
            "/api/cases?search=Golden Falcon",
            headers=self.inv_headers,
        )
        self.assertEqual(res_search.status_code, 200)
        items = res_search.json()
        self.assertTrue(any("Golden Falcon" in c["case_name"] for c in items))

        # Filter by priority
        res_prio = self.client.get(
            "/api/cases?priority=Critical",
            headers=self.inv_headers,
        )
        self.assertEqual(res_prio.status_code, 200)
        items = res_prio.json()
        for c in items:
            self.assertEqual(c["priority"].lower(), "critical")

        # Filter by investigation profile
        res_type = self.client.get(
            "/api/cases?investigation_type=financial_fraud",
            headers=self.inv_headers,
        )
        self.assertEqual(res_type.status_code, 200)
        items = res_type.json()
        for c in items:
            self.assertEqual(c["investigation_type"].lower(), "financial_fraud")

    def test_04_import_authorization_enforcement(self):
        """Verify that importing data into a case the user is NOT assigned to returns HTTP 403."""
        # Create a private case with inv_user
        res_create = self.client.post(
            "/api/cases",
            json={"case_name": "Top Secret Syndicate Investigation"},
            headers=self.inv_headers,
        )
        self.assertEqual(res_create.status_code, 200)
        target_case_id = res_create.json()["case_id"]

        # fresh_user is NOT assigned to target_case_id
        csv_payload = (
            "record_type,id,type,name,source,target,relation_type,weight\n"
            "entity,P-01,Person,Suspect Alpha,,,,\n"
            "entity,C-01,Company,Front Shell Corp,,,,\n"
            "relationship,,,,P-01,C-01,DIRECTOR_OF,0.95\n"
        )
        res_unauthorized = self.client.post(
            "/api/import",
            json={
                "content": csv_payload,
                "type": "csv",
                "case_id": target_case_id,
            },
            headers=self.fresh_headers,
        )
        self.assertEqual(res_unauthorized.status_code, 403)
        self.assertIn("Access Denied", res_unauthorized.json()["detail"])

        # inv_user IS assigned to target_case_id, so import succeeds
        res_authorized = self.client.post(
            "/api/import",
            json={
                "content": csv_payload,
                "type": "csv",
                "case_id": target_case_id,
            },
            headers=self.inv_headers,
        )
        self.assertEqual(res_authorized.status_code, 200, res_authorized.text)

    def test_05_fresh_user_with_no_cases(self):
        """A user with no assigned cases gets an empty case list and a clear 404 from active endpoint."""
        # fresh_user has no cases assigned
        res_cases = self.client.get("/api/cases", headers=self.fresh_headers)
        self.assertEqual(res_cases.status_code, 200)
        cases_list = res_cases.json()
        self.assertEqual(len(cases_list), 0, "Fresh user should have 0 authorized cases initially")

        # GET /api/cases/active should return 404 for fresh user with 0 assigned cases
        res_active = self.client.get("/api/cases/active", headers=self.fresh_headers)
        self.assertEqual(res_active.status_code, 404)
        self.assertIn("No active or assigned case found", res_active.json()["detail"])


if __name__ == "__main__":
    unittest.main()
