import requests


WEATHER_CODE_MAP = {
    0: "clear skies",
    1: "mostly clear skies",
    2: "partly cloudy skies",
    3: "overcast skies",
    45: "foggy conditions",
    48: "freezing fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "heavy drizzle",
    56: "light freezing drizzle",
    57: "heavy freezing drizzle",
    61: "light rain",
    63: "moderate rain",
    65: "heavy rain",
    66: "light freezing rain",
    67: "heavy freezing rain",
    71: "light snowfall",
    73: "moderate snowfall",
    75: "heavy snowfall",
    77: "snow grains",
    80: "light rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    85: "light snow showers",
    86: "heavy snow showers",
    95: "a thunderstorm",
    96: "a thunderstorm with light hail",
    99: "a thunderstorm with heavy hail",
}


def _dress_tip(temp_c: float, weather_text: str) -> str:
    weather_text = weather_text.lower()
    if "thunderstorm" in weather_text or "rain" in weather_text or "drizzle" in weather_text:
        return "It may be wet outside, so bring a rain jacket or umbrella."
    if temp_c <= 5:
        return "It's cold outside, so wear a warm coat and layers."
    if temp_c <= 14:
        return "It's cool outside, so a light jacket would be a good idea."
    if temp_c >= 28:
        return "It's warm outside, so wear light clothes and stay hydrated."
    return "The weather is mild, so dress comfortably if you go outside."


def get_weather_for_coordinates(
    latitude: float | None,
    longitude: float | None,
    location_description: str = "your area",
) -> dict:
    lat = latitude
    lon = longitude

    if lat is None or lon is None:
        response = (
            f"I couldn't read your exact weather right now, but you're in {location_description}. "
            "Please check your local weather app before heading outside."
        )
        return {
            "response": response,
            "location": location_description,
            "temperature_c": None,
            "weather": "unknown",
            "dress_tip": "Please check a weather app before going out.",
        }

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "timezone": "auto",
    }

    try:
        response = requests.get(url, params=params, timeout=8)
        if not response.ok:
            raise requests.RequestException(f"Weather API status {response.status_code}")
        payload = response.json()
        current = payload.get("current_weather", {})
        temp_c = current.get("temperature")
        weather_code = current.get("weathercode")
        weather_text = WEATHER_CODE_MAP.get(weather_code, "current weather conditions")

        if temp_c is None:
            raise ValueError("Temperature missing from weather response")

        tip = _dress_tip(float(temp_c), weather_text)
        natural = (
            f"Right now in {location_description}, it's about {temp_c}°C with {weather_text}. "
            f"{tip}"
        )

        return {
            "response": natural,
            "location": location_description,
            "temperature_c": temp_c,
            "weather": weather_text,
            "dress_tip": tip,
        }
    except (requests.RequestException, ValueError):
        natural = (
            f"I couldn't fetch the latest weather in {location_description} right now. "
            "Please check your weather app before going outside."
        )
        return {
            "response": natural,
            "location": location_description,
            "temperature_c": None,
            "weather": "unavailable",
            "dress_tip": "Please check your weather app before going out.",
        }


def get_weather_response(location_context: dict | None = None) -> dict:
    ctx = location_context or {}
    return get_weather_for_coordinates(
        ctx.get("latitude"),
        ctx.get("longitude"),
        ctx.get("description") or ctx.get("location_description") or "your area",
    )