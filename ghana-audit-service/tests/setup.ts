import { vi, beforeEach } from 'vitest'

// Mock $fetch global (used by Nuxt)
vi.stubGlobal('$fetch', vi.fn())

// Mock fetch for API tests
vi.stubGlobal('fetch', vi.fn())

// happy-dom never loads images, yet reports every <img> as finished with no
// pixels (complete: true, naturalWidth: 0) — what a real browser reports for
// a failed load. UiBaseImage treats that as a load that failed before
// hydration and moves on, so report images as still loading, as a browser
// does right after rendering. Tests that need a finished load stub these.
if (typeof HTMLImageElement !== 'undefined') {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get: () => false
  })
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
