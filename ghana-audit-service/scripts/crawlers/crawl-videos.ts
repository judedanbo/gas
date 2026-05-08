import { fetchHtml, writeJson, delay } from './utils'
import { join } from 'node:path'
import { mkdirSync, createWriteStream, existsSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const BASE_URL = 'https://audit.gov.gh'
const INDEX_URL = `${BASE_URL}/6/25/videos`
const IMG_DIR = join(process.cwd(), 'public/img/videos')
const OUTPUT_PATH = join(process.cwd(), 'server/database/seeds/data/videos.json')

interface VideoItem {
  url: string
  thumbnail: string | null
  duration: null
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
}

/**
 * Normalise any YouTube URL form to the canonical embed URL.
 * Returns null if the input is not a recognisable YouTube URL.
 */
function toYouTubeEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw)

    // Already an embed URL — strip query params that change behaviour
    if (url.pathname.startsWith('/embed/')) {
      return `https://www.youtube.com${url.pathname}`
    }

    // youtu.be/<id>
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '')
      if (id) return `https://www.youtube.com/embed/${id}`
    }

    // youtube.com/watch?v=<id>
    const vid = url.searchParams.get('v')
    if (vid) return `https://www.youtube.com/embed/${vid}`

    // youtube.com/shorts/<id>  or  youtube.com/v/<id>
    const shortMatch = url.pathname.match(/\/(shorts|v)\/([A-Za-z0-9_-]{11})/)
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[2]}`
  } catch {
    // Not a valid URL
  }
  return null
}

/**
 * Extract the video ID from any YouTube URL form.
 */
function youtubeVideoId(embedUrl: string): string | null {
  const match = embedUrl.match(/\/embed\/([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

/**
 * Generate publishedAt dates working backwards from today using monthly intervals.
 */
function generatePublishedAt(index: number): string {
  const date = new Date('2026-05-08') // today per task spec
  date.setMonth(date.getMonth() - index)
  return date.toISOString().split('T')[0]
}

async function crawlIndex(): Promise<VideoItem[]> {
  const $ = await fetchHtml(INDEX_URL)
  const items: VideoItem[] = []

  // Each video lives in a .items div containing:
  //   - an .embed-responsive div wrapping an <iframe src="youtube…">
  //   - a sibling element with the title text
  // We iterate over all <iframe> tags and look upward for title and outward for thumbnail.
  $('iframe').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || ''
    if (!src.includes('youtube') && !src.includes('youtu.be')) return

    const embedUrl = toYouTubeEmbedUrl(src)
    if (!embedUrl) return

    // Title: look inside the grandparent (.items) for text nodes / sibling text
    const embedContainer = $(el).parent() // .embed-responsive
    const itemContainer = embedContainer.parent() // .items

    // Extract text from the item container excluding nested iframes
    const titleEl = itemContainer.clone()
    titleEl.find('iframe, script, style').remove()
    const rawTitle = titleEl.text().trim()

    // Clean up whitespace; take first non-empty line
    const title =
      rawTitle
        .split(/\n|\r/)
        .map((s) => s.trim())
        .find((s) => s.length > 0) || `Video ${i + 1}`

    const publishedAt = generatePublishedAt(i)

    items.push({
      url: embedUrl,
      thumbnail: null, // filled in after download
      duration: null,
      publishedAt,
      isPublished: true,
      translations: {
        en: {
          title,
          description: null
        }
      }
    })

    console.log(`  [${i + 1}] "${title}" => ${embedUrl}`)
  })

  return items
}

async function main() {
  console.log('=== Crawling Videos ===\n')

  mkdirSync(IMG_DIR, { recursive: true })

  console.log('Fetching index page and extracting embedded videos...')
  const videoItems = await crawlIndex()
  console.log(`\nFound ${videoItems.length} video(s) with YouTube URLs on index page`)

  if (videoItems.length === 0) {
    console.log('No videos found. Writing empty JSON.')
    writeJson(OUTPUT_PATH, [])
    return
  }

  // Download YouTube thumbnails using the standard thumbnail URL pattern.
  // YouTube provides thumbnails at: https://img.youtube.com/vi/<id>/hqdefault.jpg
  // We name each file <videoId>.jpg to avoid collisions (all share the basename "hqdefault.jpg").
  for (let i = 0; i < videoItems.length; i++) {
    const item = videoItems[i]
    const videoId = youtubeVideoId(item.url)

    if (videoId) {
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      const filename = `${videoId}.jpg`
      const destPath = join(IMG_DIR, filename)

      console.log(`\n[${i + 1}/${videoItems.length}] Downloading thumbnail for "${item.translations.en.title}"`)

      try {
        if (existsSync(destPath)) {
          console.log(`  Already exists: ${filename}`)
          item.thumbnail = `/img/videos/${filename}`
        } else {
          const res = await fetch(thumbUrl)
          if (res.ok && res.body) {
            const fileStream = createWriteStream(destPath)
            await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream)
            item.thumbnail = `/img/videos/${filename}`
            console.log(`  Saved: ${item.thumbnail}`)
          } else {
            console.log(`  Warning: could not download thumbnail (HTTP ${res.status})`)
          }
        }
      } catch (err) {
        console.log(`  Warning: download error: ${(err as Error).message}`)
      }

      await delay(500)
    }
  }

  writeJson(OUTPUT_PATH, videoItems)
  console.log(`\n=== Done ===`)
  console.log(`Videos crawled: ${videoItems.length}`)
  console.log(`Output: ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
