import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  __resetUploadPipelineForTests,
  beginUploadTransfer,
  drainReportUploadPipelines,
  isAcceptingUploads,
  isPastUploadHandoff,
  resumeInterruptedUploadJobs,
  runReportUploadPipeline,
  runResumedUploadPipeline
} from '~/server/utils/reportUploadPipeline'
import { persistUpload } from '~/server/utils/fileUpload'
import { generateThumbnailFromPdf } from '~/server/utils/generateThumbnail'
import { materializePdfSource } from '~/server/utils/pdfSource'
import {
  runReportOptimization,
  type RunReportOptimizationOptions
} from '~/server/utils/runReportOptimization'
import { pushEvent, updateJob } from '~/server/utils/pdfOptimizationJobs'
import { __resetSchedulerForTests } from '~/server/utils/pdfOptimizationScheduler'
import { logWarn } from '~/server/utils/logger'
import {
  applyUploadJobToReport,
  finalizeExhaustedUploadJobs,
  listInterruptedUploadJobs,
  type ReportUploadJob
} from '~/server/utils/reportUploadJobs'

// In-memory stand-in for the MySQL job table. Writes are fenced exactly like
// the real conditional UPDATEs (runId, and in-flight only for handoffs), and
// every status transition is recorded so tests can assert the stage order.
const store = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  statuses: [] as string[],
  claims: 0
}))

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/reportUploadJobs', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/reportUploadJobs')>(
    '~/server/utils/reportUploadJobs'
  )
  function write(
    id: string,
    patch: Record<string, unknown>,
    guard?: { runId: string; activeOnly?: boolean }
  ): boolean {
    const row = store.rows.get(id)
    if (!row) return false
    if (guard && row.runId !== guard.runId) return false
    if (
      guard?.activeOnly &&
      !actual.isActiveUploadStatus(row.status as ReportUploadJob['status'])
    ) {
      return false
    }
    if (typeof patch.status === 'string' && patch.status !== row.status) {
      store.statuses.push(patch.status)
    }
    Object.assign(row, patch, { updatedAt: new Date() })
    return true
  }
  return {
    ...actual,
    getUploadJob: vi.fn(async (id: string) => {
      const row = store.rows.get(id)
      return row ? ({ ...row } as ReportUploadJob) : undefined
    }),
    updateUploadJob: vi.fn(
      async (id: string, patch: Record<string, unknown>, guard?: { runId: string }) =>
        write(id, patch, guard)
    ),
    touchUploadJob: vi.fn(async (id: string, runId: string) => write(id, {}, { runId })),
    releaseUploadJobForResume: vi.fn(async (id: string, runId: string, status: string) =>
      write(
        id,
        { status, phase: null, runId: null, interruptedAt: new Date() },
        { runId, activeOnly: true }
      )
    ),
    failInterruptedUploadJob: vi.fn(async (id: string, runId: string) =>
      write(
        id,
        {
          status: 'failed',
          error: 'The server restarted before the file was saved',
          errorCode: 'INTERRUPTED',
          runId: null,
          completedAt: new Date()
        },
        { runId, activeOnly: true }
      )
    ),
    listInterruptedUploadJobs: vi.fn(async (limit: number) =>
      [...store.rows.values()]
        .filter((r) => r.interruptedAt && (r.attempts as number) < actual.MAX_UPLOAD_ATTEMPTS)
        .slice(0, limit)
        .map((r) => ({ ...r }) as ReportUploadJob)
    ),
    claimInterruptedUploadJob: vi.fn(async (id: string, worker: string) => {
      const row = store.rows.get(id)
      if (!row || !row.interruptedAt || row.runId) return undefined
      Object.assign(row, {
        runId: `claim-${++store.claims}`,
        worker,
        attempts: (row.attempts as number) + 1,
        interruptedAt: null,
        updatedAt: new Date()
      })
      return { ...row } as ReportUploadJob
    }),
    finalizeExhaustedUploadJobs: vi.fn(async () => 0),
    uploadWorkerId: vi.fn(() => 'pod-test'),
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

vi.mock('~/server/utils/pdfSource', () => ({
  materializePdfSource: vi.fn()
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
  logError: vi.fn(),
  logWarn: vi.fn()
}))

const actor = { userId: 1, ipAddress: '10.0.0.1', userAgent: 'vitest' }
const SPOOL = '/tmp/gas-test-spool.pdf'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let nextId = 0

/** Insert a row and hand back a detached copy, like createUploadJob does. */
function seedJob(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
  const row: ReportUploadJob = {
    id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
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
    allowDropBookmarks: false,
    runId: 'run-1',
    worker: 'pod-test',
    attempts: 1,
    interruptedAt: null,
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
  store.rows.set(row.id, { ...row })
  return { ...row }
}

function rowOf(job: ReportUploadJob): Record<string, unknown> {
  return store.rows.get(job.id)!
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

/**
 * Make the optimizer hang until the test releases it, capturing the options
 * it was started with (its abort signal in particular).
 */
function holdOptimizer() {
  const release = deferred()
  const started = deferred<RunReportOptimizationOptions>()
  vi.mocked(runReportOptimization).mockImplementation(async (o) => {
    started.resolve(o)
    await release.promise
    updateJob(o.jobId, { status: 'success', result: successResult })
  })
  return { started: started.promise, release: () => release.resolve() }
}

beforeEach(() => {
  store.rows.clear()
  store.statuses.length = 0
  __resetSchedulerForTests()
  __resetUploadPipelineForTests()
  vi.mocked(persistUpload).mockResolvedValue('/pdf/reports/20260929-x.pdf')
  vi.mocked(generateThumbnailFromPdf).mockResolvedValue('/uploads/thumbnails/cover.jpg')
  vi.mocked(materializePdfSource).mockResolvedValue({
    path: '/tmp/gas-test-materialized.pdf',
    blobKey: 'pdf/reports/20260929-x.pdf',
    cleanup: vi.fn(async () => undefined)
  })
  vi.mocked(finalizeExhaustedUploadJobs).mockResolvedValue(0)
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
    const job = seedJob({ allowDropBookmarks: true })

    await runReportUploadPipeline(job, SPOOL, { actor })

    expect(store.statuses).toEqual(['storing', 'thumbnail', 'optimizing', 'completed'])
    expect(persistUpload).toHaveBeenCalledWith(
      expect.objectContaining({ directory: 'reports' }),
      job.filename,
      SPOOL,
      'application/pdf'
    )
    // Thumbnail is rendered from the spooled copy, not re-downloaded.
    expect(generateThumbnailFromPdf).toHaveBeenCalledWith(SPOOL)

    const final = rowOf(job)
    expect(final.status).toBe('completed')
    expect(final.progress).toBe(100)
    expect(final.thumbnailUrl).toBe('/uploads/thumbnails/cover.jpg')
    expect(final.finalSize).toBe(3000)
    expect(final.optimizationStatus).toBe('success')
    expect(final.optimizationResult).toMatchObject({ preset: 'ebook', savedBytes: 2000 })
    expect(typeof final.optimizationJobId).toBe('string')
    expect(final.completedAt).toBeInstanceOf(Date)

    // The optimizer ran against the spooled file with the job's own options
    // (persisted on the row, so a resume uses the same ones), no report
    // link (the row is found by fileUrl once saved), and an abort signal.
    expect(runReportOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: job.fileUrl,
        preset: 'ebook',
        allowDropBookmarks: true,
        actor,
        reportId: null,
        signal: expect.any(AbortSignal),
        source: expect.objectContaining({ path: SPOOL })
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

    await runReportUploadPipeline(job, SPOOL, { actor })

    expect(store.statuses).toEqual(['storing', 'failed'])
    const final = rowOf(job)
    expect(final.errorCode).toBe('STORE_FAILED')
    // Safe summary only — never the raw error message.
    expect(final.error).not.toContain('blob down')
    expect(generateThumbnailFromPdf).not.toHaveBeenCalled()
    expect(runReportOptimization).not.toHaveBeenCalled()
  })

  it('completes with an optimization error (file kept) when the optimizer fails', async () => {
    const job = seedJob({ preset: 'screen' })
    vi.mocked(runReportOptimization).mockImplementation(async ({ jobId }) => {
      updateJob(jobId, { status: 'error', error: 'HAS_BOOKMARKS', errorCode: 'HAS_BOOKMARKS' })
    })

    await runReportUploadPipeline(job, SPOOL, { actor })

    expect(store.statuses).toEqual(['storing', 'thumbnail', 'optimizing', 'completed'])
    const final = rowOf(job)
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

    await runReportUploadPipeline(job, SPOOL, { actor })

    const final = rowOf(job)
    expect(final.status).toBe('completed')
    expect(final.thumbnailUrl).toBeNull()
    expect(final.optimizationStatus).toBe('success')
  })

  it('does nothing for a job it does not own', async () => {
    const job = seedJob({ runId: 'another-run' })

    await runReportUploadPipeline({ ...job, runId: 'run-1' }, SPOOL, { actor })

    expect(persistUpload).not.toHaveBeenCalled()
    expect(store.statuses).toEqual([])
    expect(rowOf(job).runId).toBe('another-run')
  })

  it('stops at once when another process takes the job over, and writes nothing more', async () => {
    const job = seedJob()
    const optimizer = holdOptimizer()
    const run = runReportUploadPipeline(job, SPOOL, { actor })
    const { jobId: optJobId, signal } = await optimizer.started

    // Presumed dead (e.g. through a long database outage) and resumed elsewhere.
    rowOf(job).runId = 'other-run'
    // Its next write — here a progress update — is refused…
    pushEvent(optJobId, { phase: 'inspect', pageCount: 3, hasBookmarks: false })
    await run

    // …which stops the optimizer and the pipeline without touching the row.
    expect(signal?.aborted).toBe(true)
    optimizer.release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(rowOf(job)).toMatchObject({ status: 'optimizing', runId: 'other-run' })
    expect(store.statuses).not.toContain('completed')
    expect(applyUploadJobToReport).not.toHaveBeenCalled()
  })
})

describe('drainReportUploadPipelines (shutdown)', () => {
  it('fails an upload whose file has not reached storage, right away', async () => {
    const job = seedJob()
    const storing = deferred<string>()
    vi.mocked(persistUpload).mockReturnValueOnce(storing.promise)
    const run = runReportUploadPipeline(job, SPOOL, { actor })
    await vi.waitFor(() => expect(rowOf(job).status).toBe('storing'))

    await drainReportUploadPipelines(20)

    expect(isAcceptingUploads()).toBe(false)
    expect(rowOf(job)).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED', runId: null })
    // The transfer to storage finishing afterwards changes nothing.
    storing.resolve('/pdf/reports/20260929-x.pdf')
    await run
    expect(store.statuses).toEqual(['storing', 'failed'])
    expect(generateThumbnailFromPdf).not.toHaveBeenCalled()
  })

  it('releases a stored upload for another server to resume, and stops its optimizer', async () => {
    const job = seedJob()
    const optimizer = holdOptimizer()
    const run = runReportUploadPipeline(job, SPOOL, { actor })
    const { signal } = await optimizer.started

    await drainReportUploadPipelines(20)

    const row = rowOf(job)
    expect(row).toMatchObject({ status: 'optimizing', runId: null, phase: null })
    expect(row.interruptedAt).toBeInstanceOf(Date)
    expect(signal?.aborted).toBe(true)
    expect(logWarn).toHaveBeenCalledWith(
      'reportUpload',
      expect.stringContaining('released 1 stored upload(s)')
    )
    // The pipeline returns without waiting for the optimizer to wind down…
    await run
    // …and an optimizer that finishes late anyway cannot complete the job.
    optimizer.release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(rowOf(job).status).toBe('optimizing')
    expect(store.statuses).not.toContain('completed')
  })

  it('lets uploads that finish within the grace period complete normally', async () => {
    const job = seedJob()
    const optimizing = deferred()
    vi.mocked(runReportOptimization).mockImplementation(async ({ jobId }) => {
      optimizing.resolve()
      await new Promise((resolve) => setTimeout(resolve, 30))
      updateJob(jobId, { status: 'success', result: successResult })
    })
    const run = runReportUploadPipeline(job, SPOOL, { actor })
    await optimizing.promise

    const startedAt = Date.now()
    await drainReportUploadPipelines(5_000)

    // Returns as soon as the run is done rather than sitting out the grace.
    expect(Date.now() - startedAt).toBeLessThan(2_000)
    expect(rowOf(job)).toMatchObject({ status: 'completed', interruptedAt: null })
    await run
  })

  it('waits for an upload still streaming in, then gives its run the rest of the grace', async () => {
    const endTransfer = beginUploadTransfer()
    let drained = false
    const drain = drainReportUploadPipelines(2_000).then(() => (drained = true))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(drained).toBe(false)
    expect(isPastUploadHandoff()).toBe(false)

    // The bytes land: the pipeline starts, then the request lets go.
    const job = seedJob()
    const run = runReportUploadPipeline(job, SPOOL, { actor })
    endTransfer()
    await drain

    expect(rowOf(job)).toMatchObject({ status: 'completed', interruptedAt: null })
    await run
  })

  it('stops waiting for bytes at the deadline', async () => {
    beginUploadTransfer()

    await drainReportUploadPipelines(20)

    expect(isPastUploadHandoff()).toBe(true)
  })

  it('fails an upload that arrives after the handoff instead of starting it', async () => {
    await drainReportUploadPipelines(0)
    const job = seedJob()

    await runReportUploadPipeline(job, SPOOL, { actor })

    expect(persistUpload).not.toHaveBeenCalled()
    expect(rowOf(job)).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED' })
  })

  it('is shared between the signal handler and the close hook', () => {
    expect(drainReportUploadPipelines(10)).toBe(drainReportUploadPipelines(10))
  })
})

describe('runResumedUploadPipeline', () => {
  /** A job some process just claimed (see claimInterruptedUploadJob). */
  function claimedJob(overrides: Partial<ReportUploadJob> = {}): ReportUploadJob {
    return seedJob({
      status: 'optimizing',
      thumbnailUrl: '/uploads/thumbnails/old-cover.jpg',
      runId: 'claim-run',
      attempts: 2,
      allowDropBookmarks: true,
      ...overrides
    })
  }

  it('re-materializes the PDF from storage, keeps the thumbnail and finishes the job', async () => {
    const job = claimedJob()

    await runResumedUploadPipeline(job)

    expect(materializePdfSource).toHaveBeenCalledWith(job.fileUrl)
    expect(persistUpload).not.toHaveBeenCalled()
    expect(generateThumbnailFromPdf).not.toHaveBeenCalled()
    expect(runReportOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          path: '/tmp/gas-test-materialized.pdf',
          blobKey: 'pdf/reports/20260929-x.pdf'
        }),
        allowDropBookmarks: true,
        // No request behind a resume: attributed to the uploader.
        actor: { userId: 1, ipAddress: null, userAgent: null }
      })
    )
    expect(rowOf(job)).toMatchObject({
      status: 'completed',
      optimizationStatus: 'success',
      thumbnailUrl: '/uploads/thumbnails/old-cover.jpg'
    })
    // The materialized temp copy is removed once.
    const source = await vi.mocked(materializePdfSource).mock.results[0].value
    expect(source.cleanup).toHaveBeenCalledTimes(1)
    expect(applyUploadJobToReport).toHaveBeenCalled()
  })

  it('renders the thumbnail when the interrupted run had not got to it', async () => {
    const job = claimedJob({ status: 'thumbnail', thumbnailUrl: null })

    await runResumedUploadPipeline(job)

    expect(generateThumbnailFromPdf).toHaveBeenCalledWith('/tmp/gas-test-materialized.pdf')
    expect(store.statuses).toEqual(['optimizing', 'completed'])
    expect(rowOf(job).thumbnailUrl).toBe('/uploads/thumbnails/cover.jpg')
  })

  it('fails with RESUME_FAILED when the stored file is gone', async () => {
    const job = claimedJob()
    vi.mocked(materializePdfSource).mockResolvedValueOnce(null)

    await runResumedUploadPipeline(job)

    expect(rowOf(job)).toMatchObject({ status: 'failed', errorCode: 'RESUME_FAILED' })
    expect(runReportOptimization).not.toHaveBeenCalled()
  })

  it('puts the job back for another attempt when storage cannot be read', async () => {
    const job = claimedJob()
    vi.mocked(materializePdfSource).mockRejectedValueOnce(new Error('blob timeout'))

    await runResumedUploadPipeline(job)

    const row = rowOf(job)
    expect(row).toMatchObject({ status: 'optimizing', runId: null })
    expect(row.interruptedAt).toBeInstanceOf(Date)
    expect(store.statuses).not.toContain('failed')
  })

  it('gives a job claimed during the handoff straight back', async () => {
    await drainReportUploadPipelines(0)
    const job = claimedJob()

    await runResumedUploadPipeline(job)

    expect(materializePdfSource).not.toHaveBeenCalled()
    expect(rowOf(job)).toMatchObject({ status: 'optimizing', runId: null })
    expect(rowOf(job).interruptedAt).toBeInstanceOf(Date)
  })
})

