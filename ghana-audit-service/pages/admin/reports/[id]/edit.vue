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

            <!-- Report File -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div class="flex items-start justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Report File</h2>
                <button
                  v-if="form.fileUrl"
                  type="button"
                  class="btn btn-ghost text-sm"
                  :disabled="optimization.isRunning.value"
                  @click="optimizeExistingFile()"
                >
                  {{ optimization.isRunning.value ? 'Optimizing…' : 'Optimize PDF' }}
                </button>
              </div>
              <AdminFormAdminFileModal
                resource="reports"
                label="Report File"
                :file-url="form.fileUrl"
                :file-size="form.fileSize"
                :thumbnail="form.thumbnail"
                :error="errors.fileUrl"
                :report-id="id"
                required
                @update:file-url="form.fileUrl = $event"
                @update:file-size="form.fileSize = $event"
                @update:thumbnail="form.thumbnail = $event"
              />
              <div
                v-if="optimization.status.value !== 'idle'"
                class="mt-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-sm"
                aria-live="polite"
              >
                <div v-if="optimization.isRunning.value" class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="font-medium text-gray-700 dark:text-gray-300">
                      {{ inlinePhaseLabel }}
                    </span>
                    <span
                      v-if="
                        (optimization.phase.value === 'classify' ||
                          optimization.phase.value === 'ocr') &&
                        optimization.totalPages.value > 0
                      "
                      class="text-gray-500"
                    >
                      Page {{ optimization.page.value }} of {{ optimization.totalPages.value }}
                    </span>
                  </div>
                  <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      class="h-2 bg-primary rounded-full transition-all duration-200"
                      :style="{ width: `${optimization.progress.value}%` }"
                    />
                  </div>
                </div>
                <p
                  v-else-if="optimization.status.value === 'success' && optimization.result.value"
                  class="text-green-700 dark:text-green-400"
                >
                  <template v-if="optimization.result.value.skippedCompression">
                    File was already well-compressed; original kept.
                  </template>
                  <template v-else>
                    Reduced to {{ formatBytes(optimization.result.value.optimizedSize) }} (saved
                    {{ formatBytes(optimization.result.value.savedBytes) }})
                  </template>
                </p>
                <p
                  v-else-if="optimization.status.value === 'error'"
                  class="text-amber-700 dark:text-amber-400"
                >
                  Optimization failed: {{ optimization.error.value }}
                  <button
                    v-if="
                      optimization.error.value && optimization.error.value.includes('HAS_BOOKMARKS')
                    "
                    type="button"
                    class="ml-2 underline"
                    @click="optimizeExistingFile({ allowDropBookmarks: true })"
                  >
                    Optimize anyway (drops bookmarks)
                  </button>
                </p>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <!-- Status -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h2>
              <div class="space-y-4">
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      form.isPublished
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    ]"
                  >
                    {{ form.isPublished ? 'Published' : 'Draft' }}
                  </span>
                </div>

                <AdminFormAdminSwitch
                  v-model="form.isPublished"
                  label="Published"
                  description="Make this report visible to the public"
                />

                <UiDateTimePicker
                  v-if="form.isPublished"
                  v-model="form.publishedAt"
                  label="Publish Date"
                  mode="datetime"
                />
              </div>
            </div>

            <!-- URL -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">URL</h2>
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
            </div>

            <!-- Classification -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Classification
              </h2>
              <AdminFormAdminSelect
                v-model="form.category"
                :options="categories"
                label="Category"
                required
                :error="errors.category"
              />
            </div>

            <!-- History -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <button
                type="button"
                class="w-full flex items-center justify-between px-6 py-4 text-left"
                @click="historyExpanded = !historyExpanded"
              >
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">History</h2>
                <svg
                  :class="[
                    'w-5 h-5 text-gray-400 transition-transform',
                    historyExpanded ? 'rotate-180' : ''
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                v-if="historyExpanded"
                class="border-t border-gray-200 dark:border-gray-700 px-6 py-4"
              >
                <div v-if="historyLoading" class="flex justify-center py-4">
                  <div
                    class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
                  />
                </div>
                <div
                  v-else-if="historyEntries.length === 0"
                  class="text-sm text-gray-500 dark:text-gray-400 py-2"
                >
                  No history available
                </div>
                <div v-else class="relative">
                  <div class="absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-600" />
                  <div
                    v-for="entry in historyEntries.slice(0, 10)"
                    :key="entry.id"
                    class="relative pl-8 pb-4 last:pb-0"
                  >
                    <div
                      class="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"
                      :class="{
                        'bg-green-500': entry.action === 'create',
                        'bg-blue-500': entry.action === 'update',
                        'bg-red-500': entry.action === 'delete'
                      }"
                    />
                    <div class="text-sm">
                      <span class="font-medium text-gray-900 dark:text-white">{{
                        entry.userName
                      }}</span>
                      <span class="text-gray-500 dark:text-gray-400">
                        {{
                          entry.action === 'create'
                            ? ' created'
                            : entry.action === 'update'
                              ? ' updated'
                              : ' deleted'
                        }}
                        this report
                      </span>
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {{ formatRelativeTime(entry.createdAt) }}
                      </p>
                      <div v-if="entry.action === 'update' && entry.changes">
                        <button
                          type="button"
                          class="text-xs text-primary hover:underline mt-1"
                          @click="entry._expanded = !entry._expanded"
                        >
                          {{ entry._expanded ? 'Hide changes' : 'View changes' }}
                        </button>
                        <div
                          v-if="entry._expanded"
                          class="mt-2 text-xs space-y-1 bg-gray-50 dark:bg-gray-700/50 rounded p-2"
                        >
                          <div
                            v-for="(change, field) in getChangedFields(entry.changes)"
                            :key="field"
                            class="text-gray-600 dark:text-gray-400"
                          >
                            <span class="font-medium">{{ humanizeField(String(field)) }}:</span>
                            <span class="text-red-500 line-through">{{
                              truncateValue(String(change.before))
                            }}</span>
                            <span class="mx-1">&rarr;</span>
                            <span class="text-green-600">{{
                              truncateValue(String(change.after))
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Meta Info -->
            <div
              class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 space-y-1"
            >
              <p>Created: {{ formatDate(currentItem.createdAt) }}</p>
              <p>Updated: {{ formatDate(currentItem.updatedAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Sticky Save Bar -->
        <Transition name="slide-up">
          <div
            v-if="hasChanges || saving"
            class="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
          >
            <div class="flex items-center justify-between max-w-full">
              <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <span class="w-2 h-2 rounded-full bg-amber-500" />
                Unsaved changes
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="saving"
                  @click="handleDiscard"
                >
                  Discard
                </button>
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
            </div>
          </div>
        </Transition>
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
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminAuditReport>('reports')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()
  const toast = useToast()
  const optimization = useReportOptimization()

  async function optimizeExistingFile(opts?: { allowDropBookmarks?: boolean }) {
    if (!form.fileUrl) return
    await optimization.start({
      fileUrl: form.fileUrl,
      preset: 'ebook',
      reportId: id,
      allowDropBookmarks: opts?.allowDropBookmarks
    })
    if (optimization.status.value === 'success' && optimization.result.value) {
      if (!optimization.result.value.skippedCompression) {
        form.fileSize = optimization.result.value.optimizedSize
        toast.success('PDF optimized')
      } else {
        toast.success('Optimization complete — original was already small')
      }
      // Refresh the row so other fields (e.g. updatedAt) stay current.
      await fetchOne(id)
    } else if (optimization.status.value === 'error') {
      toast.error(optimization.error.value || 'Optimization failed')
    }
  }

  const inlinePhaseLabel = computed(() => {
    switch (optimization.phase.value) {
      case 'inspect':
        return 'Inspecting PDF…'
      case 'split':
        return 'Splitting pages…'
      case 'classify':
        return 'Classifying pages…'
      case 'ocr':
        return 'Running OCR…'
      case 'merge':
        return 'Reassembling…'
      case 'compress':
        return 'Compressing…'
      default:
        return 'Optimizing PDF…'
    }
  })

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

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

  // Unsaved changes tracking
  const { hasChanges, markSaved } = useUnsavedChanges(() => ({
    slug: form.slug,
    category: form.category,
    fileUrl: form.fileUrl,
    fileSize: form.fileSize,
    thumbnail: form.thumbnail,
    isPublished: form.isPublished,
    publishedAt: form.publishedAt,
    translations: form.translations
  }))

  // History state
  const historyExpanded = ref(false)
  const historyLoading = ref(false)
  const historyEntries = ref<
    Array<{
      id: number
      action: string
      userName: string
      changes: Record<string, unknown> | null
      createdAt: string
      _expanded?: boolean
    }>
  >([])

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    category: [rules.required],
    fileUrl: [rules.required]
  }

  // Translation fields — richtext for summary
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
      type: 'richtext' as const,
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
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  function handleSlugChange(value: string | number) {
    const slugValue = String(value)
    clearFieldError('slug')

    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout)
    }

    slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(slugValue)
    }, 300)
  }

  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      form.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
    }
  }

  // Fetch history
  async function fetchHistory() {
    historyLoading.value = true
    try {
      const response = await $fetch<{ data: (typeof historyEntries.value)[number][] }>(
        `/api/admin/reports/${id}/history`
      )
      historyEntries.value = response.data.map((e) => ({ ...e, _expanded: false }))
    } catch {
      historyEntries.value = []
    } finally {
      historyLoading.value = false
    }
  }

  // Fetch report data
  onMounted(async () => {
    const report = await fetchOne(id)
    if (report) {
      form.slug = report.slug
      form.category = report.category
      form.fileUrl = report.fileUrl
      form.fileSize = report.fileSize || undefined
      form.thumbnail = report.thumbnail || ''
      form.isPublished = report.isPublished
      form.publishedAt = report.publishedAt || ''
      form.translations = report.translations || { en: { title: '', summary: '' } }
      nextTick(() => markSaved())
    }
    fetchHistory()
  })

  function formatDate(date: string): string {
    return new Date(date).toLocaleString()
  }

  function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    return date.toLocaleDateString()
  }

  function getChangedFields(
    changes: Record<string, unknown> | null
  ): Record<string, { before: unknown; after: unknown }> {
    if (!changes) return {}
    const before = (changes.before || {}) as Record<string, unknown>
    const after = (changes.after || {}) as Record<string, unknown>
    const result: Record<string, { before: unknown; after: unknown }> = {}

    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        result[key] = { before: before[key], after: after[key] }
      }
    }
    return result
  }

  function humanizeField(field: string): string {
    const map: Record<string, string> = {
      slug: 'Slug',
      category: 'Category',
      isPublished: 'Published',
      is_published: 'Published',
      publishedAt: 'Publish Date',
      published_at: 'Publish Date',
      fileUrl: 'File',
      file_url: 'File',
      fileSize: 'File Size',
      file_size: 'File Size',
      thumbnail: 'Thumbnail',
      translations: 'Content'
    }
    return (
      map[field] ||
      field
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase())
    )
  }

  function truncateValue(value: string, maxLength = 50): string {
    if (typeof value === 'object') return JSON.stringify(value).slice(0, maxLength)
    const str = String(value)
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
  }

  // Submit — stays on page with toast
  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const data: ReportInput = {
      ...form,
      publishedAt:
        form.isPublished && form.publishedAt ? form.publishedAt : new Date().toISOString()
    }

    const result = await update(id, data)
    if (result) {
      toast.success('Report updated successfully')
      markSaved()
      await fetchOne(id)
      if (currentItem.value) {
        form.publishedAt = currentItem.value.publishedAt || ''
      }
      nextTick(() => markSaved())
      fetchHistory()
    } else {
      if (fieldErrors.value) {
        setErrors(fieldErrors.value)
      }
      toast.error(error.value || 'Failed to save report')
    }
  }

  // Discard changes — revert to last saved state
  function handleDiscard() {
    if (currentItem.value) {
      form.slug = currentItem.value.slug
      form.category = currentItem.value.category
      form.fileUrl = currentItem.value.fileUrl
      form.fileSize = currentItem.value.fileSize || undefined
      form.thumbnail = currentItem.value.thumbnail || ''
      form.isPublished = currentItem.value.isPublished
      form.publishedAt = currentItem.value.publishedAt || ''
      form.translations = currentItem.value.translations || { en: { title: '', summary: '' } }
      nextTick(() => markSaved())
    }
  }
</script>

<style scoped>
  .slide-up-enter-active {
    transition: all 0.3s ease-out;
  }

  .slide-up-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-up-enter-from {
    opacity: 0;
    transform: translateY(100%);
  }

  .slide-up-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }
</style>
