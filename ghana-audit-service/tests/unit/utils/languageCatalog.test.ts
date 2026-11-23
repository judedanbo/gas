import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  CATALOG_CODES,
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CATALOG,
  catalogLanguage,
  splitLocalePrefix
} from '~/utils/languageCatalog'

describe('language catalogue', () => {
  it('has unique, lowercase 2–3 letter codes and never lists English', () => {
    expect(new Set(CATALOG_CODES).size).toBe(CATALOG_CODES.length)
    for (const code of CATALOG_CODES) expect(code).toMatch(/^[a-z]{2,3}$/)
    expect(CATALOG_CODES).not.toContain(DEFAULT_LANGUAGE_CODE)
  })

  it('has unique BCP 47 tags (sitemaps are named after them)', () => {
    const tags = LANGUAGE_CATALOG.map((language) => language.language)
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('only references bundled message files that exist', () => {
    for (const language of LANGUAGE_CATALOG) {
      if (!language.file) continue
      expect(fs.existsSync(path.join(process.cwd(), 'i18n/locales', language.file))).toBe(true)
    }
  })

  // A page folder named like a language code would be swallowed by that
  // language's URL prefix.
  it('does not collide with a top-level page or server route', () => {
    const taken = [
      ...fs.readdirSync(path.join(process.cwd(), 'pages')),
      ...fs.readdirSync(path.join(process.cwd(), 'server/routes')),
      'api'
    ].map((name) => name.replace(/\.(vue|ts)$/, ''))
    expect(CATALOG_CODES.filter((code) => taken.includes(code))).toEqual([])
  })

  it('looks languages up by code', () => {
    expect(catalogLanguage('ak')?.name).toBe('Akan')
    expect(catalogLanguage('en')).toBeUndefined()
    expect(catalogLanguage('zz')).toBeUndefined()
  })
})

describe('splitLocalePrefix', () => {
  it('detaches a catalogue language prefix', () => {
    expect(splitLocalePrefix('/ak/reports/5')).toEqual({ code: 'ak', rest: '/reports/5' })
    expect(splitLocalePrefix('/gaa/contact')).toEqual({ code: 'gaa', rest: '/contact' })
    expect(splitLocalePrefix('/ak')).toEqual({ code: 'ak', rest: '/' })
    expect(splitLocalePrefix('/ak/')).toEqual({ code: 'ak', rest: '/' })
  })

  it('keeps the query string and hash', () => {
    expect(splitLocalePrefix('/ak?x=1')).toEqual({ code: 'ak', rest: '/?x=1' })
    expect(splitLocalePrefix('/ee/reports?year=2024#top')).toEqual({
      code: 'ee',
      rest: '/reports?year=2024#top'
    })
  })

  it('leaves everything else alone', () => {
    for (const p of [
      '/',
      '/reports',
      '/about/the-service',
      '/api/news',
      '/akan',
      '/en/reports',
      '/AK/x'
    ]) {
      expect(splitLocalePrefix(p)).toEqual({ code: null, rest: p })
    }
  })
})
