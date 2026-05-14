# Management Team Role Expansion & Office Hierarchy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the management team from 3 roles to 6, add parent-child office hierarchy via `parentId`, rename `section` → `sector`, seed 6 sectors, and build role-based cascading office dropdowns in the admin create/edit pages.

**Architecture:** Schema-first — add `parentId` to `offices`, expand the role enum in `management_team`, then update types/validation, then the API filter, then both admin pages. A standalone migration script handles the DB changes and backfills `parentId` for existing district offices by matching `region` fields.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Drizzle ORM + MySQL 8, Zod validation, TypeScript strict

---

## Task 1: Add `parentId` to offices schema

**Files:**
- Modify: `ghana-audit-service/server/database/schema/offices.ts`

- [ ] **Step 1: Add `parentId` column and index to the schema**

In `ghana-audit-service/server/database/schema/offices.ts`, add the `parentId` column after `typeId` and add an index for it:

```typescript
// Add to the offices table columns, after typeId:
    parentId: int('parent_id').references(() => offices.id, {
      onDelete: 'set null'
    }),
```

And add to the indexes array:

```typescript
    index('idx_offices_parent_id').on(table.parentId)
```

Also add `parentId` to the type export section — it's already inferred from the table definition via `$inferSelect`, so no extra work needed.

- [ ] **Step 2: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: PASS — the new column is nullable and optional so nothing else breaks.

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/server/database/schema/offices.ts
git commit -m "feat(offices): add parentId column for hierarchical office relationships"
```

---

## Task 2: Expand management team role enum in schema

**Files:**
- Modify: `ghana-audit-service/server/database/schema/organization.ts`

- [ ] **Step 1: Update the role enum**

In `ghana-audit-service/server/database/schema/organization.ts`, line ~209, change the role enum from:

```typescript
    role: mysqlEnum('role', [
      'auditor-general',
      'deputy-auditor-general',
      'regional-auditor'
    ]).notNull(),
```

to:

```typescript
    role: mysqlEnum('role', [
      'auditor-general',
      'deputy-auditor-general',
      'regional-auditor',
      'district-auditor',
      'sector-head',
      'branch-head'
    ]).notNull(),
```

- [ ] **Step 2: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: May show errors in files that use a narrower `ManagementRole` type — that's addressed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/server/database/schema/organization.ts
git commit -m "feat(schema): expand management team role enum to 6 roles"
```

---

## Task 3: Update TypeScript types

**Files:**
- Modify: `ghana-audit-service/types/admin.ts`

- [ ] **Step 1: Expand `ManagementRole` union type**

In `ghana-audit-service/types/admin.ts`, line 263, change:

```typescript
export type ManagementRole = 'auditor-general' | 'deputy-auditor-general' | 'regional-auditor'
```

to:

```typescript
export type ManagementRole =
  | 'auditor-general'
  | 'deputy-auditor-general'
  | 'regional-auditor'
  | 'district-auditor'
  | 'sector-head'
  | 'branch-head'
```

- [ ] **Step 2: Add `parentId` to `AdminOffice` interface**

In `ghana-audit-service/types/admin.ts`, in the `AdminOffice` interface (around line 301), add `parentId` after `typeId`:

```typescript
export interface AdminOffice {
  id: number
  slug: string
  typeId: number
  parentId: number | null
  typeName?: string
  typeSlug?: string
  region: string
  // ... rest unchanged
```

Also add `typeSlug` — we'll need it for client-side filtering.

- [ ] **Step 3: Add `parentId` and `typeSlug` to `OfficeInput`**

In `ghana-audit-service/types/admin.ts`, in the `OfficeInput` interface (around line 509), add:

```typescript
export interface OfficeInput {
  slug: string
  typeId: number
  parentId?: number | null
  region: string
  // ... rest unchanged
```

- [ ] **Step 4: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: May still have errors in validation.ts (role enum mismatch) — fixed in Task 4.

- [ ] **Step 5: Commit**

```bash
git add ghana-audit-service/types/admin.ts
git commit -m "feat(types): expand ManagementRole and add parentId to AdminOffice"
```

---

## Task 4: Update Zod validation schema

**Files:**
- Modify: `ghana-audit-service/server/utils/validation.ts`

- [ ] **Step 1: Expand the role enum and add refinements**

In `ghana-audit-service/server/utils/validation.ts`, starting at line 282, replace the entire `managementTeamSchema` block:

