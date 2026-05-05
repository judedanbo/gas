import type { Publication, PublicationType, PaginatedResponse } from '~/types'

interface PublicationFilters {
  type?: PublicationType
  search?: string
  page?: number
  perPage?: number
}

export function usePublications() {
  const publications = ref<Publication[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1
  })

  async function fetchPublications(filters: PublicationFilters = {}) {
    loading.value = true
    error.value = null

    try {
      const query = new URLSearchParams()
      if (filters.type) query.set('type', filters.type)
      if (filters.search) query.set('search', filters.search)
      if (filters.page) query.set('page', filters.page.toString())
      if (filters.perPage) query.set('perPage', filters.perPage.toString())

      const response = await $fetch<PaginatedResponse<Publication>>(
        `/api/publications?${query.toString()}`
      )

      publications.value = response.data
      meta.value = response.meta
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch publications'
    } finally {
      loading.value = false
    }
  }

  async function fetchPublication(id: string) {
    loading.value = true
    error.value = null

    try {
      const publication = await $fetch<Publication>(`/api/publications/${id}`)
      return publication
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch publication'
      return null
    } finally {
      loading.value = false
    }
  }

  const types: { value: PublicationType; label: string }[] = [
    { value: 'press-statement', label: 'Press Statement' },
    { value: 'bulletin', label: 'Bulletin' },
    { value: 'guideline', label: 'Auditing Guideline' },
    { value: 'manual', label: 'AMIS Manual' },
    { value: 'strategy', label: 'Strategy Document' },
    { value: 'law', label: 'Applicable Law' }
  ]

  return {
    publications,
    loading,
    error,
    meta,
    types,
    fetchPublications,
    fetchPublication
  }
}
