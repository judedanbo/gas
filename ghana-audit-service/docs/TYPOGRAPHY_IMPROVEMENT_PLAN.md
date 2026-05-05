# Typography Improvement Plan - Ghana Audit Service

## Current State Assessment

### Strengths
- **Two-font system**: Merriweather (serif headings) + Open Sans (sans-serif body) is a solid pairing
- **Responsive scaling**: Headings scale from mobile to desktop
- **Design tokens**: CSS variables and Tailwind config are well-organized
- **Dark mode support**: Comprehensive coverage across components
- **Accessibility**: High contrast mode, focus states, reduced motion support

### Key Weaknesses Identified

| Issue | Impact | Severity |
|-------|--------|----------|
| Limited type scale (only 10 sizes) | Restricts visual hierarchy options | Medium |
| No fluid typography (clamp) | Jarring breakpoint jumps | High |
| Line heights too tight for large text | Reduced readability in heroes | Medium |
| Missing letter-spacing tokens | Inconsistent tracking | Low |
| No prose/typography plugin | Inconsistent long-form content | Medium |
| Merriweather only has 400/700 weights | Limited heading weight variation | Low |
| Font sizes jump significantly between scale steps | Loss of subtle hierarchy | Medium |

---

## Detailed Improvement Plan

### Phase 1: Foundation - Type Scale & Fluid Typography

#### 1.1 Implement Fluid Typography with CSS `clamp()` ✅ HIGH PRIORITY

**Current Problem**: Hard breakpoints cause jarring size jumps
```css
/* Current: discrete jumps */
h1 { @apply text-4xl md:text-5xl; } /* 36px → 48px */
```

**Recommended Approach** - Add fluid type utilities in `tailwind.config.ts`:

```typescript
fontSize: {
  // Fluid display sizes
  'display-2xl': ['clamp(2.5rem, 5vw + 1rem, 4.5rem)', { lineHeight: '1.1' }],
  'display-xl': ['clamp(2rem, 4vw + 1rem, 3.75rem)', { lineHeight: '1.1' }],
  'display-lg': ['clamp(1.75rem, 3vw + 1rem, 3rem)', { lineHeight: '1.15' }],
  'display-md': ['clamp(1.5rem, 2.5vw + 0.75rem, 2.25rem)', { lineHeight: '1.2' }],
  'display-sm': ['clamp(1.25rem, 2vw + 0.5rem, 1.875rem)', { lineHeight: '1.25' }],
}
```

**Files to modify**:
- `tailwind.config.ts:68-79`
- `assets/css/tailwind.css:29-34` (update heading base styles)

#### 1.2 Expand Type Scale with Intermediate Sizes

**Current Problem**: 8-step jump between sizes limits subtle hierarchy

**Recommendation**: Add intermediate sizes for finer control:

```typescript
fontSize: {
  '1.5xl': ['1.375rem', { lineHeight: '1.6rem' }],  // 22px
  '2.5xl': ['1.6875rem', { lineHeight: '2.125rem' }], // 27px
  '3.5xl': ['2rem', { lineHeight: '2.25rem' }],     // 32px
}
```

---

### Phase 2: Visual Hierarchy Enhancements

#### 2.1 Add Letter-Spacing (Tracking) Tokens

**Recommendation** - Add to `tailwind.config.ts`:

```typescript
letterSpacing: {
  'tightest': '-0.05em',  // Display headings
  'tighter': '-0.025em',  // Large headings
  'tight': '-0.015em',    // Medium headings
  'normal': '0',          // Body text
  'wide': '0.025em',      // Small caps, labels
  'wider': '0.05em',      // All caps text
  'widest': '0.1em',      // Badges, very small caps
}
```

#### 2.2 Improve Line Height for Large Text

**Recommendation**:
```typescript
fontSize: {
  '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
  '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
  '7xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
  '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
}
```

#### 2.3 Create Semantic Typography Component Classes

**Recommendation** - Add to `assets/css/tailwind.css`:

```css
/* Display text - for heroes and major headings */
.text-display-hero {
  @apply text-display-2xl font-heading font-bold tracking-tighter text-balance;
}

.text-display-title {
  @apply text-display-lg font-heading font-bold tracking-tight;
}

/* Heading hierarchy */
.text-title-lg {
  @apply text-3xl md:text-4xl font-heading font-bold tracking-tight;
}

.text-title-md {
  @apply text-2xl md:text-3xl font-heading font-bold;
}

.text-title-sm {
  @apply text-xl md:text-2xl font-heading font-semibold;
}

/* Body text variants */
.text-body-lg {
  @apply text-lg leading-relaxed text-gray-700 dark:text-gray-300;
}

.text-body-md {
  @apply text-base leading-relaxed text-gray-600 dark:text-gray-400;
}

.text-body-sm {
  @apply text-sm leading-normal text-gray-500 dark:text-gray-400;
}

/* Supporting text */
.text-caption {
  @apply text-xs leading-normal text-gray-500 dark:text-gray-400;
}

.text-overline {
  @apply text-xs font-semibold uppercase tracking-wider text-primary dark:text-primary-light;
}

.text-label {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300;
}
```

