# Component Reusability Plan

## Overview

This document outlines the strategy for improving component reusability and consistency across the Ghana Audit Service website. Following this plan will result in:

- **20-30% reduction** in template code
- **Consistent UI/UX** across all pages
- **Easier maintenance** and updates
- **Faster development** for new features

---

## Current State Analysis

### Existing Base Components (Good Foundation)

| Component | Location | Status |
|-----------|----------|--------|
| `BaseButton` | `components/ui/BaseButton.vue` | Well-implemented, has variants |
| `BaseCard` | `components/ui/BaseCard.vue` | Good structure, **underutilized** |
| `BaseModal` | `components/ui/BaseModal.vue` | Solid implementation |
| `LoadingSpinner` | `components/ui/LoadingSpinner.vue` | Good utility component |

### Key Problems Identified

1. **Repeated Patterns**: Same UI structures duplicated 6-12+ times across files
2. **Inconsistent Styling**: Mix of Tailwind classes, inline styles, and scoped CSS
3. **Underutilized Components**: `BaseCard` exists but inline card HTML used instead
4. **No Design System**: Spacing, colors, and typography vary across pages

---

## Phase 1: High Priority Components

### 1.1 SectionHeader

**Purpose**: Unified section header with title, description, and optional action button.

**Replaces**: 12+ occurrences across all pages

**Files Affected**:
- `pages/index.vue` (lines 22-27)
- `pages/about/index.vue` (lines 64-70, 161-167, 201-206)
- `pages/about/departmental-profile.vue` (lines 55-60, 100-104, 120-124)
- `pages/about/management-team.vue` (lines 42-46, 73-77, 108-112, 130-134)
- `pages/about/past-auditors-general.vue` (lines 44-48)
- `pages/about/the-service.vue` (lines 74-80, 96-102, 119-125)
- `components/home/LatestReports.vue` (lines 4-14)
- `components/home/PublicationsPreview.vue` (lines 3-14)
- `components/home/AboutCards.vue` (lines 4-9)

**Current Pattern** (repeated):
```vue
<div class="text-center mb-10">
  <h2 class="text-2xl md:text-3xl font-heading font-bold text-gray-900 mb-2">Title</h2>
  <p class="text-gray-600">Description text</p>
</div>
```

**Proposed Component**:
```vue
<!-- components/ui/SectionHeader.vue -->
<template>
  <div :class="['mb-10', centered ? 'text-center' : '']">
    <span v-if="badge" class="inline-block bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold mb-4">
      {{ badge }}
    </span>
    <h2 :class="headingClasses">{{ title }}</h2>
    <p v-if="description" class="text-gray-600 mt-2" :class="{ 'max-w-2xl mx-auto': centered }">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  description?: string
  badge?: string
  centered?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  centered: true,
  size: 'md'
})

const headingClasses = computed(() => {
  const sizes = {
    sm: 'text-xl md:text-2xl',
    md: 'text-2xl md:text-3xl',
    lg: 'text-3xl md:text-4xl'
  }
  return `${sizes[props.size]} font-heading font-bold text-gray-900`
})
</script>
```

**Usage**:
```vue
<SectionHeader
  title="About Ghana Audit Service"
  description="Established over a century ago, we continue to uphold the highest standards."
/>

<SectionHeader
  title="Latest Reports"
  description="Access our most recent audit findings"
  :centered="false"
>
  <template #action>
    <NuxtLink to="/reports" class="btn-outline">View All</NuxtLink>
  </template>
</SectionHeader>
```

---

### 1.2 StatGrid

**Purpose**: Display statistics in a responsive grid with optional animation.

**Replaces**: 8+ occurrences

**Files Affected**:
- `pages/about/index.vue` (lines 33-50)
- `pages/about/departmental-profile.vue` (lines 33-49, 209-226)
- `pages/about/management-team.vue` (lines 135-156)
- `pages/about/past-auditors-general.vue` (lines 92-108)
- `pages/about/the-service.vue` (lines 126-131)
- `components/home/StatsCounter.vue`

**Current Pattern** (repeated):
```vue
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div v-for="stat in stats" class="text-center p-6 bg-gray-100 rounded-lg">
    <span class="text-3xl block mb-2">{{ stat.icon }}</span>
    <span class="block text-3xl font-bold text-primary">{{ stat.value }}</span>
    <span class="text-sm text-gray-400">{{ stat.label }}</span>
  </div>
</div>
```

