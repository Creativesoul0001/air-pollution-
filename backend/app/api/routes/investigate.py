"""Routes for the evidence-based source investigation workflow."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.agents.investigate import investigate
from app.models.db import get_db

router = APIRouter(prefix="/api/v1")


@router.get("/investigate")
def investigate_location(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float | None = Query(None, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Ranked, evidence-based hypotheses about which nearby sources are associated with the
    current readings. Association only — never causation."""
    try:
        return investigate(lat, lon, radius_km)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"investigation backend unavailable: {exc}")
