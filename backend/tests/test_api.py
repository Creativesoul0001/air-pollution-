from app.models.location import Location, PollutionObservation


def _seed(db):
    for i, (name, cat, city) in enumerate([
        ("Sunrise Public School", "school", "New Delhi"),
        ("City Hospital Rohini", "hospital", "Delhi"),
        ("Noida Sector 18", "neighbourhood", "Noida"),
    ]):
        db.add(Location(provider="osm", osm_type="node", osm_id=str(500 + i),
                        name=name, category=cat, city=city, lat=28.6, lon=77.2))
    db.commit()
    loc = db.execute(__import__("sqlalchemy").select(Location).where(Location.name == "Noida Sector 18")).scalars().one()
    db.add(PollutionObservation(location_id=loc.id, value=88.0, source="open-meteo", observed_at="t"))
    db.commit()


def test_stats_returns_real_counts(client, db):
    _seed(db)
    r = client.get("/api/v1/locations/stats")
    assert r.status_code == 200
    b = r.json()
    assert b["total_locations"] == 3
    assert b["locations_with_observations"] == 1
    assert b["locations_with_model_estimates"] == 0
    assert "New Delhi" in b["cities"]
    assert b["by_category"]["school"] == 1
    assert b["status"] == "ok"


def test_search_matches_and_flags_observation(client, db):
    _seed(db)
    r = client.get("/api/v1/locations/search", params={"q": "school"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    assert any(x["name"] == "Sunrise Public School" for x in body["results"])

    r2 = client.get("/api/v1/locations/search", params={"q": "Sector 18"})
    hit = r2.json()["results"][0]
    assert hit["has_observation"] is True


def test_search_rejects_empty_query(client):
    r = client.get("/api/v1/locations/search", params={"q": ""})
    assert r.status_code == 422
    r2 = client.get("/api/v1/locations/search")
    assert r2.status_code == 422
