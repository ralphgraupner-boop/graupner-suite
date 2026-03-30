"""
Test suite for Anfragen (Inquiries) feature in Graupner Suite
Tests: GET /api/anfragen, POST /api/webhook/contact, POST /api/anfragen/{id}/convert, 
       DELETE /api/anfragen/{id}, GET /api/dashboard/stats (anfragen section)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin123"

# Categories constant
CATEGORIES = ["Schiebetür", "Fenster", "Innentür", "Eingangstür", "Sonstige Reparaturen"]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAnfragenCRUD:
    """Test Anfragen CRUD operations"""
    
    def test_list_anfragen_empty_or_existing(self, api_client, auth_token):
        """GET /api/anfragen - should return list (may be empty initially)"""
        response = api_client.get(f"{BASE_URL}/api/anfragen", params={"token": auth_token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/anfragen returned {len(data)} anfragen")
    
    def test_create_anfrage_via_webhook(self, api_client):
        """POST /api/webhook/contact - should create anfrage in anfragen collection"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Webhook_{unique_id}",
            "email": f"test_{unique_id}@example.com",
            "telefon": "+49 123 456789",
            "nachricht": "Test inquiry via webhook",
            "topics": ["Fenster", "Schiebetür"],
            "strasse": "Teststraße 123",
            "plz": "12345",
            "stadt": "Berlin"
        }
        response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "anfrage_id" in data
        assert data.get("message") == "Anfrage erfolgreich empfangen"
        print(f"✓ POST /api/webhook/contact created anfrage: {data['anfrage_id']}")
        return data["anfrage_id"]
    
    def test_webhook_saves_to_anfragen_not_customers(self, api_client, auth_token):
        """Verify webhook saves to anfragen collection, not customers"""
        unique_id = str(uuid.uuid4())[:8]
        test_name = f"TEST_NotCustomer_{unique_id}"
        
        # Create via webhook
        payload = {
            "name": test_name,
            "email": f"notcustomer_{unique_id}@example.com",
            "topics": ["Innentür"]
        }
        response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        assert response.status_code == 200
        anfrage_id = response.json()["anfrage_id"]
        
        # Verify it's in anfragen
        anfragen_response = api_client.get(f"{BASE_URL}/api/anfragen", params={"token": auth_token})
        anfragen = anfragen_response.json()
        found_in_anfragen = any(a.get("id") == anfrage_id for a in anfragen)
        assert found_in_anfragen, "Anfrage should be in anfragen collection"
        
        # Verify it's NOT in customers
        customers_response = api_client.get(f"{BASE_URL}/api/customers", params={"token": auth_token})
        customers = customers_response.json()
        found_in_customers = any(c.get("name") == test_name for c in customers)
        assert not found_in_customers, "Anfrage should NOT be in customers collection"
        
        print(f"✓ Webhook correctly saves to anfragen, not customers")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/anfragen/{anfrage_id}", params={"token": auth_token})
    
    def test_anfrage_categories_preserved(self, api_client, auth_token):
        """Verify categories are preserved when creating anfrage"""
        unique_id = str(uuid.uuid4())[:8]
        test_categories = ["Fenster", "Eingangstür"]
        
        payload = {
            "name": f"TEST_Categories_{unique_id}",
            "email": f"categories_{unique_id}@example.com",
            "topics": test_categories
        }
        response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        assert response.status_code == 200
        anfrage_id = response.json()["anfrage_id"]
        
        # Verify categories in anfragen list
        anfragen_response = api_client.get(f"{BASE_URL}/api/anfragen", params={"token": auth_token})
        anfragen = anfragen_response.json()
        anfrage = next((a for a in anfragen if a.get("id") == anfrage_id), None)
        assert anfrage is not None
        assert set(anfrage.get("categories", [])) == set(test_categories)
        
        print(f"✓ Categories preserved: {anfrage.get('categories')}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/anfragen/{anfrage_id}", params={"token": auth_token})
    
    def test_filter_anfragen_by_category(self, api_client, auth_token):
        """GET /api/anfragen?category=X - should filter by category"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create anfrage with specific category
        payload = {
            "name": f"TEST_Filter_{unique_id}",
            "topics": ["Sonstige Reparaturen"]
        }
        response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        anfrage_id = response.json()["anfrage_id"]
        
        # Filter by that category
        filtered_response = api_client.get(
            f"{BASE_URL}/api/anfragen", 
            params={"token": auth_token, "category": "Sonstige Reparaturen"}
        )
        assert filtered_response.status_code == 200
        filtered = filtered_response.json()
        
        # Should find our anfrage
        found = any(a.get("id") == anfrage_id for a in filtered)
        assert found, "Filtered results should include our anfrage"
        
        # All results should have the category
        for a in filtered:
            assert "Sonstige Reparaturen" in a.get("categories", [])
        
        print(f"✓ Category filter works: {len(filtered)} results for 'Sonstige Reparaturen'")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/anfragen/{anfrage_id}", params={"token": auth_token})
    
    def test_delete_anfrage(self, api_client, auth_token):
        """DELETE /api/anfragen/{id} - should delete anfrage"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create anfrage
        payload = {"name": f"TEST_Delete_{unique_id}"}
        response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        anfrage_id = response.json()["anfrage_id"]
        
        # Delete it
        delete_response = api_client.delete(
            f"{BASE_URL}/api/anfragen/{anfrage_id}", 
            params={"token": auth_token}
        )
        assert delete_response.status_code == 200
        assert delete_response.json().get("message") == "Anfrage gelöscht"
        
        # Verify it's gone
        anfragen_response = api_client.get(f"{BASE_URL}/api/anfragen", params={"token": auth_token})
        anfragen = anfragen_response.json()
        found = any(a.get("id") == anfrage_id for a in anfragen)
        assert not found, "Deleted anfrage should not be in list"
        
        print(f"✓ DELETE /api/anfragen/{anfrage_id} successful")
    
    def test_delete_nonexistent_anfrage(self, api_client, auth_token):
        """DELETE /api/anfragen/{id} - should return 404 for nonexistent"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(
            f"{BASE_URL}/api/anfragen/{fake_id}", 
            params={"token": auth_token}
        )
        assert response.status_code == 404
        print(f"✓ DELETE nonexistent anfrage returns 404")


class TestAnfrageConversion:
    """Test converting anfrage to customer"""
    
    def test_convert_anfrage_to_customer(self, api_client, auth_token):
        """POST /api/anfragen/{id}/convert - should create customer and delete anfrage"""
        unique_id = str(uuid.uuid4())[:8]
        test_name = f"TEST_Convert_{unique_id}"
        test_categories = ["Fenster", "Innentür"]
        
        # Create anfrage
        payload = {
            "name": test_name,
            "email": f"convert_{unique_id}@example.com",
            "telefon": "+49 111 222333",
            "topics": test_categories,
            "strasse": "Konvertstraße 1",
            "plz": "54321",
            "stadt": "München"
        }
        response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        anfrage_id = response.json()["anfrage_id"]
        
        # Convert to customer
        convert_response = api_client.post(
            f"{BASE_URL}/api/anfragen/{anfrage_id}/convert",
            params={"token": auth_token}
        )
        assert convert_response.status_code == 200
        data = convert_response.json()
        assert "customer_id" in data
        assert data.get("message") == "Anfrage in Kunde umgewandelt"
        customer_id = data["customer_id"]
        
        print(f"✓ Converted anfrage to customer: {customer_id}")
        
        # Verify anfrage is deleted
        anfragen_response = api_client.get(f"{BASE_URL}/api/anfragen", params={"token": auth_token})
        anfragen = anfragen_response.json()
        found_anfrage = any(a.get("id") == anfrage_id for a in anfragen)
        assert not found_anfrage, "Anfrage should be deleted after conversion"
        
        # Verify customer exists with correct data
        customers_response = api_client.get(f"{BASE_URL}/api/customers", params={"token": auth_token})
        customers = customers_response.json()
        customer = next((c for c in customers if c.get("id") == customer_id), None)
        assert customer is not None, "Customer should exist after conversion"
        assert customer.get("name") == test_name
        assert set(customer.get("categories", [])) == set(test_categories), "Categories should be preserved"
        
        print(f"✓ Customer created with preserved categories: {customer.get('categories')}")
        
        # Cleanup - delete the created customer
        api_client.delete(f"{BASE_URL}/api/customers/{customer_id}", params={"token": auth_token})
    
    def test_convert_nonexistent_anfrage(self, api_client, auth_token):
        """POST /api/anfragen/{id}/convert - should return 404 for nonexistent"""
        fake_id = str(uuid.uuid4())
        response = api_client.post(
            f"{BASE_URL}/api/anfragen/{fake_id}/convert",
            params={"token": auth_token}
        )
        assert response.status_code == 404
        print(f"✓ Convert nonexistent anfrage returns 404")


class TestDashboardAnfragenStats:
    """Test dashboard stats include anfragen section"""
    
    def test_dashboard_stats_includes_anfragen(self, api_client, auth_token):
        """GET /api/dashboard/stats - should include anfragen section"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        assert response.status_code == 200
        data = response.json()
        
        # Verify anfragen section exists
        assert "anfragen" in data, "Dashboard stats should include 'anfragen' section"
        anfragen_stats = data["anfragen"]
        
        # Verify structure
        assert "total" in anfragen_stats, "Anfragen stats should have 'total'"
        assert "by_category" in anfragen_stats, "Anfragen stats should have 'by_category'"
        assert "recent" in anfragen_stats, "Anfragen stats should have 'recent'"
        
        # Verify by_category has all categories
        by_category = anfragen_stats["by_category"]
        for cat in CATEGORIES:
            assert cat in by_category, f"by_category should include '{cat}'"
        
        print(f"✓ Dashboard stats includes anfragen: total={anfragen_stats['total']}")
        print(f"  by_category: {by_category}")
        print(f"  recent count: {len(anfragen_stats['recent'])}")
    
    def test_dashboard_stats_anfragen_count_updates(self, api_client, auth_token):
        """Verify anfragen count updates when adding/removing anfragen"""
        # Get initial count
        initial_response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        initial_count = initial_response.json()["anfragen"]["total"]
        
        # Create anfrage
        unique_id = str(uuid.uuid4())[:8]
        payload = {"name": f"TEST_DashCount_{unique_id}", "topics": ["Fenster"]}
        create_response = api_client.post(f"{BASE_URL}/api/webhook/contact", json=payload)
        anfrage_id = create_response.json()["anfrage_id"]
        
        # Check count increased
        after_create_response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        after_create_count = after_create_response.json()["anfragen"]["total"]
        assert after_create_count == initial_count + 1, "Count should increase after creating anfrage"
        
        # Delete anfrage
        api_client.delete(f"{BASE_URL}/api/anfragen/{anfrage_id}", params={"token": auth_token})
        
        # Check count decreased
        after_delete_response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        after_delete_count = after_delete_response.json()["anfragen"]["total"]
        assert after_delete_count == initial_count, "Count should return to initial after deleting"
        
        print(f"✓ Dashboard anfragen count updates correctly: {initial_count} → {after_create_count} → {after_delete_count}")


