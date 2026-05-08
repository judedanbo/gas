# Media Center Data Seeding — Design Spec

**Date**: 2026-05-08
**Status**: Approved

## Goal

Seed the Media Center (News, Events, Photo Gallery, Videos) with all content from the current Ghana Audit Service website (audit.gov.gh). Data is pre-crawled into static JSON + downloaded images, then inserted into the database via seed scripts at deployment time.

## Source URLs

| Category      | Index URL                                  | ~Count |
|---------------|--------------------------------------------|--------|
| News          | https://audit.gov.gh/6/15/news             | 80+    |
| Events        | https://audit.gov.gh/6/16/events           | 30     |
| Photo Gallery | https://audit.gov.gh/6/17/photo-gallery    | 21 albums |
| Videos        | https://audit.gov.gh/6/25/videos           | 6      |

## Schema Change — Gallery Albums

The live site organizes photos as albums (each entry contains multiple images). The current `galleryImages` schema stores individual images. Add a `galleryAlbums` table and link images via foreign key.

### New Tables

**galleryAlbums**

| Column       | Type           | Constraints                             |
|-------------|----------------|------------------------------------------|
| id          | int            | PK, autoincrement                        |
| slug        | varchar(255)   | unique, indexed                          |
| coverImageId| int            | nullable, FK → galleryImages.id, set null|
| publishedAt | datetime       | required, indexed                        |
| isPublished | boolean        | default false, indexed                   |
| createdAt   | datetime       | auto (now)                               |
| updatedAt   | datetime       | auto (now, on update)                    |
| createdBy   | int            | nullable, FK → users.id, set null        |
| deletedAt   | datetime       | nullable (soft delete)                   |

**galleryAlbumTranslations**

| Column      | Type           | Constraints                              |
|-------------|----------------|------------------------------------------|
| id          | int            | PK, autoincrement                        |
| albumId     | int            | FK → galleryAlbums.id, cascade           |
| locale      | enum(en, ak)   |                                          |
| title       | varchar(500)   | required                                 |
| description | text           | nullable                                 |
| Unique index on (albumId, locale) |      |                                          |

### Modified Table

**galleryImages** — add column:

| Column  | Type | Constraints                                  |
|---------|------|----------------------------------------------|
| albumId | int  | nullable, FK → galleryAlbums.id, cascade, indexed |

## Architecture — Two-Phase Pipeline

### Phase 1: Crawler Scripts

Four scripts under `scripts/crawlers/` using `cheerio` + `node:fs`:

1. Fetch the index page → extract all item URLs
2. Fetch each detail page → extract full content (title, body, dates, images, etc.)
3. Download images → save to `public/img/{category}/`
4. Output JSON → write to `server/database/seeds/data/{category}.json`

Only English translations are populated (live site is English-only). Akan translations are added later via the admin panel.

### Phase 2: Seed Scripts

Four scripts under `server/database/seeds/`, following the existing `departments.ts` pattern:

- Direct mysql2 pool connection
- `--force` flag to clear and reseed
- Idempotent: check for existing slugs before insert
- Transaction-wrapped multi-table inserts

## JSON Data Shapes

### news.json

```json
[{
  "slug": "assistant-auditors-general-attend-workshop...",
  "author": null,
  "thumbnail": "/img/news/assistant_auditors-general_attend_workshop.png",
  "category": "news",
  "publishedAt": "2026-03-27",
  "isPublished": true,
  "translations": {
    "en": {
      "title": "Assistant Auditors-General attend...",
      "excerpt": "The Auditor-General conducted a workshop...",
      "content": "<p>Full HTML content...</p>"
    }
  },
  "tags": []
}]
```

### events.json

```json
[{
  "slug": "audit-service-holds-pensions-seminar...",
  "startDate": "2024-11-20",
  "endDate": "2024-11-21",
  "isVirtual": false,
  "thumbnail": "/img/events/pensions-seminar.jpg",
  "isPublished": true,
  "translations": {
    "en": {
      "title": "Audit Service holds pensions seminar...",
      "description": "<p>Full HTML description...</p>",
      "location": "Shippers House, Accra"
    }
  }
}]
```

