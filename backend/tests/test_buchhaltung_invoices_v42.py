"""
Test Suite for Buchhaltung & Rechnungen/Mahnwesen Module (v42)
Tests: Buchungen CRUD, Kategorien, Statistiken, CSV Export, Kassenbuch, Monatsabschluss,
       Invoices CRUD, Overdue/Due-Soon, Dunning (Mahnwesen)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_TOKEN = None

# ==================== FIXTURES ====================

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    global AUTH_TOKEN
    if AUTH_TOKEN:
        return AUTH_TOKEN
    
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "Graupner!Suite2026"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    AUTH_TOKEN = response.json().get("token")
    return AUTH_TOKEN


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_customer_id(auth_headers):
    """Get or create a test customer for invoice tests"""
    # Try to get existing customer from module_kunden
    response = requests.get(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers)
    if response.status_code == 200 and response.json():
        return response.json()[0].get("id")
    
    # Create test customer if none exists
    response = requests.post(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers, json={
        "name": "TEST_Buchhaltung Testkunde",
        "vorname": "Test",
        "nachname": "Kunde",
        "email": "test@buchhaltung.de",
        "phone": "040-12345",
        "address": "Teststraße 1, 22453 Hamburg"
    })
    if response.status_code in [200, 201]:
        return response.json().get("id")
    pytest.skip("Could not get or create test customer")


# ==================== BUCHHALTUNG TESTS ====================

class TestBuchhaltungKategorien:
    """Test Kategorien endpoints"""
    
    def test_get_kategorien(self, auth_headers):
        """GET /api/buchhaltung/kategorien - should return categories"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kategorien", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "einnahme" in data, "Missing 'einnahme' categories"
        assert "ausgabe" in data, "Missing 'ausgabe' categories"
        assert isinstance(data["einnahme"], list)
        assert isinstance(data["ausgabe"], list)
        print(f"✓ Kategorien: {len(data['einnahme'])} Einnahme, {len(data['ausgabe'])} Ausgabe")


