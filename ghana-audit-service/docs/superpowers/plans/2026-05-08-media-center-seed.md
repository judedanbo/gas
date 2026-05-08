# Media Center Data Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crawl all Media Center content (News, Events, Photo Gallery, Videos) from audit.gov.gh into static JSON + downloaded images, then seed into the MySQL database via Drizzle ORM.

**Architecture:** Two-phase pipeline — Phase 1: four crawler scripts using cheerio that fetch from the live site, extract content, download images, and write JSON. Phase 2: four seed scripts that read the JSON files and insert into MySQL using the existing drizzle/mysql2 seed pattern. A schema migration adds gallery albums support.

**Tech Stack:** cheerio (HTML parsing), tsx (script runner), drizzle-orm + mysql2 (DB), node:fs/node:path (file I/O), existing Nuxt 3 project infrastructure.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/database/schema/media.ts` | Modify | Add `galleryAlbums`, `galleryAlbumTranslations` tables; add `albumId` FK to `galleryImages` |
| `scripts/crawlers/utils.ts` | Create | Shared crawler helpers: fetch HTML, parse with cheerio, download image, slugify |
| `scripts/crawlers/crawl-news.ts` | Create | Crawl news index + detail pages → `seeds/data/news.json` + `public/img/news/` |
| `scripts/crawlers/crawl-events.ts` | Create | Crawl events index + detail pages → `seeds/data/events.json` + `public/img/events/` |
| `scripts/crawlers/crawl-gallery.ts` | Create | Crawl gallery index + detail pages → `seeds/data/gallery.json` + `public/img/photos/` |
| `scripts/crawlers/crawl-videos.ts` | Create | Crawl videos index + detail pages → `seeds/data/videos.json` + `public/img/videos/` |
| `server/database/seeds/news.ts` | Create | Read `data/news.json`, insert into `newsArticles` + `newsArticleTranslations` |
| `server/database/seeds/events.ts` | Create | Read `data/events.json`, insert into `events` + `eventTranslations` |
| `server/database/seeds/gallery.ts` | Create | Read `data/gallery.json`, insert into `galleryAlbums` + translations + `galleryImages` + translations |
| `server/database/seeds/videos.ts` | Create | Read `data/videos.json`, insert into `videos` + `videoTranslations` |
| `package.json` | Modify | Add crawl:* and db:seed:* npm scripts |

---

### Task 1: Install cheerio

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install cheerio as a devDependency**

```bash
cd /home/jude/code/gas/ghana-audit-service && npm install --save-dev cheerio
```

- [ ] **Step 2: Verify installation**

```bash
cd /home/jude/code/gas/ghana-audit-service && node -e "const c = require('cheerio'); console.log('cheerio OK')"
```

Expected: `cheerio OK`

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add package.json package-lock.json && git commit -m "chore: add cheerio for web crawling"
```

---

### Task 2: Add galleryAlbums schema

**Files:**
- Modify: `server/database/schema/media.ts`

- [ ] **Step 1: Add galleryAlbums and galleryAlbumTranslations tables, and albumId FK on galleryImages**

In `server/database/schema/media.ts`, add the two new tables after the existing imports and before the `galleryImages` table. Also add an `albumId` column to `galleryImages`.

The new tables follow the exact same pattern as the existing schema (news, events, etc.): a main table with timestamps/soft-delete and a translations table with `(entityId, locale)` unique index.

```typescript
// Add these two tables BEFORE the existing galleryImages definition:

export const galleryAlbums = mysqlTable(
  'gallery_albums',
  {
    id: int('id').primaryKey().autoincrement(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    coverImageId: int('cover_image_id'),
    publishedAt: datetime('published_at').notNull(),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: datetime('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: datetime('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
    createdBy: int('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: datetime('deleted_at')
  },
  (table) => [
    index('idx_albums_published').on(table.publishedAt),
    index('idx_albums_is_published').on(table.isPublished)
  ]
)

export const galleryAlbumTranslations = mysqlTable(
  'gallery_album_translations',
  {
    id: int('id').primaryKey().autoincrement(),
    albumId: int('album_id')
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: 'cascade' }),
    locale: mysqlEnum('locale', ['en', 'ak']).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description')
  },
  (table) => [
    uniqueIndex('idx_album_locale').on(table.albumId, table.locale),
    index('idx_album_translations_locale').on(table.locale)
  ]
)
```

Then modify the existing `galleryImages` table to add an `albumId` column:

```typescript
// Inside the galleryImages column definition, add after `category`:
albumId: int('album_id').references(() => galleryAlbums.id, { onDelete: 'cascade' }),
```

And add an index for `albumId` in the galleryImages index function:

