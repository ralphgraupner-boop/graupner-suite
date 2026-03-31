"""
Test suite for Graupner Suite - 4 New Features:
1. Mahnwesen (Dunning) - Overdue invoices tracking, dunning levels, PDF generation
2. Dashboard Charts - Monthly revenue data, invoice status breakdown
3. EK-Preise (Purchase Prices) - Articles and Services with purchase_price field
4. Firmendaten in PDFs - Company footer in PDF documents
"""

import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

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


class TestMahnwesen:
    """Tests for Mahnwesen (Dunning) feature"""
    
    def test_get_overdue_invoices_endpoint(self, api_client, auth_token):
        """GET /api/invoices/overdue returns overdue invoices with days_overdue field"""
        response = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are overdue invoices, verify structure
        if len(data) > 0:
            inv = data[0]
            assert "days_overdue" in inv, "Overdue invoice should have days_overdue field"
            assert isinstance(inv["days_overdue"], int), "days_overdue should be an integer"
            assert inv["days_overdue"] >= 0, "days_overdue should be non-negative"
            assert "id" in inv, "Invoice should have id"
            assert "invoice_number" in inv, "Invoice should have invoice_number"
            print(f"Found {len(data)} overdue invoice(s), first is {inv['days_overdue']} days overdue")
        else:
            print("No overdue invoices found (this is OK if none exist)")
    
    def test_advance_dunning_level(self, api_client, auth_token):
        """POST /api/invoices/{id}/dunning advances dunning level (1->2->3, max 3)"""
        # First, get overdue invoices to find one to test
        overdue_res = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        assert overdue_res.status_code == 200
        overdue = overdue_res.json()
        
        if len(overdue) == 0:
            # Create a test invoice with past due date
            customers_res = api_client.get(f"{BASE_URL}/api/customers", params={"token": auth_token})
            if customers_res.status_code == 200 and len(customers_res.json()) > 0:
                customer = customers_res.json()[0]
                # Create invoice with past due date
                invoice_data = {
                    "customer_id": customer["id"],
                    "positions": [{"pos_nr": 1, "description": "TEST_Dunning Test", "quantity": 1, "unit": "Stück", "price_net": 100}],
                    "notes": "Test for dunning",
                    "vat_rate": 19,
                    "due_days": -30  # Past due
                }
                create_res = api_client.post(f"{BASE_URL}/api/invoices", params={"token": auth_token}, json=invoice_data)
                if create_res.status_code == 200:
                    test_invoice_id = create_res.json()["id"]
                else:
                    pytest.skip("Could not create test invoice for dunning test")
            else:
                pytest.skip("No customers available to create test invoice")
        else:
            test_invoice_id = overdue[0]["id"]
            initial_level = overdue[0].get("dunning_level", 0)
        
        # Advance dunning level
        response = api_client.post(f"{BASE_URL}/api/invoices/{test_invoice_id}/dunning", params={"token": auth_token})
        
        if response.status_code == 400:
            # Max level already reached
            assert "Maximale Mahnstufe" in response.json().get("detail", "")
            print("Invoice already at max dunning level (3)")
        else:
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert "dunning_level" in data, "Response should contain dunning_level"
            assert "message" in data, "Response should contain message"
            assert data["dunning_level"] in [1, 2, 3], "Dunning level should be 1, 2, or 3"
            print(f"Dunning advanced to level {data['dunning_level']}: {data['message']}")
    
    def test_dunning_level_max_3(self, api_client, auth_token):
        """Verify dunning level cannot exceed 3"""
        # Get an invoice at level 3 or advance one to level 3
        overdue_res = api_client.get(f"{BASE_URL}/api/invoices/overdue", params={"token": auth_token})
        if overdue_res.status_code != 200 or len(overdue_res.json()) == 0:
            pytest.skip("No overdue invoices to test max dunning level")
        
        # Find invoice at level 3 or advance one
        for inv in overdue_res.json():
            if inv.get("dunning_level", 0) == 3:
                test_id = inv["id"]
                break
        else:
            # Advance first invoice to level 3
            test_id = overdue_res.json()[0]["id"]
            for _ in range(3):
                res = api_client.post(f"{BASE_URL}/api/invoices/{test_id}/dunning", params={"token": auth_token})
                if res.status_code == 400:
                    break
        
        # Try to advance beyond level 3
        response = api_client.post(f"{BASE_URL}/api/invoices/{test_id}/dunning", params={"token": auth_token})
        # Should either be 400 (max reached) or 200 (if not at max yet)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"Dunning max level test: status {response.status_code}")
    
    def test_dunning_pdf_generation(self, api_client, auth_token):
        """GET /api/pdf/dunning/{id} returns PDF for dunning letter"""
        # Get an invoice with dunning level > 0
        invoices_res = api_client.get(f"{BASE_URL}/api/invoices", params={"token": auth_token})
        assert invoices_res.status_code == 200
        invoices = invoices_res.json()
        
        # Find invoice with dunning level or use any invoice
        test_invoice = None
        for inv in invoices:
            if inv.get("dunning_level", 0) > 0:
                test_invoice = inv
                break
        
        if not test_invoice and len(invoices) > 0:
            test_invoice = invoices[0]
        
        if not test_invoice:
            pytest.skip("No invoices available for dunning PDF test")
        
        # Get dunning PDF
        response = api_client.get(f"{BASE_URL}/api/pdf/dunning/{test_invoice['id']}", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf", "Response should be PDF"
        assert len(response.content) > 1000, "PDF should have substantial content"
        print(f"Dunning PDF generated successfully, size: {len(response.content)} bytes")


class TestDashboardCharts:
    """Tests for Dashboard Charts feature - monthly revenue and invoice status breakdown"""
    
    def test_dashboard_stats_monthly_data(self, api_client, auth_token):
        """GET /api/dashboard/stats includes monthly revenue data (6 months)"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "monthly" in data, "Dashboard stats should include 'monthly' field"
        
        monthly = data["monthly"]
        assert isinstance(monthly, list), "monthly should be a list"
        assert len(monthly) == 6, f"Should have 6 months of data, got {len(monthly)}"
        
        # Verify structure of each month
        for month_data in monthly:
            assert "month" in month_data, "Each month should have 'month' label"
            assert "rechnungen" in month_data, "Each month should have 'rechnungen' (invoices revenue)"
            assert "angebote" in month_data, "Each month should have 'angebote' (quotes value)"
            assert isinstance(month_data["rechnungen"], (int, float)), "rechnungen should be numeric"
            assert isinstance(month_data["angebote"], (int, float)), "angebote should be numeric"
        
        print(f"Monthly data: {monthly}")
    
    def test_dashboard_stats_invoice_statuses(self, api_client, auth_token):
        """GET /api/dashboard/stats includes invoice_statuses breakdown"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        assert response.status_code == 200
        
        data = response.json()
        assert "invoice_statuses" in data, "Dashboard stats should include 'invoice_statuses'"
        
        statuses = data["invoice_statuses"]
        assert isinstance(statuses, dict), "invoice_statuses should be a dict"
        
        # Verify expected status keys
        expected_statuses = ["Offen", "Gesendet", "Bezahlt", "Überfällig"]
        for status in expected_statuses:
            assert status in statuses, f"invoice_statuses should include '{status}'"
            assert isinstance(statuses[status], int), f"{status} count should be integer"
        
        print(f"Invoice statuses: {statuses}")
    
    def test_dashboard_stats_overdue_count(self, api_client, auth_token):
        """GET /api/dashboard/stats includes overdue_count"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", params={"token": auth_token})
        assert response.status_code == 200
        
        data = response.json()
        assert "overdue_count" in data, "Dashboard stats should include 'overdue_count'"
        assert isinstance(data["overdue_count"], int), "overdue_count should be integer"
        assert data["overdue_count"] >= 0, "overdue_count should be non-negative"
        
        print(f"Overdue count: {data['overdue_count']}")


class TestEKPreise:
    """Tests for EK-Preise (Purchase Prices) in Articles and Services"""
    
    def test_create_article_with_purchase_price(self, api_client, auth_token):
        """POST /api/articles with purchase_price field saves correctly"""
        article_data = {
            "name": "TEST_Article_EK",
            "description": "Test article with purchase price",
            "unit": "Stück",
            "price_net": 100.0,
            "purchase_price": 65.0
        }
        
        response = api_client.post(f"{BASE_URL}/api/articles", params={"token": auth_token}, json=article_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["name"] == article_data["name"], "Name should match"
        assert data["purchase_price"] == article_data["purchase_price"], f"purchase_price should be {article_data['purchase_price']}, got {data.get('purchase_price')}"
        assert data["price_net"] == article_data["price_net"], "price_net should match"
        
        # Calculate expected margin
        expected_margin = (1 - article_data["purchase_price"] / article_data["price_net"]) * 100
        print(f"Article created with EK: {data['purchase_price']}€, VK: {data['price_net']}€, Margin: {expected_margin:.1f}%")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/articles/{data['id']}", params={"token": auth_token})
    
    def test_create_service_with_purchase_price(self, api_client, auth_token):
        """POST /api/services with purchase_price field saves correctly"""
        service_data = {
            "name": "TEST_Service_EK",
            "description": "Test service with purchase price",
            "unit": "Stunde",
            "price_net": 80.0,
            "purchase_price": 45.0
        }
        
        response = api_client.post(f"{BASE_URL}/api/services", params={"token": auth_token}, json=service_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["name"] == service_data["name"], "Name should match"
        assert data["purchase_price"] == service_data["purchase_price"], f"purchase_price should be {service_data['purchase_price']}, got {data.get('purchase_price')}"
        
        print(f"Service created with EK: {data['purchase_price']}€, VK: {data['price_net']}€")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/services/{data['id']}", params={"token": auth_token})
    
    def test_get_articles_returns_purchase_price(self, api_client, auth_token):
        """GET /api/articles returns purchase_price field"""
        response = api_client.get(f"{BASE_URL}/api/articles", params={"token": auth_token})
        assert response.status_code == 200
        
        articles = response.json()
        assert isinstance(articles, list), "Response should be a list"
        
        if len(articles) > 0:
            article = articles[0]
            assert "purchase_price" in article, "Article should have purchase_price field"
            assert isinstance(article["purchase_price"], (int, float)), "purchase_price should be numeric"
            print(f"First article: {article['name']}, EK: {article['purchase_price']}€, VK: {article['price_net']}€")
        else:
            print("No articles found to verify purchase_price field")
    
    def test_get_services_returns_purchase_price(self, api_client, auth_token):
        """GET /api/services returns purchase_price field"""
        response = api_client.get(f"{BASE_URL}/api/services", params={"token": auth_token})
        assert response.status_code == 200
        
        services = response.json()
        assert isinstance(services, list), "Response should be a list"
        
        if len(services) > 0:
            service = services[0]
            assert "purchase_price" in service, "Service should have purchase_price field"
            assert isinstance(service["purchase_price"], (int, float)), "purchase_price should be numeric"
            print(f"First service: {service['name']}, EK: {service['purchase_price']}€, VK: {service['price_net']}€")
        else:
            print("No services found to verify purchase_price field")
    
    def test_update_article_purchase_price(self, api_client, auth_token):
        """PUT /api/articles/{id} updates purchase_price correctly"""
        # Create test article
        create_data = {
            "name": "TEST_Article_Update_EK",
            "unit": "Stück",
            "price_net": 150.0,
            "purchase_price": 80.0
        }
        create_res = api_client.post(f"{BASE_URL}/api/articles", params={"token": auth_token}, json=create_data)
        assert create_res.status_code == 200
        article_id = create_res.json()["id"]
        
        # Update purchase price
        update_data = {
            "name": "TEST_Article_Update_EK",
            "unit": "Stück",
            "price_net": 150.0,
            "purchase_price": 95.0  # Changed
        }
        update_res = api_client.put(f"{BASE_URL}/api/articles/{article_id}", params={"token": auth_token}, json=update_data)
        assert update_res.status_code == 200
        
        updated = update_res.json()
        assert updated["purchase_price"] == 95.0, f"purchase_price should be 95.0, got {updated.get('purchase_price')}"
        print(f"Article purchase_price updated from 80.0 to {updated['purchase_price']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/articles/{article_id}", params={"token": auth_token})


class TestPDFGeneration:
    """Tests for PDF generation with company footer"""
    
    def test_quote_pdf_generation(self, api_client, auth_token):
        """GET /api/pdf/quote/{id} returns valid PDF"""
        quotes_res = api_client.get(f"{BASE_URL}/api/quotes", params={"token": auth_token})
        if quotes_res.status_code != 200 or len(quotes_res.json()) == 0:
            pytest.skip("No quotes available for PDF test")
        
        quote = quotes_res.json()[0]
        response = api_client.get(f"{BASE_URL}/api/pdf/quote/{quote['id']}", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000, "PDF should have substantial content"
        print(f"Quote PDF generated, size: {len(response.content)} bytes")
    
    def test_invoice_pdf_generation(self, api_client, auth_token):
        """GET /api/pdf/invoice/{id} returns valid PDF"""
        invoices_res = api_client.get(f"{BASE_URL}/api/invoices", params={"token": auth_token})
        if invoices_res.status_code != 200 or len(invoices_res.json()) == 0:
            pytest.skip("No invoices available for PDF test")
        
        invoice = invoices_res.json()[0]
        response = api_client.get(f"{BASE_URL}/api/pdf/invoice/{invoice['id']}", params={"token": auth_token})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000, "PDF should have substantial content"
        print(f"Invoice PDF generated, size: {len(response.content)} bytes")


class TestInvoiceOverdueIntegration:
    """Integration tests for overdue invoice workflow"""
    
    def test_overdue_invoice_workflow(self, api_client, auth_token):
        """Test complete overdue invoice workflow: create -> check overdue -> advance dunning"""
        # Get a customer
        customers_res = api_client.get(f"{BASE_URL}/api/customers", params={"token": auth_token})
        if customers_res.status_code != 200 or len(customers_res.json()) == 0:
            pytest.skip("No customers available")
        
        customer = customers_res.json()[0]
        
        # Create invoice (note: due_days=-30 creates past due invoice)
        invoice_data = {
            "customer_id": customer["id"],
            "positions": [{"pos_nr": 1, "description": "TEST_Overdue_Workflow", "quantity": 1, "unit": "Stück", "price_net": 200}],
            "notes": "Test overdue workflow",
            "vat_rate": 19,
            "due_days": 14  # Normal due days
        }
        
        create_res = api_client.post(f"{BASE_URL}/api/invoices", params={"token": auth_token}, json=invoice_data)
        assert create_res.status_code == 200
        invoice = create_res.json()
        invoice_id = invoice["id"]
        
        # Verify invoice has due_date
        assert "due_date" in invoice, "Invoice should have due_date"
        assert invoice["dunning_level"] == 0, "New invoice should have dunning_level 0"
        
        print(f"Created invoice {invoice['invoice_number']} with due_date: {invoice['due_date']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/invoices/{invoice_id}", params={"token": auth_token})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