**Proposed Component**:
```vue
<!-- components/ui/StatGrid.vue -->
<template>
  <div :class="gridClasses">
    <div
      v-for="stat in stats"
      :key="stat.label"
      class="text-center p-6 rounded-lg"
      :class="itemBackground"
    >
      <span v-if="stat.icon" class="text-3xl block mb-2">{{ stat.icon }}</span>
      <span class="block text-3xl font-bold text-primary">
        {{ animated ? animatedValues[stat.label] : stat.value }}{{ stat.suffix }}
      </span>
      <span class="text-sm text-gray-500">{{ stat.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Stat {
  icon?: string
  value: number
  label: string
  suffix?: string
}

interface Props {
  stats: Stat[]
  columns?: 2 | 3 | 4
  animated?: boolean
  variant?: 'default' | 'card' | 'transparent'
}

const props = withDefaults(defineProps<Props>(), {
  columns: 4,
  animated: false,
  variant: 'default'
})

const gridClasses = computed(() => {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  }
  return `grid ${cols[props.columns]} gap-4 md:gap-6`
})

const itemBackground = computed(() => {
  const variants = {
    default: 'bg-gray-100',
    card: 'bg-white border border-gray-200 shadow-sm',
    transparent: 'bg-white/10'
  }
  return variants[props.variant]
})

// Animation logic (simplified)
const animatedValues = ref<Record<string, number>>({})

onMounted(() => {
  if (props.animated) {
    props.stats.forEach(stat => {
      animatedValues.value[stat.label] = 0
      // Animate to target value
    })
  }
})
</script>
```

**Usage**:
```vue
<StatGrid
  :stats="[
    { icon: '👥', value: 2295, label: 'Staff Members' },
    { icon: '🏛️', value: 16, label: 'Regions' },
    { icon: '📍', value: 95, label: 'Districts' }
  ]"
  :columns="3"
  animated
/>
```

---

### 1.3 InfoCard

**Purpose**: Card with icon, title, and description for features/services.

**Replaces**: 8+ occurrences

**Files Affected**:
- `pages/index.vue` (lines 28-39)
- `pages/about/index.vue` (lines 71-100, 169-194, 207-213)
- `pages/about/the-service.vue` (lines 81-90, 103-113)
- `components/home/AboutCards.vue` (lines 11-18)

**Current Pattern** (repeated):
```vue
<div class="bg-white border border-gray-200 rounded-lg p-6">
  <div class="text-4xl mb-4">{{ icon }}</div>
  <h3 class="text-lg font-semibold text-primary mb-3">{{ title }}</h3>
  <p class="text-gray-600">{{ description }}</p>
</div>
```

**Proposed Component**:
```vue
<!-- components/ui/InfoCard.vue -->
<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    :class="cardClasses"
  >
    <div v-if="icon || $slots.icon" :class="iconClasses">
      <slot name="icon">{{ icon }}</slot>
    </div>
    <h3 :class="titleClasses">{{ title }}</h3>
    <p v-if="description" class="text-gray-600 m-0">{{ description }}</p>
    <slot />
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

interface Props {
  icon?: string
  title: string
  description?: string
  to?: string
  variant?: 'default' | 'centered' | 'horizontal'
  hover?: boolean
  iconColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  hover: false
})

const cardClasses = computed(() => {
  const base = 'bg-white border border-gray-200 rounded-lg p-6'
  const centered = props.variant === 'centered' ? 'text-center' : ''
  const horizontal = props.variant === 'horizontal' ? 'flex items-start gap-4' : ''
  const hoverEffect = props.hover ? 'transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary cursor-pointer' : ''
  const link = props.to ? 'no-underline' : ''
  return [base, centered, horizontal, hoverEffect, link].filter(Boolean).join(' ')
})

const iconClasses = computed(() => {
  return props.variant === 'horizontal' ? 'text-3xl flex-shrink-0' : 'text-4xl mb-4'
})

const titleClasses = computed(() => {
  return 'text-lg font-semibold text-primary mb-3'
})
</script>
```

