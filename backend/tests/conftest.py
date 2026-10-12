import os
import pathlib
import tempfile

# Point the app at a throwaway SQLite DB BEFORE app modules read DATABASE_URL at import.
_fd, _path = tempfile.mkstemp(suffix=".db")
os.close(_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{pathlib.Path(_path).as_posix()}"
os.environ.setdefault("CORS_ORIGINS", "*")

import pytest

from app.models.db import SessionLocal, init_db
from app.models.location import DatasetMeta, Location, PollutionObservation


@pytest.fixture(scope="session", autouse=True)
def _prepare_db():
    init_db()
    yield


@pytest.fixture(autouse=True)
def _reset_tables():
    s = SessionLocal()
    from app.models.action import Action, ActionEvent, Verification
    from app.models.air_sample import AirSample
    from app.models.location import DatasetMeta, Location, PollutionObservation

    for m in (ActionEvent, Verification, Action, AirSample, PollutionObservation, Location, DatasetMeta):
        s.execute(m.__table__.delete())
    s.commit()
    s.close()


@pytest.fixture()
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture()
def client(_reset_tables):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
