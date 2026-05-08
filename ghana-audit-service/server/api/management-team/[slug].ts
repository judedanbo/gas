import type { ManagementTeamMember } from '~/types'
import { eq, and, isNull, inArray } from 'drizzle-orm'
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
      statusMessage: 'Member slug is required',
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
      statusMessage: 'Management team member not found',
    })
  }

  // Fetch translations and responsibilities in parallel
  const [translations, responsibilities] = await Promise.all([
    db
      .select()
      .from(schema.managementTeamTranslations)
      .where(eq(schema.managementTeamTranslations.managementTeamId, member.id)),
    db
      .select()
      .from(schema.managementTeamResponsibilities)
      .where(eq(schema.managementTeamResponsibilities.managementTeamId, member.id)),
  ])

  const translationsByLocale = translations.reduce(
    (acc, t) => {
      acc[t.locale] = { name: t.name, title: t.title, bio: t.bio }
      return acc
    },
    {} as Record<string, { name: string; title: string; bio: string | null }>
  )

  const responsibilityIds = responsibilities.map((r) => r.id)

  // Fetch responsibility translations, department, and regional office in parallel
  const [respTranslationsResult, deptResult, officeResult] = await Promise.all([
    responsibilityIds.length > 0
      ? db
          .select()
          .from(schema.managementTeamResponsibilityTranslations)
          .where(
            inArray(
              schema.managementTeamResponsibilityTranslations.responsibilityId,
              responsibilityIds
            )
          )
      : Promise.resolve([]),
    member.departmentId
      ? db
          .select()
          .from(schema.departments)
          .where(eq(schema.departments.id, member.departmentId))
      : Promise.resolve([]),
    member.regionalOfficeId
      ? db
          .select()
          .from(schema.regionalOffices)
          .where(eq(schema.regionalOffices.id, member.regionalOfficeId))
      : Promise.resolve([]),
  ])

  const respTranslationsMap = respTranslationsResult.reduce(
    (acc, t) => {
      if (!acc[t.responsibilityId]) acc[t.responsibilityId] = {}
      acc[t.responsibilityId][t.locale] = { description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { description: string }>>
  )

  const responsibilitiesWithTranslations = responsibilities.map((r) => ({
    displayOrder: r.displayOrder,
    translations: respTranslationsMap[r.id] || {},
  }))

  // Fetch department and regional office translations in parallel
  const [deptTranslations, officeTranslations] = await Promise.all([
    deptResult.length > 0
      ? db
          .select()
          .from(schema.departmentTranslations)
          .where(eq(schema.departmentTranslations.departmentId, deptResult[0].id))
      : Promise.resolve([]),
    officeResult.length > 0
      ? db
          .select()
          .from(schema.regionalOfficeTranslations)
          .where(eq(schema.regionalOfficeTranslations.officeId, officeResult[0].id))
      : Promise.resolve([]),
  ])

  let department: { id: number; translations: Record<string, { name: string }> } | undefined
  if (deptResult.length > 0) {
    const deptTranslationsByLocale = deptTranslations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name }
        return acc
      },
      {} as Record<string, { name: string }>
    )
    department = { id: deptResult[0].id, translations: deptTranslationsByLocale }
  }

  let regionalOffice:
    | { id: number; region: string; translations: Record<string, { name: string }> }
    | undefined
  if (officeResult.length > 0) {
    const officeTranslationsByLocale = officeTranslations.reduce(
      (acc, t) => {
        acc[t.locale] = { name: t.name }
        return acc
      },
      {} as Record<string, { name: string }>
    )
    regionalOffice = {
      id: officeResult[0].id,
      region: officeResult[0].region,
      translations: officeTranslationsByLocale,
    }
  }

  const memberWithData = {
    ...member,
    translations: translationsByLocale,
    responsibilities: responsibilitiesWithTranslations,
    department,
    regionalOffice,
  }

  return transformManagementTeamMember(memberWithData, locale)
})
