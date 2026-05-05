import type { H3Event } from 'h3'
import type { AdminUser } from '~/types/admin'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requireAdmin, parsePagination, buildPaginationMeta } from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { userSchema, validateBody, createValidationError } from '../../../utils/validation'
import { hashPassword } from '../../../utils/password'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleList(event)
  if (method === 'POST') return handleCreate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleList(event: H3Event) {
  requireAdmin(event)

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = []
  if (query.includeDeleted !== 'true') conditions.push(isNull(schema.users.deletedAt))
  if (query.role && typeof query.role === 'string') {
    conditions.push(eq(schema.users.role, query.role as AdminUser['role']))
  }
  if (query.isActive === 'true') conditions.push(eq(schema.users.isActive, true))
  else if (query.isActive === 'false') conditions.push(eq(schema.users.isActive, false))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .where(whereClause)

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
      deletedAt: schema.users.deletedAt
    })
    .from(schema.users)
    .where(whereClause)
    .orderBy(desc(schema.users.createdAt))
    .limit(perPage)
    .offset(offset)

  return { data: users, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requireAdmin(event)

  const body = await readBody(event)
  const input = validateBody(userSchema, body)
  const db = getDatabase()

  if (!input.password) {
    throw createValidationError({ password: 'Password is required' })
  }

  // Check for duplicate email
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, input.email.toLowerCase()))
    .limit(1)

  if (existing) {
    throw createValidationError({ email: 'Email already exists' })
  }

  const passwordHash = await hashPassword(input.password)

  const [result] = await db.insert(schema.users).values({
    email: input.email.toLowerCase(),
    passwordHash,
    name: input.name,
    role: input.role,
    isActive: input.isActive
  })

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, result.insertId))
    .limit(1)

  await logAuditAction(event, 'create', 'user', result.insertId, {
    after: sanitizeForAudit(user as Record<string, unknown>)
  })

  return user
}
