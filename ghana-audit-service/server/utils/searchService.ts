import { and, eq, gte, isNull, like, lte, or, inArray, type SQL } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import type { PaginatedResponse, SearchResult } from '~/types'
import type { SupportedLocale } from './locale'

export const MIN_QUERY_LENGTH = 2
export const MAX_PER_PAGE = 50
const MAX_PER_DOMAIN = 200

export type SearchableType = SearchResult['type']

const PHASE_1_TYPES: ReadonlyArray<SearchableType> = ['report', 'publication', 'news']

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

function buildExcerpt(body: string, term: string, max = 200): string {
  if (!body) return ''
  const lower = body.toLowerCase()
  const idx = lower.indexOf(term.toLowerCase())
  if (idx === -1) {
    const head = body.slice(0, max).trim()
    return body.length > max ? `${head}…` : head
  }
  const window = Math.max(0, max - term.length)
  const half = Math.floor(window / 2)
  const start = Math.max(0, idx - half)
  const end = Math.min(body.length, start + max)
  const snippet = body.slice(start, end).trim()
  const prefix = start > 0 ? '…' : ''
  const suffix = end < body.length ? '…' : ''
  return `${prefix}${snippet}${suffix}`
}

interface TranslationRow {
  baseId: number
  slug: string
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

function publicationUrl(type: string | undefined, slug: string): string {
  const segment = type ? (PUBLICATION_TYPE_PATHS[type] ?? '') : ''
  if (segment && PUBLICATION_TYPES_WITH_SLUG_ROUTE.has(type ?? '')) {
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
  if (opts.dateFrom) conditions.push(gte(schema.auditReports.publishedAt, opts.dateFrom))
  if (opts.dateTo) conditions.push(lte(schema.auditReports.publishedAt, opts.dateTo))

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
  if (opts.dateFrom) conditions.push(gte(schema.publications.publishedAt, opts.dateFrom))
  if (opts.dateTo) conditions.push(lte(schema.publications.publishedAt, opts.dateTo))

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
  if (opts.dateFrom) conditions.push(gte(schema.newsArticles.publishedAt, opts.dateFrom))
  if (opts.dateTo) conditions.push(lte(schema.newsArticles.publishedAt, opts.dateTo))

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

  const requestedTypes = opts.types && opts.types.length > 0 ? opts.types : PHASE_1_TYPES
  const activeTypes = requestedTypes.filter((t) => PHASE_1_TYPES.includes(t))
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

  const domainHits = await Promise.all(tasks)
  const merged = sortHits(domainHits.flat())

  const total = merged.length
  const lastPage = Math.ceil(total / perPage) || 1
  const start = (page - 1) * perPage
  const slice = merged.slice(start, start + perPage)
  const data = slice.map((hit) => toSearchResult(hit, trimmed))

  return { data, meta: { total, page, perPage, lastPage } }
}