**Usage**:
```vue
<InfoCard
  icon="🏛️"
  title="Who We Are"
  description="The supreme audit institution of Ghana."
  variant="centered"
/>

<InfoCard
  icon="📊"
  title="View Reports"
  description="Access audit findings"
  to="/reports"
  hover
/>
```

---

### 1.4 Badge

**Purpose**: Consistent badge/tag styling for categories, statuses, and labels.

**Replaces**: 6+ variations

**Files Affected**:
- `components/home/LatestReports.vue` (lines 19-21, 139-167)
- `components/home/PublicationsPreview.vue` (lines 21, 51, 144-154)
- `pages/about/management-team.vue` (lines 25, 90)
- `pages/about/past-auditors-general.vue` (line 23)

**Current Pattern** (inconsistent):
```vue
<!-- Variation 1 -->
<span class="category-badge" :class="getCategoryClass(category)">

<!-- Variation 2 -->
<span class="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-primary text-white">

<!-- Variation 3 -->
<span class="bg-accent text-gray-900 px-3 py-1 rounded text-sm font-medium">
```

**Proposed Component**:
```vue
<!-- components/ui/Badge.vue -->
<template>
  <span :class="badgeClasses">
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
  size?: 'sm' | 'md' | 'lg'
  rounded?: 'default' | 'full'
  uppercase?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  rounded: 'full',
  uppercase: true
})

const badgeClasses = computed(() => {
  const base = 'inline-flex items-center font-semibold'

  const variants = {
    primary: 'bg-primary text-white',
    secondary: 'bg-secondary text-white',
    accent: 'bg-accent text-gray-900',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800'
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm'
  }

  const roundedClasses = {
    default: 'rounded',
    full: 'rounded-full'
  }

  const casing = props.uppercase ? 'uppercase tracking-wider' : ''

  return [base, variants[props.variant], sizes[props.size], roundedClasses[props.rounded], casing].join(' ')
})
</script>
```

**Usage**:
```vue
<Badge variant="primary">Financial</Badge>
<Badge variant="accent" size="lg">Featured</Badge>
<Badge variant="success" :uppercase="false">Active</Badge>
```

**Category Badge Mapping** (create a composable):
```ts
// composables/useCategoryBadge.ts
export function useCategoryBadge() {
  const categoryVariants: Record<string, string> = {
    financial: 'primary',
    compliance: 'info',
    it: 'accent',
    performance: 'success',
    technical: 'warning',
    'follow-up': 'gray'
  }

  function getVariant(category: string) {
    return categoryVariants[category] || 'gray'
  }

  return { getVariant, categoryVariants }
}
```

---

### 1.5 CheckList

**Purpose**: List items with consistent icon styling (checkmarks, bullets, arrows).

**Replaces**: 7+ occurrences

**Files Affected**:
- `pages/about/index.vue` (lines 115-140, 187-192)
- `pages/about/departmental-profile.vue` (lines 82-84, 110-112, 131-133)
- `pages/about/management-team.vue` (lines 95-98)
- `pages/about/the-service.vue` (lines 86-88, 187-192)
- `pages/about/past-auditors-general.vue` (lines 31-35)

**Current Pattern** (repeated):
```vue
<ul class="space-y-3">
  <li class="flex items-start gap-3 py-3 text-gray-600 border-b border-gray-200">
    <span class="text-primary font-bold flex-shrink-0">✓</span>
    Content text
  </li>
</ul>
```

**Proposed Component**:
```vue
<!-- components/ui/CheckList.vue -->
<template>
  <ul :class="listClasses">
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="itemClasses"
    >
      <span :class="iconClasses">
        <slot name="icon">{{ icons[icon] }}</slot>
      </span>
      <span>{{ item }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
interface Props {
  items: string[]
  icon?: 'check' | 'bullet' | 'arrow' | 'star' | 'dot'
  divided?: boolean
  spacing?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'check',
  divided: false,
  spacing: 'md'
})

const icons = {
  check: '✓',
  bullet: '•',
  arrow: '→',
  star: '★',
  dot: '●'
}

const listClasses = computed(() => {
  const spacings = {
    sm: 'space-y-2',
    md: 'space-y-3',
    lg: 'space-y-4'
  }
  return spacings[props.spacing]
})

const itemClasses = computed(() => {
  const base = 'flex items-start gap-3 text-gray-600'
  const divided = props.divided ? 'py-3 border-b border-gray-200 last:border-0' : ''
  return [base, divided].filter(Boolean).join(' ')
})

const iconClasses = computed(() => {
  return 'text-primary font-bold flex-shrink-0'
})
</script>
```

