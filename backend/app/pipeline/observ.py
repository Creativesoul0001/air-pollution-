import logging

import requests
from sqlalchemy import select, distinct

from app.core.config import settings
from app.models.location import Location, PollutionObservation

log = logging.getLogger("dhuan.observe")


def fetch_pm25(coords: list[tuple[float, float]], batch: int = 100) -> list[dict]:
    """Fetch REAL current PM2.5 for coordinates from Open-Meteo (keyless, batched).

    Returns a list aligned to the input order: {lat, lon, value, time}.
    """
    if not coords:
        return []
    results: list[dict] = []
    for i in range(0, len(coords), batch):
        chunk = coords[i : i + batch]
        params = {
            "latitude": ",".join(f"{c[0]}" for c in chunk),
            "longitude": ",".join(f"{c[1]}" for c in chunk),
            "current": "pm2_5",
            "timezone": "auto",
        }
        resp = requests.get(
            settings.open_meteo_base,
            params=params,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict):
            data = [data]
        for item in data:
            current = item.get("current") or {}
            results.append(
                {
                    "lat": item.get("latitude"),
                    "lon": item.get("longitude"),
                    "value": current.get("pm2_5"),
                    "time": current.get("time"),
                }
            )
    return results


def fetch_observations(db, cap: int | None = None) -> dict:
    """Attach real PM2.5 readings to indexed locations that don't yet have one.

    Incremental and repeatable: locations that already have an observation are not
    re-fetched, so counts remain stable across runs.
    """
    cap = cap if cap is not None else settings.observations_cap
    already = set(
        db.execute(select(PollutionObservation.location_id).distinct()).scalars().all()
    )
    candidates = (
        db.execute(
            select(Location)
            .where(Location.name.isnot(None))
            .order_by(Location.id)
            .limit(cap * 4)
        )
        .scalars()
        .all()
    )
    todo = [loc for loc in candidates if loc.id not in already][:cap]
    if not todo:
        return {"observed_locations": 0, "requested": 0}

    readings = fetch_pm25([(loc.lat, loc.lon) for loc in todo])
    if len(readings) != len(todo):
        log.warning("meteo alignment mismatch todo=%s readings=%s", len(todo), len(readings))

    stored = 0
    for loc, res in zip(todo, readings):
        value = res.get("value")
        if value is None:  # no defensible reading for this point -> leave it without one
            continue
        db.add(
            PollutionObservation(
                location_id=loc.id,
                pollutant="pm2_5",
                value=float(value),
                source="open-meteo",
                observed_at=str(res.get("time")),
            )
        )
        stored += 1
    db.commit()
    return {"observed_locations": stored, "requested": len(todo)}
