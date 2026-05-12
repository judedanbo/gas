<template>
  <div>
    <CommonBreadcrumb :crumbs="[{ label: $t('common.advertisement'), path: '/advertisement' }]" />

    <div class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">{{ $t('advertisement.title') }}</h1>
        <p class="page-subtitle">{{ $t('advertisement.subtitle') }}</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <NuxtLink
            v-for="category in categories"
            :key="category.path"
            :to="category.path"
            class="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center transition-all hover:border-primary hover:shadow-lg no-underline"
          >
            <div
              class="w-14 h-14 mx-auto mb-4 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center"
            >
              <Icon
                :name="category.icon"
                class="w-7 h-7 text-primary dark:text-primary-light"
                aria-hidden="true"
              />
            </div>
            <h2
              class="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary dark:group-hover:text-primary-light transition-colors"
            >
              {{ category.title }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {{ category.description }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: `${t('advertisement.title')} | Ghana Audit Service`,
  description: t('advertisement.subtitle'),
})

const categories = computed(() => [
  {
    title: t('advertisement.vacancies'),
    description: t('advertisement.vacanciesDescription'),
    icon: 'heroicons:briefcase',
    path: '/careers',
  },
  {
    title: t('advertisement.tenders'),
    description: t('advertisement.tendersDescription'),
    icon: 'heroicons:pencil-square',
    path: '/careers/tenders',
  },
])
</script>
