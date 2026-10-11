"""Action tracking API: create, list, authorized transitions, assignment, verification."""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.db import get_db
from app.services import actions as svc

router = APIRouter(prefix="/api/v1")


class ActionIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str | None = None
    category: str = "general"
    location_name: str | None = None
    lat: float | None = None
    lon: float | None = None
    source_osm_id: str | None = None


class TransitionIn(BaseModel):
    to_status: str = Field(..., min_length=1, max_length=32)


class AssignIn(BaseModel):
    assignee: str = Field(..., min_length=1, max_length=120)


class VerificationIn(BaseModel):
    pollutant: str = Field(..., min_length=1, max_length=16)
    units: str = Field("µg/m³", max_length=16)
    before_value: float | None = None
    before_time: str | None = None
    before_provenance: str | None = None
    after_value: float | None = None
    after_time: str | None = None
    after_provenance: str | None = None
    note: str | None = None


def actor_of(x_actor: str | None = Header(None)) -> str:
    """Lightweight actor context. Full Cognito authorization is not wired in this build;
    the caller identity is taken from the X-Actor header and recorded in the audit trail."""
    return x_actor or "anonymous"


@router.post("/actions", status_code=201)
def create_action(payload: ActionIn, db: Session = Depends(get_db), actor: str = Depends(actor_of)):
    a = svc.create_action(db, **payload.model_dump(), actor=actor)
    return svc.serialize_action(a, include_events=True)


@router.get("/actions")
def list_actions(
    status: str | None = Query(None),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows, total = svc.list_actions(db, status, limit, offset)
    return {
        "count": len(rows),
        "total": total,
        "results": [svc.serialize_action(r) for r in rows],
    }


@router.get("/actions/{action_id}")
def action_detail(action_id: int, db: Session = Depends(get_db)):
    a = svc.get_action(db, action_id)
    if not a:
        raise HTTPException(status_code=404, detail="action not found")
    payload = svc.serialize_action(a, include_events=True)
    payload["verifications"] = [
        svc.serialize_verification(v) for v in svc.list_verifications(db, action_id)
    ]
    return payload


@router.post("/actions/{action_id}/transition")
def transition_action(
    action_id: int,
    payload: TransitionIn,
    db: Session = Depends(get_db),
    actor: str = Depends(actor_of),
):
    try:
        a = svc.transition_action(db, action_id, payload.to_status, actor)
    except KeyError:
        raise HTTPException(status_code=404, detail="action not found")
    except svc.TransitionError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(exc),
                "current_status": exc.current,
                "allowed_transitions": exc.allowed,
            },
        )
    return svc.serialize_action(a, include_events=True)


@router.post("/actions/{action_id}/assign")
def assign_action(
    action_id: int,
    payload: AssignIn,
    db: Session = Depends(get_db),
    actor: str = Depends(actor_of),
):
    try:
        a = svc.assign_action(db, action_id, payload.assignee, actor)
    except KeyError:
        raise HTTPException(status_code=404, detail="action not found")
    return svc.serialize_action(a, include_events=True)


@router.post("/actions/{action_id}/verify", status_code=201)
def verify_action(
    action_id: int,
    payload: VerificationIn,
    db: Session = Depends(get_db),
    actor: str = Depends(actor_of),
):
    try:
        v = svc.add_verification(db, action_id, **payload.model_dump(), actor=actor)
    except KeyError:
        raise HTTPException(status_code=404, detail="action not found")
    return svc.serialize_verification(v)
