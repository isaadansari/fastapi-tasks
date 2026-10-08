"""File listing, scanning, organizing, duplicate detection, and removal."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FileRecord
from app.schemas.files import (
    DuplicateGroup, DuplicateResponse, FilePage, FileResponse, OrganizeRequest,
    OrganizeResponse, ScanRequest, ScanResponse,
)
from app.services.duplicate_finder import find_duplicates
from app.services.organizer import organize_directory
from app.services.scanner import scan_directory

router = APIRouter(tags=["files"])


@router.get("/files", response_model=FilePage)
def list_files(
    category: str | None = None,
    search: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> FilePage:
    statement = select(FileRecord)
    count_statement = select(func.count(FileRecord.id))
    if category:
        statement = statement.where(FileRecord.category == category)
        count_statement = count_statement.where(FileRecord.category == category)
    if search:
        statement = statement.where(FileRecord.filename.ilike(f"%{search}%"))
        count_statement = count_statement.where(FileRecord.filename.ilike(f"%{search}%"))
    items = db.scalars(statement.order_by(FileRecord.filename).limit(limit).offset(offset)).all()
    return FilePage(items=items, total=db.scalar(count_statement) or 0, limit=limit, offset=offset)


@router.get("/files/{file_id}", response_model=FileResponse)
def get_file(file_id: int, db: Session = Depends(get_db)) -> FileRecord:
    record = db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File record not found")
    return record


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file_record(file_id: int, db: Session = Depends(get_db)) -> Response:
    record = db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File record not found")
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/scan", response_model=ScanResponse)
def scan(request: ScanRequest, db: Session = Depends(get_db)) -> ScanResponse:
    try:
        return ScanResponse(**scan_directory(request.root_path, db, request.hash_files))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/organize", response_model=OrganizeResponse)
def organize(request: OrganizeRequest, db: Session = Depends(get_db)) -> OrganizeResponse:
    try:
        moves = organize_directory(request.root_path, db, request.dry_run)
        return OrganizeResponse(dry_run=request.dry_run, moved=0 if request.dry_run else len(moves), moves=moves)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/duplicates", response_model=DuplicateResponse)
def duplicates(db: Session = Depends(get_db)) -> DuplicateResponse:
    groups = [DuplicateGroup(sha256=digest, size=size, files=files) for digest, size, files in find_duplicates(db)]
    return DuplicateResponse(groups=groups, duplicate_files=sum(len(group.files) for group in groups))
