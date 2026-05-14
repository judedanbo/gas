import type { Office } from '~/types'
import { isNull, sql, asc } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformOffices } from '../utils/transformOffice'
import { getLocaleFromRequest } from '../utils/locale'

export default defineEventHandler(async (event): Promise<Office[]> => {
  const query = getQuery(event)
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  const offices = await db
    .select()
    .from(schema.offices)
    .where(isNull(schema.offices.deletedAt))
    .orderBy(asc(schema.offices.displayOrder), asc(schema.offices.region))

  const officeIds = offices.map((o) => o.id)
  const translations =
    officeIds.length > 0
      ? await db
          .select()
          .from(schema.officeTranslations)
          .where(
            sql`${schema.officeTranslations.officeId} IN (${sql.join(officeIds, sql`, `)})`
          )
      : []

  const typeIds = [...new Set(offices.map((o) => o.typeId))]
  const types =
    typeIds.length > 0
      ? await db
          .select()
          .from(schema.officeTypes)
          .where(sql`${schema.officeTypes.id} IN (${sql.join(typeIds, sql`, `)})`)
      : []
  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]))

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

  let officesWithTranslations = offices.map((office) => ({
    ...office,
    typeName: typeMap[office.typeId] || '',
    translations: translationsByOffice[office.id] || {}
  }))

  if (query.region && typeof query.region === 'string') {
    const regionFilter = query.region.toLowerCase()
    officesWithTranslations = officesWithTranslations.filter(
      (o) => o.region.toLowerCase() === regionFilter
    )
  }

  if (query.type && typeof query.type === 'string') {
    const typeFilter = query.type.toLowerCase()
    officesWithTranslations = officesWithTranslations.filter(
      (o) => o.typeName.toLowerCase() === typeFilter
    )
  }

  return transformOffices(officesWithTranslations, locale)
})
