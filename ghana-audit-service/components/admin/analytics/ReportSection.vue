<template>
  <section class="report-section mb-10 last:mb-0">
    <header class="mb-4 border-b border-gray-200 pb-2">
      <h2 class="text-xl font-semibold text-gray-900">{{ title }}</h2>
      <p v-if="subtitle" class="mt-1 text-sm text-gray-600">{{ subtitle }}</p>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
  defineProps<{
    title: string
    subtitle?: string
  }>()
</script>
