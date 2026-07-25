/**
 * Preservation Property Tests — Compatible Stream-Exam Pairs Unchanged
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Preservation — For all compatible stream-exam pairs (PCM+JEE,
 * PCB+NEET, Commerce+CA Foundation, no-exam cases), the fallback output
 * matches the currently observed behavior exactly. These tests capture the
 * baseline behavior that MUST NOT regress after the fix is applied.
 *
 * Methodology: Observation-first — we first observed what the unfixed code
 * returns for each compatible case, then encoded those observations as
 * assertions. These tests MUST PASS on unfixed code.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { runCareerRecommendationAgent, runSummaryAgent } from './Orchestrator.js'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildState(formOverrides) {
  return {
    formData: {
      classLevel: 'class12',
      board: 'CBSE',
      marks: '75',
      state: 'Maharashtra',
      stream: '',
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
    profileAnalysis: {
      academicStanding: 'Medium',
      financialCategory: 'Affordable',
      riskAppetite: 'Balanced',
      keyConstraints: [],
      keyStrengths: [],
      coachingNeeds: '',
    },
    careerPaths: { recommendations: [{ path: 'Test Path', path_id: 'test' }] },
    collegeRecommendations: [],
    scholarshipRecommendations: [],
  }
}

/**
 * isBugCondition — checks whether a given input would trigger the bug.
 * For preservation tests, we test inputs where this returns FALSE (no mismatch).
 *
 * Formal spec from design:
 *   exam IS NOT EMPTY AND exam != 'none' AND validStreams IS DEFINED
 *   AND stream NOT IN validStreams → bug condition
 */
const EXAM_STREAM_MAP = {
  'jee': ['science (pcm)'],
  'jee main': ['science (pcm)'],
  'neet': ['science (pcb)', 'science (pcmb)'],
  'neet-ug': ['science (pcb)', 'science (pcmb)'],
  'ca foundation': ['commerce'],
  'clat': ['arts / humanities', 'commerce'],
  'nift': ['science (pcm)', 'arts / humanities'],
  'uceed': ['science (pcm)', 'arts / humanities'],
}

function isBugCondition(stream, exam) {
  const normalizedExam = (exam || '').trim().toLowerCase()
  const normalizedStream = (stream || '').trim().toLowerCase()

  if (!normalizedExam || normalizedExam === 'none') return false
  const validStreams = EXAM_STREAM_MAP[normalizedExam]
  if (!validStreams) return false // Unknown exam — not a bug condition
  return !validStreams.includes(normalizedStream)
}

// ─── Observed baseline values (captured from unfixed code) ──────────────────────

const OBSERVED_PCM_PATH_IDS = ['btech_cs_ai', 'bsc_data_science']
const OBSERVED_PCB_PATH_IDS = ['bsc_biotech', 'bpt_physiotherapy']
const OBSERVED_COMMERCE_PATH_IDS = ['ca_finance', 'bba_finance']

// ─── Property-Based Preservation Tests ──────────────────────────────────────────

