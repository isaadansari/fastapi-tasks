import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { describe, expect, it, jest as vi } from '@jest/globals'
import type { FileRecord } from '../api'
import { FileTable } from './FileTable'

const file: FileRecord = {
  id: 7,
  path: 'C:/library/report.pdf',
  filename: 'report.pdf',
  extension: '.pdf',
  category: 'Documents',
  subcategory: 'PDFs',
  type_label: 'PDF',
  size: 2048,
  created_at: '2024-01-01T00:00:00Z',
  modified_at: '2024-01-02T00:00:00Z',
  sha256: null,
}

describe('FileTable', () => {
  it('shows file type and subcategory labels', () => {
    render(<FileTable files={[file]} onRemove={vi.fn()} />)

    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getAllByText('PDFs')).toHaveLength(2)
    expect(screen.getByText('Documents')).toBeTruthy()
  })

  it('requests removal of the selected record', () => {
    const onRemove = vi.fn()
    render(<FileTable files={[file]} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove record' }))

    expect(onRemove).toHaveBeenCalledWith(file)
  })
})
