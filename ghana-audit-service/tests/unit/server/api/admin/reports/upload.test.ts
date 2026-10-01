import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { receiveMultipartFile } from '~/server/utils/fileUpload'
import { createUploadJob } from '~/server/utils/reportUploadJobs'
import {
  beginUploadTransfer,
  isAcceptingUploads,
  isPastUploadHandoff,
  startReportUploadPipeline
} from '~/server/utils/reportUploadPipeline'

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn(),
  getCurrentUser: vi.fn(() => ({ id: 7, name: 'Ama' }))
}))

vi.mock('~/server/utils/fileUpload', () => ({
  uploadConfigs: { report: { directory: 'reports', urlBase: '/pdf' } },
  receiveMultipartFile: vi.fn(async () => ({
    tempPath: '/tmp/gas-upload-test',
    originalName: 'AG Report.pdf',
    mimeType: 'application/pdf',
    size: 5000
  })),
  generateFilename: vi.fn(() => '20261001-x.pdf'),
  uploadUrlFor: vi.fn(() => '/pdf/reports/20261001-x.pdf')
}))

vi.mock('~/server/utils/auditLogger', () => ({
  auditActorFromEvent: vi.fn(() => ({ userId: 7, ipAddress: '10.0.0.1', userAgent: 'test' })),
  logAuditAction: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/reportUploadJobs', () => ({
  createUploadJob: vi.fn(async (input: object) => ({ id: 'job-1', runId: 'run-1', ...input })),
  toUploadJobDTO: vi.fn((job: { id: string }) => ({ id: job.id }))
}))

const endTransfer = vi.hoisted(() => vi.fn())

vi.mock('~/server/utils/reportUploadPipeline', () => ({
  beginUploadTransfer: vi.fn(() => endTransfer),
  isAcceptingUploads: vi.fn(() => true),
  isPastUploadHandoff: vi.fn(() => false),
  startReportUploadPipeline: vi.fn()
}))

// h3 auto-imported helpers — stub BEFORE the dynamic import below.
const headers = vi.hoisted(() => new Map<string, unknown>())
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query)
vi.stubGlobal('createError', (input: object) => Object.assign(new Error('h3'), input))
vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: unknown) => {
  headers.set(name, value)
})

interface FakeEvent {
  query: Record<string, unknown>
  node: { req: { headers: Record<string, string> } }
}

type Handler = (event: FakeEvent) => Promise<{ jobId: string; url: string }>

let handler: Handler

beforeAll(async () => {
  handler = (await import('~/server/api/admin/reports/upload.post')).default as unknown as Handler
})

function event(query: Record<string, unknown> = {}): FakeEvent {
  return { query, node: { req: { headers: { 'content-type': 'multipart/form-data' } } } }
}

beforeEach(() => {
  headers.clear()
  vi.mocked(isAcceptingUploads).mockReturnValue(true)
  vi.mocked(isPastUploadHandoff).mockReturnValue(false)
})

describe('POST /api/admin/reports/upload', () => {
  it('creates the job with its options and hands it to the pipeline', async () => {
    const res = await handler(event({ preset: 'screen', allowDropBookmarks: 'true' }))

    expect(res).toMatchObject({ jobId: 'job-1', url: '/pdf/reports/20261001-x.pdf' })
    // Persisted on the row so a resume on another server optimizes the same way.
    expect(createUploadJob).toHaveBeenCalledWith(
      expect.objectContaining({ preset: 'screen', allowDropBookmarks: true, userId: 7 })
    )
    expect(startReportUploadPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1', runId: 'run-1' }),
      '/tmp/gas-upload-test',
      { actor: { userId: 7, ipAddress: '10.0.0.1', userAgent: 'test' } }
    )
    // A shutdown waits for the transfer until the pipeline's run has taken
    // over — never a moment with neither registered.
    expect(beginUploadTransfer).toHaveBeenCalledTimes(1)
    expect(vi.mocked(receiveMultipartFile).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(beginUploadTransfer).mock.invocationCallOrder[0]
    )
    expect(endTransfer.mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(startReportUploadPipeline).mock.invocationCallOrder[0]
    )
  })

  it('turns away bytes that land after the shutdown handoff, without creating a job', async () => {
    vi.mocked(isPastUploadHandoff).mockReturnValue(true)

    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503 })

    expect(createUploadJob).not.toHaveBeenCalled()
    expect(startReportUploadPipeline).not.toHaveBeenCalled()
    expect(endTransfer).toHaveBeenCalledTimes(1)
  })

  it('turns uploads away with a retryable 503 while the server shuts down', async () => {
    vi.mocked(isAcceptingUploads).mockReturnValue(false)

    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503 })

    expect(headers.get('Retry-After')).toBe(5)
    // Rejected before a single byte is read or a job row exists.
    expect(receiveMultipartFile).not.toHaveBeenCalled()
    expect(createUploadJob).not.toHaveBeenCalled()
  })
})
