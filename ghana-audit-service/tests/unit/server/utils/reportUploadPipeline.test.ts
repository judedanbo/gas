import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import {
  __resetReportUploadPipelinesForTests,
  runReportUploadPipeline,
  startReportUploadPipeline,
  stopReportUploadPipelines
} from '~/server/utils/reportUploadPipeline'
import { persistUpload } from '~/server/utils/fileUpload'
import { generateThumbnailFromPdf } from '~/server/utils/generateThumbnail'
import { runReportOptimization } from '~/server/utils/runReportOptimization'
import { pushEvent, updateJob } from '~/server/utils/pdfOptimizationJobs'
import { __resetSchedulerForTests } from '~/server/utils/pdfOptimizationScheduler'
import { applyUploadJobToReport, type ReportUploadJob } from '~/server/utils/reportUploadJobs'

// In-memory stand-in for the MySQL job table. Every status transition is
// recorded so the tests can assert the pipeline's stage order.
const store = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  statuses: [] as string[]
}))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/reportUploadJobs', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/reportUploadJobs')>(
    '~/server/utils/reportUploadJobs'
  )
  return {
    ...actual,
    getUploadJob: vi.fn(async (id: string) => store.rows.get(id) as ReportUploadJob | undefined),
    updateUploadJob: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const row = store.rows.get(id)
      if (!row) return
      if (typeof patch.status === 'string' && patch.status !== row.status) {
        store.statuses.push(patch.status)
      }
      Object.assign(row, patch, { updatedAt: new Date() })
    }),
    touchUploadJob: vi.fn(async () => undefined),
    applyUploadJobToReport: vi.fn(async () => undefined)
  }
})

vi.mock('~/server/utils/fileUpload', () => ({
  uploadConfigs: {
    report: {
      allowedTypes: ['application/pdf'],
      maxSize: 100 * 1024 * 1024,
      directory: 'reports',
      baseDir: 'public/pdf',
      urlBase: '/pdf',
      backend: 'blob'
    }
  },
  persistUpload: vi.fn(async () => '/pdf/reports/x.pdf')
}))

vi.mock('~/server/utils/generateThumbnail', () => ({
  generateThumbnailFromPdf: vi.fn(async () => '/uploads/thumbnails/cover.jpg')
}))

vi.mock('~/server/utils/blobStorage', () => ({
  getContainerClient: vi.fn(() => null),
  blobKeyFromFileUrl: vi.fn((url: string) => url.replace(/^\/+/, ''))
}))

vi.mock('~/server/utils/publicFiles', () => ({
  resolvePublicAsset: vi.fn(() => null)
}))

vi.mock('~/server/utils/runReportOptimization', () => ({
  runReportOptimization: vi.fn()
}))

vi.mock('~/server/utils/logger', () => ({
  logError: vi.fn()
}))

const event = {} as H3Event

function seedJob(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
  const row: ReportUploadJob = {
    id: '22222222-2222-4222-8222-222222222222',
    userId: 1,
    reportId: null,
    status: 'queued',
    progress: 2,
    phase: null,
    page: 0,
    totalPages: 0,
    originalName: 'report.pdf',
    filename: '20260929-x.pdf',
    fileUrl: '/pdf/reports/20260929-x.pdf',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides
  }
  store.rows.set(row.id, row as unknown as Record<string, unknown>)
  return row
}

const successResult = {
  originalSize: 5000,
  optimizedSize: 3000,
  savedBytes: 2000,
  skippedCompression: false,
  nativePages: 2,
  scannedPages: 1,
  ocrFailedPages: 0,
  pageCount: 3
}

beforeEach(() => {
  store.rows.clear()
  store.statuses.length = 0
  __resetSchedulerForTests()
  __resetReportUploadPipelinesForTests()
  vi.mocked(persistUpload).mockResolvedValue('/pdf/reports/20260929-x.pdf')
  vi.mocked(generateThumbnailFromPdf).mockResolvedValue('/uploads/thumbnails/cover.jpg')
  vi.mocked(runReportOptimization).mockImplementation(async ({ jobId }) => {
    // Drive the in-process optimization job the way the real runner does:
    // a few progress events, then the terminal state.
    pushEvent(jobId, { phase: 'inspect', pageCount: 3, hasBookmarks: false })
    pushEvent(jobId, { phase: 'classify', page: 1, totalPages: 3, kind: 'native', reason: '' })
    updateJob(jobId, { status: 'success', result: successResult })
  })
})

