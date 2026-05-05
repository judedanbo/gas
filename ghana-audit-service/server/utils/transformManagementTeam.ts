import type { ManagementTeamMember } from '~/types'

type SupportedLocale = 'en' | 'ak'
type ManagementRole = 'auditor-general' | 'deputy-auditor-general' | 'regional-auditor'

interface DbManagementTeamMember {
  id: number
  slug: string
  role: ManagementRole
  regionalOfficeId: number | null
  departmentId: number | null
  icon: string | null
  photo: string | null
  email: string | null
  phone: string | null
  displayOrder: number
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

interface ManagementTeamMemberWithData extends DbManagementTeamMember {
  translations: Record<string, { name: string; title: string; bio: string | null }>
  responsibilities: Array<{
    displayOrder: number
    translations: Record<string, { description: string }>
  }>
  regionalOffice?: {
    id: number
    region: string
    translations: Record<string, { name: string }>
  }
  department?: {
    id: number
    translations: Record<string, { name: string }>
  }
}

/**
 * Transform a database management team member to public API format
 */
export function transformManagementTeamMember(
  member: ManagementTeamMemberWithData,
  locale: SupportedLocale = 'en'
): ManagementTeamMember {
  // Get translation for requested locale, fallback to English
  const translation = member.translations[locale] ||
    member.translations.en || {
      name: 'Unknown',
      title: '',
      bio: null
    }

  // Transform responsibilities with locale fallback
  const responsibilities = member.responsibilities
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((resp) => {
      const respTranslation = resp.translations[locale] ||
        resp.translations.en || { description: '' }
      return respTranslation.description
    })
    .filter((desc) => desc.length > 0)

  // Get regional office name for regional auditors
  let regionalOfficeName: string | undefined
  if (member.regionalOffice) {
    const officeTranslation =
      member.regionalOffice.translations[locale] || member.regionalOffice.translations.en
    regionalOfficeName = officeTranslation?.name || member.regionalOffice.region
  }

  // Get department name for deputy auditors-general
  let departmentName: string | undefined
  if (member.department) {
    const deptTranslation =
      member.department.translations[locale] || member.department.translations.en
    departmentName = deptTranslation?.name
  }

  return {
    id: String(member.id),
    slug: member.slug,
    role: member.role,
    name: translation.name,
    title: translation.title,
    bio: translation.bio || undefined,
    icon: member.icon || undefined,
    photo: member.photo || undefined,
    email: member.email || undefined,
    phone: member.phone || undefined,
    responsibilities,
    order: member.displayOrder,
    isActive: member.isActive,
    regionalOfficeId: member.regionalOfficeId || undefined,
    regionalOfficeName,
    departmentId: member.departmentId || undefined,
    departmentName
  }
}

/**
 * Transform an array of database management team members to public API format
 */
export function transformManagementTeamMembers(
  members: ManagementTeamMemberWithData[],
  locale: SupportedLocale = 'en'
): ManagementTeamMember[] {
  return members.map((member) => transformManagementTeamMember(member, locale))
}
