from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.db import get_db
from app.models.location import DatasetMeta, Location, PollutionObservation

router = APIRouter(prefix="/api/v1")

# POI layers the UI can toggle on the map (bounded caps prevent marker overload).
DEFAULT_LAYERS = ["school", "hospital", "metro_station", "park", "landmark", "college", "city"]
ALLOWED_LAYERS = set(DEFAULT_LAYERS) | {"neighbourhood", "major_road", "junction"}


@router.get("/locations/stats")
def locations_stats(db: Session = Depends(get_db)):
    total = int(db.scalar(select(func.count(Location.id))) or 0)
    with_obs = int(
        db.scalar(select(func.count(distinct(PollutionObservation.location_id)))) or 0
    )
    # Geographic areas present in the imported data (never fabricated).
    cities = [
        c
        for (c,) in db.execute(
            select(Location.city).where(Location.city.isnot(None)).distinct()
        ).all()
        if c
    ]
    admin = [
        n
        for (n,) in db.execute(select(Location.name).where(Location.category == "city")).all()
        if n
    ]
    by_category = {
        cat: int(cnt)
        for cat, cnt in db.execute(
            select(Location.category, func.count(Location.id)).group_by(Location.category)
        ).all()
    }
    meta = db.get(DatasetMeta, "last_update")
    s, w, n, e = settings.bbox
    return {
        "bbox": {"south": s, "west": w, "north": n, "east": e},
        "total_locations": total,
        "locations_with_observations": with_obs,
        "locations_with_model_estimates": 0,  # no ML model deployed yet (honest)
        "cities": sorted(set(cities)),
        "administrative_areas": sorted(set(admin)),
        "by_category": by_category,
        "sources": {
            "locations": "OpenStreetMap (ODbL)",
            "observations": "Open-Meteo (keyless)",
        },
        "last_update": meta.value if meta else None,
        "status": "ok" if total else "empty",
    }


@router.get("/locations/search")
def locations_search(
    q: str = Query(..., min_length=1, description="Search text (>=1 char)"),
    limit: int = Query(25, ge=1, le=50),
    db: Session = Depends(get_db),
):
    term = q.strip()
    like = f"%{term}%"
    rows = (
        db.execute(
            select(Location)
            .where(Location.name.isnot(None))
            .where(Location.name.ilike(like))
            .order_by(func.length(Location.name), Location.name)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    observed = set(
        db.execute(select(PollutionObservation.location_id).distinct()).scalars().all()
    )
    return {
        "query": q,
        "count": len(rows),
        "results": [
            {
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "lat": r.lat,
                "lon": r.lon,
                "city": r.city,
                "has_observation": r.id in observed,
            }
            for r in rows
        ],
    }


@router.get("/locations/points")
def locations_points(
    categories: str | None = Query(None, description="Comma-separated categories"),
    limit: int = Query(600, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    """Capped map points for POI layers (real records only)."""
    cats = (
        [c.strip() for c in categories.split(",") if c.strip()]
        if categories
        else DEFAULT_LAYERS
    )
    cats = [c for c in cats if c in ALLOWED_LAYERS]
    if not cats:
        return {"count": 0, "points": []}
    rows = (
        db.execute(
            select(Location.name, Location.category, Location.lat, Location.lon, Location.id)
            .where(Location.category.in_(cats))
            .where(Location.name.isnot(None))
            .limit(limit)
        )
        .all()
    )
    return {
        "count": len(rows),
        "points": [
            {"id": rid, "name": name, "category": cat, "lat": la, "lon": lo}
            for name, cat, la, lo, rid in rows
        ],
    }


@router.get("/locations/observations/points")
def observation_points(limit: int = Query(1000, ge=1, le=5000), db: Session = Depends(get_db)):
    """Latest observation per location (real readings), for the map 'air quality' layer."""
    rows = (
        db.execute(
            select(
                PollutionObservation.location_id,
                PollutionObservation.value,
                PollutionObservation.pollutant,
                PollutionObservation.recorded_at,
                Location.lat,
                Location.lon,
                Location.name,
            ).join(Location, Location.id == PollutionObservation.location_id)
        )
        .all()
    )
    latest: dict[int, tuple] = {}
    for loc_id, value, pollutant, recorded_at, lat, lon, name in rows:
        prev = latest.get(loc_id)
        if prev is None or str(recorded_at) >= str(prev[3]):
            latest[loc_id] = (loc_id, value, pollutant, recorded_at, lat, lon, name)
    points = [
        {
            "id": loc_id,
            "value": value,
            "pollutant": pollutant,
            "observed_at": str(recorded_at),
            "lat": lat,
            "lon": lon,
            "name": name,
        }
        for loc_id, value, pollutant, recorded_at, lat, lon, name in latest.values()
    ][:limit]
    return {"count": len(points), "points": points}


@router.get("/locations/{loc_id}")
def location_detail(loc_id: int, db: Session = Depends(get_db)):
    loc = db.get(Location, loc_id)
    if not loc:
        raise HTTPException(status_code=404, detail="location not found")
    obs = (
        db.execute(
            select(PollutionObservation)
            .where(PollutionObservation.location_id == loc_id)
            .order_by(PollutionObservation.recorded_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    latest = None
    if obs:
        latest = {
            "pollutant": obs.pollutant,
            "value": obs.value,
            "source": obs.source,
            "observed_at": obs.observed_at,
        }
    return {
        "id": loc.id,
        "name": loc.name,
        "category": loc.category,
        "lat": loc.lat,
        "lon": loc.lon,
        "city": loc.city,
        "attribution": loc.attribution,
        "latest_observation": latest,
    }
