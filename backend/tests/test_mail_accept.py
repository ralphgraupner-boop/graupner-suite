"""
Regression-Test für /api/module-mail-inbox/accept

Bug 07.05.2026:
  Mail-Inbox-Accept hat das geparste 'nachricht' fälschlich ins Feld
  'anliegen' geschrieben — Kunden-Datenmaske liest aber 'nachricht'.
  → 'Nachricht / Anliegen' war im Kundenformular leer.

Dieser Test verwendet kein HTTP, sondern ruft die Funktion direkt + mockt
die DB-Layer minimal über monkeypatching. Bewusst klein gehalten, damit
der Test auch ohne Mongo grün läuft.
"""
import asyncio
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


class _FakeCollection:
    def __init__(self):
        self.last_inserted = None
        self.updates = []

    async def find_one(self, q, _proj=None):
        # liefert eine simulierte Mail-Inbox-Anfrage
        return {
            "id": q.get("id"),
            "status": "vorschlag",
            "from_name": "Wilfried Kollmann",
            "reply_to": "w.kollmann@hamburg.de",
            "parsed": {
                "anrede": "Herr",
                "vorname": "Wilfried",
                "nachname": "Kollmann",
                "email": "w.kollmann@hamburg.de",
                "telefon": "01798117885",
                "strasse": "Paeplowstieg 2b",
                "plz": "22453",
                "ort": "Hamburg",
                "nachricht": "Schiebetür mit Fliegengitter beschädigt.",
                "source_url": "https://www.tischlerei-graupner.de/x",
            },
        }

    async def insert_one(self, doc):
        self.last_inserted = doc

    async def update_one(self, q, upd):
        self.updates.append((q, upd))


def test_accept_schreibt_nachricht_nicht_anliegen(monkeypatch):
    from module_mail_inbox import routes as mailinbox_routes

    fake_inbox = _FakeCollection()
    fake_kunden = _FakeCollection()

    class _FakeDB:
        module_mail_inbox = fake_inbox
        module_kunden = fake_kunden

    monkeypatch.setattr(mailinbox_routes, "db", _FakeDB)

    class _FakeUser:
        username = "tester"

    asyncio.run(mailinbox_routes.accept("entry-1", body={}, user=_FakeUser()))

    new_kunde = fake_kunden.last_inserted
    assert new_kunde is not None
    # Kernpunkt des Bugs:
    assert new_kunde.get("nachricht") == "Schiebetür mit Fliegengitter beschädigt."
    # Das veraltete Feld darf nicht mehr geschrieben werden
    assert "anliegen" not in new_kunde
    # Plausibilität restlicher Felder
    assert new_kunde["anrede"] == "Herr"
    assert new_kunde["vorname"] == "Wilfried"
    assert new_kunde["nachname"] == "Kollmann"
    assert new_kunde["email"] == "w.kollmann@hamburg.de"
    assert new_kunde["plz"] == "22453"
