<template>
  <div>
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'Gallery', path: '/media/gallery' },
        { label: albumTitle, path: '' }
      ]"
    />

    <div class="page-header">
      <div class="container">
        <h1 class="text-3xl md:text-4xl font-heading font-bold mb-2">{{ albumTitle }}</h1>
        <p v-if="album" class="text-sm text-gray-400">
          {{ album.imageCount }} photos
        </p>
        <p v-if="album?.description" class="page-subtitle mt-2">{{ album.description }}</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <div v-else-if="error" class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4 mx-auto" aria-hidden="true" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Album not found</h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">This album may have been removed or is unavailable.</p>
          <NuxtLink to="/media/gallery" class="btn-primary btn-sm">Back to Gallery</NuxtLink>
        </div>

        <template v-else>
          <MediaGalleryGrid :images="images" />

          <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <NuxtLink
              to="/media/gallery"
              class="text-accent hover:text-accent/80 font-medium text-sm inline-flex items-center gap-1 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Gallery
            </NuxtLink>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { GalleryImage } from '~/types'

const route = useRoute()
const slug = route.params.slug as string

const album = ref<{ slug: string; title: string; description?: string; imageCount: number } | null>(null)
const images = ref<GalleryImage[]>([])
const loading = ref(true)
const error = ref(false)

const albumTitle = computed(() => album.value?.title || 'Album')

useSeoMeta({
  title: () => `${albumTitle.value} | Photo Gallery | Ghana Audit Service`,
  description: () => album.value?.description || `Photos from ${albumTitle.value}`
})

onMounted(async () => {
  try {
    const response = await $fetch<{
      album: typeof album.value
      images: GalleryImage[]
    }>(`/api/gallery/albums/${slug}`)
    album.value = response.album
    images.value = response.images
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>