describe('Preservation Property: Compatible Stream-Exam Pairs Unchanged', () => {
  /**
   * Property 2a: PCM + JEE (compatible pair)
   * Observed: returns B.Tech CS & AI (btech_cs_ai) and B.Sc Data Science (bsc_data_science)
   */
  test('Property 2a: PCM+JEE compatible pair — returns B.Tech/B.Sc engineering recommendations unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom('Science (PCM)', 'Science (PCM) '),
          preferredModeOfAdmission: fc.constantFrom('JEE', 'JEE Main', 'jee'),
          marks: fc.constantFrom('75', '85', '92', '60'),
          interests: fc.constantFrom('technology', 'coding', 'engineering', 'robotics'),
        }),
        async ({ stream, preferredModeOfAdmission, marks, interests }) => {
          // Confirm this is NOT a bug condition
          assert.ok(
            !isBugCondition(stream, preferredModeOfAdmission),
            `PCM+JEE should NOT be a bug condition`
          )

          const state = buildState({ stream, preferredModeOfAdmission, marks, interests })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const pathIds = paths.map(p => p.path_id)

          // Preservation: same path_ids as observed on unfixed code
          assert.deepStrictEqual(
            pathIds,
            OBSERVED_PCM_PATH_IDS,
            `PCM+JEE should return path_ids ${JSON.stringify(OBSERVED_PCM_PATH_IDS)} but got ${JSON.stringify(pathIds)}`
          )

          // Preservation: B.Tech CS & AI as first recommendation
          assert.ok(
            paths[0].path.includes('B.Tech Computer Science'),
            `First recommendation should be B.Tech CS but got: ${paths[0].path}`
          )

          // Preservation: B.Sc Data Science as second recommendation
          assert.ok(
            paths[1].path.includes('Data Science'),
            `Second recommendation should be Data Science but got: ${paths[1].path}`
          )
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 2b: PCB + NEET (compatible pair)
   * Observed: returns B.Sc Biotech (bsc_biotech) and BPT (bpt_physiotherapy)
   */
  test('Property 2b: PCB+NEET compatible pair — returns Biotech/BPT recommendations unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom('Science (PCB)', 'Science (PCB) '),
          preferredModeOfAdmission: fc.constantFrom('NEET', 'NEET-UG', 'neet'),
          marks: fc.constantFrom('75', '80', '65', '90'),
          interests: fc.constantFrom('biology', 'medicine', 'research', 'healthcare'),
        }),
        async ({ stream, preferredModeOfAdmission, marks, interests }) => {
          assert.ok(
            !isBugCondition(stream, preferredModeOfAdmission),
            `PCB+NEET should NOT be a bug condition`
          )

          const state = buildState({ stream, preferredModeOfAdmission, marks, interests })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const pathIds = paths.map(p => p.path_id)

          // Preservation: same path_ids as observed on unfixed code
          assert.deepStrictEqual(
            pathIds,
            OBSERVED_PCB_PATH_IDS,
            `PCB+NEET should return path_ids ${JSON.stringify(OBSERVED_PCB_PATH_IDS)} but got ${JSON.stringify(pathIds)}`
          )

          // Preservation: B.Sc Biotech as first recommendation
          assert.ok(
            paths[0].path.includes('Biotechnology'),
            `First recommendation should be Biotech but got: ${paths[0].path}`
          )

          // Preservation: BPT as second recommendation
          assert.ok(
            paths[1].path.includes('Physiotherapy'),
            `Second recommendation should be BPT but got: ${paths[1].path}`
          )
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 2c: Commerce + CA Foundation (compatible pair)
   * Observed: returns CA (ca_finance) and BBA (bba_finance)
   */
  test('Property 2c: Commerce+CA Foundation compatible pair — returns CA/BBA recommendations unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom('Commerce', 'Commerce '),
          preferredModeOfAdmission: fc.constantFrom('CA Foundation', 'ca foundation'),
          marks: fc.constantFrom('75', '82', '60', '95'),
        }),
        async ({ stream, preferredModeOfAdmission, marks }) => {
          assert.ok(
            !isBugCondition(stream, preferredModeOfAdmission),
            `Commerce+CA Foundation should NOT be a bug condition`
          )

          const state = buildState({ stream, preferredModeOfAdmission, marks })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const pathIds = paths.map(p => p.path_id)

          // Preservation: same path_ids as observed on unfixed code
          assert.deepStrictEqual(
            pathIds,
            OBSERVED_COMMERCE_PATH_IDS,
            `Commerce+CA Foundation should return path_ids ${JSON.stringify(OBSERVED_COMMERCE_PATH_IDS)} but got ${JSON.stringify(pathIds)}`
          )

          // Preservation: CA as first recommendation
          assert.ok(
            paths[0].path.includes('Chartered Accountancy'),
            `First recommendation should be CA but got: ${paths[0].path}`
          )

          // Preservation: BBA as second recommendation
          assert.ok(
            paths[1].path.includes('BBA'),
            `Second recommendation should be BBA but got: ${paths[1].path}`
          )
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 2d: No-exam cases — Commerce with empty/no exam preference
   * Observed: returns CA (ca_finance) and BBA (bba_finance)
   *
   * **Validates: Requirement 3.3**
   */
  test('Property 2d: No-exam cases — Commerce with empty exam returns CA/BBA unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom('Commerce', 'Commerce '),
          preferredModeOfAdmission: fc.constantFrom('', 'None', 'none', ' '),
          marks: fc.constantFrom('75', '80', '55', '92'),
        }),
        async ({ stream, preferredModeOfAdmission, marks }) => {
          assert.ok(
            !isBugCondition(stream, preferredModeOfAdmission),
            `Commerce with no/empty exam should NOT be a bug condition`
          )

          const state = buildState({ stream, preferredModeOfAdmission, marks })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const pathIds = paths.map(p => p.path_id)

          // Preservation: same path_ids as observed — CA and BBA
          assert.deepStrictEqual(
            pathIds,
            OBSERVED_COMMERCE_PATH_IDS,
            `Commerce with no exam should return path_ids ${JSON.stringify(OBSERVED_COMMERCE_PATH_IDS)} but got ${JSON.stringify(pathIds)}`
          )
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 2e: Summary fallback with valid preferredState produces geographic text
   * Observed: "By targeting top institutions in {state} and securing..."
   *
   * **Validates: Requirement 3.5**
   */
  test('Property 2e: Summary fallback with valid state — produces geographic text with state name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom('Science (PCM)', 'Science (PCB)', 'Commerce'),
          preferredState: fc.constantFrom('Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Uttar Pradesh'),
          interests: fc.constantFrom('coding', 'biology', 'finance', 'design'),
        }),
        async ({ stream, preferredState, interests }) => {
          const state = buildState({ stream, preferredState, interests })
          const result = await runSummaryAgent(state)

          // Preservation: summary should contain the state name
          assert.ok(
            result.summary.includes(preferredState),
            `Summary with preferredState="${preferredState}" should contain the state name but got: "${result.summary}"`
          )

          // Preservation: summary should contain the stream reference
          const streamRef = stream === 'Science (PCM)' ? 'Science (PCM)' :
            stream === 'Science (PCB)' ? 'Science (PCB)' : 'Commerce'
          assert.ok(
            result.summary.includes(streamRef),
            `Summary should reference the stream "${streamRef}" but got: "${result.summary}"`
          )

          // Preservation: oneThingToDoThisWeek should be about entrance exams
          assert.ok(
            result.oneThingToDoThisWeek.includes('entrance exam') ||
            result.oneThingToDoThisWeek.includes('application deadline'),
            `oneThingToDoThisWeek should mention entrance exams/deadlines but got: "${result.oneThingToDoThisWeek}"`
          )
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 2f: For ALL inputs where isBugCondition returns false,
   * runCareerRecommendationAgent produces deterministic results based on
   * stream alone (the current behavior to preserve).
   *
   * This property generates various compatible stream-exam pairs and verifies
   * the output is consistent with the stream-based branching logic.
   *
   * NOTE: "Arts / Humanities" contains "iti" (from "humanities") which triggers
   * the isDiplomaTrack branch in the current code — this is a pre-existing
   * quirk that we preserve as-is.
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  test('Property 2f: All non-bug-condition inputs — career fallback is determined by stream', async () => {
    const OBSERVED_DIPLOMA_PATH_IDS = ['btech_lateral', 'bvoc', 'diploma_job']

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom(
            'Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts / Humanities'
          ),
          preferredModeOfAdmission: fc.constantFrom(
            '', 'None', 'JEE', 'NEET', 'CA Foundation', 'CLAT'
          ),
          marks: fc.constantFrom('60', '75', '85', '95'),
          interests: fc.constantFrom('coding', 'biology', 'finance', 'literature'),
        }).filter(({ stream, preferredModeOfAdmission }) =>
          // Only test cases where it's NOT a bug condition
          !isBugCondition(stream, preferredModeOfAdmission)
        ),
        async ({ stream, preferredModeOfAdmission, marks, interests }) => {
          const state = buildState({ stream, preferredModeOfAdmission, marks, interests })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const pathIds = paths.map(p => p.path_id)

          // The fallback is purely stream-based for compatible/no-exam cases.
          // "Arts / Humanities" triggers isDiplomaTrack due to "iti" in "humanities".
          if (stream.includes('PCM')) {
            assert.deepStrictEqual(pathIds, OBSERVED_PCM_PATH_IDS,
              `PCM stream should always produce ${JSON.stringify(OBSERVED_PCM_PATH_IDS)}`)
          } else if (stream.includes('PCB')) {
            assert.deepStrictEqual(pathIds, OBSERVED_PCB_PATH_IDS,
              `PCB stream should always produce ${JSON.stringify(OBSERVED_PCB_PATH_IDS)}`)
          } else if (stream.toLowerCase().includes('iti')) {
            // "Arts / Humanities" contains "iti" → triggers diploma track in current code
            assert.deepStrictEqual(pathIds, OBSERVED_DIPLOMA_PATH_IDS,
              `Stream "${stream}" (contains "iti") should produce diploma paths ${JSON.stringify(OBSERVED_DIPLOMA_PATH_IDS)}`)
          } else {
            // Commerce and other streams fall into the else branch → CA/BBA
            assert.deepStrictEqual(pathIds, OBSERVED_COMMERCE_PATH_IDS,
              `Non-PCM/PCB stream "${stream}" should produce ${JSON.stringify(OBSERVED_COMMERCE_PATH_IDS)}`)
          }
        }
      ),
      { numRuns: 20 }
    )
  })
})
