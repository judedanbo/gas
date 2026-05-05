<template>
  <span :class="containerClasses">
    <Icon
      :name="resolvedIcon"
      :class="iconClasses"
      aria-hidden="true"
    />
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
import { resolveIcon } from '~/utils/iconMap'

interface Props {
  icon: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'default' | 'muted' | 'primary' | 'white'
  gap?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'default',
  gap: 'md'
})

// Resolve emoji to icon name, or use directly if already an icon name
const resolvedIcon = computed(() => resolveIcon(props.icon))

const containerClasses = computed(() => {
  const base = 'inline-flex items-center'

  const gaps = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3'
  }

  const colors = {
    default: 'text-gray-600 dark:text-gray-300',
    muted: 'text-gray-400',
    primary: 'text-primary dark:text-primary-light',
    white: 'text-white'
  }

  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return [base, gaps[props.gap], colors[props.color], sizes[props.size]].join(' ')
})

const iconClasses = computed(() => {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }
  return sizes[props.size]
})
</script>
