import logging

import requests

log = logging.getLogger("dhuan.providers")

AQ_VARS = "pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide"
AQ_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality"
FC_BASE = "https://api.open-meteo.com/v1/forecast"


def current_air(lat: float, lon: float) -> dict:
    """Real current air-quality values from Open-Meteo (keyless). Labeled as model data,
    not a ground monitoring station."""
    resp = requests.get(
        AQ_BASE,
        params={"latitude": lat, "longitude": lon, "current": AQ_VARS, "timezone": "auto"},
        timeout=30,
    )
    resp.raise_for_status()
    cur = resp.json().get("current", {})
    return {
        "time": cur.get("time"),
        "pollutants": {
            "pm2_5": cur.get("pm2_5"),
            "pm10": cur.get("pm10"),
            "no2": cur.get("nitrogen_dioxide"),
            "so2": cur.get("sulphur_dioxide"),
            "o3": cur.get("ozone"),
            "co": cur.get("carbon_monoxide"),
        },
        "provider": "Open-Meteo (current, model assimilation)",
        "units": {k: "µg/m³" for k in ("pm2_5", "pm10", "no2", "so2", "o3", "co")},
    }


def current_weather(lat: float, lon: float) -> dict:
    """Real current wind + weather from Open-Meteo (keyless)."""
    resp = requests.get(
        FC_BASE,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m",
            "timezone": "auto",
        },
        timeout=30,
    )
    resp.raise_for_status()
    cur = resp.json().get("current", {})
    return {
        "time": cur.get("time"),
        "wind_speed_kmh": cur.get("wind_speed_10m"),
        "wind_direction_deg": cur.get("wind_direction_10m"),
        "temperature_c": cur.get("temperature_2m"),
        "humidity_pct": cur.get("relative_humidity_2m"),
        "provider": "Open-Meteo (current, model)",
    }
