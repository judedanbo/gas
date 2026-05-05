<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Team member not found
      </h2>
      <NuxtLink to="/admin/team-members" class="btn btn-primary">Back to Team Members</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/team-members"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Team Member</h1>
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
                Profile Information
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
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Photo</h2>
              <AdminFormAdminFileUpload v-model="form.photo" type="image" label="Profile Photo" />
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Details</h2>
              <div class="space-y-4">
                <AdminFormAdminSelect
                  v-model="form.departmentId"
                  label="Department"
                  :options="departmentOptions"
                />
                <AdminFormAdminInput
                  v-model="form.email"
                  label="Email"
                  type="email"
                  :error="errors.email"
                  @update:model-value="clearFieldError('email')"
                />
                <AdminFormAdminInput v-model="form.phone" label="Phone" type="tel" />
                <AdminFormAdminInput
                  v-model.number="form.displayOrder"
                  label="Display Order"
                  type="number"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <NuxtLink to="/admin/team-members" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminTeamMember, TeamMemberInput, AdminDepartment } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminTeamMember>('team-members')
  const { items: departments, fetchAll: fetchDepartments } =
    useAdminCrud<AdminDepartment>('departments')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  const form = reactive<TeamMemberInput>({
    departmentId: undefined,
    photo: '',
    email: '',
    phone: '',
    displayOrder: 0,
    translations: { en: { name: '', position: '', bio: '' } }
  })

  const validationRules = {
    'translations.en.name': [rules.required],
    'translations.en.position': [rules.required],
    email: [rules.email]
  }

  const translationFields = [
    { key: 'name', label: 'Full Name', type: 'input' as const, required: true },
    { key: 'position', label: 'Position/Title', type: 'input' as const, required: true },
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

  const departmentOptions = computed(() => [
    { value: '', label: 'No department' },
    ...departments.value.map((d) => ({
      value: d.id,
      label: d.translations?.en?.name || `Department ${d.id}`
    }))
  ])

  onMounted(async () => {
    fetchDepartments({ perPage: 100 })
    const item = await fetchOne(id)
    if (item) {
      form.departmentId = item.departmentId || undefined
      form.photo = item.photo || ''
      form.email = item.email || ''
      form.phone = item.phone || ''
      form.displayOrder = item.displayOrder
      form.translations = item.translations || { en: { name: '', position: '', bio: '' } }
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      ...form,
      departmentId: form.departmentId ? Number(form.departmentId) : undefined
    })
    if (result) {
      router.push('/admin/team-members')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
