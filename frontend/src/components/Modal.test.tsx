import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { describe, expect, it, jest as vi } from '@jest/globals'
import { Modal } from './Modal'

describe('Modal', () => {
  it('shows its content and closes from the close button', () => {
    const onClose = vi.fn()
    render(<Modal title="Confirm action" subtitle="Check this first" onClose={onClose}>Dialog body</Modal>)

    expect(screen.getByRole('dialog', { name: 'Confirm action' })).toBeTruthy()
    expect(screen.getByText('Dialog body')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop click but not on a dialog click', () => {
    const onClose = vi.fn()
    const { container } = render(<Modal title="Confirm action" subtitle="" onClose={onClose}>Body</Modal>)
    const backdrop = container.querySelector('.modal-backdrop')!

    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
