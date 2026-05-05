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
import { videoSchema, validateBody } from '../../../utils/validation'

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
  if (query.includeDeleted !== 'true') conditions.push(isNull(schema.videos.deletedAt))
  if (query.isPublished === 'true') conditions.push(eq(schema.videos.isPublished, true))
  else if (query.isPublished === 'false') conditions.push(eq(schema.videos.isPublished, false))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.videos)
    .where(whereClause)

  const videos = await db
    .select()
    .from(schema.videos)
    .where(whereClause)
    .orderBy(desc(schema.videos.publishedAt))
    .limit(perPage)
    .offset(offset)

  const videoIds = videos.map((v) => v.id)
  const translations =
    videoIds.length > 0
      ? await db
          .select()
          .from(schema.videoTranslations)
          .where(sql`${schema.videoTranslations.videoId} IN (${sql.join(videoIds, sql`, `)})`)
      : []

  const translationsByVideo = translations.reduce(
    (acc, t) => {
      if (!acc[t.videoId]) acc[t.videoId] = {}
      acc[t.videoId][t.locale] = { title: t.title, description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string | null }>>
  )

  const data = videos.map((v) => ({ ...v, translations: translationsByVideo[v.id] || {} }))

  return { data, meta: buildPaginationMeta(Number(count), page, perPage) }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)
  const input = validateBody(videoSchema, body)
  const db = getDatabase()
  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO videos (url, thumbnail, duration, published_at, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.url,
        input.thumbnail || null,
        input.duration || null,
        new Date(input.publishedAt),
        input.isPublished,
        user.id
      ]
    )

    const videoId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO video_translations (video_id, locale, title, description) VALUES (?, ?, ?, ?)`,
          [videoId, locale, trans.title, trans.description || null]
        )
      }
    }

    await connection.commit()

    const [video] = await db
      .select()
      .from(schema.videos)
      .where(eq(schema.videos.id, videoId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.videoTranslations)
      .where(eq(schema.videoTranslations.videoId, videoId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, description: t.description }
        return acc
      },
      {} as Record<string, { title: string; description: string | null }>
    )

    await logAuditAction(event, 'create', 'video', videoId, {
      after: sanitizeForAudit({ ...video, translations: translationsMap })
    })

    return { ...video, translations: translationsMap }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
