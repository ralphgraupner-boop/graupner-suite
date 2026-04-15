"""
Test Module Linkage Features (v39)
- Kontakt-Modul <-> Kunden-Modul Transfer
- Kunden-Modul -> Dokumente (Kundenauswahl im Editor)
- Artikel -> Dokumente (bereits existent)
- Textvorlagen -> Dokumente (bereits existent)
"""
import pytest
import requests
import os
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "Graupner!Suite2026"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")

@pytest.fixture
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestKontaktToKundenTransfer:
    """Test POST /api/modules/kunden/from-kontakt/{id} - Kontakt als Kunde uebernehmen"""
    
    def test_create_kontakt_and_transfer_to_kunde(self, api_client):
        """Create a new Kontakt and transfer to Kunden-Modul"""
        # Create a unique Kontakt
        unique_id = str(uuid4())[:8]
        kontakt_data = {
            "vorname": f"TEST_Transfer_{unique_id}",
            "nachname": "Kontakt",
            "email": f"test_transfer_{unique_id}@example.com",
            "phone": "0123456789",
            "customer_type": "Privat",
            "kontakt_status": "Anfrage",
            "strasse": "Teststrasse",
            "hausnummer": "123",
            "plz": "12345",
            "ort": "Teststadt"
        }
        
        # Create Kontakt
        create_res = api_client.post(f"{BASE_URL}/api/modules/kontakt/data", json=kontakt_data)
        assert create_res.status_code == 200, f"Failed to create Kontakt: {create_res.text}"
        kontakt = create_res.json()
        kontakt_id = kontakt["id"]
        
        # Transfer to Kunden-Modul
        transfer_res = api_client.post(f"{BASE_URL}/api/modules/kunden/from-kontakt/{kontakt_id}")
        assert transfer_res.status_code == 200, f"Transfer failed: {transfer_res.text}"
        
        result = transfer_res.json()
        assert "kunde" in result, "Response should contain 'kunde'"
        assert result.get("already_exists") == False, "Should be a new transfer"
        assert result["kunde"]["vorname"] == kontakt_data["vorname"]
        assert result["kunde"]["nachname"] == kontakt_data["nachname"]
        assert result["kunde"]["email"] == kontakt_data["email"]
        assert result["kunde"]["source_kontakt_id"] == kontakt_id
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/modules/kontakt/data/{kontakt_id}")
        api_client.delete(f"{BASE_URL}/api/modules/kunden/data/{result['kunde']['id']}")
        print("PASS: Kontakt -> Kunde transfer works correctly")
    
    def test_duplicate_detection_by_email(self, api_client):
        """Test that duplicate detection works by email"""
        unique_id = str(uuid4())[:8]
        email = f"test_dup_{unique_id}@example.com"
        
        # Create Kontakt
        kontakt_data = {
            "vorname": f"TEST_Dup_{unique_id}",
            "nachname": "Email",
            "email": email,
            "customer_type": "Privat"
        }
        create_res = api_client.post(f"{BASE_URL}/api/modules/kontakt/data", json=kontakt_data)
        assert create_res.status_code == 200
        kontakt_id = create_res.json()["id"]
        
        # First transfer - should succeed
        transfer1 = api_client.post(f"{BASE_URL}/api/modules/kunden/from-kontakt/{kontakt_id}")
        assert transfer1.status_code == 200
        assert transfer1.json().get("already_exists") == False
        kunde_id = transfer1.json()["kunde"]["id"]
        
        # Second transfer - should detect duplicate
        transfer2 = api_client.post(f"{BASE_URL}/api/modules/kunden/from-kontakt/{kontakt_id}")
        assert transfer2.status_code == 200
        assert transfer2.json().get("already_exists") == True
        assert "bereits als Kunde vorhanden" in transfer2.json().get("message", "")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/modules/kontakt/data/{kontakt_id}")
        api_client.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}")
        print("PASS: Duplicate detection by email works")
    
    def test_transfer_nonexistent_kontakt(self, api_client):
        """Test transfer of non-existent Kontakt returns 404"""
        fake_id = str(uuid4())
        res = api_client.post(f"{BASE_URL}/api/modules/kunden/from-kontakt/{fake_id}")
        assert res.status_code == 404
        print("PASS: Non-existent Kontakt returns 404")


