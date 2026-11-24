<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Add App</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          An Audit Service app or website, with its own page on this site
        </p>
      </div>
    </div>

    <AdminFormAdminAppForm
      :saving="saving"
      :error="error"
      :field-errors="fieldErrors"
      submit-label="Add App"
      saving-label="Adding..."
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
  import type { AdminServiceApp, ServiceAppInput } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } = useAdminCrud<AdminServiceApp>('apps')

  async function handleSubmit(payload: ServiceAppInput) {
    if (await create(payload as unknown as Partial<AdminServiceApp>)) router.push('/admin/apps')
  }
</script>
