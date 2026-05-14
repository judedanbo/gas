<template>
  <div>
    <!-- Skip to main content for accessibility -->
    <a href="#main-content" class="skip-link">
      Skip to main content
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
// Global app configuration
useHead({
  htmlAttrs: {
    lang: 'en'
  }
})

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
