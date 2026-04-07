"""
Backend tests for Mitarbeiter (Employee) feature
Tests CRUD operations for employees, urlaub, krankmeldungen, lohnhistorie, fortbildungen
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session

@pytest.fixture(scope="module")
def test_mitarbeiter(api_client):
    """Create a test employee for use in other tests"""
    unique_id = str(uuid.uuid4())[:6]
    payload = {
        "vorname": f"TEST_Max_{unique_id}",
        "nachname": f"TEST_Mustermann_{unique_id}",
        "position": "Geselle",
        "email": f"test_{unique_id}@example.com",
        "telefon": "0123456789",
        "eintrittsdatum": "2024-01-15",
        "personalnummer": f"T{unique_id}",
        "anrede": "Herr",
        "urlaubsanspruch": 30
    }
    response = api_client.post(f"{BASE_URL}/api/mitarbeiter", json=payload)
    assert response.status_code == 200, f"Failed to create test employee: {response.text}"
    ma = response.json()
    yield ma
    # Cleanup
    try:
        api_client.delete(f"{BASE_URL}/api/mitarbeiter/{ma['id']}")
    except:
        pass


class TestMitarbeiterCRUD:
    """Test Mitarbeiter CRUD operations"""
    
    def test_list_mitarbeiter(self, api_client):
        """Test listing all employees"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List mitarbeiter: {len(data)} employees found")
    
    def test_create_mitarbeiter(self, api_client):
        """Test creating a new employee"""
        unique_id = str(uuid.uuid4())[:6]
        payload = {
            "vorname": f"TEST_Anna_{unique_id}",
            "nachname": f"TEST_Schmidt_{unique_id}",
            "position": "Meister",
            "email": f"anna_{unique_id}@test.de",
            "telefon": "040-123456",
            "eintrittsdatum": "2025-01-01",
            "personalnummer": f"A{unique_id}",
            "anrede": "Frau",
            "status": "aktiv",
            "urlaubsanspruch": 28
        }
        response = api_client.post(f"{BASE_URL}/api/mitarbeiter", json=payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["vorname"] == payload["vorname"]
        assert data["nachname"] == payload["nachname"]
        assert data["position"] == payload["position"]
        assert data["urlaubsanspruch"] == 28
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["vorname"] == payload["vorname"]
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/mitarbeiter/{data['id']}")
        print(f"✓ Create mitarbeiter: {data['id']}")
    
    def test_get_mitarbeiter(self, api_client, test_mitarbeiter):
        """Test getting a single employee"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_mitarbeiter["id"]
        assert data["vorname"] == test_mitarbeiter["vorname"]
        print(f"✓ Get mitarbeiter: {data['id']}")
    
    def test_update_mitarbeiter(self, api_client, test_mitarbeiter):
        """Test updating an employee"""
        update_payload = {
            "position": "Meister",
            "telefon": "040-999888"
        }
        response = api_client.put(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}", json=update_payload)
        assert response.status_code == 200
        
        # Verify update persisted
        get_response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["position"] == "Meister"
        assert data["telefon"] == "040-999888"
        print(f"✓ Update mitarbeiter: {test_mitarbeiter['id']}")
    
    def test_get_nonexistent_mitarbeiter(self, api_client):
        """Test getting a non-existent employee returns 404"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/nonexistent123")
        assert response.status_code == 404
        print("✓ Get nonexistent mitarbeiter returns 404")


