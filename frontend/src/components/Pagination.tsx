import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  setPage: (page: number) => void
}

export function Pagination({ page, pageSize, total, setPage }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstItem = total === 0 ? 0 : page * pageSize + 1
  const lastItem = Math.min((page + 1) * pageSize, total)

  return <div className="pagination">
    <span>Showing <b>{firstItem}–{lastItem}</b> of <b>{total.toLocaleString()}</b> files</span>
    <div className="page-controls">
      <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <span>Page {page + 1} of {pageCount}</span>
      <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
    </div>
  </div>
}
