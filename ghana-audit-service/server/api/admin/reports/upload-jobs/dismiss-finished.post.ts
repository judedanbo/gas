import { getCurrentUser, requirePermission } from '../../../../utils/adminHelpers'
import { dismissFinishedUploadJobs } from '../../../../utils/reportUploadJobs'

/**
 * "Clear all" in the notification center: acknowledge every finished upload
 * the caller started. Uploads still running stay listed.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'create')
  const user = getCurrentUser(event)

  const dismissed = await dismissFinishedUploadJobs(user.id)
  return { success: true, dismissed }
})
