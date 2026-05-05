<template>
  <div>
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Add User</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Create a new admin user</p>
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

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AdminFormAdminInput
            v-model="form.password"
            label="Password"
            type="password"
            required
            minlength="8"
            :error="errors.password"
            @update:model-value="clearFieldError('password')"
          />
          <AdminFormAdminInput
            v-model="confirmPassword"
            label="Confirm Password"
            type="password"
            required
            :error="passwordMismatch ? 'Passwords do not match' : ''"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AdminFormAdminSelect
            v-model="form.role"
            label="Role"
            :options="roleOptions"
            required
            :error="errors.role"
          />
          <div class="flex items-end pb-1">
            <AdminFormAdminSwitch
              v-model="form.isActive"
              label="Active"
              description="User can log in and access the dashboard"
            />
          </div>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Role Permissions</h3>
          <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li v-if="form.role === 'admin'">
              <span class="font-medium text-primary">Admin:</span> Full access - create, edit,
              delete all content; manage users
            </li>
            <li v-else-if="form.role === 'editor'">
              <span class="font-medium text-accent">Editor:</span> Create and edit content; cannot
              delete or manage users
            </li>
            <li v-else>
              <span class="font-medium">Viewer:</span> Read-only access to dashboard and content
            </li>
          </ul>
        </div>
      </div>

      <div class="flex items-center justify-end gap-4 mt-6">
        <NuxtLink to="/admin/users" class="btn btn-ghost">Cancel</NuxtLink>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="saving || form.password !== confirmPassword"
        >
          {{ saving ? 'Creating...' : 'Create User' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminUser, UserInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { hasPermission } = useAdminAuth()
  const router = useRouter()

  // Redirect if not admin
  if (!hasPermission('manage_users')) {
    router.replace('/admin')
  }

  const { create, saving, error, fieldErrors } = useAdminCrud<AdminUser>('users')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()

  const form = reactive<UserInput>({
    name: '',
    email: '',
    password: '',
    role: 'editor',
    isActive: true
  })
  const confirmPassword = ref('')

  const validationRules = {
    name: [rules.required],
    email: [rules.required, rules.email],
    password: [rules.required, rules.minLength(8)],
    role: [rules.required]
  }

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' }
  ]

  const passwordMismatch = computed(
    () => form.password && confirmPassword.value && form.password !== confirmPassword.value
  )

  async function handleSubmit() {
    if (!validate(form, validationRules)) return
    if (passwordMismatch.value) return

    const result = await create(form)
    if (result) {
      router.push('/admin/users')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
