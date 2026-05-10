import type { PaginatedResponse, SearchResult } from '~/types'
import { getLocaleFromRequest } from '../utils/locale'
import { runGlobalSearch, type SearchableType } from '../utils/searchService'

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

  return runGlobalSearch({
    query: typeof query.query === 'string' ? query.query : String(query.query ?? ''),
    types: parseTypes(query.type),
    dateFrom: parseOptionalString(query.dateFrom),
    dateTo: parseOptionalString(query.dateTo),
    locale,
    page: Number(query.page) || 1,
    perPage: Number(query.perPage) || 10
  })
})
