import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Code2,
  File,
  FileImage,
  FileText,
  Film,
  Folder,
  FolderOpen,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Trash2,
  X,
} from 'lucide-react'
import {
  fileOrganizerApi,
  categories,
  type DuplicateGroup,
  type FileRecord,
  type Move,
  type Organization,
} from './api'
import './offline.css'
import './cleanup.css'
import './organize.css'
import { DuplicateCard } from './components/DuplicateCard'
import { DuplicateIcon as CopyIcon } from './components/DuplicateIcon'
import { FileTable as ReusableFileTable } from './components/FileTable'
import { Modal } from './components/Modal'
import { Pagination } from './components/Pagination'
import { StatCard } from './components/StatCard'
import { formatBytes, formatDate } from './utils/formatters'

type View = 'overview' | 'all' | 'duplicates'
const categoryIcons: Record<string, typeof File> = {
  Images: FileImage,
  Documents: FileText,
  Videos: Film,
  Music: Music2,
  Archives: Archive,
  Code: Code2,
  Other: File,
}
const categoryColors: Record<string, string> = {
  Images: 'lilac',
  Documents: 'blue',
  Videos: 'rose',
  Music: 'amber',
  Archives: 'mint',
  Code: 'slate',
  Other: 'gray',
}

export default function App() {
  const [view, setView] = useState<View>('overview')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [total, setTotal] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [rootPath, setRootPath] = useState('')
  const [scannedRoot, setScannedRoot] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [moves, setMoves] = useState<Move[]>([])
  const [organizeMode, setOrganizeMode] = useState<Organization>('category')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [apiOffline, setApiOffline] = useState(false)
  const [startingApi, setStartingApi] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<FileRecord | null>(null)
  const pageSize = 10

  const loadFiles = useCallback(async () => {
    const result = await fileOrganizerApi.listFiles({
      offset: page * pageSize,
      limit: pageSize,
      category: selectedCategory || undefined,
      search: search || undefined,
    })
    setFiles(result.items)
    setTotal(result.total)
  }, [page, selectedCategory, search])
  const loadDuplicates = useCallback(async () => {
    const result = await fileOrganizerApi.findDuplicateFileGroups()
    setDuplicates(result.groups)
    setDuplicateCount(result.duplicate_files)
  }, [])
  const loadCategoryCounts = useCallback(async () => {
    const entries = await Promise.all(
      categories.map(async (category) => {
        const result = await fileOrganizerApi.listFiles({ limit: 1, category })
        return [category, result.total] as const
      }),
    )
    setCategoryCounts(Object.fromEntries(entries))
  }, [])
  const refresh = useCallback(async () => {
    setError('')
    try {
      await Promise.all([loadFiles(), loadDuplicates(), loadCategoryCounts()])
      setApiOffline(false)
    } catch (e) {
      setApiOffline(true)
      setError(e instanceof Error ? e.message : 'Could not load files.')
    }
  }, [loadFiles, loadDuplicates, loadCategoryCounts])

  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    setPage(0)
  }, [search, selectedCategory])

  async function startApi() {
    setStartingApi(true)
    setError('')
    try {
      const response = await fetch('/__local/start-api', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Could not start the API.')
      setNotice(result.message || 'The API is running.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the API.')
    } finally {
      setStartingApi(false)
    }
  }

  async function scanFolder(event: FormEvent) {
    event.preventDefault()
    if (!rootPath.trim()) return
    setBusy('scan')
    setError('')
    setNotice('')
    try {
      const result = await fileOrganizerApi.scanFolder(rootPath.trim())
      setScannedRoot(rootPath.trim())
      setScanOpen(false)
      setNotice(
        `Scan complete · ${result.scanned.toLocaleString()} files indexed · ${result.added} new`,
      )
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.')
    } finally {
      setBusy('')
    }
  }

  async function previewOrganize(mode: Organization = organizeMode) {
    if (!scannedRoot) {
      setError('Scan a folder first so the organizer knows which folder to use.')
      return
    }
    setBusy('organize')
    setError('')
    setOrganizeMode(mode)
    try {
      const result = await fileOrganizerApi.organizeFolder(scannedRoot, true, mode)
      setMoves(result.moves)
      setOrganizeOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not preview organization.')
    } finally {
      setBusy('')
    }
  }

  async function applyOrganize() {
    setBusy('organize')
    setError('')
    try {
      const result = await fileOrganizerApi.organizeFolder(scannedRoot, false, organizeMode)
      setOrganizeOpen(false)
      setNotice(`${result.moved} files organized into category folders.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Organization failed.')
    } finally {
      setBusy('')
    }
  }

  async function removeFile(file: FileRecord) {
    setBusy(`delete-${file.id}`)
    setError('')
    try {
      await fileOrganizerApi.removeFileRecord(file.id)
      setConfirmDelete(null)
      setNotice('File removed from the index. The disk file was kept.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove file.')
    } finally {
      setBusy('')
    }
  }

  async function clearLibrary() {
    setBusy('clear')
    setError('')
    try {
      const result = await fileOrganizerApi.clearIndexedLibrary()
      setClearOpen(false)
      setNotice(
        `${result.deleted.toLocaleString()} indexed records cleared. Files on disk were left untouched.`,
      )
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear the library.')
    } finally {
      setBusy('')
    }
  }

  const currentTitle =
    view === 'overview'
      ? 'Overview'
      : view === 'duplicates'
        ? 'Duplicate files'
        : selectedCategory || 'All files'
  const usedCategories = categories.filter((category) => (categoryCounts[category] || 0) > 0)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setView('overview')}>
          <span className="brand-mark">
            <FolderOpen size={21} strokeWidth={2.5} />
          </span>
          <span className="brand-name">
            file<span>space</span>
          </span>
        </a>
        <div className="workspace-pill">
          <span className="workspace-avatar">S</span>
          <span>
            <b>My workspace</b>
            <small>Personal storage</small>
          </span>
          <ChevronsUpDown size={14} />
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav className="main-nav">
          <button
            className={`nav-link ${view === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setView('overview')
              setSelectedCategory('')
            }}
          >
            <LayoutDashboard size={17} />
            Overview
          </button>
          <button
            className={`nav-link ${view === 'all' && !selectedCategory ? 'active' : ''}`}
            onClick={() => {
              setView('all')
              setSelectedCategory('')
            }}
          >
            <Folder size={17} />
            All files<span className="nav-count">{total.toLocaleString()}</span>
          </button>
          <button
            className={`nav-link ${view === 'duplicates' ? 'active' : ''}`}
            onClick={() => setView('duplicates')}
          >
            <CopyIcon />
            Duplicates<span className="nav-count">{duplicateCount || ''}</span>
          </button>
        </nav>
        <div className="side-label category-label">
          CATEGORIES{' '}
          <button aria-label="Show categories">
            <Plus size={14} />
          </button>
        </div>
        <nav className="category-nav">
          {categories.map((category) => {
            const Icon = categoryIcons[category]
            return (
              <button
                key={category}
                className={`category-link ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => {
                  setView('all')
                  setSelectedCategory(category)
                }}
              >
                <span className={`category-icon ${categoryColors[category]}`}>
                  <Icon size={15} />
                </span>
                {category}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-card">
            <span className="storage-icon">
              <HardDrive size={16} />
            </span>
            <div className="storage-copy">
              <b>Local storage</b>
              <small>Connected to this device</small>
            </div>
            <span className="online-dot" />
          </div>
          <button className="nav-link settings-link">
            <Settings2 size={17} />
            Settings
          </button>
          <div className="profile-row">
            <span className="profile-avatar">S</span>
            <span>
              <b>Sam</b>
              <small>Personal plan</small>
            </span>
            <CircleHelp size={17} className="help-icon" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{currentTitle}</b>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" title="Refresh" onClick={() => void refresh()}>
              <RefreshCw size={16} />
            </button>
            <span className="topbar-divider" />
            <button className="profile-avatar small">S</button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="toast error-toast">
              <TriangleAlert size={17} />
              {error}
              <button onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast success-toast">
              <Check size={17} />
              {notice}
              <button onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {apiOffline && (
            <div className="api-offline-card">
              <span className="offline-indicator">
                <HardDrive size={17} />
              </span>
              <span className="offline-copy">
                <b>API server isn’t running</b>
                <small>Start the local Python service to load your library.</small>
              </span>
              <button
                className="button-primary"
                onClick={() => void startApi()}
                disabled={startingApi}
              >
                {startingApi ? (
                  <>
                    <LoaderCircle size={15} className="spin" /> Starting...
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Start API
                  </>
                )}
              </button>
            </div>
          )}

          {view === 'overview' && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={13} /> YOUR PERSONAL LIBRARY
                  </div>
                  <h1>
                    Good to see you, Sam<span className="wave">✳</span>
                  </h1>
                  <p className="subhead">
                    Everything in its right place. Here's your file overview.
                  </p>
                </div>
                <button className="button-primary" onClick={() => setScanOpen(true)}>
                  <Plus size={17} /> Scan a folder
                </button>
              </section>
              <section className="stats-grid">
                <StatCard
                  label="TOTAL FILES"
                  value={total.toLocaleString()}
                  icon={<File size={19} />}
                  tone="blue"
                  detail="Across your library"
                />
                <StatCard
                  label="CATEGORIES"
                  value={String(usedCategories.length || 0)}
                  icon={<Folder size={19} />}
                  tone="violet"
                  detail="Types organized"
                />
                <StatCard
                  label="DUPLICATE FILES"
                  value={duplicateCount.toLocaleString()}
                  icon={<CopyIcon />}
                  tone="orange"
                  detail={
                    duplicates.length
                      ? `${duplicates.length} matching groups`
                      : 'No duplicates found'
                  }
                />
                <StatCard
                  label="SCAN STATUS"
                  value={scannedRoot ? 'Up to date' : 'Ready'}
                  icon={<ShieldCheck size={19} />}
                  tone="green"
                  detail={scannedRoot ? scannedRoot : 'Choose a folder to begin'}
                  status
                />
              </section>
              <section className="overview-grid">
                <div className="panel category-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Browse by category</h2>
                      <p>Your files, automatically sorted</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setView('all')
                        setSelectedCategory('')
                      }}
                    >
                      View all <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="category-grid">
                    {categories.map((category) => {
                      const Icon = categoryIcons[category]
                      return (
                        <button
                          className="category-tile"
                          key={category}
                          onClick={() => {
                            setView('all')
                            setSelectedCategory(category)
                          }}
                        >
                          <span className={`category-tile-icon ${categoryColors[category]}`}>
                            <Icon size={19} />
                          </span>
                          <span className="category-tile-text">
                            <b>{category}</b>
                            <small>{(categoryCounts[category] ?? 0).toLocaleString()} files</small>
                          </span>
                          <ChevronRight size={15} className="tile-chevron" />
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="panel quick-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Quick actions</h2>
                      <p>Keep your library tidy</p>
                    </div>
                    <span className="sparkle-badge">
                      <Sparkles size={15} />
                    </span>
                  </div>
                  <button className="action-card" onClick={() => setScanOpen(true)}>
                    <span className="action-icon lavender">
                      <FolderOpen size={18} />
                    </span>
                    <span>
                      <b>Scan a folder</b>
                      <small>Add files from your computer</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <button className="action-card" onClick={() => setView('duplicates')}>
                    <span className="action-icon peach">
                      <CopyIcon />
                    </span>
                    <span>
                      <b>Review duplicates</b>
                      <small>
                        {duplicateCount
                          ? `${duplicateCount} files could be duplicates`
                          : 'Find identical files'}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <button className="action-card" onClick={() => void previewOrganize()}>
                    <span className="action-icon mint">
                      <Sparkles size={18} />
                    </span>
                    <span>
                      <b>Organize files</b>
                      <small>Sort files into category folders</small>
                    </span>
                    {busy === 'organize' ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </button>
                  <button className="action-card clear-action" onClick={() => setClearOpen(true)}>
                    <span className="action-icon clear-action-icon">
                      <Trash2 size={17} />
                    </span>
                    <span>
                      <b>Clear library</b>
                      <small>Remove indexed records, keep disk files</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <div className="privacy-note">
                    <ShieldCheck size={15} />
                    <span>
                      Your files stay on your device.
                      <br />
                      <b>Private by design.</b>
                    </span>
                  </div>
                </div>
              </section>
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recently added</h2>
                    <p>The latest files in your library</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setView('all')
                      setSelectedCategory('')
                    }}
                  >
                    All files <ChevronRight size={14} />
                  </button>
                </div>
                <FileTable files={files.slice(0, 5)} onDelete={setConfirmDelete} compact />
              </section>
            </>
          )}

          {view === 'all' && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">YOUR LIBRARY</div>
                  <h1>{selectedCategory || 'All files'}</h1>
                  <p className="subhead">
                    {total.toLocaleString()}{' '}
                    {selectedCategory ? selectedCategory.toLowerCase() : 'files'} in your library
                  </p>
                </div>
                <button className="button-primary" onClick={() => setScanOpen(true)}>
                  <Plus size={17} /> Scan a folder
                </button>
              </section>
              <section className="panel file-list-panel">
                <div className="list-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search files..."
                    />
                    <kbd>⌘ K</kbd>
                  </div>
                  <div className="toolbar-right">
                    <button className="button-secondary" onClick={() => setClearOpen(true)}>
                      <Trash2 size={14} /> Clear library
                    </button>
                    <button className="button-secondary" onClick={() => void refresh()}>
                      <RefreshCw size={15} /> Refresh
                    </button>
                    <button className="button-secondary" onClick={() => void previewOrganize()}>
                      {busy === 'organize' ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <Sparkles size={15} />
                      )}{' '}
                      Organize
                    </button>
                  </div>
                </div>
                <FileTable files={files} onDelete={setConfirmDelete} />
                <Pagination page={page} pageSize={pageSize} total={total} setPage={setPage} />
              </section>
            </>
          )}

          {view === 'duplicates' && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">LIBRARY CLEANUP</div>
                  <h1>Duplicate files</h1>
                  <p className="subhead">Files with matching SHA-256 fingerprints</p>
                </div>
                <button
                  className="button-secondary"
                  onClick={() => {
                    setBusy('duplicates')
                    void loadDuplicates()
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(''))
                  }}
                >
                  {busy === 'duplicates' ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <RefreshCw size={15} />
                  )}{' '}
                  Check again
                </button>
              </section>
              {duplicates.length === 0 ? (
                <div className="panel empty-state">
                  <span className="empty-icon">
                    <ShieldCheck size={25} />
                  </span>
                  <h2>All clear</h2>
                  <p>
                    No duplicate files found in your indexed library. Scan a folder with hashing
                    enabled to check its contents.
                  </p>
                  <button className="button-primary" onClick={() => setScanOpen(true)}>
                    <Plus size={16} /> Scan a folder
                  </button>
                </div>
              ) : (
                <div className="duplicate-list">
                  {duplicates.map((group) => (
                    <DuplicateCard key={group.sha256} group={group} />
                  ))}
                </div>
              )}
            </>
          )}
          <footer className="footer">
            <span>
              Made for a more organized you <span className="footer-heart">✳</span>
            </span>
            <span>
              File Organizer <span className="footer-dot">·</span> v1.0
            </span>
          </footer>
        </div>
      </main>

      {scanOpen && (
        <Modal
          title="Scan a folder"
          subtitle="Index files from any folder your API server can access."
          onClose={() => setScanOpen(false)}
        >
          <form onSubmit={scanFolder}>
            <label className="form-label" htmlFor="folder-path">
              Folder path
            </label>
            <input
              id="folder-path"
              className="text-input"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="E:\\test-dropbox"
              autoFocus
            />
            <p className="form-hint">
              <ShieldCheck size={14} /> Files are indexed locally. SHA-256 hashing may take a while
              for large folders.
            </p>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setScanOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={!rootPath.trim() || busy === 'scan'}
              >
                {busy === 'scan' ? (
                  <>
                    <LoaderCircle size={16} className="spin" /> Scanning...
                  </>
                ) : (
                  <>
                    <Search size={16} /> Scan folder
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {organizeOpen && (
        <Modal
          title="Organize preview"
          subtitle={`${moves.length} files will be moved using the selected layout. Files in nested folders are included.`}
          onClose={() => setOrganizeOpen(false)}
        >
          <label className="form-label" htmlFor="organize-mode">
            Organize by
          </label>
          <select
            id="organize-mode"
            className="text-input organize-select"
            value={organizeMode}
            disabled={!!busy}
            onChange={(event) => void previewOrganize(event.target.value as Organization)}
          >
            <option value="category">File category</option>
            <option value="year">Modified year</option>
            <option value="month">Modified year / month</option>
            <option value="date">Modified year / month / day</option>
          </select>
          <div className="form-hint">
            <Folder size={14} /> Date layouts use each file’s modified date.
          </div>
          <div className="move-preview">
            {moves.length === 0 ? (
              <div className="preview-empty">
                <Check size={20} /> Nothing to organize in this folder.
              </div>
            ) : (
              moves.slice(0, 8).map((move, i) => (
                <div className="move-row" key={`${move.source}-${i}`}>
                  <span className={`category-icon ${categoryColors[move.category]}`}>
                    <Folder size={15} />
                  </span>
                  <span className="move-name">{move.source.split(/[\\/]/).at(-1)}</span>
                  <ChevronRight size={14} />
                  <span className="move-dest">
                    {move.destination.slice(scannedRoot.length + 1).replaceAll('\\', '/')}
                  </span>
                </div>
              ))
            )}
            {moves.length > 8 && <p className="more-moves">and {moves.length - 8} more files...</p>}
          </div>
          <div className="form-hint warning-hint">
            <TriangleAlert size={14} /> Applying this will move files on disk. You can review the
            preview before continuing.
          </div>
          <div className="modal-actions">
            <button className="button-secondary" onClick={() => setOrganizeOpen(false)}>
              Cancel
            </button>
            <button
              className="button-primary"
              onClick={() => void applyOrganize()}
              disabled={moves.length === 0 || !!busy}
            >
              {busy === 'organize' ? (
                <>
                  <LoaderCircle size={16} className="spin" /> Organizing...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Apply organization
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="Remove from library?"
          subtitle={`“${confirmDelete.filename}” will be removed from the index. The file on disk will not be deleted.`}
          onClose={() => setConfirmDelete(null)}
        >
          <div className="modal-actions">
            <button className="button-secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              className="button-danger"
              onClick={() => void removeFile(confirmDelete)}
              disabled={busy === `delete-${confirmDelete.id}`}
            >
              {busy === `delete-${confirmDelete.id}` ? (
                <LoaderCircle size={16} className="spin" />
              ) : null}
              Remove record
            </button>
          </div>
        </Modal>
      )}
      {clearOpen && (
        <Modal
          title="Clear your library?"
          subtitle="This permanently removes every indexed file record and duplicate result from the database. Your actual files and folders on disk will not be deleted."
          onClose={() => setClearOpen(false)}
        >
          <div className="modal-actions">
            <button className="button-secondary" onClick={() => setClearOpen(false)}>
              Cancel
            </button>
            <button
              className="button-danger"
              onClick={() => void clearLibrary()}
              disabled={busy === 'clear'}
            >
              {busy === 'clear' ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Trash2 size={15} />
              )}
              Clear indexed data
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FileTable({
  files,
  onDelete,
  compact = false,
}: {
  files: FileRecord[]
  onDelete: (file: FileRecord) => void
  compact?: boolean
}) {
  return <ReusableFileTable files={files} onRemove={onDelete} compact={compact} />
  if (files.length === 0)
    return (
      <div className="table-empty">
        <span className="empty-icon small-empty">
          <FolderOpen size={19} />
        </span>
        <b>No files here yet</b>
        <span>Scan a folder to start building your library.</span>
      </div>
    )
  return (
    <div className="table-scroll">
      <table className="file-table">
        <thead>
          <tr>
            <th>NAME</th>
            <th>CATEGORY</th>
            {!compact && <th>LOCATION</th>}
            <th>SIZE</th>
            <th>MODIFIED</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const Icon = categoryIcons[file.category] || File
            return (
              <tr key={file.id}>
                <td>
                  <div className="file-cell">
                    <span className={`file-type-icon ${categoryColors[file.category] || 'gray'}`}>
                      <Icon size={16} />
                    </span>
                    <span className="file-name-wrap">
                      <b title={file.filename}>{file.filename}</b>
                      <small>{file.extension || 'No extension'}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`category-chip ${categoryColors[file.category] || 'gray'}`}>
                    {file.category}
                  </span>
                </td>
                {!compact && (
                  <td>
                    <span className="path-cell" title={file.path}>
                      {file.path}
                    </span>
                  </td>
                )}
                <td className="muted-cell">{formatBytes(file.size)}</td>
                <td className="muted-cell">{formatDate(file.modified_at)}</td>
                <td>
                  <button className="row-menu" title="Remove record" onClick={() => onDelete(file)}>
                    <ChevronDown size={15} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
