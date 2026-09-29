import { requirePermission } from '../../../../../utils/adminHelpers'
import { dismissUploadJob, getUploadJob } from '../../../../../utils/reportUploadJobs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Acknowledge a finished upload so it leaves the dashboard list. */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')

  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid job id' })
  }

  const job = await getUploadJob(id)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Upload job not found' })
  }

  const dismissed = await dismissUploadJob(id)
  if (!dismissed && job.status !== 'completed' && job.status !== 'failed') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: 'An upload that is still running cannot be dismissed'
    })
  }

  return { success: true }
})
