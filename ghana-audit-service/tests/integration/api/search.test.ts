import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event, EventHandlerRequest } from 'h3'
import type { PaginatedResponse, SearchResult } from '~/types'

interface ReportRow {
  baseId: number
  slug: string
  publishedAt: string
  locale: 'en' | 'ak'
  title: string
  body: string | null
}

interface PublicationRow extends ReportRow {
  type: string
  excerpt: string | null
  content: string | null
}

interface NewsRow extends ReportRow {
  excerpt: string | null
  content: string | null
}

const tableResults = new Map<unknown, unknown[]>()
const queryLog: { table: unknown; from: string }[] = []

const SCHEMA_TABLE_NAMES = [
  'auditReports',
  'auditReportTranslations',
  'publications',
  'publicationTranslations',
  'newsArticles',
  'newsArticleTranslations',
  'events',
  'eventTranslations',
  'tenders',
  'tenderTranslations',
  'vacancies',
  'vacancyTranslations',
  'videos',
  'videoTranslations',
  'galleryAlbums',
  'galleryAlbumTranslations',
  'managementTeam',
  'managementTeamTranslations',
  'offices',
  'officeTranslations'
] as const

function tableKey(table: unknown): string {
  const tag = (table as { __tag?: string }).__tag
  return tag ?? 'unknown'
}

vi.mock('../../../server/database', () => {
  // Each table is a Proxy: any column access returns a non-undefined sentinel so
  // searcher code like `schema.events.isPublished` doesn't crash, while object
  // identity on the table itself remains stable for Map lookups.
  const makeTaggedTable = (name: string) =>
    new Proxy(
      { __tag: name },
      {
        get(target, prop) {
          if (prop === '__tag') return target.__tag
          if (typeof prop === 'symbol') return undefined
          return { __column: `${name}.${String(prop)}` }
        }
      }
    ) as unknown as Record<string, unknown>

  const schema = Object.fromEntries(
    SCHEMA_TABLE_NAMES.map((name) => [name, makeTaggedTable(name)])
  ) as Record<(typeof SCHEMA_TABLE_NAMES)[number], Record<string, unknown>>

  function makeBuilder() {
    const state: { table?: unknown } = {}
    const builder: Record<string, unknown> = {
      from(table: unknown) {
        state.table = table
        queryLog.push({ table, from: tableKey(table) })
        return builder
      },
      innerJoin: () => builder,
      leftJoin: () => builder,
      where: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      offset: () => builder,
      then(resolve: (value: unknown) => void) {
        const rows = state.table ? (tableResults.get(state.table) ?? []) : []
        resolve(rows)
      }
    }
    return builder
  }

  return {
    schema,
    getDatabase: () => ({
      select: () => makeBuilder(),
      selectDistinct: () => makeBuilder(),
      insert: () => ({ values: () => Promise.resolve() })
    }),
    getPool: () => null
  }
})

// h3 globals used by the handler
const mockGetQuery = vi.fn()
const mockGetHeader = vi.fn(() => '')
vi.stubGlobal('getQuery', mockGetQuery)
vi.stubGlobal('getHeader', mockGetHeader)
vi.stubGlobal('defineEventHandler', <T,>(handler: T) => handler)

const createMockEvent = () => ({ node: { req: {}, res: {} } }) as unknown as H3Event<EventHandlerRequest>

async function importHandler() {
  vi.resetModules()
  const mod = await import('../../../server/api/search')
  return mod.default as (event: H3Event<EventHandlerRequest>) => Promise<PaginatedResponse<SearchResult>>
}

async function importSchemaTags() {
  const { schema } = await import('../../../server/database')
  return schema
}

const reportRow = (overrides: Partial<ReportRow> = {}): ReportRow => ({
  baseId: 1,
  slug: 'audit-report-2024',
  publishedAt: '2024-06-15',
  locale: 'en',
  title: 'Audit Report 2024',
  body: 'Annual audit summary for 2024.',
  ...overrides
})