```typescript
export const managementTeamSchema = z
  .object({
    slug: slugSchema,
    role: z.enum([
      'auditor-general',
      'deputy-auditor-general',
      'regional-auditor',
      'district-auditor',
      'sector-head',
      'branch-head'
    ]),
    officeId: z.number().optional().nullable(),
    departmentId: z.number().optional().nullable(),
    icon: z.string().max(100).optional().nullable(),
    photo: z.string().max(500).optional().nullable(),
    email: z.string().email().max(255).optional().nullable().or(z.literal('')),
    phone: z.string().max(50).optional().nullable(),
    displayOrder: z.number().default(0),
    isActive: z.boolean().default(true),
    translations: translationsSchema({
      name: z.string().min(1).max(255),
      title: z.string().max(255).optional().nullable(),
      bio: z.string().optional().nullable()
    }),
    responsibilities: z
      .array(
        z.object({
          displayOrder: z.number().default(0),
          translations: translationsSchema({
            description: z.string().min(1).max(500)
          })
        })
      )
      .optional()
      .default([])
  })
  .refine(
    (data) => {
      const rolesRequiringOffice = ['regional-auditor', 'district-auditor', 'sector-head', 'branch-head']
      if (rolesRequiringOffice.includes(data.role)) {
        return data.officeId !== null && data.officeId !== undefined
      }
      return true
    },
    {
      message: 'This role must be assigned to an office',
      path: ['officeId']
    }
  )
  .refine(
    (data) => {
      if (data.role === 'deputy-auditor-general') {
        return data.departmentId !== null && data.departmentId !== undefined
      }
      return true
    },
    {
      message: 'Deputy Auditors-General must be assigned to a department',
      path: ['departmentId']
    }
  )
```

- [ ] **Step 2: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: PASS — types and validation now align.

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/server/utils/validation.ts
git commit -m "feat(validation): expand management team role enum and office refinements"
```

---

## Task 5: Update management team list API to accept new roles as filter

**Files:**
- Modify: `ghana-audit-service/server/api/admin/management-team/index.ts`

- [ ] **Step 1: Expand the `validRoles` array**

In `ghana-audit-service/server/api/admin/management-team/index.ts`, line ~46, change:

```typescript
    const validRoles = ['auditor-general', 'deputy-auditor-general', 'regional-auditor'] as const
```

to:

```typescript
    const validRoles = [
      'auditor-general',
      'deputy-auditor-general',
      'regional-auditor',
      'district-auditor',
      'sector-head',
      'branch-head'
    ] as const
```

- [ ] **Step 2: Commit**

```bash
git add ghana-audit-service/server/api/admin/management-team/index.ts
git commit -m "feat(api): accept new management team roles in list filter"
```

---

## Task 6: Add `typeSlug` and `parentId` filters to offices API

**Files:**
- Modify: `ghana-audit-service/server/api/admin/offices/index.ts`

- [ ] **Step 1: Add query filters to `handleList`**

In `ghana-audit-service/server/api/admin/offices/index.ts`, in the `handleList` function, add type-based and parent-based filtering. After the existing `includeDeleted` condition (line ~29), add:

```typescript
  if (query.typeSlug && typeof query.typeSlug === 'string') {
    const typeResult = await db
      .select({ id: schema.officeTypes.id })
      .from(schema.officeTypes)
      .where(eq(schema.officeTypes.slug, query.typeSlug))
      .limit(1)
    if (typeResult.length > 0) {
      conditions.push(eq(schema.offices.typeId, typeResult[0].id))
    }
  }

  if (query.parentId && typeof query.parentId === 'string') {
    conditions.push(eq(schema.offices.parentId, Number(query.parentId)))
  }
```

Also add `eq` to the import from `drizzle-orm` (it's not in the current import list). The import line should be:

```typescript
import { eq, and, isNull, sql, asc } from 'drizzle-orm'
```

- [ ] **Step 2: Include `typeSlug` and `parentId` in the response data**

In the same file, update the response mapping to include `typeSlug` and `parentId`. First, build a typeSlugMap alongside the existing typeMap:

```typescript
  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]))
  const typeSlugMap = Object.fromEntries(types.map((t) => [t.id, t.slug]))
```

Then update the data mapping:

```typescript
  const data = offices.map((o) => ({
    ...o,
    typeName: typeMap[o.typeId] || '',
    typeSlug: typeSlugMap[o.typeId] || '',
    translations: translationsByOffice[o.id] || {}
  }))
```

- [ ] **Step 3: Also remove the pagination for dropdown queries**

When the UI fetches offices for dropdowns, it needs all matching offices, not paginated. Add a `noPagination` check:

After the `parsePagination` call, add logic so that when `typeSlug` is provided (dropdown mode), we return all results:

```typescript
  const isDropdownMode = !!query.typeSlug || !!query.parentId
  const limit = isDropdownMode ? 1000 : perPage
  const queryOffset = isDropdownMode ? 0 : offset
```

Then use `limit` and `queryOffset` in the query instead of `perPage` and `offset`. Also adjust the meta for dropdown mode:

```typescript
  return {
    data,
    meta: isDropdownMode
      ? buildPaginationMeta(data.length, 1, data.length || 1)
      : buildPaginationMeta(Number(count), page, perPage)
  }
```

- [ ] **Step 4: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ghana-audit-service/server/api/admin/offices/index.ts
git commit -m "feat(api): add typeSlug and parentId filters to offices list endpoint"
```

---

## Task 7: Update the create page with role-based cascading office selection

**Files:**
- Modify: `ghana-audit-service/pages/admin/management-team/create.vue`

- [ ] **Step 1: Update the `<script setup>` section**

