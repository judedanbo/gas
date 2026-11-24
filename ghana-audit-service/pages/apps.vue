<template>
  <div>
    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">{{ $t('apps.title') }}</h1>
        <p class="page-subtitle">{{ $t('apps.subtitle') }}</p>
      </div>
    </div>

    <CommonBreadcrumb :crumbs="[{ label: $t('apps.title'), path: localePath('/apps') }]" />

    <section class="section bg-gray-50 dark:bg-gray-900">
      <div class="container">
        <p class="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto text-center mb-10">
          {{ $t('apps.intro') }}
        </p>

        <p v-if="error" role="alert" class="text-center text-gray-600 dark:text-gray-400 py-12">
          {{ $t('apps.loadError') }}
        </p>
        <p
          v-else-if="!apps || apps.length === 0"
          class="text-center text-gray-600 dark:text-gray-400 py-12"
        >
          {{ $t('apps.empty') }}
        </p>
        <ul v-else class="grid grid-cols-1 md:grid-cols-2 gap-6 list-none p-0 m-0">
          <li v-for="app in apps" :key="app.slug">
            <AppsAppCard :app="app" />
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  const { t } = useI18n()
  const localePath = useLocalePath()

  const { data: apps, error } = await useServiceApps()

  useSeoMeta({
    title: () => t('apps.title'),
    description: () => t('apps.intro')
  })
</script>
