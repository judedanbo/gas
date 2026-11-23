import type { SitePopup, SitePopupResponse } from '~/types'

const FOLLOWED_KEY = 'gas:announcement-followed'

// One pop-up per full page load: in-app navigation (and layout remounts) must
// not bring it back. Module scope lives exactly as long as the loaded page.
let handledThisLoad = false

/** Test hook: forget that this page load already handled its pop-up. */
export function resetSiteAnnouncement() {
  handledThisLoad = false
}

function readFollowedId(): string | null {
  try {
    const id = sessionStorage.getItem(FOLLOWED_KEY)
    sessionStorage.removeItem(FOLLOWED_KEY)
    return id
  } catch {
    return null
  }
}

function preloadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

/**
 * The pop-up configured in the admin panel (/admin/popups), shown once per
 * page load for `displaySeconds`.
 *
 * Loaded client-side after mount because public pages are served from a
 * shared page cache, so their SSR output can't depend on the schedule.
 */
export function useSiteAnnouncement() {
  const popup = ref<SitePopup | null>(null)
  const visible = ref(false)
  const remaining = ref(0)

  let timer: ReturnType<typeof setInterval> | null = null

  function stopTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function close() {
    stopTimer()
    visible.value = false
  }

  /** Close early — only honoured when the pop-up was configured as dismissible. */
  function dismiss() {
    if (popup.value?.isDismissible) close()
  }

  /**
   * The visitor clicked through. A same-tab link is a fresh page load, which
   * would put the same pop-up straight back in front of the page they asked
   * for — remember the click so that one load skips it.
   */
  function follow() {
    if (popup.value && !popup.value.openInNewTab) {
      try {
        sessionStorage.setItem(FOLLOWED_KEY, String(popup.value.id))
      } catch {
        // Storage unavailable (private mode): the pop-up just shows again.
      }
    }
    close()
  }

  function tick() {
    // Only time the visitor could actually see it counts.
    if (document.hidden) return
    remaining.value -= 1
    if (remaining.value <= 0) close()
  }

  async function load() {
    if (handledThisLoad) return
    handledThisLoad = true

    const followedId = readFollowedId()

    let next: SitePopup | null
    try {
      next = (await $fetch<SitePopupResponse>('/api/announcement')).popup
    } catch {
      return
    }
    if (!next || String(next.id) === followedId) return

    // Never open an empty frame or start the countdown on a blank box.
    if (!(await preloadImage(next.imageUrl))) return

    popup.value = next
    remaining.value = Math.max(1, Math.round(next.displaySeconds))
    visible.value = true
    timer = setInterval(tick, 1000)
  }

  if (getCurrentInstance()) {
    onMounted(load)
    onUnmounted(stopTimer)
  }

  return { popup, visible, remaining, load, close, dismiss, follow }
}
