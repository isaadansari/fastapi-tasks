"""Reversible records of file organization operations."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrganizationBatch(Base):
    __tablename__ = "organization_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reverted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    changes: Mapped[list["OrganizationChange"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan", order_by="OrganizationChange.id"
    )


class OrganizationChange(Base):
    __tablename__ = "organization_changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("organization_batches.id", ondelete="CASCADE"), index=True)
    previous_path: Mapped[str] = mapped_column(String(4096))
    organized_path: Mapped[str] = mapped_column(String(4096))
    batch: Mapped[OrganizationBatch] = relationship(back_populates="changes")


# Backwards-compatible model name used by older route/service imports.
OrganizationMoveRecord = OrganizationChange
