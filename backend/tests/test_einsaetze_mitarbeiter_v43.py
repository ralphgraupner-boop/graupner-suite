"""
Test Suite for Einsaetze-Modul and Mitarbeiter-Modul (v43)
Tests all CRUD operations, Bilder upload, from-kontakt/from-kunde creation, ICS download
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://handwerk-deploy.preview.emergentagent.com"

# Test credentials
TEST_USER = "admin"
TEST_PASS = "Graupner!Suite2026"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": TEST_USER,
        "password": TEST_PASS
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ==================== EINSATZ-CONFIG TESTS ====================

class TestEinsatzConfig:
    """Tests for /api/einsatz-config endpoint"""
    
    def test_get_config(self, api_client):
        """GET /api/einsatz-config - should return reparaturgruppen, materialien, etc."""
        response = api_client.get(f"{BASE_URL}/api/einsatz-config")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "reparaturgruppen" in data, "Missing reparaturgruppen"
        assert "materialien" in data, "Missing materialien"
        assert "bild_kategorien" in data, "Missing bild_kategorien"
        assert "prioritaeten" in data, "Missing prioritaeten"
        
        # Verify default values exist
        assert len(data["reparaturgruppen"]) > 0, "No reparaturgruppen"
        assert len(data["materialien"]) > 0, "No materialien"
        print(f"Config loaded: {len(data['reparaturgruppen'])} reparaturgruppen, {len(data['materialien'])} materialien")


# ==================== EINSAETZE CRUD TESTS ====================

class TestEinsaetzeCRUD:
    """Tests for /api/einsaetze CRUD operations"""
    
    def test_list_einsaetze(self, api_client):
        """GET /api/einsaetze - should return list of einsaetze"""
        response = api_client.get(f"{BASE_URL}/api/einsaetze")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} einsaetze")
    
    def test_list_einsaetze_with_status_filter(self, api_client):
        """GET /api/einsaetze?status=aktiv - should filter by status"""
        response = api_client.get(f"{BASE_URL}/api/einsaetze?status=aktiv")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # All returned items should have aktiv or in_bearbeitung status
        for item in data:
            assert item.get("status") in ["aktiv", "in_bearbeitung"], f"Unexpected status: {item.get('status')}"
        print(f"Found {len(data)} aktiv einsaetze")
    
    def test_create_einsatz(self, api_client):
        """POST /api/einsaetze - should create new einsatz"""
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "betreff": f"TEST_Einsatz_{test_id}",
            "beschreibung": "Test Beschreibung für Einsatz",
            "bemerkungen": "Interne Bemerkungen",
            "kunde_name": f"TEST_Kunde_{test_id}",
            "kunde_email": "test@example.de",
            "kunde_telefon": "040-123456",
            "kunde_adresse": "Teststraße 1, 22453 Hamburg",
            "objekt_strasse": "Objektstraße 5",
            "objekt_plz": "22453",
            "objekt_ort": "Hamburg",
            "reparaturgruppe": "Fenster",
            "material": "Holz",
            "summe_netto": 1500.00,
            "mwst_satz": 19,
            "status": "aktiv",
            "prioritaet": "normal",
            "termin": "2026-02-15T10:00:00"
        }
        
        response = api_client.post(f"{BASE_URL}/api/einsaetze", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Missing id in response"
        assert data["betreff"] == payload["betreff"], "Betreff mismatch"
        assert data["kunde_name"] == payload["kunde_name"], "Kunde name mismatch"
        assert data["reparaturgruppe"] == payload["reparaturgruppe"], "Reparaturgruppe mismatch"
        assert data["material"] == payload["material"], "Material mismatch"
        assert data["summe_netto"] == payload["summe_netto"], "Summe netto mismatch"
        assert data["status"] == "aktiv", "Status should be aktiv"
        
        # Store for later tests
        TestEinsaetzeCRUD.created_einsatz_id = data["id"]
        print(f"Created einsatz: {data['id']}")
        return data["id"]
    
    def test_get_einsatz(self, api_client):
        """GET /api/einsaetze/{id} - should return single einsatz"""
        einsatz_id = getattr(TestEinsaetzeCRUD, 'created_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No einsatz created")
        
        response = api_client.get(f"{BASE_URL}/api/einsaetze/{einsatz_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["id"] == einsatz_id, "ID mismatch"
        assert "betreff" in data, "Missing betreff"
        assert "kunde_name" in data, "Missing kunde_name"
        print(f"Retrieved einsatz: {data['betreff']}")
    
    def test_update_einsatz(self, api_client):
        """PUT /api/einsaetze/{id} - should update einsatz"""
        einsatz_id = getattr(TestEinsaetzeCRUD, 'created_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No einsatz created")
        
        update_payload = {
            "betreff": "TEST_Einsatz_UPDATED",
            "status": "in_bearbeitung",
            "prioritaet": "hoch",
            "summe_netto": 2000.00,
            "monteur_name": "Max Mustermann"
        }
        
        response = api_client.put(f"{BASE_URL}/api/einsaetze/{einsatz_id}", json=update_payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["betreff"] == "TEST_Einsatz_UPDATED", "Betreff not updated"
        assert data["status"] == "in_bearbeitung", "Status not updated"
        assert data["prioritaet"] == "hoch", "Prioritaet not updated"
        assert data["summe_netto"] == 2000.00, "Summe netto not updated"
        assert data["monteur_name"] == "Max Mustermann", "Monteur name not updated"
        print(f"Updated einsatz: {data['betreff']}")
    
    def test_delete_einsatz(self, api_client):
        """DELETE /api/einsaetze/{id} - should delete einsatz"""
        einsatz_id = getattr(TestEinsaetzeCRUD, 'created_einsatz_id', None)
        if not einsatz_id:
            pytest.skip("No einsatz created")
        
        response = api_client.delete(f"{BASE_URL}/api/einsaetze/{einsatz_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Missing message"
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/einsaetze/{einsatz_id}")
        assert get_response.status_code == 404, "Einsatz should be deleted"
        print(f"Deleted einsatz: {einsatz_id}")


# ==================== EINSATZ FROM KONTAKT/KUNDE TESTS ====================

class TestEinsatzFromKontaktKunde:
    """Tests for creating Einsatz from Kontakt or Kunde"""
    
    def test_create_from_kontakt(self, api_client):
        """POST /api/einsaetze/from-kontakt/{id} - should create einsatz from kontakt"""
        # First get a kontakt
        kontakt_response = api_client.get(f"{BASE_URL}/api/modules/kontakt/data")
        if kontakt_response.status_code != 200:
            pytest.skip("Could not get kontakte")
        
        kontakte = kontakt_response.json()
        if not kontakte:
            pytest.skip("No kontakte available")
        
        kontakt_id = kontakte[0]["id"]
        kontakt_name = kontakte[0].get("vorname", "") + " " + kontakte[0].get("nachname", "")
        
        response = api_client.post(f"{BASE_URL}/api/einsaetze/from-kontakt/{kontakt_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Missing id"
        assert data["kontakt_id"] == kontakt_id, "Kontakt ID mismatch"
        assert data["status"] == "aktiv", "Status should be aktiv"
        
        # Store for cleanup
        TestEinsatzFromKontaktKunde.from_kontakt_id = data["id"]
        print(f"Created einsatz from kontakt: {data['id']} (Kontakt: {kontakt_name.strip()})")
    
    def test_create_from_kunde(self, api_client):
        """POST /api/einsaetze/from-kunde/{id} - should create einsatz from kunde"""
        # First get a kunde
        kunde_response = api_client.get(f"{BASE_URL}/api/modules/kunden/data")
        if kunde_response.status_code != 200:
            pytest.skip("Could not get kunden")
        
        kunden = kunde_response.json()
        if not kunden:
            pytest.skip("No kunden available")
        
        kunde_id = kunden[0]["id"]
        kunde_name = kunden[0].get("vorname", "") + " " + kunden[0].get("nachname", "")
        
        payload = {
            "betreff": "Test Einsatz aus Kunde",
            "beschreibung": "Erstellt aus Kunden-Modul"
        }
        
        response = api_client.post(f"{BASE_URL}/api/einsaetze/from-kunde/{kunde_id}", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Missing id"
        assert data["kunde_id"] == kunde_id, "Kunde ID mismatch"
        assert data["status"] == "aktiv", "Status should be aktiv"
        
        # Store for cleanup
        TestEinsatzFromKontaktKunde.from_kunde_id = data["id"]
        print(f"Created einsatz from kunde: {data['id']} (Kunde: {kunde_name.strip()})")
    
    def test_cleanup_from_kontakt_kunde(self, api_client):
        """Cleanup einsaetze created from kontakt/kunde"""
        for attr in ['from_kontakt_id', 'from_kunde_id']:
            einsatz_id = getattr(TestEinsatzFromKontaktKunde, attr, None)
            if einsatz_id:
                api_client.delete(f"{BASE_URL}/api/einsaetze/{einsatz_id}")
                print(f"Cleaned up {attr}: {einsatz_id}")


# ==================== EINSATZ ICS TESTS ====================

class TestEinsatzICS:
    """Tests for ICS calendar download"""
    
    def test_get_ics_with_termin(self, api_client):
        """GET /api/einsaetze/{id}/ics - should return ICS file"""
        # Create einsatz with termin
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "betreff": f"TEST_ICS_{test_id}",
            "kunde_name": "ICS Test Kunde",
            "termin": "2026-02-20T14:00:00",
            "status": "aktiv"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/einsaetze", json=payload)
        assert create_response.status_code == 200, f"Failed to create: {create_response.text}"
        einsatz_id = create_response.json()["id"]
        
        # Get ICS
        response = api_client.get(f"{BASE_URL}/api/einsaetze/{einsatz_id}/ics")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/calendar" in content_type, f"Wrong content type: {content_type}"
        
        # Check ICS content
        ics_content = response.text
        assert "BEGIN:VCALENDAR" in ics_content, "Missing VCALENDAR"
        assert "BEGIN:VEVENT" in ics_content, "Missing VEVENT"
        assert "END:VCALENDAR" in ics_content, "Missing END:VCALENDAR"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/einsaetze/{einsatz_id}")
        print(f"ICS download successful for einsatz: {einsatz_id}")


# ==================== MITARBEITER CRUD TESTS ====================

class TestMitarbeiterCRUD:
    """Tests for /api/mitarbeiter CRUD operations"""
    
    def test_list_mitarbeiter(self, api_client):
        """GET /api/mitarbeiter - should return list of mitarbeiter"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} mitarbeiter")
    
    def test_create_mitarbeiter(self, api_client):
        """POST /api/mitarbeiter - should create new mitarbeiter"""
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "vorname": f"TEST_Vorname_{test_id}",
            "nachname": f"TEST_Nachname_{test_id}",
            "anrede": "Herr",
            "position": "Tischler",
            "telefon": "040-987654",
            "email": f"test_{test_id}@example.de",
            "status": "aktiv",
            "wochenstunden": 40,
            "stundenlohn": 25.50,
            "strasse": "Mitarbeiterstr. 10",
            "plz": "22453",
            "ort": "Hamburg"
        }
        
        response = api_client.post(f"{BASE_URL}/api/mitarbeiter", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Missing id in response"
        assert data["vorname"] == payload["vorname"], "Vorname mismatch"
        assert data["nachname"] == payload["nachname"], "Nachname mismatch"
        assert data["position"] == payload["position"], "Position mismatch"
        assert data["status"] == "aktiv", "Status should be aktiv"
        
        # Store for later tests
        TestMitarbeiterCRUD.created_mitarbeiter_id = data["id"]
        print(f"Created mitarbeiter: {data['id']} ({data['vorname']} {data['nachname']})")
        return data["id"]
    
    def test_get_mitarbeiter(self, api_client):
        """GET /api/mitarbeiter/{id} - should return single mitarbeiter"""
        ma_id = getattr(TestMitarbeiterCRUD, 'created_mitarbeiter_id', None)
        if not ma_id:
            pytest.skip("No mitarbeiter created")
        
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{ma_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["id"] == ma_id, "ID mismatch"
        assert "vorname" in data, "Missing vorname"
        assert "nachname" in data, "Missing nachname"
        print(f"Retrieved mitarbeiter: {data['vorname']} {data['nachname']}")
    
    def test_update_mitarbeiter(self, api_client):
        """PUT /api/mitarbeiter/{id} - should update mitarbeiter"""
        ma_id = getattr(TestMitarbeiterCRUD, 'created_mitarbeiter_id', None)
        if not ma_id:
            pytest.skip("No mitarbeiter created")
        
        update_payload = {
            "position": "Senior Tischler",
            "stundenlohn": 30.00,
            "wochenstunden": 38
        }
        
        response = api_client.put(f"{BASE_URL}/api/mitarbeiter/{ma_id}", json=update_payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # PUT returns {"message": "Gespeichert"} - verify via GET
        assert "message" in data, "Missing message in response"
        
        # Verify update via GET
        get_response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{ma_id}")
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        
        updated_data = get_response.json()
        assert updated_data["position"] == "Senior Tischler", "Position not updated"
        assert updated_data["stundenlohn"] == 30.00, "Stundenlohn not updated"
        assert updated_data["wochenstunden"] == 38, "Wochenstunden not updated"
        print(f"Updated mitarbeiter: {updated_data['vorname']} {updated_data['nachname']}")
    
    def test_delete_mitarbeiter(self, api_client):
        """DELETE /api/mitarbeiter/{id} - should delete mitarbeiter"""
        ma_id = getattr(TestMitarbeiterCRUD, 'created_mitarbeiter_id', None)
        if not ma_id:
            pytest.skip("No mitarbeiter created")
        
        response = api_client.delete(f"{BASE_URL}/api/mitarbeiter/{ma_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{ma_id}")
        assert get_response.status_code == 404, "Mitarbeiter should be deleted"
        print(f"Deleted mitarbeiter: {ma_id}")


# ==================== EINSATZ MONTEUR INTEGRATION TESTS ====================

class TestEinsatzMonteurIntegration:
    """Tests for Einsatz-Mitarbeiter integration (Monteur assignment)"""
    
    def test_assign_monteur_to_einsatz(self, api_client):
        """Create einsatz with monteur assignment"""
        # Get existing mitarbeiter
        ma_response = api_client.get(f"{BASE_URL}/api/mitarbeiter")
        if ma_response.status_code != 200:
            pytest.skip("Could not get mitarbeiter")
        
        mitarbeiter = ma_response.json()
        aktive_ma = [m for m in mitarbeiter if m.get("status") == "aktiv"]
        if not aktive_ma:
            pytest.skip("No active mitarbeiter available")
        
        monteur = aktive_ma[0]
        monteur_name = f"{monteur['vorname']} {monteur['nachname']}"
        
        # Create einsatz with monteur
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "betreff": f"TEST_Monteur_{test_id}",
            "kunde_name": "Monteur Test Kunde",
            "monteur_id": monteur["id"],
            "monteur_name": monteur_name,
            "status": "aktiv"
        }
        
        response = api_client.post(f"{BASE_URL}/api/einsaetze", json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["monteur_id"] == monteur["id"], "Monteur ID mismatch"
        assert data["monteur_name"] == monteur_name, "Monteur name mismatch"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/einsaetze/{data['id']}")
        print(f"Einsatz with monteur assignment successful: {monteur_name}")


# ==================== ERROR HANDLING TESTS ====================

class TestErrorHandling:
    """Tests for error handling"""
    
    def test_get_nonexistent_einsatz(self, api_client):
        """GET /api/einsaetze/{id} with invalid ID should return 404"""
        response = api_client.get(f"{BASE_URL}/api/einsaetze/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_get_nonexistent_mitarbeiter(self, api_client):
        """GET /api/mitarbeiter/{id} with invalid ID should return 404"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_create_from_nonexistent_kontakt(self, api_client):
        """POST /api/einsaetze/from-kontakt/{id} with invalid ID should return 404"""
        response = api_client.post(f"{BASE_URL}/api/einsaetze/from-kontakt/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_create_from_nonexistent_kunde(self, api_client):
        """POST /api/einsaetze/from-kunde/{id} with invalid ID should return 404"""
        response = api_client.post(f"{BASE_URL}/api/einsaetze/from-kunde/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
