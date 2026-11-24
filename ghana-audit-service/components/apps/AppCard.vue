<template>
  <article
    class="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
  >
    <div class="flex items-start gap-4 mb-4">
      <!-- Decorative: the app's name follows. White behind it so any logo shows in dark mode. -->
      <span
        class="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-xl bg-white border border-gray-200 dark:border-gray-600 p-1.5"
      >
        <img
          :src="app.logoUrl"
          alt=""
          width="56"
          height="56"
          loading="lazy"
          class="max-w-full max-h-full object-contain"
        />
      </span>
      <div class="min-w-0">
        <component
          :is="headingTag"
          class="text-xl font-heading font-bold text-gray-900 dark:text-white"
        >
          {{ app.name }}
        </component>
        <p v-if="app.tagline" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ app.tagline }}
        </p>
      </div>
    </div>
    <p class="text-gray-600 dark:text-gray-400 mb-6 flex-1">{{ app.summary }}</p>
    <div class="flex flex-wrap gap-3">
      <NuxtLink
        :to="localePath(app.path)"
        class="btn-outline"
        :aria-label="$t('apps.learnMoreAbout', { name: app.name })"
      >
        {{ $t('apps.learnMore') }}
      </NuxtLink>
      <a
        :href="app.url"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-primary inline-flex items-center gap-2"
      >
        {{ app.launchLabel || $t('apps.open', { name: app.name }) }}
        <span aria-hidden="true">↗</span>
        <span class="sr-only">{{ $t('apps.opensInNewTab') }}</span>
      </a>
    </div>
  </article>
</template>

<script setup lang="ts">
  import type { ServiceAppSummary } from '~/types'

  withDefaults(
    defineProps<{
      app: ServiceAppSummary
      /** Heading level for the app's name, to fit the page outline. */
      headingTag?: 'h2' | 'h3'
    }>(),
    { headingTag: 'h2' }
  )

  const localePath = useLocalePath()
</script>
