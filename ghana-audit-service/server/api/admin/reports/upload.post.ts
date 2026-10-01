import { unlink } from 'node:fs/promises'
import type { H3Event } from 'h3'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import {
  receiveMultipartFile,
  uploadConfigs,
  generateFilename,
  uploadUrlFor
} from '../../../utils/fileUpload'
import { auditActorFromEvent, logAuditAction } from '../../../utils/auditLogger'
import { internalError } from '../../../utils/errors'
import type { CompressionPreset } from '../../../utils/pdfOptimizer'
import { createUploadJob, toUploadJobDTO } from '../../../utils/reportUploadJobs'
import {
  beginUploadTransfer,
  isAcceptingUploads,
  isPastUploadHandoff,
  startReportUploadPipeline
} from '../../../utils/reportUploadPipeline'

const ALLOWED_PRESETS: CompressionPreset[] = ['screen', 'ebook', 'printer']

/** This pod is shutting down; the retry reaches a live replica. */
function serverRestarting(event: H3Event) {
  setResponseHeader(event, 'Retry-After', 5)
  return createError({
    statusCode: 503,
    statusMessage: 'The server is restarting. Please try the upload again in a moment.'
  })
}

/**
 * Background A-G report upload.
 *
 * The request only lasts as long as the byte transfer: the PDF is streamed
 * to a spool file, a persistent job row is created, and the response
 * carries the job id plus the final fileUrl straight away. Storing to Blob,
 * thumbnailing and optimization then run detached (reportUploadPipeline.ts)
 * and the admin UI polls /api/admin/reports/upload-jobs for progress —
 * across tabs, logins and sessions. If this pod is shut down mid-way, the
 * job is resumed on another one (or, if its bytes never reached storage,
 * failed straight away) — see reportUploadPipeline.ts.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')
  const user = getCurrentUser(event)

  // A pod that is shutting down must not start a transfer it cannot finish.
  if (!isAcceptingUploads()) throw serverRestarting(event)

  const query = getQuery(event)
  const preset: CompressionPreset =
    typeof query.preset === 'string' && ALLOWED_PRESETS.includes(query.preset as CompressionPreset)
      ? (query.preset as CompressionPreset)
      : 'ebook'
  const allowDropBookmarks = query.allowDropBookmarks === 'true'

  const config = uploadConfigs.report
  const req = event.node.req

  // A shutdown that starts while the bytes are still arriving waits for them
  // within its grace period. The pipeline's run registers before this is
  // released, so from then on the shutdown waits for the run instead.
  const endTransfer = beginUploadTransfer()
  try {
    // Rejects with a client-facing 4xx (and removes its spool file) on a
    // missing, oversize, non-PDF or malformed upload.
    const received = await receiveMultipartFile(req, req.headers, config)
    // Landed after this pod handed its uploads off: it would be cut off
    // before reaching storage.
    if (isPastUploadHandoff()) {
      await unlink(received.tempPath).catch(() => {})
      throw serverRestarting(event)
    }

    const filename = generateFilename(received.originalName)
    const url = uploadUrlFor(config, filename)

    let job
    try {
      job = await createUploadJob({
        userId: user.id,
        originalName: received.originalName,
        filename,
        fileUrl: url,
        mimeType: received.mimeType,
        size: received.size,
        preset,
        allowDropBookmarks
      })
    } catch (error) {
      await unlink(received.tempPath).catch(() => {})
      throw internalError('reportUpload', error, 'Upload failed')
    }

    void logAuditAction(event, 'create', 'file_upload', null, {
      after: {
        type: 'report',
        filename,
        originalName: received.originalName,
        size: received.size,
        mimeType: received.mimeType,
        url,
        uploadJobId: job.id,
        preset
      }
    })

    startReportUploadPipeline(job, received.tempPath, { actor: auditActorFromEvent(event) })

    return {
      success: true,
      jobId: job.id,
      url,
      filename,
      originalName: received.originalName,
      size: received.size,
      mimeType: received.mimeType,
      job: toUploadJobDTO(job, { userName: user.name })
    }
  } finally {
    endTransfer()
  }
})
