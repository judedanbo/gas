import type { H3Event } from 'h3'
import type { AuditAction } from '../../../utils/auditLogger'
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = []

  // Filter by user
  if (query.userId) {
    conditions.push(eq(schema.auditLogs.userId, Number(query.userId)))
  }

  // Filter by action
  if (query.action && typeof query.action === 'string') {
    conditions.push(eq(schema.auditLogs.action, query.action as AuditAction))
  }

  // Filter by entity type
  if (query.entityType && typeof query.entityType === 'string') {
    conditions.push(eq(schema.auditLogs.entityType, query.entityType))
  }

  // Filter by entity ID
  if (query.entityId) {
    conditions.push(eq(schema.auditLogs.entityId, Number(query.entityId)))
  }

  // Filter by date range
  if (query.dateFrom && typeof query.dateFrom === 'string') {
    conditions.push(gte(schema.auditLogs.createdAt, new Date(query.dateFrom)))
  }

  if (query.dateTo && typeof query.dateTo === 'string') {
    conditions.push(lte(schema.auditLogs.createdAt, new Date(query.dateTo)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.auditLogs)
    .where(whereClause)

  const logs = await db
    .select({
      id: schema.auditLogs.id,
      userId: schema.auditLogs.userId,
      action: schema.auditLogs.action,
      entityType: schema.auditLogs.entityType,
      entityId: schema.auditLogs.entityId,
      changes: schema.auditLogs.changes,
      ipAddress: schema.auditLogs.ipAddress,
      userAgent: schema.auditLogs.userAgent,
      createdAt: schema.auditLogs.createdAt,
      userName: schema.users.name,
      userEmail: schema.users.email
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .where(whereClause)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(perPage)
    .offset(offset)

  const data = logs.map((log) => ({
    id: log.id,
    user: log.userId
      ? {
          id: log.userId,
          name: log.userName,
          email: log.userEmail
        }
      : null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    changes: log.changes,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt
  }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}
