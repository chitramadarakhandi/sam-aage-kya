/**
 * Pipeline tests — runMultiAgentOrchestrator end-to-end + response assembly.
 *
 * These cover the three production paths that had no automated coverage:
 *
 *  (a) COMBINED-AGENT SUCCESS — the whole orchestrator run when the single
 *      combined LLM call returns a well-formed payload. Asserts the assembled
 *      response has the exact shape the frontend consumes.
 *
 *  (b) COMBINED-AGENT FAILURE FALLBACK — the per-agent pipeline. This is the
 *      regression guard for the sequential Profile → Career → Roadmap chain:
 *      the career agent must observe a populated `state.profileAnalysis` and the
 *      roadmap agent must observe populated `state.careerPaths`. A `Promise.all`
 *      version of that branch races and fails these tests.
 *
 *  (c) path_id JOIN DEGRADATION — `assembleGuidanceResponse`'s matchMapping
 *      helper joins careerPaths ↔ collegeRecommendations ↔ roadmaps. When an LLM
 *      omits `path_id` the join must fall back to normalized path text, and when
 *      nothing matches it must degrade to empty arrays instead of throwing.
 *
 * DETERMINISM: no network and no Supabase.
 *  - All AI-key env vars are deleted BEFORE importing the module under test, so
 *    `isAiAvailable()` is false and `callLLM` throws AI_UNAVAILABLE with no I/O.
 *  - Supabase env vars are deleted too, so the orchestrator's client is null and
 *    the RAG agent returns empty lists with no I/O.
 *  - Where a *successful* LLM response is required, `global.fetch` is replaced
 *    with an in-process stub (and a fake key set), so still no network.
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'

// ─── Env isolation (must happen before importing Orchestrator.js) ────────────
const MANAGED_ENV = [
  'GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
]
const SAVED_ENV = {}
for (const key of MANAGED_ENV) {
  SAVED_ENV[key] = process.env[key]
  delete process.env[key]
}

const { runMultiAgentOrchestrator, assembleGuidanceResponse, COST_DATA_UNAVAILABLE } = await import('./Orchestrator.js')

const REAL_FETCH = global.fetch

after(() => {
  global.fetch = REAL_FETCH
  for (const key of MANAGED_ENV) {
    if (SAVED_ENV[key] === undefined) delete process.env[key]
    else process.env[key] = SAVED_ENV[key]
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function baseForm(overrides = {}) {
  return {
    fullName: 'Test Student',
    classLevel: 'class12',
    board: 'CBSE',
    marks: '88',
    state: 'Maharashtra',
    stream: 'Science (PCM)',
    incomeRange: '2.5L-5L',
    interests: 'building apps',
    biggestFear: 'not getting a job',
    preferredState: '',
    preferredCity: '',
    preferredModeOfAdmission: '',
    budget: '1L-3L',
    ...overrides,
  }
}

/** Minimal OpenAI-compatible success response for the shared LLM client. */
function llmOk(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
      usage: { total_tokens: 42 },
    }),
  }
}

function llmError(status = 500, body = 'stubbed provider error') {
  return { ok: false, status, text: async () => body }
}

/**
 * Install a fetch stub that routes on prompt content. `routes` is a list of
 * [substring, handler(prompt)] pairs. Every intercepted prompt is recorded.
 * A fake key is set so `isAiAvailable()` returns true — no network is used
 * because fetch itself is replaced.
 */
function installLlmStub(routes) {
  const prompts = []
  process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    const prompt = body.messages[0].content
    prompts.push(prompt)
    for (const [needle, handler] of routes) {
      if (prompt.includes(needle)) return handler(prompt)
    }
    return llmError(500, 'no stub route matched')
  }
  return {
    prompts,
    find: (needle) => prompts.find(p => p.includes(needle)),
  }
}

function restoreLlmStub() {
  global.fetch = REAL_FETCH
  delete process.env.GROQ_API_KEY
}

const COMBINED_PROMPT_MARKER = 'produce guidance in ONE JSON response'
const PROFILE_AGENT_MARKER = 'You are the Profile Analysis Agent'
const CAREER_AGENT_MARKER = 'You are the Career Recommendation Agent'
const ROADMAP_AGENT_MARKER = 'You are the Career Roadmap Agent'
const SUMMARY_AGENT_MARKER = 'You are the Summary Agent'

