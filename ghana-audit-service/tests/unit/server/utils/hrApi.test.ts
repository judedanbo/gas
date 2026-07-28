import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchHrMetrics } from '../../../../server/utils/hrApi'

/**
 * fetchHrMetrics must be a graceful no-op until the HR API is configured:
 * when the base URL or key is missing it returns {} without ever calling
 * $fetch, so callers safely fall back to manual values.
 */
function stubConfig(cfg: { hrApiBaseUrl: string; hrApiKey: string }) {
  vi.stubGlobal('useRuntimeConfig', () => cfg)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchHrMetrics (disabled path)', () => {
  it('returns {} and does not call $fetch when base URL is unset', async () => {
    stubConfig({ hrApiBaseUrl: '', hrApiKey: 'secret' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('$fetch', fetchSpy)

    const result = await fetchHrMetrics()

    expect(result).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns {} and does not call $fetch when API key is unset', async () => {
    stubConfig({ hrApiBaseUrl: 'https://hr.example/api', hrApiKey: '' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('$fetch', fetchSpy)

    const result = await fetchHrMetrics()

    expect(result).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('treats whitespace-only config as unset', async () => {
    stubConfig({ hrApiBaseUrl: '   ', hrApiKey: '   ' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('$fetch', fetchSpy)

    const result = await fetchHrMetrics()

    expect(result).toEqual({})
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('fetchHrMetrics (configured path)', () => {
  it('filters the HR response to finite numeric metrics', async () => {
    stubConfig({ hrApiBaseUrl: 'https://hr.example/api', hrApiKey: 'secret' })
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        staff_total: 2310,
        staff_professional: '1500',
        note: 'ignore me',
        broken: null
      })
    )

    const result = await fetchHrMetrics()

    expect(result).toEqual({ staff_total: 2310, staff_professional: 1500 })
  })

  it('returns {} when the HR request throws', async () => {
    stubConfig({ hrApiBaseUrl: 'https://hr.example/api', hrApiKey: 'secret' })
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await fetchHrMetrics()

    expect(result).toEqual({})
  })
})