class TestBuchhaltungStatistiken:
    """Test Statistiken endpoint"""
    
    def test_get_statistiken_jahr(self, auth_headers):
        """GET /api/buchhaltung/statistiken?zeitraum=jahr - should return statistics"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/statistiken", 
                               headers=auth_headers, params={"zeitraum": "jahr"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check required fields
        required_fields = ["einnahmen_netto", "einnahmen_brutto", "ausgaben_netto", "ausgaben_brutto",
                         "gewinn_netto", "gewinn_brutto", "ust_einnahmen", "vst_ausgaben", 
                         "ust_zahllast", "anzahl_buchungen"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        assert "kategorien_ausgaben" in data
        assert "kategorien_einnahmen" in data
        assert "monatlich" in data
        print(f"✓ Statistiken: {data['anzahl_buchungen']} Buchungen, Gewinn: {data['gewinn_brutto']} EUR")
    
    def test_get_statistiken_monat(self, auth_headers):
        """GET /api/buchhaltung/statistiken?zeitraum=monat"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/statistiken", 
                               headers=auth_headers, params={"zeitraum": "monat"})
        assert response.status_code == 200
        print("✓ Statistiken (Monat) returned successfully")
    
    def test_get_statistiken_quartal(self, auth_headers):
        """GET /api/buchhaltung/statistiken?zeitraum=quartal"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/statistiken", 
                               headers=auth_headers, params={"zeitraum": "quartal"})
        assert response.status_code == 200
        print("✓ Statistiken (Quartal) returned successfully")


class TestBuchhaltungBuchungen:
    """Test Buchungen CRUD"""
    
    created_buchung_id = None
    
    def test_get_buchungen_alle(self, auth_headers):
        """GET /api/buchhaltung/buchungen?zeitraum=alle - should return list"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", 
                               headers=auth_headers, params={"zeitraum": "alle"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Buchungen (alle): {len(data)} Einträge")
    
    def test_create_buchung_einnahme(self, auth_headers):
        """POST /api/buchhaltung/buchungen - create Einnahme"""
        payload = {
            "typ": "einnahme",
            "kategorie": "Rechnung",
            "beschreibung": "TEST_Einnahme Buchhaltungstest",
            "betrag_netto": 100.00,
            "mwst_satz": 19,
            "datum": datetime.now().strftime("%Y-%m-%d"),
            "kunde": "Testkunde"
        }
        response = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen", 
                                headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("id"), "Missing id"
        assert data.get("belegnummer"), "Missing belegnummer"
        assert data.get("typ") == "einnahme"
        assert data.get("betrag_brutto") == 119.00, f"Expected 119.00, got {data.get('betrag_brutto')}"
        
        TestBuchhaltungBuchungen.created_buchung_id = data["id"]
        print(f"✓ Einnahme erstellt: {data['belegnummer']} - {data['betrag_brutto']} EUR")
    
    def test_create_buchung_ausgabe(self, auth_headers):
        """POST /api/buchhaltung/buchungen - create Ausgabe"""
        payload = {
            "typ": "ausgabe",
            "kategorie": "Material",
            "beschreibung": "TEST_Ausgabe Materialkosten",
            "betrag_brutto": 59.50,
            "mwst_satz": 19,
            "datum": datetime.now().strftime("%Y-%m-%d")
        }
        response = requests.post(f"{BASE_URL}/api/buchhaltung/buchungen", 
                                headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("typ") == "ausgabe"
        assert data.get("betrag_netto") == pytest.approx(50.0, rel=0.01), "Netto calculation wrong"
        print(f"✓ Ausgabe erstellt: {data['belegnummer']} - {data['betrag_brutto']} EUR")
    
    def test_update_buchung(self, auth_headers):
        """PUT /api/buchhaltung/buchungen/{id} - update buchung"""
        if not TestBuchhaltungBuchungen.created_buchung_id:
            pytest.skip("No buchung created")
        
        buchung_id = TestBuchhaltungBuchungen.created_buchung_id
        payload = {
            "beschreibung": "TEST_Einnahme UPDATED",
            "betrag_netto": 200.00
        }
        response = requests.put(f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}", 
                               headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("beschreibung") == "TEST_Einnahme UPDATED"
        assert data.get("betrag_brutto") == 238.00
        print(f"✓ Buchung aktualisiert: {data['betrag_brutto']} EUR")
    
    def test_delete_buchung(self, auth_headers):
        """DELETE /api/buchhaltung/buchungen/{id} - delete buchung"""
        if not TestBuchhaltungBuchungen.created_buchung_id:
            pytest.skip("No buchung created")
        
        buchung_id = TestBuchhaltungBuchungen.created_buchung_id
        response = requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{buchung_id}", 
                                  headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Buchung gelöscht")


class TestBuchhaltungKassenbuch:
    """Test Kassenbuch endpoint"""
    
    def test_get_kassenbuch(self, auth_headers):
        """GET /api/buchhaltung/kassenbuch - should return entries with running balance"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kassenbuch", 
                               headers=auth_headers, params={"zeitraum": "jahr"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "eintraege" in data
        assert "endsaldo" in data
        assert isinstance(data["eintraege"], list)
        print(f"✓ Kassenbuch: {len(data['eintraege'])} Einträge, Endsaldo: {data['endsaldo']} EUR")


class TestBuchhaltungMonatsabschluss:
    """Test Monatsabschluss endpoint"""
    
    def test_get_monatsabschluss(self, auth_headers):
        """GET /api/buchhaltung/monatsabschluss - should return monthly summary"""
        year = datetime.now().year
        response = requests.get(f"{BASE_URL}/api/buchhaltung/monatsabschluss", 
                               headers=auth_headers, params={"jahr": year})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "jahr" in data
        assert "monate" in data
        assert data["jahr"] == year
        print(f"✓ Monatsabschluss {year}: {len(data['monate'])} Monate mit Daten")


class TestBuchhaltungExport:
    """Test CSV Export endpoint"""
    
    def test_export_csv(self, auth_headers):
        """GET /api/buchhaltung/export-csv - should return CSV file"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/export-csv", 
                               headers=auth_headers, params={"zeitraum": "jahr"})
        assert response.status_code == 200, f"Failed: {response.text}"
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "Content-Disposition" in response.headers
        print(f"✓ CSV Export: {len(response.content)} bytes")


class TestBuchhaltungOffenePosten:
    """Test Offene Posten endpoint"""
    
    def test_get_offene_posten(self, auth_headers):
        """GET /api/buchhaltung/offene-posten - should return open invoices"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/offene-posten", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Offene Posten: {len(data)} Einträge")


class TestBuchhaltungPlausibilitaet:
    """Test Plausibilitätsprüfung endpoint"""
    
    def test_plausibilitaet_valid(self, auth_headers):
        """POST /api/buchhaltung/plausibilitaet - valid data"""
        payload = {
            "typ": "ausgabe",
            "kategorie": "Material",
            "beschreibung": "Testbuchung",
            "betrag_brutto": 100.00,
            "datum": datetime.now().strftime("%Y-%m-%d")
        }
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet", 
                                headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "warnungen" in data
        assert "ok" in data
        print(f"✓ Plausibilitätsprüfung: ok={data['ok']}, {len(data['warnungen'])} Warnungen")
    
    def test_plausibilitaet_missing_kategorie(self, auth_headers):
        """POST /api/buchhaltung/plausibilitaet - missing category should warn"""
        payload = {
            "typ": "ausgabe",
            "kategorie": "",
            "beschreibung": "Test",
            "betrag_brutto": 100.00,
            "datum": datetime.now().strftime("%Y-%m-%d")
        }
        response = requests.post(f"{BASE_URL}/api/buchhaltung/plausibilitaet", 
                                headers=auth_headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["warnungen"]) > 0, "Should have warning for missing category"
        print(f"✓ Plausibilitätsprüfung (fehlende Kategorie): {len(data['warnungen'])} Warnungen")


# ==================== INVOICES TESTS ====================

class TestInvoicesList:
    """Test Invoices list endpoint"""
    
    def test_get_invoices(self, auth_headers):
        """GET /api/invoices - should return list"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Rechnungen: {len(data)} Einträge")


