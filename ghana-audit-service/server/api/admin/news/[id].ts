import type { H3Event } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission, getCurrentUser, isAdmin } from '../../../utils/adminHelpers'
import { logAuditAction, createChangesObject, sanitizeForAudit } from '../../../utils/auditLogger'
import { newsArticleSchema, validateBody, createValidationError } from '../../../utils/validation'
import { safeError } from '../../../utils/errors'

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

  const conditions = [eq(schema.newsArticles.id, id)]
  if (!isAdmin(event)) conditions.push(isNull(schema.newsArticles.deletedAt))

  const [article] = await db
    .select()
    .from(schema.newsArticles)
    .where(and(...conditions))
    .limit(1)

  if (!article) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'News article not found'
    })
  }

  const translations = await db
    .select()
    .from(schema.newsArticleTranslations)
    .where(eq(schema.newsArticleTranslations.newsArticleId, id))

  const tags = await db
    .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.newsArticleTags)
    .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
    .where(eq(schema.newsArticleTags.newsArticleId, id))

  const translationsMap = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
      return acc
    },
    {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
  )

  return { ...article, translations: translationsMap, tags }
}

async function handleUpdate(event: H3Event, id: number) {
  requirePermission(event, 'update')

  getCurrentUser(event) // Verify user is authenticated
  const body = await readBody(event)
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.newsArticles)
    .where(and(eq(schema.newsArticles.id, id), isNull(schema.newsArticles.deletedAt)))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'News article not found'
    })
  }

  const existingTranslations = await db
    .select()
    .from(schema.newsArticleTranslations)
    .where(eq(schema.newsArticleTranslations.newsArticleId, id))

  const existingTags = await db
    .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.newsArticleTags)
    .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
    .where(eq(schema.newsArticleTags.newsArticleId, id))

  const existingTransMap = existingTranslations.reduce(
    (acc, t) => {
      acc[t.locale] = { id: t.id, title: t.title, excerpt: t.excerpt, content: t.content }
      return acc
    },
    {} as Record<
      string,
      { id: number; title: string; excerpt: string | null; content: string | null }
    >
  )

  const input = validateBody(newsArticleSchema, body)

  if (input.slug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.newsArticles.id })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.slug, input.slug))
      .limit(1)

    if (duplicate) {
      throw createValidationError({ slug: 'A news article with this slug already exists' })
    }
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE news_articles SET slug = ?, author = ?, thumbnail = ?, category = ?, published_at = ?, is_published = ? WHERE id = ?`,
      [
        input.slug,
        input.author || null,
        input.thumbnail || null,
        input.category || null,
        new Date(input.publishedAt),
        input.isPublished,
        id
      ]
    )

    // Update translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        const existingTrans = existingTransMap[locale]
        if (existingTrans) {
          await connection.execute(
            `UPDATE news_article_translations SET title = ?, excerpt = ?, content = ? WHERE id = ?`,
            [trans.title, trans.excerpt || null, trans.content || null, existingTrans.id]
          )
        } else {
          await connection.execute(
            `INSERT INTO news_article_translations (news_article_id, locale, title, excerpt, content) VALUES (?, ?, ?, ?, ?)`,
            [id, locale, trans.title, trans.excerpt || null, trans.content || null]
          )
        }
      }
    }

    // Update tags: delete existing and insert new
    await connection.execute(`DELETE FROM news_article_tags WHERE news_article_id = ?`, [id])

    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await connection.execute(
          `INSERT INTO news_article_tags (news_article_id, tag_id) VALUES (?, ?)`,
          [id, tagId]
        )
      }
    }

    await connection.commit()

    // Fetch updated article
    const [updated] = await db
      .select()
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, id))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.newsArticleTranslations)
      .where(eq(schema.newsArticleTranslations.newsArticleId, id))

    const tags = await db
      .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
      .from(schema.newsArticleTags)
      .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
      .where(eq(schema.newsArticleTags.newsArticleId, id))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
        return acc
      },
      {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
    )

    const before = sanitizeForAudit({
      ...existing,
      translations: existingTransMap,
      tags: existingTags
    })
    const after = sanitizeForAudit({ ...updated, translations: translationsMap, tags })
    const changes = createChangesObject(
      before as Record<string, unknown>,
      after as Record<string, unknown>
    )
    await logAuditAction(event, 'update', 'news_article', id, changes)

    return { ...updated, translations: translationsMap, tags }
  } catch (error) {
    await connection.rollback()
    throw safeError('admin:news', error)
  } finally {
    connection.release()
  }
}

async function handleDelete(event: H3Event, id: number) {
  requirePermission(event, 'delete')
  const db = getDatabase()

  const [existing] = await db
    .select()
    .from(schema.newsArticles)
    .where(and(eq(schema.newsArticles.id, id), isNull(schema.newsArticles.deletedAt)))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'News article not found'
    })
  }

  await db
    .update(schema.newsArticles)
    .set({ deletedAt: new Date() })
    .where(eq(schema.newsArticles.id, id))

  await logAuditAction(event, 'delete', 'news_article', id, {
    before: sanitizeForAudit(existing as Record<string, unknown>)
  })

  return { success: true, message: 'News article deleted successfully' }
}
