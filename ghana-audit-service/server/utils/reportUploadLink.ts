import type { ReportOptimizationMeta } from '../database/schema/audit-reports'
import {
  applyUploadJobToReport,
  findUploadJobByFileUrl,
  getUploadJob,
  isActiveUploadStatus,
  linkUploadJobToReport,
  effectiveUploadJob
} from './reportUploadJobs'

/**
 * What a report save can take from its background upload job right now.
 * `pending` means the job is still running and will patch the row itself
 * once it is linked — so the save should not do slow synchronous work
 * (thumbnail generation) the pipeline is already doing.
 */
export interface UploadJobSaveInputs {
  pending: boolean
  thumbnailUrl: string | null
  finalSize: number | null
  optimizedAt: Date | null
  optimizationMeta: ReportOptimizationMeta | null
}

const NONE: UploadJobSaveInputs = {
  pending: false,
  thumbnailUrl: null,
  finalSize: null,
  optimizedAt: null,
  optimizationMeta: null
}

/**
 * Look up the upload job for the file being saved — by the id the form sent,
 * falling back to the most recent job for the fileUrl (a form restored from
 * a notification, or a client that pre-dates uploadJobId). A job whose file
 * is not the one being saved is ignored.
 */
export async function resolveUploadJobForSave(
  uploadJobId: string | null | undefined,
  fileUrl: string
): Promise<UploadJobSaveInputs> {
  if (!fileUrl) return NONE
  let job = uploadJobId ? await getUploadJob(uploadJobId) : undefined
  if (!job || job.fileUrl !== fileUrl) {
    job = fileUrl.startsWith('/pdf/reports/') ? await findUploadJobByFileUrl(fileUrl) : undefined
  }
  if (!job) return NONE
  const effective = effectiveUploadJob(job)
  const completed = effective.status === 'completed'
  return {
    pending: isActiveUploadStatus(effective.status),
    thumbnailUrl: job.thumbnailUrl ?? null,
    finalSize: completed ? (job.finalSize ?? null) : null,
    optimizedAt:
      completed && job.optimizationStatus === 'success' ? (job.completedAt ?? null) : null,
    optimizationMeta:
      completed && job.optimizationStatus === 'success' ? (job.optimizationResult ?? null) : null
  }
}

/**
 * After the row is committed: attach it to the job and, if the job already
 * finished, apply the job's outputs (idempotent with the pipeline's own
 * finalization — see applyUploadJobToReport).
 */
export async function linkSavedReportToUploadJob(
  uploadJobId: string | null | undefined,
  reportId: number,
  fileUrl: string
): Promise<void> {
  if (!fileUrl) return
  let jobId = uploadJobId ?? null
  if (!jobId && fileUrl.startsWith('/pdf/reports/')) {
    jobId = (await findUploadJobByFileUrl(fileUrl))?.id ?? null
  }
  if (!jobId) return
  const job = await linkUploadJobToReport(jobId, reportId, fileUrl)
  if (job && job.status === 'completed') {
    await applyUploadJobToReport(job)
  }
}
