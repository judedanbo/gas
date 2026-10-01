import { unlink } from 'node:fs/promises'
import type { H3Event } from 'h3'
import { uploadConfigs, persistUpload } from './fileUpload'
import { generateThumbnailFromPdf } from './generateThumbnail'
import { getContainerClient, blobKeyFromFileUrl } from './blobStorage'
import { resolvePublicAsset } from './publicFiles'
import type { LocalPdfSource } from './pdfSource'
import { createJob, getJob, subscribe, type SequencedEvent } from './pdfOptimizationJobs'
import { enqueue, registerActiveJob } from './pdfOptimizationScheduler'
import { runReportOptimization } from './runReportOptimization'
import type { CompressionPreset } from './pdfOptimizer'
import { logError } from './logger'
import {
  applyUploadJobToReport,
  getUploadJob,
  touchUploadJob,
  updateUploadJob,
  uploadProgressPercent,
  HEARTBEAT_INTERVAL_MS,
  STAGE_PROGRESS,
  type ReportUploadJob
} from './reportUploadJobs'

export interface ReportUploadPipelineOptions {
  preset: CompressionPreset
  allowDropBookmarks?: boolean
  /** Request that received the bytes — only used for audit-log attribution. */
  event: H3Event
}

// Progress events arrive per page; coalesce DB writes to roughly one per
// second (phase changes flush immediately so the label never lags).
const PROGRESS_WRITE_INTERVAL_MS = 1_000

/**
 * Kick off the pipeline detached from the request lifetime. The caller has
 * already persisted the job row and returned its id to the browser; from
 * here on every outcome — including a crash — is written to that row.
 */
export function startReportUploadPipeline(
  jobId: string,
  tempPath: string,
  opts: ReportUploadPipelineOptions
): void {
  void runReportUploadPipeline(jobId, tempPath, opts).catch((err) => {
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
  jobId: string,
  tempPath: string,
  opts: ReportUploadPipelineOptions
): Promise<void> {
  const job = await getUploadJob(jobId)
  if (!job) {
    await unlink(tempPath).catch(() => {})
    return
  }

  const heartbeat = setInterval(() => void touchUploadJob(jobId), HEARTBEAT_INTERVAL_MS)
  heartbeat.unref?.()

  try {
    // 1. Store the original. Until this lands the fileUrl points nowhere,
    //    which is why the admin UI shows "Saving to storage…" rather than a link.
    await updateUploadJob(jobId, { status: 'storing', progress: STAGE_PROGRESS.storing })
    try {
      await persistUpload(uploadConfigs.report, job.filename, tempPath, job.mimeType)
    } catch (err) {
      logError('reportUpload', err)
      await updateUploadJob(jobId, {
        status: 'failed',
        error: 'The file could not be saved to storage',
        errorCode: 'STORE_FAILED',
        completedAt: new Date()
      })
      return
    }

    // 2. Thumbnail from the cover page. The optimizer preserves page 1
    //    byte-for-byte, so rendering it before optimization is safe and gets
    //    the cover onto the form sooner. Non-fatal: the admin can upload a
    //    custom image.
    await updateUploadJob(jobId, { status: 'thumbnail', progress: STAGE_PROGRESS.thumbnail })
    let thumbnailUrl: string | null = null
    try {
      thumbnailUrl = await generateThumbnailFromPdf(tempPath)
    } catch (err) {
      logError('reportUpload', err)
    }

    // 3. Optimize through the shared scheduler so background uploads and
    //    explicit "Optimize" clicks share the same concurrency cap and
    //    per-file dedup. The in-process job id is stored so the edit page's
    //    SSE/poll attach keeps working for uploads too.
    await updateUploadJob(jobId, {
      status: 'optimizing',
      phase: 'waiting',
      progress: STAGE_PROGRESS.optimizingStart,
      thumbnailUrl
    })
    const outcome = await optimizeInPlace(job, tempPath, opts)

    const finalSize =
      outcome.status === 'success' && outcome.result && !outcome.result.skippedCompression
        ? outcome.result.optimizedSize
        : job.size

    const completedAt = new Date()
    await updateUploadJob(jobId, {
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
      completedAt
    })

    // 4. Land the outputs on the report row if the admin already saved one
    //    for this file (or linked this job). Runs *after* the completed
    //    write so a create POST racing us sees a completed job and applies
    //    the same values itself — whichever side finishes second wins.
    const finished = await getUploadJob(jobId)
    if (finished) await applyUploadJobToReport(finished)
  } catch (err) {
    logError('reportUpload', err)
    await updateUploadJob(jobId, {
      status: 'failed',
      error: 'The upload could not be processed',
      errorCode: 'PIPELINE_FAILED',
      completedAt: new Date()
    })
  } finally {
    clearInterval(heartbeat)
    await unlink(tempPath).catch(() => {})
  }
}

interface OptimizeOutcome {
  status: 'success' | 'error'
  result?: NonNullable<ReturnType<typeof getJob>>['result']
  error?: string
  errorCode?: string
}

/**
 * Run the optimizer over the spooled copy and mirror its progress onto the
 * job row. Resolves when the optimizer finishes (however it finishes).
 */
async function optimizeInPlace(
  job: ReportUploadJob,
  tempPath: string,
  opts: ReportUploadPipelineOptions
): Promise<OptimizeOutcome> {
  // Where the optimizer works. Blob: the temp copy (optimized bytes are
  // pushed back to the same key). Disk: the persisted file itself, in place,
  // exactly like the explicit optimize endpoint.
  const blobBacked = Boolean(getContainerClient())
  const source: LocalPdfSource = blobBacked
    ? { path: tempPath, blobKey: blobKeyFromFileUrl(job.fileUrl), cleanup: async () => {} }
    : {
        path: resolvePublicAsset(job.fileUrl) ?? tempPath,
        blobKey: null,
        cleanup: async () => {}
      }

  const optJob = createJob(job.fileUrl, null)
  registerActiveJob(job.fileUrl, optJob.id)
  await updateUploadJob(job.id, { optimizationJobId: optJob.id })

  // Throttled progress mirror: latest snapshot wins, flushed at most once per
  // interval, immediately on phase change.
  let snapshot = { phase: 'waiting' as string, page: 0, totalPages: job.totalPages }
  let lastFlushedPhase = 'waiting'
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    flushTimer = null
    lastFlushedPhase = snapshot.phase
    void updateUploadJob(job.id, {
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
    await new Promise<void>((resolve) => {
      enqueue(optJob.id, job.fileUrl, () =>
        runReportOptimization({
          jobId: optJob.id,
          source,
          fileUrl: job.fileUrl,
          preset: job.preset,
          allowDropBookmarks: opts.allowDropBookmarks === true,
          event: opts.event,
          reportId: null
        }).finally(resolve)
      )
    })
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
