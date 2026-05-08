import type { NewsArticle } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbNewsArticle {
  id: number
  slug: string
  author: string | null
  thumbnail: string | null
  category: string | null
  publishedAt: Date | string
  isPublished: boolean
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface ArticleImage {
  url: string
  alt: string
  caption?: string
}

interface NewsArticleWithTranslations extends DbNewsArticle {
  translations: Record<string, { title: string; excerpt: string; content: string }>
  tags?: string[]
  images?: ArticleImage[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

/**
 * Transform a database news article to public API format
 */
export function transformNewsArticle(
  article: NewsArticleWithTranslations,
  locale: SupportedLocale = 'en'
): NewsArticle {
  // Get translation for requested locale, fallback to English
  const translation = article.translations[locale] ||
    article.translations.en || {
      title: 'Untitled Article',
      excerpt: '',
      content: ''
    }

  return {
    id: String(article.id),
    title: translation.title,
    slug: article.slug,
    content: translation.content,
    excerpt: stripHtml(translation.excerpt),
    publishedAt: formatDate(article.publishedAt),
    author: article.author || undefined,
    thumbnail: article.thumbnail || undefined,
    category: article.category || undefined,
    tags: article.tags,
    images: article.images?.length ? article.images : undefined
  }
}

/**
 * Transform an array of database news articles to public API format
 */
export function transformNewsArticles(
  articles: NewsArticleWithTranslations[],
  locale: SupportedLocale = 'en'
): NewsArticle[] {
  return articles.map((article) => transformNewsArticle(article, locale))
}
