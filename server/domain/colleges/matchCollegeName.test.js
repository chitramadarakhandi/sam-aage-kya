/**
 * Guards /api/college-details against cross-institution data leakage.
 *
 * The endpoint used to query `.ilike('name', '%' + name.split(' ')[0] + '%')`
 * and return `data[0]`, so any two institutions sharing a first word could be
 * served each other's fees/cutoffs/placements ("Shri Ram College of Commerce" vs
 * "Lady Shri Ram College", "NIT Trichy" vs "NIT Patna").
 *
 * server/index.js calls app.listen() at import time so it cannot be imported
 * here; the selection rules live in the pure helper below, and the route wiring
 * is asserted against the source text (same technique as roadmapMockShape.test.js).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fc from 'fast-check'
import { normalizeCollegeName, escapeIlikePattern, pickCollegeMatch } from './matchCollegeName.js'

// Real rows from server/seed.js (names verbatim) that collide on their first word.
const ROWS = [
  { name: 'Shri Ram College of Commerce', city: 'Delhi', state: 'Delhi', yearly_cost_min: 58000, yearly_cost_max: 108000 },
  { name: 'Lady Shri Ram College', city: 'Delhi', state: 'Delhi', yearly_cost_min: 52000, yearly_cost_max: 102000 },
  { name: 'NIT Trichy', city: 'Tiruchirappalli', state: 'Tamil Nadu', yearly_cost_min: 145000, yearly_cost_max: 220000 },
  { name: 'NIT Patna', city: 'Patna', state: 'Bihar', yearly_cost_min: 118000, yearly_cost_max: 180000 },
  { name: 'RV College of Engineering', city: 'Bangalore', state: 'Karnataka', yearly_cost_min: 140000, yearly_cost_max: 225000 },
  { name: 'BMS College of Engineering', city: 'Bangalore', state: 'Karnataka', yearly_cost_min: 125000, yearly_cost_max: 215000 },
]

test('colliding first words each resolve to their OWN row', () => {
  const srcc = pickCollegeMatch(ROWS, 'Shri Ram College of Commerce')
  const lsr = pickCollegeMatch(ROWS, 'Lady Shri Ram College')
  assert.equal(srcc.name, 'Shri Ram College of Commerce')
  assert.equal(lsr.name, 'Lady Shri Ram College')
  // The wrong institution's cost figures must never be served.
  assert.notEqual(srcc.yearly_cost_min, lsr.yearly_cost_min)
  assert.equal(srcc.state, 'Delhi')
  assert.equal(lsr.city, 'Delhi')

  const trichy = pickCollegeMatch(ROWS, 'NIT Trichy')
  const patna = pickCollegeMatch(ROWS, 'NIT Patna')
  assert.equal(trichy.name, 'NIT Trichy')
  assert.equal(patna.name, 'NIT Patna')
  assert.equal(patna.state, 'Bihar')
  assert.notEqual(patna.yearly_cost_max, trichy.yearly_cost_max)

  const rv = pickCollegeMatch(ROWS, 'RV College of Engineering')
  assert.equal(rv.name, 'RV College of Engineering')
  assert.notEqual(rv.name, 'BMS College of Engineering')
})

test('a first-word-only query is not a match', () => {
  // "%Shri%" / "%NIT%" style hits are ambiguous — no row may be returned.
  assert.equal(pickCollegeMatch(ROWS, 'Shri'), null)
  assert.equal(pickCollegeMatch(ROWS, 'NIT'), null)
  assert.equal(pickCollegeMatch(ROWS, 'College'), null)
})

test('normalized exact match tolerates casing and padding only', () => {
  assert.equal(pickCollegeMatch(ROWS, '  nit  patna ').name, 'NIT Patna')
  assert.equal(pickCollegeMatch(ROWS, 'SHRI RAM COLLEGE OF COMMERCE').name, 'Shri Ram College of Commerce')
})

test('unknown institution yields no match (caller falls through to AI path)', () => {
  assert.equal(pickCollegeMatch(ROWS, 'Some Unlisted College of Nowhere'), null)
  assert.equal(pickCollegeMatch([], 'NIT Patna'), null)
  assert.equal(pickCollegeMatch(null, 'NIT Patna'), null)
  assert.equal(pickCollegeMatch(ROWS, ''), null)
})

test('full-name containment resolves a longer official name, when unambiguous', () => {
  const rows = [{ name: 'National Institute of Technology Patna (NIT Patna)' }]
  assert.equal(pickCollegeMatch(rows, 'NIT Patna').name, 'National Institute of Technology Patna (NIT Patna)')
})

test('ilike wildcards in the requested name are escaped', () => {
  assert.equal(escapeIlikePattern('NIT%'), 'NIT\\%')
  assert.equal(escapeIlikePattern('a_b'), 'a\\_b')
  assert.equal(normalizeCollegeName('  NIT   Patna '), 'nit patna')
})

/**
 * Property: a returned row is always a genuine full-name match — its name either
 * equals the requested name or fully contains it (never a first-word overlap).
 *
 * **Validates: Requirements 1.1**
 */
test('property: any returned row is a full-name match for the request', () => {
  const nameArb = fc.constantFrom(...ROWS.map(r => r.name), 'Shri', 'NIT', 'College of Engineering', 'Unknown College')
  fc.assert(
    fc.property(nameArb, fc.uniqueArray(fc.constantFrom(...ROWS), { minLength: 0, maxLength: ROWS.length }), (requested, rows) => {
      const match = pickCollegeMatch(rows, requested)
      if (match === null) return true
      const rowName = normalizeCollegeName(match.name)
      const req = normalizeCollegeName(requested)
      return rowName === req || rowName.includes(req)
    }),
    { numRuns: 300 }
  )
})

test('/api/college-details uses the full-name matcher, not the first word', () => {
  const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.js')
  const source = readFileSync(indexPath, 'utf8')

  const routeStart = source.indexOf("app.get('/api/college-details'")
  assert.notEqual(routeStart, -1, '/api/college-details route not found')
  const routeEnd = source.indexOf("app.get('/api/course-feedback'", routeStart)
  const route = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd)

  assert.ok(!route.includes("name.split(' ')[0]"), 'route must not match on the first word of the name')
  assert.ok(route.includes('pickCollegeMatch('), 'route should resolve rows through pickCollegeMatch')
  assert.ok(route.includes(".ilike('name', pattern)"), 'route should try a wildcard-free (exact) ilike first')
  assert.ok(route.includes('`%${pattern}%`'), 'fallback tier should use the whole name as the pattern')
  assert.ok(route.includes("name.length < 2"), 'the short-name guard must be preserved')
  assert.ok(route.includes("error: 'BAD_REQUEST'"), 'the 400 response must be preserved')
  assert.ok(route.includes("source: 'database'"), 'the database response shape must be preserved')
  assert.ok(
    route.includes('Do not estimate, generalize, or reuse figures from other institutions'),
    'the AI fallback prompt must forbid reusing other institutions\' figures'
  )
})
