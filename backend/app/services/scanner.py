"""Recursive, read-only filesystem scanner."""

import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FileRecord
from app.services.taxonomy import classify_file
from app.services.classifier import classify_file

logger = logging.getLogger(__name__)

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _utc_timestamp(timestamp: float) -> datetime:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def scan_files_in_directory(root_path: str, db: Session, hash_files: bool = True) -> dict[str, int]:
    root = Path(root_path).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise ValueError("root_path must be a directory")

    counts = {"scanned": 0, "added": 0, "updated": 0, "skipped": 0}
    for current, directories, filenames in os.walk(root, followlinks=False):
        directories[:] = [name for name in directories if not (Path(current) / name).is_symlink()]
        for name in filenames:
            path = Path(current) / name
            try:
                if path.is_symlink() or not path.is_file():
                    counts["skipped"] += 1
                    continue
                stat = path.stat()
                extension = path.suffix.lower()
                digest = sha256_file(path) if hash_files else None
                category, subcategory, type_label = classify_file(path)
                record = db.scalar(select(FileRecord).where(FileRecord.path == str(path)))
                values = {
                    "filename": path.name,
                    "extension": extension,
                    "category": category,
                    "subcategory": subcategory,
                    "type_label": type_label,
                    "size": stat.st_size,
                    "created_at": _utc_timestamp(getattr(stat, "st_birthtime", stat.st_ctime)),
                    "modified_at": _utc_timestamp(stat.st_mtime),
                }
                if digest is not None:
                    values["sha256"] = digest
                if record is None:
                    record = FileRecord(path=str(path), **values)
                    db.add(record)
                    counts["added"] += 1
                elif any(getattr(record, key) != value for key, value in values.items()):
                    for key, value in values.items():
                        setattr(record, key, value)
                    counts["updated"] += 1
                counts["scanned"] += 1
            except (OSError, PermissionError) as exc:
                logger.warning("Could not scan %s: %s", path, exc)
                counts["skipped"] += 1
    db.commit()
    return counts
