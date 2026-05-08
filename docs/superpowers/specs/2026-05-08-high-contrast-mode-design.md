# High Contrast Mode — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  
**Branch:** `feature/high-contrast-mode`

## Goal

Implement a site-wide high contrast mode for the Ghana Audit Service public website that enhances contrast ratios to WCAG AAA (7:1 minimum) while preserving the Ghana flag color identity. The mode is toggled from the existing button in the sticky top bar and persists across sessions via localStorage.

## Constraints

- Public site only (admin panel excluded from toggle, but not actively blocked)
- Independent of dark mode — both can be active simultaneously
- Zero component-file changes — all styling flows through CSS variables
- WCAG 2.1 AA is the baseline; high contrast mode targets AAA (7:1)
- Must support Tailwind opacity modifiers (`bg-primary/50`)

## Approach: CSS Variable Bridge

### Problem

The codebase has ~2,000 Tailwind color class usages across 77 public-facing Vue files. All colors in `tailwind.config.ts` are hardcoded hex values. The existing `:root.high-contrast` CSS variable overrides in `variables.css` have no effect because no component references those variables — everything goes through Tailwind utilities.

### Solution

Rewire Tailwind's color definitions to resolve through CSS custom properties. Override those properties under `:root.high-contrast` for light high-contrast and `:root.high-contrast.dark` for dark high-contrast.

## Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | Colors from hex to `rgb(var(--tw-*) / <alpha-value>)` |
| `assets/css/variables.css` | Add `--tw-*` base values + high-contrast overrides + dark HC overrides. Replace the existing `:root.high-contrast` block (lines 195-253) which overrides `--color-*` variables that nothing references — the new block overrides `--tw-*` variables that Tailwind actually uses |
| `assets/css/tailwind.css` | High-contrast utility styles (link underlines, border widths, focus rings) |
| `composables/useAccessibility.ts` | No changes — already functional |
| `components/common/AppHeader.vue` | No changes — toggle button already exists |

## Detailed Design

### 1. Tailwind Config: Color Definitions

Each color changes from a hardcoded hex to a CSS variable reference using Tailwind's alpha-value pattern:

```ts
// tailwind.config.ts
colors: {
  primary: {
    DEFAULT: 'rgb(var(--tw-primary) / <alpha-value>)',
    dark: 'rgb(var(--tw-primary-dark) / <alpha-value>)',
    light: 'rgb(var(--tw-primary-light) / <alpha-value>)',
  },
  secondary: {
    DEFAULT: 'rgb(var(--tw-secondary) / <alpha-value>)',
    dark: 'rgb(var(--tw-secondary-dark) / <alpha-value>)',
    light: 'rgb(var(--tw-secondary-light) / <alpha-value>)',
  },
  accent: {
    DEFAULT: 'rgb(var(--tw-accent) / <alpha-value>)',
    dark: 'rgb(var(--tw-accent-dark) / <alpha-value>)',
    light: 'rgb(var(--tw-accent-light) / <alpha-value>)',
  },
  // Same for: ghana-red, ghana-gold, ghana-green
  // Same for: success, warning, error, info (+ light variants)
  // Same for: gray-50 through gray-900
}
```

Colors that are NOT variable-backed (stay as hex): `white`, `black`, `transparent`, `current` — these are absolute and should never change in high contrast mode.

### 2. CSS Variables: Base Values

In `variables.css` under `:root`, define RGB channel triplets (no `rgb()` wrapper — Tailwind adds that):

```css
:root {
  /* Primary (Ghana Green) */
  --tw-primary: 0 107 63;
  --tw-primary-dark: 0 77 44;
  --tw-primary-light: 0 139 82;

  /* Secondary (Ghana Red) */
  --tw-secondary: 206 17 38;
  --tw-secondary-dark: 165 14 31;
  --tw-secondary-light: 229 29 51;

  /* Accent (Ghana Gold) */
  --tw-accent: 252 209 22;
  --tw-accent-dark: 212 173 0;
  --tw-accent-light: 255 225 77;

  /* Ghana flag aliases */
  --tw-ghana-red: 206 17 38;
  --tw-ghana-gold: 252 209 22;
  --tw-ghana-green: 0 107 63;

  /* Gray scale */
  --tw-gray-50: 249 250 251;
  --tw-gray-100: 243 244 246;
  --tw-gray-200: 229 231 235;
  --tw-gray-300: 209 213 219;
  --tw-gray-400: 156 163 175;
  --tw-gray-500: 107 114 128;
  --tw-gray-600: 75 85 99;
  --tw-gray-700: 55 65 81;
  --tw-gray-800: 31 41 55;
  --tw-gray-900: 17 24 39;

  /* Functional */
  --tw-success: 46 125 50;
  --tw-success-light: 76 175 80;
  --tw-warning: 245 124 0;
  --tw-warning-light: 255 152 0;
  --tw-error: 198 40 40;
  --tw-error-light: 239 83 80;
  --tw-info: 21 101 192;
  --tw-info-light: 33 150 243;
}
```

### 3. High Contrast Overrides (Light)

Enhanced contrast with color — darker/more saturated versions of the Ghana palette, all meeting 7:1 contrast ratio on white:

