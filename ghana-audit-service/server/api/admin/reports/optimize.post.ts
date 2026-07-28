import { statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'
import { materializePdfSource, type LocalPdfSource } from '../../../utils/pdfSource'
import { uploadBlob } from '../../../utils/blobStorage'
import { logAuditAction } from '../../../utils/auditLogger'
import {
  optimizeReportPdf,
  PdfOptimizerError,
  type CompressionPreset
} from '../../../utils/pdfOptimizer'
import { createJob, pushEvent, updateJob } from '../../../utils/pdfOptimizationJobs'
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

  const source = await materializePdfSource(fileUrl)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'PDF file not found in storage' })
  }

  const job = createJob(fileUrl, reportId)

  // Run the optimizer detached from the request lifetime. The SSE endpoint
  // (optimize-stream.get.ts) streams the job's events to the admin UI.
  void runOptimization(job.id, source, preset, allowDropBookmarks, event, reportId)

  // Mint a short-lived SSE ticket so the EventSource auth travels as a ~2min
  // aud-scoped ticket rather than the long-lived session JWT in the URL.
  const auth = event.context.auth!
  const sseTicket = signSseTicket({ userId: auth.user.id, sid: auth.sessionId })

  return { jobId: job.id, sseTicket }
})

async function runOptimization(
  jobId: string,
  source: LocalPdfSource,
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

    // Persist the new file size when the optimization is tied to a saved
    // report row. For the unsaved create flow (no reportId yet), the UI
    // reads the new size from the SSE 'done' event.
    if (reportId && !result.skippedCompression) {
      try {
        const db = getDatabase()
        await db
          .update(schema.auditReports)
          .set({ fileSize: String(result.optimizedSize) })
          .where(eq(schema.auditReports.id, reportId))
      } catch (dbErr) {
        logError('pdfOptimizer', dbErr)
      }
    }

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
      scannedPages: result.scannedPages
    })

    void logAuditAction(event, 'update', 'report_optimization', reportId, {
      after: {
        fileUrl: pdfPath,
        preset,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
        savedBytes: result.savedBytes,
        nativePages: result.nativePages,
        scannedPages: result.scannedPages,
        skippedCompression: result.skippedCompression
      }
    })
  } catch (err) {
    // Log the full error server-side, but only surface a safe summary to the
    // admin client. PdfOptimizerError.code is a fixed enum (no internals); the
    // free-form message can contain file paths, so it is not sent to the client.
    logError('pdfOptimizer', err)
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

    updateJob(jobId, { status: 'error', error: message })
    pushEvent(jobId, {
      phase: 'done',
      originalSize: currentSize ?? 0,
      optimizedSize: currentSize ?? 0,
      savedBytes: 0,
      skippedCompression: true,
      nativePages: 0,
      scannedPages: 0
    })

    void logAuditAction(event, 'update', 'report_optimization', reportId, {
      after: { fileUrl: pdfPath, preset, error: message }
    })
  } finally {
    await source.cleanup()
  }
}
