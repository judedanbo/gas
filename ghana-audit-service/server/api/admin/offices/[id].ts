import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { officeSchema, validateBody, createValidationError } from '../../../utils/validation'

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

  const conditions = [eq(schema.offices.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.offices.deletedAt))

  const [office] = await db
    .select()
    .from(schema.offices)
    .where(and(...conditions))
    .limit(1)

  if (!office)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Office not found' })

  const translations = await db
    .select()
    .from(schema.officeTranslations)
    .where(eq(schema.officeTranslations.officeId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { name: t.name, address: t.address }
      return acc
    },
    {} as Record<string, { name: string; address: string | null }>
  )

  return { ...office, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.offices)
    .where(and(eq(schema.offices.id, id), isNull(schema.offices.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Office not found' })

  const existingTranslations = await db
    .select()
    .from(schema.officeTranslations)
    .where(eq(schema.officeTranslations.officeId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, name: t.name, address: t.address }
      return acc
    },
    {} as Record<string, { id: number; name: string; address: string | null }>
  )

  const input = validateBody(officeSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.offices.id })
      .from(schema.offices)
      .where(eq(schema.offices.slug, input.slug))
      .limit(1)
    if (duplicate) throw createValidationError({ slug: 'Slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE offices SET slug = ?, type_id = ?, parent_id = ?, region = ?, phone = ?, email = ?, latitude = ?, longitude = ?, display_order = ? WHERE id = ?`,
      [
        input.slug,
        input.typeId,
        input.parentId || null,
        input.region,
        input.phone || null,
        input.email || null,
        input.latitude || null,
        input.longitude || null,
        input.displayOrder,
        id
      ]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE office_translations SET name = ?, address = ? WHERE id = ?`,
            [trans.name, trans.address || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO office_translations (office_id, locale, name, address) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.name, trans.address || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.offices)
      .where(eq(schema.offices.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.officeTranslations)
      .where(eq(schema.officeTranslations.officeId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name, address: t.address }
        return acc
      },
      {} as Record<string, { name: string; address: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'office',
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
    .from(schema.offices)
    .where(and(eq(schema.offices.id, id), isNull(schema.offices.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Office not found' })

  await db
    .update(schema.offices)
    .set({ deletedAt: new Date() })
    .where(eq(schema.offices.id, id))

  await logAuditAction(event, 'delete', 'office', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Office deleted successfully' }
}
