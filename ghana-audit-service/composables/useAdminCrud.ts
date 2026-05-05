import type { PaginationMeta } from '~/types/admin'

interface CrudOptions {
  // Custom endpoint if different from resource name
  endpoint?: string
}

export function useAdminCrud<T extends { id: number }>(
  resource: string,
  options: CrudOptions = {}
) {
  const api = useAdminApi()
  const endpoint = options.endpoint || resource

  // State
  const items = ref<T[]>([]) as Ref<T[]>
  const currentItem = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const saving = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  const meta = ref<PaginationMeta>({
    total: 0,
    page: 1,
    perPage: 20,
    lastPage: 1
  })

  // Fetch all items with optional filters
  async function fetchAll(
    params?: Record<string, string | number | boolean | undefined | null>
  ): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await api.getList<T>(endpoint, params)
      items.value = response.data
      meta.value = response.meta
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || `Failed to fetch ${resource}`
      items.value = []
    } finally {
      loading.value = false
    }
  }

  // Fetch single item by ID
  async function fetchOne(id: number): Promise<T | null> {
    loading.value = true
    error.value = null

    try {
      const item = await api.get<T>(`${endpoint}/${id}`)
      currentItem.value = item
      return item
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || `Failed to fetch ${resource}`
      currentItem.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  // Create new item
  async function create(data: Partial<T>): Promise<T | null> {
    saving.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const item = await api.post<T>(endpoint, data)
      // Add to items list if loaded
      if (items.value.length > 0) {
        items.value = [item, ...items.value]
        meta.value.total++
      }
      return item
    } catch (e: unknown) {
      const err = e as {
        data?: { message?: string; errors?: Record<string, string> }
        message?: string
      }
      error.value = err.data?.message || err.message || `Failed to create ${resource}`
      // Extract field-level errors from API response
      if (err.data?.errors && typeof err.data.errors === 'object') {
        fieldErrors.value = err.data.errors
      }
      return null
    } finally {
      saving.value = false
    }
  }

  // Update existing item
  async function update(id: number, data: Partial<T>): Promise<T | null> {
    saving.value = true
    error.value = null
    fieldErrors.value = {}

    try {
      const item = await api.put<T>(`${endpoint}/${id}`, data)
      // Update in items list if loaded
      const index = items.value.findIndex((i) => i.id === id)
      if (index !== -1) {
        items.value[index] = item
      }
      if (currentItem.value?.id === id) {
        currentItem.value = item
      }
      return item
    } catch (e: unknown) {
      const err = e as {
        data?: { message?: string; errors?: Record<string, string> }
        message?: string
      }
      error.value = err.data?.message || err.message || `Failed to update ${resource}`
      // Extract field-level errors from API response
      if (err.data?.errors && typeof err.data.errors === 'object') {
        fieldErrors.value = err.data.errors
      }
      return null
    } finally {
      saving.value = false
    }
  }

  // Delete item (soft delete)
  async function remove(id: number): Promise<boolean> {
    deleting.value = true
    error.value = null

    try {
      await api.del(`${endpoint}/${id}`)
      // Remove from items list
      items.value = items.value.filter((i) => i.id !== id)
      meta.value.total--
      if (currentItem.value?.id === id) {
        currentItem.value = null
      }
      return true
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || `Failed to delete ${resource}`
      return false
    } finally {
      deleting.value = false
    }
  }

  // Reset error state
  function clearError() {
    error.value = null
  }

  // Clear field errors
  function clearFieldErrors() {
    fieldErrors.value = {}
  }

  // Reset all state
  function reset() {
    items.value = []
    currentItem.value = null
    loading.value = false
    saving.value = false
    deleting.value = false
    error.value = null
    fieldErrors.value = {}
    meta.value = {
      total: 0,
      page: 1,
      perPage: 20,
      lastPage: 1
    }
  }

  return {
    // State
    items,
    currentItem,
    loading,
    saving,
    deleting,
    error,
    fieldErrors,
    meta,

    // Methods
    fetchAll,
    fetchOne,
    create,
    update,
    remove,
    clearError,
    clearFieldErrors,
    reset
  }
}
