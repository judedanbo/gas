# Global Search Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the header's navigate-only SearchBar with a Ctrl+K command palette modal featuring live search results, fix dark mode gaps on the /search page, and add keyboard shortcut support.

**Architecture:** A new `SearchCommandPalette.vue` component (teleported to body) provides the modal UI with debounced live search via the existing `useSearch()` composable. A `useSearchShortcut.ts` composable handles global Ctrl+K/Cmd+K interception. Shared open/close state uses Nuxt's `useState`. The header search icon and keyboard shortcut both toggle this shared state.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Tailwind CSS (class-based dark mode), `@nuxtjs/color-mode`, `@nuxtjs/i18n`, existing `useSearch()` composable + `/api/search` endpoint.

---

### Task 1: Add i18n Keys for Command Palette

**Files:**
- Modify: `i18n/locales/en.json:115-127`
- Modify: `i18n/locales/ak.json:115-127`

- [ ] **Step 1: Add English i18n keys**

In `i18n/locales/en.json`, add `commandPalette` nested under the existing `search` object (after the `applyFilters` key on line 126):

```json
"search": {
  "title": "Search Results",
  "placeholder": "Search reports, publications, news...",
  "noResults": "No results found",
  "resultsFor": "Showing results for",
  "filters": "Filters",
  "type": "Content Type",
  "dateRange": "Date Range",
  "from": "From",
  "to": "To",
  "clearFilters": "Clear Filters",
  "applyFilters": "Apply Filters",
  "commandPalette": {
    "placeholder": "Search reports, publications, news...",
    "hint": "Type to search",
    "viewAll": "View all {count} results",
    "noResults": "No results found for \"{query}\"",
    "close": "Close",
    "shortcutHint": "to open search"
  }
}
```

- [ ] **Step 2: Add Akan i18n keys**

In `i18n/locales/ak.json`, add the same `commandPalette` nested under `search`:

```json
"search": {
  "title": "Hwehwɛ Nsɛm",
  "placeholder": "Hwehwɛ amanneɛbɔ, nwoma, nsɛm...",
  "noResults": "Yɛanhunu hwee",
  "resultsFor": "Ɛkyerɛ nsɛm a ɛfa ho",
  "filters": "Nneɛma A Ɛhwehwɛ",
  "type": "Nsɛm No Sɛso",
  "dateRange": "Da Ntamu",
  "from": "Firi",
  "to": "Kɔsi",
  "clearFilters": "Yi Filters",
  "applyFilters": "Fa Filters Di Dwuma",
  "commandPalette": {
    "placeholder": "Hwehwɛ amanneɛbɔ, nwoma, nsɛm...",
    "hint": "Kyerɛw na hwehwɛ",
    "viewAll": "Hwɛ nsɛm {count} nyinaa",
    "noResults": "Yɛanhunu hwee a ɛfa \"{query}\" ho",
    "close": "To mu",
    "shortcutHint": "bue hwehwɛ"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add i18n/locales/en.json i18n/locales/ak.json
git commit -m "feat(i18n): add command palette search keys for en and ak"
```

---

### Task 2: Create `useSearchShortcut` Composable

**Files:**
- Create: `composables/useSearchShortcut.ts`
- Create: `tests/unit/composables/useSearchShortcut.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/composables/useSearchShortcut.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

const mockState = ref(false)
vi.stubGlobal('useState', vi.fn((_key: string, init: () => boolean) => {
  mockState.value = init()
  return mockState
}))

describe('useSearchShortcut', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockState.value = false
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('should toggle palette open on Ctrl+K', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    expect(isOpen.value).toBe(false)

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    Object.defineProperty(event, 'defaultPrevented', { value: false })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(isOpen.value).toBe(true)
  })

  it('should toggle palette open on Meta+K (Mac)', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(true)
  })

  it('should close palette on Escape when open', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    isOpen.value = true

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
  })

  it('should not toggle when focus is on an input element', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    })
    vi.spyOn(event, 'preventDefault')
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
    document.body.removeChild(input)
  })

  it('should not toggle when focus is on a textarea', async () => {
    const { useSearchShortcut } = await import('../../../composables/useSearchShortcut')
    const { isOpen, destroy } = useSearchShortcut()
    cleanup = destroy

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    })
    window.dispatchEvent(event)

    expect(isOpen.value).toBe(false)
    document.body.removeChild(textarea)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ghana-audit-service && npx vitest run tests/unit/composables/useSearchShortcut.test.ts`
