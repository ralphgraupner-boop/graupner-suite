"""
Test suite for Graupner Suite Templates & Suggestions API
Testing:
- /api/documents/suggestions/{doc_type} - Get templates and similar documents
- /api/documents/{type}/{id}/template - Toggle is_template flag
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://code-import-flow-1.preview.emergentagent.com')


class TestDocumentSuggestions:
    """Tests for /api/documents/suggestions/{doc_type} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and existing customer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, "Login failed"
        self.token = response.json()["token"]
        
        # Get first customer for testing
        customers_response = requests.get(f"{BASE_URL}/api/customers", params={"token": self.token})
        customers = customers_response.json()
        self.customer_id = customers[0]["id"] if customers else None
        self.customer_name = customers[0]["name"] if customers else None
    
    def test_get_suggestions_for_quote(self):
        """Test getting templates and similar docs for quote type"""
        response = requests.get(
            f"{BASE_URL}/api/documents/suggestions/quote",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "templates" in data, "Response should have 'templates' key"
        assert "similar" in data, "Response should have 'similar' key"
        assert isinstance(data["templates"], list), "templates should be a list"
        assert isinstance(data["similar"], list), "similar should be a list"
        
        print(f"Found {len(data['templates'])} templates and {len(data['similar'])} similar docs for quotes")
    
    def test_get_suggestions_with_customer_id(self):
        """Test getting suggestions filtered by customer_id"""
        if not self.customer_id:
            pytest.skip("No customer available")
        
        response = requests.get(
            f"{BASE_URL}/api/documents/suggestions/quote",
            params={
                "token": self.token,
                "customer_id": self.customer_id
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data
        assert "similar" in data
        
        # Similar docs should be scored higher for matching customer
        print(f"With customer_id: {len(data['templates'])} templates, {len(data['similar'])} similar docs")
    
    def test_get_suggestions_with_current_positions(self):
        """Test getting suggestions with current position descriptions"""
        response = requests.get(
            f"{BASE_URL}/api/documents/suggestions/quote",
            params={
                "token": self.token,
                "current_positions": "Holzarbeiten,Türmontage"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data
        assert "similar" in data
        print(f"With positions filter: {len(data['templates'])} templates, {len(data['similar'])} similar docs")
    
    def test_get_suggestions_for_order(self):
        """Test getting templates and similar docs for order type"""
        response = requests.get(
            f"{BASE_URL}/api/documents/suggestions/order",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data
        assert "similar" in data
        print(f"Found {len(data['templates'])} templates and {len(data['similar'])} similar docs for orders")
    
    def test_get_suggestions_for_invoice(self):
        """Test getting templates and similar docs for invoice type"""
        response = requests.get(
            f"{BASE_URL}/api/documents/suggestions/invoice",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data
        assert "similar" in data
        print(f"Found {len(data['templates'])} templates and {len(data['similar'])} similar docs for invoices")


class TestToggleTemplate:
    """Tests for /api/documents/{type}/{id}/template endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, "Login failed"
        self.token = response.json()["token"]
    
    def test_toggle_quote_template(self):
        """Test toggling is_template flag on a quote"""
        # Get existing quotes
        quotes_response = requests.get(f"{BASE_URL}/api/quotes", params={"token": self.token})
        quotes = quotes_response.json()
        
        if not quotes:
            pytest.skip("No quotes available")
        
        quote_id = quotes[0]["id"]
        
        # Toggle template ON
        response = requests.put(
            f"{BASE_URL}/api/documents/quote/{quote_id}/template",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_template" in data
        first_state = data["is_template"]
        print(f"Quote {quote_id} is_template set to: {first_state}")
        
        # Toggle template OFF (toggle again)
        response2 = requests.put(
            f"{BASE_URL}/api/documents/quote/{quote_id}/template",
            params={"token": self.token}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["is_template"] != first_state, "Toggle should flip the value"
        print(f"Quote {quote_id} is_template toggled to: {data2['is_template']}")
    
    def test_toggle_order_template(self):
        """Test toggling is_template flag on an order"""
        orders_response = requests.get(f"{BASE_URL}/api/orders", params={"token": self.token})
        orders = orders_response.json()
        
        if not orders:
            pytest.skip("No orders available")
        
        order_id = orders[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/documents/order/{order_id}/template",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_template" in data
        print(f"Order {order_id} is_template: {data['is_template']}")
        
        # Toggle back
        requests.put(
            f"{BASE_URL}/api/documents/order/{order_id}/template",
            params={"token": self.token}
        )
    
    def test_toggle_invoice_template(self):
        """Test toggling is_template flag on an invoice"""
        invoices_response = requests.get(f"{BASE_URL}/api/invoices", params={"token": self.token})
        invoices = invoices_response.json()
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/documents/invoice/{invoice_id}/template",
            params={"token": self.token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_template" in data
        print(f"Invoice {invoice_id} is_template: {data['is_template']}")
        
        # Toggle back
        requests.put(
            f"{BASE_URL}/api/documents/invoice/{invoice_id}/template",
            params={"token": self.token}
        )
    
    def test_toggle_nonexistent_document(self):
        """Test toggling template on non-existent document returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/documents/quote/nonexistent-id-12345/template",
            params={"token": self.token}
        )
        assert response.status_code == 404
        print("Non-existent document properly returns 404")


class TestTemplateInSuggestions:
    """Test that templates appear in suggestions after being marked"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, "Login failed"
        self.token = response.json()["token"]
    
    def test_template_appears_in_suggestions(self):
        """Mark a quote as template and verify it appears in suggestions"""
        # Get existing quotes
        quotes_response = requests.get(f"{BASE_URL}/api/quotes", params={"token": self.token})
        quotes = quotes_response.json()
        
        if not quotes:
            pytest.skip("No quotes available")
        
        quote_id = quotes[0]["id"]
        
        # Mark as template
        toggle_response = requests.put(
            f"{BASE_URL}/api/documents/quote/{quote_id}/template",
            params={"token": self.token}
        )
        is_template = toggle_response.json()["is_template"]
        
        # Get suggestions
        suggestions_response = requests.get(
            f"{BASE_URL}/api/documents/suggestions/quote",
            params={"token": self.token}
        )
        suggestions = suggestions_response.json()
        
        if is_template:
            # Should be in templates list
            template_ids = [t["id"] for t in suggestions["templates"]]
            assert quote_id in template_ids, f"Quote {quote_id} should be in templates list"
            print(f"Quote {quote_id} correctly appears in templates")
        else:
            # Should NOT be in templates list
            template_ids = [t["id"] for t in suggestions["templates"]]
            assert quote_id not in template_ids, f"Quote {quote_id} should NOT be in templates list"
            print(f"Quote {quote_id} correctly NOT in templates")
        
        # Toggle back to original state
        requests.put(
            f"{BASE_URL}/api/documents/quote/{quote_id}/template",
            params={"token": self.token}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
