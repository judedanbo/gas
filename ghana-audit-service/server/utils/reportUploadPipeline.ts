import { unlink } from 'node:fs/promises'
import { uploadConfigs, persistUpload } from './fileUpload'
import { generateThumbnailFromPdf } from './generateThumbnail'
import { getContainerClient, blobKeyFromFileUrl } from './blobStorage'
import { resolvePublicAsset } from './publicFiles'
import { materializePdfSource, type LocalPdfSource } from './pdfSource'
import { createJob, getJob, subscribe, type SequencedEvent } from './pdfOptimizationJobs'
import { enqueue, registerActiveJob } from './pdfOptimizationScheduler'
import { runReportOptimization } from './runReportOptimization'
import { settledOrTimeout } from './shutdownSignals'
import type { AuditActor } from './auditLogger'
import { logError, logWarn } from './logger'
import {
  applyUploadJobToReport,
  claimInterruptedUploadJob,
  failInterruptedUploadJob,
  finalizeExhaustedUploadJobs,
  getUploadJob,
  listInterruptedUploadJobs,
  releaseUploadJobForResume,
  touchUploadJob,
  updateUploadJob,
  uploadProgressPercent,
  uploadWorkerId,
  HEARTBEAT_INTERVAL_MS,
  STAGE_PROGRESS,
  type ReportUploadJob,
  type StoredUploadStatus,
  type UploadJobPatch
} from './reportUploadJobs'

/*
 * Background A-G report uploads run inside the web process, so they have to
 * survive that process going away — every deploy replaces the pods.
 *
 * - Each run owns its job row through a fencing token (runId): every write it
 *   makes is conditional on still holding it, and it stops as soon as one
 *   isn't (see updateUploadJob).
 * - On shutdown (drainReportUploadPipelines) running uploads get a bounded
 *   grace period. What is still running then is handed off: released for
 *   resume if its file is already stored, failed with INTERRUPTED if not.
 * - Any live process resumes released jobs (resumeInterruptedUploadJobs, from
 *   the watchdog plugin), re-materializing the PDF from storage.
 */

export interface ReportUploadPipelineOptions {
  /** Who uploaded the file — audit-log attribution for the optimization. */
  actor: AuditActor
}

/**
 * How long a process that is shutting down lets its running uploads finish
 * before handing them off. Must stay well inside Nitro's close budget
 * (NITRO_SHUTDOWN_TIMEOUT, 30s by default) and the pod's
 * terminationGracePeriodSeconds (k8s/frontend/deployment.yaml) so the
 * handoff writes always land.
 */
export const DRAIN_GRACE_MS = 20_000

/**
 * Upload runs this process may already be carrying and still claim
 * interrupted jobs to resume — the optimizer runs two at a time per process,
 * so a busier pod leaves resumes to an idler replica.
 */
const RESUME_CAPACITY = 2

// Progress events arrive per page; coalesce DB writes to roughly one per
// second (phase changes flush immediately so the label never lags).
const PROGRESS_WRITE_INTERVAL_MS = 1_000

type RunStage = 'store' | 'thumbnail' | 'optimize'

interface UploadRun {
  jobId: string
  runId: string
  /** Anything past 'store' means the original is in storage. */
  stage: RunStage
  controller: AbortController
  /** Settles when the run's work returns, however it ends. */
  done: Promise<void>
}

/** serving → draining (no new uploads or resumes) → handed-off (runs given away). */
type DrainPhase = 'serving' | 'draining' | 'handed-off'

let drainPhase: DrainPhase = 'serving'
let drainPromise: Promise<void> | null = null
const runs = new Map<string, UploadRun>()
/** Upload requests whose bytes are still arriving. */
const transfers = new Set<Promise<void>>()

/** False once this process has started shutting down: new uploads belong on another replica. */
export function isAcceptingUploads(): boolean {
  return drainPhase === 'serving'
}

/**
 * True once this process has handed its uploads off: a pipeline started now
 * would be cut off before it could store anything.
 */
export function isPastUploadHandoff(): boolean {
  return drainPhase === 'handed-off'
}

/**
 * Register an upload request whose bytes are still arriving, so a shutdown
 * waits for it within the grace period like for a running pipeline — a
 * report still streaming in when SIGTERM lands can then be stored and handed
 * off for resume instead of lost. Call the returned function when the
 * request is done, however it ends.
 */
