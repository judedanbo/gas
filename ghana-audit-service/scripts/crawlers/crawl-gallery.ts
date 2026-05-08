import { fetchHtml, downloadImage, slugify, writeJson, delay, resolveUrl } from './utils'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const BASE_URL = 'https://audit.gov.gh'
const INDEX_URL = `${BASE_URL}/6/17/photo-gallery`
const IMG_DIR = join(process.cwd(), 'public/img/photos')
const OUTPUT_PATH = join(process.cwd(), 'server/database/seeds/data/gallery.json')

interface GalleryImage {
  url: string
  translations: {
    en: { alt: string; caption: string | null }
  }
}

interface GalleryAlbum {
  slug: string
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
  images: GalleryImage[]
}

async function crawlIndex(): Promise<Array<{ url: string; title: string; thumbnail: string | null }>> {
  const $ = await fetchHtml(INDEX_URL)
  const items: Array<{ url: string; title: string; thumbnail: string | null }> = []

  // Gallery albums follow pattern /6/17/{id}/{slug}
  $('a[href*="/6/17/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href === '/6/17/photo-gallery' || !href.match(/\/6\/17\/\d+\//)) return

    const fullUrl = resolveUrl(href)
    if (items.some((item) => item.url === fullUrl)) return

    // The album title is best found in the img[alt] attribute inside the link
    const imgEl = $(el).find('img').first()
    const imgAlt = imgEl.attr('alt')?.trim() || ''
    const imgSrc = imgEl.attr('src') || null

    // Fallback: derive title from URL slug (last path segment, de-slugified)
    const urlSlug = href.split('/').filter(Boolean).pop() || ''
    const titleFromSlug = urlSlug
      .replace(/-+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    const title = imgAlt || titleFromSlug || 'Untitled Album'

    const thumbnail = imgSrc ? resolveUrl(imgSrc) : null

    items.push({ url: fullUrl, title, thumbnail })
  })

  console.log(`Found ${items.length} gallery albums on index page`)
  return items
}

/**
 * Extract all photo images from an album detail page.
 * Looks for <img> tags with src paths containing photo-relevant paths,
 * and <a> tags linking to full-size images.
 */
async function crawlAlbumDetail(url: string): Promise<{
  title: string
  imageUrls: string[]
}> {
  const $ = await fetchHtml(url)

  // On gallery detail pages, the album title is in <h3> (not h1 or h2).
  // h1 = "Other Photo Albums" (section heading), h2 = sidebar headings.
  // Fall back to og:title / <title> if h3 is absent or uninformative.
  const rawH3 = $('h3').first().text().trim()
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || ''
  const pageTitle = $('title').text().trim()

  // Exclude h3 values that are clearly sidebar/footer elements
  const SIDEBAR_H3 = ['send us a message', 'contact us']
  const isUsableH3 = rawH3 && !SIDEBAR_H3.includes(rawH3.toLowerCase())

  let title = isUsableH3 ? rawH3 : ''
  if (!title && ogTitle) {
    title = ogTitle.replace(/^Ghana Audit Service\s*[-–]\s*/i, '').trim()
  }
  if (!title && pageTitle) {
    title = pageTitle.replace(/^Ghana Audit Service\s*[-–]\s*/i, '').trim()
  }
  if (!title) title = 'Untitled Album'

  const imageUrls = new Set<string>()

  // Collect all <img> src values that look like photos
  $('img').each((_, el) => {
    const src = $(el).attr('src')
    if (!src) return
    // Accept images from /img/photos/ or any image path that isn't nav/logo/icon
    if (
      src.includes('/img/photos/') ||
      src.includes('/img/gallery/') ||
      src.includes('/img/media/')
    ) {
      imageUrls.add(resolveUrl(src))
    }
  })

  // Also collect <a> hrefs that point to image files in photo paths
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    if (
      (href.includes('/img/photos/') ||
        href.includes('/img/gallery/') ||
        href.includes('/img/media/')) &&
      href.match(/\.(jpe?g|png|gif|webp)(\?.*)?$/i)
    ) {
      imageUrls.add(resolveUrl(href))
    }
  })

  // If no photo-specific paths found, try a broader approach:
  // collect all <img> whose src matches common image extensions
  // but exclude tiny icons, logos, and nav images
  if (imageUrls.size === 0) {
    $('img').each((_, el) => {
      const src = $(el).attr('src')
      if (!src) return
      // Skip nav/logo/icon/flag images
      if (
        src.includes('logo') ||
        src.includes('icon') ||
        src.includes('flag') ||
        src.includes('banner') ||
        src.includes('/layout/') ||
        src.includes('/templates/')
      )
        return
      if (src.match(/\.(jpe?g|png|gif|webp)(\?.*)?$/i)) {
        imageUrls.add(resolveUrl(src))
      }
    })
  }

  // Also check data-src (lazy-loaded images)
  $('img[data-src]').each((_, el) => {
    const dataSrc = $(el).attr('data-src')
    if (!dataSrc) return
    if (dataSrc.match(/\.(jpe?g|png|gif|webp)(\?.*)?$/i)) {
      imageUrls.add(resolveUrl(dataSrc))
    }
  })

  // Check <a> tags that wrap images (lightbox pattern)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    if (href.match(/\.(jpe?g|png|gif|webp)(\?.*)?$/i)) {
      imageUrls.add(resolveUrl(href))
    }
  })

  return { title, imageUrls: Array.from(imageUrls) }
}