```typescript
// Add to the galleryImages index array:
index('idx_gallery_album').on(table.albumId),
```

Finally, add type exports at the bottom of the file:

```typescript
export type GalleryAlbum = typeof galleryAlbums.$inferSelect
export type NewGalleryAlbum = typeof galleryAlbums.$inferInsert
export type GalleryAlbumTranslation = typeof galleryAlbumTranslations.$inferSelect
export type NewGalleryAlbumTranslation = typeof galleryAlbumTranslations.$inferInsert
```

Note: `coverImageId` does NOT use a `.references()` call to avoid a circular FK constraint at the Drizzle level. The logical relationship is enforced in application code (the seed sets it after images are inserted).

- [ ] **Step 2: Push schema to database**

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run db:migrate
```

Expected: Drizzle pushes the new tables and column to MySQL. Verify with:

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run db:studio
```

Check that `gallery_albums`, `gallery_album_translations` tables exist, and `gallery_images` has the `album_id` column.

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add server/database/schema/media.ts && git commit -m "feat(schema): add gallery albums table with translations and albumId FK on images"
```

---

### Task 3: Create shared crawler utilities

**Files:**
- Create: `scripts/crawlers/utils.ts`

- [ ] **Step 1: Create the crawler utilities file**

Create `scripts/crawlers/utils.ts` with these helpers:

```typescript
import * as cheerio from 'cheerio'
import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const BASE_URL = 'https://audit.gov.gh'

export function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path
  // Handle relative paths like ../../img/photos/foo.jpg
  const cleaned = path.replace(/^(\.\.\/)+/, '/')
  return `${BASE_URL}${cleaned}`
}

