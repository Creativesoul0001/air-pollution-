from app.pipeline.overpass import build_query, categorize, coordinates


def test_categorize_maps_tags():
    assert categorize({"station": "subway"}) == "metro_station"
    assert categorize({"amenity": "school"}) == "school"
    assert categorize({"amenity": "hospital"}) == "hospital"
    assert categorize({"place": "suburb"}) == "neighbourhood"
    assert categorize({"place": "city"}) == "city"
    assert categorize({"highway": "motorway_junction"}) == "junction"
    assert categorize({"highway": "primary"}) == "major_road"
    assert categorize({"leisure": "park"}) == "park"
    assert categorize({"tourism": "hotel"}) == "landmark"
    assert categorize({}) == "poi"


def test_coordinates_node_and_way():
    assert coordinates({"type": "node", "lat": 1.0, "lon": 2.0}) == (1.0, 2.0)
    assert coordinates({"type": "way", "center": {"lat": 3.0, "lon": 4.0}}) == (3.0, 4.0)
    assert coordinates({"type": "way"}) == (None, None)


def test_build_query_scoped_to_categories():
    q = build_query(categories=["school"])
    assert "out center;" in q
    assert '["amenity"="school"]' in q
    assert '["leisure"="park"]' not in q  # other categories excluded
