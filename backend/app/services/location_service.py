import requests

from app.services.llm_service import ask_llm


LOCATION_SYSTEM_PROMPT = """
You are a gentle AI assistant for someone with dementia.
They are asking where they are. Reassure them calmly and simply.
Use the provided location details.
Keep it to 2-3 sentences. Be warm and grounding.
Never mention dementia or memory loss.
"""

FALLBACK_LOCATION = {
    "description": "your home in Vancouver",
    "city": "Vancouver",
    "region": "British Columbia",
    "country": "Canada",
    "latitude": None,
    "longitude": None,
    "safe": True,
}

NOMINATIM_USER_AGENT = "memoria-ai/1.0 (care-assistant)"


def get_live_location() -> dict:
    """Use a free IP geolocation API for approximate location."""
    url = "https://ipapi.co/json/"

    try:
        response = requests.get(url, timeout=8)
        if not response.ok:
            return FALLBACK_LOCATION

        payload = response.json()
        city = payload.get("city")
        region = payload.get("region")
        country = payload.get("country_name")
        lat = payload.get("latitude")
        lon = payload.get("longitude")

        if city and region and country:
            description = f"{city}, {region}, {country}"
        elif city and country:
            description = f"{city}, {country}"
        else:
            description = FALLBACK_LOCATION["description"]

        return {
            "description": description,
            "city": city,
            "region": region,
            "country": country,
            "latitude": lat,
            "longitude": lon,
            "safe": True,
        }
    except requests.RequestException:
        return FALLBACK_LOCATION


def get_location_from_coordinates(latitude: float, longitude: float) -> dict:
    """Use free OpenStreetMap reverse geocoding for browser GPS coordinates."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": latitude,
        "lon": longitude,
        "format": "jsonv2",
        "addressdetails": 1,
    }
    headers = {"User-Agent": NOMINATIM_USER_AGENT}

    try:
        response = requests.get(url, params=params, headers=headers, timeout=8)
        if not response.ok:
            return {
                **FALLBACK_LOCATION,
                "latitude": latitude,
                "longitude": longitude,
            }

        payload = response.json()
        address = payload.get("address", {})
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("hamlet")
        )
        region = address.get("state") or address.get("region")
        country = address.get("country")

        if city and region and country:
            description = f"{city}, {region}, {country}"
        elif city and country:
            description = f"{city}, {country}"
        elif payload.get("display_name"):
            description = payload["display_name"].split(",", 3)[0:3]
            description = ", ".join(description)
        else:
            description = FALLBACK_LOCATION["description"]

        return {
            "description": description,
            "city": city,
            "region": region,
            "country": country,
            "latitude": latitude,
            "longitude": longitude,
            "safe": True,
        }
    except requests.RequestException:
        return {
            **FALLBACK_LOCATION,
            "latitude": latitude,
            "longitude": longitude,
        }


def get_location_context(latitude: float | None = None, longitude: float | None = None) -> dict:
    """Return location context from browser GPS when available, else IP fallback."""
    if latitude is not None and longitude is not None:
        return get_location_from_coordinates(latitude, longitude)
    return get_live_location()


def normalize_location_context(context: dict | None) -> dict:
    """Accept multiple context key shapes and normalize for downstream services."""
    if not context:
        return {}

    description = context.get("description") or context.get("location_description")
    city = context.get("city")
    region = context.get("region")
    country = context.get("country")
    latitude = context.get("latitude")
    longitude = context.get("longitude")
    safe = context.get("safe", True)

    if not description:
        if city and region and country:
            description = f"{city}, {region}, {country}"
        elif city and country:
            description = f"{city}, {country}"
        else:
            description = FALLBACK_LOCATION["description"]

    return {
        "description": description,
        "city": city,
        "region": region,
        "country": country,
        "latitude": latitude,
        "longitude": longitude,
        "safe": safe,
    }


def get_location_response(query: str, location_context: dict | None = None) -> dict:
    live_location = normalize_location_context(location_context) if location_context else get_live_location()
    response = ask_llm(
        system_prompt=LOCATION_SYSTEM_PROMPT,
        user_message=(
            f"User asked: '{query}'\n"
            f"Actual location details: {live_location['description']}"
        ),
    )
    return {
        "location": live_location["description"],
        "safe": live_location["safe"],
        "city": live_location.get("city"),
        "region": live_location.get("region"),
        "country": live_location.get("country"),
        "latitude": live_location.get("latitude"),
        "longitude": live_location.get("longitude"),
        "response": response,
    }