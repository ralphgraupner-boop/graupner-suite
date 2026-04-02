"""
Test Text Templates CRUD API
Tests for Vortext/Schlusstext templates for Angebote, Auftragsbestätigungen, and Rechnungen
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTextTemplatesAPI:
    """Text Templates CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        self.token = login_res.json()["token"]
        self.headers = {"Content-Type": "application/json"}
        self.params = {"token": self.token}
    
    def test_get_placeholders(self):
        """GET /api/text-templates/placeholders returns placeholder list"""
        res = requests.get(f"{BASE_URL}/api/text-templates/placeholders", params=self.params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 7  # At least 7 placeholders defined
        # Check structure
        aliases = [p["alias"] for p in data]
        assert "{kunde_name}" in aliases
        assert "{kunde_adresse}" in aliases
        assert "{firma}" in aliases
        assert "{datum}" in aliases
        assert "{dokument_nr}" in aliases
        print("PASS: GET /api/text-templates/placeholders returns correct placeholders")
    
    def test_get_templates_empty_filter(self):
        """GET /api/text-templates returns all templates"""
        res = requests.get(f"{BASE_URL}/api/text-templates", params=self.params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/text-templates returns {len(data)} templates")
    
    def test_get_templates_filtered_by_doc_type(self):
        """GET /api/text-templates?doc_type=angebot filters correctly"""
        params = {**self.params, "doc_type": "angebot"}
        res = requests.get(f"{BASE_URL}/api/text-templates", params=params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        for t in data:
            assert t["doc_type"] == "angebot", f"Expected doc_type=angebot, got {t['doc_type']}"
        print(f"PASS: GET /api/text-templates?doc_type=angebot returns {len(data)} templates")
    
    def test_get_templates_filtered_by_text_type(self):
        """GET /api/text-templates?text_type=vortext filters correctly"""
        params = {**self.params, "text_type": "vortext"}
        res = requests.get(f"{BASE_URL}/api/text-templates", params=params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        for t in data:
            assert t["text_type"] == "vortext", f"Expected text_type=vortext, got {t['text_type']}"
        print(f"PASS: GET /api/text-templates?text_type=vortext returns {len(data)} templates")
    
    def test_create_template_vortext_angebot(self):
        """POST /api/text-templates creates a new Vortext template for Angebot"""
        payload = {
            "doc_type": "angebot",
            "text_type": "vortext",
            "title": "TEST_Vortext Angebot",
            "content": "Sehr geehrte/r {kunde_name},\n\nvielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu können:"
        }
        res = requests.post(f"{BASE_URL}/api/text-templates", json=payload, params=self.params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        assert data["title"] == payload["title"]
        assert data["content"] == payload["content"]
        assert data["doc_type"] == "angebot"
        assert data["text_type"] == "vortext"
        assert "id" in data
        self.created_template_id = data["id"]
        print(f"PASS: POST /api/text-templates creates Vortext template with id={data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/text-templates/{data['id']}", params=self.params)
    
    def test_create_template_schlusstext_rechnung(self):
        """POST /api/text-templates creates a new Schlusstext template for Rechnung"""
        payload = {
            "doc_type": "rechnung",
            "text_type": "schlusstext",
            "title": "TEST_Schlusstext Rechnung",
            "content": "Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf unser Konto.\n\nMit freundlichen Grüßen,\n{firma}"
        }
        res = requests.post(f"{BASE_URL}/api/text-templates", json=payload, params=self.params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        assert data["doc_type"] == "rechnung"
        assert data["text_type"] == "schlusstext"
        print(f"PASS: POST /api/text-templates creates Schlusstext template for Rechnung")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/text-templates/{data['id']}", params=self.params)
    
    def test_create_template_invalid_doc_type(self):
        """POST /api/text-templates with invalid doc_type returns 400"""
        payload = {
            "doc_type": "invalid_type",
            "text_type": "vortext",
            "title": "TEST_Invalid",
            "content": "Test content"
        }
        res = requests.post(f"{BASE_URL}/api/text-templates", json=payload, params=self.params)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("PASS: POST /api/text-templates with invalid doc_type returns 400")
    
    def test_create_template_invalid_text_type(self):
        """POST /api/text-templates with invalid text_type returns 400"""
        payload = {
            "doc_type": "angebot",
            "text_type": "invalid_type",
            "title": "TEST_Invalid",
            "content": "Test content"
        }
        res = requests.post(f"{BASE_URL}/api/text-templates", json=payload, params=self.params)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("PASS: POST /api/text-templates with invalid text_type returns 400")
    
    def test_update_template(self):
        """PUT /api/text-templates/{id} updates an existing template"""
        # First create a template
        create_payload = {
            "doc_type": "auftrag",
            "text_type": "vortext",
            "title": "TEST_Update Template",
            "content": "Original content"
        }
        create_res = requests.post(f"{BASE_URL}/api/text-templates", json=create_payload, params=self.params)
        assert create_res.status_code == 200
        template_id = create_res.json()["id"]
        
        # Update the template
        update_payload = {
            "doc_type": "auftrag",
            "text_type": "vortext",
            "title": "TEST_Updated Title",
            "content": "Updated content with {kunde_name}"
        }
        update_res = requests.put(f"{BASE_URL}/api/text-templates/{template_id}", json=update_payload, params=self.params)
        assert update_res.status_code == 200, f"Failed: {update_res.text}"
        data = update_res.json()
        assert data["title"] == "TEST_Updated Title"
        assert data["content"] == "Updated content with {kunde_name}"
        print(f"PASS: PUT /api/text-templates/{template_id} updates template correctly")
        
        # Verify with GET
        get_res = requests.get(f"{BASE_URL}/api/text-templates", params={**self.params, "doc_type": "auftrag"})
        templates = get_res.json()
        found = [t for t in templates if t["id"] == template_id]
        assert len(found) == 1
        assert found[0]["title"] == "TEST_Updated Title"
        print("PASS: GET confirms template was updated")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/text-templates/{template_id}", params=self.params)
    
    def test_update_template_not_found(self):
        """PUT /api/text-templates/{id} with non-existent ID returns 404"""
        payload = {
            "doc_type": "angebot",
            "text_type": "vortext",
            "title": "Test",
            "content": "Test"
        }
        res = requests.put(f"{BASE_URL}/api/text-templates/non-existent-id", json=payload, params=self.params)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        print("PASS: PUT /api/text-templates/non-existent-id returns 404")
    
    def test_delete_template(self):
        """DELETE /api/text-templates/{id} deletes a template"""
        # First create a template
        create_payload = {
            "doc_type": "rechnung",
            "text_type": "schlusstext",
            "title": "TEST_Delete Template",
            "content": "To be deleted"
        }
        create_res = requests.post(f"{BASE_URL}/api/text-templates", json=create_payload, params=self.params)
        assert create_res.status_code == 200
        template_id = create_res.json()["id"]
        
        # Delete the template
        delete_res = requests.delete(f"{BASE_URL}/api/text-templates/{template_id}", params=self.params)
        assert delete_res.status_code == 200, f"Failed: {delete_res.text}"
        print(f"PASS: DELETE /api/text-templates/{template_id} returns 200")
        
        # Verify deletion
        get_res = requests.get(f"{BASE_URL}/api/text-templates", params=self.params)
        templates = get_res.json()
        found = [t for t in templates if t["id"] == template_id]
        assert len(found) == 0, "Template should be deleted"
        print("PASS: GET confirms template was deleted")
    
    def test_delete_template_not_found(self):
        """DELETE /api/text-templates/{id} with non-existent ID returns 404"""
        res = requests.delete(f"{BASE_URL}/api/text-templates/non-existent-id", params=self.params)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}"
        print("PASS: DELETE /api/text-templates/non-existent-id returns 404")


class TestQuotesWithVortextSchlusstext:
    """Test Quote endpoints accept vortext and schlusstext fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and create test customer"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200
        self.token = login_res.json()["token"]
        self.params = {"token": self.token}
        
        # Get or create a test customer
        customers_res = requests.get(f"{BASE_URL}/api/customers", params=self.params)
        customers = customers_res.json()
        if customers:
            self.customer_id = customers[0]["id"]
        else:
            # Create a test customer
            customer_res = requests.post(f"{BASE_URL}/api/customers", json={
                "name": "TEST_Customer for Quotes",
                "email": "test@example.com"
            }, params=self.params)
            self.customer_id = customer_res.json()["id"]
    
    def test_create_quote_with_vortext_schlusstext(self):
        """POST /api/quotes accepts vortext and schlusstext fields"""
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"pos_nr": 1, "description": "Test Position", "quantity": 1, "unit": "Stück", "price_net": 100}
            ],
            "notes": "Test notes",
            "vortext": "Sehr geehrter Kunde,\n\nvielen Dank für Ihre Anfrage.",
            "schlusstext": "Mit freundlichen Grüßen,\nTischlerei Graupner",
            "vat_rate": 19
        }
        res = requests.post(f"{BASE_URL}/api/quotes", json=payload, params=self.params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        assert data["vortext"] == payload["vortext"], f"vortext mismatch: {data.get('vortext')}"
        assert data["schlusstext"] == payload["schlusstext"], f"schlusstext mismatch: {data.get('schlusstext')}"
        print(f"PASS: POST /api/quotes creates quote with vortext and schlusstext")
        
        # Store for cleanup
        self.quote_id = data["id"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/quotes/{data['id']}", params=self.params)
    
    def test_update_quote_with_vortext_schlusstext(self):
        """PUT /api/quotes/{id} saves vortext and schlusstext"""
        # First create a quote
        create_payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 50}
            ],
            "vortext": "Original vortext",
            "schlusstext": "Original schlusstext",
            "vat_rate": 19
        }
        create_res = requests.post(f"{BASE_URL}/api/quotes", json=create_payload, params=self.params)
        assert create_res.status_code == 200
        quote_id = create_res.json()["id"]
        
        # Update the quote
        update_payload = {
            "positions": [
                {"pos_nr": 1, "description": "Updated", "quantity": 2, "unit": "Stück", "price_net": 75}
            ],
            "vortext": "Updated vortext with {kunde_name}",
            "schlusstext": "Updated schlusstext",
            "vat_rate": 19
        }
        update_res = requests.put(f"{BASE_URL}/api/quotes/{quote_id}", json=update_payload, params=self.params)
        assert update_res.status_code == 200, f"Failed: {update_res.text}"
        data = update_res.json()
        assert data["vortext"] == update_payload["vortext"]
        assert data["schlusstext"] == update_payload["schlusstext"]
        print(f"PASS: PUT /api/quotes/{quote_id} updates vortext and schlusstext")
        
        # Verify with GET
        get_res = requests.get(f"{BASE_URL}/api/quotes/{quote_id}", params=self.params)
        quote = get_res.json()
        assert quote["vortext"] == update_payload["vortext"]
        assert quote["schlusstext"] == update_payload["schlusstext"]
        print("PASS: GET confirms vortext/schlusstext were persisted")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/quotes/{quote_id}", params=self.params)


class TestInvoicesWithVortextSchlusstext:
    """Test Invoice endpoints accept vortext and schlusstext fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and create test customer"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200
        self.token = login_res.json()["token"]
        self.params = {"token": self.token}
        
        # Get or create a test customer
        customers_res = requests.get(f"{BASE_URL}/api/customers", params=self.params)
        customers = customers_res.json()
        if customers:
            self.customer_id = customers[0]["id"]
        else:
            customer_res = requests.post(f"{BASE_URL}/api/customers", json={
                "name": "TEST_Customer for Invoices",
                "email": "test@example.com"
            }, params=self.params)
            self.customer_id = customer_res.json()["id"]
    
    def test_create_invoice_with_vortext_schlusstext(self):
        """POST /api/invoices accepts vortext and schlusstext fields"""
        payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"pos_nr": 1, "description": "Invoice Position", "quantity": 1, "unit": "Stück", "price_net": 200}
            ],
            "notes": "Invoice notes",
            "vortext": "Rechnung Vortext",
            "schlusstext": "Rechnung Schlusstext",
            "vat_rate": 19,
            "due_days": 14
        }
        res = requests.post(f"{BASE_URL}/api/invoices", json=payload, params=self.params)
        assert res.status_code == 200, f"Failed: {res.text}"
        data = res.json()
        assert data["vortext"] == payload["vortext"], f"vortext mismatch: {data.get('vortext')}"
        assert data["schlusstext"] == payload["schlusstext"], f"schlusstext mismatch: {data.get('schlusstext')}"
        print(f"PASS: POST /api/invoices creates invoice with vortext and schlusstext")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invoices/{data['id']}", params=self.params)
    
    def test_update_invoice_with_vortext_schlusstext(self):
        """PUT /api/invoices/{id} saves vortext and schlusstext"""
        # First create an invoice
        create_payload = {
            "customer_id": self.customer_id,
            "positions": [
                {"pos_nr": 1, "description": "Test", "quantity": 1, "unit": "Stück", "price_net": 100}
            ],
            "vortext": "Original invoice vortext",
            "schlusstext": "Original invoice schlusstext",
            "vat_rate": 19,
            "due_days": 14
        }
        create_res = requests.post(f"{BASE_URL}/api/invoices", json=create_payload, params=self.params)
        assert create_res.status_code == 200
        invoice_id = create_res.json()["id"]
        
        # Update the invoice
        update_payload = {
            "positions": [
                {"pos_nr": 1, "description": "Updated", "quantity": 1, "unit": "Stück", "price_net": 150}
            ],
            "vortext": "Updated invoice vortext",
            "schlusstext": "Updated invoice schlusstext",
            "vat_rate": 19,
            "deposit_amount": 0
        }
        update_res = requests.put(f"{BASE_URL}/api/invoices/{invoice_id}", json=update_payload, params=self.params)
        assert update_res.status_code == 200, f"Failed: {update_res.text}"
        data = update_res.json()
        assert data["vortext"] == update_payload["vortext"]
        assert data["schlusstext"] == update_payload["schlusstext"]
        print(f"PASS: PUT /api/invoices/{invoice_id} updates vortext and schlusstext")
        
        # Verify with GET
        get_res = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}", params=self.params)
        invoice = get_res.json()
        assert invoice["vortext"] == update_payload["vortext"]
        assert invoice["schlusstext"] == update_payload["schlusstext"]
        print("PASS: GET confirms vortext/schlusstext were persisted")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}", params=self.params)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
