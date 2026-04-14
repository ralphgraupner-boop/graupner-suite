#!/usr/bin/env python3
"""
Comprehensive Backend API Test for Graupner Suite
Tests all major API endpoints with proper authentication
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://handwerk-deploy.preview.emergentagent.com/api"

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Graupner!Suite2026"

class GraupnerAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.session = requests.Session()
        self.results = {
            "passed": [],
            "failed": [],
            "errors": []
        }
    
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        if success:
            self.results["passed"].append(f"✅ {test_name}")
            print(f"✅ {test_name}")
        else:
            self.results["failed"].append(f"❌ {test_name}: {details}")
            print(f"❌ {test_name}: {details}")
    
    def log_error(self, test_name, error):
        """Log test error"""
        error_msg = f"🔥 {test_name}: {str(error)}"
        self.results["errors"].append(error_msg)
        print(error_msg)
    
    def test_auth_login(self):
        """Test authentication login"""
        try:
            url = f"{self.base_url}/auth/login"
            payload = {
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.token = data["token"]
                    self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                    self.log_result("Auth Login", True, f"Token received, role: {data.get('role', 'unknown')}")
                    return True
                else:
                    self.log_result("Auth Login", False, "No token in response")
                    return False
            else:
                self.log_result("Auth Login", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Auth Login", e)
            return False
    
    def test_auth_me(self):
        """Test auth/me endpoint"""
        try:
            url = f"{self.base_url}/auth/me"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Auth Me", True, f"User: {data.get('username', 'unknown')}")
                return True
            else:
                self.log_result("Auth Me", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Auth Me", e)
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        try:
            url = f"{self.base_url}/dashboard/stats"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                customers_count = data.get("customers_count", 0)
                self.log_result("Dashboard Stats", True, f"Customers: {customers_count}")
                return True
            else:
                self.log_result("Dashboard Stats", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Dashboard Stats", e)
            return False
    
    def test_customers_crud(self):
        """Test customers CRUD operations"""
        try:
            # Test GET customers
            url = f"{self.base_url}/customers"
            response = self.session.get(url)
            
            if response.status_code != 200:
                self.log_result("Customers GET", False, f"Status {response.status_code}: {response.text}")
                return False
            
            customers = response.json()
            self.log_result("Customers GET", True, f"Found {len(customers)} customers")
            
            # Test POST customer
            new_customer = {
                "name": "Max Mustermann",
                "email": "max.mustermann@example.com",
                "phone": "+49 123 456789",
                "address": "Musterstraße 123, 12345 Musterstadt",
                "customer_type": "Privat",
                "anrede": "Herr",
                "notes": "Test customer created by API test"
            }
            
            response = self.session.post(url, json=new_customer)
            
            if response.status_code == 200:
                created_customer = response.json()
                customer_id = created_customer.get("id")
                self.log_result("Customers POST", True, f"Created customer ID: {customer_id}")
                
                # Test GET specific customer
                if customer_id:
                    get_url = f"{self.base_url}/customers/{customer_id}"
                    response = self.session.get(get_url)
                    if response.status_code == 200:
                        self.log_result("Customers GET by ID", True)
                    else:
                        self.log_result("Customers GET by ID", False, f"Status {response.status_code}")
                
                return True
            else:
                self.log_result("Customers POST", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Customers CRUD", e)
            return False
    
    def test_articles_api(self):
        """Test articles API"""
        try:
            url = f"{self.base_url}/articles"
            response = self.session.get(url)
            
            if response.status_code == 200:
                articles = response.json()
                self.log_result("Articles GET", True, f"Found {len(articles)} articles")
                
                # Test POST article
                new_article = {
                    "name": "Test Artikel",
                    "description": "Test Artikel für API Test",
                    "price": 99.99,
                    "unit": "Stück",
                    "category": "Sonstiges"
                }
                
                response = self.session.post(url, json=new_article)
                if response.status_code == 200:
                    self.log_result("Articles POST", True)
                else:
                    self.log_result("Articles POST", False, f"Status {response.status_code}: {response.text}")
                
                return True
            else:
                self.log_result("Articles GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Articles API", e)
            return False
    
    def test_quotes_api(self):
        """Test quotes API"""
        try:
            url = f"{self.base_url}/quotes"
            response = self.session.get(url)
            
            if response.status_code == 200:
                quotes = response.json()
                self.log_result("Quotes GET", True, f"Found {len(quotes)} quotes")
                return True
            else:
                self.log_result("Quotes GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Quotes API", e)
            return False
    
    def test_orders_api(self):
        """Test orders API"""
        try:
            url = f"{self.base_url}/orders"
            response = self.session.get(url)
            
            if response.status_code == 200:
                orders = response.json()
                self.log_result("Orders GET", True, f"Found {len(orders)} orders")
                return True
            else:
                self.log_result("Orders GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Orders API", e)
            return False
    
    def test_invoices_api(self):
        """Test invoices API"""
        try:
            url = f"{self.base_url}/invoices"
            response = self.session.get(url)
            
            if response.status_code == 200:
                invoices = response.json()
                self.log_result("Invoices GET", True, f"Found {len(invoices)} invoices")
                return True
            else:
                self.log_result("Invoices GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Invoices API", e)
            return False
    
    def test_buchhaltung_api(self):
        """Test buchhaltung (accounting) API"""
        try:
            # Test buchungen endpoint
            url = f"{self.base_url}/buchhaltung/buchungen"
            response = self.session.get(url)
            
            if response.status_code == 200:
                buchungen = response.json()
                self.log_result("Buchhaltung Buchungen", True, f"Found {len(buchungen)} buchungen")
            else:
                self.log_result("Buchhaltung Buchungen", False, f"Status {response.status_code}: {response.text}")
            
            # Test statistiken endpoint (correct endpoint name)
            url = f"{self.base_url}/buchhaltung/statistiken"
            response = self.session.get(url)
            
            if response.status_code == 200:
                statistiken = response.json()
                self.log_result("Buchhaltung Statistiken", True)
                return True
            else:
                self.log_result("Buchhaltung Statistiken", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Buchhaltung API", e)
            return False
    
    def test_mitarbeiter_api(self):
        """Test mitarbeiter (employees) API"""
        try:
            url = f"{self.base_url}/mitarbeiter"
            response = self.session.get(url)
            
            if response.status_code == 200:
                mitarbeiter = response.json()
                self.log_result("Mitarbeiter GET", True, f"Found {len(mitarbeiter)} employees")
                
                # Test POST mitarbeiter
                new_employee = {
                    "name": "Hans Müller",
                    "email": "hans.mueller@example.com",
                    "phone": "+49 987 654321",
                    "position": "Tischler",
                    "hourly_rate": 25.50,
                    "start_date": datetime.now().isoformat()
                }
                
                response = self.session.post(url, json=new_employee)
                if response.status_code == 200:
                    self.log_result("Mitarbeiter POST", True)
                else:
                    self.log_result("Mitarbeiter POST", False, f"Status {response.status_code}: {response.text}")
                
                return True
            else:
                self.log_result("Mitarbeiter GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Mitarbeiter API", e)
            return False
    
    def test_einsaetze_api(self):
        """Test einsaetze (job scheduling) API"""
        try:
            url = f"{self.base_url}/einsaetze"
            response = self.session.get(url)
            
            if response.status_code == 200:
                einsaetze = response.json()
                self.log_result("Einsaetze GET", True, f"Found {len(einsaetze)} job assignments")
                return True
            else:
                self.log_result("Einsaetze GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Einsaetze API", e)
            return False
    
    def test_settings_api(self):
        """Test settings API"""
        try:
            url = f"{self.base_url}/settings"
            response = self.session.get(url)
            
            if response.status_code == 200:
                settings = response.json()
                self.log_result("Settings GET", True)
                return True
            else:
                self.log_result("Settings GET", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_error("Settings API", e)
            return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting Graupner Suite API Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication is required first
        if not self.test_auth_login():
            print("❌ Authentication failed - cannot continue with other tests")
            return False
        
        # Test auth/me
        self.test_auth_me()
        
        # Test all other endpoints
        self.test_dashboard_stats()
        self.test_customers_crud()
        self.test_articles_api()
        self.test_quotes_api()
        self.test_orders_api()
        self.test_invoices_api()
        self.test_buchhaltung_api()
        self.test_mitarbeiter_api()
        self.test_einsaetze_api()
        self.test_settings_api()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        print(f"✅ Passed: {len(self.results['passed'])}")
        for test in self.results['passed']:
            print(f"  {test}")
        
        if self.results['failed']:
            print(f"\n❌ Failed: {len(self.results['failed'])}")
            for test in self.results['failed']:
                print(f"  {test}")
        
        if self.results['errors']:
            print(f"\n🔥 Errors: {len(self.results['errors'])}")
            for test in self.results['errors']:
                print(f"  {test}")
        
        total_tests = len(self.results['passed']) + len(self.results['failed']) + len(self.results['errors'])
        success_rate = (len(self.results['passed']) / total_tests * 100) if total_tests > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}% ({len(self.results['passed'])}/{total_tests})")
        
        return len(self.results['failed']) == 0 and len(self.results['errors']) == 0


if __name__ == "__main__":
    tester = GraupnerAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)