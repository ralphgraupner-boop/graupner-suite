"""
Tests für die neuen Duplikat-Schutzmechanismen in module_mail_inbox:

1. Accept liefert 409 wenn ein Kunde mit gleicher E-Mail/Telefon existiert.
2. Accept legt mit force_new=True trotzdem an.
3. Accept-Link ordnet Mail einem bestehenden Kunden zu, ohne Doppelkunden.
4. _content_hash ist stabil, normalisiert, leer bei leeren Feldern.
"""
import asyncio
import sys
import pathlib

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


# ───────────────────────── Hash-Tests (rein) ─────────────────────────

def test_content_hash_normalisiert_und_stabil():
    from module_mail_inbox.routes import _content_hash

    a = _content_hash({"email": "Klaus@Test.de", "nachricht": "Hallo Welt!", "telefon": "040 / 123 456"})
    b = _content_hash({"email": "klaus@test.de  ", "nachricht": "  hallo welt!  ", "telefon": "040123456"})
    assert a and a == b, "Hash muss case/whitespace/format-invariant sein"


def test_content_hash_leer_bei_unvollstaendigen_feldern():
    from module_mail_inbox.routes import _content_hash

    assert _content_hash({"email": "", "nachricht": "x"}) == ""
    assert _content_hash({"email": "a@b.de", "nachricht": ""}) == ""


# ───────────────────────── Accept Duplicate Tests ─────────────────────

class _MailInboxStub:
    def __init__(self, entry):
        self._entry = entry
        self.updates = []

    async def find_one(self, q, _proj=None):
        if q.get("id") == self._entry["id"]:
            return dict(self._entry)
        return None

    async def update_one(self, q, upd):
        self.updates.append((q, upd))


class _KundenStub:
    """Implementiert genug von der Mongo-Collection für die Duplikatsuche."""
    def __init__(self, existing):
        self.docs = list(existing)
        self.inserted = []

    def find(self, query, _projection=None):
        docs = self.docs
        if "email" in query and isinstance(query["email"], dict) and "$regex" in query["email"]:
            import re as _re
            pat = query["email"]["$regex"]
            flags = _re.I if "i" in (query["email"].get("$options") or "") else 0
            docs = [d for d in docs if d.get("email") and _re.match(pat, d["email"], flags)]
        elif "phone" in query:
            docs = [d for d in docs if d.get("phone")]
        return _AsyncCursor(docs)

    async def insert_one(self, doc):
        self.inserted.append(doc)
        self.docs.append(doc)

    async def find_one(self, query, _proj=None):
        for d in self.docs:
            if d.get("id") == query.get("id"):
                return dict(d)
        return None

    async def update_one(self, q, upd):
        for d in self.docs:
            if d.get("id") == q.get("id"):
                if "$set" in upd:
                    d.update(upd["$set"])
                return


class _AsyncCursor:
    def __init__(self, docs):
        self._docs = docs

    def limit(self, _n):
        return self

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


def _make_db(entry, existing_kunden):
    inbox = _MailInboxStub(entry)
    kunden = _KundenStub(existing_kunden)

    class _DB:
        module_mail_inbox = inbox
        module_kunden = kunden

    return _DB, inbox, kunden


_BASE_PARSED = {
    "anrede": "Herr",
    "vorname": "Max",
    "nachname": "Muster",
    "email": "max@muster.de",
    "telefon": "040 / 123 456",
    "nachricht": "Türfix bitte.",
    "strasse": "Hauptstr. 1",
    "plz": "20095",
    "ort": "Hamburg",
}


def test_accept_409_bei_doppelter_email(monkeypatch):
    from module_mail_inbox import routes
    DB, _, kunden = _make_db(
        entry={"id": "e1", "status": "vorschlag", "parsed": _BASE_PARSED, "from_name": "Max"},
        existing_kunden=[{
            "id": "k-old", "name": "Max Muster", "email": "max@muster.de",
            "phone": "0123", "kontakt_status": "Kunde",
        }],
    )
    monkeypatch.setattr(routes, "db", DB)

    class _U:
        username = "tester"

    with pytest.raises(HTTPException) as exc:
        asyncio.run(routes.accept("e1", body={}, user=_U()))
    assert exc.value.status_code == 409
    detail = exc.value.detail
    assert detail["code"] == "duplicate_kunde"
    assert detail["duplicates"][0]["id"] == "k-old"
    assert kunden.inserted == []  # nichts angelegt


def test_accept_force_new_legt_trotzdem_an(monkeypatch):
    from module_mail_inbox import routes
    DB, _, kunden = _make_db(
        entry={"id": "e2", "status": "vorschlag", "parsed": _BASE_PARSED, "from_name": "Max"},
        existing_kunden=[{
            "id": "k-old", "name": "Max Muster", "email": "max@muster.de",
            "phone": "0123",
        }],
    )
    monkeypatch.setattr(routes, "db", DB)

    class _U:
        username = "tester"

    res = asyncio.run(routes.accept("e2", body={"force_new": True}, user=_U()))
    assert res["ok"] is True
    assert len(kunden.inserted) == 1
    assert kunden.inserted[0]["nachricht"] == "Türfix bitte."


def test_accept_link_ordnet_zu_und_haengt_nachricht_an(monkeypatch):
    from module_mail_inbox import routes
    DB, inbox, kunden = _make_db(
        entry={"id": "e3", "status": "vorschlag", "parsed": _BASE_PARSED},
        existing_kunden=[{
            "id": "k-old", "name": "Max Muster", "email": "max@muster.de",
            "nachricht": "Alte Notiz",
        }],
    )
    monkeypatch.setattr(routes, "db", DB)

    class _U:
        username = "tester"

    res = asyncio.run(routes.accept_link("e3", body={"kunde_id": "k-old"}, user=_U()))
    assert res["ok"] is True and res["linked"] is True
    assert kunden.inserted == []
    target = next(d for d in kunden.docs if d["id"] == "k-old")
    assert "Alte Notiz" in target["nachricht"]
    assert "Türfix bitte." in target["nachricht"]
    assert "[Neue Anfrage" in target["nachricht"]
    # Inbox-Status muss auf übernommen stehen
    last_upd = inbox.updates[-1][1]["$set"]
    assert last_upd["status"] == "übernommen"
    assert last_upd["kunde_id"] == "k-old"
    assert last_upd["linked_to_existing"] is True


def test_accept_kein_treffer_legt_normal_an(monkeypatch):
    from module_mail_inbox import routes
    DB, _, kunden = _make_db(
        entry={"id": "e4", "status": "vorschlag", "parsed": _BASE_PARSED, "from_name": "Max"},
        existing_kunden=[],
    )
    monkeypatch.setattr(routes, "db", DB)

    class _U:
        username = "tester"

    res = asyncio.run(routes.accept("e4", body={}, user=_U()))
    assert res["ok"] is True
    assert len(kunden.inserted) == 1
