import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import {
  applyUploadJobToReport,
  dismissFinishedUploadJobs,
  dismissUploadJob,
  effectiveUploadJob,
  listUploadJobs,
  sweepStalledUploadJobs,
  toUploadJobDTO,
  uploadProgressPercent,
  STAGE_PROGRESS,
  STALL_TIMEOUT_MS,
  type ReportUploadJob
} from '~/server/utils/reportUploadJobs'

const captured = vi.hoisted(() => ({
  ops: [] as Array<{ op: string; values?: Record<string, unknown>; where?: unknown }>,
  affectedRows: 1,
  selectRows: [] as unknown[]
}))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
// The real schema tables are used so SQL rendering in assertions is faithful.
vi.mock('~/server/database', async () => {
  const schema = await vi.importActual<typeof import('~/server/database/schema/index')>(
    '~/server/database/schema/index'
  )
  return {
    schema,
    getDatabase: vi.fn(() => ({
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: (where: unknown) => {
                captured.ops.push({ op: 'select', where })
                return { orderBy: () => ({ limit: async () => captured.selectRows }) }
              }
            })
          })
        })
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async (where: unknown) => {
            captured.ops.push({ op: 'update', values, where })
            return [{ affectedRows: captured.affectedRows }]
          }
        })
      }),
      delete: () => ({
        where: async (where: unknown) => {
          captured.ops.push({ op: 'delete', where })
        }
      })
    }))
  }
})

vi.mock('~/server/utils/logger', () => ({
  logError: vi.fn()
}))

const dialect = new MySqlDialect()
function render(q: unknown): string {
  return dialect.sqlToQuery(q as SQL).sql
}
function params(q: unknown): unknown[] {
  return dialect.sqlToQuery(q as SQL).params
}

const NOW = Date.UTC(2026, 8, 29, 12, 0, 0)

function row(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 7,
    reportId: null,
    status: 'optimizing',
    progress: 40,
    phase: 'classify',
    page: 3,
    totalPages: 10,
    originalName: 'AG Report 2025.pdf',
    filename: '20260929-abc.pdf',
    fileUrl: '/pdf/reports/20260929-abc.pdf',
    mimeType: 'application/pdf',
    size: 5000,
    finalSize: null,
    preset: 'ebook',
    thumbnailUrl: null,
    optimizationJobId: null,
    optimizationStatus: 'pending',
    optimizationResult: null,
    error: null,
    errorCode: null,
    dismissedAt: null,
    createdAt: new Date(NOW - 60_000),
    updatedAt: new Date(NOW - 10_000),
    completedAt: null,
    ...overrides
  }
}

beforeEach(() => {
  captured.ops.length = 0
  captured.affectedRows = 1
  captured.selectRows = []
})

describe('uploadProgressPercent', () => {
  it('starts at the optimizing floor with no phase', () => {
    expect(uploadProgressPercent(null)).toBe(STAGE_PROGRESS.optimizingStart)
    expect(uploadProgressPercent('waiting')).toBe(STAGE_PROGRESS.optimizingStart)
  })

  it('is monotonic across phases and refined by page progress', () => {
    const inspect = uploadProgressPercent('inspect')
    const classifyStart = uploadProgressPercent('classify', 0, 10)
    const classifyMid = uploadProgressPercent('classify', 5, 10)
    const classifyEnd = uploadProgressPercent('classify', 10, 10)
    const ocrMid = uploadProgressPercent('ocr', 5, 10)
    const compress = uploadProgressPercent('compress')
    expect(inspect).toBeGreaterThan(STAGE_PROGRESS.optimizingStart)
    expect(classifyStart).toBeGreaterThanOrEqual(inspect)
    expect(classifyMid).toBeGreaterThan(classifyStart)
    expect(classifyEnd).toBeGreaterThan(classifyMid)
    expect(ocrMid).toBeGreaterThan(classifyEnd)
    expect(compress).toBeGreaterThan(ocrMid)
    expect(compress).toBeLessThanOrEqual(STAGE_PROGRESS.optimizingEnd)
  })

  it('never exceeds the optimizing ceiling even with bogus page counts', () => {
    expect(uploadProgressPercent('ocr', 50, 10)).toBeLessThanOrEqual(STAGE_PROGRESS.optimizingEnd)
    expect(uploadProgressPercent('done')).toBe(STAGE_PROGRESS.optimizingEnd)
  })
})

describe('effectiveUploadJob', () => {
  it('leaves a recently-updated active job alone', () => {
    const r = row()
    expect(effectiveUploadJob(r, NOW)).toBe(r)
  })

  it('reads a silent active job as failed/STALLED', () => {
    const r = row({ updatedAt: new Date(NOW - STALL_TIMEOUT_MS - 1) })
    const eff = effectiveUploadJob(r, NOW)
    expect(eff.status).toBe('failed')
    expect(eff.errorCode).toBe('STALLED')
    // Never mutates the input.
    expect(r.status).toBe('optimizing')
  })

  it('does not touch terminal jobs however old', () => {
    const r = row({ status: 'completed', updatedAt: new Date(NOW - 10 * STALL_TIMEOUT_MS) })
    expect(effectiveUploadJob(r, NOW).status).toBe('completed')
  })
})

