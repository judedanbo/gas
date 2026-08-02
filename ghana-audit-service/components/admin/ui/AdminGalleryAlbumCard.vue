<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-primary/40 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
  >
    <div
      class="relative cursor-pointer bg-gray-100 dark:bg-gray-700"
      role="button"
      tabindex="0"
      :aria-label="`Open album ${title}`"
      @click="navigate"
      @keydown.enter="navigate"
    >
      <div class="relative aspect-[16/9] w-full overflow-hidden">
        <UiBaseImage
          v-if="coverUrl"
          :src="coverUrl"
          :alt="title"
          class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        >
          <svg class="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        <span
          class="absolute right-2 top-2 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shadow-sm"
          :class="
            album.id === 0
              ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
              : album.isPublished
                ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
          "
        >
          {{ album.id === 0 ? 'Unassigned' : album.isPublished ? 'Published' : 'Draft' }}
        </span>
      </div>

      <!-- 3-image strip -->
      <div class="grid grid-cols-3 gap-0.5 bg-gray-100 dark:bg-gray-700">
        <div
          v-for="(slot, idx) in stripSlots"
          :key="idx"
          class="relative aspect-square overflow-hidden bg-gray-200 dark:bg-gray-600"
        >
          <UiBaseImage
            v-if="slot"
            :src="slot"
            :alt="`${title} thumbnail ${idx + 2}`"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </div>

    <div class="flex flex-1 flex-col p-4">
      <h3
        class="mb-1 line-clamp-2 cursor-pointer text-sm font-semibold leading-snug text-gray-900 transition-colors hover:text-primary dark:text-white"
        :title="title"
        role="button"
        tabindex="0"
        @click="navigate"
        @keydown.enter="navigate"
      >
        {{ title }}
      </h3>
      <p
        v-if="description"
        class="line-clamp-2 text-xs text-gray-600 dark:text-gray-400"
        :title="description"
      >
        {{ description }}
      </p>

      <div
        class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        <span>{{ album.imageCount }} {{ album.imageCount === 1 ? 'image' : 'images' }}</span>

        <div v-if="album.id !== 0" class="flex items-center gap-1">
          <NuxtLink
            :to="`/admin/gallery/albums/${album.id}`"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-700"
            @click.stop
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Open
          </NuxtLink>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            @click.stop="$emit('delete')"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </div>

        <NuxtLink
          v-else
          to="/admin/gallery/albums/0"
          class="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-700"
          @click.stop
        >
          Manage
        </NuxtLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
  import type { AdminGalleryAlbum } from '~/types/admin'

  const props = defineProps<{
    album: AdminGalleryAlbum
    locale?: 'en' | 'ak'
  }>()

  defineEmits<{
    delete: []
  }>()

  const router = useRouter()

  const activeLocale = computed<'en' | 'ak'>(() => props.locale || 'en')

  const title = computed(() => {
    const t = props.album.translations
    return t[activeLocale.value]?.title || t.en?.title || props.album.slug
  })

  const description = computed(() => {
    const t = props.album.translations
    return t[activeLocale.value]?.description || t.en?.description || ''
  })

  const coverUrl = computed(() => props.album.previewImages[0] || null)

  const stripSlots = computed(() => {
    const slots: (string | null)[] = []
    for (let i = 1; i <= 3; i++) {
      slots.push(props.album.previewImages[i] || null)
    }
    return slots
  })

  function navigate() {
    router.push(`/admin/gallery/albums/${props.album.id}`)
  }
</script>
