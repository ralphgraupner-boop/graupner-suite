"""v45 backend tests for Dokumenten-Editor fixes:
- Settings slogan_font_size persist (FIX 6)
- PDF Generation with slogan_font_size for quote/order/invoice (FIX 2 regression)
- Text Templates CRUD (FIX 1)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "Graupner!Suite2026"})
    assert r.status_code == 200, r.text
    # response uses "token" key
    data = r.json()
    return data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Settings: slogan_font_size ---
class TestSettingsSloganFontSize:
    def test_get_settings_has_slogan_font_size(self, headers):
        r = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Either preset or default 9
        assert "slogan_font_size" in data, f"slogan_font_size missing in {list(data.keys())[:20]}"
        assert isinstance(data["slogan_font_size"], int)

    def test_put_settings_slogan_font_size_persists(self, headers):
        # Read current
        cur = requests.get(f"{BASE_URL}/api/settings", headers=headers).json()
        original = cur.get("slogan_font_size", 9)
        try:
            new_val = 12 if original != 12 else 11
            cur["slogan_font_size"] = new_val
            r = requests.put(f"{BASE_URL}/api/settings", headers=headers, json=cur)
            assert r.status_code in (200, 201), r.text
            verify = requests.get(f"{BASE_URL}/api/settings", headers=headers).json()
            assert verify["slogan_font_size"] == new_val, f"got {verify['slogan_font_size']} expected {new_val}"
        finally:
            cur["slogan_font_size"] = original
            requests.put(f"{BASE_URL}/api/settings", headers=headers, json=cur)


# --- PDF-Generation with slogan_font_size across document types ---
class TestPDFGenerationDocTypes:
    @pytest.fixture(scope="class")
    def customer_id(self, headers):
        payload = {"name": "TEST_v45 Kunde", "email": "test45@example.com"}
        r = requests.post(f"{BASE_URL}/api/customers", headers=headers, json=payload)
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id")
        yield cid
        try:
            requests.delete(f"{BASE_URL}/api/customers/{cid}", headers=headers)
        except Exception:
            pass

    def _create_doc(self, endpoint, headers, customer_id):
        payload = {
            "customer_id": customer_id,
            "subject": f"TEST_v45 {endpoint}",
            "positions": [
                {"description": "TEST Pos 1", "quantity": 1, "unit": "Stk", "price_net": 100.0, "tax_rate": 19}
            ],
        }
        r = requests.post(f"{BASE_URL}/api/{endpoint}", headers=headers, json=payload)
        assert r.status_code in (200, 201), f"{endpoint} create failed: {r.status_code} {r.text}"
        return r.json().get("id")

    def test_quote_pdf_ok(self, headers, customer_id):
        qid = self._create_doc("quotes", headers, customer_id)
        r = requests.get(f"{BASE_URL}/api/pdf/quote/{qid}", headers=headers)
        assert r.status_code == 200, f"PDF gen failed: {r.status_code} {r.text[:300]}"
        assert r.content[:4] == b"%PDF", "Not a PDF binary"
        requests.delete(f"{BASE_URL}/api/quotes/{qid}", headers=headers)

    def test_order_pdf_ok(self, headers, customer_id):
        # Orders are created via blank-for-customer route
        r = requests.post(f"{BASE_URL}/api/orders/blank-for-customer/{customer_id}", headers=headers)
        assert r.status_code in (200, 201), f"order create failed: {r.status_code} {r.text}"
        oid = r.json().get("id")
        # Add a position via PUT
        order = r.json()
        order["positions"] = [{"description": "TEST", "quantity": 1, "unit": "Stk", "price_net": 50.0, "tax_rate": 19}]
        requests.put(f"{BASE_URL}/api/orders/{oid}", headers=headers, json=order)
        r = requests.get(f"{BASE_URL}/api/pdf/order/{oid}", headers=headers)
        assert r.status_code == 200, f"PDF gen failed: {r.status_code} {r.text[:300]}"
        assert r.content[:4] == b"%PDF"
        requests.delete(f"{BASE_URL}/api/orders/{oid}", headers=headers)

    def test_invoice_pdf_ok(self, headers, customer_id):
        iid = self._create_doc("invoices", headers, customer_id)
        r = requests.get(f"{BASE_URL}/api/pdf/invoice/{iid}", headers=headers)
        assert r.status_code == 200, f"PDF gen failed: {r.status_code} {r.text[:300]}"
        assert r.content[:4] == b"%PDF"
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=headers)

    def test_pdf_with_custom_slogan_size(self, headers, customer_id):
        # Set custom slogan size, generate PDF, ensure no exception
        cur = requests.get(f"{BASE_URL}/api/settings", headers=headers).json()
        original = cur.get("slogan_font_size", 9)
        try:
            cur["slogan_font_size"] = 14
            requests.put(f"{BASE_URL}/api/settings", headers=headers, json=cur)
            qid = self._create_doc("quotes", headers, customer_id)
            r = requests.get(f"{BASE_URL}/api/pdf/quote/{qid}", headers=headers)
            assert r.status_code == 200, f"PDF with slogan_size=14 failed: {r.text[:300]}"
            assert r.content[:4] == b"%PDF"
            requests.delete(f"{BASE_URL}/api/quotes/{qid}", headers=headers)
        finally:
            cur["slogan_font_size"] = original
            requests.put(f"{BASE_URL}/api/settings", headers=headers, json=cur)


# --- Text Templates ---
class TestTextTemplatesCRUD:
    def test_list_templates(self, headers):
        r = requests.get(f"{BASE_URL}/api/text-templates", headers=headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_update_delete(self, headers):
        # Create
        payload = {"title": "TEST_v45 Template", "content": "Hallo Welt", "category": "general", "doc_type": "angebot", "text_type": "vortext"}
        r = requests.post(f"{BASE_URL}/api/text-templates", headers=headers, json=payload)
        assert r.status_code in (200, 201), r.text
        tid = r.json().get("id")
        assert tid
        # Update
        upd = {"title": "TEST_v45 Updated", "content": "Aktualisiert", "category": "general", "doc_type": "angebot", "text_type": "vortext"}
        r = requests.put(f"{BASE_URL}/api/text-templates/{tid}", headers=headers, json=upd)
        assert r.status_code == 200, r.text
        # Verify
        r = requests.get(f"{BASE_URL}/api/text-templates", headers=headers)
        items = [t for t in r.json() if t.get("id") == tid]
        assert items and items[0]["title"] == "TEST_v45 Updated"
        # Delete
        r = requests.delete(f"{BASE_URL}/api/text-templates/{tid}", headers=headers)
        assert r.status_code in (200, 204)
