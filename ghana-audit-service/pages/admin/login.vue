<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
          <span class="text-white text-2xl font-bold">GAS</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Admin Login</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Ghana Audit Service</p>
      </div>

      <!-- Login Form -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <form @submit.prevent="handleSubmit">
          <!-- Session Expired Notice -->
          <div
            v-if="showExpiredNotice"
            class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
            role="status"
          >
            <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span class="text-sm font-medium">Your session expired. Please sign in again.</span>
            </div>
          </div>

          <!-- Error Alert -->
          <div
            v-if="error"
            class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span class="text-sm font-medium">{{ error }}</span>
            </div>
          </div>

          <!-- Email Field -->
          <div class="mb-4">
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              class="form-input w-full"
              placeholder="admin@audit.gov.gh"
              :disabled="loading"
            />
          </div>

          <!-- Password Field -->
          <div class="mb-6">
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Password
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="form-input w-full pr-10"
                placeholder="Enter your password"
                :disabled="loading"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="btn btn-primary w-full flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
            <span>{{ loading ? 'Signing in...' : 'Sign In' }}</span>
          </button>
        </form>

        <!-- Back to Site -->
        <div class="mt-6 text-center">
          <NuxtLink
            to="/"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
          >
            Back to Main Site
          </NuxtLink>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Ghana Audit Service Admin Portal
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  definePageMeta({
    layout: false
  })

  const router = useRouter()
  const route = useRoute()
  const { login, loading, error, isAuthenticated, init } = useAdminAuth()

  const form = reactive({
    email: '',
    password: ''
  })

  const showPassword = ref(false)
  const showExpiredNotice = ref(route.query.reason === 'expired')

  // Initialize auth and redirect if already logged in
  onMounted(() => {
    init()
    if (isAuthenticated()) {
      const redirect = route.query.redirect as string
      router.replace(redirect || '/admin')
    }
  })

  async function handleSubmit() {
    const success = await login(form.email, form.password)

    if (success) {
      const redirect = route.query.redirect as string
      router.push(redirect || '/admin')
    }
  }
</script>
