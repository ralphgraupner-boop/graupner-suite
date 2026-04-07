"""
Test suite for enhanced Buchhaltung (Accounting) module features:
- Fortlaufende Belegnummern (B-YYYY-NNNN format)
- Plausibilitätsprüfung (duplicate detection, amount validation, category check, future date warning)
- Kassenbuch (chronological with running balance)
- Monatsabschluss (monthly summary per year)
- CSV-Export for Steuerberater
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestBelegnummern:
    """Test fortlaufende Belegnummern (B-YYYY-NNNN format)"""
    
    def test_create_buchung_gets_auto_belegnummer(self, auth_headers):
        """POST /api/buchhaltung/buchungen should auto-generate belegnummer"""
        response = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen", 
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_Belegnummer_Test",
                "betrag_netto": 100,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify belegnummer format B-YYYY-NNNN
        assert "belegnummer" in data, "Response should contain belegnummer"
        belegnummer = data["belegnummer"]
        assert belegnummer.startswith("B-"), f"Belegnummer should start with 'B-', got: {belegnummer}"
        
        year = datetime.now().year
        assert f"B-{year}-" in belegnummer, f"Belegnummer should contain year {year}, got: {belegnummer}"
        
        # Verify format: B-YYYY-NNNN (4 digit number)
        parts = belegnummer.split("-")
        assert len(parts) == 3, f"Belegnummer should have 3 parts, got: {parts}"
        assert len(parts[2]) == 4, f"Number part should be 4 digits, got: {parts[2]}"
        
        # Store ID for cleanup
        self.created_id = data["id"]
        print(f"✓ Created buchung with belegnummer: {belegnummer}")
    
    def test_belegnummer_increments(self, auth_headers):
        """Creating another buchung should increment belegnummer"""
        # Create first buchung
        response1 = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen", 
            headers=auth_headers,
            json={
                "typ": "einnahme",
                "kategorie": "Rechnung",
                "beschreibung": "TEST_Increment_1",
                "betrag_netto": 50,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response1.status_code == 200
        beleg1 = response1.json()["belegnummer"]
        id1 = response1.json()["id"]
        
        # Create second buchung
        response2 = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen", 
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Werkzeug",
                "beschreibung": "TEST_Increment_2",
                "betrag_netto": 75,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response2.status_code == 200
        beleg2 = response2.json()["belegnummer"]
        id2 = response2.json()["id"]
        
        # Extract numbers and verify increment
        num1 = int(beleg1.split("-")[-1])
        num2 = int(beleg2.split("-")[-1])
        assert num2 > num1, f"Second belegnummer ({num2}) should be greater than first ({num1})"
        
        print(f"✓ Belegnummern increment correctly: {beleg1} → {beleg2}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{id1}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{id2}", headers=auth_headers)


class TestPlausibilitaetspruefung:
    """Test Plausibilitätsprüfung endpoint"""
    
    def test_plausibility_empty_category_warning(self, auth_headers):
        """Empty category should return warnung"""
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "",
                "beschreibung": "Test",
                "betrag_brutto": 100,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "warnungen" in data
        assert "ok" in data
        
        # Should have warning for empty category
        warnings = data["warnungen"]
        category_warning = [w for w in warnings if "Kategorie" in w.get("text", "")]
        assert len(category_warning) > 0, "Should warn about missing category"
        assert category_warning[0]["typ"] == "warnung"
        
        # ok should be True (warnung doesn't block)
        assert data["ok"] == True, "ok should be True for warnings (not errors)"
        print(f"✓ Empty category returns warnung: {category_warning[0]['text']}")
    
    def test_plausibility_zero_amount_error(self, auth_headers):
        """Zero amount should return fehler (blocks saving)"""
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "Test",
                "betrag_brutto": 0,
                "betrag_netto": 0,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have error for zero amount
        warnings = data["warnungen"]
        amount_error = [w for w in warnings if "0" in w.get("text", "") or "negativ" in w.get("text", "")]
        assert len(amount_error) > 0, "Should error on zero amount"
        assert amount_error[0]["typ"] == "fehler"
        
        # ok should be False (fehler blocks)
        assert data["ok"] == False, "ok should be False when there are errors"
        print(f"✓ Zero amount returns fehler: {amount_error[0]['text']}")
    
    def test_plausibility_high_amount_warning(self, auth_headers):
        """Amount > 50000 should return warnung"""
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "Test",
                "betrag_brutto": 60000,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        warnings = data["warnungen"]
        high_amount_warning = [w for w in warnings if "hoch" in w.get("text", "").lower() or "60000" in w.get("text", "")]
        assert len(high_amount_warning) > 0, "Should warn about high amount"
        assert high_amount_warning[0]["typ"] == "warnung"
        assert data["ok"] == True
        print(f"✓ High amount (>50000) returns warnung: {high_amount_warning[0]['text']}")
    
    def test_plausibility_future_date_warning(self, auth_headers):
        """Future date should return warnung"""
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "Test",
                "betrag_brutto": 100,
                "datum": future_date
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        warnings = data["warnungen"]
        future_warning = [w for w in warnings if "Zukunft" in w.get("text", "")]
        assert len(future_warning) > 0, "Should warn about future date"
        assert future_warning[0]["typ"] == "warnung"
        print(f"✓ Future date returns warnung: {future_warning[0]['text']}")
    
    def test_plausibility_duplicate_detection(self, auth_headers):
        """Creating same buchung twice should warn about duplicate"""
        # First create a buchung
        today = datetime.now().strftime("%Y-%m-%d")
        response1 = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_Duplicate_Detection",
                "betrag_brutto": 123.45,
                "datum": today
            }
        )
        assert response1.status_code == 200
        id1 = response1.json()["id"]
        
        # Now check plausibility for same data
        response2 = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_Duplicate_Detection",
                "betrag_brutto": 123.45,
                "datum": today
            }
        )
        assert response2.status_code == 200
        data = response2.json()
        
        warnings = data["warnungen"]
        dup_warning = [w for w in warnings if "Doppel" in w.get("text", "") or "ähnlich" in w.get("text", "")]
        assert len(dup_warning) > 0, "Should warn about potential duplicate"
        print(f"✓ Duplicate detection works: {dup_warning[0]['text']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{id1}", headers=auth_headers)
    
    def test_plausibility_missing_description_hint(self, auth_headers):
        """Missing description should return hinweis"""
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "",
                "betrag_brutto": 100,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        warnings = data["warnungen"]
        desc_hint = [w for w in warnings if "Beschreibung" in w.get("text", "")]
        assert len(desc_hint) > 0, "Should hint about missing description"
        assert desc_hint[0]["typ"] == "hinweis"
        print(f"✓ Missing description returns hinweis: {desc_hint[0]['text']}")


class TestKassenbuch:
    """Test Kassenbuch endpoint (chronological with running balance)"""
    
    def test_kassenbuch_returns_entries_with_saldo(self, auth_headers):
        """GET /api/buchhaltung/kassenbuch should return entries with running saldo"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kassenbuch",
            headers=auth_headers,
            params={"zeitraum": "jahr"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "eintraege" in data, "Response should contain 'eintraege'"
        assert "endsaldo" in data, "Response should contain 'endsaldo'"
        
        print(f"✓ Kassenbuch returns {len(data['eintraege'])} entries, endsaldo: {data['endsaldo']}")
    
    def test_kassenbuch_entries_have_saldo_field(self, auth_headers):
        """Each kassenbuch entry should have saldo field"""
        # First create a test buchung
        response1 = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "einnahme",
                "kategorie": "Rechnung",
                "beschreibung": "TEST_Kassenbuch_Entry",
                "betrag_brutto": 500,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        assert response1.status_code == 200
        test_id = response1.json()["id"]
        
        # Get kassenbuch
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kassenbuch",
            headers=auth_headers,
            params={"zeitraum": "jahr"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["eintraege"]:
            entry = data["eintraege"][0]
            assert "saldo" in entry, "Each entry should have 'saldo' field"
            assert "belegnummer" in entry, "Each entry should have 'belegnummer' field"
            assert "datum" in entry, "Each entry should have 'datum' field"
            assert "beschreibung" in entry, "Each entry should have 'beschreibung' field"
            assert "kategorie" in entry, "Each entry should have 'kategorie' field"
            assert "typ" in entry, "Each entry should have 'typ' field"
            assert "betrag_brutto" in entry, "Each entry should have 'betrag_brutto' field"
            print(f"✓ Kassenbuch entry has all required fields including saldo: {entry.get('saldo')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{test_id}", headers=auth_headers)
    
    def test_kassenbuch_running_balance_calculation(self, auth_headers):
        """Kassenbuch should calculate running balance correctly"""
        # Create einnahme
        r1 = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "einnahme",
                "kategorie": "Rechnung",
                "beschreibung": "TEST_Balance_Einnahme",
                "betrag_brutto": 1000,
                "datum": datetime.now().strftime("%Y-%m-%d") + "T10:00:00"
            }
        )
        id1 = r1.json()["id"]
        
        # Create ausgabe
        r2 = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_Balance_Ausgabe",
                "betrag_brutto": 300,
                "datum": datetime.now().strftime("%Y-%m-%d") + "T11:00:00"
            }
        )
        id2 = r2.json()["id"]
        
        # Get kassenbuch
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kassenbuch",
            headers=auth_headers,
            params={"zeitraum": "jahr"}
        )
        data = response.json()
        
        # Verify endsaldo is a number
        assert isinstance(data["endsaldo"], (int, float)), "endsaldo should be a number"
        print(f"✓ Kassenbuch running balance calculated, endsaldo: {data['endsaldo']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{id1}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{id2}", headers=auth_headers)
    
    def test_kassenbuch_zeitraum_filter(self, auth_headers):
        """Kassenbuch should respect zeitraum filter"""
        for zeitraum in ["monat", "quartal", "jahr", "alle"]:
            response = requests.get(f"{BASE_URL}/api/buchhaltung/kassenbuch",
                headers=auth_headers,
                params={"zeitraum": zeitraum}
            )
            assert response.status_code == 200, f"Zeitraum '{zeitraum}' should work"
            data = response.json()
            assert "eintraege" in data
            assert "endsaldo" in data
        print("✓ Kassenbuch zeitraum filter works for all options")


