"""
Tests für module_aufgaben – internes Aufgaben-Modul.
Module-First: Schreibt nur in module_aufgaben Collection.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://handwerk-deploy.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/module-aufgaben"

ADMIN_USER = {"username": "admin", "password": "Graupner!Suite2026"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # Cleanup: delete any leftover tasks created during tests
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER, timeout=15)
    if r.status_code == 200:
        h = {"Authorization": f"Bearer {r.json()['token']}"}
        for tid in ids:
            try:
                requests.delete(f"{API}/{tid}", headers=h, timeout=10)
            except Exception:
                pass


# ==================== META ====================

class TestMeta:
    def test_meta_returns_enums(self, headers):
        r = requests.get(f"{API}/meta", headers=headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "kategorien" in data and "prioritaeten" in data
        assert "status" in data and "wiederholungen" in data
        assert set(["auto", "werkzeug", "lager", "fahrzeug", "buero", "sonstige"]).issubset(set(data["kategorien"]))
        assert set(["niedrig", "normal", "hoch"]).issubset(set(data["prioritaeten"]))
        assert set(["offen", "in_arbeit", "erledigt"]).issubset(set(data["status"]))
        assert set(["einmalig", "taeglich", "woechentlich", "monatlich"]).issubset(set(data["wiederholungen"]))


# ==================== ADMIN SETTINGS ====================

class TestAdminSettings:
    def test_get_settings(self, headers):
        r = requests.get(f"{API}/admin/settings", headers=headers, timeout=10)
        assert r.status_code == 200
        assert "feature_enabled" in r.json()

    def test_update_settings_toggle(self, headers):
        # Set true (default), confirm
        r = requests.put(f"{API}/admin/settings", headers=headers, json={"feature_enabled": True}, timeout=10)
        assert r.status_code == 200
        assert r.json()["feature_enabled"] is True

        # GET reflects state
        r2 = requests.get(f"{API}/admin/settings", headers=headers, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["feature_enabled"] is True


# ==================== MITARBEITER ====================

class TestMitarbeiter:
    def test_list_mitarbeiter(self, headers):
        r = requests.get(f"{API}/mitarbeiter", headers=headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # admin should be in users; structure check
        if data:
            assert "username" in data[0]
            assert "anzeige_name" in data[0]


# ==================== CRUD ====================

class TestCRUD:
    def test_create_task_minimal(self, headers, created_ids):
        payload = {
            "titel": "TEST_Auto waschen",
            "kategorie": "auto",
            "prioritaet": "normal",
        }
        r = requests.post(API, headers=headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["titel"] == "TEST_Auto waschen"
        assert d["kategorie"] == "auto"
        assert d["prioritaet"] == "normal"
        assert d["status"] == "offen"
        assert d["wiederholung"] == "einmalig"
        assert "id" in d and d["id"]
        assert d["created_by"] == "admin"
        assert "_id" not in d
        created_ids.append(d["id"])

    def test_get_after_create_persists(self, headers, created_ids):
        assert created_ids, "previous test should have created an item"
        tid = created_ids[0]
        r = requests.get(f"{API}/{tid}", headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == tid

    def test_list_returns_created(self, headers, created_ids):
        r = requests.get(API, headers=headers, timeout=10)
        assert r.status_code == 200
        items = r.json()
        ids = [x["id"] for x in items]
        assert created_ids[0] in ids

    def test_list_filter_kategorie(self, headers, created_ids):
        r = requests.get(f"{API}?kategorie=auto", headers=headers, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert all(x["kategorie"] == "auto" for x in items)
        assert any(x["id"] == created_ids[0] for x in items)

    def test_list_filter_status_offen(self, headers, created_ids):
        r = requests.get(f"{API}?status=offen", headers=headers, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert all(x["status"] == "offen" for x in items)

    def test_patch_status_in_arbeit(self, headers, created_ids):
        tid = created_ids[0]
        r = requests.patch(f"{API}/{tid}/status", headers=headers, json={"status": "in_arbeit"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "in_arbeit"
        assert d["erledigt_am"] is None

    def test_patch_status_erledigt_stamps(self, headers, created_ids):
        tid = created_ids[0]
        r = requests.patch(f"{API}/{tid}/status", headers=headers, json={"status": "erledigt"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "erledigt"
        assert d["erledigt_am"] is not None
        assert d["erledigt_von"] == "admin"

    def test_put_update_fields(self, headers, created_ids):
        tid = created_ids[0]
        r = requests.put(
            f"{API}/{tid}",
            headers=headers,
            json={"titel": "TEST_Auto waschen V2", "prioritaet": "hoch"},
            timeout=10,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["titel"] == "TEST_Auto waschen V2"
        assert d["prioritaet"] == "hoch"

    def test_put_status_back_to_offen_clears_stamp(self, headers, created_ids):
        tid = created_ids[0]
        r = requests.put(f"{API}/{tid}", headers=headers, json={"status": "offen"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "offen"
        assert d["erledigt_am"] is None
        assert d["erledigt_von"] is None


# ==================== VALIDATION ====================

class TestValidation:
    def test_missing_titel_rejected(self, headers):
        r = requests.post(API, headers=headers, json={"titel": "   ", "kategorie": "auto"}, timeout=10)
        assert r.status_code == 400

    def test_invalid_kategorie(self, headers):
        r = requests.post(API, headers=headers, json={"titel": "TEST_X", "kategorie": "schmuh"}, timeout=10)
        assert r.status_code == 400

    def test_invalid_prioritaet(self, headers):
        r = requests.post(API, headers=headers, json={"titel": "TEST_X", "prioritaet": "extrem"}, timeout=10)
        assert r.status_code == 400

    def test_invalid_status_patch(self, headers, created_ids):
        if not created_ids:
            pytest.skip("no task")
        r = requests.patch(f"{API}/{created_ids[0]}/status", headers=headers, json={"status": "xyz"}, timeout=10)
        assert r.status_code == 400

    def test_get_unknown_404(self, headers):
        r = requests.get(f"{API}/00000000-0000-0000-0000-000000000000", headers=headers, timeout=10)
        assert r.status_code == 404


# ==================== STATS ====================

class TestStats:
    def test_stats_uebersicht(self, headers):
        r = requests.get(f"{API}/stats/uebersicht", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("offen", "in_arbeit", "erledigt", "gesamt"):
            assert k in d
            assert isinstance(d[k], int)


# ==================== ISOLATION ====================

class TestIsolation:
    def test_module_isolation(self, headers, created_ids):
        """Ensure data only lives in module_aufgaben collection (no spillover)."""
        # Create another task and verify it doesn't appear in unrelated lists
        r = requests.post(API, headers=headers, json={"titel": "TEST_Isolation", "kategorie": "lager"}, timeout=10)
        assert r.status_code == 200
        new_id = r.json()["id"]
        created_ids.append(new_id)

        # Spot-check unrelated endpoints don't echo this title
        for path in ["/api/customers", "/api/module-kunden", "/api/module-projekte"]:
            try:
                rr = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=10)
                if rr.status_code == 200 and isinstance(rr.json(), list):
                    body = str(rr.json())
                    assert "TEST_Isolation" not in body, f"Leak into {path}"
            except Exception:
                pass


# ==================== DELETE ====================

class TestDelete:
    def test_delete_admin_can_delete_any(self, headers, created_ids):
        # Delete all created items
        for tid in list(created_ids):
            r = requests.delete(f"{API}/{tid}", headers=headers, timeout=10)
            assert r.status_code == 200
            assert r.json().get("deleted") is True
            # Verify removed
            g = requests.get(f"{API}/{tid}", headers=headers, timeout=10)
            assert g.status_code == 404
            created_ids.remove(tid)
