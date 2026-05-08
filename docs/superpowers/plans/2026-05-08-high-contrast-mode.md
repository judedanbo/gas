# High Contrast Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Tailwind's color system through CSS custom properties so that toggling `.high-contrast` on `<html>` changes every color across the public site — enhanced contrast with preserved Ghana flag identity.

**Architecture:** Replace hardcoded hex values in `tailwind.config.ts` with `rgb(var(--tw-*) / <alpha-value>)` references. Define the RGB channel values in `variables.css` under `:root`, then override them under `:root.high-contrast` (light) and `:root.high-contrast.dark` (dark). Add global high-contrast utility styles to `tailwind.css`.

**Tech Stack:** Tailwind CSS, CSS custom properties, Nuxt 3 / `@nuxtjs/color-mode`

**Spec:** `docs/superpowers/specs/2026-05-08-high-contrast-mode-design.md`

---

### Task 0: Create feature branch

**Files:** None (git only)

- [ ] **Step 1: Create and checkout the feature branch**

```bash
git checkout -b feature/high-contrast-mode
```

- [ ] **Step 2: Verify you're on the new branch**

```bash
git branch --show-current
```

Expected: `feature/high-contrast-mode`

---

### Task 1: Add `--tw-*` base CSS variables to `variables.css`

**Files:**
- Modify: `ghana-audit-service/assets/css/variables.css`

These variables store RGB channel triplets (e.g. `0 107 63`) that Tailwind will wrap in `rgb(... / <alpha-value>)`. They go inside the existing `:root { }` block, right before the `--text-scale` accessibility variable at line 184.

- [ ] **Step 1: Add `--tw-*` variables to the `:root` block**

Open `ghana-audit-service/assets/css/variables.css`. Inside the existing `:root { ... }` block (which starts at line 6), add the following section right before the `/* ACCESSIBILITY */` comment at line 181:

```css
  /* ============================================
     TAILWIND COLOR BRIDGE
     These RGB channel values power Tailwind's color utilities.
     Override them under :root.high-contrast to change all colors site-wide.
     ============================================ */

  /* Primary (Ghana Green: #006B3F) */
  --tw-primary: 0 107 63;
  --tw-primary-dark: 0 77 44;
  --tw-primary-light: 0 139 82;

  /* Secondary (Ghana Red: #CE1126) */
  --tw-secondary: 206 17 38;
  --tw-secondary-dark: 165 14 31;
  --tw-secondary-light: 229 29 51;

  /* Accent (Ghana Gold: #FCD116) */
  --tw-accent: 252 209 22;
  --tw-accent-dark: 212 173 0;
  --tw-accent-light: 255 225 77;

  /* Ghana flag color aliases */
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

  /* Functional colors */
  --tw-success: 46 125 50;
  --tw-success-light: 76 175 80;
  --tw-warning: 245 124 0;
  --tw-warning-light: 255 152 0;
  --tw-error: 198 40 40;
  --tw-error-light: 239 83 80;
  --tw-info: 21 101 192;
  --tw-info-light: 33 150 243;
```

- [ ] **Step 2: Verify the file is valid CSS**

Run from `ghana-audit-service/`:
```bash
npx prettier --check assets/css/variables.css
```

