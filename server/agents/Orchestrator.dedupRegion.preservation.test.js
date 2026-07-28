/**
 * Preservation Property Tests — College List Dedup & No Hardcoded Substitution
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2 (design.md) / Property 4 (design.md correctness properties):
 * Preservation - Non-Duplicate Lists, Fallback-List Content, and
 * DB-Retrieved Paths Unchanged.
 *
 * UPDATE: the low-budget "NIT Patna" region-swap behavior these tests used to
 * assert (with or without a region check) has been REMOVED from the codebase.
 * College-name substitution must never override real fallback data with a
 * fixed placeholder institution, regardless of budget/region/stream. The
 * properties below now assert the fallback list passes through UNCHANGED for
 * every budget value, and that "NIT Patna" never appears in any output.
 *
 * Methodology: Observation-first — we first observe what the code returns for
 * each preservation scenario, then encode those observations as example-based
 * and property-based assertions.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { runCollegeRecommendationAgent, assembleGuidanceResponse } from './Orchestrator.js'

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
      ["Lady Shri Ram College", "St. Xavier's College Mumbai", 'Hindu College', 'Fergusson College'],
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
      ['RV College of Engineering', 'PES University', 'BMS College of Engineering', 'Dayananda Sagar College of Engineering']
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
   * Observation 2b — LOW budget (below_20k / below_1L) with no in-region
   * match also returns the untouched default engineering fallback. This is
   * the behavior that used to be substituted to "NIT Patna" — that
   * substitution has been removed entirely, so low budget must now behave
   * identically to any other budget for this fallback branch.
   */
  test('Observation 2b: low budget with no in-region match ALSO returns untouched RV College/PES University fallback (no substitution)', async () => {
    const state = buildCollegeAgentState({ budget: 'below_1L', preferredState: 'Kerala', preferredCity: '' })
    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]

    assert.deepStrictEqual(
      mapping.colleges.map(c => c.name),
      ['RV College of Engineering', 'PES University', 'BMS College of Engineering', 'Dayananda Sagar College of Engineering'],
      `Low-budget student with no in-region match must still see the unchanged fallback, ` +
      `NOT a substitution — got: ${JSON.stringify(mapping.colleges.map(c => c.name))}`
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
   * Observation 5 — class10 students get an empty colleges array for every
   * option, regardless of budget/stream, with no fallback-list computation.
   */
  test('Observation 5: class10 students get colleges: [] for every option', async () => {
    const state = buildCollegeAgentState(
      { classLevel: 'class10', budget: 'below_20k', preferredState: 'Kerala' },
      { path_id: 'science_pcm', path: 'Science (PCM)' }
    )
    const result = await runCollegeRecommendationAgent(state)
    assert.deepStrictEqual(result.mappings[0].colleges, [])
  })

  /**
   * Observation 4 — retrievedColleges.length > 0 (any budget) returns colleges
   * sourced solely from retrievedColleges.slice(0, 6), unaffected by budget or
   * region.
   */
  test('Observation 4: retrievedColleges present sources output solely from retrievedColleges.slice(0, 6)', async () => {
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
      ['College A', 'College B', 'College C', 'College D']
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
   * Property (task 2, bullet 2, clause A — updated): for ALL budget values
   * (low or not) and ALL preferredState/preferredCity combinations,
   * runCollegeRecommendationAgent's fallback-branch output colleges and
   * whyFit text are identical — i.e. completely region- and budget-invariant.
   * This supersedes the old "non-low-budget only" scoping now that the
   * NIT Patna substitution has been removed entirely: budget/region must
   * never affect which fallback colleges are returned.
   *
   * **Validates: Requirement 3.2**
   */
  test('Property: fallback-branch output is budget- and region-invariant (no substitution ever happens)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          budgetA: fc.constantFrom(...NON_LOW_BUDGETS, 'below_20k', 'below_1L'),
          budgetB: fc.constantFrom(...NON_LOW_BUDGETS, 'below_20k', 'below_1L'),
          preferredStateA: fc.constantFrom('', 'Karnataka', 'Kerala', 'Maharashtra', 'Any State'),
          preferredCityA: fc.constantFrom('', 'Bangalore', 'Kochi', 'Pune'),
          preferredStateB: fc.constantFrom('', 'Karnataka', 'Kerala', 'Maharashtra', 'Any State'),
          preferredCityB: fc.constantFrom('', 'Bangalore', 'Kochi', 'Pune'),
        }),
        async ({ budgetA, budgetB, preferredStateA, preferredCityA, preferredStateB, preferredCityB }) => {
          const stateA = buildCollegeAgentState({ budget: budgetA, preferredState: preferredStateA, preferredCity: preferredCityA })
          const stateB = buildCollegeAgentState({ budget: budgetB, preferredState: preferredStateB, preferredCity: preferredCityB })

          const resultA = await runCollegeRecommendationAgent(stateA)
          const resultB = await runCollegeRecommendationAgent(stateB)

          assert.deepStrictEqual(
            resultA.mappings[0].colleges,
            resultB.mappings[0].colleges,
            `Fallback output must be budget/region-invariant but differed between ` +
            `(budget=${budgetA}, ${preferredStateA}/${preferredCityA}) and (budget=${budgetB}, ${preferredStateB}/${preferredCityB})`
          )
          // Never any trace of a hardcoded substitution institution.
          const namesA = resultA.mappings[0].colleges.map(c => c.name)
          assert.ok(!namesA.includes('NIT Patna'), `"NIT Patna" must never appear but got: ${JSON.stringify(namesA)}`)
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
          // Sourced solely from retrievedColleges.slice(0, 6) — never NIT Patna/RV/PES.
          const names = resultA.mappings[0].colleges.map(c => c.name)
          assert.ok(!names.includes('NIT Patna'))
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property (updated per Requirement 3.3 — substitution removed entirely):
   * for ANY budget × preferredState/preferredCity combination (in-region,
   * out-of-region, or no preference at all), the default engineering
   * fallback names and whyFit remain "RV College of Engineering" /
   * "PES University" with their ORIGINAL text — "NIT Patna" never appears
   * as a possible output for any input. This sweeps budget × region
   * combinations broadly, mirroring the style of the prior in-region-only
   * property but widened to cover the full removal of the substitution.
   *
   * **Validates: Requirement 3.3**
   */
  test('Property: NIT Patna never appears for ANY budget × region combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          budget: fc.constantFrom(...NON_LOW_BUDGETS, 'below_20k', 'below_1L'),
          preferredState: fc.constantFrom('', 'Karnataka', 'karnataka', ' Karnataka ', 'Kerala', 'Bihar', 'Any State'),
          preferredCity: fc.constantFrom('', 'Bangalore', 'bangalore', 'Bengaluru', 'Kochi', 'Patna'),
        }),
        async ({ budget, preferredState, preferredCity }) => {
          const state = buildCollegeAgentState({ budget, preferredState, preferredCity })
          const result = await runCollegeRecommendationAgent(state)
          const mapping = result.mappings[0]
          const names = mapping.colleges.map(c => c.name)

          assert.deepStrictEqual(
            names,
            ['RV College of Engineering', 'PES University', 'BMS College of Engineering', 'Dayananda Sagar College of Engineering'],
            `budget="${budget}", preferredState="${preferredState}", preferredCity="${preferredCity}" ` +
            `must keep the default engineering fallback unchanged but got: ${JSON.stringify(names)}`
          )
          assert.ok(!names.includes('NIT Patna'))
          assert.equal(mapping.colleges[0].whyFit, 'Top-tier college offering excellent tech exposure and placements.')
          assert.equal(mapping.colleges[1].whyFit, 'Premium infrastructure and direct corporate recruiter partnerships.')
        }
      ),
      { numRuns: 30 }
    )
  })

  /**
   * Property — class10 gate: for ANY budget/stream/path combination, when
   * formData.classLevel === 'class10', runCollegeRecommendationAgent returns
   * colleges: [] for every option. No fallback list is ever computed, so
   * "NIT Patna" (or any other institution name) can never leak through for
   * a class10 student either.
   */
  test('Property: class10 always returns colleges: [] regardless of budget/path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          budget: fc.constantFrom(...NON_LOW_BUDGETS, 'below_20k', 'below_1L'),
          preferredState: fc.constantFrom('', 'Karnataka', 'Kerala', 'Bihar'),
          pathId: fc.constantFrom('science_pcm', 'commerce_maths', 'arts_humanities', 'diploma_polytechnic'),
          path: fc.constantFrom('Science (PCM)', 'Commerce with Maths', 'Arts / Humanities', 'Polytechnic Diploma (Engineering)'),
        }),
        async ({ budget, preferredState, pathId, path }) => {
          const state = buildCollegeAgentState(
            { classLevel: 'class10', budget, preferredState },
            { path_id: pathId, path }
          )
          const result = await runCollegeRecommendationAgent(state)
          assert.deepStrictEqual(result.mappings[0].colleges, [])
        }
      ),
      { numRuns: 30 }
    )
  })
})

