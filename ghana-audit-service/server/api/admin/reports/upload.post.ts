import { unlink } from 'node:fs/promises'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import {
  receiveMultipartFile,
  uploadConfigs,
  generateFilename,
  uploadUrlFor
} from '../../../utils/fileUpload'
import { logAuditAction } from '../../../utils/auditLogger'
import { internalError } from '../../../utils/errors'
import type { CompressionPreset } from '../../../utils/pdfOptimizer'
import { createUploadJob, toUploadJobDTO } from '../../../utils/reportUploadJobs'
import { startReportUploadPipeline } from '../../../utils/reportUploadPipeline'

const ALLOWED_PRESETS: CompressionPreset[] = ['screen', 'ebook', 'printer']

/**
 * Background A-G report upload.
 *
 * The request only lasts as long as the byte transfer: the PDF is streamed
 * to a spool file, a persistent job row is created, and the response
 * carries the job id plus the final fileUrl straight away. Storing to Blob,
 * thumbnailing and optimization then run detached (reportUploadPipeline.ts)
 * and the admin UI polls /api/admin/reports/upload-jobs for progress —
 * across tabs, logins and sessions.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')
  const user = getCurrentUser(event)

  const query = getQuery(event)
  const preset: CompressionPreset =
    typeof query.preset === 'string' && ALLOWED_PRESETS.includes(query.preset as CompressionPreset)
      ? (query.preset as CompressionPreset)
      : 'ebook'
  const allowDropBookmarks = query.allowDropBookmarks === 'true'

  const config = uploadConfigs.report
  const req = event.node.req
  // Rejects with a client-facing 4xx (and removes its spool file) on a
  // missing, oversize, non-PDF or malformed upload.
  const received = await receiveMultipartFile(req, req.headers, config)

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
      preset
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

  startReportUploadPipeline(job.id, received.tempPath, { preset, allowDropBookmarks, event })

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
})
