/**
 * Home page carousel — database side. Loads/saves the configuration and turns
 * it into slides for the public feed (/api/slideshow) and the admin page
 * (/api/admin/carousel). The rules themselves live in carousel.ts.
 */
import type { RowDataPacket } from 'mysql2'
import type { HeroSlide } from '~/types'
import type { AdminCarousel, AdminCarouselCandidate, AdminCarouselSlide } from '~/types/admin'
import { and, asc, desc, eq, gte, inArray, isNull, notInArray } from 'drizzle-orm'
import { getDatabase, getPool, schema } from '../database'
import type { SupportedLocale } from './locale'
import {
  transformEventToSlide,
  transformGalleryToSlide,
  transformNewsToSlide,
  transformReportToSlide
} from './transformSlideshow'
import {
  DEFAULT_CAROUSEL_SETTINGS,
  DEFAULT_FEATURED_ALBUMS,
  isPinActive,
  pickGalleryImages,
  planCarousel,
  todayUtc,
  type CarouselConfig,
  type CarouselItemConfig,
  type CarouselItemType
} from './carousel'
import { logError } from './logger'

type Db = ReturnType<typeof getDatabase>

const SETTINGS_ID = 1

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LoadedCarouselConfig extends CarouselConfig {
  /** True until an admin saves for the first time. */
  isDefault: boolean
}

/** The gallery entries the hardcoded slideshow used, resolved to real ids. */
async function defaultGalleryItems(db: Db): Promise<CarouselItemConfig[]> {
  const items: CarouselItemConfig[] = []

  for (const { slug, positions } of DEFAULT_FEATURED_ALBUMS) {
    const [album] = await db
      .select({ id: schema.galleryAlbums.id })
      .from(schema.galleryAlbums)
      .where(and(eq(schema.galleryAlbums.slug, slug), isNull(schema.galleryAlbums.deletedAt)))
      .limit(1)
    if (!album) continue

    const images = await db
      .select({ id: schema.galleryImages.id })
      .from(schema.galleryImages)
      .where(
        and(eq(schema.galleryImages.albumId, album.id), isNull(schema.galleryImages.deletedAt))
      )
      .orderBy(asc(schema.galleryImages.id))
      .limit(Math.max(...positions) + 1)

    const imageIds = positions.map((p) => images[p]?.id).filter((id) => id !== undefined)
    if (imageIds.length === 0) continue

    items.push({
      type: 'gallery',
      refId: album.id,
      mode: 'pinned',
      pinnedUntil: null,
      imageCount: imageIds.length,
      imageIds
    })
  }

  return items
}

export async function loadCarouselConfig(db: Db = getDatabase()): Promise<LoadedCarouselConfig> {
  const [settings] = await db
    .select()
    .from(schema.carouselSettings)
    .where(eq(schema.carouselSettings.id, SETTINGS_ID))
    .limit(1)

  if (!settings) {
    return {
      isDefault: true,
      settings: { ...DEFAULT_CAROUSEL_SETTINGS },
      items: await defaultGalleryItems(db)
    }
  }

  const rows = await db
    .select()
    .from(schema.carouselItems)
    .orderBy(asc(schema.carouselItems.displayOrder), asc(schema.carouselItems.id))

  return {
    isDefault: false,
    settings: {
      newsCount: settings.newsCount,
      eventsCount: settings.eventsCount,
      reportsCount: settings.reportsCount
    },
    items: rows.map((row) => ({
      type: row.itemType,
      refId: row.refId,
      mode: row.mode,
      pinnedUntil: row.pinnedUntil,
      imageCount: row.imageCount,
      imageIds: Array.isArray(row.imageIds) ? row.imageIds : []
    }))
  }
}

