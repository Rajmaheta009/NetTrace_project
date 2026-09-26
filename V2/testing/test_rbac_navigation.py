"""
Unit and Integration Tests for Role-Based Access Control (RBAC),
Navigation Permissions, and Standardized 403 Responses.
"""

import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS


class TestRBACNavigation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_permission_catalog_integrity(self):
        """Ensure all permissions in DEFAULT_ROLE_PERMISSIONS exist in ALL_PERMISSIONS."""
        for role, perms in DEFAULT_ROLE_PERMISSIONS.items():
            for p in perms:
                self.assertIn(
                    p,
                    ALL_PERMISSIONS,
                    f"Permission {p} assigned to role {role} does not exist in ALL_PERMISSIONS catalog."
                )

    def test_role_hierarchy_permissions(self):
        """Verify role hierarchy: Super Admin > Admin > Investigator > Analyst/Reviewer > Viewer."""
        sadmin_perms = set(DEFAULT_ROLE_PERMISSIONS["SUPER_ADMIN"])
        admin_perms = set(DEFAULT_ROLE_PERMISSIONS["ADMIN"])
        inv_perms = set(DEFAULT_ROLE_PERMISSIONS["INVESTIGATOR"])
        ana_perms = set(DEFAULT_ROLE_PERMISSIONS["ANALYST"])
        rev_perms = set(DEFAULT_ROLE_PERMISSIONS["REVIEWER"])
        view_perms = set(DEFAULT_ROLE_PERMISSIONS["VIEWER"])

        # Super Admin has all permissions
        self.assertEqual(sadmin_perms, set(ALL_PERMISSIONS.keys()))

        # Admin has CASE_DELETE, USER_VIEW, but lacks SYSTEM_SETTINGS
        self.assertIn("CASE_DELETE", admin_perms)
        self.assertIn("USER_VIEW", admin_perms)
        self.assertNotIn("SYSTEM_SETTINGS", admin_perms)

        # Investigator can upload evidence and validate, but cannot delete cases or view admin
        self.assertIn("EVIDENCE_UPLOAD", inv_perms)
        self.assertIn("VALIDATION_ACCEPT", inv_perms)
        self.assertNotIn("CASE_DELETE", inv_perms)
        self.assertNotIn("USER_VIEW", inv_perms)

        # Analyst can analyze graph and create notes, but cannot upload or delete
        self.assertIn("GRAPH_ANALYZE", ana_perms)
        self.assertIn("NOTE_CREATE", ana_perms)
        self.assertNotIn("EVIDENCE_UPLOAD", ana_perms)
        self.assertNotIn("CASE_DELETE", ana_perms)
        self.assertNotIn("USER_VIEW", ana_perms)

        # Reviewer can validate, but cannot upload or delete
        self.assertIn("VALIDATION_ACCEPT", rev_perms)
        self.assertIn("VALIDATION_REJECT", rev_perms)
        self.assertNotIn("EVIDENCE_UPLOAD", rev_perms)
        self.assertNotIn("CASE_DELETE", rev_perms)

        # Viewer is read-only
        self.assertNotIn("EVIDENCE_UPLOAD", view_perms)
        self.assertNotIn("CASE_CREATE", view_perms)
        self.assertNotIn("CASE_DELETE", view_perms)
        self.assertNotIn("NOTE_CREATE", view_perms)
        self.assertNotIn("USER_VIEW", view_perms)

    def test_403_standardized_json_response(self):
        """Ensure all 403 responses return the standardized payload with success=False and message."""
        # Viewer attempting to create a case
        headers = {"X-User-Role": "VIEWER"}
        res = self.client.post("/api/cases", json={"case_name": "Unauthorized Test"}, headers=headers)
        self.assertEqual(res.status_code, 403)
        data = res.json()
        self.assertIn("success", data)
        self.assertFalse(data["success"])
        self.assertIn("message", data)
        self.assertIn("detail", data)
        self.assertTrue(len(data["message"]) > 0)

    def test_viewer_role_boundaries(self):
        """Viewer role must receive 403 on all write/admin actions."""
        headers = {"X-User-Role": "VIEWER"}

        # Cannot import data
        res_import = self.client.post("/api/import", json={"content": "data"}, headers=headers)
        self.assertEqual(res_import.status_code, 403)
        self.assertFalse(res_import.json()["success"])

        # Cannot access admin users
        res_admin = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(res_admin.status_code, 403)
        self.assertFalse(res_admin.json()["success"])

        # Cannot clear graph
        res_clear = self.client.post("/api/graph/clear", headers=headers)
        self.assertEqual(res_clear.status_code, 403)

        # Cannot reset graph
        res_reset = self.client.post("/api/graph/reset", headers=headers)
        self.assertEqual(res_reset.status_code, 403)

        # Cannot delete case
        res_del = self.client.delete("/api/cases/case-test", headers=headers)
        self.assertEqual(res_del.status_code, 403)

    def test_analyst_role_boundaries(self):
        """Analyst role can view and analyze, but cannot import, delete cases, or access admin."""
        headers = {"X-User-Role": "ANALYST"}

        # Cannot import
        res_import = self.client.post("/api/import", json={"content": "data"}, headers=headers)
        self.assertEqual(res_import.status_code, 403)

        # Cannot access admin
        res_admin = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(res_admin.status_code, 403)

        # Cannot delete case
        res_del = self.client.delete("/api/cases/case-test", headers=headers)
        self.assertEqual(res_del.status_code, 403)

        # Cannot clear graph
        res_clear = self.client.post("/api/graph/clear", headers=headers)
        self.assertEqual(res_clear.status_code, 403)

    def test_reviewer_role_boundaries(self):
        """Reviewer role can review validation, but cannot import, delete cases, or access admin."""
        headers = {"X-User-Role": "REVIEWER"}

        # Cannot import
        res_import = self.client.post("/api/import", json={"content": "data"}, headers=headers)
        self.assertEqual(res_import.status_code, 403)

        # Cannot access admin
        res_admin = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(res_admin.status_code, 403)

        # Cannot delete case
        res_del = self.client.delete("/api/cases/case-test", headers=headers)
        self.assertEqual(res_del.status_code, 403)

    def test_investigator_role_boundaries(self):
        """Investigator role can import and create cases, but cannot access admin or delete cases."""
        headers = {"X-User-Role": "INVESTIGATOR"}

        # Cannot access admin
        res_admin = self.client.get("/api/admin/users", headers=headers)
        self.assertEqual(res_admin.status_code, 403)

        # Cannot delete case
        res_del = self.client.delete("/api/cases/case-test", headers=headers)
        self.assertEqual(res_del.status_code, 403)

    def test_admin_and_super_admin_privileges(self):
        """Admin and Super Admin can access administrative user and role catalogs."""
        # Admin can access admin endpoints
        admin_hdrs = {"X-User-Role": "ADMIN"}
        res_admin_users = self.client.get("/api/admin/users", headers=admin_hdrs)
        self.assertIn(res_admin_users.status_code, (200, 404))

        res_admin_roles = self.client.get("/api/admin/roles", headers=admin_hdrs)
        self.assertIn(res_admin_roles.status_code, (200, 404))

        # Super Admin can access admin endpoints
        sadmin_hdrs = {"X-User-Role": "SUPER_ADMIN"}
        res_sadmin_users = self.client.get("/api/admin/users", headers=sadmin_hdrs)
        self.assertIn(res_sadmin_users.status_code, (200, 404))


if __name__ == "__main__":
    unittest.main()
