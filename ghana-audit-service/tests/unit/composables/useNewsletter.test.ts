import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, readonly } from 'vue'

// Mock Vue's ref, computed, readonly as globals (like Nuxt auto-imports)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('readonly', readonly)

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useNewsletter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('initial state', () => {
    it('should have correct initial state', async () => {
      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { email, loading, success, error } = useNewsletter()

      expect(email.value).toBe('')
      expect(loading.value).toBe(false)
      expect(success.value).toBe(false)
      expect(error.value).toBeNull()
    })
  })

  describe('isEmailValid', () => {
    it('should return false for empty email', async () => {
      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { isEmailValid, email } = useNewsletter()

      email.value = ''
      expect(isEmailValid.value).toBe(false)
    })

    it('should return false for invalid email', async () => {
      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { isEmailValid, email } = useNewsletter()

      email.value = 'invalid-email'
      expect(isEmailValid.value).toBe(false)

      email.value = 'test@'
      expect(isEmailValid.value).toBe(false)

      email.value = '@example.com'
      expect(isEmailValid.value).toBe(false)
    })

    it('should return true for valid email', async () => {
      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { isEmailValid, email } = useNewsletter()

      email.value = 'test@example.com'
      expect(isEmailValid.value).toBe(true)

      email.value = 'user.name@domain.co.uk'
      expect(isEmailValid.value).toBe(true)
    })
  })

  describe('subscribe', () => {
    it('should return false and set error for empty email', async () => {
      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, error } = useNewsletter()

      const result = await subscribe('')

      expect(result).toBe(false)
      expect(error.value).toBe('Please enter your email address')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return false and set error for invalid email', async () => {
      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, error } = useNewsletter()

      const result = await subscribe('invalid-email')

      expect(result).toBe(false)
      expect(error.value).toBe('Please enter a valid email address')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should fetch CSRF token before subscribing', async () => {
      mockFetch
        .mockResolvedValueOnce({ token: 'csrf-token-123' })
        .mockResolvedValueOnce({ success: true })

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe } = useNewsletter()

      await subscribe('test@example.com')

      expect(mockFetch).toHaveBeenCalledWith('/api/csrf')
    })

    it('should send subscription request with CSRF token', async () => {
      mockFetch
        .mockResolvedValueOnce({ token: 'csrf-token-123' })
        .mockResolvedValueOnce({ success: true })

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe } = useNewsletter()

      await subscribe('test@example.com')

      expect(mockFetch).toHaveBeenCalledWith('/api/newsletter', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'csrf-token-123'
        },
        body: {
          email: 'test@example.com'
        }
      })
    })

    it('should return true and set success on successful subscription', async () => {
      mockFetch
        .mockResolvedValueOnce({ token: 'csrf-token-123' })
        .mockResolvedValueOnce({ success: true })

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, success, email } = useNewsletter()

      email.value = 'test@example.com'
      const result = await subscribe()

      expect(result).toBe(true)
      expect(success.value).toBe(true)
      expect(email.value).toBe('') // Should clear on success
    })

    it('should return false and set error on failed subscription', async () => {
      mockFetch
        .mockResolvedValueOnce({ token: 'csrf-token-123' })
        .mockResolvedValueOnce({ success: false, message: 'Email already exists' })

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, error, success } = useNewsletter()

      const result = await subscribe('test@example.com')

      expect(result).toBe(false)
      expect(success.value).toBe(false)
      expect(error.value).toBe('Email already exists')
    })

    it('should handle CSRF token fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('CSRF error'))

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, error } = useNewsletter()

      const result = await subscribe('test@example.com')

      expect(result).toBe(false)
      expect(error.value).toBe('Security validation failed. Please refresh and try again.')
    })

    it('should handle 403 error (CSRF validation failure)', async () => {
      mockFetch
        .mockResolvedValueOnce({ token: 'csrf-token-123' })
        .mockRejectedValueOnce({ statusCode: 403 })

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, error } = useNewsletter()

      const result = await subscribe('test@example.com')

      expect(result).toBe(false)
      expect(error.value).toBe('Security validation failed. Please try again.')
    })

    it('should set loading state during subscription', async () => {
      let resolveCSRF: (value: unknown) => void
      let resolveSubscribe: (value: unknown) => void

      mockFetch
        .mockReturnValueOnce(new Promise(r => { resolveCSRF = r }))
        .mockReturnValueOnce(new Promise(r => { resolveSubscribe = r }))

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, loading } = useNewsletter()

      const promise = subscribe('test@example.com')

      // Loading should be true after validation passes and fetch starts
      resolveCSRF!({ token: 'token' })
      await new Promise(r => setTimeout(r, 0))

      expect(loading.value).toBe(true)

      resolveSubscribe!({ success: true })
      await promise

      expect(loading.value).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state values', async () => {
      mockFetch
        .mockResolvedValueOnce({ token: 'csrf-token-123' })
        .mockResolvedValueOnce({ success: true })

      const { useNewsletter } = await import('../../../composables/useNewsletter')
      const { subscribe, reset, email, success, error } = useNewsletter()

      // Set some state
      email.value = 'test@example.com'
      await subscribe()

      expect(success.value).toBe(true)

      // Reset
      reset()

      expect(email.value).toBe('')
      expect(success.value).toBe(false)
      expect(error.value).toBeNull()
    })
  })
})
