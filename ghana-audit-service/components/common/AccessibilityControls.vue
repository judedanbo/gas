<template>
  <div :class="wrapperClasses" role="group" :aria-label="$t('accessibility.controls')">
    <!-- Dark mode -->
    <button
      type="button"
      :class="buttonClasses"
      :aria-pressed="isDark"
      :title="isDark ? $t('accessibility.switchToLight') : $t('accessibility.switchToDark')"
      :aria-label="isDark ? $t('accessibility.switchToLight') : $t('accessibility.switchToDark')"
      @click="toggleDarkMode"
    >
      <ClientOnly>
        <Icon
          :name="isDark ? 'heroicons:sun' : 'heroicons:moon'"
          class="w-4 h-4"
          aria-hidden="true"
        />
        <template #fallback>
          <span class="w-4 h-4 inline-block"></span>
        </template>
      </ClientOnly>
    </button>

    <!-- High contrast -->
    <button
      type="button"
      :class="[buttonClasses, highContrast ? activeClasses : '']"
      :aria-pressed="highContrast"
      :title="
        highContrast
          ? $t('accessibility.disableHighContrast')
          : $t('accessibility.enableHighContrast')
      "
      :aria-label="
        highContrast
          ? $t('accessibility.disableHighContrast')
          : $t('accessibility.enableHighContrast')
      "
      @click="toggleHighContrast"
    >
      <Icon name="heroicons:eye" class="w-4 h-4" aria-hidden="true" />
    </button>

    <!-- Text size -->
    <button
      type="button"
      :class="buttonClasses"
      :disabled="!canDecreaseText"
      :title="$t('accessibility.decreaseText', { percent: textScalePercent })"
      :aria-label="$t('accessibility.decreaseText', { percent: textScalePercent })"
      @click="decreaseTextSize"
    >
      <span class="text-xs font-bold" aria-hidden="true">A-</span>
    </button>
    <span
      :class="statusClasses"
      class="text-xs min-w-[3.5ch] text-center tabular-nums px-1"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="sr-only">{{
        $t('accessibility.textSizeStatus', { percent: textScalePercent })
      }}</span>
      <span aria-hidden="true">{{ textScalePercent }}%</span>
    </span>
    <button
      type="button"
      :class="buttonClasses"
      :disabled="!canIncreaseText"
      :title="$t('accessibility.increaseText', { percent: textScalePercent })"
      :aria-label="$t('accessibility.increaseText', { percent: textScalePercent })"
      @click="increaseTextSize"
    >
      <span class="text-xs font-bold" aria-hidden="true">A+</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  /**
   * Dark mode, high-contrast and text-size controls.
   * `variant="on-brand"` styles the buttons for the green header bar;
   * `variant="default"` for light/dark neutral surfaces (e.g. the mobile menu).
   */
  interface Props {
    variant?: 'on-brand' | 'default'
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'default'
  })

  const colorMode = useColorMode()

  // SSR renders colorMode.value as 'system' while the client resolves it to
  // dark/light before hydration, so bind dark-mode UI through a mounted gate
  // to keep the first client render identical to the server HTML.
  const mounted = ref(false)
  const isDark = computed(() => mounted.value && colorMode.value === 'dark')

  function toggleDarkMode() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }

  const {
    highContrast,
    textScalePercent,
    canIncreaseText,
    canDecreaseText,
    toggleHighContrast,
    increaseTextSize,
    decreaseTextSize
  } = useAccessibility()

  const wrapperClasses = computed(() =>
    ['items-center gap-0.5', props.variant === 'on-brand' ? 'on-brand' : '']
      .filter(Boolean)
      .join(' ')
  )

  const buttonClasses = computed(() => {
    const base =
      'touch-target-area p-2 rounded transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed'
    return props.variant === 'on-brand'
      ? `${base} text-white/90 hover:text-white hover:bg-white/10`
      : `${base} text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700`
  })

  const activeClasses = computed(() =>
    props.variant === 'on-brand'
      ? 'bg-white/20 text-white'
      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
  )

  const statusClasses = computed(() =>
    props.variant === 'on-brand' ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'
  )

  onMounted(() => {
    mounted.value = true
  })
</script>
