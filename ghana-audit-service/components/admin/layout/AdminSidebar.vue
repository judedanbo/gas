<template>
  <aside
    :class="[
      'fixed top-0 left-0 z-50 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64',
      'hidden lg:block'
    ]"
  >
    <!-- Logo -->
    <div
      class="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700"
    >
      <NuxtLink to="/admin" class="flex items-center gap-2">
        <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">GAS</span>
        </div>
        <span
          v-if="!collapsed"
          class="font-semibold text-gray-900 dark:text-white whitespace-nowrap"
        >
          Admin Panel
        </span>
      </NuxtLink>
      <button
        v-if="!collapsed"
        type="button"
        class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        @click="$emit('toggle')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
          />
        </svg>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
      <!-- Dashboard -->
      <SidebarLink to="/admin" icon="home" label="Dashboard" :collapsed="collapsed" />
      <SidebarLink
        to="/admin/analytics"
        icon="chart-bar"
        label="Analytics"
        :collapsed="collapsed"
      />

      <!-- Content Section -->
      <SidebarSection title="Content" :collapsed="collapsed">
        <SidebarLink
          to="/admin/reports"
          icon="document-report"
          label="A-G Reports"
          :collapsed="collapsed"
        />
        <SidebarLink
          to="/admin/publications"
          icon="document-text"
          label="Publications"
          :collapsed="collapsed"
        />
        <SidebarLink to="/admin/news" icon="newspaper" label="News" :collapsed="collapsed" />
        <SidebarLink to="/admin/events" icon="calendar" label="Events" :collapsed="collapsed" />
      </SidebarSection>

      <!-- Careers Section -->
      <SidebarSection title="Careers" :collapsed="collapsed">
        <SidebarLink
          to="/admin/vacancies"
          icon="briefcase"
          label="Vacancies"
          :collapsed="collapsed"
        />
        <SidebarLink
          to="/admin/tenders"
          icon="document-duplicate"
          label="Tenders"
          :collapsed="collapsed"
        />
      </SidebarSection>

      <!-- Organization Section -->
      <SidebarSection title="Organization" :collapsed="collapsed">
        <SidebarLink
          to="/admin/management-team"
          icon="user-circle"
          label="Management Team"
          :collapsed="collapsed"
        />
        <SidebarLink
          to="/admin/departments"
          icon="office-building"
          label="Departments"
          :collapsed="collapsed"
        />
        <SidebarLink
          to="/admin/team-members"
          icon="users"
          label="Team Members"
          :collapsed="collapsed"
        />
        <SidebarLink
          to="/admin/regional-offices"
          icon="location-marker"
          label="Regional Offices"
          :collapsed="collapsed"
        />
      </SidebarSection>

      <!-- Media Section -->
      <SidebarSection title="Media" :collapsed="collapsed">
        <SidebarLink to="/admin/gallery" icon="photograph" label="Gallery" :collapsed="collapsed" />
        <SidebarLink to="/admin/videos" icon="video-camera" label="Videos" :collapsed="collapsed" />
      </SidebarSection>

      <!-- Settings Section (admin only) -->
      <SidebarSection title="Settings" :collapsed="collapsed">
        <SidebarLink to="/admin/tags" icon="tag" label="Tags" :collapsed="collapsed" />
        <SidebarLink
          v-if="hasPermission('manage_users')"
          to="/admin/users"
          icon="user-group"
          label="Users"
          :collapsed="collapsed"
        />
      </SidebarSection>

      <!-- Activity Section -->
      <SidebarSection title="Activity" :collapsed="collapsed">
        <SidebarLink
          to="/admin/audit-logs"
          icon="clipboard-list"
          label="Audit Logs"
          :collapsed="collapsed"
        />
        <SidebarLink to="/admin/newsletter" icon="mail" label="Newsletter" :collapsed="collapsed" />
        <SidebarLink
          to="/admin/contact-submissions"
          icon="chat-alt-2"
          label="Contact Forms"
          :collapsed="collapsed"
        />
      </SidebarSection>
    </nav>

    <!-- Expand Button (collapsed state) -->
    <button
      v-if="collapsed"
      type="button"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      @click="$emit('toggle')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 5l7 7-7 7M5 5l7 7-7 7"
        />
      </svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
  interface Props {
    collapsed: boolean
  }

  defineProps<Props>()
  defineEmits<{
    toggle: []
  }>()

  const { hasPermission } = useAdminAuth()

  // Sidebar Link Component
  const SidebarLink = defineComponent({
    props: {
      to: { type: String, required: true },
      icon: { type: String, required: true },
      label: { type: String, required: true },
      collapsed: { type: Boolean, default: false }
    },
    setup(props) {
      const route = useRoute()
      const isActive = computed(() => {
        if (props.to === '/admin') {
          return route.path === '/admin'
        }
        return route.path.startsWith(props.to)
      })

      return () =>
        h(
          resolveComponent('NuxtLink'),
          {
            to: props.to,
            class: [
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive.value
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              props.collapsed ? 'justify-center' : ''
            ],
            title: props.collapsed ? props.label : undefined
          },
          () => [h(SidebarIcon, { name: props.icon }), !props.collapsed && h('span', props.label)]
        )
    }
  })

  // Sidebar Section Component
  const SidebarSection = defineComponent({
    props: {
      title: { type: String, required: true },
      collapsed: { type: Boolean, default: false }
    },
    setup(props, { slots }) {
      return () =>
        h('div', { class: 'pt-4' }, [
          !props.collapsed &&
            h(
              'h3',
              {
                class:
                  'px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'
              },
              props.title
            ),
          h('div', { class: 'space-y-1' }, slots.default?.())
        ])
    }
  })

  // Sidebar Icon Component
  const SidebarIcon = defineComponent({
    props: {
      name: { type: String, required: true }
    },
    setup(props) {
      const icons: Record<string, string> = {
        home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        'document-report':
          'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        'document-text':
          'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        newspaper:
          'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
        calendar:
          'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        briefcase:
          'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        'document-duplicate':
          'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2',
        'office-building':
          'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        users:
          'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        'user-circle':
          'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        'location-marker':
          'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
        photograph:
          'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
        'video-camera':
          'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
        tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
        'user-group':
          'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
        'clipboard-list':
          'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        'chat-alt-2':
          'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
        'chart-bar':
          'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
      }

      return () =>
        h(
          'svg',
          {
            class: 'w-5 h-5 flex-shrink-0',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24'
          },
          [
            h('path', {
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
              'stroke-width': '2',
              d: icons[props.name] || icons.home
            })
          ]
        )
    }
  })
</script>
