/**
 * Preservation Property Tests — Per-Option Card Integrity
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**
 *
 * Property 2 (design.md correctness properties 5 & 6): Preservation —
 * unrelated branches, non-mismatched honest_take, non-empty-college cost
 * derivation, and non-low-income cards must all remain byte-for-byte
 * unchanged by this fix.
 *
 * Methodology: Observation-first — we first observe what the UNFIXED code
 * returns for each preservation scenario, then encode those observations as
 * example-based and property-based assertions. These tests MUST PASS on
 * unfixed code (they capture the baseline behavior that must not regress).
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import {
  runCollegeRecommendationAgent,
  runCareerRecommendationAgent,
  assembleGuidanceResponse,
} from './Orchestrator.js'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildCollegeAgentState(careerRecommendations, retrievedColleges = [], formOverrides = {}) {
  return {
    formData: {
      classLevel: 'class12',
      board: 'CBSE',
      marks: '75',
      state: 'Maharashtra',
      stream: 'Science (PCB)',
      incomeRange: '2.5L-5L',
      interests: 'biology',
      preferredModeOfAdmission: '',
      preferredState: '',
      preferredCity: '',
      budget: '1L-3L',
      fullName: 'Test Student',
      ...formOverrides,
    },
    careerPaths: { recommendations: careerRecommendations },
    retrievedColleges,
  }
}

function buildAssembleState(optionsWithMappedColleges, formData, scholarshipRecommendations = []) {
  const careerPaths = { recommendations: optionsWithMappedColleges.map(o => o.opt) }
  const collegeRecommendations = optionsWithMappedColleges.map(o => ({
    path_id: o.opt.path_id,
    path: o.opt.path,
    colleges: o.colleges,
  }))
  const roadmaps = optionsWithMappedColleges.map(o => ({ path_id: o.opt.path_id, path: o.opt.path, years: [] }))

  return {
    formData,
    profileAnalysis: { academicStanding: 'Medium', keyStrengths: [], keyConstraints: [] },
    retrievedColleges: [],
    retrievedScholarships: [],
    careerPaths,
    collegeRecommendations,
    scholarshipRecommendations,
    studyAbroadGuidance: { isFeasible: false },
    roadmaps,
    mentorMatches: [],
    youtubeResources: [],
    finalSummary: { summary: 'Summary.', oneThingToDoThisWeek: 'Action.' },
    executionLogs: [],
  }
}

// ─── Observation anchors (example-based) ───────────────────────────────────────

describe('Preservation Observation: baseline behaviors on unfixed code', () => {
  /**
   * Observation 1 — a genuinely NEET-gated option (mbbs / doctor-named) with
   * no DB colleges keeps the AIIMS New Delhi / Madras Medical College
   * fallback, with the original whyFit text.
   */
  test('Observation 1: mbbs with no DB colleges returns AIIMS New Delhi / Madras Medical College unchanged', async () => {
    const state = buildCollegeAgentState([
      { path_id: 'mbbs', path: 'MBBS (Bachelor of Medicine & Surgery)' },
    ], [])
    const result = await runCollegeRecommendationAgent(state)
    const mapping = result.mappings[0]

    assert.deepStrictEqual(
      mapping.colleges.map(c => c.name),
      ['AIIMS New Delhi', 'Madras Medical College', 'Christian Medical College (CMC) Vellore', 'Maulana Azad Medical College']
    )
    assert.equal(mapping.colleges[0].admissionMode, 'NEET-UG')
    assert.equal(
      mapping.colleges[0].whyFit,
      "India's premier medical institute with highly subsidized education fees."
    )
  })

  /**
   * Observation 2 — the commerce/finance and humanities fallback branches
   * return their existing institutions/fee ranges/admission modes/whyFit
   * unchanged.
   */
  test('Observation 2: commerce and humanities fallback branches are untouched', async () => {
    const state = buildCollegeAgentState([
      { path_id: 'ca_finance', path: 'Chartered Accountancy (CA)' },
      { path_id: 'arts_humanities', path: 'Arts / Humanities' },
    ], [])
    const result = await runCollegeRecommendationAgent(state)

    assert.deepStrictEqual(
      result.mappings[0].colleges.map(c => c.name),
      ['Shri Ram College of Commerce', 'Symbiosis College of Arts and Commerce', 'Christ University', 'Loyola College']
    )
    assert.deepStrictEqual(
      result.mappings[1].colleges.map(c => c.name),
      ['Lady Shri Ram College', "St. Xavier's College Mumbai", 'Hindu College', 'Fergusson College']
    )
  })

  /**
   * Observation 3 — a recommendation whose honest_take names an exam that IS
   * its own requires_entrance_exam (e.g. MBBS naming NEET) is surfaced
   * verbatim through assembleGuidanceResponse.
   */
  test('Observation 3: honest_take naming its own gating exam is surfaced verbatim', () => {
    const formData = { classLevel: 'class12', incomeRange: '2.5L-5L' }
    const opt = {
      path_id: 'mbbs',
      path: 'MBBS (Bachelor of Medicine & Surgery)',
      honest_take: 'Extremely competitive through NEET-UG, and the course is long.',
      requires_entrance_exam: 'NEET-UG',
    }
    const state = buildAssembleState([{ opt, colleges: [] }], formData)
    const result = assembleGuidanceResponse(state, formData, 5)

    assert.equal(result.options[0].honest_take, opt.honest_take)
  })

  /**
   * Observation 4 — an option with a non-empty deduped college list derives
   * avg_yearly_cost from dedupedColleges[0].feeRange.
   */
  test('Observation 4: non-empty college list derives avg_yearly_cost from the first college feeRange', () => {
    const formData = { classLevel: 'class12', incomeRange: '2.5L-5L' }
    const opt = { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI', honest_take: 'x', requires_entrance_exam: 'JEE Main' }
    const colleges = [
      { name: 'RV College of Engineering', feeRange: '₹1,40,000–₹2,25,000/yr' },
      { name: 'PES University', feeRange: '₹1,95,000–₹3,15,000/yr' },
    ]
    const state = buildAssembleState([{ opt, colleges }], formData)
    const result = assembleGuidanceResponse(state, formData, 5)

    assert.equal(result.options[0].avg_yearly_cost, '₹1,40,000–₹2,25,000/yr')
  })

  /**
   * Observation 5 — for incomeRange values other than below_2.5L, no
   * financial_aid key appears on any option.
   */
  test('Observation 5: non-below_2.5L incomes get no financial_aid key', () => {
    for (const incomeRange of ['2.5L-5L', '5L-10L', 'above_10L', undefined, '']) {
      const formData = { classLevel: 'class12', incomeRange }
      const opt = { path_id: 'opt_a', path: 'Option A', honest_take: 'x', requires_entrance_exam: 'None' }
      const state = buildAssembleState([{ opt, colleges: [] }], formData, [{ name: 'Some Scholarship', eligibility: 'x', applicationUrl: 'y' }])
      const result = assembleGuidanceResponse(state, formData, 5)
      assert.equal('financial_aid' in result.options[0], false, `incomeRange="${incomeRange}" must not add financial_aid`)
    }
  })

  /**
   * Observation 6 — class10 continues to get colleges: [] for every option,
   * regardless of path text, and derives avg_yearly_cost from the budget
   * band rather than any college data.
   */
  test('Observation 6: class10 gets colleges: [] regardless of path text', async () => {
    const state = buildCollegeAgentState(
      [{ path_id: 'science_pcm', path: 'Science (PCM)' }],
      [],
      { classLevel: 'class10' }
    )
    const result = await runCollegeRecommendationAgent(state)
    assert.deepStrictEqual(result.mappings[0].colleges, [])
  })

  /**
   * Observation 7 — the evidence guardrail continues to run and continues
   * to leave a legitimate fallback scholarship_to_check unblanked.
   */
  test('Observation 7: evidence guardrail leaves a legitimate fallback scholarship_to_check unblanked', () => {
    const formData = { classLevel: 'class12', incomeRange: '2.5L-5L' }
    const opt = { path_id: 'opt_a', path: 'Option A', honest_take: 'x', requires_entrance_exam: 'None' }
    const state = buildAssembleState([{ opt, colleges: [] }], formData, [])
    const result = assembleGuidanceResponse(state, formData, 5)
    // scholarshipRecommendations is empty, so scholarship_to_check falls back
    // to FALLBACK_SCHOLARSHIP_NAME, and the guardrail must not blank it.
    assert.equal(result.scholarship_to_check, 'Post-Matric Scholarship Scheme')
  })
})

