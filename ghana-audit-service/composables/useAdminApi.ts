import type { PaginatedResponse, ReportUploadResponse, UploadResponse } from '~/types/admin'

export interface UploadOptions {
  /** Byte-transfer progress, 0–1. */
  onProgress?: (fraction: number) => void
}

export interface ReportUploadOptions extends UploadOptions {
  preset?: 'screen' | 'ebook' | 'printer'
  allowDropBookmarks?: boolean
}

/**
 * Error shape thrown by the XHR upload path, aligned with ofetch's
 * FetchError so existing `error.data?.message || error.message` handling
 * and the 401 redirect keep working.
 */
export interface UploadRequestError extends Error {
  statusCode: number
  statusMessage?: string
  data?: { message?: string; statusMessage?: string; [key: string]: unknown }
}

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

  // Multipart POST over XMLHttpRequest — the only browser API that reports
  // upload (request body) progress, which $fetch cannot. Report PDFs run to
  // 100MB, so the admin needs to see the transfer moving.
  function xhrUpload<T>(url: string, formData: FormData, opts: UploadOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      xhr.responseType = 'text'
      if (token.value) {
        xhr.setRequestHeader('Authorization', `Bearer ${token.value}`)
      }

      if (opts.onProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && e.total > 0) {
            opts.onProgress?.(Math.min(1, e.loaded / e.total))
          }
        })
      }

      const fail = (statusCode: number, message: string, data?: UploadRequestError['data']) => {
        const err = new Error(message) as UploadRequestError
        err.statusCode = statusCode
        err.statusMessage = data?.statusMessage ?? message
        err.data = data
        reject(err)
      }

      xhr.addEventListener('load', () => {
        let parsed: unknown
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null
        } catch {
          parsed = null
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed as T)
          return
        }
        const data = (parsed ?? {}) as NonNullable<UploadRequestError['data']>
        fail(
          xhr.status,
          data.message || data.statusMessage || `Upload failed (${xhr.status})`,
          data
        )
      })
      xhr.addEventListener('error', () => fail(0, 'Network error during upload'))
      xhr.addEventListener('abort', () => fail(0, 'Upload cancelled'))
      xhr.addEventListener('timeout', () => fail(0, 'Upload timed out'))

      xhr.send(formData)
    })
  }

  async function handleUploadError(error: unknown): Promise<never> {
    const fetchError = error as { statusCode?: number }
    if (fetchError.statusCode === 401) {
      clearAuth()
      await router.push({ path: '/admin/login', query: { reason: 'expired' } })
    }
    throw error
  }

  // File upload (synchronous server-side persistence; images, thumbnails,
  // publications).
  async function upload(
    file: File,
    type: 'report' | 'publication' | 'image' | 'thumbnail',
    opts: UploadOptions = {}
  ): Promise<UploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    try {
      return await xhrUpload<UploadResponse>(`/api/admin/upload?type=${type}`, formData, opts)
    } catch (error: unknown) {
      return handleUploadError(error)
    }
  }

  // A-G report upload: the request ends when the bytes land; storing,
  // thumbnailing and optimization continue as a server-side job that the
  // response identifies (see useReportUploadJobs for following it).
  async function uploadReport(
    file: File,
    opts: ReportUploadOptions = {}
  ): Promise<ReportUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    if (opts.preset) params.set('preset', opts.preset)
    if (opts.allowDropBookmarks) params.set('allowDropBookmarks', 'true')
    const qs = params.toString()
    const url = `/api/admin/reports/upload${qs ? `?${qs}` : ''}`
    try {
      return await xhrUpload<ReportUploadResponse>(url, formData, opts)
    } catch (error: unknown) {
      return handleUploadError(error)
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
    upload,
    uploadReport
  }
}
