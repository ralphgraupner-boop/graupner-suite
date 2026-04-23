"""
Dokumente v2 – Phase 4 (State-Machine: Convert + Chain)
Testet /api/dokumente-v2/admin/dokumente/{id}/convert und /chain

Kritische Flows:
- Erlaubte Transitions: angebot->auftrag, angebot->rechnung, auftrag->rechnung, rechnung->gutschrift
- Verbotene Transitions (409): auftrag->gutschrift, gutschrift->*, rechnung->angebot, usw.
- Storniertes Source-Dokument -> 409
- Issued Rechnung -> Gutschrift OK (Storno-Szenario). Source bleibt unverändert.
- Multi-Level Chain: Angebot -> Auftrag -> Rechnung (parent_id-Kette korrekt)
- GET /chain: {parent, children}, nur projizierte Felder (id,type,nummer,status,betreff,created_at)
- Positions-Kopie: neue UUIDs, Inhalt identisch
- Issued Angebot kann trotzdem konvertiert werden (nur storniert blockiert)
- Isolation: kein Write auf quotes/orders/invoices/module_kunden
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://handwerk-deploy.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/dokumente-v2/admin"

ADMIN_USER = "admin"
ADMIN_PASS = "Graupner!Suite2026"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "graupner_suite")


# ============== Fixtures ==============

@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def isolation_snapshot(db):
    return {
        "quotes": db.quotes.count_documents({}),
        "orders": db.orders.count_documents({}),
        "invoices": db.invoices.count_documents({}),
        "module_kunden": db.module_kunden.count_documents({}),
    }


def _create_doc(client, doc_type, kunde_name="TEST_P4", positions=None, **extra):
    payload = {
        "type": doc_type,
        "kunde_name": kunde_name,
        "kunde_adresse": "Teststr. 1\n12345 Teststadt",
        "kunde_email": "test_phase4@example.com",
        "betreff": f"TEST Phase4 {doc_type}",
        "vortext": "Sehr geehrte Damen und Herren,",
        "schlusstext": "MfG",
        "positions": positions or [
            {"beschreibung": "Pos A", "menge": 2, "einzelpreis": 100, "rabatt_prozent": 10, "mwst_satz": 19, "lohn_anteil": 50}
        ],
    }
    payload.update(extra)
    r = client.post(f"{API}/dokumente", json=payload)
    assert r.status_code == 200, f"create {doc_type} failed: {r.status_code} {r.text}"
    return r.json()


# ============== ALLOWED TRANSITIONS ==============

@pytest.mark.parametrize("src,tgt", [
    ("angebot", "auftrag"),
    ("angebot", "rechnung"),
    ("auftrag", "rechnung"),
])
def test_allowed_transitions_non_strict(client, src, tgt):
    source = _create_doc(client, src, kunde_name=f"TEST_P4_{src}_{tgt}")
    try:
        r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": tgt})
        assert r.status_code == 200, f"{src}->{tgt} convert failed: {r.status_code} {r.text}"
        new_doc = r.json()
        assert new_doc["type"] == tgt
        assert new_doc["status"] == "entwurf"
        assert new_doc["nummer"] is None
        assert new_doc["parent_id"] == source["id"]
        assert new_doc["id"] != source["id"]
        # Kundendaten kopiert
        assert new_doc["kunde_name"] == source["kunde_name"]
        assert new_doc["kunde_adresse"] == source["kunde_adresse"]
        assert new_doc["kunde_email"] == source["kunde_email"]
        assert new_doc["betreff"] == source["betreff"]
        assert new_doc["vortext"] == source["vortext"]
        assert new_doc["schlusstext"] == source["schlusstext"]
        # Totals neu berechnet (gleiche Positionen -> gleiche Summen)
        assert round(new_doc["netto"], 2) == round(source["netto"], 2)
        assert round(new_doc["mwst"], 2) == round(source["mwst"], 2)
        assert round(new_doc["brutto"], 2) == round(source["brutto"], 2)
        assert round(new_doc["lohn_netto"], 2) == round(source["lohn_netto"], 2)
        # Cleanup new doc (entwurf löschbar)
        client.delete(f"{API}/dokumente/{new_doc['id']}")
    finally:
        client.delete(f"{API}/dokumente/{source['id']}")


def test_rechnung_to_gutschrift_requires_issued_rechnung(client):
    """rechnung->gutschrift ist erlaubt, auch wenn issued."""
    source = _create_doc(client, "rechnung", kunde_name="TEST_P4_RE_GU")
    try:
        # Issue die Rechnung
        r = client.post(f"{API}/dokumente/{source['id']}/issue")
        assert r.status_code == 200
        issued = r.json()
        assert issued["status"] == "erstellt"
        assert issued["nummer"] is not None
        original_nummer = issued["nummer"]

        # Convert zu Gutschrift
        r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": "gutschrift"})
        assert r.status_code == 200, r.text
        gu = r.json()
        assert gu["type"] == "gutschrift"
        assert gu["status"] == "entwurf"
        assert gu["nummer"] is None
        assert gu["parent_id"] == source["id"]

        # Source (Rechnung) bleibt unverändert
        r = client.get(f"{API}/dokumente/{source['id']}")
        assert r.status_code == 200
        still = r.json()
        assert still["status"] == "erstellt"
        assert still["nummer"] == original_nummer

        # Cleanup: gutschrift-entwurf löschen, rechnung stornieren
        client.delete(f"{API}/dokumente/{gu['id']}")
    finally:
        client.post(f"{API}/dokumente/{source['id']}/cancel?reason=TEST_P4_cleanup")


# ============== VERBOTENE TRANSITIONS ==============

@pytest.mark.parametrize("src,tgt", [
    ("auftrag", "gutschrift"),
    ("auftrag", "angebot"),
    ("rechnung", "angebot"),
    ("rechnung", "auftrag"),
    ("gutschrift", "angebot"),
    ("gutschrift", "auftrag"),
    ("gutschrift", "rechnung"),
    ("angebot", "gutschrift"),
])
def test_forbidden_transitions_return_409(client, src, tgt):
    source = _create_doc(client, src, kunde_name=f"TEST_P4_forbid_{src}_{tgt}")
    try:
        r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": tgt})
        assert r.status_code == 409, f"Expected 409 for {src}->{tgt}, got {r.status_code}: {r.text}"
        body = r.json()
        # FastAPI liefert {"detail": "..."}
        detail = body.get("detail", "")
        assert "nicht erlaubt" in detail.lower() or "not allowed" in detail.lower() or "erlaubt" in detail.lower()
    finally:
        # Gutschriften sind strict und als Entwurf löschbar; Rechnung-Entwurf auch
        if source.get("status") == "entwurf":
            client.delete(f"{API}/dokumente/{source['id']}")
        else:
            client.post(f"{API}/dokumente/{source['id']}/cancel?reason=TEST_P4_cleanup")


# ============== STORNIERTES SOURCE ==============

def test_convert_canceled_source_blocked(client):
    source = _create_doc(client, "rechnung", kunde_name="TEST_P4_cancelled_src")
    # Issue + Cancel
    r = client.post(f"{API}/dokumente/{source['id']}/issue")
    assert r.status_code == 200
    r = client.post(f"{API}/dokumente/{source['id']}/cancel?reason=TEST_P4")
    assert r.status_code == 200

    # Convert muss 409 geben
    r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": "gutschrift"})
    assert r.status_code == 409, f"Expected 409 for canceled source, got {r.status_code}: {r.text}"
    detail = r.json().get("detail", "")
    assert "stornier" in detail.lower()


# ============== ISSUED ANGEBOT KANN TROTZDEM CONVERTED WERDEN ==============

def test_issued_angebot_can_be_converted(client):
    source = _create_doc(client, "angebot", kunde_name="TEST_P4_issued_AN")
    try:
        r = client.post(f"{API}/dokumente/{source['id']}/issue")
        assert r.status_code == 200
        issued = r.json()
        assert issued["status"] == "erstellt"
        assert issued["nummer"] is not None

        # Convert zu auftrag muss gehen
        r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": "auftrag"})
        assert r.status_code == 200, r.text
        ab = r.json()
        assert ab["type"] == "auftrag"
        assert ab["parent_id"] == source["id"]
        client.delete(f"{API}/dokumente/{ab['id']}")

        # Convert zu rechnung muss auch gehen
        r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": "rechnung"})
        assert r.status_code == 200, r.text
        re = r.json()
        assert re["type"] == "rechnung"
        assert re["parent_id"] == source["id"]
        client.delete(f"{API}/dokumente/{re['id']}")
    finally:
        client.delete(f"{API}/dokumente/{source['id']}")


# ============== MULTI-LEVEL CHAIN ==============

def test_multi_level_chain_parent_refs(client):
    """Angebot -> Auftrag -> Rechnung. parent der Rechnung = Auftrag, nicht Angebot."""
    angebot = _create_doc(client, "angebot", kunde_name="TEST_P4_chain_AN")
    created_ids = [angebot["id"]]
    try:
        # Convert zu Auftrag
        r = client.post(f"{API}/dokumente/{angebot['id']}/convert", json={"target_type": "auftrag"})
        assert r.status_code == 200
        auftrag = r.json()
        created_ids.append(auftrag["id"])
        assert auftrag["parent_id"] == angebot["id"]

        # Convert Auftrag zu Rechnung
        r = client.post(f"{API}/dokumente/{auftrag['id']}/convert", json={"target_type": "rechnung"})
        assert r.status_code == 200
        rechnung = r.json()
        created_ids.append(rechnung["id"])
        assert rechnung["parent_id"] == auftrag["id"]
        assert rechnung["parent_id"] != angebot["id"]

        # Chain von Rechnung -> parent=Auftrag
        r = client.get(f"{API}/dokumente/{rechnung['id']}/chain")
        assert r.status_code == 200
        chain = r.json()
        assert chain["parent"] is not None
        assert chain["parent"]["id"] == auftrag["id"]
        assert chain["parent"]["type"] == "auftrag"
        assert chain["children"] == []

        # Chain von Auftrag -> parent=Angebot, children=[Rechnung]
        r = client.get(f"{API}/dokumente/{auftrag['id']}/chain")
        assert r.status_code == 200
        chain = r.json()
        assert chain["parent"] is not None
        assert chain["parent"]["id"] == angebot["id"]
        assert chain["parent"]["type"] == "angebot"
        assert len(chain["children"]) == 1
        assert chain["children"][0]["id"] == rechnung["id"]
        assert chain["children"][0]["type"] == "rechnung"

        # Chain von Angebot -> parent=None, children=[Auftrag]
        r = client.get(f"{API}/dokumente/{angebot['id']}/chain")
        assert r.status_code == 200
        chain = r.json()
        assert chain["parent"] is None
        assert len(chain["children"]) == 1
        assert chain["children"][0]["id"] == auftrag["id"]
    finally:
        # Reverse Cleanup: Rechnung ist draft -> löschbar
        for did in reversed(created_ids):
            client.delete(f"{API}/dokumente/{did}")


def test_chain_response_projection_only(client):
    """Chain-Response darf nur id,type,nummer,status,betreff,created_at enthalten, keine positions / _id."""
    angebot = _create_doc(client, "angebot", kunde_name="TEST_P4_chain_proj")
    r = client.post(f"{API}/dokumente/{angebot['id']}/convert", json={"target_type": "auftrag"})
    auftrag = r.json()
    try:
        r = client.get(f"{API}/dokumente/{auftrag['id']}/chain")
        assert r.status_code == 200
        chain = r.json()
        allowed_fields = {"id", "type", "nummer", "status", "betreff", "created_at"}

        # parent
        assert chain["parent"] is not None
        p_keys = set(chain["parent"].keys())
        extra = p_keys - allowed_fields
        assert not extra, f"Parent hat unerwartete Felder: {extra}"
        assert "_id" not in p_keys
        assert "positions" not in p_keys

        # children - bei diesem Knoten keine, aber prüfe sonst an anderem
        # Chain des Angebot -> children=[auftrag] für Projection-Prüfung
        r2 = client.get(f"{API}/dokumente/{angebot['id']}/chain")
        chain2 = r2.json()
        assert len(chain2["children"]) >= 1
        c_keys = set(chain2["children"][0].keys())
        extra = c_keys - allowed_fields
        assert not extra, f"Child hat unerwartete Felder: {extra}"
        assert "positions" not in c_keys
    finally:
        client.delete(f"{API}/dokumente/{auftrag['id']}")
        client.delete(f"{API}/dokumente/{angebot['id']}")


def test_chain_no_parent_no_children(client):
    """Neu angelegtes Dokument ohne Convert: parent=None, children=[]"""
    doc = _create_doc(client, "angebot", kunde_name="TEST_P4_no_chain")
    try:
        r = client.get(f"{API}/dokumente/{doc['id']}/chain")
        assert r.status_code == 200
        chain = r.json()
        assert chain["parent"] is None
        assert chain["children"] == []
    finally:
        client.delete(f"{API}/dokumente/{doc['id']}")


def test_chain_404_unknown(client):
    r = client.get(f"{API}/dokumente/nonexistent-xyz/chain")
    assert r.status_code == 404


# ============== POSITIONS-KOPIE ==============

def test_positions_copy_new_uuids_same_content(client):
    positions = [
        {"beschreibung": "Holzplatte", "menge": 3, "einzelpreis": 45.5, "rabatt_prozent": 5, "mwst_satz": 19, "lohn_anteil": 30},
        {"beschreibung": "Schrauben", "menge": 100, "einzelpreis": 0.2, "rabatt_prozent": 0, "mwst_satz": 19, "lohn_anteil": 0},
        {"beschreibung": "Montage", "menge": 4, "einzelpreis": 65.0, "rabatt_prozent": 0, "mwst_satz": 19, "lohn_anteil": 100},
    ]
    source = _create_doc(client, "angebot", kunde_name="TEST_P4_pos_copy", positions=positions)
    try:
        # GET um IDs der Source-Positions zu bekommen
        r = client.get(f"{API}/dokumente/{source['id']}")
        src_full = r.json()
        src_pos_ids = [p["id"] for p in src_full["positions"]]

        r = client.post(f"{API}/dokumente/{source['id']}/convert", json={"target_type": "auftrag"})
        assert r.status_code == 200
        new_doc = r.json()
        new_positions = new_doc["positions"]

        assert len(new_positions) == len(positions)
        new_pos_ids = [p["id"] for p in new_positions]

        # IDs sind neu (unterschiedlich)
        assert set(new_pos_ids).isdisjoint(set(src_pos_ids)), "Positionen-IDs müssen neu sein"
        # Alle IDs unique
        assert len(set(new_pos_ids)) == len(new_pos_ids)

        # Inhalt identisch
        for i, expected in enumerate(positions):
            np = new_positions[i]
            assert np["beschreibung"] == expected["beschreibung"]
            assert np["menge"] == expected["menge"]
            assert np["einzelpreis"] == expected["einzelpreis"]
            assert np["rabatt_prozent"] == expected["rabatt_prozent"]
            assert np["mwst_satz"] == expected["mwst_satz"]
            assert np["lohn_anteil"] == expected["lohn_anteil"]

        client.delete(f"{API}/dokumente/{new_doc['id']}")
    finally:
        client.delete(f"{API}/dokumente/{source['id']}")


# ============== ISOLATION ==============

def test_isolation_convert_does_not_touch_legacy(db, isolation_snapshot, client):
    """Convert-Flow darf keine Dokumente in quotes/orders/invoices/module_kunden erzeugen."""
    # Kompletten Convert-Flow durchziehen
    angebot = _create_doc(client, "angebot", kunde_name="TEST_P4_isolation")
    created = [angebot["id"]]
    try:
        r = client.post(f"{API}/dokumente/{angebot['id']}/convert", json={"target_type": "auftrag"})
        auftrag = r.json()
        created.append(auftrag["id"])
        r = client.post(f"{API}/dokumente/{auftrag['id']}/convert", json={"target_type": "rechnung"})
        rechnung = r.json()
        created.append(rechnung["id"])
        client.post(f"{API}/dokumente/{rechnung['id']}/issue")
        r = client.post(f"{API}/dokumente/{rechnung['id']}/convert", json={"target_type": "gutschrift"})
        gu = r.json()
        created.append(gu["id"])

        for coll, before in isolation_snapshot.items():
            after = db[coll].count_documents({})
            assert after == before, f"Isolation-Bruch: {coll} {before} -> {after}"
    finally:
        # Cleanup: draft gutschrift + draft auftrag + draft angebot löschen, rechnung stornieren
        client.delete(f"{API}/dokumente/{created[3]}")  # gu draft
        client.post(f"{API}/dokumente/{created[2]}/cancel?reason=TEST_P4_iso")
        client.delete(f"{API}/dokumente/{created[1]}")  # auftrag draft
        client.delete(f"{API}/dokumente/{created[0]}")  # angebot draft


# ============== FINAL CLEANUP ==============

def test_zz_final_cleanup_phase4(client, db):
    """Löscht übrig gebliebene TEST_P4_ Entwürfe und storniert issued Rechnungen."""
    docs = list(db.dokumente_v2.find(
        {"$or": [
            {"kunde_name": {"$regex": "^TEST_P4"}},
            {"betreff": {"$regex": "TEST_P4"}},
            {"betreff": {"$regex": "TEST Phase4"}},
        ]},
        {"_id": 0, "id": 1, "type": 1, "status": 1}
    ))
    for d in docs:
        did = d["id"]
        if d["type"] in ("rechnung", "gutschrift") and d.get("status") == "erstellt":
            client.post(f"{API}/dokumente/{did}/cancel?reason=TEST_P4_final")
        else:
            client.delete(f"{API}/dokumente/{did}")
    print(f"Phase4 Cleanup: verarbeitete {len(docs)} TEST_P4 Dokumente")
