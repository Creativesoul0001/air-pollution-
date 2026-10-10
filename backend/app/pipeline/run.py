import argparse
import json
import logging
import os
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

from app.core.logging import get_logger
from app.models.db import SessionLocal, init_db
from app.models.location import DatasetMeta, Location, PollutionObservation
from app.pipeline.ingest import ingest_locations
from app.pipeline.observ import fetch_observations
from app.pipeline.overpass import FRAGMENTS, fetch_osm
from sqlalchemy import distinct, func, select

log = get_logger("dhuan.run")


def _set_meta(db, key: str, value: str) -> None:
    row = db.get(DatasetMeta, key)
    if row:
        row.value = value
    else:
        db.add(DatasetMeta(key=key, value=value))
    db.commit()


def run(categories=None) -> dict:
    init_db()
    db = SessionLocal()
    try:
        cats = list(categories) if categories else list(FRAGMENTS.keys())
        agg = {"added": 0, "duplicates": 0, "skipped_no_center": 0}
        per_cat: dict[str, dict] = {}
        failed: list[str] = []
        total_input = 0

        # Ingest one category at a time: lighter queries, no big timeouts, naturally
        # paginated. A single failing category is logged and skipped, never aborts the run.
        for cat in cats:
            try:
                els = fetch_osm([cat])
            except Exception as exc:
                failed.append(cat)
                log.warning("category_failed cat=%s error=%s", cat, str(exc))
                continue
            r = ingest_locations(db, els)
            total_input += len(els)
            for k in agg:
                agg[k] += r.get(k, 0)
            per_cat[cat] = {"input": len(els), "added": r["added"]}
            log.info("category_done cat=%s input=%s added=%s", cat, len(els), r["added"])

        observations = fetch_observations(db)

        total = int(db.scalar(select(func.count(Location.id))) or 0)
        with_obs = int(
            db.scalar(select(func.count(distinct(PollutionObservation.location_id)))) or 0
        )
        now = datetime.now(timezone.utc).isoformat()
        _set_meta(db, "last_update", now)
        _set_meta(db, "provider", "OpenStreetMap/Overpass (ODbL) + Open-Meteo (keyless)")
        _set_meta(db, "runs", str(int((db.get(DatasetMeta, "runs").value if db.get(DatasetMeta, "runs") else 0)) + 1))

        report = {
            "categories": per_cat,
            "input_features_total": total_input,
            **agg,
            "failed_categories": failed,
            "observations": observations,
            "total_locations": total,
            "locations_with_observations": with_obs,
            "last_update": now,
        }
        log.info(
            "run_complete total_locations=%s with_observations=%s added=%s failed=%s",
            total, with_obs, agg["added"], failed,
        )
        return report
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest real Delhi NCR locations + observations")
    parser.add_argument("--categories", nargs="*", default=None, help="Limit to specific categories")
    args = parser.parse_args()
    print(json.dumps(run(args.categories), indent=2))
