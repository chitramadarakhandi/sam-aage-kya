/**
 * RECOMMENDATION RANKING TESTS — rankRecommendations + its orchestrator wiring.
 *
 * What matters here:
 *  - "Option 1/2/3" in the UI is just the array index of
 *    state.careerPaths.recommendations, so raw LLM order must not decide the
 *    ranking. A profile naming an exam must get that exam's track first.
 *  - The matcher must be exam-AWARE, not substring-naive: the PCB fallback's
 *    biotech option literally contains "Avoids NEET pressure" in its
 *    honest_take, which naive matching would promote for a NEET student.
 *  - Ranking must be order-only: no recommendation dropped, added, or edited.
 *  - The wiring must cover the PRIMARY (combined-agent) path, not just the
 *    per-agent fallback.
 *
 * DETERMINISM: provider keys and Supabase env vars are deleted BEFORE importing
 * the module under test; the one end-to-end test replaces global.fetch with an
 * in-process stub (see Orchestrator.pipeline.test.js for the same pattern).
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'

const MANAGED_ENV = [
  'GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
]
const SAVED_ENV = {}
for (const key of MANAGED_ENV) {
  SAVED_ENV[key] = process.env[key]
  delete process.env[key]
}

const { rankRecommendations, runMultiAgentOrchestrator } = await import('./Orchestrator.js')

const REAL_FETCH = global.fetch

after(() => {
  global.fetch = REAL_FETCH
  for (const key of MANAGED_ENV) {
    if (SAVED_ENV[key] === undefined) delete process.env[key]
    else process.env[key] = SAVED_ENV[key]
  }
})

// ─── Recommendation fixtures (shapes copied from the real agents) ────────────

const MBBS = {
  path_id: 'mbbs_medicine',
  path: 'MBBS (Bachelor of Medicine & Surgery)',
  honest_take: 'Extremely competitive through NEET-UG, and the course is long.',
  requires_entrance_exam: 'NEET-UG',
  opens_doors_to: ['Doctor', 'Surgeon (after PG)'],
  watch_out_for: 'Private college fees are very high.',
  backup_plan: 'BDS or BAMS through the same NEET score.',
}

/** The real PCB fallback text — "Avoids NEET pressure" is the naive-match trap. */
const BIOTECH = {
  path_id: 'bsc_biotech',
  path: 'B.Sc Biotechnology / Genetics',
  honest_take: 'Great research and lab-oriented career. Avoids NEET pressure but requires higher education to secure top roles.',
  requires_entrance_exam: 'CUET / None',
  opens_doors_to: ['Biotech Researcher', 'Lab Scientist', 'Pharmaceutical Analyst'],
  watch_out_for: 'An M.Sc or Ph.D is practically mandatory.',
  backup_plan: 'MBA in Clinical Research Management.',
}

const BPT = {
  path_id: 'bpt_physiotherapy',
  path: 'Bachelor of Physiotherapy (BPT)',
  honest_take: 'A strong clinical option focused on rehabilitation.',
  requires_entrance_exam: 'State CET / NEET',
  opens_doors_to: ['Physiotherapist', 'Sports Rehab Specialist'],
  watch_out_for: 'Low initial salaries.',
  backup_plan: 'Diploma in Hospital Administration.',
}

const BTECH_CS = {
  path_id: 'btech_cs_ai',
  path: 'B.Tech Computer Science & AI',
  honest_take: 'The most popular engineering field in India.',
  requires_entrance_exam: 'JEE Main / COMEDK',
  opens_doors_to: ['Software Engineer', 'AI Developer'],
  watch_out_for: 'High market saturation without projects.',
  backup_plan: 'BCA followed by MCA.',
}

const BSC_DATA = {
  path_id: 'bsc_data_science',
  path: 'B.Sc Data Science / Analytics',
  honest_take: 'A modern analytics pathway.',
  requires_entrance_exam: 'CUET / None',
  opens_doors_to: ['Data Analyst', 'Business Analyst'],
  watch_out_for: 'Needs strong mathematics.',
  backup_plan: 'B.Sc Information Technology.',
}

const BA_LLB = {
  path_id: 'ba_llb',
  path: 'BA LLB (5-year integrated law)',
  honest_take: 'Entry is through CLAT and the reading load is heavy.',
  requires_entrance_exam: 'CLAT / AILET',
  opens_doors_to: ['Lawyer', 'Corporate Legal Counsel'],
  watch_out_for: 'Litigation pays little in the early years.',
  backup_plan: 'BA Political Science then a 3-year LLB.',
}

