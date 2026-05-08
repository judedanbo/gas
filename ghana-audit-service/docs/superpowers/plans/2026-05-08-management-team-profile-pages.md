# Management Team Profile Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add individual profile pages for management team members at `/about/management-team/:slug` with a dedicated API endpoint, structured bio sections, and links from the list page.

**Architecture:** A client-side utility parses bio text with `##` section markers. A new Nitro API route serves individual members by slug using the existing transform. A new Vue page renders the profile with structured bio sections. The list page gets NuxtLink wrappers for navigation.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Nitro server routes, Drizzle ORM, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-08-management-team-profile-pages-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `utils/parseBioSections.ts` | Parse bio text with `##` markers into structured sections |
| Create | `server/api/management-team/[slug].ts` | Public API: single member by slug |
| Create | `pages/about/management-team/[slug].vue` | Profile page for individual member |
| Modify | `pages/about/management-team.vue` | Add NuxtLinks to individual profiles |
| Modify | `server/database/seeds/management-team.ts` | Add `##` section markers to bios |
| Modify | `nuxt.config.ts` | Add route rule for management-team API caching |

---

### Task 1: Create bio section parser utility

**Files:**
- Create: `utils/parseBioSections.ts`
- Create: `tests/unit/utils/parseBioSections.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/unit/utils/parseBioSections.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseBioSections } from '~/utils/parseBioSections'

describe('parseBioSections', () => {
  it('returns single section with null heading for plain text', () => {
    const bio = 'A simple bio with no sections.'
    const result = parseBioSections(bio)
    expect(result).toEqual([{ heading: null, content: 'A simple bio with no sections.' }])
  })

  it('returns empty array for empty string', () => {
    const result = parseBioSections('')
    expect(result).toEqual([])
  })

  it('parses multiple sections with ## markers', () => {
    const bio = `## Career Background
Joined in 2004 as Assistant Auditor-General.

Served in multiple departments.

## Qualifications
Chartered Accountant.

MBA in Finance.`

    const result = parseBioSections(bio)
    expect(result).toEqual([
      {
        heading: 'Career Background',
        content: 'Joined in 2004 as Assistant Auditor-General.\n\nServed in multiple departments.'
      },
      {
        heading: 'Qualifications',
        content: 'Chartered Accountant.\n\nMBA in Finance.'
      }
    ])
  })

  it('handles content before the first ## as a null-heading section', () => {
    const bio = `Mr. Smith is a senior official.

## Career Background
Joined in 2004.`

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: null, content: 'Mr. Smith is a senior official.' },
      { heading: 'Career Background', content: 'Joined in 2004.' }
    ])
  })

  it('trims whitespace from headings and content', () => {
    const bio = `##   Spaced Heading  

  Content with leading spaces.  `

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: 'Spaced Heading', content: 'Content with leading spaces.' }
    ])
  })

  it('skips sections with empty content after trimming', () => {
    const bio = `## Empty Section

## Real Section
Has content.`

    const result = parseBioSections(bio)
    expect(result).toEqual([
      { heading: 'Real Section', content: 'Has content.' }
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/jude/code/gas/ghana-audit-service
npx vitest run tests/unit/utils/parseBioSections.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

Create `utils/parseBioSections.ts`:

```typescript
export interface BioSection {
  heading: string | null
  content: string
}

