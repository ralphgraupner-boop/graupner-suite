"""
Test suite for Kunden-Modul API endpoints
Tests all CRUD operations, VCF import, file upload/delete, and export
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestKundenModulAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestKundenModulCRUD(TestKundenModulAuth):
    """CRUD operations for Kunden-Modul"""
    
    created_kunde_id = None
    
    def test_01_get_kunden_list(self, auth_headers):
        """GET /api/modules/kunden/data - Kundenliste abrufen"""
        response = requests.get(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} Kunden in database")
    
    def test_02_create_kunde(self, auth_headers):
        """POST /api/modules/kunden/data - Neuen Kunden erstellen"""
        payload = {
            "vorname": "TEST_Vorname",
            "nachname": "TEST_Nachname",
            "firma": "TEST Firma GmbH",
            "email": "test@kunden-modul.de",
            "phone": "040-9876543",
            "strasse": "Teststrasse",
            "hausnummer": "42",
            "plz": "20095",
            "ort": "Hamburg",
            "customer_type": "Firma",
            "status": "Neu",
            "categories": ["Sanitär", "Heizung"],
            "notes": "Testkunde für automatisierte Tests"
        }
        response = requests.post(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["vorname"] == "TEST_Vorname"
        assert data["nachname"] == "TEST_Nachname"
        assert data["firma"] == "TEST Firma GmbH"
        assert data["email"] == "test@kunden-modul.de"
        assert data["customer_type"] == "Firma"
        assert data["status"] == "Neu"
        assert "Sanitär" in data["categories"]
        assert data["name"] == "TEST_Vorname TEST_Nachname"  # Auto-generated
        assert "Teststrasse 42" in data["address"]  # Auto-generated address
        
        TestKundenModulCRUD.created_kunde_id = data["id"]
        print(f"Created Kunde with ID: {data['id']}")
    
    def test_03_get_single_kunde(self, auth_headers):
        """GET /api/modules/kunden/data/{id} - Einzelnen Kunden abrufen"""
        kunde_id = TestKundenModulCRUD.created_kunde_id
        assert kunde_id, "No kunde_id from previous test"
        
        response = requests.get(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == kunde_id
        assert data["vorname"] == "TEST_Vorname"
        assert data["nachname"] == "TEST_Nachname"
    
    def test_04_update_kunde(self, auth_headers):
        """PUT /api/modules/kunden/data/{id} - Kunden bearbeiten"""
        kunde_id = TestKundenModulCRUD.created_kunde_id
        assert kunde_id, "No kunde_id from previous test"
        
        update_payload = {
            "vorname": "TEST_Updated",
            "nachname": "TEST_Nachname_Updated",
            "status": "Angebot erstellt",
            "notes": "Aktualisierte Notizen"
        }
        response = requests.put(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers, json=update_payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["vorname"] == "TEST_Updated"
        assert data["nachname"] == "TEST_Nachname_Updated"
        assert data["status"] == "Angebot erstellt"
        assert data["notes"] == "Aktualisierte Notizen"
        assert data["name"] == "TEST_Updated TEST_Nachname_Updated"  # Auto-updated
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["vorname"] == "TEST_Updated"
    
    def test_05_export_kunden(self, auth_headers):
        """GET /api/modules/kunden/export - Export"""
        response = requests.get(f"{BASE_URL}/api/modules/kunden/export", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "module" in data
        assert "data" in data
        assert "exported_at" in data
        assert "count" in data
        assert data["module"]["slug"] == "kunden"
        assert isinstance(data["data"], list)
        print(f"Export contains {data['count']} Kunden")
    
    def test_06_delete_kunde(self, auth_headers):
        """DELETE /api/modules/kunden/data/{id} - Kunden löschen"""
        kunde_id = TestKundenModulCRUD.created_kunde_id
        assert kunde_id, "No kunde_id from previous test"
        
        response = requests.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Kunde geloescht"
        
        # Verify deletion with GET
        get_response = requests.get(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
        assert get_response.status_code == 404


class TestKundenModulVCF(TestKundenModulAuth):
    """VCF Import tests"""
    
    vcf_kunde_id = None
    
    def test_01_import_vcf(self, auth_headers):
        """POST /api/modules/kunden/import-vcf - VCF Import"""
        vcf_content = """BEGIN:VCARD
