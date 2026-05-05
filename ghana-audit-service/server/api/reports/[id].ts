import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformReport } from '../../utils/transformReport'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Report ID is required'
    })
  }

  // Build where conditions - only published, non-deleted reports
  // Allow lookup by numeric ID or slug
  const isNumericId = /^\d+$/.test(id)
  const idCondition = isNumericId
    ? eq(schema.auditReports.id, Number(id))
    : eq(schema.auditReports.slug, id)

  const whereClause = and(
    idCondition,
    eq(schema.auditReports.isPublished, true),
    isNull(schema.auditReports.deletedAt)
  )

  // Fetch the report
  const [report] = await db.select().from(schema.auditReports).where(whereClause).limit(1)

  if (!report) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Report not found'
    })
  }

  // Fetch translations for the report
  const translations = await db
    .select()
    .from(schema.auditReportTranslations)
    .where(eq(schema.auditReportTranslations.auditReportId, report.id))

  // Group translations by locale
  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        title: t.title,
        summary: t.summary
      }
      return acc
    },
    {} as Record<string, { title: string; summary: string | null }>
  )

  // Return transformed report
  return transformReport(
    {
      ...report,
      translations: translationsMap
    },
    locale
  )
})
