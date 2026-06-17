import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { teamMemberSchema, validateBody } from '../../../utils/validation'
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

  const conditions = [eq(schema.teamMembers.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.teamMembers.deletedAt))

  const [member] = await db
    .select()
    .from(schema.teamMembers)
    .where(and(...conditions))
    .limit(1)

  if (!member)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Team member not found'
    })

  const translations = await db
    .select()
    .from(schema.teamMemberTranslations)
    .where(eq(schema.teamMemberTranslations.teamMemberId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { name: t.name, position: t.position, bio: t.bio }
      return acc
    },
    {} as Record<string, { name: string; position: string; bio: string | null }>
  )

  return { ...member, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.id, id), isNull(schema.teamMembers.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Team member not found'
    })

  const existingTranslations = await db
    .select()
    .from(schema.teamMemberTranslations)
    .where(eq(schema.teamMemberTranslations.teamMemberId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, name: t.name, position: t.position, bio: t.bio }
      return acc
    },
    {} as Record<string, { id: number; name: string; position: string; bio: string | null }>
  )

  const input = validateBody(teamMemberSchema, body)
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE team_members SET department_id = ?, photo = ?, email = ?, phone = ?, display_order = ? WHERE id = ?`,
      [
        input.departmentId || null,
        input.photo || null,
        input.email || null,
        input.phone || null,
        input.displayOrder,
        id
      ]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE team_member_translations SET name = ?, position = ?, bio = ? WHERE id = ?`,
            [trans.name, trans.position, trans.bio || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO team_member_translations (team_member_id, locale, name, position, bio) VALUES (?, ?, ?, ?, ?)`,
            [id, locale, trans.name, trans.position, trans.bio || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.teamMemberTranslations)
      .where(eq(schema.teamMemberTranslations.teamMemberId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, position: t.position, bio: t.bio }
        return acc
      },
      {} as Record<string, { name: string; position: string; bio: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'team_member',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:team-members', error)
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.id, id), isNull(schema.teamMembers.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Team member not found'
    })

  await db
    .update(schema.teamMembers)
    .set({ deletedAt: new Date() })
    .where(eq(schema.teamMembers.id, id))

  await logAuditAction(event, 'delete', 'team_member', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Team member deleted successfully' }
}
