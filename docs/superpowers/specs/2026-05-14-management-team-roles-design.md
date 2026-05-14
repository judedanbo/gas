# Management Team Role Expansion & Office Hierarchy

**Date:** 2026-05-14
**Status:** Approved

## Summary

Expand the management team admin pages (create/edit) to support six roles instead of three, add hierarchical office relationships via a `parentId` column, rename the `section` office type to `sector`, seed six sectors, and implement role-based cascading office selection in the admin UI.

## Current State

- **Roles:** `auditor-general`, `deputy-auditor-general`, `regional-auditor`
- **Office types:** `head-office`, `regional-office`, `district-office`, `section`, `branch`
- **Office grouping:** District offices share a `region` varchar with their regional office (no explicit parent FK)
- **Admin UI:** Role dropdown shows 3 roles; regional auditor shows a flat office dropdown; DAG shows a department dropdown

## Target State

### New Roles

Six roles in the management team enum:

| Role | Slug Prefix | Office Selection | Department? | Responsibilities? |
|------|-------------|-----------------|-------------|-------------------|
| Auditor-General | `ag-` | None | No | No |
| Deputy AG | `dag-` | None | Yes (department dropdown) | Yes |
| Regional Auditor | `ra-` | Single dropdown: regional offices | No | Yes |
| District Auditor | `da-` | Cascading: region → district | No | No |
| Sector Head | `sh-` | Single dropdown: sectors | No | No |
| Branch Head | `bh-` | Cascading: sector → branch | No | No |

### Database Changes

#### 1. `offices` table — add `parentId`

```sql
ALTER TABLE offices ADD COLUMN parent_id INT NULL;
ALTER TABLE offices ADD CONSTRAINT fk_offices_parent
  FOREIGN KEY (parent_id) REFERENCES offices(id) ON DELETE SET NULL;
CREATE INDEX idx_offices_parent_id ON offices(parent_id);
```

- District offices → `parentId` = their regional office ID (matched by `region` field during migration)
- Branches → `parentId` = their parent sector ID
- Regional offices and sectors → `parentId` = NULL (top-level within their category)

#### 2. Rename office type `section` → `sector`

Update `office_types` row where `slug = 'section'` to `slug = 'sector'`, `name = 'Sector'`.

#### 3. Expand `management_team.role` enum

```sql
ALTER TABLE management_team
  MODIFY COLUMN role ENUM(
    'auditor-general',
    'deputy-auditor-general',
    'regional-auditor',
    'district-auditor',
    'sector-head',
    'branch-head'
  ) NOT NULL;
```

### Admin UI Changes (create.vue and [id]/edit.vue)

#### Role Dropdown

```
Auditor-General
Deputy Auditor-General
Regional Auditor
District Auditor
Sector Head
Branch Head
```

#### Conditional Office Fields

**Regional Auditor:** Single `<AdminFormAdminSelect>` showing offices where `typeSlug = 'regional-office'`. Binds to `officeId`.

**District Auditor:** Two dropdowns:
1. "Region" — offices where `typeSlug = 'regional-office'` (used as a filter, binds to a local `selectedRegionId` ref)
2. "District Office" — offices where `typeSlug = 'district-office'` AND `parentId = selectedRegionId`. Binds to `officeId`.
   - When the region changes, reset the district selection and re-filter.

**Sector Head:** Single dropdown showing offices where `typeSlug = 'sector'`. Binds to `officeId`.

**Branch Head:** Two dropdowns:
1. "Sector" — offices where `typeSlug = 'sector'` (filter only, binds to `selectedSectorId`)
2. "Branch" — offices where `typeSlug = 'branch'` AND `parentId = selectedSectorId`. Binds to `officeId`.
   - When the sector changes, reset the branch selection and re-filter.

**Deputy AG:** Department dropdown (unchanged).

**Auditor-General:** No office or department fields.

### API Changes

#### Offices list endpoint (`/api/admin/offices`)

Add optional query filters:
- `typeSlug` — filter offices by office type slug (e.g., `regional-office`, `district-office`, `sector`, `branch`)
- `parentId` — filter offices by parent ID (for cascading dropdowns)

These filters allow the admin UI to fetch exactly the offices needed for each dropdown without client-side filtering.

### Validation Changes (`server/utils/validation.ts`)

- Expand role enum: add `'district-auditor'`, `'sector-head'`, `'branch-head'`
- Add refinement: district auditors, sector heads, and branch heads must have `officeId` set
- Remove the DAG `departmentId` requirement for the new roles (they don't use departments)

### Type Changes (`types/admin.ts`)

- Expand `ManagementRole` union type with the 3 new roles
- Add `parentId` to `AdminOffice` interface

### Seed Data

#### Sectors (6 entries, office type = `sector`)

| Slug | Name | Region |
|------|------|--------|
| `cg-sector-1` | Sector 1 | Greater Accra |
| `cg-sector-2` | Sector 2 | Greater Accra |
| `cg-sector-3` | Sector 3 | Greater Accra |
| `cg-sector-4` | Sector 4 | Greater Accra |
| `cg-sector-5` | Sector 5 | Greater Accra |
| `cg-sector-6` | Sector 6 | Greater Accra |

All sectors have `parentId = NULL` (top-level). Branches will be seeded later.

#### Backfill `parentId` for existing district offices

For each district office, find the regional office with the same `region` value and set `parentId` accordingly.

### Files to Modify

| File | Change |
|------|--------|
| `server/database/schema/offices.ts` | Add `parentId` column with self-referencing FK |
| `server/database/schema/organization.ts` | Expand role enum to 6 values |
| `server/utils/validation.ts` | Expand role enum, add refinements for new roles |
| `types/admin.ts` | Expand `ManagementRole`, add `parentId` to `AdminOffice` |
| `pages/admin/management-team/create.vue` | Role-based cascading office selection UI |
| `pages/admin/management-team/[id]/edit.vue` | Same cascading UI with pre-populated values |
| `server/api/admin/offices/index.ts` | Add `typeSlug` and `parentId` query filters |
| `server/database/seeds/offices.ts` | Add sector seed data + `parentId` backfill |

### Files to Create

| File | Purpose |
|------|---------|
| `server/database/migrations/add-parent-id-to-offices.ts` | Migration script for `parentId` column + backfill |

### Out of Scope

- Branch seed data (deferred per user request)
- Public-facing pages for new roles
- Changes to the management team public API response shape
