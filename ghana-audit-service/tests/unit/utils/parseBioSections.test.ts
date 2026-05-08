import { describe, it, expect } from 'vitest'
import { parseBioSections } from '~/utils/parseBioSections'

describe('parseBioSections', () => {
  it('returns single section with null heading for plain text', () => {
    const bio = 'A simple bio with no sections.'
    const result = parseBioSections(bio)
    expect(result).toEqual([{ heading: null, content: 'A simple bio with no sections.' }])
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
          'Joined in 2004 as Assistant Auditor-General.\n\nServed in multiple departments.',
      },
      {
        heading: 'Qualifications',
        content: 'Chartered Accountant.\n\nMBA in Finance.',
      },
    ])
  })

  it('handles content before the first ## as a null-heading section', () => {
    const bio = `Mr. Smith is a senior official.

## Career Background
Joined in 2004.`

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: null, content: 'Mr. Smith is a senior official.' },
      { heading: 'Career Background', content: 'Joined in 2004.' },
    ])
  })

  it('trims whitespace from headings and content', () => {
    const bio = `##   Spaced Heading

  Content with leading spaces.  `

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: 'Spaced Heading', content: 'Content with leading spaces.' },
    ])
  })

  it('skips sections with empty content after trimming', () => {
    const bio = `## Empty Section

## Real Section
Has content.`

    const result = parseBioSections(bio)
    expect(result).toEqual([{ heading: 'Real Section', content: 'Has content.' }])
  })

  it('skips heading-only sections with no body text', () => {
    const bio = `## Solo Heading
## Real Section
Has content.`
    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: 'Real Section', content: 'Has content.' }
    ])
  })
})
