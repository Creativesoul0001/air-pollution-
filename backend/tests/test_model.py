import math

import pytest

from app.api.routes import model as model_route
from app.ml.features import FEATURE_NAMES, build_features
from app.ml.model import (
    FEATURES,
    _idw_value,
    idw_loso,
    predict_quantiles,
    ridge_fit,
    ridge_predict,
    train_best,
    train_model,
)
from app.models.air_sample import AirSample

SYNTHETIC_MODEL = {
    "selected": "idw",
    "type": "ridge_log_pm25+idw",
    "l2": 1.0,
    "idw": {"power": 2.0, "radius_km": 80.0},
    "feature_names": list(FEATURE_NAMES),
    "mean": [0.0] * FEATURES,
    "std": [1.0] * FEATURES,
    "weights": [5.0] + [0.0] * FEATURES,
    "metrics": {
        "method": "LOSO_IDW",
        "n_samples": 100,
        "n_locations": 2,
        "rmse": 5.0,
        "mae": 4.0,
        "r2": 0.9,
        "residual_quantiles_log": [-0.1, 0.0, 0.1],
    },
    "candidates": {"ridge": {}, "idw": {}},
    "trained_at": "2026-01-01T00:00:00+00:00",
}

DONORS = [
    {"lat": 28.50, "lon": 77.05, "pm2_5": 50.0},
    {"lat": 28.50, "lon": 77.20, "pm2_5": 100.0},
]


# ------------------------------ pure geometry -------------------------------
def test_idw_exact_donor_hit_returns_that_value():
    assert _idw_value(DONORS[0], DONORS, 2.0, 80.0) == 50.0


def test_idw_interpolates_between_two_donors():
    midway = {"lat": 28.50, "lon": 77.125}
    value = _idw_value(midway, DONORS, 2.0, 80.0)
    assert value is not None
    assert 50.0 < value < 100.0
    assert abs(value - 75.0) < 1.0


def test_idw_outside_radius_returns_none():
    far = {"lat": 29.30, "lon": 78.20}  # far beyond 80 km of every donor
    assert _idw_value(far, DONORS, 2.0, 80.0) is None


def test_idw_no_donors_returns_none():
    assert _idw_value({"lat": 28.5, "lon": 77.1}, [], 2.0, 80.0) is None


# -------------------------------- features ---------------------------------
def test_build_features_matches_declared_names():
    rec = {"lat": 28.6, "lon": 77.2, "ts": "2026-10-10T12:00:00", "pm2_5": 90}
    feats = build_features(rec)
    assert len(feats) == len(FEATURE_NAMES) == FEATURES
    assert all(isinstance(v, float) and math.isfinite(v) for v in feats)


def test_build_features_survives_missing_optional_fields():
    feats = build_features({"lat": 28.6, "lon": 77.2, "ts": "2026-10-10T12:00:00"})
    assert len(feats) == FEATURES
    assert all(math.isfinite(v) for v in feats)


# --------------------------------- ridge -----------------------------------
def test_ridge_recovers_linear_signal():
    """With (near) zero penalty, ridge recovers an exact linear relationship."""
    import numpy as np

    from app.ml.model import standardise_fit

    X = [[float(i), 1.0] for i in range(10)]
    y = [3.0 * x[0] + 2.0 for x in X]
    arr = np.asarray(X, dtype=float)
    mean, std = standardise_fit(arr)
    Xs = (arr - mean) / std
    w = ridge_fit(Xs, np.asarray(y, dtype=float), l2=0.0)
    preds = ridge_predict(Xs, w)
    assert max(abs(p - t) for p, t in zip(preds, y)) < 1e-6


def test_ridge_shrinkage_reduces_slope():
    """A larger L2 penalty must shrink coefficients (sanity check on the penalty)."""
    import numpy as np

    from app.ml.model import standardise_fit

    X = [[float(i)] for i in range(20)]
    y = [5.0 * x[0] for x in X]
    arr = np.asarray(X, dtype=float)
    mean, std = standardise_fit(arr)
    Xs = (arr - mean) / std
    small = ridge_fit(Xs, np.asarray(y, dtype=float), l2=0.001)[1]
    large = ridge_fit(Xs, np.asarray(y, dtype=float), l2=1000.0)[1]
    assert abs(small) > abs(large)


def test_predict_quantiles_band_orders_correctly():
    q = predict_quantiles(SYNTHETIC_MODEL, [0.0] * FEATURES)
    assert q["pm25_p10"] <= q["pm25_p50"] <= q["pm25_p90"]


# ------------------------------ LOSO / training ------------------------------
def test_idw_loso_reports_finite_metrics_on_tiny_set():
    records = []
    for i, (la, lo) in enumerate([(28.4, 77.0), (28.6, 77.2), (28.8, 77.4)]):
        for h in range(3):
            records.append({"ts": f"2026-10-10T0{h}:00:00", "lat": la, "lon": lo,
                            "pm2_5": 50.0 + 10 * i + h})
    m = idw_loso(records, power=2.0, radius_km=200.0)
    assert m["n_samples"] > 0
    assert math.isfinite(m["rmse"]) and m["rmse"] >= 0
    assert len(m["residual_quantiles_log"]) == 3


def _spatial_records(n_loc=4, lon_n=3, hours=8):
    """A smooth spatial Gaussian bump with a mild diurnal cycle (deterministic)."""
    records = []
    for i in range(n_loc):
        for j in range(lon_n):
            la, lo = round(28.40 + i * 0.05, 5), round(77.00 + j * 0.10, 5)
            bump = 100.0 * math.exp(-((la - 28.50) ** 2 / 0.02 + (lo - 77.10) ** 2 / 0.02))
            for h in range(hours):
                value = bump + 3.0 * math.sin(2 * math.pi * h / 24) + 1.0 * h
                records.append(
                    {
                        "ts": f"2026-10-10T{h:02d}:00:00",
                        "lat": la,
                        "lon": lo,
                        "pm2_5": max(value, 1.0),
                    }
                )
    return records


