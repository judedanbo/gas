import { describe, it, expect } from 'vitest'
import { resolveStatValue, transformSiteStat } from '../../../../server/utils/transformSiteStats'

/**
 * The resolved-value rule is the single source of truth for the
 * "manual override on every figure" requirement:
 *   useApi = source === 'hr_api' && !overrideEnabled && apiValue != null
 *   value  = useApi ? apiValue : manualValue
 */
describe('resolveStatValue', () => {
  it('uses manualValue for manual-source stats', () => {
    expect(
      resolveStatValue({
        source: 'manual',
        overrideEnabled: false,
        apiValue: 9999,
        manualValue: 42
      })
    ).toBe(42)
  })

  it('uses apiValue for hr_api stats when populated and not overridden', () => {
    expect(
      resolveStatValue({
        source: 'hr_api',
        overrideEnabled: false,
        apiValue: 2310,
        manualValue: 2295
      })
    ).toBe(2310)
  })

  it('uses manualValue for hr_api stats when the override is enabled', () => {
    expect(
      resolveStatValue({
        source: 'hr_api',
        overrideEnabled: true,
        apiValue: 2310,
        manualValue: 2295
      })
    ).toBe(2295)
  })

  it('falls back to manualValue for hr_api stats when apiValue is null', () => {
    expect(
      resolveStatValue({
        source: 'hr_api',
        overrideEnabled: false,
        apiValue: null,
        manualValue: 2295
      })
    ).toBe(2295)
  })
})

describe('transformSiteStat', () => {
  const base = {
    id: 1,
    section: 'home' as const,
    statKey: 'home_staff_members',
    label: 'Staff Members',
    suffix: null,
    icon: null,
    displayOrder: 1,
    source: 'hr_api' as const,
    hrMetricKey: 'staff_total',
    manualValue: 2295,
    apiValue: 2310,
    overrideEnabled: false,
    apiSyncedAt: null,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }

  it('coerces a null suffix to an empty string (HomeStatsCounter requires a string)', () => {
    expect(transformSiteStat(base).suffix).toBe('')
  })

  it('maps a null icon to undefined', () => {
    expect(transformSiteStat(base).icon).toBeUndefined()
  })

  it('resolves the displayed value via the resolved-value rule', () => {
    expect(transformSiteStat(base).value).toBe(2310)
    expect(transformSiteStat({ ...base, overrideEnabled: true }).value).toBe(2295)
  })

  it('passes through section, statKey and label', () => {
    const dto = transformSiteStat(base)
    expect(dto.section).toBe('home')
    expect(dto.statKey).toBe('home_staff_members')
    expect(dto.label).toBe('Staff Members')
  })
})
