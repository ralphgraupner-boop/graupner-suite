"""
Test suite for Graupner Suite after major refactoring.
Tests all route modules split from monolithic server.py.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication endpoint tests - routes/auth.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "username" in data, "Username not in response"
        assert data["username"] == "admin"
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestDashboard:
    """Dashboard endpoint tests - routes/dashboard.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        # Get auth token
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats returns statistics"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats", params={"token": self.token})
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        assert "customers_count" in data
        assert "quotes" in data
        assert "orders" in data
        assert "invoices" in data
        assert "anfragen" in data
        assert "monthly" in data
    
    def test_stats_overview_anfragen(self):
        """GET /api/stats/overview?view=anfragen"""
        response = self.session.get(f"{BASE_URL}/api/stats/overview", params={"token": self.token, "view": "anfragen"})
        assert response.status_code == 200
        data = response.json()
        assert data["view"] == "anfragen"
        assert "groups" in data
    
    def test_stats_overview_kunden(self):
        """GET /api/stats/overview?view=kunden"""
        response = self.session.get(f"{BASE_URL}/api/stats/overview", params={"token": self.token, "view": "kunden"})
        assert response.status_code == 200
        data = response.json()
        assert data["view"] == "kunden"
        assert "groups" in data
    
    def test_stats_overview_leistungen(self):
        """GET /api/stats/overview?view=leistungen"""
        response = self.session.get(f"{BASE_URL}/api/stats/overview", params={"token": self.token, "view": "leistungen"})
        assert response.status_code == 200
        data = response.json()
        assert data["view"] == "leistungen"


