import { File } from 'lucide-react'
import type { DuplicateGroup } from '../api'
import { formatBytes, formatDate } from '../utils/formatters'
import { DuplicateIcon } from './DuplicateIcon'

type DuplicateCardProps = { group: DuplicateGroup }

export function DuplicateCard({ group }: DuplicateCardProps) {
  return <section className="panel duplicate-card">
    <div className="duplicate-heading">
      <div className="duplicate-title">
        <span className="action-icon peach"><DuplicateIcon /></span>
        <span><b>{group.files.length} identical files</b><small>{formatBytes(group.size)} each · {formatBytes(group.size * (group.files.length - 1))} potential space</small></span>
      </div>
      <span className="hash-pill">SHA-256 · {group.sha256.slice(0, 12)}…</span>
    </div>
    <div className="duplicate-files">
      {group.files.map((file) => <div className="duplicate-file" key={file.id}>
        <span className="file-type-icon blue"><File size={15} /></span>
        <span className="duplicate-file-name"><b>{file.filename}</b><small title={file.path}>{file.path}</small></span>
        <span className="muted-cell">{formatDate(file.modified_at)}</span>
      </div>)}
    </div>
  </section>
}
