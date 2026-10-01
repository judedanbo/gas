<template>
  <div ref="rootRef" class="relative" @focusout="handleFocusOut">
    <button
      ref="buttonRef"
      type="button"
      class="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      :aria-label="bellLabel"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="PANEL_ID"
      @click="toggle"
      @keydown.esc="open && close(true)"
    >
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <!-- Unread outcomes -->
      <span
        v-if="unreadCount > 0"
        class="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-white dark:ring-gray-800"
        aria-hidden="true"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
      <!-- Work in progress -->
      <span
        v-if="activeCount > 0"
        class="absolute bottom-1.5 right-1.5 flex h-2.5 w-2.5"
        aria-hidden="true"
      >
        <span
          class="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-safe:animate-ping"
        />
        <span
          class="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white dark:ring-gray-800"
        />
      </span>
    </button>

    <Transition name="notification-panel">
      <div
        v-if="open"
        :id="PANEL_ID"
        ref="panelRef"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="TITLE_ID"
        tabindex="-1"
        class="fixed inset-x-2 top-16 z-dropdown flex max-h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-800 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[70vh] sm:w-96"
        @keydown.esc.stop="close(true)"
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <div class="min-w-0">
            <h2 :id="TITLE_ID" class="text-base font-semibold text-gray-900 dark:text-white">
              Notifications
            </h2>
            <p v-if="activeCount > 0" class="text-xs text-gray-600 dark:text-gray-400">
              {{ activeCount }} in progress
            </p>
          </div>
          <button
            v-if="finished.length > 0"
            type="button"
            class="flex-shrink-0 rounded-sm text-sm font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 dark:text-primary-200"
            :disabled="clearing"
            @click="clearAll"
          >
            Clear all
          </button>
        </div>

        <div class="flex-1 overflow-y-auto overscroll-contain">
          <div v-if="notifications.length === 0" class="px-6 py-10 text-center">
            <svg
              class="mx-auto mb-3 h-10 w-10 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p class="text-sm font-medium text-gray-900 dark:text-white">You're all caught up</p>
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Progress of uploads, optimizations and other long-running actions appears here.
            </p>
          </div>

          <template v-else>
            <section v-if="running.length > 0" :aria-labelledby="`${PANEL_ID}-running`">
              <h3
                :id="`${PANEL_ID}-running`"
                class="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-900/40 dark:text-gray-300"
              >
                In progress
              </h3>
              <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                <li v-for="item in running" :key="item.id">
                  <AdminUiAdminNotificationItem
                    :notification="item"
                    :now="now"
                    @navigate="close(false)"
                  />
                </li>
              </ul>
            </section>

            <section v-if="finished.length > 0" :aria-labelledby="`${PANEL_ID}-finished`">
              <h3
                :id="`${PANEL_ID}-finished`"
                class="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-900/40 dark:text-gray-300"
              >
                Recent
              </h3>
              <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                <li v-for="item in finished" :key="item.id">
                  <AdminUiAdminNotificationItem
                    :notification="item"
                    :fresh="freshIds.has(item.id)"
                    :now="now"
                    @dismiss="dismiss"
                    @navigate="close(false)"
                  />
                </li>
              </ul>
            </section>
          </template>
        </div>

        <p
          class="border-t border-gray-200 px-4 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400"
        >
          Uploads and optimizations keep running on the server after you leave the page or sign out.
        </p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import { notificationBellLabel } from '~/utils/adminNotifications'

  const PANEL_ID = 'admin-notifications-panel'
  const TITLE_ID = 'admin-notifications-title'
  /** How often relative timestamps refresh while the panel is open. */
  const CLOCK_TICK_MS = 30_000

  const store = useAdminNotifications()
  const { notifications, activeCount, unreadCount } = store
  const { user } = useAdminAuth()
  const route = useRoute()

  const rootRef = ref<HTMLElement | null>(null)
  const buttonRef = ref<HTMLButtonElement | null>(null)
  const panelRef = ref<HTMLElement | null>(null)

  const open = ref(false)
  const clearing = ref(false)
  // Entries that were unread when the panel opened, highlighted until it closes.
  const freshIds = ref(new Set<string>())
  const now = ref(Date.now())
  let clock: ReturnType<typeof setInterval> | null = null

  const running = computed(() => notifications.value.filter((n) => n.status === 'running'))
  const finished = computed(() => notifications.value.filter((n) => n.status !== 'running'))
  const bellLabel = computed(() => notificationBellLabel(activeCount.value, unreadCount.value))

  function show(): void {
    freshIds.value = new Set(store.openPanel())
    now.value = Date.now()
    clock = setInterval(() => {
      now.value = Date.now()
    }, CLOCK_TICK_MS)
    open.value = true
    // Move focus into the dialog so keyboard and screen-reader users land in it.
    nextTick(() => panelRef.value?.focus())
  }

  function close(returnFocus: boolean): void {
    if (!open.value) return
    open.value = false
    store.closePanel()
    freshIds.value = new Set()
    if (clock) {
      clearInterval(clock)
      clock = null
    }
    if (returnFocus) buttonRef.value?.focus()
  }

  function toggle(): void {
    if (open.value) close(false)
    else show()
  }

  async function dismiss(id: string): Promise<void> {
    // The dismissed row (and the focused button in it) is about to vanish;
    // keep keyboard focus inside the dialog.
    panelRef.value?.focus()
    await store.dismiss(id)
  }

  async function clearAll(): Promise<void> {
    clearing.value = true
    try {
      panelRef.value?.focus()
      await store.clearFinished()
    } finally {
      clearing.value = false
    }
  }

  // Tabbing out of the panel closes it. A null relatedTarget means focus fell
  // to the page (e.g. a dismissed row was removed), which is not leaving it.
  function handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null
    if (open.value && next && rootRef.value && !rootRef.value.contains(next)) close(false)
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (open.value && rootRef.value && !rootRef.value.contains(event.target as Node)) {
      close(false)
    }
  }

  watch(
    () => route.fullPath,
    () => close(false)
  )

  // Another admin signed in on this tab: feed their notifications instead.
  watch(
    () => user.value?.id,
    (id, previous) => {
      if (id === previous) return
      close(false)
      store.stop()
      store.start()
    }
  )

  onMounted(() => {
    store.start()
    document.addEventListener('click', handleDocumentClick)
  })

  onBeforeUnmount(() => {
    close(false)
    store.stop()
    document.removeEventListener('click', handleDocumentClick)
  })
</script>

<style scoped>
  .notification-panel-enter-active,
  .notification-panel-leave-active {
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .notification-panel-enter-from,
  .notification-panel-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }
</style>
