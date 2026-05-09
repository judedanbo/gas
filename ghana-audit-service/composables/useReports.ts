import type { AuditReport, AuditCategory, PaginatedResponse } from '~/types'

interface ReportFilters {
  category?: AuditCategory
  year?: number
  search?: string
  page?: number
  perPage?: number
}

export function useReports() {
  const reports = ref<AuditReport[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const meta = ref({
    total: 0,
    page: 1,
    perPage: 10,
    lastPage: 1
  })

  async function fetchReports(filters: ReportFilters = {}) {
    loading.value = true
    error.value = null

    try {
      const query = new URLSearchParams()
      if (filters.category) query.set('category', filters.category)
      if (filters.year) query.set('year', filters.year.toString())
      if (filters.search) query.set('search', filters.search)
      if (filters.page) query.set('page', filters.page.toString())
      if (filters.perPage) query.set('perPage', filters.perPage.toString())

      const response = await $fetch<PaginatedResponse<AuditReport>>(
        `/api/reports?${query.toString()}`
      )

      reports.value = response.data
      meta.value = response.meta
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch reports'
    } finally {
      loading.value = false
    }
  }

  async function fetchReport(id: string) {
    loading.value = true
    error.value = null

    try {
      const report = await $fetch<AuditReport>(`/api/reports/${id}`)
      return report
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch report'
      return null
    } finally {
      loading.value = false
    }
  }

  const categories: { value: AuditCategory; label: string }[] = [
    { value: 'financial', label: 'Financial Audit' },
    { value: 'compliance', label: 'Compliance Audit' },
    { value: 'it', label: 'IT Audit' },
    { value: 'performance', label: 'Performance Audit' },
    { value: 'technical', label: 'Technical Audit' },
    { value: 'follow-up', label: 'Follow-up Review' },
    { value: 'special', label: 'Special Audit' }
  ]

  return {
    reports,
    loading,
    error,
    meta,
    categories,
    fetchReports,
    fetchReport
  }
}
