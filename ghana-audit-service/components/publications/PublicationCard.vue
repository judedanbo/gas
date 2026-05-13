<template>
  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col transition-all hover:border-primary hover:shadow-lg">
    <!-- Thumbnail -->
    <div class="aspect-video bg-gray-100">
      <img
        :src="publication.thumbnail || '/img/publications/default-cover.png'"
        :alt="publication.title"
        class="w-full h-full object-cover"
        loading="lazy"
      />
    </div>

    <div class="p-6 flex flex-col flex-1">
    <div class="flex justify-between items-start mb-3">
      <UiBadge :variant="getPublicationTypeVariant(publication.type)" size="sm">
        {{ getPublicationTypeLabel(publication.type) }}
      </UiBadge>
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDate(publication.publishedAt) }}</span>
    </div>

    <h3 class="text-lg font-semibold leading-snug mb-3">
      <template v-if="publication.fileUrl">
        <a
          :href="publication.fileUrl"
          class="text-gray-900 dark:text-white no-underline transition-colors hover:text-primary"
          target="_blank"
        >
          {{ publication.title }}
        </a>
      </template>
      <template v-else>
        <span class="text-gray-900 dark:text-white">{{ publication.title }}</span>
      </template>
    </h3>

    <p v-if="publication.excerpt" class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4 flex-grow line-clamp-3">
      {{ publication.excerpt }}
    </p>

    <div class="flex gap-2 mt-auto">
      <template v-if="publication.fileUrl">
        <a
          :href="publication.fileUrl"
          class="btn-primary btn-sm flex-1 justify-center"
          download
          :aria-label="`${$t('common.download')}: ${publication.title}`"
        >
          {{ $t('common.download') }}
        </a>
      </template>
      <template v-else-if="publication.content">
        <button
          type="button"
          class="btn-outline btn-sm flex-1 justify-center"
          :aria-label="`${$t('common.readMore')}: ${publication.title}`"
          @click="$emit('read-more', publication)"
        >
          {{ $t('common.readMore') }}
        </button>
      </template>
    </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Publication } from '~/types'

interface Props {
  publication: Publication
}

defineProps<Props>()

defineEmits<{
  'read-more': [publication: Publication]
}>()

const { getPublicationTypeVariant, getPublicationTypeLabel } = useCategoryBadge()
const { formatDateShort } = useLocaleDate()

function formatDate(dateStr: string): string {
  return formatDateShort(dateStr)
}
</script>
