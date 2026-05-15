<template>
  <UiBaseModal
    :model-value="modelValue"
    title="Move image"
    size="md"
    :close-on-backdrop="!moving"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Move this image to a different album. Choose
        <strong>Unassigned</strong>
        to remove it from any album.
      </p>

      <div>
        <label class="form-label" for="move-search">Search albums</label>
        <input
          id="move-search"
          v-model="search"
          type="search"
          placeholder="Type to filter albums..."
          class="form-input"
          :disabled="loading || moving"
        />
      </div>

      <div
        class="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
        role="listbox"
      >
        <div v-if="loading" class="flex items-center justify-center py-6 text-sm text-gray-500">
          <div
            class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          Loading albums…
        </div>
        <ul
          v-else-if="filteredOptions.length > 0"
          class="divide-y divide-gray-100 dark:divide-gray-700"
        >
          <li v-for="option in filteredOptions" :key="String(option.id)">
            <button
              type="button"
              role="option"
              :aria-selected="selectedId === option.id"
              :disabled="moving || option.id === currentAlbumId"
              class="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              :class="
                selectedId === option.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              "
              @click="selectedId = option.id"
            >
              <span>
                {{ option.title }}
                <span v-if="option.id === currentAlbumId" class="ml-1 text-xs text-gray-500">
                  (current)
                </span>
              </span>
              <span class="text-xs text-gray-400">{{ option.imageCount }}</span>
            </button>
          </li>
        </ul>
        <div v-else class="px-3 py-6 text-center text-sm text-gray-500">No matching albums</div>
      </div>

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="moving"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="moving || selectedId === undefined || selectedId === currentAlbumId"
          @click="confirm"
        >
          {{ moving ? 'Moving…' : 'Move' }}
        </button>
      </div>
    </template>
  </UiBaseModal>
</template>

<script setup lang="ts">
  import type { AdminGalleryAlbum, PaginatedResponse } from '~/types/admin'

  interface Props {
    modelValue: boolean
    imageId: number | null
    currentAlbumId: number | null
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    moved: [payload: { imageId: number; albumId: number | null }]
  }>()

  type Option = { id: number | null; title: string; imageCount: number }

  const api = useAdminApi()

  const loading = ref(false)
  const moving = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')
  const options = ref<Option[]>([])
  const selectedId = ref<number | null | undefined>(undefined)

  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (!isOpen) return
      error.value = null
      search.value = ''
      selectedId.value = undefined
      await loadAlbums()
    }
  )

  async function loadAlbums() {
    loading.value = true
    try {
      const response = await api.get<PaginatedResponse<AdminGalleryAlbum>>('gallery/albums', {
        perPage: 100
      })
      const albums = response.data ?? []
      const opts: Option[] = [{ id: null, title: 'Unassigned', imageCount: 0 }]
      for (const album of albums) {
        if (album.id === 0) continue
        const title = album.translations?.en?.title || album.slug
        opts.push({ id: album.id, title, imageCount: album.imageCount })
      }
      options.value = opts
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to load albums'
    } finally {
      loading.value = false
    }
  }

  const filteredOptions = computed(() => {
    const term = search.value.trim().toLowerCase()
    if (!term) return options.value
    return options.value.filter((o) => o.title.toLowerCase().includes(term))
  })

  async function confirm() {
    if (props.imageId == null) return
    if (selectedId.value === undefined) return
    if (selectedId.value === props.currentAlbumId) return

    moving.value = true
    error.value = null
    try {
      const existing = await api.get<{
        url: string
        category: string | null
        translations: Record<string, { alt: string | null; caption: string | null }>
      }>(`gallery/${props.imageId}`)

      await api.put(`gallery/${props.imageId}`, {
        url: existing.url,
        category: existing.category,
        albumId: selectedId.value,
        translations: existing.translations
      })

      emit('moved', { imageId: props.imageId, albumId: selectedId.value })
      emit('update:modelValue', false)
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to move image'
    } finally {
      moving.value = false
    }
  }
</script>
