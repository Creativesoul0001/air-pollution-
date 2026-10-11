"""Routes for real ground monitoring stations (kept separate from model estimates)."""

from fastapi import APIRouter, HTTPException, Query

import app.pipeline.ground as ground

router = APIRouter(prefix="/api/v1")


@router.get("/stations")
def stations(lat: float = Query(...), lon: float = Query(...)):
    """Real ground monitoring readings. Returns `unavailable` (never fabricated) when no
    station data is reachable. Model estimates are excluded by design."""
    try:
        return ground.ground_readings(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"ground stations unavailable: {exc}")
