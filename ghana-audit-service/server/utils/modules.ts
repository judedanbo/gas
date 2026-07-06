import type { H3Event } from 'h3'

/**
 * Functional "module scope" — an orthogonal dimension to the admin/editor/viewer
 * role. The role controls CRUD depth; the module list controls which functional
 * areas of the admin panel a user may touch. Admins implicitly have every
 * module (their stored value is ignored).
 */
export const MODULE_KEYS = [
  'reports',
  'content',
  'careers',
  'organization',
  'media',
  'analytics',
  'communications'
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

/**
 * Maps the first path segment under `/api/admin/<segment>` to a module.
 * Segments absent from this map are intentionally NOT module-gated
 * (`auth`, `upload`, `users` — the latter is already `requireAdmin`-gated).
 */
export const PATH_MODULE_MAP: Record<string, ModuleKey> = {
  reports: 'reports',
  publications: 'content',
  news: 'content',
  events: 'content',
  tags: 'content',
  vacancies: 'careers',
  tenders: 'careers',
  'management-team': 'organization',
  'board-members': 'organization',
  departments: 'organization',
  'team-members': 'organization',
  offices: 'organization',
  gallery: 'media',
  videos: 'media',
  analytics: 'analytics',
  'audit-logs': 'analytics',
  newsletter: 'communications',
  'contact-submissions': 'communications'
}

function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value)
}

/**
 * Resolve the module a request path belongs to. Returns null when the path is
 * not module-gated. Tolerates a trailing query string.
 */
export function moduleForPath(path: string): ModuleKey | null {
  const segment = path.split('?')[0].split('/')[3]
  if (!segment) return null
  return PATH_MODULE_MAP[segment] ?? null
}

/**
 * Effective module list for a user. Admins implicitly get every module
 * regardless of the stored value; other roles get their (filtered) list.
 */
export function resolveUserModules(role: string, stored: string[] | null): ModuleKey[] {
  if (role === 'admin') return [...MODULE_KEYS]
  return (stored ?? []).filter(isModuleKey)
}

/**
 * Whether the authenticated user on the event may access a module.
 */
export function userHasModule(event: H3Event, module: ModuleKey): boolean {
  const user = event.context.auth?.user
  if (!user) return false
  if (user.role === 'admin') return true
  return (user.modules ?? []).includes(module)
}

/**
 * Require access to a module; throws 403 if the user lacks it.
 */
export function requireModuleAccess(event: H3Event, module: ModuleKey): void {
  if (!userHasModule(event, module)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `You don't have access to the ${module} module`
    })
  }
}
