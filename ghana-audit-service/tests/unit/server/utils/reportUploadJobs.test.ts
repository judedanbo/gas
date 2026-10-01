import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import {
  applyUploadJobToReport,
  claimInterruptedUploadJob,
  createUploadJob,
  dismissFinishedUploadJobs,
  dismissUploadJob,
  effectiveUploadJob,
  failInterruptedUploadJob,
  finalizeExhaustedUploadJobs,
  listInterruptedUploadJobs,
  listUploadJobs,
  recoverOrphanedUploadJobs,
  releaseUploadJobForResume,
  sweepStalledUploadJobs,
  toUploadJobDTO,
  touchUploadJob,
  updateUploadJob,
  uploadProgressPercent,
  uploadWorkerId,
  MAX_UPLOAD_ATTEMPTS,
  STAGE_PROGRESS,
  STALL_TIMEOUT_MS,
  type ReportUploadJob
} from '~/server/utils/reportUploadJobs'

const captured = vi.hoisted(() => ({
  ops: [] as Array<{ op: string; values?: Record<string, unknown>; where?: unknown }>,
  affectedRows: 1,
  /** Per-update affectedRows, consumed in order; falls back to affectedRows. */
  affectedQueue: [] as number[],
  selectRows: [] as unknown[] | (() => unknown[]),
  failUpdates: false
}))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
// The real schema tables are used so SQL rendering in assertions is faithful.
vi.mock('~/server/database', async () => {
  const schema = await vi.importActual<typeof import('~/server/database/schema/index')>(
    '~/server/database/schema/index'
  )
  return {
    schema,
    getDatabase: vi.fn(() => {
      const selected = (where: unknown) => {
        captured.ops.push({ op: 'select', where })
        const rows = async () =>
          typeof captured.selectRows === 'function' ? captured.selectRows() : captured.selectRows
        return { orderBy: () => ({ limit: rows }), limit: rows }
      }
      return {
        select: () => ({
          from: () => ({
            // listUploadJobs joins the user and report title…
            leftJoin: () => ({ leftJoin: () => ({ where: selected }) }),
            // …everything else reads the job table alone.
            where: selected
          })
        }),
        insert: () => ({
          values: async (values: Record<string, unknown>) => {
            captured.ops.push({ op: 'insert', values })
          }
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => ({
            where: async (where: unknown) => {
              if (captured.failUpdates) throw new Error('db down')
              captured.ops.push({ op: 'update', values, where })
              return [{ affectedRows: captured.affectedQueue.shift() ?? captured.affectedRows }]
            }
          })
        }),
        delete: () => ({
          where: async (where: unknown) => {
            captured.ops.push({ op: 'delete', where })
          }
        })
      }
    })
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
/** How drizzle hands a datetime parameter to mysql2. */
function sqlDate(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '')
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
    allowDropBookmarks: false,
    runId: 'run-1',
    worker: 'pod-a',
    attempts: 1,
    interruptedAt: null,
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
  captured.affectedQueue = []
  captured.selectRows = []
  captured.failUpdates = false
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
  const silent = new Date(NOW - STALL_TIMEOUT_MS - 1)

  it('leaves a recently-updated active job alone', () => {
    const r = row()
    expect(effectiveUploadJob(r, NOW)).toBe(r)
  })

  it('reads a silent job whose file never reached storage as failed/STALLED', () => {
    const r = row({ status: 'storing', updatedAt: silent })
    const eff = effectiveUploadJob(r, NOW)
    expect(eff.status).toBe('failed')
    expect(eff.errorCode).toBe('STALLED')
    // Never mutates the input.
    expect(r.status).toBe('storing')
  })

  it('reads a silent stored job as awaiting resume, not failed', () => {
    const r = row({ status: 'optimizing', updatedAt: silent })
    const eff = effectiveUploadJob(r, NOW)
    expect(eff.status).toBe('optimizing')
    expect(eff.interruptedAt).toEqual(new Date(NOW))
    expect(r.interruptedAt).toBeNull()
  })

  it('leaves a job already queued for resume as it is', () => {
    const r = row({ status: 'thumbnail', interruptedAt: new Date(NOW - 1_000) })
    expect(effectiveUploadJob(r, NOW)).toBe(r)
  })

  it('reads an interrupted job with no attempts left as completed, optimization skipped', () => {
    const r = row({
      status: 'optimizing',
      attempts: MAX_UPLOAD_ATTEMPTS,
      interruptedAt: new Date(NOW - 1_000)
    })
    const eff = effectiveUploadJob(r, NOW)
    expect(eff).toMatchObject({
      status: 'completed',
      progress: 100,
      optimizationStatus: 'error',
      errorCode: 'INTERRUPTED',
      finalSize: 5000,
      interruptedAt: null
    })
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
    expect(dto.attempts).toBe(1)
    expect(dto.interruptedAt).toBeNull()
    // Ownership internals stay server-side.
    expect(dto).not.toHaveProperty('runId')
    expect(dto).not.toHaveProperty('worker')

    const stalled = toUploadJobDTO(
      row({ status: 'storing', updatedAt: new Date(NOW - STALL_TIMEOUT_MS * 2) }),
      {},
      NOW
    )
    expect(stalled.active).toBe(false)
    expect(stalled.status).toBe('failed')
  })

  it('keeps an interrupted stored job active and says when it was interrupted', () => {
    const interruptedAt = new Date(NOW - 5_000)
    const dto = toUploadJobDTO(row({ interruptedAt, attempts: 2 }), {}, NOW)
    expect(dto.active).toBe(true)
    expect(dto.interruptedAt).toBe(interruptedAt.toISOString())
    expect(dto.attempts).toBe(2)
  })

  it('reports 100% for completed jobs regardless of the stored progress', () => {
    const dto = toUploadJobDTO(row({ status: 'completed', progress: 98 }), {}, NOW)
    expect(dto.progress).toBe(100)
  })
})

describe('sweepStalledUploadJobs', () => {
  it('fails silent jobs that never reached storage and queues stored ones for resume', async () => {
    captured.affectedQueue = [1, 2]
    const result = await sweepStalledUploadJobs(new Date(NOW))
    expect(result).toEqual({ failed: 1, interrupted: 2 })

    const [fail, interrupt] = captured.ops
    expect(fail.values).toMatchObject({ status: 'failed', errorCode: 'STALLED', runId: null })
    expect(render(fail.where)).toContain('`status` in (?, ?)')
    expect(params(fail.where)).toEqual(
      expect.arrayContaining(['queued', 'storing', sqlDate(NOW - STALL_TIMEOUT_MS)])
    )

    // Stored jobs keep their stage; only ownership is released.
    expect(interrupt.values).toMatchObject({ runId: null, phase: null })
    expect(interrupt.values?.status).toBeUndefined()
    expect(interrupt.values?.interruptedAt).toEqual(new Date(NOW))
    const where = render(interrupt.where)
    expect(where).toContain('`interrupted_at` is null')
    expect(where).toContain('`updated_at` < ?')
    expect(params(interrupt.where)).toEqual(expect.arrayContaining(['thumbnail', 'optimizing']))
  })
})

describe('recoverOrphanedUploadJobs', () => {
  it("acts on this host's jobs last written before the process started", async () => {
    captured.affectedQueue = [1, 1]
    const startedAt = new Date(NOW)
    expect(await recoverOrphanedUploadJobs('pod-a', startedAt, new Date(NOW + 5_000))).toEqual({
      failed: 1,
      interrupted: 1
    })

    const [fail, interrupt] = captured.ops
    // The bytes of an unstored job died with the previous process.
    expect(fail.values).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED', runId: null })
    for (const op of [fail, interrupt]) {
      expect(render(op.where)).toContain('`worker` = ?')
      // A margin below the start keeps second-rounded rows of this process out.
      expect(params(op.where)).toEqual(expect.arrayContaining(['pod-a', sqlDate(NOW - 2_000)]))
    }
    expect(interrupt.values?.interruptedAt).toEqual(new Date(NOW + 5_000))
  })
})

describe('updateUploadJob', () => {
  it('fences a guarded write to the owning run', async () => {
    expect(await updateUploadJob('job-1', { progress: 50 }, { runId: 'run-1' })).toBe(true)
    const [op] = captured.ops
    expect(render(op.where)).toContain('`run_id` = ?')
    expect(params(op.where)).toEqual(['job-1', 'run-1'])
    expect(op.values?.updatedAt).toBeInstanceOf(Date)
  })

  it('reports a lost job when the fence matches nothing', async () => {
    captured.affectedRows = 0
    expect(await touchUploadJob('job-1', 'stale-run')).toBe(false)
  })

  it('reads a database error as "still owned" so a blip never stops a live run', async () => {
    captured.failUpdates = true
    expect(await updateUploadJob('job-1', { progress: 50 }, { runId: 'run-1' })).toBe(true)
  })

  it('stays unconditional without a guard (e.g. linking a report)', async () => {
    await updateUploadJob('job-1', { reportId: 3 })
    expect(render(captured.ops[0].where)).not.toContain('run_id')
  })
})

describe('shutdown handoff', () => {
  it('releases a stored job for resume, only while its run still owns it in flight', async () => {
    expect(await releaseUploadJobForResume('job-1', 'run-1', 'optimizing')).toBe(true)
    const [op] = captured.ops
    expect(op.values).toMatchObject({ status: 'optimizing', phase: null, runId: null })
    expect(op.values?.interruptedAt).toBeInstanceOf(Date)
    expect(render(op.where)).toContain('`status` in (?, ?, ?, ?)')
    expect(params(op.where)).toEqual(expect.arrayContaining(['job-1', 'run-1']))
  })

  it('fails an unstored job with INTERRUPTED and fences the old run out', async () => {
    captured.affectedRows = 0
    // Already finished or taken over: nothing to do.
    expect(await failInterruptedUploadJob('job-1', 'run-1')).toBe(false)
    const [op] = captured.ops
    expect(op.values).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED', runId: null })
    expect(op.values?.completedAt).toBeInstanceOf(Date)
    expect(render(op.where)).toContain('`run_id` = ?')
  })
})

describe('resume claims', () => {
  it('lists interrupted stored jobs that still have attempts, oldest first', async () => {
    await listInterruptedUploadJobs(2)
    const where = render(captured.ops[0].where)
    expect(where).toContain('`interrupted_at` is not null')
    expect(where).toContain('`attempts` < ?')
    expect(params(captured.ops[0].where)).toContain(MAX_UPLOAD_ATTEMPTS)
  })

  it('claims a job with a fresh run token and one more attempt', async () => {
    captured.selectRows = () => {
      const claim = captured.ops.find((op) => op.op === 'update')!
      return [row({ runId: claim.values?.runId as string, worker: 'pod-b', attempts: 2 })]
    }
    const claimed = await claimInterruptedUploadJob('job-1', 'pod-b')

    const claim = captured.ops.find((op) => op.op === 'update')!
    expect(claim.values).toMatchObject({ worker: 'pod-b', interruptedAt: null })
    expect(claim.values?.runId).toMatch(/^[0-9a-f-]{36}$/)
    expect(render(claim.values?.attempts)).toBe('`report_upload_jobs`.`attempts` + 1')
    const where = render(claim.where)
    expect(where).toContain('`interrupted_at` is not null')
    expect(where).toContain('`run_id` is null')
    expect(where).toContain('`attempts` < ?')
    expect(claimed).toMatchObject({ runId: claim.values?.runId, attempts: 2 })
  })

  it('returns nothing when another process claimed it first', async () => {
    captured.affectedRows = 0
    expect(await claimInterruptedUploadJob('job-1', 'pod-b')).toBeUndefined()
    expect(captured.ops.filter((op) => op.op === 'select')).toHaveLength(0)
  })
})

describe('finalizeExhaustedUploadJobs', () => {
  it('completes jobs out of attempts and lands what they have on the report', async () => {
    captured.selectRows = [
      row({
        attempts: MAX_UPLOAD_ATTEMPTS,
        interruptedAt: new Date(NOW - 1_000),
        runId: null,
        thumbnailUrl: '/uploads/thumbnails/a.jpg'
      })
    ]
    expect(await finalizeExhaustedUploadJobs(new Date(NOW))).toBe(1)

    const [select, finalize, report] = captured.ops
    expect(render(select.where)).toContain('`attempts` >= ?')
    expect(finalize.values).toMatchObject({
      status: 'completed',
      optimizationStatus: 'error',
      errorCode: 'INTERRUPTED',
      interruptedAt: null
    })
    expect(render(finalize.where)).toContain('`run_id` is null')
    // applyUploadJobToReport: size and the cover thumbnail, no optimization meta.
    expect(report.values?.fileSize).toBe('5000')
    expect(report.values?.optimizationMeta).toBeUndefined()
  })

  it('skips a job someone else finalized or claimed meanwhile', async () => {
    captured.selectRows = [row({ attempts: MAX_UPLOAD_ATTEMPTS, interruptedAt: new Date() })]
    captured.affectedRows = 0
    expect(await finalizeExhaustedUploadJobs(new Date(NOW))).toBe(0)
    expect(captured.ops.filter((op) => op.op === 'update')).toHaveLength(1)
  })
})

describe('createUploadJob', () => {
  it('inserts the job already owned by its first run on this host', async () => {
    const job = await createUploadJob({
      userId: 7,
      originalName: 'a.pdf',
      filename: 'f.pdf',
      fileUrl: '/pdf/reports/f.pdf',
      mimeType: 'application/pdf',
      size: 10,
      preset: 'screen',
      allowDropBookmarks: true
    })
    expect(job).toMatchObject({
      status: 'queued',
      attempts: 1,
      worker: uploadWorkerId(),
      allowDropBookmarks: true,
      interruptedAt: null
    })
    expect(job.runId).toMatch(/^[0-9a-f-]{36}$/)
    expect(captured.ops[0]).toMatchObject({ op: 'insert', values: job })
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
