import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'
import {
  effectiveJobState,
  getJobAcrossInstances,
  type JobStatus
} from '../../../utils/pdfOptimizationJobs'
import { getActiveJobForFile } from '../../../utils/pdfOptimizationScheduler'
import type { OptimizeResult, ProgressEvent } from '../../../utils/pdfOptimizer'

// Authenticated (Bearer) polling companion to the SSE stream. Lets a client
// resume watching a job it did not start in this tab — by jobId, or by
// reportId/fileUrl lookup for "is anything optimizing this file right now?".
export interface OptimizeStatusResponse {
  active: boolean
  jobId: string | null
  status: JobStatus | null
  fileUrl: string | null
  reportId: number | null
  error: string | null
  errorCode: string | null
  result: OptimizeResult | null
  lastEvent: ProgressEvent | null
  lastSeq: number
  startedAt: number | null
  updatedAt: number | null
}

const INACTIVE: OptimizeStatusResponse = {
  active: false,
  jobId: null,
  status: null,
  fileUrl: null,
  reportId: null,
  error: null,
  errorCode: null,
  result: null,
  lastEvent: null,
  lastSeq: 0,
  startedAt: null,
  updatedAt: null
}

export default defineEventHandler(async (event): Promise<OptimizeStatusResponse> => {
  requirePermission(event, 'update')

  const query = getQuery(event)
  const jobId = typeof query.jobId === 'string' && query.jobId ? query.jobId : null
  const reportId =
    typeof query.reportId === 'string' && query.reportId ? Number(query.reportId) : null
  const fileUrlParam = typeof query.fileUrl === 'string' && query.fileUrl ? query.fileUrl : null

  if (!jobId && reportId === null && !fileUrlParam) {
    throw createError({ statusCode: 400, statusMessage: 'jobId, reportId, or fileUrl is required' })
  }
  if (reportId !== null && !Number.isFinite(reportId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid reportId' })
  }

  let resolvedJobId = jobId
  if (!resolvedJobId) {
    let fileUrl = fileUrlParam
    if (!fileUrl && reportId !== null) {
      const db = getDatabase()
      const [row] = await db
        .select({ fileUrl: schema.auditReports.fileUrl })
        .from(schema.auditReports)
        .where(eq(schema.auditReports.id, reportId))
        .limit(1)
      fileUrl = row?.fileUrl ?? null
    }
    if (fileUrl) {
      if (!fileUrl.startsWith('/pdf/reports/')) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid file path' })
      }
      resolvedJobId = (await getActiveJobForFile(fileUrl)) ?? null
    }
    // Lookup semantics: "nothing is optimizing this file" is a normal answer.
    if (!resolvedJobId) return INACTIVE
  }

  const raw = await getJobAcrossInstances(resolvedJobId)
  if (!raw) {
    // Direct jobId queries expect the job to exist; lookups degrade to
    // inactive (the index can outlive an expired job mirror briefly).
    if (jobId) throw createError({ statusCode: 404, statusMessage: 'Job not found' })
    return INACTIVE
  }

  const state = effectiveJobState(raw)
  const last = state.events.length > 0 ? state.events[state.events.length - 1] : null

  return {
    active: state.status === 'queued' || state.status === 'running',
    jobId: state.id,
    status: state.status,
    fileUrl: state.fileUrl,
    reportId: state.reportId ?? null,
    error: state.error ?? null,
    errorCode: state.errorCode ?? null,
    result: state.result ?? null,
    lastEvent: last?.event ?? null,
    lastSeq: last?.seq ?? 0,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt
  }
})
