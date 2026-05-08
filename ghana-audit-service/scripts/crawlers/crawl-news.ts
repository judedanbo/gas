import { fetchHtml, downloadImage, slugify, writeJson, delay, resolveUrl } from './utils'
import { join } from 'node:path'

const BASE_URL = 'https://audit.gov.gh'
const INDEX_URL = `${BASE_URL}/6/15/news`
const IMG_DIR = join(process.cwd(), 'public/img/news')
const OUTPUT_PATH = join(process.cwd(), 'server/database/seeds/data/news.json')

interface NewsItem {
  slug: string
  author: string | null
  thumbnail: string | null
  category: string
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; excerpt: string; content: string }
  }
  tags: string[]
}

async function crawlIndex(): Promise<Array<{ url: string; thumbnail: string | null; date: string | null }>> {
  const $ = await fetchHtml(INDEX_URL)
  const items: Array<{ url: string; thumbnail: string | null; date: string | null }> = []

  $('a[href*="/6/15/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href === '/6/15/news' || !href.match(/\/6\/15\/\d+\//)) return

    const fullUrl = resolveUrl(href)
    if (items.some((item) => item.url === fullUrl)) return

    const img = $(el).find('img').attr('src') || $(el).prev('img').attr('src') || null
    const thumbnail = img ? resolveUrl(img) : null

    const parent = $(el).closest('div, article, li')
    const dateText = parent.find('time, .date, [class*="date"]').text().trim() || null

    items.push({ url: fullUrl, thumbnail, date: dateText })
  })

  console.log(`Found ${items.length} news articles on index page`)
  return items
}

function parseDate(dateText: string | null): string {
  if (!dateText) return new Date().toISOString().split('T')[0]
  // Strip ordinal suffixes: "27th March 2026" -> "27 March 2026"
  const cleaned = dateText.replace(/(\d+)(st|nd|rd|th)/gi, '$1')
  try {
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  } catch {}
  try {
    const d = new Date(dateText)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  } catch {}
  return new Date().toISOString().split('T')[0]
}

async function crawlDetail(url: string): Promise<{
  title: string
  content: string
  date: string | null
  thumbnailSrc: string | null
}> {
  const $ = await fetchHtml(url)

  // The site uses h1 for the section heading ("Other News") and h2 for the article title.
  // Fall back to og:title / <title> if h2 is absent.
  const rawH2 = $('h2').first().text().trim()
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || ''
  const pageTitle = $('title').text().trim()

  let title = rawH2 || ''
  if (!title && ogTitle) {
    // Strip "Ghana Audit Service - " prefix if present
    title = ogTitle.replace(/^Ghana Audit Service\s*[-–]\s*/i, '').trim()
  }
  if (!title && pageTitle) {
    title = pageTitle.replace(/^Ghana Audit Service\s*[-–]\s*/i, '').trim()
  }
  if (!title) title = 'Untitled'

  // The first .date on the detail page is the article publication date
  const date = $('.date').first().text().trim() || null

  // Article content is in <article>; the image sits just before it in the h2 container
  const articleEl = $('article').first()
  let content = ''
  if (articleEl.length) {
    articleEl.find('script, style, nav, header, footer').remove()
    content = articleEl.html()?.trim() || ''
  }

  if (!content) {
    const paragraphs: string[] = []
    $('p').each((_, el) => {
      const text = $(el).html()?.trim()
      if (text && text.length > 20) paragraphs.push(`<p>${text}</p>`)
    })
    content = paragraphs.join('\n')
  }

  // Image is in the h2 parent container (sibling of h2, before <article>)
  const h2Parent = $('h2').first().parent()
  const thumbnailSrc =
    h2Parent.find('img').first().attr('src') ||
    $('article img, main img').first().attr('src') ||
    null

  return { title, content, date, thumbnailSrc }
}

function generateExcerpt(content: string): string {
  const text = content.replace(/<[^>]+>/g, '').trim()
  if (text.length <= 200) return text
  return text.slice(0, 200).replace(/\s+\S*$/, '') + '...'
}

async function main() {
  console.log('=== Crawling News Articles ===\n')

  const indexItems = await crawlIndex()
  const newsData: NewsItem[] = []

  for (let i = 0; i < indexItems.length; i++) {
    const item = indexItems[i]
    console.log(`\n[${i + 1}/${indexItems.length}] ${item.url}`)

    try {
      const detail = await crawlDetail(item.url)

      let thumbnailPath: string | null = null
      const imgSrc = item.thumbnail || detail.thumbnailSrc
      if (imgSrc) {
        const filename = await downloadImage(imgSrc, IMG_DIR)
        if (filename) thumbnailPath = `/img/news/${filename}`
      }

      // Derive slug from URL path (last segment) to ensure uniqueness
      const urlSlug = slugify(item.url.split('/').filter(Boolean).pop() || detail.title)
      const slug = urlSlug || slugify(detail.title)
      const publishedAt = parseDate(detail.date || item.date)

      newsData.push({
        slug,
        author: null,
        thumbnail: thumbnailPath,
        category: 'news',
        publishedAt,
        isPublished: true,
        translations: {
          en: {
            title: detail.title,
            excerpt: generateExcerpt(detail.content),
            content: detail.content
          }
        },
        tags: []
      })

      console.log(`  Done: "${detail.title.slice(0, 60)}..."`)
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`)
    }

    await delay(500)
  }

  writeJson(OUTPUT_PATH, newsData)
  console.log(`\n=== Done: ${newsData.length} news articles crawled ===`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
