import { vi, beforeEach } from 'vitest'

// Mock $fetch global (used by Nuxt)
vi.stubGlobal('$fetch', vi.fn())

// Mock fetch for API tests
vi.stubGlobal('fetch', vi.fn())

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
