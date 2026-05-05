<template>
  <div :class="containerClasses">
    <span
      v-if="badge"
      class="inline-block bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold mb-4"
    >
      {{ badge }}
    </span>
    <h2 :class="headingClasses">
      <slot name="title">{{ title }}</slot>
    </h2>
    <p v-if="description || $slots.description" :class="descriptionClasses">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.action" class="mt-6">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    title?: string
    description?: string
    badge?: string
    centered?: boolean
    size?: 'sm' | 'md' | 'lg'
    spacing?: 'sm' | 'md' | 'lg'
  }

  const props = withDefaults(defineProps<Props>(), {
    centered: true,
    size: 'md',
    spacing: 'md',
    title: undefined,
    description: undefined,
    badge: undefined
  })

  const containerClasses = computed(() => {
    const spacings = {
      sm: 'mb-6',
      md: 'mb-10',
      lg: 'mb-12'
    }
    return [spacings[props.spacing], props.centered ? 'text-center' : ''].filter(Boolean).join(' ')
  })

  const headingClasses = computed(() => {
    const sizes = {
      sm: 'text-xl md:text-2xl',
      md: 'text-2xl md:text-3xl',
      lg: 'text-3xl md:text-4xl'
    }
    return `${sizes[props.size]} font-heading font-bold text-gray-900 dark:text-white mb-2`
  })

  const descriptionClasses = computed(() => {
    const base = 'text-gray-600 dark:text-gray-400'
    const centered = props.centered ? 'max-w-2xl mx-auto' : ''
    return [base, centered].filter(Boolean).join(' ')
  })
</script>