**Usage**:
```vue
<CheckList
  :items="['Audit public accounts', 'Report to Parliament', 'Ensure compliance']"
  icon="check"
  divided
/>

<CheckList
  :items="functions"
  icon="arrow"
  spacing="lg"
/>
```

---

### 1.6 ProfileCard

**Purpose**: Person card with avatar, name, title, and content.

**Replaces**: 6+ occurrences

**Files Affected**:
- `pages/about/management-team.vue` (lines 18-37, 82-101, 114-123)
- `pages/about/past-auditors-general.vue` (lines 18-38, 51-68)

**Current Pattern** (repeated):
```vue
<div class="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-10">
  <div class="flex justify-center">
    <div class="w-[220px] h-[280px] bg-gray-100 rounded-lg flex items-center justify-center border-4 border-primary">
      <span class="text-7xl opacity-30">👤</span>
    </div>
  </div>
  <div>
    <h3 class="text-2xl font-bold text-gray-900">Name</h3>
    <p class="text-primary font-semibold">Title</p>
    <!-- Content -->
  </div>
</div>
```

**Proposed Component**:
```vue
<!-- components/ui/ProfileCard.vue -->
<template>
  <div :class="containerClasses">
    <!-- Avatar -->
    <div class="flex justify-center" :class="{ 'md:justify-start': layout === 'horizontal' }">
      <div :class="avatarClasses">
        <img v-if="image" :src="image" :alt="name" class="w-full h-full object-cover" />
        <span v-else class="text-7xl opacity-30">👤</span>
      </div>
    </div>

    <!-- Content -->
    <div>
      <h3 :class="nameClasses">{{ name }}</h3>
      <p v-if="title" class="text-primary font-semibold mb-2">{{ title }}</p>
      <p v-if="subtitle" class="text-gray-500 text-sm mb-4">{{ subtitle }}</p>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  name: string
  title?: string
  subtitle?: string
  image?: string
  layout?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
  featured?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'horizontal',
  size: 'md',
  featured: false
})

const containerClasses = computed(() => {
  if (props.layout === 'vertical') {
    return 'text-center'
  }
  return 'grid grid-cols-1 md:grid-cols-[250px_1fr] gap-10 items-start'
})

const avatarClasses = computed(() => {
  const sizes = {
    sm: 'w-[120px] h-[150px]',
    md: 'w-[180px] h-[220px]',
    lg: 'w-[220px] h-[280px]'
  }
  const base = 'bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden'
  const border = props.featured ? 'border-4 border-primary' : 'border border-gray-200'
  return [base, sizes[props.size], border].join(' ')
})

const nameClasses = computed(() => {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  }
  return `${sizes[props.size]} font-bold text-gray-900 mb-1`
})
</script>
```

**Usage**:
```vue
<ProfileCard
  name="Johnson Akuamoah Asiedu"
  title="Auditor-General"
  subtitle="2021 - Present"
  size="lg"
  featured
>
  <p>The current Auditor-General of Ghana...</p>
  <CheckList :items="achievements" icon="check" />
</ProfileCard>
```

---

## Phase 2: Medium Priority Components

### 2.1 AccordionItem

**Purpose**: Expandable content sections with consistent animation.

**Files to Refactor**:
- `pages/about/departmental-profile.vue` (lines 62-93)
- `components/common/MobileMenu.vue`

```vue
<!-- components/ui/AccordionItem.vue -->
<template>
  <div class="border border-gray-200 rounded-lg overflow-hidden">
    <button
      @click="toggle"
      class="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
    >
      <div class="flex items-center gap-4">
        <span v-if="icon" class="text-2xl">{{ icon }}</span>
        <span class="font-semibold text-gray-900">{{ title }}</span>
      </div>
      <span class="text-gray-400 transition-transform" :class="{ 'rotate-180': isOpen }">
        ▼
      </span>
    </button>
    <div v-show="isOpen" class="p-4 border-t border-gray-200 bg-gray-50">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  icon?: string
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: false
})

const isOpen = ref(props.defaultOpen)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>
```