describe('resumeInterruptedUploadJobs', () => {
  function interruptedJob(): ReportUploadJob {
    return seedJob({
      status: 'optimizing',
      thumbnailUrl: '/uploads/thumbnails/cover.jpg',
      runId: null,
      interruptedAt: new Date()
    })
  }

  it('claims as many interrupted jobs as it has room for and resumes them here', async () => {
    const jobs = [interruptedJob(), interruptedJob(), interruptedJob()]

    const result = await resumeInterruptedUploadJobs()

    expect(result).toEqual({ resumed: 2, finalized: 0 })
    expect(listInterruptedUploadJobs).toHaveBeenCalledWith(2)
    await vi.waitFor(() => {
      expect(jobs.slice(0, 2).map((j) => rowOf(j).status)).toEqual(['completed', 'completed'])
    })
    expect(rowOf(jobs[0])).toMatchObject({ worker: 'pod-test', attempts: 2, interruptedAt: null })
    // The third waits for the next sweep (here or on another replica).
    expect(rowOf(jobs[2])).toMatchObject({ status: 'optimizing', runId: null })
  })

  it('leaves resumes to other replicas while this process is busy', async () => {
    const busy = seedJob()
    const storing = deferred<string>()
    vi.mocked(persistUpload).mockReturnValueOnce(storing.promise)
    const run = runReportUploadPipeline(busy, SPOOL, { actor })
    await vi.waitFor(() => expect(rowOf(busy).status).toBe('storing'))
    interruptedJob()

    await resumeInterruptedUploadJobs()

    // One local run leaves room for one resume.
    expect(listInterruptedUploadJobs).toHaveBeenCalledWith(1)
    storing.resolve('/pdf/reports/20260929-x.pdf')
    await run
  })

  it('reports jobs given up after too many interruptions', async () => {
    vi.mocked(finalizeExhaustedUploadJobs).mockResolvedValueOnce(3)
    expect(await resumeInterruptedUploadJobs()).toEqual({ resumed: 0, finalized: 3 })
  })

  it('does nothing once the process is shutting down', async () => {
    interruptedJob()
    await drainReportUploadPipelines(0)

    expect(await resumeInterruptedUploadJobs()).toEqual({ resumed: 0, finalized: 0 })
    expect(finalizeExhaustedUploadJobs).not.toHaveBeenCalled()
    expect(listInterruptedUploadJobs).not.toHaveBeenCalled()
  })
})
