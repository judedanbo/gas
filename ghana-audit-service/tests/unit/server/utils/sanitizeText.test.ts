import { describe, it, expect } from 'vitest'
import { stripHtmlToText } from '~/server/utils/sanitizeText'

describe('stripHtmlToText', () => {
  it('returns empty string for nullish/empty input', () => {
    expect(stripHtmlToText('')).toBe('')
    expect(stripHtmlToText(null)).toBe('')
    expect(stripHtmlToText(undefined)).toBe('')
  })

  it('drops <script> tags and their content', () => {
    const out = stripHtmlToText('Hello <script>alert(1)</script> world')
    expect(out).not.toContain('script')
    expect(out).not.toContain('alert')
    expect(out).toContain('Hello')
    expect(out).toContain('world')
  })

  it('neutralizes an img onerror payload', () => {
    const out = stripHtmlToText('<img src=x onerror="alert(document.cookie)">')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('<img')
    expect(out).toBe('')
  })

  it('keeps the text content of formatting tags', () => {
    expect(stripHtmlToText('<b>bold</b> and <i>italic</i>')).toBe('bold and italic')
  })

  it('keeps literal special characters (no entity-encoding → no double-escape)', () => {
    expect(stripHtmlToText("Tom & Jerry's report")).toBe("Tom & Jerry's report")
    expect(stripHtmlToText('5 < 10 and 10 > 5')).toBe('5 < 10 and 10 > 5')
  })

  it('preserves newlines in multi-line messages', () => {
    expect(stripHtmlToText('line1\nline2\nline3')).toBe('line1\nline2\nline3')
  })

  it('strips a stored-then-rendered XSS vector to plain text', () => {
    const out = stripHtmlToText('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toBe('click')
  })
})
