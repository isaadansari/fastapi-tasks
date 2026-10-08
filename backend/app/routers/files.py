"""File listing, scanning, organizing, duplicate detection, and removal."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.files import OrganizationHistoryResponse, RevertOrganizationRequest
from app.models import FileRecord
from app.schemas.files import (
    DuplicateGroup, DuplicateResponse, FilePage, FileResponse, OrganizeRequest,
    OrganizeResponse, OrganizationHistoryResponse, ScanRequest, ScanResponse,
    UndoOrganizationResponse,
)
from app.services.duplicate_finder import find_duplicate_file_groups
from app.services.manifest_organizer import (
    latest_reversible_operation,
    organize_files,
    preview_undo,
    undo_latest_organization,
)
from app.services.organization_history import get_latest_reversible_batch, undo_latest_organization
from app.services.file_scanner import scan_files_in_directory

router = APIRouter(tags=["files"])


@router.get("/files", response_model=FilePage)
def list_files(
    category: str | None = None,
    subcategory: str | None = None,
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
    if subcategory:
        statement = statement.where(FileRecord.subcategory == subcategory)
        count_statement = count_statement.where(FileRecord.subcategory == subcategory)
    if search:
        statement = statement.where(FileRecord.filename.ilike(f"%{search}%"))
        count_statement = count_statement.where(FileRecord.filename.ilike(f"%{search}%"))
    items = db.scalars(statement.order_by(FileRecord.filename).limit(limit).offset(offset)).all()
    return FilePage(items=items, total=db.scalar(count_statement) or 0, limit=limit, offset=offset)


@router.get("/files/{file_id}", response_model=FileResponse)
def get_file_record(file_id: int, db: Session = Depends(get_db)) -> FileRecord:
    record = db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File record not found")
    return record


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_file_record(file_id: int, db: Session = Depends(get_db)) -> Response:
    record = db.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File record not found")
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/files", tags=["files"])
def clear_indexed_file_records(db: Session = Depends(get_db)) -> dict[str, int]:
    """Clear indexed metadata only; files on disk are never removed."""
    result = db.execute(delete(FileRecord))
    db.commit()
    return {"deleted": result.rowcount or 0}


@router.post("/scan", response_model=ScanResponse)
def scan_directory_endpoint(request: ScanRequest, db: Session = Depends(get_db)) -> ScanResponse:
    try:
        return ScanResponse(**scan_files_in_directory(request.root_path, db, request.hash_files))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/organize", response_model=OrganizeResponse)
def organize_directory_endpoint(request: OrganizeRequest, db: Session = Depends(get_db)) -> OrganizeResponse:
    try:
        operation_id, moves = organize_files(
            request.root_path, db, request.organization, request.dry_run
        )
        return OrganizeResponse(
            dry_run=request.dry_run,
            moved=0 if request.dry_run else len(moves),
            moves=moves,
            operation_id=operation_id,
        )
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/organize/history", response_model=OrganizationHistoryResponse)
def get_organization_history(db: Session = Depends(get_db)) -> OrganizationHistoryResponse:
    batch = get_latest_reversible_batch(db)
    if batch is None:
        return OrganizationHistoryResponse(can_undo=False)
    return OrganizationHistoryResponse(
        can_undo=True,
        batch_id=batch.id,
        organization=batch.organization,
        moved=len(batch.moves),
        created_at=batch.created_at,
    )


@router.post("/organize/undo", response_model=UndoOrganizationResponse)
def undo_organization_endpoint(db: Session = Depends(get_db)) -> UndoOrganizationResponse:
    try:
        result = undo_latest_organization(db)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="There is no organization operation to undo")
    batch_id, organization, restored = result
    return UndoOrganizationResponse(batch_id=batch_id, organization=organization, restored=restored)


@router.post("/duplicates", response_model=DuplicateResponse)
def list_duplicate_file_groups(db: Session = Depends(get_db)) -> DuplicateResponse:
    groups = [DuplicateGroup(sha256=digest, size=size, files=files) for digest, size, files in find_duplicate_file_groups(db)]
    return DuplicateResponse(groups=groups, duplicate_files=sum(len(group.files) for group in groups))


@router.get("/organize/history", response_model=OrganizationHistoryResponse)
def get_organization_history(
    root_path: str,
) -> OrganizationHistoryResponse:
    latest_operation = latest_reversible_operation(root_path)
    return OrganizationHistoryResponse(
        can_revert=latest_operation is not None,
        files_to_revert=len(latest_operation.get("changes", [])) if latest_operation else 0,
        organized_at=latest_operation.get("created_at") if latest_operation else None,
    )


@router.post("/organize/revert", response_model=OrganizeResponse)
def revert_organization(
    request: RevertOrganizationRequest,
    db: Session = Depends(get_db),
) -> OrganizeResponse:
    try:
        if request.dry_run:
            preview = preview_undo(request.root_path)
            if preview is None:
                raise HTTPException(status_code=404, detail="There is no organization operation to revert")
            operation_id, moves = preview
            return OrganizeResponse(dry_run=True, moved=0, moves=moves, operation_id=operation_id)

        result = undo_latest_organization(request.root_path, db)
        if result is None:
            raise HTTPException(status_code=404, detail="There is no organization operation to revert")
        operation_id, moves = result
        return OrganizeResponse(dry_run=False, moved=len(moves), moves=moves, operation_id=operation_id)
    except HTTPException:
        raise
    except (OSError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
