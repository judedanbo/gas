import { and, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction } from '../../../utils/auditLogger'
import { validateBody } from '../../../utils/validation'

const bulkActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive', 'delete']),
  ids: z.array(z.number().int().positive()).min(1).max(50)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { action, ids } = validateBody(bulkActionSchema, body)

  const needsDelete = action === 'archive' || action === 'delete'
  requirePermission(event, needsDelete ? 'delete' : 'update')

  const user = getCurrentUser(event)
  const db = getDatabase()

  const existingReports = await db
    .select({ id: schema.auditReports.id })
    .from(schema.auditReports)
    .where(
      and(
        sql`${schema.auditReports.id} IN (${sql.join(ids, sql`, `)})`,
        isNull(schema.auditReports.deletedAt)
      )
    )

  const validIds = existingReports.map(r => r.id)
  if (validIds.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'No valid reports found for the given IDs'
    })
  }

  const whereIds = sql`${schema.auditReports.id} IN (${sql.join(validIds, sql`, `)})`
  const now = new Date()

  if (action === 'publish') {
    await db
      .update(schema.auditReports)
      .set({ isPublished: true, updatedBy: user.id })
      .where(whereIds)
  } else if (action === 'unpublish') {
    await db
      .update(schema.auditReports)
      .set({ isPublished: false, updatedBy: user.id })
      .where(whereIds)
  } else {
    // archive and delete both soft-delete
    await db
      .update(schema.auditReports)
      .set({ deletedAt: now, updatedBy: user.id })
      .where(whereIds)
  }

  for (const id of validIds) {
    await logAuditAction(event, action === 'archive' || action === 'delete' ? 'delete' : 'update', 'audit_report', id, {
      action,
      bulkOperation: true
    })
  }

  return { success: true, affected: validIds.length }
})
