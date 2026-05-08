import type { HeroSlide, Event, GalleryImage } from '~/types'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { getLocaleFromRequest } from '../utils/locale'
import {
  transformNewsToSlide,
  transformEventToSlide,
  transformGalleryToSlide,
  transformReportToSlide
} from '../utils/transformSlideshow'

const STATIC_FALLBACK: HeroSlide = {
  id: 'fallback-1',
  type: 'news',
  image: '/images/hero/default-news.svg',
  imageAlt: 'Ghana Audit Service',
  title: 'Ghana Audit Service',
  excerpt: 'Protecting the Public Purse Through Accountability and Transparency',
  linkUrl: '/reports',
  linkLabel: 'slideshow.viewReport',
  categoryLabel: 'slideshow.news'
}

async function fetchLatestNews(locale: 'en' | 'ak') {
  try {
    const db = getDatabase()
    const articles = await db
      .select()
      .from(schema.newsArticles)
      .where(and(eq(schema.newsArticles.isPublished, true), isNull(schema.newsArticles.deletedAt)))
      .orderBy(desc(schema.newsArticles.publishedAt))
      .limit(2)

    if (articles.length === 0) return []

    const articleIds = articles.map((a) => a.id)
    const translations = await db
      .select()
      .from(schema.newsArticleTranslations)
      .where(
        sql`${schema.newsArticleTranslations.newsArticleId} IN (${sql.join(articleIds, sql`, `)})`
      )

    const translationsByArticle = translations.reduce(
      (acc, t) => {
        if (!acc[t.newsArticleId]) acc[t.newsArticleId] = {}
        acc[t.newsArticleId][t.locale] = { title: t.title, excerpt: t.excerpt }
        return acc
      },
      {} as Record<number, Record<string, { title: string; excerpt: string }>>
    )

    return articles.map((article) =>
      transformNewsToSlide(
        { ...article, translations: translationsByArticle[article.id] || {} },
        locale
      )
    )
  } catch {
    return []
  }
}

async function fetchLatestReport(locale: 'en' | 'ak') {
  try {
    const db = getDatabase()
    const reports = await db
      .select()
      .from(schema.auditReports)
      .where(and(eq(schema.auditReports.isPublished, true), isNull(schema.auditReports.deletedAt)))
      .orderBy(desc(schema.auditReports.publishedAt))
      .limit(1)

    if (reports.length === 0) return []

    const reportIds = reports.map((r) => r.id)
    const translations = await db
      .select()
      .from(schema.auditReportTranslations)
      .where(
        sql`${schema.auditReportTranslations.auditReportId} IN (${sql.join(reportIds, sql`, `)})`
      )

    const translationsByReport = translations.reduce(
      (acc, t) => {
        if (!acc[t.auditReportId]) acc[t.auditReportId] = {}
        acc[t.auditReportId][t.locale] = { title: t.title, summary: t.summary }
        return acc
      },
      {} as Record<number, Record<string, { title: string; summary: string | null }>>
    )

    return reports.map((report) =>
      transformReportToSlide(
        { ...report, translations: translationsByReport[report.id] || {} },
        locale
      )
    )
  } catch {
    return []
  }
}

async function fetchLatestEvent(): Promise<HeroSlide[]> {
  try {
    const { data } = await $fetch<Event[]>('/api/events', {
      query: { filter: 'upcoming' }
    }).then((events) => ({ data: events }))

    if (!data || data.length === 0) return []
    return [transformEventToSlide(data[0])]
  } catch {
    return []
  }
}

async function fetchLatestGallery(): Promise<HeroSlide[]> {
  try {
    const { images } = await $fetch<{ images: GalleryImage[] }>('/api/gallery')
    if (!images || images.length === 0) return []
    return images.slice(0, 2).map(transformGalleryToSlide)
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const locale = getLocaleFromRequest(event)

  const [newsSlides, reportSlides, eventSlides, gallerySlides] = await Promise.all([
    fetchLatestNews(locale),
    fetchLatestReport(locale),
    fetchLatestEvent(),
    fetchLatestGallery()
  ])

  const slides: HeroSlide[] = [...newsSlides, ...eventSlides, ...gallerySlides, ...reportSlides]

  if (slides.length === 0) {
    return { slides: [STATIC_FALLBACK] }
  }

  return { slides }
})
