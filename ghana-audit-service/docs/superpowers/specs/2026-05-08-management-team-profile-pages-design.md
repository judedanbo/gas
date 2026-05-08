# Individual Management Team Profile Pages

**Date:** 2026-05-08
**Branch:** `feature/management-team-real-data` (continuation)
**Status:** Approved

## Goal

Add individual profile pages for each management team member, accessible at
`/about/management-team/:slug`, with a dedicated API endpoint and structured
bio sections.

## Scope

**In scope:**

- Public API route `GET /api/management-team/:slug` returning a single member
- Profile page at `pages/about/management-team/[slug].vue`
- Links from the list page to individual profiles
- Bio section markers (`##` headings) in seed data
- A utility to parse bio text into sections for rendering

**Out of scope:**

- Schema changes (existing `text` bio field supports section markers)
- Admin page changes (bio is already a free-text field)
- Akan translations (can be added later via admin panel)

## API Route

**File:** `server/api/management-team/[slug].ts`

**Route:** `GET /api/management-team/:slug`

**Behavior:**
- Accepts slug as route parameter via `getRouterParam(event, 'slug')`
- Queries `management_team` table filtered by slug, `isActive = true`,
  `deletedAt IS NULL`
- Fetches translations, responsibilities, department data for the member
- Returns `ManagementTeamMember` via `transformManagementTeamMember()`
- Returns 400 if slug is missing
- Returns 404 if member not found
- Locale-aware via `getLocaleFromRequest(event)`

**Pattern:** Follows existing `server/api/news/[slug].ts` pattern.

**Caching:** Same SWR policy as other management team routes (configured
in `nuxt.config.ts` route rules).

## Profile Page

**File:** `pages/about/management-team/[slug].vue`

**Route:** `/about/management-team/:slug`

**Layout:**

```
Breadcrumb: Home > About Us > Management Team > [Name]
┌──────────────────────────────────────────────┐
│  [Photo]   Name                              │
│            Title                              │
│            [Role Badge]                       │
│            [Department Name]                  │
│            email@... | phone                  │
└──────────────────────────────────────────────┘

## Career Background
[paragraphs...]

## International Experience
[paragraphs...]

## Professional Qualifications
[paragraphs...]

## Personal Interests
[paragraphs...]

← Back to Management Team
```

**Behavior:**
- Fetches member data from `/api/management-team/:slug`
- Uses `useSeoMeta` with the member's name and title
- Parses bio into sections using the bio parser utility
- Renders each section as a heading + paragraphs
- Shows loading spinner while fetching
- Shows 404-style message if member not found
- Links back to `/about/management-team`

**Components used:**
- `CommonBreadcrumb` for navigation
- `UiBadge` for role badge
- `UiIconText` for email/phone
- Standard HTML for bio sections (styled with Tailwind)

## List Page Changes

**File:** `pages/about/management-team.vue` (modify)

**Changes:**
- AG section: Wrap name/photo in `<NuxtLink>` to individual profile
- DAG profiles section: Wrap each DAG card name in `<NuxtLink>`
- Org chart DAG cards: Make clickable cards link to profile pages (in
  addition to the existing toggle behavior)

## Bio Section Parser

**File:** `utils/parseBioSections.ts`

**Function:** `parseBioSections(bio: string): BioSection[]`

**Type:**
```typescript
interface BioSection {
  heading: string | null
  content: string
}
```

**Behavior:**
- Splits bio text on `## ` heading markers
- Returns array of `{ heading, content }` objects
- Content before the first `##` gets `heading: null`
- If bio has no `##` markers, returns single section with `heading: null`
  and the full text as content (backward compatible with plain text bios)
- Trims whitespace from headings and content

## Seed Data Update

**File:** `server/database/seeds/management-team.ts` (modify)

Update the bio text for each member to include `## ` section markers. The
sections vary per member based on available content:

- **Johnson Akuamoah Asiedu:** Career Background, International Experience,
  Professional Development, Professional Qualifications, Personal Interests
- **Eugenia Shorme Nortey:** Career Background, Education, Career Achievements,
  Personal Interests
- **Samuel Frimpong-Manso:** Career Background, Audit Experience,
  Capacity Building, Professional Credentials, Education, Publications
- **Roberta Assiamah-Appiah:** Career Background, Special Assignments,
  Professional Development, Qualifications, Personal Interests
- **Samuel Nii Odartey Lamptey:** Career Background, Domestic Audit Experience,
  International Audit Experience, Regional Leadership, Professional Credentials
- **Judith Kwaaku:** Career Background, Notable Assignments,
  Professional Qualifications, Personal Interests
- **George Swanzy Winful:** Career Background, Qualifications,
  Public Sector Career, Ministry of Finance, International Experience,
  Personal Details

## Route Rules (nuxt.config.ts)

Add cache rule for the management team endpoints (list + detail), following
the existing pattern in `routeRules`:

```typescript
'/api/management-team/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
```

Uses the same long-lived cache as `/api/team/**` and `/api/regional-offices/**`
since management team data changes infrequently.

## What Does NOT Change

- Database schema
- Admin API routes or pages
- Transform utilities (already handle single member)
- Validation schema
- Existing list API route path
