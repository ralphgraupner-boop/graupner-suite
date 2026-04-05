"""
Test Kalkulation Historie feature - CRUD endpoints for calculation history
Tests: POST /api/kalkulation, GET /api/kalkulation/{article_id}, GET /api/kalkulation/{article_id}/latest
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestKalkulationHistorieEndpoints:
    """Test Kalkulation Historie CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test article ID"""
        self.test_article_id = f"TEST_article_{uuid.uuid4().hex[:8]}"
        self.test_article_name = "TEST Kalkulation Article"
    
    def test_post_kalkulation_saves_entry(self):
        """POST /api/kalkulation saves a full calculation entry to DB"""
        payload = {
            "article_id": self.test_article_id,
            "article_name": self.test_article_name,
            "ek": 100.0,
            "zeit_meister": 2.0,
            "zeit_geselle": 3.0,
            "zeit_azubi": 0.0,
            "zeit_helfer": 0.0,
            "rate_meister": 58.0,
            "rate_geselle": 45.0,
            "rate_azubi": 18.0,
            "rate_helfer": 25.0,
            "sonstige_kosten": [{"name": "Fahrtkosten", "betrag": 25.0}],
            "materialzuschlag": 10.0,
            "gewinnaufschlag": 15.0,
            "lohnkosten": 251.0,  # 2*58 + 3*45
            "sonstige_summe": 25.0,
            "zwischensumme": 376.0,  # 100 + 251 + 25
            "material_betrag": 37.6,  # 376 * 0.10
            "gewinn_betrag": 62.04,  # 413.6 * 0.15
            "vk_preis": 475.64  # 413.6 + 62.04
        }
        
        response = requests.post(f"{BASE_URL}/api/kalkulation", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "created_at" in data, "Response should contain 'created_at'"
        print(f"Created kalkulation entry with ID: {data['id']}")
        
        return data["id"]
    
    def test_get_kalkulation_historie_returns_entries(self):
        """GET /api/kalkulation/{article_id} returns history sorted by date descending"""
        # First create multiple entries
        for i in range(3):
            payload = {
                "article_id": self.test_article_id,
                "article_name": self.test_article_name,
                "ek": 100.0 + i * 10,
                "zeit_meister": 1.0 + i,
                "zeit_geselle": 2.0,
                "zeit_azubi": 0.0,
                "zeit_helfer": 0.0,
                "rate_meister": 58.0,
                "rate_geselle": 45.0,
                "rate_azubi": 18.0,
                "rate_helfer": 25.0,
                "sonstige_kosten": [],
                "materialzuschlag": 10.0,
                "gewinnaufschlag": 15.0,
                "lohnkosten": 148.0 + i * 58,
                "sonstige_summe": 0.0,
                "zwischensumme": 248.0 + i * 68,
                "material_betrag": 24.8 + i * 6.8,
                "gewinn_betrag": 40.92 + i * 11.22,
                "vk_preis": 313.72 + i * 86.02
            }
            response = requests.post(f"{BASE_URL}/api/kalkulation", json=payload)
            assert response.status_code == 200
        
        # Get history
        response = requests.get(f"{BASE_URL}/api/kalkulation/{self.test_article_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 3, f"Expected at least 3 entries, got {len(data)}"
        
        # Verify sorted by date descending (newest first)
        if len(data) >= 2:
            for i in range(len(data) - 1):
                assert data[i]["created_at"] >= data[i+1]["created_at"], "Entries should be sorted by date descending"
        
        # Verify entry structure
        entry = data[0]
        assert "article_id" in entry
        assert "vk_preis" in entry
        assert "ek" in entry
        assert "zeit_meister" in entry
        assert "materialzuschlag" in entry
        assert "gewinnaufschlag" in entry
        assert "created_at" in entry
        
        print(f"Got {len(data)} history entries for article {self.test_article_id}")
        return data
    
    def test_get_kalkulation_historie_max_20_entries(self):
        """GET /api/kalkulation/{article_id} returns max 20 entries"""
        # Create 25 entries
        for i in range(25):
            payload = {
                "article_id": f"TEST_max20_{uuid.uuid4().hex[:8]}",
                "article_name": "TEST Max 20",
                "ek": 50.0,
                "zeit_meister": 1.0,
                "zeit_geselle": 1.0,
                "zeit_azubi": 0.0,
                "zeit_helfer": 0.0,
                "rate_meister": 58.0,
                "rate_geselle": 45.0,
                "rate_azubi": 18.0,
                "rate_helfer": 25.0,
                "sonstige_kosten": [],
                "materialzuschlag": 10.0,
                "gewinnaufschlag": 15.0,
                "lohnkosten": 103.0,
                "sonstige_summe": 0.0,
                "zwischensumme": 153.0,
                "material_betrag": 15.3,
                "gewinn_betrag": 25.25,
                "vk_preis": 193.55
            }
            # Use same article_id for all
            payload["article_id"] = self.test_article_id + "_max20"
            requests.post(f"{BASE_URL}/api/kalkulation", json=payload)
        
        # Get history - should be max 20
        response = requests.get(f"{BASE_URL}/api/kalkulation/{self.test_article_id}_max20")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) <= 20, f"Expected max 20 entries, got {len(data)}"
        print(f"Max 20 limit verified: got {len(data)} entries")
    
    def test_get_latest_kalkulation_returns_most_recent(self):
        """GET /api/kalkulation/{article_id}/latest returns the most recent calculation"""
        # Create entries with different VK prices
        latest_vk = 999.99
        for i, vk in enumerate([100.0, 200.0, latest_vk]):
            payload = {
                "article_id": self.test_article_id + "_latest",
                "article_name": "TEST Latest",
                "ek": 50.0,
                "zeit_meister": 1.0,
                "zeit_geselle": 1.0,
                "zeit_azubi": 0.0,
                "zeit_helfer": 0.0,
                "rate_meister": 58.0,
                "rate_geselle": 45.0,
                "rate_azubi": 18.0,
                "rate_helfer": 25.0,
                "sonstige_kosten": [],
                "materialzuschlag": 10.0,
                "gewinnaufschlag": 15.0,
                "lohnkosten": 103.0,
                "sonstige_summe": 0.0,
                "zwischensumme": 153.0,
                "material_betrag": 15.3,
                "gewinn_betrag": 25.25,
                "vk_preis": vk
            }
            response = requests.post(f"{BASE_URL}/api/kalkulation", json=payload)
            assert response.status_code == 200
        
        # Get latest
        response = requests.get(f"{BASE_URL}/api/kalkulation/{self.test_article_id}_latest/latest")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("vk_preis") == latest_vk, f"Expected latest VK {latest_vk}, got {data.get('vk_preis')}"
        assert data.get("article_id") == self.test_article_id + "_latest"
        
        print(f"Latest kalkulation verified: VK = {data['vk_preis']}")
    
    def test_get_latest_kalkulation_empty_for_new_article(self):
        """GET /api/kalkulation/{article_id}/latest returns empty object for new article"""
        new_article_id = f"TEST_new_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/kalkulation/{new_article_id}/latest")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data == {} or data is None or len(data) == 0, f"Expected empty response for new article, got {data}"
        print("Empty response for new article verified")
    
    def test_get_kalkulation_historie_empty_for_new_article(self):
        """GET /api/kalkulation/{article_id} returns empty list for new article"""
        new_article_id = f"TEST_new_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/kalkulation/{new_article_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, f"Expected empty list for new article, got {len(data)} entries"
        print("Empty list for new article verified")
    
    def test_kalkulation_entry_has_all_fields(self):
        """Verify saved kalkulation entry contains all required fields"""
        payload = {
            "article_id": self.test_article_id + "_fields",
            "article_name": "TEST Fields Check",
            "ek": 20.0,
            "zeit_meister": 2.0,
            "zeit_geselle": 3.0,
            "zeit_azubi": 0.5,
            "zeit_helfer": 1.0,
            "rate_meister": 76.71,
            "rate_geselle": 72.12,
            "rate_azubi": 26.0,
            "rate_helfer": 68.5,
            "sonstige_kosten": [
                {"name": "Anfahrt", "betrag": 30.0},
                {"name": "Material", "betrag": 15.0}
            ],
            "materialzuschlag": 10.0,
            "gewinnaufschlag": 15.0,
            "lohnkosten": 450.28,
            "sonstige_summe": 45.0,
            "zwischensumme": 515.28,
            "material_betrag": 51.53,
            "gewinn_betrag": 85.02,
            "vk_preis": 651.83
        }
        
        response = requests.post(f"{BASE_URL}/api/kalkulation", json=payload)
        assert response.status_code == 200
        
        # Get the entry back
        response = requests.get(f"{BASE_URL}/api/kalkulation/{self.test_article_id}_fields/latest")
        assert response.status_code == 200
        
        entry = response.json()
        
        # Verify all fields
        assert entry["article_id"] == payload["article_id"]
        assert entry["article_name"] == payload["article_name"]
        assert entry["ek"] == payload["ek"]
        assert entry["zeit_meister"] == payload["zeit_meister"]
        assert entry["zeit_geselle"] == payload["zeit_geselle"]
        assert entry["zeit_azubi"] == payload["zeit_azubi"]
        assert entry["zeit_helfer"] == payload["zeit_helfer"]
        assert entry["rate_meister"] == payload["rate_meister"]
        assert entry["rate_geselle"] == payload["rate_geselle"]
        assert entry["rate_azubi"] == payload["rate_azubi"]
        assert entry["rate_helfer"] == payload["rate_helfer"]
        assert len(entry["sonstige_kosten"]) == 2
        assert entry["materialzuschlag"] == payload["materialzuschlag"]
        assert entry["gewinnaufschlag"] == payload["gewinnaufschlag"]
        assert entry["lohnkosten"] == payload["lohnkosten"]
        assert entry["sonstige_summe"] == payload["sonstige_summe"]
        assert entry["zwischensumme"] == payload["zwischensumme"]
        assert entry["material_betrag"] == payload["material_betrag"]
        assert entry["gewinn_betrag"] == payload["gewinn_betrag"]
        assert entry["vk_preis"] == payload["vk_preis"]
        assert "created_at" in entry
        assert "id" in entry
        
        print("All fields verified in saved kalkulation entry")


class TestKalkulationHistorieWithExistingArticle:
    """Test with the existing article mentioned in context"""
    
    def test_existing_article_has_history(self):
        """Check if existing article 'Einrüstkosten/Sicherheitsrelevant' has history"""
        # Get articles to find the test article
        response = requests.get(f"{BASE_URL}/api/articles")
        assert response.status_code == 200
        
        articles = response.json()
        test_article = None
        for article in articles:
            if "Einrüstkosten" in article.get("name", "") or "Sicherheitsrelevant" in article.get("name", ""):
                test_article = article
                break
        
        if not test_article:
            pytest.skip("Test article 'Einrüstkosten/Sicherheitsrelevant' not found")
        
        # Check history
        response = requests.get(f"{BASE_URL}/api/kalkulation/{test_article['id']}")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Article '{test_article['name']}' has {len(data)} history entries")
        
        if len(data) > 0:
            latest = data[0]
            print(f"Latest entry: VK={latest.get('vk_preis')}, EK={latest.get('ek')}, "
                  f"Meister={latest.get('zeit_meister')}h, Geselle={latest.get('zeit_geselle')}h")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
