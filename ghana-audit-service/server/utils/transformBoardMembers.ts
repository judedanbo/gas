import type { BoardMember } from '~/types'

type BoardRole = 'chairperson' | 'member'

interface DbBoardMember {
  id: number
  slug: string
  role: BoardRole
  name: string
  title: string | null
  bio: string | null
  photo: string | null
  email: string | null
  phone: string | null
  displayOrder: number
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

/**
 * Transform a database board member to public API format
 */
export function transformBoardMember(member: DbBoardMember): BoardMember {
  return {
    id: String(member.id),
    slug: member.slug,
    role: member.role,
    name: member.name,
    title: member.title || undefined,
    bio: member.bio || undefined,
    photo: member.photo || undefined,
    email: member.email || undefined,
    phone: member.phone || undefined,
    order: member.displayOrder,
    isActive: member.isActive
  }
}

/**
 * Transform an array of database board members to public API format
 */
export function transformBoardMembers(members: DbBoardMember[]): BoardMember[] {
  return members.map((member) => transformBoardMember(member))
}
