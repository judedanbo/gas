import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const LIVE_VIDEO_ID = 'dQw4w9WgXcQ'

function liveHtml({
  title = 'Budget Hearing &amp; Q&#39;s — Day 1',
  withThumbnail = true,
  liveFlag = '"isLiveNow":true'
} = {}): string {
  return `
    <html><head>
      <link rel="canonical" href="https://www.youtube.com/watch?v=${LIVE_VIDEO_ID}">
      <meta property="og:title" content="${title}">
      ${withThumbnail ? `<meta property="og:image" content="https://i.ytimg.com/vi/${LIVE_VIDEO_ID}/maxresdefault_live.jpg">` : ''}
    </head><body><script>var ytInitialPlayerResponse = {"videoDetails":{${liveFlag}}}</script></body></html>
  `
}

const CHANNEL_HTML = `
  <html><head>
    <link rel="canonical" href="https://www.youtube.com/channel/UCe019PXmQjX6QY9dTm2zPyg">
    <meta property="og:title" content="Ghana Audit Service">
  </head><body></body></html>
`

async function loadModule() {
  return await import('../../../../server/utils/liveEvents')
}

describe('liveEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.YOUTUBE_API_KEY
  })

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY
  })

  describe('parseLiveProbeHtml', () => {
    it('extracts the live event from a live watch page', async () => {
      const { parseLiveProbeHtml } = await loadModule()
      const event = parseLiveProbeHtml(liveHtml())

      expect(event).not.toBeNull()
      expect(event?.videoId).toBe(LIVE_VIDEO_ID)
      expect(event?.title).toBe("Budget Hearing & Q's — Day 1")
      expect(event?.thumbnail).toBe(
        `https://i.ytimg.com/vi/${LIVE_VIDEO_ID}/maxresdefault_live.jpg`
      )
      expect(event?.url).toBe(`https://www.youtube.com/embed/${LIVE_VIDEO_ID}`)
      expect(event?.watchUrl).toBe(`https://www.youtube.com/watch?v=${LIVE_VIDEO_ID}`)
    })

    it('accepts the legacy "isLive" flag', async () => {
      const { parseLiveProbeHtml } = await loadModule()
      const event = parseLiveProbeHtml(liveHtml({ liveFlag: '"isLive": true' }))
      expect(event?.videoId).toBe(LIVE_VIDEO_ID)
    })

    it('falls back to a default thumbnail when og:image is absent', async () => {
      const { parseLiveProbeHtml } = await loadModule()
      const event = parseLiveProbeHtml(liveHtml({ withThumbnail: false }))
      expect(event?.thumbnail).toBe(`https://i.ytimg.com/vi/${LIVE_VIDEO_ID}/hqdefault.jpg`)
    })

    it('returns null for the channel page (not live)', async () => {
      const { parseLiveProbeHtml } = await loadModule()
      expect(parseLiveProbeHtml(CHANNEL_HTML)).toBeNull()
    })

    it('returns null when the watch page is not flagged live', async () => {
      const { parseLiveProbeHtml } = await loadModule()
      const html = liveHtml({ liveFlag: '"isLiveNow":false' })
      expect(parseLiveProbeHtml(html)).toBeNull()
    })

    it('returns null for garbage input', async () => {
      const { parseLiveProbeHtml } = await loadModule()
      expect(parseLiveProbeHtml('<not html at all')).toBeNull()
      expect(parseLiveProbeHtml('')).toBeNull()
    })
  })

  describe('getLiveEventStatus', () => {
    it('reports live from the probe without an API key', async () => {
      mockFetch.mockResolvedValueOnce(liveHtml())
      const { getLiveEventStatus } = await loadModule()

      const status = await getLiveEventStatus()

      expect(status.isLive).toBe(true)
      expect(status.events).toHaveLength(1)
      expect(status.events[0].videoId).toBe(LIVE_VIDEO_ID)
      expect(status.checkedAt).toBeTruthy()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('reports not live for the channel page', async () => {
      mockFetch.mockResolvedValueOnce(CHANNEL_HTML)
      const { getLiveEventStatus } = await loadModule()

      const status = await getLiveEventStatus()

      expect(status.isLive).toBe(false)
      expect(status.events).toEqual([])
    })

    it('reports not live when the probe fails and no API key is set', async () => {
      mockFetch.mockRejectedValueOnce(new Error('blocked'))
      const { getLiveEventStatus } = await loadModule()

      const status = await getLiveEventStatus()

      expect(status.isLive).toBe(false)
      expect(status.events).toEqual([])
    })

    it('caches the status across calls', async () => {
      mockFetch.mockResolvedValue(liveHtml())
      const { getLiveEventStatus } = await loadModule()

      const first = await getLiveEventStatus()
      const second = await getLiveEventStatus()

      expect(second).toBe(first)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('enriches via the Data API when a key is set and the probe says live', async () => {
      process.env.YOUTUBE_API_KEY = 'test-key'
      mockFetch.mockResolvedValueOnce(liveHtml()).mockResolvedValueOnce({
        items: [
          {
            id: { videoId: LIVE_VIDEO_ID },
            snippet: {
              title: 'API Title',
              liveBroadcastContent: 'live',
              publishedAt: '2026-07-23T09:00:00Z',
              thumbnails: { high: { url: 'https://i.ytimg.com/api-thumb.jpg' } }
            }
          }
        ]
      })
      const { getLiveEventStatus } = await loadModule()

      const status = await getLiveEventStatus()

      expect(status.isLive).toBe(true)
      expect(status.events[0].title).toBe('API Title')
      expect(status.events[0].thumbnail).toBe('https://i.ytimg.com/api-thumb.jpg')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('falls back to probe data when the API call fails', async () => {
      process.env.YOUTUBE_API_KEY = 'test-key'
      mockFetch.mockResolvedValueOnce(liveHtml()).mockRejectedValueOnce(new Error('quota'))
      const { getLiveEventStatus } = await loadModule()

      const status = await getLiveEventStatus()

      expect(status.isLive).toBe(true)
      expect(status.events[0].videoId).toBe(LIVE_VIDEO_ID)
    })

    it('falls back to the API when the probe fails and a key is set', async () => {
      process.env.YOUTUBE_API_KEY = 'test-key'
      mockFetch.mockRejectedValueOnce(new Error('blocked')).mockResolvedValueOnce({
        items: [
          {
            id: { videoId: LIVE_VIDEO_ID },
            snippet: { title: 'API Only', liveBroadcastContent: 'live' }
          }
        ]
      })
      const { getLiveEventStatus } = await loadModule()

      const status = await getLiveEventStatus()

      expect(status.isLive).toBe(true)
      expect(status.events[0].title).toBe('API Only')
    })
  })
})
