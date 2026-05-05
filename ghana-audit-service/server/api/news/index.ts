import type { NewsArticle, PaginatedResponse } from '~/types'
import { eq, and, isNull, sql, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { buildPaginationMeta } from '../../utils/adminHelpers'
import { transformNewsArticles } from '../../utils/transformNews'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<PaginatedResponse<NewsArticle>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Parse pagination
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 10))
  const offset = (page - 1) * perPage

  // Build where conditions - only published, non-deleted articles
  const conditions = [
    eq(schema.newsArticles.isPublished, true),
    isNull(schema.newsArticles.deletedAt)
  ]

  // Filter by category
  if (query.category && typeof query.category === 'string') {
    conditions.push(eq(schema.newsArticles.category, query.category))
  }

  const whereClause = and(...conditions)

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.newsArticles)
    .where(whereClause)

  // Fetch articles
  const articles = await db
    .select()
    .from(schema.newsArticles)
    .where(whereClause)
    .orderBy(desc(schema.newsArticles.publishedAt))
    .limit(perPage)
    .offset(offset)

  // Fetch translations for each article
  const articleIds = articles.map((a) => a.id)
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
            tagName: schema.tags.name
          })
          .from(schema.newsArticleTags)
          .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
          .where(sql`${schema.newsArticleTags.newsArticleId} IN (${sql.join(articleIds, sql`, `)})`)
      : []

  // Group translations by article
  const translationsByArticle = translations.reduce(
    (acc, t) => {
      if (!acc[t.newsArticleId]) {
        acc[t.newsArticleId] = {}
      }
      acc[t.newsArticleId][t.locale] = {
        title: t.title,
        excerpt: t.excerpt,
        content: t.content
      }
      return acc
    },
    {} as Record<number, Record<string, { title: string; excerpt: string; content: string }>>
  )

  // Group tags by article
  const tagsByArticle = articleTags.reduce(
    (acc, t) => {
      if (!acc[t.newsArticleId]) {
        acc[t.newsArticleId] = []
      }
      acc[t.newsArticleId].push(t.tagName)
      return acc
    },
    {} as Record<number, string[]>
  )

  // Combine articles with translations and tags
  const articlesWithData = articles.map((article) => ({
    ...article,
    translations: translationsByArticle[article.id] || {},
    tags: tagsByArticle[article.id] || []
  }))

  // Apply search filter (after combining with translations)
  let filteredArticles = articlesWithData
  if (query.search && typeof query.search === 'string') {
    const searchTerm = query.search.toLowerCase()
    filteredArticles = articlesWithData.filter((a) => {
      const translation = a.translations[locale] || a.translations.en || {}
      const title = (translation.title || '').toLowerCase()
      const excerpt = (translation.excerpt || '').toLowerCase()
      const content = (translation.content || '').toLowerCase()
      return (
        title.includes(searchTerm) || excerpt.includes(searchTerm) || content.includes(searchTerm)
      )
    })
  }

  // Transform to public format
  const data = transformNewsArticles(filteredArticles, locale)

  // Adjust count for search filter
  const total = query.search ? filteredArticles.length : Number(count)

  return {
    data,
    meta: buildPaginationMeta(total, page, perPage)
  }
})
