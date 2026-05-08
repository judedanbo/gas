import type { Video } from '~/types'

type SupportedLocale = 'en' | 'ak'

interface DbVideo {
  id: number
  url: string
  thumbnail: string | null
  duration: string | null
  publishedAt: Date | string
  isPublished: boolean
}

interface VideoWithTranslations extends DbVideo {
  translations: Record<string, { title: string; description: string | null }>
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

export function transformVideo(
  video: VideoWithTranslations,
  locale: SupportedLocale = 'en'
): Video {
  const translation = video.translations[locale] ||
    video.translations.en || {
      title: 'Untitled Video',
      description: null
    }

  return {
    id: String(video.id),
    title: translation.title,
    description: translation.description || undefined,
    url: video.url,
    thumbnail: video.thumbnail || undefined,
    duration: video.duration || undefined,
    publishedAt: formatDate(video.publishedAt)
  }
}

export function transformVideos(
  videos: VideoWithTranslations[],
  locale: SupportedLocale = 'en'
): Video[] {
  return videos.map((video) => transformVideo(video, locale))
}
