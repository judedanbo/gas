import type { H3Event } from 'h3'
import { eq, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { tagSchema, validateBody, createValidationError } from '../../../utils/validation'

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

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.tags)

  const tags = await db
    .select()
    .from(schema.tags)
    .orderBy(asc(schema.tags.name))
    .limit(perPage)
    .offset(offset)

  return { data: tags, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const body = await readBody(event)
  const input = validateBody(tagSchema, body)
  const db = getDatabase()

  // Check for duplicate name or slug
  const [existingName] = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(eq(schema.tags.name, input.name))
    .limit(1)

  if (existingName) {
    throw createValidationError({ name: 'Tag name already exists' })
  }

  const [existingSlug] = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(eq(schema.tags.slug, input.slug))
    .limit(1)

  if (existingSlug) {
    throw createValidationError({ slug: 'Tag slug already exists' })
  }

  const [result] = await db.insert(schema.tags).values({ name: input.name, slug: input.slug })

  const [tag] = await db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.id, result.insertId))
    .limit(1)

  await logAuditAction(event, 'create', 'tag', result.insertId, {
    after: sanitizeForAudit(tag as Record<string, unknown>)
  })

  return tag
}
