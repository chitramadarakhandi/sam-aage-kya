/**
 * Guards the frontend college enrichment lookup (src/data/collegeEnrichment.js,
 * used by src/components/CollegeDetailCard.jsx).
 *
 * The old lookup matched on `normalized.split(' ')[0]`, so any college sharing a
 * first word with a dictionary key inherited that key's fees/cutoffs/placements
 * ("NIT Patna" showed NIT Trichy's numbers). Lookups are now exact-match only:
 * a miss must return null, never another institution's data.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import {
  COLLEGE_ENRICHMENT,
  findEnrichment,
  normalizeCollegeKey,
} from '../src/data/collegeEnrichment.js'

test('dictionary is keyed by full institution names the app actually produces', () => {
  // Real `name` strings from server/seed.js and the Orchestrator fallback lists.
  for (const realName of [
    'RV College of Engineering',
    'BMS College of Engineering',
    'MS Ramaiah Institute of Technology',
    'NIT Trichy',
    'IIT Bombay',
    'AIIMS New Delhi',
    'BITS Pilani',
    'National Law School of India University',
  ]) {
    assert.ok(COLLEGE_ENRICHMENT[realName], `${realName} should be a dictionary key`)
    assert.equal(findEnrichment(realName).fullName.length > 0, true)
  }
})

test('NIT Patna no longer inherits NIT Trichy data', () => {
  const trichy = findEnrichment('NIT Trichy')
  const patna = findEnrichment('NIT Patna')

  assert.ok(trichy, 'NIT Trichy has a curated entry')
  assert.equal(patna, null, 'NIT Patna has no curated entry, so it must return null')
  // Belt and braces: whatever comes back must not be Trichy's numbers.
  assert.notDeepEqual(patna?.fees, trichy.fees)
  assert.notDeepEqual(patna?.cutoffs, trichy.cutoffs)
  assert.notDeepEqual(patna?.placements, trichy.placements)
})

test('"Shri" colliding colleges never return each other\'s data', () => {
  const srcc = findEnrichment('Shri Ram College of Commerce')
  const lsr = findEnrichment('Lady Shri Ram College')

  // Neither has a curated entry today — the safe answer is null for both.
  assert.equal(srcc, null)
  assert.equal(lsr, null)
})

test('other same-prefix institutions do not inherit the flagship entry', () => {
  const iitBombay = findEnrichment('IIT Bombay')
  const aiimsDelhi = findEnrichment('AIIMS New Delhi')
  const bitsPilani = findEnrichment('BITS Pilani')
  const msrit = findEnrichment('MS Ramaiah Institute of Technology')

  for (const [name, flagship] of [
    ['IIT Delhi', iitBombay],
    ['IIT Madras', iitBombay],
    ['AIIMS Mumbai', aiimsDelhi],
    ['BITS Hyderabad', bitsPilani],
    ['MS Ramaiah Medical College', msrit],
  ]) {
    const hit = findEnrichment(name)
    assert.equal(hit, null, `${name} must not resolve to another institution`)
    assert.notDeepEqual(hit?.fees, flagship.fees)
    assert.notDeepEqual(hit?.placements, flagship.placements)
  }
})

test('lookup is normalized (trim + case) and alias-aware', () => {
  const rv = findEnrichment('RV College of Engineering')
  assert.deepEqual(findEnrichment('  rv college of engineering  '), rv)
  assert.deepEqual(findEnrichment('RVCE'), rv)
  assert.deepEqual(findEnrichment('National Institute of Technology Tiruchirappalli'), findEnrichment('NIT Trichy'))
  assert.equal(findEnrichment(''), null)
  assert.equal(findEnrichment(null), null)
  assert.equal(findEnrichment(undefined), null)
})

/**
 * Property: a lookup never returns an entry belonging to a different key —
 * either the normalized name maps to that exact key (or one of its aliases), or
 * the result is null.
 *
 * **Validates: Requirements 1.1**
 */
test('property: enrichment lookups are exact or null, never cross-matched', () => {
  const keys = Object.keys(COLLEGE_ENRICHMENT)
  const wordArb = fc.constantFrom('NIT', 'IIT', 'AIIMS', 'BITS', 'Shri', 'Ram', 'College', 'of', 'Engineering', 'Patna', 'Delhi', 'MS')
  const nameArb = fc.oneof(
    fc.constantFrom(...keys),
    fc.array(wordArb, { minLength: 1, maxLength: 4 }).map(ws => ws.join(' '))
  )

  fc.assert(
    fc.property(nameArb, (name) => {
      const hit = findEnrichment(name)
      if (hit === null) return true
      const normalized = normalizeCollegeKey(name)
      // A hit is only legal when the normalized name is itself a registered key
      // (or alias) resolving to that very entry.
      return findEnrichment(normalized) === hit
    }),
    { numRuns: 500 }
  )
})
