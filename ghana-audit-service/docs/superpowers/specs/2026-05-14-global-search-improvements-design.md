# Global Search Improvements Design

## Problem

The global search has three issues:
1. The header SearchBar only navigates to `/search` — it shows no inline results preview
2. The `/search` results page has dark mode gaps (missing `dark:` classes on main section and form input)
3. No keyboard shortcut exists for triggering search (Ctrl+K / Cmd+K)

## Solution

### 1. Search Command Palette (`components/search/SearchCommandPalette.vue`)

A modal overlay that replaces the current header slide-down SearchBar.

**Triggers:**
- `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac) from anywhere on the site
- Clicking the search icon in `AppHeader.vue`

**Layout:**
- Centered modal, max-width ~600px, rendered via `<Teleport to="body">`
- Backdrop overlay with `bg-black/50` and click-to-close
- Input at top with magnifying glass icon and `Ctrl+K` keyboard hint badge

**Live search:**
- Debounced at 300ms using the existing `useSearch()` composable
- Results grouped by content type with type badges (reusing `UiBadge` component)
- Max ~8 results shown in the preview list
- Each result: type badge, title (clickable), excerpt (1-line truncated), publish date

**Interaction:**
- Clicking a result navigates directly to that item's page and closes the modal
- Footer shows "View all X results" link → navigates to `/search?q=...`
- Escape key or backdrop click closes the modal
- Arrow Up/Down moves a highlight through results, Enter selects the highlighted item

**Accessibility (WCAG 2.1 AA):**
- `role="dialog"`, `aria-modal="true"`, `aria-label="Search"`
- Focus trap: Tab cycles within the modal while open
- `aria-live="polite"` on the results region to announce result counts
- `aria-activedescendant` for keyboard-navigated highlight
- Auto-focus input on open, restore focus to trigger on close

### 2. Global Keyboard Shortcut Composable (`composables/useSearchShortcut.ts`)

- Listens for `Ctrl+K` / `Cmd+K` globally via `keydown` event
- Calls `preventDefault()` to suppress the browser's address bar focus
- Toggles the search palette state (provided via `useState` for cross-component access)
- Skips activation when focus is inside `<input>`, `<textarea>`, or `contenteditable` elements
- Registered in `app.vue` or `layouts/default.vue` so it's site-wide

### 3. Header Integration Changes (`components/common/AppHeader.vue`)

- Search icon button toggles the `SearchCommandPalette` instead of `isSearchOpen`
- Remove the slide-down `<Transition>` block with `<CommonSearchBar />`
- `CommonSearchBar.vue` remains in the codebase but is no longer rendered in the header
- The `SearchCommandPalette` is mounted once (always in DOM, visibility-toggled)

### 4. Dark/Light Theme Treatment

**Command Palette:**
- Light: `bg-white`, `border-gray-200`, `shadow-2xl`
- Dark: `bg-gray-800`, `border-gray-700`, results hover `bg-gray-700`
- Active/selected result highlight: `bg-primary/10` border-l `border-primary`
- Keyboard hint badge: `bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400`

**Search results page (`pages/search.vue`) fixes:**
- Main section: `bg-gray-50` → `bg-gray-50 dark:bg-gray-900`
- Inline search input: add `dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-primary-light`
- Clear button: add `dark:text-gray-500 dark:hover:text-gray-300`
- `SearchResultCard`: enhance hover with `hover:border-primary/30 dark:hover:border-primary-light/30`

### 5. Search State Management

Use Nuxt's `useState` for the palette open/close state so both `AppHeader` and the keyboard shortcut composable can toggle it:

```typescript
const isSearchPaletteOpen = useState('searchPalette', () => false)
```

### 6. i18n Updates

Add keys to both `en.json` and `ak.json`:
- `search.commandPalette.placeholder` — "Search reports, publications, news..."
- `search.commandPalette.hint` — "Type to search"
- `search.commandPalette.viewAll` — "View all {count} results"
- `search.commandPalette.noResults` — "No results found"
- `search.commandPalette.recentSearches` — "Recent searches"

## Files to Create

| File | Purpose |
|------|---------|
| `components/search/SearchCommandPalette.vue` | Modal command palette with live search |
| `composables/useSearchShortcut.ts` | Global Ctrl+K / Cmd+K listener |

## Files to Modify

| File | Changes |
|------|---------|
| `components/common/AppHeader.vue` | Replace slide-down SearchBar with command palette toggle |
| `pages/search.vue` | Add missing dark: classes on section and form input |
| `components/search/SearchResultCard.vue` | Enhance hover treatment for both themes |
| `i18n/locales/en.json` | Add command palette i18n keys |
| `i18n/locales/ak.json` | Add command palette i18n keys (Akan translations) |

## Out of Scope

- Search-as-you-type on the `/search` page (it already has manual "Apply Filters" which is intentional)
- Recent searches / search history persistence (can be added later)
- Server-side API changes (the existing `/api/search` endpoint is sufficient)
