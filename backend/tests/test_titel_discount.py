"""
Test suite for Titel-Gruppen (Gewerk-/Titelzusammenstellung) and Discount features
Tests:
- POST /api/quotes with positions containing type='titel' and discount fields
- PUT /api/quotes/{id} with discount and title positions
- Calculation verification: Nettosumme -> Abschlag -> Nettobetrag -> MwSt -> Brutto
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTitelAndDiscountFeatures:
    """Test Titel-Gruppen and Discount functionality in quotes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Get a customer for testing
        response = self.session.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200, f"Failed to get customers: {response.text}"
        customers = response.json()
        if customers:
            self.customer_id = customers[0]["id"]
        else:
            # Create a test customer
            create_resp = self.session.post(f"{BASE_URL}/api/customers", json={
                "name": "TEST_TitelDiscount_Customer",
                "email": "test@example.com"
            })
            assert create_resp.status_code in [200, 201], f"Failed to create customer: {create_resp.text}"
            self.customer_id = create_resp.json()["id"]
        yield
        # Cleanup: Delete test quotes
        quotes = self.session.get(f"{BASE_URL}/api/quotes").json()
        for q in quotes:
            if "TEST_" in q.get("notes", "") or "TEST_" in q.get("betreff", ""):
                self.session.delete(f"{BASE_URL}/api/quotes/{q['id']}")
    
    def test_create_quote_with_titel_positions(self):
        """Test creating a quote with titel (type='titel') positions"""
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "titel", "pos_nr": 1, "description": "Einrüstarbeiten"},
                {"type": "position", "pos_nr": 2, "description": "Gerüst aufstellen", "quantity": 1, "unit": "pauschal", "price_net": 500.00},
                {"type": "position", "pos_nr": 3, "description": "Gerüst abbauen", "quantity": 1, "unit": "pauschal", "price_net": 300.00},
                {"type": "titel", "pos_nr": 4, "description": "Dachdeckerarbeiten"},
                {"type": "position", "pos_nr": 5, "description": "Dachziegel verlegen", "quantity": 50, "unit": "m²", "price_net": 45.00}
            ],
            "notes": "TEST_TitelPositions",
            "betreff": "TEST_Angebot mit Titel-Gruppen",
            "vat_rate": 19,
            "discount": 0,
            "discount_type": "percent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/quotes", json=payload)
        assert response.status_code == 200, f"Failed to create quote: {response.text}"
        
        quote = response.json()
        print(f"Created quote: {quote['quote_number']}")
        
        # Verify positions are saved with type field
        assert len(quote["positions"]) == 5, "Should have 5 positions"
        
        # Check titel positions
        titel_positions = [p for p in quote["positions"] if p.get("type") == "titel"]
        assert len(titel_positions) == 2, f"Should have 2 titel positions, got {len(titel_positions)}"
        assert titel_positions[0]["description"] == "Einrüstarbeiten"
        assert titel_positions[1]["description"] == "Dachdeckerarbeiten"
        
        # Check regular positions
        regular_positions = [p for p in quote["positions"] if p.get("type") != "titel"]
        assert len(regular_positions) == 3, f"Should have 3 regular positions, got {len(regular_positions)}"
        
        # Verify calculation excludes titel positions
        # Expected: 500 + 300 + (50 * 45) = 500 + 300 + 2250 = 3050
        expected_subtotal = 500 + 300 + (50 * 45)
        assert quote["subtotal_net"] == expected_subtotal, f"Subtotal should be {expected_subtotal}, got {quote['subtotal_net']}"
        
        # Verify VAT calculation
        expected_vat = expected_subtotal * 0.19
        assert abs(quote["vat_amount"] - expected_vat) < 0.01, f"VAT should be {expected_vat}, got {quote['vat_amount']}"
        
        # Verify total
        expected_total = expected_subtotal + expected_vat
        assert abs(quote["total_gross"] - expected_total) < 0.01, f"Total should be {expected_total}, got {quote['total_gross']}"
        
        print(f"✓ Quote created with titel positions - Subtotal: {quote['subtotal_net']}, VAT: {quote['vat_amount']}, Total: {quote['total_gross']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/quotes/{quote['id']}")
    
    def test_create_quote_with_discount_percent(self):
        """Test creating a quote with percentage discount"""
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Arbeit 1", "quantity": 1, "unit": "Stück", "price_net": 1000.00}
            ],
            "notes": "TEST_DiscountPercent",
            "betreff": "TEST_Angebot mit Prozent-Abschlag",
            "vat_rate": 19,
            "discount": 10,  # 10% discount
            "discount_type": "percent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/quotes", json=payload)
        assert response.status_code == 200, f"Failed to create quote: {response.text}"
        
        quote = response.json()
        print(f"Created quote with discount: {quote['quote_number']}")
        
        # Verify discount is saved
        assert quote["discount"] == 10, f"Discount should be 10, got {quote['discount']}"
        assert quote["discount_type"] == "percent", f"Discount type should be 'percent', got {quote['discount_type']}"
        
        # Verify calculation: 1000 - 10% = 900, then 19% VAT
        expected_subtotal = 1000
        expected_discount_amt = 100  # 10% of 1000
        expected_net_after_discount = 900
        expected_vat = 900 * 0.19  # 171
        expected_total = 900 + expected_vat  # 1071
        
        assert quote["subtotal_net"] == expected_subtotal, f"Subtotal should be {expected_subtotal}, got {quote['subtotal_net']}"
        assert abs(quote["vat_amount"] - expected_vat) < 0.01, f"VAT should be {expected_vat}, got {quote['vat_amount']}"
        assert abs(quote["total_gross"] - expected_total) < 0.01, f"Total should be {expected_total}, got {quote['total_gross']}"
        
        print(f"✓ Quote with 10% discount - Subtotal: {quote['subtotal_net']}, VAT: {quote['vat_amount']}, Total: {quote['total_gross']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/quotes/{quote['id']}")
    
    def test_create_quote_with_titel_and_discount(self):
        """Test creating a quote with both titel positions and discount"""
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "titel", "pos_nr": 1, "description": "Einrüstarbeiten"},
                {"type": "position", "pos_nr": 2, "description": "Gerüst aufstellen", "quantity": 1, "unit": "pauschal", "price_net": 500.00},
                {"type": "titel", "pos_nr": 3, "description": "Dachdeckerarbeiten"},
                {"type": "position", "pos_nr": 4, "description": "Dachziegel verlegen", "quantity": 10, "unit": "m²", "price_net": 50.00}
            ],
            "notes": "TEST_TitelAndDiscount",
            "betreff": "TEST_Angebot mit Titel und Abschlag",
            "vat_rate": 19,
            "discount": 3,  # 3% discount
            "discount_type": "percent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/quotes", json=payload)
        assert response.status_code == 200, f"Failed to create quote: {response.text}"
        
        quote = response.json()
        print(f"Created quote with titel and discount: {quote['quote_number']}")
        
        # Verify calculation:
        # Subtotal (excluding titel): 500 + (10 * 50) = 1000
        # Discount: 3% of 1000 = 30
        # Net after discount: 970
        # VAT: 970 * 0.19 = 184.30
        # Total: 970 + 184.30 = 1154.30
        
        expected_subtotal = 1000
        expected_discount_amt = 30
        expected_net_after_discount = 970
        expected_vat = 970 * 0.19
        expected_total = 970 + expected_vat
        
        assert quote["subtotal_net"] == expected_subtotal, f"Subtotal should be {expected_subtotal}, got {quote['subtotal_net']}"
        assert abs(quote["vat_amount"] - expected_vat) < 0.01, f"VAT should be {expected_vat}, got {quote['vat_amount']}"
        assert abs(quote["total_gross"] - expected_total) < 0.01, f"Total should be {expected_total}, got {quote['total_gross']}"
        
        print(f"✓ Quote with titel and 3% discount - Subtotal: {quote['subtotal_net']}, VAT: {quote['vat_amount']}, Total: {quote['total_gross']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/quotes/{quote['id']}")
    
    def test_update_quote_with_discount(self):
        """Test updating a quote to add/change discount"""
        # First create a quote without discount
        create_payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Arbeit 1", "quantity": 2, "unit": "Stück", "price_net": 500.00}
            ],
            "notes": "TEST_UpdateDiscount",
            "betreff": "TEST_Angebot für Update",
            "vat_rate": 19,
            "discount": 0,
            "discount_type": "percent"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/quotes", json=create_payload)
        assert create_response.status_code == 200, f"Failed to create quote: {create_response.text}"
        quote = create_response.json()
        quote_id = quote["id"]
        
        # Verify initial calculation (no discount)
        # Subtotal: 2 * 500 = 1000
        # VAT: 1000 * 0.19 = 190
        # Total: 1190
        assert quote["subtotal_net"] == 1000
        assert abs(quote["total_gross"] - 1190) < 0.01
        
        # Now update with 5% discount
        update_payload = {
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Arbeit 1", "quantity": 2, "unit": "Stück", "price_net": 500.00}
            ],
            "notes": "TEST_UpdateDiscount",
            "betreff": "TEST_Angebot für Update",
            "vat_rate": 19,
            "discount": 5,
            "discount_type": "percent"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/quotes/{quote_id}", json=update_payload)
        assert update_response.status_code == 200, f"Failed to update quote: {update_response.text}"
        
        updated_quote = update_response.json()
        
        # Verify updated calculation with 5% discount
        # Subtotal: 1000
        # Discount: 5% of 1000 = 50
        # Net after discount: 950
        # VAT: 950 * 0.19 = 180.50
        # Total: 950 + 180.50 = 1130.50
        
        expected_vat = 950 * 0.19
        expected_total = 950 + expected_vat
        
        assert updated_quote["discount"] == 5, f"Discount should be 5, got {updated_quote['discount']}"
        assert updated_quote["subtotal_net"] == 1000, f"Subtotal should be 1000, got {updated_quote['subtotal_net']}"
        assert abs(updated_quote["vat_amount"] - expected_vat) < 0.01, f"VAT should be {expected_vat}, got {updated_quote['vat_amount']}"
        assert abs(updated_quote["total_gross"] - expected_total) < 0.01, f"Total should be {expected_total}, got {updated_quote['total_gross']}"
        
        print(f"✓ Quote updated with 5% discount - Subtotal: {updated_quote['subtotal_net']}, VAT: {updated_quote['vat_amount']}, Total: {updated_quote['total_gross']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/quotes/{quote_id}")
    
    def test_get_quote_preserves_titel_and_discount(self):
        """Test that GET /api/quotes/{id} returns titel positions and discount correctly"""
        # Create a quote with titel and discount
        create_payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "titel", "pos_nr": 1, "description": "Malerarbeiten"},
                {"type": "position", "pos_nr": 2, "description": "Wände streichen", "quantity": 100, "unit": "m²", "price_net": 12.00}
            ],
            "notes": "TEST_GetQuote",
            "betreff": "TEST_Angebot für GET",
            "vat_rate": 19,
            "discount": 2.5,
            "discount_type": "percent"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/quotes", json=create_payload)
        assert create_response.status_code == 200
        quote = create_response.json()
        quote_id = quote["id"]
        
        # GET the quote
        get_response = self.session.get(f"{BASE_URL}/api/quotes/{quote_id}")
        assert get_response.status_code == 200, f"Failed to get quote: {get_response.text}"
        
        fetched_quote = get_response.json()
        
        # Verify titel position is preserved
        titel_positions = [p for p in fetched_quote["positions"] if p.get("type") == "titel"]
        assert len(titel_positions) == 1, f"Should have 1 titel position, got {len(titel_positions)}"
        assert titel_positions[0]["description"] == "Malerarbeiten"
        
        # Verify discount is preserved
        assert fetched_quote["discount"] == 2.5, f"Discount should be 2.5, got {fetched_quote['discount']}"
        assert fetched_quote["discount_type"] == "percent", f"Discount type should be 'percent', got {fetched_quote['discount_type']}"
        
        print(f"✓ GET quote preserves titel and discount - Discount: {fetched_quote['discount']}%")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/quotes/{quote_id}")
    
    def test_betreff_field_saved(self):
        """Test that betreff (subject) field is saved correctly"""
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 100.00}
            ],
            "notes": "TEST_Betreff",
            "betreff": "Angebot für Dachsanierung Musterstraße 123",
            "vat_rate": 19,
            "discount": 0,
            "discount_type": "percent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/quotes", json=payload)
        assert response.status_code == 200, f"Failed to create quote: {response.text}"
        
        quote = response.json()
        assert quote["betreff"] == "Angebot für Dachsanierung Musterstraße 123", f"Betreff not saved correctly: {quote.get('betreff')}"
        
        # Verify via GET
        get_response = self.session.get(f"{BASE_URL}/api/quotes/{quote['id']}")
        fetched = get_response.json()
        assert fetched["betreff"] == "Angebot für Dachsanierung Musterstraße 123"
        
        print(f"✓ Betreff field saved and retrieved correctly")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/quotes/{quote['id']}")


