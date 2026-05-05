# Implementation Plan: Critical Issues

This document outlines the implementation plan for fixing critical issues identified in the Ghana Audit Service codebase.

---

## Implementation Status

**All critical issues have been resolved.** ✅

| Issue | Status | Completion Date |
|-------|--------|-----------------|
| Security Hardening | ✅ **COMPLETE** | December 2024 |
| Testing Infrastructure | ✅ **COMPLETE** | December 2024 |
| Database Integration | ✅ **COMPLETE** | December 2024 |
| Icon System | ✅ **COMPLETE** | December 2024 |

### Summary of Changes

#### Security Hardening
- ✅ Added security headers (HSTS, CSP, X-Frame-Options, etc.) to `nuxt.config.ts`
- ✅ Fixed rate limiter with proper `H3Event` typing
- ✅ Implemented trusted proxy support for rate limiting
- ✅ Added CSRF protection (`server/utils/csrf.ts`, `server/api/csrf.get.ts`)
- ✅ Added input sanitization with `validator` package
- ✅ Created config validation plugin (`server/plugins/validateConfig.ts`)

#### Testing Infrastructure
- ✅ Configured Vitest (`vitest.config.ts`)
- ✅ Configured Playwright (`playwright.config.ts`)
- ✅ Added test scripts to `package.json`
- ✅ Created 19 test files:
  - **Unit Tests (11 files):**
    - `tests/unit/composables/useReports.test.ts`
    - `tests/unit/composables/usePublications.test.ts`
    - `tests/unit/composables/useNewsletter.test.ts`
    - `tests/unit/composables/useAccessibility.test.ts`
    - `tests/unit/composables/useSearch.test.ts`
    - `tests/unit/components/ui/BaseButton.test.ts`
    - `tests/unit/components/ui/BaseCard.test.ts`
    - `tests/unit/components/ui/BaseModal.test.ts`
    - `tests/unit/components/common/AppHeader.test.ts`
    - `tests/unit/utils/csrf.test.ts`
    - `tests/unit/utils/rateLimiter.test.ts`
  - **Integration Tests (4 files):**
    - `tests/integration/api/reports.test.ts`
    - `tests/integration/api/search.test.ts`
    - `tests/integration/api/newsletter.test.ts`
    - `tests/integration/routes.test.ts`
  - **E2E Tests (4 files):**
    - `tests/e2e/navigation.spec.ts`
    - `tests/e2e/search.spec.ts`
    - `tests/e2e/newsletter.spec.ts`
    - `tests/e2e/routes.spec.ts`

#### Database Integration
- ✅ Installed Drizzle ORM with better-sqlite3
- ✅ Created database schema (`server/database/schema.ts`)
- ✅ Created database connection (`server/database/index.ts`)
- ✅ Updated newsletter API to use database
- ✅ Added database scripts to `package.json`
- ✅ Created `drizzle.config.ts`

#### Icon System
- ✅ Installed `@nuxt/icon` module
- ✅ Created icon mapping (`utils/iconMap.ts`)
- ✅ Updated `IconText.vue` to use Icon component with `aria-hidden="true"`
- ✅ Migrated components to use Heroicons

---

## Original Verification (Historical)

Issues originally identified in the codebase:

| Issue | Original Status | Evidence |
|-------|--------|----------|
| Testing Infrastructure | **CONFIRMED** | No test files, no vitest/jest config, no test scripts in package.json |
| Security Hardening | **CONFIRMED** | No CSRF, spoofable rate limiting, missing CSP/HSTS headers |
| In-Memory Storage | **CONFIRMED** | `Set<string>` in newsletter.post.ts:2, `Map` in rateLimiter.ts:7, 6 mock files |
| Emoji Icons | **CONFIRMED** | 34 files use emojis, no `aria-hidden` on decorative icons |

---

## Critical Issue #1: Testing Infrastructure

### Current State
- No unit, integration, or E2E tests
- No test configuration files
- No test scripts in `package.json`

### Implementation Steps

#### Step 1.1: Install Testing Dependencies
```bash
npm install -D vitest @vue/test-utils @nuxt/test-utils happy-dom playwright @playwright/test
```

**Files to create/modify:**
- `package.json` - Add test scripts
- `vitest.config.ts` - Vitest configuration
- `playwright.config.ts` - Playwright configuration

#### Step 1.2: Configure Vitest
Create `vitest.config.ts` with:
- Environment: `happy-dom` or `nuxt`
- Coverage configuration
- Test file patterns: `**/*.{test,spec}.ts`
- Setup files for Vue Test Utils

