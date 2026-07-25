/**
 * Bug Condition Exploration Test — Stream-Exam Mismatch Produces Wrong Recommendations
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * Property 1: Bug Condition — When a student's stream and preferred exam are
 * incompatible (Commerce+JEE, Arts+NEET), the system SHOULD detect the mismatch
 * and produce bridge/reconciliation paths with an advisory. Instead, the current
 * (unfixed) code ignores the exam preference and falls through to the generic
 * else branch (CA/BBA for both cases).
 *
 * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT fix the test or the code when it fails.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { runCareerRecommendationAgent, runSummaryAgent } from './Orchestrator.js'

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Exercises the fallback path of runCareerRecommendationAgent by setting
 * environment so LLM is unavailable (no API key). The function's try/catch
 * will hit the catch and use the local mock fallback.
 */
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
    careerPaths: { recommendations: [] },
    collegeRecommendations: [],
    scholarshipRecommendations: [],
  }
}

// ─── Bug Condition Tests ────────────────────────────────────────────────────────

describe('Bug Condition Exploration: Stream-Exam Mismatch', () => {
  /**
   * Commerce + JEE mismatch:
   * - JEE is an engineering entrance exam, incompatible with Commerce stream
   * - Expected (correct behavior): bridge/reconciliation paths + mismatch advisory
   * - Actual (bug): CA/BBA recommended (stream-only fallback ignores JEE)
   */
  test('Property 1a: Commerce+JEE — should NOT contain CA/BBA and SHOULD contain bridge paths with mismatch advisory', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate Commerce+JEE mismatch inputs with slight variations
        fc.record({
          stream: fc.constantFrom('Commerce', 'commerce'),
          preferredModeOfAdmission: fc.constantFrom('JEE', 'JEE Main', 'jee'),
        }),
        async ({ stream, preferredModeOfAdmission }) => {
          const state = buildState({ stream, preferredModeOfAdmission })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const allPathNames = paths.map(p => (p.path || '').toLowerCase()).join(' ')
          const allPathIds = paths.map(p => (p.path_id || '').toLowerCase()).join(' ')
          const combined = allPathNames + ' ' + allPathIds

          // EXPECTED BEHAVIOR (will fail on unfixed code):
          // 1. Should NOT contain CA/BBA as primary recommendations
          assert.ok(
            !combined.includes('chartered accountancy') && !combined.includes('ca_finance'),
            `Commerce+JEE should NOT recommend CA but got: ${paths.map(p => p.path).join(', ')}`
          )
          assert.ok(
            !combined.includes('bba') && !combined.includes('bba_finance'),
            `Commerce+JEE should NOT recommend BBA but got: ${paths.map(p => p.path).join(', ')}`
          )

          // 2. Should contain bridge/reconciliation paths that honor JEE interest
          const hasBridgePaths = combined.includes('lateral') ||
            combined.includes('bridge') ||
            combined.includes('b.tech') ||
            combined.includes('engineering') ||
            combined.includes('quant') ||
            combined.includes('reconcil')
          assert.ok(
            hasBridgePaths,
            `Commerce+JEE should contain bridge paths (lateral entry, B.Tech, quant) but got: ${paths.map(p => p.path).join(', ')}`
          )

          // 3. Should contain a mismatch advisory
          const resultStr = JSON.stringify(result).toLowerCase()
          const hasAdvisory = resultStr.includes('mismatch') ||
            resultStr.includes('advisory') ||
            resultStr.includes('conflict') ||
            resultStr.includes('incompatible')
          assert.ok(
            hasAdvisory,
            `Commerce+JEE should contain a mismatch advisory but response was: ${JSON.stringify(result).slice(0, 200)}`
          )
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Arts + NEET mismatch:
   * - NEET is a medical entrance exam, incompatible with Arts / Humanities stream
   * - Expected (correct behavior): healthcare-adjacent bridge paths + mismatch advisory
   * - Actual (bug): CA/BBA recommended (else branch, ignores NEET entirely)
   */
  test('Property 1b: Arts+NEET — should NOT contain generic stream defaults and SHOULD contain healthcare-adjacent bridge paths', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stream: fc.constantFrom('Arts / Humanities', 'Arts/Humanities', 'arts / humanities'),
          preferredModeOfAdmission: fc.constantFrom('NEET', 'NEET-UG', 'neet'),
        }),
        async ({ stream, preferredModeOfAdmission }) => {
          const state = buildState({ stream, preferredModeOfAdmission })
          const result = await runCareerRecommendationAgent(state)

          const paths = result.recommendations || []
          const allPathNames = paths.map(p => (p.path || '').toLowerCase()).join(' ')
          const allPathIds = paths.map(p => (p.path_id || '').toLowerCase()).join(' ')
          const combined = allPathNames + ' ' + allPathIds

          // EXPECTED BEHAVIOR (will fail on unfixed code):
          // 1. Should NOT contain CA/BBA (generic else-branch defaults)
          assert.ok(
            !combined.includes('chartered accountancy') && !combined.includes('ca_finance'),
            `Arts+NEET should NOT recommend CA but got: ${paths.map(p => p.path).join(', ')}`
          )
          assert.ok(
            !combined.includes('bba') && !combined.includes('bba_finance'),
            `Arts+NEET should NOT recommend BBA but got: ${paths.map(p => p.path).join(', ')}`
          )

          // 2. Should contain healthcare-adjacent bridge paths honoring NEET interest
          const hasHealthcareBridge = combined.includes('healthcare') ||
            combined.includes('health') ||
            combined.includes('psychology') ||
            combined.includes('public health') ||
            combined.includes('bha') ||
            combined.includes('medical') ||
            combined.includes('bridge')
          assert.ok(
            hasHealthcareBridge,
            `Arts+NEET should contain healthcare-adjacent bridge paths but got: ${paths.map(p => p.path).join(', ')}`
          )

          // 3. Should contain a mismatch advisory
          const resultStr = JSON.stringify(result).toLowerCase()
          const hasAdvisory = resultStr.includes('mismatch') ||
            resultStr.includes('advisory') ||
            resultStr.includes('conflict') ||
            resultStr.includes('incompatible')
          assert.ok(
            hasAdvisory,
            `Arts+NEET should contain a mismatch advisory but response was: ${JSON.stringify(result).slice(0, 200)}`
          )
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Summary agent fallback with empty preferredState:
   * - When preferredState is empty string, the fallback should NOT produce
   *   "top institutions in undefined" or broken geographic placeholder text
   * - Expected: omit geographic reference or use "across India"
   * - Actual (bug): produces "top institutions in India" (minor) or with
   *   undefined/empty interpolation issue
   */
  test('Property 1c: Summary fallback with empty state — should NOT produce broken geographic placeholders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          preferredState: fc.constantFrom('', ' ', undefined),
          stream: fc.constantFrom('Commerce', 'Arts / Humanities', 'Science (PCM)'),
        }),
        async ({ preferredState, stream }) => {
          const state = buildState({
            stream,
            preferredState: preferredState,
          })
          // Provide minimal state for summary agent
          state.careerPaths = { recommendations: [{ path: 'Test Path', path_id: 'test' }] }
          state.collegeRecommendations = []
          state.scholarshipRecommendations = []

          const result = await runSummaryAgent(state)

          const summary = (result.summary || '').toLowerCase()

          // EXPECTED BEHAVIOR:
          // Should NOT produce "top institutions in undefined" or empty geographic reference
          assert.ok(
            !summary.includes('in undefined'),
            `Summary should not contain "in undefined" but got: "${result.summary}"`
          )
          assert.ok(
            !summary.includes('in null'),
            `Summary should not contain "in null" but got: "${result.summary}"`
          )
          // Should not have "in " followed by nothing meaningful (broken interpolation)
          assert.ok(
            !summary.includes('institutions in  '),
            `Summary should not have empty geographic placeholder but got: "${result.summary}"`
          )
        }
      ),
      { numRuns: 5 }
    )
  })
})