export function parseBioSections(bio: string): BioSection[] {
  if (!bio.trim()) return []

  const parts = bio.split(/^## /m)
  const sections: BioSection[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue

    if (i === 0 && !bio.trimStart().startsWith('## ')) {
      sections.push({ heading: null, content: part })
    } else {
      const newlineIndex = part.indexOf('\n')
      if (newlineIndex === -1) continue
      const heading = part.slice(0, newlineIndex).trim()
      const content = part.slice(newlineIndex + 1).trim()
      if (!content) continue
      sections.push({ heading, content })
    }
  }

  return sections
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/utils/parseBioSections.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/parseBioSections.ts tests/unit/utils/parseBioSections.test.ts
git commit -m "feat: add bio section parser utility for management team profiles"
```

---

### Task 2: Create API route for single management team member

**Files:**
- Create: `server/api/management-team/[slug].ts`

- [ ] **Step 1: Create the API route**

Create `server/api/management-team/[slug].ts`:

```typescript
import type { ManagementTeamMember } from '~/types'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformManagementTeamMember } from '../../utils/transformManagementTeam'
import { getLocaleFromRequest } from '../../utils/locale'

export default defineEventHandler(async (event): Promise<ManagementTeamMember> => {
  const slug = getRouterParam(event, 'slug')
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Member slug is required'
    })
  }

  const [member] = await db
    .select()
    .from(schema.managementTeam)
    .where(
      and(
        eq(schema.managementTeam.slug, slug),
        eq(schema.managementTeam.isActive, true),
        isNull(schema.managementTeam.deletedAt)
      )
    )
    .limit(1)

  if (!member) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Management team member not found'
    })
  }

  const translations = await db
    .select()
    .from(schema.managementTeamTranslations)
    .where(eq(schema.managementTeamTranslations.managementTeamId, member.id))

  const translationsByLocale = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { name: t.name, title: t.title, bio: t.bio }
      return acc
    },
    {} as Record<string, { name: string; title: string; bio: string | null }>
  )

  const responsibilities = await db
    .select()
    .from(schema.managementTeamResponsibilities)
    .where(eq(schema.managementTeamResponsibilities.managementTeamId, member.id))

  const responsibilityIds = responsibilities.map((r) => r.id)
  let respTranslationsMap: Record<number, Record<string, { description: string }>> = {}

  if (responsibilityIds.length > 0) {
    const { sql } = await import('drizzle-orm')
    const respTranslations = await db
      .select()
      .from(schema.managementTeamResponsibilityTranslations)
      .where(
        sql`${schema.managementTeamResponsibilityTranslations.responsibilityId} IN (${sql.join(responsibilityIds, sql`, `)})`
      )

    respTranslationsMap = respTranslations.reduce(
      (acc, t) => {
        if (!acc[t.responsibilityId]) acc[t.responsibilityId] = {}
        acc[t.responsibilityId][t.locale] = { description: t.description }
        return acc
      },
      {} as Record<number, Record<string, { description: string }>>
    )
  }

  const responsibilitiesWithTranslations = responsibilities.map((r) => ({
    displayOrder: r.displayOrder,
    translations: respTranslationsMap[r.id] || {}
  }))

  let department: { id: number; translations: Record<string, { name: string }> } | undefined
  if (member.departmentId) {
    const [dept] = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, member.departmentId))

    if (dept) {
      const deptTranslations = await db
        .select()
        .from(schema.departmentTranslations)
        .where(eq(schema.departmentTranslations.departmentId, dept.id))

      const deptTranslationsByLocale = deptTranslations.reduce(
        (acc, t) => {
          acc[t.locale] = { name: t.name }
          return acc
        },
        {} as Record<string, { name: string }>
      )

      department = { id: dept.id, translations: deptTranslationsByLocale }
    }
  }

  let regionalOffice:
    | { id: number; region: string; translations: Record<string, { name: string }> }
    | undefined
  if (member.regionalOfficeId) {
    const [office] = await db
      .select()
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.id, member.regionalOfficeId))

    if (office) {
      const officeTranslations = await db
        .select()
        .from(schema.regionalOfficeTranslations)
        .where(eq(schema.regionalOfficeTranslations.officeId, office.id))

      const officeTranslationsByLocale = officeTranslations.reduce(
        (acc, t) => {
          acc[t.locale] = { name: t.name }
          return acc
        },
        {} as Record<string, { name: string }>
      )

      regionalOffice = {
        id: office.id,
        region: office.region,
        translations: officeTranslationsByLocale
      }
    }
  }

  const memberWithData = {
    ...member,
    translations: translationsByLocale,
    responsibilities: responsibilitiesWithTranslations,
    department,
    regionalOffice
  }

  return transformManagementTeamMember(memberWithData, locale)
})
```

- [ ] **Step 2: Verify it works manually**

```bash
curl -s http://localhost:3000/api/management-team/johnson-akuamoah-asiedu | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'name={d[\"name\"]} title={d[\"title\"]} bio_len={len(d.get(\"bio\",\"\"))}')"
```

Expected: `name=Johnson Akuamoah Asiedu title=Auditor-General of Ghana bio_len=2088`

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/management-team/nonexistent-slug
```

