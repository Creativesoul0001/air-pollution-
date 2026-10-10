import json
import logging
import time

import requests

from app.core.config import settings

log = logging.getLogger("dhuan.overpass")

# Real OpenStreetMap query fragments for Delhi NCR (ODbL). Each is a valid Overpass
# statement; they are unioned and emitted with `out center;` so ways return a centroid.
FRAGMENTS: dict[str, str] = {
    "city": 'node["place"~"^(city|town)$"]({s},{w},{n},{e});way["place"~"^(city|town)$"]({s},{w},{n},{e});',
    "neighbourhood": 'node["place"~"^(suburb|neighbourhood|quarter)$"]({s},{w},{n},{e});way["place"~"^(suburb|neighbourhood|quarter)$"]({s},{w},{n},{e});',
    "school": 'node["amenity"="school"]({s},{w},{n},{e});way["amenity"="school"]({s},{w},{n},{e});',
    "college": 'node["amenity"="college"]({s},{w},{n},{e});way["amenity"="college"]({s},{w},{n},{e});',
    "hospital": 'node["amenity"~"^(hospital|clinic)$"]({s},{w},{n},{e});way["amenity"~"^(hospital|clinic)$"]({s},{w},{n},{e});',
    "metro": 'node["station"="subway"]({s},{w},{n},{e});way["station"="subway"]({s},{w},{n},{e});',
    "major_road": 'way["highway"~"^(motorway|trunk|primary|secondary)$"]["name"]({s},{w},{n},{e});',
    "junction": 'node["highway"="motorway_junction"]({s},{w},{n},{e});',
    "park": 'node["leisure"="park"]({s},{w},{n},{e});way["leisure"="park"]({s},{w},{n},{e});',
    "landmark": 'node["tourism"~"^(attraction|hotel|museum|artwork)$"]({s},{w},{n},{e});way["tourism"~"^(attraction|hotel|museum)$"]({s},{w},{n},{e});node["historic"]["name"]({s},{w},{n},{e});',
}


def build_query(bbox=settings.bbox, categories=None) -> str:
    s, w, n, e = bbox
    cats = list(categories) if categories else list(FRAGMENTS)
    body = "".join(FRAGMENTS[c].format(s=s, w=w, n=n, e=e) for c in cats)
    return f"[out:json][timeout:{settings.http_timeout}];({body});out center;"


def coordinates(el: dict) -> tuple[float | None, float | None]:
    """Nodes carry lat/lon; ways return a centroid via `out center;`."""
    if el.get("type") == "node":
        return el.get("lat"), el.get("lon")
    center = el.get("center") or {}
    return center.get("lat"), center.get("lon")


def categorize(tags: dict) -> str:
    t = tags or {}
    if t.get("place") in ("city", "town"):
        return "city"
    if t.get("place") in ("suburb", "neighbourhood", "quarter"):
        return "neighbourhood"
    if t.get("station") == "subway" or t.get("railway") == "station" and t.get("station") == "subway":
        return "metro_station"
    a = t.get("amenity")
    if a == "school":
        return "school"
    if a == "college":
        return "college"
    if a in ("hospital", "clinic"):
        return "hospital"
    h = t.get("highway")
    if h == "motorway_junction":
        return "junction"
    if h in ("motorway", "trunk", "primary", "secondary"):
        return "major_road"
    if t.get("leisure") == "park":
        return "park"
    if t.get("tourism") or t.get("historic"):
        return "landmark"
    return "poi"


def fetch_osm(categories=None, attempts: int = 2) -> list[dict]:
    query = build_query(categories=categories)
    last = "unknown"
    for attempt in range(attempts):
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
                log.warning("overpass status=%s endpoint=%s", resp.status_code, endpoint)
            except Exception as exc:  # network/parse failure -> try next endpoint
                last = f"error {exc} @ {endpoint}"
                log.warning("overpass error=%s endpoint=%s", str(exc), endpoint)
        if attempt < attempts - 1:
            time.sleep(4)
    raise RuntimeError(f"all Overpass endpoints failed ({last}); no data for query")


def tags_json(el: dict) -> str:
    # keep the payload bounded for the DB column
    return json.dumps(el.get("tags", {}) or {})[:4000]
