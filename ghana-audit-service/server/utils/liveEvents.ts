import type { LiveEvent, LiveEventStatus } from '~/types'
import { logError } from './logger'
import {
  liveEventFromVideoId,
  transformLiveEvents,
  type YouTubeSearchItem
} from './transformLiveEvents'

export const YOUTUBE_CHANNEL_ID = 'UCe019PXmQjX6QY9dTm2zPyg'

const LIVE_PROBE_URL = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}/live`
const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'

// Liveness is re-checked at most once per STATUS_TTL_MS via the keyless
// /channel/{id}/live probe. The Data API `search.list` call costs 100 quota
// units (default quota 10k/day), so its result is cached separately for
// API_TTL_MS: with the probe healthy the API is only consulted while a stream
// is actually live (~4 calls/hour), and if the probe breaks entirely the
// API-only fallback stays under quota (96 calls/day = 9,600 units).
const STATUS_TTL_MS = 60_000
const API_TTL_MS = 900_000

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

let statusCache: CacheEntry<LiveEventStatus> | null = null
let apiCache: CacheEntry<LiveEvent[]> | null = null

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function extractMetaContent(html: string, nameOrProperty: string): string {
  const regex = new RegExp(`<meta[^>]*(?:property|name)="${nameOrProperty}"[^>]*content="([^"]*)"`)
  const match = html.match(regex)
  return match ? decodeEntities(match[1]) : ''
}

/**
 * Parse the HTML of youtube.com/channel/{id}/live. When the channel is live
 * the page is the watch page of the broadcast (canonical watch?v= link plus
 * an "isLiveNow":true player flag); otherwise it renders the channel page.
 * Scraping is inherently fragile — any parse failure means "not live".
 */
export function parseLiveProbeHtml(html: string): LiveEvent | null {
  const canonical = html.match(
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/
  )
  if (!canonical) return null

  const isLive = /"isLiveNow"\s*:\s*true/.test(html) || /"isLive"\s*:\s*true/.test(html)
  if (!isLive) return null

  const title = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'title')
  const thumbnail = extractMetaContent(html, 'og:image')
  return liveEventFromVideoId(canonical[1], title, thumbnail || undefined)
}

async function probeLive(): Promise<LiveEvent | null> {
  const html = await $fetch<string>(LIVE_PROBE_URL, {
    responseType: 'text',
    headers: { 'accept-language': 'en' }
  })
  return parseLiveProbeHtml(html)
}

async function fetchLiveViaApi(apiKey: string): Promise<LiveEvent[]> {
  if (apiCache && apiCache.expiresAt > Date.now()) return apiCache.value

  const response = await $fetch<{ items?: YouTubeSearchItem[] }>(SEARCH_URL, {
    query: {
      part: 'snippet',
      channelId: YOUTUBE_CHANNEL_ID,
      eventType: 'live',
      type: 'video',
      key: apiKey
    }
  })
  const events = transformLiveEvents(response.items ?? [])
  apiCache = { value: events, expiresAt: Date.now() + API_TTL_MS }
  return events
}

async function detectLiveEvents(): Promise<LiveEvent[]> {
  const apiKey = process.env.YOUTUBE_API_KEY

  try {
    const probeEvent = await probeLive()
    if (!probeEvent) return []

    // Probe says live — let the Data API confirm/enrich when a key is set,
    // falling back to the probe result if the API call fails.
    if (apiKey) {
      try {
        const apiEvents = await fetchLiveViaApi(apiKey)
        if (apiEvents.length > 0) return apiEvents
      } catch (error) {
        logError('live-events:api', error)
      }
    }
    return [probeEvent]
  } catch (error) {
    logError('live-events:probe', error)
    if (apiKey) {
      try {
        return await fetchLiveViaApi(apiKey)
      } catch (apiError) {
        logError('live-events:api', apiError)
      }
    }
    return []
  }
}

export async function getLiveEventStatus(): Promise<LiveEventStatus> {
  if (statusCache && statusCache.expiresAt > Date.now()) return statusCache.value

  const events = await detectLiveEvents()
  const status: LiveEventStatus = {
    isLive: events.length > 0,
    events,
    checkedAt: new Date().toISOString()
  }
  statusCache = { value: status, expiresAt: Date.now() + STATUS_TTL_MS }
  return status
}