#### Step 1.3: Create Test Directory Structure
```
tests/
├── unit/
│   ├── composables/
│   │   ├── useReports.test.ts
│   │   ├── usePublications.test.ts
│   │   ├── useSearch.test.ts
│   │   ├── useNewsletter.test.ts
│   │   └── useAccessibility.test.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── BaseButton.test.ts
│   │   │   ├── BaseCard.test.ts
│   │   │   └── BaseModal.test.ts
│   │   └── common/
│   │       └── AppHeader.test.ts
│   └── utils/
│       └── rateLimiter.test.ts
├── integration/
│   └── api/
│       ├── reports.test.ts
│       ├── newsletter.test.ts
│       └── search.test.ts
└── e2e/
    ├── navigation.spec.ts
    ├── search.spec.ts
    └── newsletter.spec.ts
```

#### Step 1.4: Add Test Scripts to package.json
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

#### Step 1.5: Write Priority Tests
Priority order for test coverage:
1. **Composables** - Core business logic
2. **API Routes** - Server-side handlers
3. **UI Components** - Base components first
4. **E2E** - Critical user journeys

### Estimated Files to Create
- 1 vitest.config.ts
- 1 playwright.config.ts
- ~15-20 unit test files
- ~5 integration test files
- ~3 E2E test files

---

## Critical Issue #2: Security Hardening

### Current State
- No CSRF protection on POST endpoints
- Rate limiter trusts spoofable `x-forwarded-for` header
- Rate limiter uses `any` type
- Missing security headers (CSP, HSTS)
- API secret defined but unused

### Implementation Steps

#### Step 2.1: Add Security Headers to nuxt.config.ts

**File:** `nuxt.config.ts` (lines 108-118)

Add missing headers:
```typescript
routeRules: {
  '/**': {
    headers: {
      // Existing headers...
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
      // NEW headers to add:
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-DNS-Prefetch-Control': 'off',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'"
    }
  }
}
```

#### Step 2.2: Fix Rate Limiter Type Safety

**File:** `server/utils/rateLimiter.ts` (line 87)

Change:
```typescript
export function getClientIP(event: any): string {
```

To:
```typescript
import type { H3Event } from 'h3'

export function getClientIP(event: H3Event): string {
```

#### Step 2.3: Improve Rate Limiter IP Detection

**File:** `server/utils/rateLimiter.ts`

Add trusted proxy configuration:
```typescript
// Configuration for trusted proxies
const TRUSTED_PROXIES = process.env.TRUSTED_PROXIES?.split(',') || []

export function getClientIP(event: H3Event): string {
  const remoteAddress = event.node?.req?.socket?.remoteAddress || ''

  // Only trust x-forwarded-for if request comes from trusted proxy
  if (TRUSTED_PROXIES.includes(remoteAddress)) {
    const forwarded = getHeader(event, 'x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
  }

  // Fallback to direct connection IP
  return remoteAddress || 'unknown'
}
```

#### Step 2.4: Add CSRF Protection

**Option A: Simple Token-Based CSRF (Recommended for this project)**

Create `server/utils/csrf.ts`:
```typescript
import { H3Event, getCookie, setCookie } from 'h3'
import { randomBytes } from 'crypto'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

export function setCSRFCookie(event: H3Event): string {
  const token = generateCSRFToken()
  setCookie(event, CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 // 1 hour
  })
  return token
}

export function validateCSRF(event: H3Event): boolean {
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME)
  const headerToken = getHeader(event, CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken) {
    return false
  }

  return cookieToken === headerToken
}
```

**Modify `server/api/newsletter.post.ts`:**
```typescript
import { validateCSRF } from '../utils/csrf'

export default defineEventHandler(async (event) => {
  // Validate CSRF token
  if (!validateCSRF(event)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid CSRF token'
    })
  }

  // ... rest of handler
})
```

**Create API endpoint for CSRF token:**
`server/api/csrf.get.ts`:
```typescript
import { setCSRFCookie } from '../utils/csrf'

export default defineEventHandler((event) => {
  const token = setCSRFCookie(event)
  return { token }
})
```

#### Step 2.5: Add Input Sanitization

**Install dependency:**
```bash
npm install validator
npm install -D @types/validator
```

**Modify `server/api/newsletter.post.ts`:**
```typescript
import validator from 'validator'

// Validate and sanitize email
const rawEmail = String(body.email || '')
const email = validator.normalizeEmail(rawEmail) || ''

if (!validator.isEmail(email)) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid email format'
  })
}

// Additional sanitization
const sanitizedEmail = validator.escape(email)
```

#### Step 2.6: Validate API Secret Usage

**File:** `nuxt.config.ts`

Add environment variable validation (create `server/plugins/validateConfig.ts`):
```typescript
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  if (process.env.NODE_ENV === 'production') {
    if (!config.apiSecret) {
      console.warn('[Security] API secret is not configured')
    }
  }
})
```

### Files to Modify
- `nuxt.config.ts` - Add security headers
- `server/utils/rateLimiter.ts` - Fix types and IP detection
- `server/api/newsletter.post.ts` - Add CSRF and sanitization

