"""
Portal v4 – End-to-End Tests (Sandbox, Iteration 48)

Deckt ab:
- Admin CRUD (/api/portal-v4/admin/accounts)
- Settings GET/PUT (/api/portal-v4/admin/settings)
- Customer Login Flow (preflight + login via token + login via email)
- /me, /messages, /uploads
- Documents: Zugriff + 404-Schutz + PDF-Download
- Dokumente v2 Portal-v4-Freigabe PATCH
- Cross-Customer-Isolation (Account A sieht Account B-Dokumente nicht)
- Account ohne customer_id sieht nichts
- Dokument ohne Freigabe ist unsichtbar
- Isolation zu Portal v2 (portal2_accounts unsichtbar)
- Dokumente v2 wird durch Portal v4 nicht verändert (Write-Counter)
"""
import os
import io
import sys
import asyncio
import pytest
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from portal_v4.auth import hash_password, generate_login_token  # noqa: E402
from database import db  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "Graupner!Suite2026"

KUNDE_A_ID = "ef9b2e7f-2682-41b0-a57b-19e10653e8eb"  # Max Mustermann
KUNDE_B_ID = "4f174f55-d7c1-44fb-b6ca-6dd76e210529"  # Ellen Graupner

PASSWORD_A = "TestA_pass_2026"
PASSWORD_B = "TestB_pass_2026"


# -------------------- Helpers --------------------

def _admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _admin_headers():
    return {"Authorization": f"Bearer {_admin_token()}"}