/** Replaces the whole configuration (settings row + every override). */
export async function saveCarouselConfig(
  config: CarouselConfig,
  userId: number,
  db: Db = getDatabase()
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.carouselSettings)
      .values({ id: SETTINGS_ID, ...config.settings, updatedBy: userId })
      .onDuplicateKeyUpdate({ set: { ...config.settings, updatedBy: userId } })

    await tx.delete(schema.carouselItems)

    if (config.items.length > 0) {
      await tx.insert(schema.carouselItems).values(
        config.items.map((item, index) => {
          const isGallery = item.type === 'gallery'
          return {
            itemType: item.type,
            refId: item.refId,
            mode: item.mode,
            pinnedUntil: item.mode === 'pinned' ? item.pinnedUntil : null,
            imageCount: isGallery ? item.imageCount : null,
            imageIds: isGallery ? item.imageIds : null,
            displayOrder: index
          }
        })
      )
    }
  })
}

/** Back to the built-in defaults: drops the settings row and every override. */
export async function resetCarouselConfig(db: Db = getDatabase()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.carouselItems)
    await tx.delete(schema.carouselSettings)
  })
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

export interface ResolvedSlide {
  slide: HeroSlide
  type: CarouselItemType
  /** Article / event / report id, or the album id for gallery slides. */
  refId: number
  source: 'pinned' | 'auto'
}

/** Either specific ids (pinned items) or the automatic picks minus `exclude`. */
type Selection = { ids: number[] } | { limit: number; exclude: number[] }

function inPinOrder<T extends { id: number }>(rows: T[], ids: number[]): T[] {
  return [...rows].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
}

function groupByParent<T extends { locale: string }>(
  rows: T[],
  parentId: (row: T) => number
): Record<number, Record<string, T>> {
  const grouped: Record<number, Record<string, T>> = {}
  for (const row of rows) {
    const id = parentId(row)
    if (!grouped[id]) grouped[id] = {}
    grouped[id][row.locale] = row
  }
  return grouped
}

async function fetchNewsSlides(
  db: Db,
  locale: SupportedLocale,
  selection: Selection
): Promise<HeroSlide[]> {
  const table = schema.newsArticles
  const live = [eq(table.isPublished, true), isNull(table.deletedAt)]

  let articles
  if ('ids' in selection) {
    if (selection.ids.length === 0) return []
    const rows = await db
      .select()
      .from(table)
      .where(and(...live, inArray(table.id, selection.ids)))
    articles = inPinOrder(rows, selection.ids)
  } else {
    if (selection.limit <= 0) return []
    articles = await db
      .select()
      .from(table)
      .where(
        and(...live, selection.exclude.length ? notInArray(table.id, selection.exclude) : undefined)
      )
      .orderBy(desc(table.publishedAt))
      .limit(selection.limit)
  }
  if (articles.length === 0) return []

  const translations = groupByParent(
    await db
      .select()
      .from(schema.newsArticleTranslations)
      .where(
        inArray(
          schema.newsArticleTranslations.newsArticleId,
          articles.map((a) => a.id)
        )
      ),
    (t) => t.newsArticleId
  )

  return articles.map((article) =>
    transformNewsToSlide({ ...article, translations: translations[article.id] || {} }, locale)
  )
}

async function fetchReportSlides(
  db: Db,
  locale: SupportedLocale,
  selection: Selection
): Promise<HeroSlide[]> {
  const table = schema.auditReports
  const live = [eq(table.isPublished, true), isNull(table.deletedAt)]

  let reports
  if ('ids' in selection) {
    if (selection.ids.length === 0) return []
    const rows = await db
      .select()
      .from(table)
      .where(and(...live, inArray(table.id, selection.ids)))
    reports = inPinOrder(rows, selection.ids)
  } else {
    if (selection.limit <= 0) return []
    reports = await db
      .select()
      .from(table)
      .where(
        and(...live, selection.exclude.length ? notInArray(table.id, selection.exclude) : undefined)
      )
      .orderBy(desc(table.publishedAt))
      .limit(selection.limit)
  }
  if (reports.length === 0) return []

  const translations = groupByParent(
    await db
      .select()
      .from(schema.auditReportTranslations)
      .where(
        inArray(
          schema.auditReportTranslations.auditReportId,
          reports.map((r) => r.id)
        )
      ),
    (t) => t.auditReportId
  )

  return reports.map((report) =>
    transformReportToSlide({ ...report, translations: translations[report.id] || {} }, locale)
  )
}