describe('runReportUploadPipeline', () => {
  it('walks store → thumbnail → optimize → completed and records the outputs', async () => {
    const job = seedJob()

    await runReportUploadPipeline(job.id, '/tmp/spool.pdf', { preset: 'ebook', event })

    expect(store.statuses).toEqual(['storing', 'thumbnail', 'optimizing', 'completed'])
    expect(persistUpload).toHaveBeenCalledWith(
      expect.objectContaining({ directory: 'reports' }),
      job.filename,
      '/tmp/spool.pdf',
      'application/pdf'
    )
    // Thumbnail is rendered from the spooled copy, not re-downloaded, and can
    // be killed on shutdown.
    expect(generateThumbnailFromPdf).toHaveBeenCalledWith('/tmp/spool.pdf', {
      signal: expect.any(AbortSignal)
    })

    const final = store.rows.get(job.id)!
    expect(final.status).toBe('completed')
    expect(final.progress).toBe(100)
    expect(final.thumbnailUrl).toBe('/uploads/thumbnails/cover.jpg')
    expect(final.finalSize).toBe(3000)
    expect(final.optimizationStatus).toBe('success')
    expect(final.optimizationResult).toMatchObject({ preset: 'ebook', savedBytes: 2000 })
    expect(typeof final.optimizationJobId).toBe('string')
    expect(final.completedAt).toBeInstanceOf(Date)

    // The optimizer ran against the spooled file with the job's preset and no
    // report link (the row is found by fileUrl once saved).
    expect(runReportOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: job.fileUrl,
        preset: 'ebook',
        reportId: null,
        source: expect.objectContaining({ path: '/tmp/spool.pdf' })
      })
    )

    // Outputs are pushed to the report row after the completed write.
    expect(applyUploadJobToReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id, status: 'completed' })
    )
  })

  it('marks the job failed (STORE_FAILED) when storage rejects, without optimizing', async () => {
    const job = seedJob()
    vi.mocked(persistUpload).mockRejectedValueOnce(new Error('blob down'))

    await runReportUploadPipeline(job.id, '/tmp/spool.pdf', { preset: 'ebook', event })

    expect(store.statuses).toEqual(['storing', 'failed'])
    const final = store.rows.get(job.id)!
    expect(final.errorCode).toBe('STORE_FAILED')
    // Safe summary only — never the raw error message.
    expect(final.error).not.toContain('blob down')
    expect(generateThumbnailFromPdf).not.toHaveBeenCalled()
    expect(runReportOptimization).not.toHaveBeenCalled()
  })

  it('completes with an optimization error (file kept) when the optimizer fails', async () => {
    const job = seedJob()
    vi.mocked(runReportOptimization).mockImplementation(async ({ jobId }) => {
      updateJob(jobId, { status: 'error', error: 'HAS_BOOKMARKS', errorCode: 'HAS_BOOKMARKS' })
    })

    await runReportUploadPipeline(job.id, '/tmp/spool.pdf', { preset: 'screen', event })

    expect(store.statuses).toEqual(['storing', 'thumbnail', 'optimizing', 'completed'])
    const final = store.rows.get(job.id)!
    expect(final.status).toBe('completed')
    expect(final.optimizationStatus).toBe('error')
    expect(final.errorCode).toBe('HAS_BOOKMARKS')
    expect(final.optimizationResult).toBeNull()
    // Original size stands.
    expect(final.finalSize).toBe(5000)
  })

  it('survives a thumbnail failure (non-fatal) and still optimizes', async () => {
    const job = seedJob()
    vi.mocked(generateThumbnailFromPdf).mockRejectedValueOnce(new Error('no pdftoppm'))

    await runReportUploadPipeline(job.id, '/tmp/spool.pdf', { preset: 'ebook', event })

    const final = store.rows.get(job.id)!
    expect(final.status).toBe('completed')
    expect(final.thumbnailUrl).toBeNull()
    expect(final.optimizationStatus).toBe('success')
  })

  it('is a no-op for an unknown job id', async () => {
    await runReportUploadPipeline('missing', '/tmp/spool.pdf', { preset: 'ebook', event })
    expect(persistUpload).not.toHaveBeenCalled()
  })
})

