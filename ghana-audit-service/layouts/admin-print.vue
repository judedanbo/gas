<template>
  <div class="report-root min-h-screen bg-white text-gray-900">
    <slot />
  </div>
</template>

<script setup lang="ts">
  // Minimal layout for printable admin pages. No sidebar / header / modals.
  // The session-expiry modal and toast container are deliberately omitted so
  // the print and Puppeteer output stay clean.
  import '~/assets/css/print.css'

  // Force light scheme for the report regardless of user color-mode
  // preference (Puppeteer respects the system pref, which surfaces as dark
  // on some hosts).
  if (import.meta.client) {
    const colorMode = useColorMode()
    colorMode.preference = 'light'
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
  }
</script>