async function fetchEventSlides(
  db: Db,
  locale: SupportedLocale,
  selection: Selection,
  now: Date
): Promise<HeroSlide[]> {
  const table = schema.events
  const live = [eq(table.isPublished, true), isNull(table.deletedAt)]

  let events
  if ('ids' in selection) {
    // A pinned event stays even once it has started — that is the point of a pin.
    if (selection.ids.length === 0) return []
    const rows = await db
      .select()
      .from(table)
      .where(and(...live, inArray(table.id, selection.ids)))
    events = inPinOrder(rows, selection.ids)
  } else {
    if (selection.limit <= 0) return []
    events = await db
      .select()
      .from(table)
      .where(
        and(
          ...live,
          gte(table.startDate, now),
          selection.exclude.length ? notInArray(table.id, selection.exclude) : undefined
        )
      )
      .orderBy(asc(table.startDate))
      .limit(selection.limit)
  }
  if (events.length === 0) return []

  const translations = groupByParent(
    await db
      .select()
      .from(schema.eventTranslations)
      .where(
        inArray(
          schema.eventTranslations.eventId,
          events.map((e) => e.id)
        )
      ),
    (t) => t.eventId
  )

  return events.map((e) => {
    const t = translations[e.id]?.[locale] || translations[e.id]?.en
    return transformEventToSlide({
      id: String(e.id),
      slug: e.slug,
      title: t?.title || e.slug,
      description: t?.description || '',
      startDate: e.startDate.toISOString().split('T')[0],
      thumbnail: e.thumbnail ?? undefined
    })
  })
}

