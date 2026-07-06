<template>
  <nav class="hidden lg:flex items-center" role="navigation" aria-label="Main navigation">
    <ul class="flex items-center gap-1 list-none m-0 p-0">
      <li
        v-for="item in navigationItems"
        :key="item.label"
        class="relative"
        @mouseenter="openDropdown(item.label)"
        @mouseleave="closeDropdown"
      >
        <NuxtLink
          v-if="!item.children"
          :to="item.href"
          class="flex items-center gap-1 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 no-underline rounded-md transition-all hover:text-primary dark:hover:text-primary-light hover:bg-gray-50 dark:hover:bg-gray-700"
          :class="{
            'text-primary dark:text-primary-light bg-gray-50 dark:bg-gray-700': isActive(item.href)
          }"
        >
          {{ item.label }}
        </NuxtLink>

        <NuxtLink
          v-else
          :to="item.href"
          class="flex items-center gap-1 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 no-underline rounded-md transition-all hover:text-primary dark:hover:text-primary-light hover:bg-gray-50 dark:hover:bg-gray-700"
          :class="{
            'text-primary dark:text-primary-light bg-gray-50 dark:bg-gray-700':
              isActive(item.href) || isChildActive(item)
          }"
        >
          {{ item.label }}
          <span
            class="text-[10px] transition-transform"
            :class="{ 'rotate-180': activeDropdown === item.label }"
            >▼</span
          >
        </NuxtLink>

        <!-- Dropdown Menu -->
        <Transition name="dropdown">
          <div
            v-if="item.children && activeDropdown === item.label"
            class="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-dropdown"
            @mouseenter="keepDropdownOpen(item.label)"
            @mouseleave="closeDropdown"
          >
            <div
              class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl min-w-[280px] overflow-hidden"
            >
              <ul class="list-none m-0 p-2">
                <li v-for="child in item.children" :key="child.label">
                  <NuxtLink
                    v-if="!child.isExternal"
                    :to="child.href"
                    class="flex items-start gap-3 px-4 py-3 text-gray-900 dark:text-gray-100 no-underline rounded-md transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
                    @click="closeDropdown"
                  >
                    <Icon
                      v-if="child.icon"
                      :name="child.icon"
                      class="w-5 h-5 flex-shrink-0 mt-0.5 text-primary dark:text-primary-light"
                      aria-hidden="true"
                    />
                    <span class="flex flex-col gap-1">
                      <span class="font-medium text-gray-900 dark:text-white">{{
                        child.label
                      }}</span>
                      <span
                        v-if="child.description"
                        class="text-sm text-gray-500 dark:text-gray-400"
                      >
                        {{ child.description }}
                      </span>
                    </span>
                  </NuxtLink>
                  <a
                    v-else
                    :href="child.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-start gap-3 px-4 py-3 text-gray-900 dark:text-gray-100 no-underline rounded-md transition-all hover:bg-gray-50 dark:hover:bg-gray-700"
                    @click="closeDropdown"
                  >
                    <Icon
                      v-if="child.icon"
                      :name="child.icon"
                      class="w-5 h-5 flex-shrink-0 mt-0.5 text-primary dark:text-primary-light"
                      aria-hidden="true"
                    />
                    <span class="flex flex-col gap-1">
                      <span class="font-medium text-gray-900 dark:text-white">{{
                        child.label
                      }}</span>
                      <span class="text-sm text-gray-500 dark:text-gray-400 ml-1">↗</span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </Transition>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
  interface NavChild {
    label: string
    href: string
    icon?: string
    description?: string
    isExternal?: boolean
  }

  interface NavItem {
    label: string
    href: string
    children?: NavChild[]
  }

  const route = useRoute()
  const activeDropdown = ref<string | null>(null)
  let closeTimeout: ReturnType<typeof setTimeout> | null = null

  const navigationItems: NavItem[] = [
    {
      label: 'About Us',
      href: '/about',
      children: [
        {
          label: 'The Service',
          href: '/about/the-service',
          icon: 'heroicons:building-library',
          description: 'Learn about our history and mandate'
        },
        {
          label: 'Past Auditors-General',
          href: '/about/past-auditors-general',
          icon: 'heroicons:user',
          description: 'Our leadership through the years'
        },
        {
          label: 'Management Team',
          href: '/about/management-team',
          icon: 'heroicons:user-group',
          description: 'Current leadership and directors'
        },
        {
          label: 'Board Members',
          href: '/about/board-members',
          icon: 'heroicons:users',
          description: 'Members of the governing board'
        },
        {
          label: 'Departmental Profile',
          href: '/about/departmental-profile',
          icon: 'heroicons:building-office',
          description: 'Our organizational structure'
        }
      ]
    },
    {
      label: "A-G's Reports",
      href: '/reports',
      children: [
        {
          label: 'All Reports',
          href: '/reports',
          icon: 'heroicons:chart-bar',
          description: 'Browse all audit reports'
        },
        {
          label: 'Financial Audits',
          href: '/reports?category=financial',
          icon: 'heroicons:currency-dollar',
          description: 'Government financial statements'
        },
        {
          label: 'Performance Audits',
          href: '/reports?category=performance',
          icon: 'heroicons:chart-bar',
          description: 'Value-for-money assessments'
        },
        {
          label: 'Compliance Audits',
          href: '/reports?category=compliance',
          icon: 'heroicons:check-circle',
          description: 'Regulatory compliance reviews'
        },
        {
          label: 'Special Audits',
          href: '/reports?category=special',
          icon: 'heroicons:magnifying-glass-circle',
          description: 'Special investigations and audit reviews'
        }
      ]
    },
    {
      label: 'Publications',
      href: '/publications',
      children: [
        {
          label: 'Press Statements',
          href: '/publications/press-statements',
          icon: 'heroicons:newspaper',
          description: 'Official announcements'
        },
        {
          label: 'Bulletins',
          href: '/publications/bulletins',
          icon: 'heroicons:document-text',
          description: 'Quarterly publications'
        },
        {
          label: 'Auditing Guidelines',
          href: '/publications/guidelines',
          icon: 'heroicons:clipboard-document-list',
          description: 'Standards and procedures'
        },
        {
          label: 'AMIS Manuals',
          href: '/publications/amis-manuals',
          icon: 'heroicons:document-text',
          description: 'Audit management manuals'
        },
        {
          label: 'PFM Strategy',
          href: '/publications/pfm-strategy',
          icon: 'heroicons:flag',
          description: '2022-2026 strategic plan'
        },
        {
          label: 'Applicable Laws',
          href: '/publications/applicable-laws',
          icon: 'heroicons:scale',
          description: 'Legal framework'
        }
      ]
    },
    {
      label: 'Media Centre',
      href: '/media',
      children: [
        {
          label: 'News',
          href: '/media/news',
          icon: 'heroicons:newspaper',
          description: 'Latest updates and stories'
        },
        {
          label: 'Events',
          href: '/media/events',
          icon: 'heroicons:calendar',
          description: 'Upcoming and past events'
        },
        {
          label: 'Photo Gallery',
          href: '/media/gallery',
          icon: 'heroicons:camera',
          description: 'Visual documentation'
        },
        {
          label: 'Videos',
          href: '/media/videos',
          icon: 'heroicons:video-camera',
          description: 'Video content and interviews'
        }
      ]
    },
    {
      label: 'Advertisement',
      href: '/advertisement',
      children: [
        {
          label: 'Job Vacancies',
          href: '/careers',
          icon: 'heroicons:briefcase',
          description: 'Current openings'
        },
        {
          label: 'Tenders & Procurement',
          href: '/careers/tenders',
          icon: 'heroicons:pencil-square',
          description: 'Procurement opportunities'
        }
      ]
    },
    {
      label: 'Contact',
      href: '/contact'
    }
  ]

  const isActive = (href: string): boolean => {
    return route.path === href
  }

  const isChildActive = (item: NavItem): boolean => {
    if (!item.children) return false
    return item.children.some((child) => route.path.startsWith(child.href.split('?')[0] ?? ''))
  }

  const openDropdown = (label: string) => {
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = null
    }
    activeDropdown.value = label
  }

  const keepDropdownOpen = (label: string) => {
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = null
    }
    activeDropdown.value = label
  }

  const closeDropdown = () => {
    closeTimeout = setTimeout(() => {
      activeDropdown.value = null
    }, 150)
  }
</script>

<style scoped>
  /* Dropdown Animation */
  .dropdown-enter-active,
  .dropdown-leave-active {
    @apply transition-all duration-150;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    @apply opacity-0 -translate-y-2.5;
    transform: translateX(-50%) translateY(-10px);
  }

  .dropdown-enter-to,
  .dropdown-leave-from {
    transform: translateX(-50%) translateY(0);
  }
</style>
