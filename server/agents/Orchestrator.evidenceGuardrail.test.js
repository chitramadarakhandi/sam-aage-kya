/**
 * Unit tests — centralized evidence guardrail wiring.
 *
 * `applyEvidenceGuardrail` is the seam where the orchestrator's assembled
 * response is passed through `enforceGuidanceEvidence`. It is a pure function
 * (no LLM / Supabase calls), so it is unit-tested directly here.
 *
 * Covers:
 *  - names outside a DB-sourced allow-list are stripped
 *  - names inside the allow-list survive
 *  - guardrail metadata reports the removal count
 *  - REGRESSION: with no DB-retrieved colleges, curated fallback colleges survive
 *  - REGRESSION: a fallback scholarship_to_check is not blanked
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { applyEvidenceGuardrail, FALLBACK_SCHOLARSHIP_NAME } from './Orchestrator.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildResult(realisticColleges, scholarshipToCheck = FALLBACK_SCHOLARSHIP_NAME) {
  return {
    summary: 'Test summary',
    options: [
      {
        path: 'B.Tech Computer Science & AI',
        realistic_colleges: realisticColleges,
        avg_yearly_cost: '₹1,40,000–₹2,25,000/yr',
      },
    ],
    scholarship_to_check: scholarshipToCheck,
    explainability: { totalDurationMs: 1, steps: [], profile: {} },
  }
}

function buildState({ retrievedColleges = [], collegeRecommendations = [], scholarshipRecommendations = [] } = {}) {
  return { retrievedColleges, collegeRecommendations, scholarshipRecommendations }
}

const DB_COLLEGES = [
  { name: 'College A', city: 'Pune', state: 'Maharashtra' },
  { name: 'College B', city: 'Nagpur', state: 'Maharashtra' },
]

describe('applyEvidenceGuardrail — DB-sourced allow-list exists', () => {
  test('strips a college name that is not in the DB-verified allow-list', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult(['College A', 'Totally Made Up Institute']),
      buildState({ retrievedColleges: DB_COLLEGES }),
      { classLevel: 'class12' }
    )

    assert.deepStrictEqual(result.options[0].realistic_colleges, ['College A'])
    assert.equal(guardrail.removedUnsupportedCollegeClaims, 1)
  })

  test('keeps every college name that IS in the allow-list', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult(['College A', 'College B']),
      buildState({ retrievedColleges: DB_COLLEGES }),
      { classLevel: 'class12' }
    )

    assert.deepStrictEqual(result.options[0].realistic_colleges, ['College A', 'College B'])
    assert.equal(guardrail.removedUnsupportedCollegeClaims, 0)
    assert.equal(guardrail.removedUnsupportedScholarshipClaim, false)
  })

  test('guardrail metadata counts multiple removed claims', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult(['Fake One', 'College B', 'Fake Two', 'Fake Three']),
      buildState({ retrievedColleges: DB_COLLEGES }),
      { classLevel: 'class12' }
    )

    assert.deepStrictEqual(result.options[0].realistic_colleges, ['College B'])
    assert.equal(guardrail.removedUnsupportedCollegeClaims, 3)
  })

  test('does not remove any other response field', () => {
    const input = buildResult(['College A'])
    const { result } = applyEvidenceGuardrail(
      input,
      buildState({ retrievedColleges: DB_COLLEGES }),
      { classLevel: 'class12' }
    )

    assert.equal(result.summary, 'Test summary')
    assert.deepStrictEqual(result.explainability, input.explainability)
    assert.equal(result.options[0].avg_yearly_cost, '₹1,40,000–₹2,25,000/yr')
  })
})

describe('applyEvidenceGuardrail — regression guards for degraded paths', () => {
  /**
   * REGRESSION GUARD (constraint 1): with no DB-retrieved colleges the curated
   * in-code fallback colleges must survive. A naive `colleges: retrievedColleges`
   * would produce an empty allow-list and blank every option.
   */
  test('hardcoded fallback colleges are NOT stripped when there are no DB-retrieved colleges', () => {
    const fallbackNames = ['RV College of Engineering', 'PES University']
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult(fallbackNames),
      buildState({
        retrievedColleges: [],
        collegeRecommendations: [
          {
            path_id: 'btech_cs_ai',
            path: 'B.Tech Computer Science & AI',
            colleges: fallbackNames.map(name => ({ name, city: 'Bangalore', state: 'Karnataka' })),
          },
        ],
      }),
      { classLevel: 'class12' }
    )

    assert.deepStrictEqual(result.options[0].realistic_colleges, fallbackNames)
    assert.equal(guardrail.removedUnsupportedCollegeClaims, 0)
  })

  test('medical/other fallback colleges survive too (AIIMS / NIT Patna)', () => {
    for (const names of [['AIIMS New Delhi', 'Madras Medical College'], ['NIT Patna']]) {
      const { result } = applyEvidenceGuardrail(
        buildResult(names),
        buildState({
          retrievedColleges: [],
          collegeRecommendations: [{ path: 'B.Tech Computer Science & AI', colleges: names.map(name => ({ name })) }],
        }),
        { classLevel: 'class12' }
      )
      assert.deepStrictEqual(result.options[0].realistic_colleges, names)
    }
  })

  /**
   * REGRESSION GUARD (constraint 2): the fallback scholarship name must not be
   * blanked out when the DB returned no scholarships.
   */
  test('fallback scholarship_to_check is not blanked when no DB scholarships exist', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult([], FALLBACK_SCHOLARSHIP_NAME),
      buildState({ scholarshipRecommendations: [] }),
      { classLevel: 'class12' }
    )

    assert.equal(result.scholarship_to_check, FALLBACK_SCHOLARSHIP_NAME)
    assert.equal(guardrail.removedUnsupportedScholarshipClaim, false)
  })

  test('a DB-surfaced scholarship name is preserved', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult([], 'National Merit Scholarship'),
      buildState({ scholarshipRecommendations: [{ name: 'National Merit Scholarship' }, { name: 'Other' }] }),
      { classLevel: 'class12' }
    )

    assert.equal(result.scholarship_to_check, 'National Merit Scholarship')
    assert.equal(guardrail.removedUnsupportedScholarshipClaim, false)
  })

  test('a scholarship name backed by no surfaced record is blanked and reported', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult([], 'Unbacked Scholarship'),
      buildState({ scholarshipRecommendations: [{ name: 'National Merit Scholarship' }] }),
      { classLevel: 'class12' }
    )

    assert.equal(result.scholarship_to_check, '')
    assert.equal(guardrail.removedUnsupportedScholarshipClaim, true)
  })

  /**
   * Documented behavior change: enforceGuidanceEvidence skips college filtering
   * entirely for class10 (the old inline guardrail had no such exemption). In
   * practice this is inert, because when DB colleges exist the college agent
   * sources names solely from them.
   */
  test('class10 profiles skip college filtering (documented exemption)', () => {
    const { result, guardrail } = applyEvidenceGuardrail(
      buildResult(['Totally Made Up Institute']),
      buildState({ retrievedColleges: DB_COLLEGES }),
      { classLevel: 'class10' }
    )

    assert.deepStrictEqual(result.options[0].realistic_colleges, ['Totally Made Up Institute'])
    assert.equal(guardrail.removedUnsupportedCollegeClaims, 0)
  })

  test('defaults to class12 enforcement when classLevel is missing', () => {
    const { guardrail } = applyEvidenceGuardrail(
      buildResult(['Totally Made Up Institute']),
      buildState({ retrievedColleges: DB_COLLEGES }),
      {}
    )

    assert.equal(guardrail.removedUnsupportedCollegeClaims, 1)
  })
})
