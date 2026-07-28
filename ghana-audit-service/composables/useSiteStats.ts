import type { SiteStat, SiteStatSection } from '~/types'

/**
 * Fallback figures mirroring the values that were previously hardcoded in the
 * pages. Returned when the API is empty or unreachable so the stat displays
 * never render blank (e.g. before the site_stats table is seeded).
 */
const FALLBACK_STATS: Record<SiteStatSection, SiteStat[]> = {
  home: [
    {
      section: 'home',
      statKey: 'home_years_of_service',
      value: 115,
      label: 'Years of Service',
      suffix: '+'
    },
    {
      section: 'home',
      statKey: 'home_staff_members',
      value: 2295,
      label: 'Staff Members',
      suffix: ''
    },
    {
      section: 'home',
      statKey: 'home_regions_covered',
      value: 16,
      label: 'Regions Covered',
      suffix: ''
    },
    {
      section: 'home',
      statKey: 'home_districts_nationwide',
      value: 95,
      label: 'Districts Nationwide',
      suffix: ''
    }
  ],
  about_service: [
    {
      section: 'about_service',
      statKey: 'service_ministries',
      icon: 'heroicons:building-library',
      value: 35,
      label: 'Ministries',
      suffix: '+'
    },
    {
      section: 'about_service',
      statKey: 'service_departments_agencies',
      icon: 'heroicons:building-office',
      value: 200,
      label: 'Departments & Agencies',
      suffix: '+'
    },
    {
      section: 'about_service',
      statKey: 'service_mmdas',
      icon: 'heroicons:building-office',
      value: 261,
      label: 'MMDAs',
      suffix: ''
    },
    {
      section: 'about_service',
      statKey: 'service_public_institutions',
      icon: 'heroicons:building-library',
      value: 100,
      label: 'Public Institutions',
      suffix: '+'
    }
  ],
  about_legacy: [
    {
      section: 'about_legacy',
      statKey: 'legacy_years_of_service',
      icon: 'heroicons:document',
      value: 115,
      label: 'Years of Service',
      suffix: '+'
    },
    {
      section: 'about_legacy',
      statKey: 'legacy_auditors_general',
      icon: 'heroicons:user',
      value: 13,
      label: 'Auditors-General',
      suffix: ''
    },
    {
      section: 'about_legacy',
      statKey: 'legacy_republics_served',
      icon: 'heroicons:flag',
      value: 4,
      label: 'Republics Served',
      suffix: ''
    }
  ]
}

/**
 * Public consumer of the editable site statistics. Fetches once (SSR-friendly,
 * edge-cached) and returns the figures for a given section.
 *
 * The hardcoded FALLBACK_STATS are used ONLY when the request genuinely fails
 * (e.g. the database is unreachable) — resilience so a transient outage doesn't
 * blank the page. A successful-but-empty response is authoritative: it means
 * the section is unseeded or the admin has deactivated every figure, so we
 * render nothing rather than resurfacing stale numbers the admin can't control.
 */
export function useSiteStats(section: SiteStatSection) {
  const { data, pending, error } = useFetch<SiteStat[]>('/api/site-stats', {
    key: 'site-stats',
    default: () => []
  })

  const stats = computed<SiteStat[]>(() => {
    if (error.value) return FALLBACK_STATS[section]
    return (data.value ?? []).filter((s) => s.section === section)
  })

  return { stats, pending }
}
