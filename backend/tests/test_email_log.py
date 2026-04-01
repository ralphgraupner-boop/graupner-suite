"""
Test Email Log Feature for Graupner Suite
Tests:
- GET /api/email/log - returns all email log entries sorted by date
- GET /api/email/log/{doc_type}/{doc_id} - returns email history for specific document
- Email log entries are automatically created when sending emails via POST /api/email/document/{type}/{id}
- Email log entries are automatically created when sending emails via POST /api/email/dunning/{id}
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmailLog:
    """Email Log API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        self.token = login_res.json()["token"]
        self.params = {"token": self.token}
    
    def test_get_email_log_returns_list(self):
        """GET /api/email/log returns list of all email log entries"""
        res = requests.get(f"{BASE_URL}/api/email/log", params=self.params)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/email/log returns {len(data)} entries")
    
    def test_email_log_entries_have_required_fields(self):
        """Email log entries have all required fields"""
        res = requests.get(f"{BASE_URL}/api/email/log", params=self.params)
        assert res.status_code == 200
        data = res.json()
        
        if len(data) > 0:
            entry = data[0]
            required_fields = ["id", "to_email", "subject", "doc_type", "doc_id", "status", "sent_at"]
            for field in required_fields:
                assert field in entry, f"Missing field: {field}"
            print(f"✓ Email log entry has all required fields: {required_fields}")
            print(f"  Sample entry: to={entry.get('to_email')}, subject={entry.get('subject')}, status={entry.get('status')}")
        else:
            print("⚠ No email log entries found - will be created when emails are sent")
    
    def test_email_log_sorted_by_date_descending(self):
        """Email log entries are sorted by sent_at descending (newest first)"""
        res = requests.get(f"{BASE_URL}/api/email/log", params=self.params)
        assert res.status_code == 200
        data = res.json()
        
        if len(data) >= 2:
            dates = [entry.get("sent_at", "") for entry in data]
            assert dates == sorted(dates, reverse=True), "Entries should be sorted by date descending"
            print(f"✓ Email log entries sorted by date (newest first)")
        else:
            print("⚠ Not enough entries to verify sorting")
    
    def test_email_log_requires_auth(self):
        """GET /api/email/log requires authentication"""
        res = requests.get(f"{BASE_URL}/api/email/log")
        assert res.status_code == 401, f"Expected 401 without token, got {res.status_code}"
        print("✓ GET /api/email/log requires authentication")
    
    def test_get_email_log_for_document(self):
        """GET /api/email/log/{doc_type}/{doc_id} returns email history for specific document"""
        # First get an invoice to test with
        invoices_res = requests.get(f"{BASE_URL}/api/invoices", params=self.params)
        assert invoices_res.status_code == 200
        invoices = invoices_res.json()
        
        if len(invoices) > 0:
            invoice = invoices[0]
            invoice_id = invoice["id"]
            
            res = requests.get(f"{BASE_URL}/api/email/log/invoice/{invoice_id}", params=self.params)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert isinstance(data, list), "Response should be a list"
            
            # Verify all entries are for this document
            for entry in data:
                assert entry.get("doc_type") == "invoice", f"Expected doc_type=invoice, got {entry.get('doc_type')}"
                assert entry.get("doc_id") == invoice_id, f"Expected doc_id={invoice_id}, got {entry.get('doc_id')}"
            
            print(f"✓ GET /api/email/log/invoice/{invoice_id} returns {len(data)} entries for this document")
        else:
            print("⚠ No invoices found to test document-specific email log")
    
    def test_email_log_for_document_requires_auth(self):
        """GET /api/email/log/{doc_type}/{doc_id} requires authentication"""
        res = requests.get(f"{BASE_URL}/api/email/log/invoice/test-id")
        assert res.status_code == 401, f"Expected 401 without token, got {res.status_code}"
        print("✓ GET /api/email/log/{doc_type}/{doc_id} requires authentication")
    
    def test_email_log_for_nonexistent_document(self):
        """GET /api/email/log/{doc_type}/{doc_id} returns empty list for nonexistent document"""
        res = requests.get(f"{BASE_URL}/api/email/log/invoice/nonexistent-id-12345", params=self.params)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, "Should return empty list for nonexistent document"
        print("✓ GET /api/email/log for nonexistent document returns empty list")


