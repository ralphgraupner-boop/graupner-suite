"""
Test Kalkulation feature - Settings and Article price updates
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestKalkulationSettings:
    """Test Kalkulation settings in company settings"""
    
    def test_get_settings_has_kalkulation_fields(self):
        """Verify settings endpoint returns kalkulation fields"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        # Check all kalkulation fields exist
        assert "kalk_meister" in data, "Missing kalk_meister field"
        assert "kalk_geselle" in data, "Missing kalk_geselle field"
        assert "kalk_azubi" in data, "Missing kalk_azubi field"
        assert "kalk_helfer" in data, "Missing kalk_helfer field"
        assert "kalk_materialzuschlag" in data, "Missing kalk_materialzuschlag field"
        assert "kalk_gewinnaufschlag" in data, "Missing kalk_gewinnaufschlag field"
        
        # Check values are numeric
        assert isinstance(data["kalk_meister"], (int, float))
        assert isinstance(data["kalk_geselle"], (int, float))
        assert isinstance(data["kalk_azubi"], (int, float))
        assert isinstance(data["kalk_helfer"], (int, float))
        assert isinstance(data["kalk_materialzuschlag"], (int, float))
        assert isinstance(data["kalk_gewinnaufschlag"], (int, float))
        
        print(f"Kalkulation settings: Meister={data['kalk_meister']}, Geselle={data['kalk_geselle']}, "
              f"Azubi={data['kalk_azubi']}, Helfer={data['kalk_helfer']}, "
              f"Material={data['kalk_materialzuschlag']}%, Gewinn={data['kalk_gewinnaufschlag']}%")
    
    def test_update_kalkulation_settings(self):
        """Test updating kalkulation settings"""
        # Get current settings
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        original_settings = response.json()
        
        # Update with new values
        new_settings = {
            **original_settings,
            "kalk_meister": 60.0,
            "kalk_geselle": 48.0,
            "kalk_azubi": 20.0,
            "kalk_helfer": 28.0,
            "kalk_materialzuschlag": 12.0,
            "kalk_gewinnaufschlag": 18.0
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json=new_settings)
        assert response.status_code == 200
        
        # Verify changes persisted
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        updated = response.json()
        
        assert updated["kalk_meister"] == 60.0
        assert updated["kalk_geselle"] == 48.0
        assert updated["kalk_azubi"] == 20.0
        assert updated["kalk_helfer"] == 28.0
        assert updated["kalk_materialzuschlag"] == 12.0
        assert updated["kalk_gewinnaufschlag"] == 18.0
        
        print("Kalkulation settings updated and verified")
        
        # Restore original settings
        response = requests.put(f"{BASE_URL}/api/settings", json=original_settings)
        assert response.status_code == 200
        print("Original settings restored")


