import type { H3Event } from 'h3'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import {
  managementTeamSchema,
  validateBody,
  createValidationError
} from '../../../utils/validation'

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

  const conditions = [eq(schema.managementTeam.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.managementTeam.deletedAt))

  const [member] = await db
    .select()
    .from(schema.managementTeam)
    .where(and(...conditions))
    .limit(1)

  if (!member)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Management team member not found'
    })

  const translations = await db
    .select()
    .from(schema.managementTeamTranslations)
    .where(eq(schema.managementTeamTranslations.managementTeamId, id))

  const responsibilities = await db
    .select()
    .from(schema.managementTeamResponsibilities)
    .where(eq(schema.managementTeamResponsibilities.managementTeamId, id))

  const respIds = responsibilities.map((r) => r.id)
  const respTranslations =
    respIds.length > 0
      ? await db
          .select()
          .from(schema.managementTeamResponsibilityTranslations)
          .where(inArray(schema.managementTeamResponsibilityTranslations.responsibilityId, respIds))
      : []

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { name: t.name, title: t.title, bio: t.bio }
      return acc
    },
    {} as Record<string, { name: string; title: string; bio: string | null }>
  )

  const respTransByResp = respTranslations.reduce(
    (acc, t) => {
      if (!acc[t.responsibilityId]) acc[t.responsibilityId] = {}
      acc[t.responsibilityId][t.locale] = { description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { description: string }>>
  )

  const responsibilitiesWithTrans = responsibilities.map((r) => ({
    id: r.id,
    displayOrder: r.displayOrder,
    translations: respTransByResp[r.id] || {}
  }))

  return { ...member, translations: translationsMap, responsibilities: responsibilitiesWithTrans }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.managementTeam)
    .where(and(eq(schema.managementTeam.id, id), isNull(schema.managementTeam.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Management team member not found'
    })

  const existingTranslations = await db
    .select()
    .from(schema.managementTeamTranslations)
    .where(eq(schema.managementTeamTranslations.managementTeamId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, name: t.name, title: t.title, bio: t.bio }
      return acc
    },
    {} as Record<string, { id: number; name: string; title: string; bio: string | null }>
  )

  const input = validateBody(managementTeamSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.managementTeam.id })
      .from(schema.managementTeam)
      .where(eq(schema.managementTeam.slug, input.slug))
      .limit(1)

    if (duplicate) throw createValidationError({ slug: 'Slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE management_team SET slug = ?, role = ?, office_id = ?, department_id = ?, icon = ?, photo = ?, email = ?, phone = ?, display_order = ?, is_active = ? WHERE id = ?`,
      [
        input.slug,
        input.role,
        input.officeId || null,
        input.departmentId || null,
        input.icon || null,
        input.photo || null,
        input.email || null,
        input.phone || null,
        input.displayOrder,
        input.isActive,
        id
      ]
    )

    // Update translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE management_team_translations SET name = ?, title = ?, bio = ? WHERE id = ?`,
            [trans.name, trans.title, trans.bio || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO management_team_translations (management_team_id, locale, name, title, bio) VALUES (?, ?, ?, ?, ?)`,
            [id, locale, trans.name, trans.title, trans.bio || null]
          )
        }
      }
    }

    // Delete existing responsibilities and recreate
    await connection.execute(
      `DELETE FROM management_team_responsibilities WHERE management_team_id = ?`,
      [id]
    )

    if (input.responsibilities && input.responsibilities.length > 0) {
      for (const resp of input.responsibilities) {
        const [respResult] = await connection.execute(
          `INSERT INTO management_team_responsibilities (management_team_id, display_order) VALUES (?, ?)`,
          [id, resp.displayOrder]
        )
        const respId = (respResult as { insertId: number }).insertId

        for (const [locale, trans] of Object.entries(resp.translations)) {
          if (trans) {
            await connection.execute(
              `INSERT INTO management_team_responsibility_translations (responsibility_id, locale, description) VALUES (?, ?, ?)`,
              [respId, locale, trans.description]
            )
          }
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.managementTeam)
      .where(eq(schema.managementTeam.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.managementTeamTranslations)
      .where(eq(schema.managementTeamTranslations.managementTeamId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, title: t.title, bio: t.bio }
        return acc
      },
      {} as Record<string, { name: string; title: string; bio: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'management_team',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.managementTeam)
    .where(and(eq(schema.managementTeam.id, id), isNull(schema.managementTeam.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Management team member not found'
    })

  await db
    .update(schema.managementTeam)
    .set({ deletedAt: new Date() })
    .where(eq(schema.managementTeam.id, id))

  await logAuditAction(event, 'delete', 'management_team', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Management team member deleted successfully' }
}
