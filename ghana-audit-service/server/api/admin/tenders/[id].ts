import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { tenderSchema, validateBody, createValidationError } from '../../../utils/validation'
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

  const conditions = [eq(schema.tenders.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.tenders.deletedAt))

  const [tender] = await db
    .select()
    .from(schema.tenders)
    .where(and(...conditions))
    .limit(1)

  if (!tender)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Tender not found' })

  const translations = await db
    .select()
    .from(schema.tenderTranslations)
    .where(eq(schema.tenderTranslations.tenderId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, description: t.description }
      return acc
    },
    {} as Record<string, { title: string; description: string | null }>
  )

  return { ...tender, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.tenders)
    .where(and(eq(schema.tenders.id, id), isNull(schema.tenders.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Tender not found' })

  const existingTranslations = await db
    .select()
    .from(schema.tenderTranslations)
    .where(eq(schema.tenderTranslations.tenderId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, description: t.description }
      return acc
    },
    {} as Record<string, { id: number; title: string; description: string | null }>
  )

  const input = validateBody(tenderSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.tenders.id })
      .from(schema.tenders)
      .where(eq(schema.tenders.slug, input.slug))
      .limit(1)
    if (duplicate) throw createValidationError({ slug: 'A tender with this slug already exists' })
  }

  if (input.referenceNumber !== existing.referenceNumber) {
    const [duplicate] = await db
      .select({ id: schema.tenders.id })
      .from(schema.tenders)
      .where(eq(schema.tenders.referenceNumber, input.referenceNumber))
      .limit(1)
    if (duplicate)
      throw createValidationError({
        referenceNumber: 'A tender with this reference number already exists'
      })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE tenders SET slug = ?, reference_number = ?, category = ?, submission_deadline = ?, opening_date = ?, document_url = ?, published_at = ?, status = ? WHERE id = ?`,
      [
        input.slug,
        input.referenceNumber,
        input.category,
        new Date(input.submissionDeadline),
        input.openingDate ? new Date(input.openingDate) : null,
        input.documentUrl || null,
        new Date(input.publishedAt),
        input.status,
        id
      ]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE tender_translations SET title = ?, description = ? WHERE id = ?`,
            [trans.title, trans.description || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO tender_translations (tender_id, locale, title, description) VALUES (?, ?, ?, ?)`,
            [id, locale, trans.title, trans.description || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db
      .select()
      .from(schema.tenders)
      .where(eq(schema.tenders.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.tenderTranslations)
      .where(eq(schema.tenderTranslations.tenderId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description }
        return acc
      },
      {} as Record<string, { title: string; description: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    await logAuditAction(
      event,
      'update',
      'tender',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return { ...updated, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:tenders', error)
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.tenders)
    .where(and(eq(schema.tenders.id, id), isNull(schema.tenders.deletedAt)))
    .limit(1)

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Tender not found' })

  await db.update(schema.tenders).set({ deletedAt: new Date() }).where(eq(schema.tenders.id, id))

  await logAuditAction(event, 'delete', 'tender', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Tender deleted successfully' }
}
