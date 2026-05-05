import { eq, and, ne } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const query = getQuery(event)
  const slug = query.slug as string
  const excludeId = query.excludeId ? Number(query.excludeId) : undefined

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required'
    })
  }

  const db = getDatabase()

  // Check if slug exists
  const conditions = [eq(schema.departments.slug, slug)]
  if (excludeId) {
    conditions.push(ne(schema.departments.id, excludeId))
  }

  const [existing] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(and(...conditions))
    .limit(1)

  if (!existing) {
    return { available: true }
  }

  // Slug is taken, find a suggestion
  let suggestion = slug
  let counter = 2

  while (counter <= 100) {
    suggestion = `${slug}-${counter}`

    const suggestionConditions = [eq(schema.departments.slug, suggestion)]
    if (excludeId) {
      suggestionConditions.push(ne(schema.departments.id, excludeId))
    }

    const [suggestionExists] = await db
      .select({ id: schema.departments.id })
      .from(schema.departments)
      .where(and(...suggestionConditions))
      .limit(1)

    if (!suggestionExists) {
      break
    }

    counter++
  }

  return {
    available: false,
    suggestion: counter <= 100 ? suggestion : undefined
  }
})
