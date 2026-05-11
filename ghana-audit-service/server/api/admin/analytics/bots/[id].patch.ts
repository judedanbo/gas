import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requirePermission, getCurrentUser } from '../../../../utils/adminHelpers'
import { logAuditAction } from '../../../../utils/auditLogger'
import { getDatabase, schema } from '../../../../database'

const PATCH_SCHEMA = z.object({
  classification: z.enum(['clean', 'crawler', 'suspicious', 'abusive', 'safe-allowlist']),
  notes: z.string().max(1000).optional().nullable()
})

/**
 * Update a bot signature's classification (mark safe, force abusive, etc.)
 * and optional notes. Records decided_by + decided_at so the detector job
 * skips this row's classification on subsequent runs.
 *
 * Requires 'update' permission (editor+). Reads any active role.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'update')
  const user = getCurrentUser(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature id' })
  }

  const body = await readBody(event)
  const parsed = PATCH_SCHEMA.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: parsed.error.flatten()
    })
  }

  const db = getDatabase()
  const [existing] = await db
    .select({ id: schema.botSignatures.id, ipHash: schema.botSignatures.ipHash })
    .from(schema.botSignatures)
    .where(eq(schema.botSignatures.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Signature not found' })
  }

  await db
    .update(schema.botSignatures)
    .set({
      classification: parsed.data.classification,
      notes: parsed.data.notes ?? null,
      decidedBy: user.id,
      decidedAt: new Date()
    })
    .where(eq(schema.botSignatures.id, id))

  await logAuditAction(event, 'update', 'bot_signature', id, {
    after: {
      classification: parsed.data.classification,
      notes: parsed.data.notes ?? null
    }
  })

  return { ok: true }
})
