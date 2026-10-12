"""Real training-data ingestion for the PM2.5 model.

Pulls real historical hourly air-quality (Open-Meteo archive) and weather
(Open-Meteo forecast API archive) over a grid of Delhi NCR points, merges them by
timestamp, and persists them as AirSample rows.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

import requests

from app.core.config import settings

log = logging.getLogger("dhuan.ml.dataset")

AQ_ARCHIVE = "https://air-quality-api.open-meteo.com/v1/air-quality"
FC_ARCHIVE = "https://api.open-meteo.com/v1/forecast"

AQ_VARS = [
    "pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "ozone",
    "carbon_monoxide", "aerosol_optical_depth", "european_aqi",
]
WX_VARS = [
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "temperature_2m", "relative_humidity_2m", "dew_point_2m",
    "precipitation", "cloud_cover", "boundary_layer_height", "surface_pressure",
]

_FIELD_MAP_AQ = {
    "pm2_5": "pm2_5", "pm10": "pm10", "nitrogen_dioxide": "no2",
    "sulphur_dioxide": "so2", "ozone": "o3", "carbon_monoxide": "co",
    "aerosol_optical_depth": "aod",
}
_FIELD_MAP_WX = {
    "wind_speed_10m": "wind_speed_kmh", "wind_direction_10m": "wind_direction_deg",
    "wind_gusts_10m": "wind_gusts_kmh", "temperature_2m": "temperature_c",
    "relative_humidity_2m": "humidity_pct", "dew_point_2m": "dew_point_c",
    "precipitation": "precipitation", "cloud_cover": "cloud_cover",
    "boundary_layer_height": "boundary_layer_height", "surface_pressure": "surface_pressure",
}


def default_grid(step_deg: float = 0.15) -> list[tuple[float, float]]:
    """A deterministic grid of sample locations across the Delhi NCR bbox."""
    s, w, n, e = settings.bbox
    lat = s
    points: list[tuple[float, float]] = []
    while lat <= n + 1e-9:
        lon = w
        while lon <= e + 1e-9:
            points.append((round(lat, 4), round(lon, 4)))
            lon += step_deg
        lat += step_deg
    return points


def _get(url: str, params: dict) -> dict:
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=60)
            if r.status_code == 200:
                return r.json()
            log.warning("archive status=%s url=%s attempt=%s", r.status_code, url, attempt)
        except Exception as exc:
            log.warning("archive error=%s url=%s attempt=%s", str(exc), url, attempt)
        time.sleep(2 + attempt * 3)
    raise RuntimeError(f"archive fetch failed for {url}")


def fetch_point(
    lat: float, lon: float, start: str, end: str
) -> list[dict]:
    """Fetch and merge hourly air + weather for one point over [start, end]."""
    aq = _get(
        AQ_ARCHIVE,
        {"latitude": lat, "longitude": lon, "hourly": ",".join(AQ_VARS),
         "start_date": start, "end_date": end, "timezone": "auto"},
    ).get("hourly", {})
    wx = _get(
        FC_ARCHIVE,
        {"latitude": lat, "longitude": lon, "hourly": ",".join(WX_VARS),
         "start_date": start, "end_date": end, "timezone": "auto"},
    ).get("hourly", {})

    keys = [k for k in _FIELD_MAP_WX if wx.get(k)]
    by_ts: dict[str, dict] = {}
    times = wx.get("time") or []
    for i, ts in enumerate(times):
        row: dict = {"ts": ts, "lat": lat, "lon": lon}
        for k in keys:
            row[_FIELD_MAP_WX[k]] = (wx.get(k) or [None] * len(times))[i]
        by_ts[ts] = row

    atimes = aq.get("time") or []
    merged: list[dict] = []
    for i, ts in enumerate(atimes):
        row = by_ts.get(ts)
        if row is None:
            row = {"ts": ts, "lat": lat, "lon": lon}
        for k, field in _FIELD_MAP_AQ.items():
            row[field] = (aq.get(k) or [None] * len(atimes))[i]
        merged.append(row)
    return merged


def collect(days: int = 60, grid=None, batch: int = 6) -> list[dict]:
    """Collect rows for the whole grid. Deterministic order, rate-limit friendly."""
    grid = grid or default_grid()
    today = datetime.now(timezone.utc).date()
    start = (today - timedelta(days=days)).isoformat()
    end = today.isoformat()
    rows: list[dict] = []
    for idx, (lat, lon) in enumerate(grid):
        try:
            rows.extend(fetch_point(lat, lon, start, end))
        except Exception as exc:
            log.warning("collect failed point=%s,%s err=%s", lat, lon, str(exc))
        if (idx + 1) % batch == 0:
            log.info("collected %s/%s points (%s rows)", idx + 1, len(grid), len(rows))
    return rows
