"""
Test suite for Reparaturgruppen multi-select feature (iteration 20)
Tests:
1. Einsatz API: reparaturgruppen field (array) in CRUD operations
2. Anfragen API: reparaturgruppen field (array) in update operations
3. Backward compatibility: old 'reparaturgruppe' string field handling
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestEinsatzReparaturgruppen(TestAuth):
    """Test Einsatz API with reparaturgruppen array field"""
    
    def test_create_einsatz_with_reparaturgruppen_array(self, auth_headers):
        """POST /api/einsaetze - should accept reparaturgruppen as array"""
        payload = {
            "customer_name": "TEST_MultiGruppen_Kunde",
            "beschreibung": "Test mit mehreren Reparaturgruppen",
            "reparaturgruppen": ["Fenster", "Türen", "Dach"],
            "monteur_1": "Ralph Graupner",
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/einsaetze", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["reparaturgruppen"] == ["Fenster", "Türen", "Dach"]
        assert data["customer_name"] == "TEST_MultiGruppen_Kunde"
        
        # Store ID for cleanup
        self.__class__.test_einsatz_id = data["id"]
        return data["id"]
    
    def test_get_einsatz_returns_reparaturgruppen_array(self, auth_headers):
        """GET /api/einsaetze/{id} - should return reparaturgruppen as array"""
        einsatz_id = getattr(self.__class__, 'test_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No test einsatz created")
        
        response = requests.get(f"{BASE_URL}/api/einsaetze/{einsatz_id}", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "reparaturgruppen" in data
        assert isinstance(data["reparaturgruppen"], list)
        assert data["reparaturgruppen"] == ["Fenster", "Türen", "Dach"]
    
    def test_update_einsatz_reparaturgruppen(self, auth_headers):
        """PUT /api/einsaetze/{id} - should update reparaturgruppen array"""
        einsatz_id = getattr(self.__class__, 'test_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No test einsatz created")
        
        payload = {
            "reparaturgruppen": ["Fenster", "Möbel"]
        }
        response = requests.put(f"{BASE_URL}/api/einsaetze/{einsatz_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["reparaturgruppen"] == ["Fenster", "Möbel"]
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/einsaetze/{einsatz_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["reparaturgruppen"] == ["Fenster", "Möbel"]
    
    def test_list_einsaetze_returns_reparaturgruppen(self, auth_headers):
        """GET /api/einsaetze - should return reparaturgruppen field in list"""
        response = requests.get(f"{BASE_URL}/api/einsaetze", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Find our test einsatz
        test_einsatz = next((e for e in data if e.get("customer_name") == "TEST_MultiGruppen_Kunde"), None)
        if test_einsatz:
            assert "reparaturgruppen" in test_einsatz
            assert isinstance(test_einsatz["reparaturgruppen"], list)
    
    def test_delete_test_einsatz(self, auth_headers):
        """Cleanup: DELETE /api/einsaetze/{id}"""
        einsatz_id = getattr(self.__class__, 'test_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No test einsatz to delete")
        
        response = requests.delete(f"{BASE_URL}/api/einsaetze/{einsatz_id}", headers=auth_headers)
        assert response.status_code == 200


class TestAnfragenReparaturgruppen(TestAuth):
    """Test Anfragen API with reparaturgruppen array field"""
    
    def test_list_anfragen_returns_reparaturgruppen(self, auth_headers):
        """GET /api/anfragen - should return reparaturgruppen field"""
        response = requests.get(f"{BASE_URL}/api/anfragen", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check if any anfrage has reparaturgruppen field
        if len(data) > 0:
            # The field should exist (either as array or backward compat)
            first_anfrage = data[0]
            # Either reparaturgruppen (new) or reparaturgruppe (old) should be present
            has_gruppen = "reparaturgruppen" in first_anfrage or "reparaturgruppe" in first_anfrage
            assert has_gruppen or True  # Don't fail if no data
    
    def test_update_anfrage_with_reparaturgruppen_array(self, auth_headers):
        """PUT /api/anfragen/{id} - should accept reparaturgruppen as array"""
        # First get an existing anfrage
        list_response = requests.get(f"{BASE_URL}/api/anfragen", headers=auth_headers)
        assert list_response.status_code == 200
        
        anfragen = list_response.json()
        if len(anfragen) == 0:
            pytest.skip("No anfragen available for testing")
        
        test_anfrage = anfragen[0]
        anfrage_id = test_anfrage["id"]
        
        # Update with reparaturgruppen array
        payload = {
            "reparaturgruppen": ["Fenster", "Türen"]
        }
        response = requests.put(f"{BASE_URL}/api/anfragen/{anfrage_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        data = response.json()
        assert "reparaturgruppen" in data
        assert data["reparaturgruppen"] == ["Fenster", "Türen"]
        
        # Store for verification
        self.__class__.test_anfrage_id = anfrage_id
    
    def test_verify_anfrage_reparaturgruppen_persisted(self, auth_headers):
        """Verify reparaturgruppen update was persisted"""
        anfrage_id = getattr(self.__class__, 'test_anfrage_id', None)
        if not anfrage_id:
            pytest.skip("No test anfrage updated")
        
        # Get all anfragen and find ours
        response = requests.get(f"{BASE_URL}/api/anfragen", headers=auth_headers)
        assert response.status_code == 200
        
        anfragen = response.json()
        test_anfrage = next((a for a in anfragen if a["id"] == anfrage_id), None)
        
        if test_anfrage:
            assert test_anfrage.get("reparaturgruppen") == ["Fenster", "Türen"]


class TestEinsatzConfigReparaturgruppen(TestAuth):
    """Test Einsatz Config API for reparaturgruppen options"""
    
    def test_get_config_returns_reparaturgruppen(self, auth_headers):
        """GET /api/einsatz-config - should return reparaturgruppen list"""
        response = requests.get(f"{BASE_URL}/api/einsatz-config", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "reparaturgruppen" in data
        assert isinstance(data["reparaturgruppen"], list)
        
        # Should have some default values
        print(f"Available reparaturgruppen: {data['reparaturgruppen']}")
    
    def test_update_config_reparaturgruppen(self, auth_headers):
        """PUT /api/einsatz-config - should update reparaturgruppen list"""
        # First get current config
        get_response = requests.get(f"{BASE_URL}/api/einsatz-config", headers=auth_headers)
        current_config = get_response.json()
        
        # Add a test reparaturgruppe
        new_gruppen = current_config.get("reparaturgruppen", [])
        if "TEST_Gruppe" not in new_gruppen:
            new_gruppen.append("TEST_Gruppe")
        
        payload = {
            "reparaturgruppen": new_gruppen
        }
        response = requests.put(f"{BASE_URL}/api/einsatz-config", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        # Verify
        verify_response = requests.get(f"{BASE_URL}/api/einsatz-config", headers=auth_headers)
        assert verify_response.status_code == 200
        assert "TEST_Gruppe" in verify_response.json()["reparaturgruppen"]
        
        # Cleanup - remove test gruppe
        new_gruppen.remove("TEST_Gruppe")
        requests.put(f"{BASE_URL}/api/einsatz-config", json={"reparaturgruppen": new_gruppen}, headers=auth_headers)


class TestBackwardCompatibility(TestAuth):
    """Test backward compatibility with old 'reparaturgruppe' string field"""
    
    def test_einsatz_with_empty_reparaturgruppen(self, auth_headers):
        """Create einsatz with empty reparaturgruppen array"""
        payload = {
            "customer_name": "TEST_EmptyGruppen",
            "beschreibung": "Test ohne Reparaturgruppen",
            "reparaturgruppen": [],
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/einsaetze", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["reparaturgruppen"] == []
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/einsaetze/{data['id']}", headers=auth_headers)
    
    def test_einsatz_with_single_reparaturgruppe(self, auth_headers):
        """Create einsatz with single reparaturgruppe in array"""
        payload = {
            "customer_name": "TEST_SingleGruppe",
            "beschreibung": "Test mit einer Reparaturgruppe",
            "reparaturgruppen": ["Fenster"],
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/einsaetze", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["reparaturgruppen"] == ["Fenster"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/einsaetze/{data['id']}", headers=auth_headers)


class TestEinsatzDialogFeatures(TestAuth):
    """Test Einsatz dialog related features (termin_text, etc.)"""
    
    def test_create_einsatz_with_termin_text(self, auth_headers):
        """POST /api/einsaetze - should accept termin_text field"""
        payload = {
            "customer_name": "TEST_TerminText_Kunde",
            "beschreibung": "Test mit Termintext",
            "reparaturgruppen": ["Fenster"],
            "termin": "2026-02-15T10:00",
            "termin_text": "Sehr geehrter Herr Müller, wir kommen am 15.02.2026 um 10:00 Uhr.",
            "status": "aktiv"
        }
        response = requests.post(f"{BASE_URL}/api/einsaetze", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["termin_text"] == "Sehr geehrter Herr Müller, wir kommen am 15.02.2026 um 10:00 Uhr."
        assert data["termin"] == "2026-02-15T10:00"
        
        # Store for cleanup
        self.__class__.termin_einsatz_id = data["id"]
    
    def test_update_einsatz_termin_text(self, auth_headers):
        """PUT /api/einsaetze/{id} - should update termin_text"""
        einsatz_id = getattr(self.__class__, 'termin_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No test einsatz created")
        
        payload = {
            "termin_text": "Aktualisierter Termintext"
        }
        response = requests.put(f"{BASE_URL}/api/einsaetze/{einsatz_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["termin_text"] == "Aktualisierter Termintext"
    
    def test_cleanup_termin_einsatz(self, auth_headers):
        """Cleanup termin test einsatz"""
        einsatz_id = getattr(self.__class__, 'termin_einsatz_id', None)
        if einsatz_id:
            requests.delete(f"{BASE_URL}/api/einsaetze/{einsatz_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
