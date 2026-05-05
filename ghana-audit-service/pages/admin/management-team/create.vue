<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/management-team"
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Add Management Team Member</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Add Auditor-General, Deputy AG, or Regional Auditor
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
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Member Details</h2>
            <AdminFormAdminTranslationTabs
              v-model="form.translations"
              :fields="translationFields"
              :errors="translationErrors"
            />
          </div>

          <div
            v-if="form.role === 'deputy-auditor-general' || form.role === 'regional-auditor'"
            class="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Responsibilities</h2>
              <button type="button" class="btn btn-ghost btn-sm" @click="addResponsibility">
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
              v-if="!form.responsibilities || form.responsibilities.length === 0"
              class="text-center py-8 text-gray-500 dark:text-gray-400"
            >
              No responsibilities added yet. Click "Add" to add key responsibilities.
            </div>
            <div v-else class="space-y-4">
              <div
                v-for="(resp, index) in form.responsibilities!"
                :key="index"
                class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Responsibility (English)</label
                      >
                      <input
                        v-model="resp.translations.en.description"
                        type="text"
                        class="form-input w-full"
                        placeholder="Enter responsibility..."
                        required
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >Responsibility (Akan)</label
                      >
                      <input
                        v-model="resp.translations.ak!.description"
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
                      @click="moveResponsibility(index, -1)"
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
                      v-if="index < (form.responsibilities?.length ?? 0) - 1"
                      type="button"
                      class="p-1 text-gray-400 hover:text-gray-600"
                      @click="moveResponsibility(index, 1)"
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
                      @click="removeResponsibility(index)"
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
              <AdminFormAdminSelect
                v-model="form.role"
                label="Role"
                :options="roleOptions"
                required
                :error="errors.role"
              />
              <AdminFormAdminSelect
                v-if="form.role === 'regional-auditor'"
                v-model="form.regionalOfficeId"
                label="Regional Office"
                :options="regionalOfficeOptions"
                required
                :error="errors.regionalOfficeId"
                help-text="Select the regional office for this auditor"
              />
              <AdminFormAdminSelect
                v-if="form.role === 'deputy-auditor-general'"
                v-model="form.departmentId"
                label="Department"
                :options="departmentOptions"
                required
                :error="errors.departmentId"
                help-text="Select the department for this DAG"
              />
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
                v-if="form.role === 'deputy-auditor-general' || form.role === 'regional-auditor'"
                v-model="form.icon"
                label="Icon"
                placeholder="e.g., heroicons:building-library"
                help-text="Heroicon name for org chart display"
              />
              <AdminFormAdminInput
                v-model="form.email"
                label="Email"
                type="email"
                placeholder="email@audit.gov.gh"
              />
              <AdminFormAdminInput
                v-model="form.phone"
                label="Phone"
                placeholder="+233 XXX XXX XXX"
              />
              <AdminFormAdminFileUpload
                v-model="form.photo"
                type="image"
                label="Photo"
                help-text="Upload a professional photo (max 5MB, JPG/PNG/WebP)"
                :error="errors.photo"
              />
              <AdminFormAdminInput
                v-model="form.displayOrder"
                label="Display Order"
                type="number"
                help-text="Lower numbers appear first"
              />
              <AdminFormAdminSwitch
                v-model="form.isActive"
                label="Active"
                description="Show this member on the public website"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <NuxtLink to="/admin/management-team" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Member' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type {
    AdminManagementTeamMember,
    ManagementTeamMemberInput,
    AdminRegionalOffice,
    AdminDepartment
  } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } =
    useAdminCrud<AdminManagementTeamMember>('management-team')
  const { errors, validate, setErrors, rules } = useFormValidation()
  const { getList } = useAdminApi()

  // Fetch regional offices for dropdown
  const regionalOfficesData = ref<{ data: AdminRegionalOffice[] } | null>(null)
  // Fetch departments for dropdown
  const departmentsData = ref<{ data: AdminDepartment[] } | null>(null)

  onMounted(async () => {
    try {
      const [offices, departments] = await Promise.all([
        getList<AdminRegionalOffice>('regional-offices'),
        getList<AdminDepartment>('departments')
      ])
      regionalOfficesData.value = offices
      departmentsData.value = departments
    } catch {
      // Silently fail - dropdowns will just be empty
    }
  })

  const regionalOfficeOptions = computed(() => {
    return (regionalOfficesData.value?.data || []).map((office) => ({
      value: office.id,
      label: office.translations?.en?.name || office.region
    }))
  })

  const departmentOptions = computed(() => {
    return (departmentsData.value?.data || []).map((dept) => ({
      value: dept.id,
      label: dept.translations?.en?.name || 'Unnamed'
    }))
  })

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

  const form = reactive<ManagementTeamMemberInput>({
    slug: '',
    role: 'auditor-general',
    regionalOfficeId: null,
    departmentId: null,
    icon: '',
    photo: '',
    email: '',
    phone: '',
    displayOrder: 0,
    isActive: true,
    translations: { en: { name: '', title: '', bio: '' } },
    responsibilities: []
  })

  const validationRules = {
    'translations.en.name': [rules.required],
    slug: [rules.required],
    role: [rules.required]
  }

  const translationFields = [
    { key: 'name', label: 'Full Name', type: 'input' as const, required: true },
    { key: 'title', label: 'Title/Portfolio', type: 'input' as const, required: false },
    { key: 'bio', label: 'Biography', type: 'richtext' as const }
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

  const roleOptions = [
    { value: 'auditor-general', label: 'Auditor-General' },
    { value: 'deputy-auditor-general', label: 'Deputy Auditor-General' },
    { value: 'regional-auditor', label: 'Regional Auditor' }
  ]

  function addResponsibility() {
    form.responsibilities = form.responsibilities || []
    form.responsibilities.push({
      displayOrder: form.responsibilities.length,
      translations: { en: { description: '' }, ak: { description: '' } }
    })
  }

  function removeResponsibility(index: number) {
    form.responsibilities?.splice(index, 1)
    form.responsibilities?.forEach((r, i) => (r.displayOrder = i))
  }

  function moveResponsibility(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= (form.responsibilities?.length || 0)) return
    const resps = form.responsibilities!
    ;[resps[index], resps[newIndex]] = [resps[newIndex], resps[index]]
    resps.forEach((r, i) => (r.displayOrder = i))
  }

  // Generate slug from text
  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  // Get role prefix for slug
  function getRolePrefix(role: string): string {
    const prefixes: Record<string, string> = {
      'auditor-general': 'ag',
      'deputy-auditor-general': 'dag',
      'regional-auditor': 'ra'
    }
    return prefixes[role] || ''
  }

  // Generate slug with role prefix
  function generateSlugWithPrefix(name: string, role: string): string {
    const baseSlug = generateSlug(name)
    const prefix = getRolePrefix(role)
    return prefix ? `${prefix}-${baseSlug}` : baseSlug
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
        'management-team/check-slug',
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

  // Auto-generate slug from name with role prefix
  watch(
    () => form.translations.en?.name,
    (name) => {
      if (name) {
        const newSlug = generateSlugWithPrefix(name, form.role)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  // Regenerate slug when role changes
  watch(
    () => form.role,
    (newRole) => {
      const name = form.translations.en?.name
      if (name) {
        const newSlug = generateSlugWithPrefix(name, newRole)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await create({
      ...form,
      displayOrder: Number(form.displayOrder) || 0,
      regionalOfficeId: form.regionalOfficeId ? Number(form.regionalOfficeId) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      icon: form.icon || null,
      photo: form.photo || null,
      email: form.email || null,
      phone: form.phone || null
    })
    if (result) {
      router.push('/admin/management-team')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