Expected: FAIL — module `composables/useSearchShortcut` does not exist.

- [ ] **Step 3: Write the composable**

Create `composables/useSearchShortcut.ts`:

```typescript
export function useSearchShortcut() {
  const isOpen = useState('searchPalette', () => false)

  function shouldIgnore(): boolean {
    const active = document.activeElement
    if (!active) return false
    const tag = active.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if ((active as HTMLElement).isContentEditable) return true
    return false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      if (shouldIgnore()) return
      e.preventDefault()
      isOpen.value = !isOpen.value
      return
    }

    if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false
    }
  }

  if (import.meta.client) {
    window.addEventListener('keydown', handleKeydown)
  }

  function destroy() {
    window.removeEventListener('keydown', handleKeydown)
  }

  return { isOpen, destroy }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ghana-audit-service && npx vitest run tests/unit/composables/useSearchShortcut.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add composables/useSearchShortcut.ts tests/unit/composables/useSearchShortcut.test.ts
git commit -m "feat(search): add useSearchShortcut composable with Ctrl+K/Cmd+K support"
```

---

### Task 3: Create `SearchCommandPalette.vue` Component

**Files:**
- Create: `components/search/SearchCommandPalette.vue`

This is the core UI component. It uses `useState('searchPalette')` for open/close, `useSearch()` for data, debounced input, keyboard navigation, and full dark/light theme support.

- [ ] **Step 1: Create the component**

Create `components/search/SearchCommandPalette.vue`:

