import type { H3Event } from 'h3'
import type { ManagementRole } from '~/types/admin'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import {
  managementTeamSchema,
  validateBody,
  createValidationError
} from '../../../utils/validation'

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
    conditions.push(isNull(schema.managementTeam.deletedAt))
  }

  if (query.isActive === 'true') {
    conditions.push(eq(schema.managementTeam.isActive, true))
  } else if (query.isActive === 'false') {
    conditions.push(eq(schema.managementTeam.isActive, false))
  }

  if (query.role && typeof query.role === 'string') {
    const validRoles = ['auditor-general', 'deputy-auditor-general', 'regional-auditor'] as const
    if (validRoles.includes(query.role as ManagementRole)) {
      conditions.push(eq(schema.managementTeam.role, query.role as ManagementRole))
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.managementTeam)
    .where(whereClause)

  const members = await db
    .select()
    .from(schema.managementTeam)
    .where(whereClause)
    .orderBy(desc(schema.managementTeam.role), schema.managementTeam.displayOrder)
    .limit(perPage)
    .offset(offset)

  const memberIds = members.map((m) => m.id)

  const translations =
    memberIds.length > 0
      ? await db
          .select()
          .from(schema.managementTeamTranslations)
          .where(
            sql`${schema.managementTeamTranslations.managementTeamId} IN (${sql.join(memberIds, sql`, `)})`
          )
      : []

  const translationsByMember = translations.reduce(
    (acc, t) => {
      if (!acc[t.managementTeamId]) acc[t.managementTeamId] = {}
      acc[t.managementTeamId][t.locale] = { name: t.name, title: t.title, bio: t.bio }
      return acc
    },
    {} as Record<number, Record<string, { name: string; title: string; bio: string | null }>>
  )

  const data = members.map((m) => ({
    ...m,
    translations: translationsByMember[m.id] || {}
  }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const body = await readBody(event)

  const input = validateBody(managementTeamSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.managementTeam.id })
    .from(schema.managementTeam)
    .where(eq(schema.managementTeam.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A management team member with this slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO management_team (slug, role, regional_office_id, department_id, icon, photo, email, phone, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.role,
        input.regionalOfficeId || null,
        input.departmentId || null,
        input.icon || null,
        input.photo || null,
        input.email || null,
        input.phone || null,
        input.displayOrder,
        input.isActive
      ]
    )

    const memberId = (result as { insertId: number }).insertId

    // Insert translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO management_team_translations (management_team_id, locale, name, title, bio)
           VALUES (?, ?, ?, ?, ?)`,
          [memberId, locale, trans.name, trans.title, trans.bio || null]
        )
      }
    }

    // Insert responsibilities with translations
    if (input.responsibilities && input.responsibilities.length > 0) {
      for (const resp of input.responsibilities) {
        const [respResult] = await connection.execute(
          `INSERT INTO management_team_responsibilities (management_team_id, display_order) VALUES (?, ?)`,
          [memberId, resp.displayOrder]
        )
        const respId = (respResult as { insertId: number }).insertId

        for (const [locale, trans] of Object.entries(resp.translations)) {
          if (trans) {
            await connection.execute(
              `INSERT INTO management_team_responsibility_translations (responsibility_id, locale, description)
               VALUES (?, ?, ?)`,
              [respId, locale, trans.description]
            )
          }
        }
      }
    }

    await connection.commit()

    // Fetch created member with all data
    const [member] = await db
      .select()
      .from(schema.managementTeam)
      .where(eq(schema.managementTeam.id, memberId))
      .limit(1)

    const memberTranslations = await db
      .select()
      .from(schema.managementTeamTranslations)
      .where(eq(schema.managementTeamTranslations.managementTeamId, memberId))

    const translationsMap = memberTranslations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, title: t.title, bio: t.bio }
        return acc
      },
      {} as Record<string, { name: string; title: string; bio: string | null }>
    )

    await logAuditAction(event, 'create', 'management_team', memberId, {
      after: sanitizeForAudit({ ...member, translations: translationsMap })
    })

    return { ...member, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