VERSION:3.0
N:TEST_VCF_Nachname;TEST_VCF_Vorname;;;
FN:TEST_VCF_Vorname TEST_VCF_Nachname
TEL;TYPE=CELL:+49 170 9999999
EMAIL:vcf.test@example.com
ADR;TYPE=HOME:;;VCF Strasse 99;Berlin;;10115;Germany
ORG:VCF Test Firma
END:VCARD"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.vcf', delete=False) as f:
            f.write(vcf_content)
            vcf_path = f.name
        
        try:
            with open(vcf_path, 'rb') as f:
                files = {'file': ('test.vcf', f, 'text/vcard')}
                headers = {"Authorization": auth_headers["Authorization"]}
                response = requests.post(f"{BASE_URL}/api/modules/kunden/import-vcf", headers=headers, files=files)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["vorname"] == "TEST_VCF_Vorname"
            assert data["nachname"] == "TEST_VCF_Nachname"
            assert data["email"] == "vcf.test@example.com"
            assert data["firma"] == "VCF Test Firma"
            assert "id" in data
            
            TestKundenModulVCF.vcf_kunde_id = data["id"]
            print(f"VCF imported Kunde with ID: {data['id']}")
        finally:
            os.unlink(vcf_path)
    
    def test_02_cleanup_vcf_kunde(self, auth_headers):
        """Cleanup: Delete VCF imported Kunde"""
        kunde_id = TestKundenModulVCF.vcf_kunde_id
        if kunde_id:
            response = requests.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
            assert response.status_code == 200


class TestKundenModulFileUpload(TestKundenModulAuth):
    """File upload/delete tests"""
    
    file_test_kunde_id = None
    
    def test_01_create_kunde_for_file_test(self, auth_headers):
        """Create a Kunde for file upload tests"""
        payload = {
            "vorname": "TEST_File",
            "nachname": "TEST_Upload",
            "email": "file.test@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers, json=payload)
        assert response.status_code == 200
        TestKundenModulFileUpload.file_test_kunde_id = response.json()["id"]
    
    def test_02_upload_file(self, auth_headers):
        """POST /api/modules/kunden/data/{id}/upload - Datei-Upload"""
        kunde_id = TestKundenModulFileUpload.file_test_kunde_id
        assert kunde_id, "No kunde_id from previous test"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("Test file content for Kunden-Modul")
            file_path = f.name
        
        try:
            with open(file_path, 'rb') as f:
                files = {'files': ('test_document.txt', f, 'text/plain')}
                headers = {"Authorization": auth_headers["Authorization"]}
                response = requests.post(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}/upload", headers=headers, files=files)
            
            assert response.status_code == 200
            data = response.json()
            
            assert "uploaded" in data
            assert len(data["uploaded"]) == 1
            assert data["uploaded"][0]["filename"] == "test_document.txt"
            assert data["total_files"] == 1
            print(f"Uploaded file: {data['uploaded'][0]['url']}")
        finally:
            os.unlink(file_path)
    
    def test_03_verify_file_in_kunde(self, auth_headers):
        """Verify file was added to Kunde"""
        kunde_id = TestKundenModulFileUpload.file_test_kunde_id
        response = requests.get(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["photos"]) == 1
        assert data["photos"][0]["filename"] == "test_document.txt"
    
    def test_04_delete_file(self, auth_headers):
        """DELETE /api/modules/kunden/data/{id}/files/{index} - Datei löschen"""
        kunde_id = TestKundenModulFileUpload.file_test_kunde_id
        
        response = requests.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}/files/0", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["message"] == "Datei geloescht"
        assert data["remaining_files"] == 0
    
    def test_05_verify_file_deleted(self, auth_headers):
        """Verify file was removed from Kunde"""
        kunde_id = TestKundenModulFileUpload.file_test_kunde_id
        response = requests.get(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["photos"]) == 0
    
    def test_06_cleanup_file_test_kunde(self, auth_headers):
        """Cleanup: Delete file test Kunde"""
        kunde_id = TestKundenModulFileUpload.file_test_kunde_id
        if kunde_id:
            response = requests.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)
            assert response.status_code == 200


class TestKundenModulEdgeCases(TestKundenModulAuth):
    """Edge case tests"""
    
    def test_get_nonexistent_kunde(self, auth_headers):
        """GET non-existent Kunde returns 404"""
        response = requests.get(f"{BASE_URL}/api/modules/kunden/data/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
    
    def test_delete_nonexistent_kunde(self, auth_headers):
        """DELETE non-existent Kunde returns 404"""
        response = requests.delete(f"{BASE_URL}/api/modules/kunden/data/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
    
    def test_update_nonexistent_kunde(self, auth_headers):
        """PUT non-existent Kunde returns 404"""
        response = requests.put(f"{BASE_URL}/api/modules/kunden/data/nonexistent-id-12345", 
                               headers=auth_headers, json={"vorname": "Test"})
        assert response.status_code == 404
    
    def test_delete_file_invalid_index(self, auth_headers):
        """DELETE file with invalid index returns 404"""
        # First create a kunde
        payload = {"vorname": "TEST_Edge", "nachname": "TEST_Case"}
        create_response = requests.post(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers, json=payload)
        kunde_id = create_response.json()["id"]
        
        # Try to delete file at index 99 (doesn't exist)
        response = requests.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}/files/99", headers=auth_headers)
        assert response.status_code == 404
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/modules/kunden/data/{kunde_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