Expected: `404`

- [ ] **Step 3: Commit**

```bash
git add server/api/management-team/[slug].ts
git commit -m "feat(api): add GET /api/management-team/:slug endpoint"
```

---

### Task 3: Add route rule for management team API caching

**Files:**
- Modify: `nuxt.config.ts:274`

- [ ] **Step 1: Add the route rule**

In `nuxt.config.ts`, find this line (line 274):

```typescript
      '/api/regional-offices/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
```

Add the management team cache rule directly **after** it:

```typescript
      '/api/management-team/**': { cache: isDev ? false : { maxAge: 3600, staleMaxAge: 7200 } },
```

- [ ] **Step 2: Commit**

```bash
git add nuxt.config.ts
git commit -m "feat(config): add cache route rule for management-team API"
```

---

### Task 4: Create individual profile page

**Files:**
- Create: `pages/about/management-team/[slug].vue`

- [ ] **Step 1: Create the profile page**

Create `pages/about/management-team/[slug].vue`:

```vue
<template>
  <div>
    <CommonBreadcrumb
      :crumbs="[
        { label: 'About Us', path: '/about' },
        { label: 'Management Team', path: '/about/management-team' },
        { label: member?.name || 'Profile', path: `/about/management-team/${route.params.slug}` }
      ]"
    />

    <!-- Loading State -->
    <div v-if="pending" class="section">
      <div class="container">
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="section">
      <div class="container text-center py-12">
        <Icon
          name="heroicons:user"
          class="w-16 h-16 text-primary dark:text-primary-light mb-4 mx-auto"
          aria-hidden="true"
        />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Member Not Found</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          The team member you're looking for doesn't exist or has been removed.
        </p>
        <NuxtLink to="/about/management-team" class="btn-primary">
          View Management Team
        </NuxtLink>
      </div>
    </div>

    <!-- Profile Content -->
    <template v-else-if="member">
      <!-- Profile Header -->
      <section class="bg-gradient-to-br from-primary to-primary-dark text-white py-12">
        <div class="container">
          <div class="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-8">
            <div class="flex-shrink-0">
              <img
                v-if="member.photo"
                :src="member.photo"
                :alt="member.name"
                class="w-48 h-56 object-cover rounded-lg shadow-lg"
              />
              <div
                v-else
                class="w-48 h-56 bg-white/10 rounded-lg flex items-center justify-center"
              >
                <Icon
                  name="heroicons:user"
                  class="w-20 h-20 text-white/50"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div>
              <UiBadge
                :variant="member.role === 'auditor-general' ? 'accent' : 'primary'"
                size="lg"
                class="mb-3"
              >
                {{ member.role === 'auditor-general' ? 'Auditor-General' : 'Deputy Auditor-General' }}
              </UiBadge>
              <h1 class="text-3xl md:text-4xl font-heading font-bold text-white mb-2">
                {{ member.name }}
              </h1>
              <p class="text-xl text-white/90 mb-4">{{ member.title }}</p>
              <p v-if="member.departmentName" class="text-white/80 mb-4">
                <Icon name="heroicons:building-library" class="w-5 h-5 inline mr-1" aria-hidden="true" />
                {{ member.departmentName }}
              </p>
              <div class="flex flex-wrap gap-4">
                <a
                  v-if="member.email"
                  :href="`mailto:${member.email}`"
                  class="text-white/90 hover:text-white transition-colors no-underline"
                >
                  <UiIconText icon="heroicons:envelope" color="default">
                    {{ member.email }}
                  </UiIconText>
                </a>
                <span v-if="member.phone" class="text-white/90">
                  <UiIconText icon="heroicons:phone" color="default">
                    {{ member.phone }}
                  </UiIconText>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bio Sections -->
      <section class="section">
        <div class="container">
          <div class="max-w-4xl mx-auto">
            <div class="space-y-8">
              <div
                v-for="(section, index) in bioSections"
                :key="index"
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8"
              >
                <h2
                  v-if="section.heading"
                  class="text-xl font-heading font-bold text-gray-900 dark:text-white mb-4"
                >
                  {{ section.heading }}
                </h2>
                <div class="prose prose-gray dark:prose-invert max-w-none whitespace-pre-line">{{ section.content }}</div>
              </div>
            </div>

            <!-- Back Link -->
            <div class="mt-10">
              <NuxtLink
                to="/about/management-team"
                class="btn-outline inline-flex items-center gap-2"
              >
                <Icon name="heroicons:arrow-left" class="w-5 h-5" aria-hidden="true" />
                Back to Management Team
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ManagementTeamMember } from '~/types'
import { parseBioSections } from '~/utils/parseBioSections'

const route = useRoute()

const {
  data: member,
  pending,
  error
} = await useFetch<ManagementTeamMember>(`/api/management-team/${route.params.slug}`)

const bioSections = computed(() => {
  if (!member.value?.bio) return []
  return parseBioSections(member.value.bio)
})

useSeoMeta({
  title: () =>
    member.value
      ? `${member.value.name} - ${member.value.title} | Ghana Audit Service`
      : 'Team Member | Ghana Audit Service',
  description: () =>
    member.value
      ? `Profile of ${member.value.name}, ${member.value.title} at the Ghana Audit Service.`
      : 'Management team member profile at the Ghana Audit Service.'
})
</script>
```

