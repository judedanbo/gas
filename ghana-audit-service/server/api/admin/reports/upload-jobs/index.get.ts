import { getCurrentUser, requirePermission } from '../../../../utils/adminHelpers'
import {
  listUploadJobs,
  toUploadJobDTO,
  type ReportUploadJobDTO
} from '../../../../utils/reportUploadJobs'

export interface UploadJobsListResponse {
  data: ReportUploadJobDTO[]
  activeCount: number
}

/**
 * Polling endpoint: every in-flight report upload plus recent finished ones
 * (undismissed, last `sinceHours`, default 24). `mine=true` narrows it to the
 * caller's own uploads — the admin notification center's feed. Reads the
 * persistent job table, so it answers from any replica and after re-login.
 */
export default defineEventHandler(async (event): Promise<UploadJobsListResponse> => {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const activeOnly = query.active === 'true'
  const includeDismissed = query.includeDismissed === 'true'
  const userId = query.mine === 'true' ? getCurrentUser(event).id : undefined
  const limitRaw = Number(query.limit)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50
  const sinceHoursRaw = Number(query.sinceHours)
  const sinceHours =
    Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? Math.min(sinceHoursRaw, 24 * 14) : 24

  const rows = await listUploadJobs({
    activeOnly,
    includeDismissed,
    userId,
    limit,
    since: new Date(Date.now() - sinceHours * 60 * 60_000)
  })

  const now = Date.now()
  const data = rows.map((row) =>
    toUploadJobDTO(row, { reportTitle: row.reportTitle, userName: row.userName }, now)
  )

  return {
    data,
    activeCount: data.filter((job) => job.active).length
  }
})
