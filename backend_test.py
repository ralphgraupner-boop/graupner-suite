import requests
import sys
from datetime import datetime
import json

class GraupnerSuiteAPITester:
    def __init__(self, base_url="https://graupner-staff.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.customer_id = None
        self.article_id = None  
        self.quote_id = None
        self.order_id = None
        self.invoice_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            url += f"?token={self.token}" if '?' not in url else f"&token={self.token}"

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error text: {response.text[:200]}")

            return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test("Root API", "GET", "/", 200)
        return success

    def test_login(self):
        """Test login with admin credentials"""
        success, response = self.run_test(
            "Login",
            "POST", 
            "/auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token received: {self.token[:20]}...")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test("Dashboard Stats", "GET", "/dashboard/stats", 200)
        if success:
            print(f"   Customers: {response.get('customers_count', 0)}")
            print(f"   Quotes: {response.get('quotes', {}).get('total', 0)}")
            print(f"   Orders: {response.get('orders', {}).get('total', 0)}")
            print(f"   Invoices: {response.get('invoices', {}).get('total', 0)}")
        return success

    def test_customer_crud(self):
        """Test customer CRUD operations"""
        # Create customer
        customer_data = {
            "name": "Test Kunde für Testing",
            "email": "test@example.com",
            "phone": "+49 123 456789",
            "address": "Teststraße 123\n12345 Teststadt",
            "notes": "Test customer for automated testing"
        }
        
        success, response = self.run_test(
            "Create Customer",
            "POST",
            "/customers",
            200,
            data=customer_data
        )
        
        if not success:
            return False
            
        self.customer_id = response.get('id')
        print(f"   Created customer ID: {self.customer_id}")

        # Get all customers
        success, _ = self.run_test("Get All Customers", "GET", "/customers", 200)
        if not success:
            return False

        # Get specific customer
        success, response = self.run_test(
            "Get Customer",
            "GET",
            f"/customers/{self.customer_id}",
            200
        )
        if not success:
            return False

        # Update customer
        updated_data = {
            "name": "Updated Test Kunde",
            "email": "updated@example.com",
            "phone": "+49 987 654321",
            "address": "Updated Teststraße 456\n54321 Updated Stadt",
            "notes": "Updated test customer"
        }
        
        success, _ = self.run_test(
            "Update Customer",
            "PUT",
            f"/customers/{self.customer_id}",
            200,
            data=updated_data
        )
        
        return success

    def test_article_crud(self):
        """Test article CRUD operations"""
        # Create article
        article_data = {
            "name": "Test Schrank",
            "description": "Test Schrank für automatische Tests",
            "unit": "Stück",
            "price_net": 299.99
        }
        
        success, response = self.run_test(
            "Create Article",
            "POST",
            "/articles",
            200,
            data=article_data
        )
        
        if not success:
            return False
            
        self.article_id = response.get('id')
        print(f"   Created article ID: {self.article_id}")

        # Get all articles
        success, _ = self.run_test("Get All Articles", "GET", "/articles", 200)
        if not success:
            return False

        # Update article
        updated_data = {
            "name": "Updated Test Schrank",
            "description": "Updated description",
            "unit": "Stück",
            "price_net": 399.99
        }
        
        success, _ = self.run_test(
            "Update Article",
            "PUT",
            f"/articles/{self.article_id}",
            200,
            data=updated_data
        )
        
        return success

    def test_quote_operations(self):
        """Test quote creation and operations"""
        if not self.customer_id:
            print("❌ No customer ID available for quote test")
            return False

        # Create quote
        quote_data = {
            "customer_id": self.customer_id,
            "positions": [
                {
                    "pos_nr": 1,
                    "description": "Test Schrank aus Eiche",
                    "quantity": 1,
                    "unit": "Stück", 
                    "price_net": 500.00
                },
                {
                    "pos_nr": 2,
                    "description": "Montage",
                    "quantity": 2,
                    "unit": "Stunden",
                    "price_net": 50.00
                }
            ],
            "notes": "Test quote für automated testing",
            "vat_rate": 19.0,
            "valid_days": 30
        }
        
        success, response = self.run_test(
            "Create Quote",
            "POST",
            "/quotes",
            200,
            data=quote_data
        )
        
        if not success:
            return False
            
        self.quote_id = response.get('id')
        quote_number = response.get('quote_number')
        print(f"   Created quote ID: {self.quote_id}")
        print(f"   Quote number: {quote_number}")
        print(f"   Total: {response.get('total_gross', 0)} €")

        # Get all quotes
        success, _ = self.run_test("Get All Quotes", "GET", "/quotes", 200)
        if not success:
            return False

        # Get specific quote
        success, _ = self.run_test(
            "Get Quote",
            "GET",
            f"/quotes/{self.quote_id}",
            200
        )
        if not success:
            return False

        # Test PDF download 
        success, _ = self.run_test(
            "Get Quote PDF",
            "GET",
            f"/pdf/quote/{self.quote_id}",
            200
        )
        
        return success

    def test_order_operations(self):
        """Test order creation from quote"""
        if not self.quote_id:
            print("❌ No quote ID available for order test")
            return False

        # Create order from quote
        success, response = self.run_test(
            "Create Order from Quote",
            "POST",
            f"/orders/from-quote/{self.quote_id}",
            200
        )
        
        if not success:
            return False
            
        self.order_id = response.get('id')
        order_number = response.get('order_number')
        print(f"   Created order ID: {self.order_id}")
        print(f"   Order number: {order_number}")

        # Get all orders
        success, _ = self.run_test("Get All Orders", "GET", "/orders", 200)
        if not success:
            return False

        # Get specific order
        success, _ = self.run_test(
            "Get Order",
            "GET",
            f"/orders/{self.order_id}",
            200
        )
        if not success:
            return False

        # Test PDF download
        success, _ = self.run_test(
            "Get Order PDF",
            "GET",
            f"/pdf/order/{self.order_id}",
            200
        )
        
        return success

    def test_invoice_operations(self):
        """Test invoice creation and operations"""
        if not self.order_id:
            print("❌ No order ID available for invoice test")
            return False

        # Create invoice from order
        success, response = self.run_test(
            "Create Invoice from Order", 
            "POST",
            f"/invoices/from-order/{self.order_id}",
            200,
            data={"due_days": 14}
        )
        
        if not success:
            return False
            
        self.invoice_id = response.get('id')
        invoice_number = response.get('invoice_number')
        print(f"   Created invoice ID: {self.invoice_id}")
        print(f"   Invoice number: {invoice_number}")

        # Get all invoices
        success, _ = self.run_test("Get All Invoices", "GET", "/invoices", 200)
        if not success:
            return False

        # Get specific invoice
        success, _ = self.run_test(
            "Get Invoice",
            "GET",
            f"/invoices/{self.invoice_id}",
            200
        )
        if not success:
            return False

        # Mark invoice as paid
        success, _ = self.run_test(
            "Mark Invoice as Paid",
            "PUT",
            f"/invoices/{self.invoice_id}/status",
            200,
            data={"status": "Bezahlt"}
        )
        if not success:
            return False

        # Test PDF download
        success, _ = self.run_test(
            "Get Invoice PDF",
            "GET",
            f"/pdf/invoice/{self.invoice_id}",
            200
        )
        
        return success

    def test_settings(self):
        """Test settings operations"""
        # Get settings
        success, response = self.run_test("Get Settings", "GET", "/settings", 200)
        if not success:
            return False

        # Update settings
        settings_data = {
            "id": "company_settings",
            "company_name": "Test Tischlerei Graupner",
            "owner_name": "Max Test Graupner",
            "address": "Test Werkstattstraße 1\n12345 Test München",
            "phone": "+49 89 123456789",
            "email": "test@tischlerei-graupner.de",
            "tax_id": "123/456/78901",
            "bank_name": "Test Sparkasse",
            "iban": "DE89370400440532013000",
            "bic": "COBADEFFXXX",
            "default_vat_rate": 19.0,
            "is_small_business": False,
            "logo_base64": ""
        }
        
        success, _ = self.run_test(
            "Update Settings",
            "PUT",
            "/settings",
            200,
            data=settings_data
        )
        
        return success

    def cleanup_test_data(self):
        """Clean up test data created during testing"""
        print(f"\n🧹 Cleaning up test data...")
        
        # Delete test invoice
        if self.invoice_id:
            success, _ = self.run_test(
                "Delete Test Invoice",
                "DELETE", 
                f"/invoices/{self.invoice_id}",
                200
            )

        # Delete test order
        if self.order_id:
            success, _ = self.run_test(
                "Delete Test Order",
                "DELETE",
                f"/orders/{self.order_id}",
                200
            )

        # Delete test quote
        if self.quote_id:
            success, _ = self.run_test(
                "Delete Test Quote",
                "DELETE",
                f"/quotes/{self.quote_id}",
                200
            )

        # Delete test article
        if self.article_id:
            success, _ = self.run_test(
                "Delete Test Article",
                "DELETE",
                f"/articles/{self.article_id}",
                200
            )

        # Delete test customer
        if self.customer_id:
            success, _ = self.run_test(
                "Delete Test Customer",
                "DELETE",
                f"/customers/{self.customer_id}",
                200
            )

def main():
    print("🚀 Starting Graupner Suite API Testing")
    print("=" * 50)
    
    tester = GraupnerSuiteAPITester()

    # Test sequence
    test_results = []

    # Basic connectivity
    print(f"\n📡 Testing API Connectivity")
    test_results.append(("Root API", tester.test_root_endpoint()))
    
    # Authentication
    print(f"\n🔐 Testing Authentication")
    test_results.append(("Login", tester.test_login()))
    
    if not tester.token:
        print("❌ Authentication failed - stopping tests")
        return 1

    # Dashboard
    print(f"\n📊 Testing Dashboard")
    test_results.append(("Dashboard Stats", tester.test_dashboard_stats()))

    # CRUD Operations
    print(f"\n👥 Testing Customer Operations")  
    test_results.append(("Customer CRUD", tester.test_customer_crud()))

    print(f"\n📦 Testing Article Operations")
    test_results.append(("Article CRUD", tester.test_article_crud()))

    print(f"\n📄 Testing Quote Operations")
    test_results.append(("Quote Operations", tester.test_quote_operations()))

    print(f"\n📋 Testing Order Operations")
    test_results.append(("Order Operations", tester.test_order_operations()))

    print(f"\n🧾 Testing Invoice Operations")
    test_results.append(("Invoice Operations", tester.test_invoice_operations()))

    print(f"\n⚙️ Testing Settings")
    test_results.append(("Settings", tester.test_settings()))

    # Cleanup
    tester.cleanup_test_data()

    # Final Results
    print(f"\n" + "=" * 50)
    print(f"📊 FINAL TEST RESULTS")
    print(f"=" * 50)
    print(f"Total tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    print(f"\n📋 Test Summary:")
    for test_name, passed in test_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {test_name}")

    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())