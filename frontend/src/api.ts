export type FileRecord = {
  id: number
  path: string
  filename: string
  extension: string
  category: string
  subcategory?: string | null
  type_label?: string | null
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
    throw new Error(
      `Cannot connect to the API at ${API_URL}. Start the FastAPI server and try again.`,
    )
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.detail || message
    } catch {
      /* Keep the status fallback. */
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const fileOrganizerApi = {
  listFiles: (
    params: { offset?: number; limit?: number; category?: string; search?: string } = {},
  ) => {
    const query = new URLSearchParams()
    query.set('limit', String(params.limit ?? 100))
    query.set('offset', String(params.offset ?? 0))
    if (params.category) query.set('category', params.category)
    if (params.search) query.set('search', params.search)
    return request<FilePage>(`/files?${query}`)
  },
  scanFolder: (root_path: string) =>
    request<{ scanned: number; added: number; updated: number; skipped: number }>('/scan', {
      method: 'POST',
      body: JSON.stringify({ root_path, hash_files: true }),
    }),
  findDuplicateFileGroups: () =>
    request<{ groups: DuplicateGroup[]; duplicate_files: number }>('/duplicates', {
      method: 'POST',
    }),
  organizeFolder: (root_path: string, dry_run: boolean, organization: Organization) =>
    request<OrganizeResult>('/organize', {
      method: 'POST',
      body: JSON.stringify({ root_path, dry_run, organization }),
    }),
  removeFileRecord: (id: number) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  clearIndexedLibrary: () => request<{ deleted: number }>('/files', { method: 'DELETE' }),
}

export const categories = ['Images', 'Documents', 'Videos', 'Music', 'Archives', 'Code', 'Other']
