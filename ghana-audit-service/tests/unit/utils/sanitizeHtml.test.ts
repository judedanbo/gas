import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '~/utils/sanitizeHtml'

describe('sanitizeHtml', () => {
  it('returns empty string for nullish input', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
    expect(sanitizeHtml('')).toBe('')
  })

  it('preserves safe rich-text markup', () => {
    const html = '<p>Hello <strong>world</strong> and <em>everyone</em></p>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('strips script tags', () => {
    const result = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    expect(result).not.toContain('<script')
    expect(result).toContain('<p>ok</p>')
  })

  it('strips inline event handlers', () => {
    const result = sanitizeHtml('<img src=x onerror="alert(1)">')
    expect(result).not.toContain('onerror')
  })

  it('strips javascript: URLs from links', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('hardens links that open in a new tab with rel="noopener noreferrer"', () => {
    const result = sanitizeHtml('<a href="https://example.com" target="_blank">link</a>')
    expect(result).toContain('rel="noopener noreferrer"')
  })
})
