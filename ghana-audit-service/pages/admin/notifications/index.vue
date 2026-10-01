<template>
  <div>
    <!-- Page Header -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Progress and outcomes of uploads, optimizations and other background work.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="unreadCount > 0"
          type="button"
          class="btn btn-ghost px-4 py-2 text-sm"
          @click="store.markAllSeen()"
        >
          Mark all as read
        </button>
        <button
          v-if="finishedCount > 0"
          type="button"
          class="btn btn-ghost px-4 py-2 text-sm"
          :disabled="clearing"
          @click="clearFinished"
        >
          Clear finished
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
      <button
        v-for="option in NOTIFICATION_FILTERS"
        :key="option.value"
        type="button"
        :aria-pressed="filter === option.value"
        :class="[
          'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          filter === option.value
            ? 'bg-primary text-white'
            : 'bg-white text-gray-700 shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        ]"
        @click="setFilter(option.value)"
      >
        {{ option.label }}
        <span
          :class="[
            'rounded-full px-1.5 text-xs tabular-nums',
            filter === option.value
              ? 'bg-white/20'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          ]"
        >
          {{ counts[option.value] }}
        </span>
      </button>
    </div>

    <!-- List -->
    <section
      class="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800"
      :aria-label="`${activeLabel} notifications`"
    >
      <ul v-if="visible.length > 0" class="divide-y divide-gray-200 dark:divide-gray-700">
        <li v-for="item in visible" :key="item.id">
          <AdminUiAdminNotificationItem
            :notification="item"
            :fresh="unreadIds.includes(item.id)"
            :now="now"
            @dismiss="dismiss"
          />
        </li>
      </ul>

      <AdminUiAdminEmptyState
        v-else
        :title="emptyState.title"
        :description="emptyState.description"
      />
    </section>

    <p class="mt-4 text-xs text-gray-600 dark:text-gray-400">
      Report uploads from the last 7 days are listed until dismissed. Uploads and optimizations keep
      running on the server after you leave the page or sign out.
    </p>
  </div>
</template>

<script setup lang="ts">
  import {
    NOTIFICATION_FILTERS,
    filterNotifications,
    type NotificationFilter
  } from '~/utils/adminNotifications'

  definePageMeta({
    layout: 'admin'
  })

  const CLOCK_TICK_MS = 30_000

  const route = useRoute()
  const router = useRouter()
  const store = useAdminNotifications()
  const { notifications, unreadIds, unreadCount } = store

  const clearing = ref(false)
  const now = ref(Date.now())
  let clock: ReturnType<typeof setInterval> | null = null

  function parseFilter(value: unknown): NotificationFilter {
    return NOTIFICATION_FILTERS.some((f) => f.value === value)
      ? (value as NotificationFilter)
      : 'all'
  }

  // Kept in the URL so a filtered view survives reloads and can be linked.
  const filter = computed(() => parseFilter(route.query.filter))

  function setFilter(value: NotificationFilter): void {
    router.replace({ query: { ...route.query, filter: value === 'all' ? undefined : value } })
  }

  const counts = computed(() => {
    const result = {} as Record<NotificationFilter, number>
    for (const option of NOTIFICATION_FILTERS) {
      result[option.value] = filterNotifications(
        notifications.value,
        option.value,
        unreadIds.value
      ).length
    }
    return result
  })

  const visible = computed(() =>
    filterNotifications(notifications.value, filter.value, unreadIds.value)
  )
  const finishedCount = computed(
    () => notifications.value.filter((n) => n.status !== 'running').length
  )
  const activeLabel = computed(
    () => NOTIFICATION_FILTERS.find((f) => f.value === filter.value)?.label ?? 'All'
  )

  const emptyState = computed(() => {
    switch (filter.value) {
      case 'running':
        return {
          title: 'Nothing in progress',
          description: 'No uploads or optimizations are running.'
        }
      case 'unread':
        return { title: 'No unread notifications', description: "You're all caught up." }
      case 'problems':
        return {
          title: 'Nothing needs attention',
          description: 'No recent work failed or finished with warnings.'
        }
      default:
        return {
          title: 'No notifications',
          description:
            'Progress of uploads, optimizations and other long-running actions appears here.'
        }
    }
  })

  async function dismiss(id: string): Promise<void> {
    await store.dismiss(id)
  }

  async function clearFinished(): Promise<void> {
    clearing.value = true
    try {
      await store.clearFinished()
    } finally {
      clearing.value = false
    }
  }

  onMounted(() => {
    clock = setInterval(() => {
      now.value = Date.now()
    }, CLOCK_TICK_MS)
  })

  onBeforeUnmount(() => {
    if (clock) clearInterval(clock)
  })
</script>
