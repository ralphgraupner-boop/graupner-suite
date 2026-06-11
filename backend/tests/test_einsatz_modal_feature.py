"""Tests for the new EinsatzModal feature - backend persistence of projekt_id/projekt_titel."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
USERNAME = "admin"
PASSWORD = "AdminPreview2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": USERNAME, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def kunden(auth_headers):
    r = requests.get(f"{BASE_URL}/api/modules/kunden/data", headers=auth_headers, timeout=15)
    assert r.status_code == 200, f"kunden data failed: {r.status_code}"
    data = r.json()
    assert isinstance(data, list)
    return data


@pytest.fixture(scope="module")
def kunde_with_projekt(auth_headers, kunden):
    """Find first kunde that has at least one project."""
    for k in kunden[:30]:
        kid = k.get("id")
        if not kid:
            continue
        r = requests.get(f"{BASE_URL}/api/module-projekte/", headers=auth_headers, params={"kunde_id": kid}, timeout=15)
        if r.status_code == 200 and len(r.json()) > 0:
            return {"kunde": k, "projekte": r.json()}
    pytest.skip("Kein Kunde mit Projekt gefunden")


# ============= Mitarbeiter endpoint (modal uses /api/mitarbeiter) =============
def test_mitarbeiter_endpoint(auth_headers):
    r = requests.get(f"{BASE_URL}/api/mitarbeiter", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    aktive = [m for m in data if m.get("status") == "aktiv"]
    assert len(aktive) > 0, "No active mitarbeiter found"


# ============= module-projekte filter by kunde_id =============
def test_module_projekte_by_kunde(auth_headers, kunde_with_projekt):
    kid = kunde_with_projekt["kunde"]["id"]
    r = requests.get(f"{BASE_URL}/api/module-projekte/", headers=auth_headers, params={"kunde_id": kid}, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert len(arr) >= 1
    for p in arr:
        assert "id" in p
        assert "titel" in p


# ============= POST /api/einsaetze persists projekt_id + projekt_titel =============
def test_create_einsatz_persists_projekt(auth_headers, kunde_with_projekt):
    kunde = kunde_with_projekt["kunde"]
    projekt = kunde_with_projekt["projekte"][0]
    payload = {
        "kunde_id": kunde["id"],
        "projekt_id": projekt["id"],
        "projekt_titel": projekt.get("titel", "TEST_Projekt"),
        "betreff": "TEST_Einsatz Modal",
        "beschreibung": "Automatisierter Testlauf",
        "objekt_strasse": "Teststr. 1",
        "objekt_plz": "20095",
        "objekt_ort": "Hamburg",
        "termin_datum": "2026-01-15",
        "termin_uhrzeit": "09:00",
        "monteur_id": "",
        "monteur_name": "",
    }
    r = requests.post(f"{BASE_URL}/api/einsaetze", headers=auth_headers, json=payload, timeout=15)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    created = r.json()
    einsatz_id = created.get("id")
    assert einsatz_id, f"no id in response: {created}"

    # Verify persistence
    try:
        rg = requests.get(f"{BASE_URL}/api/einsaetze/{einsatz_id}", headers=auth_headers, timeout=15)
        assert rg.status_code == 200, rg.text
        got = rg.json()
        assert got.get("projekt_id") == projekt["id"], f"projekt_id missing/wrong: {got}"
        assert got.get("projekt_titel") == projekt.get("titel", "TEST_Projekt"), f"projekt_titel wrong: {got}"
        assert got.get("kunde_id") == kunde["id"]
    finally:
        # cleanup
        rd = requests.delete(f"{BASE_URL}/api/einsaetze/{einsatz_id}", headers=auth_headers, timeout=15)
        assert rd.status_code in (200, 204, 404), f"cleanup failed: {rd.status_code} {rd.text}"


# ============= module-kundenlink/create works (modal Pipeline Phase 2) =============
def test_kundenlink_create(auth_headers, kunde_with_projekt):
    kid = kunde_with_projekt["kunde"]["id"]
    pid = kunde_with_projekt["projekte"][0]["id"]
    r = requests.post(f"{BASE_URL}/api/module-kundenlink/create/{kid}", headers=auth_headers, json={"projekt_id": pid}, timeout=15)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("token"), f"no token: {data}"
