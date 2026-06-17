import type { H3Event } from 'h3'
import { eq, and, isNull, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { teamMemberSchema, validateBody } from '../../../utils/validation'
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
  if (query.includeDeleted !== 'true') conditions.push(isNull(schema.teamMembers.deletedAt))
  if (query.departmentId)
    conditions.push(eq(schema.teamMembers.departmentId, Number(query.departmentId)))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.teamMembers)
    .where(whereClause)

  const members = await db
    .select()
    .from(schema.teamMembers)
    .where(whereClause)
    .orderBy(asc(schema.teamMembers.displayOrder))
    .limit(perPage)
    .offset(offset)

  const memberIds = members.map((m) => m.id)
  const translations =
    memberIds.length > 0
      ? await db
          .select()
          .from(schema.teamMemberTranslations)
          .where(
            sql`${schema.teamMemberTranslations.teamMemberId} IN (${sql.join(memberIds, sql`, `)})`
          )
      : []

  const translationsByMember = translations.reduce(
    (acc, t) => {
      if (!acc[t.teamMemberId]) acc[t.teamMemberId] = {}
      acc[t.teamMemberId][t.locale] = { name: t.name, position: t.position, bio: t.bio }
      return acc
    },
    {} as Record<number, Record<string, { name: string; position: string; bio: string | null }>>
  )

  const data = members.map((m) => ({ ...m, translations: translationsByMember[m.id] || {} }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const body = await readBody(event)
  const input = validateBody(teamMemberSchema, body)
  const db = getDatabase()
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO team_members (department_id, photo, email, phone, display_order) VALUES (?, ?, ?, ?, ?)`,
      [
        input.departmentId || null,
        input.photo || null,
        input.email || null,
        input.phone || null,
        input.displayOrder
      ]
    )

    const memberId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO team_member_translations (team_member_id, locale, name, position, bio) VALUES (?, ?, ?, ?, ?)`,
          [memberId, locale, trans.name, trans.position, trans.bio || null]
        )
      }
    }

    await connection.commit()

    const [member] = await db
      .select()
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.id, memberId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.teamMemberTranslations)
      .where(eq(schema.teamMemberTranslations.teamMemberId, memberId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, position: t.position, bio: t.bio }
        return acc
      },
      {} as Record<string, { name: string; position: string; bio: string | null }>
    )

    await logAuditAction(event, 'create', 'team_member', memberId, {
      after: sanitizeForAudit({ ...member, translations: translationsMap })
    })

    return { ...member, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:team-members', error)
  } finally {
    connection.release()
  }
}
