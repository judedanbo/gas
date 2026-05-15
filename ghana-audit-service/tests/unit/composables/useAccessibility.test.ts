import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, readonly } from 'vue'

// State store for useState mock
const stateStore: Record<string, ReturnType<typeof ref>> = {}

describe('useAccessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    // Clear state store
    Object.keys(stateStore).forEach((key) => Reflect.deleteProperty(stateStore, key))

    // Provide a fresh localStorage mock (vi.resetModules can break happy-dom's global)
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { Reflect.deleteProperty(store, key) },
      clear: () => { Object.keys(store).forEach((k) => Reflect.deleteProperty(store, k)) },
      get length() { return Object.keys(store).length },
      key: (i: number) => Object.keys(store)[i] ?? null
    })

    // Clean up real document classes and styles (from happy-dom)
    document.documentElement.classList.remove('high-contrast')
    document.documentElement.style.removeProperty('--text-scale')

    // Set up all globals in beforeEach so they're available after resetModules
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('readonly', readonly)
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      if (!stateStore[key]) {
        stateStore[key] = ref(init())
      }
      return stateStore[key]
    })
  })

  describe('initial state', () => {
    it('should have correct default values', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { highContrast, textScale, textScalePercent } = useAccessibility()

      expect(highContrast.value).toBe(false)
      expect(textScale.value).toBe(1)
      expect(textScalePercent.value).toBe(100)
    })
  })

  describe('toggleHighContrast', () => {
    it('should toggle high contrast mode', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { highContrast, toggleHighContrast } = useAccessibility()

      expect(highContrast.value).toBe(false)

      toggleHighContrast()
      expect(highContrast.value).toBe(true)

      toggleHighContrast()
      expect(highContrast.value).toBe(false)
    })

    // Skip: These tests require import.meta.client which needs Nuxt runtime
    // The composable uses import.meta.client to guard localStorage/document access
    // which isn't available in plain Vitest. Use @nuxt/test-utils for full integration tests.
    it.skip('should save high contrast setting to localStorage', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { toggleHighContrast } = useAccessibility()

      toggleHighContrast()

      expect(localStorage.getItem('gas-high-contrast')).toBe('true')
    })

    it.skip('should apply high contrast class to document', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { toggleHighContrast } = useAccessibility()

      toggleHighContrast()

      expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
    })
  })

  describe('increaseTextSize', () => {
    it('should increase text size by 0.1', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { textScale, increaseTextSize } = useAccessibility()

      expect(textScale.value).toBe(1)

      increaseTextSize()
      expect(textScale.value).toBe(1.1)
    })

    it('should not exceed maximum text scale of 1.3', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { textScale, increaseTextSize } = useAccessibility()

      // Increase to max
      increaseTextSize() // 1.1
      increaseTextSize() // 1.2
      increaseTextSize() // 1.3
      increaseTextSize() // Should stay at 1.3

      expect(textScale.value).toBe(1.3)
    })

    // Skip: These tests require import.meta.client which needs Nuxt runtime
    it.skip('should save text scale to localStorage', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { increaseTextSize } = useAccessibility()

      increaseTextSize()

      expect(localStorage.getItem('gas-text-scale')).toBe('1.1')
    })

    it.skip('should apply text scale to document', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { increaseTextSize } = useAccessibility()

      increaseTextSize()

      expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.1')
    })
  })

  describe('decreaseTextSize', () => {
    it('should decrease text size by 0.1', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { textScale, decreaseTextSize, increaseTextSize } = useAccessibility()

      // First increase so we can decrease
      increaseTextSize() // 1.1
      increaseTextSize() // 1.2

      decreaseTextSize()
      expect(textScale.value).toBe(1.1)
    })

    it('should not go below minimum text scale of 0.85', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { textScale, decreaseTextSize } = useAccessibility()

      // Decrease to min
      decreaseTextSize() // 0.9
      decreaseTextSize() // 0.85
      decreaseTextSize() // Should stay at 0.85

      expect(textScale.value).toBe(0.85)
    })
  })

  describe('canIncreaseText / canDecreaseText', () => {
    it('should correctly indicate if text can be increased', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { canIncreaseText, increaseTextSize } = useAccessibility()

      expect(canIncreaseText.value).toBe(true)

      // Increase to max
      increaseTextSize() // 1.1
      increaseTextSize() // 1.2
      increaseTextSize() // 1.3

      expect(canIncreaseText.value).toBe(false)
    })

    it('should correctly indicate if text can be decreased', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { canDecreaseText, decreaseTextSize } = useAccessibility()

      expect(canDecreaseText.value).toBe(true)

      // Decrease to min
      decreaseTextSize() // 0.9
      decreaseTextSize() // 0.85

      expect(canDecreaseText.value).toBe(false)
    })
  })

  describe('resetAccessibility', () => {
    it('should reset all accessibility settings to defaults', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { highContrast, textScale, toggleHighContrast, increaseTextSize, resetAccessibility } =
        useAccessibility()

      // Change settings
      toggleHighContrast()
      increaseTextSize()

      expect(highContrast.value).toBe(true)
      expect(textScale.value).toBe(1.1)

      // Reset
      resetAccessibility()

      expect(highContrast.value).toBe(false)
      expect(textScale.value).toBe(1)
    })

    // Skip: requires import.meta.client which needs Nuxt runtime
    it.skip('should remove settings from localStorage', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { toggleHighContrast, increaseTextSize, resetAccessibility } = useAccessibility()

      // First set some values
      toggleHighContrast()
      increaseTextSize()

      // Then reset
      resetAccessibility()

      // Verify actual localStorage values are removed (happy-dom provides real localStorage)
      expect(localStorage.getItem('gas-high-contrast')).toBeNull()
      expect(localStorage.getItem('gas-text-scale')).toBeNull()
    })
  })

  describe('textScalePercent', () => {
    it('should return text scale as percentage', async () => {
      const { useAccessibility } = await import('../../../composables/useAccessibility')
      const { textScalePercent, increaseTextSize } = useAccessibility()

      expect(textScalePercent.value).toBe(100)

      increaseTextSize()
      expect(textScalePercent.value).toBe(110)
    })
  })
})
