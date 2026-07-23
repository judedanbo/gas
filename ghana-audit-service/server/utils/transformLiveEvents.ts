import type { LiveEvent } from '~/types'

/** Raw item shape returned by the YouTube Data API v3 `search.list` endpoint. */
export interface YouTubeSearchItem {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    publishedAt?: string
    liveBroadcastContent?: string
    thumbnails?: {
      high?: { url?: string }
      medium?: { url?: string }
      default?: { url?: string }
    }
  }
}

export function liveEventFromVideoId(
  videoId: string,
  title: string,
  thumbnail?: string,
  startedAt?: string
): LiveEvent {
  return {
    videoId,
    title: title || 'Live broadcast',
    thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/embed/${videoId}`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    startedAt
  }
}

export function transformLiveEvents(items: YouTubeSearchItem[]): LiveEvent[] {
  const events: LiveEvent[] = []
  for (const item of items) {
    const videoId = item.id?.videoId
    if (!videoId || item.snippet?.liveBroadcastContent !== 'live') continue
    const thumbnails = item.snippet?.thumbnails
    const thumbnail = thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url
    events.push(
      liveEventFromVideoId(videoId, item.snippet?.title ?? '', thumbnail, item.snippet?.publishedAt)
    )
  }
  return events
}
