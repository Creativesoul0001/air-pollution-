"""Pure feature engineering for the PM2.5 model (no I/O, table-driven tested)."""

from __future__ import annotations

import math
from datetime import datetime, timezone

FEATURE_NAMES = [
    "lat_norm",
    "lon_norm",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "doy_sin",
    "doy_cos",
    "wind_u",
    "wind_v",
    "wind_speed",
    "log_gust",
    "temperature",
    "humidity",
    "dew_point",
    "boundary_layer_height",
    "cloud_cover",
    "precipitation",
    "surface_pressure",
    "pm10",
    "no2",
    "so2",
    "o3",
    "co",
    "aod",
]

# NCR reference frame used to normalise coordinates.
LAT_REF, LON_REF, LAT_SCALE, LON_SCALE = 28.65, 77.15, 0.30, 0.35


def parse_ts(ts: str) -> datetime:
    """Parse an ISO timestamp; naive strings are treated as local (IST from provider)."""
    if isinstance(ts, datetime):
        dt = ts
    else:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _cyc(value: float, period: float) -> tuple[float, float]:
    ang = 2 * math.pi * (value % period) / period
    return math.sin(ang), math.cos(ang)


def _num(*values: float | None, default: float = 0.0) -> float:
    for v in values:
        if v is not None and v == v:  # not None and not NaN
            return float(v)
    return default


def build_features(rec: dict) -> list[float]:
    """Deterministic feature vector. Missing values fall back to documented defaults."""
    lat = _num(rec.get("lat"), rec.get("latitude"), default=LAT_REF)
    lon = _num(rec.get("lon"), rec.get("longitude"), default=LON_REF)
    dt = parse_ts(rec.get("ts") or rec.get("time") or datetime.now(timezone.utc).isoformat())

    wind_dir = _num(rec.get("wind_direction_deg"), rec.get("wind_direction"))
    wind_speed = _num(rec.get("wind_speed_kmh"), rec.get("wind_speed"))
    rad = math.radians(wind_dir)
    wind_u = -wind_speed * math.sin(rad)
    wind_v = -wind_speed * math.cos(rad)

    hour_sin, hour_cos = _cyc(dt.hour, 24)
    dow_sin, dow_cos = _cyc(dt.weekday(), 7)
    doy_sin, doy_cos = _cyc(dt.timetuple().tm_yday, 366)

    return [
        (lat - LAT_REF) / LAT_SCALE,
        (lon - LON_REF) / LON_SCALE,
        hour_sin,
        hour_cos,
        dow_sin,
        dow_cos,
        doy_sin,
        doy_cos,
        wind_u,
        wind_v,
        wind_speed,
        math.log1p(_num(rec.get("wind_gusts_kmh") or rec.get("wind_gusts"))),
        _num(rec.get("temperature_c") or rec.get("temperature")),
        _num(rec.get("humidity_pct") or rec.get("humidity")),
        _num(rec.get("dew_point_c") or rec.get("dew_point")),
        _num(rec.get("boundary_layer_height"), default=500.0) / 1000.0,
        _num(rec.get("cloud_cover")),
        _num(rec.get("precipitation")),
        _num(rec.get("surface_pressure"), default=1013.0),
        _num(rec.get("pm10")),
        _num(rec.get("no2")),
        _num(rec.get("so2")),
        _num(rec.get("o3")),
        _num(rec.get("co")),
        _num(rec.get("aod") or rec.get("aerosol_optical_depth")),
    ]
