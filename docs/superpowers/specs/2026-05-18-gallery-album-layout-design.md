# Gallery Album Layout Redesign

**Date:** 2026-05-18
**Status:** Approved

## Problem

The `/media/gallery` page renders all 563 images in a flat 4-column grid. It's extremely long and hard to navigate. Albums exist in the database (23 published) but the public API flattens everything.

## Design

### Gallery Listing (`/media/gallery`)

Full-width album sections, 3 per page with pagination.

Each album section:
- Header row: album title + photo count (left), "View Album →" link (right), gold underline
- Image grid: large featured image on the left spanning 2 rows, 3×2 grid of square thumbnails on the right
- Last thumbnail position is a "+N more" card linking to the album detail page
- Clicking any image or "View Album" navigates to `/media/gallery/[slug]`

Pagination: Previous/Next + page numbers at bottom. 3 albums per page = 8 pages for 23 albums.

### Album Detail (`/media/gallery/[slug]`) — new route

- Breadcrumb: Home / Media Centre / Gallery / Album Title
- Album title + photo count
- 4-column image grid (2 cols mobile, 3 tablet, 4 desktop) using existing `GalleryGrid` component with lightbox
- "Back to Gallery" link

### New API Endpoints

**`GET /api/gallery/albums`** — paginated album listing
- Query: `page`, `perPage` (default 3)
- Returns: `{ data: GalleryAlbumPublic[], meta: { total, page, perPage, lastPage } }`
- Each album includes: id, slug, title, description, imageCount, publishedAt, previewImages (first 7 image URLs)
- Only published, non-deleted albums. Sorted by `publishedAt DESC`.
- Locale-aware (album title/description from translations table).

**`GET /api/gallery/albums/[slug]`** — single album with all images
- Returns: `{ album: { slug, title, description, imageCount, publishedAt }, images: GalleryImage[] }`
- Images are the existing `GalleryImage` type (id, url, alt, caption, category, uploadedAt)
- Only published album, non-deleted images. Sorted by `uploadedAt DESC`.

### Types

```typescript
interface GalleryAlbumPublic {
  id: string
  slug: string
  title: string
  description?: string
  imageCount: number
  publishedAt: string
  previewImages: string[]
}
```

### Files to Create/Modify

- **Create:** `server/api/gallery/albums.get.ts`, `server/api/gallery/albums/[slug].get.ts`, `pages/media/gallery/[slug].vue`
- **Modify:** `pages/media/gallery.vue` (rewrite), `types/index.ts` (add GalleryAlbumPublic), `server/utils/transformGallery.ts` (add public album transform)
- **Keep:** `components/media/GalleryGrid.vue` (reuse on album detail page), existing `/api/gallery` endpoint (unchanged, still used elsewhere)
