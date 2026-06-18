<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/departments"
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create Department</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Add a new department</p>
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
              Department Details
            </h2>
            <AdminFormAdminTranslationTabs
              v-model="form.translations"
              :fields="translationFields"
              :errors="translationErrors"
            />
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Functions</h2>
              <button type="button" class="btn btn-ghost btn-sm" @click="addFunction">
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
              v-if="!form.functions || form.functions.length === 0"
              class="text-center py-8 text-gray-500 dark:text-gray-400"
            >
              No functions added yet. Click "Add" to define department functions.
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="(func, index) in form.functions!"
                :key="index"
                class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Function (English)</label
                      >
                      <input
                        v-model="func.translations.en.description"
                        type="text"
                        class="form-input w-full"
                        placeholder="Enter function description..."
                        required
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Function (Akan)</label
                      >
                      <input
                        v-model="func.translations.ak!.description"
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
                      @click="moveFunction(index, -1)"
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
                      v-if="index < (form.functions?.length ?? 0) - 1"
                      type="button"
                      class="p-1 text-gray-400 hover:text-gray-600"
                      @click="moveFunction(index, 1)"
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
                      @click="removeFunction(index)"
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
                  help-text="URL-friendly identifier (auto-generated from name)"
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
                v-model.number="form.displayOrder"
                label="Display Order"
                type="number"
              />
              <AdminFormAdminSelect
                v-model="form.headId"
                label="Department Head"
                :options="teamMemberOptions"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <NuxtLink to="/admin/departments" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Department' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminDepartment, DepartmentInput, AdminTeamMember } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminDepartment>('departments')
  const { items: teamMembers, fetchAll: fetchTeamMembers } =
    useAdminCrud<AdminTeamMember>('team-members')
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

  const form = reactive<DepartmentInput>({
    slug: '',
    headId: undefined,
    displayOrder: 0,
    translations: { en: { name: '', description: '' } },
    functions: []
  })

  const validationRules = {
    'translations.en.name': [rules.required],
    slug: [rules.required]
  }

  const translationFields = [
    { key: 'name', label: 'Department Name', type: 'input' as const, required: true },
    { key: 'description', label: 'Description', type: 'richtext' as const }
  ]

  // Transform errors for AdminTranslationTabs format
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

  const teamMemberOptions = computed(() => [
    { value: '', label: 'No head assigned' },
    ...teamMembers.value.map((m) => ({
      value: m.id,
      label: m.translations?.en?.name || `Member ${m.id}`
    }))
  ])

  function addFunction() {
    form.functions = form.functions || []
    form.functions.push({
      displayOrder: form.functions.length,
      translations: { en: { description: '' }, ak: { description: '' } }
    })
  }

  function removeFunction(index: number) {
    form.functions?.splice(index, 1)
    form.functions?.forEach((f, i) => (f.displayOrder = i))
  }

  function moveFunction(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= (form.functions?.length || 0)) return
    const funcs = form.functions!
    ;[funcs[index], funcs[newIndex]] = [funcs[newIndex], funcs[index]]
    funcs.forEach((f, i) => (f.displayOrder = i))
  }

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
      const { get } = useAdminApi()
      const response = await get<{ available: boolean; suggestion?: string }>(
        'departments/check-slug',
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

  // Auto-generate slug from name
  watch(
    () => form.translations.en?.name,
    (name) => {
      if (name) {
        const newSlug = generateSlug(name)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  onMounted(() => {
    fetchTeamMembers({ perPage: 100 })
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await create({
      ...form,
      headId: form.headId ? Number(form.headId) : undefined
    })
    if (result) {
      router.push('/admin/departments')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
