"""
Test suite for Graupner Suite WYSIWYG Document Editor
Testing Quotes, Orders, Invoices CRUD and related APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://graupner-editor.preview.emergentagent.com')

class TestAuth:
    """Authentication tests for admin user"""
    
    def test_login_success(self):
        """Test login with admin/admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["username"] == "admin"
        print(f"Login successful, token received: {data['token'][:20]}...")

    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("Invalid credentials properly rejected")


class TestCustomers:
    """Customer API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
    
    def test_list_customers(self):
        """Get list of customers"""
        response = requests.get(f"{BASE_URL}/api/customers", params={"token": self.token})
        assert response.status_code == 200
        customers = response.json()
        assert isinstance(customers, list)
        print(f"Found {len(customers)} customers")
        # Return customer list for other tests
        return customers
    
    def test_get_existing_customer(self):
        """Get specific customer - Hans Müller should exist"""
        customers = self.test_list_customers()
        if customers:
            customer_id = customers[0]["id"]
            response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", params={"token": self.token})
            assert response.status_code == 200
            customer = response.json()
            assert "name" in customer
            assert "id" in customer
            print(f"Successfully fetched customer: {customer['name']}")


class TestQuotes:
    """Quotes (Angebote) API tests - critical for WYSIWYG editor"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and existing customer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
        
        # Get first customer for creating quotes
        customers_response = requests.get(f"{BASE_URL}/api/customers", params={"token": self.token})
        customers = customers_response.json()
        self.customer_id = customers[0]["id"] if customers else None
    
    def test_list_quotes(self):
        """Get list of quotes"""
        response = requests.get(f"{BASE_URL}/api/quotes", params={"token": self.token})
        assert response.status_code == 200
        quotes = response.json()
        assert isinstance(quotes, list)
        print(f"Found {len(quotes)} quotes")
        return quotes
    
    def test_get_existing_quote(self):
        """Get existing quote A-2026-0001"""
        quotes = self.test_list_quotes()
        if quotes:
            quote_id = quotes[0]["id"]
            response = requests.get(f"{BASE_URL}/api/quotes/{quote_id}", params={"token": self.token})
            assert response.status_code == 200
            quote = response.json()
            assert "quote_number" in quote
            assert "customer_id" in quote
            assert "positions" in quote
            assert "customer_name" in quote
            print(f"Successfully fetched quote: {quote['quote_number']}")
            return quote
    
    def test_create_quote(self):
        """Create a new quote - tests WYSIWYG create functionality"""
        if not self.customer_id:
            pytest.skip("No customer available")
        
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"pos_nr": 1, "description": "TEST Holzarbeiten", "quantity": 5, "unit": "Stunden", "price_net": 65.0},
                {"pos_nr": 2, "description": "TEST Materialkosten", "quantity": 1, "unit": "Pauschal", "price_net": 150.0}
            ],
            "notes": "TEST Angebot vom WYSIWYG Editor Test",
            "vat_rate": 19.0,
            "valid_days": 30
        }
        
        response = requests.post(f"{BASE_URL}/api/quotes", params={"token": self.token}, json=payload)
        assert response.status_code == 200
        quote = response.json()
        assert "id" in quote
        assert "quote_number" in quote
        assert quote["quote_number"].startswith("A-")
        assert quote["customer_id"] == self.customer_id
        assert len(quote["positions"]) == 2
        # Verify totals calculated
        assert quote["subtotal_net"] == 475.0  # 5*65 + 150
        assert quote["vat_amount"] == 90.25  # 475 * 0.19
        assert quote["total_gross"] == 565.25
        print(f"Created quote: {quote['quote_number']}")
        
        # Store for cleanup
        self.created_quote_id = quote["id"]
        return quote
    
    def test_update_quote(self):
        """Update existing quote - tests WYSIWYG edit functionality"""
        quotes = self.test_list_quotes()
        if not quotes:
            pytest.skip("No quotes to update")
        
        quote_id = quotes[0]["id"]
        
        update_payload = {
            "positions": [
                {"pos_nr": 1, "description": "UPDATED Beschreibung", "quantity": 3, "unit": "Stück", "price_net": 100.0}
            ],
            "notes": "Updated via test",
            "vat_rate": 19.0,
            "status": "Entwurf"
        }
        
        response = requests.put(f"{BASE_URL}/api/quotes/{quote_id}", params={"token": self.token}, json=update_payload)
        assert response.status_code == 200
        updated = response.json()
        assert updated["subtotal_net"] == 300.0
        print(f"Updated quote {quote_id}")
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/quotes/{quote_id}", params={"token": self.token})
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["notes"] == "Updated via test"


