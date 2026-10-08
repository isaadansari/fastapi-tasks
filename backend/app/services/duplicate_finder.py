"""Find indexed files with matching SHA-256 digests."""

from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FileRecord
from app.services.file_scanner import calculate_sha256


def find_duplicate_file_groups(db: Session) -> list[tuple[str, int, list[FileRecord]]]:
    duplicate_sizes = db.execute(
        select(FileRecord.size)
        .group_by(FileRecord.size)
        .having(func.count(FileRecord.id) > 1)
    ).scalars().all()
    for size in duplicate_sizes:
        candidates = db.scalars(select(FileRecord).where(FileRecord.size == size)).all()
        for record in candidates:
            if record.sha256 is None:
                try:
                    record.sha256 = calculate_sha256(Path(record.path))
                except OSError:
                    continue
    db.commit()

    duplicate_hashes = db.scalars(
        select(FileRecord.sha256)
        .where(FileRecord.sha256.is_not(None))
        .group_by(FileRecord.sha256)
        .having(func.count(FileRecord.id) > 1)
    ).all()
    groups = []
    for digest in duplicate_hashes:
        files = db.scalars(select(FileRecord).where(FileRecord.sha256 == digest).order_by(FileRecord.path)).all()
        if len(files) > 1:
            groups.append((digest, files[0].size, files))
    return groups
