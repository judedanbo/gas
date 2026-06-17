/**
 * Seed script for management team data
 * Run with: npx tsx server/database/seeds/management-team.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/management-team.ts --force
 * Requires departments seed to have been run first (departments.ts)
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { eq, sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'
import { logError } from '../../utils/logger'

const force = process.argv.includes('--force')

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
      bio: `## Career Background
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
        bio: `## Career Background
Eugenia Shorme Nortey is a highly accomplished finance executive with over 19 years of experience in auditing, finance, and leadership. In her current position, she leverages her technical expertise, leadership acumen, and passion for excellence to drive results at the Audit Service of Ghana, focusing on Finance, Administration, and Human Resources responsibilities.

## Education
She holds an MBA in Accounting and Finance from the University of Professional Studies, Accra, and an HND in Accounting from Accra Technical University. She is a Chartered Accountant and a member of the Chartered Institute of Taxation, Ghana.

## Career Achievements
Throughout her two-decade career, Eugenia has held progressively senior roles, including Director of Audit and Assistant Auditor General positions. Notable achievements include recognition as part of an outstanding internal audit team in 2005 and service on the Budget Committee's rate-fixing sub-committee in 2007.

Her audit experience encompasses foreign missions and domestic assignments. Her leadership has been instrumental in strengthening operations, making departments efficient and accessible to all stakeholders.

## Personal Interests
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
        bio: `## Career Background
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
        title:
          'Deputy Auditor-General, Educational Institutions and District Assemblies - Southern Zone',
        bio: `## Career Background
Ms. Roberta Assiamah-Appiah joined the Audit Service in 1991. She was appointed Acting Deputy Auditor-General in 2010 and received confirmation as substantive DAG in 2012. Prior to her current role, she served as DAG for Finance and Administration Department.

## Special Assignments
She has undertaken audits of Ghana's Mission in Berne, Switzerland; Ghana Institute of Management and Public Administration (GIMPA); Driver, Vehicle and Licensing Authority (DVLA); and Judicial Service projects funded by DANIDA and the World Bank.

## Professional Development
Her professional development includes training in International Public Sector Accounting Standards (IPSAS); an Institutional Leadership Workshop for Senior Managers in South Africa; the World Congress of Accountants in Malaysia; and a Management Development Programme for Senior Managers in South Africa.

## Qualifications
She holds Chartered Accountant credentials and an Executive MBA in Finance. She achieved recognition as the overall best candidate in the May 2004 examinations of the Institute of Chartered Accountants, Ghana.

## Personal Interests
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
        bio: `## Career Background
Samuel Nii Odartey Lamptey is a Chartered Accountant with an MBA in Banking and Finance and an MSc in Public Financial Management. His career spans over 24 years in public financial management, beginning at Accra Technical University (2001–2006) before joining Ghana Audit Service in 2006.

## Domestic Audit Experience
From November 2006 through December 2020, he worked within the Central Government Audits Department, conducting audits of Ghana's Public Accounts, General Government Accounts, and Ministries, Departments and Agencies. He also performed specialized audits of initiatives funded by World Bank, DFID, USAID, and DANIDA.

## International Audit Experience
Beyond domestic work, Mr. Lamptey has audited three United Nations bodies: the International Maritime Organisation (IMO, Malta), International Organization for Migration (IOM, Turkey, Belgium, Mozambique, Costa Rica, China, Thailand, Ethiopia, and Zambia), and the INTOSAI Secretariat (Austria), between 2014 and 2024.

## Capacity Building
As a public financial management expert with AFROSAI-E, he has facilitated regional workshops since 2014, providing technical support to sister nations in fiscal governance, debt sustainability audits, and strategic planning.

## Regional Leadership
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
        bio: `## Career Background
Judith Kwaaku is a Chartered Accountant with over three decades of experience in public sector auditing. She joined the Audit Service in 1990 and has progressed through multiple leadership positions, including Assistant Auditor-General, Director of Audit, and Assistant Director. Her audit experience spans educational institutions, district assemblies, commercial entities, and central government operations.

## Notable Assignments
Her work includes special audits of World Bank, GAVI, and DANIDA donor-funded projects, plus international assignments with the International Maritime Organization and International Organization for Migration in Geneva, the Philippines, Guinea, and Malaysia. She conducted peacekeeping audits in Bouaké, Côte d'Ivoire, and audits at Ghana's diplomatic missions in Paris and Abidjan.

## Professional Qualifications
She earned an MSc in Finance and Accounting and a BSc in Accounting from Kwame Nkrumah University of Science and Technology and Central University College. She is recognized for strong leadership, a results-oriented approach, and commitment to excellence, and is characterized as a diligent and responsible professional who consistently aligns technical expertise with strategic goals.

## Personal Interests
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
        title:
          'Deputy Auditor-General, Educational Institutions and District Assemblies - Northern Zone',
        bio: `## Career Background
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
      if (!force) {
        console.log(`Found ${existingMembers.length} existing management team members.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(
        `Clearing ${existingMembers.length} existing management team members (--force)...`
      )
      await db.execute(sql`DELETE FROM ${schema.managementTeamResponsibilityTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.managementTeamResponsibilities}`)
      await db.execute(sql`DELETE FROM ${schema.managementTeamTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.managementTeam}`)
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
    let dagCount = 0
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

      dagCount++
      console.log(`  - Created: ${dag.translations.en.name} → ${dept.slug}`)
    }

    console.log('\nSeed completed successfully!')
    console.log(`  - 1 Auditor-General`)
    console.log(`  - ${dagCount} Deputy Auditors-General`)
  } catch (error) {
    logError('seed:management-team', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

seed().catch((error) => {
  logError('seed:management-team', error)
  process.exit(1)
})
