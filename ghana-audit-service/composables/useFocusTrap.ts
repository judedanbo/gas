import { isRef, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/**
 * Minimal focus trap for dialogs, drawers and command palettes.
 *
 * While active:
 *  - Tab / Shift+Tab cycle within `container`
 *  - the first focusable element (or `initialFocus()`) receives focus
 * On deactivate:
 *  - focus returns to the element that was focused before activation
 *
 * The container should have `tabindex="-1"` so it can receive focus when it
 * contains nothing focusable.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export interface UseFocusTrapOptions {
  /** Reactive on/off switch. Defaults to `true` (trap for the component's lifetime). */
  active?: Ref<boolean> | boolean
  /** Element to focus on activation. Defaults to the first focusable element, then the container. */
  initialFocus?: () => HTMLElement | null | undefined
  /** Return focus to the previously focused element on deactivate. Default `true`. */
  restoreFocus?: boolean
}

export function isElementVisible(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false
  // `checkVisibility` accounts for display:none / visibility:hidden ancestors.
  // Older engines (and happy-dom in tests) lack it; assume visible there.
  if (typeof el.checkVisibility === 'function') return el.checkVisibility()
  return true
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isElementVisible
  )
}

export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
) {
  const active = isRef(options.active) ? options.active : ref(options.active ?? true)
  const restoreFocus = options.restoreFocus !== false

  let previouslyFocused: HTMLElement | null = null
  let listening = false

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !container.value) return

    const focusable = getFocusableElements(container.value)
    if (focusable.length === 0) {
      event.preventDefault()
      container.value.focus()
      return
    }

    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    const current = document.activeElement as HTMLElement | null
    const inside = current ? container.value.contains(current) : false

    if (event.shiftKey) {
      if (!inside || current === first || current === container.value) {
        event.preventDefault()
        last.focus()
      }
    } else if (!inside || current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function activate() {
    if (typeof document === 'undefined' || listening) return
    previouslyFocused = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKeydown)
    listening = true

    nextTick(() => {
      if (!active.value || !container.value) return
      const target =
        options.initialFocus?.() ?? getFocusableElements(container.value)[0] ?? container.value
      target.focus()
    })
  }

  function deactivate() {
    if (typeof document === 'undefined' || !listening) return
    document.removeEventListener('keydown', onKeydown)
    listening = false

    const target = previouslyFocused
    previouslyFocused = null
    if (restoreFocus && target && typeof target.focus === 'function' && target.isConnected) {
      target.focus()
    }
  }

  watch(active, (isActive) => {
    if (isActive) activate()
    else deactivate()
  })

  onMounted(() => {
    if (active.value) activate()
  })

  onBeforeUnmount(deactivate)

  return { activate, deactivate }
}
