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
  // (English at "/", other languages under their code, e.g. "/ak/").
  const localeHead = useLocaleHead({ dir: true, lang: true, seo: true })

  // The build has routes for every catalogue language, but only the ones
  // switched on at /admin/languages are public — advertise just those.
  const { isEnabled } = useSiteLanguages()
  const isPublicLocaleTag = (tag: unknown) =>
    typeof tag !== 'string' || tag === 'x-default' || isEnabled(tag.split(/[-_]/)[0].toLowerCase())

  useHead(
    computed(() => ({
      htmlAttrs: {
        lang: localeHead.value.htmlAttrs?.lang,
        dir: localeHead.value.htmlAttrs?.dir
      },
      link: (localeHead.value.link || []).filter((link) =>
        isPublicLocaleTag((link as { hreflang?: unknown }).hreflang)
      ),
      meta: (localeHead.value.meta || []).filter(
        (meta) => meta.property !== 'og:locale:alternate' || isPublicLocaleTag(meta.content)
      )
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
