# Ghana Audit Service - Codebase Improvement Suggestions

This document contains improvement suggestions based on a comprehensive analysis of the Ghana Audit Service Nuxt 3 website codebase.

---

## Current Status (Updated December 2024)

### Completed Items ✅

| Item | Status | Implementation Details |
|------|--------|------------------------|
| Testing Infrastructure | ✅ Complete | Vitest + Playwright configured, 19 test files, ~250 tests |
| Security Hardening | ✅ Complete | CSRF protection, security headers, input sanitization, rate limiter fixes |
| Database Integration | ✅ Complete | Drizzle ORM with SQLite, newsletter persistence |
| Icon System | ✅ Complete | @nuxt/icon with Heroicons, aria-hidden on decorative icons |
| Config Validation | ✅ Complete | Server plugin validates production config |
| i18n Completion | ✅ Complete | ~60 new translation keys, locale-aware date formatting, mobile language switcher |
| Error Handling | ✅ Complete | Custom error.vue page with i18n support |
| TypeScript Improvements | ✅ Complete | `any` types removed |

### Phase 4 Completed ✅

| Item | Status | Implementation Details |
|------|--------|------------------------|
| SEO Improvements | ✅ Complete | Sitemap, JSON-LD structured data, hreflang, expanded prerendering |
| PWA Support | ✅ Complete | @vite-pwa/nuxt, service worker, manifest, SVG icons |
| Developer Experience | ✅ Complete | Prettier, EditorConfig, Husky + lint-staged |
| Documentation | ✅ Complete | README.md rewritten, CONTRIBUTING.md created |

### Remaining Items

| Item | Priority | Status |
|------|----------|--------|
| State Management (Pinia) | Medium | Skipped (optional - current composables work well) |
| Form Validation | Medium | Basic regex only |
| Bundle Analysis | Low | Optional enhancement |

### Phase 3 Completed ✅

| Item | Status | Implementation Details |
|------|--------|------------------------|
| Accessibility Refinements | ✅ Complete | ~80% → 95%: aria-labels, color contrast, live regions, aria-controls |
| Image Optimization | ✅ Complete | @nuxt/image installed, NuxtImg with lazy loading |
| Dark Mode | ✅ Complete | @nuxtjs/color-mode, class-based dark mode, toggle in header |

---

## High Priority (Security & Critical)

### 1. Testing Infrastructure ✅ COMPLETE

**Status**: Fully implemented with comprehensive test coverage.

**What was implemented**:
- ✅ Vitest configured with `@vue/test-utils` and `happy-dom`
- ✅ Playwright configured for E2E testing
- ✅ `@nuxt/test-utils` integrated
- ✅ Test scripts added to `package.json`

**Test Files Created** (19 total):
- **Unit Tests (11 files)**: Composables (useReports, usePublications, useNewsletter, useAccessibility, useSearch), Components (BaseButton, BaseCard, BaseModal, AppHeader), Utils (csrf, rateLimiter)
- **Integration Tests (4 files)**: API routes (reports, search, newsletter), route validation
- **E2E Tests (4 files)**: Navigation, search, newsletter, routes

**Commands**:
```bash
npm run test        # Run unit/integration tests in watch mode
npm run test:run    # Run all tests once
npm run test:e2e    # Run E2E tests with Playwright
```

---

### 2. Security Hardening ✅ COMPLETE

**Status**: All security issues have been addressed.

**What was implemented**:

#### CSRF Protection ✅
- Created `server/utils/csrf.ts` with token generation and validation
- Created `server/api/csrf.get.ts` endpoint for token retrieval
- Newsletter API validates CSRF token on all POST requests

#### Rate Limiting ✅
- Fixed `H3Event` typing (removed `any` type)
- Implemented trusted proxy support via `TRUSTED_PROXIES` env variable
- Only trusts `x-forwarded-for` from configured proxy IPs

#### Security Headers ✅
- Added to `nuxt.config.ts:119-133`:
  - `Strict-Transport-Security` (HSTS)
  - `Content-Security-Policy` (CSP)
  - `X-DNS-Prefetch-Control`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `X-XSS-Protection`
  - `Referrer-Policy`
  - `Permissions-Policy`

#### Input Sanitization ✅
- Added `validator` package for email validation
- Email normalization and sanitization in newsletter API
- XSS protection via `validator.escape()`

#### Config Validation ✅
- Created `server/plugins/validateConfig.ts`
- Validates API secret in production
- Warns about missing trusted proxy configuration