describe('toUploadJobDTO', () => {
  it('shapes the row, applies the stall rule and attaches extras', () => {
    const dto = toUploadJobDTO(row(), { userName: 'Ama', reportTitle: null }, NOW)
    expect(dto.active).toBe(true)
    expect(dto.user).toEqual({ id: 7, name: 'Ama' })
    expect(dto.reportTitle).toBeNull()
    expect(dto.createdAt).toBe(new Date(NOW - 60_000).toISOString())
    expect(dto.completedAt).toBeNull()

    const stalled = toUploadJobDTO(
      row({ updatedAt: new Date(NOW - STALL_TIMEOUT_MS * 2) }),
      {},
      NOW
    )
    expect(stalled.active).toBe(false)
    expect(stalled.status).toBe('failed')
  })

  it('reports 100% for completed jobs regardless of the stored progress', () => {
    const dto = toUploadJobDTO(row({ status: 'completed', progress: 98 }), {}, NOW)
    expect(dto.progress).toBe(100)
  })
})

describe('sweepStalledUploadJobs', () => {
  it('flips only active rows older than the stall cutoff', async () => {
    captured.affectedRows = 2
    const flipped = await sweepStalledUploadJobs(new Date(NOW))
    expect(flipped).toBe(2)
    const [op] = captured.ops
    expect(op.op).toBe('update')
    expect(op.values).toMatchObject({ status: 'failed', errorCode: 'STALLED' })
    const where = render(op.where)
    expect(where).toContain('`status` in (?, ?, ?, ?)')
    expect(where).toContain('`updated_at` < ?')
  })
})

describe('dismissUploadJob', () => {
  it('only dismisses terminal, not-yet-dismissed rows', async () => {
    captured.affectedRows = 0
    expect(await dismissUploadJob(row().id)).toBe(false)
    const where = render(captured.ops[0].where)
    expect(where).toContain('`status` in (?, ?)')
    expect(where).toContain('`dismissed_at` is null')
  })
})

describe('listUploadJobs', () => {
  it("lists every uploader's jobs by default", async () => {
    await listUploadJobs()
    const where = render(captured.ops[0].where)
    expect(where).not.toContain('`user_id`')
    expect(where).toContain('`dismissed_at` is null')
  })

  it('narrows to one uploader for the notification feed', async () => {
    captured.selectRows = [{ job: row(), userName: 'Ama', reportTitle: 'AG Report' }]
    const rows = await listUploadJobs({ userId: 7 })
    const { where } = captured.ops[0]
    expect(render(where)).toContain('`report_upload_jobs`.`user_id` = ?')
    expect(params(where)).toContain(7)
    expect(rows[0]).toMatchObject({ userId: 7, userName: 'Ama', reportTitle: 'AG Report' })
  })
})

describe('dismissFinishedUploadJobs', () => {
  it("dismisses only the caller's finished, undismissed jobs", async () => {
    captured.affectedRows = 3
    expect(await dismissFinishedUploadJobs(7)).toBe(3)
    const [op] = captured.ops
    expect(op.op).toBe('update')
    expect(op.values?.dismissedAt).toBeInstanceOf(Date)
    const where = render(op.where)
    expect(where).toContain('`user_id` = ?')
    expect(where).toContain('`status` in (?, ?)')
    expect(where).toContain('`dismissed_at` is null')
    expect(params(op.where)).toEqual([7, 'completed', 'failed'])
  })
})

describe('applyUploadJobToReport', () => {
  it('does nothing for jobs that have not completed', async () => {
    await applyUploadJobToReport(row())
    expect(captured.ops).toHaveLength(0)
  })

  it('targets the linked report only while its fileUrl still matches', async () => {
    await applyUploadJobToReport(
      row({
        status: 'completed',
        reportId: 42,
        finalSize: 4000,
        thumbnailUrl: '/uploads/thumbnails/a.jpg',
        completedAt: new Date(NOW)
      })
    )
    expect(captured.ops).toHaveLength(1)
    const { values, where } = captured.ops[0]
    expect(values?.fileSize).toBe('4000')
    // Thumbnail only fills a NULL — admins' own covers are never clobbered.
    expect(render(values?.thumbnail)).toContain('COALESCE(`audit_reports`.`thumbnail`, ?)')
    const w = render(where)
    expect(w).toContain('`audit_reports`.`id` = ?')
    expect(w).toContain('`audit_reports`.`file_url` = ?')
  })

  it('falls back to any live report referencing the file when unlinked', async () => {
    await applyUploadJobToReport(
      row({
        status: 'completed',
        finalSize: 4000,
        optimizationStatus: 'success',
        optimizationResult: {
          preset: 'ebook',
          originalSize: 5000,
          optimizedSize: 4000,
          savedBytes: 1000,
          pageCount: 10,
          nativePages: 10,
          scannedPages: 0,
          ocrFailedPages: 0,
          skippedCompression: false
        },
        completedAt: new Date(NOW)
      })
    )
    const { values, where } = captured.ops[0]
    expect(render(values?.optimizedAt)).toContain('COALESCE(`audit_reports`.`optimized_at`, ?)')
    expect(render(values?.optimizationMeta)).toContain(
      'COALESCE(`audit_reports`.`optimization_meta`, ?)'
    )
    const w = render(where)
    expect(w).toContain('`audit_reports`.`file_url` = ?')
    expect(w).toContain('`audit_reports`.`deleted_at` is null')
    expect(w).not.toContain('`audit_reports`.`id` = ?')
  })
})