export function beginUploadTransfer(): () => void {
  let settle!: () => void
  const done = new Promise<void>((resolve) => (settle = resolve))
  transfers.add(done)
  return () => {
    transfers.delete(done)
    settle()
  }
}

/** Test helper: reset drain state and forget registered runs. */
export function __resetUploadPipelineForTests(): void {
  drainPhase = 'serving'
  drainPromise = null
  runs.clear()
  transfers.clear()
}

function isAborted(run: UploadRun): boolean {
  return run.controller.signal.aborted
}

function abortRun(run: UploadRun, reason: string): void {
  if (!isAborted(run)) run.controller.abort(new Error(reason))
}

function storedStatusOf(stage: RunStage): StoredUploadStatus {
  return stage === 'optimize' ? 'optimizing' : 'thumbnail'
}

/**
 * Fenced job write. False — and the run is aborted — once the job is no
 * longer this run's (handed off, or presumed dead and resumed elsewhere).
 */
async function writeJob(run: UploadRun, patch: UploadJobPatch): Promise<boolean> {
  if (isAborted(run)) return false
  const owned = await updateUploadJob(run.jobId, patch, { runId: run.runId })
  if (!owned) abortRun(run, 'Upload job is no longer owned by this run')
  return owned && !isAborted(run)
}

/**
 * Register a run under the job's current owner token and execute `work`
 * with a heartbeat, drain bookkeeping and crash reporting around it. Returns
 * false without running anything when this process is past its shutdown
 * handoff — the caller then gives the job back.
 */
async function withRun(
  job: ReportUploadJob,
  stage: RunStage,
  work: (run: UploadRun) => Promise<void>
): Promise<boolean> {
  if (!job.runId || drainPhase === 'handed-off') return false

  let settle!: () => void
  const run: UploadRun = {
    jobId: job.id,
    runId: job.runId,
    stage,
    controller: new AbortController(),
    done: new Promise<void>((resolve) => (settle = resolve))
  }
  runs.set(run.runId, run)

  // The heartbeat is also the ownership check: a run that was presumed dead
  // (e.g. it could not reach the database for STALL_TIMEOUT_MS) and resumed
  // elsewhere learns it here and stops.
  const heartbeat = setInterval(() => {
    if (isAborted(run)) return
    void touchUploadJob(run.jobId, run.runId).then((owned) => {
      if (!owned) abortRun(run, 'Upload job is no longer owned by this run')
    })
  }, HEARTBEAT_INTERVAL_MS)
  heartbeat.unref?.()

  try {
    await work(run)
  } catch (err) {
    if (!isAborted(run)) {
      logError('reportUpload', err)
      await writeJob(run, {
        status: 'failed',
        error: 'The upload could not be processed',
        errorCode: 'PIPELINE_FAILED',
        completedAt: new Date()
      })
    }
  } finally {
    clearInterval(heartbeat)
    runs.delete(run.runId)
    settle()
  }
  return true
}

// ── Original run: spool → storage → … ───────────────────────────────────────

/**
 * Kick off the pipeline detached from the request lifetime. The caller has
 * already persisted the job row (owned by its first run) and returned its id
 * to the browser; from here on every outcome — including a crash or a
 * shutdown — is written to that row.
 */
export function startReportUploadPipeline(
  job: ReportUploadJob,
  tempPath: string,
  opts: ReportUploadPipelineOptions
): void {
  void runReportUploadPipeline(job, tempPath, opts).catch((err) => {
    logError('reportUpload', err)
  })
}

/**
 * store → thumbnail → optimize → patch report → completed.
 *
 * The spooled upload (`tempPath`) is the working copy for every stage, so a
 * 100MB report is never re-downloaded from Blob. Optimization failure is not
 * an upload failure: the original is already in storage, the job completes
 * with optimizationStatus = 'error' and the admin can retry from the edit
 * page. Only a storage failure marks the job failed.
 */
export async function runReportUploadPipeline(
  job: ReportUploadJob,
  tempPath: string,
  opts: ReportUploadPipelineOptions
): Promise<void> {
  try {
    const started = await withRun(job, 'store', (run) => storeAndProcess(run, job, tempPath, opts))
    // The bytes arrived after this process handed its uploads off; it will
    // be gone before they could be stored.
    if (!started && job.runId) await failInterruptedUploadJob(job.id, job.runId)
  } finally {
    await unlink(tempPath).catch(() => {})
  }
}

