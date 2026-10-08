"""Safe category-based file organizer."""

import os
from pathlib import Path

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


def organize_directory(root_path: str, db: Session, dry_run: bool = True) -> list[OrganizeMove]:
    root = Path(root_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root_path must be a directory")
    moves: list[OrganizeMove] = []
    # Only direct child files are moved, making repeated runs predictable and preventing
    # files already in category folders from being moved into nested category folders.
    for source in root.iterdir():
        if source.is_symlink() or not source.is_file():
            continue
        category = categorize(source.suffix.lower())
        destination_dir = root / category
        destination = _destination(destination_dir, source.name)
        moves.append(OrganizeMove(source=str(source), destination=str(destination), category=category))
        if dry_run:
            continue
        destination_dir.mkdir(exist_ok=True)
        # Avoid overwrite if another process creates the candidate after planning.
        destination = _destination(destination_dir, source.name)
        os.replace(source, destination)
        record = db.scalar(select(FileRecord).where(FileRecord.path == str(source)))
        if record:
            record.path = str(destination)
            record.filename = destination.name
            record.category = category
    if not dry_run:
        db.commit()
    return moves