---

### 2.2 IconText

**Purpose**: Inline icon + text for metadata displays.

```vue
<!-- components/ui/IconText.vue -->
<template>
  <span class="inline-flex items-center gap-2 text-gray-500">
    <span>{{ icon }}</span>
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
}>()
</script>
```

**Usage**:
```vue
<IconText icon="📅">June 15, 2024</IconText>
<IconText icon="📄">4.2 MB</IconText>
```

---

### 2.3 ViewAllLink

**Purpose**: Consistent "View All" navigation pattern.

```vue
<!-- components/ui/ViewAllLink.vue -->
<template>
  <NuxtLink :to="to" :class="linkClasses">
    {{ label }}
    <span class="ml-2">→</span>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Props {
  to: string
  label?: string
  variant?: 'button' | 'text'
}

const props = withDefaults(defineProps<Props>(), {
  label: 'View All',
  variant: 'button'
})

const linkClasses = computed(() => {
  if (props.variant === 'button') {
    return 'btn-outline inline-flex items-center'
  }
  return 'text-primary hover:underline inline-flex items-center font-medium'
})
</script>
```

---

## Phase 3: Styling Standardization

### 3.1 Spacing Scale

Add to `tailwind.config.ts`:

```ts
export default {
  theme: {
    extend: {
      spacing: {
        'section': '3rem',      // py-12
        'section-lg': '4rem',   // py-16
        'section-xl': '5rem',   // py-20
      }
    }
  }
}
```

### 3.2 Component Classes

Add to `assets/css/tailwind.css`:

```css
@layer components {
  /* Section spacing */
  .section {
    @apply py-12 lg:py-16;
  }

  .section-sm {
    @apply py-8 lg:py-10;
  }

  .section-lg {
    @apply py-16 lg:py-20;
  }

  /* Container */
  .container {
    @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
  }

  /* Card base */
  .card {
    @apply bg-white border border-gray-200 rounded-lg;
  }

  .card-hover {
    @apply transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary;
  }
}
```

### 3.3 Color Variables for Dynamic Styles

Replace inline `:style` bindings with CSS custom properties:

```css
/* assets/css/tailwind.css */
@layer utilities {
  .bg-department-central { background-color: #006B3F; }
  .bg-department-mda { background-color: #1e40af; }
  .bg-department-district { background-color: #7c3aed; }
  .bg-department-technical { background-color: #ea580c; }
  .bg-department-performance { background-color: #0891b2; }
  .bg-department-it { background-color: #4f46e5; }
  .bg-department-special { background-color: #be185d; }
}
```

---

## Phase 4: Refactoring Checklist

### Pages to Refactor

| Page | Components to Use | Priority |
|------|-------------------|----------|
| `pages/index.vue` | SectionHeader, InfoCard | HIGH |
| `pages/about/index.vue` | SectionHeader, StatGrid, InfoCard, CheckList | HIGH |
| `pages/about/the-service.vue` | SectionHeader, InfoCard, CheckList, StatGrid | HIGH |
| `pages/about/management-team.vue` | SectionHeader, ProfileCard, StatGrid | HIGH |
| `pages/about/past-auditors-general.vue` | SectionHeader, ProfileCard, CheckList | MEDIUM |
| `pages/about/departmental-profile.vue` | SectionHeader, AccordionItem, StatGrid | MEDIUM |

### Components to Refactor

| Component | Changes Needed | Priority |
|-----------|----------------|----------|
| `LatestReports.vue` | Use Badge, IconText, SectionHeader | HIGH |
| `PublicationsPreview.vue` | Use Badge, BaseCard, SectionHeader | HIGH |
| `AboutCards.vue` | Use InfoCard, SectionHeader | MEDIUM |

---

## Phase 5: Implementation Order

### Week 1: Foundation
1. Create `SectionHeader` component
2. Create `Badge` component
3. Create `useCategoryBadge` composable
4. Update `tailwind.css` with component classes

### Week 2: Core Components
5. Create `StatGrid` component
6. Create `InfoCard` component
7. Create `CheckList` component
8. Refactor `pages/index.vue`

