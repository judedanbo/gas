import type { BoardMember } from '~/types'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../database'
import { transformBoardMembers } from '../utils/transformBoardMembers'

export default defineEventHandler(async (): Promise<BoardMember[]> => {
  const db = getDatabase()

  // Only active, non-deleted members
  const whereClause = and(
    isNull(schema.boardMembers.deletedAt),
    eq(schema.boardMembers.isActive, true)
  )

  // Chairperson first, then members by displayOrder
  const members = await db
    .select()
    .from(schema.boardMembers)
    .where(whereClause)
    .orderBy(
      sql`CASE WHEN ${schema.boardMembers.role} = 'chairperson' THEN 0 ELSE 1 END`,
      schema.boardMembers.displayOrder
    )

  return transformBoardMembers(members)
})
