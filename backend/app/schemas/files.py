"""API schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ScanRequest(BaseModel):
    root_path: str = Field(min_length=1, description="Directory to recursively scan")
    hash_files: bool = True


class OrganizeRequest(BaseModel):
    root_path: str = Field(min_length=1, description="Directory whose direct child files should be organized")
    dry_run: bool = True


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    path: str
    filename: str
    extension: str
    category: str
    size: int
    created_at: datetime
    modified_at: datetime
    sha256: str | None


class FilePage(BaseModel):
    items: list[FileResponse]
    total: int
    limit: int
    offset: int


class ScanResponse(BaseModel):
    scanned: int
    added: int
    updated: int
    skipped: int


class OrganizeMove(BaseModel):
    source: str
    destination: str
    category: str


class OrganizeResponse(BaseModel):
    dry_run: bool
    moved: int
    moves: list[OrganizeMove]


class DuplicateGroup(BaseModel):
    sha256: str
    size: int
    files: list[FileResponse]


class DuplicateResponse(BaseModel):
    groups: list[DuplicateGroup]
    duplicate_files: int
