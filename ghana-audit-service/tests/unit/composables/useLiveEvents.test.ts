import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed } from 'vue'

// Mock Vue/Nuxt globals (auto-imported at runtime)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('getCurrentInstance', () => null)
vi.stubGlobal('onMounted', vi.fn())
vi.stubGlobal('onUnmounted', vi.fn())

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const LIVE_STATUS = {
  isLive: true,
  events: [
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'Live stream',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    }
  ],
  checkedAt: '2026-07-23T10:00:00.000Z'
}

describe('useLiveEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('has a not-live initial state', async () => {
    const { useLiveEvents } = await import('../../../composables/useLiveEvents')
    const { status, isLive, liveEvents, loading, error } = useLiveEvents()

    expect(status.value).toBeNull()
    expect(isLive.value).toBe(false)
    expect(liveEvents.value).toEqual([])
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('fetches live status', async () => {
    mockFetch.mockResolvedValue(LIVE_STATUS)
    const { useLiveEvents } = await import('../../../composables/useLiveEvents')
    const { fetchLiveEvents, status, isLive, liveEvents } = useLiveEvents()

    await fetchLiveEvents()

    expect(mockFetch).toHaveBeenCalledWith('/api/live-events')
    expect(status.value).toEqual(LIVE_STATUS)
    expect(isLive.value).toBe(true)
    expect(liveEvents.value).toHaveLength(1)
  })

  it('records an error and stays not-live on failure', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))
    const { useLiveEvents } = await import('../../../composables/useLiveEvents')
    const { fetchLiveEvents, error, isLive, loading } = useLiveEvents()

    await fetchLiveEvents()

    expect(error.value).toBe('network down')
    expect(isLive.value).toBe(false)
    expect(loading.value).toBe(false)
  })

  it('polls every minute while started and stops cleanly', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(LIVE_STATUS)
    const { useLiveEvents } = await import('../../../composables/useLiveEvents')
    const { startPolling, stopPolling } = useLiveEvents()

    startPolling()
    expect(mockFetch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    stopPolling()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not double-start polling', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(LIVE_STATUS)
    const { useLiveEvents } = await import('../../../composables/useLiveEvents')
    const { startPolling, stopPolling } = useLiveEvents()

    startPolling()
    startPolling()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    stopPolling()
  })

  it('pauses polling while the document is hidden and resumes with a fresh fetch', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(LIVE_STATUS)
    const { useLiveEvents } = await import('../../../composables/useLiveEvents')
    const { startPolling, stopPolling, handleVisibilityChange } = useLiveEvents()

    startPolling()

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    handleVisibilityChange()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(mockFetch).not.toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    handleVisibilityChange()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    stopPolling()
  })
})
