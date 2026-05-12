import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, reactive, nextTick, watch } from 'vue'

// Mock Vue auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('watch', watch)

// Mock lifecycle / router hooks as no-ops for unit tests
vi.stubGlobal('onBeforeUnmount', vi.fn())
vi.stubGlobal('onBeforeRouteLeave', vi.fn())

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('initial state', () => {
    it('should report no changes initially before markSaved is called', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const formData = () => ({ name: 'test', email: 'test@example.com' })
      const { hasChanges } = useUnsavedChanges(formData)

      expect(hasChanges.value).toBe(false)
    })

    it('should report no changes after markSaved with unchanged data', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const formData = () => ({ name: 'test', email: 'test@example.com' })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()

      expect(hasChanges.value).toBe(false)
    })
  })

  describe('detecting changes', () => {
    it('should detect changes after form data mutation', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({ name: 'original', email: 'test@example.com' })
      const formData = () => ({ name: data.name, email: data.email })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()
      expect(hasChanges.value).toBe(false)

      // Mutate form data
      data.name = 'modified'

      expect(hasChanges.value).toBe(true)
    })

    it('should return to clean state when data is reverted', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({ name: 'original' })
      const formData = () => ({ name: data.name })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()
      data.name = 'modified'
      expect(hasChanges.value).toBe(true)

      // Revert
      data.name = 'original'
      expect(hasChanges.value).toBe(false)
    })
  })

  describe('markSaved', () => {
    it('should reset to clean after markSaved with new data', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({ name: 'original' })
      const formData = () => ({ name: data.name })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()
      data.name = 'modified'
      expect(hasChanges.value).toBe(true)

      // Mark as saved again with new value
      markSaved()
      expect(hasChanges.value).toBe(false)
    })

    it('should clear forcedClean flag when markSaved is called', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({ name: 'original' })
      const formData = () => ({ name: data.name })
      const { hasChanges, markSaved, markClean } = useUnsavedChanges(formData)

      markSaved()
      data.name = 'modified'
      markClean()
      expect(hasChanges.value).toBe(false)

      // markSaved should reset the forced clean and snapshot
      markSaved()
      data.name = 'another change'
      expect(hasChanges.value).toBe(true)
    })
  })

  describe('markClean', () => {
    it('should force clean state even with actual changes', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({ name: 'original' })
      const formData = () => ({ name: data.name })
      const { hasChanges, markSaved, markClean } = useUnsavedChanges(formData)

      markSaved()
      data.name = 'modified'
      expect(hasChanges.value).toBe(true)

      markClean()
      expect(hasChanges.value).toBe(false)
    })
  })

  describe('deep comparison', () => {
    it('should detect changes in nested objects', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({
        user: { name: 'John', address: { city: 'Accra', zip: '00233' } },
      })
      const formData = () => ({
        user: {
          name: data.user.name,
          address: { city: data.user.address.city, zip: data.user.address.zip },
        },
      })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()
      expect(hasChanges.value).toBe(false)

      // Mutate a deeply nested property
      data.user.address.city = 'Kumasi'
      expect(hasChanges.value).toBe(true)
    })

    it('should detect changes in arrays within form data', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({ tags: ['audit', 'finance'] })
      const formData = () => ({ tags: [...data.tags] })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()
      expect(hasChanges.value).toBe(false)

      data.tags.push('compliance')
      expect(hasChanges.value).toBe(true)
    })

    it('should not report changes when nested data is identical', async () => {
      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const data = reactive({
        config: { a: 1, b: { c: 2, d: [3, 4] } },
      })
      const formData = () => ({
        config: { a: data.config.a, b: { c: data.config.b.c, d: [...data.config.b.d] } },
      })
      const { hasChanges, markSaved } = useUnsavedChanges(formData)

      markSaved()
      expect(hasChanges.value).toBe(false)
    })
  })

  describe('browser navigation guard', () => {
    it('should register onBeforeRouteLeave callback', async () => {
      const mockOnBeforeRouteLeave = vi.fn()
      vi.stubGlobal('onBeforeRouteLeave', mockOnBeforeRouteLeave)

      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const formData = () => ({ name: 'test' })
      useUnsavedChanges(formData)

      expect(mockOnBeforeRouteLeave).toHaveBeenCalledTimes(1)
      expect(mockOnBeforeRouteLeave).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should not register beforeunload handler on the server (import.meta.client is falsy)', async () => {
      // In the test environment import.meta.client is undefined/falsy,
      // so the beforeunload handler and its onBeforeUnmount cleanup are skipped.
      const mockOnBeforeUnmount = vi.fn()
      vi.stubGlobal('onBeforeUnmount', mockOnBeforeUnmount)

      const { useUnsavedChanges } = await import(
        '../../../composables/useUnsavedChanges'
      )
      const formData = () => ({ name: 'test' })
      useUnsavedChanges(formData)

      // onBeforeUnmount is inside `if (import.meta.client)` — not called on server
      expect(mockOnBeforeUnmount).not.toHaveBeenCalled()
    })
  })
})
