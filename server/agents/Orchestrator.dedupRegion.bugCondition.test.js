/**
 * Bug Condition Exploration Test — College List Duplication & Silent Region Swap
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Duplicate College Names & Silent Region Swap
 *
 * Defect 1 (duplicate names): `runMultiAgentOrchestrator`'s final `options.map`
 * builds `realistic_colleges: mappedCol.colleges.map(c => c.name)` directly from
 * `mappedCol.colleges` with no uniqueness check. Overlapping DB rows / LLM output /
 * fallback branches can produce the same institution name twice for one option.
 *
 * Defect 2 (silent region swap): inside `runCollegeRecommendationAgent`, the
 * low-budget branch (`budget === 'below_20k' || budget === 'below_1L'`)
 * unconditionally rewrites "RV College of Engineering" / "PES University" to
 * "NIT Patna" regardless of whether the student's preferred region already
 * matches an in-region fallback college, and never discloses the substitution
 * in `whyFit`.
 *
 * This test is EXPECTED TO FAIL on unfixed code — failure confirms both bugs
 * exist. DO NOT fix the test or the code when it fails.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { runCollegeRecommendationAgent, dedupCollegesByName } from './Orchestrator.js'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildCollegeAgentState(formOverrides, careerPathOverrides) {
  return {
    formData: {
      classLevel: 'class12',
      board: 'CBSE',
      marks: '75',
      state: 'Maharashtra',
      stream: 'Science (PCM)',
      incomeRange: '2.5L-5L',
      interests: 'technology',
      biggestFear: 'unemployment',
      preferredModeOfAdmission: '',
      preferredState: '',
      preferredCity: '',
      budget: '1L-3L',
      fullName: 'Test Student',
      ...formOverrides,
    },
    // Default engineering fallback is hit when path_id/path don't match the
    // commerce/humanities/medical keyword branches in runCollegeRecommendationAgent.
    careerPaths: {
      recommendations: [
        { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI', ...careerPathOverrides },
      ],
    },
    retrievedColleges: [],
  }
}

// ─── Bug Condition Tests ────────────────────────────────────────────────────────

describe('Bug Condition Exploration: College List Dedup & Region Swap', () => {
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

  /**
   * Test 2 — In-region low-budget student should NOT be swapped to NIT Patna.
   * Student's preferredState/preferredCity is Karnataka/Bangalore — the SAME
   * region as the default engineering fallback (RV College / PES University,
   * both Bangalore, Karnataka). Expected (fixed): fallback stays as-is since
   * it's already in-region. Actual (unfixed): unconditionally swapped to NIT Patna.
   */
  test('Property 1 (in-region low-budget): should keep RV College/PES University, NOT swap to NIT Patna', async () => {
    const state = buildCollegeAgentState({
      budget: 'below_20k',
      preferredState: 'Karnataka',
      preferredCity: 'Bangalore',
    })

    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]
    const names = mapping.colleges.map(c => c.name)

    assert.ok(
      names.includes('RV College of Engineering') || names.includes('PES University'),
      `In-region Karnataka low-budget student should still see RV College of Engineering / PES University but got: ${JSON.stringify(names)}`
    )
    assert.ok(
      !names.includes('NIT Patna'),
      `In-region Karnataka low-budget student should NOT be swapped to NIT Patna but got: ${JSON.stringify(names)}`
    )
  })

  /**
   * Test 3 — Out-of-region low-budget substitution must disclose the reason.
   * Student's preferredState is Kerala (no in-region match in the fallback
   * data), so the NIT Patna substitution is expected to occur — but the
   * substituted entry's `whyFit` must explicitly disclose the region-based
   * reasoning, not the generic sentence.
   */
  test('Property 1 (out-of-region low-budget disclosure): NIT Patna whyFit should disclose region substitution reasoning', async () => {
    const state = buildCollegeAgentState({
      budget: 'below_1L',
      preferredState: 'Kerala',
      preferredCity: '',
    })

    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]
    const nitPatna = mapping.colleges.find(c => c.name === 'NIT Patna')

    assert.ok(nitPatna, `Expected NIT Patna to be present in the out-of-region substitution but got: ${JSON.stringify(mapping.colleges.map(c => c.name))}`)

    const whyFitLower = (nitPatna.whyFit || '').toLowerCase()

    assert.notEqual(
      nitPatna.whyFit,
      'National Institute offering quality engineering education at subsidized fees.',
      `whyFit should NOT be the generic non-disclosing sentence but got: "${nitPatna.whyFit}"`
    )
    assert.ok(
      whyFitLower.includes('region') && whyFitLower.includes('patna'),
      `whyFit should explicitly disclose the region-based substitution reasoning (mention "region" and "Patna") but got: "${nitPatna.whyFit}"`
    )
  })
})
