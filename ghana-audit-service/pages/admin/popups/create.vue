<template>
  <div>
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create Pop-up</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          An image shown over the public site when a page loads
        </p>
      </div>
    </div>

    <AdminFormAdminPopupForm
      :saving="saving"
      :error="error"
      :field-errors="fieldErrors"
      submit-label="Create Pop-up"
      saving-label="Creating..."
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminPopup, PopupInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminPopup>('popups')

  async function handleSubmit(payload: PopupInput) {
    if (await create(payload)) router.push('/admin/popups')
  }
</script>
