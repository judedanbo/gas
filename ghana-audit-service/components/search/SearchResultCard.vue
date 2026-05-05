<template>
  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
    <div class="flex items-start gap-4">
      <div class="flex-1 min-w-0">
        <!-- Type Badge -->
        <div class="mb-2">
          <UiBadge
            :label="typeLabel"
            :variant="typeVariant"
            size="sm"
          />
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          <NuxtLink
            :to="result.url"
            class="hover:text-primary transition-colors"
          >
            {{ result.title }}
          </NuxtLink>
        </h3>

        <!-- Excerpt -->
        <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
          {{ result.excerpt }}
        </p>

        <!-- Meta Info -->
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span v-if="result.publishedAt" class="flex items-center gap-1">
            <span>{{ formatDate(result.publishedAt) }}</span>
          </span>
          <span class="text-gray-500 truncate">{{ result.url }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { SearchResult } from '~/types'

const props = defineProps<{
  result: SearchResult
}>()

const { t } = useI18n()
const { formatDateShort } = useLocaleDate()

// Type to badge variant mapping
const typeVariants: Record<string, 'primary' | 'secondary' | 'accent' | 'gray'> = {
  report: 'primary',
  publication: 'secondary',
  news: 'accent',
  page: 'gray'
}

const typeLabel = computed(() => t(`searchTypes.${props.result.type}`))
const typeVariant = computed(() => typeVariants[props.result.type] || 'gray')

function formatDate(dateString: string): string {
  return formatDateShort(dateString)
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
