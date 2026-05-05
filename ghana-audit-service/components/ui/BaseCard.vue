<template>
  <div :class="cardClasses">
    <div
      v-if="$slots.header || title"
      class="px-6 py-4 border-b border-gray-200 dark:border-gray-700"
    >
      <slot name="header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
        <p v-if="subtitle" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
      </slot>
    </div>

    <div :class="bodyClasses">
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      class="px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    title?: string
    subtitle?: string
    padding?: 'none' | 'sm' | 'md' | 'lg'
    shadow?: 'none' | 'sm' | 'md' | 'lg'
    hover?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    padding: 'md',
    shadow: 'sm',
    hover: false,
    title: undefined,
    subtitle: undefined
  })

  const cardClasses = computed(() => {
    const base =
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'

    const shadows = {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg'
    }

    const hoverEffect = props.hover
      ? 'transition-all duration-200 hover:shadow-lg hover:-translate-y-1'
      : ''

    return [base, shadows[props.shadow], hoverEffect].join(' ')
  })

  const bodyClasses = computed(() => {
    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    }

    return paddings[props.padding]
  })
</script>
