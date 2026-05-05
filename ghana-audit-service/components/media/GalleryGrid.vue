<template>
  <div>
    <!-- Gallery Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <button
        v-for="(image, index) in images"
        :key="image.id"
        class="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
        @click="openLightbox(index)"
      >
        <!-- Placeholder when no actual image -->
        <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <span class="text-4xl opacity-50">📷</span>
        </div>

        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
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
          @click="closeLightbox"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Navigation -->
        <button
          v-if="currentIndex > 0"
          class="absolute left-4 text-white/80 hover:text-white"
          @click.stop="prevImage"
        >
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          v-if="currentIndex < images.length - 1"
          class="absolute right-4 text-white/80 hover:text-white"
          @click.stop="nextImage"
        >
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Image Container -->
        <div class="max-w-4xl max-h-[80vh] p-4" @click.stop>
          <div class="bg-gray-800 rounded-lg overflow-hidden">
            <!-- Placeholder Image -->
            <div class="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
              <div class="text-center text-white">
                <span class="text-6xl block mb-4">📷</span>
                <p class="text-lg">{{ currentImage?.alt }}</p>
              </div>
            </div>
          </div>

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