async function storeAndProcess(
  run: UploadRun,
  job: ReportUploadJob,
  tempPath: string,
  opts: ReportUploadPipelineOptions
): Promise<void> {
  // 1. Store the original. Until this lands the fileUrl points nowhere,
  //    which is why the admin UI shows "Saving to storage…" rather than a link.
  if (!(await writeJob(run, { status: 'storing', progress: STAGE_PROGRESS.storing }))) return
  try {
    await persistUpload(uploadConfigs.report, job.filename, tempPath, job.mimeType)
  } catch (err) {
    if (isAborted(run)) return
    logError('reportUpload', err)
    await writeJob(run, {
      status: 'failed',
      error: 'The file could not be saved to storage',
      errorCode: 'STORE_FAILED',
      completedAt: new Date()
    })
    return
  }
  // From here on the job survives this process: a handoff releases it for
  // resume instead of failing it.
  run.stage = 'thumbnail'
  if (isAborted(run)) return

  // Where the optimizer works. Blob: the temp copy (optimized bytes are
  // pushed back to the same key). Disk: the persisted file itself, in place,
  // exactly like the explicit optimize endpoint.
  const source: LocalPdfSource = getContainerClient()
    ? { path: tempPath, blobKey: blobKeyFromFileUrl(job.fileUrl), cleanup: async () => {} }
    : {
        path: resolvePublicAsset(job.fileUrl) ?? tempPath,
        blobKey: null,
        cleanup: async () => {}
      }
  await processStoredUpload(run, job, tempPath, source, opts.actor)
}

// ── Resumed run: storage → … ────────────────────────────────────────────────

/** Start a run for a job this process just claimed (claimInterruptedUploadJob). */
export function resumeReportUploadPipeline(job: ReportUploadJob): void {
  void runResumedUploadPipeline(job).catch((err) => {
    logError('reportUpload', err)
  })
}

/**
 * Pick a stored upload back up after its previous run was cut short: the
 * PDF is re-materialized from storage, the thumbnail is only rendered if the
 * earlier run did not get to it, and optimization starts over.
 */
export async function runResumedUploadPipeline(job: ReportUploadJob): Promise<void> {
  const stage: RunStage = job.status === 'optimizing' ? 'optimize' : 'thumbnail'
  const started = await withRun(job, stage, (run) => resumeFromStorage(run, job))
  // Claimed just as this process handed its uploads off: give it back.
  if (!started && job.runId) {
    await releaseUploadJobForResume(job.id, job.runId, storedStatusOf(stage))
  }
}

async function resumeFromStorage(run: UploadRun, job: ReportUploadJob): Promise<void> {
  let source: LocalPdfSource | null
  try {
    source = await materializePdfSource(job.fileUrl)
  } catch (err) {
    // Storage hiccup: put the job back for another attempt rather than fail
    // an upload whose file is safely stored. Attempts are capped.
    logError('reportUpload', err)
    if (isAborted(run)) return
    abortRun(run, 'Could not read the stored upload')
    await releaseUploadJobForResume(job.id, run.runId, storedStatusOf(run.stage))
    return
  }
  if (!source) {
    await writeJob(run, {
      status: 'failed',
      error: 'The stored file could not be found to resume the upload',
      errorCode: 'RESUME_FAILED',
      completedAt: new Date()
    })
    return
  }

  try {
    if (isAborted(run)) return
    // No request behind a resume: attribute the optimization to the uploader.
    const actor: AuditActor = { userId: job.userId, ipAddress: null, userAgent: null }
    // The materialized copy is ours to clean up, not the optimizer's.
    await processStoredUpload(run, job, source.path, { ...source, cleanup: async () => {} }, actor)
  } finally {
    await source.cleanup()
  }
}

// ── Shared stages once the original is stored ──────────────────────────────

