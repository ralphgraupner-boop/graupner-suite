"""
Test Berechtigungssystem (Permissions Management System)
Tests for iteration 34 - User permissions for Mitarbeiter module areas
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"
BUCHHALTUNG_USER = "h.bolanka"
BUCHHALTUNG_PASS = "Buch$2026!Grau"


class TestBerechtigungenBackend:
    """Test permissions backend API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_admin_token(self):
        """Login as admin and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USER,
            "password": ADMIN_PASS
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")
    
    def get_buchhaltung_token(self):
        """Login as buchhaltung user and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": BUCHHALTUNG_USER,
            "password": BUCHHALTUNG_PASS
        })
        assert response.status_code == 200, f"Buchhaltung login failed: {response.text}"
        return response.json().get("token")
    
    # ==================== AUTH/ME TESTS ====================
    
    def test_admin_login_returns_berechtigungen(self):
        """Test that /auth/me returns berechtigungen object for admin"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify berechtigungen object exists
        assert "berechtigungen" in data, "berechtigungen field missing from /auth/me response"
        berechtigungen = data["berechtigungen"]
        
        # Admin should have all permissions = True
        expected_keys = [
            "mitarbeiter_stammdaten",
            "mitarbeiter_lohn",
            "mitarbeiter_urlaub",
            "mitarbeiter_krankmeldungen",
            "mitarbeiter_dokumente",
            "mitarbeiter_fortbildungen",
            "mitarbeiter_anlegen_loeschen"
        ]
        for key in expected_keys:
            assert key in berechtigungen, f"Missing permission key: {key}"
            assert berechtigungen[key] == True, f"Admin should have {key}=True"
        
        print(f"PASS: Admin /auth/me returns berechtigungen with all True")
    
    def test_buchhaltung_login_returns_berechtigungen(self):
        """Test that /auth/me returns berechtigungen object for buchhaltung user"""
        token = self.get_buchhaltung_token()
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify berechtigungen object exists
        assert "berechtigungen" in data, "berechtigungen field missing from /auth/me response"
        berechtigungen = data["berechtigungen"]
        
        # Buchhaltung defaults: all true except mitarbeiter_anlegen_loeschen
        assert berechtigungen.get("mitarbeiter_stammdaten") == True
        assert berechtigungen.get("mitarbeiter_lohn") == True
        assert berechtigungen.get("mitarbeiter_urlaub") == True
        assert berechtigungen.get("mitarbeiter_krankmeldungen") == True
        assert berechtigungen.get("mitarbeiter_dokumente") == True
        assert berechtigungen.get("mitarbeiter_fortbildungen") == True
        # This should be False by default for buchhaltung
        assert berechtigungen.get("mitarbeiter_anlegen_loeschen") == False, \
            "Buchhaltung should NOT have mitarbeiter_anlegen_loeschen permission by default"
        
        print(f"PASS: Buchhaltung /auth/me returns correct default berechtigungen")
    
    # ==================== GET/PUT BERECHTIGUNGEN TESTS ====================
    
    def test_get_user_berechtigungen_as_admin(self):
        """Test GET /users/{username}/berechtigungen as admin"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/users/{BUCHHALTUNG_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return permissions object
        assert isinstance(data, dict)
        assert "mitarbeiter_stammdaten" in data
        print(f"PASS: Admin can GET berechtigungen for {BUCHHALTUNG_USER}")
    
    def test_get_berechtigungen_forbidden_for_non_admin(self):
        """Test that non-admin cannot GET berechtigungen"""
        token = self.get_buchhaltung_token()
        response = self.session.get(
            f"{BASE_URL}/api/users/{ADMIN_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, "Non-admin should get 403 when accessing berechtigungen"
        print(f"PASS: Non-admin correctly denied access to GET berechtigungen")
    
    def test_update_berechtigungen_as_admin(self):
        """Test PUT /users/{username}/berechtigungen as admin"""
        token = self.get_admin_token()
        
        # First get current permissions
        get_response = self.session.get(
            f"{BASE_URL}/api/users/{BUCHHALTUNG_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"}
        )
        original_perms = get_response.json()
        
        # Toggle one permission
        new_perms = original_perms.copy()
        new_perms["mitarbeiter_fortbildungen"] = not original_perms.get("mitarbeiter_fortbildungen", True)
        
        # Update
        put_response = self.session.put(
            f"{BASE_URL}/api/users/{BUCHHALTUNG_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"},
            json=new_perms
        )
        assert put_response.status_code == 200
        
        # Verify change persisted
        verify_response = self.session.get(
            f"{BASE_URL}/api/users/{BUCHHALTUNG_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"}
        )
        updated_perms = verify_response.json()
        assert updated_perms["mitarbeiter_fortbildungen"] == new_perms["mitarbeiter_fortbildungen"]
        
        # Restore original
        self.session.put(
            f"{BASE_URL}/api/users/{BUCHHALTUNG_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"},
            json=original_perms
        )
        
        print(f"PASS: Admin can update and persist berechtigungen")
    
    def test_update_berechtigungen_forbidden_for_non_admin(self):
        """Test that non-admin cannot PUT berechtigungen"""
        token = self.get_buchhaltung_token()
        response = self.session.put(
            f"{BASE_URL}/api/users/{ADMIN_USER}/berechtigungen",
            headers={"Authorization": f"Bearer {token}"},
            json={"mitarbeiter_stammdaten": False}
        )
        assert response.status_code == 403, "Non-admin should get 403 when updating berechtigungen"
        print(f"PASS: Non-admin correctly denied access to PUT berechtigungen")
    
    # ==================== MITARBEITER PERMISSION ENFORCEMENT TESTS ====================
    
    def test_buchhaltung_can_update_stammdaten(self):
        """Test that buchhaltung user CAN update Mitarbeiter Stammdaten (has permission)"""
        token = self.get_buchhaltung_token()
        
        # First get a mitarbeiter
        list_response = self.session.get(
            f"{BASE_URL}/api/mitarbeiter",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert list_response.status_code == 200
        mitarbeiter = list_response.json()
        
        if len(mitarbeiter) == 0:
            pytest.skip("No mitarbeiter found to test")
        
        ma_id = mitarbeiter[0]["id"]
        
        # Try to update stammdaten (should work - buchhaltung has mitarbeiter_stammdaten=True)
        update_response = self.session.put(
            f"{BASE_URL}/api/mitarbeiter/{ma_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"bemerkungen": "Test update from buchhaltung"}
        )
        assert update_response.status_code == 200, \
            f"Buchhaltung should be able to update stammdaten: {update_response.text}"
        
        print(f"PASS: Buchhaltung can update Mitarbeiter Stammdaten")
    
    def test_buchhaltung_cannot_create_mitarbeiter(self):
        """Test that buchhaltung user CANNOT create new Mitarbeiter (no permission)"""
        token = self.get_buchhaltung_token()
        
        # Try to create new mitarbeiter (should fail - buchhaltung has mitarbeiter_anlegen_loeschen=False)
        create_response = self.session.post(
            f"{BASE_URL}/api/mitarbeiter",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "vorname": "Test",
                "nachname": "Benutzer",
                "personalnummer": "TEST999"
            }
        )
        assert create_response.status_code == 403, \
            f"Buchhaltung should NOT be able to create mitarbeiter: {create_response.text}"
        
        print(f"PASS: Buchhaltung correctly denied creating Mitarbeiter")
    
    def test_buchhaltung_cannot_delete_mitarbeiter(self):
        """Test that buchhaltung user CANNOT delete Mitarbeiter (no permission)"""
        token = self.get_buchhaltung_token()
        
        # Try to delete (should fail even with fake ID)
        delete_response = self.session.delete(
            f"{BASE_URL}/api/mitarbeiter/fake-id-12345",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should get 403 (forbidden) not 404 (not found) - permission check happens first
        assert delete_response.status_code == 403, \
            f"Buchhaltung should NOT be able to delete mitarbeiter: {delete_response.text}"
        
        print(f"PASS: Buchhaltung correctly denied deleting Mitarbeiter")
    
    def test_admin_can_create_mitarbeiter(self):
        """Test that admin CAN create new Mitarbeiter"""
        token = self.get_admin_token()
        
        # Create new mitarbeiter
        create_response = self.session.post(
            f"{BASE_URL}/api/mitarbeiter",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "vorname": "TEST_Perm",
                "nachname": "TestUser",
                "personalnummer": "TESTPERM001"
            }
        )
        assert create_response.status_code == 200, \
            f"Admin should be able to create mitarbeiter: {create_response.text}"
        
        created = create_response.json()
        ma_id = created.get("id")
        
        # Cleanup - delete the test mitarbeiter
        if ma_id:
            self.session.delete(
                f"{BASE_URL}/api/mitarbeiter/{ma_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        print(f"PASS: Admin can create Mitarbeiter")
    
    # ==================== USERS LIST TEST ====================
    
    def test_list_users_includes_both_users(self):
        """Test that /users endpoint returns both admin and h.bolanka"""
        token = self.get_admin_token()
        response = self.session.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        usernames = [u["username"] for u in users]
        assert ADMIN_USER in usernames, f"Admin user not found in users list"
        assert BUCHHALTUNG_USER in usernames, f"Buchhaltung user not found in users list"
        
        print(f"PASS: Users list contains both admin and {BUCHHALTUNG_USER}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
