"""Real ground monitoring stations.

Only sources that are actually reachable are used:
- Sensor.Community: open, keyless citizen measurements (currently 0 sensors in India).
- WAQI (aqicn.org): aggregates CPCB/DPCC/SAFAR, but requires a personal data token.

Neither is available from a clean environment, so this adapter reports
`{"status": "unavailable", "reason": ...}` rather than fabricating readings. Model
output (Open-Meteo) is NEVER returned through this adapter, so the UI can never label
a model estimate as a ground measurement.
"""

from __future__ import annotations

import logging

import requests

from app.core.config import settings

log = logging.getLogger("dhuan.ground")

# Sensor.Community value_type -> (pollutant, unit)
_SC_VALUE = {
    "P1": ("pm10", "µg/m³"),
    "P2": ("pm2_5", "µg/m³"),
}
# WAQI iaqi key -> (pollutant, unit)
_WAQI_VALUE = {
    "pm25": ("pm2_5", "µg/m³"),
    "pm10": ("pm10", "µg/m³"),
    "no2": ("no2", "µg/m³"),
    "so2": ("so2", "µg/m³"),
    "o3": ("o3", "µg/m³"),
    "co": ("co", "µg/m³"),
}


def _distance_band(lat1, lon1, lat2, lon2) -> float:
    from app.utils.geo import haversine_km

    return round(haversine_km(lat1, lon1, lat2, lon2), 3)


def sensor_community_stations(lat: float, lon: float, radius_km: float) -> tuple[list[dict], str | None]:
    """Open, keyless. Returns (stations, error_reason)."""
    try:
        resp = requests.get(
            f"{settings.sensor_community_url.rstrip('/')}/area={lat},{lon},{radius_km}",
            timeout=30,
        )
        if resp.status_code != 200:
            return [], f"Sensor.Community HTTP {resp.status_code}"
        payload = resp.json() or []
    except Exception as exc:
        return [], f"Sensor.Community unreachable: {exc}"

    stations: list[dict] = []
    for item in payload:
        sensor = item.get("sensor") or {}
        loc = sensor.get("location") or {}
        s_lat, s_lon = loc.get("latitude"), loc.get("longitude")
        if s_lat is None or s_lon is None:
            continue
        readings = []
        for dv in item.get("sensordatavalues", []):
            key = dv.get("value_type")
            if key in _SC_VALUE and dv.get("value") not in (None, ""):
                pollutant, unit = _SC_VALUE[key]
                try:
                    value = float(dv["value"])
                except (TypeError, ValueError):
                    continue
                readings.append(
                    {"pollutant": pollutant, "value": value, "unit": unit}
                )
        if not readings:
            continue
        stype = (sensor.get("sensor_type") or {}).get("name")
        stations.append(
            {
                "station": stype or f"Sensor.Community #{sensor.get('id')}",
                "network": "Sensor.Community",
                "lat": s_lat,
                "lon": s_lon,
                "distance_km": _distance_band(lat, lon, s_lat, s_lon),
                "timestamp": item.get("timestamp"),
                "readings": readings,
                "provenance": {
                    "source": "Sensor.Community (open data)",
                    "url": "https://sensor.community",
                    "licence": "community open data",
                    "type": "ground_measurement",
                },
            }
        )
    return stations, None


def waqi_station(lat: float, lon: float) -> tuple[list[dict], str | None]:
    """Requires a personal WAQI data token. Returns (stations, error_reason)."""
    if not settings.waqi_token:
        return [], "WAQI token not configured (free token required from aqicn.org/data)"
    try:
        resp = requests.get(
            f"https://api.waqi.info/feed/geo:{lat};{lon}/", params={"token": settings.waqi_token}, timeout=30
        )
        data = resp.json() or {}
        if data.get("status") != "ok":
            return [], f"WAQI returned: {data.get('data', 'unknown error')}"
        d = data.get("data", {})
    except Exception as exc:
        return [], f"WAQI unreachable: {exc}"

    geo = (d.get("city") or {}).get("geo", [None, None])
    readings = []
    for key, meta in _WAQI_VALUE.items():
        entry = (d.get("iaqi") or {}).get(key)
        if isinstance(entry, dict) and entry.get("v") is not None:
            readings.append({"pollutant": meta[0], "value": entry["v"], "unit": meta[1]})
    if not readings or geo[0] is None:
        return [], "WAQI reported no pollutant values for this location"

    attributions = [
        {"name": a.get("name"), "url": a.get("url")} for a in (d.get("attributions") or [])
    ]
    return (
        [
            {
                "station": (d.get("city") or {}).get("name"),
                "network": "WAQI (aggregation of national agencies)",
                "lat": geo[0],
                "lon": geo[1],
                "distance_km": _distance_band(lat, lon, geo[0], geo[1]),
                "timestamp": (d.get("time") or {}).get("iso"),
                "readings": readings,
                "provenance": {
                    "source": "World Air Quality Index (WAQI) — official agency feeds",
                    "url": (d.get("city") or {}).get("url"),
                    "licence": "WAQI data licence (token)",
                    "type": "ground_measurement",
                    "attributions": attributions,
                },
            }
        ],
        None,
    )


def ground_readings(lat: float, lon: float) -> dict:
    """Nearest real ground readings. Model estimates are excluded by design."""
    radius = settings.ground_radius_km
    attempts: list[str] = []

    stations, err = sensor_community_stations(lat, lon, radius)
    if stations:
        return {"status": "ok", "count": len(stations), "stations": stations, "attempts": attempts, "note": None}
    attempts.append(err or "Sensor.Community returned no sensors in range")

    stations, err = waqi_station(lat, lon)
    if stations:
        return {"status": "ok", "count": len(stations), "stations": stations, "attempts": attempts, "note": None}
    attempts.append(err or "WAQI returned no data")

    return {
        "status": "unavailable",
        "count": 0,
        "stations": [],
        "attempts": attempts,
        "note": (
            "No ground monitoring readings are reachable without credentials. These values are "
            "NOT shown; model estimates are reported separately and are never labelled as station data."
        ),
    }
