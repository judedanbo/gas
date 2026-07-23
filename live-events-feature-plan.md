# Live Events Feature Plan

**Status:** Proposed — not yet implemented
**Scope:** Surface YouTube live broadcasts from the Ghana Audit Service channel as "LIVE" on the `/media/videos` page, and show a site-wide indicator on the home page linking to the live event.

---

## 1. Background / Current State

- `/media/videos` (`pages/media/videos.vue`) merges two sources client-side:
  - `/api/videos` — seeded/admin-managed videos from MySQL (`videos` + `video_translations` tables, shaped by `server/utils/transformVideos.ts`).
  - `/api/youtube-videos` — parses the channel RSS feed (`https://www.youtube.com/feeds/videos.xml?channel_id=UCe019PXmQjX6QY9dTm2zPyg`) with regex extraction.
- The shared `Video` type (`types/index.ts`) has no notion of live status.
- `components/media/VideoCard.vue` renders thumbnail, play overlay, duration badge, title, description, date — no live indicator.
- The home page (`pages/index.vue`) is a stack of `Home*` section components with no dynamic alert/banner slot.

**Constraint:** The YouTube RSS feed does **not** expose live-broadcast status. Live streams appear in the feed as ordinary entries (before, during, and after the broadcast), so live detection needs a separate mechanism.

## 2. Live Detection Strategy

### Primary: YouTube Data API v3 (env-gated, graceful degradation)

Add an optional `YOUTUBE_API_KEY` env var (both `.env.example` files + `docker-compose.yml` + `k8s` ConfigMap/Secret). Detection endpoint calls:

```
GET https://www.googleapis.com/youtube/v3/search
    ?part=snippet&channelId=UCe019PXmQjX6QY9dTm2zPyg
    &eventType=live&type=video&key=...
```

- Returns the currently live broadcast(s) with `videoId`, title, thumbnail.
- Optionally a second call with `eventType=upcoming` for scheduled streams (phase 2 — see §8).
- **Quota:** `search.list` costs 100 units/call out of the default 10,000/day. With a 60 s server-side cache that is ~1,440 calls/day worst case → cache for **120 s** (720 calls = 72,000 units… exceeds quota). Therefore cache for **15 minutes by default** (96 calls/day = 9,600 units) **or** use the cheaper fallback below as the poller and the API only for enrichment. Decision: **default cache TTL 5 minutes** combined with the fallback check (§ below) so the API is only hit when the cheap check suggests a live stream may exist. Document the trade-off in code comments.

### Fallback / cheap pre-check: `/channel/{id}/live` probe

When `YOUTUBE_API_KEY` is unset (mirroring the Redis/Blob "optional service" pattern), or as a cheap pre-filter:

- `GET https://www.youtube.com/channel/UCe019PXmQjX6QY9dTm2zPyg/live` (no key needed).
- If the channel is live, the returned HTML contains `"isLive":true` and a canonical `watch?v={videoId}` link; if not live it renders the channel page.
- Parse with the same lightweight regex style already used in `server/api/youtube-videos.ts` — no new dependencies.
- This is scraping and inherently fragile → wrap in try/catch, log via `logError`, and degrade to "no live event" on any parse failure. Never let it break the videos page.

### Caching

- New endpoint result cached server-side (in-process `Map` with TTL, consistent with existing patterns; Redis not required).
- Nitro `routeRules` entry in `nuxt.config.ts`: `'/api/live-events': { swr: 60 }` (short — live status must feel current; note existing public API rules use 300 s).

## 3. API Changes

### New endpoint: `server/api/live-events.ts`

Returns:

```ts
interface LiveEventStatus {
  isLive: boolean
  events: LiveEvent[]        // usually 0 or 1
  checkedAt: string          // ISO timestamp
}

interface LiveEvent {
  videoId: string
  title: string
  thumbnail?: string
  url: string                // https://www.youtube.com/embed/{videoId}
  watchUrl: string           // https://www.youtube.com/watch?v={videoId}
  startedAt?: string
}
```

