# Management Team Real Data Population

**Date:** 2026-05-08
**Branch:** `feature/management-team-real-data`
**Status:** Approved

## Goal

Replace placeholder management team seed data with real data scraped from
<https://audit.gov.gh/2/13/management-team> and its sub-pages. Download member
photos into the codebase. Create a departments seed that the management team
seed depends on.

## Scope

**In scope:**

- Download 7 management team member photos to `public/images/management/`
- Create `server/database/seeds/departments.ts` with the 6 real departments
- Rewrite `server/database/seeds/management-team.ts` with real names, titles,
  bios, photo paths, and department linkages

**Out of scope:**

- Schema changes (existing tables support all required fields)
- API route changes
- Public page or admin page changes
- Akan translations (can be added later via admin panel)
- Regional auditors (can be added later)

## Data Source

All data comes from the Ghana Audit Service website:

- Main page: <https://audit.gov.gh/2/13/management-team>
- Individual pages at `/2/13/{id}/{slug}` for each member

## Department Mapping

| # | Slug                       | Name (EN)                                                      | Icon                            |
|---|----------------------------|----------------------------------------------------------------|---------------------------------|
| 1 | central-government-audit   | Central Government Audit Department                            | heroicons:building-library      |
| 2 | commercial-audit           | Commercial Audit Department                                    | heroicons:briefcase             |
| 3 | performance-special-audit  | Performance and Special Audit Department                       | heroicons:chart-bar             |
| 4 | finance-admin-hr           | Finance, Administration and Human Resource Department          | heroicons:wrench-screwdriver    |
| 5 | eida-southern-zone         | Educational Institutions and District Assemblies - Southern Zone | heroicons:academic-cap        |
| 6 | eida-northern-zone         | Educational Institutions and District Assemblies - Northern Zone | heroicons:map                 |

## Management Team Members

| # | Slug                         | Role                    | Name                          | Department                  | Order |
|---|------------------------------|-------------------------|-------------------------------|-----------------------------|-------|
| 1 | johnson-akuamoah-asiedu      | auditor-general         | Johnson Akuamoah Asiedu       | (none)                      | 0     |
| 2 | eugenia-shorme-nortey        | deputy-auditor-general  | Eugenia Shorme Nortey         | finance-admin-hr            | 1     |
| 3 | samuel-frimpong-manso        | deputy-auditor-general  | Samuel Frimpong-Manso         | performance-special-audit   | 2     |
| 4 | roberta-assiamah-appiah      | deputy-auditor-general  | Roberta Assiamah-Appiah       | eida-southern-zone          | 3     |
| 5 | samuel-nii-odartey-lamptey   | deputy-auditor-general  | Samuel Nii Odartey Lamptey    | commercial-audit            | 4     |
| 6 | judith-kwaaku                | deputy-auditor-general  | Judith Kwaaku                 | central-government-audit    | 5     |
| 7 | george-swanzy-winful         | deputy-auditor-general  | George Swanzy Winful          | eida-northern-zone          | 6     |

Display order follows the order on the source website.

## Image Handling

- Source URLs: `https://audit.gov.gh/img/management/<original_name>.jpg`
- Destination: `public/images/management/<slug>.jpg`
- Photo field value: `/images/management/<slug>.jpg`
- Images committed to the repo (no external runtime dependency)

Files:

```
public/images/management/
  johnson-akuamoah-asiedu.jpg
  eugenia-shorme-nortey.jpg
  samuel-frimpong-manso.jpg
  roberta-assiamah-appiah.jpg
  samuel-nii-odartey-lamptey.jpg
  judith-kwaaku.jpg
  george-swanzy-winful.jpg
```

## Seed Scripts

### 1. `server/database/seeds/departments.ts` (new)

- Creates the 6 departments with English translations
- Idempotent: checks for existing records before inserting
- Run with: `npx tsx server/database/seeds/departments.ts`

### 2. `server/database/seeds/management-team.ts` (rewritten)

- Inserts 7 members with real names, titles, and full bios
- Looks up departmentId by slug from the departments table
- References photos at `/images/management/<slug>.jpg`
- Includes email for the Auditor-General (`info@audit.gov.gh`)
- Idempotent: checks for existing records before inserting
- Run with: `npx tsx server/database/seeds/management-team.ts`

**Run order:** departments first, then management-team.

## Bio Content

Full bios for each member were extracted from their individual pages on
audit.gov.gh. Each bio includes career history, qualifications, education,
international experience, and personal interests where available. Bios are
stored as plain text in the `bio` field of the English translation.

## What Does NOT Change

- Database schema (tables already support all fields)
- API routes (already serve management team data)
- Transform utilities (already shape DTOs correctly)
- Public page (`pages/about/management-team.vue`)
- Admin pages (CRUD already works)
- Validation schema

## Commits

1. `feat(assets): add management team photos from audit.gov.gh`
2. `feat(db): add departments seed with real department data`
3. `feat(db): replace management team seed with real data from audit.gov.gh`
