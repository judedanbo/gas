<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Auditor-General Message</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">
        Manage the "Message from the Auditor-General" section on the home page and the full message
        shown on the About page.
      </p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <div
      v-else-if="loadError"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-red-700 dark:text-red-400"
    >
      {{ loadError }}
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSubmit">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Content -->
        <div class="lg:col-span-2">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content</h2>
            <AdminFormAdminTranslationTabs
              v-model="form.translations"
              :fields="translationFields"
              :errors="translationErrors"
            />
          </div>
        </div>

        <!-- Settings -->
        <div class="lg:col-span-1">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
            <AdminFormAdminFileUpload
              v-model="form.photo"
              type="image"
              label="Photo"
              help-text="Upload a professional photo (max 5MB, JPG/PNG/WebP)"
              :error="errors.photo"
            />
            <AdminFormAdminSwitch
              v-model="form.isActive"
              label="Active"
              description="Show the Auditor-General message section on the public website"
            />
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminAuditorGeneralMessage } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { get, put } = useAdminApi()
  const { errors, validate, setErrors, rules } = useFormValidation()
  const toast = useToast()

  const loading = ref(true)
  const saving = ref(false)
  const loadError = ref<string | null>(null)

  const form = reactive({
    photo: '',
    isActive: true,
    translations: {
      en: { name: '', title: '', excerpt: '', fullMessage: '' },
      ak: { name: '', title: '', excerpt: '', fullMessage: '' }
    } as AdminAuditorGeneralMessage['translations']
  })

  const translationFields = [
    { key: 'name', label: 'Name', type: 'input' as const, required: true },
    { key: 'title', label: 'Title', type: 'input' as const, required: true },
    {
      key: 'excerpt',
      label: 'Message Excerpt (home page)',
      type: 'textarea' as const,
      rows: 5,
      required: true,
      placeholder: 'Short quote shown in the home page section'
    },
    {
      key: 'fullMessage',
      label: 'Full Message',
      type: 'richtext' as const,
      required: true,
      placeholder: 'The complete message shown on the About page'
    }
  ]

  const validationRules = {
    'translations.en.name': [rules.required],
    'translations.en.title': [rules.required],
    'translations.en.excerpt': [rules.required],
    'translations.en.fullMessage': [rules.requiredHtml]
  }

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

  onMounted(async () => {
    try {
      const item = await get<AdminAuditorGeneralMessage>('auditor-general')
      form.photo = item.photo || ''
      form.isActive = item.isActive
      form.translations = {
        en: {
          name: item.translations.en?.name || '',
          title: item.translations.en?.title || '',
          excerpt: item.translations.en?.excerpt || '',
          fullMessage: item.translations.en?.fullMessage || ''
        },
        ak: {
          name: item.translations.ak?.name || '',
          title: item.translations.ak?.title || '',
          excerpt: item.translations.ak?.excerpt || '',
          fullMessage: item.translations.ak?.fullMessage || ''
        }
      }
    } catch (err: unknown) {
      const fetchError = err as { statusCode?: number; data?: { message?: string } }
      loadError.value =
        fetchError.statusCode === 404
          ? 'The Auditor-General message has not been set up yet. Run the auditor-general database seed to create it.'
          : fetchError.data?.message || 'Failed to load the Auditor-General message.'
    } finally {
      loading.value = false
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    saving.value = true
    try {
      await put('auditor-general', { ...form, photo: form.photo || null })
      toast.success('Auditor-General message updated')
    } catch (err: unknown) {
      const fetchError = err as {
        data?: {
          message?: string
          errors?: Record<string, string>
          data?: { errors?: Record<string, string> }
        }
      }
      const fieldErrors = fetchError.data?.data?.errors || fetchError.data?.errors
      if (fieldErrors) {
        setErrors(fieldErrors)
      } else {
        toast.error(fetchError.data?.message || 'Failed to save the Auditor-General message')
      }
    } finally {
      saving.value = false
    }
  }
</script>
