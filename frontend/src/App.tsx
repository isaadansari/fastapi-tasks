import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown,
  CircleHelp, Code2, File, FileImage, FileText, Film, Folder, FolderOpen, HardDrive,
  LayoutDashboard, LoaderCircle, Music2, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  Sparkles, TriangleAlert, X,
} from 'lucide-react'
import { api, categories, type DuplicateGroup, type FileRecord, type Move } from './api'
import './offline.css'

type View = 'overview' | 'all' | 'duplicates'
const categoryIcons: Record<string, typeof File> = {
  Images: FileImage, Documents: FileText, Videos: Film, Music: Music2,
  Archives: Archive, Code: Code2, Other: File,
}
const categoryColors: Record<string, string> = {
  Images: 'lilac', Documents: 'blue', Videos: 'rose', Music: 'amber',
  Archives: 'mint', Code: 'slate', Other: 'gray',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++ }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}
function initials(name: string) { const parts = name.split(/[\\/]/).filter(Boolean); return parts[parts.length - 1]?.slice(0, 1).toUpperCase() || 'S' }

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
  const [moves, setMoves] = useState<Move[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [apiOffline, setApiOffline] = useState(false)
  const [startingApi, setStartingApi] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<FileRecord | null>(null)
  const pageSize = 10

  const loadFiles = useCallback(async () => {
    const result = await api.files({ offset: page * pageSize, limit: pageSize, category: selectedCategory || undefined, search: search || undefined })
    setFiles(result.items)
    setTotal(result.total)
  }, [page, selectedCategory, search])
  const loadDuplicates = useCallback(async () => {
    const result = await api.duplicates()
    setDuplicates(result.groups)
    setDuplicateCount(result.duplicate_files)
  }, [])
  const loadCategoryCounts = useCallback(async () => {
    const entries = await Promise.all(categories.map(async (category) => {
      const result = await api.files({ limit: 1, category })
      return [category, result.total] as const
    }))
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

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { setPage(0) }, [search, selectedCategory])

  async function startApi() {
    setStartingApi(true); setError('')
    try {
      const response = await fetch('/__local/start-api', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Could not start the API.')
      setNotice(result.message || 'The API is running.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the API.')
    } finally { setStartingApi(false) }
  }

  async function scanFolder(event: FormEvent) {
    event.preventDefault()
    if (!rootPath.trim()) return
    setBusy('scan'); setError(''); setNotice('')
    try {
      const result = await api.scan(rootPath.trim())
      setScannedRoot(rootPath.trim())
      setScanOpen(false)
      setNotice(`Scan complete · ${result.scanned.toLocaleString()} files indexed · ${result.added} new`)
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Scan failed.') }
    finally { setBusy('') }
  }

  async function previewOrganize() {
    if (!scannedRoot) { setError('Scan a folder first so the organizer knows which folder to use.'); return }
    setBusy('organize'); setError('')
    try {
      const result = await api.organize(scannedRoot, true)
      setMoves(result.moves); setOrganizeOpen(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not preview organization.') }
    finally { setBusy('') }
  }

  async function applyOrganize() {
    setBusy('organize'); setError('')
    try {
      const result = await api.organize(scannedRoot, false)
      setOrganizeOpen(false); setNotice(`${result.moved} files organized into category folders.`)
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Organization failed.') }
    finally { setBusy('') }
  }

  async function removeFile(file: FileRecord) {
    setBusy(`delete-${file.id}`); setError('')
    try {
      await api.deleteFile(file.id); setConfirmDelete(null); setNotice('File removed from the index. The disk file was kept.')
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove file.') }
    finally { setBusy('') }
  }

  const currentTitle = view === 'overview' ? 'Overview' : view === 'duplicates' ? 'Duplicate files' : selectedCategory || 'All files'
  const usedCategories = categories.filter((category) => (categoryCounts[category] || 0) > 0)

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => setView('overview')}>
        <span className="brand-mark"><FolderOpen size={21} strokeWidth={2.5} /></span>
        <span className="brand-name">file<span>space</span></span>
      </a>
      <div className="workspace-pill"><span className="workspace-avatar">S</span><span><b>My workspace</b><small>Personal storage</small></span><ChevronsUpDown size={14} /></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="main-nav">
        <button className={`nav-link ${view === 'overview' ? 'active' : ''}`} onClick={() => { setView('overview'); setSelectedCategory('') }}><LayoutDashboard size={17} />Overview</button>
        <button className={`nav-link ${view === 'all' && !selectedCategory ? 'active' : ''}`} onClick={() => { setView('all'); setSelectedCategory('') }}><Folder size={17} />All files<span className="nav-count">{total.toLocaleString()}</span></button>
        <button className={`nav-link ${view === 'duplicates' ? 'active' : ''}`} onClick={() => setView('duplicates')}><CopyIcon />Duplicates<span className="nav-count">{duplicateCount || ''}</span></button>
      </nav>
      <div className="side-label category-label">CATEGORIES <button aria-label="Show categories"><Plus size={14} /></button></div>
      <nav className="category-nav">
        {categories.map((category) => {
          const Icon = categoryIcons[category]
          return <button key={category} className={`category-link ${selectedCategory === category ? 'active' : ''}`} onClick={() => { setView('all'); setSelectedCategory(category) }}><span className={`category-icon ${categoryColors[category]}`}><Icon size={15} /></span>{category}</button>
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="storage-card"><span className="storage-icon"><HardDrive size={16} /></span><div className="storage-copy"><b>Local storage</b><small>Connected to this device</small></div><span className="online-dot" /></div>
        <button className="nav-link settings-link"><Settings2 size={17} />Settings</button>
        <div className="profile-row"><span className="profile-avatar">S</span><span><b>Sam</b><small>Personal plan</small></span><CircleHelp size={17} className="help-icon" /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{currentTitle}</b></div><div className="topbar-actions"><button className="icon-button" title="Refresh" onClick={() => void refresh()}><RefreshCw size={16} /></button><span className="topbar-divider" /><button className="profile-avatar small">S</button></div></header>
      <div className="content">
        {error && <div className="toast error-toast"><TriangleAlert size={17} />{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
        {notice && <div className="toast success-toast"><Check size={17} />{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}
        {apiOffline && <div className="api-offline-card"><span className="offline-indicator"><HardDrive size={17} /></span><span className="offline-copy"><b>API server isn’t running</b><small>Start the local Python service to load your library.</small></span><button className="button-primary" onClick={() => void startApi()} disabled={startingApi}>{startingApi ? <><LoaderCircle size={15} className="spin" /> Starting...</> : <><Plus size={15} /> Start API</>}</button></div>}

        {view === 'overview' && <>
          <section className="welcome-row"><div><div className="eyebrow"><Sparkles size={13} /> YOUR PERSONAL LIBRARY</div><h1>Good to see you, Sam<span className="wave">✳</span></h1><p className="subhead">Everything in its right place. Here's your file overview.</p></div><button className="button-primary" onClick={() => setScanOpen(true)}><Plus size={17} /> Scan a folder</button></section>
          <section className="stats-grid">
            <StatCard label="TOTAL FILES" value={total.toLocaleString()} icon={<File size={19} />} tone="blue" detail="Across your library" />
            <StatCard label="CATEGORIES" value={String(usedCategories.length || 0)} icon={<Folder size={19} />} tone="violet" detail="Types organized" />
            <StatCard label="DUPLICATE FILES" value={duplicateCount.toLocaleString()} icon={<CopyIcon />} tone="orange" detail={duplicates.length ? `${duplicates.length} matching groups` : 'No duplicates found'} />
            <StatCard label="SCAN STATUS" value={scannedRoot ? 'Up to date' : 'Ready'} icon={<ShieldCheck size={19} />} tone="green" detail={scannedRoot ? scannedRoot : 'Choose a folder to begin'} status />
          </section>
          <section className="overview-grid">
            <div className="panel category-panel"><div className="panel-heading"><div><h2>Browse by category</h2><p>Your files, automatically sorted</p></div><button className="text-button" onClick={() => { setView('all'); setSelectedCategory('') }}>View all <ChevronRight size={14} /></button></div>
              <div className="category-grid">{categories.map((category) => {
                const Icon = categoryIcons[category]
                return <button className="category-tile" key={category} onClick={() => { setView('all'); setSelectedCategory(category) }}><span className={`category-tile-icon ${categoryColors[category]}`}><Icon size={19} /></span><span className="category-tile-text"><b>{category}</b><small>{(categoryCounts[category] ?? 0).toLocaleString()} files</small></span><ChevronRight size={15} className="tile-chevron" /></button>
              })}</div>
            </div>
            <div className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Keep your library tidy</p></div><span className="sparkle-badge"><Sparkles size={15} /></span></div>
              <button className="action-card" onClick={() => setScanOpen(true)}><span className="action-icon lavender"><FolderOpen size={18} /></span><span><b>Scan a folder</b><small>Add files from your computer</small></span><ChevronRight size={15} /></button>
              <button className="action-card" onClick={() => setView('duplicates')}><span className="action-icon peach"><CopyIcon /></span><span><b>Review duplicates</b><small>{duplicateCount ? `${duplicateCount} files could be duplicates` : 'Find identical files'}</small></span><ChevronRight size={15} /></button>
              <button className="action-card" onClick={() => void previewOrganize()}><span className="action-icon mint"><Sparkles size={18} /></span><span><b>Organize files</b><small>Sort files into category folders</small></span>{busy === 'organize' ? <LoaderCircle className="spin" size={16} /> : <ChevronRight size={15} />}</button>
              <div className="privacy-note"><ShieldCheck size={15} /><span>Your files stay on your device.<br /><b>Private by design.</b></span></div>
            </div>
          </section>
          <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recently added</h2><p>The latest files in your library</p></div><button className="text-button" onClick={() => { setView('all'); setSelectedCategory('') }}>All files <ChevronRight size={14} /></button></div><FileTable files={files.slice(0, 5)} onDelete={setConfirmDelete} compact /></section>
        </>}

        {view === 'all' && <>
          <section className="page-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h1>{selectedCategory || 'All files'}</h1><p className="subhead">{total.toLocaleString()} {selectedCategory ? selectedCategory.toLowerCase() : 'files'} in your library</p></div><button className="button-primary" onClick={() => setScanOpen(true)}><Plus size={17} /> Scan a folder</button></section>
          <section className="panel file-list-panel"><div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." /><kbd>⌘ K</kbd></div><div className="toolbar-right"><button className="button-secondary" onClick={() => void refresh()}><RefreshCw size={15} /> Refresh</button><button className="button-secondary" onClick={() => void previewOrganize()}>{busy === 'organize' ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Organize</button></div></div><FileTable files={files} onDelete={setConfirmDelete} /><Pagination page={page} pageSize={pageSize} total={total} setPage={setPage} /></section>
        </>}

        {view === 'duplicates' && <>
          <section className="page-heading"><div><div className="eyebrow">LIBRARY CLEANUP</div><h1>Duplicate files</h1><p className="subhead">Files with matching SHA-256 fingerprints</p></div><button className="button-secondary" onClick={() => { setBusy('duplicates'); void loadDuplicates().catch((e) => setError(e.message)).finally(() => setBusy('')) }}>{busy === 'duplicates' ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Check again</button></section>
          {duplicates.length === 0 ? <div className="panel empty-state"><span className="empty-icon"><ShieldCheck size={25} /></span><h2>All clear</h2><p>No duplicate files found in your indexed library. Scan a folder with hashing enabled to check its contents.</p><button className="button-primary" onClick={() => setScanOpen(true)}><Plus size={16} /> Scan a folder</button></div> : <div className="duplicate-list">{duplicates.map((group) => <DuplicateCard key={group.sha256} group={group} />)}</div>}
        </>}
        <footer className="footer"><span>Made for a more organized you <span className="footer-heart">✳</span></span><span>File Organizer <span className="footer-dot">·</span> v1.0</span></footer>
      </div>
    </main>

    {scanOpen && <Modal title="Scan a folder" subtitle="Index files from any folder your API server can access." onClose={() => setScanOpen(false)}><form onSubmit={scanFolder}><label className="form-label" htmlFor="folder-path">Folder path</label><input id="folder-path" className="text-input" value={rootPath} onChange={(e) => setRootPath(e.target.value)} placeholder="E:\\test-dropbox" autoFocus /><p className="form-hint"><ShieldCheck size={14} /> Files are indexed locally. SHA-256 hashing may take a while for large folders.</p><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setScanOpen(false)}>Cancel</button><button type="submit" className="button-primary" disabled={!rootPath.trim() || busy === 'scan'}>{busy === 'scan' ? <><LoaderCircle size={16} className="spin" /> Scanning...</> : <><Search size={16} /> Scan folder</>}</button></div></form></Modal>}

    {organizeOpen && <Modal title="Organize preview" subtitle={`${moves.length} direct child files will be moved into category folders.`} onClose={() => setOrganizeOpen(false)}><div className="move-preview">{moves.length === 0 ? <div className="preview-empty"><Check size={20} /> Nothing to organize in this folder.</div> : moves.slice(0, 8).map((move, i) => <div className="move-row" key={`${move.source}-${i}`}><span className={`category-icon ${categoryColors[move.category]}`}><Folder size={15} /></span><span className="move-name">{move.source.split(/[\\/]/).at(-1)}</span><ChevronRight size={14} /><span className="move-dest">{move.category}/</span></div>)}{moves.length > 8 && <p className="more-moves">and {moves.length - 8} more files...</p>}</div><div className="form-hint warning-hint"><TriangleAlert size={14} /> Applying this will move files on disk. You can review the preview before continuing.</div><div className="modal-actions"><button className="button-secondary" onClick={() => setOrganizeOpen(false)}>Cancel</button><button className="button-primary" onClick={() => void applyOrganize()} disabled={moves.length === 0 || !!busy}>{busy === 'organize' ? <><LoaderCircle size={16} className="spin" /> Organizing...</> : <><Sparkles size={16} /> Apply organization</>}</button></div></Modal>}

    {confirmDelete && <Modal title="Remove from library?" subtitle={`“${confirmDelete.filename}” will be removed from the index. The file on disk will not be deleted.`} onClose={() => setConfirmDelete(null)}><div className="modal-actions"><button className="button-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="button-danger" onClick={() => void removeFile(confirmDelete)} disabled={busy === `delete-${confirmDelete.id}`}>{busy === `delete-${confirmDelete.id}` ? <LoaderCircle size={16} className="spin" /> : null}Remove record</button></div></Modal>}
  </div>
}

function CopyIcon() { return <span className="copy-icon"><File size={13} /><File size={13} /></span> }
function StatCard({ label, value, icon, tone, detail, status }: { label: string; value: string; icon: ReactNode; tone: string; detail: string; status?: boolean }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{status && <span className="status-dot" />}{value}</div><div className="stat-detail" title={detail}>{detail}</div></div>
}
function FileTable({ files, onDelete, compact = false }: { files: FileRecord[]; onDelete: (file: FileRecord) => void; compact?: boolean }) {
  if (files.length === 0) return <div className="table-empty"><span className="empty-icon small-empty"><FolderOpen size={19} /></span><b>No files here yet</b><span>Scan a folder to start building your library.</span></div>
  return <div className="table-scroll"><table className="file-table"><thead><tr><th>NAME</th><th>CATEGORY</th>{!compact && <th>LOCATION</th>}<th>SIZE</th><th>MODIFIED</th><th></th></tr></thead><tbody>{files.map((file) => {
    const Icon = categoryIcons[file.category] || File
    return <tr key={file.id}><td><div className="file-cell"><span className={`file-type-icon ${categoryColors[file.category] || 'gray'}`}><Icon size={16} /></span><span className="file-name-wrap"><b title={file.filename}>{file.filename}</b><small>{file.extension || 'No extension'}</small></span></div></td><td><span className={`category-chip ${categoryColors[file.category] || 'gray'}`}>{file.category}</span></td>{!compact && <td><span className="path-cell" title={file.path}>{file.path}</span></td>}<td className="muted-cell">{formatBytes(file.size)}</td><td className="muted-cell">{formatDate(file.modified_at)}</td><td><button className="row-menu" title="Remove record" onClick={() => onDelete(file)}><ChevronDown size={15} /></button></td></tr>
  })}</tbody></table></div>
}
function Pagination({ page, pageSize, total, setPage }: { page: number; pageSize: number; total: number; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="pagination"><span>Showing <b>{total ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)}</b> of <b>{total.toLocaleString()}</b> files</span><div className="page-controls"><button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
}
function DuplicateCard({ group }: { group: DuplicateGroup }) {
  return <section className="panel duplicate-card"><div className="duplicate-heading"><div className="duplicate-title"><span className="action-icon peach"><CopyIcon /></span><span><b>{group.files.length} identical files</b><small>{formatBytes(group.size)} each · {formatBytes(group.size * (group.files.length - 1))} potential space</small></span></div><span className="hash-pill">SHA-256 · {group.sha256.slice(0, 12)}…</span></div><div className="duplicate-files">{group.files.map((file) => <div className="duplicate-file" key={file.id}><span className="file-type-icon blue"><File size={15} /></span><span className="duplicate-file-name"><b>{file.filename}</b><small title={file.path}>{file.path}</small></span><span className="muted-cell">{formatDate(file.modified_at)}</span></div>)}</div></section>
}
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button><span className="modal-symbol"><FolderOpen size={21} /></span><h2>{title}</h2><p className="modal-subtitle">{subtitle}</p>{children}</section></div>
}
