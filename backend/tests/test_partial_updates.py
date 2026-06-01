"""Schritt 1 — Datensicherheits-Tests fuer partielle PUTs.

Stellt sicher, dass die drei reparierten Endpoints
(Customers, Services, Rechnungen v2) bei einem PUT mit nur einem Feld
die anderen Felder NICHT mit Default-Werten ueberschreiben.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://modul-first-app.preview.emergentagent.com"
)
ADMIN_USER = "admin-preview"
ADMIN_PASS = "HamburgPreview2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=10,
    )
    assert r.status_code == 200, f"Login fehlgeschlagen: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ==========================================================================
# 1) CUSTOMERS — PUT /api/customers/{id}
# ==========================================================================

class TestCustomerPartialUpdate:
    def _create(self, headers):
        suffix = uuid.uuid4().hex[:8]
        payload = {
            "name": f"Max Mustermann {suffix}",
            "vorname": "Max",
            "nachname": f"Mustermann-{suffix}",
            "email": f"max-{suffix}@example.com",
            "phone": "040123456",
            "strasse": "Hauptstr",
            "hausnummer": "1",
            "plz": "20095",
            "ort": "Hamburg",
            "notes": "Wichtige Notiz darf NICHT geloescht werden",
            "firma": "Tischlerei Test",
            "anrede": "Herr",
            "customer_type": "Privat",
            "status": "Neu",
        }
        r = requests.post(
            f"{BASE_URL}/api/customers", json=payload, headers=headers, timeout=10
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_partial_update_keeps_other_fields(self, auth_headers):
        created = self._create(auth_headers)
        cid = created["id"]

        # PUT mit NUR einem einzigen Feld
        r = requests.put(
            f"{BASE_URL}/api/customers/{cid}",
            json={"phone": "040999999"},
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        updated = r.json()

        # Phone wurde aktualisiert
        assert updated["phone"] == "040999999"
        # Alle anderen Felder MUESSEN unveraendert sein
        assert updated["email"] == created["email"], "Email wurde versehentlich ueberschrieben!"
        assert updated["notes"] == created["notes"], "Notes wurde versehentlich geloescht!"
        assert updated["firma"] == created["firma"], "Firma wurde versehentlich geloescht!"
        assert updated["strasse"] == created["strasse"]
        assert updated["plz"] == created["plz"]
        assert updated["ort"] == created["ort"]
        assert updated["nachname"] == created["nachname"]
        assert updated["anrede"] == created["anrede"]


# ==========================================================================
# 2) SERVICES — PUT /api/services/{id}
# ==========================================================================

class TestServicePartialUpdate:
    def _create(self, headers):
        suffix = uuid.uuid4().hex[:8]
        r = requests.post(
            f"{BASE_URL}/api/services",
            json={
                "name": f"Testleistung-{suffix}",
                "description": "Beschreibung darf NICHT geloescht werden",
                "price_net": 49.50,
                "ek_price": 20.0,
                "unit": "Stunde",
            },
            headers=headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_partial_update_keeps_other_fields(self, auth_headers):
        created = self._create(auth_headers)
        sid = created["id"]

        # PUT mit nur einem einzigen Feld
        r = requests.put(
            f"{BASE_URL}/api/services/{sid}",
            json={"price_net": 99.0},
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        updated = r.json()

        assert updated["price_net"] == 99.0
        # Alle anderen Felder muessen erhalten bleiben
        assert updated["name"] == created["name"], "Name wurde versehentlich geleert!"
        assert updated["description"] == created["description"], "Description wurde versehentlich geleert!"
        assert updated["ek_price"] == created["ek_price"], "EK-Preis wurde versehentlich ueberschrieben!"
        assert updated["unit"] == created["unit"]


# ==========================================================================
# 3) RECHNUNGEN V2 — PUT /api/rechnungen/{id}
# ==========================================================================

class TestRechnungV2PartialUpdate:
    def _create_customer(self, headers):
        suffix = uuid.uuid4().hex[:8]
        r = requests.post(
            f"{BASE_URL}/api/customers",
            json={
                "name": f"R-Kunde {suffix}",
                "vorname": "R",
                "nachname": f"Kunde-{suffix}",
                "email": f"rk-{suffix}@example.com",
                "customer_type": "Privat",
            },
            headers=headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def _create_rechnung(self, headers, customer_id):
        r = requests.post(
            f"{BASE_URL}/api/v2/rechnungen",
            json={
                "customer_id": customer_id,
                "mode": "voll",
                "betreff": "Testrechnung — Betreff darf NICHT geleert werden",
                "leistungsdatum": "2026-06-01",
                "positions": [
                    {
                        "type": "position",
                        "pos_nr": 1,
                        "description": "Position 1 — darf NICHT verschwinden",
                        "quantity": 2.0,
                        "unit": "Stueck",
                        "price_net": 100.0,
                        "labor_cost": 0.0,
                    }
                ],
                "vortext": "Vortext darf NICHT geleert werden",
                "schlusstext": "Schlusstext darf NICHT geleert werden",
                "discount": 0,
                "discount_type": "amount",
                "vat_rate": 19.0,
                "deposit_amount": 0,
                "show_lohnanteil": True,
            },
            headers=headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_partial_update_keeps_other_fields(self, auth_headers):
        customer_id = self._create_customer(auth_headers)
        created = self._create_rechnung(auth_headers, customer_id)
        rid = created["id"]

        # PUT mit NUR einem Feld: betreff aendern
        new_betreff = "Neuer Betreff (nur dieses Feld)"
        r = requests.put(
            f"{BASE_URL}/api/v2/rechnungen/{rid}",
            json={"betreff": new_betreff},
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        updated = r.json()

        assert updated["betreff"] == new_betreff
        # Alle anderen Felder muessen erhalten bleiben
        assert updated["vortext"] == created["vortext"], "Vortext versehentlich geleert!"
        assert updated["schlusstext"] == created["schlusstext"], "Schlusstext versehentlich geleert!"
        assert len(updated["positions"]) == len(created["positions"]) == 1, "Positions wurden versehentlich geloescht!"
        assert updated["positions"][0]["description"] == created["positions"][0]["description"]
        # Betraege muessen identisch sein, da sich Positions+Steuer nicht geaendert haben
        assert updated["subtotal"] == created["subtotal"]
        assert updated["brutto"] == created["brutto"]
        assert updated["leistungsdatum"] == created["leistungsdatum"]