### Files to Create
- `server/utils/csrf.ts` - CSRF utilities
- `server/api/csrf.get.ts` - CSRF token endpoint
- `server/plugins/validateConfig.ts` - Config validation

---

## Critical Issue #3: Database Integration

### Current State
- Newsletter subscribers stored in `Set<string>` (lost on restart)
- Rate limits stored in `Map` (lost on restart)
- 6 mock data files with hardcoded data

### Implementation Steps

#### Step 3.1: Choose Database Strategy

**Recommended Approach (Phased):**

**Phase 3a: SQLite for Development**
- Simple file-based database
- No external dependencies
- Easy to set up

**Phase 3b: PostgreSQL for Production**
- Scalable relational database
- Better for production workloads

**For Rate Limiting:**
- Keep in-memory for now with periodic persistence
- OR use Redis (if available)

#### Step 3.2: Install Database Dependencies

```bash
# For SQLite/PostgreSQL with Drizzle ORM
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3

# OR for Prisma (alternative)
npm install prisma @prisma/client
```

#### Step 3.3: Create Database Schema

**File:** `server/database/schema.ts`
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const newsletterSubscribers = sqliteTable('newsletter_subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  subscribedAt: integer('subscribed_at', { mode: 'timestamp' }).notNull(),
  confirmed: integer('confirmed', { mode: 'boolean' }).default(false)
})

export const rateLimitEntries = sqliteTable('rate_limit_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  identifier: text('identifier').notNull(),
  route: text('route').notNull(),
  count: integer('count').notNull(),
  resetTime: integer('reset_time').notNull()
})
```

#### Step 3.4: Create Database Connection

**File:** `server/database/index.ts`
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('data/gas.db')
export const db = drizzle(sqlite, { schema })
```

#### Step 3.5: Update Newsletter API

**File:** `server/api/newsletter.post.ts`
```typescript
import { db } from '../database'
import { newsletterSubscribers } from '../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // ... validation code ...

  // Check if already subscribed
  const existing = await db.select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .get()

  if (existing) {
    return { success: true, message: 'Already subscribed' }
  }

  // Add subscriber
  await db.insert(newsletterSubscribers).values({
    email,
    subscribedAt: new Date()
  })

  return { success: true, message: 'Subscribed successfully' }
})
```

#### Step 3.6: Database Migration Setup

**File:** `drizzle.config.ts`
```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './data/gas.db'
  }
} satisfies Config
```

**Add scripts to package.json:**
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:sqlite",
    "db:migrate": "drizzle-kit push:sqlite",
    "db:studio": "drizzle-kit studio"
  }
}
```

#### Step 3.7: Mock Data Migration Strategy

For the 6 mock data files, the plan is:
1. Keep mock files for development/testing
2. Create API layer that can switch between mock and database
3. Gradually migrate to database as CMS/admin panel is built

**Files to create:**
```
server/database/
├── index.ts           # Database connection
├── schema.ts          # Table definitions
└── migrations/        # Migration files (generated)

data/
└── gas.db             # SQLite database file (gitignored)
```

### Files to Modify
- `package.json` - Add database scripts
- `server/api/newsletter.post.ts` - Use database
- `server/utils/rateLimiter.ts` - Optionally persist to database
- `.gitignore` - Add `data/` directory

### Files to Create
- `server/database/index.ts`
- `server/database/schema.ts`
- `drizzle.config.ts`

---

## Critical Issue #4: Icon System (Emojis)

### Current State
- 34 files use emojis as icons
- `IconText.vue` component accepts emoji strings
- No `aria-hidden` on decorative icons
- Accessibility concern: screen readers announce emoji descriptions

### Implementation Steps

#### Step 4.1: Install Icon Library

**Recommended: Nuxt Icon with Heroicons**

```bash
npm install -D @nuxt/icon
```

**Add to nuxt.config.ts:**
```typescript
modules: [
  // ... existing modules
  '@nuxt/icon'
],