class TestOrders:
    """Orders (Aufträge) API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
    
    def test_list_orders(self):
        """Get list of orders"""
        response = requests.get(f"{BASE_URL}/api/orders", params={"token": self.token})
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"Found {len(orders)} orders")
        return orders
    
    def test_get_order(self):
        """Get specific order if exists"""
        orders = self.test_list_orders()
        if orders:
            order_id = orders[0]["id"]
            response = requests.get(f"{BASE_URL}/api/orders/{order_id}", params={"token": self.token})
            assert response.status_code == 200
            order = response.json()
            assert "order_number" in order
            assert "positions" in order
            assert "customer_name" in order
            print(f"Successfully fetched order: {order['order_number']}")
            return order
    
    def test_update_order(self):
        """Update order - tests WYSIWYG edit for orders"""
        orders = self.test_list_orders()
        if not orders:
            pytest.skip("No orders to update")
        
        order_id = orders[0]["id"]
        
        update_payload = {
            "positions": [
                {"pos_nr": 1, "description": "ORDER UPDATE TEST", "quantity": 2, "unit": "Stunden", "price_net": 75.0}
            ],
            "notes": "Updated order via test",
            "vat_rate": 19.0,
            "status": "In Arbeit"
        }
        
        response = requests.put(f"{BASE_URL}/api/orders/{order_id}", params={"token": self.token}, json=update_payload)
        assert response.status_code == 200
        updated = response.json()
        assert updated["status"] == "In Arbeit"
        print(f"Updated order {order_id}")
    
    def test_create_order_from_quote(self):
        """Create order from existing quote"""
        # Get a quote first
        quotes_response = requests.get(f"{BASE_URL}/api/quotes", params={"token": self.token})
        quotes = quotes_response.json()
        
        if not quotes:
            pytest.skip("No quotes available")
        
        quote_id = quotes[0]["id"]
        
        response = requests.post(f"{BASE_URL}/api/orders/from-quote/{quote_id}", params={"token": self.token})
        assert response.status_code == 200
        order = response.json()
        assert "order_number" in order
        assert order["order_number"].startswith("AB-")
        print(f"Created order {order['order_number']} from quote {quote_id}")
        return order


class TestInvoices:
    """Invoices (Rechnungen) API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and existing customer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
        
        customers_response = requests.get(f"{BASE_URL}/api/customers", params={"token": self.token})
        customers = customers_response.json()
        self.customer_id = customers[0]["id"] if customers else None
    
    def test_list_invoices(self):
        """Get list of invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices", params={"token": self.token})
        assert response.status_code == 200
        invoices = response.json()
        assert isinstance(invoices, list)
        print(f"Found {len(invoices)} invoices")
        return invoices
    
    def test_create_invoice(self):
        """Create a new invoice - tests WYSIWYG create functionality"""
        if not self.customer_id:
            pytest.skip("No customer available")
        
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"pos_nr": 1, "description": "TEST Rechnungsposition", "quantity": 1, "unit": "Pauschal", "price_net": 500.0}
            ],
            "notes": "TEST Rechnung via WYSIWYG Editor Test",
            "vat_rate": 19.0,
            "due_days": 14,
            "deposit_amount": 100.0
        }
        
        response = requests.post(f"{BASE_URL}/api/invoices", params={"token": self.token}, json=payload)
        assert response.status_code == 200
        invoice = response.json()
        assert "id" in invoice
        assert "invoice_number" in invoice
        assert invoice["invoice_number"].startswith("R-")
        assert invoice["deposit_amount"] == 100.0
        assert invoice["final_amount"] == 495.0  # 595 - 100
        print(f"Created invoice: {invoice['invoice_number']}")
        return invoice
    
    def test_update_invoice(self):
        """Update invoice - tests WYSIWYG edit for invoices"""
        invoices = self.test_list_invoices()
        if not invoices:
            pytest.skip("No invoices to update")
        
        invoice_id = invoices[0]["id"]
        
        update_payload = {
            "positions": [
                {"pos_nr": 1, "description": "UPDATED Rechnung", "quantity": 1, "unit": "Pauschal", "price_net": 600.0}
            ],
            "notes": "Updated invoice via test",
            "vat_rate": 19.0,
            "deposit_amount": 50.0
        }
        
        response = requests.put(f"{BASE_URL}/api/invoices/{invoice_id}", params={"token": self.token}, json=update_payload)
        assert response.status_code == 200
        updated = response.json()
        assert updated["deposit_amount"] == 50.0
        print(f"Updated invoice {invoice_id}")
    
    def test_get_invoice(self):
        """Get specific invoice if exists"""
        invoices = self.test_list_invoices()
        if invoices:
            invoice_id = invoices[0]["id"]
            response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}", params={"token": self.token})
            assert response.status_code == 200
            invoice = response.json()
            assert "invoice_number" in invoice
            assert "positions" in invoice
            print(f"Successfully fetched invoice: {invoice['invoice_number']}")


class TestServices:
    """Services (Leistungen) API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
    
    def test_list_services(self):
        """Get list of services for WYSIWYG dropdown"""
        response = requests.get(f"{BASE_URL}/api/services", params={"token": self.token})
        assert response.status_code == 200
        services = response.json()
        assert isinstance(services, list)
        print(f"Found {len(services)} services")


