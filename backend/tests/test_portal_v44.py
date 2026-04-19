"""Tests for v44: Portal-Settings, Upload-Limits, Rate-Limit, Compression, Absenden/Mark-Read + Mitarbeiter regression."""
import os
import io
import time
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://handwerk-deploy.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "Graupner!Suite2026"}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---- Portal Settings ----
class TestPortalSettings:
    def test_get_public_defaults(self):
        r = requests.get(f"{API}/portal-settings", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "begruessung" in data and "hinweise" in data
        assert "absende_text" in data and "fertig_text" in data

    def test_put_updates_settings(self, H):
        payload = {
            "begruessung": "TEST_BEGRUESSUNG_v44",
            "hinweise": "TEST_HINWEIS",
            "absende_text": "TEST_SEND",
            "fertig_text": "TEST_FERTIG",
            "logo_url": "https://example.com/logo.png",
        }
        r = requests.put(f"{API}/portal-settings", headers=H, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # verify via GET
        g = requests.get(f"{API}/portal-settings", timeout=15).json()
        assert g["begruessung"] == "TEST_BEGRUESSUNG_v44"
        assert g["absende_text"] == "TEST_SEND"


# ---- Portal creation + for-customer + absenden + mark-read ----
class TestPortalLifecycle:
    customer_id = None
    portal_id = None
    portal_token = None
    portal_password = None

    def test_01_for_customer_none(self, H):
        r = requests.get(f"{API}/portals/for-customer/nonexistent_{uuid.uuid4().hex}", headers=H, timeout=15)
        assert r.status_code == 200
        assert r.json().get("exists") is False

    def test_02_create_customer_with_email(self, H):
        payload = {"vorname": "TEST", "nachname": f"Port44_{uuid.uuid4().hex[:6]}",
                   "email": f"test_{uuid.uuid4().hex[:6]}@example.com"}
        r = requests.post(f"{API}/modules/kunden/data", headers=H, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        TestPortalLifecycle.customer_id = r.json().get("id")
        assert TestPortalLifecycle.customer_id

    def test_03_create_portal_from_customer(self, H):
        body = {"description": "TEST portal v44", "portal_base_url": BASE_URL}
        r = requests.post(f"{API}/portals/from-customer/{TestPortalLifecycle.customer_id}",
                          headers=H, json=body, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        TestPortalLifecycle.portal_id = p["id"]
        TestPortalLifecycle.portal_token = p["token"]
        TestPortalLifecycle.portal_password = p["password_plain"]

    def test_04_for_customer_exists(self, H):
        r = requests.get(f"{API}/portals/for-customer/{TestPortalLifecycle.customer_id}", headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["exists"] is True
        assert d["portal"]["id"] == TestPortalLifecycle.portal_id

    def test_05_absenden(self):
        r = requests.post(
            f"{API}/portal/{TestPortalLifecycle.portal_token}/absenden",
            json={"password": TestPortalLifecycle.portal_password, "text": "Fertig TEST"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("note", {}).get("type") == "absenden"

    def test_06_mark_read(self, H):
        r = requests.post(f"{API}/portals/{TestPortalLifecycle.portal_id}/mark-read", headers=H, timeout=15)
        assert r.status_code == 200

    def test_07_admin_note_push(self, H):
        r = requests.post(
            f"{API}/portals/{TestPortalLifecycle.portal_id}/admin-notes",
            headers=H, json={"text": "Hallo TEST von Admin"}, timeout=15,
        )
        assert r.status_code == 200
        note = r.json()
        assert note["type"] == "admin"
        # verify admin_has_new_content=True via list
        lst = requests.get(f"{API}/portals", headers=H, timeout=15).json()
        portal = next((p for p in lst if p["id"] == TestPortalLifecycle.portal_id), None)
        assert portal is not None
        assert portal.get("admin_has_new_content") is True


# ---- Image compression + upload limits + rate limit ----
def _make_jpg(size_px=3000, quality=95):
    img = Image.new("RGB", (size_px, size_px))
    # fill with noise to prevent tiny compression
    import random
    pixels = [(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
              for _ in range(size_px * size_px)]
    img.putdata(pixels)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _make_small_jpg():
    img = Image.new("RGB", (200, 200), (100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


class TestUploadCompressionAndLimits:
    customer_id = None
    portal_id = None
    portal_token = None
    portal_password = None

    def test_01_setup_portal(self, H):
        payload = {"vorname": "TEST", "nachname": f"Upload_{uuid.uuid4().hex[:6]}",
                   "email": f"up_{uuid.uuid4().hex[:6]}@example.com"}
        r = requests.post(f"{API}/modules/kunden/data", headers=H, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        TestUploadCompressionAndLimits.customer_id = r.json()["id"]
        body = {"description": "TEST upload", "portal_base_url": BASE_URL}
        r = requests.post(f"{API}/portals/from-customer/{TestUploadCompressionAndLimits.customer_id}",
                          headers=H, json=body, timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        TestUploadCompressionAndLimits.portal_id = p["id"]
        TestUploadCompressionAndLimits.portal_token = p["token"]
        TestUploadCompressionAndLimits.portal_password = p["password_plain"]

    def test_02_compression_reduces_size(self):
        big = _make_jpg(size_px=3000, quality=95)
        original_size = len(big)
        assert original_size > 500_000, f"test image too small: {original_size}"
        files = {"file": ("big.jpg", big, "image/jpeg")}
        data = {"password": TestUploadCompressionAndLimits.portal_password, "description": "big"}
        r = requests.post(
            f"{API}/portal/{TestUploadCompressionAndLimits.portal_token}/upload",
            data=data, files=files, timeout=60,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["content_type"] == "image/jpeg"
        assert doc["size"] < original_size, f"not compressed: {doc['size']} vs {original_size}"
        assert doc.get("original_size") == original_size

    def test_03_rate_limit_auto_lock(self, H):
        """Upload > 10 images in <60s to trigger rate_limit lock.
        Note: test_02 already uploaded 1; we upload 10 more small to hit limit at 11."""
        success = 0
        locked = False
        for i in range(12):
            small = _make_small_jpg()
            files = {"file": (f"s{i}.jpg", small, "image/jpeg")}
            data = {"password": TestUploadCompressionAndLimits.portal_password, "description": f"r{i}"}
            r = requests.post(
                f"{API}/portal/{TestUploadCompressionAndLimits.portal_token}/upload",
                data=data, files=files, timeout=30,
            )
            if r.status_code == 200:
                success += 1
            elif r.status_code == 429:
                locked = True
                break
            else:
                # 403 if portal deaktiviert after lock
                if r.status_code == 403 and "deaktiviert" in r.text.lower():
                    locked = True
                    break
        assert locked, f"rate limit not triggered after {success} successful uploads"
        # verify portal is locked
        lst = requests.get(f"{API}/portals", headers=H, timeout=15).json()
        portal = next((p for p in lst if p["id"] == TestUploadCompressionAndLimits.portal_id), None)
        assert portal is not None
        assert portal.get("active") is False
        assert portal.get("locked_reason") == "rate_limit"

    def test_04_reactivate_and_30_limit(self, H):
        # Reactivate portal
        requests.put(f"{API}/portals/{TestUploadCompressionAndLimits.portal_id}",
                     headers=H, json={"active": True}, timeout=15)
        # Count current files
        files_list = requests.get(f"{API}/portals/{TestUploadCompressionAndLimits.portal_id}/files",
                                  headers=H, timeout=15).json()
        current = len([f for f in files_list if f.get("uploaded_by") == "customer"])
        remaining = 30 - current
        # Wait for rate-limit window to pass (60s)
        if remaining > 0:
            time.sleep(62)
        # Upload remaining up to 30, slowly to avoid rate limit (batches of 10/60s)
        uploaded = 0
        for i in range(remaining):
            if uploaded > 0 and uploaded % 9 == 0:
                time.sleep(62)
            small = _make_small_jpg()
            files = {"file": (f"c{i}.jpg", small, "image/jpeg")}
            data = {"password": TestUploadCompressionAndLimits.portal_password, "description": f"f{i}"}
            r = requests.post(
                f"{API}/portal/{TestUploadCompressionAndLimits.portal_token}/upload",
                data=data, files=files, timeout=30,
            )
            if r.status_code == 200:
                uploaded += 1
            elif r.status_code == 429:
                time.sleep(62)
                requests.put(f"{API}/portals/{TestUploadCompressionAndLimits.portal_id}",
                             headers=H, json={"active": True}, timeout=15)
            elif r.status_code == 400 and "Maximale" in r.text:
                break
            else:
                pytest.fail(f"unexpected status {r.status_code}: {r.text}")
        # Now one more should fail with 400 max
        small = _make_small_jpg()
        files = {"file": ("over.jpg", small, "image/jpeg")}
        data = {"password": TestUploadCompressionAndLimits.portal_password}
        r = requests.post(
            f"{API}/portal/{TestUploadCompressionAndLimits.portal_token}/upload",
            data=data, files=files, timeout=30,
        )
        assert r.status_code == 400, f"expected 400 max-images, got {r.status_code} {r.text}"
        assert "Maximale" in r.text or "max" in r.text.lower()


# ---- Mitarbeiter regression ----
class TestMitarbeiterRegression:
    mid = None

    def test_list(self, H):
        r = requests.get(f"{API}/mitarbeiter", headers=H, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create(self, H):
        r = requests.post(f"{API}/mitarbeiter", headers=H,
                          json={"vorname": "TEST", "nachname": f"MA_{uuid.uuid4().hex[:6]}"}, timeout=15)
        assert r.status_code in (200, 201), r.text
        TestMitarbeiterRegression.mid = r.json().get("id")
        assert TestMitarbeiterRegression.mid

    def test_get_detail(self, H):
        r = requests.get(f"{API}/mitarbeiter/{TestMitarbeiterRegression.mid}", headers=H, timeout=15)
        assert r.status_code == 200
        assert r.json()["vorname"] == "TEST"

    def test_update(self, H):
        r = requests.put(f"{API}/mitarbeiter/{TestMitarbeiterRegression.mid}", headers=H,
                         json={"position": "Testposition"}, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/mitarbeiter/{TestMitarbeiterRegression.mid}", headers=H, timeout=15).json()
        assert g.get("position") == "Testposition"

    def test_subroutes(self, H):
        mid = TestMitarbeiterRegression.mid
        # List endpoints should respond 200 with list or dict (at minimum non-error)
        for sub in ["urlaub", "krankmeldungen", "dokumente", "fortbildungen", "lohnhistorie"]:
            r = requests.get(f"{API}/mitarbeiter/{mid}/{sub}", headers=H, timeout=15)
            assert r.status_code in (200, 404), f"{sub} -> {r.status_code} {r.text[:200]}"

    def test_cleanup(self, H):
        if TestMitarbeiterRegression.mid:
            requests.delete(f"{API}/mitarbeiter/{TestMitarbeiterRegression.mid}", headers=H, timeout=15)
