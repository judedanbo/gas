<template>
  <nav class="py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700" aria-label="Breadcrumb">
    <ol class="flex items-center flex-wrap gap-2 list-none m-0 max-w-7xl mx-auto px-4">
      <li class="flex items-center gap-2">
        <NuxtLink to="/" class="flex items-center gap-1 text-gray-600 dark:text-gray-300 no-underline text-sm transition-colors hover:text-primary dark:hover:text-primary-light">
          <span class="text-base">🏠</span>
          <span>Home</span>
        </NuxtLink>
      </li>
      <li v-for="(crumb, index) in crumbs" :key="crumb.path" class="flex items-center gap-2">
        <span class="text-gray-400 dark:text-gray-500 text-sm" aria-hidden="true">/</span>
        <NuxtLink
          v-if="index < crumbs.length - 1"
          :to="crumb.path"
          class="flex items-center gap-1 text-gray-600 dark:text-gray-300 no-underline text-sm transition-colors hover:text-primary dark:hover:text-primary-light"
        >
          {{ crumb.label }}
        </NuxtLink>
        <span v-else class="text-gray-900 dark:text-white text-sm font-medium" aria-current="page">
          {{ crumb.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
interface BreadcrumbItem {
  label: string
  path: string
}

defineProps<{
  crumbs: BreadcrumbItem[]
}>()
</script>
