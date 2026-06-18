<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <NuxtLink
        to="/admin/users"
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Add User</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Invite a new admin user</p>
      </div>
    </div>

    <!-- Success: invitation sent -->
    <div v-if="created" class="max-w-2xl">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div class="flex items-center gap-3 mb-4">
          <div
            class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">User created</h2>
            <p class="text-sm text-gray-500">{{ created.name }} — {{ created.email }}</p>
          </div>
        </div>

        <div
          v-if="created.emailSent"
          class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400"
        >
          An invitation email with an acceptance link and the initial password has been sent to
          <strong>{{ created.email }}</strong
          >. The account stays <strong>pending</strong> until they accept it.
        </div>
        <div
          v-else
          class="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400"
        >
          The invitation email could not be sent (email is not configured). Share the initial
          password below with the user securely. They still need to accept their invitation before
          signing in.
        </div>

        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Initial password (shown once)
          </p>
          <div class="flex items-center gap-3">
            <code
              class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded font-mono text-lg tracking-wide text-gray-900 dark:text-white"
            >
              {{ created.generatedPassword }}
            </code>
            <button type="button" class="btn btn-ghost" @click="copyPassword">
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            For security this password will not be shown again.
          </p>
        </div>

        <div class="flex items-center justify-end gap-4 mt-6">
          <button type="button" class="btn btn-ghost" @click="resetForm">Add another</button>
          <NuxtLink to="/admin/users" class="btn btn-primary">Done</NuxtLink>
        </div>
      </div>
    </div>

    <!-- Create form -->
    <form v-else class="max-w-2xl" @submit.prevent="handleSubmit">
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
            placeholder="name@audit.gov.gh"
            :error="errors.email"
            @update:model-value="clearFieldError('email')"
          />
        </div>

        <div
          class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300"
        >
          The system generates a secure initial password and emails the user an invitation link. The
          account remains <strong>pending</strong> until the user accepts the invitation, after
          which they can sign in and change their password.
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AdminFormAdminSelect
            v-model="form.role"
            label="Role"
            :options="roleOptions"
            required
            :error="errors.role"
          />
        </div>

        <fieldset
          class="border-t border-gray-200 dark:border-gray-700 pt-6"
          aria-describedby="modules-help"
        >
          <legend class="font-medium text-gray-900 dark:text-white">Module access</legend>
          <p id="modules-help" class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Select which functional areas this user can manage. The role controls what they can do;
            modules control where.
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
              class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <input
                v-model="form.modules"
                type="checkbox"
                :value="m"
                class="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ moduleLabels[m] }}</span>
            </label>
          </div>
        </fieldset>

        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">
            Role Permissions
          </h3>
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
      </div>

      <div class="flex items-center justify-end gap-4 mt-6">
        <NuxtLink to="/admin/users" class="btn btn-ghost">Cancel</NuxtLink>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create & Send Invitation' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
  import type { AdminUser, CreateUserResponse, ModuleKey, UserInput } from '~/types/admin'
  import { ALL_MODULES } from '~/types/admin'
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
    role: 'editor',
    modules: []
  })

  const created = ref<CreateUserResponse | null>(null)
  const copied = ref(false)

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

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' }
  ]

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = (await create(form as Partial<AdminUser>)) as CreateUserResponse | null
    if (result) {
      created.value = result
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }

  async function copyPassword() {
    if (!created.value) return
    try {
      await navigator.clipboard.writeText(created.value.generatedPassword)
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    } catch {
      // Clipboard may be unavailable; the password is still visible on screen.
    }
  }

  function resetForm() {
    created.value = null
    copied.value = false
    form.name = ''
    form.email = ''
    form.role = 'editor'
    form.modules = []
  }
</script>