async function processStoredUpload(
  run: UploadRun,
  job: ReportUploadJob,
  thumbnailFrom: string,
  source: LocalPdfSource,
  actor: AuditActor
): Promise<void> {
  // 2. Thumbnail from the cover page. The optimizer preserves page 1
  //    byte-for-byte, so rendering it before optimization is safe and gets
  //    the cover onto the form sooner. Non-fatal: the admin can upload a
  //    custom image. A resumed run keeps the one its predecessor made.
  let thumbnailUrl = job.thumbnailUrl ?? null
  if (!thumbnailUrl) {
    run.stage = 'thumbnail'
    if (!(await writeJob(run, { status: 'thumbnail', progress: STAGE_PROGRESS.thumbnail }))) return
    try {
      thumbnailUrl = await generateThumbnailFromPdf(thumbnailFrom)
    } catch (err) {
      logError('reportUpload', err)
    }
    if (isAborted(run)) return
  }

  // 3. Optimize through the shared scheduler so background uploads and
  //    explicit "Optimize" clicks share the same concurrency cap and
  //    per-file dedup. The in-process job id is stored so the edit page's
  //    SSE/poll attach keeps working for uploads too.
  run.stage = 'optimize'
  const optimizing = await writeJob(run, {
    status: 'optimizing',
    phase: 'waiting',
    page: 0,
    progress: STAGE_PROGRESS.optimizingStart,
    thumbnailUrl
  })
  if (!optimizing) return
  const outcome = await optimizeInPlace(run, job, source, actor)
  if (isAborted(run)) return

  const finalSize =
    outcome.status === 'success' && outcome.result && !outcome.result.skippedCompression
      ? outcome.result.optimizedSize
      : job.size

  const completed = await writeJob(run, {
    status: 'completed',
    progress: STAGE_PROGRESS.completed,
    phase: null,
    finalSize,
    optimizationStatus: outcome.status,
    optimizationResult:
      outcome.status === 'success' && outcome.result
        ? {
            preset: job.preset,
            originalSize: outcome.result.originalSize,
            optimizedSize: outcome.result.optimizedSize,
            savedBytes: outcome.result.savedBytes,
            pageCount: outcome.result.pageCount,
            nativePages: outcome.result.nativePages,
            scannedPages: outcome.result.scannedPages,
            ocrFailedPages: outcome.result.ocrFailedPages,
            skippedCompression: outcome.result.skippedCompression
          }
        : null,
    error: outcome.status === 'error' ? (outcome.error ?? 'Optimization failed') : null,
    errorCode: outcome.status === 'error' ? (outcome.errorCode ?? 'UNKNOWN') : null,
    completedAt: new Date()
  })
  if (!completed) return

  // 4. Land the outputs on the report row if the admin already saved one
  //    for this file (or linked this job). Runs *after* the completed
  //    write so a create POST racing us sees a completed job and applies
  //    the same values itself — whichever side finishes second wins.
  const finished = await getUploadJob(job.id)
  if (finished?.status === 'completed') await applyUploadJobToReport(finished)
}

interface OptimizeOutcome {
  status: 'success' | 'error'
  result?: NonNullable<ReturnType<typeof getJob>>['result']
  error?: string
  errorCode?: string
}

/** Resolves once the run is aborted (immediately if it already is). */
function whenAborted(run: UploadRun): Promise<void> {
  const signal = run.controller.signal
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
}

/**
 * Run the optimizer over the working copy and mirror its progress onto the
 * job row. Resolves when the optimizer finishes (however it finishes), or
 * straight away if the run is aborted — the optimizer then stops on its own
 * and writes nothing back to storage.
 */
async function optimizeInPlace(
  run: UploadRun,
  job: ReportUploadJob,
  source: LocalPdfSource,
  actor: AuditActor
): Promise<OptimizeOutcome> {
  const optJob = createJob(job.fileUrl, null)
  registerActiveJob(job.fileUrl, optJob.id)

  // Throttled progress mirror: latest snapshot wins, flushed at most once per
  // interval, immediately on phase change.
  let snapshot = { phase: 'waiting' as string, page: 0, totalPages: job.totalPages }
  let lastFlushedPhase = 'waiting'
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    flushTimer = null
    lastFlushedPhase = snapshot.phase
    void writeJob(run, {
      phase: snapshot.phase,
      page: snapshot.page,
      totalPages: snapshot.totalPages,
      progress: uploadProgressPercent(snapshot.phase, snapshot.page, snapshot.totalPages)
    })
  }
  const unsubscribe = subscribe(optJob.id, ({ event }: SequencedEvent) => {
    if (event.phase === 'done') return
    const next = { ...snapshot, phase: event.phase }
    if (event.phase === 'inspect') next.totalPages = event.pageCount
    if (event.phase === 'classify' || event.phase === 'ocr') {
      next.page = event.page
      next.totalPages = event.totalPages
    }
    snapshot = next
    if (snapshot.phase !== lastFlushedPhase) {
      if (flushTimer) clearTimeout(flushTimer)
      flush()
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, PROGRESS_WRITE_INTERVAL_MS)
      flushTimer.unref?.()
    }
  })

  try {
    // Always enqueued once registered: even an aborted run's item has to
    // pass through the scheduler, which is what releases the file claim (at
    // once, given the signal, rather than when a slot frees up).
    const optimized = new Promise<void>((resolve) => {
      enqueue(
        optJob.id,
        job.fileUrl,
        () =>
          runReportOptimization({
            jobId: optJob.id,
            source,
            fileUrl: job.fileUrl,
            preset: job.preset,
            allowDropBookmarks: job.allowDropBookmarks,
            actor,
            reportId: null,
            signal: run.controller.signal
          }).finally(resolve),
        run.controller.signal
      )
    })
    await writeJob(run, { optimizationJobId: optJob.id })
    await Promise.race([optimized, whenAborted(run)])
  } finally {
    unsubscribe()
    if (flushTimer) clearTimeout(flushTimer)
  }

  const final = getJob(optJob.id)
  if (final?.status === 'success') {
    return { status: 'success', result: final.result }
  }
  return {
    status: 'error',
    error: final?.error ?? 'Optimization failed',
    errorCode: final?.errorCode ?? 'UNKNOWN'
  }
}

