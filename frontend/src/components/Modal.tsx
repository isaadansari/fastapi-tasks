import { FolderOpen, X } from 'lucide-react'
import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, subtitle, onClose, children }: ModalProps) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <span className="modal-symbol"><FolderOpen size={21} /></span>
      <h2>{title}</h2>
      <p className="modal-subtitle">{subtitle}</p>
      {children}
    </section>
  </div>
}