async function fetchGallerySlides(
  db: Db,
  locale: SupportedLocale,
  item: CarouselItemConfig
): Promise<HeroSlide[]> {
  const [album] = await db
    .select()
    .from(schema.galleryAlbums)
    .where(
      and(
        eq(schema.galleryAlbums.id, item.refId),
        eq(schema.galleryAlbums.isPublished, true),
        isNull(schema.galleryAlbums.deletedAt)
      )
    )
    .limit(1)
  if (!album) return []

  const albumImages = await db
    .select()
    .from(schema.galleryImages)
    .where(and(eq(schema.galleryImages.albumId, album.id), isNull(schema.galleryImages.deletedAt)))
    .orderBy(asc(schema.galleryImages.id))

  const pickedIds = pickGalleryImages(
    albumImages.map((img) => img.id),
    item.imageIds,
    item.imageCount ?? item.imageIds.length
  )
  if (pickedIds.length === 0) return []

  const byId = new Map(albumImages.map((img) => [img.id, img]))
  const translations = groupByParent(
    await db
      .select()
      .from(schema.galleryImageTranslations)
      .where(inArray(schema.galleryImageTranslations.imageId, pickedIds)),
    (t) => t.imageId
  )

  const albumTranslations = await db
    .select()
    .from(schema.galleryAlbumTranslations)
    .where(eq(schema.galleryAlbumTranslations.albumId, album.id))
  const albumTitle =
    albumTranslations.find((t) => t.locale === locale)?.title ||
    albumTranslations.find((t) => t.locale === 'en')?.title ||
    album.slug

  return pickedIds.map((id) => {
    const img = byId.get(id)!
    const t = translations[id]?.[locale] || translations[id]?.en
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
}

/** One failing source must not blank the whole carousel. */
async function safely(label: string, load: () => Promise<HeroSlide[]>): Promise<HeroSlide[]> {
  try {
    return await load()
  } catch (error) {
    logError(`carousel:${label}`, error)
    return []
  }
}

/**
 * The slides the home page shows for `config`, in order: news, events,
 * gallery, reports — within a type, kept items first, then the automatic ones.
 */
export async function resolveCarousel(
  config: CarouselConfig,
  locale: SupportedLocale,
  now: Date = new Date(),
  db: Db = getDatabase()
): Promise<ResolvedSlide[]> {
  const { settings } = config
  const plan = planCarousel(config.items, todayUtc(now))
  const pinnedIds = (type: CarouselItemType) => plan.pinned[type].map((item) => item.refId)

  const [newsPinned, newsAuto, eventPinned, eventAuto, reportPinned, reportAuto, ...galleries] =
    await Promise.all([
      safely('news', () => fetchNewsSlides(db, locale, { ids: pinnedIds('news') })),
      safely('news', () =>
        fetchNewsSlides(db, locale, { limit: settings.newsCount, exclude: plan.excluded.news })
      ),
      safely('event', () => fetchEventSlides(db, locale, { ids: pinnedIds('event') }, now)),
      safely('event', () =>
        fetchEventSlides(
          db,
          locale,
          { limit: settings.eventsCount, exclude: plan.excluded.event },
          now
        )
      ),
      safely('report', () => fetchReportSlides(db, locale, { ids: pinnedIds('report') })),
      safely('report', () =>
        fetchReportSlides(db, locale, {
          limit: settings.reportsCount,
          exclude: plan.excluded.report
        })
      ),
      ...plan.pinned.gallery.map((item) =>
        safely('gallery', () => fetchGallerySlides(db, locale, item))
      )
    ])

  const refIdOf = (slide: HeroSlide) => Number(slide.id.slice(slide.id.indexOf('-') + 1))
  const tag = (slides: HeroSlide[], type: CarouselItemType, source: 'pinned' | 'auto') =>
    slides.map((slide): ResolvedSlide => ({ slide, type, refId: refIdOf(slide), source }))

  return [
    ...tag(newsPinned, 'news', 'pinned'),
    ...tag(newsAuto, 'news', 'auto'),
    ...tag(eventPinned, 'event', 'pinned'),
    ...tag(eventAuto, 'event', 'auto'),
    ...galleries.flatMap((slides, i) =>
      slides.map((slide): ResolvedSlide => ({
        slide,
        type: 'gallery',
        refId: plan.pinned.gallery[i].refId,
        source: 'pinned'
      }))
    ),
    ...tag(reportPinned, 'report', 'pinned'),
    ...tag(reportAuto, 'report', 'auto')
  ]
}

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------

/**
 * Where each type's title, image and date live. Table and column names are
 * constants from this map — never request input.
 */
const SUMMARY_SOURCES: Record<
  CarouselItemType,
  { table: string; translations: string; fk: string; date: string; image: string }
> = {
  news: {
    table: 'news_articles',
    translations: 'news_article_translations',
    fk: 'news_article_id',
    date: 'published_at',
    image: 't.thumbnail'
  },
  event: {
    table: 'events',
    translations: 'event_translations',
    fk: 'event_id',
    date: 'start_date',
    image: 't.thumbnail'
  },
  report: {
    table: 'audit_reports',
    translations: 'audit_report_translations',
    fk: 'audit_report_id',
    date: 'published_at',
    image: 't.thumbnail'
  },
  gallery: {
    table: 'gallery_albums',
    translations: 'gallery_album_translations',
    fk: 'album_id',
    date: 'published_at',
    // The album cover, else its first photo
    image: `(SELECT gi.url FROM gallery_images gi
             WHERE gi.album_id = t.id AND gi.deleted_at IS NULL
             ORDER BY (gi.id <=> t.cover_image_id) DESC, gi.id ASC LIMIT 1)`
  }
}

function toDateString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

/**
 * Title / image / date for content items: either specific ids (whatever their
 * state, so the admin can see why a kept item is not showing) or a search over
 * published items for the "add item" picker.
 */
export async function fetchCarouselSummaries(
  type: CarouselItemType,
  filter: { ids: number[] } | { search: string; limit: number }
): Promise<AdminCarouselCandidate[]> {
  const source = SUMMARY_SOURCES[type]
  const params: unknown[] = []
  let where: string
  let limit = ''

  if ('ids' in filter) {
    if (filter.ids.length === 0) return []
    where = 't.id IN (?)'
    params.push(filter.ids)
  } else {
    where = 't.deleted_at IS NULL AND t.is_published = 1'
    if (filter.search) {
      where += ' AND tr.title LIKE ?'
      params.push(`%${filter.search.replace(/[\\%_]/g, '\\$&')}%`)
    }
    limit = 'LIMIT ?'
    params.push(filter.limit)
  }

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT t.id, tr.title, ${source.image} AS image, t.${source.date} AS itemDate,
            t.is_published AS isPublished, t.deleted_at AS deletedAt
     FROM ${source.table} t
     LEFT JOIN ${source.translations} tr ON tr.${source.fk} = t.id AND tr.locale = 'en'
     WHERE ${where}
     ORDER BY t.${source.date} DESC, t.id DESC
     ${limit}`,
    params
  )

  return rows.map((row) => ({
    type,
    refId: Number(row.id),
    title: row.title || `Untitled (#${row.id})`,
    image: row.image || null,
    date: toDateString(row.itemDate),
    available: Boolean(row.isPublished) && !row.deletedAt
  }))
}

