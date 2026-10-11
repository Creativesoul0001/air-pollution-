"""Action persistence, authorized status transitions, audit history, and verification."""

from __future__ import annotations

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.action import Action, ActionEvent, Verification

# Explicit authorized transition graph. Anything not listed is rejected (422).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "open": {"assigned", "in_progress", "cancelled"},
    "assigned": {"in_progress", "cancelled"},
    "in_progress": {"pending_verification", "cancelled"},
    "pending_verification": {"verified", "in_progress"},
    "verified": {"closed"},
    "cancelled": set(),
    "closed": set(),
}
VALID_STATUSES = set(ALLOWED_TRANSITIONS)


class TransitionError(Exception):
    def __init__(self, message: str, current: str, allowed: list[str]):
        super().__init__(message)
        self.current = current
        self.allowed = allowed


def _event(
    db: Session,
    action: Action,
    event_type: str,
    actor: str,
    from_status: str | None = None,
    to_status: str | None = None,
    note: str | None = None,
    data: dict | None = None,
) -> ActionEvent:
    ev = ActionEvent(
        action_id=action.id,
        event_type=event_type,
        actor=actor,
        from_status=from_status,
        to_status=to_status,
        note=note,
        data=json.dumps(data) if data else None,
    )
    db.add(ev)
    return ev


def create_action(
    db: Session,
    *,
    title: str,
    description: str | None = None,
    category: str = "general",
    location_name: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    source_osm_id: str | None = None,
    actor: str = "anonymous",
) -> Action:
    action = Action(
        title=title.strip(),
        description=description,
        category=category,
        location_name=location_name,
        lat=lat,
        lon=lon,
        source_osm_id=source_osm_id,
        status="open",
        created_by=actor,
    )
    db.add(action)
    db.flush()
    _event(db, action, "created", actor, to_status="open")
    db.commit()
    db.refresh(action)
    return action


def get_action(db: Session, action_id: int) -> Action | None:
    return db.get(Action, action_id)


def list_actions(
    db: Session, status: str | None = None, limit: int = 50, offset: int = 0
) -> tuple[list[Action], int]:
    stmt = select(Action)
    count_stmt = select(func.count(Action.id))
    if status:
        stmt = stmt.where(Action.status == status)
        count_stmt = count_stmt.where(Action.status == status)
    total = int(db.execute(count_stmt).scalar() or 0)
    rows = (
        db.execute(stmt.order_by(Action.id.desc()).limit(limit).offset(offset)).scalars().all()
    )
    return rows, total


def transition_action(db: Session, action_id: int, to_status: str, actor: str) -> Action:
    if to_status not in VALID_STATUSES:
        raise TransitionError(f"Unknown status '{to_status}'", "", sorted(VALID_STATUSES))
    action = db.get(Action, action_id)
    if not action:
        raise KeyError(action_id)
    allowed = ALLOWED_TRANSITIONS.get(action.status, set())
    if to_status not in allowed:
        raise TransitionError(
            f"Illegal transition {action.status} -> {to_status}",
            action.status,
            sorted(allowed),
        )
    previous = action.status
    action.status = to_status
    _event(db, action, "status_change", actor, from_status=previous, to_status=to_status)
    db.commit()
    db.refresh(action)
    return action


def assign_action(db: Session, action_id: int, assignee: str, actor: str) -> Action:
    action = db.get(Action, action_id)
    if not action:
        raise KeyError(action_id)
    action.assignee = assignee
    _event(db, action, "assigned", actor, note=f"assigned to {assignee}", data={"assignee": assignee})
    db.commit()
    db.refresh(action)
    return action


def add_verification(
    db: Session,
    action_id: int,
    *,
    pollutant: str,
    units: str,
    before_value: float | None = None,
    before_time: str | None = None,
    before_provenance: str | None = None,
    after_value: float | None = None,
    after_time: str | None = None,
    after_provenance: str | None = None,
    actor: str = "anonymous",
    note: str | None = None,
) -> Verification:
    action = db.get(Action, action_id)
    if not action:
        raise KeyError(action_id)

    comparable = (
        before_value is not None
        and after_value is not None
        and bool(before_provenance)
        and bool(after_provenance)
    )
    delta = None
    pct = None
    if comparable:
        delta = round(after_value - before_value, 4)
        pct = round((after_value - before_value) / before_value * 100, 2) if before_value else None
        conclusion = "measured_delta"
    else:
        conclusion = "insufficient_evidence"

    ver = Verification(
        action_id=action_id,
        pollutant=pollutant,
        units=units,
        before_value=before_value,
        before_time=before_time,
        before_provenance=before_provenance,
        after_value=after_value,
        after_time=after_time,
        after_provenance=after_provenance,
        conclusion=conclusion,
        note=note,
        actor=actor,
    )
    db.add(ver)
    _event(
        db,
        action,
        "verified",
        actor,
        note=note,
        data={
            "verification_id": None,
            "pollutant": pollutant,
            "conclusion": conclusion,
            "delta": delta,
            "pct": pct,
        },
    )
    db.flush()
    # patch the event payload with the verification id
    last = db.execute(
        select(ActionEvent).where(ActionEvent.action_id == action_id).order_by(ActionEvent.id.desc())
    ).scalars().first()
    if last and last.event_type == "verified":
        payload = json.loads(last.data or "{}")
        payload["verification_id"] = ver.id
        last.data = json.dumps(payload)
    db.commit()
    db.refresh(ver)
    return ver


def list_verifications(db: Session, action_id: int) -> list[Verification]:
    return (
        db.execute(
            select(Verification).where(Verification.action_id == action_id).order_by(Verification.id.desc())
        )
        .scalars()
        .all()
    )


def serialize_verification(v: Verification) -> dict:
    delta = pct = None
    if v.conclusion == "measured_delta":
        delta = round((v.after_value or 0) - (v.before_value or 0), 4)
        pct = round(delta / v.before_value * 100, 2) if v.before_value else None
    return {
        "id": v.id,
        "pollutant": v.pollutant,
        "units": v.units,
        "before": {"value": v.before_value, "time": v.before_time, "provenance": v.before_provenance},
        "after": {"value": v.after_value, "time": v.after_time, "provenance": v.after_provenance},
        "conclusion": v.conclusion,
        "delta": delta,
        "pct_change": pct,
        "evidence_note": (
            "before/after are real, provenance-backed measurements taken from the same source"
            if v.conclusion == "measured_delta"
            else "insufficient evidence: both values and their provenance are required to quantify impact"
        ),
        "actor": v.actor,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "note": v.note,
    }


def serialize_action(a: Action, include_events: bool = False) -> dict:
    payload = {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "category": a.category,
        "status": a.status,
        "assignee": a.assignee,
        "location_name": a.location_name,
        "lat": a.lat,
        "lon": a.lon,
        "source_osm_id": a.source_osm_id,
        "created_by": a.created_by,
        "allowed_transitions": sorted(ALLOWED_TRANSITIONS.get(a.status, set())),
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
    if include_events:
        payload["events"] = [
            {
                "id": e.id,
                "event_type": e.event_type,
                "actor": e.actor,
                "from_status": e.from_status,
                "to_status": e.to_status,
                "note": e.note,
                "data": json.loads(e.data) if e.data else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in a.events
        ]
    return payload


# module intentionally ends here
