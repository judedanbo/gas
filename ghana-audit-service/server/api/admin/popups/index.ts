import type { H3Event } from 'h3'
import { and, desc, eq, isNull, like, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import {
  createValidationError,
  popupImageError,
  popupSchema,
  validateBody
} from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)
  if (method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = [isNull(schema.popups.deletedAt)]

  if (query.search && typeof query.search === 'string') {
    const escaped = query.search.replace(/[\\%_]/g, '\\$&')
    conditions.push(like(schema.popups.title, `%${escaped}%`))
  }

  const whereClause = and(...conditions)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.popups)
    .where(whereClause)

  const data = await db
    .select()
    .from(schema.popups)
    .where(whereClause)
    .orderBy(desc(schema.popups.createdAt), desc(schema.popups.id))
    .limit(perPage)
    .offset(offset)

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const input = validateBody(popupSchema, await readBody(event))
  const imageError = popupImageError(input.imageUrl)
  if (imageError) throw createValidationError({ imageUrl: imageError })
  const db = getDatabase()

  try {
    const [result] = await db.insert(schema.popups).values({
      title: input.title,
      imageUrl: input.imageUrl,
      altText: input.altText || null,
      linkUrl: input.linkUrl || null,
      openInNewTab: input.openInNewTab,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      displaySeconds: input.displaySeconds,
      isDismissible: input.isDismissible,
      isActive: input.isActive,
      createdBy: user.id
    })

    const [created] = await db
      .select()
      .from(schema.popups)
      .where(eq(schema.popups.id, result.insertId))
      .limit(1)

    await logAuditAction(event, 'create', 'popup', created.id, {
      after: sanitizeForAudit(created as Record<string, unknown>)
    })

    return created
  } catch (error) {
    throw safeError('admin:popups', error)
  }
}
