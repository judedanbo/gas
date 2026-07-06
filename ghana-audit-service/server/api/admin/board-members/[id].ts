import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { boardMemberSchema, validateBody, createValidationError } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

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

  const conditions = [eq(schema.boardMembers.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.boardMembers.deletedAt))

  const [member] = await db
    .select()
    .from(schema.boardMembers)
    .where(and(...conditions))
    .limit(1)

  if (!member)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Board member not found'
    })

  return member
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.boardMembers)
    .where(and(eq(schema.boardMembers.id, id), isNull(schema.boardMembers.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Board member not found'
    })

  const input = validateBody(boardMemberSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.boardMembers.id })
      .from(schema.boardMembers)
      .where(eq(schema.boardMembers.slug, input.slug))
      .limit(1)

    if (duplicate) throw createValidationError({ slug: 'Slug already exists' })
  }

  try {
    await db
      .update(schema.boardMembers)
      .set({
        slug: input.slug,
        role: input.role,
        name: input.name,
        title: input.title || null,
        bio: input.bio || null,
        photo: input.photo || null,
        email: input.email || null,
        phone: input.phone || null,
        displayOrder: input.displayOrder,
        isActive: input.isActive
      })
      .where(eq(schema.boardMembers.id, id))

    const [updated] = await db
      .select()
      .from(schema.boardMembers)
      .where(eq(schema.boardMembers.id, id))
      .limit(1)

    const before = sanitizeForAudit(existing as Record<string, unknown>)
    const after = sanitizeForAudit(updated as Record<string, unknown>)
    await logAuditAction(
      event,
      'update',
      'board_members',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return updated
  } catch (error) {
    throw safeError('admin:board-members', error)
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.boardMembers)
    .where(and(eq(schema.boardMembers.id, id), isNull(schema.boardMembers.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Board member not found'
    })

  await db
    .update(schema.boardMembers)
    .set({ deletedAt: new Date() })
    .where(eq(schema.boardMembers.id, id))

  await logAuditAction(event, 'delete', 'board_members', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Board member deleted successfully' }
}
