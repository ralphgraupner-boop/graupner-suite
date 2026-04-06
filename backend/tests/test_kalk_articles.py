"""
Backend tests for KalkulationPanel feature - Articles and Kalkulation APIs
Tests: POST /api/articles (create new Leistung/Artikel), POST /api/kalkulation (save history)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestArticlesAPI:
    """Test articles CRUD operations for KalkulationPanel feature"""
    
    def test_get_articles(self):
        """Test GET /api/articles returns list"""
        response = requests.get(f"{BASE_URL}/api/articles")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"GET /api/articles: {len(data)} articles found")
    
    def test_get_articles_by_type_leistung(self):
        """Test GET /api/articles?typ=Leistung filters correctly"""
        response = requests.get(f"{BASE_URL}/api/articles?typ=Leistung")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for article in data:
            assert article.get('typ') == 'Leistung'
        print(f"GET /api/articles?typ=Leistung: {len(data)} Leistungen found")
    
    def test_get_articles_by_type_artikel(self):
        """Test GET /api/articles?typ=Artikel filters correctly"""
        response = requests.get(f"{BASE_URL}/api/articles?typ=Artikel")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for article in data:
            assert article.get('typ') == 'Artikel'
        print(f"GET /api/articles?typ=Artikel: {len(data)} Artikel found")
    
    def test_create_leistung_from_kalk(self):
        """Test POST /api/articles creates new Leistung with kalk data"""
        unique_name = f"TEST_Leistung_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "typ": "Leistung",
            "price_net": 150.50,
            "ek_preis": 50.00,
            "unit": "Stunde",
            "description": "Test Leistung from Kalkulation"
        }
        response = requests.post(f"{BASE_URL}/api/articles", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get('name') == unique_name
        assert data.get('typ') == 'Leistung'
        assert data.get('price_net') == 150.50
        assert data.get('ek_preis') == 50.00
        assert 'id' in data
        assert 'artikel_nr' in data
        assert data['artikel_nr'].startswith('L-')  # Leistung prefix
        print(f"Created Leistung: {data['artikel_nr']} - {data['name']}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/articles/{data['id']}")
        assert delete_response.status_code == 200
        print(f"Cleaned up test Leistung: {data['id']}")
    
    def test_create_artikel_from_kalk(self):
        """Test POST /api/articles creates new Artikel with kalk data"""
        unique_name = f"TEST_Artikel_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "typ": "Artikel",
            "price_net": 299.99,
            "ek_preis": 100.00,
            "unit": "Stück",
            "description": "Test Artikel from Kalkulation"
        }
        response = requests.post(f"{BASE_URL}/api/articles", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get('name') == unique_name
        assert data.get('typ') == 'Artikel'
        assert data.get('price_net') == 299.99
        assert 'id' in data
        assert 'artikel_nr' in data
        assert data['artikel_nr'].startswith('A-')  # Artikel prefix
        print(f"Created Artikel: {data['artikel_nr']} - {data['name']}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/articles/{data['id']}")
        assert delete_response.status_code == 200
        print(f"Cleaned up test Artikel: {data['id']}")
    
    def test_update_article_stammdaten(self):
        """Test PUT /api/articles/{id} updates existing article (In Stammdaten übernehmen)"""
        # First create an article
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_payload = {
            "name": unique_name,
            "typ": "Leistung",
            "price_net": 100.00,
            "ek_preis": 30.00,
            "unit": "Stunde"
        }
        create_response = requests.post(f"{BASE_URL}/api/articles", json=create_payload)
        assert create_response.status_code == 200
        created = create_response.json()
        article_id = created['id']
        
        # Update the article (simulating "In Stammdaten übernehmen")
        update_payload = {
            "name": unique_name,
            "typ": "Leistung",
            "price_net": 175.50,  # Updated VK price from kalk
            "ek_preis": 45.00,   # Updated EK price from kalk
            "unit": "Stunde"
        }
        update_response = requests.put(f"{BASE_URL}/api/articles/{article_id}", json=update_payload)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated.get('price_net') == 175.50
        assert updated.get('ek_preis') == 45.00
        print(f"Updated article {article_id}: VK={updated['price_net']}, EK={updated['ek_preis']}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/articles/{article_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get('price_net') == 175.50
        assert fetched.get('ek_preis') == 45.00
        print(f"Verified persistence: VK={fetched['price_net']}, EK={fetched['ek_preis']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/articles/{article_id}")


class TestKalkulationAPI:
    """Test kalkulation history API for KalkulationPanel feature"""
    
    def test_save_kalkulation_history(self):
        """Test POST /api/kalkulation saves calculation history"""
        # First create an article to link kalkulation to
        unique_name = f"TEST_KalkHist_{uuid.uuid4().hex[:8]}"
        article_payload = {
            "name": unique_name,
            "typ": "Leistung",
            "price_net": 200.00,
            "ek_preis": 50.00,
            "unit": "Stunde"
        }
        article_response = requests.post(f"{BASE_URL}/api/articles", json=article_payload)
        assert article_response.status_code == 200
        article = article_response.json()
        article_id = article['id']
        
        # Save kalkulation history
        kalk_payload = {
            "article_id": article_id,
            "article_name": unique_name,
            "ek": 50.00,
            "zeit_meister": 1.5,
            "zeit_geselle": 2.0,
            "zeit_azubi": 0.5,
            "zeit_helfer": 0,
            "rate_meister": 77,
            "rate_geselle": 72,
            "rate_azubi": 26,
            "rate_helfer": 69,
            "sonstige_kosten": [{"name": "Fahrtkosten", "betrag": 25.00}],
            "materialzuschlag": 10,
            "gewinnaufschlag": 15,
            "lohnkosten": 172.50,  # 1.5*77 + 2*72 + 0.5*26
            "sonstige_summe": 25.00,
            "zwischensumme": 247.50,  # 50 + 172.50 + 25
            "material_betrag": 24.75,  # 247.50 * 0.10
            "gewinn_betrag": 40.84,   # 272.25 * 0.15
            "vk_preis": 313.09
        }
        kalk_response = requests.post(f"{BASE_URL}/api/kalkulation", json=kalk_payload)
        assert kalk_response.status_code == 200
        kalk_data = kalk_response.json()
        assert 'id' in kalk_data
        assert 'created_at' in kalk_data
        print(f"Saved kalkulation history: {kalk_data['id']}")
        
        # Verify history retrieval
        history_response = requests.get(f"{BASE_URL}/api/kalkulation/{article_id}")
        assert history_response.status_code == 200
        history = history_response.json()
        assert isinstance(history, list)
        assert len(history) >= 1
        print(f"Retrieved {len(history)} kalkulation history entries")
        
        # Verify latest retrieval
        latest_response = requests.get(f"{BASE_URL}/api/kalkulation/{article_id}/latest")
        assert latest_response.status_code == 200
        latest = latest_response.json()
        assert latest.get('article_id') == article_id
        assert latest.get('vk_preis') == 313.09
        print(f"Latest kalkulation VK: {latest['vk_preis']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/articles/{article_id}")
    
    def test_get_kalkulation_nonexistent(self):
        """Test GET /api/kalkulation/{id} for non-existent article returns empty"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/kalkulation/{fake_id}")
        assert response.status_code == 200
        data = response.json()
        assert data == [] or data == {}
        print(f"Non-existent article kalkulation returns empty: {data}")
    
    def test_get_latest_kalkulation_nonexistent(self):
        """Test GET /api/kalkulation/{id}/latest for non-existent article returns empty"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/kalkulation/{fake_id}/latest")
        assert response.status_code == 200
        data = response.json()
        assert data == {} or data is None or data == []
        print(f"Non-existent article latest kalkulation returns empty")


class TestQuotesAPI:
    """Test quotes API for position updates"""
    
    def test_get_quote(self):
        """Test GET /api/quotes/{id} returns quote with positions"""
        quote_id = "c288214e-7f81-4832-8ccf-7fa863f65294"  # Known test quote
        response = requests.get(f"{BASE_URL}/api/quotes/{quote_id}")
        assert response.status_code == 200
        data = response.json()
        assert 'positions' in data
        assert isinstance(data['positions'], list)
        print(f"Quote {data.get('quote_number')}: {len(data['positions'])} positions")
        
        # Check position structure
        for pos in data['positions']:
            if pos.get('type') != 'titel':
                assert 'price_net' in pos
                assert 'quantity' in pos
                print(f"  Position: {pos.get('description', '')[:40]}... price={pos.get('price_net')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
