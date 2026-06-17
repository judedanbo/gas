import type { H3Event } from 'h3'
import type { AdminUser } from '~/types/admin'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requireAdmin, parsePagination, buildPaginationMeta } from '../../../utils/adminHelpers'
import { resolveUserModules } from '../../../utils/modules'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { userSchema, validateBody, createValidationError } from '../../../utils/validation'
import { prepareInvitation, dispatchInvitationEmail } from '../../../utils/invitations'

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
  if (
    typeof query.status === 'string' &&
    ['pending', 'active', 'inactive'].includes(query.status)
  ) {
    conditions.push(eq(schema.users.status, query.status as 'pending' | 'active' | 'inactive'))
  }

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
      modules: schema.users.modules,
      isActive: schema.users.isActive,
      status: schema.users.status,
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

  const data = users.map((u) => ({ ...u, modules: resolveUserModules(u.role, u.modules) }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requireAdmin(event)

  const body = await readBody(event)
  const input = validateBody(userSchema, body)
  const db = getDatabase()

  // Check for duplicate email
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, input.email.toLowerCase()))
    .limit(1)

  if (existing) {
    throw createValidationError({ email: 'Email already exists' })
  }

  // The administrator no longer supplies a password. The system generates a
  // safe initial password and an invitation token; the user starts as
  // 'pending' until they accept the emailed invitation.
  const invitation = await prepareInvitation()

  const [result] = await db.insert(schema.users).values({
    email: input.email.toLowerCase(),
    passwordHash: invitation.passwordHash,
    name: input.name,
    role: input.role,
    // Admins implicitly have all modules — store NULL, never a list.
    modules: input.role === 'admin' ? null : (input.modules ?? []),
    isActive: true,
    status: 'pending',
    invitationToken: invitation.token,
    invitationTokenExpiresAt: invitation.expiresAt
  })

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      modules: schema.users.modules,
      isActive: schema.users.isActive,
      status: schema.users.status,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, result.insertId))
    .limit(1)

  const created = { ...user, modules: resolveUserModules(user.role, user.modules) }

  // Send the invitation email carrying the initial password + accept link.
  const emailSent = await dispatchInvitationEmail({
    email: user.email,
    name: user.name,
    password: invitation.password,
    token: invitation.token
  })

  await logAuditAction(event, 'create', 'user', result.insertId, {
    after: sanitizeForAudit(created as Record<string, unknown>)
  })

  // Surface the generated password once so the admin can pass it along if the
  // invitation email could not be sent. Never persisted in the clear.
  return { ...created, generatedPassword: invitation.password, emailSent }
}
