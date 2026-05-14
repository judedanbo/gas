/**
 * Seed script for office types and office data
 * Source: https://audit.gov.gh/20/we-are-here
 *
 * Run with: npx tsx server/database/seeds/offices.ts
 * Use --force to clear existing data and reseed:
 *   npx tsx server/database/seeds/offices.ts --force
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import * as schema from '../schema/index'

const force = process.argv.includes('--force')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ghana_audit_service'
}

type OfficeTypeSlug = 'head-office' | 'regional-office' | 'district-office' | 'sector' | 'branch'

const officeTypesSeed: { slug: OfficeTypeSlug; name: string; displayOrder: number }[] = [
  { slug: 'head-office', name: 'Head Office', displayOrder: 0 },
  { slug: 'regional-office', name: 'Regional Office', displayOrder: 1 },
  { slug: 'district-office', name: 'District Office', displayOrder: 2 },
  { slug: 'sector', name: 'Sector', displayOrder: 3 },
  { slug: 'branch', name: 'Branch', displayOrder: 4 }
]

interface OfficeData {
  slug: string
  type: OfficeTypeSlug
  region: string
  phone: string | null
  email: string
  displayOrder: number
  translation: {
    name: string
    address: string
  }
}

const offices: OfficeData[] = [
  // ── Head Office ──
  {
    slug: 'head-office',
    type: 'head-office',
    region: 'Greater Accra',
    phone: '+233 302 664929',
    email: 'info@audit.gov.gh',
    displayOrder: 0,
    translation: {
      name: 'Head Office',
      address: "Ministries Block 'O', 1 Old Race Course Drive, P.O. Box M96, Ministries Accra, GA-110-8787"
    }
  },

  // ── Ahafo Region ──
  {
    slug: 'ahafo-regional',
    type: 'regional-office',
    region: 'Ahafo',
    phone: '0277435555',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Ahafo Regional Office', address: 'Ahafo Region' }
  },
  {
    slug: 'ahafo-bechem',
    type: 'district-office',
    region: 'Ahafo',
    phone: '0277 435 555',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Bechem District', address: 'Bechem, Ahafo Region' }
  },
  {
    slug: 'ahafo-goaso',
    type: 'district-office',
    region: 'Ahafo',
    phone: '0244 998 681',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Goaso District', address: 'Goaso, Ahafo Region' }
  },

  // ── Ashanti Region ──
  {
    slug: 'ashanti-regional',
    type: 'regional-office',
    region: 'Ashanti',
    phone: '0504861537',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Ashanti Regional Office', address: 'Ashanti Region' }
  },
  {
    slug: 'ashanti-obuasi',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0242 744 675',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Obuasi District', address: 'Obuasi, Ashanti Region' }
  },
  {
    slug: 'ashanti-bekwai',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0201280832',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Bekwai District', address: 'Bekwai, Ashanti Region' }
  },
  {
    slug: 'ashanti-tepa',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0509476334',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Tepa District', address: 'Tepa, Ashanti Region' }
  },
  {
    slug: 'ashanti-konongo',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0208298915',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Konongo District', address: 'Konongo, Ashanti Region' }
  },
  {
    slug: 'ashanti-agona',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0242 548 027',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Agona District', address: 'Agona, Ashanti Region' }
  },
  {
    slug: 'ashanti-effiduase',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0208 166 265',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: 'Effiduase District', address: 'Effiduase, Ashanti Region' }
  },
  {
    slug: 'ashanti-offinso',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0244 279 438',
    email: 'info@audit.gov.gh',
    displayOrder: 8,
    translation: { name: 'Offinso District', address: 'Offinso, Ashanti Region' }
  },
  {
    slug: 'ashanti-mampong',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0244 998 681',
    email: 'info@audit.gov.gh',
    displayOrder: 9,
    translation: { name: 'Mampong District', address: 'Mampong, Ashanti Region' }
  },
  {
    slug: 'ashanti-district-a',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0242 760 540',
    email: 'info@audit.gov.gh',
    displayOrder: 10,
    translation: { name: "District 'A'", address: 'Kumasi, Ashanti Region' }
  },
  {
    slug: 'ashanti-district-b',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0209 231 620',
    email: 'info@audit.gov.gh',
    displayOrder: 11,
    translation: { name: "District 'B'", address: 'Kumasi, Ashanti Region' }
  },
  {
    slug: 'ashanti-district-c',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0244 223 583',
    email: 'info@audit.gov.gh',
    displayOrder: 12,
    translation: { name: "District 'C'", address: 'Kumasi, Ashanti Region' }
  },
  {
    slug: 'ashanti-district-d',
    type: 'district-office',
    region: 'Ashanti',
    phone: '0555 073 221',
    email: 'info@audit.gov.gh',
    displayOrder: 13,
    translation: { name: "District 'D'", address: 'Kumasi, Ashanti Region' }
  },

  // ── Bono East Region ──
  {
    slug: 'bono-east-regional',
    type: 'regional-office',
    region: 'Bono East',
    phone: '0244 453 013',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Bono East Regional Office', address: 'Bono East Region' }
  },
  {
    slug: 'bono-east-kintampo',
    type: 'district-office',
    region: 'Bono East',
    phone: '0248 193 813',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Kintampo District', address: 'Kintampo, Bono East Region' }
  },
  {
    slug: 'bono-east-techiman',
    type: 'district-office',
    region: 'Bono East',
    phone: '0248 776 926',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Techiman District', address: 'Techiman, Bono East Region' }
  },
  {
    slug: 'bono-east-atebubu',
    type: 'district-office',
    region: 'Bono East',
    phone: '0208837923',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Atebubu District', address: 'Atebubu, Bono East Region' }
  },

  // ── Bono Region ──
  {
    slug: 'bono-regional',
    type: 'regional-office',
    region: 'Bono',
    phone: '0246 894 012',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Bono Regional Office', address: 'Bono Region' }
  },
  {
    slug: 'bono-district-a',
    type: 'district-office',
    region: 'Bono',
    phone: '0548 038 460',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: "District 'A'", address: 'Sunyani, Bono Region' }
  },
  {
    slug: 'bono-district-b',
    type: 'district-office',
    region: 'Bono',
    phone: '0544992650',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: "District 'B'", address: 'Sunyani, Bono Region' }
  },
  {
    slug: 'bono-district-c',
    type: 'district-office',
    region: 'Bono',
    phone: '0541 128 711',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: "District 'C'", address: 'Sunyani, Bono Region' }
  },
  {
    slug: 'bono-dormaa-ahenkro',
    type: 'district-office',
    region: 'Bono',
    phone: '0244 402 631',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Dormaa Ahenkro District', address: 'Dormaa Ahenkro, Bono Region' }
  },
  {
    slug: 'bono-wenchi',
    type: 'district-office',
    region: 'Bono',
    phone: '0248 182 920',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Wenchi District', address: 'Wenchi, Bono Region' }
  },
  {
    slug: 'bono-drobo',
    type: 'district-office',
    region: 'Bono',
    phone: '0207 494 227',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: 'Drobo District', address: 'Drobo, Bono Region' }
  },

  // ── Central Region ──
  {
    slug: 'central-regional',
    type: 'regional-office',
    region: 'Central',
    phone: '0244 374 544',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Central Regional Office', address: 'Cape Coast, Central Region' }
  },
  {
    slug: 'central-district-a',
    type: 'district-office',
    region: 'Central',
    phone: '0208 605 473',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: "District 'A'", address: 'Cape Coast, Central Region' }
  },
  {
    slug: 'central-district-b',
    type: 'district-office',
    region: 'Central',
    phone: '0546 658 028',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: "District 'B'", address: 'Cape Coast, Central Region' }
  },
  {
    slug: 'central-district-c',
    type: 'district-office',
    region: 'Central',
    phone: '0207 775 539',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: "District 'C'", address: 'Cape Coast, Central Region' }
  },
  {
    slug: 'central-saltpond',
    type: 'district-office',
    region: 'Central',
    phone: '0544 095 061',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Saltpond District', address: 'Saltpond, Central Region' }
  },
  {
    slug: 'central-winneba',
    type: 'district-office',
    region: 'Central',
    phone: '0207 563 303',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Winneba District', address: 'Winneba, Central Region' }
  },
  {
    slug: 'central-swedru',
    type: 'district-office',
    region: 'Central',
    phone: '0277147370',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: 'Swedru District', address: 'Swedru, Central Region' }
  },
  {
    slug: 'central-dunkwa-on-offin',
    type: 'district-office',
    region: 'Central',
    phone: '0547 787 557',
    email: 'info@audit.gov.gh',
    displayOrder: 8,
    translation: { name: 'Dunkwa-on-Offin District', address: 'Dunkwa-on-Offin, Central Region' }
  },
  {
    slug: 'central-apam',
    type: 'district-office',
    region: 'Central',
    phone: '0208506493',
    email: 'info@audit.gov.gh',
    displayOrder: 9,
    translation: { name: 'Apam District', address: 'Apam, Central Region' }
  },
  {
    slug: 'central-assin-foso',
    type: 'district-office',
    region: 'Central',
    phone: '0244 502 267',
    email: 'info@audit.gov.gh',
    displayOrder: 10,
    translation: { name: 'Assin Foso District', address: 'Assin Foso, Central Region' }
  },
  {
    slug: 'central-elmina',
    type: 'district-office',
    region: 'Central',
    phone: '0207876317',
    email: 'info@audit.gov.gh',
    displayOrder: 11,
    translation: { name: 'Elmina District', address: 'Elmina, Central Region' }
  },
  {
    slug: 'central-twifo-praso',
    type: 'district-office',
    region: 'Central',
    phone: '0246 850 694',
    email: 'info@audit.gov.gh',
    displayOrder: 12,
    translation: { name: 'Twifo Praso District', address: 'Twifo Praso, Central Region' }
  },

  // ── Eastern Region ──
  {
    slug: 'eastern-regional',
    type: 'regional-office',
    region: 'Eastern',
    phone: '0208 159 471',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Eastern Regional Office', address: 'Koforidua, Eastern Region' }
  },
  {
    slug: 'eastern-district-a',
    type: 'district-office',
    region: 'Eastern',
    phone: '0242 308 712',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: "District 'A'", address: 'Koforidua, Eastern Region' }
  },
  {
    slug: 'eastern-district-b',
    type: 'district-office',
    region: 'Eastern',
    phone: '0208 172 801',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: "District 'B'", address: 'Koforidua, Eastern Region' }
  },
  {
    slug: 'eastern-district-c',
    type: 'district-office',
    region: 'Eastern',
    phone: '0202 884 100',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: "District 'C'", address: 'Koforidua, Eastern Region' }
  },
  {
    slug: 'eastern-nsawam',
    type: 'district-office',
    region: 'Eastern',
    phone: '0273 012 264',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Nsawam District', address: 'Nsawam, Eastern Region' }
  },
  {
    slug: 'eastern-akim-oda',
    type: 'district-office',
    region: 'Eastern',
    phone: '0262 606 498',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Akim Oda District', address: 'Akim Oda, Eastern Region' }
  },
  {
    slug: 'eastern-nkawkaw',
    type: 'district-office',
    region: 'Eastern',
    phone: '0244 886 380',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: 'Nkawkaw District', address: 'Nkawkaw, Eastern Region' }
  },
  {
    slug: 'eastern-kibi',
    type: 'district-office',
    region: 'Eastern',
    phone: '0244 780 264',
    email: 'info@audit.gov.gh',
    displayOrder: 8,
    translation: { name: 'Kibi District', address: 'Kibi, Eastern Region' }
  },
  {
    slug: 'eastern-akropong',
    type: 'district-office',
    region: 'Eastern',
    phone: '0243 579 470',
    email: 'info@audit.gov.gh',
    displayOrder: 9,
    translation: { name: 'Akropong District', address: 'Akropong, Eastern Region' }
  },
  {
    slug: 'eastern-asamankese',
    type: 'district-office',
    region: 'Eastern',
    phone: '0243 559 504',
    email: 'info@audit.gov.gh',
    displayOrder: 10,
    translation: { name: 'Asamankese District', address: 'Asamankese, Eastern Region' }
  },
  {
    slug: 'eastern-odumase-krobo',
    type: 'district-office',
    region: 'Eastern',
    phone: '0208 159 471',
    email: 'info@audit.gov.gh',
    displayOrder: 11,
    translation: { name: 'Odumase Krobo District', address: 'Odumase Krobo, Eastern Region' }
  },

  // ── Greater Accra Region ──
  {
    slug: 'greater-accra-regional',
    type: 'regional-office',
    region: 'Greater Accra',
    phone: '0208239044',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Greater Accra Regional Office', address: 'P.O. Box 556, Tema, Greater Accra Region' }
  },
  {
    slug: 'greater-accra-tema',
    type: 'district-office',
    region: 'Greater Accra',
    phone: '0243 168 249',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Tema District', address: 'P.O. Box 556, Tema, Greater Accra Region' }
  },
  {
    slug: 'greater-accra-dodowa',
    type: 'district-office',
    region: 'Greater Accra',
    phone: '0244 036 310',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Dodowa District', address: 'Dodowa, Greater Accra Region' }
  },
  {
    slug: 'greater-accra-ama',
    type: 'district-office',
    region: 'Greater Accra',
    phone: '0500 025 710',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'AMA District', address: 'Accra, Greater Accra Region' }
  },
  {
    slug: 'greater-accra-district-a',
    type: 'district-office',
    region: 'Greater Accra',
    phone: '0244 719 351',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: "GAR District 'A'", address: 'P.O. Box 556, Tema, Greater Accra Region' }
  },
  {
    slug: 'greater-accra-district-b',
    type: 'district-office',
    region: 'Greater Accra',
    phone: '0208828711',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: "GAR District 'B'", address: 'P.O. Box 556, Tema, Greater Accra Region' }
  },
  {
    slug: 'greater-accra-district-c',
    type: 'district-office',
    region: 'Greater Accra',
    phone: '0244 784 832',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: "GAR District 'C'", address: 'P.O. Box 556, Tema, Greater Accra Region' }
  },

  // ── North East Region ──
  {
    slug: 'north-east-regional',
    type: 'regional-office',
    region: 'North East',
    phone: '0244 142 685',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'North East Regional Office', address: 'Nalerigu, North East Region' }
  },
  {
    slug: 'north-east-gambaga',
    type: 'district-office',
    region: 'North East',
    phone: '0244 403 878',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Gambaga District', address: 'Gambaga, North East Region' }
  },

  // ── Northern Region ──
  {
    slug: 'northern-regional',
    type: 'regional-office',
    region: 'Northern',
    phone: '0244 784 832',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Northern Regional Office', address: 'Tamale, Northern Region' }
  },
  {
    slug: 'northern-tamale-district-a',
    type: 'district-office',
    region: 'Northern',
    phone: '0208 337 806',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: "Tamale District 'A'", address: 'Tamale, Northern Region' }
  },
  {
    slug: 'northern-tamale-district-b',
    type: 'district-office',
    region: 'Northern',
    phone: '0554 655 180',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: "Tamale District 'B'", address: 'Tamale, Northern Region' }
  },
  {
    slug: 'northern-tamale-district-c',
    type: 'district-office',
    region: 'Northern',
    phone: '0243 549 879',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: "Tamale District 'C'", address: 'Tamale, Northern Region' }
  },
  {
    slug: 'northern-bimbilla',
    type: 'district-office',
    region: 'Northern',
    phone: '0243 562 057',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Bimbilla District', address: 'Bimbilla, Northern Region' }
  },
  {
    slug: 'northern-yendi',
    type: 'district-office',
    region: 'Northern',
    phone: '0268 363 341',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Yendi District', address: 'Yendi, Northern Region' }
  },
  {
    slug: 'northern-savelugu',
    type: 'district-office',
    region: 'Northern',
    phone: '0244 902 721',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: 'Savelugu District', address: 'Savelugu, Northern Region' }
  },
  {
    slug: 'northern-gushegu',
    type: 'district-office',
    region: 'Northern',
    phone: '0246 304 758',
    email: 'info@audit.gov.gh',
    displayOrder: 8,
    translation: { name: 'Gushegu District', address: 'Gushegu, Northern Region' }
  },

  // ── Oti Region ──
  {
    slug: 'oti-regional',
    type: 'regional-office',
    region: 'Oti',
    phone: '0244 281 693',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Oti Regional Office', address: 'Dambai, Oti Region' }
  },
  {
    slug: 'oti-jasikan',
    type: 'district-office',
    region: 'Oti',
    phone: '0244 753 587',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Jasikan District', address: 'Jasikan, Oti Region' }
  },
  {
    slug: 'oti-nkwanta',
    type: 'district-office',
    region: 'Oti',
    phone: '0244 531 056',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Nkwanta District', address: 'Nkwanta, Oti Region' }
  },
  {
    slug: 'oti-kete-krachi',
    type: 'district-office',
    region: 'Oti',
    phone: '0242 270 600',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Kete-Krachi District', address: 'Kete-Krachi, Oti Region' }
  },

  // ── Savannah Region ──
  {
    slug: 'savannah-regional',
    type: 'regional-office',
    region: 'Savannah',
    phone: '0244 142 685',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Savannah Regional Office', address: 'Damongo, Savannah Region' }
  },
  {
    slug: 'savannah-bole',
    type: 'district-office',
    region: 'Savannah',
    phone: '0209 815 938',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Bole District', address: 'Bole, Savannah Region' }
  },
  {
    slug: 'savannah-damongo',
    type: 'district-office',
    region: 'Savannah',
    phone: '0244 928 418',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Damongo District', address: 'Damongo, Savannah Region' }
  },
  {
    slug: 'savannah-salaga',
    type: 'district-office',
    region: 'Savannah',
    phone: '0242 010 741',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Salaga District', address: 'Salaga, Savannah Region' }
  },

  // ── Upper East Region ──
  {
    slug: 'upper-east-regional',
    type: 'regional-office',
    region: 'Upper East',
    phone: '0246 173 879',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Upper East Regional Office', address: 'Bolgatanga, Upper East Region' }
  },
  {
    slug: 'upper-east-district-a',
    type: 'district-office',
    region: 'Upper East',
    phone: '0244 764 814',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: "District 'A'", address: 'Bolgatanga, Upper East Region' }
  },
  {
    slug: 'upper-east-district-b',
    type: 'district-office',
    region: 'Upper East',
    phone: '0243 771 814',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: "District 'B'", address: 'Bolgatanga, Upper East Region' }
  },
  {
    slug: 'upper-east-district-c',
    type: 'district-office',
    region: 'Upper East',
    phone: '0200240954',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: "District 'C'", address: 'Bolgatanga, Upper East Region' }
  },
  {
    slug: 'upper-east-navrongo',
    type: 'district-office',
    region: 'Upper East',
    phone: '0244 574 583',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Navrongo District', address: 'Navrongo, Upper East Region' }
  },
  {
    slug: 'upper-east-bawku',
    type: 'district-office',
    region: 'Upper East',
    phone: '0243 753 013',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Bawku District', address: 'Bawku, Upper East Region' }
  },
  {
    slug: 'upper-east-zebila',
    type: 'district-office',
    region: 'Upper East',
    phone: '0243 771 814',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: 'Zebila District', address: 'Zebila, Upper East Region' }
  },

  // ── Upper West Region ──
  {
    slug: 'upper-west-regional',
    type: 'regional-office',
    region: 'Upper West',
    phone: '0244 704 420',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Upper West Regional Office', address: 'Wa, Upper West Region' }
  },
  {
    slug: 'upper-west-district-a',
    type: 'district-office',
    region: 'Upper West',
    phone: '0244 819 533',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: "District 'A'", address: 'Wa, Upper West Region' }
  },
  {
    slug: 'upper-west-district-b',
    type: 'district-office',
    region: 'Upper West',
    phone: '0244 436 298',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: "District 'B'", address: 'Wa, Upper West Region' }
  },
  {
    slug: 'upper-west-lawra',
    type: 'district-office',
    region: 'Upper West',
    phone: '0244 825 213',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Lawra District', address: 'Lawra, Upper West Region' }
  },
  {
    slug: 'upper-west-tumu',
    type: 'district-office',
    region: 'Upper West',
    phone: '0244 077 527',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Tumu District', address: 'Tumu, Upper West Region' }
  },
  {
    slug: 'upper-west-jirapa',
    type: 'district-office',
    region: 'Upper West',
    phone: '0244 757 876',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Jirapa District', address: 'Jirapa, Upper West Region' }
  },

  // ── Volta Region ──
  {
    slug: 'volta-regional',
    type: 'regional-office',
    region: 'Volta',
    phone: '0247 535 353',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Volta Regional Office', address: 'Ho, Volta Region' }
  },
  {
    slug: 'volta-keta',
    type: 'district-office',
    region: 'Volta',
    phone: '0244 018 990',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Keta District', address: 'Keta, Volta Region' }
  },
  {
    slug: 'volta-sogakope',
    type: 'district-office',
    region: 'Volta',
    phone: '0204530985',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Sogakope District', address: 'Sogakope, Volta Region' }
  },
  {
    slug: 'volta-hohoe',
    type: 'district-office',
    region: 'Volta',
    phone: '0243 543 671',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Hohoe District', address: 'Hohoe, Volta Region' }
  },
  {
    slug: 'volta-kpando',
    type: 'district-office',
    region: 'Volta',
    phone: '0249 313 952',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: 'Kpando District', address: 'Kpando, Volta Region' }
  },
  {
    slug: 'volta-denu',
    type: 'district-office',
    region: 'Volta',
    phone: '0244 694 143',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: 'Denu District', address: 'Denu, Volta Region' }
  },
  {
    slug: 'volta-ho-district-a',
    type: 'district-office',
    region: 'Volta',
    phone: '0244 993 902',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: "Ho District 'A'", address: 'Ho, Volta Region' }
  },
  {
    slug: 'volta-ho-district-b',
    type: 'district-office',
    region: 'Volta',
    phone: '0243 260 905',
    email: 'info@audit.gov.gh',
    displayOrder: 8,
    translation: { name: "Ho District 'B'", address: 'Ho, Volta Region' }
  },
  {
    slug: 'volta-ho-district-c',
    type: 'district-office',
    region: 'Volta',
    phone: '0244 593 772',
    email: 'info@audit.gov.gh',
    displayOrder: 9,
    translation: { name: "Ho District 'C'", address: 'Ho, Volta Region' }
  },

  // ── Western North Region ──
  {
    slug: 'western-north-regional',
    type: 'regional-office',
    region: 'Western North',
    phone: '0244 725 192',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Western North Regional Office', address: 'Sefwi Wiawso, Western North Region' }
  },
  {
    slug: 'western-north-enchi',
    type: 'district-office',
    region: 'Western North',
    phone: '0242 744 675',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Enchi District', address: 'Enchi, Western North Region' }
  },
  {
    slug: 'western-north-bibiani',
    type: 'district-office',
    region: 'Western North',
    phone: '0244 563 608',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Bibiani District', address: 'Bibiani, Western North Region' }
  },
  {
    slug: 'western-north-sefwi-wiawso',
    type: 'district-office',
    region: 'Western North',
    phone: '0244 948 922',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Sefwi Wiawso District', address: 'Sefwi Wiawso, Western North Region' }
  },

  // ── Western Region ──
  {
    slug: 'western-regional',
    type: 'regional-office',
    region: 'Western',
    phone: '0208 215 182',
    email: 'info@audit.gov.gh',
    displayOrder: 1,
    translation: { name: 'Western Regional Office', address: 'Sekondi-Takoradi, Western Region' }
  },
  {
    slug: 'western-tarkwa',
    type: 'district-office',
    region: 'Western',
    phone: '0243 424 205',
    email: 'info@audit.gov.gh',
    displayOrder: 2,
    translation: { name: 'Tarkwa District', address: 'Tarkwa, Western Region' }
  },
  {
    slug: 'western-half-assini',
    type: 'district-office',
    region: 'Western',
    phone: '0243 321 890',
    email: 'info@audit.gov.gh',
    displayOrder: 3,
    translation: { name: 'Half Assini District', address: 'Half Assini, Western Region' }
  },
  {
    slug: 'western-axim',
    type: 'district-office',
    region: 'Western',
    phone: '0246 437 708',
    email: 'info@audit.gov.gh',
    displayOrder: 4,
    translation: { name: 'Axim District', address: 'Axim, Western Region' }
  },
  {
    slug: 'western-sekondi-district-a',
    type: 'district-office',
    region: 'Western',
    phone: '0243 264 331',
    email: 'info@audit.gov.gh',
    displayOrder: 5,
    translation: { name: "Sekondi District 'A'", address: 'Sekondi, Western Region' }
  },
  {
    slug: 'western-takoradi-district-a',
    type: 'district-office',
    region: 'Western',
    phone: '0208389614',
    email: 'info@audit.gov.gh',
    displayOrder: 6,
    translation: { name: "Takoradi District 'A'", address: 'Takoradi, Western Region' }
  },
  {
    slug: 'western-takoradi-district-b',
    type: 'district-office',
    region: 'Western',
    phone: '0240573272',
    email: 'info@audit.gov.gh',
    displayOrder: 7,
    translation: { name: "Takoradi District 'B'", address: 'Takoradi, Western Region' }
  },
  {
    slug: 'western-asankragwa',
    type: 'district-office',
    region: 'Western',
    phone: '0244 504 168',
    email: 'info@audit.gov.gh',
    displayOrder: 8,
    translation: { name: 'Asankragwa District', address: 'Asankragwa, Western Region' }
  },
  {
    slug: 'western-sekondi-district-b',
    type: 'district-office',
    region: 'Western',
    phone: '0244 938 471',
    email: 'info@audit.gov.gh',
    displayOrder: 9,
    translation: { name: "Sekondi District 'B'", address: 'Sekondi, Western Region' }
  },

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
    // Seed office types (upsert — always ensure they exist)
    const existingTypes = await db.select().from(schema.officeTypes)
    if (existingTypes.length === 0) {
      console.log('Seeding office types...')
      for (const t of officeTypesSeed) {
        await db.insert(schema.officeTypes).values(t)
      }
      console.log(`Seeded ${officeTypesSeed.length} office types.`)
    } else {
      console.log(`Found ${existingTypes.length} existing office types, skipping type seed.`)
    }

    // Build slug → id map for office types
    const allTypes = await db.select().from(schema.officeTypes)
    const typeMap = Object.fromEntries(allTypes.map((t) => [t.slug, t.id]))

    // Seed offices
    const existing = await db.select().from(schema.offices)
    if (existing.length > 0) {
      if (!force) {
        console.log(`Found ${existing.length} existing offices.`)
        console.log('Skipping seed to avoid duplicates. Use --force to clear and reseed.')
        return
      }
      console.log(`Clearing ${existing.length} existing offices (--force)...`)
      await db.execute(sql`DELETE FROM ${schema.officeTranslations}`)
      await db.execute(sql`DELETE FROM ${schema.offices}`)
    }

    console.log(`Seeding ${offices.length} offices...`)

    let inserted = 0
    for (const office of offices) {
      const typeId = typeMap[office.type]
      if (!typeId) {
        console.warn(`Unknown office type '${office.type}' for ${office.slug}, skipping.`)
        continue
      }

      const [result] = await db.insert(schema.offices).values({
        slug: office.slug,
        typeId,
        region: office.region,
        phone: office.phone,
        email: office.email,
        displayOrder: office.displayOrder
      })

      await db.insert(schema.officeTranslations).values({
        officeId: result.insertId,
        locale: 'en',
        name: office.translation.name,
        address: office.translation.address
      })

      inserted++
    }

    console.log(`Successfully seeded ${inserted} offices with English translations.`)
    console.log('Akan translations can be added later via the admin panel.')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