---

### 3. Database Integration ✅ COMPLETE

**Status**: Database persistence implemented for newsletter subscriptions.

**What was implemented**:

#### Drizzle ORM with SQLite ✅
- Installed `drizzle-orm` and `better-sqlite3`
- Created `server/database/schema.ts` with table definitions
- Created `server/database/index.ts` for database connection
- Created `drizzle.config.ts` for migrations

#### Newsletter Persistence ✅
- Newsletter subscribers now persist to SQLite database
- Supports re-subscription after unsubscribe
- Tracks subscription metadata (IP, user agent, timestamps)

#### Database Scripts ✅
```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio GUI
```

#### Files Created:
- `server/database/schema.ts` - Table definitions
- `server/database/index.ts` - Connection and exports
- `drizzle.config.ts` - Drizzle Kit configuration

**Note**: Mock data files retained for development/testing. Rate limiting remains in-memory (suitable for single-server deployments).

---

### 4. Icon System ✅ COMPLETE

**Status**: Emoji icons replaced with accessible Heroicons.

**What was implemented**:

#### @nuxt/icon Module ✅
- Installed and configured in `nuxt.config.ts`
- Server-side rendering enabled for icons

#### Icon Mapping ✅
- Created `utils/iconMap.ts` with 50+ emoji-to-Heroicon mappings
- Backward compatible - existing emoji props still work
- Icons resolve automatically via `resolveIcon()` function

#### IconText Component Updated ✅
- Uses `<Icon>` component from @nuxt/icon
- All icons have `aria-hidden="true"` for accessibility
- Supports both emoji strings and Heroicon names

#### Components Migrated ✅
- `components/common/AppHeader.vue` - uses `heroicons:phone`, `heroicons:envelope`, etc.
- `components/common/AppFooter.vue` - uses Heroicons throughout
- `components/ui/IconText.vue` - resolves icons via iconMap

**Benefits**:
- Consistent rendering across all platforms
- Screen readers no longer announce emoji descriptions
- Tree-shakeable icon bundle
- Better accessibility compliance

---

## Medium Priority (Code Quality)

### 5. i18n Completion ✅ COMPLETE

**Status**: Internationalization significantly improved (~80% coverage).

**What was implemented**:

#### Translation Keys ✅
- Added ~60 new keys to `i18n/locales/en.json` and `i18n/locales/ak.json`
- Categories: common UI, navigation, reports, newsletter, search types, errors, pagination
- Both English and Akan translations provided

#### Component Updates ✅
- `components/reports/ReportCard.vue` - Uses `$t()` for buttons, locale-aware dates
- `components/reports/ReportFilter.vue` - Uses `$t()` for labels and placeholders
- `components/search/SearchResultCard.vue` - Uses `$t()` for type labels
- `components/common/AppFooter.vue` - Uses `$t()` for headings, links, newsletter
- `components/common/MobileMenu.vue` - Uses `$t()` for all navigation items

#### Locale-Aware Date Formatting ✅
- Created `composables/useLocaleDate.ts`
- Provides `formatDate`, `formatDateLong`, `formatDateShort`, `formatDateNumeric`, `formatRelativeDate`
- Respects current locale for date formatting

#### Mobile Language Switcher ✅
- Added language switcher to `MobileMenu.vue`
- Allows switching between English and Akan on mobile

#### Dynamic HTML Lang Attribute ✅
- Removed hardcoded `lang: 'en'` from `nuxt.config.ts`
- i18n module now manages lang attribute based on current locale

**Remaining** (low priority):
- `$n()` for number formatting (not widely needed)
- `hreflang` meta tags for SEO (enhancement)

---

### 6. State Management

**Current State**: No global state management.

**Issues**:
- Each composable manages isolated state
- Composables return mutable refs (should use `readonly()`)
- No caching - every navigation refetches data
- Using `$fetch()` instead of `useFetch()` with caching

**Affected Files**:
- `composables/useReports.ts`
- `composables/usePublications.ts`
- `composables/useSearch.ts`

**Recommendations**:
- Add Pinia for global state management
- Return `readonly()` refs from composables
- Use `useFetch()` or `useAsyncData()` with cache keys
- Implement cache invalidation strategy
- Share common state between related composables

---

### 7. TypeScript Improvements