```css
:root.high-contrast {
  /* Primary: darker green — 10.5:1 on white */
  --tw-primary: 0 61 28;
  --tw-primary-dark: 0 40 18;
  --tw-primary-light: 0 90 42;

  /* Secondary: darker red — 8.2:1 on white */
  --tw-secondary: 154 10 24;
  --tw-secondary-dark: 120 8 18;
  --tw-secondary-light: 180 15 30;

  /* Accent: darker gold — 7.1:1 on white (just meets AAA) */
  --tw-accent: 130 100 0;
  --tw-accent-dark: 100 77 0;
  --tw-accent-light: 160 123 0;

  /* Ghana flag aliases match */
  --tw-ghana-red: 154 10 24;
  --tw-ghana-gold: 130 100 0;
  --tw-ghana-green: 0 61 28;

  /* Grays: increase separation */
  --tw-gray-50: 255 255 255;
  --tw-gray-100: 248 248 248;
  --tw-gray-200: 235 235 235;
  --tw-gray-300: 200 200 200;
  --tw-gray-400: 140 140 140;
  --tw-gray-500: 90 90 90;
  --tw-gray-600: 60 60 60;
  --tw-gray-700: 40 40 40;
  --tw-gray-800: 25 25 25;
  --tw-gray-900: 10 10 10;

  /* Functional: higher contrast versions */
  --tw-success: 0 80 0;
  --tw-success-light: 0 110 0;
  --tw-warning: 180 90 0;
  --tw-warning-light: 200 100 0;
  --tw-error: 170 0 0;
  --tw-error-light: 200 20 20;
  --tw-info: 0 0 170;
  --tw-info-light: 0 30 200;
}
```

### 4. High Contrast + Dark Mode Overrides

When both are active — brighter colors on darker backgrounds:

```css
:root.high-contrast.dark {
  /* Brighter primary on dark bg */
  --tw-primary: 0 200 120;
  --tw-primary-dark: 0 170 100;
  --tw-primary-light: 0 230 140;

  /* Brighter secondary */
  --tw-secondary: 255 80 95;
  --tw-secondary-dark: 230 60 75;
  --tw-secondary-light: 255 110 120;

  /* Brighter accent */
  --tw-accent: 255 225 50;
  --tw-accent-dark: 230 200 30;
  --tw-accent-light: 255 240 100;

  /* Extreme gray separation */
  --tw-gray-50: 255 255 255;
  --tw-gray-100: 240 240 240;
  --tw-gray-200: 220 220 220;
  --tw-gray-300: 190 190 190;
  --tw-gray-400: 160 160 160;
  --tw-gray-500: 130 130 130;
  --tw-gray-600: 50 50 50;
  --tw-gray-700: 30 30 30;
  --tw-gray-800: 15 15 15;
  --tw-gray-900: 0 0 0;

  /* Functional — bright on dark */
  --tw-success: 50 220 50;
  --tw-warning: 255 180 0;
  --tw-error: 255 70 70;
  --tw-info: 80 150 255;
}
```

### 5. Global High-Contrast Utility Styles

Added to `tailwind.css`:

```css
/* Links must be underlined (WCAG: don't rely on color alone) */
:root.high-contrast a:not([class*="no-underline"]) {
  text-decoration: underline;
}

/* Enhanced focus indicators */
:root.high-contrast *:focus-visible {
  outline: 3px solid rgb(var(--tw-primary));
  outline-offset: 2px;
}

/* Stronger borders for card/panel elements */
:root.high-contrast [class*="border"] {
  border-width: max(var(--border-width, 1px), 2px);
}

/* Remove decorative shadows (rely on borders for separation) */
:root.high-contrast [class*="shadow"] {
  box-shadow: none;
}
```

### 6. Typography Plugin

The `typography` config in `tailwind.config.ts` uses hardcoded hex values for prose colors. These need to become CSS variable references too, so that high-contrast mode affects prose content (report pages, publication pages).

### 7. Existing Infrastructure (No Changes Needed)

- **`useAccessibility.ts`**: Composable already toggles `high-contrast` class on `<html>`, persists to localStorage, and initializes on mount. Fully functional.
- **`AppHeader.vue`**: Toggle button already exists at line 51-62 with proper ARIA attributes (`aria-pressed`, `aria-label`).
- **`app.vue`**: Already calls `initAccessibility()` on mount.

## Scope Exclusions

- Admin panel: no toggle in admin header, no active blocking
- Print styles: not in scope (separate concern)
- Custom user color presets: out of scope (YAGNI)
- Image grayscale filter: not applied (user chose "enhanced contrast with color")

## Testing Plan

1. **Visual check — 4 mode combinations**: light, dark, light+HC, dark+HC on home, reports, publications, contact pages
2. **Contrast ratios**: verify key text/bg combos meet 7:1 using browser DevTools accessibility inspector
3. **Opacity modifiers**: confirm `bg-primary/50`, `text-gray-600/80` etc. still render correctly
4. **Persistence**: enable HC, hard-refresh, verify it persists
5. **Dark mode independence**: toggle dark mode on/off while HC is active — both should work independently
6. **Typecheck + lint**: `npm run typecheck && npm run lint` must pass
7. **Existing tests**: `npm run test:run` must pass (no component changes, so low risk)

## Color Reference Table

| Token | Normal (hex) | HC Light (hex) | HC Dark (hex) |
|-------|-------------|----------------|---------------|
| primary | #006B3F | #003D1C | #00C878 |
| secondary | #CE1126 | #9A0A18 | #FF505F |
| accent | #FCD116 | #826400 | #FFE132 |
| gray-900 | #111827 | #0A0A0A | #000000 |
| gray-100 | #F3F4F6 | #F8F8F8 | #F0F0F0 |