```vue
<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        @keydown.esc.stop="close"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="close"
        />

        <!-- Palette -->
        <div
          ref="paletteRef"
          class="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          @keydown.arrow-down.prevent="moveHighlight(1)"
          @keydown.arrow-up.prevent="moveHighlight(-1)"
          @keydown.enter.prevent="selectHighlighted"
        >
          <!-- Search Input -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Icon
              name="heroicons:magnifying-glass"
              class="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
              aria-hidden="true"
            />
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              class="flex-1 bg-transparent border-none outline-none text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              :placeholder="$t('search.commandPalette.placeholder')"
              aria-label="Search"
              aria-autocomplete="list"
              :aria-activedescendant="highlightedId"
              aria-controls="search-results-list"
            />
            <kbd
              class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
            >
              Esc
            </kbd>
          </div>

          <!-- Results Area -->
          <div
            id="search-results-list"
            role="listbox"
            aria-label="Search results"
            class="max-h-[50vh] overflow-y-auto"
          >
            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              <span class="sr-only">{{ $t('common.loading') }}</span>
            </div>

            <!-- Hint (no query) -->
            <div
              v-else-if="!query.trim()"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              <Icon
                name="heroicons:magnifying-glass"
                class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p>{{ $t('search.commandPalette.hint') }}</p>
              <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs border border-gray-200 dark:border-gray-600">Ctrl+K</kbd>
                {{ $t('search.commandPalette.shortcutHint') }}
              </p>
            </div>

            <!-- No Results -->
            <div
              v-else-if="results.length === 0 && !loading"
              class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              <Icon
                name="heroicons:inbox"
                class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p>{{ $t('search.commandPalette.noResults', { query: query }) }}</p>
            </div>

            <!-- Results List -->
            <template v-else>
              <div
                v-for="(group, groupIndex) in groupedResults"
                :key="group.type"
              >
                <div class="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {{ $t(`searchTypes.${group.type}`) }}
                </div>
                <div
                  v-for="(result, resultIndex) in group.items"
                  :id="`search-result-${flatIndex(groupIndex, resultIndex)}`"
                  :key="result.id"
                  role="option"
                  :aria-selected="highlightIndex === flatIndex(groupIndex, resultIndex)"
                  class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  :class="highlightIndex === flatIndex(groupIndex, resultIndex)
                    ? 'bg-primary/10 dark:bg-primary/20 border-l-2 border-primary'
                    : 'border-l-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'"
                  @click="navigateTo(result)"
                  @mouseenter="highlightIndex = flatIndex(groupIndex, resultIndex)"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ result.title }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ result.excerpt }}
                    </p>
                  </div>
                  <span v-if="result.publishedAt" class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {{ formatDateShort(result.publishedAt) }}
                  </span>
                </div>
              </div>

              <!-- Live region for screen readers -->
              <div class="sr-only" aria-live="polite" aria-atomic="true">
                {{ meta.total }} results found
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div
            v-if="results.length > 0"
            class="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs"
          >
            <NuxtLink
              :to="viewAllLink"
              class="text-primary dark:text-primary-light hover:underline font-medium"
              @click="close"
            >
              {{ $t('search.commandPalette.viewAll', { count: meta.total }) }}
            </NuxtLink>
            <div class="flex items-center gap-2 text-gray-400 dark:text-gray-500">
              <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">&uarr;</kbd><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">&darr;</kbd> navigate</span>
              <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">&crarr;</kbd> select</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { SearchResult } from '~/types'

const router = useRouter()
const localePath = useLocalePath()
const { formatDateShort } = useLocaleDate()
const { results, loading, meta, search, clearResults } = useSearch()

const isOpen = useState('searchPalette', () => false)
const query = ref('')
const highlightIndex = ref(-1)
const paletteRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined

interface ResultGroup {
  type: string
  items: SearchResult[]
}

const groupedResults = computed<ResultGroup[]>(() => {
  const groups = new Map<string, SearchResult[]>()
  const maxResults = 8
  let count = 0
  for (const result of results.value) {
    if (count >= maxResults) break
    const existing = groups.get(result.type)
    if (existing) {
      existing.push(result)
    } else {
      groups.set(result.type, [result])
    }
    count++
  }
  return Array.from(groups, ([type, items]) => ({ type, items }))
})

const flatResults = computed(() => groupedResults.value.flatMap(g => g.items))

function flatIndex(groupIndex: number, resultIndex: number): number {
  let idx = 0
  for (let i = 0; i < groupIndex; i++) {
    idx += groupedResults.value[i].items.length
  }
  return idx + resultIndex
}

const highlightedId = computed(() =>
  highlightIndex.value >= 0 ? `search-result-${highlightIndex.value}` : undefined
)

const viewAllLink = computed(() => ({
  path: localePath('/search'),
  query: { q: query.value }
}))

function debouncedSearch() {
  clearTimeout(debounceTimer)
  highlightIndex.value = -1
  const q = query.value.trim()
  if (q.length < 2) {
    clearResults()
    return
  }
  debounceTimer = setTimeout(() => {
    search({ query: q, perPage: 10 })
  }, 300)
}

watch(query, debouncedSearch)

function moveHighlight(delta: number) {
  const total = flatResults.value.length
  if (total === 0) return
  highlightIndex.value = (highlightIndex.value + delta + total) % total
}

function selectHighlighted() {
  const result = flatResults.value[highlightIndex.value]
  if (result) {
    navigateTo(result)
  } else if (query.value.trim()) {
    router.push(viewAllLink.value)
    close()
  }
}

function navigateTo(result: SearchResult) {
  router.push(localePath(result.url))
  close()
}

function close() {
  isOpen.value = false
}

watch(isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    nextTick(() => inputRef.value?.focus())
  } else {
    document.body.style.overflow = ''
    query.value = ''
    highlightIndex.value = -1
    clearResults()
    clearTimeout(debounceTimer)
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
  clearTimeout(debounceTimer)
})
</script>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s ease;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}

.palette-enter-active > div:last-child,
.palette-leave-active > div:last-child {
  transition: transform 0.15s ease;
}

.palette-enter-from > div:last-child,
.palette-leave-to > div:last-child {
  transform: scale(0.95) translateY(-10px);
}
</style>
```

