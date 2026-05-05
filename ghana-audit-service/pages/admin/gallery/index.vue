<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Gallery</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Manage image gallery</p>
      </div>
      <NuxtLink to="/admin/gallery/create" class="btn btn-primary inline-flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Upload Image
      </NuxtLink>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search images..."
      :has-active-filters="hasActiveFilters"
      @clear-filters="clearFilters"
    >
      <template #filters>
        <select v-model="filters.category" class="form-input text-sm">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </template>
    </AdminUiAdminSearchFilter>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <div v-else-if="items.length === 0" class="text-center py-12">
      <AdminUiAdminEmptyState
        title="No images found"
        description="Get started by uploading your first image."
        action-to="/admin/gallery/create"
        action-label="Upload Image"
      />
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div
        v-for="image in items"
        :key="image.id"
        class="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
      >
        <img
          :src="image.url"
          :alt="image.translations?.en?.alt || ''"
          class="w-full h-full object-cover"
        />
        <div
          class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
        >
          <button
            type="button"
            class="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"
            @click="viewImage(image)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            type="button"
            class="p-2 bg-red-500/80 hover:bg-red-600 rounded-lg text-white"
            @click="confirmDelete(image)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
        <div v-if="image.category" class="absolute top-2 left-2">
          <span class="badge badge-secondary text-xs">{{ image.category }}</span>
        </div>
        <div
          class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent"
        >
          <p class="text-white text-xs truncate">
            {{ image.translations?.en?.caption || image.translations?.en?.alt || 'No caption' }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="meta.lastPage > 1" class="mt-6">
      <AdminUiAdminPagination :meta="meta" @page-change="handlePageChange" />
    </div>

    <!-- View Image Modal -->
    <div
      v-if="viewingImage"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      @click.self="viewingImage = null"
    >
      <div class="relative max-w-4xl max-h-[90vh]">
        <button
          type="button"
          class="absolute -top-10 right-0 text-white hover:text-gray-300"
          @click="viewingImage = null"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          class="max-w-full max-h-[80vh] rounded-lg"
        />
        <div v-if="viewingImage.translations?.en?.caption" class="mt-2 text-center text-white">
          {{ viewingImage.translations?.en?.caption }}
        </div>
      </div>
    </div>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Image"
      message="Are you sure you want to delete this image? This action cannot be undone."
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminGalleryImage } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminGalleryImage>('gallery')

  const filters = reactive({ search: '', category: '' })
  const hasActiveFilters = computed(() => !!filters.search || !!filters.category)
  function clearFilters() {
    filters.search = ''
    filters.category = ''
  }

  const categories = computed(() => {
    const cats = new Set(items.value.map((i) => i.category).filter((c): c is string => Boolean(c)))
    return Array.from(cats)
  })

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminGalleryImage | null>(null)
  const viewingImage = ref<AdminGalleryImage | null>(null)

  function viewImage(image: AdminGalleryImage) {
    viewingImage.value = image
  }
  function confirmDelete(item: AdminGalleryImage) {
    itemToDelete.value = item
    showDeleteDialog.value = true
  }
  async function handleDelete() {
    if (itemToDelete.value && (await remove(itemToDelete.value.id))) {
      showDeleteDialog.value = false
      itemToDelete.value = null
    }
  }
  function handlePageChange(page: number) {
    fetchData({ page })
  }

  function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 24,
      ...overrides
    }
    if (filters.search) params.search = filters.search
    if (filters.category) params.category = filters.category
    fetchAll(params)
  }

  watch(filters, () => fetchData({ page: 1 }), { deep: true })
  onMounted(() => fetchData())
</script>
