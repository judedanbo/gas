<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Office not found</h2>
      <NuxtLink to="/admin/offices" class="btn btn-primary">Back to Offices</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/offices"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Office</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            {{ currentItem.translations?.en?.name }}
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
                Office Details
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
                <AdminFormAdminSelect
                  v-model="form.typeId"
                  label="Office Type"
                  :options="officeTypeOptions"
                  required
                  :error="errors.typeId"
                />
                <AdminFormAdminSelect
                  v-if="parentTypeSlug"
                  v-model="form.parentId"
                  label="Parent Office"
                  :options="parentOfficeOptions"
                  :help-text="parentHelpText"
                />
                <AdminFormAdminSelect
                  v-model="form.region"
                  label="Region"
                  :options="regionOptions"
                  required
                  :error="errors.region"
                />
                <AdminFormAdminInput v-model="form.phone" label="Phone" type="tel" />
                <AdminFormAdminInput
                  v-model="form.email"
                  label="Email"
                  type="email"
                  :error="errors.email"
                  @update:model-value="clearFieldError('email')"
                />
                <AdminFormAdminInput
                  v-model.number="form.displayOrder"
                  label="Display Order"
                  type="number"
                />
              </div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Location Coordinates
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Optional: Add GPS coordinates for map display
              </p>
              <div class="space-y-4">
                <AdminFormAdminInput
                  v-model.number="form.latitude"
                  label="Latitude"
                  type="number"
                  step="any"
                  placeholder="e.g., 5.5600"
                />
                <AdminFormAdminInput
                  v-model.number="form.longitude"
                  label="Longitude"
                  type="number"
                  step="any"
                  placeholder="e.g., -0.1969"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/offices" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminOffice, OfficeInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { getList } = useAdminApi()
  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminOffice>('offices')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  const slugError = computed(() => {
    if (isSlugAvailable.value === false) return 'This slug is already taken'
    return undefined
  })

  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  const officeTypesData = ref<{ id: number; slug: string; name: string }[]>([])
  const allOffices = ref<AdminOffice[]>([])

  const parentTypeMap: Record<string, string> = {
    'district-office': 'regional-office',
    branch: 'sector',
    unit: 'branch'
  }

  const selectedTypeSlug = computed(() => {
    const t = officeTypesData.value.find((t) => t.id === Number(form.typeId))
    return t?.slug || ''
  })

  const parentTypeSlug = computed(() => parentTypeMap[selectedTypeSlug.value] || '')

  const parentHelpText = computed(() => {
    const labels: Record<string, string> = {
      'regional-office': 'Select the parent regional office',
      sector: 'Select the parent sector',
      branch: 'Select the parent branch'
    }
    return labels[parentTypeSlug.value] || 'Select the parent office'
  })

  const parentOfficeOptions = computed(() => {
    if (!parentTypeSlug.value) return []
    const parentType = officeTypesData.value.find((t) => t.slug === parentTypeSlug.value)
    if (!parentType) return []
    return allOffices.value
      .filter((o) => o.typeId === parentType.id)
      .map((o) => ({ value: o.id, label: o.translations?.en?.name || o.slug }))
  })

  const form = reactive<OfficeInput>({
    slug: '',
    typeId: 0,
    parentId: null,
    region: '',
    phone: '',
    email: '',
    latitude: undefined,
    longitude: undefined,
    displayOrder: 0,
    translations: { en: { name: '', address: '' } }
  })

  const validationRules = {
    'translations.en.name': [rules.required],
    slug: [rules.required],
    typeId: [rules.required],
    region: [rules.required],
    email: [rules.email]
  }

  const translationFields = [
    { key: 'name', label: 'Office Name', type: 'input' as const, required: true },
    { key: 'address', label: 'Address', type: 'textarea' as const, rows: 3 }
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

  const officeTypeOptions = computed(() =>
    officeTypesData.value.map((t) => ({ value: t.id, label: t.name }))
  )

  const regionOptions = [
    { value: 'Greater Accra', label: 'Greater Accra' },
    { value: 'Ashanti', label: 'Ashanti' },
    { value: 'Western', label: 'Western' },
    { value: 'Eastern', label: 'Eastern' },
    { value: 'Central', label: 'Central' },
    { value: 'Northern', label: 'Northern' },
    { value: 'Upper East', label: 'Upper East' },
    { value: 'Upper West', label: 'Upper West' },
    { value: 'Volta', label: 'Volta' },
    { value: 'Brong Ahafo', label: 'Brong Ahafo' },
    { value: 'Bono', label: 'Bono' },
    { value: 'Bono East', label: 'Bono East' },
    { value: 'Ahafo', label: 'Ahafo' },
    { value: 'Oti', label: 'Oti' },
    { value: 'North East', label: 'North East' },
    { value: 'Savannah', label: 'Savannah' },
    { value: 'Western North', label: 'Western North' }
  ]

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
        'offices/check-slug',
        { slug, excludeId: id }
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

    if (slugCheckTimeout) clearTimeout(slugCheckTimeout)
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

  onMounted(async () => {
    try {
      const types = await getList<{ id: number; slug: string; name: string }>('offices/types')
      officeTypesData.value =
        (types as unknown as { id: number; slug: string; name: string }[]) || []

      const parentSlugs = Object.values(parentTypeMap)
      const allParentOffices: AdminOffice[] = []
      for (const slug of parentSlugs) {
        const result = await getList<AdminOffice>('offices', { typeSlug: slug })
        allParentOffices.push(...(result.data || []))
      }
      allOffices.value = allParentOffices
    } catch {
      // Types will be empty
    }

    const item = await fetchOne(id)
    if (item) {
      form.slug = item.slug
      form.typeId = item.typeId
      form.parentId = item.parentId ?? null
      form.region = item.region
      form.phone = item.phone || ''
      form.email = item.email || ''
      form.latitude = item.latitude || undefined
      form.longitude = item.longitude || undefined
      form.displayOrder = item.displayOrder
      form.translations = item.translations || { en: { name: '', address: '' } }
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      ...form,
      typeId: Number(form.typeId),
      parentId: form.parentId ? Number(form.parentId) : null
    })
    if (result) {
      router.push('/admin/offices')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
