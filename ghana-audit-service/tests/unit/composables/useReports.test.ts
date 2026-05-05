import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock Vue's ref as global (like Nuxt auto-imports)
vi.stubGlobal('ref', ref)

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('categories', () => {
    it('should provide correct audit categories', async () => {
      const { useReports } = await import('../../../composables/useReports')
      const { categories } = useReports()

      expect(categories).toHaveLength(6)
      expect(categories[0]).toEqual({ value: 'financial', label: 'Financial Audit' })
      expect(categories[1]).toEqual({ value: 'compliance', label: 'Compliance Audit' })
      expect(categories[2]).toEqual({ value: 'it', label: 'IT Audit' })
      expect(categories[3]).toEqual({ value: 'performance', label: 'Performance Audit' })
      expect(categories[4]).toEqual({ value: 'technical', label: 'Technical Audit' })
      expect(categories[5]).toEqual({ value: 'follow-up', label: 'Follow-up Review' })
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', async () => {
      const { useReports } = await import('../../../composables/useReports')
      const { reports, loading, error, meta } = useReports()

      expect(reports.value).toEqual([])
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(meta.value).toEqual({
        total: 0,
        page: 1,
        perPage: 10,
        lastPage: 1
      })
    })
  })

  describe('fetchReports', () => {
    it('should fetch reports without filters', async () => {
      const mockResponse = {
        data: [{ id: '1', title: 'Test Report' }],
        meta: { total: 1, page: 1, perPage: 10, lastPage: 1 }
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports, reports, meta } = useReports()

      await fetchReports()

      expect(mockFetch).toHaveBeenCalledWith('/api/reports?')
      expect(reports.value).toEqual(mockResponse.data)
      expect(meta.value).toEqual(mockResponse.meta)
    })

    it('should fetch reports with category filter', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports } = useReports()

      await fetchReports({ category: 'financial' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=financial')
      )
    })

    it('should fetch reports with year filter', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports } = useReports()

      await fetchReports({ year: 2024 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('year=2024')
      )
    })

    it('should fetch reports with search filter', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports } = useReports()

      await fetchReports({ search: 'audit' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=audit')
      )
    })

    it('should fetch reports with pagination', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 2, perPage: 20, lastPage: 1 }
      })

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports } = useReports()

      await fetchReports({ page: 2, perPage: 20 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('perPage=20')
      )
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValue(fetchPromise)

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports, loading } = useReports()

      const promise = fetchReports()
      expect(loading.value).toBe(true)

      resolvePromise!({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })
      await promise

      expect(loading.value).toBe(false)
    })

    it('should handle fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports, error, loading } = useReports()

      await fetchReports()

      expect(error.value).toBe('Network error')
      expect(loading.value).toBe(false)
    })

    it('should handle non-Error fetch failure', async () => {
      mockFetch.mockRejectedValue('Unknown error')

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReports, error } = useReports()

      await fetchReports()

      expect(error.value).toBe('Failed to fetch reports')
    })
  })

  describe('fetchReport', () => {
    it('should fetch a single report by id', async () => {
      const mockReport = { id: '123', title: 'Test Report' }
      mockFetch.mockResolvedValue(mockReport)

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReport } = useReports()

      const result = await fetchReport('123')

      expect(mockFetch).toHaveBeenCalledWith('/api/reports/123')
      expect(result).toEqual(mockReport)
    })

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Not found'))

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReport, error } = useReports()

      const result = await fetchReport('invalid')

      expect(result).toBeNull()
      expect(error.value).toBe('Not found')
    })

    it('should set loading state during single report fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValue(fetchPromise)

      const { useReports } = await import('../../../composables/useReports')
      const { fetchReport, loading } = useReports()

      const promise = fetchReport('123')
      expect(loading.value).toBe(true)

      resolvePromise!({ id: '123', title: 'Test' })
      await promise

      expect(loading.value).toBe(false)
    })
  })
})
