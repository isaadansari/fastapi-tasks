"""Safe category-based file organizer."""

import os
from datetime import datetime
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FileRecord
from app.schemas.files import OrganizeMove
from app.services.scanner import categorize


def _destination(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    if not candidate.exists():
        return candidate
    stem, suffix = Path(filename).stem, Path(filename).suffix
    index = 1
    while (directory / f"{stem} ({index}){suffix}").exists():
        index += 1
    return directory / f"{stem} ({index}){suffix}"


Organization = Literal["category", "year", "month", "date"]


def organize_files_in_directory(
    root_path: str,
    db: Session,
    dry_run: bool = True,
    organization: Organization = "category",
) -> list[OrganizeMove]:
    root = Path(root_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root_path must be a directory")
    moves: list[OrganizeMove] = []
    # Snapshot all files before moving anything. This lets users change organization
    # layouts repeatedly, including moving files out of an earlier folder hierarchy.
    source_files: list[Path] = []
    for current, directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        directories[:] = [name for name in directories if not (current_path / name).is_symlink()]
        for filename in filenames:
            source = current_path / filename
            if not source.is_symlink() and source.is_file():
                source_files.append(source)

    for source in sorted(source_files):
        category = categorize(source.suffix.lower())
        if organization == "category":
            destination_dir = root / category
        else:
            modified = datetime.fromtimestamp(source.stat().st_mtime)
            parts = [f"{modified.year:04d}"]
            if organization in {"month", "date"}:
                parts.append(f"{modified.month:02d}")
            if organization == "date":
                parts.append(f"{modified.day:02d}")
            destination_dir = root.joinpath(*parts)
        # Already correctly placed files are left alone, making a repeated run idempotent.
        if source.parent == destination_dir:
            continue
        destination = _destination(destination_dir, source.name)
        moves.append(OrganizeMove(source=str(source), destination=str(destination), category=category))
        if dry_run:
            continue
        destination_dir.mkdir(parents=True, exist_ok=True)
        # Avoid overwrite if another process creates the candidate after planning.
        destination = _destination(destination_dir, source.name)
        os.replace(source, destination)
        record = db.scalar(select(FileRecord).where(FileRecord.path == str(source)))
        if record:
            record.path = str(destination)
            record.filename = destination.name
            if organization == "category":
                record.category = category
    if not dry_run:
        db.commit()
    return moves