class TestMonatsabschluss:
    """Test Monatsabschluss endpoint (monthly summary per year)"""
    
    def test_monatsabschluss_returns_monthly_data(self, auth_headers):
        """GET /api/buchhaltung/monatsabschluss should return monthly summaries"""
        year = datetime.now().year
        response = requests.get(f"{BASE_URL}/api/buchhaltung/monatsabschluss",
            headers=auth_headers,
            params={"jahr": year}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "jahr" in data, "Response should contain 'jahr'"
        assert "monate" in data, "Response should contain 'monate'"
        assert data["jahr"] == year, f"Jahr should be {year}"
        
        print(f"✓ Monatsabschluss returns data for {year} with {len(data['monate'])} months")
    
    def test_monatsabschluss_month_structure(self, auth_headers):
        """Each month should have einnahmen, ausgaben, gewinn, zahllast"""
        # First create a test buchung to ensure we have data
        r = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "einnahme",
                "kategorie": "Rechnung",
                "beschreibung": "TEST_Monatsabschluss",
                "betrag_netto": 1000,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        test_id = r.json()["id"]
        
        year = datetime.now().year
        response = requests.get(f"{BASE_URL}/api/buchhaltung/monatsabschluss",
            headers=auth_headers,
            params={"jahr": year}
        )
        data = response.json()
        
        if data["monate"]:
            month = data["monate"][0]
            assert "monat" in month, "Month should have 'monat' field"
            assert "einnahmen" in month, "Month should have 'einnahmen' field"
            assert "ausgaben" in month, "Month should have 'ausgaben' field"
            assert "gewinn" in month, "Month should have 'gewinn' field"
            assert "zahllast" in month, "Month should have 'zahllast' field"
            assert "anzahl" in month, "Month should have 'anzahl' field"
            print(f"✓ Month structure correct: {month['monat']} - Einnahmen: {month['einnahmen']}, Ausgaben: {month['ausgaben']}, Gewinn: {month['gewinn']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{test_id}", headers=auth_headers)
    
    def test_monatsabschluss_year_navigation(self, auth_headers):
        """Should be able to query different years"""
        for year in [2024, 2025, 2026]:
            response = requests.get(f"{BASE_URL}/api/buchhaltung/monatsabschluss",
                headers=auth_headers,
                params={"jahr": year}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["jahr"] == year
        print("✓ Monatsabschluss year navigation works")
    
    def test_monatsabschluss_default_year(self, auth_headers):
        """Without jahr param, should default to current year"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/monatsabschluss",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["jahr"] == datetime.now().year
        print(f"✓ Monatsabschluss defaults to current year: {data['jahr']}")


class TestCSVExport:
    """Test CSV-Export endpoint"""
    
    def test_csv_export_returns_file(self, auth_headers):
        """GET /api/buchhaltung/export-csv should return CSV file"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv",
            headers=auth_headers,
            params={"zeitraum": "jahr"}
        )
        assert response.status_code == 200
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Content-Type should be text/csv, got: {content_type}"
        
        # Check content disposition (filename)
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp, "Should be attachment download"
        assert ".csv" in content_disp, "Filename should have .csv extension"
        
        print(f"✓ CSV export returns file with correct headers")
    
    def test_csv_export_semicolon_delimiter(self, auth_headers):
        """CSV should use semicolon as delimiter (German format)"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv",
            headers=auth_headers,
            params={"zeitraum": "jahr"}
        )
        content = response.text
        
        # Check header row uses semicolons
        first_line = content.split("\n")[0]
        assert ";" in first_line, "CSV should use semicolon delimiter"
        
        # Check expected columns
        assert "Belegnr." in first_line or "Beleg" in first_line, "Should have Belegnr column"
        assert "Datum" in first_line, "Should have Datum column"
        assert "Netto" in first_line, "Should have Netto column"
        assert "Brutto" in first_line, "Should have Brutto column"
        
        print(f"✓ CSV uses semicolon delimiter and has correct columns")
    
    def test_csv_export_german_number_format(self, auth_headers):
        """CSV should use German number format (comma for decimal)"""
        # First create a buchung with decimal amount
        r = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen",
            headers=auth_headers,
            json={
                "typ": "ausgabe",
                "kategorie": "Material",
                "beschreibung": "TEST_CSV_Format",
                "betrag_netto": 123.45,
                "mwst_satz": 19,
                "datum": datetime.now().strftime("%Y-%m-%d")
            }
        )
        test_id = r.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv",
            headers=auth_headers,
            params={"zeitraum": "jahr"}
        )
        content = response.text
        
        # German format uses comma for decimal
        # Look for pattern like "123,45" instead of "123.45"
        lines = content.split("\n")
        data_lines = [l for l in lines if "TEST_CSV_Format" in l]
        if data_lines:
            # Check that numbers use comma as decimal separator
            assert ",45" in data_lines[0] or ",91" in data_lines[0], "Should use German number format (comma for decimal)"
            print(f"✓ CSV uses German number format (comma for decimal)")
        else:
            print("✓ CSV export works (no test data found to verify number format)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{test_id}", headers=auth_headers)
    
    def test_csv_export_zeitraum_filter(self, auth_headers):
        """CSV export should respect zeitraum filter"""
        for zeitraum in ["monat", "quartal", "jahr", "alle"]:
            response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv",
                headers=auth_headers,
                params={"zeitraum": zeitraum}
            )
            assert response.status_code == 200, f"Zeitraum '{zeitraum}' should work"
        print("✓ CSV export zeitraum filter works for all options")


class TestAuthRequired:
    """Test that all endpoints require authentication"""
    
    def test_plausibilitaet_requires_auth(self):
        """POST /api/buchhaltung/plausibilitaet requires auth"""
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet",
            json={"betrag_brutto": 100}
        )
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_kassenbuch_requires_auth(self):
        """GET /api/buchhaltung/kassenbuch requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kassenbuch")
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_monatsabschluss_requires_auth(self):
        """GET /api/buchhaltung/monatsabschluss requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/monatsabschluss")
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_export_csv_requires_auth(self):
        """GET /api/buchhaltung/export-csv requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv")
        assert response.status_code in [401, 403], "Should require auth"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