// ─── End-to-End: assembleGuidanceResponse for a class10 profile ────────────────

describe('End-to-end: class10 profile has no colleges section but keeps the budget-band cost', () => {
  /**
   * Builds a completed orchestration state for a class10 student, driving the
   * REAL runCollegeRecommendationAgent output through assembleGuidanceResponse
   * — the same join/dedup path runMultiAgentOrchestrator uses in production.
   */
  async function buildClass10AssembledOptions(budget) {
    const formData = {
      classLevel: 'class10',
      board: 'CBSE',
      state: 'Maharashtra',
      budget,
      fullName: 'Test Student',
    }
    const careerPaths = {
      recommendations: [
        { path_id: 'science_pcm', path: 'Science (PCM)', honest_take: 'Solid gateway.', requires_entrance_exam: 'None', opens_doors_to: ['Engineering'], watch_out_for: 'Rigour.', backup_plan: 'Switch to Commerce.' },
      ],
    }
    const collegeState = { formData, careerPaths, retrievedColleges: [] }
    const collegeResult = await runCollegeRecommendationAgent(collegeState)

    const state = {
      formData,
      profileAnalysis: { academicStanding: 'High', keyStrengths: [], keyConstraints: [] },
      retrievedColleges: [],
      retrievedScholarships: [],
      careerPaths,
      collegeRecommendations: collegeResult.mappings,
      scholarshipRecommendations: [],
      studyAbroadGuidance: { isFeasible: false },
      roadmaps: [{ path_id: 'science_pcm', path: 'Science (PCM)', years: [] }],
      mentorMatches: [],
      youtubeResources: [],
      finalSummary: { summary: 'Summary.', oneThingToDoThisWeek: 'Action.' },
      executionLogs: [],
    }

    return assembleGuidanceResponse(state, formData, 5).options
  }

  test('realistic_colleges is [] for every option, and avg_yearly_cost reflects the budget band', async () => {
    const cases = [
      ['below_20k', '₹5,000–₹20,000/yr'],
      ['20k-60k', '₹20,000–₹60,000/yr'],
      ['60k-1.5L', '₹60,000–₹1,50,000/yr'],
      ['above_1.5L', '₹1,50,000–₹2,50,000/yr'],
    ]
    for (const [budget, expectedCost] of cases) {
      const options = await buildClass10AssembledOptions(budget)
      assert.equal(options.length, 1)
      assert.deepStrictEqual(options[0].realistic_colleges, [])
      assert.equal(
        options[0].avg_yearly_cost,
        expectedCost,
        `budget="${budget}" expected avg_yearly_cost="${expectedCost}" but got "${options[0].avg_yearly_cost}"`
      )
    }
  })
})