/**
 * Generate publishedAt dates working backwards from today using monthly intervals.
 * Most recent album = today, next = 1 month ago, etc.
 */
function generatePublishedAt(index: number): string {
  const date = new Date('2026-05-08') // today per task spec
  date.setMonth(date.getMonth() - index)
  return date.toISOString().split('T')[0]
}

async function main() {
  console.log('=== Crawling Photo Gallery Albums ===\n')

  mkdirSync(IMG_DIR, { recursive: true })

  const indexItems = await crawlIndex()
  const galleryData: GalleryAlbum[] = []

  let totalImages = 0

  for (let i = 0; i < indexItems.length; i++) {
    const item = indexItems[i]
    console.log(`\n[${i + 1}/${indexItems.length}] ${item.url}`)

    try {
      const detail = await crawlAlbumDetail(item.url)

      // Derive slug from URL path segments for uniqueness
      const urlParts = item.url.split('/').filter(Boolean)
      const urlSlug = slugify(urlParts.pop() || detail.title)
      const slug = urlSlug || slugify(detail.title)

      const publishedAt = generatePublishedAt(i)

      console.log(`  Title: "${detail.title.slice(0, 70)}"`)
      console.log(`  Found ${detail.imageUrls.length} image(s) on detail page`)

      const images: GalleryImage[] = []

      for (const imgUrl of detail.imageUrls) {
        const filename = await downloadImage(imgUrl, IMG_DIR)
        if (filename) {
          images.push({
            url: `/img/photos/${filename}`,
            translations: {
              en: {
                alt: detail.title,
                caption: null
              }
            }
          })
        }
        await delay(100)
      }

      // If no images were found on the detail page, try the cover thumbnail from the index
      if (images.length === 0 && item.thumbnail) {
        console.log(`  No detail images found, falling back to index thumbnail`)
        const filename = await downloadImage(item.thumbnail, IMG_DIR)
        if (filename) {
          images.push({
            url: `/img/photos/${filename}`,
            translations: {
              en: {
                alt: detail.title,
                caption: null
              }
            }
          })
        }
      }

      totalImages += images.length
      console.log(`  Downloaded ${images.length} image(s) for this album`)

      galleryData.push({
        slug,
        publishedAt,
        isPublished: true,
        translations: {
          en: {
            title: detail.title,
            description: null
          }
        },
        images
      })
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`)
    }

    await delay(500)
  }

  writeJson(OUTPUT_PATH, galleryData)
  console.log(`\n=== Done ===`)
  console.log(`Albums crawled: ${galleryData.length}`)
  console.log(`Total images downloaded: ${totalImages}`)
  console.log(`Output: ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
