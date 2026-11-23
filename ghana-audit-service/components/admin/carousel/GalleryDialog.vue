<template>
  <UiBaseModal
    :model-value="modelValue"
    :title="`Photos from “${albumTitle}”`"
    size="full"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="loadingImages" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span class="sr-only">Loading photos</span>
    </div>

    <p v-else-if="loadError" class="py-6 text-sm text-red-700 dark:text-red-400">{{ loadError }}</p>

    <p v-else-if="images.length === 0" class="py-6 text-sm">This album has no photos yet.</p>

    <div v-else class="space-y-5">
      <div>
        <label
          for="carousel-album-count"
          class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
        >
          Number of photos to show
        </label>
        <input
          id="carousel-album-count"
          v-model.number="count"
          type="number"
          min="1"
          :max="maxCount"
          required
          aria-describedby="carousel-album-count-help"
          class="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <p id="carousel-album-count-help" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Each photo is one slide (1–{{ maxCount }}).
        </p>
      </div>

      <div>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">Choose the photos</h3>
          <button
            v-if="selected.length > 0"
            type="button"
            class="text-sm font-medium text-gray-700 underline hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            @click="selected = []"
          >
            Clear selection
          </button>
        </div>
        <p class="mb-3 text-sm" aria-live="polite">
          {{ selectionSummary }}
        </p>

        <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          <li v-for="image in images" :key="image.id">
            <button
              type="button"
              class="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:bg-gray-700 dark:focus-visible:ring-offset-gray-800"
              :class="
                isSelected(image.id)
                  ? 'ring-4 ring-primary'
                  : selectionFull
                    ? 'opacity-50'
                    : 'hover:opacity-90'
              "
              :aria-pressed="isSelected(image.id)"
              :aria-label="
                isSelected(image.id)
                  ? `${image.alt} — selected, slide ${selected.indexOf(image.id) + 1}`
                  : image.alt
              "
              :disabled="!isSelected(image.id) && selectionFull"
              @click="toggle(image.id)"
            >
              <img :src="image.url" alt="" loading="lazy" class="h-full w-full object-cover" />
              <span
                v-if="isSelected(image.id)"
                class="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
                aria-hidden="true"
              >
                {{ selected.indexOf(image.id) + 1 }}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="saving || loadingImages || images.length === 0 || !countValid"
          @click="$emit('save', { imageCount: count, imageIds: [...selected] })"
        >
          {{ saving ? 'Saving...' : 'Save photos' }}
        </button>
      </div>
    </template>
  </UiBaseModal>
</template>

<script setup lang="ts">
  import type { AdminCarouselAlbumImage } from '~/types/admin'

  const MAX_PHOTOS = 10

  const props = defineProps<{
    modelValue: boolean
    albumId: number | null
    albumTitle: string
    /** Current settings when the album is already on the carousel */
    imageCount: number | null
    imageIds: number[]
    saving: boolean
    fetchAlbumImages: (albumId: number) => Promise<AdminCarouselAlbumImage[]>
  }>()

  defineEmits<{
    'update:modelValue': [value: boolean]
    save: [selection: { imageCount: number; imageIds: number[] }]
  }>()

  const images = ref<AdminCarouselAlbumImage[]>([])
  const loadingImages = ref(false)
  const loadError = ref<string | null>(null)
  const count = ref(2)
  const selected = ref<number[]>([])

  const maxCount = computed(() => Math.max(1, Math.min(MAX_PHOTOS, images.value.length)))
  const countValid = computed(
    () => Number.isInteger(count.value) && count.value >= 1 && count.value <= maxCount.value
  )
  const selectionFull = computed(() => selected.value.length >= count.value)

  const selectionSummary = computed(() => {
    const chosen = selected.value.length
    if (chosen === 0) {
      return `None chosen — the first ${count.value === 1 ? 'photo' : `${count.value} photos`} of the album will be used.`
    }
    const remaining = count.value - chosen
    if (remaining <= 0) return `${chosen} of ${count.value} chosen, shown in the order selected.`
    return `${chosen} of ${count.value} chosen — the remaining ${remaining} will be the first other ${remaining === 1 ? 'photo' : 'photos'} of the album.`
  })

  function isSelected(id: number) {
    return selected.value.includes(id)
  }

  function toggle(id: number) {
    if (isSelected(id)) selected.value = selected.value.filter((s) => s !== id)
    else if (!selectionFull.value) selected.value = [...selected.value, id]
  }

  // Lowering the number drops the photos chosen last.
  watch(count, (value) => {
    if (Number.isInteger(value) && value >= 1 && selected.value.length > value) {
      selected.value = selected.value.slice(0, value)
    }
  })

  watch(
    () => [props.modelValue, props.albumId] as const,
    async ([open, albumId]) => {
      if (!open || albumId === null) return
      images.value = []
      loadError.value = null
      loadingImages.value = true
      try {
        const data = await props.fetchAlbumImages(albumId)
        if (props.albumId !== albumId) return
        images.value = data
        const ids = new Set(data.map((img) => img.id))
        selected.value = props.imageIds.filter((id) => ids.has(id))
        count.value = Math.min(
          props.imageCount ?? 2,
          Math.max(1, Math.min(MAX_PHOTOS, data.length))
        )
      } catch {
        loadError.value = 'Failed to load the album photos. Please try again.'
      } finally {
        loadingImages.value = false
      }
    },
    { immediate: true }
  )
</script>
