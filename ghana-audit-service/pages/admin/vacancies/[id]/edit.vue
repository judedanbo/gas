<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vacancy not found</h2>
      <NuxtLink to="/admin/vacancies" class="btn btn-primary">Back to Vacancies</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/vacancies"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Vacancy</h1>
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
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Details</h2>
              <AdminFormAdminTranslationTabs
                v-model="form.translations"
                :fields="translationFields"
                :errors="translationErrors"
              />
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Requirements</h2>
                <button type="button" class="btn btn-ghost btn-sm" @click="addRequirement">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add
                </button>
              </div>
              <div
                v-if="!form.requirements || form.requirements.length === 0"
                class="text-center py-8 text-gray-500 dark:text-gray-400"
              >
                No requirements added yet. Click "Add" to add job requirements.
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(req, index) in form.requirements!"
                  :key="index"
                  class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 space-y-3">
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >Requirement (English)</label
                        >
                        <input
                          v-model="req.translations.en.description"
                          type="text"
                          :class="[
                            'form-input w-full',
                            errors[`requirements.${index}.translations.en.description`]
                              ? 'border-red-500'
                              : ''
                          ]"
                          placeholder="Enter requirement..."
                          required
                        />
                        <p
                          v-if="errors[`requirements.${index}.translations.en.description`]"
                          class="mt-1 text-sm text-red-600 dark:text-red-400"
                        >
                          {{ errors[`requirements.${index}.translations.en.description`] }}
                        </p>
                      </div>
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >Requirement (Akan)</label
                        >
                        <input
                          v-model="req.translations.ak!.description"
                          type="text"
                          class="form-input w-full"
                          placeholder="Akan translation (optional)"
                        />
                      </div>
                    </div>
                    <div class="flex flex-col items-center gap-2">
                      <button
                        v-if="index > 0"
                        type="button"
                        class="p-1 text-gray-400 hover:text-gray-600"
                        @click="moveRequirement(index, -1)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        v-if="index < (form.requirements?.length ?? 0) - 1"
                        type="button"
                        class="p-1 text-gray-400 hover:text-gray-600"
                        @click="moveRequirement(index, 1)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="p-1 text-red-400 hover:text-red-600"
                        @click="removeRequirement(index)"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
                  v-model="form.location"
                  label="Location"
                  required
                  :error="errors.location"
                  placeholder="e.g., Accra, Ghana"
                  @update:model-value="clearFieldError('location')"
                />
                <AdminFormAdminSelect
                  v-model="form.type"
                  label="Employment Type"
                  :options="typeOptions"
                  required
                  :error="errors.type"
                />
                <AdminFormAdminSelect
                  v-model="form.departmentId"
                  label="Department"
                  :options="departmentOptions"
                />
                <UiDateTimePicker
                  v-model="form.deadline"
                  label="Application Deadline"
                  mode="date"
                  required
                  :error="errors.deadline"
                />
                <UiDateTimePicker
                  v-model="form.publishedAt"
                  label="Published Date"
                  mode="datetime"
                  help-text="When this vacancy was/will be published"
                />
                <AdminFormAdminSwitch
                  v-model="form.isActive"
                  label="Active"
                  description="Make this vacancy visible to applicants"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/vacancies" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminVacancy, VacancyInput, AdminDepartment } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminVacancy>('vacancies')
  const { items: departments, fetchAll: fetchDepartments } =
    useAdminCrud<AdminDepartment>('departments')
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

  const form = reactive<VacancyInput>({
    slug: '',
    location: '',
    type: 'full-time',
    departmentId: undefined,
    deadline: '',
    publishedAt: '',
    isActive: true,
    translations: { en: { title: '', description: '' } },
    requirements: []
  })

  const validationRules = {
    'translations.en.title': [rules.required],
    slug: [rules.required],
    location: [rules.required],
    type: [rules.required],
    deadline: [rules.required]
  }

  const translationFields = [
    { key: 'title', label: 'Job Title', type: 'input' as const, required: true },
    { key: 'description', label: 'Job Description', type: 'richtext' as const }
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

  const typeOptions = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' }
  ]

  const departmentOptions = computed(() => [
    { value: '', label: 'No department' },
    ...departments.value.map((d) => ({
      value: d.id,
      label: d.translations?.en?.name || `Department ${d.id}`
    }))
  ])

  function addRequirement() {
    form.requirements = form.requirements || []
    form.requirements.push({
      displayOrder: form.requirements.length,
      translations: { en: { description: '' }, ak: { description: '' } }
    })
  }

  function removeRequirement(index: number) {
    form.requirements?.splice(index, 1)
    form.requirements?.forEach((r, i) => (r.displayOrder = i))
  }

  function moveRequirement(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= (form.requirements?.length || 0)) return
    const reqs = form.requirements!
    ;[reqs[index], reqs[newIndex]] = [reqs[newIndex], reqs[index]]
    reqs.forEach((r, i) => (r.displayOrder = i))
  }

  // Check slug availability with debounce (excludes current vacancy)
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
        'vacancies/check-slug',
        { slug, excludeId: id }
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
    fetchDepartments({ perPage: 100 })
    const item = await fetchOne(id)
    if (item) {
      form.slug = item.slug
      form.location = item.location
      form.type = item.type
      form.departmentId = item.departmentId || undefined
      form.deadline = item.deadline?.split('T')[0] || ''
      form.publishedAt = item.publishedAt ? item.publishedAt.slice(0, 16) : ''
      form.isActive = item.isActive
      form.translations = item.translations || { en: { title: '', description: '' } }
      form.requirements =
        item.requirements?.map((r) => ({
          displayOrder: r.displayOrder,
          translations: {
            en: { description: r.translations?.en?.description || '' },
            ak: { description: r.translations?.ak?.description || '' }
          }
        })) || []
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      ...form,
      departmentId: form.departmentId ? Number(form.departmentId) : undefined,
      publishedAt: form.publishedAt || new Date().toISOString()
    })
    if (result) {
      router.push('/admin/vacancies')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