const publicationRow = (overrides: Partial<PublicationRow> = {}): PublicationRow => ({
  baseId: 1,
  slug: 'press-statement-1',
  publishedAt: '2024-05-10',
  locale: 'en',
  title: 'Press Statement on Audit Findings',
  body: null,
  type: 'press-statement',
  excerpt: 'Statement summary',
  content: 'Full statement content discussing audit findings.',
  ...overrides
})

const newsRow = (overrides: Partial<NewsRow> = {}): NewsRow => ({
  baseId: 1,
  slug: 'news-1',
  publishedAt: '2024-07-01',
  locale: 'en',
  title: 'News Headline About Audit',
  body: null,
  excerpt: 'News excerpt',
  content: 'Full news article body referencing audit.',
  ...overrides
})

describe('Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHeader.mockReturnValue('')
    tableResults.clear()
    queryLog.length = 0
  })

  describe('Query validation', () => {
    it('returns an empty payload when query is missing', async () => {
      mockGetQuery.mockReturnValue({})
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
      expect(result.meta).toEqual({ total: 0, page: 1, perPage: 10, lastPage: 1 })
      expect(queryLog).toEqual([])
    })

    it('returns empty when query is shorter than the minimum length', async () => {
      mockGetQuery.mockReturnValue({ query: 'a' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
      expect(result.meta.total).toBe(0)
      expect(queryLog).toEqual([])
    })

    it('treats whitespace-only queries as empty', async () => {
      mockGetQuery.mockReturnValue({ query: '   ' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
      expect(queryLog).toEqual([])
    })
  })

  describe('Cross-domain search', () => {
    it('returns matches from reports, publications and news merged together', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [
        reportRow({ baseId: 10, title: 'Annual Audit Report' })
      ])
      tableResults.set(schema.publications, [
        publicationRow({ baseId: 20, title: 'Audit Manual', body: 'Audit guidance' })
      ])
      tableResults.set(schema.newsArticles, [
        newsRow({ baseId: 30, title: 'Audit news headline' })
      ])
      mockGetQuery.mockReturnValue({
        query: 'audit',
        type: ['report', 'publication', 'news']
      })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data.map((r) => r.type).sort()).toEqual(['news', 'publication', 'report'])
      expect(result.meta.total).toBe(3)
    })

    it('orders results by score, then by publishedAt desc', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [
        // Title-only match -> score 3
        reportRow({
          baseId: 1,
          title: 'Audit overview',
          body: 'Unrelated summary',
          publishedAt: '2024-01-01'
        })
      ])
      tableResults.set(schema.publications, [
        // Title + body match -> score 4 (older)
        publicationRow({
          baseId: 2,
          title: 'Audit summary',
          excerpt: 'audit specifics',
          content: null,
          publishedAt: '2023-01-01'
        })
      ])
      tableResults.set(schema.newsArticles, [
        // Body-only match -> score 1 (newest)
        newsRow({
          baseId: 3,
          title: 'Quarterly news roundup',
          excerpt: 'audit appears in body only',
          content: null,
          publishedAt: '2024-12-31'
        })
      ])
      mockGetQuery.mockReturnValue({
        query: 'audit',
        type: ['report', 'publication', 'news']
      })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data.map((r) => r.id)).toEqual([
        'publication-2', // score 4
        'report-1', // score 3
        'news-3' // score 1
      ])
    })
  })

  describe('Type filter', () => {
    it('limits queries to the requested type', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [reportRow({ baseId: 7, title: 'Audit report' })])
      tableResults.set(schema.publications, [publicationRow({ title: 'Audit publication' })])
      tableResults.set(schema.newsArticles, [newsRow({ title: 'Audit news' })])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'report' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].type).toBe('report')
      expect(queryLog.map((q) => q.from).sort()).toEqual(['auditReports'])
    })

    it('accepts multiple repeated type params', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.publications, [publicationRow({ title: 'Audit publication' })])
      tableResults.set(schema.newsArticles, [newsRow({ title: 'Audit news' })])
      mockGetQuery.mockReturnValue({ query: 'audit', type: ['publication', 'news'] })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data.map((r) => r.type).sort()).toEqual(['news', 'publication'])
      expect(queryLog.map((q) => q.from).sort()).toEqual(['newsArticles', 'publications'])
    })

    it('ignores unknown type values, falling back to all supported types', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [reportRow({ title: 'Audit' })])
      tableResults.set(schema.publications, [publicationRow({ title: 'Audit' })])
      tableResults.set(schema.newsArticles, [newsRow({ title: 'Audit' })])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'banana' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      // Bogus type → handler treats as unfiltered, all SUPPORTED_TYPES are queried.
      // We only seed the three Phase 1 tables, so only those return rows; static
      // pages add a few matches from inline strings containing "Audit".
      expect(result.data.length).toBeGreaterThanOrEqual(3)
      const types = new Set(result.data.map((r) => r.type))
      expect(types.has('report')).toBe(true)
      expect(types.has('publication')).toBe(true)
      expect(types.has('news')).toBe(true)
    })
  })

  describe('Locale handling', () => {
    it('prefers the requested locale row over the English fallback', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [
        reportRow({ baseId: 1, locale: 'en', title: 'English Audit Title' }),
        reportRow({ baseId: 1, locale: 'ak', title: 'Akan Audit Title' })
      ])
      mockGetHeader.mockReturnValue('ak')
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'report' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Akan Audit Title')
    })

    it('falls back to the English row when the requested locale is missing', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [
        reportRow({ baseId: 1, locale: 'en', title: 'Annual audit summary' })
      ])
      mockGetHeader.mockReturnValue('ak')
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'report' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toBe('Annual audit summary')
    })
  })

  describe('Pagination', () => {
    it('uses defaults of page=1 and perPage=10', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.newsArticles, [newsRow({ title: 'Audit headline' })])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'news' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.meta.page).toBe(1)
      expect(result.meta.perPage).toBe(10)
      expect(result.meta.lastPage).toBe(1)
    })

    it('slices the merged results by page and perPage', async () => {
      const schema = await importSchemaTags()
      const many: NewsRow[] = Array.from({ length: 12 }, (_, i) =>
        newsRow({
          baseId: i + 1,
          slug: `news-${i + 1}`,
          title: `Audit headline ${i + 1}`,
          publishedAt: `2024-01-${String(i + 1).padStart(2, '0')}`
        })
      )
      tableResults.set(schema.newsArticles, many)
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'news', perPage: '5', page: '2' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(5)
      expect(result.meta).toEqual({ total: 12, page: 2, perPage: 5, lastPage: 3, typeCounts: { news: 12 } })
    })

    it('caps perPage at the maximum allowed value', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.newsArticles, [newsRow({ title: 'Audit headline' })])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'news', perPage: '500' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.meta.perPage).toBe(50)
    })
  })

  describe('Special characters', () => {
    it('does not crash on LIKE wildcards or quotes in the query', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.newsArticles, [newsRow({ title: 'Audit headline' })])
      mockGetQuery.mockReturnValue({ query: "100% audit's \\ _safe;", type: 'news' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('meta')
    })
  })

  describe('URL shape per domain', () => {
    it('builds a /reports/:slug URL for reports', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.auditReports, [
        reportRow({ baseId: 5, slug: 'ag-mdas-2024', title: 'Audit MDAs 2024' })
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'report' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data[0].url).toBe('/reports/ag-mdas-2024')
    })

    it('builds a /publications/<segment>/:slug URL for slug-routed publication types', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.publications, [
        publicationRow({
          baseId: 1,
          slug: 'press-1',
          type: 'press-statement',
          title: 'Audit statement'
        })
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'publication' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data[0].url).toBe('/publications/press-statements/press-1')
    })

    it('uses the segment-only URL for publication types without a slug route', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.publications, [
        publicationRow({
          baseId: 1,
          slug: 'strategy-1',
          type: 'strategy',
          title: 'Audit strategy'
        })
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'publication' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data[0].url).toBe('/publications/pfm-strategy')
    })

    it('builds a /media/news/:slug URL for news', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.newsArticles, [
        newsRow({ baseId: 7, slug: 'partnership', title: 'Audit partnership' })
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'news' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data[0].url).toBe('/media/news/partnership')
    })
  })

  describe('Excerpt generation', () => {
    it('returns plain text without HTML tags', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.newsArticles, [
        newsRow({
          title: 'Quarterly update',
          excerpt: null,
          content:
            'The Ghana Audit Service announced new audit guidance and partnership initiatives.'
        })
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'news' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data[0].excerpt).not.toMatch(/<[^>]+>/)
      expect(result.data[0].excerpt.toLowerCase()).toContain('audit')
    })
  })

  describe('Phase 2 domains', () => {
    it('searches events and links to /media/events/:slug', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.events, [
        {
          baseId: 1,
          slug: 'ag-conference',
          publishedAt: '2024-08-15',
          locale: 'en',
          title: 'Audit Conference 2024',
          body: 'Annual audit conference open to the public.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'event' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].type).toBe('event')
      expect(result.data[0].url).toBe('/media/events/ag-conference')
    })

    it('searches tenders and links them to the careers tenders list page', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.tenders, [
        {
          baseId: 1,
          slug: 'tender-1',
          publishedAt: '2024-09-01',
          status: 'open',
          locale: 'en',
          title: 'Audit Software Procurement',
          body: 'Procurement of audit software for the service.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'tender' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].url).toBe('/careers/tenders')
    })

    it('excludes cancelled tenders from results', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.tenders, [
        {
          baseId: 1,
          slug: 'tender-cancelled',
          publishedAt: '2024-09-01',
          status: 'cancelled',
          locale: 'en',
          title: 'Cancelled audit tender',
          body: 'This tender was cancelled.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'tender' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
    })

    it('searches vacancies and links to /careers/:slug', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.vacancies, [
        {
          baseId: 1,
          slug: 'senior-auditor',
          publishedAt: '2024-09-01',
          locale: 'en',
          title: 'Senior Auditor wanted',
          body: 'Apply for the senior auditor role.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'auditor', type: 'vacancy' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].url).toBe('/careers/senior-auditor')
    })

    it('searches videos and links to the videos list page', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.videos, [
        {
          baseId: 42,
          publishedAt: '2024-07-01',
          locale: 'en',
          title: 'Audit explainer video',
          body: 'A short explainer about audit findings.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'video' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('video-42')
      expect(result.data[0].url).toBe('/media/videos')
    })

    it('searches gallery albums with an ?album=:slug deep link', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.galleryAlbums, [
        {
          baseId: 5,
          slug: 'audit-week',
          publishedAt: '2024-06-15',
          locale: 'en',
          title: 'Audit Week 2024 album',
          body: 'Photos from audit week.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'gallery' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].url).toBe('/media/gallery?album=audit-week')
    })

    it('searches management team and links to /about/management-team/:slug', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.managementTeam, [
        {
          baseId: 1,
          slug: 'jane-doe',
          locale: 'en',
          name: 'Jane Doe',
          role: 'Deputy Auditor-General',
          bio: 'Jane leads the audit operations directorate.'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'team' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].url).toBe('/about/management-team/jane-doe')
      expect(result.data[0].publishedAt).toBeUndefined()
    })

    it('searches offices and links to /contact', async () => {
      const schema = await importSchemaTags()
      tableResults.set(schema.offices, [
        {
          baseId: 1,
          region: 'Greater Accra',
          locale: 'en',
          name: 'Greater Accra Regional Audit Office',
          address: '123 Audit Street, Accra'
        }
      ])
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'office' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].url).toBe('/contact')
      expect(result.data[0].publishedAt).toBeUndefined()
    })

    it('searches static pages without touching the database', async () => {
      mockGetQuery.mockReturnValue({ query: 'CitizensEye', type: 'page' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      const ids = result.data.map((r) => r.id)
      expect(ids).toContain('page-citizenseye')
      // No DB lookup should have been issued for a page-only search.
      expect(queryLog).toEqual([])
    })

    it('falls back to English static-page strings when an Akan match is missing', async () => {
      mockGetHeader.mockReturnValue('ak')
      // Search for an English-only word — Akan static strings do not contain it.
      mockGetQuery.mockReturnValue({ query: 'constitutional', type: 'page' })
      const handler = await importHandler()

      const result = await handler(createMockEvent())

      expect(result.data.some((r) => r.id === 'page-about')).toBe(true)
    })
  })
})