export async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  console.log(`  Fetching: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  return cheerio.load(html)
}

export async function downloadImage(
  imageUrl: string,
  destDir: string
): Promise<string | null> {
  try {
    const resolved = resolveUrl(imageUrl)
    const filename = sanitizeFilename(basename(new URL(resolved).pathname))
    const destPath = join(destDir, filename)

    if (existsSync(destPath)) {
      return filename
    }

    mkdirSync(destDir, { recursive: true })

    const res = await fetch(resolved)
    if (!res.ok || !res.body) {
      console.warn(`  ⚠ Failed to download: ${resolved} (${res.status})`)
      return null
    }

    const fileStream = createWriteStream(destPath)
    await pipeline(Readable.fromWeb(res.body as any), fileStream)
    return filename
  } catch (err) {
    console.warn(`  ⚠ Download error for ${imageUrl}: ${(err as Error).message}`)
    return null
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

export function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`✓ Wrote ${filePath}`)
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx --eval "import './scripts/crawlers/utils.ts'; console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add scripts/crawlers/utils.ts && git commit -m "feat(crawlers): add shared crawler utilities"
```

---

### Task 4: Create news crawler

**Files:**
- Create: `scripts/crawlers/crawl-news.ts`

- [ ] **Step 1: Create the news crawler script**

This script:
1. Fetches `https://audit.gov.gh/6/15/news` to get all article links
2. Visits each article detail page to extract full content
3. Downloads thumbnail images to `public/img/news/`
4. Writes `server/database/seeds/data/news.json`

```typescript
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

  // Each news item is a link containing a thumbnail and title
  // Look for article links with the pattern /6/15/{id}/{slug}
  $('a[href*="/6/15/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href === '/6/15/news' || !href.match(/\/6\/15\/\d+\//)) return

    const fullUrl = resolveUrl(href)

    // Check if we already have this URL
    if (items.some((item) => item.url === fullUrl)) return

    // Try to find thumbnail image near this link
    const img = $(el).find('img').attr('src') || $(el).prev('img').attr('src') || null
    const thumbnail = img ? resolveUrl(img) : null

    // Try to find date text near this link
    const parent = $(el).closest('div, article, li')
    const dateText = parent.find('time, .date, [class*="date"]').text().trim() || null

    items.push({ url: fullUrl, thumbnail, date: dateText })
  })

  console.log(`Found ${items.length} news articles on index page`)
  return items
}

function parseDate(dateText: string | null): string {
  if (!dateText) return new Date().toISOString().split('T')[0]
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

  // Extract title — typically the main heading
  const title =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    'Untitled'

  // Extract publication date — look for date patterns in the page
  const dateEl = $('time, .date, [class*="date"], [class*="publish"]').first()
  let date = dateEl.attr('datetime') || dateEl.text().trim() || null

  // Extract main content — look for article body
  let content = ''
  const contentSelectors = [
    'article .content',
    '.article-content',
    '.post-content',
    '.entry-content',
    'article',
    '.content',
    'main'
  ]
  for (const selector of contentSelectors) {
    const el = $(selector)
    if (el.length && el.html()?.trim()) {
      // Remove script and style tags
      el.find('script, style, nav, header, footer').remove()
      content = el.html()?.trim() || ''
      break
    }
  }

  // If no content found, grab all paragraphs
  if (!content) {
    const paragraphs: string[] = []
    $('p').each((_, el) => {
      const text = $(el).html()?.trim()
      if (text && text.length > 20) paragraphs.push(`<p>${text}</p>`)
    })
    content = paragraphs.join('\n')
  }

  // Extract first image as thumbnail if available
  const thumbnailSrc = $('article img, .content img, main img').first().attr('src') || null

  return { title, content, date, thumbnailSrc }
}

function generateExcerpt(content: string): string {
  // Strip HTML tags, take first 200 characters
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

      // Download thumbnail
      let thumbnailPath: string | null = null
      const imgSrc = item.thumbnail || detail.thumbnailSrc
      if (imgSrc) {
        const filename = await downloadImage(imgSrc, IMG_DIR)
        if (filename) thumbnailPath = `/img/news/${filename}`
      }

      const slug = slugify(detail.title)
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

      console.log(`  ✓ "${detail.title.slice(0, 60)}..."`)
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`)
    }

    // Be polite to the server
    await delay(500)
  }

  writeJson(OUTPUT_PATH, newsData)
  console.log(`\n=== Done: ${newsData.length} news articles crawled ===`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the crawler**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx scripts/crawlers/crawl-news.ts
```

Expected: Crawls all ~80 articles, downloads thumbnails to `public/img/news/`, writes `server/database/seeds/data/news.json`. Verify:

```bash
cd /home/jude/code/gas/ghana-audit-service && ls public/img/news/ | head -5
cd /home/jude/code/gas/ghana-audit-service && node -e "const d = require('./server/database/seeds/data/news.json'); console.log(d.length + ' articles')"
```

- [ ] **Step 3: Review the JSON output**

Open `server/database/seeds/data/news.json` and spot-check:
- Slugs are reasonable (lowercase, hyphens, no special chars)
- Dates parse correctly
- Content has actual HTML body text (not just navigation chrome)
- Thumbnail paths point to downloaded files

Fix any crawler parsing issues before committing.

- [ ] **Step 4: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add scripts/crawlers/crawl-news.ts server/database/seeds/data/news.json public/img/news/ && git commit -m "feat(crawlers): crawl news articles from audit.gov.gh"
```

---

### Task 5: Create events crawler

**Files:**
- Create: `scripts/crawlers/crawl-events.ts`

- [ ] **Step 1: Create the events crawler script**

```typescript
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
    en: { title: string; description: string; location: string | null }
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

    const img = $(el).find('img').attr('src') || null
    const thumbnail = img ? resolveUrl(img) : null

    items.push({ url: fullUrl, thumbnail })
  })

  console.log(`Found ${items.length} events on index page`)
  return items
}

function parseDateRange(text: string): { startDate: string; endDate: string | null } {
  // Handle patterns like "Wednesday, 20th November 2024 – Thursday, 21st November 2024"
  // or "16 Aug 2024"
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)/g, '$1').trim()

  // Try to find two dates separated by – or -
  const parts = cleaned.split(/\s*[–-]\s*/)

  const tryParse = (s: string): string | null => {
    try {
      // Remove day-of-week prefixes
      const noDow = s.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*/i, '')
      const d = new Date(noDow)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    } catch {}
    return null
  }

  const startDate = tryParse(parts[0]) || new Date().toISOString().split('T')[0]
  const endDate = parts.length > 1 ? tryParse(parts[1]) : null

  return { startDate, endDate }
}

async function crawlDetail(url: string): Promise<{
  title: string
  description: string
  dateText: string | null
  location: string | null
  thumbnailSrc: string | null
}> {
  const $ = await fetchHtml(url)

  const title =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    'Untitled'

  // Extract date text
  const dateEl = $('time, .date, [class*="date"]').first()
  const dateText = dateEl.attr('datetime') || dateEl.text().trim() || null

  // Extract location — often appears near the date or in a specific element
  let location: string | null = null
  $('p, span, div').each((_, el) => {
    const text = $(el).text().trim()
    // Look for location-like text (contains city names or venue keywords)
    if (
      !location &&
      text.length < 200 &&
      (text.includes('Accra') ||
        text.includes('Hotel') ||
        text.includes('Centre') ||
        text.includes('Center') ||
        text.includes('House') ||
        text.includes('Hall'))
    ) {
      location = text
    }
  })

  // Extract main content
  let description = ''
  const contentSelectors = ['article .content', '.article-content', '.post-content', 'article', '.content', 'main']
  for (const selector of contentSelectors) {
    const el = $(selector)
    if (el.length && el.html()?.trim()) {
      el.find('script, style, nav, header, footer').remove()
      description = el.html()?.trim() || ''
      break
    }
  }

  if (!description) {
    const paragraphs: string[] = []
    $('p').each((_, el) => {
      const text = $(el).html()?.trim()
      if (text && text.length > 20) paragraphs.push(`<p>${text}</p>`)
    })
    description = paragraphs.join('\n')
  }

  const thumbnailSrc = $('article img, .content img, main img').first().attr('src') || null

  return { title, description, dateText, location, thumbnailSrc }
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

      const slug = slugify(detail.title)
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

      console.log(`  ✓ "${detail.title.slice(0, 60)}..."`)
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`)
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
```

- [ ] **Step 2: Run the crawler**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx scripts/crawlers/crawl-events.ts
```

