"""Reorganize files and store reversible move history beside the selected folder."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FileRecord
from app.schemas.files import OrganizeMove
from app.services.taxonomy import classify_file

OrganizationMode = Literal["category", "year", "month", "date"]
MANIFEST_NAME = ".file-organizer-history.json"
TEMP_MANIFEST_NAME = ".file-organizer-history.json.tmp"


def _resolve_root(root_path: str) -> Path:
    root = Path(root_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root_path must be a directory")
    return root


def _manifest_path(root: Path) -> Path:
    return root / MANIFEST_NAME


def _read_manifest(root: Path) -> dict:
    manifest_path = _manifest_path(root)
    if not manifest_path.exists():
        return {"version": 1, "operations": []}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read the organizer history manifest: {error}") from error
    if not isinstance(manifest, dict) or manifest.get("version") != 1 or not isinstance(manifest.get("operations"), list):
        raise ValueError("The organizer history manifest has an unsupported format")
    return manifest


def _write_manifest(root: Path, manifest: dict) -> None:
    temporary_path = root / TEMP_MANIFEST_NAME
    try:
        with temporary_path.open("w", encoding="utf-8", newline="\n") as manifest_file:
            json.dump(manifest, manifest_file, indent=2)
            manifest_file.write("\n")
            manifest_file.flush()
            os.fsync(manifest_file.fileno())
        os.replace(temporary_path, _manifest_path(root))
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def _is_inside_root(path: Path, root: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(root)
        return True
    except ValueError:
        return False


def _collect_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current_directory, child_directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current_directory)
        child_directories[:] = [name for name in child_directories if not (current_path / name).is_symlink()]
        for filename in filenames:
            file_path = current_path / filename
            if filename in {MANIFEST_NAME, TEMP_MANIFEST_NAME}:
                continue
            if not file_path.is_symlink() and file_path.is_file():
                files.append(file_path)
    return sorted(files)


def _target_directory(root: Path, source: Path, mode: OrganizationMode) -> Path:
    if mode == "category":
        return root / classify_file(source.suffix.lower())[0]
    modified_date = datetime.fromtimestamp(source.stat().st_mtime)
    path_parts = [f"{modified_date.year:04d}"]
    if mode in {"month", "date"}:
        path_parts.append(f"{modified_date.month:02d}")
    if mode == "date":
        path_parts.append(f"{modified_date.day:02d}")
    return root.joinpath(*path_parts)


def _unique_destination(directory: Path, filename: str, reserved: set[Path]) -> Path:
    candidate = directory / filename
    if not candidate.exists() and candidate not in reserved:
        return candidate
    stem, extension = Path(filename).stem, Path(filename).suffix
    index = 1
    while True:
        candidate = directory / f"{stem} ({index}){extension}"
        if not candidate.exists() and candidate not in reserved:
            return candidate
        index += 1


def _plan_organization(root: Path, mode: OrganizationMode) -> list[OrganizeMove]:
    reserved: set[Path] = set()
    moves: list[OrganizeMove] = []
    for source in _collect_files(root):
        target_directory = _target_directory(root, source, mode)
        if source.parent == target_directory:
            continue
        destination = _unique_destination(target_directory, source.name, reserved)
        reserved.add(destination)
        moves.append(OrganizeMove(
            source=str(source), destination=str(destination), category=classify_file(source.suffix.lower())[0]
        ))
    return moves


def organize_files(
    root_path: str,
    db: Session,
    mode: OrganizationMode,
    dry_run: bool = True,
) -> tuple[str | None, list[OrganizeMove]]:
    root = _resolve_root(root_path)
    planned_moves = _plan_organization(root, mode)
    if dry_run or not planned_moves:
        return None, planned_moves

    manifest = _read_manifest(root)
    operation_id = str(uuid.uuid4())
    operation = {
        "id": operation_id,
        "mode": mode,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reverted_at": None,
        "changes": [],
    }
    completed_moves: list[tuple[Path, Path]] = []
    previous_manifest_exists = _manifest_path(root).exists()
    previous_manifest_text = _manifest_path(root).read_text(encoding="utf-8") if previous_manifest_exists else None
    try:
        for move in planned_moves:
            source = Path(move.source)
            destination = Path(move.destination)
            if not _is_inside_root(source, root) or not _is_inside_root(destination, root):
                raise ValueError("A planned file path is outside the selected folder")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination = _unique_destination(destination.parent, destination.name, set())
            os.replace(source, destination)
            completed_moves.append((source, destination))
            operation["changes"].append({"previous_path": str(source), "organized_path": str(destination)})
            file_record = db.scalar(select(FileRecord).where(FileRecord.path == str(source)))
            if file_record is not None:
                file_record.path = str(destination)
                file_record.filename = destination.name
        manifest["operations"].append(operation)
        _write_manifest(root, manifest)
        db.commit()
    except Exception:
        db.rollback()
        for source, destination in reversed(completed_moves):
            if destination.exists() and not source.exists():
                source.parent.mkdir(parents=True, exist_ok=True)
                os.replace(destination, source)
        if previous_manifest_exists and previous_manifest_text is not None:
            _manifest_path(root).write_text(previous_manifest_text, encoding="utf-8")
        elif _manifest_path(root).exists():
            _manifest_path(root).unlink()
        raise

    return operation_id, [
        OrganizeMove(source=str(source), destination=str(destination), category=classify_file(source.suffix.lower())[0])
        for source, destination in completed_moves
    ]


def latest_reversible_operation(root_path: str) -> dict | None:
    root = _resolve_root(root_path)
    operations = _read_manifest(root)["operations"]
    return next((operation for operation in reversed(operations) if operation.get("reverted_at") is None), None)


def preview_undo(root_path: str) -> tuple[str, list[OrganizeMove]] | None:
    root = _resolve_root(root_path)
    operation = latest_reversible_operation(str(root))
    if operation is None:
        return None
    moves: list[OrganizeMove] = []
    reserved: set[Path] = set()
    for change in reversed(operation.get("changes", [])):
        current_path = Path(change["organized_path"])
        original_path = Path(change["previous_path"])
        if not _is_inside_root(current_path, root) or not _is_inside_root(original_path, root):
            raise ValueError("The organizer manifest contains a path outside the selected folder")
        destination = _unique_destination(original_path.parent, original_path.name, reserved)
        reserved.add(destination)
        moves.append(OrganizeMove(
            source=str(current_path), destination=str(destination), category=classify_file(original_path.suffix.lower())[0]
        ))
    return operation["id"], moves


def undo_latest_organization(root_path: str, db: Session) -> tuple[str, list[OrganizeMove]] | None:
    root = _resolve_root(root_path)
    preview = preview_undo(str(root))
    if preview is None:
        return None
    operation_id, planned_moves = preview
    manifest = _read_manifest(root)
    operation = next(item for item in manifest["operations"] if item.get("id") == operation_id)
    previous_manifest_text = _manifest_path(root).read_text(encoding="utf-8")
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
        operation["reverted_at"] = datetime.now(timezone.utc).isoformat()
        _write_manifest(root, manifest)
        db.commit()
    except Exception:
        db.rollback()
        for source, destination in reversed(completed_moves):
            if destination.exists() and not source.exists():
                source.parent.mkdir(parents=True, exist_ok=True)
                os.replace(destination, source)
        _manifest_path(root).write_text(previous_manifest_text, encoding="utf-8")
        raise

    return operation_id, [
        OrganizeMove(source=str(source), destination=str(destination), category=classify_file(source.suffix.lower())[0])
        for source, destination in completed_moves
    ]
