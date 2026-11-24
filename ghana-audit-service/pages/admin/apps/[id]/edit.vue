<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
    <div v-else-if="!currentItem" class="text-center py-12">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">App not found</h2>
      <NuxtLink to="/admin/apps" class="btn btn-primary">Back to Apps</NuxtLink>
    </div>
    <template v-else>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <NuxtLink
            to="/admin/apps"
            aria-label="Back to Apps"
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
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Edit App</h1>
            <p class="text-gray-600 dark:text-gray-400 mt-1">
              {{ currentItem.translations.en.name }}
            </p>
          </div>
        </div>
        <a
          v-if="currentItem.isActive"
          :href="`/${currentItem.slug}`"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-outline btn-sm"
        >
          View page<span class="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <AdminFormAdminAppForm
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
  import type { AdminServiceApp, ServiceAppInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminServiceApp>('apps')

  // The form seeds itself from the loaded app once, when it mounts, so a
  // failed save keeps the admin's edits.
  onMounted(() => fetchOne(id))

  async function handleSubmit(payload: ServiceAppInput) {
    if (await update(id, payload as unknown as Partial<AdminServiceApp>)) {
      router.push('/admin/apps')
    }
  }
</script>