const BA_ENGLISH = {
  path_id: 'ba_english',
  path: 'BA English / Literature',
  honest_take: 'Strong for writers and communicators.',
  requires_entrance_exam: 'CUET / Merit',
  opens_doors_to: ['Content Writer', 'Editor'],
  watch_out_for: 'Needs a PG or a portfolio for good roles.',
  backup_plan: 'BA Journalism.',
}

function form(overrides = {}) {
  return {
    classLevel: 'class12',
    board: 'CBSE',
    marks: '85',
    state: 'Maharashtra',
    stream: 'Science (PCB)',
    incomeRange: '2.5L-5L',
    interests: '',
    preferredModeOfAdmission: '',
    budget: '1L-3L',
    ...overrides,
  }
}

const idsOf = (recs) => recs.map(r => r.path_id)

// ════════════════════════════════════════════════════════════════════════════
//  THE NAMED REGRESSION — a NEET profile must get the NEET track as Option 1
// ════════════════════════════════════════════════════════════════════════════

describe('rankRecommendations — exam named in the profile wins Option 1', () => {
  test('REGRESSION: "NEET preparation" promotes MBBS from position 3 to Option 1', () => {
    const input = [BIOTECH, BPT, MBBS]
    const { ranked, breakdown } = rankRecommendations(
      input,
      form({ interests: 'NEET preparation, biology, helping patients' })
    )

    assert.equal(ranked[0].path_id, 'mbbs_medicine')
    assert.deepStrictEqual(breakdown.examsNamed, ['neet'])
    assert.equal(breakdown.reordered, true)
  })

  test('interests naming just "NEET" also promotes the medical option', () => {
    const { ranked, breakdown } = rankRecommendations([BIOTECH, MBBS], form({ interests: 'NEET' }))
    assert.equal(ranked[0].path_id, 'mbbs_medicine')
    assert.deepStrictEqual(breakdown.examsNamed, ['neet'])
  })

  test('TRAP: "Avoids NEET pressure" in honest_take never promotes biotech over MBBS', () => {
    const { ranked, breakdown } = rankRecommendations(
      [BIOTECH, MBBS],
      form({ interests: 'NEET preparation' })
    )

    assert.equal(ranked[0].path_id, 'mbbs_medicine')
    // The biotech option scored ZERO exam points despite the prose match.
    const biotechScore = breakdown.scores.find(s => s.path_id === 'bsc_biotech')
    assert.equal(biotechScore.exam, 0)
    assert.equal(biotechScore.examTrack, null)
    const mbbsScore = breakdown.scores.find(s => s.path_id === 'mbbs_medicine')
    assert.ok(mbbsScore.exam > 0)
    assert.equal(mbbsScore.examTrack, 'neet:core+required')
  })

  test('a core NEET track outranks a path that merely lists NEET as one option', () => {
    // BPT lists "State CET / NEET" but is not itself the NEET degree track.
    const { ranked } = rankRecommendations([BPT, MBBS], form({ interests: 'NEET preparation' }))
    assert.deepStrictEqual(idsOf(ranked), ['mbbs_medicine', 'bpt_physiotherapy'])
  })

  test('a JEE-mentioning profile promotes the engineering option', () => {
    const { ranked, breakdown } = rankRecommendations(
      [BSC_DATA, BTECH_CS],
      form({ stream: 'Science (PCM)', interests: 'JEE Main preparation, coding' })
    )
    assert.equal(ranked[0].path_id, 'btech_cs_ai')
    assert.deepStrictEqual(breakdown.examsNamed, ['jee'])
  })

  test('a CLAT-mentioning profile promotes the law option', () => {
    const { ranked, breakdown } = rankRecommendations(
      [BA_ENGLISH, BA_LLB],
      form({ stream: 'Arts / Humanities', interests: 'CLAT preparation, debating' })
    )
    assert.equal(ranked[0].path_id, 'ba_llb')
    assert.deepStrictEqual(breakdown.examsNamed, ['clat'])
  })

  test('the exam can also be named via preferredModeOfAdmission', () => {
    const { ranked } = rankRecommendations(
      [BIOTECH, MBBS],
      form({ interests: 'science', preferredModeOfAdmission: 'NEET-UG' })
    )
    assert.equal(ranked[0].path_id, 'mbbs_medicine')
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  STREAM + INTEREST SIGNALS, and the no-exam case
// ════════════════════════════════════════════════════════════════════════════

describe('rankRecommendations — stream and interest signals', () => {
  test('no exam named: PCB favours the medical/clinical path over the adjacent biotech one', () => {
    const { ranked, breakdown } = rankRecommendations(
      [BIOTECH, BPT],
      form({ interests: 'helping people recover' })
    )

    assert.deepStrictEqual(breakdown.examsNamed, [])
    assert.equal(breakdown.streamKey, 'pcb')
    assert.equal(ranked[0].path_id, 'bpt_physiotherapy')
  })

  test('literal interest keywords break a stream tie', () => {
    const analyst = { ...BSC_DATA, path_id: 'bsc_analytics', path: 'B.Sc Analytics' }
    const { ranked } = rankRecommendations(
      [analyst, BSC_DATA],
      form({ stream: 'Science (PCM)', interests: 'business analyst work' })
    )
    // BSC_DATA lists "Business Analyst" in opens_doors_to; the bare clone does not.
    assert.equal(ranked[0].path_id, 'bsc_data_science')
  })

  test('a profile naming no exam and no stream keeps working and does not crash', () => {
    const { ranked, breakdown } = rankRecommendations(
      [BIOTECH, BPT, MBBS],
      form({ stream: '', interests: '' })
    )
    assert.equal(ranked.length, 3)
    assert.deepStrictEqual(breakdown.examsNamed, [])
    assert.equal(breakdown.streamKey, null)
    assert.deepStrictEqual(breakdown.interestTokens, [])
    // All signals zero → stable, so input order is preserved.
    assert.deepStrictEqual(idsOf(ranked), idsOf([BIOTECH, BPT, MBBS]))
    assert.equal(breakdown.reordered, false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  STABILITY, PRESERVATION, EDGE CASES
// ════════════════════════════════════════════════════════════════════════════

describe('rankRecommendations — stability and preservation', () => {
  test('equal-scoring recommendations retain input order across repeated calls', () => {
    const a = { path_id: 'opt_a', path: 'Generic Option A', requires_entrance_exam: 'None', opens_doors_to: [] }
    const b = { path_id: 'opt_b', path: 'Generic Option B', requires_entrance_exam: 'None', opens_doors_to: [] }
    const c = { path_id: 'opt_c', path: 'Generic Option C', requires_entrance_exam: 'None', opens_doors_to: [] }
    const input = [c, a, b]
    const formData = form({ stream: '', interests: '' })

    const first = rankRecommendations(input, formData)
    assert.deepStrictEqual(idsOf(first.ranked), ['opt_c', 'opt_a', 'opt_b'])
    assert.deepStrictEqual(first.breakdown.scores.map(s => s.total), [0, 0, 0])

    for (let i = 0; i < 5; i++) {
      const again = rankRecommendations(input, formData)
      assert.deepStrictEqual(idsOf(again.ranked), idsOf(first.ranked))
    }
  })

  test('a tie between two exam-matched options keeps their input order', () => {
    const bds = { ...MBBS, path_id: 'bds_dental', path: 'BDS (Dental Surgery)', opens_doors_to: ['Dentist'] }
    const formData = form({ interests: 'NEET preparation' })

    const first = rankRecommendations([bds, MBBS], formData)
    const second = rankRecommendations([bds, MBBS], formData)
    assert.deepStrictEqual(idsOf(first.ranked), ['bds_dental', 'mbbs_medicine'])
    assert.deepStrictEqual(idsOf(second.ranked), idsOf(first.ranked))
  })

  test('nothing is dropped, added, or content-mutated — order only', () => {
    const input = [BIOTECH, BPT, MBBS]
    const snapshot = structuredClone(input)
    const { ranked } = rankRecommendations(input, form({ interests: 'NEET preparation' }))

    // Same set of path_ids, same count.
    assert.equal(ranked.length, input.length)
    assert.deepStrictEqual([...idsOf(ranked)].sort(), [...idsOf(input)].sort())
    // Same objects (identity), so no field can have been rewritten.
    for (const rec of input) assert.ok(ranked.includes(rec))
    // Every field value is byte-identical to the pre-ranking snapshot.
    for (const original of snapshot) {
      const after = ranked.find(r => r.path_id === original.path_id)
      assert.deepStrictEqual(after, original)
    }
    // The input array itself is untouched.
    assert.deepStrictEqual(input, snapshot)
  })

  test('bridge_* recommendations from the mismatch fallback are left in place', () => {
    const bridges = ['B.Tech Biotechnology', 'B.Tech Biomedical Engineering', 'B.Sc Computational Biology']
      .map((path, idx) => ({
        path_id: `bridge_${idx + 1}`,
        path,
        honest_take: 'Bridge pathway advisory text.',
        requires_entrance_exam: 'JEE',
        opens_doors_to: ['Interdisciplinary career'],
      }))

    const { ranked, breakdown } = rankRecommendations(
      bridges,
      form({ stream: 'Science (PCB)', interests: 'JEE preparation' })
    )
    assert.deepStrictEqual(idsOf(ranked), ['bridge_1', 'bridge_2', 'bridge_3'])
    assert.equal(breakdown.skipped, 'bridge_paths')
    assert.equal(breakdown.reordered, false)
  })

  test('empty, single-element and malformed inputs do not throw', () => {
    assert.deepStrictEqual(rankRecommendations([], form()).ranked, [])
    assert.equal(rankRecommendations([], form()).breakdown.skipped, 'empty')

    const single = rankRecommendations([MBBS], form({ interests: 'NEET' }))
    assert.deepStrictEqual(idsOf(single.ranked), ['mbbs_medicine'])
    assert.equal(single.breakdown.skipped, 'single_recommendation')

    assert.deepStrictEqual(rankRecommendations(undefined, form()).ranked, [])
    assert.deepStrictEqual(rankRecommendations(null).ranked, [])
    assert.equal(rankRecommendations([BIOTECH, MBBS], {}).ranked.length, 2)
    assert.equal(rankRecommendations([BIOTECH, MBBS]).ranked.length, 2)
  })

  test('missing interests / marks / opens_doors_to do not throw', () => {
    const bare = [
      { path_id: 'a', path: 'MBBS' },
      { path_id: 'b', path: 'B.Sc Biotechnology' },
    ]
    const { ranked } = rankRecommendations(bare, { stream: 'Science (PCB)' })
    assert.equal(ranked.length, 2)

    const withExam = rankRecommendations(bare, { stream: 'Science (PCB)', interests: 'NEET preparation' })
    assert.equal(withExam.ranked[0].path_id, 'a')
    // No marks supplied → no academic-fit caution can be derived.
    assert.ok(withExam.breakdown.scores.every(s => s.academicFitCaution === null))
  })

  test('the marks carve-out is conservative: a caution never demotes the exam-matched option', () => {
    // path_id 'mbbs' exists in the curated dataset (minMarks12: 60), so marks of
    // 42% produce a REAL academic-fit caution from real data.
    const datasetMbbs = { ...MBBS, path_id: 'mbbs' }
    const { ranked, breakdown } = rankRecommendations(
      [BIOTECH, datasetMbbs],
      form({ interests: 'NEET preparation', marks: '42' })
    )

    const mbbsScore = breakdown.scores.find(s => s.path_id === 'mbbs')
    assert.ok(mbbsScore.academicFitCaution, 'expected a caution derived from minMarks12')
    assert.match(mbbsScore.academicFitCaution, /42%/)
    // Recorded, but NOT acted on — the exam-matched option stays Option 1.
    assert.equal(ranked[0].path_id, 'mbbs')
    assert.equal(breakdown.carveOut.active, false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  PROPERTY: order-only + exam dominance across arbitrary input orders
// ════════════════════════════════════════════════════════════════════════════

describe('rankRecommendations — properties', () => {
  const POOL = [MBBS, BIOTECH, BPT, BTECH_CS, BSC_DATA, BA_LLB, BA_ENGLISH]

  test('Property: ranking is order-only and deterministic for any input order', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(POOL, { minLength: 2 }),
        fc.constantFrom('', 'NEET preparation', 'JEE Main preparation', 'CLAT preparation', 'sketching posters'),
        fc.constantFrom('Science (PCB)', 'Science (PCM)', 'Commerce', 'Arts / Humanities', ''),
        (recs, interests, stream) => {
          const formData = form({ interests, stream })
          const snapshot = structuredClone(recs)

          const { ranked } = rankRecommendations(recs, formData)
          const again = rankRecommendations(recs, formData)

          // Same multiset, same objects, nothing edited, input untouched.
          assert.equal(ranked.length, recs.length)
          assert.deepStrictEqual([...idsOf(ranked)].sort(), [...idsOf(recs)].sort())
          assert.deepStrictEqual(recs, snapshot)
          // Deterministic across calls.
          assert.deepStrictEqual(idsOf(again.ranked), idsOf(ranked))
        }
      ),
      { numRuns: 200 }
    )
  })

  test('Property: when the profile names NEET, Option 1 is always on the NEET track', () => {
    const NEET_TRACK = new Set(['mbbs_medicine', 'bds_dental'])
    const bds = { ...MBBS, path_id: 'bds_dental', path: 'BDS (Dental Surgery)', opens_doors_to: ['Dentist'] }
    const nonMedical = [BIOTECH, BPT, BTECH_CS, BSC_DATA, BA_LLB, BA_ENGLISH]

    fc.assert(
      fc.property(
        fc.shuffledSubarray(nonMedical, { minLength: 1 }),
        fc.constantFrom(MBBS, bds),
        fc.nat({ max: 6 }),
        fc.constantFrom('NEET preparation', 'neet', 'preparing for NEET-UG'),
        (others, medical, position, interests) => {
          const recs = [...others]
          recs.splice(Math.min(position, recs.length), 0, medical)
          const { ranked } = rankRecommendations(recs, form({ interests }))
          assert.ok(
            NEET_TRACK.has(ranked[0].path_id),
            `expected a NEET-track option first, got "${ranked[0].path_id}"`
          )
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  END-TO-END — the PRIMARY (combined-agent) path, fetch stubbed
// ════════════════════════════════════════════════════════════════════════════

function roadmapYears(tag) {
  return [1, 2, 3, 4].map(year => ({
    year,
    focus: `${tag} year ${year}`,
    skills: [`${tag} skill`],
    certifications: [`${tag} cert`],
    projects: [`${tag} project`],
    milestones: [`${tag} milestone`],
  }))
}

describe('runMultiAgentOrchestrator — re-rank is wired into the combined-agent path', () => {
  let result

  before(async () => {
    // Combined payload deliberately puts the NON-NEET option first, exactly the
    // shape the bug produced: Option 1 was whatever the model emitted first.
    const combined = {
      profile: {
        academicStanding: 'High — 88%',
        financialCategory: 'Affordable',
        riskAppetite: 'Balanced',
        keyConstraints: [],
        keyStrengths: ['Biology'],
        coachingNeeds: 'Structured coaching',
      },
      summary: 'Strong PCB profile aiming at medicine.',
      oneThingToDoThisWeek: 'Download the NEET-UG information bulletin.',
      recommendations: [
        { ...BIOTECH, roadmap_years: roadmapYears('biotech') },
        { ...MBBS, roadmap_years: roadmapYears('mbbs') },
      ],
    }

    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(combined) } }],
        usage: { total_tokens: 42 },
      }),
    })

    result = await runMultiAgentOrchestrator(form({
      fullName: 'Test Student',
      stream: 'Science (PCB)',
      marks: '88',
      interests: 'NEET preparation, biology',
    }))
  })

  after(() => {
    global.fetch = REAL_FETCH
    delete process.env.GROQ_API_KEY
  })

  test('options[0] is the exam-matched option even though the LLM emitted it second', () => {
    assert.equal(result.options.length, 2)
    assert.equal(result.options[0].path, MBBS.path)
    assert.equal(result.options[1].path, BIOTECH.path)
  })

  test('the roadmap still joins to its own path after re-ordering', () => {
    assert.deepStrictEqual(result.options[0].roadmap_steps, roadmapYears('mbbs'))
    assert.deepStrictEqual(result.options[1].roadmap_steps, roadmapYears('biotech'))
  })

  test('the response shape the frontend consumes is unchanged', () => {
    for (const key of [
      'summary', 'options', 'scholarship_to_check', 'one_thing_to_do_this_week',
      'scholarships_list', 'study_abroad', 'mentors', 'youtube_videos',
      'colleges_data', 'explainability', 'ai_status',
    ]) {
      assert.ok(key in result, `missing top-level key "${key}"`)
    }
    for (const option of result.options) {
      for (const key of [
        'path', 'honest_take', 'requires_entrance_exam', 'realistic_colleges',
        'avg_yearly_cost', 'opens_doors_to', 'watch_out_for', 'backup_plan', 'roadmap_steps',
      ]) {
        assert.ok(key in option, `missing option key "${key}"`)
      }
    }
  })

  test('no option content was rewritten by ranking', () => {
    const mbbsOption = result.options[0]
    assert.equal(mbbsOption.honest_take, MBBS.honest_take)
    assert.equal(mbbsOption.backup_plan, MBBS.backup_plan)
    assert.equal(mbbsOption.requires_entrance_exam, MBBS.requires_entrance_exam)
    assert.deepStrictEqual(mbbsOption.opens_doors_to, MBBS.opens_doors_to)
  })
})
