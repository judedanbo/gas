<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Pop-up not found</h2>
      <NuxtLink to="/admin/popups" class="btn btn-primary">Back to Pop-ups</NuxtLink>
    </div>
    <template v-else>
      <div class="flex items-center gap-4 mb-6">
        <NuxtLink
          to="/admin/popups"
          aria-label="Go back"
          class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </NuxtLink>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit Pop-up</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">{{ currentItem.title }}</p>
        </div>
      </div>

      <AdminFormAdminPopupForm
        :initial="currentItem"
        :saving="saving"
        :error="error"
        :field-errors="fieldErrors"
        submit-label="Save Changes"
        saving-label="Saving..."
        @submit="handleSubmit"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { AdminPopup, PopupInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminPopup>('popups')

  // The form seeds itself from the loaded pop-up once, when it mounts, so a
  // failed save keeps the admin's edits.
  onMounted(() => fetchOne(id))

  async function handleSubmit(payload: PopupInput) {
    if (await update(id, payload)) router.push('/admin/popups')
  }
</script>
