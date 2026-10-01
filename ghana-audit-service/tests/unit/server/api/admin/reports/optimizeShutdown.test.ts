import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { materializePdfSource } from '~/server/utils/pdfSource'
import {
  isAcceptingOptimizations,
  startExplicitOptimization
} from '~/server/utils/explicitOptimizations'
import { getActiveJobForFile } from '~/server/utils/pdfOptimizationScheduler'

// The real optimize.post.ts handler (optimize.test.ts covers the job
// orchestration through a mirror of it): how it behaves while the pod it
// runs on is shutting down.

const actor = vi.hoisted(() => ({ userId: 7, ipAddress: '10.0.0.1', userAgent: 'vitest' }))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/adminHelpers', () => ({
  requirePermission: vi.fn()
}))

vi.mock('~/server/utils/auditLogger', () => ({
  auditActorFromEvent: vi.fn(() => actor)
}))

vi.mock('~/server/utils/pdfSource', () => ({
  materializePdfSource: vi.fn()
}))

vi.mock('~/server/utils/explicitOptimizations', () => ({
  isAcceptingOptimizations: vi.fn(() => true),
  startExplicitOptimization: vi.fn()
}))

vi.mock('~/server/utils/pdfOptimizationScheduler', () => ({
  getActiveJobForFile: vi.fn(async () => undefined),
  getActiveJobIdLocal: vi.fn(() => undefined)
}))

vi.mock('~/server/utils/sseTicket', () => ({
  signSseTicket: vi.fn(() => 'sse-ticket')
}))

// h3 auto-imported helpers — stub BEFORE the dynamic import below.
const headers = vi.hoisted(() => new Map<string, unknown>())
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (input: object) => Object.assign(new Error('h3'), input))
vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: unknown) => {
  headers.set(name, value)
})

interface FakeEvent {
  body: Record<string, unknown>
  context: { auth: { user: { id: number }; sessionId: string } }
}

type Handler = (event: FakeEvent) => Promise<{ jobId: string; attached?: boolean }>

let handler: Handler

beforeAll(async () => {
  handler = (await import('~/server/api/admin/reports/optimize.post')).default as unknown as Handler
})

const FILE_URL = '/pdf/reports/annual-2025.pdf'

function event(body: Record<string, unknown> = { fileUrl: FILE_URL }): FakeEvent {
  return { body, context: { auth: { user: { id: 7 }, sessionId: 'session-1' } } }
}

function materialized() {
  const source = {
    path: '/tmp/gas-pdf-src-test.pdf',
    blobKey: 'pdf/reports/annual-2025.pdf',
    cleanup: vi.fn(async () => undefined)
  }
  vi.mocked(materializePdfSource).mockResolvedValue(source)
  return source
}

beforeEach(() => {
  headers.clear()
  vi.mocked(isAcceptingOptimizations).mockReturnValue(true)
  vi.mocked(getActiveJobForFile).mockResolvedValue(undefined)
})

describe('POST /api/admin/reports/optimize while the server shuts down', () => {
  it('starts the optimization with the request’s options when serving normally', async () => {
    const source = materialized()
    vi.mocked(startExplicitOptimization).mockReturnValue({ id: 'job-1' } as never)

    const res = await handler(
      event({ fileUrl: FILE_URL, preset: 'screen', reportId: 42, allowDropBookmarks: true })
    )

    expect(res).toEqual({ jobId: 'job-1', sseTicket: 'sse-ticket' })
    expect(startExplicitOptimization).toHaveBeenCalledWith({
      source,
      fileUrl: FILE_URL,
      preset: 'screen',
      allowDropBookmarks: true,
      actor,
      reportId: 42
    })
    expect(source.cleanup).not.toHaveBeenCalled()
  })

  it('turns requests away with a retryable 503 the admin UI can explain', async () => {
    vi.mocked(isAcceptingOptimizations).mockReturnValue(false)

    await expect(handler(event())).rejects.toMatchObject({
      statusCode: 503,
      data: { code: 'SERVER_RESTARTING' }
    })

    expect(headers.get('Retry-After')).toBe(5)
    // Turned away before a blob is downloaded or a job exists.
    expect(materializePdfSource).not.toHaveBeenCalled()
    expect(startExplicitOptimization).not.toHaveBeenCalled()
  })

  it('gives the fetched PDF back and answers 503 when shutdown began during the fetch', async () => {
    const source = materialized()
    vi.mocked(startExplicitOptimization).mockReturnValue(null)

    await expect(handler(event())).rejects.toMatchObject({
      statusCode: 503,
      data: { code: 'SERVER_RESTARTING' }
    })

    expect(source.cleanup).toHaveBeenCalledTimes(1)
    expect(headers.get('Retry-After')).toBe(5)
  })
})
