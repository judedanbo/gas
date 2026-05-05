<template>
  <NuxtLink :to="to" :class="linkClasses">
    {{ label }}
    <span v-if="showArrow" class="ml-1">→</span>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Props {
  to: string
  label?: string
  variant?: 'button' | 'text'
  size?: 'sm' | 'md' | 'lg'
  showArrow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'View All',
  variant: 'button',
  size: 'md',
  showArrow: true
})

const linkClasses = computed(() => {
  if (props.variant === 'button') {
    const sizes = {
      sm: 'btn-outline btn-sm',
      md: 'btn-outline',
      lg: 'btn-outline btn-lg'
    }
    return `${sizes[props.size]} inline-flex items-center`
  }

  // Text variant
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }
  return `${sizes[props.size]} text-primary dark:text-primary-light hover:underline inline-flex items-center font-semibold no-underline`
})
</script>
