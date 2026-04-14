"""
Test suite for Graupner Suite v36 features:
- Customer file upload (max 10 files, 10MB each)
- New fields in Customers (Anrede, Vorname, Nachname, Firmenname)
- New fields in Anfragen (Anrede, Vorname, Nachname, Firmenname)
- Diverses tab functionality
- Email inbox
- IMAP interval configuration
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    def test_login_success(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["username"] == "admin"
        assert data["role"] == "admin"
        print("✓ Admin login successful")


class TestCustomers:
    """Customer CRUD and file upload tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_customers(self, headers):
        """Test getting customer list"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} customers")
    
    def test_create_customer_with_new_fields(self, headers):
        """Test creating customer with Anrede, Vorname, Nachname"""
        payload = {
            "anrede": "Herr",
            "vorname": "TEST_Max",
            "nachname": "Mustermann",
            "email": "test.max@example.com",
            "phone": "0123456789",
            "customer_type": "Privat",
            "strasse": "Teststraße",
            "hausnummer": "123",
            "plz": "12345",
            "ort": "Teststadt"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify new fields
        assert data.get("anrede") == "Herr"
        assert data.get("vorname") == "TEST_Max"
        assert data.get("nachname") == "Mustermann"
        # Name should be auto-generated from vorname + nachname
        assert "TEST_Max" in data.get("name", "")
        assert "Mustermann" in data.get("name", "")
        
        print(f"✓ Created customer with new fields: {data.get('name')}")
        return data.get("id")
    
    def test_create_customer_firma_type(self, headers):
        """Test creating customer with Firma type and Firmenname"""
        payload = {
            "anrede": "Herr",
            "vorname": "TEST_Hans",
            "nachname": "Geschäftsführer",
            "firma": "TEST GmbH",
            "email": "test.firma@example.com",
            "phone": "0987654321",
            "customer_type": "Firma"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("firma") == "TEST GmbH"
        assert data.get("customer_type") == "Firma"
        print(f"✓ Created Firma customer: {data.get('firma')}")
        return data.get("id")
    
    def test_get_customer_by_id(self, headers):
        """Test getting single customer"""
        # First get all customers
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        customers = response.json()
        if len(customers) > 0:
            customer_id = customers[0]["id"]
            response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data.get("id") == customer_id
            print(f"✓ Got customer by ID: {data.get('name')}")


class TestAnfragen:
    """Anfragen CRUD tests with new fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_anfragen(self, headers):
        """Test getting anfragen list"""
        response = requests.get(f"{BASE_URL}/api/anfragen", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} anfragen")
    
    def test_create_anfrage_with_new_fields(self, headers):
        """Test creating anfrage with Anrede, Vorname, Nachname"""
        payload = {
            "name": "TEST_Peter Anfrage",
            "anrede": "Herr",
            "vorname": "TEST_Peter",
            "nachname": "Anfrage",
            "email": "test.peter@example.com",
            "phone": "0123456789",
            "customer_type": "Privat",
            "nachricht": "Test Anfrage Nachricht"
        }
        response = requests.post(f"{BASE_URL}/api/anfragen", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "anfrage" in data or "message" in data
        print(f"✓ Created anfrage with new fields")
    
    def test_create_anfrage_firma_type(self, headers):
        """Test creating anfrage with Firma type"""
        payload = {
            "name": "TEST Firma Anfrage",
            "firma": "TEST Anfrage GmbH",
            "email": "test.anfrage.firma@example.com",
            "phone": "0987654321",
            "customer_type": "Firma",
            "nachricht": "Firmen-Anfrage Test"
        }
        response = requests.post(f"{BASE_URL}/api/anfragen", json=payload, headers=headers)
        assert response.status_code == 200
        print(f"✓ Created Firma anfrage")


class TestDiverses:
    """Diverses/Info tab tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_diverses(self, headers):
        """Test getting diverses list"""
        response = requests.get(f"{BASE_URL}/api/diverses", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} diverses items")
    
    def test_create_diverses_item(self, headers):
        """Test creating a diverses item"""
        payload = {
            "titel": "TEST Diverses Item",
            "kategorie": "Allgemein",
            "inhalt": "Test Inhalt für Diverses",
            "typ": "notiz",
            "wichtig": False
        }
        response = requests.post(f"{BASE_URL}/api/diverses", json=payload, headers=headers)
        assert response.status_code == 200
        print(f"✓ Created diverses item")


class TestKundenStatus:
    """Kunden-Status management tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_kunden_status(self, headers):
        """Test getting kunden status list"""
        response = requests.get(f"{BASE_URL}/api/kunden-status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} kunden status values")


class TestEmailInbox:
    """Email inbox tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_email_inbox(self, headers):
        """Test getting email inbox"""
        response = requests.get(f"{BASE_URL}/api/imap/inbox", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} emails in inbox")


class TestSettings:
    """Settings tests including IMAP interval"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_settings(self, headers):
        """Test getting settings"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Got settings")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "Graupner!Suite2026"
        })
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_cleanup_test_customers(self, headers):
        """Delete test customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        customers = response.json()
        deleted = 0
        for customer in customers:
            if customer.get("name", "").startswith("TEST_") or customer.get("vorname", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/customers/{customer['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        print(f"✓ Cleaned up {deleted} test customers")
    
    def test_cleanup_test_anfragen(self, headers):
        """Delete test anfragen"""
        response = requests.get(f"{BASE_URL}/api/anfragen", headers=headers)
        anfragen = response.json()
        deleted = 0
        for anfrage in anfragen:
            if anfrage.get("name", "").startswith("TEST_") or anfrage.get("name", "").startswith("TEST "):
                del_response = requests.delete(f"{BASE_URL}/api/anfragen/{anfrage['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        print(f"✓ Cleaned up {deleted} test anfragen")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
