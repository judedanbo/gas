/**
 * mysql2 returns DECIMAL columns as strings (e.g. "5.60000000") to avoid
 * float precision loss. The admin API contract (types/admin.ts) declares
 * such fields as numbers, so read paths must convert before returning —
 * spreading the raw row would silently leak the string.
 */
export function decimalToNumber(value: string | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
