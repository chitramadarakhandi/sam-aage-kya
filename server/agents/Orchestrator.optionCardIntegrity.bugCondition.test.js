/**
 * Bug Condition Exploration Test — Per-Option Card Integrity
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12**
 *
 * Property 1: Bug Condition — four defects make sibling option cards
 * misrepresent genuinely different degree paths:
 *  1. Institution lists don't match the option's real admission pathway
 *     (bsc_biotech / bpt_physiotherapy share the NEET-UG medical bucket, and
 *     share the stream-tagged-not-degree-tagged retrievedColleges slice).
 *  2. honest_take names the wrong admission exam (bsc_biotech's fallback text
 *     names NEET even though NEET doesn't gate that degree).
 *  3. avg_yearly_cost gets copied between sibling options with no colleges
 *     (shared hardcoded literal).
 *  4. No per-card financial-aid section exists for low-income students.
 *
 * These assertions encode the EXPECTED (post-fix) behavior per design.md's
 * Correctness Properties 1-4, so this test is EXPECTED TO FAIL on unfixed
 * code — failure confirms the bugs exist. DO NOT fix the test when it fails;
 * fix the code (task 3) instead. This is the SAME test re-run in task 3.7 to
 * confirm the fix.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
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

function buildCareerAgentState(formOverrides = {}) {
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
    profileAnalysis: {
      academicStanding: 'Medium',
      financialCategory: 'Affordable',
      riskAppetite: 'Balanced',
      keyConstraints: [],
      keyStrengths: [],
      coachingNeeds: '',
    },
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

// ─── Bug Condition Tests ────────────────────────────────────────────────────────

describe('Bug Condition Exploration: Per-Option Card Integrity', () => {
  /**
   * Test 1 (Defect 1, fallback path): bsc_biotech and bpt_physiotherapy must
   * NOT share the "prestigious medical institutions" NEET-UG bucket, since
   * bsc_biotech's real entrance route is CUET/Merit, not NEET. Expected
   * (post-fix): both get realistic_colleges: [] with an explicit
   * institution_match_note (per Property 1 in design.md).
   */
  test('Property 1 (institution mismatch, fallback path): bsc_biotech and bpt_physiotherapy must NOT receive the NEET-UG medical bucket', async () => {
    const state = buildCollegeAgentState([
      { path_id: 'bsc_biotech', path: 'B.Sc Biotechnology / Genetics' },
      { path_id: 'bpt_physiotherapy', path: 'Bachelor of Physiotherapy (BPT)' },
    ], [])

    const result = await runCollegeRecommendationAgent(state)
    const biotechMapping = result.mappings[0]
    const bptMapping = result.mappings[1]

    assert.deepStrictEqual(
      biotechMapping.colleges,
      [],
      `Expected bsc_biotech to have NO institutions (no verified biotech-specific data exists), got: ${JSON.stringify(biotechMapping.colleges.map(c => c.name))}`
    )
    assert.deepStrictEqual(
      bptMapping.colleges,
      [],
      `Expected bpt_physiotherapy to have NO institutions, got: ${JSON.stringify(bptMapping.colleges.map(c => c.name))}`
    )
    assert.ok(
      biotechMapping.programMatchNote,
      'Expected bsc_biotech to carry an explicit programMatchNote explaining the absence of institution data'
    )
    assert.ok(
      bptMapping.programMatchNote,
      'Expected bpt_physiotherapy to carry an explicit programMatchNote'
    )
  })

  /**
   * Test 2 (Defect 1, DB path): retrievedColleges is only stream-tagged, not
   * degree-tagged, so it cannot honestly back a biotech-specific claim
   * either. Expected (post-fix): bsc_biotech still gets [] even when DB rows
   * exist, while a genuinely NEET-gated option (mbbs) in the SAME stream
   * keeps using the DB rows.
   */
  test('Property 1 (institution mismatch, DB path): bsc_biotech must NOT receive the raw stream-tagged DB slice', async () => {
    const retrievedColleges = [
      { name: 'AIIMS Rishikesh', city: 'Rishikesh', state: 'Uttarakhand', yearly_cost_min: 52000, yearly_cost_max: 118000 },
      { name: 'Kasturba Medical College Manipal', city: 'Manipal', state: 'Karnataka', yearly_cost_min: 900000, yearly_cost_max: 1700000 },
      { name: 'King George Medical University', city: 'Lucknow', state: 'Uttar Pradesh', yearly_cost_min: 55000, yearly_cost_max: 120000 },
    ]
    const state = buildCollegeAgentState([
      { path_id: 'bsc_biotech', path: 'B.Sc Biotechnology / Genetics' },
      { path_id: 'mbbs', path: 'MBBS (Bachelor of Medicine & Surgery)' },
    ], retrievedColleges)

    const result = await runCollegeRecommendationAgent(state)
    const biotechNames = result.mappings[0].colleges.map(c => c.name)
    const mbbsNames = result.mappings[1].colleges.map(c => c.name)

    assert.deepStrictEqual(
      biotechNames,
      [],
      `Expected bsc_biotech to receive NO institutions from the stream-tagged DB slice, got: ${JSON.stringify(biotechNames)}`
    )
    assert.ok(result.mappings[0].programMatchNote, 'Expected a programMatchNote for the DB-path biotech option')
    // Genuinely NEET-gated MBBS in the same stream must be unaffected — it
    // still uses the DB-retrieved rows exactly as before.
    assert.deepStrictEqual(
      mbbsNames,
      ['AIIMS Rishikesh', 'Kasturba Medical College Manipal', 'King George Medical University'],
      `Expected mbbs to be unaffected and still use the DB-retrieved rows, got: ${JSON.stringify(mbbsNames)}`
    )
  })

  /**
   * Test 3 (Defect 2): the PCB fallback's bsc_biotech recommendation must NOT
   * name NEET in honest_take, since requires_entrance_exam is "CUET / None".
   */
  test('Property 1 (exam claim): bsc_biotech fallback honest_take must NOT name NEET', async () => {
    const state = buildCareerAgentState({ stream: 'Science (PCB)', interests: 'biology, research' })
    const result = await runCareerRecommendationAgent(state)

    const biotech = result.recommendations.find(r => r.path_id === 'bsc_biotech')
    assert.ok(biotech, 'expected a bsc_biotech recommendation from the PCB fallback')
    assert.doesNotMatch(
      biotech.honest_take,
      /NEET/,
      `Expected honest_take to NOT name NEET (requires_entrance_exam is "CUET / None"), got: "${biotech.honest_take}"`
    )
    assert.equal(biotech.requires_entrance_exam, 'CUET / None')
  })

  /**
   * Test 4 (Defect 3): two unrelated options with zero colleges must render
   * an explicit "cost data not available" marker rather than a shared
   * hardcoded literal that looks like a verified figure.
   */
  test('Property 1 (cost sharing): zero-college options must show an explicit unavailable marker, not a fabricated-looking shared literal', () => {
    const formData = { classLevel: 'class12', incomeRange: '2.5L-5L' }
    const state = buildAssembleState([
      { opt: { path_id: 'opt_a', path: 'Option A (no colleges)', honest_take: 'x', requires_entrance_exam: 'None' }, colleges: [] },
      { opt: { path_id: 'opt_b', path: 'Option B (no colleges, unrelated)', honest_take: 'y', requires_entrance_exam: 'None' }, colleges: [] },
    ], formData)

    const result = assembleGuidanceResponse(state, formData, 5)
    const [a, b] = result.options

    assert.notEqual(
      a.avg_yearly_cost,
      '₹80,000–₹1,50,000/yr',
      `Expected the generic fabricated-looking literal to be replaced with an explicit "unavailable" marker, got: "${a.avg_yearly_cost}"`
    )
    assert.match(
      a.avg_yearly_cost,
      /not available/i,
      `Expected avg_yearly_cost to explicitly say cost data is not available, got: "${a.avg_yearly_cost}"`
    )
    assert.equal(a.avg_yearly_cost, b.avg_yearly_cost, 'the unavailable marker is intentionally the same literal, but marked as unavailable rather than a fabricated figure')
  })

  /**
   * Test 5 (Defect 4): a below_2.5L-income student's assembled response must
   * carry a financial_aid section on every option, sourced from
   * scholarshipRecommendations.
   */
  test('Property 1 (missing aid): below_2.5L income response must carry financial_aid on every option', () => {
    const formData = { classLevel: 'class12', incomeRange: 'below_2.5L' }
    const scholarshipRecommendations = [
      { name: 'Post-Matric Scholarship Scheme', eligibility: 'Marks > 50%, Income < ₹2.5 Lakh/yr', applicationUrl: 'https://scholarships.gov.in' },
    ]
    const state = buildAssembleState([
      { opt: { path_id: 'opt_a', path: 'Option A', honest_take: 'x', requires_entrance_exam: 'None' }, colleges: [] },
    ], formData, scholarshipRecommendations)

    const result = assembleGuidanceResponse(state, formData, 5)
    const [a] = result.options

    assert.ok(a.financial_aid, `Expected a financial_aid section on the option, got: ${JSON.stringify(a.financial_aid)}`)
    assert.ok(Array.isArray(a.financial_aid.schemes) && a.financial_aid.schemes.length > 0, 'expected at least one scheme')
    assert.equal(a.financial_aid.schemes[0].name, 'Post-Matric Scholarship Scheme')
  })
})
