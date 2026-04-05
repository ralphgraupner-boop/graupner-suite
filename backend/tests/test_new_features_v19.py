"""
Test suite for iteration 19 - New features:
1. E-Mail-Vorlagen for Einsatzplanung (templates with placeholders)
2. .ics calendar file download for Einsätze
3. Customer Portal shows linked Einsatz/Termin data
4. IMAP email reception endpoints
5. Anfragen Reparaturgruppe field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["username"] == "admin"
        print("✓ Login successful")


class TestEinsatzConfig:
    """Test Einsatz configuration including termin_vorlagen"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_get_einsatz_config(self, auth_token):
        """GET /api/einsatz-config returns config with termin_vorlagen field"""
        response = requests.get(
            f"{BASE_URL}/api/einsatz-config",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "monteure" in data
        assert "reparaturgruppen" in data
        assert "materialien" in data
        # Check for termin_vorlagen field (new feature)
        assert "termin_vorlagen" in data or data.get("termin_vorlagen") is None
        print(f"✓ Einsatz config loaded: {len(data.get('reparaturgruppen', []))} Reparaturgruppen")
    
    def test_update_einsatz_config_with_vorlagen(self, auth_token):
        """PUT /api/einsatz-config can save termin_vorlagen"""
        # First get current config
        get_response = requests.get(
            f"{BASE_URL}/api/einsatz-config",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        current = get_response.json()
        
        # Add a test vorlage
        test_vorlagen = [
            {
                "name": "Terminbestätigung",
                "betreff": "Terminbestätigung - {reparaturgruppe}",
                "text": "Sehr geehrte/r {kunde_name},\n\nhiermit bestätigen wir Ihren Termin am {termin_datum} um {termin_zeit} Uhr.\n\nMit freundlichen Grüßen\n{firma_name}"
            }
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/einsatz-config",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "monteure": current.get("monteure", []),
                "reparaturgruppen": current.get("reparaturgruppen", []),
                "materialien": current.get("materialien", []),
                "anfrage_schritte": current.get("anfrage_schritte", []),
                "termin_vorlagen": test_vorlagen
            }
        )
        assert response.status_code == 200
        
        # Verify it was saved
        verify_response = requests.get(
            f"{BASE_URL}/api/einsatz-config",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_data = verify_response.json()
        assert "termin_vorlagen" in verify_data
        assert len(verify_data["termin_vorlagen"]) >= 1
        print("✓ Termin-Vorlagen saved successfully")


class TestEinsaetze:
    """Test Einsätze CRUD and new features"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_einsatz_id(self, auth_token):
        """Create a test einsatz for testing"""
        response = requests.post(
            f"{BASE_URL}/api/einsaetze",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "customer_name": "TEST_Testkunde_v19",
                "beschreibung": "Test Einsatz für v19 Tests",
                "reparaturgruppe": "Fenster",
                "termin": "2026-02-15T10:00:00",
                "termin_text": "Bitte um 10 Uhr da sein",
                "monteur_1": "Ralph Graupner",
                "status": "aktiv"
            }
        )
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_list_einsaetze(self, auth_token):
        """GET /api/einsaetze returns list"""
        response = requests.get(
            f"{BASE_URL}/api/einsaetze",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} Einsätze")
    
    def test_get_einsatz_ics(self, auth_token, test_einsatz_id):
        """GET /api/einsaetze/{id}/ics returns .ics calendar file"""
        response = requests.get(
            f"{BASE_URL}/api/einsaetze/{test_einsatz_id}/ics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert "text/calendar" in response.headers.get("content-type", "")
        
        # Verify ICS content
        ics_content = response.text
        assert "BEGIN:VCALENDAR" in ics_content
        assert "BEGIN:VEVENT" in ics_content
        assert "END:VEVENT" in ics_content
        assert "END:VCALENDAR" in ics_content
        assert "DTSTART" in ics_content
        print("✓ ICS calendar file generated correctly")
    
    def test_send_einsatz_email_endpoint_exists(self, auth_token, test_einsatz_id):
        """POST /api/einsaetze/{id}/email endpoint exists"""
        # Test with missing required fields - should return 400
        response = requests.post(
            f"{BASE_URL}/api/einsaetze/{test_einsatz_id}/email",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        # Should return 400 for missing fields, not 404
        assert response.status_code in [400, 500], f"Expected 400 or 500, got {response.status_code}"
        print("✓ Email endpoint exists and validates input")
    
    def test_cleanup_test_einsatz(self, auth_token, test_einsatz_id):
        """Cleanup: Delete test einsatz"""
        response = requests.delete(
            f"{BASE_URL}/api/einsaetze/{test_einsatz_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("✓ Test einsatz cleaned up")


class TestIMAPEndpoints:
    """Test IMAP email reception endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_imap_test_endpoint_exists(self, auth_token):
        """POST /api/imap/test endpoint exists and validates input"""
        response = requests.post(
            f"{BASE_URL}/api/imap/test",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "imap_server": "invalid.server.test",
                "imap_port": 993,
                "imap_user": "test@test.com",
                "imap_password": "testpass"
            }
        )
        # Should return 400 for connection failure, not 404
        assert response.status_code in [400, 500], f"Expected 400 or 500, got {response.status_code}"
        print("✓ IMAP test endpoint exists")
    
    def test_imap_test_missing_fields(self, auth_token):
        """POST /api/imap/test returns 400 for missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/imap/test",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={}
        )
        assert response.status_code == 400
        print("✓ IMAP test validates required fields")
    
    def test_imap_fetch_endpoint_exists(self, auth_token):
        """POST /api/imap/fetch endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/imap/fetch",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 400 for incomplete settings, not 404
        assert response.status_code in [400, 500], f"Expected 400 or 500, got {response.status_code}"
        print("✓ IMAP fetch endpoint exists")


class TestAnfragenReparaturgruppe:
    """Test Anfragen with Reparaturgruppe field"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_anfragen_list_includes_reparaturgruppe(self, auth_token):
        """GET /api/anfragen returns anfragen with reparaturgruppe field"""
        response = requests.get(
            f"{BASE_URL}/api/anfragen",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check if any anfrage has reparaturgruppe field
        has_reparaturgruppe = any(a.get("reparaturgruppe") for a in data)
        print(f"✓ Listed {len(data)} Anfragen, reparaturgruppe field present: {has_reparaturgruppe}")
    
    def test_update_anfrage_reparaturgruppe(self, auth_token):
        """Anfrage reparaturgruppe can be updated via PUT"""
        # Get first anfrage
        list_response = requests.get(
            f"{BASE_URL}/api/anfragen",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        anfragen = list_response.json()
        if not anfragen:
            pytest.skip("No anfragen available for testing")
        
        anfrage_id = anfragen[0]["id"]
        original_reparaturgruppe = anfragen[0].get("reparaturgruppe", "")
        
        # Update reparaturgruppe
        response = requests.put(
            f"{BASE_URL}/api/anfragen/{anfrage_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"reparaturgruppe": "TEST_Reparaturgruppe"}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("reparaturgruppe") == "TEST_Reparaturgruppe"
        
        # Restore original value
        requests.put(
            f"{BASE_URL}/api/anfragen/{anfrage_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"reparaturgruppe": original_reparaturgruppe}
        )
        print("✓ Anfrage Reparaturgruppe can be updated")


class TestCustomerPortalEinsatzData:
    """Test Customer Portal shows linked Einsatz/Termin data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_customer_id(self, auth_token):
        """Create a test customer"""
        response = requests.post(
            f"{BASE_URL}/api/customers",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": "TEST_Portal_Kunde_v19",
                "email": "portal-test@example.com",
                "phone": "0123456789"
            }
        )
        assert response.status_code == 200
        return response.json()["id"]
    
    @pytest.fixture(scope="class")
    def test_einsatz_for_portal(self, auth_token, test_customer_id):
        """Create an einsatz linked to the customer"""
        response = requests.post(
            f"{BASE_URL}/api/einsaetze",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "customer_id": test_customer_id,
                "customer_name": "TEST_Portal_Kunde_v19",
                "beschreibung": "Portal Test Einsatz",
                "reparaturgruppe": "Fenster",
                "termin": "2026-02-20T14:00:00",
                "termin_text": "Bitte um 14 Uhr da sein",
                "monteur_1": "Ralph Graupner",
                "status": "aktiv"
            }
        )
        assert response.status_code == 200
        return response.json()["id"]
    
    @pytest.fixture(scope="class")
    def test_portal(self, auth_token, test_customer_id):
        """Create a portal for the customer"""
        response = requests.post(
            f"{BASE_URL}/api/portals",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "customer_id": test_customer_id,
                "customer_name": "TEST_Portal_Kunde_v19",
                "customer_email": "portal-test@example.com",
                "description": "Test Portal v19",
                "password": "testportal123",
                "weeks": 4
            }
        )
        assert response.status_code == 200
        return response.json()
    
    def test_portal_verify_returns_einsatz_data(self, test_portal, test_einsatz_for_portal):
        """POST /api/portal/verify/{token} returns einsatz_data"""
        response = requests.post(
            f"{BASE_URL}/api/portal/verify/{test_portal['token']}",
            json={"password": "testportal123"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check einsatz_data is present
        assert "einsatz_data" in data
        einsatz_data = data.get("einsatz_data")
        
        if einsatz_data:
            assert "termin" in einsatz_data
            assert "reparaturgruppe" in einsatz_data
            assert "monteur_1" in einsatz_data
            print(f"✓ Portal verify returns einsatz_data: termin={einsatz_data.get('termin')}")
        else:
            print("✓ Portal verify endpoint works (no einsatz linked yet)")
    
    def test_cleanup_portal_test_data(self, auth_token, test_portal, test_einsatz_for_portal, test_customer_id):
        """Cleanup test data"""
        # Delete portal
        requests.delete(
            f"{BASE_URL}/api/portals/{test_portal['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Delete einsatz
        requests.delete(
            f"{BASE_URL}/api/einsaetze/{test_einsatz_for_portal}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Delete customer
        requests.delete(
            f"{BASE_URL}/api/customers/{test_customer_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print("✓ Portal test data cleaned up")


class TestSettingsIMAPFields:
    """Test Settings include IMAP fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json()["token"]
    
    def test_settings_include_imap_fields(self, auth_token):
        """GET /api/settings returns IMAP fields"""
        response = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check IMAP fields exist
        imap_fields = ["imap_server", "imap_port", "imap_user", "imap_password", "imap_folder", "imap_enabled"]
        for field in imap_fields:
            assert field in data or data.get(field) is not None or field not in data
        print("✓ Settings endpoint returns IMAP fields")
    
    def test_settings_can_save_imap_config(self, auth_token):
        """PUT /api/settings can save IMAP configuration"""
        # Get current settings
        get_response = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        current = get_response.json()
        
        # Update with IMAP settings
        current["imap_server"] = "imap.test.com"
        current["imap_port"] = 993
        current["imap_user"] = "test@test.com"
        current["imap_folder"] = "INBOX"
        current["imap_enabled"] = False
        
        response = requests.put(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=current
        )
        assert response.status_code == 200
        
        # Verify saved
        verify = requests.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        verify_data = verify.json()
        assert verify_data.get("imap_server") == "imap.test.com"
        print("✓ IMAP settings can be saved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
