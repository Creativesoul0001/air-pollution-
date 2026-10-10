from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.db import Base

# Source + attribution constants for real OpenStreetMap data (ODbL).
OSM_SOURCE = "OpenStreetMap (Overpass)"
OSM_ATTRIBUTION = "© OpenStreetMap contributors — ODbL"


class Location(Base):
    """A unique geographic point of interest in Delhi NCR (geographic coverage only)."""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(16), default="osm")
    osm_type: Mapped[str] = mapped_column(String(8))  # node | way
    osm_id: Mapped[str] = mapped_column(String(40))
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(48), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tags: Mapped[str] = mapped_column(Text, default="{}")  # JSON string
    source: Mapped[str] = mapped_column(String(64), default=OSM_SOURCE)
    attribution: Mapped[str] = mapped_column(String(160), default=OSM_ATTRIBUTION)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("provider", "osm_type", "osm_id", name="uq_provider_osm"),
        Index("ix_locations_name", "name"),
    )


class PollutionObservation(Base):
    """A real environmental reading tied to a location (environmental-data coverage)."""

    __tablename__ = "pollution_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    location_id: Mapped[int] = mapped_column(Integer, index=True)
    pollutant: Mapped[str] = mapped_column(String(16), default="pm2_5")
    value: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(32), default="open-meteo")
    observed_at: Mapped[str] = mapped_column(String(40))  # provider timestamp (ISO)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DatasetMeta(Base):
    __tablename__ = "dataset_meta"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(400))
