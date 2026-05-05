<template>
  <div class="text-center py-12 px-4">
    <!-- Icon -->
    <div
      class="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4"
    >
      <slot name="icon">
        <svg
          class="w-8 h-8 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </slot>
    </div>

    <!-- Title -->
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
      {{ title }}
    </h3>

    <!-- Description -->
    <p v-if="description" class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
      {{ description }}
    </p>

    <!-- Action -->
    <slot name="action">
      <NuxtLink
        v-if="actionTo"
        :to="actionTo"
        class="btn btn-primary inline-flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        {{ actionLabel }}
      </NuxtLink>
    </slot>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    title?: string
    description?: string
    actionTo?: string
    actionLabel?: string
  }

  withDefaults(defineProps<Props>(), {
    title: 'No items found',
    description: '',
    actionLabel: 'Create New',
    actionTo: undefined
  })
</script>
