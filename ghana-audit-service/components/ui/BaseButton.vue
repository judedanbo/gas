<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    v-bind="$attrs"
  >
    <LoadingSpinner v-if="loading" size="sm" class="mr-2" />
    <slot />
  </component>
</template>

<script setup lang="ts">
  import { NuxtLink } from '#components'

  interface Props {
    variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    to?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
    to: undefined
  })

  const buttonClasses = computed(() => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
      secondary: 'bg-secondary text-white hover:bg-secondary-dark focus:ring-secondary',
      accent: 'bg-accent text-gray-900 hover:bg-accent-dark focus:ring-accent',
      outline:
        'border-2 border-primary text-primary dark:text-primary-light hover:bg-primary hover:text-white focus:ring-primary',
      ghost:
        'text-primary dark:text-primary-light hover:bg-primary/10 dark:hover:bg-primary/20 focus:ring-primary'
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    }

    return [base, variants[props.variant], sizes[props.size], props.block ? 'w-full' : ''].join(' ')
  })
</script>
