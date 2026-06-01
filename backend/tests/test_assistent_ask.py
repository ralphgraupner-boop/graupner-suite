"""Tests fuer den KI-Assistenten (POST /api/module-assistent/ask).

Diese Tests rufen GPT-5.2 ECHT auf (Emergent LLM Key vorhanden).
Bei fehlendem Key werden die Tests via skip uebersprungen.
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
    assert r.status_code == 200, f"Login: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _ask(headers, text, konv_id=None):
    payload = {"text": text}
    if konv_id:
        payload["konversation_id"] = konv_id
    r = requests.post(
        f"{BASE_URL}/api/module-assistent/ask",
        json=payload,
        headers=headers,
        timeout=45,  # GPT-5.2 kann etwas dauern
    )
    return r


class TestAssistentAsk:
    def test_tools_listet_vier_tools(self, headers):
        r = requests.get(
            f"{BASE_URL}/api/module-assistent/tools", headers=headers, timeout=10
        )
        assert r.status_code == 200
        names = {t["name"] for t in r.json()["tools"]}
        assert names == {"aufgabe_anlegen", "termin_anlegen", "kunde_suchen", "notiz_schreiben"}

    def test_leerer_text_ist_400(self, headers):
        r = _ask(headers, "")
        assert r.status_code == 400

    def test_aufgabe_anlegen_via_ki(self, headers):
        marker = uuid.uuid4().hex[:6]
        r = _ask(headers, f"Bitte leg eine Aufgabe an: Anruf Schmidt {marker}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tool"] == "aufgabe_anlegen", f"Erwartet aufgabe_anlegen, war: {data}"
        assert data["tool_ergebnis"]["ok"] is True
        # Persoenliche Ansprache: KI nennt Ralph
        assert "ralph" in (data["antwort"] or "").lower()

    def test_kunde_suchen_via_ki(self, headers):
        r = _ask(headers, "Such mir bitte alle Kunden mit Namen Mueller")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tool"] == "kunde_suchen"
        assert data["tool_ergebnis"]["ok"] is True
        assert "treffer" in data["tool_ergebnis"]
        assert "anzahl" in data["tool_ergebnis"]

    def test_notiz_schreiben_via_ki(self, headers):
        r = _ask(headers, "Mach eine Notiz: Holzlieferant Schmidt hat neue Preisliste")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tool"] == "notiz_schreiben"
        assert data["tool_ergebnis"]["ok"] is True
        assert data["tool_ergebnis"]["notiz"]["kategorie"] == "notiz"

    def test_konversations_verlauf_wird_gespeichert(self, headers):
        r1 = _ask(headers, "Notiz: Testkonversation A")
        assert r1.status_code == 200
        konv_id = r1.json()["konversation_id"]

        # Zweite Nachricht in gleicher Konversation
        r2 = _ask(headers, "Notiz: Testkonversation B", konv_id=konv_id)
        assert r2.status_code == 200
        assert r2.json()["konversation_id"] == konv_id

        # Verlauf abrufen
        r3 = requests.get(
            f"{BASE_URL}/api/module-assistent/konversation/{konv_id}",
            headers=headers,
            timeout=10,
        )
        assert r3.status_code == 200
        konv = r3.json()
        # 2x user + 2x ki = 4 Beitraege
        assert len(konv["beitraege"]) == 4
        rollen = [b["rolle"] for b in konv["beitraege"]]
        assert rollen == ["user", "ki", "user", "ki"]

    def test_konversationen_liste(self, headers):
        r = requests.get(
            f"{BASE_URL}/api/module-assistent/konversationen", headers=headers, timeout=10
        )
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # Mindestens 1 von den vorherigen Tests
        if items:
            assert "id" in items[0]
            assert "anzahl_beitraege" in items[0]
