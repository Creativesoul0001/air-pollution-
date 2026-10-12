"""Endpoints for the validated local PM2.5 model.

Every payload is explicitly tagged `is_model_estimate: true` with its provenance and
LOSO validation error, so a model estimate can never be mistaken for a measurement.

The served method is whichever validated better (currently IDW interpolation between
real observation points); both candidates and their metrics are always reported.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.pipeline.providers as providers
from app.ml.features import build_features
from app.ml.model import FEATURE_NAMES, _idw_value, predict_quantiles
from app.ml.store import load_model
from app.models.air_sample import AirSample
from app.models.db import get_db
from app.utils.geo import haversine_km

router = APIRouter(prefix="/api/v1")


def _provenance(model: dict) -> str:
    return (
        f"{model.get('selected', 'model')} model (trained {model.get('trained_at', 'unknown')}, "
        f"LOSO RMSE {model['metrics'].get('rmse')} µg/m³, n={model['metrics'].get('n_samples')})"
    )


def _band(model: dict, p50: float | None) -> dict:
    if p50 is None:
        return {"pm25_p10": None, "pm25_p50": None, "pm25_p90": None}
    q = model["metrics"]["residual_quantiles_log"]
    log_hat = math.log(max(p50, 1e-6))
    return {
        "pm25_p10": round(math.exp(log_hat + q[0]), 2),
        "pm25_p50": round(p50, 2),
        "pm25_p90": round(math.exp(log_hat + q[2]), 2),
    }


def _recent_location_means(db: Session, hours: int = 6) -> tuple[list[dict], str | None]:
    """Per-location mean PM2.5 over the most recent `hours` timestamps (real samples)."""
    timestamps = (
        db.execute(
            select(AirSample.ts)
            .where(AirSample.pm2_5.isnot(None))
            .distinct()
            .order_by(AirSample.ts.desc())
            .limit(max(1, hours))
        )
        .scalars()
        .all()
    )
    if not timestamps:
        return [], None
    rows = (
        db.execute(
            select(AirSample.lat, AirSample.lon, AirSample.pm2_5)
            .where(AirSample.ts.in_(list(timestamps)), AirSample.pm2_5.isnot(None))
            .limit(50000)
        )
        .all()
    )
    acc: dict[tuple[float, float], list[float]] = {}
    for lat, lon, value in rows:
        acc.setdefault((lat, lon), []).append(float(value))
    donors = [
        {"lat": la, "lon": lo, "pm2_5": sum(v) / len(v)} for (la, lo), v in acc.items() if v
    ]
    return donors, str(timestamps[0])


def _current_feature_record(lat: float, lon: float) -> dict:
    air = providers.current_air(lat, lon)
    try:
        wx = providers.current_weather(lat, lon)
    except Exception:
        wx = {}
    rec: dict = {"lat": lat, "lon": lon, "ts": air.get("time") or ""}
    rec.update({k: v for k, v in (air.get("pollutants") or {}).items()})
    rec.update(
        {
            "wind_speed_kmh": wx.get("wind_speed_kmh"),
            "wind_direction_deg": wx.get("wind_direction_deg"),
            "temperature_c": wx.get("temperature_c"),
            "humidity_pct": wx.get("humidity_pct"),
        }
    )
    return rec


@router.get("/model/metrics")
def model_metrics():
    model = load_model()
    if not model:
        return {
            "status": "untrained",
            "locations_with_model_estimates": 0,
            "message": "No validated model trained yet. Run: python -m app.ml.train",
        }
    return {
        "status": "trained",
        "selected_method": model.get("selected"),
        "trained_at": model.get("trained_at"),
        "metrics": model["metrics"],
        "candidates": model.get("candidates"),
        "dataset": model.get("dataset"),
        "selection_note": model.get("selection_note"),
        "provenance": _provenance(model),
        "locations_with_model_estimates": model.get("dataset", {}).get("n_locations", 0),
        "feature_names": model.get("feature_names") or list(FEATURE_NAMES),
    }


@router.get("/model/estimate")
def model_estimate(
    lat: float = Query(...),
    lon: float = Query(...),
    db: Session = Depends(get_db),
):
    """A model estimate (never presented as a measurement) with an explicit uncertainty band."""
    model = load_model()
    if not model:
        raise HTTPException(
            status_code=503,
            detail="no validated model trained yet; run 'python -m app.ml.train'",
        )

    donors, ref_ts = _recent_location_means(db, hours=6)
    method = model.get("selected", "idw")
    p50 = None
    feature_ts = None

    if method == "idw" and donors:
        power = model.get("idw", {}).get("power", 2.0)
        radius = model.get("idw", {}).get("radius_km", 80.0)
        p50 = _idw_value({"lat": lat, "lon": lon}, donors, power, radius)
        feature_ts = ref_ts

    if p50 is None and method == "ridge":
        try:
            record = _current_feature_record(lat, lon)
            p50 = predict_quantiles(model, build_features(record))["pm25_p50"]
            feature_ts = record.get("ts")
        except Exception:
            p50 = None

    if p50 is None:
        # last honest fallback: nearest single real observation
        nearest = None
        for d in donors:
            dist = haversine_km(lat, lon, d["lat"], d["lon"])
            if nearest is None or dist < nearest[0]:
                nearest = (dist, d["pm2_5"])
        if nearest is not None:
            p50 = nearest[1]
            method = "nearest_observation"
            feature_ts = ref_ts

    return {
        "status": "ok",
        "location": {"lat": lat, "lon": lon},
        "is_model_estimate": True,
        "kind": "model_estimate",
        "method": method,
        "provenance": _provenance(model),
        "los_validation": model["metrics"],
        "candidates": model.get("candidates"),
        "reference_timestamp": feature_ts,
        **(_band(model, p50) if p50 is not None else
            {"pm25_p10": None, "pm25_p50": None, "pm25_p90": None}),
        "note": (
            "Model estimate with an empirical LOSO uncertainty band; interpolated from real "
            "observations. Not a measurement."
        ),
    }


@router.get("/model/grid")
def model_grid(
    # Default is FINER than the training grid (0.15 deg) so cells fall between
    # observation points and are genuinely interpolated, not just echoed back.
    resolution: float = Query(0.05, ge=0.02, le=0.5),
    limit: int = Query(400, ge=10, le=2000),
    hours: int = Query(6, ge=1, le=48),
    db: Session = Depends(get_db),
):
    """A genuine model-based spatial risk surface over the NCR bbox (IDW interpolation)."""
    model = load_model()
    if not model:
        raise HTTPException(
            status_code=503,
            detail="no validated model trained yet; run 'python -m app.ml.train'",
        )

    donors, ref_ts = _recent_location_means(db, hours=hours)
    if not donors:
        raise HTTPException(status_code=503, detail="no training samples available")

    from app.core.config import settings

    power = model.get("idw", {}).get("power", 2.0)
    radius = model.get("idw", {}).get("radius_km", 80.0)
    s0, w0, n0, e0 = settings.bbox

    cells: list[dict] = []
    skipped_outside_radius = 0
    cell_lat = s0
    while cell_lat <= n0 + 1e-9 and len(cells) < limit:
        cell_lon = w0
        while cell_lon <= e0 + 1e-9 and len(cells) < limit:
            p50 = _idw_value({"lat": cell_lat, "lon": cell_lon}, donors, power, radius)
            if p50 is not None:
                cells.append(
                    {
                        "lat": round(cell_lat, 5),
                        "lon": round(cell_lon, 5),
                        **_band(model, p50),
                    }
                )
            else:
                # Beyond every donor within `radius_km`: no defensible estimate exists.
                skipped_outside_radius += 1
            cell_lon += resolution
        cell_lat += resolution

    cells.sort(key=lambda c: -(c["pm25_p50"] or 0))
    return {
        "status": "ok",
        "is_model_estimate": True,
        "provenance": _provenance(model),
        "reference_timestamp": ref_ts,
        "resolution_deg": resolution,
        "count": len(cells),
        "skipped_outside_radius": skipped_outside_radius,
        "donor_locations": len(donors),
        "cells": cells,
        "caveat": (
            "Inverse-distance interpolation between real observation points: least reliable "
            "outside the hull of donor locations; cells beyond every donor within "
            f"{radius:.0f} km are omitted rather than extrapolated."
        ),
    }


@router.get("/model/coverage")
def model_coverage(db: Session = Depends(get_db)):
    """How many distinct geographic sample locations a model estimate can cover."""
    model = load_model()
    # Count unique (lat, lon) PAIRS, not distinct latitudes.
    n = db.scalar(
        select(func.count()).select_from(
            select(AirSample.lat, AirSample.lon).distinct().subquery()
        )
    ) or 0
    return {
        "locations_with_model_estimates": int(n) if model else 0,
        "model_trained": bool(model),
        "method": model.get("selected") if model else None,
        "total_samples": int(db.scalar(select(func.count(AirSample.id))) or 0),
    }
