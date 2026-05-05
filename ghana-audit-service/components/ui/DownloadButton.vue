<template>
  <a :href="href" :class="buttonClasses" download v-bind="$attrs">
    <Icon name="heroicons:arrow-down-tray" :class="iconClasses" aria-hidden="true" />
    <slot>Download</slot>
  </a>
</template>

<script setup lang="ts">
  interface Props {
    href: string
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
    size?: 'xs' | 'sm' | 'md' | 'lg'
    block?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'primary',
    size: 'md',
    block: false
  })

  const buttonClasses = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900'

    const variants = {
      primary:
        'bg-primary text-white hover:bg-primary-dark hover:text-white focus:ring-primary dark:bg-primary dark:hover:bg-primary-light dark:text-white dark:hover:text-gray-900',
      secondary:
        'bg-secondary text-white hover:bg-secondary-dark hover:text-white focus:ring-secondary dark:bg-secondary dark:hover:bg-secondary-light dark:text-white dark:hover:text-white',
      outline:
        'border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary dark:border-primary-light dark:text-primary-light dark:hover:bg-primary-light dark:hover:text-white',
      ghost:
        'text-primary hover:bg-primary/10 hover:text-primary-dark focus:ring-primary dark:text-primary-light dark:hover:bg-primary/20 dark:hover:text-white'
    }

    const sizes = {
      xs: 'px-3 py-1.5 text-xs',
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    }

    return [base, variants[props.variant], sizes[props.size], props.block ? 'w-full' : ''].join(' ')
  })

  const iconClasses = computed(() => {
    const sizes = {
      xs: 'w-4 h-4',
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    }
    return sizes[props.size]
  })
</script>
