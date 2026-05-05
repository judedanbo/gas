import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { H3Event, EventHandlerRequest } from 'h3'

// Helper to create mock event that works with type system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockEvent = () =>
  ({ node: { req: {}, res: {} } }) as any as H3Event<EventHandlerRequest>

interface SearchResultItem {
  id: string
  type: string
  title: string
  excerpt: string
  url: string
  publishedAt?: string
}

// Mock getQuery and defineEventHandler
const mockGetQuery = vi.fn()
vi.stubGlobal('getQuery', mockGetQuery)
vi.stubGlobal('defineEventHandler', <T>(handler: T) => handler)

describe('Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('GET /api/search', () => {
    it('should return empty results when no query provided', async () => {
      mockGetQuery.mockReturnValue({})

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        perPage: 10,
        lastPage: 1
      })
    })

    it('should search in titles', async () => {
      mockGetQuery.mockReturnValue({ query: 'Audit' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data.length).toBeGreaterThan(0)
      result.data.forEach((item: SearchResultItem) => {
        const matchesTitle = item.title.toLowerCase().includes('audit')
        const matchesExcerpt = item.excerpt.toLowerCase().includes('audit')
        expect(matchesTitle || matchesExcerpt).toBe(true)
      })
    })

    it('should search in excerpts', async () => {
      mockGetQuery.mockReturnValue({ query: 'constitutional' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data.length).toBeGreaterThan(0)
    })

    it('should be case-insensitive', async () => {
      mockGetQuery.mockReturnValue({ query: 'AUDIT' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data.length).toBeGreaterThan(0)
    })

    it('should filter by type=report', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'report' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        expect(item.type).toBe('report')
      })
    })

    it('should filter by type=publication', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'publication' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        expect(item.type).toBe('publication')
      })
    })

    it('should filter by type=news', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'news' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        expect(item.type).toBe('news')
      })
    })

    it('should filter by type=page', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', type: 'page' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        expect(item.type).toBe('page')
      })
    })

    it('should filter by dateFrom', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', dateFrom: '2024-01-01' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        if (item.publishedAt) {
          expect(item.publishedAt >= '2024-01-01').toBe(true)
        }
      })
    })

    it('should filter by dateTo', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', dateTo: '2024-03-31' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        if (item.publishedAt) {
          expect(item.publishedAt <= '2024-03-31').toBe(true)
        }
      })
    })

    it('should filter by date range', async () => {
      mockGetQuery.mockReturnValue({
        query: 'audit',
        dateFrom: '2024-03-01',
        dateTo: '2024-06-30'
      })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        if (item.publishedAt) {
          expect(item.publishedAt >= '2024-03-01').toBe(true)
          expect(item.publishedAt <= '2024-06-30').toBe(true)
        }
      })
    })

    it('should combine type and date filters', async () => {
      mockGetQuery.mockReturnValue({
        query: 'audit',
        type: 'report',
        dateFrom: '2024-01-01'
      })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      result.data.forEach((item: SearchResultItem) => {
        expect(item.type).toBe('report')
        if (item.publishedAt) {
          expect(item.publishedAt >= '2024-01-01').toBe(true)
        }
      })
    })
  })

  describe('Pagination', () => {
    it('should use default pagination', async () => {
      mockGetQuery.mockReturnValue({ query: 'a' }) // Query that matches many results

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.meta.page).toBe(1)
      expect(result.meta.perPage).toBe(10)
    })

    it('should handle custom page size', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', perPage: '5' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.meta.perPage).toBe(5)
      expect(result.data.length).toBeLessThanOrEqual(5)
    })

    it('should handle page navigation', async () => {
      mockGetQuery.mockReturnValue({ query: 'a', perPage: '2', page: '2' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.meta.page).toBe(2)
    })

    it('should calculate lastPage correctly', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', perPage: '2' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      const expectedLastPage = Math.ceil(result.meta.total / 2) || 1
      expect(result.meta.lastPage).toBe(expectedLastPage)
    })

    it('should return empty array for page beyond results', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', page: '100' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
    })
  })

  describe('Response structure', () => {
    it('should return correctly structured response', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('meta')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.meta).toHaveProperty('total')
      expect(result.meta).toHaveProperty('page')
      expect(result.meta).toHaveProperty('perPage')
      expect(result.meta).toHaveProperty('lastPage')
    })

    it('should return search results with required fields', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      if (result.data.length > 0) {
        const item = result.data[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('type')
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('excerpt')
        expect(item).toHaveProperty('url')
      }
    })

    it('should return valid result types', async () => {
      mockGetQuery.mockReturnValue({ query: 'a' }) // Broad search

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      const validTypes = ['report', 'publication', 'news', 'page']
      result.data.forEach((item: SearchResultItem) => {
        expect(validTypes).toContain(item.type)
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string query', async () => {
      mockGetQuery.mockReturnValue({ query: '' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
    })

    it('should handle whitespace-only query', async () => {
      mockGetQuery.mockReturnValue({ query: '   ' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      // Whitespace matches everything in toLowerCase().includes()
      // This tests the actual behavior
      expect(result).toHaveProperty('data')
    })

    it('should handle special characters in query', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit-report' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('meta')
    })

    it('should handle query with no matches', async () => {
      mockGetQuery.mockReturnValue({ query: 'xyznonexistent123' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      expect(result.data).toEqual([])
      expect(result.meta.total).toBe(0)
    })

    it('should handle invalid page number gracefully', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', page: 'invalid' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      // NaN should fallback to 1
      expect(result.meta.page).toBe(1)
    })

    it('should handle negative page number', async () => {
      mockGetQuery.mockReturnValue({ query: 'audit', page: '-1' })

      const handler = (await import('../../../server/api/search')).default
      const result = await handler(createMockEvent())

      // Negative results in empty slice but valid response
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('meta')
    })
  })
})
