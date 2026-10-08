import {
  Archive,
  Box,
  Code2,
  File,
  FileImage,
  FileText,
  Film,
  Package,
  Type,
  Music2,
} from 'lucide-react'
import type { FileRecord } from '../api'
import { formatBytes, formatDate } from '../utils/formatters'

const fileCategoryIcons = {
  Images: FileImage,
  Documents: FileText,
  Videos: Film,
  Music: Music2,
  Archives: Archive,
  Code: Code2,
  Applications: Package,
  Fonts: Type,
  '3D & CAD': Box,
  Other: File,
}
const fileCategoryColors: Record<string, string> = {
  Images: 'lilac',
  Documents: 'blue',
  Videos: 'rose',
  Music: 'amber',
  Archives: 'mint',
  Code: 'slate',
  Applications: 'blue',
  Fonts: 'amber',
  '3D & CAD': 'lilac',
  Other: 'gray',
}

type FileTableProps = {
  files: FileRecord[]
  onRemove: (file: FileRecord) => void
  compact?: boolean
}

export function FileTable({ files, onRemove, compact = false }: FileTableProps) {
  if (files.length === 0) {
    return (
      <div className="table-empty">
        <span className="empty-icon small-empty">
          <File size={19} />
        </span>
        <b>No files here yet</b>
        <span>Scan a folder to start building your library.</span>
      </div>
    )
  }

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
            <th />
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const CategoryIcon =
              fileCategoryIcons[file.category as keyof typeof fileCategoryIcons] ?? File
            const color = fileCategoryColors[file.category] ?? 'gray'
            return (
              <tr key={file.id}>
                <td>
                  <div className="file-cell">
                    <span className={`file-type-icon ${color}`}>
                      <CategoryIcon size={16} />
                    </span>
                    <span className="file-name-wrap">
                      <b title={file.filename}>{file.filename}</b>
                      <small>
                        <span className="type-label">{file.type_label}</span>
                        {file.subcategory}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  <div className="category-cell">
                    <span className={`category-chip ${color}`}>{file.category}</span>
                    <span className="subcategory-label">{file.subcategory}</span>
                  </div>
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
                  <button
                    className="row-menu"
                    title="Remove record"
                    aria-label="Remove record"
                    onClick={() => onRemove(file)}
                  >
                    <span aria-hidden="true">···</span>
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
