# UI/UX Review — Ghana Audit Service website

_Review date: September 2026. Scope: public site and admin panel. Every headline finding was
re-verified by reading the code or grepping the tree; line numbers refer to the commit before the
fixes listed under "What has been fixed"._

Scale of the frontend: 103 pages (61 admin), 77 components (22 `ui/` primitives, 26 admin), 83 test
files.

## Executive summary

1. **The design system exists but is not used.** `UiBaseButton` and `UiBaseCard` had **0** usages.
   Raw `.btn-*` class strings appear 244×, hand-rolled card markup 185×, inline spinners ~87×, inline
   SVGs 337×, and 781 raw Tailwind palette classes (`red-500`, `yellow-500`…) bypass the `--gas-*`
   tokens, so high-contrast mode cannot reach them. Two button systems (`assets/css/tailwind.css` vs
   `components/ui/BaseButton.vue`) already differ in padding and focus behaviour.
2. **The bilingual promise was broken.** The desktop language switcher was commented out; only 28 of
   180 `.vue` files call `$t`; 172 raw `to="/..."` links drop the `/ak/` prefix on first click;
   `app.vue` hard-coded `lang="en"`; in Akan, "Media Centre" and "Error" are the same word
   (`Mfomsoɔ`), and "Advertisement" and "Press Statements" are the same word (`Dawurobɔ`).
3. **Keyboard users could not use core navigation or dialogs.** Desktop dropdowns open on
   `mouseenter` only (no `aria-expanded`); `BaseModal`'s "focus trap" was a no-op `.focus()` on a
   `<div>` without `tabindex`; the mobile menu and 7 public + 3 admin hand-built overlays have no
   dialog semantics; no focus-trap utility existed in the repo.
4. **Real WCAG AA contrast failures.** White on `yellow-500` badge ≈ 1.9:1; gold `#FCD116` on white ≈
   1.5:1 ("View Album"); green `primary-light` on gray-800 ≈ 3.4:1 for every dark-mode link;
   `text-primary` on gray-800 ≈ 2.3:1 in the admin sidebar; the focus ring (`outline-primary`) on the
   green top bar is 1:1, i.e. invisible.
5. **Shipped content bugs.** About-page stats rendered white-on-white; the homepage "Latest
   Publications" block was hard-coded fake data with fake file URLs; footer social links were
   `href="#"`; "Apply Now" did nothing; footer and contact page disagreed on address and phone
   numbers; 29 pages produced "X | Ghana Audit Service | Ghana Audit Service" titles; the homepage
   had no `<h1>` once the slideshow loaded.
6. **Admin has silent failures and dead controls.** `.badge-success`/`.badge-warning` were undefined
   yet used in 15 files (status pills rendered uncoloured); sorting is wired on 1 of 13 tables;
   `useAdminCrud.error` is rendered on 2 of 21 list pages; the unsaved-changes guard is on 1 of 28
   forms; buttons ignore permissions (silent 403s); no skip-link target; 28 create/edit files
   (~10.7k lines) are 75–85 % identical per pair.

## What has been fixed (Phase 1, this branch)

