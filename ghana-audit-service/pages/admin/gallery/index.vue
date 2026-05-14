<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Photo Gallery</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Browse and manage albums of gallery images
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink
          to="/admin/gallery/bulk-upload"
          class="btn btn-ghost inline-flex items-center gap-2"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12m4.5-4.5V21"
            />
          </svg>
          Bulk upload
        </NuxtLink>
        <NuxtLink to="/admin/gallery/create" class="btn btn-ghost inline-flex items-center gap-2">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Upload single image
        </NuxtLink>
        <NuxtLink
          to="/admin/gallery/albums/create"
          class="btn btn-primary inline-flex items-center gap-2"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          New album
        </NuxtLink>
      </div>
    </div>

    <AdminUiAdminSearchFilter
      v-model:search="filters.search"
      search-placeholder="Search albums by name..."
      :has-active-filters="!!filters.search"
      @clear-filters="filters.search = ''"
    />

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>

    <div v-else-if="items.length === 0" class="py-12 text-center">
      <AdminUiAdminEmptyState
        title="No albums found"
        :description="
          filters.search
            ? 'Try a different search term.'
            : 'Get started by creating your first album.'
        "
        action-to="/admin/gallery/albums/create"
        action-label="Create album"
      />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AdminUiAdminGalleryAlbumCard
        v-for="album in items"
        :key="album.id"
        :album="album"
        @delete="confirmDelete(album)"
      />
    </div>

    <div v-if="meta.lastPage > 1" class="mt-6">
      <AdminUiAdminPagination :meta="meta" @page-change="handlePageChange" />
    </div>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete album"
      message="Are you sure you want to delete this album? The images will remain but become unassigned."
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminGalleryAlbum } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, deleting, meta, fetchAll, remove } =
    useAdminCrud<AdminGalleryAlbum>('gallery/albums')

  const filters = reactive({ search: '' })

  const showDeleteDialog = ref(false)
  const albumToDelete = ref<AdminGalleryAlbum | null>(null)

  function confirmDelete(album: AdminGalleryAlbum) {
    albumToDelete.value = album
    showDeleteDialog.value = true
  }

  async function handleDelete() {
    if (!albumToDelete.value) return
    if (await remove(albumToDelete.value.id)) {
      showDeleteDialog.value = false
      albumToDelete.value = null
      fetchData({ page: meta.value.page })
    }
  }

  function handlePageChange(page: number) {
    fetchData({ page })
  }

  function fetchData(overrides: Record<string, string | number | boolean | undefined> = {}) {
    const params: Record<string, string | number | boolean | undefined> = {
      page: meta.value.page,
      perPage: 20,
      ...overrides
    }
    if (filters.search) params.search = filters.search
    fetchAll(params)
  }

  watch(
    () => filters.search,
    () => fetchData({ page: 1 })
  )

  onMounted(() => fetchData())
</script>
