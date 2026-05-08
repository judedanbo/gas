import type { ManagementTeamMember } from '~/types'
import { eq, and, isNull, sql } from 'drizzle-orm'
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
    translations: respTranslationsMap[r.id] || {},
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
        translations: officeTranslationsByLocale,
      }
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