| Area              | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens & CSS      | New `primary-200` tint (`#7FD7AE`, ≈8.4:1 on gray-800) used for all dark-mode links/buttons (`dark:text-primary-light` → `dark:text-primary-200` across 45 files). `.badge-success/-warning/-error/-danger/-info/-gray` defined; `.badge-*`/`.tag-accent` given dark variants and AA-compliant colours. `.btn-danger` added. Focus ring switches to gold on green surfaces (`.bg-primary`, `.page-header`, `.section-primary`, `.on-brand`) and in dark mode. `UiBadge` now uses `success/warning/error/info` tokens (warning = gold with dark text). Form error text uses the `error` token (5.9:1). |
| Header & language | `CommonLanguageSwitcher` (real links via `switchLocalePath`, `hreflang`, `aria-current`) restored in the desktop header and reused in the mobile menu. `CommonAccessibilityControls` (dark mode, high contrast, text size) extracted and now also shown in the mobile menu, so phones get them too. `<html lang/dir>`, hreflang alternates and `og:locale` now follow the active locale via `useLocaleHead` in `app.vue`.                                                                                                                                                                             |
| Dialogs           | New `useFocusTrap` composable (Tab cycling, initial focus, focus restore). `UiBaseModal`: real focus trap, unique `useId()` title/body ids, `aria-describedby`, `tabindex="-1"`, `z-modal`. Mobile menu is a `role="dialog"` with Escape, trap, scroll lock and icon buttons instead of `✕`/`▼` glyphs. Search palette: trap, focus return, `z-modal`, and "no results" is now announced. Toasts use `z-tooltip` and no longer overflow 320 px viewports.                                                                                                                                             |
| Landmarks         | Skip-link target `#main-content` added to the admin layout, the layout-less login/invitation pages and the error page; skip-link text is translatable.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Cascade           | The base link rule is now `:where(a)` so utility colours (e.g. `text-gray-900` on gold buttons) are no longer overridden by the dark-mode link colour. Locale objects use i18n v10's `language` field (the old `iso` field was silently ignored, which is why `<html lang>` and hreflang never rendered).                                                                                                                                                                                                                                                                                             |
| Locale detection  | `detectBrowserLanguage` is now off. Browser testing showed ISR-cached pages (`/`, `/contact`…) served the _first_ renderer's cookie state and root redirect to every later visitor, so English visitors got `gas_locale=ak` and the new switcher bounced. The URL prefix alone now defines the locale, which is cache-safe.                                                                                                                                                                                                                                                                           |
| Content bugs      | About stats visible; `HomePublicationsPreview` fetches `/api/publications` (loading/error/empty states, `<time>` elements, working "View All" action); first hero slide renders the page `<h1>`; duplicated title suffix removed from 29 pages; homepage title no longer repeats the brand.                                                                                                                                                                                                                                                                                                           |
| Contact & socials | `useSiteContact()` is the single source for address, postal box, digital address, phones, email and working hours; footer, contact page and Media Centre read from it. Social links come from `NUXT_PUBLIC_SOCIAL_*_URL` and are rendered only when configured (no more `href="#"`). "Apply Now" is now a `mailto:` link with the vacancy title pre-filled.                                                                                                                                                                                                                                           |
| Admin a11y        | Login error has `role="alert"`; session countdown announces at 60/30/10 s instead of every second; filter selects have accessible names; data-table sort headers are real buttons with `aria-sort`, header cells have `scope="col"`, checkboxes are labelled, loading state has `role="status"`, and the colspan bug (phantom actions column) is fixed.                                                                                                                                                                                                                                               |
| Tests             | `BaseModal.test.ts` now tests the real component (focus in/out, Escape, unique ids). New `useFocusTrap.test.ts`. Stale Playwright specs fixed (`navigation.spec.ts`) or skipped with a reason (`newsletter.spec.ts`, form disabled).                                                                                                                                                                                                                                                                                                                                                                  |

**Needs confirmation by the Audit Service:**

