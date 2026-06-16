import { describe, it, expect } from 'vitest'
import { baselineIfNeeded, baselineLedgerRow, type SqlExecutor } from '~/server/database/baseline'

// The exact values Drizzle writes for 0000_init_squash — also hardcoded in
// k8s/jobs/baseline-prod-drizzle-migrations.sql. If the baseline migration is
// ever regenerated these change; this test pins them to the real files.
const EXPECTED_HASH = '4bae540fae96167e6c375a3f8e4f32e8e0ba81e7c0a92b46ed1d3b4538fe9923'
const EXPECTED_WHEN = 1781453046275

function mockExecutor(state: {
  usersExists: boolean
  ledgerExists?: boolean
  ledgerRows?: number
}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = []
  const exec: SqlExecutor = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values })
      const norm = sql.replace(/\s+/g, ' ').trim().toLowerCase()
      if (norm.includes('information_schema.tables')) {
        const table = (values as string[] | undefined)?.[0]
        const exists = table === 'users' ? state.usersExists : (state.ledgerExists ?? false)
        return [[{ n: exists ? 1 : 0 }], []]
      }
      if (norm.startsWith('select count(*) as n from `__drizzle_migrations`')) {
        return [[{ n: state.ledgerRows ?? 0 }], []]
      }
      return [{ affectedRows: 1 }, []] // CREATE / INSERT
    }
  }
  return { exec, calls }
}

const inserted = (calls: Array<{ sql: string }>) => calls.some((c) => /insert into/i.test(c.sql))

describe('baselineLedgerRow', () => {
  it('derives the exact hash + when Drizzle writes for 0000_init_squash', () => {
    const row = baselineLedgerRow()
    expect(row.tag).toBe('0000_init_squash')
    expect(row.hash).toBe(EXPECTED_HASH)
    expect(row.when).toBe(EXPECTED_WHEN)
  })
})

describe('baselineIfNeeded', () => {
  it('does nothing on a fresh DB (no core table)', async () => {
    const { exec, calls } = mockExecutor({ usersExists: false })
    expect(await baselineIfNeeded(exec)).toBe('fresh')
    expect(inserted(calls)).toBe(false)
  })

  it('no-ops when the ledger already has rows', async () => {
    const { exec, calls } = mockExecutor({
      usersExists: true,
      ledgerExists: true,
      ledgerRows: 1
    })
    expect(await baselineIfNeeded(exec)).toBe('already-tracked')
    expect(inserted(calls)).toBe(false)
  })

  it('seeds the baseline row when schema exists but ledger is empty', async () => {
    const { exec, calls } = mockExecutor({
      usersExists: true,
      ledgerExists: true,
      ledgerRows: 0
    })
    expect(await baselineIfNeeded(exec)).toBe('baselined')
    const insert = calls.find((c) => /insert into/i.test(c.sql))
    expect(insert?.values).toEqual([EXPECTED_HASH, EXPECTED_WHEN])
  })

  it('also baselines when the ledger table does not exist yet', async () => {
    const { exec, calls } = mockExecutor({
      usersExists: true,
      ledgerExists: false
    })
    expect(await baselineIfNeeded(exec)).toBe('baselined')
    expect(calls.some((c) => /create table if not exists/i.test(c.sql))).toBe(true)
    expect(inserted(calls)).toBe(true)
  })
})
