<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/events"
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create Event</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Add a new event</p>
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
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Details</h2>
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
              <AdminFormAdminDatePicker
                v-model="form.startDate"
                label="Start Date"
                type="datetime-local"
                required
                :error="errors.startDate"
              />
              <AdminFormAdminDatePicker
                v-model="form.endDate"
                label="End Date"
                type="datetime-local"
              />
              <AdminFormAdminSwitch
                v-model="form.isVirtual"
                label="Virtual Event"
                description="This event will be held online"
              />
              <AdminFormAdminInput
                v-if="form.isVirtual"
                v-model="form.registrationUrl"
                label="Registration URL"
                type="url"
                :error="errors.registrationUrl"
                @update:model-value="clearFieldError('registrationUrl')"
              />
              <AdminFormAdminSwitch v-model="form.isPublished" label="Published" />
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Image</h2>
            <AdminFormAdminFileUpload v-model="form.thumbnail" type="image" label="Thumbnail" />
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <NuxtLink to="/admin/events" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Event' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminEvent, EventInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminEvent>('events')
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

  const form = reactive<EventInput>({
    slug: '',
    startDate: '',
    endDate: '',
    isVirtual: false,
    registrationUrl: '',
    thumbnail: '',
    isPublished: false,
    translations: { en: { title: '', description: '', location: '' } }
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    startDate: [rules.required],
    registrationUrl: [rules.url]
  }

  const translationFields = [
    { key: 'title', label: 'Title', type: 'input' as const, required: true },
    { key: 'location', label: 'Location', type: 'input' as const },
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
        '/api/admin/events/check-slug',
        { query: { slug } }
      )
      isSlugAvailable.value = response.available
      slugSuggestion.value = response.suggestion || null
    } catch {
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  // Handle slug input change
  function handleSlugChange(value: string | number) {
    const slugValue = String(value)

    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout)
    }

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

    const result = await create(form)
    if (result) {
      router.push('/admin/events')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
