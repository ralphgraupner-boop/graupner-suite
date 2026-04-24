"""Tests for module_duplikate (scan, pair, ignore, merge, log, settings) +
Auto-Sync kontakt_status Startup-Hook (via DB-Check)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL muss gesetzt sein"

ADMIN_USER = "admin"
ADMIN_PASS = "Graupner!Suite2026"

DUP = f"{BASE_URL}/api/module-duplikate"
KUNDEN = f"{BASE_URL}/api/modules/kunden/data"


# -------------------- Fixtures --------------------

@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login fail: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_customers(auth_headers):
    """Erstellt zwei Test-Kunden mit gleicher E-Mail (Duplikat)."""
    dup_email = f"test-dup-{uuid.uuid4().hex[:6]}@example.com"
    payload_a = {
        "name": "TEST_DUP_A Meier",
        "vorname": "TEST_DUP_A",
        "nachname": "Meier",
        "email": dup_email,
        "phone": "+49 40 12345",
        "plz": "20095",
        "ort": "Hamburg",
        "strasse": "Musterweg",
        "hausnummer": "1",
        "kontakt_status": "Anfrage",
        "force": True,
    }
    payload_b = {
        "name": "TEST_DUP_B Meier",
        "vorname": "TEST_DUP_B",
        "nachname": "Meier",
        "email": dup_email,
        "phone": "+49 40 12345",
        "plz": "20095",
        "ort": "Hamburg",
        "strasse": "Musterweg",
        "hausnummer": "2",
        "kontakt_status": "Anfrage",
        "force": True,  # Duplikat-Check umgehen, wir wollen bewusst ein Duplikat anlegen
    }
    ra = requests.post(KUNDEN, json=payload_a, headers=auth_headers, timeout=30)
    assert ra.status_code in (200, 201), f"create A: {ra.status_code} {ra.text}"
    rb = requests.post(KUNDEN, json=payload_b, headers=auth_headers, timeout=30)
    assert rb.status_code in (200, 201), f"create B: {rb.status_code} {rb.text}"
    a = ra.json()
    b = rb.json()
    yield a, b, dup_email
    # cleanup (auch wenn schon archiviert)
    for kid in (a.get("id"), b.get("id")):
        if kid:
            requests.delete(f"{KUNDEN}/{kid}", headers=auth_headers, timeout=30)


# -------------------- Auto-Sync --------------------

class TestAutoSyncStartup:
    def test_all_kunden_have_status_eq_kontakt_status(self, auth_headers):
        """Nach Auto-Sync-Startup-Hook muss fuer alle Kunden status == kontakt_status sein
        (leere status-Felder werden als konsistent gewertet, wenn kontakt_status auch leer)."""
        r = requests.get(KUNDEN, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        kunden = r.json()
        assert isinstance(kunden, list)
        mismatches = []
        for k in kunden:
            st = (k.get("status") or "").strip()
            ks = (k.get("kontakt_status") or "").strip()
            # Nach Auto-Sync sollte ks immer gesetzt sein und status==kontakt_status
            if ks and st != ks:
                mismatches.append({"id": k.get("id"), "status": st, "kontakt_status": ks})
        assert not mismatches, f"{len(mismatches)} Kunden mit status != kontakt_status: {mismatches[:5]}"


# -------------------- Settings --------------------

class TestSettings:
    def test_get_settings(self, auth_headers):
        r = requests.get(f"{DUP}/admin/settings", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "feature_enabled" in d
        assert d["id"] == "module_duplikate_main"

    def test_put_settings_admin(self, auth_headers):
        r = requests.put(f"{DUP}/admin/settings",
                         json={"feature_enabled": True}, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("feature_enabled") is True


# -------------------- Scan / Pair / Ignore --------------------

class TestScanAndIgnore:
    def test_scan_finds_duplicates(self, auth_headers, test_customers):
        a, b, email = test_customers
        r = requests.get(f"{DUP}/scan", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "pair_count" in d and "pairs" in d
        assert d["pair_count"] > 0
        pair = next(
            (p for p in d["pairs"]
             if {p["a"]["id"], p["b"]["id"]} == {a["id"], b["id"]}),
            None,
        )
        assert pair is not None, "Test-Duplikat nicht im Scan gefunden"
        assert "email" in pair["reasons"]
        assert pair["a"].get("name")
        assert pair["b"].get("name")

    def test_pair_detail(self, auth_headers, test_customers):
        a, b, _ = test_customers
        r = requests.get(f"{DUP}/pair", params={"a_id": a["id"], "b_id": b["id"]},
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["a"]["id"] == a["id"]
        assert d["b"]["id"] == b["id"]
        assert "stats" in d and a["id"] in d["stats"] and b["id"] in d["stats"]
        stat = d["stats"][a["id"]]
        for k in ("dokumente_v2", "einsaetze", "monteur_fotos", "monteur_notizen"):
            assert k in stat and isinstance(stat[k], int)
        assert d["pair_key"]

    def test_ignore_and_scan_hides_pair(self, auth_headers, test_customers):
        a, b, _ = test_customers
        # Baseline scan
        r0 = requests.get(f"{DUP}/scan", headers=auth_headers, timeout=60)
        base_ignored = r0.json().get("ignored_count", 0)

        r = requests.post(f"{DUP}/ignore",
                          json={"a_id": a["id"], "b_id": b["id"], "note": "TEST_DUP"},
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        # Scan should now hide the pair, ignored_count increased
        r2 = requests.get(f"{DUP}/scan", headers=auth_headers, timeout=60)
        d2 = r2.json()
        assert d2["ignored_count"] >= base_ignored + 1
        hidden = not any(
            {p["a"]["id"], p["b"]["id"]} == {a["id"], b["id"]} for p in d2["pairs"]
        )
        assert hidden, "Ignoriertes Paar darf nicht mehr im Scan auftauchen"

        # Unignore
        r3 = requests.delete(f"{DUP}/ignore", params={"a_id": a["id"], "b_id": b["id"]},
                             headers=auth_headers, timeout=30)
        assert r3.status_code == 200, r3.text
        assert r3.json().get("deleted", 0) == 1


# -------------------- Merge + Log --------------------

class TestMergeFlow:
    def test_merge_and_log(self, auth_headers, test_customers):
        a, b, email = test_customers
        # Sicherstellen: kein ignore mehr aktiv
        requests.delete(f"{DUP}/ignore", params={"a_id": a["id"], "b_id": b["id"]},
                        headers=auth_headers, timeout=30)

        winner_id = a["id"]
        loser_id = b["id"]

        merged_fields = {
            "email": email,
            "phone": "+49 40 99999",
            "ort": "Hamburg-Merged",
            "kontakt_status": "Kunde",
            "vorname": "MERGED",
            "nachname": "Meier",
        }
        r = requests.post(f"{DUP}/merge",
                          json={"winner_id": winner_id, "loser_id": loser_id,
                                "merged_fields": merged_fields},
                          headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        w = d["winner"]
        assert w["id"] == winner_id
        assert w["phone"] == "+49 40 99999"
        assert w["ort"] == "Hamburg-Merged"
        # kontakt_status <-> status Sync beim Winner
        assert w.get("kontakt_status") == "Kunde"
        assert w.get("status") == "Kunde"
        # Name neu berechnet aus vorname/nachname
        assert w.get("name") == "MERGED Meier"

        # Loser archiviert?
        r_loser = requests.get(f"{KUNDEN}/{loser_id}", headers=auth_headers, timeout=30)
        assert r_loser.status_code == 200, r_loser.text
        loser = r_loser.json()
        assert loser.get("kontakt_status") == "Archiv"
        assert loser.get("status") == "Archiv"
        assert loser.get("merged_into_id") == winner_id
        assert loser.get("merged_at")

        # Log-Eintrag
        r_log = requests.get(f"{DUP}/log", params={"limit": 50},
                             headers=auth_headers, timeout=30)
        assert r_log.status_code == 200, r_log.text
        logs = r_log.json()
        assert isinstance(logs, list) and len(logs) > 0
        entry = next((l for l in logs
                      if l["winner_id"] == winner_id and l["loser_id"] == loser_id), None)
        assert entry is not None, "Merge-Log-Eintrag fehlt"
        assert "email" in entry.get("merged_field_keys", [])

    def test_archived_kunde_excluded_from_scan(self, auth_headers, test_customers):
        """Nach Merge: Loser hat kontakt_status=Archiv -> darf im Scan nicht mehr auftauchen."""
        a, b, _ = test_customers
        r = requests.get(f"{DUP}/scan", headers=auth_headers, timeout=60)
        assert r.status_code == 200
        pairs = r.json()["pairs"]
        hidden = not any(
            {p["a"]["id"], p["b"]["id"]} == {a["id"], b["id"]} for p in pairs
        )
        assert hidden, "Archivierter Kunde darf nicht mehr als Duplikat erscheinen"


# -------------------- Auth / Permissions --------------------

class TestPermissions:
    def test_scan_requires_auth(self):
        r = requests.get(f"{DUP}/scan", timeout=30)
        assert r.status_code in (401, 403)

    def test_merge_requires_auth(self):
        r = requests.post(f"{DUP}/merge",
                          json={"winner_id": "x", "loser_id": "y", "merged_fields": {}},
                          timeout=30)
        assert r.status_code in (401, 403)