def test_train_best_selects_lower_rmse_candidate():
    records = _spatial_records()
    features = [build_features(r) for r in records]
    targets = [math.log(r["pm2_5"]) for r in records]
    locations = [(r["lat"], r["lon"]) for r in records]
    model = train_best(features, targets, locations, records)

    ridge_rmse = model["candidates"]["ridge"]["rmse"]
    idw_rmse = model["candidates"]["idw"]["rmse"]
    # selection must be exactly "lowest LOSO RMSE wins"
    assert model["selected"] == ("idw" if idw_rmse < ridge_rmse else "ridge")
    # both candidates are always reported for transparency
    assert set(model["candidates"]) == {"ridge", "idw"}
    assert model["metrics"]["method"].startswith("LOSO")


def test_train_best_idw_wins_on_smooth_spatial_bump():
    """A smooth spatial field is modelled far better by interpolation than by a linear model."""
    records = _spatial_records()
    features = [build_features(r) for r in records]
    targets = [math.log(r["pm2_5"]) for r in records]
    locations = [(r["lat"], r["lon"]) for r in records]
    model = train_best(features, targets, locations, records)

    assert model["candidates"]["idw"]["rmse"] < model["candidates"]["ridge"]["rmse"]
    assert model["selected"] == "idw"
    assert model["candidates"]["idw"]["r2"] > 0  # beats the mean baseline
    assert model["candidates"]["idw"]["mae"] < model["candidates"]["ridge"]["mae"]


# --------------------------------- endpoints --------------------------------
@pytest.fixture()
def trained(monkeypatch):
    monkeypatch.setattr(model_route, "load_model", lambda: SYNTHETIC_MODEL)


def _seed_samples(db, locations=((28.50, 77.05, 50.0), (28.50, 77.20, 100.0))):
    for la, lo, val in locations:
        for h in range(3):
            db.add(AirSample(ts=f"2026-10-11T0{h}:00:00", lat=la, lon=lo, pm2_5=val + h))
    db.commit()


def test_coverage_counts_unique_locations_not_latitudes(client, db, trained):
    # 5 distinct latitudes but 6 distinct (lat, lon) pairs.
    for la in (28.40, 28.50, 28.60, 28.70, 28.80):
        for lo, val in ((77.05, 40.0), (77.20, 60.0)):
            db.add(AirSample(ts="2026-10-11T00:00:00", lat=la, lon=lo, pm2_5=val))
    db.commit()
    r = client.get("/api/v1/model/coverage")
    assert r.status_code == 200
    assert r.json()["locations_with_model_estimates"] == 10  # 5 lat x 2 lon pairs
    distinct_lats = db.execute(text_distinct_lats()).scalar()
    assert distinct_lats == 5  # would have been wrong to report 5 locations


def text_distinct_lats():
    from sqlalchemy import func, select
    from app.models.air_sample import AirSample

    return select(func.count(func.distinct(AirSample.lat)))


def test_grid_interpolates_and_reports_skipped(client, db, trained):
    _seed_samples(db)
    r = client.get("/api/v1/model/grid?resolution=0.05&limit=400")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] > 2, "a finer grid must produce many interpolated cells"
    values = {round(c["pm25_p50"], 3) for c in body["cells"]}
    assert len(values) > 1, "cells must have distinct interpolated values"
    assert body["resolution_deg"] < 0.15, "grid must be finer than the training grid"
    assert "skipped_outside_radius" in body
    assert all(c["pm25_p10"] <= c["pm25_p50"] <= c["pm25_p90"] for c in body["cells"])


def test_grid_near_a_donor_matches_neighbour(client, db, trained):
    _seed_samples(db)
    r = client.get("/api/v1/model/grid?resolution=0.05&limit=400")
    cell = min(r.json()["cells"], key=lambda c: (c["lat"] - 28.50) ** 2 + (c["lon"] - 77.20) ** 2)
    assert abs(cell["pm25_p50"] - 100.0) < 2.0


def test_estimate_interpolates_between_donors(client, db, trained):
    _seed_samples(db)
    r = client.get("/api/v1/model/estimate?lat=28.50&lon=77.125")
    assert r.status_code == 200
    b = r.json()
    assert b["is_model_estimate"] is True
    assert 50.0 < b["pm25_p50"] < 100.0
    assert b["pm25_p10"] <= b["pm25_p50"] <= b["pm25_p90"]


def test_estimate_with_no_donors_reports_missing_not_fabricated(client, db, trained):
    r = client.get("/api/v1/model/estimate?lat=28.50&lon=77.125")
    assert r.status_code == 200
    b = r.json()
    assert b["pm25_p50"] is None
    assert b["pm25_p10"] is None
    assert b["pm25_p90"] is None


def test_estimate_outside_radius_falls_back_to_nearest(client, db, trained):
    _seed_samples(db)
    r = client.get("/api/v1/model/estimate?lat=29.30&lon=78.20")  # > 80 km from donors
    b = r.json()
    assert b["method"] == "nearest_observation"
    assert b["pm25_p50"] in (50.0, 51.0, 52.0, 100.0, 101.0, 102.0)


def test_untrained_model_is_reported_not_crashed(client, db, monkeypatch):
    monkeypatch.setattr(model_route, "load_model", lambda: None)
    m = client.get("/api/v1/model/metrics")
    assert m.status_code == 200
    assert m.json()["status"] == "untrained"
    assert client.get("/api/v1/model/estimate?lat=28.6&lon=77.2").status_code == 503
    assert client.get("/api/v1/model/grid").status_code == 503