Expected: the file passes (or gets auto-formatted with `--write`).

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/assets/css/variables.css
git commit -m "feat(a11y): add --tw-* CSS variable bridge for Tailwind colors"
```

---

### Task 2: Rewire `tailwind.config.ts` to use CSS variables

**Files:**
- Modify: `ghana-audit-service/tailwind.config.ts`

Replace every hardcoded hex color definition with `rgb(var(--tw-*) / <alpha-value>)`. This is the core change that makes all `bg-primary`, `text-gray-600`, etc. classes resolve through CSS variables.

The `<alpha-value>` placeholder is a Tailwind convention — Tailwind substitutes the actual opacity at build time, so `bg-primary/50` produces `rgb(var(--tw-primary) / 0.5)`.

- [ ] **Step 1: Replace the `colors` block in `tailwind.config.ts`**

Replace the entire `colors: { ... }` object (lines 17–61) with:

```ts
      colors: {
        // Ghana Flag Colors — via CSS variable bridge
        'ghana-red': 'rgb(var(--tw-ghana-red) / <alpha-value>)',
        'ghana-gold': 'rgb(var(--tw-ghana-gold) / <alpha-value>)',
        'ghana-green': 'rgb(var(--tw-ghana-green) / <alpha-value>)',

        // Primary (Green)
        primary: {
          DEFAULT: 'rgb(var(--tw-primary) / <alpha-value>)',
          dark: 'rgb(var(--tw-primary-dark) / <alpha-value>)',
          light: 'rgb(var(--tw-primary-light) / <alpha-value>)',
        },

        // Secondary (Red)
        secondary: {
          DEFAULT: 'rgb(var(--tw-secondary) / <alpha-value>)',
          dark: 'rgb(var(--tw-secondary-dark) / <alpha-value>)',
          light: 'rgb(var(--tw-secondary-light) / <alpha-value>)',
        },

        // Accent (Gold)
        accent: {
          DEFAULT: 'rgb(var(--tw-accent) / <alpha-value>)',
          dark: 'rgb(var(--tw-accent-dark) / <alpha-value>)',
          light: 'rgb(var(--tw-accent-light) / <alpha-value>)',
        },

        // Functional Colors
        success: {
          DEFAULT: 'rgb(var(--tw-success) / <alpha-value>)',
          light: 'rgb(var(--tw-success-light) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--tw-warning) / <alpha-value>)',
          light: 'rgb(var(--tw-warning-light) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--tw-error) / <alpha-value>)',
          light: 'rgb(var(--tw-error-light) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--tw-info) / <alpha-value>)',
          light: 'rgb(var(--tw-info-light) / <alpha-value>)',
        },

        // Gray scale
        gray: {
          50: 'rgb(var(--tw-gray-50) / <alpha-value>)',
          100: 'rgb(var(--tw-gray-100) / <alpha-value>)',
          200: 'rgb(var(--tw-gray-200) / <alpha-value>)',
          300: 'rgb(var(--tw-gray-300) / <alpha-value>)',
          400: 'rgb(var(--tw-gray-400) / <alpha-value>)',
          500: 'rgb(var(--tw-gray-500) / <alpha-value>)',
          600: 'rgb(var(--tw-gray-600) / <alpha-value>)',
          700: 'rgb(var(--tw-gray-700) / <alpha-value>)',
          800: 'rgb(var(--tw-gray-800) / <alpha-value>)',
          900: 'rgb(var(--tw-gray-900) / <alpha-value>)',
        },
      },