// ─── Property-Based Preservation Tests ──────────────────────────────────────────

// Path text that must NOT classify as biotech-like or physiotherapy-like,
// including near-miss text that a naive substring match could trip on.
const NON_BIOTECH_PHYSIO_PATHS = [
  { path_id: 'mbbs', path: 'MBBS (Bachelor of Medicine & Surgery)' },
  { path_id: 'bds', path: 'BDS (Dental Surgery)' },
  { path_id: 'btech_biomedical', path: 'B.Tech Biomedical Engineering' },
  { path_id: 'bsc_physiology', path: 'B.Sc Physiology' }, // contains "physio" but not "physiotherapy"
  { path_id: 'ca_finance', path: 'Chartered Accountancy (CA)' },
  { path_id: 'arts_humanities', path: 'Arts / Humanities' },
  { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
]

describe('Preservation Property: Per-Option Card Integrity', () => {
  /**
   * Property (Requirement 3.9, 3.11): for all path/path_id combinations that
   * do NOT classify as biotech-like or physiotherapy-like, the college
   * mapping output is unchanged from the pre-fix baseline (same names for
   * commerce/arts fallback; same NEET-UG bucket for genuinely medical paths).
   */
  test('Property: non-biotech/physio paths are unaffected by the college-mapping fix', async () => {
    for (const rec of NON_BIOTECH_PHYSIO_PATHS) {
      const state = buildCollegeAgentState([rec], [])
      const result = await runCollegeRecommendationAgent(state)
      const mapping = result.mappings[0]
      // None of these should ever end up with an empty list + programMatchNote
      // UNLESS they are genuinely biotech/physio — which none of these are.
      assert.ok(
        mapping.colleges.length > 0,
        `Expected "${rec.path}" (path_id=${rec.path_id}) to keep a non-empty fallback college list, got: ${JSON.stringify(mapping.colleges)}`
      )
    }
  })

  /**
   * Property (Requirement 3.4, 3.11): for honest_take/requires_entrance_exam
   * pairs where the named exam is consistent (matches the option's own
   * track or its own requirement), sanitization must be a no-op. This
   * property is written against assembleGuidanceResponse directly (the
   * wiring point), using consistent fixtures.
   */
  test('Property: consistent honest_take/requires_entrance_exam pairs pass through unchanged', () => {
    const consistentFixtures = [
      { path_id: 'mbbs', path: 'MBBS (Bachelor of Medicine & Surgery)', honest_take: 'Extremely competitive via NEET-UG.', requires_entrance_exam: 'NEET-UG' },
      { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI', honest_take: 'Entry is via JEE Main and highly competitive.', requires_entrance_exam: 'JEE Main / COMEDK' },
      { path_id: 'ca_finance', path: 'Chartered Accountancy (CA)', honest_take: 'CA Foundation is the entry gate and pass rates are low.', requires_entrance_exam: 'CA Foundation' },
      { path_id: 'bsc_cs', path: 'B.Sc Computer Science', honest_take: 'No major entrance pressure, mostly merit-based admission.', requires_entrance_exam: 'None' },
    ]
    const formData = { classLevel: 'class12', incomeRange: '2.5L-5L' }
    for (const opt of consistentFixtures) {
      const state = buildAssembleState([{ opt, colleges: [] }], formData)
      const result = assembleGuidanceResponse(state, formData, 5)
      assert.equal(
        result.options[0].honest_take,
        opt.honest_take,
        `Expected honest_take to pass through unchanged for "${opt.path}", got: "${result.options[0].honest_take}"`
      )
    }
  })

  /**
   * Property (Requirement 3.10): for options with a non-empty deduped
   * college list, avg_yearly_cost is always derived from that option's own
   * first institution's feeRange — never the unavailable marker.
   */
  test('Property: non-empty college lists never render the "unavailable" cost marker', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            feeRange: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (colleges) => {
          const formData = { classLevel: 'class12', incomeRange: '2.5L-5L' }
          const opt = { path_id: 'opt_x', path: 'Some Option', honest_take: 'text', requires_entrance_exam: 'None' }
          const state = buildAssembleState([{ opt, colleges }], formData)
          const result = assembleGuidanceResponse(state, formData, 5)
          // Dedup collapses same-name colleges; first occurrence's feeRange wins.
          const seen = new Set()
          const firstUnique = colleges.find(c => {
            const key = (c.name || '').trim().toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          assert.equal(result.options[0].avg_yearly_cost, firstUnique.feeRange)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property (Requirement 3.5): for all incomeRange values OTHER THAN
   * 'below_2.5L', no option ever carries a financial_aid key, regardless of
   * how many scholarships are available. (The below_2.5L → aid-present half
   * of this behavior is new/fix behavior, asserted in the bug condition
   * exploration test — this file only covers the preservation half, which
   * must already hold true on unfixed code since no income value produces
   * financial_aid today.)
   */
  test('Property: non-below_2.5L incomes never carry financial_aid, regardless of scholarship data', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('2.5L-5L', '5L-10L', 'above_10L', '', undefined, 'garbage_value'),
        fc.array(fc.record({ name: fc.string({ minLength: 1, maxLength: 15 }), eligibility: fc.string(), applicationUrl: fc.webUrl() }), { minLength: 0, maxLength: 3 }),
        (incomeRange, scholarshipRecommendations) => {
          const formData = { classLevel: 'class12', incomeRange }
          const opt = { path_id: 'opt_x', path: 'Some Option', honest_take: 'text', requires_entrance_exam: 'None' }
          const state = buildAssembleState([{ opt, colleges: [] }], formData, scholarshipRecommendations)
          const result = assembleGuidanceResponse(state, formData, 5)
          assert.equal('financial_aid' in result.options[0], false, `incomeRange="${incomeRange}" must not produce financial_aid`)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property (Requirement 3.7): class10 always derives avg_yearly_cost from
   * the budget band, and always gets colleges: [], regardless of any
   * program-matching logic introduced by this fix.
   */
  test('Property: class10 budget-band cost derivation is untouched', () => {
    const cases = [
      ['below_20k', '₹5,000–₹20,000/yr'],
      ['20k-60k', '₹20,000–₹60,000/yr'],
      ['60k-1.5L', '₹60,000–₹1,50,000/yr'],
      ['above_1.5L', '₹1,50,000–₹2,50,000/yr'],
    ]
    for (const [budget, expectedCost] of cases) {
      const formData = { classLevel: 'class10', budget, incomeRange: 'below_2.5L' }
      const opt = { path_id: 'science_pcm', path: 'Science (PCM)', honest_take: 'x', requires_entrance_exam: 'None' }
      const state = buildAssembleState([{ opt, colleges: [] }], formData)
      const result = assembleGuidanceResponse(state, formData, 5)
      assert.equal(result.options[0].avg_yearly_cost, expectedCost)
      assert.deepStrictEqual(result.options[0].realistic_colleges, [])
    }
  })
})
