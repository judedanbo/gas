import { asc } from 'drizzle-orm'
import { getDatabase, schema } from '../../../database'
import { requirePermission } from '../../../utils/adminHelpers'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'read')

  const db = getDatabase()
  return db.select().from(schema.officeTypes).orderBy(asc(schema.officeTypes.displayOrder))
})
