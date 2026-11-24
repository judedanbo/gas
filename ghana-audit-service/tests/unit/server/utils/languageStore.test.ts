import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SOURCE_MESSAGES,
  bundledMessages,
  countTranslated,
  getMessageOverrides,
  getSiteLanguages,
  invalidateLanguageCache,
  isLanguageEnabled
} from '~/server/utils/languageStore'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
const dbState = { rows: [] as unknown[], fail: false, queries: 0 }

function makeQuery() {
  const result = () => {
    dbState.queries++
    return dbState.fail ? Promise.reject(new Error('db down')) : Promise.resolve(dbState.rows)
  }
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'limit']) chain[method] = () => chain
  chain.orderBy = () => result()
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    result().then(resolve, reject)
  return chain
}

vi.mock('~/server/database', () => ({
  getDatabase: vi.fn(() => ({ select: () => makeQuery() })),
  schema: {
    languages: {
      code: 'code',
      name: 'name',
      nativeName: 'native_name',
      isEnabled: 'is_enabled',
      sortOrder: 'sort_order'
    },
    uiTranslations: { locale: 'locale', messageKey: 'message_key', value: 'value' }
  }
}))

vi.mock('~/server/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn() }))

const AKAN = { code: 'ak', name: 'Akan', nativeName: 'Akan' }

beforeEach(() => {
  invalidateLanguageCache()
  dbState.rows = []
  dbState.fail = false
  dbState.queries = 0
})

describe('bundled messages', () => {
  it('exposes the English keys as the translatable set', () => {
    expect(Object.keys(SOURCE_MESSAGES).length).toBeGreaterThan(100)
    expect(SOURCE_MESSAGES['common.home']).toBe('Home')
  })

  it('has a bundled file for Akan only', () => {
    expect(Object.keys(bundledMessages('ak')).length).toBeGreaterThan(100)
    expect(bundledMessages('ee')).toEqual({})
  })

  it('counts bundled and entered translations without double counting', () => {
    const akan = Object.keys(bundledMessages('ak')).length
    expect(countTranslated('ak', ['common.home'])).toBe(akan)
    expect(countTranslated('ee', ['common.home', 'common.about', 'gone.key'])).toBe(2)
  })
})

describe('getSiteLanguages', () => {
  it('is English only when nothing is enabled', async () => {
    const languages = await getSiteLanguages()
    expect(languages.map((language) => language.code)).toEqual(['en'])
    expect(languages[0].isDefault).toBe(true)
    expect(await isLanguageEnabled('ak')).toBe(false)
    expect(await isLanguageEnabled('en')).toBe(true)
  })

  it('adds enabled catalogue languages and ignores unknown codes', async () => {
    dbState.rows = [AKAN, { code: 'zz', name: 'Nope', nativeName: 'Nope' }]
    expect((await getSiteLanguages()).map((language) => language.code)).toEqual(['en', 'ak'])
    expect(await isLanguageEnabled('ak')).toBe(true)
    expect(await isLanguageEnabled('zz')).toBe(false)
  })

  it('answers repeat lookups from the cache', async () => {
    await getSiteLanguages()
    await getSiteLanguages()
    await isLanguageEnabled('ak')
    expect(dbState.queries).toBe(1)
  })

  it('falls back to English only when the database cannot be read', async () => {
    dbState.fail = true
    expect((await getSiteLanguages()).map((language) => language.code)).toEqual(['en'])
  })

  it('shares one query between concurrent lookups', async () => {
    await Promise.all([getSiteLanguages(), getSiteLanguages(), getSiteLanguages()])
    expect(dbState.queries).toBe(1)
  })
})

describe('getMessageOverrides', () => {
  it('returns nothing for English or a language that is not enabled', async () => {
    expect(await getMessageOverrides('en')).toEqual({})
    expect(await getMessageOverrides('ak')).toEqual({})
  })

  it('nests entered translations and drops keys English no longer has', async () => {
    dbState.rows = [AKAN]
    await getSiteLanguages()
    dbState.rows = [
      { key: 'common.home', value: 'Fie' },
      { key: 'removed.key', value: 'x' }
    ]
    expect(await getMessageOverrides('ak')).toEqual({ common: { home: 'Fie' } })
  })
})
