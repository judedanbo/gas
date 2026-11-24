<template>
  <AppsAppLanding v-if="app" :app="app" />
</template>

<script setup lang="ts">
  import { APP_SLUG_MAX_LENGTH, APP_SLUG_PATTERN } from '~/utils/serviceApps'

  /**
   * Landing page of an Audit Service app (/citizenseye, /tracker, …), managed at
   * /admin/apps. This route also receives every other single-segment address no
   * page claims, so anything that isn't a published app gets the usual 404 —
   * raised the way Nuxt's router raises its own (non-fatal), so bots probing
   * /wp-login.php and friends don't fill the logs with stack traces.
   */
  const route = useRoute()
  const slug = String(route.params.slug ?? '')
  const couldBeApp = slug.length <= APP_SLUG_MAX_LENGTH && APP_SLUG_PATTERN.test(slug)

  const { data: app, error } = await useServiceApp(slug, { immediate: couldBeApp })

  if (!couldBeApp || error.value?.statusCode === 404) {
    showError(
      createError({
        statusCode: 404,
        statusMessage: `Page not found: ${route.fullPath}`,
        fatal: false,
        data: { path: route.fullPath }
      })
    )
  } else if (error.value) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', fatal: true })
  }

  useSeoMeta({
    title: () => (app.value ? [app.value.name, app.value.tagline].filter(Boolean).join(' - ') : ''),
    description: () => app.value?.summary ?? '',
    ogTitle: () => app.value?.name ?? '',
    ogDescription: () => app.value?.summary ?? ''
  })
</script>
