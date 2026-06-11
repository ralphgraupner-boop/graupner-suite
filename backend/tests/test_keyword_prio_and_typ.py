"""Tests für (A) Keyword-Prioritäten CRUD, (B) Mail-Inbox priority sorting, (C) Einsatz typ Feld.

Run: pytest /app/backend/tests/test_keyword_prio_and_typ.py -v
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://tischlerei-suite.preview.emergentagent.com").rstrip("/")
USER = "thorsten.graupner"
PASS = "Thorsten2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json={"username": USER, "password": PASS}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# === A: Keyword-Prioritäten ===
class TestKeywordPrioritaeten:
    def test_get_keyword_prio_defaults(self, h):
        r = requests.get(f"{BASE}/api/keyword-prioritaeten", headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["sofort", "stufe1", "stufe2", "stufe3"]:
            assert k in d, f"Missing key {k}"
            assert isinstance(d[k], list)

    def test_put_keyword_prio_persist_and_restore(self, h):
        # 1. snapshot
        original = requests.get(f"{BASE}/api/keyword-prioritaeten", headers=h, timeout=15).json()
        # 2. add test keyword
        modified = {k: list(v) for k, v in original.items()}
        modified["sofort"] = modified.get("sofort", []) + ["TEST_pytest_kw"]
        r = requests.put(f"{BASE}/api/keyword-prioritaeten", headers=h, json={"stufen": modified}, timeout=15)
        assert r.status_code == 200, r.text
        # 3. verify persisted
        r2 = requests.get(f"{BASE}/api/keyword-prioritaeten", headers=h, timeout=15)
        assert r2.status_code == 200
        assert "TEST_pytest_kw" in r2.json().get("sofort", [])
        # 4. restore
        r3 = requests.put(f"{BASE}/api/keyword-prioritaeten", headers=h, json={"stufen": original}, timeout=15)
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE}/api/keyword-prioritaeten", headers=h, timeout=15)
        assert "TEST_pytest_kw" not in r4.json().get("sofort", [])


# === B: Mail-Inbox priority sort + badges ===
class TestMailInboxPriority:
    def test_list_returns_prio_stufe_and_sorted(self, h):
        r = requests.get(f"{BASE}/api/module-mail-inbox/list?limit=50", headers=h, timeout=20)
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("items", [])
        assert len(items) > 0
        # Every item has prioritaet_stufe (may be None)
        for it in items:
            assert "prioritaet_stufe" in it
        # Sorting: sofort < stufe1 < stufe2 < stufe3 < None
        rank = {"sofort": 0, "stufe1": 1, "stufe2": 2, "stufe3": 3}
        ranks = [rank.get(i.get("prioritaet_stufe"), 4) for i in items]
        assert ranks == sorted(ranks), f"Not sorted: {ranks}"


# === C: Einsatz mit typ Feld ===
class TestEinsatzTyp:
    KUNDE_ID = "c2863314-15a4-4e90-94c8-cc651dbc4091"  # Heinz Rühmann
    PROJEKT_ID = "fe3ee658-41ec-4a9f-b1cc-b768cb2b5b5e"

    def test_create_einsatz_with_typ_einsatz(self, h):
        payload = {
            "kunde_id": self.KUNDE_ID,
            "projekt_id": self.PROJEKT_ID,
            "projekt_titel": "TEST_pytest_typ",
            "typ": "einsatz",
            "datum": "2026-12-31",
            "uhrzeit": "10:00",
            "dauer_minuten": 60,
            "notiz": "TEST_pytest",
        }
        r = requests.post(f"{BASE}/api/einsaetze", headers=h, json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        eid = created.get("id") or created.get("_id")
        assert eid
        try:
            g = requests.get(f"{BASE}/api/einsaetze/{eid}", headers=h, timeout=15)
            if g.status_code == 200:
                assert g.json().get("typ") == "einsatz"
        finally:
            requests.delete(f"{BASE}/api/einsaetze/{eid}", headers=h, timeout=15)

    def test_create_einsatz_with_typ_aufgabe(self, h):
        payload = {
            "kunde_id": self.KUNDE_ID,
            "projekt_id": self.PROJEKT_ID,
            "projekt_titel": "TEST_pytest_aufgabe",
            "typ": "aufgabe",
            "datum": "2026-12-31",
            "uhrzeit": "11:00",
            "dauer_minuten": 60,
            "notiz": "TEST_pytest",
        }
        r = requests.post(f"{BASE}/api/einsaetze", headers=h, json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        eid = r.json().get("id")
        try:
            g = requests.get(f"{BASE}/api/einsaetze/{eid}", headers=h, timeout=15)
            if g.status_code == 200:
                assert g.json().get("typ") == "aufgabe"
        finally:
            requests.delete(f"{BASE}/api/einsaetze/{eid}", headers=h, timeout=15)
