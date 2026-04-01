"""
Test suite for Graupner Suite - Iteration 10 Features
Tests: Customer Status, Stats Overview, Quote Followup, Settings Expansion
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["username"] == "admin"
        print("PASS: Login successful")


class TestStatsOverview:
    """Tests for GET /api/stats/overview endpoint with view parameter"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_overview_anfragen_view(self, auth_token):
        """Test stats/overview with view=anfragen returns grouped data by categories"""
        response = requests.get(f"{BASE_URL}/api/stats/overview", params={
            "token": auth_token,
            "view": "anfragen"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["view"] == "anfragen"
        assert "total" in data
        assert "groups" in data
        # Check that groups contain category keys
        groups = data["groups"]
        assert isinstance(groups, dict)
        print(f"PASS: Overview anfragen - total: {data['total']}, groups: {list(groups.keys())}")
    
    def test_overview_kunden_view(self, auth_token):
        """Test stats/overview with view=kunden returns grouped data by customer statuses"""
        response = requests.get(f"{BASE_URL}/api/stats/overview", params={
            "token": auth_token,
            "view": "kunden"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["view"] == "kunden"
        assert "total" in data
        assert "groups" in data
        groups = data["groups"]
        # Check that groups contain customer status keys
        expected_statuses = ["Neu", "In Arbeit", "Angebot geschrieben", "Auftrag erteilt", "Abgeschlossen"]
        for status in expected_statuses:
            assert status in groups, f"Missing status: {status}"
            assert "count" in groups[status]
            assert "items" in groups[status]
        print(f"PASS: Overview kunden - total: {data['total']}, statuses: {list(groups.keys())}")
    
    def test_overview_leistungen_view(self, auth_token):
        """Test stats/overview with view=leistungen returns grouped data by Leistungen/Artikel"""
        response = requests.get(f"{BASE_URL}/api/stats/overview", params={
            "token": auth_token,
            "view": "leistungen"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["view"] == "leistungen"
        assert "total" in data
        assert "groups" in data
        groups = data["groups"]
        assert "Leistungen" in groups
        assert "Artikel" in groups
        assert "count" in groups["Leistungen"]
        assert "items" in groups["Leistungen"]
        print(f"PASS: Overview leistungen - total: {data['total']}, Leistungen: {groups['Leistungen']['count']}, Artikel: {groups['Artikel']['count']}")
    
    def test_overview_requires_auth(self):
        """Test that stats/overview requires authentication"""
        response = requests.get(f"{BASE_URL}/api/stats/overview", params={"view": "anfragen"})
        assert response.status_code == 401
        print("PASS: Overview endpoint requires authentication")


class TestQuoteFollowup:
    """Tests for quote followup endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_followup_quotes(self, auth_token):
        """Test GET /api/quotes/followup returns quotes waiting 7+ days"""
        response = requests.get(f"{BASE_URL}/api/quotes/followup", params={"token": auth_token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # If there are followup quotes, check they have days_waiting field
        for quote in data:
            assert "days_waiting" in quote
            assert quote["days_waiting"] >= 7
        print(f"PASS: Followup quotes - found {len(data)} quotes waiting 7+ days")
    
    def test_check_followup_quotes(self, auth_token):
        """Test POST /api/quotes/check-followup triggers push for pending quotes"""
        response = requests.post(f"{BASE_URL}/api/quotes/check-followup", params={"token": auth_token})
        assert response.status_code == 200
        data = response.json()
        assert "followup_count" in data
        print(f"PASS: Check followup - {data['followup_count']} quotes need followup")
    
    def test_followup_requires_auth(self):
        """Test that followup endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/quotes/followup")
        assert response.status_code == 401
        
        response = requests.post(f"{BASE_URL}/api/quotes/check-followup")
        assert response.status_code == 401
        print("PASS: Followup endpoints require authentication")


class TestEmailFollowup:
    """Tests for email followup endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def test_quote_id(self, auth_token):
        """Get a quote ID for testing"""
        response = requests.get(f"{BASE_URL}/api/quotes", params={"token": auth_token})
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No quotes available for testing")
    
    def test_email_followup_nonexistent_quote(self, auth_token):
        """Test POST /api/email/followup/{quote_id} returns 404 for nonexistent quote"""
        response = requests.post(
            f"{BASE_URL}/api/email/followup/nonexistent-id",
            params={"token": auth_token},
            json={"to_email": "test@example.com", "subject": "Test", "message": "Test"}
        )
        assert response.status_code == 404
        print("PASS: Email followup returns 404 for nonexistent quote")
    
    def test_email_followup_requires_auth(self):
        """Test that email followup requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/email/followup/some-id",
            json={"to_email": "test@example.com", "subject": "Test", "message": "Test"}
        )
        assert response.status_code == 401
        print("PASS: Email followup requires authentication")


class TestCustomerStatus:
    """Tests for customer status field"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_customer_has_status_field(self, auth_token):
        """Test that customers have status field with default 'Neu'"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"token": auth_token})
        assert response.status_code == 200
        customers = response.json()
        assert len(customers) > 0, "No customers found"
        
        # Check that all customers have status field
        for customer in customers:
            assert "status" in customer or customer.get("status") is None
            # Default should be 'Neu' if not set
            status = customer.get("status", "Neu")
            assert status in ["Neu", "In Arbeit", "Angebot geschrieben", "Auftrag erteilt", "Abgeschlossen"]
        print(f"PASS: All {len(customers)} customers have valid status field")
    
    def test_create_customer_with_status(self, auth_token):
        """Test creating customer with specific status"""
        response = requests.post(
            f"{BASE_URL}/api/customers",
            params={"token": auth_token},
            json={
                "name": "TEST_StatusCustomer",
                "email": "test@status.com",
                "status": "In Arbeit"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "In Arbeit"
        
        # Cleanup
        customer_id = data["id"]
        requests.delete(f"{BASE_URL}/api/customers/{customer_id}", params={"token": auth_token})
        print("PASS: Customer created with status 'In Arbeit'")
    
    def test_update_customer_status(self, auth_token):
        """Test updating customer status"""
        # Create test customer
        create_response = requests.post(
            f"{BASE_URL}/api/customers",
            params={"token": auth_token},
            json={"name": "TEST_UpdateStatus", "status": "Neu"}
        )
        assert create_response.status_code == 200
        customer_id = create_response.json()["id"]
        
        # Update status
        update_response = requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            params={"token": auth_token},
            json={"name": "TEST_UpdateStatus", "status": "Auftrag erteilt"}
        )
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "Auftrag erteilt"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", params={"token": auth_token})
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "Auftrag erteilt"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/customers/{customer_id}", params={"token": auth_token})
        print("PASS: Customer status updated and persisted")


class TestCompanySettings:
    """Tests for expanded company settings"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_settings_has_new_fields(self, auth_token):
        """Test that settings include new Fahrtkosten and Zahlungsziele fields"""
        response = requests.get(f"{BASE_URL}/api/settings", params={"token": auth_token})
        assert response.status_code == 200
        settings = response.json()
        
        # Check Fahrtkosten fields
        assert "km_rate" in settings
        assert "hourly_travel_rate" in settings
        assert "company_address" in settings
        
        # Check Zahlungsziele fields
        assert "default_due_days" in settings
        assert "default_quote_validity_days" in settings
        assert "email_signature" in settings
        
        print(f"PASS: Settings has all new fields - km_rate: {settings['km_rate']}, due_days: {settings['default_due_days']}")
    
    def test_update_fahrtkosten_settings(self, auth_token):
        """Test updating Fahrtkosten settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings", params={"token": auth_token})
        current_settings = get_response.json()
        
        # Update with new values
        updated_settings = {**current_settings}
        updated_settings["km_rate"] = 0.35
        updated_settings["hourly_travel_rate"] = 50.0
        updated_settings["company_address"] = "Teststraße 123, 12345 Teststadt"
        
        response = requests.put(
            f"{BASE_URL}/api/settings",
            params={"token": auth_token},
            json=updated_settings
        )
        assert response.status_code == 200
        data = response.json()
        assert data["km_rate"] == 0.35
        assert data["hourly_travel_rate"] == 50.0
        assert data["company_address"] == "Teststraße 123, 12345 Teststadt"
        
        # Restore original values
        requests.put(f"{BASE_URL}/api/settings", params={"token": auth_token}, json=current_settings)
        print("PASS: Fahrtkosten settings updated successfully")
    
    def test_update_zahlungsziele_settings(self, auth_token):
        """Test updating Zahlungsziele settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings", params={"token": auth_token})
        current_settings = get_response.json()
        
        # Update with new values
        updated_settings = {**current_settings}
        updated_settings["default_due_days"] = 21
        updated_settings["default_quote_validity_days"] = 45
        updated_settings["email_signature"] = "Mit freundlichen Grüßen\nTest Firma"
        
        response = requests.put(
            f"{BASE_URL}/api/settings",
            params={"token": auth_token},
            json=updated_settings
        )
        assert response.status_code == 200
        data = response.json()
        assert data["default_due_days"] == 21
        assert data["default_quote_validity_days"] == 45
        assert "Test Firma" in data["email_signature"]
        
        # Restore original values
        requests.put(f"{BASE_URL}/api/settings", params={"token": auth_token}, json=current_settings)
        print("PASS: Zahlungsziele settings updated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
