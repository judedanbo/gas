<template>
  <div>
    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div class="space-y-2">
          <div class="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div class="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="space-y-3">
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="space-y-3">
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found -->
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Report not found</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        The report you're looking for doesn't exist or has been deleted.
      </p>
      <NuxtLink to="/admin/reports" class="btn btn-primary"> Back to Reports </NuxtLink>
    </div>

    <!-- Edit Form -->
    <template v-else>
      <!-- Page Header -->
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/reports"
          class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </NuxtLink>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Report</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ currentItem.translations?.en?.title || 'Untitled' }}
          </p>
        </div>
      </div>

      <!-- Form -->
      <form class="space-y-6" @submit.prevent="handleSubmit">
        <!-- Error Alert -->
        <div
          v-if="error"
          class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
        >
          {{ error }}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Main Content -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Translations -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content</h2>
              <AdminFormAdminTranslationTabs
                v-model="form.translations"
                :fields="translationFields"
                :errors="translationErrors"
              />
            </div>

            <!-- File Upload -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report File</h2>
              <AdminFormAdminFileUpload
                v-model="form.fileUrl"
                type="report"
                label="PDF File"
                required
                :error="errors.fileUrl"
                @file-info="handleFileInfo"
              />
            </div>
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <!-- Publish Settings -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
              <div class="space-y-4">
                <div>
                  <AdminFormAdminInput
                    v-model="form.slug"
                    label="Slug"
                    required
                    help-text="URL-friendly identifier"
                    :error="errors.slug || slugError"
                    @update:model-value="handleSlugChange"
                  >
                    <template #suffix>
                      <span v-if="isCheckingSlug" class="text-gray-400">
                        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      </span>
                      <span v-else-if="isSlugAvailable === true" class="text-green-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      <span v-else-if="isSlugAvailable === false" class="text-red-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </span>
                    </template>
                  </AdminFormAdminInput>
                  <p v-if="slugSuggestion" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Suggestion:
                    <button
                      type="button"
                      class="text-primary hover:underline"
                      @click="useSlugSuggestion"
                    >
                      {{ slugSuggestion }}
                    </button>
                  </p>
                </div>

                <AdminFormAdminSelect
                  v-model="form.category"
                  :options="categories"
                  label="Category"
                  required
                  :error="errors.category"
                />

                <AdminFormAdminSwitch
                  v-model="form.isPublished"
                  label="Published"
                  description="Make this report visible to the public"
                />

                <AdminFormAdminDatePicker
                  v-if="form.isPublished"
                  v-model="form.publishedAt"
                  label="Publish Date"
                  type="datetime-local"
                />
              </div>
            </div>

            <!-- Thumbnail -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Thumbnail</h2>
              <AdminFormAdminFileUpload
                v-model="form.thumbnail"
                type="thumbnail"
                label="Cover Image"
                help-text="Optional cover image for the report"
              />
            </div>

            <!-- Meta Info -->
            <div
              class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400"
            >
              <p>Created: {{ formatDate(currentItem.createdAt) }}</p>
              <p>Updated: {{ formatDate(currentItem.updatedAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/reports" class="btn btn-ghost"> Cancel </NuxtLink>
          <button
            type="submit"
            class="btn btn-primary inline-flex items-center gap-2"
            :disabled="saving"
          >
            <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminAuditReport, ReportInput } from '~/types/admin'

  definePageMeta({
    layout: 'admin'
  })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminAuditReport>('reports')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  // Slug checking state
  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  const slugError = computed(() => {
    if (isSlugAvailable.value === false) {
      return 'This slug is already taken'
    }
    return undefined
  })

  // Debounce timer for slug check
  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  // Form data
  const form = reactive<ReportInput>({
    slug: '',
    category: 'financial',
    fileUrl: '',
    fileSize: undefined,
    thumbnail: '',
    isPublished: false,
    publishedAt: '',
    translations: {
      en: { title: '', summary: '' }
    }
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    category: [rules.required],
    fileUrl: [rules.required]
  }

  // Translation fields
  const translationFields = [
    {
      key: 'title',
      label: 'Title',
      type: 'input' as const,
      required: true,
      placeholder: 'Enter report title'
    },
    {
      key: 'summary',
      label: 'Summary',
      type: 'textarea' as const,
      placeholder: 'Brief description of the report'
    }
  ]

  const translationErrors = computed(() => {
    const result: Record<string, Record<string, string>> = {}
    for (const [key, message] of Object.entries(errors)) {
      const match = key.match(/^translations\.(\w+)\.(\w+)$/)
      if (match) {
        const [, locale, field] = match
        if (!result[locale]) result[locale] = {}
        result[locale][field] = message
      }
    }
    return result
  })

  // Categories
  const categories = [
    { value: 'financial', label: 'Financial Audit' },
    { value: 'compliance', label: 'Compliance Audit' },
    { value: 'it', label: 'IT Audit' },
    { value: 'performance', label: 'Performance Audit' },
    { value: 'technical', label: 'Technical Audit' },
    { value: 'follow-up', label: 'Follow-up Review' },
    { value: 'special', label: 'Special Audit' }
  ]

  // Check slug availability with debounce (excludes current report)
  async function checkSlugAvailability(slug: string) {
    if (!slug) {
      isSlugAvailable.value = null
      slugSuggestion.value = null
      return
    }

    isCheckingSlug.value = true
    isSlugAvailable.value = null
    slugSuggestion.value = null

    try {
      const response = await $fetch<{ available: boolean; suggestion?: string }>(
        '/api/admin/reports/check-slug',
        { query: { slug, excludeId: id } }
      )
      isSlugAvailable.value = response.available
      slugSuggestion.value = response.suggestion || null
    } catch {
      // On error, assume available and let server validate on submit
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  // Handle slug input change
  function handleSlugChange(value: string | number) {
    const slugValue = String(value)
    clearFieldError('slug')

    // Clear previous timeout
    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout)
    }

    // Debounce the slug check
    slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(slugValue)
    }, 300)
  }

  // Use suggested slug
  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      form.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
    }
  }

  // Fetch report data
  onMounted(async () => {
    const report = await fetchOne(id)
    if (report) {
      // Populate form
      form.slug = report.slug
      form.category = report.category
      form.fileUrl = report.fileUrl
      form.fileSize = report.fileSize || undefined
      form.thumbnail = report.thumbnail || ''
      form.isPublished = report.isPublished
      form.publishedAt = report.publishedAt || ''
      form.translations = report.translations || { en: { title: '', summary: '' } }
    }
  })

  // Handle file info
  function handleFileInfo(info: { filename: string; size: number; mimeType: string }) {
    form.fileSize = info.size
  }

  // Format date
  function formatDate(date: string): string {
    return new Date(date).toLocaleString()
  }

  // Submit
  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const data: ReportInput = {
      ...form,
      publishedAt:
        form.isPublished && form.publishedAt ? form.publishedAt : new Date().toISOString()
    }

    const result = await update(id, data)
    if (result) {
      router.push('/admin/reports')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
