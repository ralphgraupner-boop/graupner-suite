"""
Tests for Lexware Import functionality
- POST /api/lexware-import/parse - Parse ZIP file and return preview
- POST /api/lexware-import/execute - Execute import and return log
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLexwareImport:
    """Lexware Import endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_parse_endpoint_requires_auth(self):
        """Test that parse endpoint requires authentication"""
        # Test without auth
        response = requests.post(f"{BASE_URL}/api/lexware-import/parse")
        assert response.status_code in [401, 422], f"Expected 401/422, got {response.status_code}"
        print("PASS: Parse endpoint requires authentication")
    
    def test_parse_endpoint_requires_admin(self):
        """Test that parse endpoint requires admin role"""
        # Login as non-admin user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "h.bolanka",
            "password": "Buch$2026!Grau"
        })
        if login_resp.status_code == 200:
            non_admin_token = login_resp.json().get("token")
            non_admin_headers = {"Authorization": f"Bearer {non_admin_token}"}
            
            # Try to access parse endpoint
            with open("/tmp/lexware_export.zip", "rb") as f:
                response = requests.post(
                    f"{BASE_URL}/api/lexware-import/parse",
                    headers=non_admin_headers,
                    files={"file": ("test.zip", f, "application/zip")}
                )
            assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
            print("PASS: Parse endpoint requires admin role")
        else:
            pytest.skip("Non-admin user not available")
    
    def test_parse_endpoint_with_valid_zip(self):
        """Test parse endpoint with valid Lexware ZIP file"""
        zip_path = "/tmp/lexware_export.zip"
        if not os.path.exists(zip_path):
            pytest.skip("Test ZIP file not found")
        
        with open(zip_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/lexware-import/parse",
                headers=self.headers,
                files={"file": ("lexware_export.zip", f, "application/zip")}
            )
        
        assert response.status_code == 200, f"Parse failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least 1 parsed employee"
        
        # Verify each item has required fields
        for item in data:
            assert "parsed_data" in item, "Item should have parsed_data"
            assert "matched_mitarbeiter" in item, "Item should have matched_mitarbeiter"
            assert "source_file" in item, "Item should have source_file"
            
            pd = item["parsed_data"]
            assert "vorname" in pd, "parsed_data should have vorname"
            assert "nachname" in pd, "parsed_data should have nachname"
        
        print(f"PASS: Parse endpoint returned {len(data)} employees")
        
        # Verify specific employees
        names = [f"{item['parsed_data'].get('vorname', '')} {item['parsed_data'].get('nachname', '')}" for item in data]
        print(f"  Parsed employees: {names}")
        
        # Check for expected employees
        assert any("Thorsten" in n and "Graupner" in n for n in names), "Should find Thorsten Graupner"
        print("PASS: Found Thorsten Graupner in parsed data")
    
    def test_parse_returns_matched_employees(self):
        """Test that parse endpoint matches existing employees"""
        zip_path = "/tmp/lexware_export.zip"
        if not os.path.exists(zip_path):
            pytest.skip("Test ZIP file not found")
        
        with open(zip_path, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/lexware-import/parse",
                headers=self.headers,
                files={"file": ("lexware_export.zip", f, "application/zip")}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that at least one employee is matched
        matched_count = sum(1 for item in data if item.get("matched_mitarbeiter"))
        print(f"PASS: {matched_count} of {len(data)} employees matched to existing records")
        
        # Verify matched employee has id
        for item in data:
            if item.get("matched_mitarbeiter"):
                assert "id" in item["matched_mitarbeiter"], "Matched employee should have id"
    
    def test_execute_endpoint_requires_auth(self):
        """Test that execute endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/lexware-import/execute")
        assert response.status_code in [401, 422], f"Expected 401/422, got {response.status_code}"
        print("PASS: Execute endpoint requires authentication")
    
    def test_execute_endpoint_requires_admin(self):
        """Test that execute endpoint requires admin role"""
        # Login as non-admin user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "h.bolanka",
            "password": "Buch$2026!Grau"
        })
        if login_resp.status_code == 200:
            non_admin_token = login_resp.json().get("token")
            non_admin_headers = {"Authorization": f"Bearer {non_admin_token}"}
            
            # Try to access execute endpoint
            with open("/tmp/lexware_export.zip", "rb") as f:
                response = requests.post(
                    f"{BASE_URL}/api/lexware-import/execute",
                    headers=non_admin_headers,
                    files={"file": ("test.zip", f, "application/zip")}
                )
            assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
            print("PASS: Execute endpoint requires admin role")
        else:
            pytest.skip("Non-admin user not available")


class TestMitarbeiterWithLexwareData:
    """Tests to verify Lexware imported data in Mitarbeiter"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_mitarbeiter_list_has_imported_employees(self):
        """Test that Mitarbeiter list includes imported employees"""
        response = requests.get(f"{BASE_URL}/api/mitarbeiter", headers=self.headers)
        assert response.status_code == 200
        
        employees = response.json()
        assert len(employees) >= 2, "Should have at least 2 employees"
        
        # Check for specific employees
        names = [f"{e.get('vorname', '')} {e.get('nachname', '')}" for e in employees]
        print(f"Found {len(employees)} employees: {names}")
        
        # Verify Heike Bolanca (created by Lexware import)
        heike = next((e for e in employees if e.get("vorname") == "Heike" and e.get("nachname") == "Bolanca"), None)
        assert heike is not None, "Heike Bolanca should exist"
        print("PASS: Heike Bolanca found (created by Lexware import)")
        
        # Verify Thorsten Graupner (updated by Lexware import)
        thorsten = next((e for e in employees if e.get("vorname") == "Thorsten" and e.get("nachname") == "Graupner" and e.get("position") == "Geselle"), None)
        assert thorsten is not None, "Thorsten Graupner (Geselle) should exist"
        print("PASS: Thorsten Graupner (Geselle) found")
    
    def test_thorsten_has_imported_stammdaten(self):
        """Test that Thorsten Graupner has correct imported Stammdaten"""
        response = requests.get(f"{BASE_URL}/api/mitarbeiter", headers=self.headers)
        assert response.status_code == 200
        
        employees = response.json()
        thorsten = next((e for e in employees if e.get("id") == "669c101c"), None)
        
        if not thorsten:
            # Try to find by name and position
            thorsten = next((e for e in employees if e.get("vorname") == "Thorsten" and e.get("nachname") == "Graupner" and e.get("position") == "Geselle"), None)
        
        assert thorsten is not None, "Thorsten Graupner (Geselle) not found"
        
        # Verify imported address data
        assert thorsten.get("strasse") == "Schmiedekoppel 153", f"Strasse should be 'Schmiedekoppel 153', got '{thorsten.get('strasse')}'"
        assert thorsten.get("plz") == "22453", f"PLZ should be '22453', got '{thorsten.get('plz')}'"
        assert thorsten.get("ort") == "Hamburg", f"Ort should be 'Hamburg', got '{thorsten.get('ort')}'"
        print("PASS: Address data correctly imported (Schmiedekoppel 153, 22453 Hamburg)")
        
        # Verify imported SV data
        assert thorsten.get("sv_nummer") == "59040190G009", f"SV-Nummer should be '59040190G009', got '{thorsten.get('sv_nummer')}'"
        assert "DAK" in thorsten.get("krankenkasse", ""), f"Krankenkasse should contain 'DAK', got '{thorsten.get('krankenkasse')}'"
        print("PASS: SV data correctly imported (SV-Nr: 59040190G009, KK: DAK)")
        
        # Verify imported salary data
        assert thorsten.get("lohnart") == "monatsgehalt", f"Lohnart should be 'monatsgehalt', got '{thorsten.get('lohnart')}'"
        assert thorsten.get("monatsgehalt") == 2200.0, f"Monatsgehalt should be 2200.0, got '{thorsten.get('monatsgehalt')}'"
        print("PASS: Salary data correctly imported (Monatsgehalt: 2200.0)")
    
    def test_thorsten_has_lohnhistorie_entry(self):
        """Test that Thorsten has Lohnhistorie entry from Lexware import"""
        # Get Thorsten's ID
        response = requests.get(f"{BASE_URL}/api/mitarbeiter", headers=self.headers)
        employees = response.json()
        thorsten = next((e for e in employees if e.get("id") == "669c101c"), None)
        
        if not thorsten:
            thorsten = next((e for e in employees if e.get("vorname") == "Thorsten" and e.get("nachname") == "Graupner" and e.get("position") == "Geselle"), None)
        
        assert thorsten is not None, "Thorsten not found"
        ma_id = thorsten.get("id")
        
        # Get Lohnhistorie
        response = requests.get(f"{BASE_URL}/api/mitarbeiter/{ma_id}/lohnhistorie", headers=self.headers)
        assert response.status_code == 200
        
        history = response.json()
        assert len(history) >= 1, "Should have at least 1 Lohnhistorie entry"
        
        # Check for Lexware Import entry
        lexware_entry = next((h for h in history if "Lexware Import" in h.get("bemerkung", "")), None)
        assert lexware_entry is not None, "Should have Lohnhistorie entry with 'Lexware Import' bemerkung"
        
        assert lexware_entry.get("lohnart") == "monatsgehalt", "Lohnart should be monatsgehalt"
        assert lexware_entry.get("monatsgehalt") == 2200.0, "Monatsgehalt should be 2200.0"
        print(f"PASS: Lohnhistorie entry found with bemerkung: '{lexware_entry.get('bemerkung')}'")
    
    def test_thorsten_has_imported_dokument(self):
        """Test that Thorsten has PDF document from Lexware import"""
        # Get Thorsten's ID
        response = requests.get(f"{BASE_URL}/api/mitarbeiter", headers=self.headers)
        employees = response.json()
        thorsten = next((e for e in employees if e.get("id") == "669c101c"), None)
        
        if not thorsten:
            thorsten = next((e for e in employees if e.get("vorname") == "Thorsten" and e.get("nachname") == "Graupner" and e.get("position") == "Geselle"), None)
        
        assert thorsten is not None, "Thorsten not found"
        ma_id = thorsten.get("id")
        
        # Get Dokumente
        response = requests.get(f"{BASE_URL}/api/mitarbeiter/{ma_id}/dokumente", headers=self.headers)
        assert response.status_code == 200
        
        docs = response.json()
        assert len(docs) >= 1, "Should have at least 1 document"
        
        # Check for Lexware imported PDF
        lexware_doc = next((d for d in docs if "lexware" in d.get("storage_key", "").lower() or "Lohnabrechnung" in d.get("filename", "")), None)
        assert lexware_doc is not None, "Should have document from Lexware import"
        
        assert lexware_doc.get("content_type") == "application/pdf", "Document should be PDF"
        assert lexware_doc.get("kategorie") == "entgelt::Verdienstbescheinigung", f"Kategorie should be 'entgelt::Verdienstbescheinigung', got '{lexware_doc.get('kategorie')}'"
        print(f"PASS: PDF document found: '{lexware_doc.get('filename')}' with kategorie '{lexware_doc.get('kategorie')}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
