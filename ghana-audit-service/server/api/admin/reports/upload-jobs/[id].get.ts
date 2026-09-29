import { eq, and } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'
import { requirePermission } from '../../../../utils/adminHelpers'
import {
  getUploadJob,
  toUploadJobDTO,
  type ReportUploadJobDTO
} from '../../../../utils/reportUploadJobs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Single upload job, for the modal / create page to follow one job. */
export default defineEventHandler(async (event): Promise<ReportUploadJobDTO> => {
  requirePermission(event, 'read')

  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid job id' })
  }

  const job = await getUploadJob(id)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Upload job not found' })
  }

  const db = getDatabase()
  const [user] = job.userId
    ? await db
        .select({ name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.id, job.userId))
        .limit(1)
    : []
  const [report] = job.reportId
    ? await db
        .select({ title: schema.auditReportTranslations.title })
        .from(schema.auditReportTranslations)
        .where(
          and(
            eq(schema.auditReportTranslations.auditReportId, job.reportId),
            eq(schema.auditReportTranslations.locale, 'en')
          )
        )
        .limit(1)
    : []

  return toUploadJobDTO(job, { userName: user?.name ?? null, reportTitle: report?.title ?? null })
})
