<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'Gallery', path: '/media/gallery' }
      ]"
    />
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">Photo Gallery</h1>
        <p class="page-subtitle">
          Images from events, activities, and milestones of the Ghana Audit Service.
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <section class="section">
      <div class="container">
        <!-- Category Filter -->
        <div class="mb-8">
          <div class="flex items-center gap-4">
            <div ref="dropdownRef" class="relative">
              <button
                class="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-primary transition-colors"
                @click="dropdownOpen = !dropdownOpen"
              >
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
                {{ selectedCategory || 'All Albums' }}
                <svg class="w-3.5 h-3.5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <Transition
                enter-active-class="transition ease-out duration-150"
                enter-from-class="opacity-0 translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition ease-in duration-100"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-1"
              >
                <div
                  v-if="dropdownOpen"
                  class="absolute left-0 mt-2 w-80 md:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 p-4"
                >
                  <input
                    v-model="albumSearch"
                    type="text"
                    placeholder="Search albums..."
                    class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary mb-3"
                  >
                  <div class="max-h-64 overflow-y-auto space-y-0.5">
                    <button
                      class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors"
                      :class="selectedCategory === '' ? 'bg-primary text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                      @click="selectCategory('')"
                    >
                      <span>All Photos</span>
                      <span class="text-xs" :class="selectedCategory === '' ? 'text-white/70' : 'text-gray-400'">{{ images.length }}</span>
                    </button>
                    <button
                      v-for="cat in filteredCategories"
                      :key="cat"
                      class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors"
                      :class="selectedCategory === cat ? 'bg-primary text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                      @click="selectCategory(cat)"
                    >
                      <span class="truncate mr-2">{{ cat }}</span>
                      <span class="text-xs flex-shrink-0" :class="selectedCategory === cat ? 'text-white/70' : 'text-gray-400'">{{ categoryCount(cat) }}</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>

            <span class="text-sm text-gray-500 dark:text-gray-400">
              {{ filteredImages.length }} photos<span v-if="!selectedCategory"> across {{ categories.length }} albums</span>
            </span>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Gallery Grid -->
        <template v-else>
          <!-- Empty State -->
          <div
            v-if="filteredImages.length === 0"
            class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <Icon
              name="heroicons:photo"
              class="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4 mx-auto"
              aria-hidden="true"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              <template v-if="selectedCategory">No photos in "{{ selectedCategory }}"</template>
              <template v-else>No photos available yet</template>
            </h3>
            <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              <template v-if="selectedCategory">
                Try selecting a different category or view all photos.
              </template>
              <template v-else>
                Photos from events, activities, and milestones will appear here as they are added to the gallery.
              </template>
            </p>
            <div class="flex flex-wrap justify-center gap-3">
              <button v-if="selectedCategory" class="btn-primary btn-sm" @click="selectedCategory = ''">
                View All Photos
              </button>
              <NuxtLink to="/media" class="btn-outline btn-sm">
                Back to Media Centre
              </NuxtLink>
            </div>
          </div>

          <template v-else>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Showing {{ filteredImages.length }} photos
            </p>
            <MediaGalleryGrid :images="filteredImages" />
          </template>
        </template>
      </div>
    </section>

    <!-- Download Media Kit -->
    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container text-center max-w-2xl mx-auto">
        <UiSectionHeader
          title="Media Resources"
          description="Download official logos, images, and brand guidelines for the Ghana Audit Service."
          size="sm"
        />
        <a href="/documents/media-kit.zip" class="btn-primary" download> Download Media Kit </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { GalleryImage } from '~/types'

  // SEO
  useSeoMeta({
    title: 'Photo Gallery | Ghana Audit Service',
    description: 'Images from events, activities, and milestones of the Ghana Audit Service.'
  })

  const images = ref<GalleryImage[]>([])
  const categories = ref<string[]>([])
  const loading = ref(true)
  const selectedCategory = ref('')
  const dropdownOpen = ref(false)
  const albumSearch = ref('')
  const dropdownRef = ref<HTMLElement | null>(null)

  const filteredImages = computed(() => {
    if (!selectedCategory.value) return images.value
    return images.value.filter((img) => img.category === selectedCategory.value)
  })

  const filteredCategories = computed(() => {
    if (!albumSearch.value) return categories.value
    const q = albumSearch.value.toLowerCase()
    return categories.value.filter((c) => c.toLowerCase().includes(q))
  })

  function categoryCount(cat: string): number {
    return images.value.filter((img) => img.category === cat).length
  }

  function selectCategory(cat: string) {
    selectedCategory.value = cat
    dropdownOpen.value = false
    albumSearch.value = ''
  }

  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
      dropdownOpen.value = false
      albumSearch.value = ''
    }
  }

  const route = useRoute()

  onMounted(async () => {
    document.addEventListener('click', handleClickOutside)

    try {
      const response = await $fetch<{ images: GalleryImage[]; categories: string[] }>(
        '/api/gallery'
      )
      images.value = response.images
      categories.value = response.categories

      const albumParam = route.query.album
      if (typeof albumParam === 'string' && categories.value.includes(albumParam)) {
        selectedCategory.value = albumParam
      }
    } catch (error) {
      console.error('Failed to fetch gallery:', error)
    } finally {
      loading.value = false
    }
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
</script>