### gallery.json

```json
[{
  "slug": "2026-thanksgiving-service",
  "publishedAt": "2026-01-15",
  "isPublished": true,
  "translations": {
    "en": { "title": "2026 Thanksgiving Service", "description": null }
  },
  "images": [
    {
      "url": "/img/photos/9991-100.jpg",
      "translations": {
        "en": { "alt": "2026 Thanksgiving Service", "caption": null }
      }
    }
  ]
}]
```

### videos.json

```json
[{
  "url": "https://youtube.com/...",
  "thumbnail": "/img/videos/amis-methodologies.jpg",
  "duration": null,
  "publishedAt": "2024-08-16",
  "isPublished": true,
  "translations": {
    "en": { "title": "AMIS Methodologies", "description": "..." }
  }
}]
```

## File Layout

```
ghana-audit-service/
├── scripts/crawlers/
│   ├── crawl-news.ts
│   ├── crawl-events.ts
│   ├── crawl-gallery.ts
│   └── crawl-videos.ts
├── server/database/
│   ├── schema/media.ts          (modified — add galleryAlbums + albumId FK)
│   ├── seeds/
│   │   ├── data/
│   │   │   ├── news.json
│   │   │   ├── events.json
│   │   │   ├── gallery.json
│   │   │   └── videos.json
│   │   ├── news.ts
│   │   ├── events.ts
│   │   ├── gallery.ts
│   │   └── videos.ts
├── public/img/
│   ├── news/       (downloaded thumbnails)
│   ├── events/     (downloaded thumbnails)
│   ├── photos/     (downloaded gallery images)
│   └── videos/     (downloaded thumbnails)
```

## NPM Scripts

```json
"crawl:news": "tsx scripts/crawlers/crawl-news.ts",
"crawl:events": "tsx scripts/crawlers/crawl-events.ts",
"crawl:gallery": "tsx scripts/crawlers/crawl-gallery.ts",
"crawl:videos": "tsx scripts/crawlers/crawl-videos.ts",
"crawl:all": "npm run crawl:news && npm run crawl:events && npm run crawl:gallery && npm run crawl:videos",
"db:seed:news": "tsx server/database/seeds/news.ts",
"db:seed:events": "tsx server/database/seeds/events.ts",
"db:seed:gallery": "tsx server/database/seeds/gallery.ts",
"db:seed:videos": "tsx server/database/seeds/videos.ts",
"db:seed:media": "npm run db:seed:news && npm run db:seed:events && npm run db:seed:gallery && npm run db:seed:videos"
```

## Seed Execution Order

No cross-dependencies between the four seed scripts. They can run in any order. The gallery seed must insert albums before images (handled internally).

## Edge Cases & Notes

- **Gallery dates**: The live site does not display dates on gallery entries. The crawler will set `publishedAt` based on the order of items on the page (most recent first), using a reasonable spread (e.g., monthly intervals working backwards from the crawl date).
- **Video URLs**: The video index page shows only titles. The crawler must visit each detail page to extract embedded YouTube URLs. If no URL is found, the item is skipped.
- **Image download failures**: If an image fails to download (404, timeout), the crawler logs a warning and continues. The seed data will reference the original remote URL as fallback.
- **Insertion order for gallery**: Insert album first, then images with `albumId`, then update album's `coverImageId` to the first image.

## Out of Scope

- Akan translations (added later via admin panel)
- Updating mock-data API routes to use the database (natural follow-up)
- Admin CRUD for gallery albums (follow-up feature)
- Re-crawling automation / CI integration

## Dependencies

- `cheerio` — HTML parsing for crawler scripts (devDependency)
- Existing: `tsx`, `mysql2`, `dotenv`, `drizzle-orm`
