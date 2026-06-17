import type { Video } from '~/types'
import { logError } from '../utils/logger'

const CHANNEL_ID = 'UCe019PXmQjX6QY9dTm2zPyg'
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`

function extractFromXml(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`)
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`)
  const match = xml.match(regex)
  return match ? match[1] : ''
}

export default defineEventHandler(async (): Promise<Video[]> => {
  try {
    const xml = await $fetch<string>(FEED_URL, { responseType: 'text' })

    const entries = xml.split('<entry>').slice(1)

    return entries.map((entry) => {
      const videoId = extractFromXml(entry, 'yt:videoId')
      const title = extractFromXml(entry, 'title')
      const published = extractFromXml(entry, 'published')
      const description = extractFromXml(entry, 'media:description')
      const thumbnail = extractAttr(entry, 'media:thumbnail', 'url')

      return {
        id: `yt-${videoId}`,
        title,
        description: description || undefined,
        url: `https://www.youtube.com/embed/${videoId}`,
        thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: published ? published.split('T')[0] : '',
        source: 'youtube' as const
      }
    })
  } catch (error) {
    logError('youtube-videos', error)
    return []
  }
})
