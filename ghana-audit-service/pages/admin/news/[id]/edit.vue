<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Article not found</h2>
      <NuxtLink to="/admin/news" class="btn btn-primary">Back to News</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/news"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Article</h1>
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
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content</h2>
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
                <AdminFormAdminInput v-model="form.author" label="Author" />
                <AdminFormAdminInput v-model="form.category" label="Category" />
                <AdminFormAdminSwitch v-model="form.isPublished" label="Published" />
                <UiDateTimePicker
                  v-if="form.isPublished"
                  v-model="form.publishedAt"
                  label="Publish Date"
                  mode="datetime"
                />
              </div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Featured Image
              </h2>
              <AdminFormAdminFileUpload v-model="form.thumbnail" type="image" label="Thumbnail" />
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/news" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminNewsArticle, NewsInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminNewsArticle>('news')
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

  const form = reactive<NewsInput>({
    slug: '',
    author: '',
    thumbnail: '',
    category: '',
    isPublished: false,
    publishedAt: '',
    tagIds: [],
    translations: { en: { title: '', excerpt: '', content: '' } }
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    'translations.en.excerpt': [rules.required],
    'translations.en.content': [rules.requiredHtml],
    slug: [rules.required]
  }

  const translationFields = [
    { key: 'title', label: 'Title', type: 'input' as const, required: true },
    { key: 'excerpt', label: 'Excerpt', type: 'textarea' as const, rows: 3, required: true },
    { key: 'content', label: 'Content', type: 'richtext' as const, required: true }
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

  // Check slug availability with debounce (excludes current article)
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
      const { get } = useAdminApi()
      const response = await get<{ available: boolean; suggestion?: string }>('news/check-slug', {
        slug,
        excludeId: id
      })
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
      form.author = item.author || ''
      form.thumbnail = item.thumbnail || ''
      form.category = item.category || ''
      form.isPublished = item.isPublished
      form.publishedAt = item.publishedAt || ''
      form.tagIds = item.tags?.map((t) => t.id) || []
      form.translations = item.translations || { en: { title: '', excerpt: '', content: '' } }
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      ...form,
      publishedAt:
        form.publishedAt && !isNaN(Date.parse(form.publishedAt))
          ? form.publishedAt
          : new Date().toISOString()
    })
    if (result) {
      router.push('/admin/news')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
