# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ghana Audit Service official website - a Nuxt 3 application with Vue 3, TypeScript, and TailwindCSS. This is a government website for Ghana's constitutional audit body.

## Common Commands

```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run generate     # Generate static site
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
```

## Architecture

### Tech Stack
- **Framework**: Nuxt 3 with Vue 3 Composition API
- **Styling**: TailwindCSS with custom Ghana government color palette
- **i18n**: @nuxtjs/i18n with English (default) and Akan locales
- **TypeScript**: Strict mode enabled

### Directory Structure
- `pages/` - File-based routing (Nuxt convention)
- `components/` - Vue components organized by domain:
  - `ui/` - Reusable base components (BaseCard, BaseButton, BaseModal, etc.)
  - `common/` - Layout components (AppHeader, AppFooter, AppNavigation)
  - `home/`, `reports/`, `media/`, `careers/`, `publications/`, `search/` - Feature-specific components
- `composables/` - Vue composables for data fetching and shared logic
- `server/api/` - Nitro API routes returning mock data
- `server/utils/` - Mock data files (mockReports.ts, mockNews.ts, etc.)
- `types/` - TypeScript interfaces in `types/index.ts`
- `i18n/locales/` - Translation files (en.json, ak.json)
- `layouts/` - default.vue and minimal.vue layouts

### Key Patterns

**Component Naming**: Components use PascalCase folders matching their domain. Use auto-imported components with folder prefix: `<CommonAppHeader />`, `<UiBaseCard />`.

**Composables**: Data fetching uses composables that return reactive state:
```typescript
const { reports, loading, error, fetchReports } = useReports()
```

**API Routes**: Server routes in `server/api/` use Nitro's `defineEventHandler`. Currently using mock data; replace `server/utils/mock*.ts` files with real data sources.

**Type Definitions**: All domain types (AuditReport, Publication, NewsArticle, etc.) are defined in `types/index.ts`.

### Styling

Custom Tailwind config in `tailwind.config.ts` with Ghana flag colors:
- `primary` / `ghana-green`: #006B3F
- `secondary` / `ghana-red`: #CE1126
- `accent` / `ghana-gold`: #FCD116

Typography uses Open Sans (body) and Plus Jakarta Sans (headings).

### i18n

Locale strategy: `prefix_except_default` (English at `/`, Akan at `/ak/`)
- Translations in `i18n/locales/`
- Use `$t('key')` in templates or `useI18n()` composable

### Environment Variables

Copy `.env.example` to `.env`. Key variables:
- `NUXT_PUBLIC_SITE_URL` - Production URL
- `NUXT_API_SECRET` - Server-side API secret
- See `.env.example` for full list
