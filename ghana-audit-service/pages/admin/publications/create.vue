<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/publications"
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create Publication</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Add a new publication</p>
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
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document</h2>
            <AdminFormAdminFileModal
              resource="publications"
              label="Publication File"
              :file-url="form.fileUrl"
              :file-size="form.fileSize"
              :thumbnail="form.thumbnail"
              :error="errors.fileUrl"
              @update:file-url="form.fileUrl = $event"
              @update:file-size="form.fileSize = $event"
              @update:thumbnail="form.thumbnail = $event"
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
                  help-text="URL-friendly identifier (auto-generated from title)"
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
                v-model="form.type"
                :options="types"
                label="Type"
                required
                :error="errors.type"
              />
              <AdminFormAdminSwitch v-model="form.isPublished" label="Published" />

              <AdminFormAdminDatePicker
                v-if="form.isPublished"
                v-model="form.publishedAt"
                label="Publish Date"
                type="datetime-local"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <NuxtLink to="/admin/publications" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Publication' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminPublication, PublicationInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminPublication>('publications')
  const { errors, validate, setErrors, rules } = useFormValidation()

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

  const form = reactive<PublicationInput>({
    slug: '',
    type: 'press-statement',
    fileUrl: '',
    fileSize: undefined,
    thumbnail: '',
    isPublished: false,
    publishedAt: '',
    translations: { en: { title: '', excerpt: '', content: '' } }
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    type: [rules.required]
  }

  const translationFields = [
    { key: 'title', label: 'Title', type: 'input' as const, required: true },
    { key: 'excerpt', label: 'Excerpt', type: 'textarea' as const },
    { key: 'content', label: 'Content', type: 'richtext' as const }
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

  const types = [
    { value: 'press-statement', label: 'Press Statement' },
    { value: 'bulletin', label: 'Bulletin' },
    { value: 'guideline', label: 'Guideline' },
    { value: 'manual', label: 'Manual' },
    { value: 'strategy', label: 'Strategy' },
    { value: 'law', label: 'Law' }
  ]

  // Generate slug from text
  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  // Check slug availability with debounce
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
        '/api/admin/publications/check-slug',
        { query: { slug } }
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

  // Auto-generate slug from title
  watch(
    () => form.translations.en?.title,
    (title) => {
      if (title) {
        const newSlug = generateSlug(title)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await create({
      ...form,
      publishedAt:
        form.publishedAt && !isNaN(Date.parse(form.publishedAt))
          ? form.publishedAt
          : new Date().toISOString()
    })
    if (result) {
      router.push('/admin/publications')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
