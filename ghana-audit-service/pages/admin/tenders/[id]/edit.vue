<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Tender not found</h2>
      <NuxtLink to="/admin/tenders" class="btn btn-primary">Back to Tenders</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/tenders"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Tender</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ currentItem.translations?.en?.title }}
          </p>
        </div>
      </div>

      <form class="space-y-6" @submit.prevent="handleSubmit">
        <div
          v-if="error"
          class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
        >
          {{ error }}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Tender Details
              </h2>
              <AdminFormAdminTranslationTabs
                v-model="form.translations"
                :fields="translationFields"
                :errors="translationErrors"
              />
            </div>
          </div>

          <div class="space-y-6">
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
                <AdminFormAdminInput
                  v-model="form.referenceNumber"
                  label="Reference Number"
                  required
                  :error="errors.referenceNumber"
                  placeholder="e.g., GAS/PROC/2024/001"
                  @update:model-value="clearFieldError('referenceNumber')"
                />
                <AdminFormAdminInput
                  v-model="form.category"
                  label="Category"
                  placeholder="e.g., Goods, Services, Works"
                />
                <AdminFormAdminSelect
                  v-model="form.status"
                  label="Status"
                  :options="statusOptions"
                  required
                  :error="errors.status"
                />
                <AdminFormAdminDatePicker
                  v-model="form.submissionDeadline"
                  label="Submission Deadline"
                  type="datetime-local"
                  required
                  :error="errors.submissionDeadline"
                />
                <AdminFormAdminDatePicker
                  v-model="form.openingDate"
                  label="Bid Opening Date"
                  type="datetime-local"
                />
                <AdminFormAdminDatePicker
                  v-model="form.publishedAt"
                  label="Published Date"
                  type="datetime-local"
                  help-text="When this tender was/will be published"
                />
              </div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documents</h2>
              <AdminFormAdminFileUpload
                v-model="form.documentUrl"
                type="publication"
                label="Tender Document"
                accept=".pdf,.doc,.docx"
              />
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/tenders" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminTender, TenderInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminTender>('tenders')
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

  const form = reactive<TenderInput>({
    slug: '',
    referenceNumber: '',
    category: '',
    submissionDeadline: '',
    openingDate: '',
    documentUrl: '',
    publishedAt: '',
    status: 'open',
    translations: { en: { title: '', description: '' } }
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    referenceNumber: [rules.required],
    status: [rules.required],
    submissionDeadline: [rules.required]
  }

  const translationFields = [
    { key: 'title', label: 'Tender Title', type: 'input' as const, required: true },
    { key: 'description', label: 'Description', type: 'richtext' as const }
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

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'awarded', label: 'Awarded' },
    { value: 'cancelled', label: 'Cancelled' }
  ]

  // Check slug availability with debounce (excludes current tender)
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
        '/api/admin/tenders/check-slug',
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

  onMounted(async () => {
    const item = await fetchOne(id)
    if (item) {
      form.slug = item.slug
      form.referenceNumber = item.referenceNumber
      form.category = item.category || ''
      form.submissionDeadline = item.submissionDeadline || ''
      form.openingDate = item.openingDate || ''
      form.documentUrl = item.documentUrl || ''
      form.publishedAt = item.publishedAt ? item.publishedAt.slice(0, 16) : ''
      form.status = item.status
      form.translations = item.translations || { en: { title: '', description: '' } }
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      ...form,
      publishedAt: form.publishedAt || new Date().toISOString()
    })
    if (result) {
      router.push('/admin/tenders')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
