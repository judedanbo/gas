import type { AuditReport, AuditCategory, PaginatedResponse } from '~/types'
import { eq, and, isNull, sql, desc, like, or, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { buildPaginationMeta } from '../../utils/adminHelpers'
import { transformReports } from '../../utils/transformReport'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<PaginatedResponse<AuditReport>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 10))
  const offset = (page - 1) * perPage

  const conditions = [
    eq(schema.auditReports.isPublished, true),
    isNull(schema.auditReports.deletedAt)
  ]

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

  if (query.year) {
    conditions.push(sql`YEAR(${schema.auditReports.publishedAt}) = ${Number(query.year)}`)
  }

  // Search against translations at the DB level so it covers ALL reports, not just the current page
  if (query.search && typeof query.search === 'string') {
    const searchPattern = `%${query.search}%`
    const matchingIds = await db
      .selectDistinct({ id: schema.auditReportTranslations.auditReportId })
      .from(schema.auditReportTranslations)
      .where(
        or(
          like(schema.auditReportTranslations.title, searchPattern),
          like(schema.auditReportTranslations.summary, searchPattern)
        )
      )

    const ids = matchingIds.map((r) => r.id)
    if (ids.length === 0) {
      return { data: [], meta: buildPaginationMeta(0, page, perPage) }
    }
    conditions.push(inArray(schema.auditReports.id, ids))
  }

  const whereClause = and(...conditions)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(whereClause)

  const reports = await db
    .select()
    .from(schema.auditReports)
    .where(whereClause)
    .orderBy(desc(schema.auditReports.publishedAt))
    .limit(perPage)
    .offset(offset)

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

  const reportsWithTranslations = reports.map((report) => ({
    ...report,
    translations: translationsByReport[report.id] || {}
  }))

  const data = transformReports(reportsWithTranslations, locale)

  return {
    data,
    meta: buildPaginationMeta(Number(count), page, perPage)
  }
})
