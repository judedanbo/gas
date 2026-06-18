<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tags</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Manage content tags for news and articles
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Create Tag Form -->
      <div class="lg:col-span-1">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Tag</h2>
          <form class="space-y-4" @submit.prevent="handleCreate">
            <div
              v-if="error"
              class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm"
            >
              {{ error }}
            </div>
            <AdminFormAdminInput
              v-model="newTag.name"
              label="Tag Name"
              required
              placeholder="Enter tag name"
            />
            <div>
              <AdminFormAdminInput
                v-model="newTag.slug"
                label="Slug"
                required
                placeholder="tag-slug"
                help-text="URL-friendly identifier (auto-generated from name)"
                :error="slugError"
                @update:model-value="handleSlugChange"
              >
                <template #suffix>
                  <span v-if="isCheckingSlug" class="text-gray-400">
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </span>
                  <span v-else-if="isSlugAvailable === true" class="text-green-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                  <span v-else-if="isSlugAvailable === false" class="text-red-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </span>
                </template>
              </AdminFormAdminInput>
              <p v-if="slugSuggestion" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Suggestion:
                <button
                  type="button"
                  class="text-primary hover:underline"
                  @click="useSlugSuggestion"
                >
                  {{ slugSuggestion }}
                </button>
              </p>
            </div>
            <button type="submit" class="btn btn-primary w-full" :disabled="saving">
              {{ saving ? 'Creating...' : 'Create Tag' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Tags List -->
      <div class="lg:col-span-2">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <AdminFormAdminInput v-model="searchQuery" placeholder="Search tags..." />
          </div>

          <div v-if="loading" class="flex items-center justify-center py-12">
            <div
              class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>

          <div v-else-if="filteredTags.length === 0" class="text-center py-12">
            <svg
              class="w-12 h-12 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <p class="text-gray-500 dark:text-gray-400">No tags found</p>
          </div>

          <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="tag in filteredTags"
              :key="tag.id"
              class="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ tag.name }}</p>
                <p class="text-sm text-gray-500">{{ tag.slug }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">{{ formatDate(tag.createdAt) }}</span>
                <button
                  type="button"
                  class="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                  @click="confirmDelete(tag)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div v-if="meta.lastPage > 1" class="p-4 border-t border-gray-200 dark:border-gray-700">
            <AdminUiAdminPagination :meta="meta" @page-change="handlePageChange" />
          </div>
        </div>
      </div>
    </div>

    <AdminUiAdminConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Tag"
      :message="`Are you sure you want to delete '${itemToDelete?.name}'? This may affect associated content.`"
      confirm-text="Delete"
      :loading="deleting"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminTag, TagInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const { items, loading, saving, deleting, meta, error, fetchAll, create, remove } =
    useAdminCrud<AdminTag>('tags')

  const searchQuery = ref('')
  const newTag = reactive<TagInput>({ name: '', slug: '' })

  // Slug checking state
  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  const slugError = computed(() => {
    if (isSlugAvailable.value === false) {
      return 'This slug is already taken'
    }
    return undefined
  })

  // Debounce timer for slug check
  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  const filteredTags = computed(() => {
    if (!searchQuery.value) return items.value
    const query = searchQuery.value.toLowerCase()
    return items.value.filter(
      (t) => t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query)
    )
  })

  const showDeleteDialog = ref(false)
  const itemToDelete = ref<AdminTag | null>(null)

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString()
  }

  // Generate slug from text
  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  // Check slug availability with debounce
  async function checkSlugAvailability(slug: string) {
    if (!slug) {
      isSlugAvailable.value = null
      slugSuggestion.value = null
      return
    }

    isCheckingSlug.value = true
    isSlugAvailable.value = null
    slugSuggestion.value = null

    try {
      const { get } = useAdminApi()
      const response = await get<{ available: boolean; suggestion?: string }>('tags/check-slug', {
        slug
      })
      isSlugAvailable.value = response.available
      slugSuggestion.value = response.suggestion || null
    } catch {
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  // Handle slug input change
  function handleSlugChange(value: string | number) {
    const slugValue = String(value)

    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout)
    }

    slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(slugValue)
    }, 300)
  }

  // Use suggested slug
  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      newTag.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
    }
  }

  // Auto-generate slug from name
  watch(
    () => newTag.name,
    (name) => {
      if (name) {
        const newSlug = generateSlug(name)
        newTag.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  async function handleCreate() {
    const result = await create(newTag)
    if (result) {
      newTag.name = ''
      newTag.slug = ''
      isSlugAvailable.value = null
      slugSuggestion.value = null
    }
  }

  function confirmDelete(tag: AdminTag) {
    itemToDelete.value = tag
    showDeleteDialog.value = true
  }
  async function handleDelete() {
    if (itemToDelete.value && (await remove(itemToDelete.value.id))) {
      showDeleteDialog.value = false
      itemToDelete.value = null
    }
  }
  function handlePageChange(page: number) {
    fetchAll({ page, perPage: 50 })
  }

  onMounted(() => fetchAll({ perPage: 50 }))
</script>
