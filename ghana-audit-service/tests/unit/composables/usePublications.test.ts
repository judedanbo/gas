import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock Vue's ref as global (like Nuxt auto-imports)
vi.stubGlobal('ref', ref)

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('usePublications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('types', () => {
    it('should provide correct publication types', async () => {
      const { usePublications } = await import('../../../composables/usePublications')
      const { types } = usePublications()

      expect(types).toHaveLength(6)
      expect(types[0]).toEqual({ value: 'press-statement', label: 'Press Statement' })
      expect(types[1]).toEqual({ value: 'bulletin', label: 'Bulletin' })
      expect(types[2]).toEqual({ value: 'guideline', label: 'Auditing Guideline' })
      expect(types[3]).toEqual({ value: 'manual', label: 'AMIS Manual' })
      expect(types[4]).toEqual({ value: 'strategy', label: 'Strategy Document' })
      expect(types[5]).toEqual({ value: 'law', label: 'Applicable Law' })
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', async () => {
      const { usePublications } = await import('../../../composables/usePublications')
      const { publications, loading, error, meta } = usePublications()

      expect(publications.value).toEqual([])
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

  describe('fetchPublications', () => {
    it('should fetch publications without filters', async () => {
      const mockResponse = {
        data: [{ id: '1', title: 'Test Publication' }],
        meta: { total: 1, page: 1, perPage: 10, lastPage: 1 }
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications, publications, meta } = usePublications()

      await fetchPublications()

      expect(mockFetch).toHaveBeenCalledWith('/api/publications?')
      expect(publications.value).toEqual(mockResponse.data)
      expect(meta.value).toEqual(mockResponse.meta)
    })

    it('should fetch publications with type filter', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications } = usePublications()

      await fetchPublications({ type: 'press-statement' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=press-statement')
      )
    })

    it('should fetch publications with search filter', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 }
      })

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications } = usePublications()

      await fetchPublications({ search: 'bulletin' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=bulletin')
      )
    })

    it('should fetch publications with pagination', async () => {
      mockFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 3, perPage: 15, lastPage: 5 }
      })

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications } = usePublications()

      await fetchPublications({ page: 3, perPage: 15 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=3')
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('perPage=15')
      )
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValue(fetchPromise)

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications, loading } = usePublications()

      const promise = fetchPublications()
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

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications, error, loading } = usePublications()

      await fetchPublications()

      expect(error.value).toBe('Network error')
      expect(loading.value).toBe(false)
    })

    it('should handle non-Error fetch failure', async () => {
      mockFetch.mockRejectedValue('Unknown error')

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublications, error } = usePublications()

      await fetchPublications()

      expect(error.value).toBe('Failed to fetch publications')
    })
  })

  describe('fetchPublication', () => {
    it('should fetch a single publication by id', async () => {
      const mockPublication = { id: '456', title: 'Test Publication' }
      mockFetch.mockResolvedValue(mockPublication)

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublication } = usePublications()

      const result = await fetchPublication('456')

      expect(mockFetch).toHaveBeenCalledWith('/api/publications/456')
      expect(result).toEqual(mockPublication)
    })

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Not found'))

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublication, error } = usePublications()

      const result = await fetchPublication('invalid')

      expect(result).toBeNull()
      expect(error.value).toBe('Not found')
    })

    it('should set loading state during single publication fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      mockFetch.mockReturnValue(fetchPromise)

      const { usePublications } = await import('../../../composables/usePublications')
      const { fetchPublication, loading } = usePublications()

      const promise = fetchPublication('456')
      expect(loading.value).toBe(true)

      resolvePromise!({ id: '456', title: 'Test' })
      await promise

      expect(loading.value).toBe(false)
    })
  })
})
