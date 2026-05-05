<template>
  <ul :class="listClasses">
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="itemClasses"
    >
      <span :class="iconClasses">
        <slot name="icon">
          <Icon v-if="iconNames[icon]" :name="iconNames[icon]" class="w-4 h-4" aria-hidden="true" />
          <span v-else-if="icon === 'number'">{{ index + 1 }}.</span>
        </slot>
      </span>
      <span class="flex-1">
        <template v-if="typeof item === 'string'">{{ item }}</template>
        <template v-else>
          <strong v-if="item.title" class="text-gray-900 dark:text-white block">{{ item.title }}</strong>
          <span v-if="item.description" class="text-gray-500 dark:text-gray-400 text-sm">{{ item.description }}</span>
        </template>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
type ListItem = string | { title: string; description?: string }

interface Props {
  items: ListItem[]
  icon?: 'check' | 'bullet' | 'arrow' | 'star' | 'dot' | 'number'
  divided?: boolean
  spacing?: 'sm' | 'md' | 'lg'
  iconColor?: 'primary' | 'secondary' | 'accent' | 'gray'
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'check',
  divided: false,
  spacing: 'md',
  iconColor: 'primary'
})

// Map icon types to Heroicons
const iconNames: Record<string, string> = {
  check: 'heroicons:check',
  bullet: 'heroicons:minus',
  arrow: 'heroicons:arrow-right',
  star: 'heroicons:star-solid',
  dot: 'heroicons:stop-solid'
}

const listClasses = computed(() => {
  const spacings = {
    sm: 'space-y-2',
    md: 'space-y-3',
    lg: 'space-y-4'
  }
  return spacings[props.spacing]
})

const itemClasses = computed(() => {
  const base = 'flex items-start gap-3 text-gray-600 dark:text-gray-300'
  const divided = props.divided
    ? 'py-3 border-b border-gray-200 dark:border-gray-700 last:border-0'
    : ''
  return [base, divided].filter(Boolean).join(' ')
})

const iconClasses = computed(() => {
  const colors = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    gray: 'text-gray-400'
  }
  return `${colors[props.iconColor]} flex-shrink-0 mt-0.5`
})
</script>