Replace the entire `<script setup>` block in `ghana-audit-service/pages/admin/management-team/create.vue` with the following. Key changes:
- 6 role options instead of 3
- Slug prefixes for new roles (`da-`, `sh-`, `bh-`)
- Office data fetching filtered by `typeSlug`
- Cascading dropdown state (`selectedRegionId`, `selectedSectorId`)
- Watchers to reset child selections when parent changes
- Computed properties for each dropdown's options

```typescript
<script setup lang="ts">
  import type {
    AdminManagementTeamMember,
    ManagementTeamMemberInput,
    AdminOffice,
    AdminDepartment
  } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const router = useRouter()
  const { create, saving, error, fieldErrors } =
    useAdminCrud<AdminManagementTeamMember>('management-team')
  const { errors, validate, setErrors, rules } = useFormValidation()
  const { getList } = useAdminApi()

  // Office data by type
  const regionalOffices = ref<AdminOffice[]>([])
  const districtOffices = ref<AdminOffice[]>([])
  const sectors = ref<AdminOffice[]>([])
  const branches = ref<AdminOffice[]>([])
  const departmentsData = ref<{ data: AdminDepartment[] } | null>(null)

  // Cascading selection state
  const selectedRegionId = ref<number | null>(null)
  const selectedSectorId = ref<number | null>(null)

  onMounted(async () => {
    try {
      const [regOffices, dstOffices, sectorOffices, branchOffices, departments] = await Promise.all([
        getList<AdminOffice>('offices', { typeSlug: 'regional-office' }),
        getList<AdminOffice>('offices', { typeSlug: 'district-office' }),
        getList<AdminOffice>('offices', { typeSlug: 'sector' }),
        getList<AdminOffice>('offices', { typeSlug: 'branch' }),
        getList<AdminDepartment>('departments')
      ])
      regionalOffices.value = regOffices.data || []
      districtOffices.value = dstOffices.data || []
      sectors.value = sectorOffices.data || []
      branches.value = branchOffices.data || []
      departmentsData.value = departments
    } catch {
      // Dropdowns will be empty
    }
  })

  // Dropdown options
  const regionalOfficeOptions = computed(() =>
    regionalOffices.value.map((o) => ({
      value: o.id,
      label: o.translations?.en?.name || o.region
    }))
  )

  const filteredDistrictOptions = computed(() =>
    districtOffices.value
      .filter((o) => o.parentId === selectedRegionId.value)
      .map((o) => ({
        value: o.id,
        label: o.translations?.en?.name || o.region
      }))
  )

  const sectorOptions = computed(() =>
    sectors.value.map((o) => ({
      value: o.id,
      label: o.translations?.en?.name || o.slug
    }))
  )

  const filteredBranchOptions = computed(() =>
    branches.value
      .filter((o) => o.parentId === selectedSectorId.value)
      .map((o) => ({
        value: o.id,
        label: o.translations?.en?.name || o.slug
      }))
  )

  const departmentOptions = computed(() =>
    (departmentsData.value?.data || []).map((dept) => ({
      value: dept.id,
      label: dept.translations?.en?.name || 'Unnamed'
    }))
  )

  // Reset child selections when parent changes
  watch(selectedRegionId, () => {
    form.officeId = null
  })

  watch(selectedSectorId, () => {
    form.officeId = null
  })

  // Reset office/department fields when role changes
  watch(
    () => form.role,
    (newRole, oldRole) => {
      if (newRole !== oldRole) {
        form.officeId = null
        form.departmentId = null
        selectedRegionId.value = null
        selectedSectorId.value = null
      }
      // Regenerate slug
      const name = form.translations.en?.name
      if (name) {
        const newSlug = generateSlugWithPrefix(name, newRole)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  // Slug checking state
  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  const slugError = computed(() => {
    if (isSlugAvailable.value === false) {
      return 'This slug is already taken'
    }
    return undefined
  })

  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  const form = reactive<ManagementTeamMemberInput>({
    slug: '',
    role: 'auditor-general',
    officeId: null,
    departmentId: null,
    icon: '',
    photo: '',
    email: '',
    phone: '',
    displayOrder: 0,
    isActive: true,
    translations: { en: { name: '', title: '', bio: '' } },
    responsibilities: []
  })

  const validationRules = {
    'translations.en.name': [rules.required],
    slug: [rules.required],
    role: [rules.required]
  }

  const translationFields = [
    { key: 'name', label: 'Full Name', type: 'input' as const, required: true },
    { key: 'title', label: 'Title/Portfolio', type: 'input' as const, required: false },
    { key: 'bio', label: 'Biography', type: 'richtext' as const }
  ]

  const translationErrors = computed(() => {
    const result: Record<string, Record<string, string>> = {}
    for (const [key, message] of Object.entries(errors)) {
      const match = key.match(/^translations\.(\w+)\.(\w+)$/)
      if (match) {
        const [, locale, field] = match
        if (!result[locale]) result[locale] = {}
        result[locale][field] = message
      }
    }
    return result
  })

  const roleOptions = [
    { value: 'auditor-general', label: 'Auditor-General' },
    { value: 'deputy-auditor-general', label: 'Deputy Auditor-General' },
    { value: 'regional-auditor', label: 'Regional Auditor' },
    { value: 'district-auditor', label: 'District Auditor' },
    { value: 'sector-head', label: 'Sector Head' },
    { value: 'branch-head', label: 'Branch Head' }
  ]

  function addResponsibility() {
    form.responsibilities = form.responsibilities || []
    form.responsibilities.push({
      displayOrder: form.responsibilities.length,
      translations: { en: { description: '' }, ak: { description: '' } }
    })
  }

  function removeResponsibility(index: number) {
    form.responsibilities?.splice(index, 1)
    form.responsibilities?.forEach((r, i) => (r.displayOrder = i))
  }

  function moveResponsibility(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= (form.responsibilities?.length || 0)) return
    const resps = form.responsibilities!
    ;[resps[index], resps[newIndex]] = [resps[newIndex], resps[index]]
    resps.forEach((r, i) => (r.displayOrder = i))
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function getRolePrefix(role: string): string {
    const prefixes: Record<string, string> = {
      'auditor-general': 'ag',
      'deputy-auditor-general': 'dag',
      'regional-auditor': 'ra',
      'district-auditor': 'da',
      'sector-head': 'sh',
      'branch-head': 'bh'
    }
    return prefixes[role] || ''
  }

  function generateSlugWithPrefix(name: string, role: string): string {
    const baseSlug = generateSlug(name)
    const prefix = getRolePrefix(role)
    return prefix ? `${prefix}-${baseSlug}` : baseSlug
  }

  async function checkSlugAvailability(slug: string) {
    if (!slug) {
      isSlugAvailable.value = null
      slugSuggestion.value = null
      return
    }

    isCheckingSlug.value = true
    isSlugAvailable.value = null
    slugSuggestion.value = null

    try {
      const { get } = useAdminApi()
      const response = await get<{ available: boolean; suggestion?: string }>(
        'management-team/check-slug',
        { slug }
      )
      isSlugAvailable.value = response.available
      slugSuggestion.value = response.suggestion || null
    } catch {
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  function handleSlugChange(value: string | number) {
    const slugValue = String(value)

    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout)
    }

    slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(slugValue)
    }, 300)
  }

  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      form.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
    }
  }

  // Auto-generate slug from name with role prefix
  watch(
    () => form.translations.en?.name,
    (name) => {
      if (name) {
        const newSlug = generateSlugWithPrefix(name, form.role)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await create({
      ...form,
      displayOrder: Number(form.displayOrder) || 0,
      officeId: form.officeId ? Number(form.officeId) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      icon: form.icon || null,
      photo: form.photo || null,
      email: form.email || null,
      phone: form.phone || null
    })
    if (result) {
      router.push('/admin/management-team')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
```

