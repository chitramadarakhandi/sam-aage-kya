/**
 * Preservation Property Tests — College List Dedup & Region-Swap Fix
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2 (design.md) / Property 4 (design.md correctness properties):
 * Preservation - Non-Duplicate Lists, Non-Low-Budget, In-Region, and
 * DB-Retrieved Paths Unchanged.
 *
 * Methodology: Observation-first — we first observe what the UNFIXED code
 * returns for each of the four preservation scenarios described in
 * tasks.md step 2, then encode those observations as example-based and
 * property-based assertions. These tests MUST PASS on unfixed code, and
 * must continue to pass after the fix (task 3) is implemented (verified in
 * task 3.4).
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { runCollegeRecommendationAgent } from './Orchestrator.js'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildCollegeAgentState(formOverrides, careerPathOverrides, retrievedColleges = []) {
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
    careerPaths: {
      recommendations: [
        { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI', ...careerPathOverrides },
      ],
    },
    retrievedColleges,
  }
}

/**
 * Reference implementation of the dedup algorithm proposed in design.md
 * ("Function 1" changes). Used ONLY to compute what a deduped projection
 * WOULD be, so we can assert that for unique-name lists it is a no-op —
 * this is the exact preservation guarantee Property 3/4 requires without
 * depending on the fix having been implemented yet.
 */
function dedupCollegesByName(colleges) {
  const seen = new Set()
  const result = []
  for (const c of colleges || []) {
    const key = (c.name || '').trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(c)
  }
  return result
}

// Non-low budgets used across the class10/class12 forms (anything other than
// 'below_20k' / 'below_1L', which are the only two low-budget triggers checked
// by the current low-budget branch in runCollegeRecommendationAgent).
const NON_LOW_BUDGETS = ['1L-3L', '3L-6L', '20k-60k', '60k-1.5L', 'above_1.5L']

// ─── Observation anchors (example-based) ───────────────────────────────────────

describe('Preservation Observation: baseline behaviors on unfixed code', () => {
  /**
   * Observation 1 — a career option's mappedCol.colleges with unique names
   * (default humanities fallback) projects to realistic_colleges unchanged,
   * same names/order.
   */
  test('Observation 1: default humanities fallback has unique names and projects unchanged', async () => {
    const state = buildCollegeAgentState(
      {},
      { path_id: 'arts_humanities', path: 'Arts / Humanities' }
    )
    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]
    const names = mapping.colleges.map(c => c.name)

    assert.deepStrictEqual(
      names,
      ["Lady Shri Ram College", "St. Xavier's College Mumbai"],
      `Expected unchanged unique humanities fallback names but got: ${JSON.stringify(names)}`
    )

    // The exact projection runMultiAgentOrchestrator's final options.map uses
    // today: mappedCol.colleges.map(c => c.name). Deduping a list with no
    // duplicates must be a no-op.
    const rawProjection = mapping.colleges.map(c => c.name)
    const dedupedProjection = dedupCollegesByName(mapping.colleges).map(c => c.name)
    assert.deepStrictEqual(dedupedProjection, rawProjection)
  })

  /**
   * Observation 2 — non-low budget with retrievedColleges: [] returns the
   * untouched default engineering fallback, no substitution logic runs.
   */
  test('Observation 2: non-low budget returns untouched RV College/PES University fallback', async () => {
    const state = buildCollegeAgentState({ budget: '1L-3L' })
    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]

    assert.deepStrictEqual(
      mapping.colleges.map(c => c.name),
      ['RV College of Engineering', 'PES University']
    )
    assert.equal(
      mapping.colleges[0].whyFit,
      'Top-tier college offering excellent tech exposure and placements.'
    )
    assert.equal(
      mapping.colleges[1].whyFit,
      'Premium infrastructure and direct corporate recruiter partnerships.'
    )
  })

  /**
   * Observation 4 — retrievedColleges.length > 0 (any budget) returns colleges
   * sourced solely from retrievedColleges.slice(0, 3), unaffected by budget or
   * region.
   */
  test('Observation 4: retrievedColleges present sources output solely from retrievedColleges.slice(0, 3)', async () => {
    const retrieved = [
      { name: 'College A', city: 'Pune', state: 'Maharashtra', yearly_cost_min: 100000, yearly_cost_max: 200000 },
      { name: 'College B', city: 'Nagpur', state: 'Maharashtra', yearly_cost_min: 90000, yearly_cost_max: 180000 },
      { name: 'College C', city: 'Nashik', state: 'Maharashtra', yearly_cost_min: 80000, yearly_cost_max: 150000 },
      { name: 'College D', city: 'Thane', state: 'Maharashtra', yearly_cost_min: 70000, yearly_cost_max: 140000 },
    ]
    const state = buildCollegeAgentState(
      { budget: 'below_20k', preferredState: 'Kerala', preferredCity: '' },
      {},
      retrieved
    )
    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]

    assert.deepStrictEqual(
      mapping.colleges.map(c => c.name),
      ['College A', 'College B', 'College C']
    )
    // No trace of the fallback/region-swap logic — never "NIT Patna", never RV/PES.
    const names = mapping.colleges.map(c => c.name)
    assert.ok(!names.includes('NIT Patna'))
    assert.ok(!names.includes('RV College of Engineering'))
    assert.ok(!names.includes('PES University'))
  })
})