function roadmapYears(tag) {
  return [1, 2, 3, 4].map(year => ({
    year,
    focus: `${tag} year ${year} focus`,
    skills: [`${tag} skill ${year}`],
    certifications: [`${tag} cert ${year}`],
    projects: [`${tag} project ${year}`],
    milestones: [`${tag} milestone ${year}`],
  }))
}

const CANNED_COMBINED = {
  profile: {
    academicStanding: 'High — 88% (Good)',
    financialCategory: 'Affordable',
    riskAppetite: 'Balanced',
    keyConstraints: ['Budget limits'],
    keyStrengths: ['Interest in building apps'],
    coachingNeeds: 'Targeted JEE coaching',
  },
  summary: 'You have a strong PCM profile with real interest in software.',
  oneThingToDoThisWeek: 'Register for the JEE Main information bulletin.',
  recommendations: [
    {
      path_id: 'btech_cs_ai',
      path: 'B.Tech Computer Science & AI',
      honest_take: 'Competitive but a great fit. Consistent coding matters more than the college brand.',
      requires_entrance_exam: 'JEE Main',
      opens_doors_to: ['Software Engineer', 'ML Engineer'],
      watch_out_for: 'Market saturation without projects.',
      backup_plan: 'BCA then MCA.',
      roadmap_years: roadmapYears('cs'),
    },
    {
      path_id: 'bsc_data_science',
      path: 'B.Sc Data Science',
      honest_take: 'A lighter-entry analytics route. Needs strong statistics.',
      requires_entrance_exam: 'CUET',
      opens_doors_to: ['Data Analyst'],
      watch_out_for: 'College quality varies a lot.',
      backup_plan: 'B.Sc IT.',
      roadmap_years: roadmapYears('ds'),
    },
  ],
}

// ════════════════════════════════════════════════════════════════════════════
//  (a) COMBINED-AGENT SUCCESS PATH
// ════════════════════════════════════════════════════════════════════════════

