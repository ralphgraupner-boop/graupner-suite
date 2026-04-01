"""
Test suite for Email and Due-Date Warning Features (Iteration 8)
Tests:
1. GET /api/invoices/due-soon - returns invoices due within 3 days
2. POST /api/invoices/check-due - detects overdue/due-soon invoices, sends push, sets status
3. POST /api/email/document/{type}/{id} - sends document PDF via SMTP email
4. POST /api/email/dunning/{id} - sends dunning PDF via SMTP email
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestDueSoonEndpoint:
    """Tests for GET /api/invoices/due-soon endpoint"""
    
    def test_due_soon_returns_200(self, api_client, auth_token):
        """GET /api/invoices/due-soon should return 200 with list"""
        response = api_client.get(f"{BASE_URL}/api/invoices/due-soon", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/invoices/due-soon returned {len(data)} invoices")
    
    def test_due_soon_invoice_structure(self, api_client, auth_token):
        """Due-soon invoices should have days_until_due field"""
        response = api_client.get(f"{BASE_URL}/api/invoices/due-soon", params={"token": auth_token})
        assert response.status_code == 200
        data = response.json()
        # If there are due-soon invoices, check structure
        if len(data) > 0:
            inv = data[0]
            assert "days_until_due" in inv, "Invoice should have days_until_due field"
            assert "invoice_number" in inv, "Invoice should have invoice_number"
            assert "customer_name" in inv, "Invoice should have customer_name"
            assert "due_date" in inv, "Invoice should have due_date"
            print(f"✓ Due-soon invoice structure verified: {inv.get('invoice_number')}")
        else:
            print("✓ No due-soon invoices currently (expected based on context)")


class TestCheckDueEndpoint:
    """Tests for POST /api/invoices/check-due endpoint"""
    
    def test_check_due_returns_200(self, api_client, auth_token):
        """POST /api/invoices/check-due should return 200 with counts"""
        response = api_client.post(f"{BASE_URL}/api/invoices/check-due", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "due_soon" in data, "Response should have due_soon count"
        assert "overdue" in data, "Response should have overdue count"
        assert "notifications_sent" in data, "Response should have notifications_sent count"
        print(f"✓ POST /api/invoices/check-due: due_soon={data['due_soon']}, overdue={data['overdue']}, notifications={data['notifications_sent']}")
    
    def test_check_due_updates_overdue_status(self, api_client, auth_token):
        """Check-due should set overdue invoices to 'Überfällig' status"""
        # First call check-due
        response = api_client.post(f"{BASE_URL}/api/invoices/check-due", params={"token": auth_token})
        assert response.status_code == 200
        
        # Then verify overdue invoices have correct status
        overdue_response = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        assert overdue_response.status_code == 200
        overdue_invoices = overdue_response.json()
        
        for inv in overdue_invoices:
            assert inv.get("status") == "Überfällig", f"Overdue invoice {inv.get('invoice_number')} should have status 'Überfällig'"
        
        print(f"✓ All {len(overdue_invoices)} overdue invoices have status 'Überfällig'")


class TestEmailDocumentEndpoint:
    """Tests for POST /api/email/document/{type}/{id} endpoint"""
    
    def test_email_invoice_success(self, api_client, auth_token):
        """POST /api/email/document/invoice/{id} should send email successfully"""
        # First get an invoice to test with
        invoices_response = api_client.get(f"{BASE_URL}/api/invoices", params={"token": auth_token})
        assert invoices_response.status_code == 200
        invoices = invoices_response.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices available for email test")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        
        # Send email to test address
        response = api_client.post(
            f"{BASE_URL}/api/email/document/invoice/{invoice_id}",
            params={"token": auth_token},
            json={
                "to_email": "service24@tischlerei-graupner.de",
                "subject": f"TEST: Rechnung {invoice.get('invoice_number')}",
                "message": "Dies ist ein automatisierter Test."
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "erfolgreich" in data["message"].lower() or "gesendet" in data["message"].lower(), "Message should indicate success"
        print(f"✓ Invoice email sent successfully: {data['message']}")
    
    def test_email_quote_success(self, api_client, auth_token):
        """POST /api/email/document/quote/{id} should send email successfully"""
        # First get a quote to test with
        quotes_response = api_client.get(f"{BASE_URL}/api/quotes", params={"token": auth_token})
        assert quotes_response.status_code == 200
        quotes = quotes_response.json()
        
        if len(quotes) == 0:
            pytest.skip("No quotes available for email test")
        
        quote = quotes[0]
        quote_id = quote["id"]
        
        # Send email to test address
        response = api_client.post(
            f"{BASE_URL}/api/email/document/quote/{quote_id}",
            params={"token": auth_token},
            json={
                "to_email": "service24@tischlerei-graupner.de",
                "subject": f"TEST: Angebot {quote.get('quote_number')}",
                "message": "Dies ist ein automatisierter Test."
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ Quote email sent successfully: {data['message']}")
    
    def test_email_invalid_doc_type(self, api_client, auth_token):
        """POST /api/email/document/invalid/{id} should return 400"""
        response = api_client.post(
            f"{BASE_URL}/api/email/document/invalid/some-id",
            params={"token": auth_token},
            json={
                "to_email": "test@example.com",
                "subject": "Test"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid doc type, got {response.status_code}"
        print("✓ Invalid document type returns 400")
    
    def test_email_nonexistent_document(self, api_client, auth_token):
        """POST /api/email/document/invoice/nonexistent should return 404"""
        response = api_client.post(
            f"{BASE_URL}/api/email/document/invoice/nonexistent-id-12345",
            params={"token": auth_token},
            json={
                "to_email": "test@example.com",
                "subject": "Test"
            }
        )
        assert response.status_code == 404, f"Expected 404 for nonexistent document, got {response.status_code}"
        print("✓ Nonexistent document returns 404")


class TestEmailDunningEndpoint:
    """Tests for POST /api/email/dunning/{id} endpoint"""
    
    def test_email_dunning_success(self, api_client, auth_token):
        """POST /api/email/dunning/{id} should send dunning email successfully"""
        # Get overdue invoices with dunning level > 0
        overdue_response = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        assert overdue_response.status_code == 200
        overdue_invoices = overdue_response.json()
        
        # Find an invoice with dunning_level > 0
        dunned_invoice = None
        for inv in overdue_invoices:
            if inv.get("dunning_level", 0) > 0:
                dunned_invoice = inv
                break
        
        if not dunned_invoice:
            pytest.skip("No dunned invoices available for email test")
        
        invoice_id = dunned_invoice["id"]
        level = dunned_invoice.get("dunning_level", 1)
        dunning_names = {1: "Zahlungserinnerung", 2: "1. Mahnung", 3: "Letzte Mahnung"}
        
        # Send dunning email
        response = api_client.post(
            f"{BASE_URL}/api/email/dunning/{invoice_id}",
            params={"token": auth_token},
            json={
                "to_email": "service24@tischlerei-graupner.de",
                "subject": f"TEST: {dunning_names.get(level, 'Mahnung')} - Rechnung {dunned_invoice.get('invoice_number')}"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "erfolgreich" in data["message"].lower() or "gesendet" in data["message"].lower(), "Message should indicate success"
        print(f"✓ Dunning email sent successfully for {dunned_invoice.get('invoice_number')}: {data['message']}")
    
    def test_email_dunning_nonexistent_invoice(self, api_client, auth_token):
        """POST /api/email/dunning/nonexistent should return 404"""
        response = api_client.post(
            f"{BASE_URL}/api/email/dunning/nonexistent-id-12345",
            params={"token": auth_token},
            json={
                "to_email": "test@example.com",
                "subject": "Test Mahnung"
            }
        )
        assert response.status_code == 404, f"Expected 404 for nonexistent invoice, got {response.status_code}"
        print("✓ Nonexistent invoice returns 404 for dunning email")


class TestOverdueInvoicesEndpoint:
    """Tests for GET /api/invoices/overdue endpoint (verify it still works)"""
    
    def test_overdue_returns_200(self, api_client, auth_token):
        """GET /api/invoices/overdue should return 200 with list"""
        response = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/invoices/overdue returned {len(data)} invoices")
    
    def test_overdue_invoice_structure(self, api_client, auth_token):
        """Overdue invoices should have days_overdue field"""
        response = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            inv = data[0]
            assert "days_overdue" in inv, "Invoice should have days_overdue field"
            assert "invoice_number" in inv, "Invoice should have invoice_number"
            assert "customer_name" in inv, "Invoice should have customer_name"
            assert "due_date" in inv, "Invoice should have due_date"
            assert "dunning_level" in inv, "Invoice should have dunning_level"
            print(f"✓ Overdue invoice structure verified: {inv.get('invoice_number')} ({inv.get('days_overdue')} days overdue, level {inv.get('dunning_level')})")
        else:
            print("✓ No overdue invoices currently")


class TestEmailRequiresAuth:
    """Tests that email endpoints require authentication"""
    
    def test_email_document_requires_auth(self, api_client):
        """POST /api/email/document without token should return 401"""
        response = api_client.post(
            f"{BASE_URL}/api/email/document/invoice/some-id",
            json={"to_email": "test@example.com", "subject": "Test"}
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Email document endpoint requires authentication")
    
    def test_email_dunning_requires_auth(self, api_client):
        """POST /api/email/dunning without token should return 401"""
        response = api_client.post(
            f"{BASE_URL}/api/email/dunning/some-id",
            json={"to_email": "test@example.com", "subject": "Test"}
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Email dunning endpoint requires authentication")
    
    def test_due_soon_requires_auth(self, api_client):
        """GET /api/invoices/due-soon without token should return 401"""
        response = api_client.get(f"{BASE_URL}/api/invoices/due-soon")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Due-soon endpoint requires authentication")
    
    def test_check_due_requires_auth(self, api_client):
        """POST /api/invoices/check-due without token should return 401"""
        response = api_client.post(f"{BASE_URL}/api/invoices/check-due")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Check-due endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