Expected: Crawls ~30 events. Verify:

```bash
cd /home/jude/code/gas/ghana-audit-service && node -e "const d = require('./server/database/seeds/data/events.json'); console.log(d.length + ' events')"
```

- [ ] **Step 3: Review and commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add scripts/crawlers/crawl-events.ts server/database/seeds/data/events.json public/img/events/ && git commit -m "feat(crawlers): crawl events from audit.gov.gh"
```

---

### Task 6: Create gallery crawler

**Files:**
- Create: `scripts/crawlers/crawl-gallery.ts`

- [ ] **Step 1: Create the gallery crawler script**

This is the most complex crawler — it needs to crawl the index for album links, then visit each album detail page to get all individual images.

```typescript
import { fetchHtml, downloadImage, slugify, writeJson, delay, resolveUrl } from './utils'
import { join } from 'node:path'

const BASE_URL = 'https://audit.gov.gh'
const INDEX_URL = `${BASE_URL}/6/17/photo-gallery`
const IMG_DIR = join(process.cwd(), 'public/img/photos')
const OUTPUT_PATH = join(process.cwd(), 'server/database/seeds/data/gallery.json')

interface GalleryAlbumItem {
  slug: string
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
  images: Array<{
    url: string
    translations: {
      en: { alt: string; caption: string | null }
    }
  }>
}

async function crawlIndex(): Promise<Array<{ url: string; title: string; thumbnail: string | null }>> {
  const $ = await fetchHtml(INDEX_URL)
  const items: Array<{ url: string; title: string; thumbnail: string | null }> = []

  $('a[href*="/6/17/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href === '/6/17/photo-gallery' || !href.match(/\/6\/17\/\d+\//)) return

    const fullUrl = resolveUrl(href)
    if (items.some((item) => item.url === fullUrl)) return

    const img = $(el).find('img').attr('src') || null
    const thumbnail = img ? resolveUrl(img) : null

    // Get the title from the link text or nearby heading
    const title =
      $(el).text().trim() ||
      $(el).find('img').attr('alt')?.trim() ||
      $(el).attr('title')?.trim() ||
      'Untitled Album'

    items.push({ url: fullUrl, title, thumbnail })
  })

  console.log(`Found ${items.length} gallery albums on index page`)
  return items
}

async function crawlAlbumDetail(url: string, fallbackTitle: string): Promise<{
  title: string
  images: string[]
}> {
  const $ = await fetchHtml(url)

  const title =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    fallbackTitle

  // Collect all image URLs from the gallery detail page
  const images: string[] = []
  $('img').each((_, el) => {
    const src = $(el).attr('src')
    if (!src) return
    // Filter to only gallery images (in /img/photos/ path or similar)
    if (src.includes('/img/photos/') || src.includes('/img/gallery/') || src.includes('photo')) {
      const resolved = resolveUrl(src)
      if (!images.includes(resolved)) {
        images.push(resolved)
      }
    }
  })

  // Also check for links to full-size images
  $('a[href*="/img/photos/"], a[href*="/img/gallery/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      const resolved = resolveUrl(href)
      if (!images.includes(resolved)) {
        images.push(resolved)
      }
    }
  })

  return { title, images }
}