class TestKontaktFormHTML:
    """Test the public contact form HTML page"""
    
    def test_kontakt_page_loads(self, api_client):
        """GET /api/kontakt - should return HTML with categories"""
        response = api_client.get(f"{BASE_URL}/api/kontakt")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        
        html = response.text
        
        # Verify all 5 categories are present
        assert "Schiebetür" in html or "Schiebet&uuml;r" in html, "Should have Schiebetür category"
        assert "Fenster" in html, "Should have Fenster category"
        assert "Innentür" in html or "Innent&uuml;r" in html, "Should have Innentür category"
        assert "Eingangstür" in html or "Eingangst&uuml;r" in html, "Should have Eingangstür category"
        assert "Sonstige Reparaturen" in html, "Should have Sonstige Reparaturen category"
        
        # Verify form structure
        assert 'name="topic[]"' in html, "Should have topic[] checkboxes"
        assert 'type="checkbox"' in html, "Should have checkbox inputs"
        
        print(f"✓ GET /api/kontakt returns HTML with all 5 categories")


class TestCleanup:
    """Cleanup any remaining test data"""
    
    def test_cleanup_test_anfragen(self, api_client, auth_token):
        """Remove any TEST_ prefixed anfragen"""
        response = api_client.get(f"{BASE_URL}/api/anfragen", params={"token": auth_token})
        anfragen = response.json()
        
        deleted = 0
        for a in anfragen:
            if a.get("name", "").startswith("TEST_"):
                api_client.delete(f"{BASE_URL}/api/anfragen/{a['id']}", params={"token": auth_token})
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test anfragen")
    
    def test_cleanup_test_customers(self, api_client, auth_token):
        """Remove any TEST_ prefixed customers"""
        response = api_client.get(f"{BASE_URL}/api/customers", params={"token": auth_token})
        customers = response.json()
        
        deleted = 0
        for c in customers:
            if c.get("name", "").startswith("TEST_"):
                api_client.delete(f"{BASE_URL}/api/customers/{c['id']}", params={"token": auth_token})
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
