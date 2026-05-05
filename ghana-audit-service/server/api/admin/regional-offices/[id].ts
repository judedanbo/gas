import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import {
  regionalOfficeSchema,
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

  const conditions = [eq(schema.regionalOffices.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.regionalOffices.deletedAt))

  const [office] = await db
    .select()
    .from(schema.regionalOffices)
    .where(and(...conditions))
    .limit(1)

  if (!office)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Office not found' })

  const translations = await db
    .select()
    .from(schema.regionalOfficeTranslations)
    .where(eq(schema.regionalOfficeTranslations.officeId, id))

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
    .from(schema.regionalOffices)
    .where(and(eq(schema.regionalOffices.id, id), isNull(schema.regionalOffices.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Office not found' })

  const existingTranslations = await db
    .select()
    .from(schema.regionalOfficeTranslations)
    .where(eq(schema.regionalOfficeTranslations.officeId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, name: t.name, address: t.address }
      return acc
    },
    {} as Record<string, { id: number; name: string; address: string | null }>
  )

  const input = validateBody(regionalOfficeSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.regionalOffices.id })
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.slug, input.slug))
      .limit(1)
    if (duplicate) throw createValidationError({ slug: 'Slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE regional_offices SET slug = ?, region = ?, phone = ?, email = ?, latitude = ?, longitude = ?, display_order = ? WHERE id = ?`,
      [
        input.slug,
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
            `UPDATE regional_office_translations SET name = ?, address = ? WHERE id = ?`,
            [trans.name, trans.address || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO regional_office_translations (office_id, locale, name, address) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.name, trans.address || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.regionalOfficeTranslations)
      .where(eq(schema.regionalOfficeTranslations.officeId, id))

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
      'regional_office',
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
    .from(schema.regionalOffices)
    .where(and(eq(schema.regionalOffices.id, id), isNull(schema.regionalOffices.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Office not found' })

  await db
    .update(schema.regionalOffices)
    .set({ deletedAt: new Date() })
    .where(eq(schema.regionalOffices.id, id))

  await logAuditAction(event, 'delete', 'regional_office', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Regional office deleted successfully' }
}