---

### Phase 3: Typography Plugin & Long-Form Content

#### 3.1 Install and Configure @tailwindcss/typography ✅ HIGH PRIORITY

**Current Problem**: Prose styling is manually duplicated in multiple pages

**Steps**:

1. Install the plugin:
```bash
npm install @tailwindcss/typography
```

2. Configure in `tailwind.config.ts`

3. **Remove duplicate prose styles** from:
   - `pages/privacy-policy.vue`
   - `pages/terms.vue`
   - `pages/accessibility.vue`
   - `pages/media/news/[slug].vue`

4. Replace with:
```vue
<div class="prose prose-ghana lg:prose-lg dark:prose-invert max-w-none">
  <!-- content -->
</div>
```

---

### Phase 4: Font Optimization

#### 4.1 Add Variable Fonts for Performance

**Recommendation** - Update `nuxt.config.ts`:

```typescript
googleFonts: {
  families: {
    'Open+Sans': {
      wght: '400..700',  // Variable weight range
    },
    'Merriweather': [400, 700],
  },
  display: 'swap',
  prefetch: true,
  preconnect: true,
  subsets: ['latin'],
}
```

#### 4.2 Add Font Feature Settings

```css
body {
  font-feature-settings:
    "kern" 1,
    "liga" 1,
    "calt" 1;
}

.tabular-nums {
  font-feature-settings: "tnum" 1;
}
```

---

### Phase 5: Component-Level Fixes

#### 5.1 Fix Inconsistent Heading Levels

| Component | Issue | Fix |
|-----------|-------|-----|
| `components/ui/InfoCard.vue` | Always uses h3 | Add `headingLevel` prop |
| `pages/media/news/[slug].vue` | Error h1 too small | Use h2 or match h1 styling |
| `components/common/AppFooter.vue` | Scoped `.footer-heading` | Use component class system |

#### 5.2 Extract Reusable Tag/Pill Component

Create `components/ui/Tag.vue` for article tags

#### 5.3 Standardize Text Truncation

Add consistent clamping utilities

---

### Phase 6: Advanced Readability Improvements

#### 6.1 Implement Optimal Line Length (Measure)

```typescript
maxWidth: {
  'prose-xs': '45ch',
  'prose-sm': '55ch',
  'prose': '65ch',
  'prose-lg': '75ch',
  'prose-xl': '85ch',
}
```

#### 6.2 Improve Paragraph Spacing

```css
.prose-spacing > * + * {
  margin-top: 1.5em;
}
```

#### 6.3 Add Text Color Hierarchy System

Formalize text color tokens

---

### Phase 7: Accessibility Enhancements

#### 7.1 Improve Focus Indicators for Text Links

```css
a:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary
         bg-primary/10 rounded-sm px-0.5 -mx-0.5;
}
```

#### 7.2 Add ARIA Labels to Text Scaling Controls

#### 7.3 Ensure Minimum Touch Target Size

---

## Implementation Priority Matrix

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 High | 1.1 Fluid typography | Medium | High - fixes jarring jumps |
| 🔴 High | 3.1 Typography plugin | Medium | High - DRY, consistency |
| 🟡 Medium | 2.1 Letter-spacing | Low | Medium - polish |
| 🟡 Medium | 2.3 Semantic classes | Medium | Medium - maintainability |
| 🟡 Medium | 5.1 Heading levels | Low | Medium - accessibility |
| 🟢 Low | 4.1 Variable fonts | Low | Low-Medium - performance |
| 🟢 Low | 6.1 Line length | Low | Medium - readability |

---

## Files Requiring Modification

### Configuration Files
1. `tailwind.config.ts` - Type scale, tracking, prose config
2. `nuxt.config.ts` - Google Fonts optimization

### CSS Files
3. `assets/css/tailwind.css` - Base styles, component classes, utilities
4. `assets/css/variables.css` - Add new typography tokens

### Component Files
5. `components/ui/InfoCard.vue` - Flexible heading level
6. `components/ui/Tag.vue` - New component
7. `components/common/AppFooter.vue` - Remove scoped styles
8. `components/common/AppHeader.vue` - ARIA labels

### Page Files
9. `pages/privacy-policy.vue` - Use prose classes
10. `pages/terms.vue` - Use prose classes
11. `pages/accessibility.vue` - Use prose classes
12. `pages/media/news/[slug].vue` - Use prose classes

---

## Measurement & Validation

After implementing, validate with:
1. **Lighthouse** - Performance score for font loading
2. **axe DevTools** - Accessibility audit for text contrast
3. **Responsively** - Check fluid typography across breakpoints
4. **Chrome DevTools** - Font rendering
5. **WAVE** - Text accessibility validation
