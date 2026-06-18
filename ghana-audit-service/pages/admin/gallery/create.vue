<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/gallery"
        aria-label="Go back"
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Upload Image</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Add a new image to the gallery</p>
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
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Image</h2>
            <AdminFormAdminFileUpload
              v-model="form.url"
              type="image"
              label="Upload Image"
              required
            />
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Image Details</h2>
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
              <AdminFormAdminInput
                v-model="form.category"
                label="Category"
                placeholder="e.g., Events, Office, Staff"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <NuxtLink to="/admin/gallery" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving || !form.url">
          {{ saving ? 'Uploading...' : 'Add to Gallery' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminGalleryImage, GalleryImageInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminGalleryImage>('gallery')
  const { errors, validate, setErrors, rules } = useFormValidation()

  const form = reactive<GalleryImageInput>({
    url: '',
    category: '',
    translations: { en: { alt: '', caption: '' } }
  })

  const validationRules = {
    url: [rules.required]
  }

  const translationFields = [
    {
      key: 'alt',
      label: 'Alt Text',
      type: 'input' as const,
      placeholder: 'Describe the image for accessibility'
    },
    { key: 'caption', label: 'Caption', type: 'textarea' as const, rows: 2 }
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

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await create(form)
    if (result) {
      router.push('/admin/gallery')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
