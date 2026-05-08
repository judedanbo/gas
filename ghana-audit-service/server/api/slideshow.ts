import type { HeroSlide } from '~/types'
import { eq, and, isNull, desc, asc, gte, sql } from 'drizzle-orm'
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

const FEATURED_ALBUMS = [
  { slug: '2026-thanksgiving-service', count: 1, offset: 0 },
  { slug: '2026-thanksgiving-service', count: 1, offset: 3 },
  { slug: 'uniting-for-a-transparent-ghana-audit-service-may-day-celebration', count: 2, offset: 3 }
]

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

async function fetchLatestReports(locale: 'en' | 'ak') {
  try {
    const db = getDatabase()
    const reports = await db
      .select()
      .from(schema.auditReports)
      .where(and(eq(schema.auditReports.isPublished, true), isNull(schema.auditReports.deletedAt)))
      .orderBy(desc(schema.auditReports.publishedAt))
      .limit(2)

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

async function fetchUpcomingEvents(locale: 'en' | 'ak') {
  try {
    const db = getDatabase()
    const now = new Date()

    const dbEvents = await db
      .select()
      .from(schema.events)
      .where(
        and(
          eq(schema.events.isPublished, true),
          isNull(schema.events.deletedAt),
          gte(schema.events.startDate, now)
        )
      )
      .orderBy(asc(schema.events.startDate))
      .limit(2)

    if (dbEvents.length === 0) return []

    const eventIds = dbEvents.map((e) => e.id)
    const translations = await db
      .select()
      .from(schema.eventTranslations)
      .where(sql`${schema.eventTranslations.eventId} IN (${sql.join(eventIds, sql`, `)})`)

    const translationsByEvent = translations.reduce(
      (acc, t) => {
        if (!acc[t.eventId]) acc[t.eventId] = {}
        acc[t.eventId][t.locale] = {
          title: t.title,
          description: t.description,
          location: t.location
        }
        return acc
      },
      {} as Record<
        number,
        Record<string, { title: string; description: string; location: string | null }>
      >
    )

    return dbEvents.map((e) => {
      const t = translationsByEvent[e.id]?.[locale] || translationsByEvent[e.id]?.en
      return transformEventToSlide({
        id: String(e.id),
        slug: e.slug,
        title: t?.title || e.slug,
        description: t?.description || '',
        startDate: e.startDate.toISOString().split('T')[0],
        thumbnail: e.thumbnail ?? undefined
      })
    })
  } catch {
    return []
  }
}

async function fetchGallerySlides(
  locale: 'en' | 'ak',
  albumSlug: string,
  count: number,
  offset: number
): Promise<HeroSlide[]> {
  try {
    const db = getDatabase()

    const album = await db
      .select()
      .from(schema.galleryAlbums)
      .where(
        and(
          eq(schema.galleryAlbums.slug, albumSlug),
          eq(schema.galleryAlbums.isPublished, true),
          isNull(schema.galleryAlbums.deletedAt)
        )
      )
      .limit(1)

    if (album.length === 0) return []

    const images = await db
      .select()
      .from(schema.galleryImages)
      .where(
        and(
          eq(schema.galleryImages.albumId, album[0].id),
          isNull(schema.galleryImages.deletedAt)
        )
      )
      .orderBy(asc(schema.galleryImages.id))
      .limit(count + offset)

    const selected = images.slice(offset)
    if (selected.length === 0) return []

    const imageIds = selected.map((img) => img.id)
    const translations = await db
      .select()
      .from(schema.galleryImageTranslations)
      .where(
        sql`${schema.galleryImageTranslations.imageId} IN (${sql.join(imageIds, sql`, `)})`
      )

    const albumTranslations = await db
      .select()
      .from(schema.galleryAlbumTranslations)
      .where(eq(schema.galleryAlbumTranslations.albumId, album[0].id))

    const albumTitle =
      albumTranslations.find((t) => t.locale === locale)?.title ||
      albumTranslations.find((t) => t.locale === 'en')?.title ||
      albumSlug

    const translationsByImage = translations.reduce(
      (acc, t) => {
        if (!acc[t.imageId]) acc[t.imageId] = {}
        acc[t.imageId][t.locale] = { alt: t.alt, caption: t.caption }
        return acc
      },
      {} as Record<number, Record<string, { alt: string; caption: string | null }>>
    )

    return selected.map((img) => {
      const t = translationsByImage[img.id]?.[locale] || translationsByImage[img.id]?.en
      return transformGalleryToSlide(
        {
          id: String(img.id),
          url: img.url,
          alt: t?.alt || albumTitle,
          caption: t?.caption || albumTitle,
          uploadedAt: img.uploadedAt.toISOString().split('T')[0]
        },
        albumTitle
      )
    })
  } catch {
    return []
  }
}

export default defineEventHandler(async (event) => {
  const locale = getLocaleFromRequest(event)

  const galleryPromises = FEATURED_ALBUMS.map((a) =>
    fetchGallerySlides(locale, a.slug, a.count, a.offset)
  )

  const [newsSlides, reportSlides, eventSlides, ...galleryResults] = await Promise.all([
    fetchLatestNews(locale),
    fetchLatestReports(locale),
    fetchUpcomingEvents(locale),
    ...galleryPromises
  ])

  const gallerySlides = galleryResults.flat()

  const slides: HeroSlide[] = [...newsSlides, ...eventSlides, ...gallerySlides, ...reportSlides]

  if (slides.length === 0) {
    return { slides: [STATIC_FALLBACK] }
  }

  return { slides }
})
