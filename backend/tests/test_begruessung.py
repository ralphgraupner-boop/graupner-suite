"""Tests fuer Begruessungsmail-Feature: Settings + Meta + Mark + UI-Flags.

Deckt ab:
  - GET/PUT /api/begruessungsvorlagen (Defaults + Persistenz)
  - GET /api/eml-meta/begruessung/{entry_id}
  - POST /api/module-mail-inbox/begruessung-gesendet/{entry_id}
Cleanup: stellt Vorlagen + Mail-Inbox-Eintrag wieder her.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "thorsten.graupner"
ADMIN_PW = "Thorsten2026!"

DEFAULTS = {
    "sofort":  "Guten Tag,\n\nvielen Dank für Ihre Anfrage. Da es sich um einen dringenden Fall handelt, melden wir uns schnellstmöglich bei Ihnen.\n\n",
    "stufe1":  "Guten Tag,\n\nvielen Dank für Ihre Anfrage rund um Türen und Fenster. Wir prüfen Ihr Anliegen und melden uns zeitnah mit einem Terminvorschlag.\n\n",
    "stufe2":  "Guten Tag,\n\nvielen Dank für Ihre Anfrage zur Wartung. Wir melden uns in Kürze bei Ihnen, um die Details abzustimmen.\n\n",
    "stufe3":  "Guten Tag,\n\nvielen Dank für Ihre Anfrage. Wir haben Ihre Nachricht erhalten und melden uns zeitnah bei Ihnen.\n\n",
}


@pytest.fixture(scope="session")
def auth_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ── Settings: Begruessungsvorlagen ──────────────────────────────────────────
class TestBegruessungsvorlagen:
    def test_get_returns_4_keys_with_german_text(self, auth_headers):
        r = requests.get(f"{API}/begruessungsvorlagen", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("sofort", "stufe1", "stufe2", "stufe3"):
            assert k in data, f"missing key {k}"
            assert isinstance(data[k], str) and len(data[k]) > 10
            assert "Guten Tag" in data[k]

    def test_put_persists_and_restore(self, auth_headers):
        # GET current to restore later
        orig = requests.get(f"{API}/begruessungsvorlagen", headers=auth_headers, timeout=10).json()

        modified = dict(orig)
        modified["stufe1"] = "TEST_TEMP_VORLAGE Stufe1 Hallo"
        try:
            r = requests.put(
                f"{API}/begruessungsvorlagen",
                json={"vorlagen": modified},
                headers=auth_headers,
                timeout=10,
            )
            assert r.status_code == 200, r.text
            saved = r.json()
            assert "TEST_TEMP_VORLAGE" in saved["stufe1"]

            # Re-GET to verify persistence
            r2 = requests.get(f"{API}/begruessungsvorlagen", headers=auth_headers, timeout=10)
            assert r2.status_code == 200
            assert "TEST_TEMP_VORLAGE" in r2.json()["stufe1"]
        finally:
            # Restore originals (defaults if test was first)
            restore_payload = {"vorlagen": orig if orig else DEFAULTS}
            rr = requests.put(
                f"{API}/begruessungsvorlagen",
                json=restore_payload,
                headers=auth_headers,
                timeout=10,
            )
            assert rr.status_code == 200


# ── Hilfen: Mail-Inbox Eintrag mit status='vorschlag' finden ────────────────
def _find_vorschlag_entry(headers):
    r = requests.get(f"{API}/module-mail-inbox/list?status=vorschlag", headers=headers, timeout=15)
    if r.status_code != 200:
        # try without filter
        r = requests.get(f"{API}/module-mail-inbox/list", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        vorschlag = [x for x in items if x.get("status") == "vorschlag" and not x.get("begruessung_gesendet")]
        return vorschlag[0] if vorschlag else None
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", [])
    items = [x for x in items if not x.get("begruessung_gesendet")]
    return items[0] if items else None


# ── /api/eml-meta/begruessung/{id} ──────────────────────────────────────────
class TestBegruessungMeta:
    def test_meta_returns_to_subject_body(self, auth_headers):
        entry = _find_vorschlag_entry(auth_headers)
        if not entry:
            pytest.skip("Kein vorschlag-Eintrag im Inbox vorhanden")
        eid = entry["id"]
        r = requests.get(f"{API}/eml-meta/begruessung/{eid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "to" in data and "subject" in data and "body" in data
        # subject pattern
        assert data["subject"].startswith("Ihre Anfrage bei ")
        # body must contain a "Guten Tag" line + signature marker "--"
        assert "Guten Tag" in data["body"]
        assert "\n--" in data["body"] or data["body"].rstrip().endswith("--") or "--" in data["body"]

    def test_meta_404_for_unknown(self, auth_headers):
        r = requests.get(f"{API}/eml-meta/begruessung/__NOPE__", headers=auth_headers, timeout=10)
        assert r.status_code == 404


# ── POST /module-mail-inbox/begruessung-gesendet/{id} ───────────────────────
class TestBegruessungGesendetMark:
    def test_mark_sets_uebernommen_and_restores(self, auth_headers):
        entry = _find_vorschlag_entry(auth_headers)
        if not entry:
            pytest.skip("Kein vorschlag-Eintrag im Inbox vorhanden")
        eid = entry["id"]
        orig_status = entry.get("status")
        orig_flag = entry.get("begruessung_gesendet", None)
        orig_at = entry.get("begruessung_at", None)

        try:
            r = requests.post(
                f"{API}/module-mail-inbox/begruessung-gesendet/{eid}",
                headers=auth_headers,
                timeout=10,
            )
            assert r.status_code == 200, r.text
            j = r.json()
            assert j.get("ok") is True
            assert j.get("status") == "übernommen"

            # Verify via direct mongo (list may filter status='übernommen')
            from pymongo import MongoClient
            mc_check = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            found = mc_check["graupner_suite"]["module_mail_inbox"].find_one({"id": eid}, {"_id": 0})
            mc_check.close()
            assert found is not None
            assert found["status"] == "übernommen"
            assert found.get("begruessung_gesendet") is True
        finally:
            # Restore: direct via mongo (no API to revert)
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            sets = {"status": orig_status or "vorschlag"}
            unsets = {}
            if orig_flag is None:
                unsets["begruessung_gesendet"] = ""
            else:
                sets["begruessung_gesendet"] = orig_flag
            if orig_at is None:
                unsets["begruessung_at"] = ""
            else:
                sets["begruessung_at"] = orig_at
            update = {"$set": sets}
            if unsets:
                update["$unset"] = unsets
            mc["graupner_suite"]["module_mail_inbox"].update_one({"id": eid}, update)
            mc.close()
