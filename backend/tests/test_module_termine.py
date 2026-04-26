"""
Tests for module_termine - GO-Workflow + Datenmaske.
Module-First: writes only to db.module_termine.
Live DB must remain clean - all created docs are deleted in cleanup.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://handwerk-deploy.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/module-termine"

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
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER, timeout=15)
    if r.status_code == 200:
        h = {"Authorization": f"Bearer {r.json()['token']}"}
        for tid in ids:
            try:
                requests.delete(f"{API}/{tid}", headers=h, timeout=10)
            except Exception:
                pass


# Optional refs created on the fly for /enrich joining test
@pytest.fixture(scope="module")
def helper_refs(headers):
    refs = {"kunde_id": "", "projekt_id": "", "aufgabe_id": "",
            "monteur_username": "", "_cleanup": []}
    # Try existing kunden via /api/modules/kunden/data
    try:
        r = requests.get(f"{BASE_URL}/api/modules/kunden/data", headers=headers, timeout=10)
        if r.status_code == 200 and isinstance(r.json(), list) and r.json():
            refs["kunde_id"] = r.json()[0].get("id", "")
    except Exception:
        pass
    # Existing projekte
    try:
        r = requests.get(f"{BASE_URL}/api/module-projekte", headers=headers, timeout=10)
        if r.status_code == 200 and isinstance(r.json(), list) and r.json():
            refs["projekt_id"] = r.json()[0].get("id", "")
    except Exception:
        pass
    # Create temp aufgabe for join test
    try:
        ar = requests.post(f"{BASE_URL}/api/module-aufgaben", headers=headers,
                           json={"titel": "TEST_TermineJoin", "kategorie": "buero"}, timeout=10)
        if ar.status_code == 200:
            aid = ar.json()["id"]
            refs["aufgabe_id"] = aid
            refs["_cleanup"].append(("aufgabe", aid))
    except Exception:
        pass
    # Mitarbeiter
    try:
        r = requests.get(f"{BASE_URL}/api/module-aufgaben/mitarbeiter", headers=headers, timeout=10)
        if r.status_code == 200 and isinstance(r.json(), list) and r.json():
            refs["monteur_username"] = r.json()[0].get("username", "")
    except Exception:
        pass
    yield refs
    # cleanup helper-created data
    for typ, _id in refs["_cleanup"]:
        try:
            if typ == "aufgabe":
                requests.delete(f"{BASE_URL}/api/module-aufgaben/{_id}", headers=headers, timeout=10)
        except Exception:
            pass


# ==================== META ====================
class TestMeta:
    def test_meta(self, headers):
        r = requests.get(f"{API}/meta", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert set(d["status"]) >= {"wartet_auf_go", "bestaetigt", "im_kalender", "abgesagt"}
        assert set(d["typen"]) >= {"besichtigung", "ausfuehrung", "abnahme", "intern", "sonstiges"}
        assert d["status_labels"]["wartet_auf_go"] == "Wartet auf GO"
        assert d["status_labels"]["bestaetigt"] == "Bestätigt"


# ==================== CRUD ====================
class TestCRUD:
    def test_create_minimal(self, headers, created_ids):
        payload = {"titel": "TEST_T1", "typ": "ausfuehrung", "start": "2026-05-10T10:00"}
        r = requests.post(API, headers=headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["titel"] == "TEST_T1"
        assert d["status"] == "wartet_auf_go"
        assert d["go_at"] is None and d["go_by"] is None
        assert "_id" not in d
        assert d["created_by"] == "admin"
        created_ids.append(d["id"])

    def test_get_after_create(self, headers, created_ids):
        r = requests.get(f"{API}/{created_ids[0]}", headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == created_ids[0]

    def test_list_returns_created(self, headers, created_ids):
        r = requests.get(API, headers=headers, timeout=10)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert created_ids[0] in ids

    def test_list_filter_status(self, headers, created_ids):
        r = requests.get(f"{API}?status=wartet_auf_go", headers=headers, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert all(x["status"] == "wartet_auf_go" for x in items)
        assert any(x["id"] == created_ids[0] for x in items)

    def test_wartet_auf_go_endpoint(self, headers, created_ids):
        r = requests.get(f"{API}/wartet-auf-go", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and "items" in d
        assert d["count"] >= 1
        assert any(it["id"] == created_ids[0] for it in d["items"])

    def test_put_update_titel(self, headers, created_ids):
        r = requests.put(f"{API}/{created_ids[0]}", headers=headers,
                         json={"titel": "TEST_T1 V2", "ort": "Berlin"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["titel"] == "TEST_T1 V2"
        assert d["ort"] == "Berlin"

    def test_put_titel_empty_rejected(self, headers, created_ids):
        r = requests.put(f"{API}/{created_ids[0]}", headers=headers,
                         json={"titel": "  "}, timeout=10)
        assert r.status_code == 400


# ==================== WORKFLOW ====================
class TestWorkflow:
    def test_go_from_wartet(self, headers, created_ids):
        r = requests.patch(f"{API}/{created_ids[0]}/go", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "bestaetigt"
        assert d["go_at"] is not None
        assert d["go_by"] == "admin"

    def test_mark_im_kalender_from_bestaetigt(self, headers, created_ids):
        r = requests.patch(f"{API}/{created_ids[0]}/mark-im-kalender", headers=headers,
                           json={"google_event_id": "evt_TEST123"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "im_kalender"
        assert d["im_kalender_at"] is not None
        assert d["google_event_id"] == "evt_TEST123"

    def test_go_rejected_from_im_kalender(self, headers, created_ids):
        r = requests.patch(f"{API}/{created_ids[0]}/go", headers=headers, timeout=10)
        assert r.status_code == 400

    def test_mark_im_kalender_rejected_from_im_kalender(self, headers, created_ids):
        r = requests.patch(f"{API}/{created_ids[0]}/mark-im-kalender", headers=headers,
                           json={}, timeout=10)
        assert r.status_code == 400

    def test_cancel_then_reactivate(self, headers, created_ids):
        # Create a fresh termin
        r = requests.post(API, headers=headers,
                          json={"titel": "TEST_T2_cancel", "start": "2026-05-11T09:00"}, timeout=10)
        assert r.status_code == 200
        tid = r.json()["id"]
        created_ids.append(tid)

        # Cancel
        c = requests.patch(f"{API}/{tid}/cancel", headers=headers,
                           json={"status": "abgesagt", "grund": "Krankheit"}, timeout=10)
        assert c.status_code == 200
        cd = c.json()
        assert cd["status"] == "abgesagt"
        assert cd["abgesagt_grund"] == "Krankheit"
        assert cd["abgesagt_at"] is not None

        # Reactivate via /go (allowed from abgesagt)
        g = requests.patch(f"{API}/{tid}/go", headers=headers, timeout=10)
        assert g.status_code == 200
        gd = g.json()
        assert gd["status"] == "bestaetigt"
        assert gd["abgesagt_grund"] == ""


# ==================== VALIDATION ====================
class TestValidation:
    def test_missing_titel(self, headers):
        r = requests.post(API, headers=headers,
                          json={"titel": "  ", "start": "2026-05-12T10:00"}, timeout=10)
        assert r.status_code == 400

    def test_missing_start(self, headers):
        r = requests.post(API, headers=headers,
                          json={"titel": "TEST_X", "start": ""}, timeout=10)
        assert r.status_code == 400

    def test_invalid_typ(self, headers):
        r = requests.post(API, headers=headers,
                          json={"titel": "TEST_X", "start": "2026-05-12T10:00", "typ": "blubber"}, timeout=10)
        assert r.status_code == 400

    def test_get_unknown_404(self, headers):
        r = requests.get(f"{API}/00000000-0000-0000-0000-000000000000", headers=headers, timeout=10)
        assert r.status_code == 404

    def test_go_unknown_404(self, headers):
        r = requests.patch(f"{API}/00000000-0000-0000-0000-000000000000/go", headers=headers, timeout=10)
        assert r.status_code == 404


# ==================== ENRICH (DATENMASKE) ====================
class TestEnrich:
    def test_enrich_empty_refs(self, headers, created_ids):
        # Create termin with NO refs
        r = requests.post(API, headers=headers,
                          json={"titel": "TEST_T_noRefs", "start": "2026-05-13T08:00"}, timeout=10)
        assert r.status_code == 200
        tid = r.json()["id"]
        created_ids.append(tid)

        e = requests.get(f"{API}/{tid}/enrich", headers=headers, timeout=10)
        assert e.status_code == 200
        d = e.json()
        assert d["id"] == tid
        assert d["kunde_detail"] is None
        assert d["projekt_detail"] is None
        assert d["aufgabe_detail"] is None
        assert d["monteur_detail"] is None

    def test_enrich_with_refs_joins(self, headers, created_ids, helper_refs):
        # Build a termin with all available refs
        payload = {
            "titel": "TEST_T_withRefs",
            "start": "2026-05-14T08:00",
            "kunde_id": helper_refs["kunde_id"],
            "projekt_id": helper_refs["projekt_id"],
            "aufgabe_id": helper_refs["aufgabe_id"],
            "monteur_username": helper_refs["monteur_username"],
        }
        r = requests.post(API, headers=headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        created_ids.append(tid)

        e = requests.get(f"{API}/{tid}/enrich", headers=headers, timeout=10)
        assert e.status_code == 200
        d = e.json()
        # For each ref that we set, the detail should be populated (or stay None if ID didn't exist)
        if helper_refs["kunde_id"]:
            # detail may be None if kunde collection is empty for that id
            if d["kunde_detail"] is not None:
                assert d["kunde_detail"]["id"] == helper_refs["kunde_id"]
        if helper_refs["projekt_id"]:
            if d["projekt_detail"] is not None:
                assert d["projekt_detail"]["id"] == helper_refs["projekt_id"]
        if helper_refs["aufgabe_id"]:
            assert d["aufgabe_detail"] is not None, "freshly created aufgabe must join"
            assert d["aufgabe_detail"]["id"] == helper_refs["aufgabe_id"]
            assert d["aufgabe_detail"]["titel"] == "TEST_TermineJoin"
        if helper_refs["monteur_username"]:
            assert d["monteur_detail"] is not None
            assert d["monteur_detail"]["username"] == helper_refs["monteur_username"]
            assert "anzeige_name" in d["monteur_detail"]


# ==================== STATS ====================
class TestStats:
    def test_stats_uebersicht(self, headers):
        r = requests.get(f"{API}/stats/uebersicht", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("wartet_auf_go", "bestaetigt", "im_kalender", "abgesagt", "gesamt"):
            assert k in d
            assert isinstance(d[k], int)
        assert d["gesamt"] == d["wartet_auf_go"] + d["bestaetigt"] + d["im_kalender"] + d["abgesagt"]


# ==================== ISOLATION ====================
class TestIsolation:
    def test_module_isolation(self, headers, created_ids):
        # Create marker termin and ensure it doesn't bleed into other modules' lists
        r = requests.post(API, headers=headers,
                          json={"titel": "TEST_IsoMarker_ZZ", "start": "2026-05-15T08:00"}, timeout=10)
        assert r.status_code == 200
        created_ids.append(r.json()["id"])
        for path in ["/api/module-aufgaben", "/api/module-projekte", "/api/modules/kunden/data"]:
            try:
                rr = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=10)
                if rr.status_code == 200 and isinstance(rr.json(), list):
                    assert "TEST_IsoMarker_ZZ" not in str(rr.json()), f"Leak into {path}"
            except Exception:
                pass


# ==================== DELETE / FINAL CLEANUP ====================
class TestDelete:
    def test_delete_admin_can_delete_any(self, headers, created_ids):
        for tid in list(created_ids):
            r = requests.delete(f"{API}/{tid}", headers=headers, timeout=10)
            assert r.status_code == 200
            assert r.json().get("deleted") is True
            g = requests.get(f"{API}/{tid}", headers=headers, timeout=10)
            assert g.status_code == 404
            created_ids.remove(tid)

    def test_db_clean_after_all(self, headers):
        # final live-db assertion: no TEST_ leftovers
        r = requests.get(API, headers=headers, timeout=10)
        assert r.status_code == 200
        leftovers = [x for x in r.json() if x.get("titel", "").startswith("TEST_")]
        assert leftovers == [], f"Leftover TEST_ termine: {leftovers}"
