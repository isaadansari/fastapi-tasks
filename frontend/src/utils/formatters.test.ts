import { describe, expect, it } from '@jest/globals'
import { formatBytes, formatDate } from './formatters'

describe('formatBytes', () => {
  it('formats bytes and larger units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})

describe('formatDate', () => {
  it('formats a date for display', () => {
    expect(formatDate('2024-05-06T12:00:00Z')).toContain('2024')
  })
})
