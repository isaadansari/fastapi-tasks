import type { ReactNode } from 'react'

type StatCardProps = {
  label: string
  value: string
  icon: ReactNode
  tone: string
  detail: string
  status?: boolean
}

export function StatCard({ label, value, icon, tone, detail, status }: StatCardProps) {
  return <div className="stat-card">
    <div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div>
    <div className="stat-value">{status && <span className="status-dot" />}{value}</div>
    <div className="stat-detail" title={detail}>{detail}</div>
  </div>
}
