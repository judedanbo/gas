# Management Team Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder management team seed data with real biographical data and photos crawled from audit.gov.gh.

**Architecture:** Three sequential deliverables on a feature branch: (1) download member photos into the static assets directory, (2) create a departments seed script that inserts the 6 real departments, (3) rewrite the management team seed script with real names, titles, full bios, photo paths, and department linkages. No schema, API, or UI changes needed — the existing infrastructure already supports all fields.

**Tech Stack:** TypeScript, Drizzle ORM (mysql2), curl (image download), Nuxt 3 static assets (`public/`)

**Spec:** `docs/superpowers/specs/2026-05-08-management-team-real-data-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `public/images/management/*.jpg` (7 files) | Member profile photos served as static assets |
| Create | `server/database/seeds/departments.ts` | Seed 6 departments with English translations |
| Modify | `server/database/seeds/management-team.ts` | Replace placeholder data with real member data |

---

### Task 1: Create feature branch

**Files:** None (git only)

- [ ] **Step 1: Create and switch to the feature branch**

```bash
cd /home/jude/code/gas/ghana-audit-service
git checkout -b feature/management-team-real-data
```

Expected: `Switched to a new branch 'feature/management-team-real-data'`

---

### Task 2: Download management team photos

**Files:**
- Create: `public/images/management/johnson-akuamoah-asiedu.jpg`
- Create: `public/images/management/eugenia-shorme-nortey.jpg`
- Create: `public/images/management/samuel-frimpong-manso.jpg`
- Create: `public/images/management/roberta-assiamah-appiah.jpg`
- Create: `public/images/management/samuel-nii-odartey-lamptey.jpg`
- Create: `public/images/management/judith-kwaaku.jpg`
- Create: `public/images/management/george-swanzy-winful.jpg`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p public/images/management
```

- [ ] **Step 2: Download all 7 photos**

The source website uses inconsistent filenames (typos, parentheses). Download each to the normalized slug-based filename.

```bash
cd /home/jude/code/gas/ghana-audit-service

curl -fSL "https://audit.gov.gh/img/management/johnson_akuamoah_asiedu.jpg" \
  -o public/images/management/johnson-akuamoah-asiedu.jpg

curl -fSL "https://audit.gov.gh/img/management/eugenia_shorme_nortey.jpg" \
  -o public/images/management/eugenia-shorme-nortey.jpg

curl -fSL "https://audit.gov.gh/img/management/samuel_frimping-manso.jpg" \
  -o public/images/management/samuel-frimpong-manso.jpg

curl -fSL "https://audit.gov.gh/img/management/roberta_assiamah-appiah_(mrs.).jpg" \
  -o public/images/management/roberta-assiamah-appiah.jpg

curl -fSL "https://audit.gov.gh/img/management/samuel_nii_odartey_lamptey_.jpg" \
  -o public/images/management/samuel-nii-odartey-lamptey.jpg

curl -fSL "https://audit.gov.gh/img/management/judith_kwaaku.jpg" \
  -o public/images/management/judith-kwaaku.jpg

curl -fSL "https://audit.gov.gh/img/management/george_swanzy_winful.jpg" \
  -o public/images/management/george-swanzy-winful.jpg
```

- [ ] **Step 3: Verify all 7 images downloaded**

```bash
ls -la public/images/management/
```

Expected: 7 `.jpg` files, each with a non-zero file size.

- [ ] **Step 4: Commit the photos**

```bash
git add public/images/management/
git commit -m "feat(assets): add management team photos from audit.gov.gh"
```

---

### Task 3: Create departments seed script

**Files:**
- Create: `server/database/seeds/departments.ts`

- [ ] **Step 1: Write the departments seed script**

Create `server/database/seeds/departments.ts` with the following content:

```typescript
/**
 * Seed script for department data
 * Run with: npx tsx server/database/seeds/departments.ts
 * Must run BEFORE management-team.ts seed
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

const departmentsData = [
  {
    slug: 'central-government-audit',
    displayOrder: 0,
    translations: {
      en: {
        name: 'Central Government Audit Department',
        description:
          'Responsible for the audit of central government ministries, departments, and agencies to ensure accountability and transparency in the management of public resources.'
      }
    }
  },
  {
    slug: 'commercial-audit',
    displayOrder: 1,
    translations: {
      en: {
        name: 'Commercial Audit Department',
        description:
          'Oversees audits of state-owned enterprises, joint ventures, and commercial entities to ensure proper stewardship of public investments.'
      }
    }
  },
  {
    slug: 'performance-special-audit',
    displayOrder: 2,
    translations: {
      en: {
        name: 'Performance and Special Audit Department',
        description:
          'Conducts value-for-money audits, performance evaluations, and special investigations to assess the efficiency and effectiveness of government programmes.'
      }
    }
  },
  {
    slug: 'finance-admin-hr',
    displayOrder: 3,
    translations: {
      en: {
        name: 'Finance, Administration and Human Resource Department',
        description:
          'Manages the internal operations of the Audit Service including financial administration, human resource development, and corporate services.'
      }
    }
  },
  {
    slug: 'eida-southern-zone',
    displayOrder: 4,
    translations: {
      en: {
        name: 'Educational Institutions and District Assemblies - Southern Zone',
        description:
          'Audits educational institutions and district assemblies in the southern sector of Ghana, including universities, polytechnics, and metropolitan/municipal/district assemblies.'
      }
    }
  },
  {
    slug: 'eida-northern-zone',
    displayOrder: 5,
    translations: {
      en: {
        name: 'Educational Institutions and District Assemblies - Northern Zone',
        description:
          'Audits educational institutions and district assemblies in the northern zone of Ghana, covering the northern, upper east, upper west, savannah, north east, and Oti regions.'
      }
    }
  }
]

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const existing = await db.select().from(schema.departments)
    if (existing.length > 0) {
      console.log(`Found ${existing.length} existing departments.`)
      console.log(
        'Skipping seed to avoid duplicates. Delete existing data first if you want to reseed.'
      )
      await pool.end()
      return
    }

    console.log('Seeding department data...')

    for (const dept of departmentsData) {
      const [result] = await db.insert(schema.departments).values({
        slug: dept.slug,
        displayOrder: dept.displayOrder
      })

      const deptId = result.insertId

      await db.insert(schema.departmentTranslations).values({
        departmentId: deptId,
        locale: 'en',
        name: dept.translations.en.name,
        description: dept.translations.en.description
      })

      console.log(`  - Created: ${dept.translations.en.name}`)
    }

    console.log(`\nSeed completed successfully!`)
    console.log(`  - ${departmentsData.length} departments created`)
  } catch (error) {
    console.error('Error seeding data:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Verify the script compiles**

```bash
cd /home/jude/code/gas/ghana-audit-service
npx tsx --eval "import './server/database/seeds/departments'; console.log('Compiles OK')" 2>&1 | head -5
```

Note: This will attempt to run the script and fail on DB connection (expected in CI/dev without MySQL). The important check is that it compiles without TypeScript errors. An alternative check:

```bash
npx tsc --noEmit --esModuleInterop --module nodenext --moduleResolution nodenext server/database/seeds/departments.ts 2>&1 || echo "Check for TS errors above"
```

- [ ] **Step 3: Commit the departments seed**

```bash
git add server/database/seeds/departments.ts
git commit -m "feat(db): add departments seed with real department data"
```

---

### Task 4: Rewrite management team seed with real data

**Files:**
- Modify: `server/database/seeds/management-team.ts`

- [ ] **Step 1: Replace the entire management-team.ts seed file**

Overwrite `server/database/seeds/management-team.ts` with the following content. This replaces the placeholder data with real biographical data from audit.gov.gh.

```typescript
/**
 * Seed script for management team data
 * Run with: npx tsx server/database/seeds/management-team.ts
 * Requires departments seed to have been run first (departments.ts)
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { eq } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

const auditorGeneral = {
  slug: 'johnson-akuamoah-asiedu',
  role: 'auditor-general' as const,
  email: 'info@audit.gov.gh',
  photo: '/images/management/johnson-akuamoah-asiedu.jpg',
  displayOrder: 0,
  translations: {
    en: {
      name: 'Johnson Akuamoah Asiedu',
      title: 'Auditor-General of Ghana',
      bio: `Mr. Johnson Akuamoah Asiedu serves as the Auditor-General, having been appointed by President Nana Addo Dankwa Akufo-Addo. Prior to this appointment, he had already held the position of Acting Auditor-General and occupied several significant roles within the organization.

He previously served as Deputy Auditor-General (DAG) in charge of Commercial Audit Department, DAG for Finance, Administration and Human Resource, and DAG for Performance Audits Department.

He joined the Audit Service in December 2004 as an Assistant Auditor-General and Head of the Internal Audit Unit. Before that, he spent seven years at the Serious Fraud Office (SFO), now known as the Economic and Organised Crime Office (EOCO), where he advanced to become Head of the Finance Department.

Mr. Asiedu has conducted audits for various international organizations including the Regional Centre for Training in Aerospace Surveys (Nigeria), INTOSAI (Austria), the International Maritime Organization (UK), and the International Organisation for Migration. He has also audited Ghana's Scholarship Secretariat and DANIDA-funded parliamentary projects.

He is recognized as a resource person for AFROSAI-E and INTOSAI International Development Initiative, facilitating workshops across Ghana, The Gambia, South Africa, and Tanzania. Between 2013 and 2015, he served as the principal facilitator for GIZ-sponsored Leadership and Change Management workshops at the Audit Service.

He has participated in international conferences including INTOSAI workshops on Performance Management (Norway), Performance Audit Symposiums (Canada), Commonwealth meetings on public sector accounting (UK), and programs at the International Auditor Regulatory Institute (Washington, DC).

Mr. Asiedu is a Chartered Accountant and member of the Institute of Chartered Accountants (Ghana) and the Institute of Internal Auditors. He holds an MBA in Strategic Management from Paris Graduate School of Management and a BSc. Administration (Accounting) from the University of Ghana, Legon.

He enjoys football, reading, and gospel preaching.`
    }
  }
}

const deputyAuditorsGeneral = [
  {
    slug: 'eugenia-shorme-nortey',
    role: 'deputy-auditor-general' as const,
    departmentSlug: 'finance-admin-hr',
    icon: 'heroicons:wrench-screwdriver',
    photo: '/images/management/eugenia-shorme-nortey.jpg',
    displayOrder: 1,
    translations: {
      en: {
        name: 'Eugenia Shorme Nortey',
        title: 'Deputy Auditor-General, Finance, Administration and Human Resource Department',
        bio: `Eugenia Shorme Nortey is a highly accomplished finance executive with over 19 years of experience in auditing, finance, and leadership. In her current position, she leverages her technical expertise, leadership acumen, and passion for excellence to drive results at the Audit Service of Ghana, focusing on Finance, Administration, and Human Resources responsibilities.

She holds an MBA in Accounting and Finance from the University of Professional Studies, Accra, and an HND in Accounting from Accra Technical University. She is a Chartered Accountant and a member of the Chartered Institute of Taxation, Ghana.

Throughout her two-decade career, Eugenia has held progressively senior roles, including Director of Audit and Assistant Auditor General positions. Notable achievements include recognition as part of an outstanding internal audit team in 2005 and service on the Budget Committee's rate-fixing sub-committee in 2007.

Her audit experience encompasses foreign missions and domestic assignments. Her leadership has been instrumental in strengthening operations, making departments efficient and accessible to all stakeholders.

Outside work, she values family time and enjoys listening to gospel music.`
      }
    }
  },
  {
    slug: 'samuel-frimpong-manso',
    role: 'deputy-auditor-general' as const,
    departmentSlug: 'performance-special-audit',
    icon: 'heroicons:chart-bar',
    photo: '/images/management/samuel-frimpong-manso.jpg',
    displayOrder: 2,
    translations: {
      en: {
        name: 'Samuel Frimpong-Manso',
        title: 'Deputy Auditor-General, Performance and Special Audit Department',
        bio: `Mr. Samuel Frimpong-Manso held multiple positions within Ghana's Audit Service prior to his current role, including Assistant Auditor-General, Director of Audit, Assistant Director of Audit, and Principal Auditor. He joined the organization in March 2008 and has worked across several departments including the Educational Institutions and District Assemblies Department – Southern Zone (EIDA-SZ) and the District Assemblies Department (DAD).

Domestically, his experience encompasses District Wide Assistance Programme (DWAP) audits, Due Diligence Audits, Local Government Capacity Support, and USAID-funded specialized assignments. Internationally, he has directed audit teams to Ghana Missions in Algiers (2009), Havana (2015), Tokyo (2019), and Berlin (2024).

He functions as a facilitator and resource person, supporting training for Audit Service staff and external institutions including the Ghana Anti-Corruption Coalition, Inter-Ministerial Coordinating Committee on Decentralisation, Private Enterprise Federation, and Centre for Local Governance Advocacy. Between 2010 and 2025, he represented the Service on the District Development Facility Technical Working Group and District Assemblies Common Fund matters.

Mr. Frimpong-Manso is a Chartered Accountant, Fellow of the Association of Chartered Certified Accountants (FCCA, UK), member of the Institute of Chartered Accountants, Ghana (ICAG), and member of the Chartered Institute of Taxation, Ghana (CITG).

He holds a BA (Hons) in Religions and Philosophy from the University of Ghana, Legon (1998) and an MBA (Finance) from Wisconsin International University College, Legon (2010).

In October 2025, he authored and launched a book on public sector auditing practices.`
      }
    }
  },
  {
    slug: 'roberta-assiamah-appiah',
    role: 'deputy-auditor-general' as const,
    departmentSlug: 'eida-southern-zone',
    icon: 'heroicons:academic-cap',
    photo: '/images/management/roberta-assiamah-appiah.jpg',
    displayOrder: 3,
    translations: {
      en: {
        name: 'Roberta Assiamah-Appiah',
        title: 'Deputy Auditor-General, Educational Institutions and District Assemblies - Southern Zone',
        bio: `Ms. Roberta Assiamah-Appiah joined the Audit Service in 1991. She was appointed Acting Deputy Auditor-General in 2010 and received confirmation as substantive DAG in 2012. Prior to her current role, she served as DAG for Finance and Administration Department.

She has undertaken audits of Ghana's Mission in Berne, Switzerland; Ghana Institute of Management and Public Administration (GIMPA); Driver, Vehicle and Licensing Authority (DVLA); and Judicial Service projects funded by DANIDA and the World Bank.

Her professional development includes training in International Public Sector Accounting Standards (IPSAS); an Institutional Leadership Workshop for Senior Managers in South Africa; the World Congress of Accountants in Malaysia; and a Management Development Programme for Senior Managers in South Africa.

She holds Chartered Accountant credentials and an Executive MBA in Finance. She achieved recognition as the overall best candidate in the May 2004 examinations of the Institute of Chartered Accountants, Ghana.

She enjoys reading and watching football.`
      }
    }
  },
  {
    slug: 'samuel-nii-odartey-lamptey',
    role: 'deputy-auditor-general' as const,
    departmentSlug: 'commercial-audit',
    icon: 'heroicons:briefcase',
    photo: '/images/management/samuel-nii-odartey-lamptey.jpg',
    displayOrder: 4,
    translations: {
      en: {
        name: 'Samuel Nii Odartey Lamptey',
        title: 'Deputy Auditor-General, Commercial Audit Department',
        bio: `Samuel Nii Odartey Lamptey is a Chartered Accountant with an MBA in Banking and Finance and an MSc in Public Financial Management. His career spans over 24 years in public financial management, beginning at Accra Technical University (2001–2006) before joining Ghana Audit Service in 2006.

From November 2006 through December 2020, he worked within the Central Government Audits Department, conducting audits of Ghana's Public Accounts, General Government Accounts, and Ministries, Departments and Agencies. He also performed specialized audits of initiatives funded by World Bank, DFID, USAID, and DANIDA.

Beyond domestic work, Mr. Lamptey has audited three United Nations bodies: the International Maritime Organisation (IMO, Malta), International Organization for Migration (IOM, Turkey, Belgium, Mozambique, Costa Rica, China, Thailand, Ethiopia, and Zambia), and the INTOSAI Secretariat (Austria), between 2014 and 2024.

As a public financial management expert with AFROSAI-E, he has facilitated regional workshops since 2014, providing technical support to sister nations in fiscal governance, debt sustainability audits, and strategic planning.

He served as Assistant Auditor-General and Regional Head for Western-North Region from January 2021 through November 2025, overseeing District Audit Offices in Bibiani, Sefwi Wiawso, and Enchi, before his appointment to his current position.`
      }
    }
  },
  {
    slug: 'judith-kwaaku',
    role: 'deputy-auditor-general' as const,
    departmentSlug: 'central-government-audit',
    icon: 'heroicons:building-library',
    photo: '/images/management/judith-kwaaku.jpg',
    displayOrder: 5,
    translations: {
      en: {
        name: 'Judith Kwaaku',
        title: 'Deputy Auditor-General, Central Government Audit Department',
        bio: `Judith Kwaaku is a Chartered Accountant with over three decades of experience in public sector auditing. She earned an MSc in Finance and Accounting and a BSc in Accounting from Kwame Nkrumah University of Science and Technology and Central University College.

She joined the Audit Service in 1990 and has progressed through multiple leadership positions, including Assistant Auditor-General, Director of Audit, and Assistant Director. Her audit experience spans educational institutions, district assemblies, commercial entities, and central government operations.

Her work includes special audits of World Bank, GAVI, and DANIDA donor-funded projects, plus international assignments with the International Maritime Organization and International Organization for Migration in Geneva, the Philippines, Guinea, and Malaysia. She conducted peacekeeping audits in Bouaké, Côte d'Ivoire, and audits at Ghana's diplomatic missions in Paris and Abidjan.

She is recognized for strong leadership, a results-oriented approach, and commitment to excellence, and is characterized as a diligent and responsible professional who consistently aligns technical expertise with strategic goals.

She enjoys reading and solving puzzles.`
      }
    }
  },
  {
    slug: 'george-swanzy-winful',
    role: 'deputy-auditor-general' as const,
    departmentSlug: 'eida-northern-zone',
    icon: 'heroicons:map',
    photo: '/images/management/george-swanzy-winful.jpg',
    displayOrder: 6,
    translations: {
      en: {
        name: 'George Swanzy Winful',
        title: 'Deputy Auditor-General, Educational Institutions and District Assemblies - Northern Zone',
        bio: `Mr. George Swanzy Winful is a seasoned auditor and finance professional with more than 34 years of service in Ghana's public sector and international audit practice.

He is a Fellow of the Association of Chartered Certified Accountants (FCCA), holds an MBA in Public Finance, and is a member of the Institute of Chartered Accountants, Ghana (ICA).

Since 1990 with the Audit Service, he has been instrumental in advancing accountability and financial oversight across government. His notable contributions include pioneering the Performance Audit Department, serving as focal point during Ghana Integrated Financial Management Information System rollout, and leading audits producing significant state savings while reforming payroll, public enterprises, and financial regulations.

From 2021 to 2024, he was seconded to the Ministry of Finance as Director of the Revenue Policy Division, where he led the Medium-Term Revenue Strategy (2024–2027) and established Revenue Assurance initiatives. He earned formal commendation from the Head of Civil Service in 2024.

He has represented Ghana at the UN Panel of External Auditors and led audit assignments at the International Maritime Organisation and International Organization for Migration. He also trained in performance auditing under AFROSAI-E across Africa.

Born May 10, 1967 in Dixcove, Western Region; married with two children; enjoys table tennis and mentors public finance professionals.`
      }
    }
  }
]

async function seed() {
  console.log('Connecting to database...')

  const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 5
  })

  const db = drizzle(pool, { schema, mode: 'default' })

  try {
    const existingMembers = await db.select().from(schema.managementTeam)
    if (existingMembers.length > 0) {
      console.log(`Found ${existingMembers.length} existing management team members.`)
      console.log(
        'Skipping seed to avoid duplicates. Delete existing data first if you want to reseed.'
      )
      await pool.end()
      return
    }

    console.log('Seeding management team data...')

    // Insert Auditor-General (no department)
    console.log('Inserting Auditor-General...')
    const [agResult] = await db.insert(schema.managementTeam).values({
      slug: auditorGeneral.slug,
      role: auditorGeneral.role,
      email: auditorGeneral.email,
      photo: auditorGeneral.photo,
      displayOrder: auditorGeneral.displayOrder,
      isActive: true
    })

    const agId = agResult.insertId

    await db.insert(schema.managementTeamTranslations).values({
      managementTeamId: agId,
      locale: 'en',
      name: auditorGeneral.translations.en.name,
      title: auditorGeneral.translations.en.title,
      bio: auditorGeneral.translations.en.bio
    })

    console.log(`  - Created: ${auditorGeneral.translations.en.name}`)

    // Insert Deputy Auditors-General (with department linkage)
    console.log('Inserting Deputy Auditors-General...')
    for (const dag of deputyAuditorsGeneral) {
      // Look up department by slug
      const [dept] = await db
        .select()
        .from(schema.departments)
        .where(eq(schema.departments.slug, dag.departmentSlug))

      if (!dept) {
        console.warn(
          `  ⚠ Department '${dag.departmentSlug}' not found. Run departments.ts seed first.`
        )
        console.warn(`    Skipping ${dag.translations.en.name}`)
        continue
      }

      const [dagResult] = await db.insert(schema.managementTeam).values({
        slug: dag.slug,
        role: dag.role,
        departmentId: dept.id,
        icon: dag.icon,
        photo: dag.photo,
        displayOrder: dag.displayOrder,
        isActive: true
      })

      const dagId = dagResult.insertId

      await db.insert(schema.managementTeamTranslations).values({
        managementTeamId: dagId,
        locale: 'en',
        name: dag.translations.en.name,
        title: dag.translations.en.title,
        bio: dag.translations.en.bio
      })

      console.log(`  - Created: ${dag.translations.en.name} → ${dept.slug}`)
    }

    console.log('\nSeed completed successfully!')
    console.log(`  - 1 Auditor-General`)
    console.log(`  - ${deputyAuditorsGeneral.length} Deputy Auditors-General`)
  } catch (error) {
    console.error('Error seeding data:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Verify the script compiles**

```bash
cd /home/jude/code/gas/ghana-audit-service
npx tsc --noEmit --esModuleInterop --module nodenext --moduleResolution nodenext server/database/seeds/management-team.ts 2>&1 || echo "Check for TS errors above"
```

- [ ] **Step 3: Commit the rewritten seed**

```bash
git add server/database/seeds/management-team.ts
git commit -m "feat(db): replace management team seed with real data from audit.gov.gh"
```

---

### Task 5: Verify the full pipeline

- [ ] **Step 1: Run lint on both seed files**

```bash
cd /home/jude/code/gas/ghana-audit-service
npx eslint server/database/seeds/departments.ts server/database/seeds/management-team.ts
```

Expected: No errors. Fix any lint issues if reported.

- [ ] **Step 2: Run typecheck on the full project**

```bash
npm run typecheck
```

Expected: No new type errors introduced.

- [ ] **Step 3: Verify directory structure**

```bash
echo "=== Photos ===" && ls -1 public/images/management/ && echo "=== Seeds ===" && ls -1 server/database/seeds/
```

Expected output:
```
=== Photos ===
eugenia-shorme-nortey.jpg
george-swanzy-winful.jpg
johnson-akuamoah-asiedu.jpg
judith-kwaaku.jpg
roberta-assiamah-appiah.jpg
samuel-frimpong-manso.jpg
samuel-nii-odartey-lamptey.jpg
=== Seeds ===
departments.ts
management-team.ts
```

- [ ] **Step 4: Commit any lint/type fixes if needed**

```bash
git add -A
git commit -m "fix: lint and type fixes for seed scripts"
```

Only run this step if Step 1 or 2 required fixes. Skip if everything passed cleanly.

---

### Task 6: Update package.json seed commands (optional but recommended)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Check current seed commands**

```bash
cd /home/jude/code/gas/ghana-audit-service
grep -A2 '"db:seed' package.json
```

- [ ] **Step 2: Add a departments seed command**

If there isn't already a `db:seed:departments` script, add one alongside the existing seed commands in `package.json`:

```json
"db:seed:departments": "tsx server/database/seeds/departments.ts",
```

- [ ] **Step 3: Commit if changes were made**

```bash
git add package.json
git commit -m "chore: add db:seed:departments npm script"
```
