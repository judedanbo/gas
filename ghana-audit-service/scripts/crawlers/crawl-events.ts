import { fetchHtml, downloadImage, slugify, writeJson, delay, resolveUrl } from './utils'
import { join } from 'node:path'

const BASE_URL = 'https://audit.gov.gh'
const INDEX_URL = `${BASE_URL}/6/16/events`
const IMG_DIR = join(process.cwd(), 'public/img/events')
const OUTPUT_PATH = join(process.cwd(), 'server/database/seeds/data/events.json')

interface EventItem {
  slug: string
  startDate: string
  endDate: string | null
  isVirtual: boolean
  registrationUrl: string | null
  thumbnail: string | null
  isPublished: boolean
  translations: {
    en: {
      title: string
      description: string
      location: string | null
    }
  }
}

async function crawlIndex(): Promise<Array<{ url: string; thumbnail: string | null }>> {
  const $ = await fetchHtml(INDEX_URL)
  const items: Array<{ url: string; thumbnail: string | null }> = []

  $('a[href*="/6/16/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href === '/6/16/events' || !href.match(/\/6\/16\/\d+\//)) return

    const fullUrl = resolveUrl(href)
    if (items.some((item) => item.url === fullUrl)) return

    const img = $(el).find('img').first().attr('src') || null
    const thumbnail = img ? resolveUrl(img) : null

    items.push({ url: fullUrl, thumbnail })
  })

  console.log(`Found ${items.length} events on index page`)
  return items
}

/**
 * Parse a date string like "Wednesday, 20th Nov. 2024" or "20th November 2024"
 * or "Friday 16th Aug. 2024" into an ISO date string.
 */
function parseSingleDate(dateText: string): string | null {
  if (!dateText.trim()) return null
  // Strip day-of-week prefix: "Wednesday, " or "Friday "
  let cleaned = dateText.replace(/^\w+,?\s+/, '')
  // Strip ordinal suffixes: "20th" -> "20", "1st" -> "1"
  cleaned = cleaned.replace(/(\d+)(st|nd|rd|th)/gi, '$1')
  // Remove trailing periods from abbreviated months: "Nov." -> "Nov"
  cleaned = cleaned.replace(/(\w)\.(\s)/g, '$1$2')
  cleaned = cleaned.trim()
  try {
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  } catch { /* unparseable date */ }
  return null
}

/**
 * Parse a date range string like:
 *   "Wednesday, 20th Nov. 2024 - Thursday, 21st Nov. 2024"
 *   "Friday 16th Aug. 2024"
 * Returns { startDate, endDate } as ISO date strings.
 */
function parseDateRange(dateText: string): { startDate: string; endDate: string | null } {
  const fallback = new Date().toISOString().split('T')[0]

  if (!dateText.trim()) return { startDate: fallback, endDate: null }

  // Split on em-dash (–) or hyphen surrounded by spaces, or just hyphen between date parts
  // Be careful not to split on hyphens within "Aug." style tokens
  const parts = dateText.split(/\s*[–—]\s*|\s+-\s+(?=[A-Z])/)
  if (parts.length >= 2) {
    const start = parseSingleDate(parts[0])
    const end = parseSingleDate(parts[1])
    return {
      startDate: start || fallback,
      endDate: end !== start ? end : null
    }
  }

  // Single date — also handle "20th Nov. 2024 - 21st Nov. 2024" with simple hyphen
  // Try splitting on " - " pattern where both sides look like dates
  const simpleSplit = dateText.split(/\s*-\s*(?=\w)/)
  if (simpleSplit.length >= 2 && /\d{4}/.test(simpleSplit[0]) && /\d{4}/.test(simpleSplit[1])) {
    const start = parseSingleDate(simpleSplit[0])
    const end = parseSingleDate(simpleSplit[1])
    return {
      startDate: start || fallback,
      endDate: end !== start ? end : null
    }
  }

  const single = parseSingleDate(dateText)
  return { startDate: single || fallback, endDate: null }
}

async function crawlDetail(url: string): Promise<{
  title: string
  description: string
  dateText: string | null
  location: string | null
  thumbnailSrc: string | null
}> {
  const $ = await fetchHtml(url)

  // H2 holds the event title (H1 is for the "Other Events" section heading)
  const rawH2 = $('h2').first().text().trim()
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || ''
  const pageTitle = $('title').text().trim()

  let title = rawH2 || ''
  if (!title && ogTitle) {
    title = ogTitle.replace(/^Ghana Audit Service\s*[-–]\s*/i, '').trim()
  }
  if (!title && pageTitle) {
    title = pageTitle.replace(/^Ghana Audit Service\s*[-–]\s*/i, '').trim()
  }
  if (!title) title = 'Untitled'

  // The date is in "div.date.my-2" (not to be confused with the sidebar .date divs)
  const dateText = $('div.date.my-2').first().text().trim() || null

  // The location is in "div.date.text-muted.mb-3" which appears right after the H2
  const locationText = $('div.date.text-muted').first().text().trim() || null

  // Article content
  const articleEl = $('article').first()
  let description = ''
  if (articleEl.length) {
    articleEl.find('script, style, nav, header, footer').remove()
    description = articleEl.html()?.trim() || ''
  }

  if (!description) {
    const paragraphs: string[] = []
    $('p').each((_, el) => {
      const text = $(el).html()?.trim()
      if (text && text.length > 20) paragraphs.push(`<p>${text}</p>`)
    })
    description = paragraphs.join('\n')
  }

  // Image: sits between the location div and article tag, in the H2 parent container
  const h2Parent = $('h2').first().parent()
  const thumbnailSrc =
    h2Parent.find('img').first().attr('src') ||
    $('article img, main img').first().attr('src') ||
    null

  return { title, description, dateText, location: locationText, thumbnailSrc }
}

async function main() {
  console.log('=== Crawling Events ===\n')

  const indexItems = await crawlIndex()
  const eventsData: EventItem[] = []

  for (let i = 0; i < indexItems.length; i++) {
    const item = indexItems[i]
    console.log(`\n[${i + 1}/${indexItems.length}] ${item.url}`)

    try {
      const detail = await crawlDetail(item.url)

      let thumbnailPath: string | null = null
      const imgSrc = item.thumbnail || detail.thumbnailSrc
      if (imgSrc) {
        const filename = await downloadImage(imgSrc, IMG_DIR)
        if (filename) thumbnailPath = `/img/events/${filename}`
      }

      // Derive slug from URL path last segment for uniqueness
      const urlParts = item.url.split('/').filter(Boolean)
      const urlSlug = slugify(urlParts.pop() || detail.title)
      const slug = urlSlug || slugify(detail.title)

      const { startDate, endDate } = parseDateRange(detail.dateText || '')

      eventsData.push({
        slug,
        startDate,
        endDate,
        isVirtual: false,
        registrationUrl: null,
        thumbnail: thumbnailPath,
        isPublished: true,
        translations: {
          en: {
            title: detail.title,
            description: detail.description,
            location: detail.location
          }
        }
      })

      console.log(`  Done: "${detail.title.slice(0, 60)}"`)
      if (detail.dateText) console.log(`  Date: ${detail.dateText} -> ${startDate}${endDate ? ` to ${endDate}` : ''}`)
      if (detail.location) console.log(`  Location: ${detail.location}`)
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`)
    }

    await delay(500)
  }

  writeJson(OUTPUT_PATH, eventsData)
  console.log(`\n=== Done: ${eventsData.length} events crawled ===`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
