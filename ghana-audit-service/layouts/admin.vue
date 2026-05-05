<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">
    <!-- Sidebar -->
    <AdminLayoutAdminSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />

    <!-- Main Content Area -->
    <div :class="['transition-all duration-300', sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64']">
      <!-- Header -->
      <AdminLayoutAdminHeader @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed" />

      <!-- Page Content -->
      <main class="p-4 lg:p-6">
        <slot />
      </main>
    </div>

    <!-- Mobile Sidebar Overlay -->
    <Transition name="fade">
      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="mobileMenuOpen = false"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
  const sidebarCollapsed = ref(false)
  const mobileMenuOpen = ref(false)

  // Persist sidebar state
  if (import.meta.client) {
    const stored = localStorage.getItem('admin-sidebar-collapsed')
    if (stored !== null) {
      sidebarCollapsed.value = stored === 'true'
    }

    watch(sidebarCollapsed, (value) => {
      localStorage.setItem('admin-sidebar-collapsed', String(value))
    })
  }
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
