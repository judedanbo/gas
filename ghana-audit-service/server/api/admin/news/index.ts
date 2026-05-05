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
import { newsArticleSchema, validateBody, createValidationError } from '../../../utils/validation'

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

  if (query.includeDeleted !== 'true') {
    conditions.push(isNull(schema.newsArticles.deletedAt))
  }

  if (query.category && typeof query.category === 'string') {
    conditions.push(eq(schema.newsArticles.category, query.category))
  }

  if (query.isPublished === 'true') {
    conditions.push(eq(schema.newsArticles.isPublished, true))
  } else if (query.isPublished === 'false') {
    conditions.push(eq(schema.newsArticles.isPublished, false))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.newsArticles)
    .where(whereClause)

  const articles = await db
    .select()
    .from(schema.newsArticles)
    .where(whereClause)
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(perPage)
    .offset(offset)

  const articleIds = articles.map((a) => a.id)

  // Fetch translations
  const translations =
    articleIds.length > 0
      ? await db
          .select()
          .from(schema.newsArticleTranslations)
          .where(
            sql`${schema.newsArticleTranslations.newsArticleId} IN (${sql.join(articleIds, sql`, `)})`
          )
      : []

  // Fetch tags for each article
  const articleTags =
    articleIds.length > 0
      ? await db
          .select({
            newsArticleId: schema.newsArticleTags.newsArticleId,
            tagId: schema.tags.id,
            tagName: schema.tags.name,
            tagSlug: schema.tags.slug
          })
          .from(schema.newsArticleTags)
          .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
          .where(sql`${schema.newsArticleTags.newsArticleId} IN (${sql.join(articleIds, sql`, `)})`)
      : []

  const translationsByArticle = translations.reduce(
    (acc, t) => {
      if (!acc[t.newsArticleId]) acc[t.newsArticleId] = {}
      acc[t.newsArticleId][t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
      return acc
    },
    {} as Record<
      number,
      Record<string, { title: string; excerpt: string | null; content: string | null }>
    >
  )

  const tagsByArticle = articleTags.reduce(
    (acc, t) => {
      if (!acc[t.newsArticleId]) acc[t.newsArticleId] = []
      acc[t.newsArticleId].push({ id: t.tagId, name: t.tagName, slug: t.tagSlug })
      return acc
    },
    {} as Record<number, { id: number; name: string; slug: string }[]>
  )

  const data = articles.map((article) => ({
    ...article,
    translations: translationsByArticle[article.id] || {},
    tags: tagsByArticle[article.id] || []
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

  const input = validateBody(newsArticleSchema, body)
  const db = getDatabase()

  const [existing] = await db
    .select({ id: schema.newsArticles.id })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.slug, input.slug))
    .limit(1)

  if (existing) {
    throw createValidationError({ slug: 'A news article with this slug already exists' })
  }

  const pool = (await import('../../../database')).getPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [result] = await connection.execute(
      `INSERT INTO news_articles (slug, author, thumbnail, category, published_at, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.slug,
        input.author || null,
        input.thumbnail || null,
        input.category || null,
        new Date(input.publishedAt),
        input.isPublished,
        user.id
      ]
    )

    const articleId = (result as { insertId: number }).insertId

    // Insert translations
    for (const [locale, trans] of Object.entries(input.translations)) {
      if (trans) {
        await connection.execute(
          `INSERT INTO news_article_translations (news_article_id, locale, title, excerpt, content)
           VALUES (?, ?, ?, ?, ?)`,
          [articleId, locale, trans.title, trans.excerpt || null, trans.content || null]
        )
      }
    }

    // Insert tag associations
    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await connection.execute(
          `INSERT INTO news_article_tags (news_article_id, tag_id) VALUES (?, ?)`,
          [articleId, tagId]
        )
      }
    }

    await connection.commit()

    // Fetch created article
    const [article] = await db
      .select()
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, articleId))
      .limit(1)

    const translations = await db
      .select()
      .from(schema.newsArticleTranslations)
      .where(eq(schema.newsArticleTranslations.newsArticleId, articleId))

    const tags = await db
      .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
      .from(schema.newsArticleTags)
      .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
      .where(eq(schema.newsArticleTags.newsArticleId, articleId))

    const translationsMap = translations.reduce(
      (acc, t) => {
        acc[t.locale] = { title: t.title, excerpt: t.excerpt, content: t.content }
        return acc
      },
      {} as Record<string, { title: string; excerpt: string | null; content: string | null }>
    )

    await logAuditAction(event, 'create', 'news_article', articleId, {
      after: sanitizeForAudit({ ...article, translations: translationsMap, tags })
    })

    return { ...article, translations: translationsMap, tags }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
