<template>
  <div>
    <div class="mb-6 flex items-center gap-4">
      <NuxtLink
        to="/admin/gallery"
        class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </NuxtLink>
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Bulk upload</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Upload multiple images to an album in one go
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <AdminFormAdminBulkFileUpload ref="bulkRef" @complete="handleComplete" />
          <p v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
          <p
            v-if="successMessage"
            class="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
          >
            {{ successMessage }}
          </p>
        </div>
      </div>

      <div class="space-y-6">
        <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Destination</h2>
          <AdminFormAdminSelect
            v-model="destinationValue"
            label="Album"
            :options="destinationOptions"
            :disabled="loadingAlbums"
            help-text="Where uploaded images will be stored"
            placeholder="Choose an album"
          />
          <p v-if="loadingAlbums" class="mt-2 text-xs text-gray-500">Loading albums…</p>
          <NuxtLink
            to="/admin/gallery/albums/create"
            class="mt-3 inline-block text-sm text-primary hover:underline"
          >
            + New album
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { AdminGalleryAlbum, PaginatedResponse } from '~/types/admin'

  definePageMeta({ layout: 'admin' })

  const api = useAdminApi()

  const albums = ref<AdminGalleryAlbum[]>([])
  const loadingAlbums = ref(false)
  // 'null' represents the Unassigned bucket so it works with the string-valued <select>.
  const destinationValue = ref<string | number>('null')
  const error = ref<string | null>(null)
  const successMessage = ref<string | null>(null)
  const bulkRef = ref<{ reset: () => void } | null>(null)

  const destinationOptions = computed(() => {
    const opts: { value: string | number; label: string }[] = [
      { value: 'null', label: 'Unassigned (no album)' }
    ]
    for (const album of albums.value) {
      if (album.id === 0) continue
      const title = album.translations?.en?.title || album.slug
      opts.push({ value: album.id, label: title })
    }
    return opts
  })

  async function loadAlbums() {
    loadingAlbums.value = true
    try {
      const response = await api.get<PaginatedResponse<AdminGalleryAlbum>>('gallery/albums', {
        perPage: 100
      })
      albums.value = response.data ?? []
    } finally {
      loadingAlbums.value = false
    }
  }

  async function handleComplete(
    payload: {
      url: string
      translations: { en: { alt: string | null; caption: string | null } }
    }[]
  ) {
    if (payload.length === 0) return
    error.value = null
    successMessage.value = null

    const albumId =
      destinationValue.value === 'null' ? null : Number(destinationValue.value) || null

    try {
      const response = await api.post<{ count: number }>('gallery/bulk', {
        albumId,
        images: payload
      })
      const target =
        albumId === null
          ? 'Unassigned'
          : destinationOptions.value.find((o) => o.value === albumId)?.label || `album ${albumId}`
      successMessage.value = `Saved ${response.count} image${response.count === 1 ? '' : 's'} to ${target}.`
      bulkRef.value?.reset()
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to save uploaded images'
    }
  }

  onMounted(() => loadAlbums())
</script>
