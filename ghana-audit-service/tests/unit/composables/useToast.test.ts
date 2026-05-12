import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock Vue's ref as global (like Nuxt auto-imports)
vi.stubGlobal('ref', ref)

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should have an empty toasts array initially', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts } = useToast()

      expect(toasts.value).toEqual([])
    })
  })

  describe('adding toasts', () => {
    it('should add a success toast', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success } = useToast()

      success('Operation completed')

      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0]).toMatchObject({
        type: 'success',
        message: 'Operation completed',
        duration: 4000,
      })
      expect(toasts.value[0].id).toBeDefined()
    })

    it('should add an error toast', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, error } = useToast()

      error('Something went wrong')

      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0]).toMatchObject({
        type: 'error',
        message: 'Something went wrong',
      })
    })

    it('should add a warning toast', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, warning } = useToast()

      warning('Be careful')

      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0]).toMatchObject({
        type: 'warning',
        message: 'Be careful',
      })
    })

    it('should add an info toast', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, info } = useToast()

      info('Just so you know')

      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0]).toMatchObject({
        type: 'info',
        message: 'Just so you know',
      })
    })

    it('should add multiple toasts', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success, error } = useToast()

      success('First')
      error('Second')

      expect(toasts.value).toHaveLength(2)
      expect(toasts.value[0].message).toBe('First')
      expect(toasts.value[1].message).toBe('Second')
    })

    it('should generate unique IDs for each toast', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success } = useToast()

      success('First')
      success('Second')

      expect(toasts.value[0].id).not.toBe(toasts.value[1].id)
    })
  })

  describe('auto-dismiss', () => {
    it('should auto-dismiss after default 4000ms', async () => {
      vi.useFakeTimers()

      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success } = useToast()

      success('Will disappear')

      expect(toasts.value).toHaveLength(1)

      vi.advanceTimersByTime(3999)
      expect(toasts.value).toHaveLength(1)

      vi.advanceTimersByTime(1)
      expect(toasts.value).toHaveLength(0)
    })

    it('should auto-dismiss after custom duration', async () => {
      vi.useFakeTimers()

      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success } = useToast()

      success('Quick toast', 2000)

      expect(toasts.value).toHaveLength(1)

      vi.advanceTimersByTime(2000)
      expect(toasts.value).toHaveLength(0)
    })

    it('should dismiss toasts independently', async () => {
      vi.useFakeTimers()

      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success, error } = useToast()

      success('First', 2000)
      error('Second', 5000)

      expect(toasts.value).toHaveLength(2)

      vi.advanceTimersByTime(2000)
      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].message).toBe('Second')

      vi.advanceTimersByTime(3000)
      expect(toasts.value).toHaveLength(0)
    })
  })

  describe('manual dismiss', () => {
    it('should dismiss a toast by ID', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success, dismiss } = useToast()

      success('Will be dismissed')
      const id = toasts.value[0].id

      dismiss(id)

      expect(toasts.value).toHaveLength(0)
    })

    it('should only dismiss the specified toast', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success, error, dismiss } = useToast()

      success('Keep me')
      error('Remove me')
      const errorId = toasts.value[1].id

      dismiss(errorId)

      expect(toasts.value).toHaveLength(1)
      expect(toasts.value[0].message).toBe('Keep me')
    })

    it('should handle dismissing non-existent ID gracefully', async () => {
      const { useToast } = await import('../../../composables/useToast')
      const { toasts, success, dismiss } = useToast()

      success('Keep me')

      dismiss('non-existent-id')

      expect(toasts.value).toHaveLength(1)
    })
  })

  describe('singleton behavior', () => {
    it('should share state across multiple useToast calls', async () => {
      const { useToast } = await import('../../../composables/useToast')

      const toast1 = useToast()
      const toast2 = useToast()

      toast1.success('From first call')

      expect(toast2.toasts.value).toHaveLength(1)
      expect(toast2.toasts.value[0].message).toBe('From first call')
    })

    it('should allow dismissing from a different useToast instance', async () => {
      const { useToast } = await import('../../../composables/useToast')

      const toast1 = useToast()
      const toast2 = useToast()

      toast1.success('Shared toast')
      const id = toast1.toasts.value[0].id

      toast2.dismiss(id)

      expect(toast1.toasts.value).toHaveLength(0)
    })
  })
})