- [ ] **Step 2: Update the `<template>` section — role-based office dropdowns**

In the template, replace the two conditional `<AdminFormAdminSelect>` blocks for office and department (lines ~163-180) with the full set of role-based dropdowns:

```html
              <!-- Deputy AG: Department -->
              <AdminFormAdminSelect
                v-if="form.role === 'deputy-auditor-general'"
                v-model="form.departmentId"
                label="Department"
                :options="departmentOptions"
                required
                :error="errors.departmentId"
                help-text="Select the department for this DAG"
              />

              <!-- Regional Auditor: Regional Office -->
              <AdminFormAdminSelect
                v-if="form.role === 'regional-auditor'"
                v-model="form.officeId"
                label="Regional Office"
                :options="regionalOfficeOptions"
                required
                :error="errors.officeId"
                help-text="Select the regional office"
              />

              <!-- District Auditor: Region then District -->
              <template v-if="form.role === 'district-auditor'">
                <AdminFormAdminSelect
                  v-model="selectedRegionId"
                  label="Region"
                  :options="regionalOfficeOptions"
                  required
                  help-text="Select the region first"
                />
                <AdminFormAdminSelect
                  v-model="form.officeId"
                  label="District Office"
                  :options="filteredDistrictOptions"
                  required
                  :error="errors.officeId"
                  :disabled="!selectedRegionId"
                  help-text="Select the district office"
                />
              </template>

              <!-- Sector Head: Sector -->
              <AdminFormAdminSelect
                v-if="form.role === 'sector-head'"
                v-model="form.officeId"
                label="Sector"
                :options="sectorOptions"
                required
                :error="errors.officeId"
                help-text="Select the sector"
              />

              <!-- Branch Head: Sector then Branch -->
              <template v-if="form.role === 'branch-head'">
                <AdminFormAdminSelect
                  v-model="selectedSectorId"
                  label="Sector"
                  :options="sectorOptions"
                  required
                  help-text="Select the sector first"
                />
                <AdminFormAdminSelect
                  v-model="form.officeId"
                  label="Branch"
                  :options="filteredBranchOptions"
                  required
                  :error="errors.officeId"
                  :disabled="!selectedSectorId"
                  help-text="Select the branch"
                />
              </template>
```

- [ ] **Step 3: Update the page subtitle**

Change the subtitle from:

```html
          Add Auditor-General, Deputy AG, or Regional Auditor
```

to:

```html
          Add a new management team member
```

