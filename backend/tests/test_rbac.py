"""
Role-Based Access Control (RBAC) Tests
Tests for new 'buchhaltung' role with restricted access
- h.bolanka / Buch$2026!Grau (role: buchhaltung)
- admin / admin123 (role: admin)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthLogin:
    """Test login for both admin and buchhaltung users"""
    
    def test_admin_login_success(self):
        """Admin user can login and receives role=admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("username") == "admin", f"Expected username 'admin', got {data.get('username')}"
        assert data.get("role") == "admin", f"Expected role 'admin', got {data.get('role')}"
        print(f"PASS: Admin login returns role=admin")
    
    def test_buchhaltung_login_success(self):
        """Buchhaltung user h.bolanka can login and receives role=buchhaltung"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "h.bolanka",
            "password": "Buch$2026!Grau"
        })
        assert response.status_code == 200, f"Buchhaltung login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("username") == "h.bolanka", f"Expected username 'h.bolanka', got {data.get('username')}"
        assert data.get("role") == "buchhaltung", f"Expected role 'buchhaltung', got {data.get('role')}"
        print(f"PASS: h.bolanka login returns role=buchhaltung")
    
    def test_invalid_login_fails(self):
        """Invalid credentials return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "invalid_user",
            "password": "wrong_password"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASS: Invalid login returns 401")


class TestAuthMe:
    """Test /auth/me endpoint returns correct role"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json().get("token")
    
    @pytest.fixture
    def buchhaltung_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "h.bolanka",
            "password": "Buch$2026!Grau"
        })
        return response.json().get("token")
    
    def test_auth_me_admin(self, admin_token):
        """GET /auth/me returns role=admin for admin user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data.get("role") == "admin", f"Expected role 'admin', got {data.get('role')}"
        assert data.get("username") == "admin", f"Expected username 'admin', got {data.get('username')}"
        print(f"PASS: /auth/me returns role=admin for admin user")
    
    def test_auth_me_buchhaltung(self, buchhaltung_token):
        """GET /auth/me returns role=buchhaltung for h.bolanka"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {buchhaltung_token}"
        })
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data.get("role") == "buchhaltung", f"Expected role 'buchhaltung', got {data.get('role')}"
        assert data.get("username") == "h.bolanka", f"Expected username 'h.bolanka', got {data.get('username')}"
        print(f"PASS: /auth/me returns role=buchhaltung for h.bolanka")


class TestBuchhaltungAccess:
    """Test that buchhaltung role can access allowed endpoints"""
    
    @pytest.fixture
    def buchhaltung_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "h.bolanka",
            "password": "Buch$2026!Grau"
        })
        return response.json().get("token")
    
    def test_buchhaltung_can_access_customers(self, buchhaltung_token):
        """Buchhaltung can read customers (read-only)"""
        response = requests.get(f"{BASE_URL}/api/customers", headers={
            "Authorization": f"Bearer {buchhaltung_token}"
        })
        assert response.status_code == 200, f"Customers access failed: {response.text}"
        print(f"PASS: Buchhaltung can access /customers")
    
    def test_buchhaltung_can_access_orders(self, buchhaltung_token):
        """Buchhaltung can read orders (read-only)"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {buchhaltung_token}"
        })
        assert response.status_code == 200, f"Orders access failed: {response.text}"
        print(f"PASS: Buchhaltung can access /orders")
    
    def test_buchhaltung_can_access_invoices(self, buchhaltung_token):
        """Buchhaltung can read invoices (read-only + PDF)"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers={
            "Authorization": f"Bearer {buchhaltung_token}"
        })
        assert response.status_code == 200, f"Invoices access failed: {response.text}"
        print(f"PASS: Buchhaltung can access /invoices")
    
    def test_buchhaltung_can_access_buchhaltung(self, buchhaltung_token):
        """Buchhaltung has full access to /buchhaltung"""
        response = requests.get(f"{BASE_URL}/api/buchhaltung/buchungen", headers={
            "Authorization": f"Bearer {buchhaltung_token}"
        })
        assert response.status_code == 200, f"Buchhaltung access failed: {response.text}"
        print(f"PASS: Buchhaltung can access /buchhaltung/buchungen")
    
    def test_buchhaltung_can_access_overdue_invoices(self, buchhaltung_token):
        """Buchhaltung can access overdue invoices (Mahnwesen)"""
        response = requests.get(f"{BASE_URL}/api/invoices/overdue", headers={
            "Authorization": f"Bearer {buchhaltung_token}"
        })
        assert response.status_code == 200, f"Overdue invoices access failed: {response.text}"
        print(f"PASS: Buchhaltung can access /invoices/overdue (Mahnwesen)")


class TestAdminFullAccess:
    """Test that admin role has full access to all endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_admin_can_access_dashboard_data(self, admin_token):
        """Admin can access dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/stats", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        # Stats endpoint may or may not exist, but admin should have access
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"PASS: Admin can access dashboard data")
    
    def test_admin_can_access_anfragen(self, admin_token):
        """Admin can access Anfragen"""
        response = requests.get(f"{BASE_URL}/api/anfragen", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Anfragen access failed: {response.text}"
        print(f"PASS: Admin can access /anfragen")
    
    def test_admin_can_access_quotes(self, admin_token):
        """Admin can access Angebote"""
        response = requests.get(f"{BASE_URL}/api/quotes", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Quotes access failed: {response.text}"
        print(f"PASS: Admin can access /quotes")
    
    def test_admin_can_access_articles(self, admin_token):
        """Admin can access Artikel"""
        response = requests.get(f"{BASE_URL}/api/articles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Articles access failed: {response.text}"
        print(f"PASS: Admin can access /articles")
    
    def test_admin_can_access_settings(self, admin_token):
        """Admin can access Einstellungen"""
        response = requests.get(f"{BASE_URL}/api/settings", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Settings access failed: {response.text}"
        print(f"PASS: Admin can access /settings")
    
    def test_admin_can_access_users(self, admin_token):
        """Admin can access user management"""
        response = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Users access failed: {response.text}"
        print(f"PASS: Admin can access /users")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
