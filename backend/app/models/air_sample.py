from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    Integer,
    String,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.db import Base


class AirSample(Base):
    """A real historical hourly air + weather observation at a sample location.
    Used only to train/validate the local PM2.5 model."""

    __tablename__ = "air_samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[str] = mapped_column(String(32))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)

    pm2_5: Mapped[float | None] = mapped_column(Float, nullable=True)
    pm10: Mapped[float | None] = mapped_column(Float, nullable=True)
    no2: Mapped[float | None] = mapped_column(Float, nullable=True)
    so2: Mapped[float | None] = mapped_column(Float, nullable=True)
    o3: Mapped[float | None] = mapped_column(Float, nullable=True)
    co: Mapped[float | None] = mapped_column(Float, nullable=True)
    aod: Mapped[float | None] = mapped_column(Float, nullable=True)

    wind_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_gusts_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    dew_point_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    precipitation: Mapped[float | None] = mapped_column(Float, nullable=True)
    cloud_cover: Mapped[float | None] = mapped_column(Float, nullable=True)
    boundary_layer_height: Mapped[float | None] = mapped_column(Float, nullable=True)
    surface_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("ts", "lat", "lon", name="uq_air_sample"),
        Index("ix_air_samples_pm25", "pm2_5"),
    )

    def to_record(self) -> dict:
        return {
            "ts": self.ts,
            "lat": self.lat,
            "lon": self.lon,
            "pm2_5": self.pm2_5,
            "pm10": self.pm10,
            "no2": self.no2,
            "so2": self.so2,
            "o3": self.o3,
            "co": self.co,
            "aod": self.aod,
            "wind_speed_kmh": self.wind_speed_kmh,
            "wind_direction_deg": self.wind_direction_deg,
            "wind_gusts_kmh": self.wind_gusts_kmh,
            "temperature_c": self.temperature_c,
            "humidity_pct": self.humidity_pct,
            "dew_point_c": self.dew_point_c,
            "precipitation": self.precipitation,
            "cloud_cover": self.cloud_cover,
            "boundary_layer_height": self.boundary_layer_height,
            "surface_pressure": self.surface_pressure,
        }
