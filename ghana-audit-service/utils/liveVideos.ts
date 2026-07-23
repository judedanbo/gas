import type { LiveEvent, Video } from '~/types'

const YOUTUBE_ID_PATTERN = /(?:embed\/|watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/

/** Extract the 11-char YouTube video id from an embed/watch/short URL. */
export function extractVideoId(url: string): string {
  const match = url.match(YOUTUBE_ID_PATTERN)
  return match ? match[1] : url
}

/** Build a synthetic Video card for a live broadcast not yet in the feed/DB. */
export function videoFromLiveEvent(event: LiveEvent): Video {
  return {
    id: `live-${event.videoId}`,
    title: event.title,
    url: event.url,
    thumbnail: event.thumbnail,
    publishedAt: event.startedAt ?? '',
    isLive: true
  }
}

function publishedTime(video: Video): number {
  const time = new Date(video.publishedAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

/**
 * Mark videos matching a live broadcast as isLive, prepend synthetic cards for
 * live broadcasts missing from the list (RSS feed lag), and sort live videos
 * first, then by publish date descending.
 */
export function applyLiveStatus(videos: Video[], liveEvents: LiveEvent[]): Video[] {
  if (liveEvents.length === 0) return videos

  const liveIds = new Set(liveEvents.map((event) => event.videoId))
  const marked = videos.map((video) =>
    liveIds.has(extractVideoId(video.url)) ? { ...video, isLive: true } : video
  )

  const knownIds = new Set(videos.map((video) => extractVideoId(video.url)))
  const synthetic = liveEvents
    .filter((event) => !knownIds.has(event.videoId))
    .map(videoFromLiveEvent)

  return [...synthetic, ...marked].sort((a, b) => {
    if (Boolean(a.isLive) !== Boolean(b.isLive)) return a.isLive ? -1 : 1
    return publishedTime(b) - publishedTime(a)
  })
}
