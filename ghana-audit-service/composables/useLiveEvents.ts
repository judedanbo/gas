import type { LiveEvent, LiveEventStatus } from '~/types'

const POLL_INTERVAL_MS = 60_000

/**
 * Live-broadcast status for the YouTube channel (/api/live-events).
 *
 * When called from component setup, fetches on mount and re-polls every
 * minute while the tab is visible so LIVE badges/banners appear and clear
 * without a reload.
 */
export function useLiveEvents() {
  const status = ref<LiveEventStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isLive = computed(() => status.value?.isLive ?? false)
  const liveEvents = computed<LiveEvent[]>(() => status.value?.events ?? [])

  async function fetchLiveEvents() {
    loading.value = true
    error.value = null

    try {
      status.value = await $fetch<LiveEventStatus>('/api/live-events')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch live events'
    } finally {
      loading.value = false
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (timer) return
    timer = setInterval(fetchLiveEvents, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopPolling()
    } else {
      fetchLiveEvents()
      startPolling()
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      fetchLiveEvents()
      startPolling()
      document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onUnmounted(() => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  }

  return {
    status,
    isLive,
    liveEvents,
    loading,
    error,
    fetchLiveEvents,
    startPolling,
    stopPolling,
    handleVisibilityChange
  }
}
