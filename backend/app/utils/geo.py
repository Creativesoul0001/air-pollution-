"""Pure geospatial math for source attribution (distance, bearing, upwind geometry).

Kept free of I/O so it can be table-driven tested (see tests/test_geo.py).
"""

from __future__ import annotations

import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bearing_deg(lat_from: float, lon_from: float, lat_to: float, lon_to: float) -> float:
    """Initial great-circle bearing FROM -> TO, degrees clockwise from north (0..360)."""
    p1, p2 = math.radians(lat_from), math.radians(lat_to)
    dl = math.radians(lon_to - lon_from)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def relative_angle_diff(a: float, b: float) -> float:
    """Smallest absolute difference between two bearings (0..180)."""
    d = abs((a - b) % 360)
    return min(d, 360 - d)


def downwind_bearing_deg(wind_dir_deg: float) -> float:
    """Meteorological wind direction is the direction wind blows FROM, so the
    direction it blows TOWARD is (dir + 180) % 360."""
    return (wind_dir_deg + 180) % 360


def is_upwind(
    src_lat: float,
    src_lon: float,
    receiver_lat: float,
    receiver_lon: float,
    wind_dir_deg: float,
    tolerance_deg: float = 45.0,
) -> bool:
    """True when a source lies roughly in the direction the wind is coming from.

    `wind_dir_deg` uses the meteorological convention (direction FROM).
    """
    to_source = bearing_deg(receiver_lat, receiver_lon, src_lat, src_lon)
    return relative_angle_diff(to_source, wind_dir_deg) <= tolerance_deg
