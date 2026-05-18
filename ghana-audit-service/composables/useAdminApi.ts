import type { PaginatedResponse, UploadResponse } from '~/types/admin'

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
}

export function useAdminApi() {
  const { token, clearAuth } = useAdminAuth()
  const router = useRouter()

  // Base request function with auth headers
  async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...options.headers
    }

    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    try {
      // Build URL with query params
      let url = `/api/admin/${endpoint}`
      if (options.params) {
        const searchParams = new URLSearchParams()
        Object.entries(options.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value))
          }
        })
        const queryString = searchParams.toString()
        if (queryString) {
          url += `?${queryString}`
        }
      }

      const response = await $fetch(url, {
        method: options.method || 'GET',
        body: options.body as Record<string, unknown> | BodyInit | null | undefined,
        headers
      })
      return response as T
    } catch (error: unknown) {
      // Handle 401 Unauthorized - redirect to login
      const fetchError = error as { statusCode?: number }
      if (fetchError.statusCode === 401) {
        clearAuth()
        await router.push({ path: '/admin/login', query: { reason: 'expired' } })
      }

      // Re-throw the error for component handling
      throw error
    }
  }

  // GET request
  function get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): Promise<T> {
    return request<T>(endpoint, { method: 'GET', params })
  }

  // GET paginated list
  function getList<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): Promise<PaginatedResponse<T>> {
    return request<PaginatedResponse<T>>(endpoint, { method: 'GET', params })
  }

  // POST request
  function post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: 'POST', body })
  }

  // PUT request
  function put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: 'PUT', body })
  }

  // PATCH request
  function patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: 'PATCH', body })
  }

  // DELETE request
  function del<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' })
  }

  // File upload
  async function upload(
    file: File,
    type: 'report' | 'publication' | 'image' | 'thumbnail'
  ): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const headers: Record<string, string> = {}
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    try {
      return await $fetch<UploadResponse>(`/api/admin/upload?type=${type}`, {
        method: 'POST',
        body: formData,
        headers
      })
    } catch (error: unknown) {
      const fetchError = error as { statusCode?: number }
      if (fetchError.statusCode === 401) {
        clearAuth()
        await router.push({ path: '/admin/login', query: { reason: 'expired' } })
      }
      throw error
    }
  }

  return {
    request,
    get,
    getList,
    post,
    put,
    patch,
    del,
    upload
  }
}