async def _seed_accounts_and_docs() -> dict:
    """Direkt in der DB zwei Accounts (A,B) + ein Account ohne customer_id anlegen,
    jeweilige Dokumente (mit/ohne Freigabe)."""
    now_iso = "2026-04-23T00:00:00+00:00"

    # cleanup alter Testreste
    await db.portal4_accounts.delete_many({"email": {"$regex": "^test_p4_"}})
    await db.dokumente_v2.delete_many({"betreff": {"$regex": "^TEST_P4_"}})

    token_a = generate_login_token()
    token_b = generate_login_token()
    token_nocid = generate_login_token()

    acc_a = {
        "id": "test-p4-acc-a",
        "customer_id": KUNDE_A_ID,
        "name": "TEST_P4_A",
        "email": "test_p4_a@example.com",
        "password_hash": hash_password(PASSWORD_A),
        "token": token_a,
        "active": True,
        "notes": "",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    acc_b = {
        "id": "test-p4-acc-b",
        "customer_id": KUNDE_B_ID,
        "name": "TEST_P4_B",
        "email": "test_p4_b@example.com",
        "password_hash": hash_password(PASSWORD_B),
        "token": token_b,
        "active": True,
        "notes": "",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    acc_nocid = {
        "id": "test-p4-acc-nocid",
        "customer_id": None,
        "name": "TEST_P4_NOCID",
        "email": "test_p4_nocid@example.com",
        "password_hash": hash_password(PASSWORD_A),
        "token": token_nocid,
        "active": True,
        "notes": "",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.portal4_accounts.insert_many([acc_a, acc_b, acc_nocid])

    # Dokumente – alle als 'entwurf' damit Cleanup über delete_many sicher ist
    # Nur A mit Freigabe, A ohne Freigabe, B mit Freigabe
    docs = [
        {
            "id": "test-p4-doc-a-released",
            "type": "angebot",
            "status": "erstellt",
            "nummer": "TESTP4A1",
            "betreff": "TEST_P4_A_RELEASED",
            "kunde_id": KUNDE_A_ID,
            "kunde_name": "Max Mustermann",
            "netto": 100.0, "mwst": 19.0, "brutto": 119.0,
            "positions": [{"bezeichnung": "Pos1", "menge": 1, "einzelpreis": 100,
                           "rabatt_prozent": 0, "mwst_satz": 19, "lohn_anteil": 0}],
            "portal_v4_freigegeben": True,
            "portal_v4_freigegeben_at": now_iso,
            "created_at": now_iso, "updated_at": now_iso,
        },
        {
            "id": "test-p4-doc-a-hidden",
            "type": "angebot", "status": "erstellt", "nummer": "TESTP4A2",
            "betreff": "TEST_P4_A_HIDDEN",
            "kunde_id": KUNDE_A_ID, "kunde_name": "Max Mustermann",
            "netto": 50.0, "mwst": 9.5, "brutto": 59.5,
            "positions": [{"bezeichnung": "Pos1", "menge": 1, "einzelpreis": 50,
                           "rabatt_prozent": 0, "mwst_satz": 19, "lohn_anteil": 0}],
            "portal_v4_freigegeben": False,
            "created_at": now_iso, "updated_at": now_iso,
        },
        {
            "id": "test-p4-doc-b-released",
            "type": "angebot", "status": "erstellt", "nummer": "TESTP4B1",
            "betreff": "TEST_P4_B_RELEASED",
            "kunde_id": KUNDE_B_ID, "kunde_name": "Ellen Graupner",
            "netto": 200.0, "mwst": 38.0, "brutto": 238.0,
            "positions": [{"bezeichnung": "Pos1", "menge": 1, "einzelpreis": 200,
                           "rabatt_prozent": 0, "mwst_satz": 19, "lohn_anteil": 0}],
            "portal_v4_freigegeben": True,
            "portal_v4_freigegeben_at": now_iso,
            "created_at": now_iso, "updated_at": now_iso,
        },
    ]
    await db.dokumente_v2.insert_many(docs)

    return {
        "token_a": token_a, "token_b": token_b, "token_nocid": token_nocid,
    }


async def _cleanup():
    await db.portal4_accounts.delete_many({"email": {"$regex": "^test_p4_"}})
    await db.portal4_accounts.delete_many({"email": {"$regex": "^TEST_P4_"}})
    await db.portal4_messages.delete_many({"portal_id": {"$in": ["test-p4-acc-a", "test-p4-acc-b", "test-p4-acc-nocid"]}})
    await db.portal4_uploads.delete_many({"portal_id": {"$in": ["test-p4-acc-a", "test-p4-acc-b", "test-p4-acc-nocid"]}})
    await db.portal4_activity.delete_many({"portal_id": {"$in": ["test-p4-acc-a", "test-p4-acc-b", "test-p4-acc-nocid"]}})
    await db.dokumente_v2.delete_many({"betreff": {"$regex": "^TEST_P4_"}})


@pytest.fixture(scope="module")
def seed():
    data = asyncio.get_event_loop().run_until_complete(_seed_accounts_and_docs())
    yield data
    asyncio.get_event_loop().run_until_complete(_cleanup())


@pytest.fixture(scope="module")
def admin_h():
    return _admin_headers()


def _customer_session(token: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/portal-v4/login",
        json={"token": token, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"Customer login failed: {r.status_code} {r.text}"
    return r.json()["session"]


# ========== ADMIN CRUD ==========
class TestAdminCRUD:
    def test_list_accounts(self, admin_h, seed):
        r = requests.get(f"{BASE_URL}/api/portal-v4/admin/accounts", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        ids = [a["id"] for a in data]
        assert "test-p4-acc-a" in ids
        # Ensure password_hash/token not leaked
        for a in data:
            assert "password_hash" not in a
            assert "token" not in a

    def test_create_update_delete_account(self, admin_h):
        # CREATE
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/admin/accounts",
            json={"name": "TEST_P4_CRUD", "email": "test_p4_crud@example.com",
                  "customer_id": KUNDE_A_ID},
            headers=admin_h,
        )
        assert r.status_code == 200, r.text
        acc = r.json()
        acc_id = acc["id"]
        assert acc["name"] == "TEST_P4_CRUD"
        assert acc["customer_id"] == KUNDE_A_ID

        # GET single
        r = requests.get(f"{BASE_URL}/api/portal-v4/admin/accounts/{acc_id}", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["email"] == "test_p4_crud@example.com"

        # UPDATE
        r = requests.put(
            f"{BASE_URL}/api/portal-v4/admin/accounts/{acc_id}",
            json={"name": "TEST_P4_CRUD_RENAMED"},
            headers=admin_h,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_P4_CRUD_RENAMED"

        # DELETE
        r = requests.delete(f"{BASE_URL}/api/portal-v4/admin/accounts/{acc_id}", headers=admin_h)
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        r = requests.get(f"{BASE_URL}/api/portal-v4/admin/accounts/{acc_id}", headers=admin_h)
        assert r.status_code == 404


# ========== SETTINGS ==========
class TestSettings:
    def test_get_settings(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/portal-v4/admin/settings", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert "feature_enabled" in data

    def test_update_settings_toggle(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/portal-v4/admin/settings", headers=admin_h)
        original = r.json().get("feature_enabled")
        r = requests.put(
            f"{BASE_URL}/api/portal-v4/admin/settings",
            json={"feature_enabled": not original},
            headers=admin_h,
        )
        assert r.status_code == 200
        assert r.json()["feature_enabled"] is (not original)
        # restore
        requests.put(
            f"{BASE_URL}/api/portal-v4/admin/settings",
            json={"feature_enabled": original},
            headers=admin_h,
        )


# ========== CUSTOMER LOGIN ==========
class TestCustomerAuth:
    def test_preflight_valid(self, seed):
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/login/preflight",
            json={"token": seed["token_a"]},
        )
        assert r.status_code == 200
        assert r.json()["email"] == "test_p4_a@example.com"

    def test_preflight_invalid(self):
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/login/preflight",
            json={"token": "does-not-exist"},
        )
        assert r.status_code == 404

    def test_login_with_token(self, seed):
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/login",
            json={"token": seed["token_a"], "password": PASSWORD_A},
        )
        assert r.status_code == 200
        data = r.json()
        assert "session" in data and len(data["session"]) > 20
        assert data["account"]["email"] == "test_p4_a@example.com"

    def test_login_with_email(self, seed):
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/login",
            json={"email": "test_p4_b@example.com", "password": PASSWORD_B},
        )
        assert r.status_code == 200
        assert r.json()["account"]["id"] == "test-p4-acc-b"

    def test_login_wrong_password(self, seed):
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/login",
            json={"token": seed["token_a"], "password": "WRONG"},
        )
        assert r.status_code == 401

    def test_me_with_session(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/me",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 200
        assert r.json()["email"] == "test_p4_a@example.com"

    def test_me_without_token(self):
        r = requests.get(f"{BASE_URL}/api/portal-v4/me")
        assert r.status_code == 401


# ========== MESSAGES (CHAT) ==========
class TestMessages:
    def test_customer_send_and_list(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        h = {"Authorization": f"Bearer {sess}"}
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/messages",
            json={"text": "TEST_P4 hallo vom Kunden"},
            headers=h,
        )
        assert r.status_code == 200
        assert r.json()["text"] == "TEST_P4 hallo vom Kunden"

        r = requests.get(f"{BASE_URL}/api/portal-v4/messages", headers=h)
        assert r.status_code == 200
        msgs = r.json()
        assert any(m["text"] == "TEST_P4 hallo vom Kunden" for m in msgs)


# ========== UPLOADS ==========
class TestUploads:
    def test_customer_upload_and_list(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        h = {"Authorization": f"Bearer {sess}"}
        # minimal PDF file to pass type check
        pdf_bytes = b"%PDF-1.4\n%EOF\n"
        r = requests.post(
            f"{BASE_URL}/api/portal-v4/uploads",
            headers=h,
            data={"description": "TEST_P4 upload"},
            files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        )
        assert r.status_code == 200, r.text
        up = r.json()
        assert up["portal_id"] == "test-p4-acc-a"

        r = requests.get(f"{BASE_URL}/api/portal-v4/uploads", headers=h)
        assert r.status_code == 200
        assert any(u["id"] == up["id"] for u in r.json())


# ========== DOCUMENTS + SECURITY ==========
class TestDocuments:
    def test_account_a_sees_only_released_a(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 200
        docs = r.json()
        ids = [d["id"] for d in docs]
        assert "test-p4-doc-a-released" in ids
        assert "test-p4-doc-a-hidden" not in ids, "SECURITY: nicht freigegebenes Dokument darf NICHT erscheinen"
        assert "test-p4-doc-b-released" not in ids, "CROSS-CUSTOMER-LEAK: Kunde A sieht Kunde-B-Dokument!"

    def test_account_b_sees_only_released_b(self, seed):
        sess = _customer_session(seed["token_b"], PASSWORD_B)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert "test-p4-doc-b-released" in ids
        assert "test-p4-doc-a-released" not in ids, "CROSS-CUSTOMER-LEAK"
        assert "test-p4-doc-a-hidden" not in ids

    def test_account_without_customer_id_sees_nothing(self, seed):
        sess = _customer_session(seed["token_nocid"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 200
        assert r.json() == []

    def test_detail_404_for_foreign_customer(self, seed):
        # Account A tries to fetch B's released document -> 404
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-b-released",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 404

    def test_detail_404_for_own_but_unreleased(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-a-hidden",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 404

    def test_detail_200_for_released_own(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-a-released",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 200
        assert r.json()["id"] == "test-p4-doc-a-released"

    def test_pdf_download_own_released(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-a-released/pdf",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 200

    def test_pdf_download_foreign_blocked(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-b-released/pdf",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 404

    def test_pdf_download_unreleased_blocked(self, seed):
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-a-hidden/pdf",
            headers={"Authorization": f"Bearer {sess}"},
        )
        assert r.status_code == 404


# ========== DOKUMENTE V2 PATCH PORTAL V4 FREIGABE ==========
class TestFreigabePatch:
    def test_patch_freigabe_toggle_on_off(self, admin_h, seed):
        doc_id = "test-p4-doc-a-hidden"
        # Turn ON
        r = requests.patch(
            f"{BASE_URL}/api/dokumente-v2/admin/dokumente/{doc_id}/portal-v4-freigabe",
            params={"freigegeben": "true"},
            headers=admin_h,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["portal_v4_freigegeben"] is True
        assert data.get("portal_v4_freigegeben_at")
        assert data.get("portal_v4_freigegeben_by")

        # Customer A should now see it
        sess = _customer_session(seed["token_a"], PASSWORD_A)
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents",
            headers={"Authorization": f"Bearer {sess}"},
        )
        ids = [d["id"] for d in r.json()]
        assert doc_id in ids

        # Turn OFF
        r = requests.patch(
            f"{BASE_URL}/api/dokumente-v2/admin/dokumente/{doc_id}/portal-v4-freigabe",
            params={"freigegeben": "false"},
            headers=admin_h,
        )
        assert r.status_code == 200
        assert r.json()["portal_v4_freigegeben"] is False

        # Now invisible again
        r = requests.get(
            f"{BASE_URL}/api/portal-v4/documents",
            headers={"Authorization": f"Bearer {sess}"},
        )
        ids = [d["id"] for d in r.json()]
        assert doc_id not in ids


# ========== ISOLATION V2 <-> V4 ==========
class TestV2Isolation:
    def test_portal_v4_account_not_in_portal_v2_collection(self, seed):
        """portal2_accounts und portal4_accounts sind getrennte Collections."""
        async def check():
            cnt = await db.portal2_accounts.count_documents({"email": {"$regex": "^test_p4_"}})
            return cnt
        cnt = asyncio.get_event_loop().run_until_complete(check())
        assert cnt == 0

    def test_dokumente_v2_not_written_by_portal_v4_reads(self, seed, admin_h):
        """Nach kompletter Testreihe darf portal v4 NICHT in dokumente_v2 schreiben.
        Wir lesen vor + nach eine Reihe von Portal v4 Reads und prüfen, dass
        der 'updated_at' der TEST-Dokumente unverändert bleibt."""
        async def snapshot():
            docs = await db.dokumente_v2.find(
                {"betreff": {"$regex": "^TEST_P4_"}},
                {"_id": 0, "id": 1, "updated_at": 1, "portal_v4_freigegeben": 1},
            ).to_list(20)
            return {d["id"]: d.get("updated_at") for d in docs}

        before = asyncio.get_event_loop().run_until_complete(snapshot())

        sess = _customer_session(seed["token_a"], PASSWORD_A)
        h = {"Authorization": f"Bearer {sess}"}
        # Multiple reads
        requests.get(f"{BASE_URL}/api/portal-v4/documents", headers=h)
        requests.get(f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-a-released", headers=h)
        requests.get(f"{BASE_URL}/api/portal-v4/documents/test-p4-doc-a-released/pdf", headers=h)

        after = asyncio.get_event_loop().run_until_complete(snapshot())
        assert before == after, f"Portal v4 read caused write to dokumente_v2! before={before} after={after}"