class TestArticles:
    """Articles (Artikel) API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
    
    def test_list_articles(self):
        """Get list of articles for WYSIWYG dropdown"""
        response = requests.get(f"{BASE_URL}/api/articles", params={"token": self.token})
        assert response.status_code == 200
        articles = response.json()
        assert isinstance(articles, list)
        print(f"Found {len(articles)} articles")


class TestSettings:
    """Settings API tests - needed for WYSIWYG header"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
    
    def test_get_settings(self):
        """Get company settings - shown in WYSIWYG document header"""
        response = requests.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        assert response.status_code == 200
        settings = response.json()
        assert "company_name" in settings
        print(f"Company: {settings['company_name']}")


class TestPDFGeneration:
    """PDF generation tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        self.token = response.json()["token"]
    
    def test_quote_pdf(self):
        """Test PDF generation for quote"""
        quotes_response = requests.get(f"{BASE_URL}/api/quotes", params={"token": self.token})
        quotes = quotes_response.json()
        if not quotes:
            pytest.skip("No quotes for PDF test")
        
        quote_id = quotes[0]["id"]
        response = requests.get(f"{BASE_URL}/api/pdf/quote/{quote_id}", params={"token": self.token})
        assert response.status_code == 200
        assert response.headers['content-type'] == 'application/pdf'
        print("Quote PDF generated successfully")
    
    def test_order_pdf(self):
        """Test PDF generation for order"""
        orders_response = requests.get(f"{BASE_URL}/api/orders", params={"token": self.token})
        orders = orders_response.json()
        if not orders:
            pytest.skip("No orders for PDF test")
        
        order_id = orders[0]["id"]
        response = requests.get(f"{BASE_URL}/api/pdf/order/{order_id}", params={"token": self.token})
        assert response.status_code == 200
        assert response.headers['content-type'] == 'application/pdf'
        print("Order PDF generated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
