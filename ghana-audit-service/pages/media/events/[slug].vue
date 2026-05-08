<template>
  <div>
    <!-- Breadcrumb -->
    <CommonBreadcrumb
      :crumbs="[
        { label: 'Media Centre', path: '/media' },
        { label: 'Events', path: '/media/events' },
        { label: eventData?.title || 'Event', path: `/media/events/${route.params.slug}` }
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container">
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="section">
      <div class="container text-center py-12">
        <Icon name="heroicons:calendar" class="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
        <h2 class="text-display-md font-heading font-bold text-gray-900 dark:text-white mb-2">Event Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">The event you're looking for doesn't exist or has been removed.</p>
        <NuxtLink to="/media/events" class="btn-primary">
          Back to Events
        </NuxtLink>
      </div>
    </div>

    <!-- Event Content -->
    <template v-else-if="eventData">
      <!-- Event Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div class="max-w-3xl">
            <div class="flex items-center gap-3 mb-4">
              <UiBadge :variant="eventData.isVirtual ? 'info' : 'accent'" size="md">
                {{ eventData.isVirtual ? 'Virtual Event' : 'In-Person Event' }}
              </UiBadge>
              <span v-if="isPast" class="text-sm bg-white/20 px-3 py-1 rounded-full">Past Event</span>
            </div>

            <h1 class="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              {{ eventData.title }}
            </h1>

            <div class="flex flex-wrap items-center gap-6 text-white/80">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{{ formatDateRange(eventData.startDate, eventData.endDate) }}</span>
              </div>
              <div v-if="eventData.location" class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{{ eventData.location }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Event Body -->
      <section class="section">
        <div class="container">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main Content -->
            <div class="lg:col-span-2">
              <!-- Thumbnail -->
              <div v-if="eventData.thumbnail" class="mb-8 rounded-lg overflow-hidden">
                <img
                  :src="eventData.thumbnail"
                  :alt="eventData.title"
                  class="w-full"
                >
              </div>

              <!-- Event Description -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
                <div class="prose prose-lg dark:prose-invert max-w-none" v-html="eventData.content"></div>

                <!-- Event Photo Gallery -->
                <div v-if="eventData.images?.length" class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Event Photos
                    <span class="text-sm font-normal text-gray-500 ml-2">{{ eventData.images.length }} photos</span>
                  </h4>
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <button
                      v-for="(img, idx) in eventData.images"
                      :key="idx"
                      class="aspect-square rounded-lg overflow-hidden group relative"
                      @click="openGallery(idx)"
                    >
                      <img
                        :src="img.url"
                        :alt="img.alt"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      >
                      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-1 space-y-6">
              <!-- Event Details Card -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Event Details</h3>
                <div class="space-y-4">
                  <div>
                    <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</dt>
                    <dd class="text-sm text-gray-900 dark:text-white mt-1">{{ formatDateRange(eventData.startDate, eventData.endDate) }}</dd>
                  </div>
                  <div v-if="eventData.location">
                    <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Location</dt>
                    <dd class="text-sm text-gray-900 dark:text-white mt-1">{{ eventData.location }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Format</dt>
                    <dd class="text-sm text-gray-900 dark:text-white mt-1">{{ eventData.isVirtual ? 'Virtual' : 'In-Person' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</dt>
                    <dd class="mt-1">
                      <UiBadge :variant="isPast ? 'secondary' : 'accent'" size="sm">
                        {{ isPast ? 'Completed' : 'Upcoming' }}
                      </UiBadge>
                    </dd>
                  </div>
                </div>

                <div v-if="eventData.registrationUrl && !isPast" class="mt-6">
                  <a
                    :href="eventData.registrationUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-primary w-full justify-center"
                  >
                    Register Now
                  </a>
                </div>
              </div>

              <!-- Share This Event -->
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Share This Event</h3>
                <div class="flex gap-3">
                  <a
                    :href="`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2] text-white hover:scale-110 transition-transform dark:bg-gray-700 dark:text-[#1877F2] dark:ring-1 dark:ring-[#1877F2]/40"
                    aria-label="Share on Facebook"
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  </a>
                  <a
                    :href="`https://x.com/intent/tweet?url=${shareUrl}&text=${encodeURIComponent(eventData.title)}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white hover:scale-110 transition-transform dark:bg-gray-700 dark:text-white dark:ring-1 dark:ring-white/30"
                    aria-label="Share on X"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  </a>
                  <a
                    :href="`https://wa.me/?text=${encodeURIComponent(eventData.title + ' ' + shareUrl)}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-10 h-10 flex items-center justify-center rounded-full bg-[#25D366] text-white hover:scale-110 transition-transform dark:bg-gray-700 dark:text-[#25D366] dark:ring-1 dark:ring-[#25D366]/40"
                    aria-label="Share on WhatsApp"
                  >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  </a>
                  <a
                    :href="`mailto:?subject=${encodeURIComponent(eventData.title)}&body=${encodeURIComponent(eventData.title + '\n\n' + shareUrl)}`"
                    class="w-10 h-10 flex items-center justify-center rounded-full bg-gray-600 text-white hover:scale-110 transition-transform dark:bg-gray-700 dark:text-gray-300 dark:ring-1 dark:ring-gray-500/40"
                    aria-label="Share via Email"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </a>
                </div>
              </div>

              <!-- Back to Events -->
              <NuxtLink to="/media/events" class="btn-outline w-full justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Events
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Gallery Lightbox -->
      <Teleport to="body">
        <div
          v-if="galleryOpen && eventData.images?.length"
          class="fixed inset-0 z-modal bg-black/90 flex items-center justify-center"
          @click="closeGallery"
        >
          <button class="absolute top-4 right-4 text-white/80 hover:text-white z-10" @click="closeGallery">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button v-if="galleryIndex > 0" class="absolute left-4 text-white/80 hover:text-white" @click.stop="galleryIndex--">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button v-if="galleryIndex < eventData.images.length - 1" class="absolute right-4 text-white/80 hover:text-white" @click.stop="galleryIndex++">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div class="max-w-4xl max-h-[80vh] p-4" @click.stop>
            <img
              :src="eventData.images[galleryIndex].url"
              :alt="eventData.images[galleryIndex].alt"
              class="max-w-full max-h-[75vh] rounded-lg mx-auto"
            >
            <div class="text-center mt-4 text-white">
              <p v-if="eventData.images[galleryIndex].caption" class="text-lg">{{ eventData.images[galleryIndex].caption }}</p>
              <p class="text-sm text-white/60 mt-1">{{ galleryIndex + 1 }} / {{ eventData.images.length }}</p>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Event } from '~/types'

const route = useRoute()

const { data: eventData, pending, error } = await useFetch<Event>(
  `/api/events/${route.params.slug}`
)

const isPast = computed(() => {
  if (!eventData.value) return false
  return new Date(eventData.value.startDate) < new Date()
})

const shareUrl = computed(() => {
  if (!import.meta.client) return ''
  return encodeURIComponent(window.location.href)
})

const galleryOpen = ref(false)
const galleryIndex = ref(0)

function openGallery(index: number) {
  galleryIndex.value = index
  galleryOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeGallery() {
  galleryOpen.value = false
  document.body.style.overflow = ''
}

onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (!galleryOpen.value || !eventData.value?.images) return
    if (e.key === 'Escape') closeGallery()
    if (e.key === 'ArrowLeft' && galleryIndex.value > 0) galleryIndex.value--
    if (e.key === 'ArrowRight' && galleryIndex.value < eventData.value.images.length - 1) galleryIndex.value++
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})

useSeoMeta({
  title: () => eventData.value ? `${eventData.value.title} | Ghana Audit Service` : 'Event | Ghana Audit Service',
  description: () => eventData.value?.description || 'Event from the Ghana Audit Service'
})

function formatDateRange(start: string, end?: string): string {
  const startDate = new Date(start)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }

  if (!end) {
    return startDate.toLocaleDateString('en-GB', options)
  }

  const endDate = new Date(end)

  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.getDate()} - ${endDate.toLocaleDateString('en-GB', options)}`
  }

  return `${startDate.toLocaleDateString('en-GB', options)} - ${endDate.toLocaleDateString('en-GB', options)}`
}
</script>