class TestKundenToKontaktTransfer:
    """Test POST /api/modules/kontakt/from-kunden/{id} - Kunde als Kontakt uebernehmen"""
    
    def test_create_kunde_and_transfer_to_kontakt(self, api_client):
        """Create a new Kunde and transfer to Kontakt-Modul"""
        unique_id = str(uuid4())[:8]
        kunde_data = {
            "vorname": f"TEST_KundeTransfer_{unique_id}",
            "nachname": "ToKontakt",
            "email": f"test_kunde_transfer_{unique_id}@example.com",
            "phone": "0987654321",
            "customer_type": "Firma",
            "firma": "Test GmbH",
            "strasse": "Kundenstrasse",
            "hausnummer": "456",
            "plz": "54321",
            "ort": "Kundenstadt"
        }
        
        # Create Kunde
        create_res = api_client.post(f"{BASE_URL}/api/modules/kunden/data", json=kunde_data)
        assert create_res.status_code == 200, f"Failed to create Kunde: {create_res.text}"
        kunde = create_res.json()
        kunde_id = kunde["id"]
        
        # Transfer to Kontakt-Modul
        transfer_res = api_client.post(f"{BASE_URL}/api/modules/kontakt/from-kunden/{kunde_id}")
        assert transfer_res.status_code == 200, f"Transfer failed: {transfer_res.text}"
        
        result = transfer_res.json()
        assert "kontakt" in result, "Response should contain 'kontakt'"
        assert result.get("already_exists") == False, "Should be a new transfer"
        assert result["kontakt"]["vorname"] == kunde_data["vorname"]
        assert result["kontakt"]["nachname"] == kunde_data["nachname"]
        assert result["kontakt"]["email"] == kunde_data["email"]
        assert result["kontakt"]["source_kunden_id"] == kunde_id
        assert result["kontakt"]["kontakt_status"] == "Kunde"  # Should be set to "Kunde"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}")
        api_client.delete(f"{BASE_URL}/api/modules/kontakt/data/{result['kontakt']['id']}")
        print("PASS: Kunde -> Kontakt transfer works correctly")
    
    def test_duplicate_detection_kunde_to_kontakt(self, api_client):
        """Test duplicate detection when transferring Kunde to Kontakt"""
        unique_id = str(uuid4())[:8]
        email = f"test_dup_k2k_{unique_id}@example.com"
        
        # Create Kunde
        kunde_data = {
            "vorname": f"TEST_DupK2K_{unique_id}",
            "nachname": "Test",
            "email": email,
            "customer_type": "Privat"
        }
        create_res = api_client.post(f"{BASE_URL}/api/modules/kunden/data", json=kunde_data)
        assert create_res.status_code == 200
        kunde_id = create_res.json()["id"]
        
        # First transfer
        transfer1 = api_client.post(f"{BASE_URL}/api/modules/kontakt/from-kunden/{kunde_id}")
        assert transfer1.status_code == 200
        assert transfer1.json().get("already_exists") == False
        kontakt_id = transfer1.json()["kontakt"]["id"]
        
        # Second transfer - should detect duplicate
        transfer2 = api_client.post(f"{BASE_URL}/api/modules/kontakt/from-kunden/{kunde_id}")
        assert transfer2.status_code == 200
        assert transfer2.json().get("already_exists") == True
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}")
        api_client.delete(f"{BASE_URL}/api/modules/kontakt/data/{kontakt_id}")
        print("PASS: Duplicate detection Kunde -> Kontakt works")
    
    def test_transfer_nonexistent_kunde(self, api_client):
        """Test transfer of non-existent Kunde returns 404"""
        fake_id = str(uuid4())
        res = api_client.post(f"{BASE_URL}/api/modules/kontakt/from-kunden/{fake_id}")
        assert res.status_code == 404
        print("PASS: Non-existent Kunde returns 404")


