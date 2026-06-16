/**
 * Heuristics for spotting secrets left at their shipped example/placeholder
 * values (or that are implausibly short). Used by the startup config validator
 * to warn in production. Pure — no Nitro/runtime deps — so it's unit-testable.
 */

// Substrings that appear in the placeholders shipped across .env.example /
// .env.docker / docker-compose.yml.
const PLACEHOLDER_PATTERN = /change[-_ ]?(this|me)|generate-a|your-|secret-here|example|placeholder/i

/**
 * True when `value` is set but looks like an unedited placeholder or is shorter
 * than `minLength`. Returns false for unset/empty (callers report that
 * separately).
 */
export function looksLikePlaceholderSecret(value: string | undefined, minLength = 16): boolean {
  if (!value) return false
  if (value.length < minLength) return true
  return PLACEHOLDER_PATTERN.test(value)
}
