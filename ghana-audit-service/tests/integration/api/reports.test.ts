import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { H3Event, EventHandlerRequest } from 'h3'

// Helper to create mock event that works with type system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockEvent = () =>
  ({ node: { req: {}, res: {} } }) as any as H3Event<EventHandlerRequest>

// Mock mockReports data
const mockReports = [
  {
    id: 'report-1',
    title: 'Annual Audit Report 2023',
    summary: 'Comprehensive audit of ministries and departments',
    category: 'financial',
    year: 2023,
    publishedAt: '2024-06-15',
    downloadUrl: '/reports/report-1.pdf'
  },
  {
    id: 'report-2',
    title: 'Performance Audit Report',
    summary: 'Assessment of government programs',
    category: 'performance',
    year: 2023,
    publishedAt: '2024-03-10',
    downloadUrl: '/reports/report-2.pdf'
  },
  {
    id: 'report-3',
    title: 'IT Systems Audit 2022',
    summary: 'Review of government IT infrastructure',
    category: 'it',
    year: 2022,
    publishedAt: '2023-06-20',
    downloadUrl: '/reports/report-3.pdf'
  },
  {
    id: 'report-4',
    title: 'Compliance Audit Report',
    summary: 'Compliance review of financial regulations',
    category: 'compliance',
    year: 2023,
    publishedAt: '2024-05-01',
    downloadUrl: '/reports/report-4.pdf'
  },
  {
    id: 'report-5',
    title: 'Technical Audit Report 2023',
    summary: 'Technical assessment of infrastructure projects',
    category: 'technical',
    year: 2023,
    publishedAt: '2024-04-15',
    downloadUrl: '/reports/report-5.pdf'
  }
]

// Mock the module
vi.mock('../../../server/utils/mockReports', () => ({
  mockReports
}))

// Mock getQuery and defineEventHandler
const mockGetQuery = vi.fn()
vi.stubGlobal('getQuery', mockGetQuery)
vi.stubGlobal('defineEventHandler', <T>(handler: T) => handler)

describe('Reports API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/reports', () => {
    it('should return all reports with default pagination', async () => {
      mockGetQuery.mockReturnValue({})

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(5)
      expect(result.meta).toEqual({
        total: 5,
        page: 1,
        perPage: 10,
        lastPage: 1
      })
    })

    it('should filter reports by category', async () => {
      mockGetQuery.mockReturnValue({ category: 'financial' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].category).toBe('financial')
    })

    it('should filter reports by year', async () => {
      mockGetQuery.mockReturnValue({ year: '2022' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].year).toBe(2022)
    })

    it('should filter reports by search term in title', async () => {
      mockGetQuery.mockReturnValue({ search: 'Performance' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].title).toContain('Performance')
    })

    it('should filter reports by search term in summary', async () => {
      mockGetQuery.mockReturnValue({ search: 'infrastructure' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(2) // IT and Technical both mention infrastructure
    })

    it('should combine multiple filters', async () => {
      mockGetQuery.mockReturnValue({ category: 'financial', year: '2023' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1)
      expect(result.data[0].category).toBe('financial')
      expect(result.data[0].year).toBe(2023)
    })

    it('should return empty array when no reports match filters', async () => {
      mockGetQuery.mockReturnValue({ category: 'financial', year: '2022' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(0)
      expect(result.meta.total).toBe(0)
    })

    it('should sort reports by publishedAt date (newest first)', async () => {
      mockGetQuery.mockReturnValue({})

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      // Check that reports are sorted by date descending
      for (let i = 0; i < result.data.length - 1; i++) {
        const currentDate = new Date(result.data[i].publishedAt).getTime()
        const nextDate = new Date(result.data[i + 1].publishedAt).getTime()
        expect(currentDate).toBeGreaterThanOrEqual(nextDate)
      }
    })

    it('should paginate results correctly', async () => {
      mockGetQuery.mockReturnValue({ perPage: '2', page: '1' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(2)
      expect(result.meta).toEqual({
        total: 5,
        page: 1,
        perPage: 2,
        lastPage: 3
      })
    })

    it('should handle page 2 of pagination', async () => {
      mockGetQuery.mockReturnValue({ perPage: '2', page: '2' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(2)
      expect(result.meta.page).toBe(2)
    })

    it('should handle last page with fewer items', async () => {
      mockGetQuery.mockReturnValue({ perPage: '2', page: '3' })

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.data).toHaveLength(1) // Only 1 item on last page
      expect(result.meta.page).toBe(3)
    })

    it('should use default pagination values', async () => {
      mockGetQuery.mockReturnValue({})

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result.meta.page).toBe(1)
      expect(result.meta.perPage).toBe(10)
    })
  })

  describe('Response structure', () => {
    it('should return correctly structured paginated response', async () => {
      mockGetQuery.mockReturnValue({})

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('meta')
      expect(result.meta).toHaveProperty('total')
      expect(result.meta).toHaveProperty('page')
      expect(result.meta).toHaveProperty('perPage')
      expect(result.meta).toHaveProperty('lastPage')
    })

    it('should return reports with required fields', async () => {
      mockGetQuery.mockReturnValue({})

      const handler = (await import('../../../server/api/reports/index')).default
      const result = await handler(createMockEvent())

      const report = result.data[0]
      expect(report).toHaveProperty('id')
      expect(report).toHaveProperty('title')
      expect(report).toHaveProperty('category')
      expect(report).toHaveProperty('year')
      expect(report).toHaveProperty('publishedAt')
    })
  })

  describe('Category filtering', () => {
    const categories = ['financial', 'performance', 'it', 'compliance', 'technical']

    for (const category of categories) {
      it(`should filter by ${category} category`, async () => {
        mockGetQuery.mockReturnValue({ category })

        const handler = (await import('../../../server/api/reports/index')).default
        const result = await handler(createMockEvent())

        result.data.forEach((report: { category: string }) => {
          expect(report.category).toBe(category)
        })
      })
    }
  })
})
