"""
Test suite for Distance Calculation / Fahrtkosten feature
Tests the /api/calculate-distance endpoint which uses:
- OpenStreetMap Nominatim for geocoding
- OSRM for routing
- Settings for km_rate and hourly_travel_rate
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDistanceCalculation:
    """Tests for POST /api/calculate-distance endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("token")
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_calculate_distance_with_to_address(self):
        """Test: POST /api/calculate-distance with to_address returns distance_km, duration_minutes, km_cost, time_cost, total_cost"""
        # Use real addresses for external API test
        response = self.session.post(
            f"{BASE_URL}/api/calculate-distance",
            params={"token": self.token},
            json={"to_address": "Hamburg, Germany"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        assert "distance_km" in data, "Response missing distance_km"
        assert "duration_minutes" in data, "Response missing duration_minutes"
        assert "km_cost" in data, "Response missing km_cost"
        assert "time_cost" in data, "Response missing time_cost"
        assert "total_cost" in data, "Response missing total_cost"
        
        # Verify data types
        assert isinstance(data["distance_km"], (int, float)), "distance_km should be numeric"
        assert isinstance(data["duration_minutes"], (int, float)), "duration_minutes should be numeric"
        assert isinstance(data["km_cost"], (int, float)), "km_cost should be numeric"
        assert isinstance(data["time_cost"], (int, float)), "time_cost should be numeric"
        assert isinstance(data["total_cost"], (int, float)), "total_cost should be numeric"
        
        # Verify values are reasonable (Berlin to Hamburg is ~280-300km)
        assert data["distance_km"] > 200, f"Distance too short: {data['distance_km']} km"
        assert data["distance_km"] < 400, f"Distance too long: {data['distance_km']} km"
        assert data["duration_minutes"] > 100, f"Duration too short: {data['duration_minutes']} min"
        assert data["duration_minutes"] < 300, f"Duration too long: {data['duration_minutes']} min"
        
        # Verify cost calculation (km_rate=0.30, hourly_travel_rate=45 from settings)
        assert data["km_cost"] > 0, "km_cost should be positive"
        assert data["time_cost"] > 0, "time_cost should be positive"
        assert data["total_cost"] == round(data["km_cost"] + data["time_cost"], 2), "total_cost should be km_cost + time_cost"
        
        print(f"✓ Distance calculation successful: {data['distance_km']} km, {data['duration_minutes']} min, {data['total_cost']} € total")
    
    def test_calculate_distance_uses_company_address_from_settings(self):
        """Test: POST /api/calculate-distance uses company_address from settings as from_address when not provided"""
        # First verify settings have company_address
        settings_res = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        assert settings_res.status_code == 200
        settings = settings_res.json()
        
        # Ensure company_address is set (should be "Berlin, Germany" from previous tests)
        if not settings.get("company_address"):
            # Set it if not present
            settings["company_address"] = "Berlin, Germany"
            update_res = self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=settings
            )
            assert update_res.status_code == 200
        
        # Now test distance calculation without from_address
        response = self.session.post(
            f"{BASE_URL}/api/calculate-distance",
            params={"token": self.token},
            json={"to_address": "Munich, Germany"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify from_address is the company address from settings
        assert "from_address" in data, "Response should include from_address"
        assert "Berlin" in data["from_address"] or "berlin" in data["from_address"].lower(), \
            f"from_address should be Berlin (company address), got: {data['from_address']}"
        
        # Berlin to Munich is ~580-600km
        assert data["distance_km"] > 500, f"Distance too short for Berlin-Munich: {data['distance_km']} km"
        assert data["distance_km"] < 700, f"Distance too long for Berlin-Munich: {data['distance_km']} km"
        
        print(f"✓ Company address used as from_address: {data['from_address']} -> {data['to_address']}")
    
    def test_calculate_distance_returns_400_without_company_address(self):
        """Test: POST /api/calculate-distance returns 400 if no company_address in settings and no from_address provided"""
        # First, save current settings
        settings_res = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        assert settings_res.status_code == 200
        original_settings = settings_res.json()
        original_company_address = original_settings.get("company_address", "")
        
        try:
            # Clear company_address
            original_settings["company_address"] = ""
            update_res = self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=original_settings
            )
            assert update_res.status_code == 200
            
            # Now try to calculate distance without from_address
            response = self.session.post(
                f"{BASE_URL}/api/calculate-distance",
                params={"token": self.token},
                json={"to_address": "Hamburg, Germany"}
            )
            
            assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "detail" in data, "Error response should have detail field"
            # German error message expected
            assert "Firmenstandort" in data["detail"] or "Start" in data["detail"] or "adresse" in data["detail"].lower(), \
                f"Error should mention missing company address, got: {data['detail']}"
            
            print(f"✓ Correctly returns 400 when no company_address: {data['detail']}")
            
        finally:
            # Restore original company_address
            original_settings["company_address"] = original_company_address
            self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=original_settings
            )
    
    def test_calculate_distance_with_explicit_from_address(self):
        """Test: POST /api/calculate-distance with explicit from_address overrides settings"""
        response = self.session.post(
            f"{BASE_URL}/api/calculate-distance",
            params={"token": self.token},
            json={
                "from_address": "Frankfurt, Germany",
                "to_address": "Cologne, Germany"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify from_address is Frankfurt (not Berlin from settings)
        assert "Frankfurt" in data["from_address"] or "frankfurt" in data["from_address"].lower(), \
            f"from_address should be Frankfurt, got: {data['from_address']}"
        
        # Frankfurt to Cologne is ~180-200km
        assert data["distance_km"] > 150, f"Distance too short for Frankfurt-Cologne: {data['distance_km']} km"
        assert data["distance_km"] < 250, f"Distance too long for Frankfurt-Cologne: {data['distance_km']} km"
        
        print(f"✓ Explicit from_address used: {data['from_address']} -> {data['to_address']}, {data['distance_km']} km")
    
    def test_calculate_distance_requires_authentication(self):
        """Test: POST /api/calculate-distance requires authentication"""
        # Request without token
        response = requests.post(
            f"{BASE_URL}/api/calculate-distance",
            json={"to_address": "Hamburg, Germany"}
        )
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        print("✓ Endpoint correctly requires authentication")
    
    def test_calculate_distance_invalid_address(self):
        """Test: POST /api/calculate-distance returns 400 for invalid/unfindable address"""
        response = self.session.post(
            f"{BASE_URL}/api/calculate-distance",
            params={"token": self.token},
            json={"to_address": "xyznonexistentaddress12345"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid address, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should have detail field"
        print(f"✓ Correctly returns 400 for invalid address: {data['detail']}")
    
    def test_calculate_distance_missing_to_address(self):
        """Test: POST /api/calculate-distance returns 400 when to_address is missing"""
        response = self.session.post(
            f"{BASE_URL}/api/calculate-distance",
            params={"token": self.token},
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400 for missing to_address, got {response.status_code}"
        print("✓ Correctly returns 400 when to_address is missing")


class TestSettingsForFahrtkosten:
    """Tests for Settings endpoint - Fahrtkosten fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("token")
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_settings_has_fahrtkosten_fields(self):
        """Test: Settings endpoint returns company_address, km_rate, hourly_travel_rate fields"""
        response = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify Fahrtkosten fields exist
        assert "company_address" in data, "Settings missing company_address field"
        assert "km_rate" in data, "Settings missing km_rate field"
        assert "hourly_travel_rate" in data, "Settings missing hourly_travel_rate field"
        
        # Verify data types
        assert isinstance(data["km_rate"], (int, float)), "km_rate should be numeric"
        assert isinstance(data["hourly_travel_rate"], (int, float)), "hourly_travel_rate should be numeric"
        
        print(f"✓ Settings has Fahrtkosten fields: company_address='{data['company_address']}', km_rate={data['km_rate']}, hourly_travel_rate={data['hourly_travel_rate']}")
    
    def test_settings_update_fahrtkosten_fields(self):
        """Test: Settings endpoint accepts and stores company_address, km_rate, hourly_travel_rate fields"""
        # Get current settings
        get_res = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        assert get_res.status_code == 200
        settings = get_res.json()
        
        # Save original values
        original_company_address = settings.get("company_address", "")
        original_km_rate = settings.get("km_rate", 0.30)
        original_hourly_rate = settings.get("hourly_travel_rate", 45.0)
        
        try:
            # Update with new values
            settings["company_address"] = "TEST_Dresden, Germany"
            settings["km_rate"] = 0.35
            settings["hourly_travel_rate"] = 50.0
            
            update_res = self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=settings
            )
            
            assert update_res.status_code == 200, f"Expected 200, got {update_res.status_code}: {update_res.text}"
            
            # Verify update response
            updated = update_res.json()
            assert updated["company_address"] == "TEST_Dresden, Germany", "company_address not updated"
            assert updated["km_rate"] == 0.35, "km_rate not updated"
            assert updated["hourly_travel_rate"] == 50.0, "hourly_travel_rate not updated"
            
            # Verify persistence with GET
            verify_res = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
            assert verify_res.status_code == 200
            verified = verify_res.json()
            
            assert verified["company_address"] == "TEST_Dresden, Germany", "company_address not persisted"
            assert verified["km_rate"] == 0.35, "km_rate not persisted"
            assert verified["hourly_travel_rate"] == 50.0, "hourly_travel_rate not persisted"
            
            print("✓ Settings Fahrtkosten fields can be updated and persisted")
            
        finally:
            # Restore original values
            settings["company_address"] = original_company_address
            settings["km_rate"] = original_km_rate
            settings["hourly_travel_rate"] = original_hourly_rate
            self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=settings
            )
    
    def test_distance_calculation_uses_updated_rates(self):
        """Test: Distance calculation uses km_rate and hourly_travel_rate from settings"""
        # Get current settings
        get_res = self.session.get(f"{BASE_URL}/api/settings", params={"token": self.token})
        assert get_res.status_code == 200
        settings = get_res.json()
        
        # Save original values
        original_km_rate = settings.get("km_rate", 0.30)
        original_hourly_rate = settings.get("hourly_travel_rate", 45.0)
        original_company_address = settings.get("company_address", "")
        
        try:
            # Set known rates and company address
            settings["company_address"] = "Berlin, Germany"
            settings["km_rate"] = 0.50  # 50 cents per km
            settings["hourly_travel_rate"] = 60.0  # 60€ per hour
            
            update_res = self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=settings
            )
            assert update_res.status_code == 200
            
            # Calculate distance
            calc_res = self.session.post(
                f"{BASE_URL}/api/calculate-distance",
                params={"token": self.token},
                json={"to_address": "Hamburg, Germany"}
            )
            
            assert calc_res.status_code == 200, f"Expected 200, got {calc_res.status_code}: {calc_res.text}"
            
            data = calc_res.json()
            
            # Verify rates are returned
            assert data.get("km_rate") == 0.50, f"Expected km_rate 0.50, got {data.get('km_rate')}"
            assert data.get("hourly_rate") == 60.0, f"Expected hourly_rate 60.0, got {data.get('hourly_rate')}"
            
            # Verify cost calculation
            expected_km_cost = round(data["distance_km"] * 0.50, 2)
            expected_time_cost = round((data["duration_minutes"] / 60) * 60.0, 2)
            
            assert abs(data["km_cost"] - expected_km_cost) < 0.1, \
                f"km_cost mismatch: expected ~{expected_km_cost}, got {data['km_cost']}"
            assert abs(data["time_cost"] - expected_time_cost) < 0.1, \
                f"time_cost mismatch: expected ~{expected_time_cost}, got {data['time_cost']}"
            
            print(f"✓ Distance calculation uses settings rates: km_rate={data['km_rate']}, hourly_rate={data['hourly_rate']}")
            print(f"  km_cost={data['km_cost']} €, time_cost={data['time_cost']} €, total={data['total_cost']} €")
            
        finally:
            # Restore original values
            settings["company_address"] = original_company_address
            settings["km_rate"] = original_km_rate
            settings["hourly_travel_rate"] = original_hourly_rate
            self.session.put(
                f"{BASE_URL}/api/settings",
                params={"token": self.token},
                json=settings
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