- [ ] **Step 4: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ghana-audit-service/pages/admin/management-team/create.vue
git commit -m "feat(admin): add role-based cascading office selection to create page"
```

---

## Task 8: Update the edit page with role-based cascading office selection

**Files:**
- Modify: `ghana-audit-service/pages/admin/management-team/[id]/edit.vue`

This mirrors Task 7 but includes pre-populating the cascading dropdowns from existing data.

- [ ] **Step 1: Update the `<script setup>` section**

Replace the entire `<script setup>` in `ghana-audit-service/pages/admin/management-team/[id]/edit.vue`. The key differences from create:
- On mount, after fetching the member, pre-populate `selectedRegionId` / `selectedSectorId` by looking up the office's `parentId`
- Slug check passes `excludeId`

```typescript
<script setup lang="ts">
  import type {
    AdminManagementTeamMember,
    ManagementTeamMemberInput,
    AdminOffice,
    AdminDepartment
  } from '~/types/admin'
  definePageMeta({ layout: 'admin' })

  const route = useRoute()
  const router = useRouter()
  const id = Number(route.params.id)

  const { currentItem, loading, saving, error, fieldErrors, fetchOne, update } =
    useAdminCrud<AdminManagementTeamMember>('management-team')
  const { errors, validate, setErrors, clearFieldError, rules } = useFormValidation()
  const { getList } = useAdminApi()

  // Office data by type
  const regionalOffices = ref<AdminOffice[]>([])
  const districtOffices = ref<AdminOffice[]>([])
  const sectors = ref<AdminOffice[]>([])
  const branches = ref<AdminOffice[]>([])
  const departmentsData = ref<{ data: AdminDepartment[] } | null>(null)

  // Cascading selection state
  const selectedRegionId = ref<number | null>(null)
  const selectedSectorId = ref<number | null>(null)

  const regionalOfficeOptions = computed(() =>
    regionalOffices.value.map((o) => ({
      value: o.id,
      label: o.translations?.en?.name || o.region
    }))
  )

  const filteredDistrictOptions = computed(() =>
    districtOffices.value
      .filter((o) => o.parentId === selectedRegionId.value)
      .map((o) => ({
        value: o.id,
        label: o.translations?.en?.name || o.region
      }))
  )

  const sectorOptions = computed(() =>
    sectors.value.map((o) => ({
      value: o.id,
      label: o.translations?.en?.name || o.slug
    }))
  )

  const filteredBranchOptions = computed(() =>
    branches.value
      .filter((o) => o.parentId === selectedSectorId.value)
      .map((o) => ({
        value: o.id,
        label: o.translations?.en?.name || o.slug
      }))
  )

  const departmentOptions = computed(() =>
    (departmentsData.value?.data || []).map((dept) => ({
      value: dept.id,
      label: dept.translations?.en?.name || 'Unnamed'
    }))
  )

  // Reset child office when parent changes (only after initial load)
  const initialized = ref(false)
  watch(selectedRegionId, () => {
    if (initialized.value) form.officeId = null
  })
  watch(selectedSectorId, () => {
    if (initialized.value) form.officeId = null
  })

  // Reset fields when role changes
  watch(
    () => form.role,
    (newRole, oldRole) => {
      if (initialized.value && newRole !== oldRole) {
        form.officeId = null
        form.departmentId = null
        selectedRegionId.value = null
        selectedSectorId.value = null
      }
      if (newRole !== oldRole && form.translations.en?.name) {
        const newSlug = generateSlugWithPrefix(form.translations.en.name, newRole)
        form.slug = newSlug
        handleSlugChange(newSlug)
      }
    }
  )

  // Slug checking state
  const isCheckingSlug = ref(false)
  const isSlugAvailable = ref<boolean | null>(null)
  const slugSuggestion = ref<string | null>(null)
  const slugError = computed(() => {
    if (isSlugAvailable.value === false) {
      return 'This slug is already taken'
    }
    return undefined
  })

  let slugCheckTimeout: ReturnType<typeof setTimeout> | null = null

  const form = reactive<ManagementTeamMemberInput>({
    slug: '',
    role: 'auditor-general',
    officeId: null,
    departmentId: null,
    icon: '',
    photo: '',
    email: '',
    phone: '',
    displayOrder: 0,
    isActive: true,
    translations: { en: { name: '', title: '', bio: '' } },
    responsibilities: []
  })

  const validationRules = {
    'translations.en.name': [rules.required],
    slug: [rules.required],
    role: [rules.required]
  }

  const translationFields = [
    { key: 'name', label: 'Full Name', type: 'input' as const, required: true },
    { key: 'title', label: 'Title/Portfolio', type: 'input' as const, required: false },
    { key: 'bio', label: 'Biography', type: 'richtext' as const }
  ]

  const translationErrors = computed(() => {
    const result: Record<string, Record<string, string>> = {}
    for (const [key, message] of Object.entries(errors)) {
      const match = key.match(/^translations\.(\w+)\.(\w+)$/)
      if (match) {
        const [, locale, field] = match
        if (!result[locale]) result[locale] = {}
        result[locale][field] = message
      }
    }
    return result
  })

  const roleOptions = [
    { value: 'auditor-general', label: 'Auditor-General' },
    { value: 'deputy-auditor-general', label: 'Deputy Auditor-General' },
    { value: 'regional-auditor', label: 'Regional Auditor' },
    { value: 'district-auditor', label: 'District Auditor' },
    { value: 'sector-head', label: 'Sector Head' },
    { value: 'branch-head', label: 'Branch Head' }
  ]

  function addResponsibility() {
    form.responsibilities = form.responsibilities || []
    form.responsibilities.push({
      displayOrder: form.responsibilities.length,
      translations: { en: { description: '' }, ak: { description: '' } }
    })
  }

  function removeResponsibility(index: number) {
    form.responsibilities?.splice(index, 1)
    form.responsibilities?.forEach((r, i) => (r.displayOrder = i))
  }

  function moveResponsibility(index: number, direction: number) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= (form.responsibilities?.length || 0)) return
    const resps = form.responsibilities!
    ;[resps[index], resps[newIndex]] = [resps[newIndex], resps[index]]
    resps.forEach((r, i) => (r.displayOrder = i))
  }

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function getRolePrefix(role: string): string {
    const prefixes: Record<string, string> = {
      'auditor-general': 'ag',
      'deputy-auditor-general': 'dag',
      'regional-auditor': 'ra',
      'district-auditor': 'da',
      'sector-head': 'sh',
      'branch-head': 'bh'
    }
    return prefixes[role] || ''
  }

  function generateSlugWithPrefix(name: string, role: string): string {
    const baseSlug = generateSlug(name)
    const prefix = getRolePrefix(role)
    return prefix ? `${prefix}-${baseSlug}` : baseSlug
  }

  async function checkSlugAvailability(slug: string) {
    if (!slug) {
      isSlugAvailable.value = null
      slugSuggestion.value = null
      return
    }

    isCheckingSlug.value = true
    isSlugAvailable.value = null
    slugSuggestion.value = null

    try {
      const { get } = useAdminApi()
      const response = await get<{ available: boolean; suggestion?: string }>(
        'management-team/check-slug',
        { slug, excludeId: id }
      )
      isSlugAvailable.value = response.available
      slugSuggestion.value = response.suggestion || null
    } catch {
      isSlugAvailable.value = null
    } finally {
      isCheckingSlug.value = false
    }
  }

  function handleSlugChange(value: string | number) {
    const slugValue = String(value)
    clearFieldError('slug')

    if (slugCheckTimeout) {
      clearTimeout(slugCheckTimeout)
    }

    slugCheckTimeout = setTimeout(() => {
      checkSlugAvailability(slugValue)
    }, 300)
  }

  function useSlugSuggestion() {
    if (slugSuggestion.value) {
      form.slug = slugSuggestion.value
      isSlugAvailable.value = true
      slugSuggestion.value = null
    }
  }

  onMounted(async () => {
    try {
      const [regOffices, dstOffices, sectorOffices, branchOffices, departments] = await Promise.all([
        getList<AdminOffice>('offices', { typeSlug: 'regional-office' }),
        getList<AdminOffice>('offices', { typeSlug: 'district-office' }),
        getList<AdminOffice>('offices', { typeSlug: 'sector' }),
        getList<AdminOffice>('offices', { typeSlug: 'branch' }),
        getList<AdminDepartment>('departments')
      ])
      regionalOffices.value = regOffices.data || []
      districtOffices.value = dstOffices.data || []
      sectors.value = sectorOffices.data || []
      branches.value = branchOffices.data || []
      departmentsData.value = departments
    } catch {
      // Dropdowns will be empty
    }

    const item = await fetchOne(id)
    if (item) {
      form.slug = item.slug
      form.role = item.role
      form.officeId = item.officeId || null
      form.departmentId = item.departmentId || null
      form.icon = item.icon || ''
      form.photo = item.photo || ''
      form.email = item.email || ''
      form.phone = item.phone || ''
      form.displayOrder = item.displayOrder
      form.isActive = item.isActive
      form.translations = item.translations || { en: { name: '', title: '', bio: '' } }
      form.responsibilities =
        item.responsibilities?.map((r) => ({
          displayOrder: r.displayOrder,
          translations: {
            en: { description: r.translations?.en?.description || '' },
            ak: { description: r.translations?.ak?.description || '' }
          }
        })) || []

      // Pre-populate cascading parent selection for district auditors
      if (item.role === 'district-auditor' && item.officeId) {
        const office = districtOffices.value.find((o) => o.id === item.officeId)
        if (office?.parentId) {
          selectedRegionId.value = office.parentId
        }
      }

      // Pre-populate cascading parent selection for branch heads
      if (item.role === 'branch-head' && item.officeId) {
        const office = branches.value.find((o) => o.id === item.officeId)
        if (office?.parentId) {
          selectedSectorId.value = office.parentId
        }
      }

      nextTick(() => {
        initialized.value = true
      })
    }
  })

  async function handleSubmit() {
    if (!validate(form, validationRules)) return

    const result = await update(id, {
      ...form,
      displayOrder: Number(form.displayOrder) || 0,
      officeId: form.officeId ? Number(form.officeId) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      icon: form.icon || null,
      photo: form.photo || null,
      email: form.email || null,
      phone: form.phone || null
    })
    if (result) {
      router.push('/admin/management-team')
    } else if (fieldErrors.value) {
      setErrors(fieldErrors.value)
    }
  }
