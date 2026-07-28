import type { H3Event } from 'h3'
import type { AnyColumn } from 'drizzle-orm'
import { eq, and, isNull, sql, desc, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { auditReportSchema, validateBody, createValidationError } from '../../../utils/validation'
import { fileSizeToBytes } from '../../../utils/fileSize'
import { resolvePublicAsset } from '../../../utils/publicFiles'
import { generateThumbnailFromPdf } from '../../../utils/generateThumbnail'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    return handleList(event)
  } else if (method === 'POST') {
    return handleCreate(event)
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method Not Allowed'
  })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  // Sort parameters
  const sortColumnMap: Record<string, AnyColumn> = {
    publishedAt: schema.auditReports.publishedAt,
    category: schema.auditReports.category,
    isPublished: schema.auditReports.isPublished,
    fileSize: schema.auditReports.fileSize
  }

  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : null
  const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
  const sortByTitle = sortBy === 'translations.en.title'

  // Build where conditions
  const conditions = []

  // Filter by deleted status (only admins can see deleted)
  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.auditReports.deletedAt))
  }

  // Filter by category
  if (query.category && typeof query.category === 'string') {
    conditions.push(
      eq(schema.auditReports.category, query.category as typeof schema.auditReports.category._.data)
    )
  }

  // Filter by year (derived from publishedAt)
  if (query.year) {
    conditions.push(sql`YEAR(${schema.auditReports.publishedAt}) = ${Number(query.year)}`)
  }

  // Filter by published status
  if (query.isPublished === 'true') {
    conditions.push(eq(schema.auditReports.isPublished, true))
  } else if (query.isPublished === 'false') {
    conditions.push(eq(schema.auditReports.isPublished, false))
  }

  // Search in translations via subquery
  if (query.search && typeof query.search === 'string') {
    const searchTerm = `%${query.search}%`
    conditions.push(
      sql`${schema.auditReports.id} IN (
        SELECT ${schema.auditReportTranslations.auditReportId}
        FROM ${schema.auditReportTranslations}
        WHERE ${schema.auditReportTranslations.title} LIKE ${searchTerm}
           OR ${schema.auditReportTranslations.summary} LIKE ${searchTerm}
      )`
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(whereClause)

  // Count published
  const [{ publishedCount }] = await db
    .select({ publishedCount: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(
      and(...(conditions.length > 0 ? conditions : []), eq(schema.auditReports.isPublished, true))
    )

  // Count drafts
  const [{ draftCount }] = await db
    .select({ draftCount: sql<number>`count(*)` })
    .from(schema.auditReports)
    .where(
      and(...(conditions.length > 0 ? conditions : []), eq(schema.auditReports.isPublished, false))
    )

  // Fetch reports — with optional title sort via join
  let reportRows
  if (sortByTitle) {
    const reports = await db
      .select({ report: schema.auditReports })
      .from(schema.auditReports)
      .leftJoin(
        schema.auditReportTranslations,
        and(
          eq(schema.auditReportTranslations.auditReportId, schema.auditReports.id),
          eq(schema.auditReportTranslations.locale, 'en')
        )
      )
      .where(whereClause)
      .orderBy(
        sortDir === 'asc'
          ? asc(schema.auditReportTranslations.title)
          : desc(schema.auditReportTranslations.title)
      )
      .limit(perPage)
      .offset(offset)

    reportRows = reports.map((r) => r.report)
  } else {
    const sortColumn =
      sortBy && sortColumnMap[sortBy] ? sortColumnMap[sortBy] : schema.auditReports.publishedAt
    const orderFn = sortDir === 'asc' ? asc : desc

    reportRows = await db
      .select()
      .from(schema.auditReports)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(perPage)
      .offset(offset)
  }

  // Fetch translations for each report
  const reportIds = reportRows.map((r) => r.id)
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
  const data = reportRows.map((report) => ({
    ...report,
    fileSize: fileSizeToBytes(report.fileSize),
    translations: translationsByReport[report.id] || {}
  }))

  return {
    data,
    meta: buildPaginationMeta(Number(count), page, perPage),
    counts: {
      total: Number(count),
      published: Number(publishedCount),
      drafts: Number(draftCount)
    }
  }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)

  // Validate input
  const input = validateBody(auditReportSchema, body)
  const db = getDatabase()

  // Check for duplicate slug
  const [existing] = await db
    .select({ id: schema.auditReports.id })
    .from(schema.auditReports)
    .where(eq(schema.auditReports.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A report with this slug already exists' })
  }

  // Auto-generate thumbnail from PDF if none was provided
  let thumbnail = input.thumbnail || null
  if (!thumbnail && input.fileUrl) {
    const pdfPath = resolvePublicAsset(input.fileUrl)
    if (pdfPath) {
      thumbnail = generateThumbnailFromPdf(pdfPath)
    }
  }

  // Insert report and translations in a transaction
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // Insert main report
    const [result] = await connection.execute(
      `INSERT INTO audit_reports (slug, category, published_at, file_url, file_size, thumbnail, is_published, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.category,
        new Date(input.publishedAt),
        input.fileUrl,
        input.fileSize,
        thumbnail,
        input.isPublished,
        user.id,
        user.id
      ]
    )

    const reportId = (result as { insertId: number }).insertId

    // Insert translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO audit_report_translations (audit_report_id, locale, title, summary)
           VALUES (?, ?, ?, ?)`,
          [reportId, locale, trans.title, trans.summary || null]
        )
      }
    }

    await connection.commit()

    // Fetch the created report
    const [report] = await db
      .select()
      .from(schema.auditReports)
      .where(eq(schema.auditReports.id, reportId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.auditReportTranslations)
      .where(eq(schema.auditReportTranslations.auditReportId, reportId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, summary: t.summary }
        return acc
      },
      {} as Record<string, { title: string; summary: string | null }>
    )

    // Log audit action
    await logAuditAction(event, 'create', 'audit_report', reportId, {
      after: sanitizeForAudit({ ...report, translations: translationsMap })
    })

    return {
      ...report,
      fileSize: fileSizeToBytes(report.fileSize),
      translations: translationsMap
    }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:reports', error)
  } finally {
    connection.release()
  }
}
