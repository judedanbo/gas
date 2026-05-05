import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { publicationSchema, validateBody, createValidationError } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })
  }

  if (method === 'GET') return handleGet(event, id)
  if (method === 'PUT') return handleUpdate(event, id)
  if (method === 'DELETE') return handleDelete(event, id)

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})

async function handleGet(event: H3Event, id: number) {
  requirePermission(event, 'read')
  const db = getDatabase()

  const conditions = [eq(schema.publications.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.publications.deletedAt))

  const [publication] = await db
    .select()
    .from(schema.publications)
    .where(and(...conditions))
    .limit(1)

  if (!publication) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Publication not found' })
  }

  const translations = await db
    .select()
    .from(schema.publicationTranslations)
    .where(eq(schema.publicationTranslations.publicationId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
      return acc
    },
    {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
  )

  return { ...publication, translations: translationsMap }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.publications)
    .where(and(eq(schema.publications.id, id), isNull(schema.publications.deletedAt)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Publication not found' })
  }

  const existingTranslations = await db
    .select()
    .from(schema.publicationTranslations)
    .where(eq(schema.publicationTranslations.publicationId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, excerpt: t.excerpt, content: t.content }
      return acc
    },
    {} as Record<string, { id: number; title: string; excerpt: string | null; content: string | null }>
  )

  const input = validateBody(publicationSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.publications.id })
      .from(schema.publications)
      .where(eq(schema.publications.slug, input.slug))
      .limit(1)

    if (duplicate) {
      throw createValidationError({ slug: 'A publication with this slug already exists' })
    }
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE publications SET slug = ?, type = ?, published_at = ?, file_url = ?, thumbnail = ?, is_published = ?, updated_by = ? WHERE id = ?`,
      [
        input.slug,
        input.type,
        new Date(input.publishedAt),
        input.fileUrl || null,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        id
      ]
    )

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE publication_translations SET title = ?, excerpt = ?, content = ? WHERE id = ?`,
            [trans.title, trans.excerpt || null, trans.content || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO publication_translations (publication_id, locale, title, excerpt, content) VALUES (?, ?, ?, ?, ?)`,
            [id, locale, trans.title, trans.excerpt || null, trans.content || null]
          )
        }
      }
    }

    await connection.commit()

    const [updated] = await db.select().from(schema.publications).where(eq(schema.publications.id, id)).limit(1)

    const translations = await db
      .select()
      .from(schema.publicationTranslations)
      .where(eq(schema.publicationTranslations.publicationId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
        return acc
      },
      {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
    )

    const before = sanitizeForAudit({ ...existing, translations: existingTransMap })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap })
    const changes = createChangesObject(before as Record<string, unknown>, after as Record<string, unknown>)
    await logAuditAction(event, 'update', 'publication', id, changes)

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
    .from(schema.publications)
    .where(and(eq(schema.publications.id, id), isNull(schema.publications.deletedAt)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Publication not found' })
  }

  await db.update(schema.publications).set({ deletedAt: new Date() }).where(eq(schema.publications.id, id))

  await logAuditAction(event, 'delete', 'publication', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'Publication deleted successfully' }
}
