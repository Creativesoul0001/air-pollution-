import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _engine():
    url = settings.db_url
    if url.startswith("sqlite"):
        file_part = url.split("///", 1)[1]
        if file_part and file_part != ":memory:":
            parent = os.path.dirname(file_part)
            if parent:
                os.makedirs(parent, exist_ok=True)
        return create_engine(url, connect_args={"check_same_thread": False}, future=True)
    return create_engine(url, future=True)


engine = _engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    # Import models so their tables are registered on the metadata.
    import app.models.action  # noqa: F401
    import app.models.air_sample  # noqa: F401
    import app.models.location  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