- [ ] **Step 2: Verify it renders in the browser**

Navigate to `http://localhost:3000/about/management-team/johnson-akuamoah-asiedu` in the browser.

Expected: Profile page showing the AG's photo, name, title, badge, email, and bio paragraphs. The bio won't have section headings yet (that's Task 6).

Also verify the 404 page: `http://localhost:3000/about/management-team/nonexistent-slug`

Expected: "Member Not Found" error message with a link back to the management team page.

- [ ] **Step 3: Commit**

```bash
git add pages/about/management-team/[slug].vue
git commit -m "feat(pages): add individual management team profile page"
```

---

### Task 5: Add NuxtLinks from list page to individual profiles

**Files:**
- Modify: `pages/about/management-team.vue`

- [ ] **Step 1: Wrap the AG ProfileCard in a NuxtLink**

In `pages/about/management-team.vue`, find the AG section (around line 29). Replace this:

```vue
            <UiProfileCard
              :name="auditorGeneral.name"
              :title="auditorGeneral.title"
              :description="auditorGeneral.bio"
              :image="auditorGeneral.photo || '/images/ags/johnson_akuamoah_asiedu.jpg'"
              size="lg"
              featured
            >
```

With:

```vue
            <NuxtLink
              :to="`/about/management-team/${auditorGeneral.slug}`"
              class="block no-underline text-inherit hover:no-underline"
            >
              <UiProfileCard
                :name="auditorGeneral.name"
                :title="auditorGeneral.title"
                :description="auditorGeneral.bio"
                :image="auditorGeneral.photo || '/images/ags/johnson_akuamoah_asiedu.jpg'"
                size="lg"
                featured
              >
```

And close the NuxtLink after the `</UiProfileCard>` (after line 50):

```vue
            </UiProfileCard>
            </NuxtLink>
```

- [ ] **Step 2: Wrap each DAG ProfileCard in a NuxtLink**

In the Deputy Auditors-General section (around line 108), find:

```vue
              <UiProfileCard
                :name="dag.name"
                :title="dag.title"
                :description="dag.bio"
                :image="dag.photo"
                size="sm"
                layout="horizontal"
              >
```

Replace with:

```vue
              <NuxtLink
                :to="`/about/management-team/${dag.slug}`"
                class="block no-underline text-inherit hover:no-underline"
              >
                <UiProfileCard
                  :name="dag.name"
                  :title="dag.title"
                  :description="dag.bio"
                  :image="dag.photo"
                  size="sm"
                  layout="horizontal"
                >
```

And close the NuxtLink after the `</UiProfileCard>` closing tag (around line 119):

```vue
              </UiProfileCard>
              </NuxtLink>
```

- [ ] **Step 3: Verify links work in the browser**

Navigate to `http://localhost:3000/about/management-team`. Click on the AG card — should navigate to `/about/management-team/johnson-akuamoah-asiedu`. Click on any DAG card — should navigate to their profile page. Use the "Back to Management Team" link on the profile page to return.

- [ ] **Step 4: Commit**

```bash
git add pages/about/management-team.vue
git commit -m "feat(pages): add links from management team list to individual profiles"
```

---

### Task 6: Add section markers to seed bios and re-seed

**Files:**
- Modify: `server/database/seeds/management-team.ts`

- [ ] **Step 1: Update the Auditor-General bio with section markers**

In `server/database/seeds/management-team.ts`, replace the AG bio (the template literal value of `bio:`) with:

```
## Career Background
Mr. Johnson Akuamoah Asiedu serves as the Auditor-General, having been appointed by President Nana Addo Dankwa Akufo-Addo. Prior to this appointment, he had already held the position of Acting Auditor-General and occupied several significant roles within the organization.

He previously served as Deputy Auditor-General (DAG) in charge of Commercial Audit Department, DAG for Finance, Administration and Human Resource, and DAG for Performance Audits Department.

He joined the Audit Service in December 2004 as an Assistant Auditor-General and Head of the Internal Audit Unit. Before that, he spent seven years at the Serious Fraud Office (SFO), now known as the Economic and Organised Crime Office (EOCO), where he advanced to become Head of the Finance Department.

## International Experience
Mr. Asiedu has conducted audits for various international organizations including the Regional Centre for Training in Aerospace Surveys (Nigeria), INTOSAI (Austria), the International Maritime Organization (UK), and the International Organisation for Migration. He has also audited Ghana's Scholarship Secretariat and DANIDA-funded parliamentary projects.

## Professional Development
He is recognized as a resource person for AFROSAI-E and INTOSAI International Development Initiative, facilitating workshops across Ghana, The Gambia, South Africa, and Tanzania. Between 2013 and 2015, he served as the principal facilitator for GIZ-sponsored Leadership and Change Management workshops at the Audit Service.

He has participated in international conferences including INTOSAI workshops on Performance Management (Norway), Performance Audit Symposiums (Canada), Commonwealth meetings on public sector accounting (UK), and programs at the International Auditor Regulatory Institute (Washington, DC).

## Professional Qualifications
Mr. Asiedu is a Chartered Accountant and member of the Institute of Chartered Accountants (Ghana) and the Institute of Internal Auditors. He holds an MBA in Strategic Management from Paris Graduate School of Management and a BSc. Administration (Accounting) from the University of Ghana, Legon.

## Personal Interests
He enjoys football, reading, and gospel preaching.
```

- [ ] **Step 2: Update the remaining 6 DAG bios with section markers**

For each DAG, add `## ` section markers at the natural paragraph break points. The sections per member are:

**Eugenia Shorme Nortey:**
```
## Career Background
Eugenia Shorme Nortey is a highly accomplished finance executive with over 19 years of experience in auditing, finance, and leadership. In her current position, she leverages her technical expertise, leadership acumen, and passion for excellence to drive results at the Audit Service of Ghana, focusing on Finance, Administration, and Human Resources responsibilities.

## Education
She holds an MBA in Accounting and Finance from the University of Professional Studies, Accra, and an HND in Accounting from Accra Technical University. She is a Chartered Accountant and a member of the Chartered Institute of Taxation, Ghana.

## Career Achievements
Throughout her two-decade career, Eugenia has held progressively senior roles, including Director of Audit and Assistant Auditor General positions. Notable achievements include recognition as part of an outstanding internal audit team in 2005 and service on the Budget Committee's rate-fixing sub-committee in 2007.

Her audit experience encompasses foreign missions and domestic assignments. Her leadership has been instrumental in strengthening operations, making departments efficient and accessible to all stakeholders.

## Personal Interests
Outside work, she values family time and enjoys listening to gospel music.
```

**Samuel Frimpong-Manso:**
```
## Career Background
Mr. Samuel Frimpong-Manso held multiple positions within Ghana's Audit Service prior to his current role, including Assistant Auditor-General, Director of Audit, Assistant Director of Audit, and Principal Auditor. He joined the organization in March 2008 and has worked across several departments including the Educational Institutions and District Assemblies Department – Southern Zone (EIDA-SZ) and the District Assemblies Department (DAD).

## Audit Experience
Domestically, his experience encompasses District Wide Assistance Programme (DWAP) audits, Due Diligence Audits, Local Government Capacity Support, and USAID-funded specialized assignments. Internationally, he has directed audit teams to Ghana Missions in Algiers (2009), Havana (2015), Tokyo (2019), and Berlin (2024).

## Capacity Building
He functions as a facilitator and resource person, supporting training for Audit Service staff and external institutions including the Ghana Anti-Corruption Coalition, Inter-Ministerial Coordinating Committee on Decentralisation, Private Enterprise Federation, and Centre for Local Governance Advocacy. Between 2010 and 2025, he represented the Service on the District Development Facility Technical Working Group and District Assemblies Common Fund matters.

## Professional Credentials
Mr. Frimpong-Manso is a Chartered Accountant, Fellow of the Association of Chartered Certified Accountants (FCCA, UK), member of the Institute of Chartered Accountants, Ghana (ICAG), and member of the Chartered Institute of Taxation, Ghana (CITG).

## Education
He holds a BA (Hons) in Religions and Philosophy from the University of Ghana, Legon (1998) and an MBA (Finance) from Wisconsin International University College, Legon (2010).

## Publications
In October 2025, he authored and launched a book on public sector auditing practices.
```

**Roberta Assiamah-Appiah:**
```
## Career Background
Ms. Roberta Assiamah-Appiah joined the Audit Service in 1991. She was appointed Acting Deputy Auditor-General in 2010 and received confirmation as substantive DAG in 2012. Prior to her current role, she served as DAG for Finance and Administration Department.

## Special Assignments
She has undertaken audits of Ghana's Mission in Berne, Switzerland; Ghana Institute of Management and Public Administration (GIMPA); Driver, Vehicle and Licensing Authority (DVLA); and Judicial Service projects funded by DANIDA and the World Bank.

## Professional Development
Her professional development includes training in International Public Sector Accounting Standards (IPSAS); an Institutional Leadership Workshop for Senior Managers in South Africa; the World Congress of Accountants in Malaysia; and a Management Development Programme for Senior Managers in South Africa.

## Qualifications
She holds Chartered Accountant credentials and an Executive MBA in Finance. She achieved recognition as the overall best candidate in the May 2004 examinations of the Institute of Chartered Accountants, Ghana.

## Personal Interests
She enjoys reading and watching football.
```

**Samuel Nii Odartey Lamptey:**
```
## Career Background
Samuel Nii Odartey Lamptey is a Chartered Accountant with an MBA in Banking and Finance and an MSc in Public Financial Management. His career spans over 24 years in public financial management, beginning at Accra Technical University (2001–2006) before joining Ghana Audit Service in 2006.

## Domestic Audit Experience
From November 2006 through December 2020, he worked within the Central Government Audits Department, conducting audits of Ghana's Public Accounts, General Government Accounts, and Ministries, Departments and Agencies. He also performed specialized audits of initiatives funded by World Bank, DFID, USAID, and DANIDA.

## International Audit Experience
Beyond domestic work, Mr. Lamptey has audited three United Nations bodies: the International Maritime Organisation (IMO, Malta), International Organization for Migration (IOM, Turkey, Belgium, Mozambique, Costa Rica, China, Thailand, Ethiopia, and Zambia), and the INTOSAI Secretariat (Austria), between 2014 and 2024.

## Capacity Building
As a public financial management expert with AFROSAI-E, he has facilitated regional workshops since 2014, providing technical support to sister nations in fiscal governance, debt sustainability audits, and strategic planning.

## Regional Leadership
He served as Assistant Auditor-General and Regional Head for Western-North Region from January 2021 through November 2025, overseeing District Audit Offices in Bibiani, Sefwi Wiawso, and Enchi, before his appointment to his current position.
```

**Judith Kwaaku:**
```
## Career Background
Judith Kwaaku is a Chartered Accountant with over three decades of experience in public sector auditing. She joined the Audit Service in 1990 and has progressed through multiple leadership positions, including Assistant Auditor-General, Director of Audit, and Assistant Director. Her audit experience spans educational institutions, district assemblies, commercial entities, and central government operations.

## Notable Assignments
Her work includes special audits of World Bank, GAVI, and DANIDA donor-funded projects, plus international assignments with the International Maritime Organization and International Organization for Migration in Geneva, the Philippines, Guinea, and Malaysia. She conducted peacekeeping audits in Bouaké, Côte d'Ivoire, and audits at Ghana's diplomatic missions in Paris and Abidjan.

## Professional Qualifications
She earned an MSc in Finance and Accounting and a BSc in Accounting from Kwame Nkrumah University of Science and Technology and Central University College. She is recognized for strong leadership, a results-oriented approach, and commitment to excellence, and is characterized as a diligent and responsible professional who consistently aligns technical expertise with strategic goals.

## Personal Interests
She enjoys reading and solving puzzles.
```

**George Swanzy Winful:**
```
## Career Background
Mr. George Swanzy Winful is a seasoned auditor and finance professional with more than 34 years of service in Ghana's public sector and international audit practice.

## Qualifications
He is a Fellow of the Association of Chartered Certified Accountants (FCCA), holds an MBA in Public Finance, and is a member of the Institute of Chartered Accountants, Ghana (ICA).

## Public Sector Career
Since 1990 with the Audit Service, he has been instrumental in advancing accountability and financial oversight across government. His notable contributions include pioneering the Performance Audit Department, serving as focal point during Ghana Integrated Financial Management Information System rollout, and leading audits producing significant state savings while reforming payroll, public enterprises, and financial regulations.

## Ministry of Finance
From 2021 to 2024, he was seconded to the Ministry of Finance as Director of the Revenue Policy Division, where he led the Medium-Term Revenue Strategy (2024–2027) and established Revenue Assurance initiatives. He earned formal commendation from the Head of Civil Service in 2024.

## International Experience
He has represented Ghana at the UN Panel of External Auditors and led audit assignments at the International Maritime Organisation and International Organization for Migration. He also trained in performance auditing under AFROSAI-E across Africa.

## Personal Details
Born May 10, 1967 in Dixcove, Western Region; married with two children; enjoys table tennis and mentors public finance professionals.
```

- [ ] **Step 3: Re-seed the database**

```bash
cd /home/jude/code/gas/ghana-audit-service
npx tsx server/database/seeds/management-team.ts --force
```

Expected: All 7 members created with updated bios.

- [ ] **Step 4: Verify bio sections render on the profile page**

Navigate to `http://localhost:3000/about/management-team/johnson-akuamoah-asiedu` in the browser.

Expected: Bio is now split into sections with headings: "Career Background", "International Experience", "Professional Development", "Professional Qualifications", "Personal Interests". Each section appears in its own card.

- [ ] **Step 5: Commit**

```bash
git add server/database/seeds/management-team.ts
git commit -m "feat(db): add section markers to management team bios"
```

---

### Task 7: Run quality gates

- [ ] **Step 1: Run lint**

```bash
cd /home/jude/code/gas/ghana-audit-service
npx eslint utils/parseBioSections.ts server/api/management-team/[slug].ts pages/about/management-team/[slug].vue pages/about/management-team.vue
```

Expected: No errors. Fix any issues found.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No new type errors.

- [ ] **Step 3: Run the bio parser tests**

```bash
npx vitest run tests/unit/utils/parseBioSections.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: lint and type fixes for profile pages"
```

Only if Steps 1-2 required changes.
