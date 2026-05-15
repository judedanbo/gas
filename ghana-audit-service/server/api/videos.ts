import type { Video } from '~/types'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformVideos } from '../utils/transformVideos'
import { getLocaleFromRequest } from '../utils/locale'

export default defineEventHandler(async (event): Promise<Video[]> => {
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const dbVideos = await db
    .select()
    .from(schema.videos)
    .where(
      and(
        eq(schema.videos.isPublished, true),
        isNull(schema.videos.deletedAt)
      )
    )
    .orderBy(desc(schema.videos.publishedAt))

  const videoIds = dbVideos.map((v) => v.id)
  const translations =
    videoIds.length > 0
      ? await db
          .select()
          .from(schema.videoTranslations)
          .where(
            sql`${schema.videoTranslations.videoId} IN (${sql.join(videoIds, sql`, `)})`
          )
      : []

  const translationsByVideo = translations.reduce(
    (acc, t) => {
      if (!acc[t.videoId]) acc[t.videoId] = {}
      acc[t.videoId][t.locale] = {
        title: t.title,
        description: t.description
      }
      return acc
    },
    {} as Record<number, Record<string, { title: string; description: string | null }>>
  )

  const videosWithData = dbVideos.map((v) => ({
    ...v,
    translations: translationsByVideo[v.id] || {}
  }))

  return transformVideos(videosWithData, locale)
})
