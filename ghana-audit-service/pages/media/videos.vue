<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'Videos', path: '/media/videos' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Videos</h1>
        <p class="page-subtitle">
          Video content, documentaries, and recordings from the Ghana Audit Service.
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <section class="section">
      <div class="container">
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Videos Grid -->
        <template v-else>
          <!-- Empty State -->
          <div
            v-if="videos.length === 0"
            class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon name="heroicons:video-camera" class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No videos available yet
            </h3>
            <p class="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
              Video content, documentaries, and event recordings will appear here. Check back soon.
            </p>
            <NuxtLink to="/media" class="btn-outline btn-sm">
              Back to Media Centre
            </NuxtLink>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MediaVideoCard
              v-for="video in videos"
              :key="video.id"
              :video="video"
              @play="openVideoPlayer"
            />
          </div>
        </template>
      </div>
    </section>

    <!-- YouTube Channel -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container text-center max-w-2xl mx-auto">
        <UiSectionHeader
          title="Subscribe to Our Channel"
          description="Follow our YouTube channel for the latest videos and updates."
          size="sm"
        />
        <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" class="btn-primary">
          Visit YouTube Channel
        </a>
      </div>
    </section>

    <!-- Video Player Modal -->
    <Teleport to="body">
      <div
        v-if="selectedVideo"
        class="fixed inset-0 z-modal bg-black/90 flex items-center justify-center p-4"
        @click="closeVideoPlayer"
      >
        <!-- Close Button -->
        <button
          class="absolute top-4 right-4 text-white/80 hover:text-white z-10"
          aria-label="Close video player"
          @click="closeVideoPlayer"
        >
          <Icon name="heroicons:x-mark" class="w-8 h-8" aria-hidden="true" />
        </button>

        <!-- Video Container -->
        <div class="w-full max-w-4xl" @click.stop>
          <div class="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              :src="selectedVideo.url"
              class="w-full h-full"
              frameborder="0"
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
              "
              allowfullscreen
            ></iframe>
          </div>
          <div class="text-white mt-4">
            <h3 class="text-xl font-semibold">{{ selectedVideo.title }}</h3>
            <p v-if="selectedVideo.description" class="text-white/70 mt-2">
              {{ selectedVideo.description }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import type { Video } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Videos | Ghana Audit Service',
    description: 'Video content, documentaries, and recordings from the Ghana Audit Service.'
  })

  const videos = ref<Video[]>([])
  const loading = ref(true)
  const selectedVideo = ref<Video | null>(null)

  onMounted(async () => {
    try {
      videos.value = await $fetch<Video[]>('/api/videos')
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    } finally {
      loading.value = false
    }
  })

  function openVideoPlayer(video: Video) {
    selectedVideo.value = video
    document.body.style.overflow = 'hidden'
  }

  function closeVideoPlayer() {
    selectedVideo.value = null
    document.body.style.overflow = ''
  }

  // Close on escape key
  onMounted(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedVideo.value) {
        closeVideoPlayer()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
  })
</script>