class TestDocumentEditorDataSources:
    """Test that Document Editor loads data from all modules"""
    
    def test_kunden_modul_data_available(self, api_client):
        """Verify Kunden-Modul data is accessible for Document Editor"""
        res = api_client.get(f"{BASE_URL}/api/modules/kunden/data")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Kunden-Modul returns {len(data)} customers")
    
    def test_kontakt_modul_data_available(self, api_client):
        """Verify Kontakt-Modul data is accessible for Document Editor"""
        res = api_client.get(f"{BASE_URL}/api/modules/kontakt/data")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Kontakt-Modul returns {len(data)} contacts")
    
    def test_artikel_modul_data_available(self, api_client):
        """Verify Artikel-Modul data is accessible for Document Editor"""
        res = api_client.get(f"{BASE_URL}/api/modules/artikel/data")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Artikel-Modul returns {len(data)} articles")
    
    def test_textvorlagen_modul_data_available(self, api_client):
        """Verify Textvorlagen-Modul data is accessible for Document Editor"""
        res = api_client.get(f"{BASE_URL}/api/modules/textvorlagen/data")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Textvorlagen-Modul returns {len(data)} templates")
    
    def test_customers_endpoint_available(self, api_client):
        """Verify legacy customers endpoint is accessible"""
        res = api_client.get(f"{BASE_URL}/api/customers")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Customers endpoint returns {len(data)} customers")
    
    def test_articles_endpoint_available(self, api_client):
        """Verify articles endpoint is accessible"""
        res = api_client.get(f"{BASE_URL}/api/articles")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Articles endpoint returns {len(data)} articles")


class TestTextTemplateSelect:
    """Test TextTemplateSelect component data sources"""
    
    def test_text_templates_endpoint(self, api_client):
        """Verify text-templates endpoint works"""
        res = api_client.get(f"{BASE_URL}/api/text-templates")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: Text-templates returns {len(data)} templates")
    
    def test_text_templates_by_type(self, api_client):
        """Verify text-templates can be filtered by type"""
        for text_type in ["vortext", "schlusstext", "betreff"]:
            res = api_client.get(f"{BASE_URL}/api/text-templates", params={"text_type": text_type})
            assert res.status_code == 200
            print(f"PASS: Text-templates for {text_type} works")
    
    def test_textvorlagen_modul_by_type(self, api_client):
        """Verify Textvorlagen-Modul can be filtered by type"""
        for text_type in ["vortext", "schlusstext", "betreff"]:
            res = api_client.get(f"{BASE_URL}/api/modules/textvorlagen/data", params={"text_type": text_type})
            assert res.status_code == 200
            print(f"PASS: Textvorlagen-Modul for {text_type} works")


class TestModuleEndpointsExist:
    """Verify all required module endpoints exist"""
    
    def test_kunden_from_kontakt_endpoint_exists(self, api_client):
        """POST /api/modules/kunden/from-kontakt/{id} exists"""
        # Use a fake ID to test endpoint exists (should return 404, not 405)
        res = api_client.post(f"{BASE_URL}/api/modules/kunden/from-kontakt/fake-id")
        assert res.status_code == 404  # Not 405 Method Not Allowed
        print("PASS: /api/modules/kunden/from-kontakt endpoint exists")
    
    def test_kontakt_from_kunden_endpoint_exists(self, api_client):
        """POST /api/modules/kontakt/from-kunden/{id} exists"""
        res = api_client.post(f"{BASE_URL}/api/modules/kontakt/from-kunden/fake-id")
        assert res.status_code == 404  # Not 405 Method Not Allowed
        print("PASS: /api/modules/kontakt/from-kunden endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
