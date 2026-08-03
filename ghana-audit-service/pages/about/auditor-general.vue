<template>
  <div>
    <CommonBreadcrumb :crumbs="breadcrumbs" />

    <!-- Page Header -->
    <section class="page-header">
      <div class="container">
        <h1 class="text-4xl md:text-5xl font-heading font-bold mb-4">
          {{ t('home.agMessage.pageTitle') }}
        </h1>
        <p class="max-w-[600px] mx-auto text-lg text-white/90">
          {{ t('home.agMessage.pageDescription') }}
        </p>
      </div>
    </section>

    <!-- Message -->
    <section class="section">
      <div class="container">
        <div v-if="pending" class="flex items-center justify-center py-12">
          <UiLoadingSpinner />
        </div>

        <div v-else-if="message" class="max-w-4xl mx-auto">
          <!-- Author block -->
          <div class="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 mb-10">
            <UiBaseImage
              v-if="message.photo"
              :src="message.photo"
              :alt="`${message.name}, ${message.title}`"
              fallback-icon="heroicons:user"
              class="w-56 md:w-72 aspect-[4/5] rounded-2xl object-contain bg-gray-100 dark:bg-gray-800 shadow-lg flex-shrink-0"
            />
            <div class="text-center sm:text-left">
              <h2 class="text-2xl md:text-3xl font-heading font-bold text-gray-900 dark:text-white">
                {{ message.name }}
              </h2>
              <p class="text-gray-600 dark:text-gray-400 text-lg mt-1">{{ message.title }}</p>
            </div>
          </div>

          <!-- Full message -->
          <!-- eslint-disable vue/no-v-html -- content sanitized via sanitizeHtml() (DOMPurify) -->
          <div
            class="prose prose-lg dark:prose-invert max-w-none"
            v-html="sanitizeHtml(message.fullMessage)"
          ></div>
          <!-- eslint-enable vue/no-v-html -->
        </div>

        <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
          {{ t('errors.serverErrorDesc') }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { sanitizeHtml } from '~/utils/sanitizeHtml'

  const { t } = useI18n()
  const localePath = useLocalePath()
  const { message, pending } = useAuditorGeneral()

  useHead({
    title: t('home.agMessage.pageTitle')
  })

  useSeoMeta({
    title: `${t('home.agMessage.pageTitle')} - Ghana Audit Service`,
    description: t('home.agMessage.pageDescription'),
    ogTitle: `${t('home.agMessage.pageTitle')} - Ghana Audit Service`,
    ogDescription: t('home.agMessage.pageDescription')
  })

  const breadcrumbs = computed(() => [
    { label: t('common.about'), path: localePath('/about') },
    { label: t('home.agMessage.pageTitle'), path: localePath('/about/auditor-general') }
  ])
</script>
