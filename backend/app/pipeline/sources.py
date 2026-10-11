"""Real nearby pollution-source discovery from OpenStreetMap (Overpass, ODbL).

Sources are mapped features that plausibly emit air pollutants. Each returned source
carries its OSM identifiers so evidence can be traced back to the map.
"""

from __future__ import annotations

import logging
import math
import time

import requests

from app.core.config import settings
from app.pipeline.overpass import coordinates
from app.utils.geo import haversine_km

log = logging.getLogger("dhuan.sources")

# Plausibility of emitting air pollutants, per type (transparent heuristic, not causation).
SOURCE_RULES: list[tuple[str, tuple[str, ...], str, tuple[str, ...]]] = [
    # (osm_key, matching_values, source_type, pollutants)
    (("landuse",), ("landfill",), "landfill", ("pm2_5", "pm10")),
    (("landuse",), ("construction",), "construction_site", ("pm10", "pm2_5")),
    (("landuse",), ("industrial",), "industrial_zone", ("pm2_5", "no2", "so2")),
    (("amenity",), ("waste_transfer_station", "waste_disposal", "recycling"), "waste_facility", ("pm2_5", "pm10")),
    (("man_made",), ("works", "wastewater_plant", "chimney", "kiln"), "industrial_facility", ("pm2_5", "no2")),
    (("power",), ("plant",), "power_plant", ("so2", "no2", "pm2_5")),
    (("power",), ("generator",), "generator", ("no2", "pm2_5")),
    (("highway",), ("motorway_junction",), "traffic_junction", ("no2", "pm2_5")),
    (("highway",), ("motorway", "trunk", "primary", "secondary"), "major_road", ("pm2_5", "pm10", "no2")),
    (("railway",), ("rail",), "railway", ("pm2_5", "pm10")),
    (("historic",), ("brick_kiln",), "brick_kiln", ("pm2_5", "pm10")),
]

_PLAUSIBILITY = {
    "landfill": "high",
    "brick_kiln": "high",
    "industrial_zone": "high",
    "power_plant": "medium",
    "construction_site": "medium",
    "waste_facility": "medium",
    "generator": "medium",
    "traffic_junction": "medium",
    "major_road": "medium",
    "industrial_facility": "low",
    "railway": "low",
    "unknown": "low",
}

_LABEL = {
    "landfill": "Landfill / waste dump",
    "construction_site": "Construction site",
    "industrial_zone": "Industrial zone",
    "waste_facility": "Waste / recycling facility",
    "industrial_facility": "Industrial facility (works/chimney)",
    "power_plant": "Power plant",
    "generator": "Diesel generator",
    "traffic_junction": "Traffic junction",
    "major_road": "Major road",
    "railway": "Railway",
    "brick_kiln": "Brick kiln",
    "unknown": "Mapped feature",
}


def classify(tags: dict) -> tuple[str, str, tuple[str, ...]]:
    """Map OSM tags -> (source_type, label, plausible_pollutants)."""
    t = tags or {}
    for keys, values, s_type, pollutants in SOURCE_RULES:
        if any(t.get(k) in values for k in keys):
            return s_type, _LABEL[s_type], pollutants
    return "unknown", _LABEL["unknown"], ("pm2_5",)


def bbox_around(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    d_lat = radius_km / 110.574
    d_lon = radius_km / (111.320 * max(0.15, math.cos(math.radians(lat))))
    return (lat - d_lat, lon - d_lon, lat + d_lat, lon + d_lon)


def build_sources_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    body = "".join(
        f'way["{k}"~"{ "|".join(vals) }"]({s},{w},{n},{e});node["{k}"~"{ "|".join(vals) }"]({s},{w},{n},{e});'
        for (k,), vals, _st, _p in SOURCE_RULES
        if k != "historic"  # historic=brick_kiln only exists as node/way values in RULE set
    )
    # brick kilns are tagged on location objects, add explicitly
    body += f'node["historic"="brick_kiln"]({s},{w},{n},{e});way["historic"="brick_kiln"]({s},{w},{n},{e});'
    return f"[out:json][timeout:{settings.http_timeout}];({body});out center;"


def post_query(query: str) -> list[dict]:
    """POST an Overpass query, trying each configured mirror. Raises on total failure."""
    last = "unknown"
    for attempt in range(2):
        for endpoint in settings.overpass_endpoints:
            try:
                resp = requests.post(
                    endpoint,
                    data={"data": query},
                    headers={"User-Agent": settings.http_user_agent},
                    timeout=settings.http_timeout,
                )
                if resp.status_code == 200:
                    return resp.json().get("elements", [])
                last = f"status {resp.status_code} @ {endpoint}"
            except Exception as exc:
                last = f"error {exc} @ {endpoint}"
        if attempt == 0:
            time.sleep(3)
    raise RuntimeError(f"Overpass query failed ({last})")


def nearby_sources(lat: float, lon: float, radius_km: float | None = None, limit: int | None = None) -> dict:
    """Discover mapped pollution sources within `radius_km` of a point (real OSM data)."""
    radius_km = radius_km if radius_km is not None else settings.sources_radius_km
    limit = limit if limit is not None else settings.sources_limit

    bbox = bbox_around(lat, lon, radius_km)
    elements = post_query(build_sources_query(bbox))

    seen: set[tuple[str, str]] = set()
    sources: list[dict] = []
    for el in elements:
        osm_type, osm_id = el.get("type"), str(el.get("id"))
        if (osm_type, osm_id) in seen:
            continue
        seen.add((osm_type, osm_id))

        s_lat, s_lon = coordinates(el)
        if s_lat is None or s_lon is None:
            continue
        tags = el.get("tags", {}) or {}
        s_type, label, pollutants = classify(tags)
        if s_type == "unknown":
            continue
        sources.append(
            {
                "type": s_type,
                "label": label,
                "name": tags.get("name"),
                "lat": float(s_lat),
                "lon": float(s_lon),
                "distance_km": round(haversine_km(lat, lon, float(s_lat), float(s_lon)), 3),
                "bearing_deg": None,  # filled by caller with wind context
                "plausibility": _PLAUSIBILITY.get(s_type, "low"),
                "pollutants": list(pollutants),
                "osm_type": osm_type,
                "osm_id": osm_id,
                "osm_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            }
        )

    sources.sort(key=lambda s: s["distance_km"])
    return {
        "count": min(len(sources), limit),
        "total_found": len(sources),
        "radius_km": radius_km,
        "bbox": {"south": bbox[0], "west": bbox[1], "north": bbox[2], "east": bbox[3]},
        "provenance": "OpenStreetMap (Overpass API) — © OpenStreetMap contributors, ODbL",
        "sources": sources[:limit],
    }
