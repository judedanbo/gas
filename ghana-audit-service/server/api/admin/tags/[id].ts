import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { tagSchema, validateBody, createValidationError } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  const db = getDatabase()

  const [tag] = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1)

  if (!tag)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Tag not found' })

  return tag
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Tag not found' })

  const input = validateBody(tagSchema, body)

  // Check for duplicate name (excluding current)
  if (input.name !== existing.name) {
    const [duplicate] = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(eq(schema.tags.name, input.name))
      .limit(1)
    if (duplicate) throw createValidationError({ name: 'Tag name already exists' })
  }

  // Check for duplicate slug (excluding current)
  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(eq(schema.tags.slug, input.slug))
      .limit(1)
    if (duplicate) throw createValidationError({ slug: 'Tag slug already exists' })
  }

  await db
    .update(schema.tags)
    .set({ name: input.name, slug: input.slug })
    .where(eq(schema.tags.id, id))

  const [updated] = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1)

  const before = sanitizeForAudit(existing as Record<string, unknown>)
  const after = sanitizeForAudit(updated as Record<string, unknown>)
  await logAuditAction(event, 'update', 'tag', id, createChangesObject(before, after))

  return updated
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db.select().from(schema.tags).where(eq(schema.tags.id, id)).limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Tag not found' })

  // Delete tag associations first, then tag
  await db.delete(schema.newsArticleTags).where(eq(schema.newsArticleTags.tagId, id))
  await db.delete(schema.tags).where(eq(schema.tags.id, id))

  await logAuditAction(event, 'delete', 'tag', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Tag deleted successfully' }
}