class TestInvoicesOverdue:
    """Test Overdue and Due-Soon endpoints"""
    
    def test_get_overdue_invoices(self, auth_headers):
        """GET /api/invoices/overdue - should return overdue invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices/overdue", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Check that overdue invoices have days_overdue field
        for inv in data:
            assert "days_overdue" in inv, "Missing days_overdue field"
        print(f"✓ Überfällige Rechnungen: {len(data)} Einträge")
    
    def test_get_due_soon_invoices(self, auth_headers):
        """GET /api/invoices/due-soon - should return invoices due in 3 days"""
        response = requests.get(f"{BASE_URL}/api/invoices/due-soon", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Bald fällige Rechnungen: {len(data)} Einträge")


class TestInvoicesCRUD:
    """Test Invoice CRUD operations"""
    
    created_invoice_id = None
    
    def test_create_invoice(self, auth_headers, test_customer_id):
        """POST /api/invoices - create new invoice"""
        payload = {
            "customer_id": test_customer_id,
            "positions": [
                {
                    "type": "position",
                    "pos_nr": 1,
                    "description": "TEST_Position Buchhaltungstest",
                    "quantity": 2,
                    "unit": "Stück",
                    "price_net": 50.00
                }
            ],
            "notes": "Testrechnung für Buchhaltungsmodul",
            "betreff": "TEST_Rechnung Buchhaltung",
            "vat_rate": 19,
            "due_days": 14
        }
        response = requests.post(f"{BASE_URL}/api/invoices", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("id"), "Missing id"
        assert data.get("invoice_number"), "Missing invoice_number"
        assert data.get("customer_id") == test_customer_id
        assert data.get("subtotal_net") == 100.00
        assert data.get("vat_amount") == 19.00
        assert data.get("total_gross") == 119.00
        assert data.get("due_date"), "Missing due_date"
        
        TestInvoicesCRUD.created_invoice_id = data["id"]
        print(f"✓ Rechnung erstellt: {data['invoice_number']} - {data['total_gross']} EUR")
    
    def test_get_invoice_by_id(self, auth_headers):
        """GET /api/invoices/{id} - get single invoice"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("id") == invoice_id
        print(f"✓ Rechnung abgerufen: {data['invoice_number']}")
    
    def test_update_invoice_status(self, auth_headers):
        """PUT /api/invoices/{id}/status - update status to Bezahlt"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.put(f"{BASE_URL}/api/invoices/{invoice_id}/status", 
                               headers=auth_headers, json={"status": "Bezahlt"})
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify status changed
        response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}", headers=auth_headers)
        data = response.json()
        assert data.get("status") == "Bezahlt"
        assert data.get("paid_at"), "Missing paid_at timestamp"
        print("✓ Rechnung als bezahlt markiert")
    
    def test_update_invoice_status_back_to_offen(self, auth_headers):
        """PUT /api/invoices/{id}/status - update status back to Offen"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.put(f"{BASE_URL}/api/invoices/{invoice_id}/status", 
                               headers=auth_headers, json={"status": "Offen"})
        assert response.status_code == 200
        print("✓ Rechnung zurück auf Offen gesetzt")


