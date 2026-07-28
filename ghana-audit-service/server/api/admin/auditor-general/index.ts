/**
 * Admin API for the Auditor-General message singleton (edit-only).
 * The single row is created by the seed (npm run db:seed:auditor-general) —
 * there is no create/delete; GET and PUT operate on the first row.
 */
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { getDatabase, getPool, schema } from '../../../database'
import { requirePermission, getCurrentUser } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { auditorGeneralMessageSchema, validateBody } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

type TranslationFields = { name: string; title: string; excerpt: string; fullMessage: string }

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') return handleGet(event)
  if (method === 'PUT') return handleUpdate(event)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function fetchSingleton() {
  const db = getDatabase()

  const [message] = await db
    .select()
    .from(schema.auditorGeneralMessage)
    .orderBy(schema.auditorGeneralMessage.id)
    .limit(1)

  if (!message) return null

  const translations = await db
    .select()
    .from(schema.auditorGeneralMessageTranslations)
    .where(eq(schema.auditorGeneralMessageTranslations.messageId, message.id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        id: t.id,
        name: t.name,
        title: t.title,
        excerpt: t.excerpt,
        fullMessage: t.fullMessage
      }
      return acc
    },
    {} as Record<string, TranslationFields & { id: number }>
  )

  return { ...message, translations: translationsMap }
}

function notFound() {
  return createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    message: 'Auditor-General message not found — run npm run db:seed:auditor-general'
  })
}

async function handleGet(event: H3Event) {
  requirePermission(event, 'read')

  const message = await fetchSingleton()
  if (!message) throw notFound()

  return message
}

async function handleUpdate(event: H3Event) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)

  const existing = await fetchSingleton()
  if (!existing) throw notFound()

  const input = validateBody(auditorGeneralMessageSchema, body)
  const id = existing.id

  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE auditor_general_message SET photo = ?, is_active = ? WHERE id = ?`,
      [input.photo || null, input.isActive, id]
    )

    // Update or insert translations per locale
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existing.translations[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE auditor_general_message_translations SET name = ?, title = ?, excerpt = ?, full_message = ? WHERE id = ?`,
            [trans.name, trans.title, trans.excerpt, trans.fullMessage, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO auditor_general_message_translations (message_id, locale, name, title, excerpt, full_message) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, locale, trans.name, trans.title, trans.excerpt, trans.fullMessage]
          )
        }
      }
    }

    await connection.commit()

    const updated = await fetchSingleton()

    const before = sanitizeForAudit(existing as unknown as Record<string, unknown>)
    const after = sanitizeForAudit(updated as unknown as Record<string, unknown>)
    await logAuditAction(
      event,
      'update',
      'auditor_general_message',
      id,
      createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    )

    return updated
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:auditor-general', error)
  } finally {
    connection.release()
  }
}
