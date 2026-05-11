<template>
  <div
    class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {{ label }}
    </div>
    <div class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
      {{ value }}
    </div>
    <div v-if="hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    label: string
    value: string | number
    hint?: string
  }>()
</script>