class TestInvoicesDunning:
    """Test Mahnwesen (Dunning) functionality"""
    
    def test_advance_dunning_level_1(self, auth_headers):
        """POST /api/invoices/{id}/dunning - set dunning level 1 (Zahlungserinnerung)"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/dunning", 
                                headers=auth_headers, json={"level": 1, "custom_text": "Zahlungserinnerung Test"})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("dunning_level") == 1
        assert data.get("fee") == 0
        print(f"✓ Mahnstufe 1 gesetzt: {data['message']}")
    
    def test_advance_dunning_level_2(self, auth_headers):
        """POST /api/invoices/{id}/dunning - set dunning level 2 (1. Mahnung)"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/dunning", 
                                headers=auth_headers, json={"level": 2})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("dunning_level") == 2
        assert data.get("fee") == 5.00
        print(f"✓ Mahnstufe 2 gesetzt: Gebühr {data['fee']} EUR")
    
    def test_advance_dunning_level_3(self, auth_headers):
        """POST /api/invoices/{id}/dunning - set dunning level 3 (Letzte Mahnung)"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/dunning", 
                                headers=auth_headers, json={"level": 3})
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("dunning_level") == 3
        assert data.get("fee") == 10.00
        print(f"✓ Mahnstufe 3 gesetzt: Gebühr {data['fee']} EUR")
    
    def test_verify_dunning_history(self, auth_headers):
        """Verify dunning history is saved"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice created")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("dunning_level") == 3
        assert data.get("dunning_history"), "Missing dunning_history"
        assert len(data["dunning_history"]) == 3, f"Expected 3 history entries, got {len(data['dunning_history'])}"
        print(f"✓ Mahnverlauf: {len(data['dunning_history'])} Einträge")


class TestInvoicesCleanup:
    """Cleanup test data"""
    
    def test_delete_test_invoice(self, auth_headers):
        """DELETE /api/invoices/{id} - cleanup test invoice"""
        if not TestInvoicesCRUD.created_invoice_id:
            pytest.skip("No invoice to delete")
        
        invoice_id = TestInvoicesCRUD.created_invoice_id
        response = requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Test-Rechnung gelöscht")


class TestBuchhaltungCleanup:
    """Cleanup test buchungen"""
    
    def test_cleanup_test_buchungen(self, auth_headers):
        """Delete all TEST_ prefixed buchungen"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", 
                               headers=auth_headers, params={"zeitraum": "alle"})
        if response.status_code == 200:
            buchungen = response.json()
            deleted = 0
            for b in buchungen:
                if b.get("beschreibung", "").startswith("TEST_"):
                    del_resp = requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{b['id']}", 
                                              headers=auth_headers)
                    if del_resp.status_code == 200:
                        deleted += 1
            print(f"✓ Cleanup: {deleted} Test-Buchungen gelöscht")


# ==================== NAVIGATION TESTS ====================

class TestNavigation:
    """Test that navigation items exist"""
    
    def test_buchhaltung_route_accessible(self, auth_headers):
        """Verify /api/buchhaltung endpoints are accessible"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/statistiken", 
                               headers=auth_headers, params={"zeitraum": "jahr"})
        assert response.status_code == 200, "Buchhaltung route not accessible"
        print("✓ Buchhaltung Route erreichbar")
    
    def test_invoices_route_accessible(self, auth_headers):
        """Verify /api/invoices endpoints are accessible"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200, "Invoices route not accessible"
        print("✓ Rechnungen Route erreichbar")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
