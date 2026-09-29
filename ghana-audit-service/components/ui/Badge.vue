<template>
  <span :class="badgeClasses">
    <span v-if="icon" class="mr-1">{{ icon }}</span>
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
  interface Props {
    label?: string
    icon?: string
    variant?:
      'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
    size?: 'xs' | 'sm' | 'md' | 'lg'
    rounded?: 'default' | 'full'
    uppercase?: boolean
    outline?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'primary',
    size: 'md',
    rounded: 'full',
    uppercase: true,
    outline: false,
    label: undefined,
    icon: undefined
  })

  const badgeClasses = computed(() => {
    const base = 'inline-flex items-center font-semibold'

    const solidVariants = {
      primary: 'bg-primary text-white',
      secondary: 'bg-secondary text-white',
      accent: 'bg-accent text-gray-900',
      success: 'bg-success text-white',
      warning: 'bg-accent text-gray-900',
      danger: 'bg-error text-white',
      info: 'bg-info text-white',
      gray: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }

    const outlineVariants = {
      primary: 'border border-primary text-primary dark:text-primary-200 bg-primary/5',
      secondary: 'border border-secondary text-secondary bg-secondary/5',
      accent: 'border border-accent-dark text-gray-900 dark:text-accent bg-accent/15',
      success:
        'border border-success text-success dark:text-success-light bg-success/10 dark:bg-success/20',
      warning:
        'border border-accent-dark text-gray-900 dark:text-accent bg-accent/15 dark:bg-accent/15',
      danger: 'border border-error text-error dark:text-error-light bg-error/10 dark:bg-error/20',
      info: 'border border-info text-info dark:text-info-light bg-info/10 dark:bg-info/20',
      gray: 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
    }

    const sizes = {
      xs: 'px-1.5 py-0.5 text-[10px]',
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-xs',
      lg: 'px-4 py-1.5 text-sm'
    }

    const roundedClasses = {
      default: 'rounded',
      full: 'rounded-full'
    }

    const casing = props.uppercase ? 'uppercase tracking-wider' : ''
    const variantClass = props.outline
      ? outlineVariants[props.variant]
      : solidVariants[props.variant]

    return [base, variantClass, sizes[props.size], roundedClasses[props.rounded], casing]
      .filter(Boolean)
      .join(' ')
  })
</script>