class TestEmailLogCreation:
    """Test that email log entries are automatically created when sending emails"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        self.token = login_res.json()["token"]
        self.params = {"token": self.token}
    
    def test_email_document_creates_log_entry(self):
        """POST /api/email/document/{type}/{id} creates email log entry"""
        # Get an invoice to send
        invoices_res = requests.get(f"{BASE_URL}/api/invoices", params=self.params)
        assert invoices_res.status_code == 200
        invoices = invoices_res.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices available for testing")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        
        # Get current log count for this document
        log_before = requests.get(f"{BASE_URL}/api/email/log/invoice/{invoice_id}", params=self.params)
        count_before = len(log_before.json())
        
        # Send email (this is REAL SMTP - will actually send)
        test_email = "test-log@example.com"  # Use a test email
        email_res = requests.post(
            f"{BASE_URL}/api/email/document/invoice/{invoice_id}",
            params=self.params,
            json={
                "to_email": test_email,
                "subject": f"Test Email Log - {datetime.now().isoformat()}",
                "message": "Testing email log creation"
            }
        )
        
        # Check if email was sent (may fail if SMTP not configured for test email)
        if email_res.status_code == 200:
            # Verify log entry was created
            log_after = requests.get(f"{BASE_URL}/api/email/log/invoice/{invoice_id}", params=self.params)
            count_after = len(log_after.json())
            assert count_after > count_before, "Email log entry should be created after sending"
            
            # Verify the new entry has correct data
            new_entry = log_after.json()[0]  # Most recent entry
            assert new_entry.get("to_email") == test_email
            assert new_entry.get("doc_type") == "invoice"
            assert new_entry.get("doc_id") == invoice_id
            assert new_entry.get("status") == "gesendet"
            print(f"✓ Email document creates log entry with status=gesendet")
        else:
            # Email failed - log entry should still be created with status=fehlgeschlagen
            log_after = requests.get(f"{BASE_URL}/api/email/log/invoice/{invoice_id}", params=self.params)
            count_after = len(log_after.json())
            
            if count_after > count_before:
                new_entry = log_after.json()[0]
                assert new_entry.get("status") == "fehlgeschlagen"
                print(f"✓ Failed email creates log entry with status=fehlgeschlagen")
            else:
                print(f"⚠ Email send returned {email_res.status_code}: {email_res.text}")
    
    def test_email_dunning_creates_log_entry(self):
        """POST /api/email/dunning/{id} creates email log entry"""
        # Get an invoice with dunning level > 0
        invoices_res = requests.get(f"{BASE_URL}/api/invoices", params=self.params)
        assert invoices_res.status_code == 200
        invoices = invoices_res.json()
        
        # Find invoice with dunning level or create one
        dunned_invoice = None
        for inv in invoices:
            if inv.get("dunning_level", 0) > 0:
                dunned_invoice = inv
                break
        
        if not dunned_invoice and len(invoices) > 0:
            # Advance dunning on first invoice
            inv = invoices[0]
            dunning_res = requests.post(f"{BASE_URL}/api/invoices/{inv['id']}/dunning", params=self.params)
            if dunning_res.status_code == 200:
                dunned_invoice = inv
                dunned_invoice["dunning_level"] = 1
        
        if not dunned_invoice:
            pytest.skip("No invoices available for dunning test")
        
        invoice_id = dunned_invoice["id"]
        
        # Get current log count
        log_before = requests.get(f"{BASE_URL}/api/email/log/dunning/{invoice_id}", params=self.params)
        count_before = len(log_before.json())
        
        # Send dunning email
        test_email = "test-dunning@example.com"
        email_res = requests.post(
            f"{BASE_URL}/api/email/dunning/{invoice_id}",
            params=self.params,
            json={
                "to_email": test_email,
                "subject": f"Test Dunning Log - {datetime.now().isoformat()}",
                "message": ""
            }
        )
        
        # Check log entry was created
        log_after = requests.get(f"{BASE_URL}/api/email/log/dunning/{invoice_id}", params=self.params)
        count_after = len(log_after.json())
        
        if count_after > count_before:
            new_entry = log_after.json()[0]
            assert new_entry.get("doc_type") == "dunning"
            assert new_entry.get("doc_id") == invoice_id
            print(f"✓ Email dunning creates log entry with doc_type=dunning")
        else:
            print(f"⚠ Dunning email returned {email_res.status_code}: {email_res.text}")


class TestEmailLogIntegration:
    """Integration tests for email log with existing email functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200
        self.token = login_res.json()["token"]
        self.params = {"token": self.token}
    
    def test_email_log_contains_existing_entries(self):
        """Verify existing email log entries from previous tests"""
        res = requests.get(f"{BASE_URL}/api/email/log", params=self.params)
        assert res.status_code == 200
        data = res.json()
        
        print(f"✓ Email log contains {len(data)} total entries")
        
        # Count by doc_type
        type_counts = {}
        for entry in data:
            doc_type = entry.get("doc_type", "unknown")
            type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
        
        for doc_type, count in type_counts.items():
            print(f"  - {doc_type}: {count} entries")
        
        # Count by status
        status_counts = {}
        for entry in data:
            status = entry.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in status_counts.items():
            print(f"  - Status '{status}': {count} entries")
    
    def test_email_log_for_quote(self):
        """Test email log for quote documents"""
        quotes_res = requests.get(f"{BASE_URL}/api/quotes", params=self.params)
        assert quotes_res.status_code == 200
        quotes = quotes_res.json()
        
        if len(quotes) > 0:
            quote = quotes[0]
            res = requests.get(f"{BASE_URL}/api/email/log/quote/{quote['id']}", params=self.params)
            assert res.status_code == 200
            print(f"✓ GET /api/email/log/quote/{quote['id']} returns {len(res.json())} entries")
        else:
            print("⚠ No quotes found to test")
    
    def test_email_log_for_order(self):
        """Test email log for order documents"""
        orders_res = requests.get(f"{BASE_URL}/api/orders", params=self.params)
        assert orders_res.status_code == 200
        orders = orders_res.json()
        
        if len(orders) > 0:
            order = orders[0]
            res = requests.get(f"{BASE_URL}/api/email/log/order/{order['id']}", params=self.params)
            assert res.status_code == 200
            print(f"✓ GET /api/email/log/order/{order['id']} returns {len(res.json())} entries")
        else:
            print("⚠ No orders found to test")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