describe('runMultiAgentOrchestrator — combined-agent success path', () => {
  let result
  let stub

  before(async () => {
    stub = installLlmStub([[COMBINED_PROMPT_MARKER, () => llmOk(CANNED_COMBINED)]])
    result = await runMultiAgentOrchestrator(baseForm())
  })

  after(() => restoreLlmStub())

  test('exactly one LLM call is made (the combined agent)', () => {
    assert.equal(stub.prompts.length, 1)
    assert.ok(stub.find(COMBINED_PROMPT_MARKER))
    // The per-agent fallback agents must NOT have run.
    assert.equal(stub.find(CAREER_AGENT_MARKER), undefined)
    assert.equal(stub.find(ROADMAP_AGENT_MARKER), undefined)
  })

  test('top-level response has every field the frontend consumes', () => {
    for (const key of [
      'summary', 'options', 'scholarship_to_check', 'one_thing_to_do_this_week',
      'scholarships_list', 'study_abroad', 'mentors', 'youtube_videos',
      'colleges_data', 'explainability', 'ai_status',
    ]) {
      assert.ok(key in result, `missing top-level key "${key}"`)
    }

    assert.equal(result.summary, CANNED_COMBINED.summary)
    assert.equal(result.one_thing_to_do_this_week, CANNED_COMBINED.oneThingToDoThisWeek)
    assert.ok(Array.isArray(result.options))
    assert.equal(result.options.length, 2)
    assert.ok(Array.isArray(result.scholarships_list) && result.scholarships_list.length > 0)
    assert.ok(typeof result.scholarship_to_check === 'string' && result.scholarship_to_check.length > 0)
    assert.ok(Array.isArray(result.mentors) && result.mentors.length > 0)
    assert.ok(Array.isArray(result.youtube_videos))
    assert.equal(typeof result.study_abroad, 'object')
    assert.equal(typeof result.colleges_data, 'object')
  })

  test('each option carries the full option contract', () => {
    for (const [i, option] of result.options.entries()) {
      const expected = CANNED_COMBINED.recommendations[i]
      assert.equal(option.path, expected.path)
      assert.equal(option.honest_take, expected.honest_take)
      assert.equal(option.requires_entrance_exam, expected.requires_entrance_exam)
      assert.deepStrictEqual(option.opens_doors_to, expected.opens_doors_to)
      assert.equal(option.watch_out_for, expected.watch_out_for)
      assert.equal(option.backup_plan, expected.backup_plan)

      assert.ok(Array.isArray(option.realistic_colleges))
      assert.ok(option.realistic_colleges.length > 0, `option "${option.path}" has no colleges`)
      assert.ok(option.realistic_colleges.every(name => typeof name === 'string' && name.length > 0))
      assert.match(option.avg_yearly_cost, /₹/)

      // roadmap_steps must be the 4 years produced by the combined payload.
      assert.equal(option.roadmap_steps.length, 4)
      assert.deepStrictEqual(option.roadmap_steps, expected.roadmap_years)
    }
  })

  test('explainability reports duration, per-agent steps, profile and guardrail', () => {
    const { explainability } = result
    assert.equal(typeof explainability.totalDurationMs, 'number')
    assert.ok(explainability.totalDurationMs >= 0)
    assert.deepStrictEqual(explainability.profile, CANNED_COMBINED.profile)

    assert.ok(Array.isArray(explainability.steps) && explainability.steps.length > 0)
    const agents = explainability.steps.map(s => s.agent)
    assert.ok(agents.includes('Combined Guidance Agent'))
    assert.ok(agents.includes('Search & Retrieval Agent'))
    assert.ok(agents.includes('College Recommendation Agent'))
    for (const step of explainability.steps) {
      assert.ok(['success', 'failed'].includes(step.status))
      assert.equal(typeof step.durationMs, 'number')
      assert.equal(typeof step.timestamp, 'string')
    }

    assert.equal(typeof explainability.guardrail, 'object')
    assert.equal(typeof explainability.guardrail.removedUnsupportedCollegeClaims, 'number')
    assert.equal(typeof explainability.guardrail.removedUnsupportedScholarshipClaim, 'boolean')
  })

  test('ai_status reports the AI as available on the success path', () => {
    assert.equal(result.ai_status.available, true)
    assert.equal(result.ai_status.lastProvider, 'groq')
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  (b) COMBINED-AGENT FAILURE → SEQUENTIAL FALLBACK PIPELINE
//      REGRESSION GUARD for the profile → career → roadmap threading.
// ════════════════════════════════════════════════════════════════════════════

describe('runMultiAgentOrchestrator — fallback pipeline threads profile → career → roadmap', () => {
  /**
   * Fully degraded run: no API keys at all, so every agent falls back to its
   * deterministic in-code mock and NOTHING touches the network.
   *
   * The roadmap agent's mock builds each roadmap from `state.careerPaths`
   * (path name + entrance exam). If those three agents run concurrently
   * (`Promise.all`), `state.careerPaths` is still the initial `[]` when the
   * roadmap agent runs, so `careerPaths.recommendations` is undefined and the
   * roadmaps come back EMPTY — which these assertions catch.
   */
  describe('fully degraded (no keys, no network)', () => {
    let result
    let fetchCalls

    before(async () => {
      fetchCalls = 0
      global.fetch = async () => { fetchCalls++; return llmError(500, 'should never be called') }
      // PCB stream: the two mock paths get *different* domain-aware roadmaps,
      // which is what proves the roadmap agent saw the real career paths.
      result = await runMultiAgentOrchestrator(baseForm({ stream: 'Science (PCB)', marks: '82' }))
    })

    after(() => { global.fetch = REAL_FETCH })

    test('makes no network calls when no API key is configured', () => {
      assert.equal(fetchCalls, 0)
      assert.equal(result.ai_status.available, false)
    })

    test('the three fallback agents each recorded an explainability step', () => {
      const agents = result.explainability.steps.map(s => s.agent)
      for (const agent of ['Profile Analysis Agent', 'Career Recommendation Agent', 'Career Roadmap Agent']) {
        assert.ok(agents.includes(agent), `missing step for "${agent}"`)
      }
      // And they ran in dependency order.
      assert.ok(agents.indexOf('Profile Analysis Agent') < agents.indexOf('Career Recommendation Agent'))
      assert.ok(agents.indexOf('Career Recommendation Agent') < agents.indexOf('Career Roadmap Agent'))
    })

    test('the profile agent output reached the response (explainability.profile)', () => {
      const profile = result.explainability.profile
      assert.ok(profile && typeof profile === 'object')
      assert.match(profile.academicStanding, /82/)
      assert.ok(Array.isArray(profile.keyStrengths) && profile.keyStrengths.length > 0)
    })

    test('REGRESSION: every option has a NON-EMPTY roadmap (proves the roadmap agent saw state.careerPaths)', () => {
      assert.ok(result.options.length >= 2, 'expected the PCB mock to produce at least 2 paths')
      for (const option of result.options) {
        assert.ok(
          Array.isArray(option.roadmap_steps) && option.roadmap_steps.length === 4,
          `option "${option.path}" has roadmap_steps=${JSON.stringify(option.roadmap_steps)} — ` +
          `an empty roadmap means the roadmap agent ran before state.careerPaths was populated`
        )
        assert.deepStrictEqual(option.roadmap_steps.map(y => y.year), [1, 2, 3, 4])
      }
    })

    test('REGRESSION: roadmaps correspond to their own path, not a generic one', () => {
      const physio = result.options.find(o => /physiotherapy/i.test(o.path))
      const biotech = result.options.find(o => /biotech/i.test(o.path))
      assert.ok(physio, 'expected a physiotherapy path in the PCB mock')
      assert.ok(biotech, 'expected a biotech path in the PCB mock')

      // Domain-aware: the physio roadmap is the medical one, biotech gets the
      // science/engineering one. Identical roadmaps would mean the roadmap agent
      // never saw the actual path names.
      assert.match(physio.roadmap_steps[0].focus, /biology & chemistry/i)
      assert.match(biotech.roadmap_steps[0].focus, /core fundamentals/i)
      assert.notEqual(physio.roadmap_steps[0].focus, biotech.roadmap_steps[0].focus)

      // The roadmap also echoes the career path's entrance exam — only reachable
      // from state.careerPaths.
      const certs = physio.roadmap_steps.flatMap(y => y.certifications).join(' | ')
      assert.match(certs, new RegExp(physio.requires_entrance_exam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
    })
  })

  /**
   * Same fallback branch, but with the per-agent LLM calls stubbed so we can
   * read the EXACT prompts each agent built. This directly observes what the
   * career agent and roadmap agent saw in `state`:
   *   - the career prompt interpolates `Profile Analysis: ${JSON.stringify(...)}`
   *   - the roadmap prompt interpolates `Career Options: ${JSON.stringify(...)}`
   * Under a racing `Promise.all` those read `null` and `[]` respectively.
   */
  describe('with per-agent LLM calls stubbed (prompt inspection)', () => {
    const PROFILE_MARKER = 'PROFILE_MARKER_FROM_PROFILE_AGENT'
    const PATH_ID_MARKER = 'career_marker_path'

    let stub
    let result

    before(async () => {
      stub = installLlmStub([
        // Combined agent fails → orchestrator takes the per-agent fallback.
        [COMBINED_PROMPT_MARKER, () => llmError(500, 'combined agent unavailable')],
        [PROFILE_AGENT_MARKER, () => llmOk({
          academicStanding: PROFILE_MARKER,
          financialCategory: 'Affordable',
          riskAppetite: 'Balanced',
          keyConstraints: ['Budget limits'],
          keyStrengths: ['Interest in building apps'],
          coachingNeeds: 'Self-study plus targeted coaching',
        })],
        [CAREER_AGENT_MARKER, () => llmOk({
          recommendations: [{
            path_id: PATH_ID_MARKER,
            path: 'B.Tech Computer Science & AI',
            honest_take: 'Competitive but a good fit.',
            requires_entrance_exam: 'JEE Main',
            opens_doors_to: ['Software Engineer'],
            watch_out_for: 'Needs projects.',
            backup_plan: 'BCA then MCA.',
          }],
        })],
        [ROADMAP_AGENT_MARKER, () => llmOk({
          roadmaps: [{
            path_id: PATH_ID_MARKER,
            path: 'B.Tech Computer Science & AI',
            years: roadmapYears('stubbed'),
          }],
        })],
        [SUMMARY_AGENT_MARKER, () => llmOk({
          summary: 'Stubbed summary.',
          oneThingToDoThisWeek: 'Stubbed action.',
        })],
      ])
      result = await runMultiAgentOrchestrator(baseForm())
    })

    after(() => restoreLlmStub())

    test('the fallback pipeline actually ran (combined call failed)', () => {
      assert.ok(stub.find(COMBINED_PROMPT_MARKER))
      assert.ok(stub.find(PROFILE_AGENT_MARKER))
      assert.ok(stub.find(CAREER_AGENT_MARKER))
      assert.ok(stub.find(ROADMAP_AGENT_MARKER))

      const combinedStep = result.explainability.steps.find(s => s.agent === 'Combined Guidance Agent')
      assert.equal(combinedStep.status, 'failed')
    })

    test('REGRESSION: the Career Recommendation Agent observed a non-null state.profileAnalysis', () => {
      const careerPrompt = stub.find(CAREER_AGENT_MARKER)
      assert.ok(
        careerPrompt.includes(PROFILE_MARKER),
        'the career agent prompt did not contain the profile agent output — it ran before ' +
        'state.profileAnalysis was assigned (racing Promise.all)'
      )
      assert.ok(!careerPrompt.includes('Profile Analysis: null'))
      assert.ok(!careerPrompt.includes('Profile Analysis: undefined'))
    })

    test('REGRESSION: the Career Roadmap Agent observed populated state.careerPaths', () => {
      const roadmapPrompt = stub.find(ROADMAP_AGENT_MARKER)
      assert.ok(
        roadmapPrompt.includes(PATH_ID_MARKER),
        'the roadmap agent prompt did not contain the career agent output — it ran before ' +
        'state.careerPaths was assigned (racing Promise.all)'
      )
      assert.ok(!roadmapPrompt.includes('Career Options: []'))
      assert.ok(!roadmapPrompt.includes('Career Options: {"recommendations":[]}'))
    })

    test('the threaded roadmap is joined onto the option by path_id', () => {
      assert.equal(result.options.length, 1)
      assert.deepStrictEqual(result.options[0].roadmap_steps, roadmapYears('stubbed'))
      assert.equal(result.summary, 'Stubbed summary.')
      assert.equal(result.explainability.profile.academicStanding, PROFILE_MARKER)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  (c) path_id JOIN DEGRADATION — assembleGuidanceResponse
// ════════════════════════════════════════════════════════════════════════════

const COLLEGE = {
  name: 'RV College of Engineering',
  city: 'Bangalore',
  state: 'Karnataka',
  feeRange: '₹1,40,000–₹2,25,000/yr',
  admissionMode: 'KCET',
  whyFit: 'Strong placements.',
}

/**
 * Build a completed orchestration state. `career`, `mapping` and `roadmap`
 * carry only the identity fields (path_id / path) each test wants to vary.
 */
function buildAssemblyState({ career, mapping, roadmap }) {
  return {
    formData: baseForm(),
    profileAnalysis: { academicStanding: 'High', keyStrengths: [], keyConstraints: [] },
    retrievedColleges: [],
    retrievedScholarships: [],
    careerPaths: {
      recommendations: [{
        honest_take: 'Honest take.',
        requires_entrance_exam: 'JEE Main',
        opens_doors_to: ['Software Engineer'],
        watch_out_for: 'Competition.',
        backup_plan: 'BCA.',
        ...career,
      }],
    },
    collegeRecommendations: [{ colleges: [COLLEGE], ...mapping }],
    scholarshipRecommendations: [],
    studyAbroadGuidance: { isFeasible: false },
    roadmaps: [{ years: roadmapYears('joined'), ...roadmap }],
    mentorMatches: [],
    youtubeResources: [],
    finalSummary: { summary: 'Summary.', oneThingToDoThisWeek: 'Action.' },
    executionLogs: [],
  }
}

function assembleWith(parts) {
  const state = buildAssemblyState(parts)
  return assembleGuidanceResponse(state, state.formData, 5).options[0]
}

describe('assembleGuidanceResponse — path_id join degrades gracefully', () => {
  test('both sides have path_id → strict id match populates colleges and roadmap', () => {
    const option = assembleWith({
      career: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
      mapping: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
      roadmap: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [COLLEGE.name])
    assert.equal(option.roadmap_steps.length, 4)
    assert.equal(option.avg_yearly_cost, COLLEGE.feeRange)
  })

  test('path_id missing on BOTH sides → join falls back to path text', () => {
    const option = assembleWith({
      career: { path: 'B.Tech Computer Science & AI' },
      mapping: { path: 'B.Tech Computer Science & AI' },
      roadmap: { path: 'B.Tech Computer Science & AI' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [COLLEGE.name])
    assert.equal(option.roadmap_steps.length, 4)
  })

  test('path_id present only on the career option → join still resolves via path text', () => {
    const option = assembleWith({
      career: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
      mapping: { path: 'B.Tech Computer Science & AI' },
      roadmap: { path: 'B.Tech Computer Science & AI' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [COLLEGE.name])
    assert.equal(option.roadmap_steps.length, 4)
  })

  test('path_id present only on the mapping/roadmap side → join still resolves via path text', () => {
    const option = assembleWith({
      career: { path: 'B.Tech Computer Science & AI' },
      mapping: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
      roadmap: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [COLLEGE.name])
    assert.equal(option.roadmap_steps.length, 4)
  })

  test('path text differing only by casing/whitespace still joins', () => {
    const option = assembleWith({
      career: { path: 'B.Tech Computer Science & AI' },
      mapping: { path: '  b.tech computer science & ai  ' },
      roadmap: { path: 'B.TECH COMPUTER SCIENCE & AI' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [COLLEGE.name])
    assert.equal(option.roadmap_steps.length, 4)
  })

  test('nothing matches → degrades to empty arrays without throwing', () => {
    const option = assembleWith({
      career: { path: 'B.Tech Computer Science & AI' },
      mapping: { path: 'Bachelor of Physiotherapy (BPT)' },
      roadmap: { path: 'Chartered Accountancy (CA)' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [])
    assert.deepStrictEqual(option.roadmap_steps, [])
    // Cost falls back to the explicit "unavailable" marker rather than crashing.
    assert.equal(option.avg_yearly_cost, COST_DATA_UNAVAILABLE)
    // Everything else still assembles.
    assert.equal(option.path, 'B.Tech Computer Science & AI')
    assert.equal(option.requires_entrance_exam, 'JEE Main')
  })

  test('differing path_ids on both sides do NOT fall back to text (strict id wins)', () => {
    const option = assembleWith({
      career: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
      mapping: { path_id: 'something_else', path: 'B.Tech Computer Science & AI' },
      roadmap: { path_id: 'something_else', path: 'B.Tech Computer Science & AI' },
    })

    assert.deepStrictEqual(option.realistic_colleges, [])
    assert.deepStrictEqual(option.roadmap_steps, [])
  })

  test('empty state collections degrade to empty arrays', () => {
    const state = buildAssemblyState({
      career: { path_id: 'btech_cs_ai', path: 'B.Tech Computer Science & AI' },
      mapping: {},
      roadmap: {},
    })
    state.collegeRecommendations = []
    state.roadmaps = []

    const result = assembleGuidanceResponse(state, state.formData, 1)
    assert.deepStrictEqual(result.options[0].realistic_colleges, [])
    assert.deepStrictEqual(result.options[0].roadmap_steps, [])
  })

  /**
   * Property: for ANY casing/whitespace perturbation of the same path text,
   * with path_id absent on the mapping/roadmap side, the join still resolves.
   */
  test('Property: text-fallback join is invariant to casing and surrounding whitespace', () => {
    const pad = fc.constantFrom('', ' ', '   ', '\t', '\n ')
    fc.assert(
      fc.property(
        fc.constantFrom('B.Tech Computer Science & AI', 'Bachelor of Physiotherapy (BPT)', 'Chartered Accountancy (CA)'),
        fc.constantFrom('lower', 'upper', 'same'),
        pad,
        pad,
        fc.option(fc.constant('btech_cs_ai'), { nil: undefined }),
        (path, casing, left, right, careerPathId) => {
          const variant = casing === 'lower' ? path.toLowerCase() : casing === 'upper' ? path.toUpperCase() : path
          const option = assembleWith({
            career: { path_id: careerPathId, path },
            mapping: { path: `${left}${variant}${right}` },
            roadmap: { path: `${left}${variant}${right}` },
          })

          assert.deepStrictEqual(option.realistic_colleges, [COLLEGE.name])
          assert.equal(option.roadmap_steps.length, 4)
        }
      ),
      { numRuns: 100 }
    )
  })
})
