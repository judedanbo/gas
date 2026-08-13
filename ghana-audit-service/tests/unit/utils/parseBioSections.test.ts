import { describe, it, expect } from 'vitest'
import { parseBioSections } from '~/utils/parseBioSections'
import { sanitizeHtml } from '~/utils/sanitizeHtml'

describe('parseBioSections', () => {
  it('returns single section with null heading for plain text', () => {
    const bio = 'A simple bio with no sections.'
    const result = parseBioSections(bio)
    expect(result).toEqual([{ heading: null, content: 'A simple bio with no sections.', isHtml: false }])
  })

  it('returns empty array for empty string', () => {
    const result = parseBioSections('')
    expect(result).toEqual([])
  })

  it('parses multiple sections with ## markers', () => {
    const bio = `## Career Background
Joined in 2004 as Assistant Auditor-General.

Served in multiple departments.

## Qualifications
Chartered Accountant.

MBA in Finance.`

    const result = parseBioSections(bio)
    expect(result).toEqual([
      {
        heading: 'Career Background',
        content:
          'Joined in 2004 as Assistant Auditor-General.\n\nServed in multiple departments.', isHtml: false
      },
      {
        heading: 'Qualifications',
        content: 'Chartered Accountant.\n\nMBA in Finance.', isHtml: false
      },
    ])
  })

  it('handles content before the first ## as a null-heading section', () => {
    const bio = `Mr. Smith is a senior official.

## Career Background
Joined in 2004.`

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: null, content: 'Mr. Smith is a senior official.', isHtml: false },
      { heading: 'Career Background', content: 'Joined in 2004.', isHtml: false },
    ])
  })

  it('trims whitespace from headings and content', () => {
    const bio = `##   Spaced Heading

  Content with leading spaces.  `

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: 'Spaced Heading', content: 'Content with leading spaces.', isHtml: false },
    ])
  })

  it('skips sections with empty content after trimming', () => {
    const bio = `## Empty Section

## Real Section
Has content.`

    const result = parseBioSections(bio)
    expect(result).toEqual([{ heading: 'Real Section', content: 'Has content.', isHtml: false }])
  })

  it('skips heading-only sections with no body text', () => {
    const bio = `## Solo Heading
## Real Section
Has content.`
    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: 'Real Section', content: 'Has content.', isHtml: false }
    ])
  })

  describe('HTML bios (admin TipTap editor)', () => {
    it('flags editor HTML as one untitled section instead of escaping it as text', () => {
      // The admin editor runs StarterKit with `heading: false`, so this is the shape
      // real bios take — and the case that used to render raw <p> tags on the page.
      const bio = '<p>Dr. Graham was appointed in 2023.</p><p>She holds a PhD.</p>'
      expect(parseBioSections(bio)).toEqual([
        { heading: null, content: bio, isHtml: true }
      ])
    })

    it('preserves inline markup so the section can be rendered with v-html', () => {
      const bio = '<p>A <strong>Chartered Accountant</strong> and <em>CIA</em>.</p>'
      const [section] = parseBioSections(bio)
      expect(section.isHtml).toBe(true)
      expect(section.content).toContain('<strong>Chartered Accountant</strong>')
    })

    it('survives the profile page render path intact', () => {
      // The composition is what actually regressed: the page pairs parseBioSections
      // with sanitizeHtml, so formatting must not be stripped on the way to the DOM,
      // while scripting must be.
      const bio =
        '<p>Appointed in 2023.</p><ul><li>MBA</li></ul>' +
        '<p><a href="https://icagh.com">ICAG</a> member.</p><script>alert(1)</script>'
      const [section] = parseBioSections(bio)
      const rendered = sanitizeHtml(section.content)

      expect(rendered).toContain('<li>MBA</li>')
      expect(rendered).toContain('href="https://icagh.com"')
      expect(rendered).not.toContain('<script')
    })

    it('splits HTML on heading elements, mirroring the ## behaviour', () => {
      const bio =
        '<p>Intro text.</p><h2>Career Background</h2><p>Joined in 2004.</p>' +
        '<h2>Qualifications</h2><ul><li>MBA</li></ul>'
      expect(parseBioSections(bio)).toEqual([
        { heading: null, content: '<p>Intro text.</p>', isHtml: true },
        { heading: 'Career Background', content: '<p>Joined in 2004.</p>', isHtml: true },
        { heading: 'Qualifications', content: '<ul><li>MBA</li></ul>', isHtml: true }
      ])
    })

    it('drops sections whose body is markup with no text', () => {
      // TipTap leaves a trailing empty paragraph behind on save.
      const bio = '<h2>Career</h2><p>Real content.</p><h2>Empty</h2><p></p>'
      expect(parseBioSections(bio)).toEqual([
        { heading: 'Career', content: '<p>Real content.</p>', isHtml: true }
      ])
    })

    it('treats a bare comparison in plain text as text, not markup', () => {
      const bio = 'Audited < 5% of entities before 2004.'
      expect(parseBioSections(bio)).toEqual([
        { heading: null, content: bio, isHtml: false }
      ])
    })

    it('returns an empty array for markup carrying no prose', () => {
      expect(parseBioSections('<p></p>')).toEqual([])
    })
  })
})
