import type { H3Event } from 'h3'
import type { BoardRole } from '~/types/admin'
import { eq, and, isNull, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { boardMemberSchema, validateBody, createValidationError } from '../../../utils/validation'
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

  const conditions = []

  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.boardMembers.deletedAt))
  }

  if (query.isActive === 'true') {
    conditions.push(eq(schema.boardMembers.isActive, true))
  } else if (query.isActive === 'false') {
    conditions.push(eq(schema.boardMembers.isActive, false))
  }

  if (query.role && typeof query.role === 'string') {
    const validRoles = ['chairperson', 'member'] as const
    if (validRoles.includes(query.role as BoardRole)) {
      conditions.push(eq(schema.boardMembers.role, query.role as BoardRole))
    }
  }

  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    // Escape LIKE wildcards (\, %, _) so they match literally
    const term = query.search.trim().replace(/[\\%_]/g, '\\$&')
    conditions.push(sql`${schema.boardMembers.name} LIKE ${`%${term}%`}`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.boardMembers)
    .where(whereClause)

  const members = await db
    .select()
    .from(schema.boardMembers)
    .where(whereClause)
    .orderBy(asc(schema.boardMembers.role), schema.boardMembers.displayOrder)
    .limit(perPage)
    .offset(offset)

  return { data: members, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const body = await readBody(event)

  const input = validateBody(boardMemberSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.boardMembers.id })
    .from(schema.boardMembers)
    .where(eq(schema.boardMembers.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A board member with this slug already exists' })
  }

  try {
    const [result] = await db.insert(schema.boardMembers).values({
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

    const memberId = result.insertId

    const [member] = await db
      .select()
      .from(schema.boardMembers)
      .where(eq(schema.boardMembers.id, memberId))
      .limit(1)

    await logAuditAction(event, 'create', 'board_members', memberId, {
      after: sanitizeForAudit(member as Record<string, unknown>)
    })

    return member
  } catch (error) {
    throw safeError('admin:board-members', error)
  }
}
