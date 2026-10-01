import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  __resetExplicitOptimizationsForTests,
  drainExplicitOptimizations,
  isAcceptingOptimizations,
  startExplicitOptimization,
  type ExplicitOptimizationOptions
} from '~/server/utils/explicitOptimizations'
import {
  optimizeReportPdf,
  PdfOptimizerError,
  type OptimizeOptions,
  type OptimizeResult
} from '~/server/utils/pdfOptimizer'
import { createJob, getJob, subscribe, type JobState } from '~/server/utils/pdfOptimizationJobs'
import {
  enqueue,
  getActiveJobIdLocal,
  registerActiveJob,
  __resetSchedulerForTests
} from '~/server/utils/pdfOptimizationScheduler'
import { runReportOptimization } from '~/server/utils/runReportOptimization'
import { uploadBlobFromFile } from '~/server/utils/blobStorage'
import { persistOptimizationResult } from '~/server/utils/persistOptimizationResult'
import { getRedis } from '~/server/utils/redis'
import { logWarn } from '~/server/utils/logger'

// The job store, the scheduler and the runner are real: what is under test is
// how they behave together when the process is told to stop. Only the
// optimizer's tools, storage, the database and Redis are stood in for.

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/utils/pdfOptimizer', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/pdfOptimizer')>(
    '~/server/utils/pdfOptimizer'
  )
  return { ...actual, optimizeReportPdf: vi.fn() }
})

vi.mock('~/server/utils/blobStorage', () => ({
  uploadBlobFromFile: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/persistOptimizationResult', () => ({
  persistOptimizationResult: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/auditLogger', () => ({
  logAuditActionAs: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn()
}))

vi.mock('~/server/utils/redis', () => ({
  getRedis: vi.fn(() => null)
}))

/** Enough of ioredis for the job mirror and the per-file claims. */
function makeFakeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    /** What another replica would read for a job. */
    mirrored(jobId: string): JobState | undefined {
      const raw = store.get(`gas:pdf-opt:${jobId}`)
      return raw ? (JSON.parse(raw) as JobState) : undefined
    },
    claim(fileUrl: string): string | undefined {
      return store.get(`gas:pdf-opt-active:${fileUrl}`)
    },
    client: {
      async set(key: string, value: string, ...opts: unknown[]) {
        if (opts.includes('NX') && store.has(key)) return null
        store.set(key, value)
        return 'OK'
      },
      async get(key: string) {
        return store.get(key) ?? null
      },
      async del(key: string) {
        return store.delete(key) ? 1 : 0
      }
    }
  }
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => (resolve = res))
  return { promise, resolve }
}

const actor = { userId: 7, ipAddress: '10.0.0.1', userAgent: 'vitest' }

const result: OptimizeResult = {
  originalSize: 5000,
  optimizedSize: 3000,
  savedBytes: 2000,
  skippedCompression: false,
  nativePages: 3,
  scannedPages: 0,
  ocrFailedPages: 0,
  pageCount: 3
}

let fileSeq = 0

function options(overrides: Partial<ExplicitOptimizationOptions> = {}) {
  const fileUrl = `/pdf/reports/explicit-${++fileSeq}.pdf`
  const cleanup = vi.fn(async () => undefined)
  return {
    cleanup,
    opts: {
      source: { path: `/tmp/gas-test-${fileSeq}.pdf`, blobKey: fileUrl.slice(1), cleanup },
      fileUrl,
      preset: 'ebook',
      allowDropBookmarks: false,
      actor,
      reportId: 42,
      ...overrides
    } satisfies ExplicitOptimizationOptions
  }
}

/**
 * Optimizer stand-in that runs until released — or until its signal aborts,
 * when it fails the way a killed Ghostscript does.
 */
function holdOptimizer() {
  const signals: Array<AbortSignal | undefined> = []
  vi.mocked(optimizeReportPdf).mockImplementation(
    (_path: string, opts: OptimizeOptions = {}) =>
      new Promise<OptimizeResult>((_resolve, reject) => {
        signals.push(opts.signal)
        opts.signal?.addEventListener(
          'abort',
          () => reject(new PdfOptimizerError('COMPRESS_FAILED', 'gs failed: killed')),
          { once: true }
        )
      })
  )
  return signals
}

function start(overrides: Partial<ExplicitOptimizationOptions> = {}) {
  const { opts, cleanup } = options(overrides)
  const job = startExplicitOptimization(opts)
  if (!job) throw new Error('expected the optimization to start')
  return { job, cleanup, fileUrl: opts.fileUrl }
}

let redis: ReturnType<typeof makeFakeRedis>

