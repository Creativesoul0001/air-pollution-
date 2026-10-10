from app.pipeline.ingest import ingest_locations

# Elements shaped like real Overpass output (`out center;`).
ELEMENTS = [
    {"type": "node", "id": 1, "lat": 28.60, "lon": 77.20,
     "tags": {"amenity": "school", "name": "ABC School", "addr:city": "New Delhi"}},
    {"type": "node", "id": 1, "lat": 28.60, "lon": 77.20,  # duplicate in same batch
     "tags": {"amenity": "school", "name": "ABC School"}},
    {"type": "node", "id": 2, "lat": 28.61, "lon": 77.21, "tags": {"place": "city", "name": "Noida"}},
    {"type": "way", "id": 10, "center": {"lat": 28.62, "lon": 77.22},
     "tags": {"leisure": "park", "name": "Central Park"}},
    {"type": "way", "id": 11, "tags": {"leisure": "park", "name": "No centroid"}},  # skipped
]


def test_first_ingest_counts(db):
    r = ingest_locations(db, ELEMENTS)
    assert r == {"added": 3, "duplicates": 1, "skipped_no_center": 1, "input": 5}


def test_reingest_is_idempotent_no_duplicates(db):
    ingest_locations(db, ELEMENTS)
    r = ingest_locations(db, ELEMENTS)
    assert r["added"] == 0
    assert r["duplicates"] == 4
    assert r["skipped_no_center"] == 1


def test_categories_and_fields_persist(db):
    ingest_locations(db, ELEMENTS)
    from sqlalchemy import select
    from app.models.location import Location

    rows = db.execute(select(Location)).scalars().all()
    by = {r.osm_id: r for r in rows}
    assert by["1"].category == "school"
    assert by["2"].category == "city"
    assert by["10"].category == "park"
    assert by["1"].city == "New Delhi"
    assert all(r.attribution.startswith("© OpenStreetMap") for r in rows)