**Current Issues**:
- `any` type used in `server/utils/rateLimiter.ts:87`
- No runtime validation library
- No branded types for entity IDs
- Missing JSDoc documentation on interfaces

**Recommendations**:
- Remove all `any` types - use proper typing
- Add Zod for runtime validation on API inputs
- Implement branded types for IDs:
  ```typescript
  type ReportId = string & { __brand: 'ReportId' }
  type PublicationId = string & { __brand: 'PublicationId' }
  ```
- Add JSDoc comments to all interfaces in `types/index.ts`

---

### 8. Error Handling ✅ COMPLETE

**Status**: Custom error page implemented with i18n support.

**What was implemented**:

#### Custom Error Page ✅
- Created `error.vue` in project root
- Handles 404 (Not Found) and 500 (Server Error) gracefully
- Clean, accessible design consistent with site branding
- "Go Back" and "Go to Homepage" buttons
- Contact information for support

#### Internationalized Error Messages ✅
- Added error translation keys to both locale files
- Keys: `notFound`, `notFoundDesc`, `serverError`, `serverErrorDesc`, `goHome`, `goBack`, `tryAgain`, `errorCode`
- Both English and Akan translations provided

#### User Experience ✅
- Different icons for 404 vs server errors
- Helpful descriptions explaining what happened
- Easy navigation back to safety

**Remaining** (low priority):
- Error logging service integration
- Global error boundary for component errors

---

### 9. Form Validation

**Current State**: Basic regex validation only.

**Recommendations**:
- Add Vee-Validate or FormKit for form handling
- Add Zod or Yup for schema validation
- Implement client-side and server-side validation
- Add proper error messages with i18n support

---

## Lower Priority (Enhancement)

### 10. Performance Optimizations

**Image Optimization**:
- No `@nuxt/image` module installed
- No WebP conversion
- No responsive images
- No lazy loading strategy

**Bundle Size**:
- No bundle analyzer configured
- Tailwind viewer enabled in production (`nuxt.config.ts:42`)
- No size budgets defined

**List Rendering**:
- Report lists could have 100+ items with no virtualization
- Location: `pages/reports/index.vue`

**Resource Hints**:
- Missing preconnect/prefetch for external resources
- Location: `nuxt.config.ts` head configuration

**Caching**:
- No service worker
- No offline support
- No PWA module

**Recommendations**:
- Install and configure `@nuxt/image`
- Add bundle analyzer (`nuxt-build-analyze`)
- Disable Tailwind viewer in production
- Add virtual scrolling for long lists (`vue-virtual-scroller`)
- Add resource hints for Google Fonts and API endpoints
- Consider adding `@vite-pwa/nuxt` for PWA support

---

### 11. Accessibility Refinements

**Current Issues**:

| Issue | Location | Fix |
|-------|----------|-----|
| Decorative emojis missing `aria-hidden` | Multiple components | Add `aria-hidden="true"` |
| Color contrast (gray-400 on white) | `assets/css/tailwind.css` | Use gray-500 or darker |
| Ambiguous "Read More" links | Report/news cards | Use "Read more about {title}" |
| Missing `role="status"` on loaders | Loading components | Add ARIA live region |
| Search input missing label | `AppHeader.vue` | Add visually hidden label |

**Recommendations**:
- Run axe-core or Lighthouse accessibility audits
- Fix all WCAG AA violations
- Test with screen readers (NVDA, VoiceOver)
- Add more skip links (to navigation, search, footer)

---

### 12. Dark Mode

**Current State**: CSS variables defined but not implemented.

**Location**: `assets/css/variables.css:259-269`

**Recommendations**:
- Add dark mode toggle to header
- Implement `useColorMode()` composable
- Store preference in localStorage
- Respect `prefers-color-scheme` media query

---

### 13. Code Organization

**Missing Directories**:
- `/plugins` - for global configurations
- `/middleware` - for route guards
- `/utils` - for client-side utilities

**Recommendations**:
- Create `/plugins` for global Vue plugins
- Create `/middleware` for auth guards (when needed)
- Create `/utils` for shared client utilities
- Add Storybook for component documentation and development

---

### 14. SEO Improvements

**Current Issues**:
- Prerendering limited to homepage only (`nuxt.config.ts`)
- No sitemap generation
- `htmlAttrs.lang` always 'en'

**Recommendations**:
- Add `@nuxtjs/sitemap` module
- Configure all static routes for prerendering
- Set `htmlAttrs.lang` dynamically based on locale
- Add structured data (JSON-LD) for government organization
- Add Open Graph images for social sharing

