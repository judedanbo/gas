<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
          <span class="text-white text-2xl font-bold">GAS</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Accept Invitation</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Ghana Audit Service</p>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <!-- Validating -->
        <div v-if="validating" class="text-center py-6 text-gray-600 dark:text-gray-400">
          <svg
            class="w-8 h-8 animate-spin mx-auto mb-3 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Validating your invitation…
        </div>

        <!-- Invalid / expired token -->
        <div v-else-if="tokenError" class="text-center py-4">
          <div
            class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400"
          >
            {{ tokenError }}
          </div>
          <NuxtLink to="/admin/login" class="text-sm text-primary hover:underline"
            >Go to sign in</NuxtLink
          >
        </div>

        <!-- Accepted -->
        <div v-else-if="accepted" class="text-center py-4">
          <div
            class="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Invitation accepted
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Your account is now active. You can sign in
            {{
              usedOwnPassword
                ? 'with your new password.'
                : 'with the initial password from your invitation email.'
            }}
          </p>
          <NuxtLink to="/admin/login" class="btn btn-primary w-full">Go to sign in</NuxtLink>
        </div>

        <!-- Accept form -->
        <form v-else @submit.prevent="handleAccept">
          <div
            v-if="error"
            class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400"
          >
            {{ error }}
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Welcome, <strong class="text-gray-900 dark:text-white">{{ invitee.name }}</strong
            >. Accept your invitation to activate your account
            <span class="text-gray-500">({{ invitee.email }})</span>.
          </p>

          <label class="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              v-model="setOwnPassword"
              type="checkbox"
              class="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">
              Set my own password now
              <span class="block text-xs text-gray-500">
                Otherwise, sign in with the initial password from your invitation email — you can
                change it later.
              </span>
            </span>
          </label>

          <div v-if="setOwnPassword" class="space-y-4 mb-6">
            <div>
              <label
                for="password"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >New password</label
              >
              <input
                id="password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                minlength="8"
                class="form-input w-full"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label
                for="confirm"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >Confirm password</label
              >
              <input
                id="confirm"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                class="form-input w-full"
                placeholder="Re-enter password"
              />
              <p v-if="passwordMismatch" class="text-xs text-red-600 mt-1">
                Passwords do not match
              </p>
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="submitting || (setOwnPassword && !passwordValid)"
          >
            {{ submitting ? 'Accepting…' : 'Accept Invitation' }}
          </button>
        </form>
      </div>

      <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Ghana Audit Service Admin Portal
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({ layout: false })

  const route = useRoute()
  const token = computed(() => (route.query.token as string) || '')

  const validating = ref(true)
  const tokenError = ref('')
  const invitee = reactive({ name: '', email: '' })

  const setOwnPassword = ref(false)
  const password = ref('')
  const confirmPassword = ref('')
  const submitting = ref(false)
  const error = ref('')
  const accepted = ref(false)
  const usedOwnPassword = ref(false)

  const passwordMismatch = computed(
    () => !!password.value && !!confirmPassword.value && password.value !== confirmPassword.value
  )
  const passwordValid = computed(
    () => password.value.length >= 8 && password.value === confirmPassword.value
  )

  onMounted(async () => {
    if (!token.value) {
      tokenError.value = 'No invitation token provided.'
      validating.value = false
      return
    }
    try {
      const res = await $fetch<{ valid: boolean; name: string; email: string }>(
        '/api/admin/auth/invitation',
        { params: { token: token.value } }
      )
      invitee.name = res.name
      invitee.email = res.email
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      tokenError.value =
        err.data?.message || err.message || 'This invitation is invalid or has expired.'
    } finally {
      validating.value = false
    }
  })

  async function handleAccept() {
    if (setOwnPassword.value && !passwordValid.value) return
    submitting.value = true
    error.value = ''
    try {
      await $fetch('/api/admin/auth/accept-invitation', {
        method: 'POST',
        body: {
          token: token.value,
          ...(setOwnPassword.value ? { password: password.value } : {})
        }
      })
      usedOwnPassword.value = setOwnPassword.value
      accepted.value = true
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to accept invitation.'
    } finally {
      submitting.value = false
    }
  }
</script>