class TestOrdersWithTitelAndDiscount:
    """Test Titel and Discount in Orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Get a customer
        response = self.session.get(f"{BASE_URL}/api/customers")
        customers = response.json()
        self.customer_id = customers[0]["id"] if customers else None
        yield
    
    def test_order_update_with_discount(self):
        """Test updating an order with discount"""
        if not self.customer_id:
            pytest.skip("No customer available")
        
        # First create a quote
        quote_payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 1000.00}
            ],
            "notes": "TEST_OrderDiscount",
            "vat_rate": 19,
            "discount": 0,
            "discount_type": "percent"
        }
        quote_resp = self.session.post(f"{BASE_URL}/api/quotes", json=quote_payload)
        assert quote_resp.status_code == 200
        quote = quote_resp.json()
        
        # Create order from quote
        order_resp = self.session.post(f"{BASE_URL}/api/orders/from-quote/{quote['id']}")
        assert order_resp.status_code == 200, f"Failed to create order: {order_resp.text}"
        order = order_resp.json()
        order_id = order["id"]
        
        # Update order with discount
        update_payload = {
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 1000.00}
            ],
            "notes": "TEST_OrderDiscount",
            "vat_rate": 19,
            "discount": 5,
            "discount_type": "percent"
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/orders/{order_id}", json=update_payload)
        assert update_resp.status_code == 200, f"Failed to update order: {update_resp.text}"
        
        updated_order = update_resp.json()
        
        # Verify discount calculation
        # Subtotal: 1000, Discount: 5% = 50, Net: 950, VAT: 180.50, Total: 1130.50
        expected_vat = 950 * 0.19
        expected_total = 950 + expected_vat
        
        assert updated_order["discount"] == 5
        assert abs(updated_order["total_gross"] - expected_total) < 0.01
        
        print(f"✓ Order updated with 5% discount - Total: {updated_order['total_gross']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/orders/{order_id}")
        self.session.delete(f"{BASE_URL}/api/quotes/{quote['id']}")


class TestInvoicesWithTitelAndDiscount:
    """Test Titel and Discount in Invoices"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Get a customer
        response = self.session.get(f"{BASE_URL}/api/customers")
        customers = response.json()
        self.customer_id = customers[0]["id"] if customers else None
        yield
    
    def test_create_invoice_with_titel_and_discount(self):
        """Test creating an invoice with titel positions and discount"""
        if not self.customer_id:
            pytest.skip("No customer available")
        
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "titel", "pos_nr": 1, "description": "Elektroarbeiten"},
                {"type": "position", "pos_nr": 2, "description": "Kabel verlegen", "quantity": 50, "unit": "m", "price_net": 5.00},
                {"type": "position", "pos_nr": 3, "description": "Steckdosen montieren", "quantity": 10, "unit": "Stück", "price_net": 25.00}
            ],
            "notes": "TEST_InvoiceTitelDiscount",
            "betreff": "TEST_Rechnung mit Titel und Abschlag",
            "vat_rate": 19,
            "discount": 2,
            "discount_type": "percent",
            "deposit_amount": 0,
            "due_days": 14
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=payload)
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        
        invoice = response.json()
        
        # Verify calculation:
        # Subtotal (excluding titel): (50 * 5) + (10 * 25) = 250 + 250 = 500
        # Discount: 2% of 500 = 10
        # Net after discount: 490
        # VAT: 490 * 0.19 = 93.10
        # Total: 490 + 93.10 = 583.10
        
        expected_subtotal = 500
        expected_vat = 490 * 0.19
        expected_total = 490 + expected_vat
        
        assert invoice["subtotal_net"] == expected_subtotal, f"Subtotal should be {expected_subtotal}, got {invoice['subtotal_net']}"
        assert invoice["discount"] == 2
        assert abs(invoice["vat_amount"] - expected_vat) < 0.01
        assert abs(invoice["total_gross"] - expected_total) < 0.01
        
        # Verify titel position preserved
        titel_positions = [p for p in invoice["positions"] if p.get("type") == "titel"]
        assert len(titel_positions) == 1
        
        print(f"✓ Invoice created with titel and 2% discount - Total: {invoice['total_gross']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/invoices/{invoice['id']}")
    
    def test_update_invoice_with_discount(self):
        """Test updating an invoice with discount"""
        if not self.customer_id:
            pytest.skip("No customer available")
        
        # Create invoice
        create_payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 2000.00}
            ],
            "notes": "TEST_InvoiceUpdateDiscount",
            "vat_rate": 19,
            "discount": 0,
            "discount_type": "percent",
            "deposit_amount": 0,
            "due_days": 14
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/invoices", json=create_payload)
        assert create_resp.status_code == 200
        invoice = create_resp.json()
        invoice_id = invoice["id"]
        
        # Update with discount
        update_payload = {
            "positions": [
                {"type": "position", "pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 2000.00}
            ],
            "notes": "TEST_InvoiceUpdateDiscount",
            "vat_rate": 19,
            "discount": 10,
            "discount_type": "percent",
            "deposit_amount": 500
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=update_payload)
        assert update_resp.status_code == 200, f"Failed to update invoice: {update_resp.text}"
        
        updated = update_resp.json()
        
        # Verify: Subtotal 2000, Discount 10% = 200, Net 1800, VAT 342, Total 2142, Final (after deposit) 1642
        expected_vat = 1800 * 0.19
        expected_total = 1800 + expected_vat
        expected_final = expected_total - 500
        
        assert updated["discount"] == 10
        assert updated["deposit_amount"] == 500
        assert abs(updated["total_gross"] - expected_total) < 0.01
        assert abs(updated["final_amount"] - expected_final) < 0.01
        
        print(f"✓ Invoice updated with 10% discount and 500€ deposit - Total: {updated['total_gross']}, Final: {updated['final_amount']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/invoices/{invoice_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
