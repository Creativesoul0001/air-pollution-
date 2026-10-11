import copy

import pytest

from app.pipeline.sources import bbox_around, classify, nearby_sources

FIXTURE_ELEMENTS = [
    # landfill, ~1 km north (will be upwind when wind is from the north)
    {"type": "node", "id": 101, "lat": 28.6459, "lon": 77.2167, "tags": {"landuse": "landfill", "name": "Test Landfill"}},
    # industrial zone, ~1 km south (downwind when wind is from the north)
    {"type": "way", "id": 202, "center": {"lat": 28.6171, "lon": 77.2167}, "tags": {"landuse": "industrial", "name": "Test Industry"}},
    # duplicate of the landfill in the same response
    {"type": "node", "id": 101, "lat": 28.6459, "lon": 77.2167, "tags": {"landuse": "landfill"}},
    # a way with no centroid at all
    {"type": "way", "id": 303, "tags": {"landuse": "construction"}},
    # not a source type at all
    {"type": "node", "id": 404, "lat": 28.63, "lon": 77.22, "tags": {"amenity": "cafe"}},
    # traffic junction close by
    {"type": "node", "id": 505, "lat": 28.632, "lon": 77.218, "tags": {"highway": "motorway_junction"}},
]


def test_classify_maps_osm_tags():
    assert classify({"landuse": "landfill"})[0] == "landfill"
    assert classify({"landuse": "construction"})[0] == "construction_site"
    assert classify({"power": "plant"})[0] == "power_plant"
    assert classify({"highway": "motorway_junction"})[0] == "traffic_junction"
    assert classify({"historic": "brick_kiln"})[0] == "brick_kiln"
    assert classify({"amenity": "cafe"})[0] == "unknown"


def test_bbox_around_grows_with_radius():
    s, w, n, e = bbox_around(28.6, 77.2, 10)
    assert n > 28.6 > s
    assert e > 77.2 > w
    s2, w2, n2, e2 = bbox_around(28.6, 77.2, 20)
    assert n2 > n and s2 < s


def test_nearby_sources_normalises_and_dedupes(monkeypatch):
    import app.pipeline.sources as sources

    monkeypatch.setattr(sources, "post_query", lambda query: copy.deepcopy(FIXTURE_ELEMENTS))
    res = nearby_sources(28.6315, 77.2167, radius_km=5, limit=10)

    assert res["count"] == 3  # landfill, industrial, junction (cafe + no-centroid way dropped)
    assert res["total_found"] == 3
    ids = [f"{s['osm_type']}/{s['osm_id']}" for s in res["sources"]]
    assert ids.count("node/101") == 1, "duplicate must be deduplicated"
    # sorted by distance ascending
    dists = [s["distance_km"] for s in res["sources"]]
    assert dists == sorted(dists)
    assert res["provenance"].startswith("OpenStreetMap")
    assert all("osm_url" in s for s in res["sources"])


def test_nearby_sources_respects_limit(monkeypatch):
    import app.pipeline.sources as sources

    monkeypatch.setattr(sources, "post_query", lambda query: copy.deepcopy(FIXTURE_ELEMENTS))
    res = nearby_sources(28.6315, 77.2167, radius_km=5, limit=2)
    assert res["count"] == 2
    assert res["total_found"] == 3


def test_nearby_sources_empty(monkeypatch):
    import app.pipeline.sources as sources

    monkeypatch.setattr(sources, "post_query", lambda query: [])
    res = nearby_sources(28.63, 77.21, radius_km=3)
    assert res["count"] == 0
    assert res["sources"] == []