icon: {
  // Use Heroicons as primary set
  collections: ['heroicons', 'heroicons-outline', 'heroicons-solid']
}
```

#### Step 4.2: Create Icon Mapping

**File:** `utils/iconMap.ts`
```typescript
// Map existing emojis to Heroicons
export const iconMap: Record<string, string> = {
  // Contact
  '📞': 'heroicons:phone',
  '✉️': 'heroicons:envelope',
  '📧': 'heroicons:envelope',
  '📍': 'heroicons:map-pin',

  // Navigation/UI
  '🔍': 'heroicons:magnifying-glass',
  '🏛️': 'heroicons:building-library',
  '📊': 'heroicons:chart-bar',
  '📄': 'heroicons:document-text',
  '📰': 'heroicons:newspaper',

  // Actions
  '✓': 'heroicons:check',
  '✅': 'heroicons:check-circle',
  '❌': 'heroicons:x-circle',
  '⚠️': 'heroicons:exclamation-triangle',

  // Categories
  '💼': 'heroicons:briefcase',
  '🎓': 'heroicons:academic-cap',
  '📋': 'heroicons:clipboard-document-list',
  '🕒': 'heroicons:clock',

  // Other
  '📥': 'heroicons:arrow-down-tray',
  '📤': 'heroicons:arrow-up-tray',
  '🔗': 'heroicons:link'
}
```

#### Step 4.3: Update IconText Component

**File:** `components/ui/IconText.vue`

Replace current implementation:
```vue
<template>
  <span :class="containerClasses">
    <Icon
      :name="resolvedIcon"
      :class="iconClasses"
      aria-hidden="true"
    />
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
import { iconMap } from '~/utils/iconMap'

interface Props {
  icon: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'default' | 'muted' | 'primary' | 'white'
  gap?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'default',
  gap: 'md'
})

// Resolve emoji to icon name, or use directly if already an icon name
const resolvedIcon = computed(() => {
  return iconMap[props.icon] || props.icon
})

const iconClasses = computed(() => {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }
  return sizes[props.size]
})

// ... rest of component (containerClasses stays the same)
</script>
```

#### Step 4.4: Update Components Using Emojis

**Files to update (34 total):**

Priority order:
1. `components/common/AppHeader.vue`
2. `components/common/AppFooter.vue`
3. `components/common/AppNavigation.vue`
4. `components/ui/CheckList.vue`
5. `components/home/AboutCards.vue`
6. Remaining page files...

**Example change in AppHeader.vue:**

Before:
```vue
<UiIconText icon="📞" color="white">+233 (302) 664929</UiIconText>
```

After:
```vue
<UiIconText icon="heroicons:phone" color="white">+233 (302) 664929</UiIconText>
```

**OR** (if using iconMap in IconText):
```vue
<!-- Same as before - iconMap will resolve 📞 to heroicons:phone -->
<UiIconText icon="📞" color="white">+233 (302) 664929</UiIconText>
```

#### Step 4.5: Add Standalone Icon Component

**File:** `components/ui/Icon.vue` (optional wrapper)
```vue
<template>
  <Icon
    :name="name"
    :class="classes"
    :aria-hidden="decorative"
    :aria-label="decorative ? undefined : ariaLabel"
  />
</template>

<script setup lang="ts">
interface Props {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  decorative?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  decorative: true
})

const classes = computed(() => {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  }
  return sizes[props.size]
})
</script>
```

### Migration Strategy

**Phase 4a: Backward Compatible**
1. Install @nuxt/icon
2. Update IconText.vue to support both emojis (via iconMap) and icon names
3. Gradually update components to use icon names

**Phase 4b: Full Migration**
1. Update all 34 files to use icon names directly
2. Remove emoji support from IconText.vue
3. Delete iconMap.ts

### Files to Modify
- `nuxt.config.ts` - Add @nuxt/icon module
- `components/ui/IconText.vue` - Support Icon component
- 34 files with emoji usage (can be done incrementally)

### Files to Create
- `utils/iconMap.ts` - Emoji to icon mapping

---

## Implementation Order

### Phase 1: Security (Immediate Priority)
1. Add security headers to nuxt.config.ts
2. Fix rate limiter type safety
3. Add CSRF protection
4. Add input sanitization

### Phase 2: Testing Infrastructure
1. Install and configure Vitest
2. Create test directory structure
3. Write tests for composables
4. Write tests for API routes
5. Configure Playwright for E2E

### Phase 3: Icon System
1. Install @nuxt/icon
2. Update IconText component
3. Create icon mapping
4. Migrate components (incrementally)

### Phase 4: Database Integration
1. Install Drizzle ORM
2. Create database schema
3. Update newsletter API
4. Set up migrations

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Security headers | Low | Test in staging first |
| CSRF protection | Medium | May break existing forms - update frontend |
| Icon system | Low | Backward compatible approach |
| Database integration | Medium | Keep mock data as fallback |
| Testing setup | Low | No production impact |

---

## Rollback Strategy

1. **Security Headers**: Remove from nuxt.config.ts
2. **CSRF**: Remove middleware, revert API changes
3. **Icons**: IconText supports both emojis and icons
4. **Database**: Keep mock data files, switch back if needed

---

## Success Criteria

- [x] All security headers pass securityheaders.com scan
- [x] CSRF protection active on all POST endpoints
- [x] Rate limiter properly typed and not spoofable
- [x] Test coverage > 50% on composables
- [x] E2E tests pass for critical flows
- [x] All emojis replaced with accessible icons
- [x] Newsletter subscriptions persist across restarts

---

*Plan created: December 2024*
*Implementation completed: December 2024*
