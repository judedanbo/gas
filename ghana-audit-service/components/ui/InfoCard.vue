<template>
  <component :is="to ? NuxtLink : 'div'" :to="to" :class="cardClasses">
    <!-- Icon -->
    <div v-if="icon || $slots.icon" :class="iconContainerClasses">
      <slot name="icon">
        <Icon v-if="icon" :name="icon" :class="iconClasses" aria-hidden="true" />
      </slot>
    </div>

    <!-- Title -->
    <component :is="headingTag" :class="titleClasses">
      <slot name="title">{{ title }}</slot>
    </component>

    <!-- Description -->
    <p v-if="description || $slots.description" :class="descriptionClasses">
      <slot name="description">{{ description }}</slot>
    </p>

    <!-- Additional content -->
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>

    <!-- Footer -->
    <div v-if="$slots.footer" class="mt-auto pt-4">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
  import { NuxtLink } from '#components'

  interface Props {
    icon?: string
    title: string
    description?: string
    to?: string
    variant?: 'default' | 'centered' | 'horizontal' | 'compact'
    hover?: boolean
    bordered?: boolean
    shadow?: 'none' | 'sm' | 'md' | 'lg'
    iconSize?: 'sm' | 'md' | 'lg'
    iconBackground?: boolean
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'default',
    hover: false,
    bordered: true,
    shadow: 'none',
    iconSize: 'md',
    iconBackground: false,
    headingLevel: 3,
    icon: undefined,
    description: undefined,
    to: undefined
  })

  const headingTag = computed(() => `h${props.headingLevel}`)

  const cardClasses = computed(() => {
    const base = 'bg-white dark:bg-gray-800 rounded-lg'

    const padding = props.variant === 'compact' ? 'p-4' : 'p-6'

    const border = props.bordered ? 'border border-gray-200 dark:border-gray-700' : ''

    const shadows = {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg'
    }

    const layout =
      props.variant === 'horizontal'
        ? 'flex items-start gap-4'
        : props.variant === 'centered'
          ? 'text-center flex flex-col'
          : 'flex flex-col'

    const hoverEffect = props.hover
      ? 'transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-primary cursor-pointer'
      : ''

    const link = props.to ? 'no-underline block' : ''

    return [base, padding, border, shadows[props.shadow], layout, hoverEffect, link]
      .filter(Boolean)
      .join(' ')
  })

  const iconContainerClasses = computed(() => {
    if (props.variant === 'horizontal') {
      return 'flex-shrink-0'
    }
    if (props.variant === 'centered') {
      return 'flex justify-center'
    }
    return ''
  })

  const iconClasses = computed(() => {
    const sizes = {
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-10 h-10'
    }

    const base = props.iconBackground ? 'p-3 rounded-lg bg-primary/10' : ''

    const spacing = props.variant === 'horizontal' ? '' : 'mb-4'
    const color = 'text-primary'

    return [sizes[props.iconSize], base, spacing, color].filter(Boolean).join(' ')
  })

  const titleClasses = computed(() => {
    return 'text-lg font-semibold text-primary dark:text-primary-light mb-2'
  })

  const descriptionClasses = computed(() => {
    return 'text-gray-600 dark:text-gray-400 m-0 text-sm leading-relaxed'
  })
</script>