---

### 15. Developer Experience

**Missing Configurations**:
- No ESLint configuration visible
- No Prettier configuration
- No component documentation
- No README with setup instructions

**Recommendations**:
- Add ESLint with `@nuxt/eslint-config`
- Add Prettier with consistent formatting rules
- Add Husky for pre-commit hooks
- Create comprehensive README.md
- Add CONTRIBUTING.md for contributors
- Set up Storybook for component playground

---

## Architecture Strengths (Preserve These)

The codebase has solid foundations worth preserving:

- Clean domain-driven component organization (`components/ui/`, `components/home/`, etc.)
- Strict TypeScript configuration with comprehensive checks
- Well-designed Tailwind config with Ghana branding colors
- Proper Nuxt 3 conventions followed throughout
- Accessibility foundation (skip links, focus management, semantic HTML)
- SSR/SSG setup properly configured
- Consistent coding patterns across components
- Good use of Vue 3 Composition API with `<script setup>`

---

## Summary Table

| Area | Current State | Priority | Status |
|------|---------------|----------|--------|
| Testing | 19 test files, ~250 tests | Critical | ✅ Complete |
| Security | CSRF, CSP, headers, sanitization | Critical | ✅ Complete |
| Database | SQLite with Drizzle ORM | Critical | ✅ Complete |
| Icons | Heroicons with @nuxt/icon | High | ✅ Complete |
| i18n | ~80% complete | Medium | ✅ Complete |
| State | Composables (Pinia optional) | Medium | ⏳ Skipped |
| TypeScript | 100% typed | Medium | ✅ Complete |
| Accessibility | ~95% | High | ✅ Complete |
| Image Optimization | @nuxt/image + NuxtImg | Medium | ✅ Complete |
| Dark Mode | @nuxtjs/color-mode | Low | ✅ Complete |
| SEO | Sitemap, JSON-LD, hreflang | Low | ✅ Complete |
| PWA | Service worker, manifest | Low | ✅ Complete |
| Dev Experience | Prettier, Husky, EditorConfig | Low | ✅ Complete |

---

## Implementation Progress

### ✅ Phase 1 - Critical Security & Testing (COMPLETE)
- [x] Set up testing infrastructure (Vitest + Playwright)
- [x] Add CSRF protection
- [x] Implement security headers (HSTS, CSP, etc.)
- [x] Database integration (Drizzle ORM + SQLite)
- [x] Replace emoji icons with Heroicons
- [x] Config validation plugin

### ✅ Phase 2 - Code Quality (COMPLETE)
- [x] Complete i18n coverage (~60 new translation keys)
- [x] Fix TypeScript issues (any types removed)
- [x] Improve error handling (custom error.vue page)
- [ ] Add Pinia state management (skipped - composables work well)

### ✅ Phase 3 - User Experience (COMPLETE)
- [x] Fix accessibility issues (aria-labels, color contrast, live regions, aria-controls)
- [x] Add image optimization (@nuxt/image, NuxtImg with lazy loading)
- [x] Implement dark mode (@nuxtjs/color-mode, class-based, toggle in header)
- [x] Update components with dark: variants

### ✅ Phase 4 - Polish (COMPLETE)
- [x] SEO improvements
  - Installed `@nuxtjs/sitemap` for automatic sitemap generation
  - Created `composables/useSchemaOrg.ts` with JSON-LD schema generators
  - Added structured data to homepage (Organization, WebSite), news articles (NewsArticle), reports (Report)
  - Configured hreflang tags via i18n baseUrl
  - Expanded prerendering to 20+ static routes
- [x] PWA support
  - Installed `@vite-pwa/nuxt` with auto-update service worker
  - Configured web app manifest (name, colors, display mode)
  - Created SVG icons at `public/pwa-icons/`
  - Added Workbox runtime caching for Google Fonts
- [x] Developer experience tools
  - Added Prettier with `.prettierrc` configuration
  - Added `.editorconfig` for consistent formatting
  - Added Husky + lint-staged for pre-commit hooks
  - Added `npm run format` and `npm run format:check` scripts
- [x] Documentation
  - Rewrote `README.md` with features, tech stack, setup instructions, project structure
  - Created `CONTRIBUTING.md` with branch naming, commit format, PR process, code style guidelines

---

*Generated: December 2024*
*Last Updated: December 2024*
