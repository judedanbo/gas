<template>
  <component :is="to ? NuxtLink : 'span'" :to="to" :class="tagClasses">
    <Icon v-if="icon" :name="icon" :class="iconClasses" aria-hidden="true" />
    <slot />
    <button
      v-if="removable"
      type="button"
      class="ml-1.5 -mr-1 hover:text-current/80 focus:outline-none"
      :aria-label="`Remove ${$slots.default ? '' : 'tag'}`"
      @click.prevent.stop="$emit('remove')"
    >
      <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  </component>
</template>

<script setup lang="ts">
  import { NuxtLink } from '#components'

  interface Props {
    variant?: 'default' | 'primary' | 'secondary' | 'accent'
    size?: 'sm' | 'md' | 'lg'
    icon?: string
    to?: string
    removable?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    variant: 'default',
    size: 'md',
    removable: false,
    icon: undefined,
    to: undefined
  })

  defineEmits<{
    remove: []
  }>()

  const tagClasses = computed(() => {
    const base = 'tag'

    const variants = {
      default: '',
      primary: 'tag-primary',
      secondary: 'tag-secondary',
      accent: 'tag-accent'
    }

    const sizes = {
      sm: 'tag-sm',
      md: '',
      lg: 'tag-lg'
    }

    const link = props.to ? 'no-underline hover:opacity-80 cursor-pointer' : ''

    return [base, variants[props.variant], sizes[props.size], link].filter(Boolean).join(' ')
  })

  const iconClasses = computed(() => {
    const sizes = {
      sm: 'w-3 h-3 mr-1',
      md: 'w-4 h-4 mr-1.5',
      lg: 'w-5 h-5 mr-2'
    }
    return sizes[props.size]
  })
</script>
