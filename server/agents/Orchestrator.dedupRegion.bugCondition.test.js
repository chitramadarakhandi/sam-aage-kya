/**
 * Bug Condition Exploration Test — College List Duplication
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Duplicate College Names
 *
 * Defect 1 (duplicate names): `runMultiAgentOrchestrator`'s final `options.map`
 * builds `realistic_colleges: mappedCol.colleges.map(c => c.name)` directly from
 * `mappedCol.colleges` with no uniqueness check. Overlapping DB rows / LLM output /
 * fallback branches can produce the same institution name twice for one option.
 *
 * NOTE: the former Defect 2 in this file (a low-budget silent "NIT Patna"
 * region swap) has been REMOVED from the codebase entirely — college-name
 * substitution must never override real fallback data with a fixed
 * placeholder institution. See Orchestrator.dedupRegion.preservation.test.js
 * for the property asserting "NIT Patna" never appears in any output.
 *
 * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug
 * exists. DO NOT fix the test or the code when it fails.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { dedupCollegesByName } from './Orchestrator.js'

// ─── Bug Condition Tests ────────────────────────────────────────────────────────

describe('Bug Condition Exploration: College List Dedup', () => {
  /**
   * Test 1 — Duplicate college names.
   * Builds a synthetic `mappedCol.colleges` array (same shape produced by
   * runCollegeRecommendationAgent's DB-retrieved-colleges branch) containing
   * the same institution name twice, then drives it through the projection
   * `runMultiAgentOrchestrator`'s final `options.map` uses:
   *   dedupCollegesByName(mappedCol.colleges).map(c => c.name)
   * Expected (fixed): "AIIMS New Delhi" appears exactly once.
   * Actual (unfixed, before dedupCollegesByName existed): appeared twice.
   *
   * NOTE: originally this test inlined the raw (buggy) projection
   * `mappedCol.colleges.map(c => c.name)`, which could never observe a fix
   * implemented inside `runMultiAgentOrchestrator` since this file only
   * imports `runCollegeRecommendationAgent`. It now imports and calls the
   * real `dedupCollegesByName` helper so it actually exercises the fix.
   */
  test('Property 1 (duplicate names): realistic_colleges should contain "AIIMS New Delhi" only once', () => {
    const mappedCol = {
      path_id: 'bsc_biotech',
      path: 'B.Sc Biotechnology',
      colleges: [
        {
          name: 'AIIMS New Delhi',
          city: 'Delhi',
          state: 'Delhi',
          feeRange: '₹50,000–₹1,15,000/yr',
          admissionMode: 'NEET-UG',
          whyFit: 'Directly matches academic stream and falls within preferred budget thresholds.',
        },
        {
          name: 'AIIMS New Delhi',
          city: 'Delhi',
          state: 'Delhi',
          feeRange: '₹50,000–₹1,15,000/yr',
          admissionMode: 'NEET-UG',
          whyFit: 'Directly matches academic stream and falls within preferred budget thresholds.',
        },
      ],
    }

    // This is the EXACT projection used in runMultiAgentOrchestrator's final
    // options.map (post-fix): dedup mappedCol.colleges by name first, then map
    // to names — `dedupCollegesByName(mappedCol.colleges).map(c => c.name)`.
    const realisticColleges = mappedCol ? dedupCollegesByName(mappedCol.colleges).map(c => c.name) : []

    const occurrences = realisticColleges.filter(name => name === 'AIIMS New Delhi').length

    assert.equal(
      occurrences,
      1,
      `Expected "AIIMS New Delhi" to appear once in realistic_colleges, but it appeared ${occurrences} times: ${JSON.stringify(realisticColleges)}`
    )
  })
})
