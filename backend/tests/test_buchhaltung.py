"""
Test suite for Buchhaltung (Accounting) module
Tests: Buchungen CRUD, Kategorien, Statistiken, Offene Posten, Zahlungseingang, Zahlung rückgängig
"""
import pytest
import requests
import os
import uuid

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
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# ==================== BUCHUNGEN CRUD ====================

class TestBuchungenCRUD:
    """Test Buchungen (transactions) CRUD operations"""
    
    created_buchung_id = None
    
    def test_get_buchungen_returns_array(self, auth_headers):
        """GET /api/buchhaltung/buchungen returns array"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"GET buchungen: {len(data)} entries found")
    
    def test_get_buchungen_with_zeitraum_filter(self, auth_headers):
        """GET /api/buchhaltung/buchungen with zeitraum filter"""
        for zeitraum in ["monat", "quartal", "jahr", "alle"]:
            response = requests.get(
                f"{BASE_URL}/api/buchhaltung/buchungen",
                params={"zeitraum": zeitraum},
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"Zeitraum '{zeitraum}': {len(data)} buchungen")
    
    def test_get_buchungen_with_typ_filter(self, auth_headers):
        """GET /api/buchhaltung/buchungen with typ filter"""
        for typ in ["einnahme", "ausgabe", "alle"]:
            response = requests.get(
                f"{BASE_URL}/api/buchhaltung/buchungen",
                params={"typ": typ},
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"Typ '{typ}': {len(data)} buchungen")
    
    def test_create_buchung_ausgabe(self, auth_headers):
        """POST /api/buchhaltung/buchungen creates ausgabe with auto-calculated brutto"""
        payload = {
            "typ": "ausgabe",
            "kategorie": "Material",
            "beschreibung": "TEST_Holz Eiche für Tisch",
            "betrag_netto": 100.00,
            "mwst_satz": 19,
            "datum": "2026-01-15",
            "kunde": "TEST_Kunde",
            "notizen": "Testbuchung"
        }
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify auto-calculation: netto 100 + 19% = brutto 119
        assert data["betrag_netto"] == 100.00
        assert data["betrag_brutto"] == 119.00
        assert data["mwst_satz"] == 19
        assert data["typ"] == "ausgabe"
        assert data["kategorie"] == "Material"
        assert "id" in data
        
        TestBuchungenCRUD.created_buchung_id = data["id"]
        print(f"Created ausgabe buchung: {data['id']}, brutto: {data['betrag_brutto']}")
    
    def test_create_buchung_einnahme(self, auth_headers):
        """POST /api/buchhaltung/buchungen creates einnahme"""
        payload = {
            "typ": "einnahme",
            "kategorie": "Rechnung",
            "beschreibung": "TEST_Zahlung Kunde Müller",
            "betrag_netto": 500.00,
            "mwst_satz": 19,
            "datum": "2026-01-16",
            "kunde": "TEST_Müller GmbH"
        }
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/buchungen",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify auto-calculation: netto 500 + 19% = brutto 595
        assert data["betrag_netto"] == 500.00
        assert data["betrag_brutto"] == 595.00
        assert data["typ"] == "einnahme"
        print(f"Created einnahme buchung: {data['id']}, brutto: {data['betrag_brutto']}")
    
    def test_get_buchung_after_create(self, auth_headers):
        """Verify created buchung appears in list"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find our test buchung
        test_buchungen = [b for b in data if "TEST_" in (b.get("beschreibung") or "")]
        assert len(test_buchungen) >= 1
        print(f"Found {len(test_buchungen)} TEST_ buchungen")
    
    def test_update_buchung(self, auth_headers):
        """PUT /api/buchhaltung/buchungen/{id} updates buchung"""
        if not TestBuchungenCRUD.created_buchung_id:
            pytest.skip("No buchung created to update")
        
        payload = {
            "beschreibung": "TEST_Holz Eiche UPDATED",
            "betrag_netto": 150.00
        }
        response = requests.put(
            f"{BASE_URL}/api/buchhaltung/buchungen/{TestBuchungenCRUD.created_buchung_id}",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify update and auto-recalculation
        assert data["beschreibung"] == "TEST_Holz Eiche UPDATED"
        assert data["betrag_netto"] == 150.00
        assert data["betrag_brutto"] == 178.50  # 150 * 1.19
        print(f"Updated buchung: netto {data['betrag_netto']} -> brutto {data['betrag_brutto']}")
    
    def test_update_nonexistent_buchung(self, auth_headers):
        """PUT /api/buchhaltung/buchungen/{id} returns 404 for nonexistent"""
        response = requests.put(
            f"{BASE_URL}/api/buchhaltung/buchungen/nonexistent-id-12345",
            json={"beschreibung": "test"},
            headers=auth_headers
        )
        assert response.status_code == 404
        print("Correctly returns 404 for nonexistent buchung")
    
    def test_delete_buchung_permanent(self, auth_headers):
        """DELETE /api/buchhaltung/buchungen/{id} permanently deletes (rückstandslos)"""
        if not TestBuchungenCRUD.created_buchung_id:
            pytest.skip("No buchung created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/buchhaltung/buchungen/{TestBuchungenCRUD.created_buchung_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rückstandslos" in data.get("message", "").lower() or "gelöscht" in data.get("message", "").lower()
        print(f"Deleted buchung: {data.get('message')}")
        
        # Verify it's truly gone
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers=auth_headers)
        data = response.json()
        deleted_buchung = [b for b in data if b.get("id") == TestBuchungenCRUD.created_buchung_id]
        assert len(deleted_buchung) == 0
        print("Verified buchung is permanently deleted")
    
    def test_delete_nonexistent_buchung(self, auth_headers):
        """DELETE /api/buchhaltung/buchungen/{id} returns 404 for nonexistent"""
        response = requests.delete(
            f"{BASE_URL}/api/buchhaltung/buchungen/nonexistent-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("Correctly returns 404 for nonexistent buchung")


# ==================== KATEGORIEN ====================

class TestKategorien:
    """Test Kategorien (categories) endpoints"""
    
    def test_get_kategorien(self, auth_headers):
        """GET /api/buchhaltung/kategorien returns einnahme and ausgabe arrays"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kategorien", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "einnahme" in data
        assert "ausgabe" in data
        assert isinstance(data["einnahme"], list)
        assert isinstance(data["ausgabe"], list)
        print(f"Kategorien: {len(data['einnahme'])} einnahme, {len(data['ausgabe'])} ausgabe")
    
    def test_update_kategorien(self, auth_headers):
        """PUT /api/buchhaltung/kategorien updates categories"""
        # First get current
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kategorien", headers=auth_headers)
        current = response.json()
        
        # Add test category
        new_einnahme = current.get("einnahme", []) + ["TEST_Kategorie"]
        
        response = requests.put(
            f"{BASE_URL}/api/buchhaltung/kategorien",
            json={"einnahme": new_einnahme},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "TEST_Kategorie" in data.get("einnahme", [])
        print("Added TEST_Kategorie to einnahme")
        
        # Clean up - remove test category
        clean_einnahme = [k for k in data.get("einnahme", []) if k != "TEST_Kategorie"]
        requests.put(
            f"{BASE_URL}/api/buchhaltung/kategorien",
            json={"einnahme": clean_einnahme},
            headers=auth_headers
        )
        print("Cleaned up TEST_Kategorie")


# ==================== STATISTIKEN ====================

class TestStatistiken:
    """Test Statistiken (statistics) endpoint"""
    
    def test_get_statistiken(self, auth_headers):
        """GET /api/buchhaltung/statistiken returns einnahmen/ausgaben/gewinn/ust breakdown"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/statistiken", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        required_fields = [
            "einnahmen_netto", "einnahmen_brutto",
            "ausgaben_netto", "ausgaben_brutto",
            "gewinn_netto", "gewinn_brutto",
            "ust_einnahmen", "vst_ausgaben", "ust_zahllast",
            "kategorien_ausgaben", "kategorien_einnahmen",
            "monatlich", "anzahl_buchungen"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Statistiken: Einnahmen {data['einnahmen_brutto']} EUR, Ausgaben {data['ausgaben_brutto']} EUR, Gewinn {data['gewinn_brutto']} EUR")
    
    def test_get_statistiken_with_zeitraum(self, auth_headers):
        """GET /api/buchhaltung/statistiken with zeitraum filter"""
        for zeitraum in ["monat", "quartal", "jahr", "alle"]:
            response = requests.get(
                f"{BASE_URL}/api/buchhaltung/statistiken",
                params={"zeitraum": zeitraum},
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "einnahmen_brutto" in data
            print(f"Statistiken '{zeitraum}': {data['anzahl_buchungen']} buchungen")


# ==================== OFFENE POSTEN ====================

class TestOffenePosten:
    """Test Offene Posten (unpaid invoices) endpoint"""
    
    def test_get_offene_posten(self, auth_headers):
        """GET /api/buchhaltung/offene-posten returns unpaid invoices"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/offene-posten", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Offene Posten: {len(data)} unpaid invoices")
        
        # If there are any, verify structure
        if len(data) > 0:
            posten = data[0]
            expected_fields = ["id", "rechnung_nr", "kunde", "betrag", "status", "datum"]
            for field in expected_fields:
                assert field in posten, f"Missing field in posten: {field}"
            print(f"First posten: {posten.get('rechnung_nr')} - {posten.get('betrag')} EUR - {posten.get('status')}")


# ==================== ZAHLUNGSEINGANG ====================

class TestZahlungseingang:
    """Test Zahlungseingang (mark invoice paid) and Zahlung rückgängig"""
    
    test_invoice_id = None
    
    def test_zahlungseingang_nonexistent_invoice(self, auth_headers):
        """POST /api/buchhaltung/zahlungseingang/{id} returns 404 for nonexistent"""
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/zahlungseingang/nonexistent-invoice-12345",
            json={},
            headers=auth_headers
        )
        assert response.status_code == 404
        print("Correctly returns 404 for nonexistent invoice")
    
    def test_zahlung_rueckgaengig_nonexistent(self, auth_headers):
        """POST /api/buchhaltung/zahlung-rueckgaengig/{id} returns 404 for nonexistent"""
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/zahlung-rueckgaengig/nonexistent-invoice-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("Correctly returns 404 for nonexistent invoice")
    
    def test_zahlungseingang_with_real_invoice(self, auth_headers):
        """Test zahlungseingang with a real open invoice if available"""
        # Get offene posten
        response = requests.get(f"{BASE_URL}/api/buchhaltung/offene-posten", headers=auth_headers)
        posten = response.json()
        
        if len(posten) == 0:
            print("No open invoices available for zahlungseingang test - SKIPPED")
            pytest.skip("No open invoices to test zahlungseingang")
        
        # Use first open invoice
        invoice_id = posten[0]["id"]
        invoice_nr = posten[0].get("rechnung_nr", "")
        TestZahlungseingang.test_invoice_id = invoice_id
        
        # Mark as paid
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/zahlungseingang/{invoice_id}",
            json={"buchung_erstellen": True},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "bezahlt" in data.get("message", "").lower()
        print(f"Marked invoice {invoice_nr} as paid: {data.get('message')}")
        
        # Verify invoice no longer in offene posten
        response = requests.get(f"{BASE_URL}/api/buchhaltung/offene-posten", headers=auth_headers)
        new_posten = response.json()
        paid_invoice = [p for p in new_posten if p.get("id") == invoice_id]
        assert len(paid_invoice) == 0
        print("Verified invoice removed from offene posten")
        
        # Verify buchung was created
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers=auth_headers)
        buchungen = response.json()
        related_buchung = [b for b in buchungen if b.get("rechnung_id") == invoice_id]
        assert len(related_buchung) >= 1
        print(f"Verified buchung created for invoice: {related_buchung[0].get('beschreibung')}")
    
    def test_zahlung_rueckgaengig(self, auth_headers):
        """Test zahlung rückgängig - undo payment"""
        if not TestZahlungseingang.test_invoice_id:
            pytest.skip("No invoice was marked as paid to undo")
        
        invoice_id = TestZahlungseingang.test_invoice_id
        
        # Undo payment
        response = requests.post(
            f"{BASE_URL}/api/buchhaltung/zahlung-rueckgaengig/{invoice_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rückgängig" in data.get("message", "").lower()
        print(f"Undid payment: {data.get('message')}")
        
        # Verify invoice back in offene posten
        response = requests.get(f"{BASE_URL}/api/buchhaltung/offene-posten", headers=auth_headers)
        posten = response.json()
        restored_invoice = [p for p in posten if p.get("id") == invoice_id]
        assert len(restored_invoice) == 1
        assert restored_invoice[0].get("status") == "Offen"
        print("Verified invoice restored to offene posten with status 'Offen'")
        
        # Verify buchung was deleted
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers=auth_headers)
        buchungen = response.json()
        related_buchung = [b for b in buchungen if b.get("rechnung_id") == invoice_id]
        assert len(related_buchung) == 0
        print("Verified associated buchung was deleted")


# ==================== AUTH REQUIRED ====================

class TestAuthRequired:
    """Test that endpoints require authentication"""
    
    def test_buchungen_requires_auth(self):
        """GET /api/buchhaltung/buchungen requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen")
        assert response.status_code in [401, 403]
        print("buchungen endpoint requires auth")
    
    def test_kategorien_requires_auth(self):
        """GET /api/buchhaltung/kategorien requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/kategorien")
        assert response.status_code in [401, 403]
        print("kategorien endpoint requires auth")
    
    def test_statistiken_requires_auth(self):
        """GET /api/buchhaltung/statistiken requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/statistiken")
        assert response.status_code in [401, 403]
        print("statistiken endpoint requires auth")
    
    def test_offene_posten_requires_auth(self):
        """GET /api/buchhaltung/offene-posten requires auth"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/offene-posten")
        assert response.status_code in [401, 403]
        print("offene-posten endpoint requires auth")


# ==================== CLEANUP ====================

class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_buchungen(self, auth_headers):
        """Delete all TEST_ prefixed buchungen"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers=auth_headers)
        buchungen = response.json()
        
        test_buchungen = [b for b in buchungen if "TEST_" in (b.get("beschreibung") or "") or "TEST_" in (b.get("kunde") or "")]
        
        for b in test_buchungen:
            requests.delete(f"{BASE_URL}/api/buchhaltung/buchungen/{b['id']}", headers=auth_headers)
            print(f"Cleaned up: {b.get('beschreibung')}")
        
        print(f"Cleaned up {len(test_buchungen)} test buchungen")
