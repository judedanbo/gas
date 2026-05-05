interface NewsletterResponse {
  success: boolean
  message?: string
}

interface CSRFResponse {
  token: string
}

export function useNewsletter() {
  const email = ref('')
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const csrfToken = ref<string | null>(null)

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Validate email format
  function validateEmail(emailToValidate: string): boolean {
    return emailRegex.test(emailToValidate)
  }

  // Fetch CSRF token
  async function fetchCSRFToken(): Promise<string | null> {
    try {
      const response = await $fetch<CSRFResponse>('/api/csrf')
      csrfToken.value = response.token
      return response.token
    } catch {
      console.error('[Newsletter] Failed to fetch CSRF token')
      return null
    }
  }

  // Subscribe to newsletter
  async function subscribe(emailToSubscribe?: string): Promise<boolean> {
    const emailValue = emailToSubscribe || email.value

    // Reset states
    error.value = null
    success.value = false

    // Validate email
    if (!emailValue || !emailValue.trim()) {
      error.value = 'Please enter your email address'
      return false
    }

    if (!validateEmail(emailValue.trim())) {
      error.value = 'Please enter a valid email address'
      return false
    }

    loading.value = true

    try {
      // Fetch CSRF token if not already available
      const token = csrfToken.value || await fetchCSRFToken()
      if (!token) {
        error.value = 'Security validation failed. Please refresh and try again.'
        return false
      }

      const response = await $fetch<NewsletterResponse>('/api/newsletter', {
        method: 'POST',
        headers: {
          'x-csrf-token': token
        },
        body: {
          email: emailValue.trim()
        }
      })

      if (response.success) {
        success.value = true
        email.value = '' // Clear input on success
        return true
      } else {
        error.value = response.message || 'Subscription failed. Please try again.'
        return false
      }
    } catch (e: unknown) {
      // Clear CSRF token on error (will be refreshed on next attempt)
      csrfToken.value = null

      // Handle specific error cases
      if (e && typeof e === 'object' && 'statusCode' in e) {
        const statusCode = (e as { statusCode: number }).statusCode
        if (statusCode === 403) {
          error.value = 'Security validation failed. Please try again.'
          return false
        }
      }

      error.value = e instanceof Error ? e.message : 'An error occurred. Please try again.'
      return false
    } finally {
      loading.value = false
    }
  }

  // Reset all states
  function reset() {
    email.value = ''
    loading.value = false
    success.value = false
    error.value = null
    csrfToken.value = null
  }

  // Check if email is valid (for enabling/disabling submit button)
  const isEmailValid = computed(() => validateEmail(email.value.trim()))

  return {
    email,
    loading: readonly(loading),
    success: readonly(success),
    error: readonly(error),
    isEmailValid,
    subscribe,
    reset
  }
}
