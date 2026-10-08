"""FastAPI entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.models import FileRecord  # noqa: F401 - ensure model is registered before create_all
from app.routers.files import router as files_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == "sqlite":
        with engine.begin() as connection:
            existing_columns = {
                row[1] for row in connection.exec_driver_sql("PRAGMA table_info(files)").fetchall()
            }
            if "subcategory" not in existing_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE files ADD COLUMN subcategory VARCHAR(64) NOT NULL DEFAULT 'Uncategorized'"
                )
            if "type_label" not in existing_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE files ADD COLUMN type_label VARCHAR(32) NOT NULL DEFAULT 'FILE'"
                )
    yield


app = FastAPI(title="Personal File Organizer API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
app.include_router(files_router)


@app.get("/", tags=["health"])
def health() -> dict[str, str]:
    return {"name": "Personal File Organizer API", "status": "ok", "docs": "/docs"}
