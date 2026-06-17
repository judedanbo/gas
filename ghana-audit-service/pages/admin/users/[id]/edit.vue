<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">User not found</h2>
      <NuxtLink to="/admin/users" class="btn btn-primary">Back to Users</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/users"
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit User</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">{{ currentItem.name }}</p>
        </div>
      </div>

      <form class="max-w-2xl" @submit.prevent="handleSubmit">
        <div
          v-if="error"
          class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
        >
          {{ error }}
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AdminFormAdminInput
              v-model="form.name"
              label="Full Name"
              required
              :error="errors.name"
              @update:model-value="clearFieldError('name')"
            />
            <AdminFormAdminInput
              v-model="form.email"
              label="Email Address"
              type="email"
              required
              :error="errors.email"
              @update:model-value="clearFieldError('email')"
            />
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 class="font-medium text-gray-900 dark:text-white mb-4">Change Password</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Leave blank to keep current password
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminFormAdminInput
                v-model="form.password"
                label="New Password"
                type="password"
                minlength="8"
                :error="errors.password"
                @update:model-value="clearFieldError('password')"
              />
              <AdminFormAdminInput
                v-model="confirmPassword"
                label="Confirm Password"
                type="password"
                :error="passwordMismatch ? 'Passwords do not match' : ''"
              />
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminFormAdminSelect
                v-model="form.role"
                label="Role"
                :options="roleOptions"
                required
                :disabled="isCurrentUser"
                :error="errors.role"
              />
              <div class="flex items-end pb-1">
                <AdminFormAdminSwitch
                  v-model="form.isActive"
                  label="Active"
                  description="User can log in and access the dashboard"
                  :disabled="isCurrentUser"
                />
              </div>
            </div>
            <p v-if="isCurrentUser" class="mt-2 text-sm text-amber-600 dark:text-amber-400">
              You cannot change your own role or status
            </p>
          </div>

          <fieldset
            class="border-t border-gray-200 dark:border-gray-700 pt-6"
            aria-describedby="modules-help"
          >
            <legend class="font-medium text-gray-900 dark:text-white">Module access</legend>
            <p id="modules-help" class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
              Select which functional areas this user can manage. The role controls what they can
              do; modules control where.
            </p>
            <p
              v-if="isAdminRole"
              class="text-sm text-primary bg-primary/5 border border-primary/20 rounded-lg p-3"
            >
              Admins have full access to all modules.
            </p>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                v-for="m in ALL_MODULES"
                :key="m"
                class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                :class="
                  isCurrentUser
                    ? 'opacity-60 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
                "
              >
                <input
                  v-model="form.modules"
                  type="checkbox"
                  :value="m"
                  :disabled="isCurrentUser"
                  class="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ moduleLabels[m] }}</span>
              </label>
            </div>
          </fieldset>

          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 class="font-medium text-gray-900 dark:text-white mb-2">Role Permissions</h3>
            <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li v-if="form.role === 'admin'">
                <span class="font-medium text-primary">Admin:</span> Full access - create, edit,
                delete all content; manage users
              </li>
              <li v-else-if="form.role === 'editor'">
                <span class="font-medium text-accent">Editor:</span> Create and edit content (within
                assigned modules); cannot delete or manage users
              </li>
              <li v-else>
                <span class="font-medium">Viewer:</span> Read-only access to assigned modules
              </li>
            </ul>
          </div>

          <div v-if="currentItem.lastLoginAt" class="text-sm text-gray-500 dark:text-gray-400">
            Last login: {{ new Date(currentItem.lastLoginAt).toLocaleString() }}
          </div>
        </div>

        <div class="flex items-center justify-end gap-4 mt-6">
          <NuxtLink to="/admin/users" class="btn btn-ghost">Cancel</NuxtLink>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="saving || !!(form.password && form.password !== confirmPassword)"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminUser, ModuleKey, UserInput } from '~/types/admin'
  import { ALL_MODULES } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { user: currentUser, hasPermission } = useAdminAuth()

  // Redirect if not admin
  if (!hasPermission('manage_users')) {
    router.replace('/admin')
  }

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminUser>('users')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  // Edit always works with a concrete password string + active flag (unlike
  // the invite-based create flow), so narrow the optional UserInput fields.
  const form = reactive<UserInput & { password: string; isActive: boolean }>({
    name: '',
    email: '',
    password: '',
    role: 'editor',
    modules: [],
    isActive: true
  })
  const confirmPassword = ref('')

  const isAdminRole = computed(() => form.role === 'admin')

  const moduleLabels: Record<ModuleKey, string> = {
    reports: 'Audit Reports',
    content: 'Content (Publications, News, Events, Tags)',
    careers: 'Careers (Vacancies, Tenders)',
    organization: 'Organization (Team, Departments, Offices)',
    media: 'Media (Gallery, Videos)',
    analytics: 'Analytics & Audit Logs',
    communications: 'Communications (Newsletter, Contact Forms)'
  }

  const ORG_EMAIL_DOMAIN = 'audit.gov.gh'
  const orgEmailRule = (value: unknown): true | string => {
    const str = (value as string) || ''
    if (!str) return true // Let required handle empty
    return (
      str.toLowerCase().endsWith(`@${ORG_EMAIL_DOMAIN}`) ||
      `Email must be an @${ORG_EMAIL_DOMAIN} address`
    )
  }

  const validationRules = {
    name: [rules.required],
    email: [rules.required, rules.email, orgEmailRule],
    role: [rules.required]
  }

  const isCurrentUser = computed(() => currentUser.value?.id === id)
  const passwordMismatch = computed(
    () => form.password && confirmPassword.value && form.password !== confirmPassword.value
  )

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' }
  ]

  onMounted(async () => {
    const item = await fetchOne(id)
    if (item) {
      form.name = item.name
      form.email = item.email
      form.role = item.role
      form.modules = item.modules ?? []
      form.isActive = item.isActive
      form.password = ''
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return
    if (passwordMismatch.value) return

    const updateData: Partial<UserInput> = {
      name: form.name,
      email: form.email
    }

    // Only include password if changed
    if (form.password) {
      updateData.password = form.password
    }

    // Don't allow changing own role/status/modules
    if (!isCurrentUser.value) {
      updateData.role = form.role
      updateData.isActive = form.isActive
      updateData.modules = form.modules
    }

    const result = await update(id, updateData as UserInput)
    if (result) {
      router.push('/admin/users')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