class TestMitarbeiterUrlaub:
    """Test Urlaub (vacation) operations"""
    
    def test_create_urlaub(self, api_client, test_mitarbeiter):
        """Test creating a vacation entry"""
        payload = {
            "von": "2025-02-01",
            "bis": "2025-02-07",
            "tage": 5,
            "typ": "urlaub",
            "status": "genehmigt",
            "bemerkung": "Winterurlaub"
        }
        response = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/urlaub", json=payload)
        assert response.status_code == 200, f"Create urlaub failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["von"] == payload["von"]
        assert data["bis"] == payload["bis"]
        assert data["tage"] == 5
        assert data["typ"] == "urlaub"
        print(f"✓ Create urlaub: {data['id']}")
        return data
    
    def test_list_urlaub(self, api_client, test_mitarbeiter):
        """Test listing vacation entries"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/urlaub")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List urlaub: {len(data)} entries")
    
    def test_delete_urlaub(self, api_client, test_mitarbeiter):
        """Test deleting a vacation entry"""
        # First create one
        payload = {"von": "2025-03-01", "bis": "2025-03-03", "tage": 2, "typ": "urlaub", "status": "genehmigt"}
        create_resp = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/urlaub", json=payload)
        assert create_resp.status_code == 200
        entry_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = api_client.delete(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/urlaub/{entry_id}")
        assert delete_resp.status_code == 200
        
        # Verify deletion
        list_resp = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/urlaub")
        entries = list_resp.json()
        assert not any(e["id"] == entry_id for e in entries)
        print(f"✓ Delete urlaub: {entry_id}")


class TestMitarbeiterKrankmeldungen:
    """Test Krankmeldungen (sick leave) operations"""
    
    def test_create_krankmeldung(self, api_client, test_mitarbeiter):
        """Test creating a sick leave entry"""
        payload = {
            "von": "2025-01-20",
            "bis": "2025-01-22",
            "tage": 3,
            "au_bescheinigung": True,
            "arzt": "Dr. Müller",
            "bemerkung": "Grippe"
        }
        response = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/krankmeldungen", json=payload)
        assert response.status_code == 200, f"Create krankmeldung failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["von"] == payload["von"]
        assert data["tage"] == 3
        assert data["au_bescheinigung"] == True
        print(f"✓ Create krankmeldung: {data['id']}")
        return data
    
    def test_list_krankmeldungen(self, api_client, test_mitarbeiter):
        """Test listing sick leave entries"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/krankmeldungen")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List krankmeldungen: {len(data)} entries")
    
    def test_delete_krankmeldung(self, api_client, test_mitarbeiter):
        """Test deleting a sick leave entry"""
        # First create one
        payload = {"von": "2025-04-01", "bis": "2025-04-02", "tage": 2, "au_bescheinigung": False}
        create_resp = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/krankmeldungen", json=payload)
        assert create_resp.status_code == 200
        entry_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = api_client.delete(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/krankmeldungen/{entry_id}")
        assert delete_resp.status_code == 200
        print(f"✓ Delete krankmeldung: {entry_id}")


class TestMitarbeiterLohnhistorie:
    """Test Lohnhistorie (salary history) operations"""
    
    def test_create_lohnhistorie(self, api_client, test_mitarbeiter):
        """Test creating a salary change entry"""
        payload = {
            "gueltig_ab": "2025-01-01",
            "lohnart": "stundenlohn",
            "stundenlohn": 25.50,
            "monatsgehalt": 0,
            "bemerkung": "Lohnerhöhung"
        }
        response = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/lohnhistorie", json=payload)
        assert response.status_code == 200, f"Create lohnhistorie failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["gueltig_ab"] == payload["gueltig_ab"]
        assert data["lohnart"] == "stundenlohn"
        assert data["stundenlohn"] == 25.50
        print(f"✓ Create lohnhistorie: {data['id']}")
        
        # Verify employee's current salary was updated
        ma_resp = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}")
        ma_data = ma_resp.json()
        assert ma_data["stundenlohn"] == 25.50
        print(f"✓ Employee salary updated to {ma_data['stundenlohn']}")
    
    def test_list_lohnhistorie(self, api_client, test_mitarbeiter):
        """Test listing salary history"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/lohnhistorie")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List lohnhistorie: {len(data)} entries")


class TestMitarbeiterFortbildungen:
    """Test Fortbildungen (training) operations"""
    
    def test_create_fortbildung(self, api_client, test_mitarbeiter):
        """Test creating a training entry"""
        payload = {
            "bezeichnung": "CNC-Kurs Grundlagen",
            "anbieter": "HWK Hamburg",
            "datum": "2025-03-15",
            "bis_datum": "2025-03-17",
            "kosten": 450.00,
            "zertifikat": True,
            "bemerkung": "Erfolgreich abgeschlossen"
        }
        response = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/fortbildungen", json=payload)
        assert response.status_code == 200, f"Create fortbildung failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["bezeichnung"] == payload["bezeichnung"]
        assert data["kosten"] == 450.00
        assert data["zertifikat"] == True
        print(f"✓ Create fortbildung: {data['id']}")
        return data
    
    def test_list_fortbildungen(self, api_client, test_mitarbeiter):
        """Test listing training entries"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/fortbildungen")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ List fortbildungen: {len(data)} entries")
    
    def test_delete_fortbildung(self, api_client, test_mitarbeiter):
        """Test deleting a training entry"""
        # First create one
        payload = {"bezeichnung": "Test Kurs", "datum": "2025-05-01", "kosten": 100}
        create_resp = api_client.post(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/fortbildungen", json=payload)
        assert create_resp.status_code == 200
        entry_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = api_client.delete(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/fortbildungen/{entry_id}")
        assert delete_resp.status_code == 200
        print(f"✓ Delete fortbildung: {entry_id}")


class TestMitarbeiterStatistiken:
    """Test employee statistics endpoint"""
    
    def test_get_statistiken(self, api_client, test_mitarbeiter):
        """Test getting employee statistics"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter/{test_mitarbeiter['id']}/statistiken")
        assert response.status_code == 200
        
        data = response.json()
        assert "year" in data
        assert "urlaubsanspruch" in data
        assert "urlaub_genommen" in data
        assert "urlaub_rest" in data
        assert "kranktage" in data
        print(f"✓ Get statistiken: Urlaub rest={data['urlaub_rest']}, Kranktage={data['kranktage']}")


class TestMitarbeiterAbwesenheiten:
    """Test calendar/absence overview endpoint"""
    
    def test_get_all_abwesenheiten(self, api_client):
        """Test getting all absences for calendar view"""
        response = api_client.get(f"{BASE_URL}/api/mitarbeiter-abwesenheiten")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get all abwesenheiten: {len(data)} events")


class TestPasswordManagement:
    """Test password management features in auth.py"""
    
    def test_list_users(self, api_client):
        """Test listing users"""
        response = api_client.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check h.bolanka exists
        usernames = [u["username"] for u in data]
        assert "h.bolanka" in usernames or "admin" in usernames
        print(f"✓ List users: {len(data)} users found")
    
    def test_change_password(self, api_client):
        """Test changing a user's password"""
        # First check if h.bolanka exists
        users_resp = api_client.get(f"{BASE_URL}/api/users")
        users = users_resp.json()
        
        if any(u["username"] == "h.bolanka" for u in users):
            # Change password
            response = api_client.put(f"{BASE_URL}/api/users/h.bolanka/password", json={
                "password": "Buch$2026!Grau"  # Reset to original
            })
            assert response.status_code == 200
            print("✓ Change password for h.bolanka")
        else:
            print("⚠ h.bolanka user not found, skipping password change test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
