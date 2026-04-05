from fastapi import APIRouter
from pydantic import BaseModel

from app.services.location_service import get_location_context
from app.services.weather_service import get_weather_for_coordinates


router = APIRouter(prefix="/location", tags=["Location & Weather Context"])


class LocationContextRequest(BaseModel):
    latitude: float
    longitude: float


@router.post("/context")
def location_context(request: LocationContextRequest):
    """Build live location + weather context from browser GPS coordinates."""
    location = get_location_context(request.latitude, request.longitude)
    weather = get_weather_for_coordinates(
        location.get("latitude"),
        location.get("longitude"),
        location.get("description", "your area"),
    )

    return {
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "location_description": location.get("description"),
        "city": location.get("city"),
        "region": location.get("region"),
        "country": location.get("country"),
        "safe": location.get("safe", True),
        "weather": {
            "temperature_c": weather.get("temperature_c"),
            "weather": weather.get("weather"),
            "dress_tip": weather.get("dress_tip"),
        },
    }
