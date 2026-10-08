export type FileRecord = {
  id: number
  path: string
  filename: string
  extension: string
  category: string
  subcategory: string
  type_label: string
  size: number
  created_at: string
  modified_at: string
  sha256: string | null
}

export type FilePage = { items: FileRecord[]; total: number; limit: number; offset: number }
export type DuplicateGroup = { sha256: string; size: number; files: FileRecord[] }
export type Move = { source: string; destination: string; category: string }
export type OrganizeResult = { dry_run: boolean; moved: number; moves: Move[] }
export type Organization = 'category' | 'year' | 'month' | 'date'

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new Error(`Cannot connect to the API at ${API_URL}. Start the FastAPI server and try again.`)
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.detail || message
    } catch { /* Keep the status fallback. */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const fileOrganizerApi = {
  listFiles: (params: { offset?: number; limit?: number; category?: string; subcategory?: string; search?: string } = {}) => {
    const query = new URLSearchParams()
    query.set('limit', String(params.limit ?? 100))
    query.set('offset', String(params.offset ?? 0))
    if (params.category) query.set('category', params.category)
    if (params.subcategory) query.set('subcategory', params.subcategory)
    if (params.search) query.set('search', params.search)
    return request<FilePage>(`/files?${query}`)
  },
  scanFolder: (root_path: string) => request<{ scanned: number; added: number; updated: number; skipped: number }>('/scan', {
    method: 'POST', body: JSON.stringify({ root_path, hash_files: false }),
  }),
  findDuplicateFileGroups: () => request<{ groups: DuplicateGroup[]; duplicate_files: number }>('/duplicates', { method: 'POST' }),
  organizeFolder: (root_path: string, dry_run: boolean, organization: Organization) => request<OrganizeResult>('/organize', {
    method: 'POST', body: JSON.stringify({ root_path, dry_run, organization }),
  }),
  removeFileRecord: (id: number) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  clearIndexedLibrary: () => request<{ deleted: number }>('/files', { method: 'DELETE' }),
  getOrganizationHistory: (root_path: string) => request<{ can_revert: boolean; files_to_revert: number; organized_at: string | null }>(`/organize/history?root_path=${encodeURIComponent(root_path)}`),
  previewOrganizationRevert: (root_path: string) => request<OrganizeResult>('/organize/revert', {
    method: 'POST', body: JSON.stringify({ root_path, dry_run: true }),
  }),
  revertLastOrganization: (root_path: string) => request<OrganizeResult>('/organize/revert', {
    method: 'POST', body: JSON.stringify({ root_path, dry_run: false }),
  }),
}

export const categories = ['Images', 'Documents', 'Videos', 'Music', 'Archives', 'Code', 'Applications', 'Fonts', '3D & CAD', 'Other']
export const subcategoriesByCategory: Record<string, string[]> = {
  Images: ['Photos', 'Graphics', 'Camera RAW'],
  Documents: ['PDFs', 'Text & Notes', 'Word Documents', 'Spreadsheets', 'Presentations', 'Ebooks'],
  Videos: ['Movies', 'Video Projects'],
  Music: ['Compressed Audio', 'Lossless Audio', 'Playlists'],
  Archives: ['Compressed Folders', 'Disk Images'],
  Code: ['Python', 'JavaScript & TypeScript', 'Web', 'Systems Languages', 'Data & Config', 'Scripts'],
  Applications: ['Installers', 'Mobile Apps'],
  Fonts: ['Font Files'],
  '3D & CAD': ['3D Models', 'CAD Drawings'],
  Other: ['Uncategorized'],
}
