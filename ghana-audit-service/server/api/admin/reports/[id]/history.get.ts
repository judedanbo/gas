import { eq, and, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../../database'
import { requirePermission } from '../../../../utils/adminHelpers'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid ID'
    })
  }

  const db = getDatabase()

  const logs = await db
    .select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      changes: schema.auditLogs.changes,
      createdAt: schema.auditLogs.createdAt,
      userId: schema.auditLogs.userId,
      userName: schema.users.name
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .where(
      and(
        eq(schema.auditLogs.entityType, 'audit_report'),
        eq(schema.auditLogs.entityId, id)
      )
    )
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(20)

  return {
    data: logs.map((log) => ({
      id: log.id,
      action: log.action,
      userName: log.userName || 'System',
      changes: log.changes,
      createdAt: log.createdAt
    }))
  }
})
