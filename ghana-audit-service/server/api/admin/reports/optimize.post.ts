import { statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { requirePermission } from '../../../utils/adminHelpers'
import { persistOptimizationResult } from '../../../utils/persistOptimizationResult'
import { materializePdfSource, type LocalPdfSource } from '../../../utils/pdfSource'
import { uploadBlob } from '../../../utils/blobStorage'
import { logAuditAction } from '../../../utils/auditLogger'
import {
  optimizeReportPdf,
  PdfOptimizerError,
  type CompressionPreset
} from '../../../utils/pdfOptimizer'
import { createJob, pushEvent, updateJob } from '../../../utils/pdfOptimizationJobs'
import {
  enqueue,
  getActiveJobForFile,
  getActiveJobIdLocal,
  registerActiveJob
} from '../../../utils/pdfOptimizationScheduler'
import { signSseTicket } from '../../../utils/sseTicket'
import { logError } from '../../../utils/logger'

const ALLOWED_PRESETS: CompressionPreset[] = ['screen', 'ebook', 'printer']

interface OptimizeBody {
  fileUrl?: string
  preset?: CompressionPreset
  reportId?: number
  allowDropBookmarks?: boolean
}

export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')

  const body = await readBody<OptimizeBody>(event)
  const fileUrl = body?.fileUrl
  const preset: CompressionPreset =
    body?.preset && ALLOWED_PRESETS.includes(body.preset) ? body.preset : 'ebook'
  const reportId = typeof body?.reportId === 'number' ? body.reportId : null
  const allowDropBookmarks = body?.allowDropBookmarks === true

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'fileUrl is required' })
  }

  if (!fileUrl.startsWith('/pdf/reports/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
  }

  // Mint a short-lived SSE ticket so the EventSource auth travels as a ~2min
  // aud-scoped ticket rather than the long-lived session JWT in the URL.
  const auth = event.context.auth!
  const sseTicket = signSseTicket({ userId: auth.user.id, sid: auth.sessionId })

  // Same-file dedup: if an optimization is already queued/running for this
  // file (on any replica), attach the caller to it instead of starting a
  // duplicate — checked before materializing so we don't download a blob
  // just to attach.
  const existingJobId = await getActiveJobForFile(fileUrl)
  if (existingJobId) {
    return { jobId: existingJobId, sseTicket, attached: true }
  }

  const source = await materializePdfSource(fileUrl)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found in storage' })
  }

  // Re-check after the async materialize: a concurrent same-file POST on this
  // pod may have claimed the file meanwhile. From here to registerActiveJob
  // there is no await, so the claim itself is race-free in-process.
  const raceWinner = getActiveJobIdLocal(fileUrl)
  if (raceWinner) {
    await source.cleanup()
    return { jobId: raceWinner, sseTicket, attached: true }
  }

  const job = createJob(fileUrl, reportId)
  registerActiveJob(fileUrl, job.id)

  // Run the optimizer detached from the request lifetime, throttled by the
  // scheduler (bounded concurrency + FIFO queue). The SSE endpoint
  // (optimize-stream.get.ts) streams the job's events to the admin UI.
  enqueue(job.id, fileUrl, () =>
    runOptimization(job.id, source, fileUrl, preset, allowDropBookmarks, event, reportId)
  )

  return { jobId: job.id, sseTicket }
})

async function runOptimization(
  jobId: string,
  source: LocalPdfSource,
  fileUrl: string,
  preset: CompressionPreset,
  allowDropBookmarks: boolean,
  event: Parameters<typeof logAuditAction>[0],
  reportId: number | null
): Promise<void> {
  const { path: pdfPath, blobKey } = source
  updateJob(jobId, { status: 'running' })
  try {
    const result = await optimizeReportPdf(pdfPath, {
      preset,
      allowDropBookmarks,
      onProgress: (e) => pushEvent(jobId, e)
    })

    // Blob-backed file: pdfPath is a temp download, so push the optimized
    // bytes back to the same key. Must happen before the DB fileSize update
    // and the success event — if the upload fails, Blob still holds the
    // original and the error path reports honestly.
    if (blobKey && !result.skippedCompression) {
      await uploadBlob(blobKey, await readFile(pdfPath), 'application/pdf')
    }

    // Persist size + optimization metadata on the report row — by reportId
    // for the edit flow, by fileUrl for a create-flow report that was saved
    // while the job ran. (An unsaved create form instead carries the result
    // via the modal's update:optimization emit.)
    await persistOptimizationResult(fileUrl, reportId, preset, result)

    updateJob(jobId, { status: 'success', result })
    // Emit a terminal 'done' event so SSE subscribers that connected while the
    // job was still running are notified of completion. (Without this, only the
    // error path pushed a terminal event, so successful optimizations left the
    // stream — and the admin UI — hanging at "Optimizing…".)
    pushEvent(jobId, {
      phase: 'done',
      originalSize: result.originalSize,
      optimizedSize: result.optimizedSize,
      savedBytes: result.savedBytes,
      skippedCompression: result.skippedCompression,
      nativePages: result.nativePages,
      scannedPages: result.scannedPages,
      ocrFailedPages: result.ocrFailedPages
    })

    void logAuditAction(event, 'update', 'report_optimization', reportId, {
      after: {
        fileUrl,
        preset,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        savedBytes: result.savedBytes,
        nativePages: result.nativePages,
        scannedPages: result.scannedPages,
        ocrFailedPages: result.ocrFailedPages,
        skippedCompression: result.skippedCompression
      }
    })
  } catch (err) {
    // Log the full error server-side, but only surface a safe summary to the
    // admin client. PdfOptimizerError.code is a fixed enum (no internals); the
    // free-form message can contain file paths, so it is not sent to the client.
    logError('pdfOptimizer', err)
    const errorCode = err instanceof PdfOptimizerError ? err.code : 'UNKNOWN'
    const message = err instanceof PdfOptimizerError ? err.code : 'Optimization failed'

    // The file is left untouched on any error path (the optimizer only
    // renames into place after the optimized variant is fully written and
    // verified). Surface a final stat so the UI can show "original X MB".
    let currentSize: number | undefined
    try {
      currentSize = statSync(pdfPath).size
    } catch {
      currentSize = undefined
    }

    updateJob(jobId, { status: 'error', error: message, errorCode })
    pushEvent(jobId, {
      phase: 'done',
      originalSize: currentSize ?? 0,
      optimizedSize: currentSize ?? 0,
      savedBytes: 0,
      skippedCompression: true,
      nativePages: 0,
      scannedPages: 0,
      ocrFailedPages: 0
    })

    void logAuditAction(event, 'update', 'report_optimization', reportId, {
      after: { fileUrl, preset, error: message }
    })
  } finally {
    await source.cleanup()
  }
}
