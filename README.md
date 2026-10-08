# Personal File Organizer API

A Python + FastAPI backend that indexes files from a caller-selected directory, classifies them, calculates SHA-256 hashes, reports duplicate content, and can organize direct child files into category folders. No React frontend is included yet; the API is ready for one to consume.

## Run locally

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Interactive API documentation is at `http://127.0.0.1:8000/docs`.

## Run the React frontend

In a second PowerShell window:

```powershell
cd E:\Python\fastapi-tasks\frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The frontend reads `VITE_API_URL` from `frontend/.env` (default `http://127.0.0.1:8000`). If the API is stopped, use **Start API** in the frontend; the local Vite server starts Uvicorn from the `backend` folder. The Python environment must already have the backend requirements installed (`pip install -r requirements.txt`).

Run frontend unit tests from `frontend/` with `npm run test:run`; use `npm test` for watch mode.

Frontend UI pieces that are shared across views live in `frontend/src/components/`; display formatting helpers live in `frontend/src/utils/`. Vitest runs in jsdom and exercises the file table, dialog, and formatting helpers.

## API

- `GET /files?category=Images&search=photo&limit=100&offset=0` — paginated index.
- `GET /files/{id}` — one indexed record.
- `POST /scan` with `{"root_path":"E:\\test-dropbox","hash_files":true}` — recursively index files. Hashing can be disabled for faster scans; run the scan with hashing enabled before duplicate detection.
- `POST /duplicates` — groups indexed files by SHA-256.
- `POST /organize` with `{"root_path":"E:\\test-dropbox","dry_run":true,"organization":"month"}` — recursively preview moves, including files already inside folders from an earlier organization. `organization` can be `category`, `year`, `month`, or `date`; date layouts use each file's modified time and create `YYYY`, `YYYY/MM`, or `YYYY/MM/DD` folders. Set `dry_run` to `false` to apply the moves. Existing names receive a numbered suffix rather than being overwritten.
- `DELETE /files/{id}` — remove the database record only; it does not delete the physical file.
- `DELETE /files` — clear all indexed records only; it does not delete files or folders on disk.

The scan root is provided per request. Filesystem paths are kept local to the server and should only be exposed to trusted clients. The organizer starts in preview mode by default. Timestamps are stored as UTC. SQLite database location is configured with `DATABASE_URL`.

Categories: Images, Documents, Videos, Music, Archives, Code, Other.