// ─── Property-Based Preservation Tests ──────────────────────────────────────────

describe('Preservation Property: Dedup & Region-Swap Fix', () => {
  /**
   * Property (task 2, bullet 1): for all career options whose college list
   * already contains only unique institution names, the deduped
   * realistic_colleges projection equals the pre-dedup projection (same
   * names, same order). Generated with varying length and casing.
   *
   * **Validates: Requirement 3.1**
   */
  test('Property: dedup is a no-op for college lists with unique names', () => {
    const uniqueCollegeArb = fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        city: fc.string({ minLength: 1, maxLength: 15 }),
        state: fc.string({ minLength: 1, maxLength: 15 }),
        feeRange: fc.string({ minLength: 1, maxLength: 15 }),
        admissionMode: fc.string({ minLength: 1, maxLength: 15 }),
        whyFit: fc.string({ minLength: 1, maxLength: 40 }),
      }),
      { minLength: 0, maxLength: 10 }
    ).filter(colleges => {
      // Ensure uniqueness under the SAME normalization dedupCollegesByName uses
      // (trim + lowercase), otherwise near-duplicates would legitimately collapse.
      const keys = colleges.map(c => (c.name || '').trim().toLowerCase())
      return new Set(keys).size === keys.length
    })

    fc.assert(
      fc.property(uniqueCollegeArb, (colleges) => {
        // The EXACT projection runMultiAgentOrchestrator's final options.map
        // uses today: mappedCol.colleges.map(c => c.name).
        const rawProjection = colleges.map(c => c.name)
        const dedupedProjection = dedupCollegesByName(colleges).map(c => c.name)

        assert.deepStrictEqual(dedupedProjection, rawProjection)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property (task 2, bullet 2, clause A): for all inputs where budget is
   * NOT below_20k/below_1L, runCollegeRecommendationAgent's output colleges
   * and whyFit text are identical regardless of preferredState/preferredCity.
   *
   * **Validates: Requirement 3.2**
   */
  test('Property: non-low-budget output is region-invariant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          budget: fc.constantFrom(...NON_LOW_BUDGETS),
          preferredStateA: fc.constantFrom('', 'Karnataka', 'Kerala', 'Maharashtra', 'Any State'),
          preferredCityA: fc.constantFrom('', 'Bangalore', 'Kochi', 'Pune'),
          preferredStateB: fc.constantFrom('', 'Karnataka', 'Kerala', 'Maharashtra', 'Any State'),
          preferredCityB: fc.constantFrom('', 'Bangalore', 'Kochi', 'Pune'),
        }),
        async ({ budget, preferredStateA, preferredCityA, preferredStateB, preferredCityB }) => {
          const stateA = buildCollegeAgentState({ budget, preferredState: preferredStateA, preferredCity: preferredCityA })
          const stateB = buildCollegeAgentState({ budget, preferredState: preferredStateB, preferredCity: preferredCityB })

          const resultA = await runCollegeRecommendationAgent(stateA)
          const resultB = await runCollegeRecommendationAgent(stateB)

          assert.deepStrictEqual(
            resultA.mappings[0].colleges,
            resultB.mappings[0].colleges,
            `Non-low-budget (${budget}) output must be region-invariant but differed between ` +
            `(${preferredStateA}/${preferredCityA}) and (${preferredStateB}/${preferredCityB})`
          )
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property (task 2, bullet 2, clause B): for all inputs where
   * retrievedColleges.length > 0 (any budget, including low budgets),
   * output colleges and whyFit text are identical regardless of
   * preferredState/preferredCity.
   *
   * **Validates: Requirement 3.4**
   */
  test('Property: DB-retrieved-colleges output is region-invariant regardless of budget', async () => {
    const retrievedCollegeArb = fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        city: fc.constantFrom('Pune', 'Nagpur', 'Nashik', 'Thane'),
        state: fc.constant('Maharashtra'),
        yearly_cost_min: fc.integer({ min: 50000, max: 150000 }),
        yearly_cost_max: fc.integer({ min: 150001, max: 300000 }),
      }),
      { minLength: 1, maxLength: 5 }
    )

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          budget: fc.constantFrom(...NON_LOW_BUDGETS, 'below_20k', 'below_1L'),
          retrievedColleges: retrievedCollegeArb,
          preferredStateA: fc.constantFrom('', 'Karnataka', 'Kerala'),
          preferredCityA: fc.constantFrom('', 'Bangalore', 'Kochi'),
          preferredStateB: fc.constantFrom('', 'Karnataka', 'Kerala'),
          preferredCityB: fc.constantFrom('', 'Bangalore', 'Kochi'),
        }),
        async ({ budget, retrievedColleges, preferredStateA, preferredCityA, preferredStateB, preferredCityB }) => {
          const stateA = buildCollegeAgentState(
            { budget, preferredState: preferredStateA, preferredCity: preferredCityA },
            {},
            retrievedColleges
          )
          const stateB = buildCollegeAgentState(
            { budget, preferredState: preferredStateB, preferredCity: preferredCityB },
            {},
            retrievedColleges
          )

          const resultA = await runCollegeRecommendationAgent(stateA)
          const resultB = await runCollegeRecommendationAgent(stateB)

          assert.deepStrictEqual(resultA.mappings[0].colleges, resultB.mappings[0].colleges)
          // Sourced solely from retrievedColleges.slice(0, 3) — never NIT Patna/RV/PES.
          const names = resultA.mappings[0].colleges.map(c => c.name)
          assert.ok(!names.includes('NIT Patna'))
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property (task 2, bullet 3 / design.md Property 4 / Requirement 3.3):
   * for low-budget inputs whose preferredState/preferredCity already matches
   * Karnataka/Bangalore/Bengaluru (case/whitespace variants), the default
   * engineering fallback names and whyFit remain "RV College of Engineering"
   * / "PES University" with their original text.
   *
   * SCOPE NOTE: this was FALSE on unfixed code — see task 1's
   * `Orchestrator.dedupRegion.bugCondition.test.js` Test 2, which documented
   * it as a bug condition (unconditional swap ignoring region) rather than
   * existing preserved behavior. Now that task 3.2's in-region check has
   * been implemented, this scenario is genuinely true, so it is added here
   * as a real preservation property per the task 3.4 instruction.
   *
   * **Validates: Requirement 3.3**
   */
  test('Property: in-region low-budget (Karnataka/Bangalore/Bengaluru variants) keeps RV College/PES University unsubstituted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          budget: fc.constantFrom('below_20k', 'below_1L'),
          preferredState: fc.constantFrom('Karnataka', 'karnataka', ' Karnataka ', 'KARNATAKA'),
          preferredCity: fc.constantFrom('', 'Bangalore', 'bangalore', 'Bengaluru', ' Bengaluru '),
        }),
        async ({ budget, preferredState, preferredCity }) => {
          const state = buildCollegeAgentState({ budget, preferredState, preferredCity })
          const result = await runCollegeRecommendationAgent(state)
          const mapping = result.mappings[0]

          assert.deepStrictEqual(
            mapping.colleges.map(c => c.name),
            ['RV College of Engineering', 'PES University'],
            `In-region low-budget student (preferredState="${preferredState}", preferredCity="${preferredCity}") ` +
            `must keep RV College of Engineering/PES University but got: ${JSON.stringify(mapping.colleges.map(c => c.name))}`
          )
          assert.equal(mapping.colleges[0].whyFit, 'Top-tier college offering excellent tech exposure and placements.')
          assert.equal(mapping.colleges[1].whyFit, 'Premium infrastructure and direct corporate recruiter partnerships.')
        }
      ),
      { numRuns: 30 }
    )
  })
})
