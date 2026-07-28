import type { SiteStat, SiteStatSection } from '~/types'

interface DbSiteStat {
  id: number
  section: SiteStatSection
  statKey: string
  label: string
  suffix: string | null
  icon: string | null
  displayOrder: number
  source: 'manual' | 'hr_api'
  hrMetricKey: string | null
  manualValue: number
  apiValue: number | null
  overrideEnabled: boolean
  apiSyncedAt: Date | string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Resolve the value a stat should display.
 *
 * HR-backed figures use the live API value, unless the admin has enabled a
 * manual override or the API hasn't populated a value yet. Manual figures
 * always use their manual value. This is the single source of truth for the
 * "manual override for every figure" requirement.
 */
export function resolveStatValue(stat: {
  source: 'manual' | 'hr_api'
  overrideEnabled: boolean
  apiValue: number | null
  manualValue: number
}): number {
  const useApi = stat.source === 'hr_api' && !stat.overrideEnabled && stat.apiValue != null
  return useApi ? (stat.apiValue as number) : stat.manualValue
}

/** Transform a database site stat row to public API format. */
export function transformSiteStat(stat: DbSiteStat): SiteStat {
  return {
    section: stat.section,
    statKey: stat.statKey,
    icon: stat.icon || undefined,
    value: resolveStatValue(stat),
    label: stat.label,
    // HomeStatsCounter requires a string suffix; coerce null to ''.
    suffix: stat.suffix || ''
  }
}

/** Transform an array of database site stats to public API format. */
export function transformSiteStats(stats: DbSiteStat[]): SiteStat[] {
  return stats.map((stat) => transformSiteStat(stat))
}
