<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-4">
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isUnassigned ? 'Unassigned images' : albumTitle || 'Album' }}
          </h1>
          <p v-if="!isUnassigned && album" class="mt-1 text-gray-600 dark:text-gray-400">
            {{ images.length }} image{{ images.length === 1 ? '' : 's' }}
            <span v-if="album.isPublished" class="ml-2 text-green-600">· Published</span>
            <span v-else class="ml-2 text-amber-600">· Draft</span>
          </p>
          <p v-else-if="isUnassigned" class="mt-1 text-gray-600 dark:text-gray-400">
            Images that don't yet belong to an album. Use the move action to organize them.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="btn btn-primary inline-flex items-center gap-2"
          @click="showBulkUpload = true"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Upload images
        </button>
      </div>
    </div>

    <div v-if="albumLoading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>

    <div v-else>
      <div
        v-if="!isUnassigned && album"
        class="mb-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800"
      >
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Album details</h2>
        <form class="space-y-4" @submit.prevent="handleSave">
          <div
            v-if="saveError"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            {{ saveError }}
          </div>

          <AdminFormAdminTranslationTabs
            v-model="form.translations"
            :fields="translationFields"
            :errors="translationErrors"
          />

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminFormAdminInput v-model="form.slug" label="Slug" required :error="errors.slug" />
            <AdminFormAdminSwitch v-model="form.isPublished" label="Published" />
            <UiDateTimePicker v-model="form.publishedAt" label="Publish date" mode="datetime" />
          </div>

          <div
            class="flex items-center justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700"
          >
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>

      <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Images</h2>

        <div v-if="imagesLoading" class="flex items-center justify-center py-12">
          <div
            class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
        </div>

        <div v-else-if="images.length === 0" class="py-12 text-center text-sm text-gray-500">
          No images yet. Click
          <strong>Upload images</strong>
          to add some.
        </div>

        <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <div
            v-for="image in images"
            :key="image.id"
            class="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <img
              :src="image.url"
              :alt="image.translations?.en?.alt || ''"
              class="h-full w-full object-cover"
            />
            <div
              v-if="album && !isUnassigned && album.coverImageId === image.id"
              class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            >
              <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.922-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.196-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.293z"
                />
              </svg>
              Cover
            </div>

            <div
              class="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                type="button"
                title="View"
                class="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30"
                @click="viewingImage = image"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <button
                v-if="!isUnassigned && album && album.coverImageId !== image.id"
                type="button"
                title="Set as cover"
                class="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30"
                :disabled="settingCoverId === image.id"
                @click="setAsCover(image)"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.922-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.196-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L4.98 8.719c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Move to album"
                class="rounded-lg bg-white/20 p-2 text-white hover:bg-white/30"
                @click="openMove(image)"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4-4m-4 4l4 4"
                  />
                </svg>
              </button>
              <button
                type="button"
                title="Delete"
                class="rounded-lg bg-red-500/80 p-2 text-white hover:bg-red-600"
                @click="confirmDeleteImage(image)"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-if="imagesMeta.lastPage > 1" class="mt-6">
          <AdminUiAdminPagination :meta="imagesMeta" @page-change="handleImagesPageChange" />
        </div>
      </div>
    </div>

    <!-- Bulk upload modal -->
    <UiBaseModal v-model="showBulkUpload" size="full" title="Upload images">
      <AdminFormAdminBulkFileUpload ref="bulkRef" @complete="handleBulkComplete" />
      <p v-if="bulkSaveError" class="mt-3 text-sm text-red-600 dark:text-red-400">
        {{ bulkSaveError }}
      </p>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="bulkSaving"
            @click="showBulkUpload = false"
          >
            Close
          </button>
        </div>
      </template>
    </UiBaseModal>

    <!-- View image -->
    <div
      v-if="viewingImage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      @click.self="viewingImage = null"
    >
      <div class="relative max-h-[90vh] max-w-4xl">
        <button
          type="button"
          class="absolute -top-10 right-0 text-white hover:text-gray-300"
          @click="viewingImage = null"
        >
          <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <img
          :src="viewingImage.url"
          :alt="viewingImage.translations?.en?.alt || ''"
          class="max-h-[80vh] max-w-full rounded-lg"
        />
        <div v-if="viewingImage.translations?.en?.caption" class="mt-2 text-center text-white">
          {{ viewingImage.translations.en.caption }}
        </div>
      </div>
    </div>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteImage"
      title="Delete image"
      message="Are you sure you want to delete this image? This action cannot be undone."
      confirm-text="Delete"
      :loading="deletingImage"
      @confirm="handleDeleteImage"
    />

    <AdminUiAdminGalleryMoveDialog
      v-model="showMoveDialog"
      :image-id="movingImage?.id ?? null"
      :current-album-id="movingImage?.albumId ?? null"
      @moved="handleMoved"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminGalleryAlbum, AdminGalleryImage, GalleryAlbumInput } from '~/types/admin'

  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const albumId = computed(() => Number(route.params.id))
  const isUnassigned = computed(() => albumId.value === 0)

  const api = useAdminApi()
  const { errors, validate, setErrors, rules } = useFormValidation()

  const album = ref<AdminGalleryAlbum | null>(null)
  const albumLoading = ref(false)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const settingCoverId = ref<number | null>(null)

  const form = reactive<GalleryAlbumInput>({
    slug: '',
    coverImageId: null,
    publishedAt: '',
    isPublished: false,
    translations: { en: { title: '', description: '' } }
  })

  const translationFields = [
    { key: 'title', label: 'Title', type: 'input' as const, required: true },
    { key: 'description', label: 'Description', type: 'textarea' as const, rows: 4 }
  ]

  const translationErrors = computed(() => {
    const result: Record<string, Record<string, string>> = {}
    for (const [key, message] of Object.entries(errors)) {
      const match = key.match(/^translations\.(\w+)\.(\w+)$/)
      if (match) {
        const [, locale, field] = match
        if (!result[locale]) result[locale] = {}
        result[locale][field] = message
      }
    }
    return result
  })

  const albumTitle = computed(() => album.value?.translations?.en?.title || album.value?.slug)

  async function loadAlbum() {
    if (isUnassigned.value) {
      album.value = null
      return
    }
    albumLoading.value = true
    try {
      const a = await api.get<AdminGalleryAlbum>(`gallery/albums/${albumId.value}`)
      album.value = a
      form.slug = a.slug
      form.coverImageId = a.coverImageId
      form.publishedAt = a.publishedAt
      form.isPublished = a.isPublished
      form.translations = {
        en: {
          title: a.translations?.en?.title || '',
          description: a.translations?.en?.description || ''
        },
        ak: a.translations?.ak
          ? {
              title: a.translations.ak.title || '',
              description: a.translations.ak.description || ''
            }
          : undefined
      } as GalleryAlbumInput['translations']
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      saveError.value = err.data?.message || err.message || 'Failed to load album'
    } finally {
      albumLoading.value = false
    }
  }

  async function handleSave() {
    if (isUnassigned.value || !album.value) return
    if (!validate(form, { 'translations.en.title': [rules.required], slug: [rules.required] }))
      return
    saving.value = true
    saveError.value = null
    try {
      const updated = await api.put<AdminGalleryAlbum>(`gallery/albums/${albumId.value}`, {
        ...form,
        publishedAt:
          form.publishedAt && !isNaN(Date.parse(form.publishedAt))
            ? form.publishedAt
            : new Date().toISOString()
      })
      album.value = updated
    } catch (e: unknown) {
      const err = e as {
        data?: { message?: string; errors?: Record<string, string> }
        message?: string
      }
      if (err.data?.errors) setErrors(err.data.errors)
      saveError.value = err.data?.message || err.message || 'Failed to save'
    } finally {
      saving.value = false
    }
  }

  // ------------------------------------------------------------------ Images

  const images = ref<AdminGalleryImage[]>([])
  const imagesLoading = ref(false)
  const imagesMeta = ref({ total: 0, page: 1, perPage: 24, lastPage: 1 })

  async function loadImages(page = 1) {
    imagesLoading.value = true
    try {
      const params: Record<string, string | number> = { page, perPage: 24 }
      params.albumId = isUnassigned.value ? 'null' : albumId.value
      const response = await api.getList<AdminGalleryImage>('gallery', params)
      images.value = response.data
      imagesMeta.value = response.meta
    } catch {
      images.value = []
    } finally {
      imagesLoading.value = false
    }
  }

  function handleImagesPageChange(page: number) {
    loadImages(page)
  }

  // ------------------------------------------------------------------ Set cover

  async function setAsCover(image: AdminGalleryImage) {
    if (isUnassigned.value || !album.value) return
    settingCoverId.value = image.id
    try {
      const updated = await api.put<AdminGalleryAlbum>(`gallery/albums/${albumId.value}`, {
        ...form,
        coverImageId: image.id
      })
      album.value = updated
      form.coverImageId = image.id
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      saveError.value = err.data?.message || err.message || 'Failed to set cover'
    } finally {
      settingCoverId.value = null
    }
  }

  // ------------------------------------------------------------------ Move

  const showMoveDialog = ref(false)
  const movingImage = ref<AdminGalleryImage | null>(null)

  function openMove(image: AdminGalleryImage) {
    movingImage.value = image
    showMoveDialog.value = true
  }

  function handleMoved(payload: { imageId: number; albumId: number | null }) {
    images.value = images.value.filter((i) => i.id !== payload.imageId)
    imagesMeta.value.total = Math.max(0, imagesMeta.value.total - 1)
  }

  // ------------------------------------------------------------------ Delete image

  const showDeleteImage = ref(false)
  const deletingImage = ref(false)
  const imageToDelete = ref<AdminGalleryImage | null>(null)

  function confirmDeleteImage(image: AdminGalleryImage) {
    imageToDelete.value = image
    showDeleteImage.value = true
  }

  async function handleDeleteImage() {
    if (!imageToDelete.value) return
    deletingImage.value = true
    try {
      await api.del(`gallery/${imageToDelete.value.id}`)
      images.value = images.value.filter((i) => i.id !== imageToDelete.value!.id)
      imagesMeta.value.total = Math.max(0, imagesMeta.value.total - 1)
      showDeleteImage.value = false
      imageToDelete.value = null
    } finally {
      deletingImage.value = false
    }
  }

  // ------------------------------------------------------------------ View modal

  const viewingImage = ref<AdminGalleryImage | null>(null)

  // ------------------------------------------------------------------ Bulk upload

  const showBulkUpload = ref(false)
  const bulkSaving = ref(false)
  const bulkSaveError = ref<string | null>(null)
  const bulkRef = ref<{ reset: () => void } | null>(null)

  async function handleBulkComplete(
    payload: {
      url: string
      translations: { en: { alt: string | null; caption: string | null } }
    }[]
  ) {
    if (payload.length === 0) return
    bulkSaving.value = true
    bulkSaveError.value = null
    try {
      await api.post('gallery/bulk', {
        albumId: isUnassigned.value ? null : albumId.value,
        images: payload
      })
      showBulkUpload.value = false
      bulkRef.value?.reset()
      await loadImages(1)
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string }
      bulkSaveError.value = err.data?.message || err.message || 'Failed to save uploaded images'
    } finally {
      bulkSaving.value = false
    }
  }

  // ------------------------------------------------------------------ Mount

  onMounted(async () => {
    await loadAlbum()
    await loadImages(1)
  })

  watch(albumId, async () => {
    await loadAlbum()
    await loadImages(1)
  })
</script>
