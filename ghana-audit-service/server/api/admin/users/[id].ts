import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requireAdmin, getCurrentUser } from '../../../utils/adminHelpers'
import { resolveUserModules } from '../../../utils/modules'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { userUpdateSchema, validateBody, createValidationError } from '../../../utils/validation'
import { hashPassword } from '../../../utils/password'

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
  requireAdmin(event)
  const db = getDatabase()

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      modules: schema.users.modules,
      isActive: schema.users.isActive,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      deletedAt: schema.users.deletedAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)

  if (!user)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })

  return { ...user, modules: resolveUserModules(user.role, user.modules) }
}

async function handleUpdate(event: H3Event, id: number) {
  requireAdmin(event)

  const currentUser = getCurrentUser(event)
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })

  // Prevent self-demotion
  if (id === currentUser.id && body.role && body.role !== 'admin') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Cannot demote yourself'
    })
  }

  const input = validateBody(userUpdateSchema, body)

  // Check email uniqueness if changed
  if (input.email && input.email.toLowerCase() !== existing.email) {
    const [duplicate] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email.toLowerCase()))
      .limit(1)
    if (duplicate) throw createValidationError({ email: 'Email already exists' })
  }

  const updateData: Record<string, unknown> = {}
  if (input.email) updateData.email = input.email.toLowerCase()
  if (input.name) updateData.name = input.name
  if (input.role) updateData.role = input.role
  if (typeof input.isActive === 'boolean') updateData.isActive = input.isActive
  if (input.password) updateData.passwordHash = await hashPassword(input.password)

  // Keep module scope consistent with the effective role: admins store NULL
  // (implicitly all modules); demoting away from admin without an explicit
  // list starts the user with no modules.
  const effectiveRole = input.role ?? existing.role
  if (effectiveRole === 'admin') {
    updateData.modules = null
  } else if (input.modules !== undefined) {
    updateData.modules = input.modules
  } else if (existing.role === 'admin') {
    updateData.modules = []
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(schema.users).set(updateData).where(eq(schema.users.id, id))
  }

  const [updated] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      modules: schema.users.modules,
      isActive: schema.users.isActive,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)

  const updatedResolved = { ...updated, modules: resolveUserModules(updated.role, updated.modules) }

  const before = sanitizeForAudit({
    id: existing.id,
    email: existing.email,
    name: existing.name,
    role: existing.role,
    modules: resolveUserModules(existing.role, existing.modules),
    isActive: existing.isActive
  })
  const after = sanitizeForAudit(updatedResolved as Record<string, unknown>)
  await logAuditAction(event, 'update', 'user', id, createChangesObject(before, after))

  return updatedResolved
}

async function handleDelete(event: H3Event, id: number) {
  requireAdmin(event)

  const currentUser = getCurrentUser(event)
  const db = getDatabase()

  // Prevent self-deletion
  if (id === currentUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Cannot delete yourself'
    })
  }

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, id), isNull(schema.users.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })

  await db
    .update(schema.users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(schema.users.id, id))

  await logAuditAction(event, 'delete', 'user', id, {
    before: sanitizeForAudit({
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role: existing.role
    })
  })

  return { success: true, message: 'User deleted successfully' }
}
