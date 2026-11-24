import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findPublishedServiceApp,
  getPublishedServiceApps,
  invalidateServiceAppCache
} from '~/server/utils/serviceAppStore'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
const dbState = {
  apps: [] as Record<string, unknown>[],
  translations: [] as Record<string, unknown>[],
  fail: false,
  queries: 0
}

function makeQuery() {
  let table = ''
  const result = () => {
    dbState.queries++
    if (dbState.fail) return Promise.reject(new Error('db down'))
    return Promise.resolve(table === 'service_apps' ? dbState.apps : dbState.translations)
  }
  const chain: Record<string, unknown> = {}
  chain.from = (t: { __name: string }) => {
    table = t.__name
    return chain
  }
  chain.where = () => chain
  chain.orderBy = () => result()
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    result().then(resolve, reject)
  return chain
}

vi.mock('~/server/database', () => ({
  getDatabase: vi.fn(() => ({ select: () => makeQuery() })),
  schema: {
    serviceApps: {
      __name: 'service_apps',
      id: 'id',
      isActive: 'is_active',
      sortOrder: 'sort_order'
    },
    serviceAppTranslations: { __name: 'service_app_translations', appId: 'app_id' }
  }
}))

function appRow(id: number, slug: string) {
  return { id, slug, url: `https://${slug}.audit.gov.gh`, icon: 'heroicons:eye', isActive: true }
}

function englishRow(appId: number, name: string) {
  return { appId, locale: 'en', name, summary: `${name} summary`, content: null }
}

beforeEach(() => {
  invalidateServiceAppCache()
  dbState.apps = [appRow(1, 'citizenseye'), appRow(2, 'tracker'), appRow(3, 'draft')]
  dbState.translations = [englishRow(1, 'CitizensEye'), englishRow(2, 'Tracker')]
  dbState.fail = false
  dbState.queries = 0
})

describe('getPublishedServiceApps', () => {
  it('lists apps that have English text, with their translations', async () => {
    const apps = await getPublishedServiceApps()
    // App 3 has no English version yet, so it isn't shown.
    expect(apps.map((app) => app.slug)).toEqual(['citizenseye', 'tracker'])
    expect(apps[0].translations.en?.name).toBe('CitizensEye')
    expect(apps[0].translations.en?.tagline).toBe('')
  })

  it('answers from the cache until an admin change invalidates it', async () => {
    await getPublishedServiceApps()
    await findPublishedServiceApp('tracker')
    await findPublishedServiceApp('no-such-app')
    expect(dbState.queries).toBe(2) // apps + translations, once

    invalidateServiceAppCache()
    await getPublishedServiceApps()
    expect(dbState.queries).toBe(4)
  })

  it('shares one load between concurrent callers', async () => {
    await Promise.all([getPublishedServiceApps(), getPublishedServiceApps()])
    expect(dbState.queries).toBe(2)
  })

  it('fails when the database is down and nothing is cached', async () => {
    dbState.fail = true
    await expect(getPublishedServiceApps()).rejects.toThrow('db down')
  })

  it('keeps serving the last good list when a refresh fails', async () => {
    vi.useFakeTimers()
    try {
      await getPublishedServiceApps()
      vi.advanceTimersByTime(31_000)
      dbState.fail = true
      expect((await getPublishedServiceApps()).map((app) => app.slug)).toEqual([
        'citizenseye',
        'tracker'
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('finds a published app by its address', async () => {
    expect((await findPublishedServiceApp('tracker'))?.id).toBe(2)
    expect(await findPublishedServiceApp('draft')).toBeNull()
  })
})
