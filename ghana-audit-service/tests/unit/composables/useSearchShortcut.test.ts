import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

const mockState = ref(false)
vi.stubGlobal('useState', vi.fn((_key: string, init: () => boolean) => {
  mockState.value = init()
  return mockState
}))

let mountedCb: (() => void) | undefined
let unmountedCb: (() => void) | undefined
vi.stubGlobal('onMounted', vi.fn((cb: () => void) => { mountedCb = cb }))
vi.stubGlobal('onUnmounted', vi.fn((cb: () => void) => { unmountedCb = cb }))

describe('useSearchShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockState.value = false
    mountedCb = undefined
    unmountedCb = undefined
  })

  afterEach(() => {
    unmountedCb?.()
  })

  async function setup() {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const result = useSearchShortcut()
    mountedCb?.()
    return result
  }

  it('should toggle palette open on Ctrl+K', async () => {
    const { isOpen } = await setup()

    expect(isOpen.value).toBe(false)

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(isOpen.value).toBe(true)
  })

  it('should toggle palette open on Meta+K (Mac)', async () => {
    const { isOpen } = await setup()

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(true)
  })

  it('should close palette on Escape when open', async () => {
    const { isOpen } = await setup()

    isOpen.value = true

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
  })

  it('should not toggle when focus is on an input element', async () => {
    const { isOpen } = await setup()

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
    const { isOpen } = await setup()

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

  it('should allow Ctrl+K from within a dialog (toggle close)', async () => {
    const { isOpen } = await setup()
    isOpen.value = true

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    const input = document.createElement('input')
    dialog.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(isOpen.value).toBe(false)
    document.body.removeChild(dialog)
  })

  it('should clean up listener on unmount', async () => {
    const { isOpen } = await setup()

    unmountedCb?.()

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
  })
})