- [ ] **Step 2: Verify the component renders without errors by running typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: No errors related to `SearchCommandPalette`.

- [ ] **Step 3: Commit**

```bash
git add components/search/SearchCommandPalette.vue
git commit -m "feat(search): create SearchCommandPalette modal with live search and keyboard nav"
```

---

### Task 4: Integrate Command Palette into AppHeader and App

**Files:**
- Modify: `components/common/AppHeader.vue:155-201,254-259`
- Modify: `app.vue:18-31`

- [ ] **Step 1: Update AppHeader — replace slide-down SearchBar with command palette toggle**

In `components/common/AppHeader.vue`:

**Replace** the search button (lines 155-163) to toggle `searchPalette` state instead of `isSearchOpen`:

```html
<!-- Search Button -->
<button
  class="touch-target bg-transparent border-none p-2 cursor-pointer text-gray-600 dark:text-gray-300 hover:text-primary transition-colors flex items-center justify-center"
  aria-label="Open search (Ctrl+K)"
  @click="openSearch"
>
  <Icon name="heroicons:magnifying-glass" class="w-6 h-6" aria-hidden="true" />
</button>
```

**Remove** the slide-down search bar block (lines 192-201 — the entire `<Transition name="slide-down">` wrapping `<CommonSearchBar />`):

```html
<!-- DELETE THIS BLOCK -->
<!-- Search Bar (Expandable) -->
<Transition name="slide-down">
  <div
    v-if="isSearchOpen"
    class="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 py-4"
  >
    <div class="container">
      <CommonSearchBar @close="toggleSearch" />
    </div>
  </div>
</Transition>
```

**Add** after the closing `</header>` tag (but inside the template root), mount the palette:

```html
<SearchSearchCommandPalette />
```

**In `<script setup>`**, replace `isSearchOpen` and `toggleSearch`:

Remove:
```typescript
const isSearchOpen = ref(false)
```

Add:
```typescript
const isSearchPaletteOpen = useState('searchPalette', () => false)
```

Replace the `toggleSearch` function:
```typescript
const openSearch = () => {
  isSearchPaletteOpen.value = true
  isMobileMenuOpen.value = false
}
```

Update the `toggleMobileMenu` function — replace `isSearchOpen.value = false` with `isSearchPaletteOpen.value = false`:
```typescript
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isMobileMenuOpen.value) {
    isSearchPaletteOpen.value = false
  }
}
```

Update the route watcher — replace `isSearchOpen.value = false` with `isSearchPaletteOpen.value = false`:
```typescript
watch(
  () => route.path,
  () => {
    isMobileMenuOpen.value = false
    isSearchPaletteOpen.value = false
  }
)
```

Remove `aria-expanded` from the search button (the palette is a separate dialog, not an expandable region).

- [ ] **Step 2: Register the global keyboard shortcut in app.vue**

In `app.vue`, add `useSearchShortcut()` call inside `<script setup>`:

```typescript
<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'en'
  }
})

const { init: initAccessibility } = useAccessibility()
useSearchShortcut()

onMounted(() => {
  initAccessibility()
})
</script>
```

Since `useSearchShortcut` uses `import.meta.client` internally, it's safe to call in `<script setup>` — the listener only attaches on the client.