async function main() {
  console.log('=== Crawling Photo Gallery ===\n')

  const indexItems = await crawlIndex()
  const galleryData: GalleryAlbumItem[] = []

  // Generate publishedAt dates working backwards from now (monthly intervals)
  // since the live site doesn't show dates for gallery items
  const now = new Date()

  for (let i = 0; i < indexItems.length; i++) {
    const item = indexItems[i]
    console.log(`\n[${i + 1}/${indexItems.length}] ${item.url}`)

    try {
      const detail = await crawlAlbumDetail(item.url, item.title)

      // Download all images
      const imageEntries: GalleryAlbumItem['images'] = []
      for (const imgUrl of detail.images) {
        const filename = await downloadImage(imgUrl, IMG_DIR)
        if (filename) {
          imageEntries.push({
            url: `/img/photos/${filename}`,
            translations: {
              en: { alt: detail.title, caption: null }
            }
          })
        }
      }

      // If no images from detail page, try the index thumbnail
      if (imageEntries.length === 0 && item.thumbnail) {
        const filename = await downloadImage(item.thumbnail, IMG_DIR)
        if (filename) {
          imageEntries.push({
            url: `/img/photos/${filename}`,
            translations: {
              en: { alt: detail.title, caption: null }
            }
          })
        }
      }

      const slug = slugify(detail.title)
      // Spread albums one month apart, most recent first
      const publishedAt = new Date(now)
      publishedAt.setMonth(publishedAt.getMonth() - i)
      const dateStr = publishedAt.toISOString().split('T')[0]

      galleryData.push({
        slug,
        publishedAt: dateStr,
        isPublished: true,
        translations: {
          en: { title: detail.title, description: null }
        },
        images: imageEntries
      })

      console.log(`  ✓ "${detail.title.slice(0, 50)}" — ${imageEntries.length} images`)
    } catch (err) {
      console.error(`  ✗ Failed: ${(err as Error).message}`)
    }

    await delay(500)
  }

  writeJson(OUTPUT_PATH, galleryData)
  console.log(`\n=== Done: ${galleryData.length} albums, ${galleryData.reduce((sum, a) => sum + a.images.length, 0)} total images ===`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the crawler**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx scripts/crawlers/crawl-gallery.ts
```

Expected: Crawls 21 albums + all images inside. Verify:

```bash
cd /home/jude/code/gas/ghana-audit-service && node -e "const d = require('./server/database/seeds/data/gallery.json'); console.log(d.length + ' albums, ' + d.reduce((s,a) => s + a.images.length, 0) + ' images')"
cd /home/jude/code/gas/ghana-audit-service && ls public/img/photos/ | wc -l
```

- [ ] **Step 3: Review and commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add scripts/crawlers/crawl-gallery.ts server/database/seeds/data/gallery.json public/img/photos/ && git commit -m "feat(crawlers): crawl photo gallery albums from audit.gov.gh"
```

---

### Task 7: Create videos crawler

**Files:**
- Create: `scripts/crawlers/crawl-videos.ts`

- [ ] **Step 1: Create the videos crawler script**

The video index page has limited data (titles only, no links visible). The crawler will attempt to find video detail pages and extract YouTube embed URLs.

```typescript
import { fetchHtml, downloadImage, slugify, writeJson, delay, resolveUrl } from './utils'
import { join } from 'node:path'

const BASE_URL = 'https://audit.gov.gh'
const INDEX_URL = `${BASE_URL}/6/25/videos`
const IMG_DIR = join(process.cwd(), 'public/img/videos')
const OUTPUT_PATH = join(process.cwd(), 'server/database/seeds/data/videos.json')

interface VideoItem {
  url: string
  thumbnail: string | null
  duration: string | null
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
}

async function crawlIndex(): Promise<Array<{ url: string | null; title: string }>> {
  const $ = await fetchHtml(INDEX_URL)
  const items: Array<{ url: string | null; title: string }> = []

  // Try to find video links with pattern /6/25/{id}/{slug}
  $('a[href*="/6/25/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href === '/6/25/videos' || !href.match(/\/6\/25\/\d+\//)) return

    const fullUrl = resolveUrl(href)
    if (items.some((item) => item.url === fullUrl)) return

    const title = $(el).text().trim() || 'Untitled Video'
    items.push({ url: fullUrl, title })
  })

  // If no links found, try to extract titles from the page content
  if (items.length === 0) {
    console.log('No video links found, attempting to extract titles from page content...')

    // Look for video titles in headings or list items
    $('h3, h4, li, .video-title').each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.length > 3 && text.length < 200) {
        items.push({ url: null, title: text })
      }
    })
  }

  // Also check for embedded YouTube iframes directly on the index
  $('iframe[src*="youtube"], iframe[src*="youtu.be"]').each((_, el) => {
    const src = $(el).attr('src') || ''
    const title = $(el).attr('title') || 'Untitled Video'
    items.push({ url: src, title })
  })

  console.log(`Found ${items.length} video entries`)
  return items
}

async function crawlDetail(url: string): Promise<{
  title: string
  youtubeUrl: string | null
  description: string | null
  thumbnailSrc: string | null
}> {
  const $ = await fetchHtml(url)

  const title =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    'Untitled'

  // Look for YouTube embeds
  let youtubeUrl: string | null = null
  $('iframe[src*="youtube"], iframe[src*="youtu.be"]').each((_, el) => {
    if (!youtubeUrl) {
      youtubeUrl = $(el).attr('src') || null
    }
  })

  // Also check for YouTube links in the page
  if (!youtubeUrl) {
    $('a[href*="youtube.com"], a[href*="youtu.be"]').each((_, el) => {
      if (!youtubeUrl) {
        youtubeUrl = $(el).attr('href') || null
      }
    })
  }

  // Also check for video source tags
  if (!youtubeUrl) {
    $('video source, video').each((_, el) => {
      if (!youtubeUrl) {
        youtubeUrl = $(el).attr('src') || null
      }
    })
  }

  // Extract description
  let description: string | null = null
  $('p').each((_, el) => {
    const text = $(el).text().trim()
    if (!description && text.length > 30) {
      description = text
    }
  })

  const thumbnailSrc = $('img').first().attr('src') || null

  return { title, youtubeUrl, description, thumbnailSrc }
}

async function main() {
  console.log('=== Crawling Videos ===\n')

  const indexItems = await crawlIndex()
  const videosData: VideoItem[] = []
  const now = new Date()

  for (let i = 0; i < indexItems.length; i++) {
    const item = indexItems[i]
    console.log(`\n[${i + 1}/${indexItems.length}] ${item.title}`)

    let videoUrl: string | null = null
    let title = item.title
    let description: string | null = null
    let thumbnailPath: string | null = null

    // If we have a detail page URL, crawl it
    if (item.url && !item.url.includes('youtube.com')) {
      try {
        const detail = await crawlDetail(item.url)
        videoUrl = detail.youtubeUrl
        title = detail.title || item.title
        description = detail.description

        if (detail.thumbnailSrc) {
          const filename = await downloadImage(detail.thumbnailSrc, IMG_DIR)
          if (filename) thumbnailPath = `/img/videos/${filename}`
        }
      } catch (err) {
        console.warn(`  ⚠ Detail page failed: ${(err as Error).message}`)
      }
      await delay(500)
    } else if (item.url?.includes('youtube.com')) {
      videoUrl = item.url
    }

    // Skip videos with no URL at all
    if (!videoUrl) {
      console.log(`  ⚠ No video URL found, skipping`)
      continue
    }

    const publishedAt = new Date(now)
    publishedAt.setMonth(publishedAt.getMonth() - i)
    const dateStr = publishedAt.toISOString().split('T')[0]

    videosData.push({
      url: videoUrl,
      thumbnail: thumbnailPath,
      duration: null,
      publishedAt: dateStr,
      isPublished: true,
      translations: {
        en: { title, description }
      }
    })

    console.log(`  ✓ "${title}" → ${videoUrl}`)
  }

  writeJson(OUTPUT_PATH, videosData)
  console.log(`\n=== Done: ${videosData.length} videos crawled ===`)
}

main().catch((err) => {
  console.error('Crawl failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the crawler**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx scripts/crawlers/crawl-videos.ts
```

Expected: Crawls 6 videos. Some may be skipped if no YouTube URL is found. Verify:

```bash
cd /home/jude/code/gas/ghana-audit-service && cat server/database/seeds/data/videos.json | head -20
```

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add scripts/crawlers/crawl-videos.ts server/database/seeds/data/videos.json public/img/videos/ && git commit -m "feat(crawlers): crawl videos from audit.gov.gh"
```

---

### Task 8: Create news seed script

**Files:**
- Create: `server/database/seeds/news.ts`

- [ ] **Step 1: Create the news seed script**

Follows the exact pattern from `departments.ts`: dotenv config, mysql2 pool, drizzle, `--force` flag, idempotent slug check.

```typescript
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

interface SeedNewsItem {
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

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const dataPath = join(__dirname, 'data/news.json')
    const newsData: SeedNewsItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${newsData.length} news articles from seed data`)

    const existing = await db.select().from(schema.newsArticles)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing news articles.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing news articles (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.newsArticleTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.newsArticleTags}`)
      await db.execute(sql`DELETE FROM ${schema.newsArticles}`)
    }

    console.log('Seeding news articles...')

    for (const article of newsData) {
      const [result] = await db.insert(schema.newsArticles).values({
        slug: article.slug,
        author: article.author,
        thumbnail: article.thumbnail,
        category: article.category,
        publishedAt: new Date(article.publishedAt),
        isPublished: article.isPublished
      })

      const articleId = result.insertId

      await db.insert(schema.newsArticleTranslations).values({
        newsArticleId: articleId,
        locale: 'en',
        title: article.translations.en.title,
        excerpt: article.translations.en.excerpt,
        content: article.translations.en.content
      })

      console.log(`  - Created: ${article.translations.en.title.slice(0, 70)}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${newsData.length} news articles created`)
  } catch (error) {
    console.error('Error seeding news:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Run the seed**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/news.ts
```

Expected: Inserts all news articles and translations. Run again without `--force` to verify idempotency:

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/news.ts
```

Expected: `Found N existing news articles. Skipping seed to avoid duplicates.`

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add server/database/seeds/news.ts && git commit -m "feat(seeds): add news seed script"
```

---

### Task 9: Create events seed script

**Files:**
- Create: `server/database/seeds/events.ts`

- [ ] **Step 1: Create the events seed script**

```typescript
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

interface SeedEventItem {
  slug: string
  startDate: string
  endDate: string | null
  isVirtual: boolean
  registrationUrl: string | null
  thumbnail: string | null
  isPublished: boolean
  translations: {
    en: { title: string; description: string; location: string | null }
  }
}

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const dataPath = join(__dirname, 'data/events.json')
    const eventsData: SeedEventItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${eventsData.length} events from seed data`)

    const existing = await db.select().from(schema.events)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing events.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing events (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.eventTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.events}`)
    }

    console.log('Seeding events...')

    for (const evt of eventsData) {
      const [result] = await db.insert(schema.events).values({
        slug: evt.slug,
        startDate: new Date(evt.startDate),
        endDate: evt.endDate ? new Date(evt.endDate) : null,
        isVirtual: evt.isVirtual,
        registrationUrl: evt.registrationUrl,
        thumbnail: evt.thumbnail,
        isPublished: evt.isPublished
      })

      const eventId = result.insertId

      await db.insert(schema.eventTranslations).values({
        eventId,
        locale: 'en',
        title: evt.translations.en.title,
        description: evt.translations.en.description,
        location: evt.translations.en.location
      })

      console.log(`  - Created: ${evt.translations.en.title.slice(0, 70)}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${eventsData.length} events created`)
  } catch (error) {
    console.error('Error seeding events:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Run and verify**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/events.ts
```

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add server/database/seeds/events.ts && git commit -m "feat(seeds): add events seed script"
```

---

### Task 10: Create gallery seed script

**Files:**
- Create: `server/database/seeds/gallery.ts`

- [ ] **Step 1: Create the gallery seed script**

This is the most complex seed — it inserts albums, then images per album, then sets the `coverImageId`.

```typescript
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql, eq } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

interface SeedGalleryAlbum {
  slug: string
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
  images: Array<{
    url: string
    translations: {
      en: { alt: string; caption: string | null }
    }
  }>
}

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const dataPath = join(__dirname, 'data/gallery.json')
    const galleryData: SeedGalleryAlbum[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${galleryData.length} gallery albums from seed data`)

    const existingAlbums = await db.select().from(schema.galleryAlbums)
    if (existingAlbums.length > 0) {
      if (!force) {
        console.log(`Found ${existingAlbums.length} existing gallery albums.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing existing gallery data (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.galleryImageTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.galleryAlbumTranslations}`)
      // Null out coverImageId before deleting images (FK constraint)
      await db.execute(sql`UPDATE ${schema.galleryAlbums} SET cover_image_id = NULL`)
      await db.execute(sql`DELETE FROM ${schema.galleryImages}`)
      await db.execute(sql`DELETE FROM ${schema.galleryAlbums}`)
    }

    console.log('Seeding gallery albums...')
    let totalImages = 0

    for (const album of galleryData) {
      // 1. Insert album
      const [albumResult] = await db.insert(schema.galleryAlbums).values({
        slug: album.slug,
        publishedAt: new Date(album.publishedAt),
        isPublished: album.isPublished
      })

      const albumId = albumResult.insertId

      // 2. Insert album translation
      await db.insert(schema.galleryAlbumTranslations).values({
        albumId,
        locale: 'en',
        title: album.translations.en.title,
        description: album.translations.en.description
      })

      // 3. Insert images for this album
      let firstImageId: number | null = null

      for (const img of album.images) {
        const [imgResult] = await db.insert(schema.galleryImages).values({
          url: img.url,
          albumId,
          category: album.translations.en.title
        })

        const imageId = imgResult.insertId
        if (!firstImageId) firstImageId = imageId

        await db.insert(schema.galleryImageTranslations).values({
          imageId,
          locale: 'en',
          alt: img.translations.en.alt,
          caption: img.translations.en.caption
        })

        totalImages++
      }

      // 4. Set coverImageId to first image
      if (firstImageId) {
        await db
          .update(schema.galleryAlbums)
          .set({ coverImageId: firstImageId })
          .where(eq(schema.galleryAlbums.id, albumId))
      }

      console.log(`  - Created: ${album.translations.en.title} (${album.images.length} images)`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${galleryData.length} albums created`)
    console.log(`  - ${totalImages} images created`)
  } catch (error) {
    console.error('Error seeding gallery:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Run and verify**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/gallery.ts
```

Expected: Creates albums with images. Verify via Drizzle Studio:

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run db:studio
```

Check `gallery_albums` has entries, `gallery_images` has `album_id` populated, and `cover_image_id` is set.

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add server/database/seeds/gallery.ts && git commit -m "feat(seeds): add gallery seed script with album support"
```

---

### Task 11: Create videos seed script

**Files:**
- Create: `server/database/seeds/videos.ts`

- [ ] **Step 1: Create the videos seed script**

```typescript
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

interface SeedVideoItem {
  url: string
  thumbnail: string | null
  duration: string | null
  publishedAt: string
  isPublished: boolean
  translations: {
    en: { title: string; description: string | null }
  }
}

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const dataPath = join(__dirname, 'data/videos.json')
    const videosData: SeedVideoItem[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    console.log(`Loaded ${videosData.length} videos from seed data`)

    const existing = await db.select().from(schema.videos)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing videos.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing videos (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.videoTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.videos}`)
    }

    console.log('Seeding videos...')

    for (const video of videosData) {
      const [result] = await db.insert(schema.videos).values({
        url: video.url,
        thumbnail: video.thumbnail,
        duration: video.duration,
        publishedAt: new Date(video.publishedAt),
        isPublished: video.isPublished
      })

      const videoId = result.insertId

      await db.insert(schema.videoTranslations).values({
        videoId,
        locale: 'en',
        title: video.translations.en.title,
        description: video.translations.en.description
      })

      console.log(`  - Created: ${video.translations.en.title}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${videosData.length} videos created`)
  } catch (error) {
    console.error('Error seeding videos:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Run and verify**

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/videos.ts
```

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add server/database/seeds/videos.ts && git commit -m "feat(seeds): add videos seed script"
```

---

### Task 12: Add NPM scripts to package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add crawler and seed scripts**

Add the following scripts to the `"scripts"` section of `package.json`, after the existing `db:seed:management-team` entry:

```json
"crawl:news": "tsx scripts/crawlers/crawl-news.ts",
"crawl:events": "tsx scripts/crawlers/crawl-events.ts",
"crawl:gallery": "tsx scripts/crawlers/crawl-gallery.ts",
"crawl:videos": "tsx scripts/crawlers/crawl-videos.ts",
"crawl:all": "npm run crawl:news && npm run crawl:events && npm run crawl:gallery && npm run crawl:videos",
"db:seed:news": "npx tsx server/database/seeds/news.ts",
"db:seed:events": "npx tsx server/database/seeds/events.ts",
"db:seed:gallery": "npx tsx server/database/seeds/gallery.ts",
"db:seed:videos": "npx tsx server/database/seeds/videos.ts",
"db:seed:media": "npm run db:seed:news && npm run db:seed:events && npm run db:seed:gallery && npm run db:seed:videos"
```

- [ ] **Step 2: Verify scripts are wired correctly**

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run db:seed:news -- --help 2>&1 | head -1
```

Expected: Should not error about missing script.

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add package.json && git commit -m "chore: add crawler and media seed npm scripts"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Run the full crawl pipeline**

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run crawl:all
```

Expected: All four crawlers run, JSON files are written, images are downloaded.

- [ ] **Step 2: Verify JSON data files exist and are valid**

```bash
cd /home/jude/code/gas/ghana-audit-service && for f in server/database/seeds/data/*.json; do echo "$f: $(node -e "console.log(require('./$f').length)") items"; done
```

Expected: Four JSON files with item counts matching the live site.

- [ ] **Step 3: Run the full seed pipeline with --force**

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run db:seed:media -- --force
```

Note: `--force` propagates through the npm script chain. If it doesn't, run each individually:

```bash
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/news.ts --force
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/events.ts --force
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/gallery.ts --force
cd /home/jude/code/gas/ghana-audit-service && npx tsx server/database/seeds/videos.ts --force
```

- [ ] **Step 4: Verify data in database**

Start the dev server and check the public API endpoints:

```bash
cd /home/jude/code/gas/ghana-audit-service && npm run dev &
sleep 5
curl -s http://localhost:3000/api/news | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('News:',j.meta?.total||j.data?.length||'?')})"
```

Note: Events, gallery, and videos API routes still return mock data (the spec declared updating them as out of scope). Verify news works since it already queries the database.

- [ ] **Step 5: Commit any final adjustments**

```bash
cd /home/jude/code/gas/ghana-audit-service && git add -A && git status
```

Only commit if there are meaningful changes from the verification step.
