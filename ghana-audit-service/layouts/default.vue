<template>
  <div class="layout-default bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-normal">
    <!-- Header Component -->
    <CommonAppHeader />

    <!-- Main Content -->
    <main id="main-content" class="main-content">
      <slot />
    </main>

    <!-- Footer Component -->
    <CommonAppFooter />
  </div>
</template>

<script setup lang="ts">
// Layout configuration
</script>

<style scoped>
.layout-default {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
}
</style>
