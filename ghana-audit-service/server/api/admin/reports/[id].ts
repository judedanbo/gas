import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { auditReportSchema, validateBody, createValidationError } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid ID'
    })
  }

  if (method === 'GET') {
    return handleGet(event, id)
  } else if (method === 'PUT') {
    return handleUpdate(event, id)
  } else if (method === 'DELETE') {
    return handleDelete(event, id)
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method Not Allowed'
  })
})

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')

  const db = getDatabase()

  // Build conditions - admins can see deleted items
  const conditions = [eq(schema.auditReports.id, id)]
  if (!isAdmin(event)) {
    conditions.push(isNull(schema.auditReports.deletedAt))
  }

  const [report] = await db
    .select()
    .from(schema.auditReports)
    .where(and(...conditions))
    .limit(1)

  if (!report) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Report not found'
    })
  }

  // Fetch translations
  const translations = await db
    .select()
    .from(schema.auditReportTranslations)
    .where(eq(schema.auditReportTranslations.auditReportId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, summary: t.summary }
      return acc
    },
    {} as Record<string, { title: string; summary: string | null }>
  )

  return {
    ...report,
    translations: translationsMap
  }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const db = getDatabase()

  // Fetch existing report
  const [existingReport] = await db
    .select()
    .from(schema.auditReports)
    .where(and(eq(schema.auditReports.id, id), isNull(schema.auditReports.deletedAt)))
    .limit(1)

  if (!existingReport) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Report not found'
    })
  }

  // Fetch existing translations
  const existingTranslations = await db
    .select()
    .from(schema.auditReportTranslations)
    .where(eq(schema.auditReportTranslations.auditReportId, id))

  const existingTranslationsMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, summary: t.summary }
      return acc
    },
    {} as Record<string, { id: number; title: string; summary: string | null }>
  )

  // Validate input
  const input = validateBody(auditReportSchema, body)

  // Check for duplicate slug (excluding current report)
  if (input.slug !== existingReport.slug) {
    const [duplicate] = await db
      .select({ id: schema.auditReports.id })
      .from(schema.auditReports)
      .where(eq(schema.auditReports.slug, input.slug))
      .limit(1)

    if (duplicate) {
      throw createValidationError({ slug: 'A report with this slug already exists' })
    }
  }

  // Update report and translations in a transaction
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // Update main report
    await connection.execute(
      `UPDATE audit_reports
       SET slug = ?, category = ?, published_at = ?, year = ?, file_url = ?, file_size = ?,
           thumbnail = ?, is_published = ?, updated_by = ?
       WHERE id = ?`,
      [
        input.slug,
        input.category,
        new Date(input.publishedAt),
        input.year,
        input.fileUrl,
        input.fileSize,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        id
      ]
    )

    // Upsert translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existing = existingTranslationsMap[locale]
        if (existing) {
          // Update existing translation
          await connection.execute(
            `UPDATE audit_report_translations SET title = ?, summary = ? WHERE id = ?`,
            [trans.title, trans.summary || null, existing.id]
          )
        } else {
          // Insert new translation
          await connection.execute(
            `INSERT INTO audit_report_translations (audit_report_id, locale, title, summary)
             VALUES (?, ?, ?, ?)`,
            [id, locale, trans.title, trans.summary || null]
          )
        }
      }
    }

    await connection.commit()

    // Fetch updated report
    const [updatedReport] = await db
      .select()
      .from(schema.auditReports)
      .where(eq(schema.auditReports.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.auditReportTranslations)
      .where(eq(schema.auditReportTranslations.auditReportId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, summary: t.summary }
        return acc
      },
      {} as Record<string, { title: string; summary: string | null }>
    )

    // Log audit action with changes
    const before = sanitizeForAudit({
      ...existingReport,
      translations: Object.fromEntries(
        Object.entries(existingTranslationsMap).map(([k, v]) => [k, { title: v.title, summary: v.summary }])
      )
    })
    const after = sanitizeForAudit({ ...updatedReport, translations: translationsMap })
    const changes = createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)

    await logAuditAction(event, 'update', 'audit_report', id, changes)

    return {
      ...updatedReport,
      translations: translationsMap
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')

  const db = getDatabase()

  // Fetch existing report
  const [existingReport] = await db
    .select()
    .from(schema.auditReports)
    .where(and(eq(schema.auditReports.id, id), isNull(schema.auditReports.deletedAt)))
    .limit(1)

  if (!existingReport) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Report not found'
    })
  }

  // Soft delete
  await db
    .update(schema.auditReports)
    .set({ deletedAt: new Date() })
    .where(eq(schema.auditReports.id, id))

  // Log audit action
  await logAuditAction(event, 'delete', 'audit_report', id, {
    before: sanitizeForAudit(existingReport as Record<string, unknown>)
  })

  return {
    success: true,
    message: 'Report deleted successfully'
  }
}
