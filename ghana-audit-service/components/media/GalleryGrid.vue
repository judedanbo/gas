<template>
  <div>
    <!-- Gallery Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <button
        v-for="(image, index) in images"
        :key="image.id"
        class="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
        :aria-label="`View photo: ${image.caption || image.alt}`"
        @click="openLightbox(index)"
      >
        <img
          :src="image.url"
          :alt="image.alt"
          class="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        >

        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Icon name="heroicons:magnifying-glass-plus" class="w-10 h-10 text-white" aria-hidden="true" />
        </div>

        <!-- Caption -->
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
          {{ image.caption || image.alt }}
        </div>
      </button>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen"
        class="fixed inset-0 z-modal bg-black/90 flex items-center justify-center"
        @click="closeLightbox"
      >
        <!-- Close Button -->
        <button
          class="absolute top-4 right-4 text-white/80 hover:text-white z-10"
          aria-label="Close lightbox"
          @click="closeLightbox"
        >
          <Icon name="heroicons:x-mark" class="w-8 h-8" aria-hidden="true" />
        </button>

        <!-- Navigation -->
        <button
          v-if="currentIndex > 0"
          class="absolute left-4 text-white/80 hover:text-white"
          aria-label="Previous image"
          @click.stop="prevImage"
        >
          <Icon name="heroicons:chevron-left" class="w-12 h-12" aria-hidden="true" />
        </button>

        <button
          v-if="currentIndex < images.length - 1"
          class="absolute right-4 text-white/80 hover:text-white"
          aria-label="Next image"
          @click.stop="nextImage"
        >
          <Icon name="heroicons:chevron-right" class="w-12 h-12" aria-hidden="true" />
        </button>

        <!-- Image Container -->
        <div class="max-w-4xl max-h-[80vh] p-4" @click.stop>
          <img
            v-if="currentImage"
            :src="currentImage.url"
            :alt="currentImage.alt"
            class="max-w-full max-h-[75vh] rounded-lg"
          >

          <!-- Caption -->
          <div v-if="currentImage" class="text-center mt-4 text-white">
            <p class="text-lg">{{ currentImage.caption || currentImage.alt }}</p>
            <p class="text-sm text-white/60 mt-1">{{ currentImage.category }}</p>
          </div>

          <!-- Counter -->
          <div class="text-center mt-2 text-white/60 text-sm">
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { GalleryImage } from '~/types'

interface Props {
  images: GalleryImage[]
}

const props = defineProps<Props>()

const lightboxOpen = ref(false)
const currentIndex = ref(0)

const currentImage = computed(() => props.images[currentIndex.value])

function openLightbox(index: number) {
  currentIndex.value = index
  lightboxOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightboxOpen.value = false
  document.body.style.overflow = ''
}

function prevImage() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function nextImage() {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
  }
}

// Keyboard navigation
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (!lightboxOpen.value) return
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowLeft') prevImage()
    if (e.key === 'ArrowRight') nextImage()
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>