// ── Shutdown and resume ────────────────────────────────────────────────────

/**
 * Wait a bounded time for this process's uploads to finish, then hand off
 * whatever is still running. Idempotent: the shutdown signal and Nitro's
 * close hook both call it and share one drain.
 */
export function drainReportUploadPipelines(graceMs: number = DRAIN_GRACE_MS): Promise<void> {
  drainPromise ??= drainRuns(graceMs)
  return drainPromise
}

async function drainRuns(graceMs: number): Promise<void> {
  drainPhase = 'draining'
  const deadline = Date.now() + graceMs
  // Re-snapshot each round: an upload whose bytes finish arriving during the
  // grace period starts a run that deserves the remaining time too.
  while (runs.size > 0 || transfers.size > 0) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await settledOrTimeout([...[...runs.values()].map((run) => run.done), ...transfers], remaining)
  }
  drainPhase = 'handed-off'

  const leftovers = [...runs.values()]
  if (leftovers.length === 0) return
  const outcomes = await Promise.all(leftovers.map(handOff))
  const resumable = outcomes.filter((o) => o === 'resumable').length
  const failed = outcomes.filter((o) => o === 'failed').length
  logWarn(
    'reportUpload',
    `shutdown: released ${resumable} stored upload(s) for resume elsewhere, failed ${failed} not yet stored`
  )
}

/**
 * Stop a run and leave its job in a state another process can act on. The
 * abort comes first so the run makes no further progress; both writes are
 * fenced to this run and clear its token, so nothing it still has in flight
 * can land afterwards.
 */
async function handOff(run: UploadRun): Promise<'resumable' | 'failed' | 'gone'> {
  abortRun(run, 'Server is shutting down')
  if (run.stage === 'store') {
    return (await failInterruptedUploadJob(run.jobId, run.runId)) ? 'failed' : 'gone'
  }
  const released = await releaseUploadJobForResume(run.jobId, run.runId, storedStatusOf(run.stage))
  return released ? 'resumable' : 'gone'
}

export interface ResumeSweepResult {
  resumed: number
  /** Jobs whose attempts ran out: completed with optimization skipped. */
  finalized: number
}

/**
 * Watchdog step: give up on interrupted jobs that are out of attempts, then
 * claim and resume as many others as this process has room for. Does
 * nothing once the process is shutting down.
 */
export async function resumeInterruptedUploadJobs(): Promise<ResumeSweepResult> {
  if (!isAcceptingUploads()) return { resumed: 0, finalized: 0 }
  const finalized = await finalizeExhaustedUploadJobs()
  const capacity = RESUME_CAPACITY - runs.size
  if (capacity <= 0) return { resumed: 0, finalized }

  const worker = uploadWorkerId()
  let resumed = 0
  for (const candidate of await listInterruptedUploadJobs(capacity)) {
    if (!isAcceptingUploads()) break
    const claimed = await claimInterruptedUploadJob(candidate.id, worker)
    if (!claimed) continue
    resumeReportUploadPipeline(claimed)
    resumed++
  }
  return { resumed, finalized }
}
