import type { SearchResult, SearchFilters, PaginatedResponse } from '~/types'

export function useSearch() {
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1,
    typeCounts: {} as Record<string, number>
  })

  async function search(filters: SearchFilters) {
    if (!filters.query || filters.query.trim().length < 2) {
      results.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const query = new URLSearchParams()
      query.set('query', filters.query)
      if (filters.type) query.set('type', filters.type)
      if (filters.category) query.set('category', filters.category)
      if (filters.dateFrom) query.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) query.set('dateTo', filters.dateTo)
      if (filters.page) query.set('page', filters.page.toString())
      if (filters.perPage) query.set('perPage', filters.perPage.toString())

      const response = await $fetch<PaginatedResponse<SearchResult>>(
        `/api/search?${query.toString()}`
      )

      results.value = response.data
      meta.value = { ...response.meta, typeCounts: response.meta.typeCounts ?? {} }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
    } finally {
      loading.value = false
    }
  }

  function clearResults() {
    results.value = []
    error.value = null
  }

  const typeFilters = [
    { value: 'report', label: 'Audit Reports' },
    { value: 'publication', label: 'Publications' },
    { value: 'news', label: 'News' },
    { value: 'event', label: 'Events' },
    { value: 'tender', label: 'Tenders' },
    { value: 'vacancy', label: 'Vacancies' },
    { value: 'video', label: 'Videos' },
    { value: 'gallery', label: 'Gallery' },
    { value: 'team', label: 'Team' },
    { value: 'office', label: 'Offices' },
    { value: 'page', label: 'Pages' }
  ]

  return {
    results,
    loading,
    error,
    meta,
    typeFilters,
    search,
    clearResults
  }
}
