<template>
  <div>
    <!-- Skip to main content for accessibility -->
    <a href="#main-content" class="skip-link">
      {{ $t('accessibility.skipToContent') }}
    </a>

    <!-- Route announcer for screen readers -->
    <NuxtRouteAnnouncer />

    <!-- Main layout wrapper -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
  // <html lang/dir>, hreflang alternates and og:locale follow the active locale
  // (English at "/", Akan at "/ak/"). Previously `lang` was hard-coded to "en".
  const localeHead = useLocaleHead({ dir: true, lang: true, seo: true })

  useHead(
    computed(() => ({
      htmlAttrs: {
        lang: localeHead.value.htmlAttrs?.lang,
        dir: localeHead.value.htmlAttrs?.dir
      },
      link: [...(localeHead.value.link || [])],
      meta: [...(localeHead.value.meta || [])]
    }))
  )

  // Initialize accessibility settings on client side
  const { init: initAccessibility } = useAccessibility()
  useSearchShortcut()

  onMounted(() => {
    initAccessibility()
  })
</script>

<style>
  /* App-level styles are in assets/css/main.css */
</style>