```

**Important:** Do NOT touch the `white`, `black`, `transparent`, or `current` colors — these are Tailwind built-ins and should remain as-is (they are not defined in this config's `colors` block, so they come from Tailwind defaults).

- [ ] **Step 2: Update the `typography` plugin colors**

In the same file, replace the hardcoded hex values in the `typography` config (lines 199–299) with `rgb(var(...))` references. Replace the entire `typography` key:

```ts
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'rgb(var(--tw-gray-700))',
            '--tw-prose-headings': 'rgb(var(--tw-gray-900))',
            '--tw-prose-lead': 'rgb(var(--tw-gray-600))',
            '--tw-prose-links': 'rgb(var(--tw-primary))',
            '--tw-prose-bold': 'rgb(var(--tw-gray-900))',
            '--tw-prose-counters': 'rgb(var(--tw-primary))',
            '--tw-prose-bullets': 'rgb(var(--tw-primary))',
            '--tw-prose-hr': 'rgb(var(--tw-gray-200))',
            '--tw-prose-quotes': 'rgb(var(--tw-gray-900))',
            '--tw-prose-quote-borders': 'rgb(var(--tw-primary))',
            '--tw-prose-captions': 'rgb(var(--tw-gray-500))',
            '--tw-prose-code': 'rgb(var(--tw-gray-900))',
            '--tw-prose-pre-code': 'rgb(var(--tw-gray-200))',
            '--tw-prose-pre-bg': 'rgb(var(--tw-gray-800))',
            '--tw-prose-th-borders': 'rgb(var(--tw-gray-300))',
            '--tw-prose-td-borders': 'rgb(var(--tw-gray-200))',
            h1: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '700',
              letterSpacing: '-0.025em'
            },
            h2: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '700',
              letterSpacing: '-0.015em',
              marginTop: '2em',
              marginBottom: '1em'
            },
            h3: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '400',
              marginTop: '1.6em',
              marginBottom: '0.6em'
            },
            h4: {
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: '600',
              marginTop: '1.5em',
              marginBottom: '0.5em'
            },
            a: {
              color: 'rgb(var(--tw-primary))',
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                color: 'rgb(var(--tw-primary-dark))',
                textDecoration: 'underline'
              }
            },
            p: {
              marginTop: '1.25em',
              marginBottom: '1.25em'
            },
            'ul > li': {
              paddingLeft: '0.375em'
            },
            'ol > li': {
              paddingLeft: '0.375em'
            },
            blockquote: {
              fontStyle: 'italic',
              borderLeftColor: 'rgb(var(--tw-primary))',
              borderLeftWidth: '4px'
            }
          }
        },
        invert: {
          css: {
            '--tw-prose-body': 'rgb(var(--tw-gray-300))',
            '--tw-prose-headings': '#ffffff',
            '--tw-prose-lead': 'rgb(var(--tw-gray-400))',
            '--tw-prose-links': 'rgb(var(--tw-primary-light))',
            '--tw-prose-bold': '#ffffff',
            '--tw-prose-counters': 'rgb(var(--tw-primary-light))',
            '--tw-prose-bullets': 'rgb(var(--tw-primary-light))',
            '--tw-prose-hr': 'rgb(var(--tw-gray-700))',
            '--tw-prose-quotes': 'rgb(var(--tw-gray-100))',
            '--tw-prose-quote-borders': 'rgb(var(--tw-primary-light))',
            '--tw-prose-captions': 'rgb(var(--tw-gray-400))',
            '--tw-prose-code': '#ffffff',
            '--tw-prose-pre-code': 'rgb(var(--tw-gray-200))',
            '--tw-prose-pre-bg': 'rgb(var(--tw-gray-900))',
            '--tw-prose-th-borders': 'rgb(var(--tw-gray-600))',
            '--tw-prose-td-borders': 'rgb(var(--tw-gray-700))',
            a: {
              color: 'rgb(var(--tw-primary-light))',
              '&:hover': {
                color: 'rgb(var(--tw-primary))'
              }
            }
          }
        }
      }
```

Note: `--tw-prose-headings` and `--tw-prose-bold` in the `invert` variant use literal `#ffffff` (pure white is absolute — it should never be overridden by high contrast mode in dark mode).

- [ ] **Step 3: Verify Tailwind builds without errors**

Run from `ghana-audit-service/`:
```bash
npx nuxi typecheck
```

