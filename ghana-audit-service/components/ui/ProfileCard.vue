<template>
  <div :class="containerClasses">
    <!-- Avatar Section -->
    <div :class="avatarContainerClasses">
      <div :class="avatarClasses">
        <NuxtImg
          v-if="image"
          :src="image"
          :alt="name"
          class="w-full h-full object-cover"
          loading="lazy"
        />
        <Icon v-else name="heroicons:user" class="w-28 h-28 text-gray-300" aria-hidden="true" />
      </div>
    </div>

    <!-- Content Section -->
    <div :class="contentClasses">
      <!-- Name -->
      <h3 :class="nameClasses">{{ name }}</h3>

      <!-- Title/Position -->
      <p v-if="title" class="text-primary dark:text-primary-light font-semibold mb-1">
        {{ title }}
      </p>

      <!-- Subtitle (e.g., tenure) -->
      <p v-if="subtitle" class="text-gray-500 dark:text-gray-400 text-sm mb-4">{{ subtitle }}</p>

      <!-- Badge -->
      <div v-if="badge" class="mb-4">
        <UiBadge :variant="badgeVariant" size="sm">{{ badge }}</UiBadge>
      </div>

      <p v-if="bio" class="text-gray-600 dark:text-gray-400 mb-4 line-clamp-4">{{ bio }}</p>

      <!-- Additional content slot -->
      <slot />

      <!-- Actions slot -->
      <div v-if="$slots.actions" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    name: string
    title?: string
    subtitle?: string
    bio?: string
    image?: string
    badge?: string
    badgeVariant?: 'primary' | 'secondary' | 'accent' | 'success' | 'info'
    layout?: 'horizontal' | 'vertical'
    size?: 'sm' | 'md' | 'lg'
    featured?: boolean
    compact?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    layout: 'horizontal',
    size: 'md',
    featured: false,
    compact: false,
    badgeVariant: 'primary',
    title: undefined,
    subtitle: undefined,
    bio: undefined,
    image: undefined,
    badge: undefined
  })

  const containerClasses = computed(() => {
    if (props.layout === 'vertical') {
      return 'text-center'
    }
    return 'grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-start'
  })

  const avatarContainerClasses = computed(() => {
    if (props.layout === 'vertical') {
      return 'flex justify-center mb-4'
    }
    return 'flex justify-center md:justify-start'
  })

  const avatarClasses = computed(() => {
    const sizes = {
      sm: 'w-[100px] h-[120px]',
      md: 'w-[150px] h-[180px]',
      lg: 'w-[220px] h-[280px]'
    }

    const base =
      'bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden'
    const border = props.featured
      ? 'border-4 border-primary shadow-lg'
      : 'border border-gray-200 dark:border-gray-600'

    return [base, sizes[props.size], border].join(' ')
  })

  const contentClasses = computed(() => {
    if (props.layout === 'vertical') {
      return ''
    }
    return ''
  })

  const nameClasses = computed(() => {
    const sizes = {
      sm: 'text-lg',
      md: 'text-xl',
      lg: 'text-2xl'
    }
    return `${sizes[props.size]} font-bold text-gray-900 dark:text-white mb-1`
  })
</script>