class TestCustomers:
    """Customer endpoint tests - routes/customers.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_customers(self):
        """GET /api/customers returns list"""
        response = self.session.get(f"{BASE_URL}/api/customers", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_and_get_customer(self):
        """POST /api/customers creates customer, GET verifies"""
        customer_data = {
            "name": "TEST_Refactor Customer",
            "email": "test@refactor.com",
            "phone": "0123456789",
            "address": "Test Street 1, Berlin",
            "customer_type": "Privat",
            "status": "Neu"
        }
        # Create
        response = self.session.post(f"{BASE_URL}/api/customers", json=customer_data, params={"token": self.token})
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        assert created["name"] == customer_data["name"]
        customer_id = created["id"]
        
        # Verify with GET
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}", params={"token": self.token})
        assert response.status_code == 200
        fetched = response.json()
        assert fetched["name"] == customer_data["name"]
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/customers/{customer_id}", params={"token": self.token})
    
    def test_customer_to_anfrage(self):
        """POST /api/customers/{id}/to-anfrage converts customer back to inquiry"""
        # Create a customer first
        customer_data = {"name": "TEST_ToAnfrage Customer", "email": "toanfrage@test.com"}
        resp = self.session.post(f"{BASE_URL}/api/customers", json=customer_data, params={"token": self.token})
        customer_id = resp.json()["id"]
        
        # Convert to anfrage
        response = self.session.post(f"{BASE_URL}/api/customers/{customer_id}/to-anfrage", params={"token": self.token})
        assert response.status_code == 200, f"To-anfrage failed: {response.text}"
        data = response.json()
        assert "anfrage_id" in data
        
        # Verify customer no longer exists
        response = self.session.get(f"{BASE_URL}/api/customers/{customer_id}", params={"token": self.token})
        assert response.status_code == 404


class TestAnfragen:
    """Anfragen (Inquiries) endpoint tests - routes/dashboard.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_anfragen(self):
        """GET /api/anfragen returns list"""
        response = self.session.get(f"{BASE_URL}/api/anfragen", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_anfragen_with_category_filter(self):
        """GET /api/anfragen?category=Schiebetür filters by category"""
        response = self.session.get(f"{BASE_URL}/api/anfragen", params={"token": self.token, "category": "Schiebetür"})
        assert response.status_code == 200


class TestQuotes:
    """Quote endpoint tests - routes/quotes.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_quotes(self):
        """GET /api/quotes returns list"""
        response = self.session.get(f"{BASE_URL}/api/quotes", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_quotes_followup_route_not_shadowed(self):
        """GET /api/quotes/followup - specific route must not be shadowed by /{id}"""
        response = self.session.get(f"{BASE_URL}/api/quotes/followup", params={"token": self.token})
        assert response.status_code == 200, f"Followup route shadowed! Got: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_quotes_check_followup(self):
        """POST /api/quotes/check-followup"""
        response = self.session.post(f"{BASE_URL}/api/quotes/check-followup", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert "followup_count" in data


class TestOrders:
    """Order endpoint tests - routes/orders.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_orders(self):
        """GET /api/orders returns list"""
        response = self.session.get(f"{BASE_URL}/api/orders", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestInvoices:
    """Invoice endpoint tests - routes/invoices.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_invoices(self):
        """GET /api/invoices returns list"""
        response = self.session.get(f"{BASE_URL}/api/invoices", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_invoices_overdue_route_not_shadowed(self):
        """GET /api/invoices/overdue - specific route must not be shadowed by /{id}"""
        response = self.session.get(f"{BASE_URL}/api/invoices/overdue", params={"token": self.token})
        assert response.status_code == 200, f"Overdue route shadowed! Got: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list)
    
    def test_invoices_due_soon(self):
        """GET /api/invoices/due-soon"""
        response = self.session.get(f"{BASE_URL}/api/invoices/due-soon", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestArticles:
    """Article endpoint tests - routes/articles.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_articles(self):
        """GET /api/articles returns list"""
        response = self.session.get(f"{BASE_URL}/api/articles", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_article_crud(self):
        """Full CRUD test for articles"""
        # Create
        article_data = {"name": "TEST_Refactor Article", "unit": "Stück", "price_net": 99.99}
        response = self.session.post(f"{BASE_URL}/api/articles", json=article_data, params={"token": self.token})
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        article_id = created["id"]
        assert created["name"] == article_data["name"]
        
        # Update
        updated_data = {"name": "TEST_Refactor Article Updated", "unit": "Stück", "price_net": 149.99}
        response = self.session.put(f"{BASE_URL}/api/articles/{article_id}", json=updated_data, params={"token": self.token})
        assert response.status_code == 200
        updated = response.json()
        assert updated["name"] == updated_data["name"]
        
        # Delete
        response = self.session.delete(f"{BASE_URL}/api/articles/{article_id}", params={"token": self.token})
        assert response.status_code == 200


class TestServices:
    """Service endpoint tests - routes/services.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_services(self):
        """GET /api/services returns list"""
        response = self.session.get(f"{BASE_URL}/api/services", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_service_crud(self):
        """Full CRUD test for services"""
        # Create
        service_data = {"name": "TEST_Refactor Service", "unit": "Stunde", "price_net": 75.00}
        response = self.session.post(f"{BASE_URL}/api/services", json=service_data, params={"token": self.token})
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        service_id = created["id"]
        assert created["name"] == service_data["name"]
        
        # Update
        updated_data = {"name": "TEST_Refactor Service Updated", "unit": "Stunde", "price_net": 85.00}
        response = self.session.put(f"{BASE_URL}/api/services/{service_id}", json=updated_data, params={"token": self.token})
        assert response.status_code == 200
        updated = response.json()
        assert updated["name"] == updated_data["name"]
        
        # Delete
        response = self.session.delete(f"{BASE_URL}/api/services/{service_id}", params={"token": self.token})
        assert response.status_code == 200


class TestSettings:
    """Settings endpoint tests - routes/settings.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_settings(self):
        """GET /api/settings returns company settings"""
        response = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
    
    def test_update_settings(self):
        """PUT /api/settings updates and persists"""
        # Get current settings
        response = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        current = response.json()
        
        # Update with test value
        test_company_name = "TEST_Refactor Company"
        current["company_name"] = test_company_name
        response = self.session.put(f"{BASE_URL}/api/settings", json=current, params={"token": self.token})
        assert response.status_code == 200
        
        # Verify persistence
        response = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        fetched = response.json()
        assert fetched["company_name"] == test_company_name


class TestEmailLog:
    """Email log endpoint tests - routes/email.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin", "password": "admin123"
        })
        self.token = resp.json().get("token", "")
    
    def test_get_email_log(self):
        """GET /api/email/log returns list"""
        response = self.session.get(f"{BASE_URL}/api/email/log", params={"token": self.token})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAPIRoot:
    """Root API endpoint test"""
    
    def test_api_root(self):
        """GET /api/ returns version info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert data["version"] == "2.0.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
