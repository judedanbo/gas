import { and, eq, gte, isNull, like, lte, or, inArray, type SQL } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import type { PaginatedResponse, SearchResult } from '~/types'
import type { SupportedLocale } from './locale'
import { STATIC_SEARCHABLE_PAGES } from './staticSearchablePages'

export const MIN_QUERY_LENGTH = 2
export const MAX_PER_PAGE = 50
const MAX_PER_DOMAIN = 200

export type SearchableType = SearchResult['type']

export const SUPPORTED_TYPES: ReadonlyArray<SearchableType> = [
  'report',
  'publication',
  'news',
  'event',
  'tender',
  'vacancy',
  'video',
  'gallery',
  'team',
  'office',
  'page'
]

export interface SearchOptions {
  query: string
  types?: ReadonlyArray<SearchableType>
  dateFrom?: string
  dateTo?: string
  locale: SupportedLocale
  page: number
  perPage: number
}

interface RawHit {
  id: string
  type: SearchableType
  title: string
  body: string
  url: string
  publishedAt?: string
  score: number
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function toISODate(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildExcerpt(body: string, term: string, max = 200): string {
  if (!body) return ''
  const plain = stripHtml(body)
  const lower = plain.toLowerCase()
  const idx = lower.indexOf(term.toLowerCase())
  if (idx === -1) {
    const head = plain.slice(0, max).trim()
    return plain.length > max ? `${head}…` : head
  }
  const window = Math.max(0, max - term.length)
  const half = Math.floor(window / 2)
  const start = Math.max(0, idx - half)
  const end = Math.min(plain.length, start + max)
  const snippet = plain.slice(start, end).trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < plain.length ? '…' : ''
  return `${prefix}${snippet}${suffix}`
}

interface TranslationRow {
  baseId: number
  slug?: string
  publishedAt: Date | string | null
  locale: string
  title: string
  body: string | null
  type?: string
}

function preferLocale(rows: TranslationRow[], requested: SupportedLocale): TranslationRow[] {
  const byId = new Map<number, TranslationRow>()
  for (const row of rows) {
    const existing = byId.get(row.baseId)
    if (!existing) {
      byId.set(row.baseId, row)
      continue
    }
    if (existing.locale !== requested && row.locale === requested) {
      byId.set(row.baseId, row)
    }
  }
  return Array.from(byId.values())
}

function scoreRow(
  row: TranslationRow,
  termLower: string
): { titleHit: boolean; bodyHit: boolean; score: number } {
  const titleHit = row.title.toLowerCase().includes(termLower)
  const bodyHit = !!row.body && row.body.toLowerCase().includes(termLower)
  return { titleHit, bodyHit, score: (titleHit ? 3 : 0) + (bodyHit ? 1 : 0) }
}

const PUBLICATION_TYPE_PATHS: Record<string, string> = {
  'press-statement': 'press-statements',
  bulletin: 'bulletins',
  guideline: 'guidelines',
  manual: 'amis-manuals',
  strategy: 'pfm-strategy',
  law: 'applicable-laws'
}

const PUBLICATION_TYPES_WITH_SLUG_ROUTE = new Set(['press-statement', 'bulletin', 'guideline', 'manual'])

function publicationUrl(type: string | undefined, slug: string | undefined): string {
  const segment = type ? (PUBLICATION_TYPE_PATHS[type] ?? '') : ''
  if (segment && slug && PUBLICATION_TYPES_WITH_SLUG_ROUTE.has(type ?? '')) {
    return `/publications/${segment}/${slug}`
  }
  if (segment) return `/publications/${segment}`
  return '/publications'
}

type Db = ReturnType<typeof getDatabase>

async function searchReports(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  const conditions: SQL[] = [
    eq(schema.auditReports.isPublished, true),
    isNull(schema.auditReports.deletedAt),
    inArray(schema.auditReportTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.auditReportTranslations.title, pattern),
      like(schema.auditReportTranslations.summary, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.auditReports.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.auditReports.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.auditReports.id,
      slug: schema.auditReports.slug,
      publishedAt: schema.auditReports.publishedAt,
      locale: schema.auditReportTranslations.locale,
      title: schema.auditReportTranslations.title,
      body: schema.auditReportTranslations.summary
    })
    .from(schema.auditReports)
    .innerJoin(
      schema.auditReportTranslations,
      eq(schema.auditReportTranslations.auditReportId, schema.auditReports.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(rows as TranslationRow[], opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `report-${row.baseId}`,
      type: 'report',
      title: row.title,
      body: row.body ?? '',
      url: `/reports/${row.slug}`,
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchPublications(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  const conditions: SQL[] = [
    eq(schema.publications.isPublished, true),
    isNull(schema.publications.deletedAt),
    inArray(schema.publicationTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.publicationTranslations.title, pattern),
      like(schema.publicationTranslations.excerpt, pattern),
      like(schema.publicationTranslations.content, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.publications.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.publications.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.publications.id,
      slug: schema.publications.slug,
      publishedAt: schema.publications.publishedAt,
      type: schema.publications.type,
      locale: schema.publicationTranslations.locale,
      title: schema.publicationTranslations.title,
      excerpt: schema.publicationTranslations.excerpt,
      content: schema.publicationTranslations.content
    })
    .from(schema.publications)
    .innerJoin(
      schema.publicationTranslations,
      eq(schema.publicationTranslations.publicationId, schema.publications.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const translationRows: TranslationRow[] = rows.map((r) => ({
    baseId: r.baseId,
    slug: r.slug,
    publishedAt: r.publishedAt,
    locale: r.locale,
    title: r.title,
    body: r.excerpt ?? r.content ?? null,
    type: r.type
  }))

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(translationRows, opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `publication-${row.baseId}`,
      type: 'publication',
      title: row.title,
      body: row.body ?? '',
      url: publicationUrl(row.type, row.slug),
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchNews(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  const conditions: SQL[] = [
    eq(schema.newsArticles.isPublished, true),
    isNull(schema.newsArticles.deletedAt),
    inArray(schema.newsArticleTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.newsArticleTranslations.title, pattern),
      like(schema.newsArticleTranslations.excerpt, pattern),
      like(schema.newsArticleTranslations.content, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.newsArticles.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.newsArticles.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.newsArticles.id,
      slug: schema.newsArticles.slug,
      publishedAt: schema.newsArticles.publishedAt,
      locale: schema.newsArticleTranslations.locale,
      title: schema.newsArticleTranslations.title,
      excerpt: schema.newsArticleTranslations.excerpt,
      content: schema.newsArticleTranslations.content
    })
    .from(schema.newsArticles)
    .innerJoin(
      schema.newsArticleTranslations,
      eq(schema.newsArticleTranslations.newsArticleId, schema.newsArticles.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const translationRows: TranslationRow[] = rows.map((r) => ({
    baseId: r.baseId,
    slug: r.slug,
    publishedAt: r.publishedAt,
    locale: r.locale,
    title: r.title,
    body: r.excerpt ?? r.content ?? null
  }))

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(translationRows, opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `news-${row.baseId}`,
      type: 'news',
      title: row.title,
      body: row.body ?? '',
      url: `/media/news/${row.slug}`,
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchEvents(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  const conditions: SQL[] = [
    eq(schema.events.isPublished, true),
    isNull(schema.events.deletedAt),
    inArray(schema.eventTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.eventTranslations.title, pattern),
      like(schema.eventTranslations.description, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.events.startDate, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.events.startDate, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.events.id,
      slug: schema.events.slug,
      publishedAt: schema.events.startDate,
      locale: schema.eventTranslations.locale,
      title: schema.eventTranslations.title,
      body: schema.eventTranslations.description
    })
    .from(schema.events)
    .innerJoin(
      schema.eventTranslations,
      eq(schema.eventTranslations.eventId, schema.events.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(rows as TranslationRow[], opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `event-${row.baseId}`,
      type: 'event',
      title: row.title,
      body: row.body ?? '',
      url: `/media/events/${row.slug}`,
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchTenders(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  // Tenders have no isPublished column; filter out cancelled status instead.
  const conditions: SQL[] = [
    isNull(schema.tenders.deletedAt),
    inArray(schema.tenderTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.tenderTranslations.title, pattern),
      like(schema.tenderTranslations.description, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.tenders.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.tenders.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.tenders.id,
      slug: schema.tenders.slug,
      publishedAt: schema.tenders.publishedAt,
      status: schema.tenders.status,
      locale: schema.tenderTranslations.locale,
      title: schema.tenderTranslations.title,
      body: schema.tenderTranslations.description
    })
    .from(schema.tenders)
    .innerJoin(
      schema.tenderTranslations,
      eq(schema.tenderTranslations.tenderId, schema.tenders.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const visible = rows.filter((r) => r.status !== 'cancelled')
  const preferred = preferLocale(visible as TranslationRow[], opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `tender-${row.baseId}`,
      type: 'tender',
      title: row.title,
      body: row.body ?? '',
      // Per-tender detail page is a follow-up; link to the list page for now.
      url: '/careers/tenders',
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchVacancies(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  const conditions: SQL[] = [
    eq(schema.vacancies.isActive, true),
    isNull(schema.vacancies.deletedAt),
    inArray(schema.vacancyTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.vacancyTranslations.title, pattern),
      like(schema.vacancyTranslations.description, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.vacancies.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.vacancies.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.vacancies.id,
      slug: schema.vacancies.slug,
      publishedAt: schema.vacancies.publishedAt,
      locale: schema.vacancyTranslations.locale,
      title: schema.vacancyTranslations.title,
      body: schema.vacancyTranslations.description
    })
    .from(schema.vacancies)
    .innerJoin(
      schema.vacancyTranslations,
      eq(schema.vacancyTranslations.vacancyId, schema.vacancies.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(rows as TranslationRow[], opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `vacancy-${row.baseId}`,
      type: 'vacancy',
      title: row.title,
      body: row.body ?? '',
      url: `/careers/${row.slug}`,
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchVideos(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  // Videos have no slug column — fall back to id when constructing identifiers.
  const conditions: SQL[] = [
    eq(schema.videos.isPublished, true),
    isNull(schema.videos.deletedAt),
    inArray(schema.videoTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.videoTranslations.title, pattern),
      like(schema.videoTranslations.description, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.videos.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.videos.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.videos.id,
      publishedAt: schema.videos.publishedAt,
      locale: schema.videoTranslations.locale,
      title: schema.videoTranslations.title,
      body: schema.videoTranslations.description
    })
    .from(schema.videos)
    .innerJoin(
      schema.videoTranslations,
      eq(schema.videoTranslations.videoId, schema.videos.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(rows as TranslationRow[], opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `video-${row.baseId}`,
      type: 'video',
      title: row.title,
      body: row.body ?? '',
      // Per-video detail page is a follow-up; link to the list page for now.
      url: '/media/videos',
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchGallery(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  const conditions: SQL[] = [
    eq(schema.galleryAlbums.isPublished, true),
    isNull(schema.galleryAlbums.deletedAt),
    inArray(schema.galleryAlbumTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.galleryAlbumTranslations.title, pattern),
      like(schema.galleryAlbumTranslations.description, pattern)
    ) as SQL
  ]
  if (opts.dateFrom) conditions.push(gte(schema.galleryAlbums.publishedAt, new Date(opts.dateFrom)))
  if (opts.dateTo) conditions.push(lte(schema.galleryAlbums.publishedAt, new Date(opts.dateTo)))

  const rows = await db
    .select({
      baseId: schema.galleryAlbums.id,
      slug: schema.galleryAlbums.slug,
      publishedAt: schema.galleryAlbums.publishedAt,
      locale: schema.galleryAlbumTranslations.locale,
      title: schema.galleryAlbumTranslations.title,
      body: schema.galleryAlbumTranslations.description
    })
    .from(schema.galleryAlbums)
    .innerJoin(
      schema.galleryAlbumTranslations,
      eq(schema.galleryAlbumTranslations.albumId, schema.galleryAlbums.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(rows as TranslationRow[], opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `gallery-${row.baseId}`,
      type: 'gallery',
      title: row.title,
      body: row.body ?? '',
      url: `/media/gallery?album=${row.slug ?? ''}`,
      publishedAt: toISODate(row.publishedAt),
      score
    })
  }
  return hits
}

async function searchTeam(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  // Team has no publishedAt and no description body; matches go against name, title, and bio.
  const conditions: SQL[] = [
    eq(schema.managementTeam.isActive, true),
    isNull(schema.managementTeam.deletedAt),
    inArray(schema.managementTeamTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.managementTeamTranslations.name, pattern),
      like(schema.managementTeamTranslations.title, pattern),
      like(schema.managementTeamTranslations.bio, pattern)
    ) as SQL
  ]

  const rows = await db
    .select({
      baseId: schema.managementTeam.id,
      slug: schema.managementTeam.slug,
      locale: schema.managementTeamTranslations.locale,
      name: schema.managementTeamTranslations.name,
      role: schema.managementTeamTranslations.title,
      bio: schema.managementTeamTranslations.bio
    })
    .from(schema.managementTeam)
    .innerJoin(
      schema.managementTeamTranslations,
      eq(schema.managementTeamTranslations.managementTeamId, schema.managementTeam.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const translationRows: TranslationRow[] = rows.map((r) => ({
    baseId: r.baseId,
    slug: r.slug,
    publishedAt: null,
    locale: r.locale,
    // Compose name + role so scoreRow's title match covers either signal.
    title: `${r.name} — ${r.role}`,
    body: r.bio ?? null
  }))

  const termLower = opts.query.toLowerCase()
  const preferred = preferLocale(translationRows, opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `team-${row.baseId}`,
      type: 'team',
      title: row.title,
      body: row.body ?? '',
      url: `/about/management-team/${row.slug ?? ''}`,
      score
    })
  }
  return hits
}

async function searchOffices(db: Db, opts: SearchOptions, pattern: string): Promise<RawHit[]> {
  // Offices have no isPublished column and no publishedAt; match name, address, and region.
  const conditions: SQL[] = [
    isNull(schema.offices.deletedAt),
    inArray(schema.officeTranslations.locale, [opts.locale, 'en']),
    or(
      like(schema.officeTranslations.name, pattern),
      like(schema.officeTranslations.address, pattern),
      like(schema.offices.region, pattern)
    ) as SQL
  ]

  const rows = await db
    .select({
      baseId: schema.offices.id,
      region: schema.offices.region,
      locale: schema.officeTranslations.locale,
      name: schema.officeTranslations.name,
      address: schema.officeTranslations.address
    })
    .from(schema.offices)
    .innerJoin(
      schema.officeTranslations,
      eq(schema.officeTranslations.officeId, schema.offices.id)
    )
    .where(and(...conditions))
    .limit(MAX_PER_DOMAIN)

  const termLower = opts.query.toLowerCase()
  const translationRows: TranslationRow[] = rows.map((r) => ({
    baseId: r.baseId,
    publishedAt: null,
    locale: r.locale,
    title: r.name,
    body: [r.region, r.address].filter(Boolean).join(' — ')
  }))
  const preferred = preferLocale(translationRows, opts.locale)
  const hits: RawHit[] = []
  for (const row of preferred) {
    const { score } = scoreRow(row, termLower)
    if (score === 0) continue
    hits.push({
      id: `office-${row.baseId}`,
      type: 'office',
      title: row.title,
      body: row.body ?? '',
      // Regional office data lives on the Contact page (no per-office route exists).
      url: '/contact',
      score
    })
  }
  return hits
}

function searchStaticPages(opts: SearchOptions): RawHit[] {
  const termLower = opts.query.toLowerCase()
  const hits: RawHit[] = []
  for (const entry of STATIC_SEARCHABLE_PAGES) {
    const titleEn = entry.title.en
    const descEn = entry.description.en
    const titleLocale = entry.title[opts.locale] ?? titleEn
    const descLocale = entry.description[opts.locale] ?? descEn
    // Match against both locale and English strings so an English-only term still
    // surfaces the page when the user is in Akan — same fallback model as the DB
    // searchers, which join on `[locale, 'en']`.
    const titleHit =
      titleLocale.toLowerCase().includes(termLower) ||
      titleEn.toLowerCase().includes(termLower)
    const bodyHit =
      descLocale.toLowerCase().includes(termLower) || descEn.toLowerCase().includes(termLower)
    if (!titleHit && !bodyHit) continue
    hits.push({
      id: `page-${entry.id}`,
      type: 'page',
      title: titleLocale,
      body: descLocale,
      url: entry.path,
      score: (titleHit ? 3 : 0) + (bodyHit ? 1 : 0)
    })
  }
  return hits
}

function sortHits(hits: RawHit[]): RawHit[] {
  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aDate = a.publishedAt ?? ''
    const bDate = b.publishedAt ?? ''
    if (aDate === bDate) return 0
    return bDate.localeCompare(aDate)
  })
}

function toSearchResult(hit: RawHit, term: string): SearchResult {
  const excerptSource = hit.body || hit.title
  return {
    id: hit.id,
    type: hit.type,
    title: hit.title,
    excerpt: buildExcerpt(excerptSource, term),
    url: hit.url,
    publishedAt: hit.publishedAt
  }
}

function emptyResponse(page: number, perPage: number): PaginatedResponse<SearchResult> {
  return { data: [], meta: { total: 0, page, perPage, lastPage: 1 } }
}

export async function runGlobalSearch(
  opts: SearchOptions
): Promise<PaginatedResponse<SearchResult>> {
  const trimmed = opts.query.trim()
  const page = Math.max(1, Math.floor(opts.page) || 1)
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(opts.perPage) || 10))

  if (trimmed.length < MIN_QUERY_LENGTH) {
    return emptyResponse(page, perPage)
  }

  const requestedTypes = opts.types && opts.types.length > 0 ? opts.types : SUPPORTED_TYPES
  const activeTypes = requestedTypes.filter((t) => SUPPORTED_TYPES.includes(t))
  if (activeTypes.length === 0) {
    return emptyResponse(page, perPage)
  }

  const db = getDatabase()
  const pattern = `%${escapeLike(trimmed)}%`
  const sharedOpts: SearchOptions = { ...opts, query: trimmed, page, perPage }

  const tasks: Promise<RawHit[]>[] = []
  if (activeTypes.includes('report')) tasks.push(searchReports(db, sharedOpts, pattern))
  if (activeTypes.includes('publication')) tasks.push(searchPublications(db, sharedOpts, pattern))
  if (activeTypes.includes('news')) tasks.push(searchNews(db, sharedOpts, pattern))
  if (activeTypes.includes('event')) tasks.push(searchEvents(db, sharedOpts, pattern))
  if (activeTypes.includes('tender')) tasks.push(searchTenders(db, sharedOpts, pattern))
  if (activeTypes.includes('vacancy')) tasks.push(searchVacancies(db, sharedOpts, pattern))
  if (activeTypes.includes('video')) tasks.push(searchVideos(db, sharedOpts, pattern))
  if (activeTypes.includes('gallery')) tasks.push(searchGallery(db, sharedOpts, pattern))
  if (activeTypes.includes('team')) tasks.push(searchTeam(db, sharedOpts, pattern))
  if (activeTypes.includes('office')) tasks.push(searchOffices(db, sharedOpts, pattern))

  const domainHits = await Promise.all(tasks)
  const staticHits = activeTypes.includes('page') ? searchStaticPages(sharedOpts) : []
  const merged = sortHits([...domainHits.flat(), ...staticHits])

  const total = merged.length
  const lastPage = Math.ceil(total / perPage) || 1
  const start = (page - 1) * perPage
  const slice = merged.slice(start, start + perPage)
  const data = slice.map((hit) => toSearchResult(hit, trimmed))

  const typeCounts: Record<string, number> = {}
  for (const hit of merged) {
    typeCounts[hit.type] = (typeCounts[hit.type] || 0) + 1
  }

  return { data, meta: { total, page, perPage, lastPage, typeCounts } }
}