- Uses detection strategy from §2 (API key if present, probe otherwise).
- On any upstream failure: return `{ isLive: false, events: [], checkedAt }` — never 5xx to the client.
- Add DTO shaping in `server/utils/transformLiveEvents.ts` to honor the "no raw upstream payloads out of API routes" convention.

### `server/api/youtube-videos.ts` (no change required)

Live entries already appear in the RSS feed; the videos page will cross-reference the live-events endpoint (see §5) rather than this endpoint learning about liveness. Keeps concerns separated.

## 4. Type Changes (`types/index.ts`)

```ts
export interface Video {
  // ...existing fields...
  isLive?: boolean          // currently broadcasting
}

export interface LiveEvent { ... }        // as in §3
export interface LiveEventStatus { ... }
```

`isLive` is optional so the DB transform (`transformVideos.ts`) and existing consumers are untouched.

## 5. Frontend — `/media/videos` page

### New composable: `composables/useLiveEvents.ts`

- `{ status, isLive, liveEvents, loading, error, fetchLiveEvents }` following the existing composable shape (`{ items, loading, error, fetch* }`).
- Fetches `/api/live-events`; used by both the videos page and the home page banner.
- Client-side refresh: `setInterval` re-fetch every 60 s while mounted (cleared in `onUnmounted`) so the LIVE badge appears/disappears without a reload. Pause the interval when `document.hidden` (visibility API) to avoid background polling.

### `pages/media/videos.vue`

- Call `useLiveEvents()` alongside the existing fetches.
- After merging seeded + YouTube videos, mark `isLive: true` on any video whose extracted videoId matches a live event (reuse the existing `extractVideoId` helper).
- If a live event is not present in the merged list (feed lag), prepend a synthetic `Video` built from the `LiveEvent` so it is always visible.
- Sort live videos to the top of the grid, then by `publishedAt` descending as today.
- Optional: a slim "● Live now" strip above the grid anchoring to the live card.

### `components/media/VideoCard.vue`

- When `video.isLive`:
  - **Badge** top-left over the thumbnail: `LIVE` in `ghana-red` (`secondary`, `#CE1126`) with a pulsing dot (`animate-pulse` on the dot only — respect `prefers-reduced-motion` via Tailwind `motion-safe:animate-pulse`).
  - Hide the duration badge (a live stream has no fixed duration).
  - Show "Streaming now" in place of the formatted date.
- **Accessibility (WCAG 2.1 AA, non-negotiable):**
  - Badge is real text (not color-only); include visually-hidden context: `<span class="sr-only">{{ $t('videos.liveNowA11y') }}</span>` → "This event is live now".
  - White-on-`#CE1126` passes AA for the badge text at the size used (verify ≥ 4.5:1; if the size is < 18.66 px bold, keep white text — contrast is ~5.9:1, passes).
  - Card `<article>` gets `aria-label` including live status.

## 6. Frontend — Home page live indicator

### New component: `components/home/LiveEventBanner.vue` (`<HomeLiveEventBanner />`)