beforeEach(() => {
  __resetSchedulerForTests()
  __resetExplicitOptimizationsForTests()
  redis = makeFakeRedis()
  vi.mocked(getRedis).mockReturnValue(redis.client as never)
  vi.mocked(optimizeReportPdf).mockResolvedValue(result)
  vi.mocked(uploadBlobFromFile).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('startExplicitOptimization', () => {
  it('claims the file and runs the optimizer with an abort signal', async () => {
    const { job, cleanup, fileUrl } = start()
    expect(getActiveJobIdLocal(fileUrl)).toBe(job.id)

    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe('success'))

    expect(optimizeReportPdf).toHaveBeenCalledWith(
      `/tmp/gas-test-${fileSeq}.pdf`,
      expect.objectContaining({ preset: 'ebook', signal: expect.any(AbortSignal) })
    )
    expect(cleanup).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(redis.claim(fileUrl)).toBeUndefined())
    expect(getActiveJobIdLocal(fileUrl)).toBeUndefined()
  })
})

describe('drainExplicitOptimizations (shutdown)', () => {
  it('reports every queued and running optimization INTERRUPTED at once and frees their files', async () => {
    const signals = holdOptimizer()
    // Two run at once; the third waits in the queue.
    vi.stubEnv('PDF_OPTIMIZATION_MAX_CONCURRENT', '2')
    const runs = [start(), start(), start()]
    await vi.waitFor(() => expect(signals).toHaveLength(2))
    const terminal: string[] = []
    for (const { job } of runs) {
      subscribe(job.id, ({ event }) => {
        if (event.phase === 'done') terminal.push(job.id)
      })
    }

    const drained = drainExplicitOptimizations(1_000)

    // Before the drain has awaited anything: what this pod's SSE streams and
    // status endpoint serve is already accurate.
    for (const { job } of runs) {
      expect(getJob(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
    }
    expect(terminal.sort()).toEqual(runs.map(({ job }) => job.id).sort())
    expect(signals.every((s) => s?.aborted)).toBe(true)

    await drained

    for (const { job, cleanup, fileUrl } of runs) {
      // What the other replicas serve: interrupted, not running (and so not a
      // TIMEOUT 15 minutes from now), with the file free for a retry.
      expect(redis.mirrored(job.id)).toMatchObject({
        status: 'error',
        errorCode: 'INTERRUPTED'
      })
      expect(redis.claim(fileUrl)).toBeUndefined()
      expect(getActiveJobIdLocal(fileUrl)).toBeUndefined()
      expect(cleanup).toHaveBeenCalledTimes(1)
    }
    // The queued one never started, and nothing reached storage.
    expect(optimizeReportPdf).toHaveBeenCalledTimes(2)
    expect(uploadBlobFromFile).not.toHaveBeenCalled()
    expect(persistOptimizationResult).not.toHaveBeenCalled()
    expect(logWarn).toHaveBeenCalledWith('pdfOptimizer', 'shutdown: interrupted 3 optimization(s)')
  })

  it('is not done until the interruption has reached Redis', async () => {
    holdOptimizer()
    const { job } = start()
    await vi.waitFor(() => expect(optimizeReportPdf).toHaveBeenCalled())
    // From here on Redis acknowledges writes only when the test says so.
    const unacknowledged: Array<() => void> = []
    vi.mocked(getRedis).mockReturnValue({
      ...redis.client,
      set: (key: string, value: string) =>
        new Promise((resolve) => unacknowledged.push(() => resolve(redis.client.set(key, value))))
    } as never)

    let drained = false
    const drain = drainExplicitOptimizations(1_000).then(() => (drained = true))
    // Already on its way the moment the drain starts, ahead of any close hook.
    expect(unacknowledged.length).toBeGreaterThan(0)
    await new Promise((resolve) => setTimeout(resolve, 20))
    // The run itself has long wound down; the drain still waits for Redis.
    expect(drained).toBe(false)

    while (unacknowledged.length > 0) unacknowledged.shift()!()
    await drain
    expect(redis.mirrored(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
  })

  it('refuses new optimizations once the process is shutting down', async () => {
    await drainExplicitOptimizations(0)

    expect(isAcceptingOptimizations()).toBe(false)
    const { opts, cleanup } = options()
    expect(startExplicitOptimization(opts)).toBeNull()
    expect(getActiveJobIdLocal(opts.fileUrl)).toBeUndefined()
    // The caller still owns the fetched copy.
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('leaves background-upload optimizations to the upload drain', async () => {
    vi.stubEnv('PDF_OPTIMIZATION_MAX_CONCURRENT', '2')
    const signals = holdOptimizer()
    // How the upload pipeline queues its optimization: not through here.
    const uploadRun = new AbortController()
    const uploadJob = createJob('/pdf/reports/uploaded.pdf', null)
    registerActiveJob(uploadJob.fileUrl, uploadJob.id)
    enqueue(
      uploadJob.id,
      uploadJob.fileUrl,
      () =>
        runReportOptimization({
          jobId: uploadJob.id,
          source: { path: '/tmp/gas-upload.pdf', blobKey: null, cleanup: async () => {} },
          fileUrl: uploadJob.fileUrl,
          preset: 'ebook',
          allowDropBookmarks: false,
          actor,
          reportId: null,
          signal: uploadRun.signal
        }),
      uploadRun.signal
    )
    const explicit = start()
    await vi.waitFor(() => expect(signals).toHaveLength(2))

    await drainExplicitOptimizations(1_000)

    expect(getJob(explicit.job.id)?.errorCode).toBe('INTERRUPTED')
    expect(uploadRun.signal.aborted).toBe(false)
    expect(getJob(uploadJob.id)?.status).toBe('running')
    expect(getActiveJobIdLocal(uploadJob.fileUrl)).toBe(uploadJob.id)

    // Its own handoff stops it later.
    uploadRun.abort()
    await vi.waitFor(() => expect(getJob(uploadJob.id)?.errorCode).toBe('INTERRUPTED'))
  })

  it('releases one queued behind background uploads without waiting for a slot', async () => {
    const signals = holdOptimizer()
    // Both optimizer slots are busy with uploads, which drain on their own.
    vi.stubEnv('PDF_OPTIMIZATION_MAX_CONCURRENT', '2')
    const uploadRuns = [new AbortController(), new AbortController()]
    for (const [i, controller] of uploadRuns.entries()) {
      const fileUrl = `/pdf/reports/busy-upload-${i}.pdf`
      enqueue(
        `upload-opt-${i}`,
        fileUrl,
        () => optimizeReportPdf(fileUrl, { signal: controller.signal }).then(() => undefined),
        controller.signal
      )
    }
    const { job, cleanup, fileUrl } = start()
    await vi.waitFor(() => expect(signals).toHaveLength(2))

    const startedAt = Date.now()
    await drainExplicitOptimizations(5_000)

    // Done well inside the grace period, with the uploads still running.
    expect(Date.now() - startedAt).toBeLessThan(2_000)
    expect(redis.mirrored(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
    expect(redis.claim(fileUrl)).toBeUndefined()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(signals).toHaveLength(2)
    for (const controller of uploadRuns) controller.abort()
  })

  it('reports the real outcome of a run already pushing its result to storage', async () => {
    const storing = deferred()
    vi.mocked(uploadBlobFromFile).mockReturnValueOnce(storing.promise)
    const { job } = start()
    await vi.waitFor(() => expect(uploadBlobFromFile).toHaveBeenCalled())

    const drained = drainExplicitOptimizations(1_000)
    // Interrupted at once, as the upload may not finish before the pod goes…
    expect(getJob(job.id)?.errorCode).toBe('INTERRUPTED')

    // …but it does, so the optimized file is what everyone ends up seeing.
    storing.resolve()
    await drained
    expect(getJob(job.id)).toMatchObject({ status: 'success', result })
    expect(getJob(job.id)?.errorCode).toBeUndefined()
    expect(redis.mirrored(job.id)).toMatchObject({ status: 'success' })
    expect(redis.mirrored(job.id)?.errorCode).toBeUndefined()
    expect(persistOptimizationResult).toHaveBeenCalled()
  })

  it('stops waiting for runs that will not wind down at the deadline', async () => {
    vi.mocked(uploadBlobFromFile).mockReturnValueOnce(new Promise(() => {}))
    const { job, fileUrl } = start()
    await vi.waitFor(() => expect(uploadBlobFromFile).toHaveBeenCalled())

    await drainExplicitOptimizations(20)

    expect(redis.mirrored(job.id)).toMatchObject({ status: 'error', errorCode: 'INTERRUPTED' })
    // Freed by the drain itself: the run never ends to let the scheduler do it.
    expect(redis.claim(fileUrl)).toBeUndefined()
    expect(getActiveJobIdLocal(fileUrl)).toBeUndefined()
  })

  it('does nothing more than stop accepting when nothing is running', async () => {
    await drainExplicitOptimizations(1_000)

    expect(isAcceptingOptimizations()).toBe(false)
    expect(logWarn).not.toHaveBeenCalled()
  })

  it('is shared between the signal handler and the close hook', () => {
    expect(drainExplicitOptimizations(10)).toBe(drainExplicitOptimizations(10))
  })
})
