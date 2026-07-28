import type { H3Event } from 'h3'
import type { PublicationType } from '~/types/admin'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import {
  requirePermission,
  getCurrentUser,
  parsePagination,
  buildPaginationMeta
} from '../../../utils/adminHelpers'
import { logAuditAction, sanitizeForAudit } from '../../../utils/auditLogger'
import { publicationSchema, validateBody, createValidationError } from '../../../utils/validation'
import { fileSizeToBytes } from '../../../utils/fileSize'
import { safeError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    return handleList(event)
  } else if (method === 'POST') {
    return handleCreate(event)
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method Not Allowed'
  })
})

async function handleList(event: H3Event) {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const { page, perPage, offset } = parsePagination(query as Record<string, unknown>)
  const db = getDatabase()

  const conditions = []

  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.publications.deletedAt))
  }

  if (query.type && typeof query.type === 'string') {
    conditions.push(eq(schema.publications.type, query.type as PublicationType))
  }

  if (query.isPublished === 'true') {
    conditions.push(eq(schema.publications.isPublished, true))
  } else if (query.isPublished === 'false') {
    conditions.push(eq(schema.publications.isPublished, false))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.publications)
    .where(whereClause)

  const publications = await db
    .select()
    .from(schema.publications)
    .where(whereClause)
    .orderBy(desc(schema.publications.publishedAt))
    .limit(perPage)
    .offset(offset)

  const pubIds = publications.map((p) => p.id)
  const translations =
    pubIds.length > 0
      ? await db
          .select()
          .from(schema.publicationTranslations)
          .where(
            sql`${schema.publicationTranslations.publicationId} IN (${sql.join(pubIds, sql`, `)})`
          )
      : []

  const translationsByPub = translations.reduce(
    (acc, t) => {
      if (!acc[t.publicationId]) acc[t.publicationId] = {}
      acc[t.publicationId][t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
      return acc
    },
    {} as Record<
      number,
      Record<string, { title: string; excerpt: string | null; content: string | null }>
    >
  )

  const data = publications.map((pub) => ({
    ...pub,
    fileSize: fileSizeToBytes(pub.fileSize),
    translations: translationsByPub[pub.id] || {}
  }))

  return {
    data,
    meta: buildPaginationMeta(Number(count), page, perPage)
  }
}

async function handleCreate(event: H3Event) {
  requirePermission(event, 'create')

  const user = getCurrentUser(event)
  const body = await readBody(event)

  const input = validateBody(publicationSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.publications.id })
    .from(schema.publications)
    .where(eq(schema.publications.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A publication with this slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO publications (slug, type, published_at, file_url, file_size, thumbnail, is_published, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.type,
        new Date(input.publishedAt),
        input.fileUrl || null,
        input.fileSize || null,
        input.thumbnail || null,
        input.isPublished,
        user.id,
        user.id
      ]
    )

    const pubId = (result as { insertId: number }).insertId

    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO publication_translations (publication_id, locale, title, excerpt, content)
           VALUES (?, ?, ?, ?, ?)`,
          [pubId, locale, trans.title, trans.excerpt || null, trans.content || null]
        )
      }
    }

    await connection.commit()

    const [publication] = await db
      .select()
      .from(schema.publications)
      .where(eq(schema.publications.id, pubId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.publicationTranslations)
      .where(eq(schema.publicationTranslations.publicationId, pubId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
        return acc
      },
      {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
    )

    await logAuditAction(event, 'create', 'publication', pubId, {
      after: sanitizeForAudit({ ...publication, translations: translationsMap })
    })

    return {
      ...publication,
      fileSize: fileSizeToBytes(publication.fileSize),
      translations: translationsMap
    }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:publications', error)
  } finally {
    connection.release()
  }
}
