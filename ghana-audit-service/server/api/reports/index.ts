import type { AuditReport, AuditCategory, PaginatedResponse } from '~/types'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { buildPaginationMeta } from '../../utils/adminHelpers'
import { transformReports } from '../../utils/transformReport'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<PaginatedResponse<AuditReport>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Parse pagination (use defaults suitable for public API)
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 10))
  const offset = (page - 1) * perPage

  // Build where conditions - only published, non-deleted reports
  const conditions = [
    eq(schema.auditReports.isPublished, true),
    isNull(schema.auditReports.deletedAt)
  ]

  // Filter by category
  if (query.category && typeof query.category === 'string') {
    const validCategories: AuditCategory[] = [
      'financial',
      'compliance',
      'it',
      'performance',
      'technical',
      'follow-up',
      'special'
    ]
    if (validCategories.includes(query.category as AuditCategory)) {
      conditions.push(eq(schema.auditReports.category, query.category as AuditCategory))
    }
  }

  // Filter by year
  if (query.year) {
    conditions.push(eq(schema.auditReports.year, Number(query.year)))
  }

  const whereClause = and(...conditions)

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(whereClause)

  // Fetch reports
  const reports = await db
    .select()
    .from(schema.auditReports)
    .where(whereClause)
    .orderBy(desc(schema.auditReports.publishedAt))
    .limit(perPage)
    .offset(offset)

  // Fetch translations for each report
  const reportIds = reports.map((r) => r.id)
  const translations =
    reportIds.length > 0
      ? await db
          .select()
          .from(schema.auditReportTranslations)
          .where(
            sql`${schema.auditReportTranslations.auditReportId} IN (${sql.join(reportIds, sql`, `)})`
          )
      : []

  // Group translations by report
  const translationsByReport = translations.reduce(
    (acc, t) => {
      if (!acc[t.auditReportId]) {
        acc[t.auditReportId] = {}
      }
      acc[t.auditReportId][t.locale] = {
        title: t.title,
        summary: t.summary
      }
      return acc
    },
    {} as Record<number, Record<string, { title: string; summary: string | null }>>
  )

  // Combine reports with translations
  const reportsWithTranslations = reports.map((report) => ({
    ...report,
    translations: translationsByReport[report.id] || {}
  }))

  // Apply search filter (after combining with translations for title/summary search)
  let filteredReports = reportsWithTranslations
  if (query.search && typeof query.search === 'string') {
    const searchTerm = query.search.toLowerCase()
    filteredReports = reportsWithTranslations.filter((r) => {
      const translation = r.translations[locale] || r.translations.en || {}
      const title = (translation.title || '').toLowerCase()
      const summary = (translation.summary || '').toLowerCase()
      return title.includes(searchTerm) || summary.includes(searchTerm)
    })
  }

  // Transform to public format
  const data = transformReports(filteredReports, locale)

  // Adjust count for search filter
  const total = query.search ? filteredReports.length : Number(count)

  return {
    data,
    meta: buildPaginationMeta(total, page, perPage)
  }
})
