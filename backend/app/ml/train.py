"""Training CLI: ingest real historical data, train, validate (LOSO), persist.

Usage:
    python -m app.ml.train                 # 60 days, 0.15 deg grid
    python -m app.ml.train --days 45 --grid-step 0.2
"""

from __future__ import annotations

import argparse
import json
import math
import threading

import numpy as np
from sqlalchemy import select

from app.core.logging import get_logger
from app.ml.dataset import collect, default_grid
from app.ml.features import FEATURE_NAMES, build_features
from app.ml.model import train_best
from app.ml.store import save_model
from app.models.air_sample import AirSample
from app.models.db import SessionLocal, init_db

log = get_logger("dhuan.ml.train")


def persist_samples(db, rows: list[dict]) -> int:
    """Insert samples idempotently (unique on ts/lat/lon). Returns inserted count."""
    existing = {
        (ts, lat, lon)
        for ts, lat, lon in db.execute(select(AirSample.ts, AirSample.lat, AirSample.lon)).all()
    }
    seen: set[tuple[str, float, float]] = set()
    objects: list[AirSample] = []
    for r in rows:
        key = (str(r.get("ts")), float(r.get("lat")), float(r.get("lon")))
        if key in seen or key in existing:
            continue
        seen.add(key)
        objects.append(
            AirSample(
                ts=str(r.get("ts")),
                lat=float(r.get("lat")),
                lon=float(r.get("lon")),
                pm2_5=r.get("pm2_5"),
                pm10=r.get("pm10"),
                no2=r.get("no2"),
                so2=r.get("so2"),
                o3=r.get("o3"),
                co=r.get("co"),
                aod=r.get("aod"),
                wind_speed_kmh=r.get("wind_speed_kmh"),
                wind_direction_deg=r.get("wind_direction_deg"),
                wind_gusts_kmh=r.get("wind_gusts_kmh"),
                temperature_c=r.get("temperature_c"),
                humidity_pct=r.get("humidity_pct"),
                dew_point_c=r.get("dew_point_c"),
                precipitation=r.get("precipitation"),
                cloud_cover=r.get("cloud_cover"),
                boundary_layer_height=r.get("boundary_layer_height"),
                surface_pressure=r.get("surface_pressure"),
            )
        )
    for i in range(0, len(objects), 5000):
        db.add_all(objects[i : i + 5000])
    db.commit()
    return len(objects)


def load_dataset(db) -> tuple[list[dict], list[list[float]], list[float], list[tuple[float, float]]]:
    """Read persisted samples and build features/log targets, skipping unusable rows."""
    records, features, targets, locations = [], [], [], []
    for sample in db.execute(select(AirSample)).scalars().yield_per(2000):
        rec = sample.to_record()
        pm25 = rec.get("pm2_5")
        if pm25 is None or pm25 < 0:
            continue
        records.append(rec)
        features.append(build_features(rec))
        targets.append(math.log(max(float(pm25), 0.05)))
        locations.append((rec["lat"], rec["lon"]))
    return records, features, targets, locations


def train(days: int, grid_step: float, use_stored: bool = False) -> dict:
    init_db()
    db = SessionLocal()
    try:
        if not use_stored:
            grid = default_grid(grid_step)
            log.info("collecting %s grid points, %s days", len(grid), days)
            rows = collect(days=days, grid=grid)
            log.info("collected %s rows", len(rows))
            inserted = persist_samples(db, rows)
            log.info("inserted %s new samples", inserted)
        records, features, targets, locations = load_dataset(db)
    finally:
        db.close()

    if len(records) < 400:
        raise RuntimeError(
            f"insufficient usable samples ({len(records)}); need at least 400 to train"
        )

    model = train_best(features, targets, locations, records)
    model["feature_names"] = list(FEATURE_NAMES)
    model["dataset"] = {
        "days": days,
        "grid_step_deg": grid_step,
        "samples_used": len(records),
        "n_locations": len(set(locations)),
        "target": "log1p(pm2_5)",
    }
    path = save_model(model)
    return {"model_path": path, "metrics": model["metrics"], "dataset": model["dataset"]}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the validated PM2.5 model")
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--grid-step", type=float, default=0.15)
    parser.add_argument("--stored", action="store_true", help="reuse already-ingested samples")
    args = parser.parse_args()
    result = train(args.days, args.grid_step, args.stored)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