- Which headquarters address is current. The code previously showed two (contact page: "No. 12
  Starlets 91 Road, Opposite African Union"; footer: "Ministries Block 'O', 1 Old Race Course
  Drive"). `composables/useSiteContact.ts` now carries the contact-page version and is marked `TODO(content)`.
- Social-media profile URLs (set `NUXT_PUBLIC_SOCIAL_FACEBOOK_URL`, `…_TWITTER_URL`, `…_LINKEDIN_URL`,
  `…_YOUTUBE_URL`).
- New Akan strings under `common.*` and `accessibility.*` in `i18n/locales/ak.json`: a few were
  translated from vocabulary already in the file (`Kasa`, `To mu`, `Bue menu no`, `Fa kɔ nsɛm
titiriw no so`); the rest are English placeholders awaiting a native speaker.

## Findings by area

### A. Design system & tokens

- `UiBaseButton` 0 uses / `.btn-*` 244; `UiBaseCard` 0 / inline cards 185; `UiLoadingSpinner` 7 / inline spinners 87.
- Two button systems drift: `.btn` = `px-6 py-3`, `BaseButton` md = `px-4 py-2`; `.btn` uses `focus:` not `focus-visible:`; no `danger` variant existed → admin uses raw `bg-red-600`.
- Three token vocabularies: `--gas-*` (live), `--color-*`/`--bg-*`/`--text-*`/`--space-*` in `variables.css:6-179` (0 `var()` refs, and a _different_ Material gray scale), and raw Tailwind palette (781 uses). No semantic `surface/text-muted/border` tokens → every file repeats `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`.
- `variant` prop means colour (Badge/Button), layout (InfoCard), surface (StatGrid), chrome (AccordionItem). Colour props: `color`, `iconColor`, `badgeVariant`.
- Dead CSS: `.text-title-*`, `.text-body-*`, `.text-caption/overline/lead`, `.section-title`, department colour utilities (`tailwind.css`).
- Fluid heading scale overridden by fixed sizes on 41 `<h1>` / 47 `<h2>`; 32 `text-[10px]/[11px]` px sizes ignore the text-scale feature.
- Z-index tokens (`z-dropdown…z-tooltip`) are defined but palette/modal/toasts used raw `z-50`, admin overlay `z-40`, while the header is `z-sticky` (200) → the sticky header painted above the search-palette backdrop. _(fixed)_
- Dark-mode surfaces: body `dark:bg-gray-800` vs layout `dark:bg-gray-900`; cards also gray-800 → no elevation. `error.vue`, `citizenseye/privacy.vue`, guidelines/AMIS detail, `Tag.vue` have no dark variants.
- Small primitive bugs: `LoadingSpinner` has two roots (drops `class` from `BaseButton`); `BaseButton` `v-bind="$attrs"` without `inheritAttrs:false`; `Tag.vue` empty `aria-label="Remove "` + `outline-none`; `StatGrid` animated mode observes an attribute never rendered.

### B. Internationalisation

- Desktop switcher was commented out; mobile-only switcher. _(fixed)_
- 28/180 files use i18n; 336 keys total, 144 are admin analytics; 58 existing keys (`contact.*`, `pagination.*`, `accessibility.*`, `common.previous/next`) unused while the same strings are hard-coded.
- `useLocalePath` used in 4 files; 172 raw paths. `useLocaleHead` used 0 times; `app.vue` forced `lang="en"` _(fixed)_; `og:locale` fixed to `en_GH` _(fixed)_; no hreflang _(fixed)_.
- Two nav configs drift: desktop `AppNavigation.vue` (English, has "PFM Strategy") vs mobile `MobileMenu.vue` (i18n keys, missing "PFM Strategy", different icons).
- Akan quality: `common.media` = `errors.*` word (`Mfomsoɔ`); `common.advertisement` = `nav.pressStatements` (`Dawurobɔ`); 68 values identical to English — needs native-speaker review.
- 32 files call `toLocaleDateString('en-GB')` directly, bypassing `useLocaleDate` (which pins UTC to avoid hydration day-shift).
- `useCategoryBadge.ts` duplicates `reports.categories.*` in English; month/weekday names hard-coded in the date picker.

### C. Keyboard, focus, dialogs

- Desktop dropdown: hover-only, parent is a link that also owns a submenu, `▼` glyph, no `aria-expanded/haspopup`, no Escape.
- `BaseModal.vue`: no-op focus, no trap, no restore, Escape only when focus inside, static `id="modal-title"`, `z-50`. _(fixed)_
- Mobile menu: no `role="dialog"`, no trap, no Escape, no scroll lock, `max-height:500px` accordion hack. _(fixed)_
- Hand-built overlays without dialog semantics: publications modal, news lightbox, event lightbox, `GalleryGrid.vue`, video player (iframe without `title`), `PdfReader.vue` fullscreen; admin: audit-logs detail, contact-submissions detail, gallery image viewer.
- Focus ring: global `outline-primary` invisible on `bg-primary` top bar / `.page-header` / hero gradient; ≈2.7:1 in dark mode. _(fixed)_
- Skip link target existed only in `layouts/default.vue`. _(fixed)_
- Search palette: input `outline-none`, no combobox roles, no focus return _(fixed)_, "no results" never announced _(fixed)_, hint always "Ctrl+K".
- Admin: sortable `<th>` click-only with no `aria-sort` _(fixed)_; row `@click` not keyboard-reachable; hidden file input; clickable `<div>` rows (audit logs, contact submissions); hover-only gallery actions; scroll-only time wheels; read-only date input, no grid keyboard nav; unlabelled repeater buttons (6 files); unlabelled filter `<select>`s _(fixed)_; RichText toolbar lacks `role="toolbar"`/`aria-pressed`, link URL not validated.
- Unlabelled icon buttons (public): `ReportFilter.vue` chip removers, news clear-search; icon-only Edit/Delete in admin say only "Edit"/"Delete" with no record name.
- `AccordionItem.vue` puts `<h3>` inside `<button>`; contact FAQ `icon: '?'` is read in every name; `Tooltip.vue` hover-only.

### D. Contrast & colour

| Combination                      | Where                                                      | Ratio                                                  |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| white on `yellow-500`            | `Badge.vue` warning (Special Audits, Laws, closed tenders) | 1.9:1 _(fixed)_                                        |
| `#FCD116` on white               | gallery "View Album"                                       | 1.5:1 _(fixed)_                                        |
| `accent-dark` on `accent/10`     | `Badge.vue` accent outline                                 | ~2.1:1 _(fixed)_                                       |
| `primary-light` on gray-800/900  | every dark-mode link                                       | 3.4 / 4.0 _(fixed)_                                    |
| `text-primary` on gray-800       | admin sidebar active link, `badge-primary`                 | ~2.3:1 _(fixed)_                                       |
| white on `bg-amber-500`          | admin bulk buttons (`reports/index.vue`)                   | ~2.1:1                                                 |
| `text-red-500` on white          | all form errors                                            | 3.8:1 _(fixed for contact form and admin form groups)_ |
| `text-gray-400` as body text     | 571 uses (dates, meta)                                     | 2.5:1                                                  |
| `dark:text-gray-500` on gray-900 | footer                                                     | 3.6:1                                                  |
| `text-white/70` 12px             | text-size readout                                          | 4.1:1 _(fixed)_                                        |

- Links have no underline outside high-contrast mode, contradicting `accessibility.vue`.
- Red used for neutral categories ("Performance", "Follow-up"); `badge-secondary` (Ghana red) for "Inactive"/"Viewer"/module chips in admin.

### E. Motion & announcements

- Hero autoplay ignores `prefers-reduced-motion`; polite live region fires every 7 s; dot targets 10 px; `StatsCounter` count-up ignores reduced motion and renders 0 in ISR HTML; 7 pages `scrollTo({behavior:'smooth'})`.
- Admin session countdown was `aria-live="assertive"` every second. _(fixed)_
- Good reference: `HeroSlideshow.vue` otherwise (pause control, tablist, swipe, keyboard).

### F. Feedback, loading, forms

- `UiToastContainer` is mounted only in the admin layout → the public site has no feedback surface; toasts auto-dismiss all types at 4 s with no hover pause.
- Public lists SSR as "Showing 0 of 0 / No reports match" because `useReports` starts `loading=false` and fetches in `onMounted`; detail pages render soft-404 with HTTP 200 instead of `createError`; fetch failures show the empty state; `publications/index.vue` has no empty/error state.
- Three pagination patterns, none with `<nav aria-label>`/`aria-current`, only reports syncs page to URL; ~20 inline spinners, most without `role="status"`.
- Forms: no `aria-invalid`/`aria-describedby` anywhere public or in `AdminInput`/`AdminFormGroup`; no error summary, no focus-to-first-error; success/error boxes not live regions; `useFormValidation` unused by `contact.vue`; required = red `*` only.
- Admin: 26/28 create/edit pages redirect with no success toast; `AdminTranslationTabs` shows no error marker (errors on the hidden EN tab are invisible); API error banners lack `role="alert"`; 401 drops the return URL; blocked modules redirect silently; "Archive" = "Delete" (both soft) but text says "cannot be undone", no restore UI; contact-submission status changes and abuse "Force abusive" have no confirmation.

### G. Content & information architecture

- Content bugs (all fixed in Phase 1): white-on-white About stats; fake `PublicationsPreview`; `href="#"` socials; "Apply Now" no-op; address/phone mismatch; double title suffix; homepage `<h1>`.
- Still open: no `og:image` anywhere despite `summary_large_image`; 25 broken report PDFs (`broken-report-links.md`) still show "Download PDF"; placeholders "Events archive coming soon" / "Reports coming soon"; hard-coded About stats; placeholder image boxes.
- IA: top-level "Advertisement" holds Vacancies + Tenders while their breadcrumbs say "Careers"; `/citizenseye` landing page unreachable (all 5 CTAs go straight to AppSheet); breadcrumb placement varies, uses a 🏠 emoji and its own container width; sticky sidebars `top-24` slide under the ~130 px header; 5 document-detail layouts (reports/press/bulletins near-duplicates; guidelines/AMIS no viewer, no dark mode); report `summary` never shown on the detail page; news search/year filter covers only the loaded 12 items.
- Admin has no theme toggle; `admin-print.vue` forces `colorMode.preference='light'` persistently.
- Admin IA: 6 analytics links ungrouped; Routes page unreachable from sidebar; "Settings" = Tags + Users; no profile/change-password/sessions UI though APIs exist; Tags manageable but unassignable; sidebar active uses `startsWith` (`/admin/newsletter` lights "News"); URL-generated breadcrumbs produce dead links; no preview / "view on site" / scheduled publish.
- PWA: `orientation:'portrait'` fails WCAG 1.3.4; precache `**/*.png` ≈ 7.6 MB; stale `public/site.webmanifest`; 255 KB logo PNG at 50 px; only 2/35 `UiBaseImage` pass width/height.
- Print: no `@media print` for public reports; `print.css` `@page{margin:0}` leaks globally once admin-print loads.

### H. Tests

- No axe/pa11y/Lighthouse dependency.
- `BaseButton/BaseCard/DateTimePicker/AppHeader.test.ts` still redefine the component inline instead of importing it (`BaseModal.test.ts` fixed).
- Stale e2e specs fixed/skipped in Phase 1.

## Recommendations (prioritised)

### P0 — done in Phase 1

See "What has been fixed" above.

### P1 — Foundations (1–2 sprints, unlocks everything else)

1. **Accessible disclosure nav**: make the desktop parent a `<button aria-expanded aria-controls>` (or link + separate toggle), open on click/Enter/Space/ArrowDown, close on Escape/focusout, roving arrow keys. One `utils/navigation.ts` config (i18n keys) feeding desktop, mobile, footer and breadcrumbs.
2. **Semantic tokens**: add `surface`, `surface-muted`, `surface-elevated`, `text-strong/text-muted/text-subtle`, `border` to `tailwind.config.ts` mapped to `--gas-*` with dark + high-contrast overrides; delete the dead `--color-*` block in `variables.css`.
3. **One button, one card, one spinner**: make `UiBaseButton` emit the `.btn-*` classes (so both systems agree), then codemod `class="btn-primary…"` → `<UiBaseButton>`; same for cards/spinners. Add `UiPagination` (`<nav aria-label>`, `aria-current`, URL sync) and `UiEmptyState`/`UiErrorState`.
4. **Focus trap everywhere**: apply `useFocusTrap` to the remaining hand-built overlays (publications modal, lightboxes, gallery grid, video player, PDF fullscreen, admin detail drawers) or replace them with `UiBaseModal`.
5. **Feedback layer**: mount `UiToastContainer` in `layouts/default.vue`; `role="status"` for info/success, `role="alert"` for errors; errors persist until dismissed; pause on hover/focus.
6. **Form primitives**: `UiFormField` (label, required text, hint, error with `aria-describedby`/`aria-invalid`, live region) used by public forms and `AdminFormGroup`; `useFormValidation` with i18n messages; focus first invalid field; error marker on `AdminTranslationTabs`.
7. **i18n pass on public chrome**: header, nav, footer, breadcrumbs, page headers and buttons, using the 58 already-present keys first; `useLocalePath` on all internal links (ESLint rule or a `CommonLocaleLink` wrapper); `useLocaleDate` everywhere (delete the 32 ad-hoc formatters).
8. **List/detail conventions**: fetch with `useAsyncData` so SSR renders real data; `createError({statusCode:404})` on detail misses; one document-detail layout for reports/press/bulletins/guidelines/AMIS; sticky offsets from a `--header-height` variable.

### P2 — Admin productivity & safety

9. `AdminPageHeader` (title, description, breadcrumbs from route meta, actions, back link) replacing 40+ hand-written headers.
10. `useAdminListPage()` + `AdminListPage` scaffold: URL-synced page/filter/sort, error toasts, permission-gated actions, confirm-delete flow, trash/restore tab; real `@sort` handling everywhere; skeleton rows.
11. `useAdminForm()` + `AdminFormScaffold` modelled on `reports/[id]/edit.vue`: skeleton/not-found states, error summary + focus, sticky save bar, `useUnsavedChanges` by default, success toast, `AdminSlugField` (respects manual edits), publish panel with schedule + "view on site" + preview.
12. Permission-aware UI (`hasPermission` gates on Add/Edit/Delete), 401 keeps `redirect`, friendly "no access" page.
13. Sidebar regrouping (Content / Media / People / Analytics / System), exact-match active state + `aria-current`, `aria-label` on `<nav>`, theme toggle in the admin header, profile/change-password/sessions pages (APIs exist).
14. Charts: enable ECharts `aria: { enabled: true, decal: { show: true } }`, `role="img"` + `aria-label`, brand palette, transparent background in dark mode, data-table toggle.
15. Accessible `DateTimePicker`: typeable input, grid keyboard nav, focusable time options.

### P3 — Polish & governance

16. `og:image` default + per-page for reports/news; PWA: drop `orientation`, add PNG icons, remove stale `site.webmanifest`, narrow the precache glob; optimise the logo; pass `width/height/sizes` to `UiBaseImage`.
17. Public print stylesheet for report/publication detail; scope the `@page` rule to admin-print.
18. Reduced motion: gate autoplay/count-up/smooth scroll on `usePreferredReducedMotion()`; hero live region `off` while autoplaying.
19. Native-speaker Akan review (start with the duplicate `Mfomsoɔ`/`Dawurobɔ` labels and the Phase 1 placeholders).
20. a11y CI: `@axe-core/playwright` on key routes; `eslint-plugin-vuejs-accessibility`; a "kitchen sink" page for primitives in light/dark/high-contrast.
21. Delete dead code: `SearchBar.vue`, `layouts/minimal.vue`, commented org chart/newsletter, unused typography classes, the `iconMap.ts` emoji shim once glyph icons are gone.
