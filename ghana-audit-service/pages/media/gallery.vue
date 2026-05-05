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
          <div class="flex flex-wrap gap-2">
            <button
              :class="selectedCategory === '' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
              @click="selectedCategory = ''"
            >
              All Photos
            </button>
            <button
              v-for="category in categories"
              :key="category"
              :class="selectedCategory === category ? 'btn-primary btn-sm' : 'btn-outline btn-sm'"
              @click="selectedCategory = category"
            >
              {{ category }}
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <!-- Gallery Grid -->
        <template v-else>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Showing {{ filteredImages.length }} photos
          </p>

          <MediaGalleryGrid :images="filteredImages" />
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

  const filteredImages = computed(() => {
    if (!selectedCategory.value) return images.value
    return images.value.filter((img) => img.category === selectedCategory.value)
  })

  onMounted(async () => {
    try {
      const response = await $fetch<{ images: GalleryImage[]; categories: string[] }>(
        '/api/gallery'
      )
      images.value = response.images
      categories.value = response.categories
    } catch (error) {
      console.error('Failed to fetch gallery:', error)
    } finally {
      loading.value = false
    }
  })
</script>
