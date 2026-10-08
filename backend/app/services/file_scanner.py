"""Scan a directory tree and synchronize file metadata with the database."""

import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FileRecord
from app.services.taxonomy import classify_file

logger = logging.getLogger(__name__)


def calculate_sha256(path: Path) -> str:
    """Calculate a file's SHA-256 digest without loading it all into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as file_stream:
        for chunk in iter(lambda: file_stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def scan_files_in_directory(root_path: str, db: Session, hash_files: bool = True) -> dict[str, int]:
    root = Path(root_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root_path must be a directory")

    result = {"scanned": 0, "added": 0, "updated": 0, "skipped": 0}
    for current_directory, child_directories, filenames in os.walk(root, followlinks=False):
        current_path = Path(current_directory)
        child_directories[:] = [name for name in child_directories if not (current_path / name).is_symlink()]
        for filename in filenames:
            if filename in {".file-organizer-history.json", ".file-organizer-history.json.tmp"}:
                continue
            file_path = current_path / filename
            try:
                if file_path.is_symlink() or not file_path.is_file():
                    result["skipped"] += 1
                    continue
                file_stat = file_path.stat()
                modified_at = datetime.fromtimestamp(file_stat.st_mtime, tz=timezone.utc)
                extension = file_path.suffix.lower()
                category, subcategory, type_label = classify_file(extension)
                file_metadata = {
                    "filename": file_path.name,
                    "extension": extension,
                    "category": category,
                    "subcategory": subcategory,
                    "type_label": type_label,
                    "size": file_stat.st_size,
                    "created_at": datetime.fromtimestamp(
                        getattr(file_stat, "st_birthtime", file_stat.st_ctime), tz=timezone.utc
                    ),
                    "modified_at": modified_at,
                }
                if hash_files:
                    file_metadata["sha256"] = calculate_sha256(file_path)

                record = db.scalar(select(FileRecord).where(FileRecord.path == str(file_path)))
                if (
                    record is not None
                    and not hash_files
                    and (record.size != file_stat.st_size or record.modified_at != modified_at)
                ):
                    file_metadata["sha256"] = None
                if record is None:
                    db.add(FileRecord(path=str(file_path), **file_metadata))
                    result["added"] += 1
                elif any(getattr(record, key) != value for key, value in file_metadata.items()):
                    for key, value in file_metadata.items():
                        setattr(record, key, value)
                    result["updated"] += 1
                result["scanned"] += 1
            except OSError as error:
                logger.warning("Could not scan %s: %s", file_path, error)
                result["skipped"] += 1

    db.commit()
    return result