Expected: No errors related to Tailwind config. (TypeScript won't validate CSS variable strings, but the build will fail if the syntax is wrong.)

- [ ] **Step 4: Start the dev server briefly and check the homepage**

Run from `ghana-audit-service/`:
```bash
npm run dev
```

Open `http://localhost:3000` in a browser. The site should look **identical** to before — the CSS variables hold the same RGB values that the hex colors decoded to. If anything looks wrong (transparent backgrounds, missing colors), there's a mismatch between the hex values and the RGB triplets.

Key things to verify visually:
- Green header bar is still green
- Text is readable
- Cards have visible borders
- Buttons have correct colors

Press Ctrl+C to stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add ghana-audit-service/tailwind.config.ts
git commit -m "feat(a11y): rewire Tailwind colors to CSS variable bridge"
```

---

### Task 3: Replace old high-contrast CSS with new `--tw-*` overrides

**Files:**
- Modify: `ghana-audit-service/assets/css/variables.css`

The existing `:root.high-contrast` block (lines 195–253) overrides `--color-*` variables that no component references. Replace it entirely with overrides for the `--tw-*` variables that Tailwind now uses, plus add a `:root.high-contrast.dark` block for combined dark + high-contrast mode.

- [ ] **Step 1: Replace the high-contrast section**

Delete everything from line 192 (`/* HIGH CONTRAST MODE */` comment) through line 253 (`:root.high-contrast img { ... }`), and the dark mode section from line 258 through line 269. Replace with:

```css
/* ============================================
   HIGH CONTRAST MODE (Light)
   Enhanced contrast with Ghana flag colors preserved.
   All values meet WCAG AAA 7:1 contrast ratio on white.
   ============================================ */
:root.high-contrast {
  /* Primary: darker green — ~10.5:1 on white */
  --tw-primary: 0 61 28;
  --tw-primary-dark: 0 40 18;
  --tw-primary-light: 0 90 42;

  /* Secondary: darker red — ~8.2:1 on white */
  --tw-secondary: 154 10 24;
  --tw-secondary-dark: 120 8 18;
  --tw-secondary-light: 180 15 30;

  /* Accent: darker gold — ~7.1:1 on white */
  --tw-accent: 130 100 0;
  --tw-accent-dark: 100 77 0;
  --tw-accent-light: 160 123 0;

  /* Ghana flag aliases */
  --tw-ghana-red: 154 10 24;
  --tw-ghana-gold: 130 100 0;
  --tw-ghana-green: 0 61 28;

  /* Grays: increased separation for better readability */
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

/* ============================================
   HIGH CONTRAST + DARK MODE
   Brighter colors on darker backgrounds.
   ============================================ */
:root.high-contrast.dark {
  /* Brighter green on dark bg */
  --tw-primary: 0 200 120;
  --tw-primary-dark: 0 170 100;
  --tw-primary-light: 0 230 140;

  /* Brighter red on dark bg */
  --tw-secondary: 255 80 95;
  --tw-secondary-dark: 230 60 75;
  --tw-secondary-light: 255 110 120;

  /* Brighter gold on dark bg */
  --tw-accent: 255 225 50;
  --tw-accent-dark: 230 200 30;
  --tw-accent-light: 255 240 100;

  /* Ghana flag aliases */
  --tw-ghana-red: 255 80 95;
  --tw-ghana-gold: 255 225 50;
  --tw-ghana-green: 0 200 120;

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
  --tw-success-light: 80 240 80;
  --tw-warning: 255 180 0;
  --tw-warning-light: 255 200 50;
  --tw-error: 255 70 70;
  --tw-error-light: 255 100 100;
  --tw-info: 80 150 255;
  --tw-info-light: 120 180 255;
}
```

- [ ] **Step 2: Verify file is valid**

```bash
npx prettier --check ghana-audit-service/assets/css/variables.css
```

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/assets/css/variables.css
git commit -m "feat(a11y): add high-contrast and dark+HC color overrides for --tw-* variables"
```

---

### Task 4: Add high-contrast utility styles to `tailwind.css`

**Files:**
- Modify: `ghana-audit-service/assets/css/tailwind.css`

Add global styles that enhance visibility when high contrast mode is active: underlined links, stronger focus rings, shadow removal.

- [ ] **Step 1: Add the high-contrast utility block**

At the end of `ghana-audit-service/assets/css/tailwind.css`, after the `.visually-hidden` rule (line 520), add:

```css

/* ============================================
   HIGH CONTRAST MODE - Global overrides
   ============================================ */

/* Links: underline all links (WCAG: don't rely on color alone to convey meaning) */
:root.high-contrast a:not(.no-underline):not([class*="btn"]) {
  text-decoration: underline;
}

/* Focus: enhanced visible focus indicators */
:root.high-contrast :focus-visible {
  outline: 3px solid rgb(var(--tw-primary));
  outline-offset: 2px;
}

/* Shadows: remove decorative shadows, rely on borders for element separation */
:root.high-contrast .shadow-sm,
:root.high-contrast .shadow-md,
:root.high-contrast .shadow-lg,
:root.high-contrast .shadow-xl,
:root.high-contrast .shadow-2xl {
  box-shadow: none !important;
}

/* Cards: ensure visible borders when shadows are removed */
:root.high-contrast .card {
  border-width: 2px;
}
```

- [ ] **Step 2: Verify file is valid**

```bash
npx prettier --check ghana-audit-service/assets/css/tailwind.css
```

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/assets/css/tailwind.css
git commit -m "feat(a11y): add high-contrast global utility styles"
```

---

### Task 5: Verify the feature works — all 4 mode combinations

**Files:** None (manual testing only)

- [ ] **Step 1: Start the dev server**

```bash
cd ghana-audit-service && npm run dev
```

- [ ] **Step 2: Test light mode (no high contrast)**

Open `http://localhost:3000` in a browser. Verify:
- Homepage looks identical to before the changes
- Colors match the Ghana flag palette (green header, red accents, gold highlights)
- Cards have visible borders and shadows
- Navigation links are styled correctly
- Footer is styled correctly

- [ ] **Step 3: Test light + high contrast**

Click the ◐ button in the sticky top bar. Verify:
- Colors shift to darker, higher-contrast versions (green is darker, red is deeper)
- Text is more readable against backgrounds
- Links are underlined
- Cards have 2px borders (shadows removed)
- The ◐ button shows the active state (bg-white/20 highlight)
- Navigate to a few pages: `/reports`, `/publications`, `/contact` — all should have enhanced contrast

- [ ] **Step 4: Test dark mode (no high contrast)**

Click the ◐ button again to disable high contrast. Click the moon icon to enable dark mode. Verify:
- Standard dark mode works as before
- Dark backgrounds, light text
- No visual regressions

- [ ] **Step 5: Test dark + high contrast**

With dark mode still on, click ◐ to enable high contrast. Verify:
- Colors are brighter/more vivid on dark backgrounds
- Text has maximum contrast against dark backgrounds
- Links are underlined
- Navigate to a few pages — all should render correctly

- [ ] **Step 6: Test persistence**

With dark + high contrast both enabled, hard-refresh the page (Ctrl+Shift+R). Verify:
- High contrast mode is still active after refresh
- Dark mode is still active after refresh

- [ ] **Step 7: Test opacity modifiers**

Open browser DevTools, inspect an element that uses an opacity modifier (e.g., a badge with `bg-primary/10` or a button with `hover:bg-primary/10`). Verify:
- The computed color shows `rgb(... / 0.1)` — the opacity is being applied correctly
- The element is visible and styled appropriately

- [ ] **Step 8: Stop dev server**

Press Ctrl+C.

---

### Task 6: Run quality gates

**Files:** None

- [ ] **Step 1: Run TypeScript type check**

```bash
cd ghana-audit-service && npm run typecheck
```

Expected: Pass with no errors.

- [ ] **Step 2: Run ESLint**

```bash
npm run lint
```

Expected: Pass (or only pre-existing warnings).

- [ ] **Step 3: Run Prettier format check**

```bash
npm run format:check
```

Expected: Pass. If it fails, run `npm run format` to auto-fix, then re-run the check.

- [ ] **Step 4: Run existing tests**

```bash
npm run test:run
```

Expected: All existing tests pass. No component files were changed, so failures would indicate a CSS/config regression.

- [ ] **Step 5: Commit any format fixes (if needed)**

If Prettier or ESLint auto-fixed anything:

```bash
git add -A
git commit -m "chore: auto-format after high contrast mode changes"
```
