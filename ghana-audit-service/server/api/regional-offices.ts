import type { RegionalOffice } from '~/types'
import { isNull, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformRegionalOffices, getLocaleFromRequest } from '../utils/transformRegionalOffice'

export default defineEventHandler(async (event): Promise<RegionalOffice[]> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Fetch all non-deleted offices, sorted by displayOrder then region
  const offices = await db
    .select()
    .from(schema.regionalOffices)
    .where(isNull(schema.regionalOffices.deletedAt))
    .orderBy(asc(schema.regionalOffices.displayOrder), asc(schema.regionalOffices.region))

  // Fetch translations for each office
  const officeIds = offices.map((o) => o.id)
  const translations =
    officeIds.length > 0
      ? await db
          .select()
          .from(schema.regionalOfficeTranslations)
          .where(
            sql`${schema.regionalOfficeTranslations.officeId} IN (${sql.join(officeIds, sql`, `)})`
          )
      : []

  // Group translations by office
  const translationsByOffice = translations.reduce(
    (acc, t) => {
      if (!acc[t.officeId]) {
        acc[t.officeId] = {}
      }
      acc[t.officeId][t.locale] = {
        name: t.name,
        address: t.address
      }
      return acc
    },
    {} as Record<number, Record<string, { name: string; address: string }>>
  )

  // Combine offices with translations
  let officesWithTranslations = offices.map((office) => ({
    ...office,
    translations: translationsByOffice[office.id] || {}
  }))

  // Filter by region if specified
  if (query.region && typeof query.region === 'string') {
    const regionFilter = query.region.toLowerCase()
    officesWithTranslations = officesWithTranslations.filter(
      (o) => o.region.toLowerCase() === regionFilter
    )
  }

  // Transform to public format
  return transformRegionalOffices(officesWithTranslations, locale)
})