- Renders **nothing** when no live event (zero layout shift when absent; when present it pushes content down — acceptable since it appears on load, not late — fetch during setup so SSR/first paint includes it when possible; note home page is SSR, so the banner can render server-side).
- Placement: top of `pages/index.vue`, above `<HomeHeroSlideshow />`, full-width bar.
- Content: pulsing dot + "We're live: {event title}" + a "Watch now" `NuxtLink` to `/media/videos` (the videos page opens the player; deep-linking straight to the modal is a stretch goal — support `/media/videos?play={videoId}` query param that auto-opens the player, small addition to the videos page `onMounted`).
- Styling: `ghana-red` background, white text, matches header/container widths; visible in dark mode unchanged (red bar works on both).
- Uses the same `useLiveEvents` composable (per-component fetch is fine — the endpoint is SWR-cached; no shared state needed).
- A11y: `role="status"` + `aria-live="polite"` so screen readers announce the banner when it appears mid-session; link has descriptive text (not just "click here"); dismissible is **not** planned (it's an important, temporary notice), but keyboard focus order must remain header-first.

### SEO/schema (nice-to-have)

- When live, `useSchemaOrg` addition of a `BroadcastEvent` snippet is deferred — note as future work.

## 7. i18n

Add to **both** `i18n/locales/en.json` and `i18n/locales/ak.json`:

| Key | en |
|---|---|
| `videos.liveBadge` | `LIVE` |
| `videos.liveNowA11y` | `This event is live now` |
| `videos.streamingNow` | `Streaming now` |
| `home.liveBanner.label` | `We're live` |
| `home.liveBanner.watchNow` | `Watch now` |

Akan translations must be provided (missing keys fall back to key names, not English). If a verified Akan translation isn't available at implementation time, flag for content-team review in the PR rather than machine-translating silently.

## 8. Out of Scope (explicitly deferred)

- **Upcoming/scheduled streams** (`eventType=upcoming`, "Starts at 10:00" badges) — phase 2.
- Admin-panel manual override ("force live banner" toggle) — consider if API/scrape detection proves unreliable.
- `BroadcastEvent` structured data.
- Push/PWA notifications for live starts.
- Persisting live events to the DB — liveness is ephemeral; no schema/migration changes in this feature.

## 9. Implementation Order

1. Types (`types/index.ts`) — `LiveEvent`, `LiveEventStatus`, `Video.isLive`.
2. Server: `server/utils/transformLiveEvents.ts` + `server/api/live-events.ts` (detection with env-gated API key, probe fallback, in-process TTL cache) + `nuxt.config.ts` route rule + `.env.example` entries (both files) + `docker-compose.yml` / `k8s` secret plumbing for `YOUTUBE_API_KEY`.
3. Composable: `composables/useLiveEvents.ts` (fetch + polling + visibility pause).
4. Video card: LIVE badge + a11y states in `components/media/VideoCard.vue`.
5. Videos page: merge/mark/sort live videos; synthetic card for un-fed live events; `?play=` deep link.
6. Home banner: `components/home/LiveEventBanner.vue` + mount in `pages/index.vue`.
7. i18n: en + ak keys.
8. Tests (see §10), then quality gate.

## 10. Testing

- **Unit (Vitest):**
  - Live-detection parsing: API-response shaping and `/live` probe HTML parsing (fixtures for live, not-live, malformed HTML) — must return "not live" on failure, never throw.
  - `transformLiveEvents` DTO shape.
  - `useLiveEvents` composable: polling setup/teardown, visibility pause (mock timers; remember `vi.mock` factory hoisting gotcha).
  - `VideoCard`: renders LIVE badge + sr-only text when `isLive`, hides duration, shows date otherwise.
  - `LiveEventBanner`: renders nothing when not live; renders `role="status"` bar with link when live.
  - Videos page merge logic: live video sorted first; synthetic card created when the live videoId is absent from both sources.
- **E2E (Playwright):** stub `/api/live-events` and assert badge on `/media/videos` and banner + link on `/`.
- **Manual:** with a real `YOUTUBE_API_KEY` against a channel that is live (or temporarily point `CHANNEL_ID` at a known 24/7 live channel in dev) verify end-to-end.
- **Gate:** `npm run test:run && npm run lint && npm run format:check && npm run typecheck` from `ghana-audit-service/`.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YouTube API quota exhaustion (`search.list` = 100 units) | Probe-first detection, API only as enrichment; 5-min server cache; SWR route rule |
| `/live` probe HTML changes (scraping fragility) | try/catch + `logError`, degrade to not-live; regex kept minimal (`"isLive":true` + videoId) |
| Stale "LIVE" after stream ends | Short cache TTL + 60 s client polling clears the badge/banner within ~2 min |
| CSP / strict security headers | No new client-side origins needed (YouTube embed already allowed); server-side fetches unaffected by CSP |
| Edge cache (`swr`) serving stale not-live during a live start | 60 s SWR on the new endpoint only — do not reuse the 300 s public rule |
| Akan copy missing | PR checklist item; content-team review before merge |
