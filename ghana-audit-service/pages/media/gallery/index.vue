<template>
  <div>
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'Gallery', path: '/media/gallery' }
      ]"
    />

    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Photo Gallery</h1>
        <p class="page-subtitle">
          Images from events, activities, and milestones of the Ghana Audit Service.
        </p>
        <p v-if="meta.total" class="text-sm text-gray-400 mt-2">
          {{ meta.total }} albums
        </p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <template v-else-if="albums.length === 0">
          <div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Icon name="heroicons:photo" class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4 mx-auto" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No albums available yet</h3>
            <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Photo albums from events, activities, and milestones will appear here.
            </p>
            <NuxtLink to="/media" class="btn-outline btn-sm">Back to Media Centre</NuxtLink>
          </div>
        </template>

        <template v-else>
          <div class="space-y-10">
            <article v-for="album in albums" :key="album.id" class="album-section">
              <div class="flex items-center justify-between mb-4 pb-3 border-b-2 border-accent">
                <div>
                  <h2 class="text-xl md:text-2xl font-heading font-bold text-gray-900 dark:text-white">
                    {{ album.title }}
                  </h2>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ album.imageCount }} photos</p>
                </div>
                <NuxtLink
                  :to="`/media/gallery/${album.slug}`"
                  class="text-accent hover:text-accent/80 font-medium text-sm inline-flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  View Album
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </NuxtLink>
              </div>

              <NuxtLink :to="`/media/gallery/${album.slug}`" class="group block">
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 sm:gap-1.5 md:gap-2">
                  <!-- Featured large image -->
                  <div class="col-span-1 row-span-2 aspect-[3/4] sm:aspect-auto sm:min-h-[240px] md:min-h-[280px] overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                    <UiBaseImage
                      v-if="album.previewImages[0]"
                      :src="album.previewImages[0]"
                      :alt="album.title"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>

                  <!-- Smaller thumbnails -->
                  <div
                    v-for="(url, i) in album.previewImages.slice(1, visibleThumbnailCount(album))"
                    :key="i"
                    class="aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
                  >
                    <UiBaseImage
                      :src="url"
                      :alt="`${album.title} photo ${i + 2}`"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>

                  <!-- "+N more" card -->
                  <div
                    v-if="remainingCount(album) > 0"
                    class="aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center group-hover:border-accent transition-colors"
                  >
                    <div class="text-center">
                      <span class="block text-2xl md:text-3xl font-bold text-accent">+{{ remainingCount(album) }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1">more</span>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </article>
          </div>

          <!-- Pagination -->
          <div v-if="meta.lastPage > 1" class="mt-12 flex justify-center items-center gap-2">
            <button
              :disabled="meta.page === 1"
              class="btn-outline btn-sm"
              @click="goToPage(meta.page - 1)"
            >
              Previous
            </button>
            <template v-for="p in pageNumbers" :key="p">
              <span v-if="p === '...'" class="px-2 text-gray-400">...</span>
              <button
                v-else
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                :class="p === meta.page ? 'bg-accent text-gray-900' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'"
                @click="goToPage(p as number)"
              >
                {{ p }}
              </button>
            </template>
            <button
              :disabled="meta.page === meta.lastPage"
              class="btn-outline btn-sm"
              @click="goToPage(meta.page + 1)"
            >
              Next
            </button>
          </div>
        </template>
      </div>
    </section>

    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container text-center max-w-2xl mx-auto">
        <UiSectionHeader
          title="Media Resources"
          description="Download official logos, images, and brand guidelines for the Ghana Audit Service."
          size="sm"
        />
        <a href="/documents/media-kit.zip" class="btn-primary" download>Download Media Kit</a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { GalleryAlbumPublic } from '~/types'

useSeoMeta({
  title: 'Photo Gallery | Ghana Audit Service',
  description: 'Images from events, activities, and milestones of the Ghana Audit Service.'
})

const albums = ref<GalleryAlbumPublic[]>([])
const loading = ref(true)
const meta = ref({ total: 0, page: 1, perPage: 3, lastPage: 1 })

const screenWidth = ref(768)

function updateScreenWidth() {
  screenWidth.value = window.innerWidth
}

onMounted(() => {
  updateScreenWidth()
  window.addEventListener('resize', updateScreenWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth)
})

const maxPreviewSlots = computed(() => {
  if (screenWidth.value < 640) return 5
  if (screenWidth.value < 768) return 5
  return 7
})

function visibleThumbnailCount(album: GalleryAlbumPublic): number {
  const maxSlots = maxPreviewSlots.value
  const available = album.previewImages.length - 1
  const showMore = album.imageCount > maxSlots ? 1 : 0
  return Math.min(available, maxSlots - 1 - showMore)
}

function remainingCount(album: GalleryAlbumPublic): number {
  const shown = 1 + visibleThumbnailCount(album)
  return Math.max(0, album.imageCount - shown)
}

const pageNumbers = computed(() => {
  const { page, lastPage } = meta.value
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  if (page > 3) pages.push('...')
  for (let i = Math.max(2, page - 1); i <= Math.min(lastPage - 1, page + 1); i++) {
    pages.push(i)
  }
  if (page < lastPage - 2) pages.push('...')
  pages.push(lastPage)
  return pages
})

async function fetchAlbums(page = 1) {
  loading.value = true
  try {
    const response = await $fetch<{
      data: GalleryAlbumPublic[]
      meta: typeof meta.value
    }>('/api/gallery/albums', {
      query: { page, perPage: meta.value.perPage }
    })
    albums.value = response.data
    meta.value = response.meta
  } catch {
    // fetch failed — page shows empty state
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > meta.value.lastPage) return
  fetchAlbums(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  fetchAlbums()
})
</script>
