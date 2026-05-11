import type { PaginatedResponse, SearchResult } from '~/types'
import { getLocaleFromRequest } from '../utils/locale'
import { runGlobalSearch, type SearchableType } from '../utils/searchService'
import { recordSearch } from '../utils/analytics/recordSearch'

const KNOWN_TYPES: ReadonlyArray<SearchableType> = [
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

function parseTypes(raw: unknown): SearchableType[] | undefined {
  if (raw == null) return undefined
  const candidates = Array.isArray(raw) ? raw.map(String) : [String(raw)]
  const valid = candidates.filter((c): c is SearchableType =>
    KNOWN_TYPES.includes(c as SearchableType)
  )
  return valid.length > 0 ? valid : undefined
}

function parseOptionalString(raw: unknown): string | undefined {
  if (raw == null) return undefined
  const value = String(raw).trim()
  return value.length > 0 ? value : undefined
}

export default defineEventHandler(async (event): Promise<PaginatedResponse<SearchResult>> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)

  const result = await runGlobalSearch({
    query: typeof query.query === 'string' ? query.query : String(query.query ?? ''),
    types: parseTypes(query.type),
    dateFrom: parseOptionalString(query.dateFrom),
    dateTo: parseOptionalString(query.dateTo),
    locale,
    page: Number(query.page) || 1,
    perPage: Number(query.perPage) || 10
  })

  // Record the search (and its result count) for the admin Insights tab.
  // Fire-and-forget; never blocks the response. Uses the locale resolved
  // above by getLocaleFromRequest (the public search component passes the
  // user's preferred locale either via Accept-Language or the i18n URL
  // prefix; PR #9 normalised that into getLocaleFromRequest).
  recordSearch(event, {
    query: String(query.query ?? ''),
    resultCount: result.meta.total,
    locale
  })

  return result
})
