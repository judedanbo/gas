import { describe, it, expect, vi, beforeEach } from 'vitest'
import { persistOptimizationResult } from '~/server/utils/persistOptimizationResult'
import { logError } from '~/server/utils/logger'
import type { OptimizeResult } from '~/server/utils/pdfOptimizer'

const captured = vi.hoisted(() => ({
  sets: [] as Array<Record<string, unknown>>,
  wheres: [] as unknown[],
  fail: false
}))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/database', () => ({
  getDatabase: vi.fn(() => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async (where: unknown) => {
          if (captured.fail) throw new Error('db down')
          captured.sets.push(values)
          captured.wheres.push(where)
        }
      })
    })
  })),
  schema: {
    auditReports: { id: 'col_id', fileUrl: 'col_file_url', deletedAt: 'col_deleted_at' }
  }
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  isNull: (col: unknown) => ({ op: 'isNull', col })
}))

vi.mock('~/server/utils/logger', () => ({
  logError: vi.fn()
}))

const result: OptimizeResult = {
  originalSize: 100,
  optimizedSize: 40,
  savedBytes: 60,
  skippedCompression: false,
  nativePages: 2,
  scannedPages: 1,
  ocrFailedPages: 0,
  pageCount: 3
}

describe('persistOptimizationResult', () => {
  beforeEach(() => {
    captured.sets = []
    captured.wheres = []
    captured.fail = false
  })

  it('updates by reportId with size, timestamp, and metadata', async () => {
    await persistOptimizationResult('/pdf/reports/a.pdf', 7, 'ebook', result)

    expect(captured.sets).toHaveLength(1)
    expect(captured.sets[0].fileSize).toBe('40')
    expect(captured.sets[0].optimizedAt).toBeInstanceOf(Date)
    expect(captured.sets[0].optimizationMeta).toMatchObject({
      preset: 'ebook',
      savedBytes: 60,
      pageCount: 3,
      skippedCompression: false
    })
    expect(captured.wheres[0]).toMatchObject({ op: 'eq', col: 'col_id', val: 7 })
  })

  it('falls back to a soft-delete-aware fileUrl match when reportId is null', async () => {
    await persistOptimizationResult('/pdf/reports/b.pdf', null, 'screen', result)

    expect(captured.wheres[0]).toMatchObject({
      op: 'and',
      args: [
        { op: 'eq', col: 'col_file_url', val: '/pdf/reports/b.pdf' },
        { op: 'isNull', col: 'col_deleted_at' }
      ]
    })
  })

  it('records the run but keeps the stored size when compression was skipped', async () => {
    await persistOptimizationResult('/pdf/reports/c.pdf', 3, 'ebook', {
      ...result,
      optimizedSize: 100,
      savedBytes: 0,
      skippedCompression: true
    })

    expect(captured.sets[0].fileSize).toBeUndefined()
    expect(captured.sets[0].optimizedAt).toBeInstanceOf(Date)
    expect((captured.sets[0].optimizationMeta as { skippedCompression: boolean }).skippedCompression).toBe(
      true
    )
  })

  it('never throws on database failure — logs and returns', async () => {
    captured.fail = true
    await expect(
      persistOptimizationResult('/pdf/reports/d.pdf', 1, 'ebook', result)
    ).resolves.toBeUndefined()
    expect(vi.mocked(logError)).toHaveBeenCalled()
  })
})
