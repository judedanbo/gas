<template>
  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-primary hover:shadow-lg">
    <!-- Thumbnail -->
    <div v-if="article.thumbnail" class="aspect-video bg-gray-100">
      <NuxtImg
        :src="article.thumbnail"
        :alt="article.title"
        class="w-full h-full object-cover"
        loading="lazy"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
    </div>
    <div v-else class="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
      <Icon name="heroicons:newspaper" class="w-20 h-20 text-gray-400 opacity-50" aria-hidden="true" />
    </div>

    <!-- Content -->
    <div class="p-6">
      <div class="flex items-center gap-2 mb-3">
        <UiBadge v-if="article.category" variant="primary" size="sm">
          {{ article.category }}
        </UiBadge>
        <time class="text-sm text-gray-500 dark:text-gray-400">{{ formatDate(article.publishedAt) }}</time>
      </div>

      <h3 class="text-lg font-semibold leading-snug mb-2">
        <NuxtLink
          :to="`/media/news/${article.slug}`"
          class="text-gray-900 dark:text-white no-underline transition-colors hover:text-primary"
        >
          {{ article.title }}
        </NuxtLink>
      </h3>

      <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
        {{ article.excerpt }}
      </p>

      <NuxtLink
        :to="`/media/news/${article.slug}`"
        class="text-primary font-medium text-sm inline-flex items-center gap-1 hover:underline"
        :aria-label="`${$t('common.readMore')}: ${article.title}`"
      >
        {{ $t('common.readMore') }}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </NuxtLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { NewsArticle } from '~/types'

interface Props {
  article: NewsArticle
}

defineProps<Props>()

const { formatDateShort } = useLocaleDate()

function formatDate(dateStr: string): string {
  return formatDateShort(dateStr)
}
</script>
