<template>
  <header
    class="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
  >
    <div class="flex items-center justify-between h-16 px-4 lg:px-6">
      <!-- Left: Mobile menu + Breadcrumb -->
      <div class="flex items-center gap-4">
        <!-- Mobile menu button -->
        <button
          type="button"
          class="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="$emit('toggle-sidebar')"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <!-- Breadcrumb -->
        <nav class="hidden sm:flex items-center gap-2 text-sm">
          <NuxtLink
            to="/admin"
            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Dashboard
          </NuxtLink>
          <template v-for="(crumb, index) in breadcrumbs" :key="index">
            <svg
              class="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
            <NuxtLink
              v-if="crumb.to"
              :to="crumb.to"
              class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {{ crumb.label }}
            </NuxtLink>
            <span v-else class="text-gray-900 dark:text-white font-medium">
              {{ crumb.label }}
            </span>
          </template>
        </nav>
      </div>

      <!-- Right: Actions + User -->
      <div class="flex items-center gap-3">
        <!-- View Site Link -->
        <a
          href="/"
          target="_blank"
          class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          View Site
        </a>

        <!-- User Dropdown -->
        <div ref="userMenuRef" class="relative">
          <button
            type="button"
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="userMenuOpen = !userMenuOpen"
          >
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <span class="text-primary text-sm font-semibold">
                {{ userInitials }}
              </span>
            </div>
            <div class="hidden sm:block text-left">
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ user?.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {{ user?.role }}
              </p>
            </div>
            <svg
              class="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <Transition name="dropdown">
            <div
              v-if="userMenuOpen"
              class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
            >
              <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 sm:hidden">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ user?.name }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ user?.email }}
                </p>
              </div>
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                @click="handleLogout"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
  defineEmits<{
    'toggle-sidebar': []
  }>()

  const route = useRoute()
  const router = useRouter()
  const { user, logout } = useAdminAuth()

  const userMenuOpen = ref(false)
  const userMenuRef = ref<HTMLElement | null>(null)

  // Close menu when clicking outside
  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  function handleClickOutside(event: MouseEvent) {
    if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
      userMenuOpen.value = false
    }
  }

  // User initials
  const userInitials = computed(() => {
    if (!user.value?.name) return '?'
    const names = user.value.name.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase()
    }
    return names[0].substring(0, 2).toUpperCase()
  })

  // Breadcrumbs
  const breadcrumbs = computed(() => {
    const path = route.path
    const parts = path.replace('/admin', '').split('/').filter(Boolean)

    const crumbs: Array<{ label: string; to?: string }> = []

    const labels: Record<string, string> = {
      reports: 'A-G Reports',
      publications: 'Publications',
      news: 'News',
      events: 'Events',
      vacancies: 'Vacancies',
      tenders: 'Tenders',
      departments: 'Departments',
      'team-members': 'Team Members',
      'regional-offices': 'Regional Offices',
      gallery: 'Gallery',
      videos: 'Videos',
      tags: 'Tags',
      users: 'Users',
      'audit-logs': 'Audit Logs',
      newsletter: 'Newsletter',
      'contact-submissions': 'Contact Forms',
      create: 'Create',
      edit: 'Edit'
    }

    let currentPath = '/admin'

    parts.forEach((part, index) => {
      currentPath += `/${part}`
      const isLast = index === parts.length - 1

      // Check if it's an ID (numeric)
      const isId = /^\d+$/.test(part)

      if (isId) {
        // Skip IDs in breadcrumb or show as "Edit"
        return
      }

      crumbs.push({
        label: labels[part] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
        to: isLast ? undefined : currentPath
      })
    })

    return crumbs
  })

  // Handle logout
  async function handleLogout() {
    await logout()
    router.push('/admin/login')
  }
</script>

<style scoped>
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }
</style>
