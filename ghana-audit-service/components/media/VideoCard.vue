<template>
  <article
    :aria-label="video.isLive ? video.title + ' — ' + $t('videos.liveNowA11y') : undefined"
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all hover:border-primary hover:shadow-lg"
  >
    <!-- Thumbnail -->
    <button class="relative w-full aspect-video bg-gray-900 group" @click="$emit('play', video)">
      <img
        v-if="video.thumbnail"
        :src="video.thumbnail"
        :alt="video.title"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div v-else class="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"></div>

      <!-- Play Button Overlay -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
        >
          <svg class="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      <!-- Live Badge -->
      <span
        v-if="video.isLive"
        class="absolute top-2 left-2 inline-flex items-center gap-1.5 bg-secondary text-white text-xs font-bold uppercase tracking-wide px-2 py-1 rounded"
      >
        <span
          class="w-2 h-2 rounded-full bg-white motion-safe:animate-pulse"
          aria-hidden="true"
        ></span>
        {{ $t('videos.liveBadge') }}
        <span class="sr-only">{{ $t('videos.liveNowA11y') }}</span>
      </span>

      <!-- Duration Badge (a live stream has no fixed duration) -->
      <div
        v-if="video.duration && !video.isLive"
        class="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded"
      >
        {{ video.duration }}
      </div>
    </button>

    <!-- Content -->
    <div class="p-4">
      <h3 class="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
        {{ video.title }}
      </h3>
      <p v-if="video.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
        {{ video.description }}
      </p>
      <span v-if="video.isLive" class="text-xs font-semibold text-secondary mt-2 block">
        {{ $t('videos.streamingNow') }}
      </span>
      <time v-else class="text-xs text-gray-400 mt-2 block">
        {{ formatDate(video.publishedAt) }}
      </time>
    </div>
  </article>
</template>

<script setup lang="ts">
  import type { Video } from '~/types'

  interface Props {
    video: Video
  }

  defineProps<Props>()

  defineEmits<{
    play: [video: Video]
  }>()

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
</script>
