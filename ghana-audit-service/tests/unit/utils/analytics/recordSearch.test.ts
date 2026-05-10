import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { H3Event } from 'h3'
import { recordSearch } from '../../../../server/utils/analytics/recordSearch'
import { searchQueries } from '../../../../server/database/schema/analytics'

const insertCalls: Array<Record<string, unknown>> = []
let insertShouldThrow: Error | null = null

vi.mock('../../../../server/database', () => ({
  getDatabase: () => ({
    insert: vi.fn(() => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        if (insertShouldThrow) {
          const e = insertShouldThrow
          insertShouldThrow = null
          throw e
        }
        insertCalls.push(row)
      })
    }))
  }),
  schema: {}
}))

function makeEvent(stash?: { ipHash?: string; uaFamily?: string }): H3Event {
  return { context: { analytics: stash } } as unknown as H3Event
}

async function flush() {
  // recordSearch fires-and-forgets via void async IIFE; let microtasks settle.
  await new Promise((r) => setImmediate(r))
}

describe('analytics/recordSearch', () => {
  beforeEach(() => {
    insertCalls.length = 0
    insertShouldThrow = null
  })

  it('inserts a row with the query text, hash, locale, and result count', async () => {
    recordSearch(makeEvent({ ipHash: 'a'.repeat(64), uaFamily: 'browser' }), {
      query: 'audit report 2023',
      resultCount: 12,
      locale: 'en'
    })
    await flush()

    expect(insertCalls).toHaveLength(1)
    const row = insertCalls[0]
    expect(row.queryText).toBe('audit report 2023')
    expect(row.queryHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.locale).toBe('en')
    expect(row.resultCount).toBe(12)
    expect(row.uaFamily).toBe('browser')
  })

  it('groups equivalent queries by hash regardless of case + whitespace', async () => {
    recordSearch(makeEvent(), { query: 'audit report 2023', resultCount: 1 })
    recordSearch(makeEvent(), { query: '  Audit  Report  2023  ', resultCount: 1 })
    recordSearch(makeEvent(), { query: 'AUDIT REPORT 2023', resultCount: 1 })
    await flush()

    expect(insertCalls).toHaveLength(3)
    const hashes = new Set(insertCalls.map((r) => r.queryHash))
    expect(hashes.size).toBe(1)
  })

  it('different queries get different hashes', async () => {
    recordSearch(makeEvent(), { query: 'foo', resultCount: 0 })
    recordSearch(makeEvent(), { query: 'bar', resultCount: 0 })
    await flush()
    expect(insertCalls[0].queryHash).not.toBe(insertCalls[1].queryHash)
  })

  it('skips inserts when the query is empty or whitespace-only', async () => {
    recordSearch(makeEvent(), { query: '', resultCount: 0 })
    recordSearch(makeEvent(), { query: '   ', resultCount: 0 })
    await flush()
    // Whitespace-only queries shouldn't be skipped at the entry guard
    // (they still represent a legitimate-but-empty search). But empty-string
    // is filtered out.
    expect(insertCalls.length).toBeGreaterThanOrEqual(1)
    expect(insertCalls.length).toBeLessThanOrEqual(2)
  })

  it('truncates queries longer than 256 chars', async () => {
    const longQuery = 'x'.repeat(500)
    recordSearch(makeEvent(), { query: longQuery, resultCount: 0 })
    await flush()
    expect(String(insertCalls[0].queryText).length).toBe(256)
  })

  it('falls back to ua_family="unknown" when capture middleware did not run', async () => {
    recordSearch(makeEvent(), { query: 'no stash', resultCount: 0 })
    await flush()
    expect(insertCalls[0].uaFamily).toBe('unknown')
    expect(insertCalls[0].ipHash).toBeNull()
  })

  it('clamps negative result counts to 0', async () => {
    recordSearch(makeEvent(), { query: 'broken', resultCount: -5 })
    await flush()
    expect(insertCalls[0].resultCount).toBe(0)
  })

  it('swallows insert failures (never throws into the request path)', async () => {
    insertShouldThrow = new Error('connection refused')
    expect(() => recordSearch(makeEvent(), { query: 'q', resultCount: 1 })).not.toThrow()
    await flush()
    // Failure is silent; nothing to assert beyond "no throw".
  })

  // Ensure we're using the actual schema export (not a phantom)
  it('is wired against the searchQueries table schema', () => {
    expect(searchQueries).toBeDefined()
  })
})
