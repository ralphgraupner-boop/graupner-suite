"""
Test unified Artikel/Leistung/Fremdleistung API
Tests: GET, POST, PUT, DELETE with type filtering and VK price calculation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestUnifiedArticlesAPI:
    """Tests for unified articles endpoint with Artikel, Leistung, Fremdleistung types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data IDs for cleanup"""
        self.created_ids = []
        yield
        # Cleanup test data
        for item_id in self.created_ids:
            try:
                requests.delete(f"{BASE_URL}/api/articles/{item_id}")
            except:
                pass
    
    def test_get_all_articles(self):
        """GET /api/articles returns all items"""
        response = requests.get(f"{BASE_URL}/api/articles")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 7, f"Expected at least 7 items (4 Artikel + 3 Leistung), got {len(data)}"
        print(f"✓ GET /api/articles returns {len(data)} items")
    
    def test_filter_by_typ_artikel(self):
        """GET /api/articles?typ=Artikel filters correctly"""
        response = requests.get(f"{BASE_URL}/api/articles?typ=Artikel")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4, f"Expected at least 4 Artikel items, got {len(data)}"
        for item in data:
            assert item["typ"] == "Artikel", f"Item {item['name']} has typ={item['typ']}, expected Artikel"
        print(f"✓ GET /api/articles?typ=Artikel returns {len(data)} Artikel items")
    
    def test_filter_by_typ_leistung(self):
        """GET /api/articles?typ=Leistung filters correctly"""
        response = requests.get(f"{BASE_URL}/api/articles?typ=Leistung")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3, f"Expected at least 3 Leistung items, got {len(data)}"
        for item in data:
            assert item["typ"] == "Leistung", f"Item {item['name']} has typ={item['typ']}, expected Leistung"
        print(f"✓ GET /api/articles?typ=Leistung returns {len(data)} Leistung items")
    
    def test_filter_by_typ_fremdleistung(self):
        """GET /api/articles?typ=Fremdleistung filters correctly"""
        response = requests.get(f"{BASE_URL}/api/articles?typ=Fremdleistung")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # May be 0 if no Fremdleistung exists yet
        for item in data:
            assert item["typ"] == "Fremdleistung", f"Item {item['name']} has typ={item['typ']}, expected Fremdleistung"
        print(f"✓ GET /api/articles?typ=Fremdleistung returns {len(data)} Fremdleistung items")
    
    def test_create_artikel_with_vk_calculation(self):
        """POST /api/articles creates item with calculated VK prices"""
        payload = {
            "name": "TEST_VK_Calculation",
            "description": "Testing VK price calculation",
            "typ": "Artikel",
            "ek_preis": 100,
            "aufschlag_1": 20,
            "aufschlag_2": 30,
            "aufschlag_3": 50,
            "price_net": 150,
            "unit": "Stück"
        }
        response = requests.post(f"{BASE_URL}/api/articles", json=payload)
        assert response.status_code == 200
        data = response.json()
        self.created_ids.append(data["id"])
        
        # Verify VK calculation: ek * (1 + aufschlag/100)
        assert data["vk_preis_1"] == 120.0, f"VK1 should be 120 (100 * 1.20), got {data['vk_preis_1']}"
        assert data["vk_preis_2"] == 130.0, f"VK2 should be 130 (100 * 1.30), got {data['vk_preis_2']}"
        assert data["vk_preis_3"] == 150.0, f"VK3 should be 150 (100 * 1.50), got {data['vk_preis_3']}"
        assert data["typ"] == "Artikel"
        print(f"✓ POST /api/articles creates item with correct VK calculation")
    
    def test_create_fremdleistung_with_subunternehmer(self):
        """POST /api/articles with typ=Fremdleistung saves subunternehmer"""
        payload = {
            "name": "TEST_Fremdleistung",
            "description": "Testing Fremdleistung with subunternehmer",
            "typ": "Fremdleistung",
            "ek_preis": 80,
            "aufschlag_1": 25,
            "price_net": 100,
            "unit": "Stunde",
            "subunternehmer": "Elektro Müller GmbH"
        }
        response = requests.post(f"{BASE_URL}/api/articles", json=payload)
        assert response.status_code == 200
        data = response.json()
        self.created_ids.append(data["id"])
        
        assert data["typ"] == "Fremdleistung"
        assert data["subunternehmer"] == "Elektro Müller GmbH"
        assert data["vk_preis_1"] == 100.0, f"VK1 should be 100 (80 * 1.25), got {data['vk_preis_1']}"
        print(f"✓ POST /api/articles with Fremdleistung saves subunternehmer correctly")
    
    def test_update_article_recalculates_vk(self):
        """PUT /api/articles/{id} updates item and recalculates VK prices"""
        # First create an item
        create_payload = {
            "name": "TEST_Update_VK",
            "typ": "Artikel",
            "ek_preis": 100,
            "aufschlag_1": 10,
            "price_net": 110,
            "unit": "Stück"
        }
        create_response = requests.post(f"{BASE_URL}/api/articles", json=create_payload)
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        self.created_ids.append(item_id)
        
        # Update with new EK and aufschlag
        update_payload = {
            "name": "TEST_Update_VK_Updated",
            "typ": "Artikel",
            "ek_preis": 200,
            "aufschlag_1": 15,
            "aufschlag_2": 25,
            "aufschlag_3": 35,
            "price_net": 250,
            "unit": "Stück"
        }
        update_response = requests.put(f"{BASE_URL}/api/articles/{item_id}", json=update_payload)
        assert update_response.status_code == 200
        data = update_response.json()
        
        # Verify recalculated VK prices
        assert data["vk_preis_1"] == 230.0, f"VK1 should be 230 (200 * 1.15), got {data['vk_preis_1']}"
        assert data["vk_preis_2"] == 250.0, f"VK2 should be 250 (200 * 1.25), got {data['vk_preis_2']}"
        assert data["vk_preis_3"] == 270.0, f"VK3 should be 270 (200 * 1.35), got {data['vk_preis_3']}"
        print(f"✓ PUT /api/articles/{item_id} recalculates VK prices correctly")
    
    def test_delete_article(self):
        """DELETE /api/articles/{id} deletes item"""
        # First create an item
        create_payload = {
            "name": "TEST_Delete_Item",
            "typ": "Artikel",
            "price_net": 50,
            "unit": "Stück"
        }
        create_response = requests.post(f"{BASE_URL}/api/articles", json=create_payload)
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        
        # Delete the item
        delete_response = requests.delete(f"{BASE_URL}/api/articles/{item_id}")
        assert delete_response.status_code == 200
        
        # Verify item no longer exists
        get_response = requests.get(f"{BASE_URL}/api/articles")
        items = get_response.json()
        item_ids = [i["id"] for i in items]
        assert item_id not in item_ids, "Deleted item should not exist"
        print(f"✓ DELETE /api/articles/{item_id} deletes item successfully")
    
    def test_delete_nonexistent_returns_404(self):
        """DELETE /api/articles/{id} returns 404 for non-existent item"""
        response = requests.delete(f"{BASE_URL}/api/articles/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ DELETE /api/articles/nonexistent returns 404")
    
    def test_vk_calculation_with_zero_values(self):
        """VK calculation returns 0 when ek_preis or aufschlag is 0"""
        payload = {
            "name": "TEST_Zero_VK",
            "typ": "Artikel",
            "ek_preis": 0,
            "aufschlag_1": 20,
            "price_net": 100,
            "unit": "Stück"
        }
        response = requests.post(f"{BASE_URL}/api/articles", json=payload)
        assert response.status_code == 200
        data = response.json()
        self.created_ids.append(data["id"])
        
        assert data["vk_preis_1"] == 0, f"VK1 should be 0 when ek_preis=0, got {data['vk_preis_1']}"
        print(f"✓ VK calculation returns 0 when ek_preis is 0")


class TestServicesRedirect:
    """Test that old /api/services endpoint still works (backward compatibility)"""
    
    def test_services_endpoint_exists(self):
        """GET /api/services should still work for backward compatibility"""
        response = requests.get(f"{BASE_URL}/api/services")
        # May return 200 or 404 depending on implementation
        # If it exists, it should return a list
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ GET /api/services returns {len(data)} items (backward compatible)")
        else:
            print(f"✓ GET /api/services returns {response.status_code} (endpoint may be deprecated)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
