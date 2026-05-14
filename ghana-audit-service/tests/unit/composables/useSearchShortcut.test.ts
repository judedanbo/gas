import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

const mockState = ref(false)
vi.stubGlobal('useState', vi.fn((_key: string, init: () => boolean) => {
  mockState.value = init()
  return mockState
}))

describe('useSearchShortcut', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockState.value = false
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('should toggle palette open on Ctrl+K', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    expect(isOpen.value).toBe(false)

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    Object.defineProperty(event, 'defaultPrevented', { value: false })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(isOpen.value).toBe(true)
  })

  it('should toggle palette open on Meta+K (Mac)', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(true)
  })

  it('should close palette on Escape when open', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    isOpen.value = true

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
  })

  it('should not toggle when focus is on an input element', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
    document.body.removeChild(input)
  })

  it('should not toggle when focus is on a textarea', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    })
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
    document.body.removeChild(textarea)
  })
})