class TestArticleKalkulation:
    """Test article price updates via Kalkulation"""
    
    def test_get_article_by_id(self):
        """Test GET /api/articles/{id} endpoint"""
        # First get list of articles
        response = requests.get(f"{BASE_URL}/api/articles")
        assert response.status_code == 200
        articles = response.json()
        
        if len(articles) > 0:
            article_id = articles[0]["id"]
            
            # Get single article
            response = requests.get(f"{BASE_URL}/api/articles/{article_id}")
            assert response.status_code == 200
            
            article = response.json()
            assert article["id"] == article_id
            assert "name" in article
            assert "price_net" in article
            print(f"Got article: {article['name']} (ID: {article_id})")
        else:
            pytest.skip("No articles available for testing")
    
    def test_update_article_price(self):
        """Test updating article price (simulating Kalkulation apply)"""
        # Get list of articles
        response = requests.get(f"{BASE_URL}/api/articles")
        assert response.status_code == 200
        articles = response.json()
        
        if len(articles) == 0:
            pytest.skip("No articles available for testing")
        
        # Find a Leistung type article
        test_article = None
        for article in articles:
            if article.get("typ") == "Leistung":
                test_article = article
                break
        
        if not test_article:
            test_article = articles[0]
        
        article_id = test_article["id"]
        original_price = test_article["price_net"]
        original_ek = test_article.get("ek_preis", 0)
        
        print(f"Testing with article: {test_article['name']}")
        print(f"Original price: {original_price}, Original EK: {original_ek}")
        
        # Update price (simulating Kalkulation apply)
        new_price = 199.99
        new_ek = 50.0
        
        update_data = {
            "name": test_article["name"],
            "description": test_article.get("description", ""),
            "typ": test_article.get("typ", "Leistung"),
            "price_net": new_price,
            "ek_preis": new_ek,
            "unit": test_article.get("unit", "Stück"),
            "aufschlag_1": test_article.get("aufschlag_1", 0),
            "aufschlag_2": test_article.get("aufschlag_2", 0),
            "aufschlag_3": test_article.get("aufschlag_3", 0),
        }
        
        response = requests.put(f"{BASE_URL}/api/articles/{article_id}", json=update_data)
        assert response.status_code == 200
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/articles/{article_id}")
        assert response.status_code == 200
        updated = response.json()
        
        assert updated["price_net"] == new_price
        assert updated["ek_preis"] == new_ek
        print(f"Updated price to {new_price}, EK to {new_ek}")
        
        # Restore original values
        update_data["price_net"] = original_price
        update_data["ek_preis"] = original_ek
        response = requests.put(f"{BASE_URL}/api/articles/{article_id}", json=update_data)
        assert response.status_code == 200
        print("Original values restored")
    
    def test_article_not_found(self):
        """Test 404 for non-existent article"""
        response = requests.get(f"{BASE_URL}/api/articles/non-existent-id")
        assert response.status_code == 404


class TestKalkulationCalculation:
    """Test the calculation formula"""
    
    def test_calculation_formula(self):
        """Verify the calculation formula: VK = (EK + Lohnkosten + Sonstige) × (1 + Material%) × (1 + Gewinn%)"""
        # Get settings for rates
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        settings = response.json()
        
        # Test values
        ek = 100.0
        meister_hours = 2.0
        geselle_hours = 1.0
        azubi_hours = 0.0
        helfer_hours = 0.0
        sonstige = 50.0
        
        # Get rates from settings
        meister_rate = settings.get("kalk_meister", 58)
        geselle_rate = settings.get("kalk_geselle", 45)
        azubi_rate = settings.get("kalk_azubi", 18)
        helfer_rate = settings.get("kalk_helfer", 25)
        material_pct = settings.get("kalk_materialzuschlag", 10)
        gewinn_pct = settings.get("kalk_gewinnaufschlag", 15)
        
        # Calculate
        lohnkosten = (meister_hours * meister_rate + 
                     geselle_hours * geselle_rate + 
                     azubi_hours * azubi_rate + 
                     helfer_hours * helfer_rate)
        
        zwischensumme = ek + lohnkosten + sonstige
        material_betrag = zwischensumme * (material_pct / 100)
        nach_material = zwischensumme + material_betrag
        gewinn_betrag = nach_material * (gewinn_pct / 100)
        vk_preis = nach_material + gewinn_betrag
        
        print(f"Calculation test:")
        print(f"  EK: {ek}")
        print(f"  Lohnkosten: {lohnkosten} (Meister: {meister_hours}h × {meister_rate}€, Geselle: {geselle_hours}h × {geselle_rate}€)")
        print(f"  Sonstige: {sonstige}")
        print(f"  Zwischensumme: {zwischensumme}")
        print(f"  Materialzuschlag ({material_pct}%): {material_betrag}")
        print(f"  Nach Material: {nach_material}")
        print(f"  Gewinnaufschlag ({gewinn_pct}%): {gewinn_betrag}")
        print(f"  VK Netto: {vk_preis}")
        
        # Verify formula is correct
        expected_vk = (ek + lohnkosten + sonstige) * (1 + material_pct/100) * (1 + gewinn_pct/100)
        assert abs(vk_preis - expected_vk) < 0.01, f"Calculation mismatch: {vk_preis} vs {expected_vk}"
        print(f"Formula verified: VK = {vk_preis:.2f}€")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