</script>
```

- [ ] **Step 2: Update the `<template>` section — same dropdown structure as create page**

Replace the office/department dropdowns in the Settings card (same markup as Task 7 Step 2):

```html
              <!-- Deputy AG: Department -->
              <AdminFormAdminSelect
                v-if="form.role === 'deputy-auditor-general'"
                v-model="form.departmentId"
                label="Department"
                :options="departmentOptions"
                required
                :error="errors.departmentId"
                help-text="Select the department for this DAG"
              />

              <!-- Regional Auditor: Regional Office -->
              <AdminFormAdminSelect
                v-if="form.role === 'regional-auditor'"
                v-model="form.officeId"
                label="Regional Office"
                :options="regionalOfficeOptions"
                required
                :error="errors.officeId"
                help-text="Select the regional office"
              />

              <!-- District Auditor: Region then District -->
              <template v-if="form.role === 'district-auditor'">
                <AdminFormAdminSelect
                  v-model="selectedRegionId"
                  label="Region"
                  :options="regionalOfficeOptions"
                  required
                  help-text="Select the region first"
                />
                <AdminFormAdminSelect
                  v-model="form.officeId"
                  label="District Office"
                  :options="filteredDistrictOptions"
                  required
                  :error="errors.officeId"
                  :disabled="!selectedRegionId"
                  help-text="Select the district office"
                />
              </template>

              <!-- Sector Head: Sector -->
              <AdminFormAdminSelect
                v-if="form.role === 'sector-head'"
                v-model="form.officeId"
                label="Sector"
                :options="sectorOptions"
                required
                :error="errors.officeId"
                help-text="Select the sector"
              />

              <!-- Branch Head: Sector then Branch -->
              <template v-if="form.role === 'branch-head'">
                <AdminFormAdminSelect
                  v-model="selectedSectorId"
                  label="Sector"
                  :options="sectorOptions"
                  required
                  help-text="Select the sector first"
                />
                <AdminFormAdminSelect
                  v-model="form.officeId"
                  label="Branch"
                  :options="filteredBranchOptions"
                  required
                  :error="errors.officeId"
                  :disabled="!selectedSectorId"
                  help-text="Select the branch"
                />
              </template>
