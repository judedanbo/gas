<template>
  <div>
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink
        to="/admin/gallery"
        aria-label="Back to Gallery"
        class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create album</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Add a new album. You can upload images after it is created.
        </p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent="handleSubmit">
      <div
        v-if="error"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      >
        {{ error }}
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Details</h2>
            <AdminFormAdminTranslationTabs
              v-model="form.translations"
              :fields="translationFields"
              :errors="translationErrors"
            />
          </div>
        </div>

        <div class="space-y-6">
          <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
            <div class="space-y-4">
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
                    <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span v-else-if="isSlugAvailable === false" class="text-red-500">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <AdminFormAdminSwitch v-model="form.isPublished" label="Published" />
              <UiDateTimePicker v-model="form.publishedAt" label="Publish date" mode="datetime" />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-700"
      >
        <NuxtLink to="/admin/gallery" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating…' : 'Create album' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminGalleryAlbum, GalleryAlbumInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminGalleryAlbum>('gallery/albums')
  const { errors, validate, setErrors, rules } = useFormValidation()

  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  const slugError = computed(() =>
    isSlugAvailable.value === false ? 'This slug is already taken' : undefined
  )

  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  const form = reactive<GalleryAlbumInput>({
    slug: '',
    coverImageId: null,
    publishedAt: new Date().toISOString(),
    isPublished: false,
    translations: { en: { title: '', description: '' } }
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required]
  }

  const translationFields = [
    { key: 'title', label: 'Title', type: 'input' as const, required: true },
    { key: 'description', label: 'Description', type: 'textarea' as const, rows: 4 }
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

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

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
      const response = await get<{ available: boolean; suggestion?: string }>(
        'gallery/albums/check-slug',
        { slug }
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
    if (slugCheckTimeout) clearTimeout(slugCheckTimeout)
    slugCheckTimeout = setTimeout(() => checkSlugAvailability(slugValue), 300)
  }

  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      form.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
    }
  }

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
      router.push(`/admin/gallery/albums/${result.id}`)
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
