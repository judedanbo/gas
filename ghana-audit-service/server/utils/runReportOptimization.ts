import { statSync } from 'node:fs'
import { persistOptimizationResult } from './persistOptimizationResult'
import type { LocalPdfSource } from './pdfSource'
import { uploadBlobFromFile } from './blobStorage'
import { logAuditActionAs, type AuditActor } from './auditLogger'
import { optimizeReportPdf, PdfOptimizerError, type CompressionPreset } from './pdfOptimizer'
import { pushEvent, updateJob } from './pdfOptimizationJobs'
import { logError } from './logger'

export interface RunReportOptimizationOptions {
  jobId: string
  source: LocalPdfSource
  fileUrl: string
  preset: CompressionPreset
  allowDropBookmarks: boolean
  /** Who started the work — audit-log attribution. */
  actor: AuditActor
  reportId: number | null
  /**
   * Abort to stop early (a background upload handed off at shutdown). The
   * job then ends as error INTERRUPTED and nothing more is written to
   * storage: another server may already be resuming from the stored file.
   */
  signal?: AbortSignal
}

/**
 * Execute one optimization job end to end: run the optimizer, push the
 * optimized bytes back to Blob, persist the result on the report row, and
 * flip the in-process job to its terminal state. Never throws — every error
 * path reports through the job state (safe code only) and the audit log.
 *
 * Shared by the explicit optimize endpoint (edit page "Optimize" button,
 * bookmark-drop retry) and the background upload pipeline, so both surfaces
 * behave identically. Callers own scheduling (pdfOptimizationScheduler).
 */
export async function runReportOptimization(opts: RunReportOptimizationOptions): Promise<void> {
  const { jobId, source, fileUrl, preset, allowDropBookmarks, actor, reportId, signal } = opts
  const { path: pdfPath, blobKey } = source
  updateJob(jobId, { status: 'running' })
  try {
    // Aborted while it waited for a scheduler slot.
    signal?.throwIfAborted()
    const result = await optimizeReportPdf(pdfPath, {
      preset,
      allowDropBookmarks,
      signal,
      onProgress: (e) => pushEvent(jobId, e)
    })

    // Blob-backed file: pdfPath is a temp download, so push the optimized
    // bytes back to the same key. Must happen before the DB fileSize update
    // and the success event — if the upload fails, Blob still holds the
    // original and the error path reports honestly. Streamed from disk in
    // blocks rather than read into a Buffer: PDFs run to 100MB and the pod
    // memory limit is 512Mi.
    if (blobKey && !result.skippedCompression) {
      signal?.throwIfAborted()
      await uploadBlobFromFile(blobKey, pdfPath, 'application/pdf')
    }

    // Persist size + optimization metadata on the report row — by reportId
    // for the edit flow, by fileUrl for a create-flow report that was saved
    // while the job ran. (An unsaved create form instead carries the result
    // via the modal's update:optimization emit / the upload job row.)
    await persistOptimizationResult(fileUrl, reportId, preset, result)

    updateJob(jobId, { status: 'success', result })
    // Emit a terminal 'done' event so SSE subscribers that connected while the
    // job was still running are notified of completion.
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

    void logAuditActionAs(actor, 'update', 'report_optimization', reportId, {
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
    // An abort is not a failure of the file — whatever the optimizer threw on
    // its way out, report it as the interruption it is.
    const interrupted = signal?.aborted === true
    if (!interrupted) logError('pdfOptimizer', err)
    const errorCode = interrupted
      ? 'INTERRUPTED'
      : err instanceof PdfOptimizerError
        ? err.code
        : 'UNKNOWN'
    const message =
      interrupted || err instanceof PdfOptimizerError ? errorCode : 'Optimization failed'

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

    void logAuditActionAs(actor, 'update', 'report_optimization', reportId, {
      after: { fileUrl, preset, error: message }
    })
  } finally {
    await source.cleanup()
  }
}