```

- [ ] **Step 3: Run typecheck**

Run: `cd ghana-audit-service && npx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add ghana-audit-service/pages/admin/management-team/[id]/edit.vue
git commit -m "feat(admin): add role-based cascading office selection to edit page"
```

---

## Task 9: Create migration script for DB changes + backfill

**Files:**
- Create: `ghana-audit-service/server/database/migrations/add-parent-id-to-offices.ts`

- [ ] **Step 1: Write the migration script**

Create `ghana-audit-service/server/database/migrations/add-parent-id-to-offices.ts`:

```typescript
/**
 * Migration: Add parent_id to offices, rename section→sector, expand management_team role enum
 *
 * Run with: npx tsx server/database/migrations/add-parent-id-to-offices.ts
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

async function migrate() {
  console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`)
  const connection = await mysql.createConnection(dbConfig)

  try {
    // 1. Add parent_id column to offices (if not exists)
    const [cols] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'offices' AND COLUMN_NAME = 'parent_id'`,
      [dbConfig.database]
    )

    if (cols.length === 0) {
      console.log('Adding parent_id column to offices...')
      await connection.execute(
        `ALTER TABLE offices ADD COLUMN parent_id INT NULL AFTER type_id`
      )
      await connection.execute(
        `ALTER TABLE offices ADD CONSTRAINT fk_offices_parent FOREIGN KEY (parent_id) REFERENCES offices(id) ON DELETE SET NULL`
      )
      await connection.execute(
        `CREATE INDEX idx_offices_parent_id ON offices(parent_id)`
      )
      console.log('Added parent_id column with FK and index.')
    } else {
      console.log('parent_id column already exists, skipping.')
    }

    // 2. Rename office type section → sector
    const [sectionType] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM office_types WHERE slug = 'section'`
    )

    if (sectionType.length > 0) {
      console.log('Renaming office type section → sector...')
      await connection.execute(
        `UPDATE office_types SET slug = 'sector', name = 'Sector' WHERE slug = 'section'`
      )
      console.log('Renamed section → sector.')
    } else {
      console.log('No section office type found (may already be renamed), skipping.')
    }

    // 3. Expand management_team role enum
    console.log('Expanding management_team role enum...')
    await connection.execute(
      `ALTER TABLE management_team MODIFY COLUMN role ENUM('auditor-general', 'deputy-auditor-general', 'regional-auditor', 'district-auditor', 'sector-head', 'branch-head') NOT NULL`
    )
    console.log('Expanded role enum to 6 values.')

    // 4. Backfill parent_id for district offices
    console.log('Backfilling parent_id for district offices...')
    const [districtTypeRow] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM office_types WHERE slug = 'district-office'`
    )
    const [regionalTypeRow] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM office_types WHERE slug = 'regional-office'`
    )

    if (districtTypeRow.length > 0 && regionalTypeRow.length > 0) {
      const districtTypeId = districtTypeRow[0].id
      const regionalTypeId = regionalTypeRow[0].id

      const [updated] = await connection.execute<mysql.ResultSetHeader>(
        `UPDATE offices d
         JOIN offices r ON d.region = r.region AND r.type_id = ?
         SET d.parent_id = r.id
         WHERE d.type_id = ? AND d.parent_id IS NULL`,
        [regionalTypeId, districtTypeId]
      )
      console.log(`Backfilled parent_id for ${updated.affectedRows} district offices.`)
    }

    console.log('Migration complete.')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

migrate()
```

- [ ] **Step 2: Commit**

```bash
git add ghana-audit-service/server/database/migrations/add-parent-id-to-offices.ts
git commit -m "feat(migration): add parentId to offices, rename section→sector, expand role enum"
```

---

## Task 10: Update seed script — add sectors and rename section→sector

**Files:**
- Modify: `ghana-audit-service/server/database/seeds/offices.ts`

- [ ] **Step 1: Update the office type slug from `section` to `sector`**

In `ghana-audit-service/server/database/seeds/offices.ts`, line ~26, change the type:

```typescript
type OfficeTypeSlug = 'head-office' | 'regional-office' | 'district-office' | 'sector' | 'branch'
```

And update the seed array entry at line ~33:

```typescript
  { slug: 'sector', name: 'Sector', displayOrder: 3 },
```

- [ ] **Step 2: Add sector seed data to the offices array**

Add the following entries to the `offices` array, before the closing `]`:

```typescript
  // ── Sectors (Central Government Audit Department) ──
  {
    slug: 'cg-sector-1',
    type: 'sector',
    region: 'Greater Accra',
    phone: null,
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Sector 1', address: 'Head Office, Accra' }
  },
  {
    slug: 'cg-sector-2',
    type: 'sector',
    region: 'Greater Accra',
    phone: null,
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Sector 2', address: 'Head Office, Accra' }
  },
  {
    slug: 'cg-sector-3',
    type: 'sector',
    region: 'Greater Accra',
    phone: null,
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Sector 3', address: 'Head Office, Accra' }
  },
  {
    slug: 'cg-sector-4',
    type: 'sector',
    region: 'Greater Accra',
    phone: null,
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Sector 4', address: 'Head Office, Accra' }
  },
  {
    slug: 'cg-sector-5',
    type: 'sector',
    region: 'Greater Accra',
    phone: null,
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Sector 5', address: 'Head Office, Accra' }
  },
  {
    slug: 'cg-sector-6',
    type: 'sector',
    region: 'Greater Accra',
    phone: null,
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Sector 6', address: 'Head Office, Accra' }
  }
```

- [ ] **Step 3: Commit**

```bash
git add ghana-audit-service/server/database/seeds/offices.ts
git commit -m "feat(seeds): add 6 sectors and rename section→sector in office types"
```

---

## Task 11: Run Drizzle schema push and verify

- [ ] **Step 1: Push schema changes to the database**

Run: `cd ghana-audit-service && npm run db:migrate`

This uses `drizzle-kit push` which reads the schema files and applies changes to the live DB. It will detect the new `parentId` column and the expanded enum.

- [ ] **Step 2: Run the migration script to backfill and rename**

Run: `cd ghana-audit-service && npx tsx server/database/migrations/add-parent-id-to-offices.ts`

This handles the data-level changes: renaming the office type, expanding the enum, and backfilling `parentId` for district offices.

- [ ] **Step 3: Seed the sectors**

Run: `cd ghana-audit-service && npx tsx server/database/seeds/offices.ts`

If offices already exist, use `--force` to clear and reseed, or manually insert just the sectors.

- [ ] **Step 4: Run typecheck and lint**

Run: `cd ghana-audit-service && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit any generated migration files**

```bash
git add -A ghana-audit-service/server/database/migrations/
git commit -m "chore(db): apply schema changes for parentId and role enum expansion"
```

---

## Task 12: Manual smoke test

- [ ] **Step 1: Start the dev server**

Run: `cd ghana-audit-service && npm run dev`

- [ ] **Step 2: Test the create page**

Navigate to `http://localhost:3000/admin/management-team/create`. Verify:
1. Role dropdown shows all 6 roles
2. Selecting "Regional Auditor" shows a single Regional Office dropdown
3. Selecting "District Auditor" shows Region dropdown → then District dropdown filters correctly
4. Selecting "Sector Head" shows a single Sector dropdown with Sectors 1-6
5. Selecting "Branch Head" shows Sector dropdown → then Branch dropdown (empty until branches are seeded)
6. Selecting "Deputy AG" shows Department dropdown
7. Selecting "Auditor-General" shows no office/department
8. Changing roles resets the office/department selections
9. Slug auto-generates with correct prefix for each role

- [ ] **Step 3: Test the edit page**

Edit an existing member. Change their role. Verify dropdowns update correctly and pre-populate when editing a district auditor or branch head.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(admin): address smoke test findings for management team roles"
```
