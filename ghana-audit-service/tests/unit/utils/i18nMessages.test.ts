import { describe, it, expect } from 'vitest'
import {
  flattenMessages,
  unflattenMessages,
  messagePlaceholders,
  placeholderMismatch,
  messageSyntaxProblem
} from '~/utils/i18nMessages'

describe('flattenMessages / unflattenMessages', () => {
  it('flattens nested messages to dotted keys', () => {
    expect(flattenMessages({ nav: { home: 'Home', sub: { a: 'A' } }, title: 'T' })).toEqual({
      'nav.home': 'Home',
      'nav.sub.a': 'A',
      title: 'T'
    })
  })

  it('skips non-string leaves and non-objects', () => {
    expect(flattenMessages({ a: 1, b: ['x'], c: null, d: 'ok' })).toEqual({ d: 'ok' })
    expect(flattenMessages('nope')).toEqual({})
    expect(flattenMessages(['a'])).toEqual({})
  })

  it('round-trips', () => {
    const nested = { nav: { home: 'Home', about: 'About' }, footer: { legal: { terms: 'Terms' } } }
    expect(unflattenMessages(flattenMessages(nested))).toEqual(nested)
  })

  it('never writes through prototype keys', () => {
    const out = unflattenMessages({ '__proto__.polluted': 'x', 'a.constructor.b': 'y', ok: 'z' })
    expect(out).toEqual({ ok: 'z' })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('drops a key that collides with an existing leaf or branch', () => {
    expect(unflattenMessages({ a: 'leaf', 'a.b': 'child' })).toEqual({ a: 'leaf' })
    expect(unflattenMessages({ 'a.b': 'child', a: 'leaf' })).toEqual({ a: { b: 'child' } })
  })
})

describe('placeholders', () => {
  it('lists named placeholders once, sorted', () => {
    expect(messagePlaceholders('Slide {current} of {total}, {current}')).toEqual([
      'current',
      'total'
    ])
    expect(messagePlaceholders('No placeholders')).toEqual([])
  })

  it('reports lost and invented placeholders', () => {
    expect(placeholderMismatch('View all {count} results', 'Hwɛ nyinaa')).toEqual({
      missing: ['count'],
      unknown: []
    })
    expect(placeholderMismatch('View all {count} results', 'Hwɛ {total}')).toEqual({
      missing: ['count'],
      unknown: ['total']
    })
    expect(placeholderMismatch('Page {n}', 'Kratafa {n}')).toEqual({ missing: [], unknown: [] })
  })
})

describe('messageSyntaxProblem', () => {
  it('accepts plain text and well-formed placeholders', () => {
    expect(messageSyntaxProblem('Aƒeme')).toBeNull()
    expect(
      messageSyntaxProblem('Kratafa {current} wɔ {total} mu', 'Slide {current} of {total}')
    ).toBeNull()
  })

  it('rejects unbalanced or stray braces', () => {
    expect(messageSyntaxProblem('bad {count')).toMatch(/Curly braces/)
    expect(messageSyntaxProblem('bad }')).toMatch(/Curly braces/)
    expect(messageSyntaxProblem('{two words}')).toMatch(/Curly braces/)
  })

  it('rejects @ and | unless English uses them too', () => {
    expect(messageSyntaxProblem('mail info@audit.gov.gh')).toMatch(/@/)
    expect(messageSyntaxProblem('mail info@audit.gov.gh', 'Email info@audit.gov.gh')).toBeNull()
    expect(messageSyntaxProblem('one | many')).toMatch(/\|/)
    expect(messageSyntaxProblem('baako | bebree', 'one | many')).toBeNull()
  })
})
