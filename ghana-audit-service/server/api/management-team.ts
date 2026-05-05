import type { ManagementTeamMember } from '~/types'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformManagementTeamMembers } from '../utils/transformManagementTeam'
import { getLocaleFromRequest } from '../utils/locale'

export default defineEventHandler(async (event): Promise<ManagementTeamMember[]> => {
  const locale = getLocaleFromRequest(event)
  const db = getDatabase()

  // Build where conditions - only active, non-deleted members
  const whereClause = and(
    isNull(schema.managementTeam.deletedAt),
    eq(schema.managementTeam.isActive, true)
  )

  // Fetch management team members ordered by role (AG first, DAGs second, Regional Auditors third) then displayOrder
  const members = await db
    .select()
    .from(schema.managementTeam)
    .where(whereClause)
    .orderBy(
      sql`CASE
        WHEN ${schema.managementTeam.role} = 'auditor-general' THEN 0
        WHEN ${schema.managementTeam.role} = 'deputy-auditor-general' THEN 1
        ELSE 2
      END`,
      schema.managementTeam.displayOrder
    )

  if (members.length === 0) {
    return []
  }

  const memberIds = members.map((m) => m.id)

  // Fetch translations for all members
  const translations = await db
    .select()
    .from(schema.managementTeamTranslations)
    .where(
      sql`${schema.managementTeamTranslations.managementTeamId} IN (${sql.join(memberIds, sql`, `)})`
    )

  // Fetch responsibilities and their translations
  const responsibilities = await db
    .select()
    .from(schema.managementTeamResponsibilities)
    .where(
      sql`${schema.managementTeamResponsibilities.managementTeamId} IN (${sql.join(memberIds, sql`, `)})`
    )

  const responsibilityIds = responsibilities.map((r) => r.id)
  const responsibilityTranslations =
    responsibilityIds.length > 0
      ? await db
          .select()
          .from(schema.managementTeamResponsibilityTranslations)
          .where(
            sql`${schema.managementTeamResponsibilityTranslations.responsibilityId} IN (${sql.join(responsibilityIds, sql`, `)})`
          )
      : []

  // Group translations by member
  const translationsByMember = translations.reduce(
    (acc, t) => {
      if (!acc[t.managementTeamId]) {
        acc[t.managementTeamId] = {}
      }
      acc[t.managementTeamId][t.locale] = {
        name: t.name,
        title: t.title,
        bio: t.bio
      }
      return acc
    },
    {} as Record<number, Record<string, { name: string; title: string; bio: string | null }>>
  )

  // Group responsibility translations
  const respTranslationsMap = responsibilityTranslations.reduce(
    (acc, t) => {
      if (!acc[t.responsibilityId]) {
        acc[t.responsibilityId] = {}
      }
      acc[t.responsibilityId][t.locale] = { description: t.description }
      return acc
    },
    {} as Record<number, Record<string, { description: string }>>
  )

  // Group responsibilities by member
  const responsibilitiesByMember = responsibilities.reduce(
    (acc, r) => {
      if (!acc[r.managementTeamId]) {
        acc[r.managementTeamId] = []
      }
      acc[r.managementTeamId].push({
        displayOrder: r.displayOrder,
        translations: respTranslationsMap[r.id] || {}
      })
      return acc
    },
    {} as Record<
      number,
      Array<{ displayOrder: number; translations: Record<string, { description: string }> }>
    >
  )

  // Fetch regional office data for regional auditors
  const regionalOfficeIds = members
    .filter((m) => m.role === 'regional-auditor' && m.regionalOfficeId)
    .map((m) => m.regionalOfficeId!)

  let regionalOfficesMap: Record<
    number,
    { id: number; region: string; translations: Record<string, { name: string }> }
  > = {}

  if (regionalOfficeIds.length > 0) {
    const offices = await db
      .select()
      .from(schema.regionalOffices)
      .where(sql`${schema.regionalOffices.id} IN (${sql.join(regionalOfficeIds, sql`, `)})`)

    const officeTranslations = await db
      .select()
      .from(schema.regionalOfficeTranslations)
      .where(
        sql`${schema.regionalOfficeTranslations.officeId} IN (${sql.join(regionalOfficeIds, sql`, `)})`
      )

    // Group office translations
    const officeTranslationsMap = officeTranslations.reduce(
      (acc, t) => {
        if (!acc[t.officeId]) {
          acc[t.officeId] = {}
        }
        acc[t.officeId][t.locale] = { name: t.name }
        return acc
      },
      {} as Record<number, Record<string, { name: string }>>
    )

    // Build regional offices map
    regionalOfficesMap = offices.reduce(
      (acc, office) => {
        acc[office.id] = {
          id: office.id,
          region: office.region,
          translations: officeTranslationsMap[office.id] || {}
        }
        return acc
      },
      {} as Record<
        number,
        { id: number; region: string; translations: Record<string, { name: string }> }
      >
    )
  }

  // Fetch department data for deputy auditors-general
  const departmentIds = members
    .filter((m) => m.role === 'deputy-auditor-general' && m.departmentId)
    .map((m) => m.departmentId!)

  let departmentsMap: Record<
    number,
    { id: number; translations: Record<string, { name: string }> }
  > = {}

  if (departmentIds.length > 0) {
    const departments = await db
      .select()
      .from(schema.departments)
      .where(sql`${schema.departments.id} IN (${sql.join(departmentIds, sql`, `)})`)

    const deptTranslations = await db
      .select()
      .from(schema.departmentTranslations)
      .where(
        sql`${schema.departmentTranslations.departmentId} IN (${sql.join(departmentIds, sql`, `)})`
      )

    // Group department translations
    const deptTranslationsMap = deptTranslations.reduce(
      (acc, t) => {
        if (!acc[t.departmentId]) {
          acc[t.departmentId] = {}
        }
        acc[t.departmentId][t.locale] = { name: t.name }
        return acc
      },
      {} as Record<number, Record<string, { name: string }>>
    )

    // Build departments map
    departmentsMap = departments.reduce(
      (acc, dept) => {
        acc[dept.id] = {
          id: dept.id,
          translations: deptTranslationsMap[dept.id] || {}
        }
        return acc
      },
      {} as Record<number, { id: number; translations: Record<string, { name: string }> }>
    )
  }

  // Combine members with data
  const membersWithData = members.map((member) => ({
    ...member,
    translations: translationsByMember[member.id] || {},
    responsibilities: responsibilitiesByMember[member.id] || [],
    regionalOffice: member.regionalOfficeId
      ? regionalOfficesMap[member.regionalOfficeId]
      : undefined,
    department: member.departmentId ? departmentsMap[member.departmentId] : undefined
  }))

  // Transform to public format
  return transformManagementTeamMembers(membersWithData, locale)
})
