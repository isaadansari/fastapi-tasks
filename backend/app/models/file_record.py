"""Indexed file metadata."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FileRecord(Base):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    path: Mapped[str] = mapped_column(String(4096), unique=True, index=True)
    filename: Mapped[str] = mapped_column(String(1024), index=True)
    extension: Mapped[str] = mapped_column(String(32), default="", index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    modified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    sha256: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
