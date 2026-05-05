import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

// Mock Vue's ref and computed as globals (like Nuxt auto-imports)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('typeFilters', () => {
    it('should provide correct type filters', async () => {
      const { useSearch } = await import('../../../composables/useSearch')
      const { typeFilters } = useSearch()

      expect(typeFilters).toHaveLength(4)
      expect(typeFilters[0]).toEqual({ value: 'report', label: 'Audit Reports' })
      expect(typeFilters[1]).toEqual({ value: 'publication', label: 'Publications' })
      expect(typeFilters[2]).toEqual({ value: 'news', label: 'News' })
      expect(typeFilters[3]).toEqual({ value: 'page', label: 'Pages' })
    })
  })

  describe('search function validation', () => {
    it('should not call API for empty query', async () => {
      const { useSearch } = await import('../../../composables/useSearch')
      const { search } = useSearch()

      await search({ query: '' })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should not call API for query shorter than 2 characters', async () => {
      const { useSearch } = await import('../../../composables/useSearch')
      const { search } = useSearch()

      await search({ query: 'a' })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should call API for valid query', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { useSearch } = await import('../../../composables/useSearch')
      const { search } = useSearch()

      await search({ query: 'audit report' })

      expect(mockFetch).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?')
      )
    })

    it('should include optional filters in query', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { useSearch } = await import('../../../composables/useSearch')
      const { search } = useSearch()

      await search({
        query: 'test',
        type: 'report',
        page: 2
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=report')
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      )
    })
  })
})
