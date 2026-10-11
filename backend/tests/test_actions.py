from fastapi.testclient import TestClient

from app.main import app
from app.models.action import Action, ActionEvent, Verification
from app.services import actions as svc


def _reset(client=None):
    # conftest resets tables between tests; verify tables exist
    from app.models.db import SessionLocal

    s = SessionLocal()
    s.commit()
    s.close()


def test_create_and_serialize_includes_allowed_transitions(db):
    a = svc.create_action(db, title="Inspect dust at site", category="construction", lat=28.6, lon=77.2)
    p = svc.serialize_action(a, include_events=True)
    assert p["status"] == "open"
    assert p["allowed_transitions"] == ["assigned", "cancelled", "in_progress"]
    assert p["events"][0]["event_type"] == "created"
    assert p["events"][0]["to_status"] == "open"


def test_legal_transition_writes_audit_event(db):
    a = svc.create_action(db, title="Tackle burning")
    svc.transition_action(db, a.id, "in_progress", actor="inspector")
    svc.transition_action(db, a.id, "pending_verification", actor="inspector")
    db.refresh(a)
    assert a.status == "pending_verification"
    types = [e.event_type for e in a.events]
    actors = [e.actor for e in a.events]
    assert "status_change" in types
    assert "inspector" in actors
    assert a.events[-1].from_status == "in_progress"


def test_illegal_transition_blocked(db):
    a = svc.create_action(db, title="Skip steps")
    try:
        svc.transition_action(db, a.id, "closed", actor="x")
        raised = False
    except svc.TransitionError as exc:
        raised = True
        assert exc.current == "open"
        assert "open" == "open"
        assert "assigned" in exc.allowed
    assert raised, "illegal transition must raise"


def test_api_illegal_transition_returns_422_with_allowed(client, db):
    from app.services import actions as svc2

    a = svc2.create_action(db, title="Bad jump")
    r = client.post(f"/api/v1/actions/{a.id}/transition", json={"to_status": "closed"})
    assert r.status_code == 422
    body = r.json()["detail"]
    assert body["current_status"] == "open"
    assert "assigned" in body["allowed_transitions"]


def test_missing_action_returns_404(client):
    assert client.post("/api/v1/actions/999999/transition", json={"to_status": "assigned"}).status_code == 404


def test_assignment_recorded(db):
    a = svc.create_action(db, title="Assign me")
    svc.assign_action(db, a.id, "ward-42-team", actor="admin")
    db.refresh(a)
    assert a.assignee == "ward-42-team"
    assert any(e.event_type == "assigned" for e in a.events)


def test_verification_with_both_measurements_computes_delta(db):
    a = svc.create_action(db, title="Verify me")
    v = svc.add_verification(
        db,
        a.id,
        pollutant="pm2_5",
        units="µg/m³",
        before_value=120.0,
        before_time="2026-10-10T10:00Z",
        before_provenance="CPCB station A",
        after_value=80.0,
        after_time="2026-10-12T10:00Z",
        after_provenance="CPCB station A",
        actor="verifier",
    )
    out = svc.serialize_verification(v)
    assert out["conclusion"] == "measured_delta"
    assert out["delta"] == -40.0
    assert out["pct_change"] == -33.33
    assert "real, provenance-backed" in out["evidence_note"]


def test_verification_without_measurements_is_insufficient(db):
    a = svc.create_action(db, title="No data verify")
    v = svc.add_verification(db, a.id, pollutant="pm2_5", units="µg/m³", after_value=50.0, actor="v")
    out = svc.serialize_verification(v)
    assert out["conclusion"] == "insufficient_evidence"
    assert out["delta"] is None
    assert "insufficient" in out["evidence_note"]


def test_api_end_to_end(client, db):
    created = client.post(
        "/api/v1/actions",
        json={"title": "Close unauthorised dump", "category": "landfill", "lat": 28.6, "lon": 77.2},
        headers={"X-Actor": "rwa-member"},
    )
    assert created.status_code == 201
    aid = created.json()["id"]
    assert created.json()["created_by"] == "rwa-member"

    listed = client.get("/api/v1/actions?limit=10")
    assert listed.status_code == 200
    assert any(a["id"] == aid for a in listed.json()["results"])

    tr = client.post(f"/api/v1/actions/{aid}/transition", json={"to_status": "in_progress"})
    assert tr.status_code == 200
    assert tr.json()["status"] == "in_progress"

    detail = client.get(f"/api/v1/actions/{aid}")
    assert detail.status_code == 200
    assert len(detail.json()["events"]) >= 2
    assert detail.json()["verifications"] == []

    vr = client.post(
        f"/api/v1/actions/{aid}/verify",
        json={
            "pollutant": "pm2_5",
            "units": "µg/m³",
            "before_value": 200.0,
            "before_provenance": "sensor-1",
            "after_value": 90.0,
            "after_provenance": "sensor-1",
        },
    )
    assert vr.status_code == 201
    assert vr.json()["conclusion"] == "measured_delta"


def test_tables_registered():
    from sqlalchemy import inspect

    from app.models.db import engine

    tables = set(inspect(engine).get_table_names())
    assert {"actions", "action_events", "action_verifications"} <= tables
