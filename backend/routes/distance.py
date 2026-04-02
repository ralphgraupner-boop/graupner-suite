from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user
from utils import send_email

router = APIRouter()


@router.post("/calculate-distance")
async def calculate_distance(data: dict, user=Depends(get_current_user)):
    """Berechnet Fahrstrecke zwischen Firmenadresse und Kundenadresse"""
    import httpx

    from_addr = data.get("from_address", "")
    to_addr = data.get("to_address", "")

    if not from_addr or not to_addr:
        raise HTTPException(status_code=400, detail="Beide Adressen erforderlich")

    async with httpx.AsyncClient() as client:
        # Geocode from
        from_resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": from_addr, "format": "json", "limit": 1},
            headers={"User-Agent": "GraupnerSuite/1.0"}
        )
        from_results = from_resp.json()
        if not from_results:
            raise HTTPException(status_code=404, detail=f"Firmenadresse nicht gefunden: {from_addr}")

        # Geocode to
        to_resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": to_addr, "format": "json", "limit": 1},
            headers={"User-Agent": "GraupnerSuite/1.0"}
        )
        to_results = to_resp.json()
        if not to_results:
            raise HTTPException(status_code=404, detail=f"Kundenadresse nicht gefunden: {to_addr}")

        from_lat, from_lon = from_results[0]["lat"], from_results[0]["lon"]
        to_lat, to_lon = to_results[0]["lat"], to_results[0]["lon"]

        # OSRM Route
        route_resp = await client.get(
            f"https://router.project-osrm.org/route/v1/driving/{from_lon},{from_lat};{to_lon},{to_lat}",
            params={"overview": "false"}
        )
        route_data = route_resp.json()

        if route_data.get("code") != "Ok" or not route_data.get("routes"):
            raise HTTPException(status_code=500, detail="Route konnte nicht berechnet werden")

        route = route_data["routes"][0]
        distance_km = round(route["distance"] / 1000, 1)
        duration_min = round(route["duration"] / 60, 0)

        # Get settings for cost calculation
        settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
        km_rate = settings.get("km_rate", 0.30)
        hourly_travel_rate = settings.get("hourly_travel_rate", 45.0)

        # Calculate costs (round trip)
        total_km = distance_km * 2
        total_minutes = duration_min * 2
        travel_hours = total_minutes / 60

        km_cost = round(total_km * km_rate, 2)
        time_cost = round(travel_hours * hourly_travel_rate, 2)
        total_cost = round(km_cost + time_cost, 2)

        return {
            "distance_km": distance_km,
            "duration_min": int(duration_min),
            "total_km_roundtrip": round(total_km, 1),
            "total_minutes_roundtrip": int(total_minutes),
            "km_rate": km_rate,
            "hourly_travel_rate": hourly_travel_rate,
            "km_cost": km_cost,
            "time_cost": time_cost,
            "total_cost": total_cost,
            "from_address": from_addr,
            "to_address": to_addr
        }