- [ ] **Step 3: Verify the app builds and typecheck passes**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit 2>&1 | head -30`
Expected: Clean output (no type errors).

- [ ] **Step 4: Commit**

```bash
git add components/common/AppHeader.vue app.vue
git commit -m "feat(search): integrate command palette into header and register Ctrl+K shortcut"
```

---

### Task 5: Fix Dark Mode on /search Page

**Files:**
- Modify: `pages/search.vue:15,32-33,39-40`
- Modify: `components/search/SearchResultCard.vue:2`

- [ ] **Step 1: Fix the main section background**

In `pages/search.vue` line 15, change:

```html
<section class="section bg-gray-50">
```

to:

```html
<section class="section bg-gray-50 dark:bg-gray-900">
```

- [ ] **Step 2: Fix the search input dark mode classes**

In `pages/search.vue` line 32-33, change the input classes from:

```
class="w-full py-3 px-4 pl-12 pr-10 text-base border-2 border-gray-300 rounded-lg bg-white transition-colors focus:outline-none focus:border-primary"
```

to:

```
class="w-full py-3 px-4 pl-12 pr-10 text-base border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white transition-colors focus:outline-none focus:border-primary dark:focus:border-primary-light"
```

- [ ] **Step 3: Fix the clear button dark mode**

In `pages/search.vue` lines 39-40, change the clear button classes from:

```
class="absolute right-3 bg-transparent border-none p-2 cursor-pointer text-gray-400 text-lg leading-none hover:text-gray-600"
```

to:

```
class="absolute right-3 bg-transparent border-none p-2 cursor-pointer text-gray-400 dark:text-gray-500 text-lg leading-none hover:text-gray-600 dark:hover:text-gray-300"
```

- [ ] **Step 4: Enhance SearchResultCard hover treatment**

In `components/search/SearchResultCard.vue` line 2, change:

```html
<article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
```

to:

```html
<article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md hover:border-primary/30 dark:hover:border-primary-light/30 transition-all">
```

- [ ] **Step 5: Fix the Help Section dark mode**

In `pages/search.vue` line 257, the help section uses `bg-white` without dark variant. Change:

```html
<section class="section bg-white">
```

to:

```html
<section class="section bg-white dark:bg-gray-800">
```

- [ ] **Step 6: Commit**

```bash
git add pages/search.vue components/search/SearchResultCard.vue
git commit -m "fix(search): add missing dark mode classes on search page and result cards"
```

---

### Task 6: Manual Testing and Verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd ghana-audit-service && npx vitest run`
Expected: All tests pass, including the new `useSearchShortcut.test.ts`.

- [ ] **Step 2: Run lint**

Run: `cd ghana-audit-service && npm run lint`
Expected: No lint errors.

- [ ] **Step 3: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Start dev server and test in browser**

Run: `cd ghana-audit-service && npm run dev`

Test the following scenarios in the browser at `http://localhost:3000`:

1. **Ctrl+K shortcut:** Press Ctrl+K from any page — the command palette modal should appear centered with backdrop overlay.
2. **Search icon:** Click the magnifying glass in the header — same modal opens.
3. **Live search:** Type "audit" — after 300ms debounce, results should appear grouped by type (reports, news, etc.) with title, excerpt, and date.
4. **Keyboard navigation:** Press Arrow Down/Up to highlight results. Press Enter to navigate to the highlighted result.
5. **Mouse interaction:** Click a result — navigates to that page and closes the modal.
6. **View all link:** With results showing, click "View all X results" in the footer — navigates to `/search?q=...`.
7. **Close:** Press Escape or click the backdrop — modal closes.
8. **Dark mode:** Toggle dark mode via the header moon/sun icon. Verify the command palette and `/search` page both render correctly in dark mode — no white-on-white or invisible text.
9. **Shortcut suppression:** Focus on an input field on any page (e.g., the contact form), press Ctrl+K — the palette should NOT open.
10. **Mobile:** Resize to mobile width. The search icon should still open the palette. The modal should be responsive (full width with padding).

- [ ] **Step 5: Fix any issues found during manual testing**

If any issues are found, fix them and re-run the tests/typecheck.

- [ ] **Step 6: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(search): address issues found during manual testing"
```
