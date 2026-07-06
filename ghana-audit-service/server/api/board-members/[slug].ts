import type { BoardMember } from '~/types'
import { eq, and, isNull } from 'drizzle-orm'
import { getDatabase, schema } from '../../database'
import { transformBoardMember } from '../../utils/transformBoardMembers'

export default defineEventHandler(async (event): Promise<BoardMember> => {
  const slug = getRouterParam(event, 'slug')
  const db = getDatabase()

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Member slug is required'
    })
  }

  const [member] = await db
    .select()
    .from(schema.boardMembers)
    .where(
      and(
        eq(schema.boardMembers.slug, slug),
        eq(schema.boardMembers.isActive, true),
        isNull(schema.boardMembers.deletedAt)
      )
    )
    .limit(1)

  if (!member) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board member not found'
    })
  }

  return transformBoardMember(member)
})
