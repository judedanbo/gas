import { describe, it, expect } from 'vitest'
import { htmlToPlainText, htmlToExcerpt } from '~/utils/htmlToPlainText'

describe('htmlToPlainText', () => {
  it('returns an empty string for nullish or empty input', () => {
    expect(htmlToPlainText(null)).toBe('')
    expect(htmlToPlainText(undefined)).toBe('')
    expect(htmlToPlainText('')).toBe('')
  })

  it('leaves plain text untouched', () => {
    expect(htmlToPlainText('Already plain text.')).toBe('Already plain text.')
  })

  it('removes tags authored in the rich-text editor', () => {
    expect(htmlToPlainText('<p>Appointed in <strong>2023</strong>.</p>')).toBe('Appointed in 2023.')
  })

  it('separates block elements so paragraphs do not run together', () => {
    // The regression the hand-rolled strippers had: deleting tags outright
    // turned this into "OneTwo".
    expect(htmlToPlainText('<p>One</p><p>Two</p>')).toBe('One Two')
    expect(htmlToPlainText('<ul><li>First</li><li>Second</li></ul>')).toBe('First Second')
    expect(htmlToPlainText('Line one<br>Line two')).toBe('Line one Line two')
  })

  it('keeps inline emphasis from splitting a word', () => {
    expect(htmlToPlainText('end<em>ing</em>')).toBe('ending')
  })

  it('decodes entities to literal characters', () => {
    expect(htmlToPlainText('<p>Audit&nbsp;&amp; Assurance</p>')).toBe('Audit & Assurance')
    expect(htmlToPlainText('&lt;script&gt;')).toBe('<script>')
    expect(htmlToPlainText('&#8212;dash')).toBe('—dash')
    expect(htmlToPlainText('&#x2014;dash')).toBe('—dash')
  })

  it('does not throw on malformed or out-of-range entities', () => {
    expect(() => htmlToPlainText('&#xD800;&#0;&notarealentity;')).not.toThrow()
  })

  it('drops script and style content rather than surfacing it as prose', () => {
    expect(htmlToPlainText('<p>Bio</p><script>alert(1)</script>')).toBe('Bio')
    expect(htmlToPlainText('<style>.a{color:red}</style><p>Bio</p>')).toBe('Bio')
  })

  it('is not defeated by markup that reassembles when naively stripped', () => {
    // The reason this parses instead of regex-stripping: a single
    // `replace(/<[^>]*>/g, '')` pass over these leaves a live tag behind.
    expect(htmlToPlainText('<<script>script>alert(1)<</script>/script>')).not.toContain('<script')
    expect(htmlToPlainText('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toContain('<script')
    expect(htmlToPlainText('<img src=x onerror=alert(1)>')).not.toContain('onerror')
  })

  it('collapses the whitespace that block markup leaves behind', () => {
    expect(htmlToPlainText('<p>  Spaced   out  </p>\n\n<p>text</p>')).toBe('Spaced out text')
  })
})

describe('htmlToExcerpt', () => {
  it('returns the full text when it fits', () => {
    expect(htmlToExcerpt('<p>Short bio.</p>', 100)).toBe('Short bio.')
  })

  it('cuts on a word boundary and appends an ellipsis', () => {
    const result = htmlToExcerpt('<p>The Ghana Audit Service publishes reports.</p>', 20)
    expect(result).toBe('The Ghana Audit…')
    expect(result).not.toContain('<')
  })

  it('falls back to a hard cut when the first word exceeds the limit', () => {
    expect(htmlToExcerpt('Supercalifragilistic', 10)).toBe('Supercalif…')
  })

  it('returns an empty string for nullish input', () => {
    expect(htmlToExcerpt(null, 50)).toBe('')
    expect(htmlToExcerpt(undefined, 50)).toBe('')
  })
})
