<template>
  <div>
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-gray-600 dark:text-gray-400 mt-1">Welcome back, {{ user?.name }}</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <AdminUiAdminStatsCard
        label="Total Reports"
        :value="stats.reports"
        icon="document"
        icon-color="primary"
        to="/admin/reports"
      />
      <AdminUiAdminStatsCard
        label="Publications"
        :value="stats.publications"
        icon="document"
        icon-color="secondary"
        to="/admin/publications"
      />
      <AdminUiAdminStatsCard
        label="News Articles"
        :value="stats.news"
        icon="document"
        icon-color="accent"
        to="/admin/news"
      />
      <AdminUiAdminStatsCard
        label="Subscribers"
        :value="stats.subscribers"
        icon="mail"
        icon-color="success"
        to="/admin/newsletter"
      />
    </div>

    <!-- Quick Actions + Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quick Actions -->
      <div class="lg:col-span-1">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div class="space-y-2">
            <NuxtLink
              v-for="action in quickActions"
              :key="action.to"
              :to="action.to"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div
                :class="['w-10 h-10 rounded-lg flex items-center justify-center', action.bgClass]"
              >
                <component :is="action.icon" :class="['w-5 h-5', action.iconClass]" />
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ action.label }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ action.description }}
                </p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="lg:col-span-2">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
              <NuxtLink to="/admin/audit-logs" class="text-sm text-primary hover:underline">
                View all
              </NuxtLink>
            </div>
          </div>

          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            <!-- Loading -->
            <div v-if="loadingActivity" class="p-6 text-center">
              <div
                class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"
              />
            </div>

            <!-- Empty -->
            <div
              v-else-if="recentActivity.length === 0"
              class="p-6 text-center text-gray-500 dark:text-gray-400"
            >
              No recent activity
            </div>

            <!-- Activity List -->
            <div
              v-for="activity in recentActivity"
              v-else
              :key="activity.id"
              class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div class="flex items-start gap-3">
                <div
                  :class="[
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    getActionBgClass(activity.action)
                  ]"
                >
                  <component
                    :is="getActionIcon(activity.action)"
                    :class="['w-4 h-4', getActionIconClass(activity.action)]"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900 dark:text-white">
                    <span class="font-medium">{{ activity.user?.name || 'System' }}</span>
                    {{ getActionText(activity.action) }}
                    <span class="font-medium">{{ activity.entityType.replace(/_/g, ' ') }}</span>
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ formatRelativeTime(activity.createdAt) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Overview -->
    <div class="mt-8">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Content Overview</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <NuxtLink
          v-for="item in contentOverview"
          :key="item.to"
          :to="item.to"
          class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow"
        >
          <p class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ item.count }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ item.label }}
          </p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { AuditLogEntry } from '~/types/admin'
  import type { Component } from 'vue'

  definePageMeta({
    layout: 'admin'
  })

  const { user } = useAdminAuth()
  const api = useAdminApi()

  // Stats
  const stats = reactive({
    reports: 0,
    publications: 0,
    news: 0,
    subscribers: 0
  })

  // Content overview
  const contentOverview = ref<Array<{ label: string; count: number; to: string }>>([])

  // Recent activity
  const recentActivity = ref<AuditLogEntry[]>([])
  const loadingActivity = ref(true)

  // Quick actions
  const quickActions = computed(() => [
    {
      to: '/admin/reports/create',
      label: 'New Report',
      description: 'Upload an audit report',
      icon: IconDocument,
      bgClass: 'bg-primary/10',
      iconClass: 'text-primary'
    },
    {
      to: '/admin/news/create',
      label: 'New Article',
      description: 'Create a news article',
      icon: IconNewspaper,
      bgClass: 'bg-accent/10',
      iconClass: 'text-accent'
    },
    {
      to: '/admin/events/create',
      label: 'New Event',
      description: 'Schedule an event',
      icon: IconCalendar,
      bgClass: 'bg-secondary/10',
      iconClass: 'text-secondary'
    },
    {
      to: '/admin/vacancies/create',
      label: 'Post Vacancy',
      description: 'Create a job posting',
      icon: IconBriefcase,
      bgClass: 'bg-green-100 dark:bg-green-900/20',
      iconClass: 'text-green-600'
    }
  ])

  // Fetch dashboard data
  onMounted(async () => {
    await Promise.all([fetchStats(), fetchContentOverview(), fetchRecentActivity()])
  })

  async function fetchStats() {
    try {
      // Fetch counts from API - these endpoints return paginated data
      const [reports, publications, news, newsletter] = await Promise.all([
        api.getList('reports', { perPage: 1 }),
        api.getList('publications', { perPage: 1 }),
        api.getList('news', { perPage: 1 }),
        api.get<{ stats: { total: number } }>('newsletter')
      ])

      stats.reports = reports.meta.total
      stats.publications = publications.meta.total
      stats.news = news.meta.total
      stats.subscribers = newsletter.stats?.total || 0
    } catch {
      // Silent fail - show 0s
    }
  }

  async function fetchContentOverview() {
    try {
      const [events, vacancies, tenders, departments, teamMembers, gallery] = await Promise.all([
        api.getList('events', { perPage: 1 }),
        api.getList('vacancies', { perPage: 1 }),
        api.getList('tenders', { perPage: 1 }),
        api.getList('departments', { perPage: 1 }),
        api.getList('team-members', { perPage: 1 }),
        api.getList('gallery', { perPage: 1 })
      ])

      contentOverview.value = [
        { label: 'Events', count: events.meta.total, to: '/admin/events' },
        { label: 'Vacancies', count: vacancies.meta.total, to: '/admin/vacancies' },
        { label: 'Tenders', count: tenders.meta.total, to: '/admin/tenders' },
        { label: 'Departments', count: departments.meta.total, to: '/admin/departments' },
        { label: 'Team Members', count: teamMembers.meta.total, to: '/admin/team-members' },
        { label: 'Gallery Items', count: gallery.meta.total, to: '/admin/gallery' }
      ]
    } catch {
      // Silent fail
    }
  }

  async function fetchRecentActivity() {
    try {
      const response = await api.getList<AuditLogEntry>('audit-logs', { perPage: 5 })
      recentActivity.value = response.data
    } catch {
      // Silent fail
    } finally {
      loadingActivity.value = false
    }
  }

  // Action helpers
  function getActionText(action: string): string {
    const texts: Record<string, string> = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      login: 'logged in',
      logout: 'logged out'
    }
    return texts[action] || action
  }

  function getActionBgClass(action: string): string {
    const classes: Record<string, string> = {
      create: 'bg-green-100 dark:bg-green-900/20',
      update: 'bg-blue-100 dark:bg-blue-900/20',
      delete: 'bg-red-100 dark:bg-red-900/20',
      login: 'bg-purple-100 dark:bg-purple-900/20',
      logout: 'bg-gray-100 dark:bg-gray-700'
    }
    return classes[action] || 'bg-gray-100 dark:bg-gray-700'
  }

  function getActionIconClass(action: string): string {
    const classes: Record<string, string> = {
      create: 'text-green-600 dark:text-green-400',
      update: 'text-blue-600 dark:text-blue-400',
      delete: 'text-red-600 dark:text-red-400',
      login: 'text-purple-600 dark:text-purple-400',
      logout: 'text-gray-600 dark:text-gray-400'
    }
    return classes[action] || 'text-gray-600'
  }

  function getActionIcon(action: string) {
    const icons: Record<string, Component> = {
      create: IconPlus,
      update: IconPencil,
      delete: IconTrash,
      login: IconLogin,
      logout: IconLogout
    }
    return icons[action] || IconPlus
  }

  function formatRelativeTime(date: string): string {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    return then.toLocaleDateString()
  }

  // Icon components
  const IconDocument = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
        })
      ])
    }
  }

  const IconNewspaper = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
        })
      ])
    }
  }

  const IconCalendar = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
        })
      ])
    }
  }

  const IconBriefcase = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
        })
      ])
    }
  }

  const IconPlus = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M12 4v16m8-8H4'
        })
      ])
    }
  }

  const IconPencil = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
        })
      ])
    }
  }

  const IconTrash = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
        })
      ])
    }
  }

  const IconLogin = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1'
        })
      ])
    }
  }

  const IconLogout = {
    render() {
      return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
        })
      ])
    }
  }
</script>