/** Every photo of an album, in upload order, for the photo picker. */
export async function fetchCarouselAlbumImages(albumId: number, db: Db = getDatabase()) {
  const images = await db
    .select({ id: schema.galleryImages.id, url: schema.galleryImages.url })
    .from(schema.galleryImages)
    .where(and(eq(schema.galleryImages.albumId, albumId), isNull(schema.galleryImages.deletedAt)))
    .orderBy(asc(schema.galleryImages.id))
  if (images.length === 0) return []

  const translations = await db
    .select({
      imageId: schema.galleryImageTranslations.imageId,
      alt: schema.galleryImageTranslations.alt
    })
    .from(schema.galleryImageTranslations)
    .where(
      and(
        inArray(
          schema.galleryImageTranslations.imageId,
          images.map((img) => img.id)
        ),
        eq(schema.galleryImageTranslations.locale, 'en')
      )
    )
  const altById = new Map(translations.map((t) => [t.imageId, t.alt]))

  return images.map((img, index) => ({
    id: img.id,
    url: img.url,
    alt: altById.get(img.id) || `Photo ${index + 1}`
  }))
}

/** Everything /admin/carousel renders: the configuration plus the live result. */
export async function buildAdminCarousel(now: Date = new Date()): Promise<AdminCarousel> {
  const db = getDatabase()
  const config = await loadCarouselConfig(db)
  const today = todayUtc(now)

  const summaries = new Map<string, AdminCarouselCandidate>()
  await Promise.all(
    (['news', 'event', 'report', 'gallery'] as const).map(async (type) => {
      const ids = config.items.filter((item) => item.type === type).map((item) => item.refId)
      for (const summary of await fetchCarouselSummaries(type, { ids })) {
        summaries.set(`${type}:${summary.refId}`, summary)
      }
    })
  )

  const resolved = await resolveCarousel(config, 'en', now, db)
  const pins = new Map(
    config.items
      .filter((item) => item.mode === 'pinned')
      .map((item) => [`${item.type}:${item.refId}`, item])
  )

  const slides: AdminCarouselSlide[] = resolved.map(({ slide, type, refId, source }) => ({
    id: slide.id,
    type,
    refId,
    source,
    title: slide.title,
    image: slide.image,
    date: slide.publishedAt || null,
    pinnedUntil: source === 'pinned' ? (pins.get(`${type}:${refId}`)?.pinnedUntil ?? null) : null
  }))

  return {
    isDefault: config.isDefault,
    settings: config.settings,
    items: config.items.map((item) => {
      const summary = summaries.get(`${item.type}:${item.refId}`)
      return {
        ...item,
        title: summary?.title ?? `Deleted item (#${item.refId})`,
        image: summary?.image ?? null,
        date: summary?.date ?? null,
        available: summary?.available ?? false,
        expired: item.mode === 'pinned' && !isPinActive(item, today)
      }
    }),
    slides
  }
}
