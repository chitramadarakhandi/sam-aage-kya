/**
 * location.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared display helpers for city / state / type lines.
 *
 * Union territories (Delhi, Chandigarh, Puducherry) store the same value in
 * `city` and `state`, so a naive `[city, state, type].join(' · ')` renders
 * "Delhi · Delhi · central". These helpers collapse values that are equal after
 * trim + case-folding so each distinct value is shown exactly once.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Trims, drops empties, and removes case-insensitive duplicates while keeping
 * the first occurrence (and its original casing) in order.
 */
export function dedupeLocationParts(parts) {
  const seen = new Set()
  const result = []
  for (const raw of parts || []) {
    if (raw === null || raw === undefined) continue
    const value = String(raw).trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

/**
 * Joins city / state / type (or any subset) for display, collapsing duplicates.
 * `formatLocation(['Delhi', 'Delhi', 'central'])` → `"Delhi · central"`.
 */
export function formatLocation(parts, separator = ' · ') {
  return dedupeLocationParts(parts).join(separator)
}

/**
 * "City, State" for list rows — a union territory renders as just "Delhi".
 */
export function formatCityState(city, state) {
  return dedupeLocationParts([city, state]).join(', ')
}
