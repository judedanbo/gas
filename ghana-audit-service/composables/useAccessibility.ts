export function useAccessibility() {
  const highContrast = useState<boolean>('highContrast', () => false)
  const textScale = useState<number>('textScale', () => 1)

  const TEXT_SCALE_MIN = 0.85
  const TEXT_SCALE_MAX = 1.3
  const TEXT_SCALE_STEP = 0.1

  // Initialize from localStorage on client
  function init() {
    if (import.meta.client) {
      const savedContrast = localStorage.getItem('gas-high-contrast')
      const savedScale = localStorage.getItem('gas-text-scale')

      if (savedContrast !== null) {
        highContrast.value = savedContrast === 'true'
      }
      if (savedScale !== null) {
        textScale.value = parseFloat(savedScale)
      }

      applySettings()
    }
  }

  // Apply current settings to document
  function applySettings() {
    if (import.meta.client) {
      const root = document.documentElement

      // High contrast
      if (highContrast.value) {
        root.classList.add('high-contrast')
      } else {
        root.classList.remove('high-contrast')
      }

      // Text scale
      root.style.setProperty('--text-scale', textScale.value.toString())
    }
  }

  // Toggle high contrast mode
  function toggleHighContrast() {
    highContrast.value = !highContrast.value
    if (import.meta.client) {
      localStorage.setItem('gas-high-contrast', highContrast.value.toString())
    }
    applySettings()
  }

  // Increase text size
  function increaseTextSize() {
    if (textScale.value < TEXT_SCALE_MAX) {
      textScale.value = Math.min(TEXT_SCALE_MAX, textScale.value + TEXT_SCALE_STEP)
      textScale.value = Math.round(textScale.value * 100) / 100 // Fix floating point
      if (import.meta.client) {
        localStorage.setItem('gas-text-scale', textScale.value.toString())
      }
      applySettings()
    }
  }

  // Decrease text size
  function decreaseTextSize() {
    if (textScale.value > TEXT_SCALE_MIN) {
      textScale.value = Math.max(TEXT_SCALE_MIN, textScale.value - TEXT_SCALE_STEP)
      textScale.value = Math.round(textScale.value * 100) / 100 // Fix floating point
      if (import.meta.client) {
        localStorage.setItem('gas-text-scale', textScale.value.toString())
      }
      applySettings()
    }
  }

  // Reset all accessibility settings
  function resetAccessibility() {
    highContrast.value = false
    textScale.value = 1
    if (import.meta.client) {
      localStorage.removeItem('gas-high-contrast')
      localStorage.removeItem('gas-text-scale')
    }
    applySettings()
  }

  // Check if text can be increased/decreased
  const canIncreaseText = computed(() => textScale.value < TEXT_SCALE_MAX)
  const canDecreaseText = computed(() => textScale.value > TEXT_SCALE_MIN)

  // Get text scale percentage for display
  const textScalePercent = computed(() => Math.round(textScale.value * 100))

  return {
    highContrast: readonly(highContrast),
    textScale: readonly(textScale),
    textScalePercent,
    canIncreaseText,
    canDecreaseText,
    init,
    toggleHighContrast,
    increaseTextSize,
    decreaseTextSize,
    resetAccessibility
  }
}
