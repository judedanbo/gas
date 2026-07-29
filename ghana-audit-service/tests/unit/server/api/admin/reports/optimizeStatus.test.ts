import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { createJob, getJob, pushEvent, updateJob } from '~/server/utils/pdfOptimizationJobs'
import {
  registerActiveJob,
  __resetSchedulerForTests
} from '~/server/utils/pdfOptimizationScheduler'

const mocks = vi.hoisted(() => ({
  dbRows: [] as Array<{ fileUrl: string }>
}))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn(() => null)
}))

vi.mock('~/server/database', () => ({
  getDatabase: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mocks.dbRows
        })
      })
    })
  })),
  schema: { auditReports: { id: 'id', fileUrl: 'file_url' } }
}))

// h3 auto-imported helpers — stub BEFORE the dynamic import below.
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query)
vi.stubGlobal('createError', (input: object) => Object.assign(new Error('h3'), input))

interface FakeH3Event {
  query: Record<string, unknown>
}

type Handler = (event: FakeH3Event) => Promise<{
  active: boolean
  jobId: string | null
  status: string | null
  error: string | null
  errorCode: string | null
  result: unknown
  lastEvent: { phase: string } | null
  lastSeq: number
}>

let handler: Handler

beforeAll(async () => {
  handler = (await import('~/server/api/admin/reports/optimize-status.get'))
    .default as unknown as Handler
})

describe('GET /api/admin/reports/optimize-status', () => {
  beforeEach(() => {
    __resetSchedulerForTests()
    mocks.dbRows = []
  })

  it('400s when neither jobId, reportId, nor fileUrl is provided', async () => {
    await expect(handler({ query: {} })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('404s for an unknown jobId', async () => {
    await expect(handler({ query: { jobId: 'nope' } })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('reports inactive for a report with no running optimization', async () => {
    mocks.dbRows = [{ fileUrl: '/pdf/reports/idle.pdf' }]
    const res = await handler({ query: { reportId: '12' } })
    expect(res).toMatchObject({ active: false, jobId: null, status: null })
  })

  it('returns progress for a running job by jobId', async () => {
    const job = createJob('/pdf/reports/status-run.pdf', 1)
    updateJob(job.id, { status: 'running' })
    pushEvent(job.id, { phase: 'inspect', pageCount: 4, hasBookmarks: false })
    pushEvent(job.id, { phase: 'split' })

    const res = await handler({ query: { jobId: job.id } })
    expect(res.active).toBe(true)
    expect(res.status).toBe('running')
    expect(res.lastEvent).toMatchObject({ phase: 'split' })
    expect(res.lastSeq).toBe(2)
  })

  it('returns the result and errorCode for terminal jobs', async () => {
    const job = createJob('/pdf/reports/status-done.pdf', 2)
    updateJob(job.id, {
      status: 'error',
      error: 'HAS_BOOKMARKS',
      errorCode: 'HAS_BOOKMARKS'
    })

    const res = await handler({ query: { jobId: job.id } })
    expect(res.active).toBe(false)
    expect(res.status).toBe('error')
    expect(res.errorCode).toBe('HAS_BOOKMARKS')
  })

  it('reports a stalled running job as timed out', async () => {
    const job = createJob('/pdf/reports/status-stalled.pdf', 3)
    updateJob(job.id, { status: 'running' })
    // Simulate a dead producer: no activity for 16 minutes.
    getJob(job.id)!.updatedAt = Date.now() - 16 * 60_000

    const res = await handler({ query: { jobId: job.id } })
    expect(res.status).toBe('error')
    expect(res.errorCode).toBe('TIMEOUT')
  })

  it('finds the active job for a report via the scheduler index', async () => {
    mocks.dbRows = [{ fileUrl: '/pdf/reports/status-lookup.pdf' }]
    const job = createJob('/pdf/reports/status-lookup.pdf', 44)
    updateJob(job.id, { status: 'running' })
    registerActiveJob('/pdf/reports/status-lookup.pdf', job.id)

    const res = await handler({ query: { reportId: '44' } })
    expect(res.active).toBe(true)
    expect(res.jobId).toBe(job.id)
  })
})
