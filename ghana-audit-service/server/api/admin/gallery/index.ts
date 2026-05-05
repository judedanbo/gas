import type { H3Event } from 'h3'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { galleryImageSchema, validateBody } from '../../../utils/validation'

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
  if (query.includeDeleted !== 'true') conditions.push(isNull(schema.galleryImages.deletedAt))
  if (query.category && typeof query.category === 'string') {
    conditions.push(eq(schema.galleryImages.category, query.category))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.galleryImages)
    .where(whereClause)

  const images = await db
    .select()
    .from(schema.galleryImages)
    .where(whereClause)
    .orderBy(desc(schema.galleryImages.uploadedAt))
    .limit(perPage)
    .offset(offset)

  const imageIds = images.map((i) => i.id)
  const translations =
    imageIds.length > 0
      ? await db
          .select()
          .from(schema.galleryImageTranslations)
          .where(
            sql`${schema.galleryImageTranslations.imageId} IN (${sql.join(imageIds, sql`, `)})`
          )
      : []

  const translationsByImage = translations.reduce(
    (acc, t) => {
      if (!acc[t.imageId]) acc[t.imageId] = {}
      acc[t.imageId][t.locale] = { alt: t.alt, caption: t.caption }
      return acc
    },
    {} as Record<number, Record<string, { alt: string | null; caption: string | null }>>
  )

  const data = images.map((i) => ({ ...i, translations: translationsByImage[i.id] || {} }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const input = validateBody(galleryImageSchema, body)
  const db = getDatabase()
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO gallery_images (url, category, created_by) VALUES (?, ?, ?)`,
      [input.url, input.category || null, user.id]
    )

    const imageId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO gallery_image_translations (image_id, locale, alt, caption) VALUES (?, ?, ?, ?)`,
          [imageId, locale, trans.alt || null, trans.caption || null]
        )
      }
    }

    await connection.commit()

    const [image] = await db
      .select()
      .from(schema.galleryImages)
      .where(eq(schema.galleryImages.id, imageId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.galleryImageTranslations)
      .where(eq(schema.galleryImageTranslations.imageId, imageId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { alt: t.alt, caption: t.caption }
        return acc
      },
      {} as Record<string, { alt: string | null; caption: string | null }>
    )

    await logAuditAction(event, 'create', 'gallery_image', imageId, {
      after: sanitizeForAudit({ ...image, translations: translationsMap })
    })

    return { ...image, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