describe('stopReportUploadPipelines (server shutdown)', () => {
  function start(jobId: string): void {
    startReportUploadPipeline(jobId, '/tmp/spool.pdf', { preset: 'ebook', event })
  }

  // How a killed pdftoppm looks to the pipeline: the render only ends when
  // its signal aborts, and yields no thumbnail.
  function renderUntilAborted(_path: string, opts?: { signal?: AbortSignal }) {
    return new Promise<string | null>((resolve) => {
      if (opts?.signal?.aborted) resolve(null)
      else opts?.signal?.addEventListener('abort', () => resolve(null))
    })
  }

  it('kills the cover render and completes without optimizing', async () => {
    const job = seedJob()
    vi.mocked(generateThumbnailFromPdf).mockImplementation(renderUntilAborted)

    start(job.id)
    await vi.waitFor(() => expect(generateThumbnailFromPdf).toHaveBeenCalled())
    await stopReportUploadPipelines()

    // Resolves only once the run has recorded its outcome.
    expect(store.statuses).toEqual(['storing', 'thumbnail', 'completed'])
    const final = store.rows.get(job.id)!
    expect(final.optimizationStatus).toBe('error')
    expect(final.errorCode).toBe('INTERRUPTED')
    expect(final.thumbnailUrl).toBeNull()
    expect(final.finalSize).toBe(5000)
    expect(final.completedAt).toBeInstanceOf(Date)
    expect(runReportOptimization).not.toHaveBeenCalled()
    expect(applyUploadJobToReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id, status: 'completed' })
    )
  })

  it('keeps a cover that finished rendering as shutdown began', async () => {
    const job = seedJob()
    let stopping: Promise<void> | undefined
    vi.mocked(generateThumbnailFromPdf).mockImplementation(async () => {
      stopping = stopReportUploadPipelines()
      return '/uploads/thumbnails/cover.jpg'
    })

    start(job.id)
    await vi.waitFor(() => expect(stopping).toBeDefined())
    await stopping

    const final = store.rows.get(job.id)!
    expect(final.status).toBe('completed')
    expect(final.thumbnailUrl).toBe('/uploads/thumbnails/cover.jpg')
    expect(final.errorCode).toBe('INTERRUPTED')
    expect(runReportOptimization).not.toHaveBeenCalled()
  })

  it('still completes a run whose storing finishes during the grace period', async () => {
    const job = seedJob()
    let finishStoring!: () => void
    vi.mocked(persistUpload).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finishStoring = () => resolve(job.fileUrl)
        })
    )
    vi.mocked(generateThumbnailFromPdf).mockImplementation(renderUntilAborted)

    start(job.id)
    await vi.waitFor(() => expect(persistUpload).toHaveBeenCalled())
    const stopping = stopReportUploadPipelines()
    finishStoring()
    await stopping

    expect(store.statuses).toEqual(['storing', 'thumbnail', 'completed'])
    expect(store.rows.get(job.id)!.errorCode).toBe('INTERRUPTED')
    expect(runReportOptimization).not.toHaveBeenCalled()
  })

  it('stops waiting after the grace period for an optimization already under way', async () => {
    const job = seedJob()
    vi.mocked(runReportOptimization).mockImplementation(() => new Promise(() => {}))

    start(job.id)
    await vi.waitFor(() => expect(runReportOptimization).toHaveBeenCalled())
    await stopReportUploadPipelines(20)

    // Left for the stall watchdog, as before.
    expect(store.rows.get(job.id)!.status).toBe('optimizing')
  })

  it('returns at once when no upload is running', async () => {
    // A minute-long grace would time the test out if it were waited on.
    await expect(stopReportUploadPipelines(60_000)).resolves.toBeUndefined()
  })
})
