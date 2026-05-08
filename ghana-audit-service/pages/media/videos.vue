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
            v-if="allVideos.length === 0"
            class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div class="text-4xl mb-4">🎬</div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No videos available
            </h3>
            <p class="text-gray-600 dark:text-gray-400">Check back soon for new video content.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MediaVideoCard
              v-for="video in allVideos"
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
        <a
          href="https://www.youtube.com/@ghanaauditservice5076"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-primary inline-flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
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
          @click="closeVideoPlayer"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
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

  useSeoMeta({
    title: 'Videos | Ghana Audit Service',
    description: 'Video content, documentaries, and recordings from the Ghana Audit Service.'
  })

  const allVideos = ref<Video[]>([])
  const loading = ref(true)
  const selectedVideo = ref<Video | null>(null)

  function extractVideoId(url: string): string {
    const match = url.match(/(?:embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return match ? match[1] : url
  }

  onMounted(async () => {
    try {
      const [seeded, youtube] = await Promise.all([
        $fetch<Video[]>('/api/videos'),
        $fetch<Video[]>('/api/youtube-videos').catch(() => [] as Video[])
      ])

      const seededIds = new Set(seeded.map((v) => extractVideoId(v.url)))

      const uniqueYoutube = youtube.filter((v) => !seededIds.has(extractVideoId(v.url)))

      const merged = [...seeded, ...uniqueYoutube]
      merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

      allVideos.value = merged
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
