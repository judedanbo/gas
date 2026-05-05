/**
 * Seed script for management team data
 * Run with: npx tsx server/database/seeds/management-team.ts
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

// Original data from management-team.vue
const auditorGeneral = {
  slug: 'johnson-akuamoah-asiedu',
  role: 'auditor-general' as const,
  email: 'info@audit.gov.gh',
  photo: '/images/ags/johnson_akuamoah_asiedu.jpg',
  displayOrder: 0,
  translations: {
    en: {
      name: 'Johnson Akuamoah Asiedu',
      title: 'Auditor-General of Ghana',
      bio: 'Mr. Johnson Akuamoah Asiedu is the Auditor-General of Ghana, responsible for auditing the public accounts of Ghana and reporting to Parliament. He leads the Ghana Audit Service in fulfilling its constitutional mandate of ensuring accountability and transparency in the management of public resources.'
    }
  }
}

const deputyAuditorsGeneral = [
  {
    slug: 'dag-central-government',
    role: 'deputy-auditor-general' as const,
    icon: 'heroicons:building-library',
    displayOrder: 1,
    translations: {
      en: {
        name: 'Deputy Auditor-General',
        title: 'Central Government',
        bio: 'Oversees audits of central government ministries, departments, and agencies.'
      }
    },
    responsibilities: [
      { displayOrder: 0, translations: { en: { description: 'Audits of government ministries' } } },
      { displayOrder: 1, translations: { en: { description: 'Statutory bodies audits' } } },
      { displayOrder: 2, translations: { en: { description: 'Consolidated fund audits' } } },
      {
        displayOrder: 3,
        translations: { en: { description: 'Special audits and investigations' } }
      }
    ]
  },
  {
    slug: 'dag-local-government',
    role: 'deputy-auditor-general' as const,
    icon: 'heroicons:building-office',
    displayOrder: 2,
    translations: {
      en: {
        name: 'Deputy Auditor-General',
        title: 'Local Government',
        bio: 'Leads audit operations for all Metropolitan, Municipal, and District Assemblies.'
      }
    },
    responsibilities: [
      { displayOrder: 0, translations: { en: { description: 'MMDA financial audits' } } },
      {
        displayOrder: 1,
        translations: { en: { description: 'District Assemblies Common Fund audits' } }
      },
      {
        displayOrder: 2,
        translations: { en: { description: 'Local government compliance reviews' } }
      },
      {
        displayOrder: 3,
        translations: { en: { description: 'Regional coordinating council audits' } }
      }
    ]
  },
  {
    slug: 'dag-education-sector',
    role: 'deputy-auditor-general' as const,
    icon: 'heroicons:academic-cap',
    displayOrder: 3,
    translations: {
      en: {
        name: 'Deputy Auditor-General',
        title: 'Education Sector',
        bio: 'Responsible for auditing educational institutions and sector funds.'
      }
    },
    responsibilities: [
      { displayOrder: 0, translations: { en: { description: 'University audits' } } },
      { displayOrder: 1, translations: { en: { description: 'GETFund audits' } } },
      { displayOrder: 2, translations: { en: { description: 'Secondary education audits' } } },
      { displayOrder: 3, translations: { en: { description: 'Education sector compliance' } } }
    ]
  },
  {
    slug: 'dag-commercial-audits',
    role: 'deputy-auditor-general' as const,
    icon: 'heroicons:briefcase',
    displayOrder: 4,
    translations: {
      en: {
        name: 'Deputy Auditor-General',
        title: 'Commercial Audits',
        bio: 'Oversees audits of state-owned enterprises and commercial entities.'
      }
    },
    responsibilities: [
      { displayOrder: 0, translations: { en: { description: 'State-owned enterprise audits' } } },
      { displayOrder: 1, translations: { en: { description: 'Joint venture audits' } } },
      { displayOrder: 2, translations: { en: { description: 'Commercial compliance reviews' } } },
      { displayOrder: 3, translations: { en: { description: 'Public corporation audits' } } }
    ]
  },
  {
    slug: 'dag-performance-audit',
    role: 'deputy-auditor-general' as const,
    icon: 'heroicons:chart-bar',
    displayOrder: 5,
    translations: {
      en: {
        name: 'Deputy Auditor-General',
        title: 'Performance Audit',
        bio: 'Leads value-for-money and performance audit operations.'
      }
    },
    responsibilities: [
      { displayOrder: 0, translations: { en: { description: 'Performance audit planning' } } },
      { displayOrder: 1, translations: { en: { description: 'Value-for-money assessments' } } },
      { displayOrder: 2, translations: { en: { description: 'Program effectiveness reviews' } } },
      { displayOrder: 3, translations: { en: { description: 'Impact evaluations' } } }
    ]
  },
  {
    slug: 'dag-corporate-services',
    role: 'deputy-auditor-general' as const,
    icon: 'heroicons:wrench-screwdriver',
    displayOrder: 6,
    translations: {
      en: {
        name: 'Deputy Auditor-General',
        title: 'Corporate Services',
        bio: 'Manages internal operations, HR, and administrative functions.'
      }
    },
    responsibilities: [
      { displayOrder: 0, translations: { en: { description: 'Human resource management' } } },
      { displayOrder: 1, translations: { en: { description: 'Financial administration' } } },
      { displayOrder: 2, translations: { en: { description: 'Information technology' } } },
      { displayOrder: 3, translations: { en: { description: 'Corporate planning' } } }
    ]
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
    // Check if data already exists
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

    // Insert Auditor-General
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

    // Insert AG translation
    await db.insert(schema.managementTeamTranslations).values({
      managementTeamId: agId,
      locale: 'en',
      name: auditorGeneral.translations.en.name,
      title: auditorGeneral.translations.en.title,
      bio: auditorGeneral.translations.en.bio
    })

    console.log(`  - Created: ${auditorGeneral.translations.en.name}`)

    // Insert Deputy Auditors-General
    console.log('Inserting Deputy Auditors-General...')
    for (const dag of deputyAuditorsGeneral) {
      const [dagResult] = await db.insert(schema.managementTeam).values({
        slug: dag.slug,
        role: dag.role,
        icon: dag.icon,
        displayOrder: dag.displayOrder,
        isActive: true
      })

      const dagId = dagResult.insertId

      // Insert DAG translation
      await db.insert(schema.managementTeamTranslations).values({
        managementTeamId: dagId,
        locale: 'en',
        name: dag.translations.en.name,
        title: dag.translations.en.title,
        bio: dag.translations.en.bio
      })

      // Insert responsibilities
      for (const resp of dag.responsibilities) {
        const [respResult] = await db.insert(schema.managementTeamResponsibilities).values({
          managementTeamId: dagId,
          displayOrder: resp.displayOrder
        })

        const respId = respResult.insertId

        // Insert responsibility translation
        await db.insert(schema.managementTeamResponsibilityTranslations).values({
          responsibilityId: respId,
          locale: 'en',
          description: resp.translations.en.description
        })
      }

      console.log(
        `  - Created: ${dag.translations.en.name} (${dag.translations.en.title}) with ${dag.responsibilities.length} responsibilities`
      )
    }

    console.log('\nSeed completed successfully!')
    console.log(`  - 1 Auditor-General`)
    console.log(`  - ${deputyAuditorsGeneral.length} Deputy Auditors-General`)
    console.log(
      `  - ${deputyAuditorsGeneral.reduce((acc, dag) => acc + dag.responsibilities.length, 0)} responsibilities`
    )
  } catch (error) {
    console.error('Error seeding data:', error)
    throw error
  } finally {
    await pool.end()
    console.log('Database connection closed.')
  }
}

// Run the seed
seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
