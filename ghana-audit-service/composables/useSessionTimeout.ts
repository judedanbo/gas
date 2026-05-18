import type { RefreshResponse } from '~/types/admin'

/**
 * Drives the admin idle/absolute session expiry UX.
 *
 * Singleton module-level state (same pattern as useToast) so the modal and
 * the layout share one set of timers/listeners. Server-side the session is
 * authoritative; this only mirrors its timing to warn and redirect.
 */

const showWarning = ref(false)
const secondsRemaining = ref(0)

let tickTimer: ReturnType<typeof setInterval> | null = null
let lastActivityRefresh = 0
let started = false
let activityHandler: (() => void) | null = null
let storageHandler: ((e: StorageEvent) => void) | null = null

const ACTIVITY_REFRESH_THROTTLE_MS = 60_000
const DEFAULT_WARNING_MS = 120_000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function useSessionTimeout() {
  const { session, token, setSession, clearAuth, logout } = useAdminAuth()
  const router = useRouter()

  function expiryMs(): number | null {
    if (!session.value) return null
    const t = Date.parse(session.value.expiresAt)
    return Number.isFinite(t) ? t : null
  }

  async function expireNow(): Promise<void> {
    stop()
    clearAuth()
    await router.push({ path: '/admin/login', query: { reason: 'expired' } })
  }

  async function refresh(): Promise<boolean> {
    if (!token.value) return false
    try {
      const res = await $fetch<RefreshResponse>('/api/admin/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` }
      })
      setSession(res.session)
      showWarning.value = false
      return true
    } catch {
      await expireNow()
      return false
    }
  }

  function onActivity(): void {
    // While the modal is up we wait for an explicit decision instead of
    // silently extending the session on a stray mouse move.
    if (showWarning.value) return
    const now = Date.now()
    if (now - lastActivityRefresh < ACTIVITY_REFRESH_THROTTLE_MS) return
    lastActivityRefresh = now
    void refresh()
  }

  function tick(): void {
    const expiry = expiryMs()
    if (expiry === null) return

    const remaining = expiry - Date.now()
    if (remaining <= 0) {
      void expireNow()
      return
    }

    const warnMs = session.value?.warningBeforeMs ?? DEFAULT_WARNING_MS
    if (remaining <= warnMs) {
      showWarning.value = true
      secondsRemaining.value = Math.ceil(remaining / 1000)
    } else if (showWarning.value) {
      showWarning.value = false
    }
  }

  function start(): void {
    if (!import.meta.client || started) return
    started = true
    lastActivityRefresh = Date.now()

    tickTimer = setInterval(tick, 1000)

    activityHandler = () => onActivity()
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, activityHandler, { passive: true })
    }

    storageHandler = (e: StorageEvent) => {
      if (e.key === 'admin-token' && e.newValue === null) {
        // Signed out in another tab.
        void expireNow()
      } else if (e.key === 'admin-session' && e.newValue) {
        // Another tab refreshed the session — re-sync the countdown.
        try {
          setSession(JSON.parse(e.newValue))
          showWarning.value = false
        } catch {
          /* ignore malformed payload */
        }
      }
    }
    window.addEventListener('storage', storageHandler)

    tick()
  }

  function stop(): void {
    if (!import.meta.client) return
    started = false

    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    if (activityHandler) {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, activityHandler)
      }
      activityHandler = null
    }
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler)
      storageHandler = null
    }
    showWarning.value = false
  }

  async function stayLoggedIn(): Promise<void> {
    await refresh()
  }

  async function logoutNow(): Promise<void> {
    stop()
    await logout()
    await router.push('/admin/login')
  }

  return {
    showWarning: readonly(showWarning),
    secondsRemaining: readonly(secondsRemaining),
    start,
    stop,
    stayLoggedIn,
    logoutNow
  }
}
