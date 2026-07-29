import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { signToken } from '~/server/utils/jwt'
import { signSseTicket } from '~/server/utils/sseTicket'

const SECRET = 'test-secret-for-adminauth-middleware-tests'
const ORIGINAL_SECRET = process.env.JWT_SECRET

const ACTIVE_USER = {
  id: 7,
  email: 'admin@audit.gov.gh',
  name: 'Admin',
  role: 'admin' as const,
  modules: null,
  isActive: true,
  status: 'active',
  deletedAt: null
}

// Per CLAUDE.md: vi.mock factories must use `function` declarations (hoisted).
vi.mock('~/server/database', () => ({
  getDatabase: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [ACTIVE_USER]
        })
      })
    })
  })),
  schema: {
    users: {
      id: 'id',
      email: 'email',
      name: 'name',
      role: 'role',
      modules: 'modules',
      isActive: 'is_active',
      status: 'status',
      deletedAt: 'deleted_at'
    }
  }
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  isNull: (col: unknown) => ({ op: 'isNull', col })
}))

vi.mock('~/server/utils/sessions', () => ({
  validateSession: vi.fn(async (sid: string) => ({
    ok: true,
    userId: 7,
    reason: undefined,
    timing: { sid, idleExpiresAt: 0, absoluteExpiresAt: 0 }
  }))
}))

vi.mock('~/server/utils/modules', () => ({
  resolveUserModules: vi.fn(() => []),
  moduleForPath: vi.fn(() => null)
}))

// h3 auto-imported helpers — stub BEFORE the dynamic import below. The fake
// event carries `headers` and `query` bags the stubs read from.
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal(
  'getHeader',
  (event: { headers: Record<string, string> }, name: string) => event.headers?.[name]
)
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query)
vi.stubGlobal('createError', (input: object) => Object.assign(new Error('h3'), input))

interface FakeH3Event {
  path: string
  headers: Record<string, string>
  query: Record<string, unknown>
  context: { auth?: { user: { id: number }; token: string; sessionId: string } }
}

function makeEvent(path: string, opts: { bearer?: string; ticket?: string } = {}): FakeH3Event {
  return {
    path,
    headers: opts.bearer ? { Authorization: `Bearer ${opts.bearer}` } : {},
    query: opts.ticket ? { ticket: opts.ticket } : {},
    context: {}
  }
}

let middleware: (event: FakeH3Event) => Promise<void>

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET
  middleware = (await import('~/server/middleware/adminAuth'))
    .default as unknown as typeof middleware
})

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = ORIGINAL_SECRET
})

describe('adminAuth middleware — SSE ticket route scoping', () => {
  it('accepts a valid ticket on the SSE stream route', async () => {
    const ticket = signSseTicket({ userId: 7, sid: 'sess-1' })
    const event = makeEvent('/api/admin/reports/optimize-stream?jobId=x', { ticket })

    await middleware(event)

    expect(event.context.auth).toBeDefined()
    expect(event.context.auth!.user.id).toBe(7)
    expect(event.context.auth!.sessionId).toBe('sess-1')
    expect(event.context.auth!.token).toBe(ticket)
  })

  it('rejects the same ticket on any other admin route', async () => {
    const ticket = signSseTicket({ userId: 7, sid: 'sess-1' })
    const event = makeEvent('/api/admin/reports', { ticket })

    await expect(middleware(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(event.context.auth).toBeUndefined()
  })

  it('rejects a session JWT smuggled in as a ticket (aud mismatch)', async () => {
    const jwt = signToken({ userId: 7, email: ACTIVE_USER.email, role: 'admin', sid: 'sess-1' })
    const event = makeEvent('/api/admin/reports/optimize-stream?jobId=x', { ticket: jwt })

    await expect(middleware(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('still accepts a Bearer JWT on a normal admin route', async () => {
    const jwt = signToken({ userId: 7, email: ACTIVE_USER.email, role: 'admin', sid: 'sess-1' })
    const event = makeEvent('/api/admin/reports', { bearer: jwt })

    await middleware(event)

    expect(event.context.auth).toBeDefined()
    expect(event.context.auth!.user.id).toBe(7)
  })

  it('ignores non-admin routes entirely', async () => {
    const event = makeEvent('/api/news')
    await middleware(event)
    expect(event.context.auth).toBeUndefined()
  })
})
