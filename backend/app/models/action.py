from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.db import Base


class Action(Base):
    """A persistent remediation / intervention record."""

    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(48), default="general")
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_osm_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    assignee: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[str] = mapped_column(String(120), default="anonymous")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    events: Mapped[list["ActionEvent"]] = relationship(
        back_populates="action", cascade="all, delete-orphan", order_by="ActionEvent.id"
    )


class ActionEvent(Base):
    """Append-only audit history for an action."""

    __tablename__ = "action_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action_id: Mapped[int] = mapped_column(ForeignKey("actions.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(32))
    actor: Mapped[str] = mapped_column(String(120))
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    action: Mapped[Action] = relationship(back_populates="events")


class Verification(Base):
    """Before/after environmental measurement for an action.

    A delta is computed ONLY when both values are real measurements WITH provenance;
    otherwise the conclusion is explicitly `insufficient_evidence`.
    """

    __tablename__ = "action_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action_id: Mapped[int] = mapped_column(ForeignKey("actions.id"), index=True)
    pollutant: Mapped[str] = mapped_column(String(16))
    units: Mapped[str] = mapped_column(String(16))
    before_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    before_time: Mapped[str | None] = mapped_column(String(40), nullable=True)
    before_provenance: Mapped[str | None] = mapped_column(String(160), nullable=True)
    after_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    after_time: Mapped[str | None] = mapped_column(String(40), nullable=True)
    after_provenance: Mapped[str | None] = mapped_column(String(160), nullable=True)
    conclusion: Mapped[str] = mapped_column(String(40))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor: Mapped[str] = mapped_column(String(120), default="anonymous")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
