/**
 * matchCollegeName.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure helpers for resolving a requested college name to a `colleges` row.
 *
 * /api/college-details used to query `.ilike('name', '%' + name.split(' ')[0] + '%')`
 * and trust the first row. Any two institutions sharing a first word collided:
 * "Shri Ram College of Commerce" could return "Lady Shri Ram College"'s fees,
 * every "NIT <city>" could return another NIT's cutoffs. The matcher below only
 * ever accepts a row that matches the FULL requested name:
 *
 *   Tier 1 — normalized exact match on the whole name.
 *   Tier 2 — the whole requested name appears inside exactly one row's name.
 *            (Ambiguous → no match, so the caller falls through to the AI path
 *            instead of presenting another institution's data as authoritative.)
 *
 * No I/O here, so the selection rules are unit-testable without Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** trim + collapse inner whitespace + case-fold, for comparison only. */
export function normalizeCollegeName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Escapes PostgREST `ilike` wildcards so a user-supplied name is matched
 * literally (a name containing `%` must not turn into a match-everything query).
 */
export function escapeIlikePattern(value) {
  return String(value ?? '').replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/**
 * Picks the row that genuinely corresponds to `requestedName`, or null.
 * Never falls back to a partial/first-word hit.
 */
export function pickCollegeMatch(rows, requestedName) {
  const requested = normalizeCollegeName(requestedName)
  if (!requested) return null

  const list = (Array.isArray(rows) ? rows : []).filter(r => r && normalizeCollegeName(r.name))

  // Tier 1: normalized exact match on the full name.
  const exact = list.find(r => normalizeCollegeName(r.name) === requested)
  if (exact) return exact

  // Tier 2: the full requested name is contained in the row's name — accepted
  // only when a single row qualifies, otherwise it is ambiguous.
  const contained = list.filter(r => normalizeCollegeName(r.name).includes(requested))
  return contained.length === 1 ? contained[0] : null
}