### Week 3: Advanced Components
9. Create `ProfileCard` component
10. Create `AccordionItem` component
11. Refactor About section pages

### Week 4: Polish
12. Create `IconText` component
13. Create `ViewAllLink` component
14. Refactor home components (LatestReports, PublicationsPreview)
15. Final styling consistency pass

---

## Metrics for Success

After implementing this plan, measure:

1. **Code Reduction**: Target 20-30% reduction in template code
2. **Consistency**: All similar UI elements use the same component
3. **Maintainability**: Single source of truth for each UI pattern
4. **Development Speed**: New pages built 50% faster using existing components

---

## Component Directory Structure (Final)

```
components/
├── common/
│   ├── AppHeader.vue
│   ├── AppFooter.vue
│   ├── AppNavigation.vue
│   ├── Breadcrumb.vue
│   ├── MobileMenu.vue
│   └── SearchBar.vue
├── home/
│   ├── HeroCarousel.vue
│   ├── AboutCards.vue      # Refactor to use InfoCard
│   ├── AGMessage.vue
│   ├── StatsCounter.vue    # Keep for animation, use StatGrid internally
│   ├── LatestReports.vue   # Refactor to use Badge, IconText
│   └── PublicationsPreview.vue
└── ui/
    ├── BaseButton.vue      # Existing
    ├── BaseCard.vue        # Existing
    ├── BaseModal.vue       # Existing
    ├── LoadingSpinner.vue  # Existing
    ├── SectionHeader.vue   # NEW
    ├── StatGrid.vue        # NEW
    ├── InfoCard.vue        # NEW
    ├── Badge.vue           # NEW
    ├── CheckList.vue       # NEW
    ├── ProfileCard.vue     # NEW
    ├── AccordionItem.vue   # NEW
    ├── IconText.vue        # NEW
    └── ViewAllLink.vue     # NEW
```

---

## Implementation Status: COMPLETED

All phases of this plan have been successfully implemented.

### Phase 1: High Priority Components - DONE
| Component | Status | File |
|-----------|--------|------|
| SectionHeader | ✅ Implemented | `components/ui/SectionHeader.vue` |
| Badge | ✅ Implemented | `components/ui/Badge.vue` |
| StatGrid | ✅ Implemented | `components/ui/StatGrid.vue` |
| InfoCard | ✅ Implemented | `components/ui/InfoCard.vue` |
| CheckList | ✅ Implemented | `components/ui/CheckList.vue` |
| ProfileCard | ✅ Implemented | `components/ui/ProfileCard.vue` |

### Phase 2: Medium Priority Components - DONE
| Component | Status | File |
|-----------|--------|------|
| AccordionItem | ✅ Implemented | `components/ui/AccordionItem.vue` |
| IconText | ✅ Implemented | `components/ui/IconText.vue` |
| ViewAllLink | ✅ Implemented | `components/ui/ViewAllLink.vue` |

### Phase 3: Styling Standardization - DONE
- ✅ Spacing scale added to `tailwind.config.ts`
- ✅ Section variants (section-sm, section-lg) added
- ✅ Card hover utilities added
- ✅ Department color utilities added

### Phase 4: Refactoring Checklist - DONE
**Pages Refactored:**
- ✅ `pages/index.vue`
- ✅ `pages/about/index.vue`
- ✅ `pages/about/the-service.vue`
- ✅ `pages/about/management-team.vue`
- ✅ `pages/about/past-auditors-general.vue`
- ✅ `pages/about/departmental-profile.vue`

**Components Refactored:**
- ✅ `components/home/LatestReports.vue`
- ✅ `components/home/PublicationsPreview.vue`
- ✅ `components/home/AboutCards.vue`

### Composables Created
| Composable | Purpose |
|------------|---------|
| `useCategoryBadge` | Consistent badge variants for audit categories & publication types |
| `useReports` | Fetch and filter audit reports |
| `usePublications` | Fetch and filter publications |
| `useSearch` | Global site search |

### Results Achieved
- **9 new UI components** created
- **4 composables** for data/utility functions
- **All pages** refactored to use reusable components
- **Consistent styling** via Tailwind CSS utilities
- **0 TypeScript errors** in final build

---

*Document created: December 11, 2025*
*Last updated: December 11, 2025*
*Implementation completed: December 11, 2025*
