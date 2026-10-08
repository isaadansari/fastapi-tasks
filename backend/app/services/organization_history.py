"""Apply file organization plans and reverse recorded file moves."""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FileRecord, OrganizationBatch, OrganizationChange
from app.schemas.files import OrganizeMove
from app.services.taxonomy import classify_file

OrganizationMode = Literal["category", "year", "month", "date"]


def _collect_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current_directory, child_directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current_directory)
        child_directories[:] = [name for name in child_directories if not (current_path / name).is_symlink()]
        files.extend(
            current_path / filename
            for filename in filenames
            if not (current_path / filename).is_symlink() and (current_path / filename).is_file()
        )
    return sorted(files)


def _destination_directory(root: Path, source: Path, mode: OrganizationMode) -> Path:
    if mode == "category":
        return root / classify_file(source.suffix.lower())[0]
    modified_time = datetime.fromtimestamp(source.stat().st_mtime)
    parts = [f"{modified_time.year:04d}"]
    if mode in {"month", "date"}:
        parts.append(f"{modified_time.month:02d}")
    if mode == "date":
        parts.append(f"{modified_time.day:02d}")
    return root.joinpath(*parts)


def _unique_destination(directory: Path, filename: str, reserved: set[Path]) -> Path:
    candidate = directory / filename
    if not candidate.exists() and candidate not in reserved:
        return candidate
    stem, suffix = Path(filename).stem, Path(filename).suffix
    sequence = 1
    while True:
        candidate = directory / f"{stem} ({sequence}){suffix}"
        if not candidate.exists() and candidate not in reserved:
            return candidate
        sequence += 1


def _plan_moves(root: Path, mode: OrganizationMode) -> list[OrganizeMove]:
    reserved: set[Path] = set()
    moves: list[OrganizeMove] = []
    for source in _collect_files(root):
        destination_directory = _destination_directory(root, source, mode)
        if source.parent == destination_directory:
            continue
        destination = _unique_destination(destination_directory, source.name, reserved)
        reserved.add(destination)
        moves.append(OrganizeMove(
            source=str(source),
            destination=str(destination),
            category=classify_file(source.suffix.lower())[0],
        ))
    return moves


def organize_files_in_directory(
    root_path: str,
    db: Session,
    dry_run: bool = True,
    organization: OrganizationMode = "category",
) -> tuple[int | None, list[OrganizeMove]]:
    root = Path(root_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root_path must be a directory")
    planned_moves = _plan_moves(root, organization)
    if dry_run or not planned_moves:
        return None, planned_moves

    batch = OrganizationBatch()
    db.add(batch)
    db.flush()
    completed_moves: list[tuple[Path, Path]] = []
    try:
        for move in planned_moves:
            source = Path(move.source)
            destination = Path(move.destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            # Recheck the destination in case another process created it after the preview.
            destination = _unique_destination(destination.parent, destination.name, set())
            os.replace(source, destination)
            completed_moves.append((source, destination))
            db.add(OrganizationChange(
                batch_id=batch.id,
                previous_path=str(source),
                organized_path=str(destination),
            ))
            file_record = db.scalar(select(FileRecord).where(FileRecord.path == str(source)))
            if file_record is not None:
                file_record.path = str(destination)
                file_record.filename = destination.name
        db.commit()
    except Exception:
        db.rollback()
        for source, destination in reversed(completed_moves):
            if destination.exists() and not source.exists():
                source.parent.mkdir(parents=True, exist_ok=True)
                os.replace(destination, source)
        raise

    applied_moves = [
        OrganizeMove(source=str(source), destination=str(destination), category=classify_file(source.suffix.lower())[0])
        for source, destination in completed_moves
    ]
    return batch.id, applied_moves


def get_latest_reversible_batch(db: Session) -> OrganizationBatch | None:
    return db.scalar(
        select(OrganizationBatch)
        .where(OrganizationBatch.reverted_at.is_(None))
        .order_by(OrganizationBatch.id.desc())
    )


def preview_latest_reversal(db: Session) -> tuple[OrganizationBatch, list[OrganizeMove]] | None:
    batch = get_latest_reversible_batch(db)
    if batch is None:
        return None
    moves = [
        OrganizeMove(
            source=change.organized_path,
            destination=change.previous_path,
            category=classify_file(Path(change.previous_path).suffix.lower())[0],
        )
        for change in reversed(batch.changes)
    ]
    return batch, moves


def revert_latest_organization(db: Session) -> tuple[int, list[OrganizeMove]] | None:
    preview = preview_latest_reversal(db)
    if preview is None:
        return None
    batch, planned_moves = preview
    completed_moves: list[tuple[Path, Path]] = []
    try:
        for move in planned_moves:
            source = Path(move.source)
            destination = Path(move.destination)
            if not source.is_file():
                raise FileNotFoundError(f"Organized file no longer exists: {source}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination = _unique_destination(destination.parent, destination.name, set())
            os.replace(source, destination)
            completed_moves.append((source, destination))
            file_record = db.scalar(select(FileRecord).where(FileRecord.path == str(source)))
            if file_record is not None:
                file_record.path = str(destination)
                file_record.filename = destination.name
        batch.reverted_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
        for source, destination in reversed(completed_moves):
            if destination.exists() and not source.exists():
                source.parent.mkdir(parents=True, exist_ok=True)
                os.replace(destination, source)
        raise

    restored_moves = [
        OrganizeMove(source=str(source), destination=str(destination), category=classify_file(source.suffix.lower())[0])
        for source, destination in completed_moves
    ]
    return batch.id, restored_moves
