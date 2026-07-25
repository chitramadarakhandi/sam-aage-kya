/**
 * Tests — pathwayAdvisor retrieval, verification and fallback.
 *
 *  STAGE 1 (`retrieveCandidates`) is fully deterministic: no LLM, no DB. It is
 *  tested directly, including the anti-hallucination invariant that every
 *  candidate comes from the curated `indiaPathways` dataset.
 *
 *  STAGE 3 (verification) and STAGE 4 (deterministic fallback) of
 *  `recommendPathways` are covered too:
 *   - fallback: no API key → `callLLM` throws AI_UNAVAILABLE with no I/O
 *   - verification: `global.fetch` is stubbed in-process (no network) to return
 *     a payload containing hallucinated path_ids, which must be dropped.
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'

// ─── Env isolation (before importing the module under test) ─────────────────
const MANAGED_ENV = [
  'GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
]
const SAVED_ENV = {}
for (const key of MANAGED_ENV) {
  SAVED_ENV[key] = process.env[key]
  delete process.env[key]
}

const { retrieveCandidates, recommendPathways } = await import('./pathwayAdvisor.js')
const { AFTER_CLASS_10, AFTER_CLASS_12, findPathwayById } = await import('../data/indiaPathways.js')

const REAL_FETCH = global.fetch

after(() => {
  global.fetch = REAL_FETCH
  for (const key of MANAGED_ENV) {
    if (SAVED_ENV[key] === undefined) delete process.env[key]
    else process.env[key] = SAVED_ENV[key]
  }
})

const STREAM_IDS = new Set(AFTER_CLASS_10.map(s => s.id))
const COURSE_IDS = new Set(AFTER_CLASS_12.map(c => c.id))

// Answer sets that push the domain scorer in a known direction.
const TECH_ANSWERS = [
  { questionId: 'q_code', answer: 'yes' },
  { questionId: 'q_build', answer: 'yes' },
  { questionId: 'fc_data', answer: 'yes' },
  { questionId: 'q_bio', answer: 'no' },
]
const MEDICAL_ANSWERS = [
  { questionId: 'q_bio', answer: 'yes' },
  { questionId: 'fm_neet', answer: 'yes' },
  { questionId: 'fm_allied', answer: 'yes' },
  { questionId: 'q_code', answer: 'no' },
]
const COMMERCE_ANSWERS = [
  { questionId: 'q_numbers', answer: 'yes' },
  { questionId: 'fco_ca', answer: 'yes' },
  { questionId: 'q_lead', answer: 'yes' },
]

// ════════════════════════════════════════════════════════════════════════════
//  STAGE 1 — retrieveCandidates (deterministic)
// ════════════════════════════════════════════════════════════════════════════

describe('retrieveCandidates — class 10 returns STREAM candidates', () => {
  test('returns only after-class-10 streams, never after-12 courses', () => {
    const { classLevel, candidates } = retrieveCandidates({ classLevel: 'class10' }, TECH_ANSWERS)

    assert.equal(classLevel, 'class10')
    assert.ok(candidates.length > 0)
    for (const candidate of candidates) {
      assert.ok(STREAM_IDS.has(candidate.id), `"${candidate.id}" is not an after-class-10 option`)
      assert.ok(!COURSE_IDS.has(candidate.id))
      // Type is copied straight from the dataset entry (stream / diploma / ...).
      assert.equal(candidate.type, findPathwayById(candidate.id).type)
    }
  })

  test('tech-leaning answers rank a science/PCM-style stream first', () => {
    const { candidates } = retrieveCandidates({ classLevel: 'class10' }, TECH_ANSWERS)
    assert.equal(candidates[0].id, 'science_pcm')
    assert.ok(candidates[0]._score > 0)
  })

  test('medical-leaning answers rank PCB above commerce', () => {
    const { candidates } = retrieveCandidates({ classLevel: 'class10' }, MEDICAL_ANSWERS)
    const ids = candidates.map(c => c.id)
    assert.ok(ids.indexOf('science_pcb') !== -1)
    const commerceIndex = ids.indexOf('commerce_maths')
    if (commerceIndex !== -1) assert.ok(ids.indexOf('science_pcb') < commerceIndex)
  })

  test('with no answers it still returns a usable set of streams (never empty)', () => {
    const { candidates } = retrieveCandidates({ classLevel: 'class10' }, [])
    assert.ok(candidates.length >= 4)
    assert.ok(candidates.length <= 6)
    for (const candidate of candidates) assert.ok(STREAM_IDS.has(candidate.id))
  })
})

describe('retrieveCandidates — class 12 returns COURSE candidates', () => {
  test('defaults to class12 and returns only after-class-12 courses', () => {
    const { classLevel, candidates } = retrieveCandidates({}, TECH_ANSWERS)

    assert.equal(classLevel, 'class12')
    assert.ok(candidates.length > 0)
    assert.ok(candidates.length <= 14, 'candidate list must stay capped at 14')
    for (const candidate of candidates) {
      assert.ok(COURSE_IDS.has(candidate.id), `"${candidate.id}" is not an after-class-12 course`)
      assert.ok(!STREAM_IDS.has(candidate.id))
    }
  })

  test('candidates come from the top-ranked domains', () => {
    const { rankedDomains, candidates } = retrieveCandidates({}, TECH_ANSWERS)
    const topDomains = new Set(rankedDomains.slice(0, 5).map(d => d.id))
    for (const candidate of candidates) {
      assert.ok(topDomains.has(candidate.domain), `"${candidate.id}" is outside the top-5 domains`)
    }
  })

  test('stream eligibility filters out courses the student cannot take', () => {
    const { candidates } = retrieveCandidates(
      { classLevel: 'class12', stream: 'Science (PCB)' },
      MEDICAL_ANSWERS
    )

    assert.ok(candidates.length >= 3)
    for (const candidate of candidates) {
      const eligible = candidate.eligibleStreams.includes('any') || candidate.eligibleStreams.includes('science_pcb')
      assert.ok(eligible, `"${candidate.id}" is not open to a Science (PCB) student`)
    }
  })

  test('an explicit streamId is honoured the same way as a stream name', () => {
    const byName = retrieveCandidates({ classLevel: 'class12', stream: 'Commerce with Mathematics' }, COMMERCE_ANSWERS)
    const byId = retrieveCandidates({ classLevel: 'class12', streamId: 'commerce_maths' }, COMMERCE_ANSWERS)

    assert.deepStrictEqual(byId.candidates.map(c => c.id), byName.candidates.map(c => c.id))
    for (const candidate of byId.candidates) {
      const eligible = candidate.eligibleStreams.includes('any') || candidate.eligibleStreams.includes('commerce_maths')
      assert.ok(eligible, `"${candidate.id}" is not open to a commerce_maths student`)
    }
  })

  test('an unknown stream name does not filter anything out (degrades, not empty)', () => {
    const { candidates } = retrieveCandidates({ classLevel: 'class12', stream: 'Totally Unknown Stream' }, TECH_ANSWERS)
    assert.ok(candidates.length > 0)
    for (const candidate of candidates) assert.ok(COURSE_IDS.has(candidate.id))
  })

  /**
   * Anti-hallucination invariant: whatever the answers, every candidate id must
   * resolve inside the curated dataset for that class level.
   */
  test('Property: candidates are always inside the curated indiaPathways dataset', () => {
    const answerArb = fc.array(
      fc.record({
        questionId: fc.constantFrom(
          'q_build', 'q_code', 'q_bio', 'q_numbers', 'q_lead', 'q_argue', 'q_create',
          'q_express', 'q_people', 'q_nature', 'q_science_why', 'q_uniform', 'q_hands',
          'q_teach', 'q_travel', 'fc_data', 'fm_neet', 'fco_ca', 'fd_ux',
          'not_a_real_question_id'
        ),
        answer: fc.constantFrom('yes', 'no', 'skip'),
      }),
      { maxLength: 12 }
    )

    fc.assert(
      fc.property(
        answerArb,
        fc.constantFrom('class10', 'class12', undefined),
        fc.constantFrom('Science (PCM)', 'Science (PCB)', 'Commerce with Mathematics', 'Arts / Humanities', '', undefined),
        (answers, classLevel, stream) => {
          const { candidates, classLevel: resolved } = retrieveCandidates({ classLevel, stream }, answers)
          const allowed = resolved === 'class10' ? STREAM_IDS : COURSE_IDS

          assert.ok(candidates.length > 0, 'candidate list must never be empty')
          for (const candidate of candidates) {
            assert.ok(allowed.has(candidate.id), `"${candidate.id}" is outside the curated dataset`)
            assert.ok(findPathwayById(candidate.id) !== null)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  STAGE 4 — deterministic fallback when the LLM is unavailable
// ════════════════════════════════════════════════════════════════════════════

describe('recommendPathways — STAGE 4 deterministic fallback (no AI key, no network)', () => {
  let fetchCalls

  before(() => {
    fetchCalls = 0
    global.fetch = async () => { fetchCalls++; return { ok: false, status: 500, text: async () => 'never' } }
  })

  after(() => { global.fetch = REAL_FETCH })

  test('class12 fallback returns dataset-grounded options and reports usedFallback', async () => {
    const result = await recommendPathways(
      { classLevel: 'class12', stream: 'Science (PCM)', marks: '85', state: 'Karnataka', interests: 'apps' },
      TECH_ANSWERS
    )

    assert.equal(fetchCalls, 0, 'no network call may be attempted without an API key')
    assert.equal(result.meta.usedFallback, true)
    assert.equal(result.meta.grounded, true)
    assert.deepStrictEqual(result.meta.droppedHallucinations, [])
    assert.equal(result.meta.collegesAvailable, false)
    assert.equal(result.ai_status.available, false)

    assert.ok(result.options.length > 0 && result.options.length <= 4)
    for (const option of result.options) {
      assert.ok(COURSE_IDS.has(option.id), `"${option.id}" is not in the dataset`)
      assert.equal(option.type, 'course')
      assert.equal(option.verified, true)
      // Facts are copied from the dataset, never invented.
      const truth = findPathwayById(option.id)
      assert.equal(option.name, truth.name)
      assert.deepStrictEqual(option.entrance_exams, truth.entranceExams)
      assert.equal(option.duration_years, truth.durationYears)
      // Template prose + a confidence score are still produced.
      assert.ok(option.why_this_fits.length > 0)
      assert.ok(option.honest_note.length > 0)
      assert.equal(option.fit_label, 'Good Fit')
      assert.ok(option.confidence.score >= 0 && option.confidence.score <= 100)
    }

    assert.ok(result.overall_advice.length > 0)
    assert.ok(result.explore_next.length > 0)
    assert.equal(typeof result.overall_confidence.score, 'number')
    assert.equal(typeof result.discovery.new_fields_count, 'number')
    assert.deepStrictEqual(result.location, { state: 'Karnataka', city: '' })
  })

  test('class10 fallback returns stream options with stream-shaped fields', async () => {
    const result = await recommendPathways({ classLevel: 'class10', marks: '80' }, MEDICAL_ANSWERS)

    assert.equal(result.classLevel, 'class10')
    assert.equal(result.meta.usedFallback, true)
    assert.ok(result.options.length > 0)
    for (const option of result.options) {
      assert.ok(STREAM_IDS.has(option.id))
      assert.equal(option.type, 'stream')
      assert.ok(Array.isArray(option.subjects) && option.subjects.length > 0)
      assert.ok(Array.isArray(option.leads_to))
      assert.equal(option.verified, true)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  STAGE 3 — verification drops hallucinated path_ids
// ════════════════════════════════════════════════════════════════════════════

describe('recommendPathways — STAGE 3 verification against the dataset', () => {
  const FORM = { classLevel: 'class12', stream: 'Science (PCM)', marks: '85', interests: 'apps' }

  function stubLlm(buildPayload) {
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    global.fetch = async (_url, init) => {
      const prompt = JSON.parse(init.body).messages[0].content
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(buildPayload(prompt)) } }],
          usage: { total_tokens: 30 },
        }),
      }
    }
  }

  after(() => {
    global.fetch = REAL_FETCH
    delete process.env.GROQ_API_KEY
  })

  test('unknown / hallucinated path_ids are dropped, valid ones survive', async () => {
    const { candidates } = retrieveCandidates(FORM, TECH_ANSWERS)
    const validId = candidates[0].id

    stubLlm(() => ({
      recommendations: [
        { id: validId, why_this_fits: 'Fits your interest in apps.', honest_note: 'Competitive.', fit_label: 'Strong Fit' },
        { id: 'totally_fake_course', why_this_fits: 'Invented.', honest_note: 'Invented.', fit_label: 'Good Fit' },
        { id: 'btech_time_travel', why_this_fits: 'Invented.', honest_note: 'Invented.', fit_label: 'Good Fit' },
      ],
      overall_advice: 'Stubbed advice.',
      explore_next: 'Stubbed nudge.',
    }))

    const result = await recommendPathways(FORM, TECH_ANSWERS)

    assert.deepStrictEqual(result.options.map(o => o.id), [validId])
    assert.deepStrictEqual(result.meta.droppedHallucinations.sort(), ['btech_time_travel', 'totally_fake_course'])
    assert.equal(result.meta.usedFallback, false)
    assert.equal(result.options[0].fit_label, 'Strong Fit')
    assert.equal(result.options[0].why_this_fits, 'Fits your interest in apps.')
    // Facts still come from the dataset, not the model.
    const truth = findPathwayById(validId)
    assert.equal(result.options[0].name, truth.name)
    assert.deepStrictEqual(result.options[0].entrance_exams, truth.entranceExams)
    assert.equal(result.options[0].approx_annual_fee, truth.approxAnnualFee)
  })

  test('a real dataset course that was NOT offered as a candidate is still dropped', async () => {
    // 'mbbs' is a real course, but a PCM student with tech answers is never
    // offered it — selecting it is out-of-scope and must not survive.
    stubLlm(() => ({
      recommendations: [{ id: 'mbbs', why_this_fits: 'Out of scope.', honest_note: 'Out of scope.', fit_label: 'Good Fit' }],
      overall_advice: 'Stubbed advice.',
      explore_next: 'Stubbed nudge.',
    }))

    const result = await recommendPathways(FORM, TECH_ANSWERS)

    assert.ok(!result.options.some(o => o.id === 'mbbs'))
    assert.ok(result.meta.droppedHallucinations.includes('mbbs'))
    // Everything dropped → STAGE 4 fallback still gives the student real options.
    assert.equal(result.meta.usedFallback, true)
    assert.ok(result.options.length > 0)
    for (const option of result.options) assert.ok(COURSE_IDS.has(option.id))
  })

  test('an unrecognised fit_label is normalised instead of passed through', async () => {
    const { candidates } = retrieveCandidates(FORM, TECH_ANSWERS)
    const validId = candidates[0].id

    stubLlm(() => ({
      recommendations: [
        { id: validId, why_this_fits: 'Fits <script>you</script>.', honest_note: 'Honest.', fit_label: 'Perfect Ultra Fit' },
      ],
      overall_advice: 'Stubbed advice.',
      explore_next: 'Stubbed nudge.',
    }))

    const result = await recommendPathways(FORM, TECH_ANSWERS)

    assert.equal(result.options[0].fit_label, 'Good Fit')
    // Angle brackets are stripped by the sanitizer.
    assert.ok(!result.options[0].why_this_fits.includes('<'))
    assert.ok(!result.options[0].why_this_fits.includes('>'))
  })
})
