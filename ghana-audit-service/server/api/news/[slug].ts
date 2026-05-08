import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformNewsArticle } from '../../utils/transformNews'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Article slug or ID is required'
    })
  }

  // Determine if slug is numeric (database ID) or string (slug)
  const isNumericId = /^\d+$/.test(slug)

  // Build where conditions
  const idCondition = isNumericId
    ? eq(schema.newsArticles.id, Number(slug))
    : eq(schema.newsArticles.slug, slug)

  const whereClause = and(
    idCondition,
    eq(schema.newsArticles.isPublished, true),
    isNull(schema.newsArticles.deletedAt)
  )

  // Fetch article
  const [article] = await db.select().from(schema.newsArticles).where(whereClause).limit(1)

  if (!article) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Article not found'
    })
  }

  // Fetch translations for the article
  const translations = await db
    .select()
    .from(schema.newsArticleTranslations)
    .where(eq(schema.newsArticleTranslations.newsArticleId, article.id))

  // Fetch tags for the article
  const articleTags = await db
    .select({
      tagName: schema.tags.name
    })
    .from(schema.newsArticleTags)
    .innerJoin(schema.tags, eq(schema.newsArticleTags.tagId, schema.tags.id))
    .where(eq(schema.newsArticleTags.newsArticleId, article.id))

  // Fetch article images
  const articleImages = await db
    .select()
    .from(schema.newsArticleImages)
    .where(eq(schema.newsArticleImages.newsArticleId, article.id))
    .orderBy(schema.newsArticleImages.sortOrder)

  // Group translations by locale
  const translationsByLocale = translations.reduce(
    (acc, t) => {
      acc[t.locale] = {
        title: t.title,
        excerpt: t.excerpt,
        content: t.content
      }
      return acc
    },
    {} as Record<string, { title: string; excerpt: string; content: string }>
  )

  // Combine article with translations, tags, and images
  const articleWithData = {
    ...article,
    translations: translationsByLocale,
    tags: articleTags.map((t) => t.tagName),
    images: articleImages.map((img) => ({
      url: img.url,
      alt: img.alt,
      caption: img.caption || undefined
    }))
  }

  // Transform to public format
  return transformNewsArticle(articleWithData, locale)
})
