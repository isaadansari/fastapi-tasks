"""Find indexed files with matching SHA-256 digests."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FileRecord


def find_duplicate_file_groups(db: Session) -> list[tuple[str, int, list[FileRecord]]]:
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
