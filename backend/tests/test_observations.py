import app.pipeline.observ as observ
from app.models.location import Location, PollutionObservation
from app.pipeline.observ import fetch_observations
from sqlalchemy import func, select


def _seed(db, names):
    for i, name in enumerate(names):
        db.add(Location(provider="osm", osm_type="node", osm_id=str(100 + i),
                        name=name, category="school", lat=28.6 + i * 0.01, lon=77.2))
    db.commit()


def test_observations_store_real_values(db, monkeypatch):
    _seed(db, ["School A", "School B"])
    # Mock the network boundary only; return 2 aligned readings, one null.
    monkeypatch.setattr(
        observ, "fetch_pm25",
        lambda coords: [
            {"lat": c[0], "lon": c[1], "value": 42.0, "time": "2026-10-10T12:00Z"} if i == 0
            else {"lat": c[0], "lon": c[1], "value": None, "time": None}
            for i, c in enumerate(coords)
        ],
    )
    r = fetch_observations(db)
    assert r["requested"] == 2
    assert r["observed_locations"] == 1  # the null reading is not stored
    count = db.scalar(select(func.count(PollutionObservation.id)))
    assert int(count) == 1


def test_observations_are_incremental(db, monkeypatch):
    _seed(db, ["Only One"])
    monkeypatch.setattr(
        observ, "fetch_pm25",
        lambda coords: [{"lat": c[0], "lon": c[1], "value": 55.5, "time": "t"} for c in coords],
    )
    first = fetch_observations(db)
    assert first["observed_locations"] == 1
    second = fetch_observations(db)
    assert second["observed_locations"] == 0  # already observed -> not re-fetched
    assert second["requested"] == 0
