import { createClient } from '@supabase/supabase-js'
import { normalizeStream, streamsMatch, detectStreamExamMismatch } from '../config/streams.js'
import { enforceGuidanceEvidence } from '../domain/verification/verifyEvidence.js'
import { callLLM, isAiAvailable, getAiStatus } from '../ai/llmClient.js'

// Helper to check environment configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null

// Call the shared LLM client. Uses the consolidated client so all AI calls
// share ONE code path (env handling, token circuit breaker, provider fallback).
async function runLLMAgent(prompt, responseJson = true) {
  return callLLM(prompt, { json: responseJson, maxTokens: 800, temperature: 0.2 })
}

/**
 * Removes duplicate colleges by name (case/whitespace-insensitive), keeping
 * only the first occurrence of each institution in its original position.
 * Pure function — does not mutate the input array.
 */
export function dedupCollegesByName(colleges) {
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

/**
 * Scholarship surfaced when the RAG agent returns no DB-verified scholarships.
 * Kept as a named constant so the evidence guardrail's allow-list and the
 * response assembly can never drift apart (a drift would blank the name out).
 */
export const FALLBACK_SCHOLARSHIP_NAME = 'Post-Matric Scholarship Scheme'

/**
 * EVIDENCE GUARDRAIL — every college/scholarship name surfaced in the response
 * must trace back to a record some agent actually produced.
 *
 * What this actually checks today: `runCollegeRecommendationAgent` and
 * `runScholarshipAgent` are both deterministic (they map DB-retrieved rows, or
 * pick from curated in-code fallback lists) — the LLM is never asked to name a
 * college or a scholarship. So this is a defence-in-depth invariant check on the
 * assembly step, NOT an LLM-hallucination filter. It becomes a real
 * hallucination filter only if a future change lets the model choose names.
 *
 * Allow-list selection (deliberate, to avoid degrading the fallback paths):
 *  - Colleges: the DB-retrieved rows when RAG returned any (the verified source
 *    of truth). When RAG returned nothing (Supabase unconfigured / empty), the
 *    allow-list is the college agent's own curated fallback rows instead — using
 *    an empty allow-list there would strip every college and make the degraded
 *    path strictly worse.
 *  - Scholarships: the surfaced DB rows, or the curated fallback name when there
 *    are none, so a legitimate fallback `scholarship_to_check` is never blanked.
 *
 * Pure function (no I/O) so it can be unit-tested without LLM/Supabase calls.
 */
export function applyEvidenceGuardrail(result, state = {}, formData = {}) {
  const retrievedColleges = state.retrievedColleges || []
  const collegeMappings = state.collegeRecommendations || []
  const surfacedScholarships = state.scholarshipRecommendations || []

  const collegeAllowList = retrievedColleges.length > 0
    ? retrievedColleges.map(c => ({ name: c.name }))
    : collegeMappings.flatMap(m => (m.colleges || []).map(c => ({ name: c.name })))

  const scholarshipAllowList = surfacedScholarships.length > 0
    ? surfacedScholarships.map(s => ({ name: s.name }))
    : [{ name: FALLBACK_SCHOLARSHIP_NAME }]

  return enforceGuidanceEvidence(result, {
    profile: { classLevel: formData.classLevel || 'class12' },
    colleges: collegeAllowList,
    scholarships: scholarshipAllowList,
  })
}

/**
 * COMBINED GUIDANCE AGENT — one LLM call instead of four.
 * Produces profile analysis + career paths + roadmaps + summary in a single
 * request. This cuts token usage ~75% (4 calls → 1), so the free-tier budget
 * lasts ~4x longer and rate limits are hit far less often.
 * Returns null on failure so the orchestrator falls back to the per-agent path.
 */
export async function runCombinedGuidanceAgent(state) {
  const form = state.formData
  const isClass10 = form.classLevel === 'class10'
  const sLower = (form.stream || '').toLowerCase()
  const aLower = (form.preferredModeOfAdmission || '').toLowerCase()
  const isDiplomaTrack =
    sLower.includes('diploma') || sLower.includes('polytechnic') ||
    sLower.includes('iti') || sLower.includes('vocational') ||
    aLower.includes('lateral') || aLower.includes('diploma')

  let modeInstruction
  if (isClass10) {
    modeInstruction = 'This is a CLASS 10 student. "path" values MUST be STREAM choices for 11th/12th (e.g. "Science (PCM)", "Commerce with Maths", "Arts / Humanities", "Polytechnic Diploma (Engineering)", "ITI"). Do NOT recommend degrees like B.Tech/MBBS/CA.'
  } else if (isDiplomaTrack) {
    modeInstruction = 'This is a DIPLOMA / POLYTECHNIC / ITI / LATERAL-ENTRY student. "path" values MUST be practical routes ONLY: "B.Tech via Lateral Entry (after Diploma)", "B.Voc", "Job-oriented Diplomas & Certifications", "Apprenticeship". Do NOT recommend CA, MBBS, BBA or exam-heavy degrees.'
  } else {
    modeInstruction = `This is a CLASS 12 student in the "${form.stream}" stream. "path" values are college courses/careers (e.g. B.Tech CSE, B.Sc Biotech, CA, B.Des) that fit their stream.`
  }

  // Detect stream-exam mismatch before constructing the prompt
  const mismatchResult = detectStreamExamMismatch(form.stream, form.preferredModeOfAdmission)

  let mismatchParagraph = ''
  if (mismatchResult.isMismatch) {
    mismatchParagraph = `
IMPORTANT — STREAM-EXAM MISMATCH DETECTED:
${mismatchResult.advisory}
You MUST acknowledge this conflict in your response. The student's declared stream ("${form.stream || 'NA'}") does not align with their preferred admission exam ("${form.preferredModeOfAdmission || 'NA'}"). Suggest reconciliation/bridge pathways that honor BOTH the student's stream background AND their exam interest. Include at least one bridge path such as: ${mismatchResult.bridgePaths.join(', ')}.`
  }

  const prompt = `You are an honest Indian career counsellor. Analyse this student and produce guidance in ONE JSON response.

STUDENT:
- Class level: ${form.classLevel || 'class12'}
- Board: ${form.board || 'NA'}, Marks: ${form.marks || 'NA'}%
- Stream: ${form.stream || 'NA'}
- Home state: ${form.state || 'NA'}, Family income: ${form.incomeRange || 'NA'}
- Interests: ${form.interests || 'NA'}
- Biggest fear: ${form.biggestFear || 'NA'}
- Admission mode: ${form.preferredModeOfAdmission || 'NA'}

${modeInstruction}${mismatchParagraph}

INTEREST RULE: map creative/design interests (poster, sketching, UI) to modern careers (B.Des UI/UX, Animation, Digital Marketing), NOT traditional fine arts unless they mention performing arts/music.

Recommend 2-3 best-fit paths. For each, give a 4-year roadmap (years 1-4, each with focus/skills/milestones). Be specific to THIS student's interests and marks.

Respond ONLY with JSON:
{
  "profile": { "academicStanding": "...", "financialCategory": "...", "riskAppetite": "...", "keyConstraints": ["..."], "keyStrengths": ["..."], "coachingNeeds": "..." },
  "summary": "warm 3-sentence summary specific to this student",
  "oneThingToDoThisWeek": "one concrete action",
  "recommendations": [
    {
      "path_id": "short_kebab_slug",
      "path": "path/stream/course name per the rule above",
      "honest_take": "2 honest sentences on difficulty/competition/fit",
      "requires_entrance_exam": "specific exam or None",
      "opens_doors_to": ["role1","role2"],
      "watch_out_for": "main pitfall",
      "backup_plan": "specific backup",
      "roadmap_years": [
        { "year": 1, "focus": "...", "skills": ["..."], "certifications": ["..."], "projects": ["..."], "milestones": ["..."] },
        { "year": 2, "focus": "...", "skills": ["..."], "certifications": ["..."], "projects": ["..."], "milestones": ["..."] },
        { "year": 3, "focus": "...", "skills": ["..."], "certifications": ["..."], "projects": ["..."], "milestones": ["..."] },
        { "year": 4, "focus": "...", "skills": ["..."], "certifications": ["..."], "projects": ["..."], "milestones": ["..."] }
      ]
    }
  ]
}`

  // One call, a bit more output room since it produces everything at once.
  return callLLM(prompt, { json: true, maxTokens: 2200, temperature: 0.2 })
}

// ──────────────────────────────────────────────────────────────────────────────
// SPECIALIZED AGENTS WITH DEGRADED MOCK FALLBACKS
// A subset call the LLM (reasoning); the rest are deterministic (lookups/rules)
// to keep token spend low and latency fast.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 1. Profile Analysis Agent
 */
export async function runProfileAnalysisAgent(state) {
  const form = state.formData
  try {
    const prompt = `
    You are the Profile Analysis Agent. Analyze the student's profile:
    - Board: ${form.board || 'Not specified'}
    - Marks: ${form.marks || 'Not specified'}%
    - Home State: ${form.state || 'Not specified'}
    - Stream: ${form.stream || 'Not specified'}
    - Class Level: ${form.classLevel || 'class12'}
    - Family Income: ${form.incomeRange || 'Not specified'}
    - First Generation College: ${form.firstGenCollege === true ? 'Yes' : 'No'}
    - Preferred State/City: ${form.preferredState || 'Not specified'} / ${form.preferredCity || 'Not specified'}
    - Annual Budget: ${form.budget || 'Not specified'}
    - Hobbies/Interests: ${form.interests || 'Not specified'}
    - Biggest Fear: ${form.biggestFear || 'Not specified'}

    Provide a structured assessment of this student's profile.
    Respond ONLY with a JSON object:
    {
      "academicStanding": "High/Medium/Low with brief reason",
      "financialCategory": "Affordable/Subsidized/Premium based on budget & income",
      "riskAppetite": "Safe, Balanced, or Exploratory",
      "keyConstraints": ["list of budget, geography, or board constraints"],
      "keyStrengths": ["list of academic/hobby strengths"],
      "coachingNeeds": "Detailed evaluation of coaching/guidance requirements"
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[ProfileAnalysisAgent] Falling back to local mock analyzer...')
    const marksNum = parseFloat(form.marks) || 0
    const marksLabel = marksNum >= 90 ? `${marksNum}% (Excellent)` : marksNum >= 75 ? `${marksNum}% (Good)` : marksNum >= 50 ? `${marksNum}% (Average)` : `${marksNum}% (Needs improvement)`
    return {
      academicStanding: marksNum >= 80 ? `High — ${marksLabel}` : marksNum >= 55 ? `Medium — ${marksLabel}` : `Low — ${marksLabel}`,
      financialCategory: form.incomeRange === 'below_2.5L' ? 'Subsidized' : form.incomeRange === '2.5L-5L' ? 'Affordable' : 'Standard',
      riskAppetite: "Balanced",
      keyConstraints: ["Budget limits", `Home state preference (${form.state || 'India'})`],
      keyStrengths: [form.interests ? `Interest in ${form.interests}` : "Academics", `${marksNum}% academic performance`],
      coachingNeeds: marksNum >= 85 ? "Advanced prep — target competitive national exams." : "Self-study supplemented by targeted coaching resources."
    }
  }
}

/**
 * 2. Search & Retrieval Agent (RAG)
 */
export async function runSearchRetrievalAgent(state) {
  const form = state.formData
  if (!supabase) {
    return { colleges: [], scholarships: [] }
  }

  const stream = form.stream || ''
  const marks = parseFloat(form.marks) || 0
  const budget = form.budget || ''
  const statePref = form.preferredState || ''
  const classLevel = form.classLevel || 'class12'

  let colleges = []
  let scholarships = []

  try {
    // 1. Fetch colleges
    const { data: colData, error: colError } = await supabase
      .from('colleges')
      .select('*')
    
    if (colError) throw colError
    
    let allColleges = colData || []
    
    // Parse budget limits
    let maxBudget = Infinity
    if (classLevel === 'class10') {
      // Map high school/coaching budget to corresponding future college budget
      if (budget === 'below_20k') maxBudget = 100000
      else if (budget === '20k-60k') maxBudget = 300000
      else if (budget === '60k-1.5L') maxBudget = 600000
    } else {
      if (budget === 'below_1L') maxBudget = 100000
      else if (budget === '1L-3L') maxBudget = 300000
      else if (budget === '3L-6L') maxBudget = 600000
    }

    // Filter and score colleges
    const normStudentStream = normalizeStream(stream)
    const preStreamFilter = allColleges.filter(c => {
      // Stream match for class12: compare normalized to avoid casing/whitespace drift.
      if (classLevel === 'class12' && stream) {
        if (!c.streams || !c.streams.some(s => normalizeStream(s) === normStudentStream)) return false
      }
      return true
    })

    // Warn loudly if stream filtering produced zero colleges (indicates drift).
    if (classLevel === 'class12' && stream && preStreamFilter.length === 0) {
      console.warn(
        `[RAG] Stream filter "${stream}" (normalized: "${normStudentStream}") matched 0 colleges — ` +
        `check that Onboarding form values match the streams array in seed.js. Falling back to all colleges.`
      )
    }

    const collegesForScoring = (classLevel === 'class12' && stream && preStreamFilter.length > 0)
      ? preStreamFilter
      : allColleges

    const scoredColleges = collegesForScoring.map(c => {
      let score = 0
      
      // Marks check: within range?
      if (marks >= c.min_marks) {
        score += 30
      } else if (marks + 10 >= c.min_marks) {
        score += 10
      } else {
        score -= 50
      }

      // Budget check:
      if (c.yearly_cost_max <= maxBudget) {
        score += 40
      } else if (c.yearly_cost_min <= maxBudget) {
        score += 20
      } else {
        score -= 40
      }

      // State check:
      if (statePref && statePref !== 'Any State') {
        if (c.state && c.state.toLowerCase() === statePref.toLowerCase()) {
          score += 30
        }
      } else {
        score += 10
      }

      // College type: central/state colleges are usually cheaper and look good for low income
      if (form.incomeRange === 'below_2.5L' && (c.college_type === 'central' || c.college_type === 'state')) {
        score += 15
      }

      return { ...c, matchScore: score }
    })
    
    // Sort by match score descending
    scoredColleges.sort((a, b) => b.matchScore - a.matchScore)
    // Remove severely mismatched colleges (score < 0) unless we have too few
    let filteredColleges = scoredColleges.filter(c => c.matchScore >= 0)
    if (filteredColleges.length < 5) {
      filteredColleges = scoredColleges.slice(0, 10)
    }
    colleges = filteredColleges.slice(0, 20)

    // 2. Fetch scholarships and filter them
    const { data: scholData, error: scholError } = await supabase
      .from('scholarships')
      .select('*')
    if (scholError) throw scholError

    let allScholarships = scholData || []
    
    // Parse student income range in lakh
    let studentIncomeLakh = 99
    if (form.incomeRange === 'below_2.5L') studentIncomeLakh = 2.5
    else if (form.incomeRange === '2.5L-5L') studentIncomeLakh = 5.0
    else if (form.incomeRange === '5L-10L') studentIncomeLakh = 10.0
    else if (form.incomeRange === 'above_10L') studentIncomeLakh = 99.0

    const scoredScholarships = allScholarships.map(s => {
      let score = 0
      
      // Income eligibility
      if (s.eligibility_income_max_lakh >= studentIncomeLakh) {
        score += 30
      } else {
        score -= 50
      }

      // Marks eligibility
      if (marks >= s.eligibility_marks_min) {
        score += 20
      } else {
        score -= 50
      }

      // Stream eligibility
      if (s.eligible_streams && (s.eligible_streams.includes('All') || s.eligible_streams.includes(stream))) {
        score += 20
      }

      // State eligibility
      if (s.eligible_states && (s.eligible_states.includes('All') || s.eligible_states.includes(form.state))) {
        score += 20
      }

      return { ...s, matchScore: score }
    })

    scoredScholarships.sort((a, b) => b.matchScore - a.matchScore)
    scholarships = scoredScholarships.filter(s => s.matchScore >= 0).slice(0, 10)

  } catch (err) {
    console.warn('RAG Database retrieval failed, falling back:', err.message)
  }

  return { colleges, scholarships }
}

/**
 * 3. Career Recommendation Agent
 */
export async function runCareerRecommendationAgent(state) {
  const form = state.formData
  const profileAnalysis = state.profileAnalysis
  try {
    const isClass10 = form.classLevel === 'class10'
    const streamLower = (form.stream || '').toLowerCase()
    const admissionLower = (form.preferredModeOfAdmission || '').toLowerCase()
    // Detect a diploma / polytechnic / ITI / lateral-entry student — they need
    // vocational + lateral-entry paths, NOT generic degrees like CA or MBBS.
    const isDiplomaTrack =
      streamLower.includes('diploma') || streamLower.includes('polytechnic') ||
      streamLower.includes('iti') || streamLower.includes('vocational') ||
      admissionLower.includes('lateral') || admissionLower.includes('diploma')

    let classLevelInstruction
    if (isClass10) {
      classLevelInstruction = `
    ⚠️ THIS STUDENT IS IN CLASS 10 (choosing what to study in Class 11 & 12).
    You MUST recommend STREAM CHOICES for 11th/12th — NOT college degrees.
    Valid "path" values are streams such as: "Science (PCM)", "Science (PCB)",
    "Science (PCMB)", "Commerce with Maths", "Commerce without Maths",
    "Arts / Humanities", and also practical routes: "Polytechnic Diploma (Engineering)",
    "ITI (Industrial Training Institute)". If the student wants a job-ready or
    hands-on path, DO recommend Diploma/ITI. Do NOT recommend B.Tech, BCA, MBBS,
    or degree courses — those come after Class 12.
    - "requires_entrance_exam" should be "None (stream selection, not entrance-based)".
    - "backup_plan" should describe switching to another stream if this one is too hard.`
    } else if (isDiplomaTrack) {
      classLevelInstruction = `
    ⚠️ THIS IS A DIPLOMA / POLYTECHNIC / ITI / LATERAL-ENTRY STUDENT.
    They already hold (or are pursuing) a diploma/ITI, NOT a regular 12th stream.
    You MUST recommend PRACTICAL, DIPLOMA-APPROPRIATE next steps ONLY. Valid paths:
      • "B.Tech via Lateral Entry (after Diploma)" — join engineering directly in 2nd year via LEET/ECET
      • "B.Voc (Vocational Degree)" — skill-first UGC degree
      • "Job-oriented Diplomas & Certifications" (IT, design, trades, digital marketing)
      • "Apprenticeship / NAPS (earn-while-you-learn)"
      • Advanced diploma or a specialised trade certification in their field
    DO NOT recommend CA, MBBS, BBA, generic B.Com/BA, or exam-heavy degree routes —
    those do not fit a diploma/lateral-entry student. Focus on lateral entry to
    engineering, vocational degrees, apprenticeships, and skill certifications.
    - "requires_entrance_exam" should name the real route (e.g. "LEET / ECET (Lateral Entry)" or "None / Direct admission").
    - "backup_plan" should be another practical/vocational option.`
    } else {
      classLevelInstruction = `
    THIS STUDENT IS IN CLASS 12 (choosing a college course/career after 12th).
    Recommend specific college courses / career tracks (e.g. B.Tech Computer
    Science, B.Sc Biotechnology, CA, B.Des), matching their stream "${form.stream}".`
    }

    const prompt = `
    You are the Career Recommendation Agent. Recommends the best career paths and courses matching this profile.
    Profile Analysis: ${JSON.stringify(profileAnalysis)}
    Student Interests: ${form.interests}
    Student Stream: ${form.stream || (isClass10 ? 'Not yet chosen (Class 10)' : 'Not specified')}
    Class Level: ${form.classLevel}
    ${classLevelInstruction}

    INTEREST INTERPRETATION GUIDELINE:
    If a student enters design or visual/creative interests like 'poster', 'posters', 'designing', or 'sketching':
    - Map them to modern, highly-employable professional design careers: Bachelor of Design (B.Des in Graphic Design, Communication Design, or UI/UX), B.Sc in Animation & VFX, or fields in Digital Marketing / Advertising.
    - Do NOT recommend traditional fine arts (BFA in Painting, Sculpture, etc.) or music/songs/performing arts unless the student explicitly mentions performing arts, singing, or music.
    - If they have a Science stream, B.Des, B.Arch, or tech-design fields (like UI/UX) are excellent options.

    Recommend 2-3 ${isClass10 ? 'stream options for Class 11/12' : 'specific career tracks'}.
    Respond ONLY with a JSON object in this format:
    {
      "recommendations": [
        {
          "path_id": "short_kebab_slug (${isClass10 ? 'e.g. science_pcm, commerce_maths, arts_humanities' : 'e.g. btech_cs, mbbs_medicine, ca_finance, bsc_biotech'}). MUST be unique per path and <= 20 chars, lowercase letters and underscores only.",
          "path": "${isClass10 ? 'Stream name (e.g. Science (PCM), Commerce with Maths, Arts / Humanities)' : 'Career/Course name (e.g. B.Tech Computer Science, B.Sc Biotechnology)'}",
          "honest_take": "Brutally honest 2-sentence advice about difficulty, competition, and suitability.",
          "requires_entrance_exam": "${isClass10 ? 'None (stream selection, not entrance-based)' : 'Specific exam name or None'}",
          "opens_doors_to": ["${isClass10 ? 'Future career this stream enables' : 'Job role 1'}", "${isClass10 ? 'Another future career' : 'Job role 2'}"],
          "watch_out_for": "Main pitfall or drawback of this ${isClass10 ? 'stream' : 'path'}",
          "backup_plan": "${isClass10 ? 'Which stream to switch to if this is too hard' : 'Specific backup plan if entrance fails'}"
        }
      ]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[CareerRecommendationAgent] Falling back to local mock carrier recommendations...')
    const isClass10 = form.classLevel === 'class10'
    const stream = form.stream || 'Commerce'
    const sLower = (form.stream || '').toLowerCase()
    const aLower = (form.preferredModeOfAdmission || '').toLowerCase()
    const isDiplomaTrack =
      sLower.includes('diploma') || sLower.includes('polytechnic') ||
      sLower.includes('iti') || sLower.includes('vocational') ||
      aLower.includes('lateral') || aLower.includes('diploma')

    // Diploma / lateral-entry students get practical routes, never CA/MBBS.
    // BUT: first check for stream-exam mismatch, which takes priority over the
    // isDiplomaTrack heuristic (since "Arts / Humanities" falsely triggers it
    // due to "iti" in "humanities").
    if (!isClass10) {
      const mismatchResult = detectStreamExamMismatch(form.stream, form.preferredModeOfAdmission)
      if (mismatchResult.isMismatch) {
        return {
          advisory: mismatchResult.advisory,
          recommendations: mismatchResult.bridgePaths.map((bridgePath, idx) => ({
            path_id: `bridge_${idx + 1}`,
            path: bridgePath,
            honest_take: `${mismatchResult.advisory} This bridge pathway combines your ${form.stream || 'current'} background with your ${form.preferredModeOfAdmission || ''} exam interest.`,
            requires_entrance_exam: form.preferredModeOfAdmission || 'None',
            opens_doors_to: ['Interdisciplinary career', 'Bridge to preferred field'],
            watch_out_for: 'Bridge pathways may require additional preparation or lateral entry exams.',
            backup_plan: 'Consider reorienting to a stream-compatible exam or explore integrated programs.'
          }))
        }
      }
    }

    if (!isClass10 && isDiplomaTrack) {
      return {
        recommendations: [
          {
            path_id: 'btech_lateral',
            path: 'B.Tech via Lateral Entry (after Diploma)',
            honest_take: 'Your diploma lets you skip straight into the 2nd year of a B.Tech via LEET/ECET — a cheaper, faster route to an engineering degree than starting fresh.',
            requires_entrance_exam: 'State Lateral Entry test (LEET / ECET)',
            opens_doors_to: ['Engineer in your diploma branch', 'Core industry / PSU roles'],
            watch_out_for: 'Seats are limited and the 2nd-year jump can be academically intense.',
            backup_plan: 'Continue with a B.Voc or advanced diploma while gaining work experience.'
          },
          {
            path_id: 'bvoc',
            path: 'B.Voc (Vocational Degree)',
            honest_take: 'A skill-first UGC-recognised degree that builds directly on your diploma with strong employability.',
            requires_entrance_exam: 'None / Merit',
            opens_doors_to: ['Skilled technician', 'Supervisor', 'Specialist in your trade'],
            watch_out_for: 'Choose a college with real industry tie-ups, not just a paper degree.',
            backup_plan: 'Job-oriented certifications while working.'
          },
          {
            path_id: 'diploma_job',
            path: 'Job-oriented Diplomas & Certifications',
            honest_take: 'Short, practical programs (IT, CAD, digital marketing, trades) that get you earning quickly or add a high-demand skill on top of your diploma.',
            requires_entrance_exam: 'None / Direct admission',
            opens_doors_to: ['Skilled technician', 'Junior developer / designer', 'Trade professional'],
            watch_out_for: 'Pick certifications the industry actually recognises.',
            backup_plan: 'Apprenticeship (NAPS) to earn while you learn.'
          }
        ]
      }
    }

    if (isClass10) {
      return {
        recommendations: [
          {
            path_id: 'science_pcm',
            path: "Science (PCM)",
            honest_take: "PCM is a solid gateway to engineering and design. It is demanding, but offers maximum career versatility.",
            requires_entrance_exam: "JEE Main / BITSAT",
            opens_doors_to: ["Software Engineering", "Architecture", "Data Analytics"],
            watch_out_for: "Significantly higher academic rigour compared to Class 10.",
            backup_plan: "Transition to Commerce or BCA if mathematics/physics feels too difficult."
          },
          {
            path_id: 'commerce_maths',
            path: "Commerce with Applied Mathematics",
            honest_take: "Focuses heavily on business, accounting, and finance. Practical and structured with good industry opportunities.",
            requires_entrance_exam: "None",
            opens_doors_to: ["Chartered Accountancy", "Business Analytics", "Investment Banking"],
            watch_out_for: "Requires strong logical and quantitative abilities.",
            backup_plan: "General Commerce without Maths if Accounting gets too complex."
          },
          {
            path_id: 'diploma_polytechnic',
            path: "Polytechnic Diploma (Engineering)",
            honest_take: "A hands-on, job-ready route after 10th. You can start earning sooner or join B.Tech directly in the 2nd year via lateral entry.",
            requires_entrance_exam: "None (stream selection, not entrance-based)",
            opens_doors_to: ["Junior Engineer / Technician", "B.Tech via lateral entry", "Government technical jobs"],
            watch_out_for: "Less theory than a degree; aim for lateral entry if you want to go further.",
            backup_plan: "Switch to Science (PCM) in 11th if you prefer the degree route."
          }
        ]
      }
    }

    if (stream.includes('PCM')) {
      return {
        recommendations: [
          {
            path_id: 'btech_cs_ai',
            path: "B.Tech Computer Science & AI",
            honest_take: "The most popular engineering field in India. Great packages if you code regularly, but entry competition is intense.",
            requires_entrance_exam: "JEE Main / COMEDK / KCET",
            opens_doors_to: ["Software Engineer", "AI Developer", "Cloud Solutions Architect"],
            watch_out_for: "High market saturation; you need a strong portfolio of projects to stand out.",
            backup_plan: "BCA followed by an MCA to enter the IT sector."
          },
          {
            path_id: 'bsc_data_science',
            path: "B.Sc in Data Science / Analytics",
            honest_take: "A modern analytics pathway focusing on statistics, programming, and databases. An excellent alternative to engineering.",
            requires_entrance_exam: "CUET / None",
            opens_doors_to: ["Data Analyst", "Database Manager", "Business Analyst"],
            watch_out_for: "Requires a strong aptitude for mathematics and logical reasoning.",
            backup_plan: "General B.Sc in Information Technology."
          }
        ]
      }
    } else if (stream.includes('PCB')) {
      return {
        recommendations: [
          {
            path_id: 'bsc_biotech',
            path: "B.Sc Biotechnology / Genetics",
            honest_take: "Great research and lab-oriented career. Avoids NEET pressure but requires higher education to secure top roles.",
            requires_entrance_exam: "CUET / None",
            opens_doors_to: ["Biotech Researcher", "Lab Scientist", "Pharmaceutical Analyst"],
            watch_out_for: "An M.Sc or Ph.D is practically mandatory for high-paying research roles.",
            backup_plan: "Transition to MBA in Biotech or Clinical Research Management."
          },
          {
            path_id: 'bpt_physiotherapy',
            path: "Bachelor of Physiotherapy (BPT)",
            honest_take: "An excellent clinical option with a focus on patient rehabilitation. High demand in private clinics and sports academies.",
            requires_entrance_exam: "State CET / NEET",
            opens_doors_to: ["Physiotherapist", "Sports Rehab Specialist", "Health Consultant"],
            watch_out_for: "Low initial salaries before you build a reputation and private practice.",
            backup_plan: "Diploma in Hospital Administration."
          }
        ]
      }
    } else {
      return {
        recommendations: [
          {
            path_id: 'ca_finance',
            path: "Chartered Accountancy (CA)",
            honest_take: "One of the most prestigious finance careers. Affordable to pursue but demands immense discipline and multiple attempt persistence.",
            requires_entrance_exam: "CA Foundation",
            opens_doors_to: ["Corporate Auditor", "Tax consultant", "Financial Controller"],
            watch_out_for: "Very low pass percentages in intermediate and final exams.",
            backup_plan: "B.Com + MBA in Finance."
          },
          {
            path_id: 'bba_finance',
            path: "BBA in Financial Analyst",
            honest_take: "A highly dynamic management degree focusing on corporate finance, stocks, and investments. Offers faster corporate entry.",
            requires_entrance_exam: "CUET / IPMAT",
            opens_doors_to: ["Financial Analyst", "Portfolio Coordinator", "Operations Lead"],
            watch_out_for: "Placements depend heavily on college tiers; aim for top 50 B-schools.",
            backup_plan: "Postgraduate preparation for CAT or GMAT."
          }
        ]
      }
    }
  }
}

/**
 * Returns true if any college in `colleges` has a `city`/`state` (lower-cased,
 * trimmed) equal to the student's preferred `prefCity`/`prefState`. Placeholder
 * values ("", "any state", "any") are treated as "no preference" by the caller
 * before this function is invoked, so an empty prefState/prefCity here simply
 * never matches (no in-region match possible when nothing is preferred).
 */
function hasInRegionMatch(colleges, prefState, prefCity) {
  return (colleges || []).some(c => {
    const cState = (c.state || '').trim().toLowerCase()
    const cCity = (c.city || '').trim().toLowerCase()
    return (prefState && cState === prefState) || (prefCity && cCity === prefCity)
  })
}

/**
 * 4. College Recommendation Agent
 */
export async function runCollegeRecommendationAgent(state) {
  const form = state.formData
  const careerPaths = state.careerPaths
  const retrievedColleges = state.retrievedColleges
  // Student's preferred region, normalized. Placeholder values mean "no preference".
  const rawPrefState = (form.preferredState || '').trim().toLowerCase()
  const rawPrefCity = (form.preferredCity || '').trim().toLowerCase()
  const NO_PREFERENCE = new Set(['', 'any state', 'any'])
  const prefState = NO_PREFERENCE.has(rawPrefState) ? '' : rawPrefState
  const prefCity = NO_PREFERENCE.has(rawPrefCity) ? '' : rawPrefCity
  // DETERMINISTIC (no LLM): the retrieved colleges are already DB-verified and
  // ranked by the RAG agent, so mapping them to paths is a pure lookup. This
  // removes one LLM call per request AND is more accurate than asking the model
  // to re-pick colleges (which risked hallucination and needed a guardrail).
  {
    return {
      mappings: (careerPaths.recommendations || []).map(opt => {
        const pathId = opt.path_id || ''
        const pathLower = (opt.path || '').toLowerCase()
        let fallbackColleges = []

        if (pathId === 'ca_finance' || pathId === 'bba_finance' ||
            pathLower.includes('commerce') || pathLower.includes('accountancy') || pathLower.includes('bba') || pathLower.includes('finance') || pathLower.includes('ca')) {
          fallbackColleges = [
            {
              name: "Shri Ram College of Commerce",
              city: "Delhi",
              state: "Delhi",
              feeRange: "₹58,000–₹1,08,000/yr",
              admissionMode: "CUET",
              whyFit: "Top-ranked commerce college in India with highly subsidized fees."
            },
            {
              name: "Symbiosis College of Arts and Commerce",
              city: "Pune",
              state: "Maharashtra",
              feeRange: "₹1,28,000–₹2,15,000/yr",
              admissionMode: "Merit / Direct",
              whyFit: "Highly respected institution for business and commerce studies."
            }
          ]
        } else if (pathId.includes('humanities') || pathId.includes('arts') ||
                   pathLower.includes('arts') || pathLower.includes('humanities') || pathLower.includes('ias') || pathLower.includes('civil')) {
          fallbackColleges = [
            {
              name: "Lady Shri Ram College",
              city: "Delhi",
              state: "Delhi",
              feeRange: "₹52,000–₹1,02,000/yr",
              admissionMode: "CUET",
              whyFit: "Elite humanities institution with extremely affordable fees."
            },
            {
              name: "St. Xavier's College Mumbai",
              city: "Mumbai",
              state: "Maharashtra",
              feeRange: "₹92,000–₹1,72,000/yr",
              admissionMode: "CUET / Entrance",
              whyFit: "Historical institution renowned for arts and liberal education."
            }
          ]
        } else if (pathId === 'bsc_biotech' || pathId === 'bpt_physiotherapy' ||
                   pathLower.includes('doctor') || pathLower.includes('neet') || pathLower.includes('mbbs') || pathLower.includes('biotech') || pathLower.includes('physiotherapy')) {
          fallbackColleges = [
            {
              name: "AIIMS New Delhi",
              city: "Delhi",
              state: "Delhi",
              feeRange: "₹50,000–₹1,15,000/yr",
              admissionMode: "NEET-UG",
              whyFit: "India's premier medical institute with highly subsidized education fees."
            },
            {
              name: "Madras Medical College",
              city: "Chennai",
              state: "Tamil Nadu",
              feeRange: "₹48,000–₹1,02,000/yr",
              admissionMode: "NEET-UG",
              whyFit: "Respected state-run medical institution offering affordable learning."
            }
          ]
        } else {
          // Default Science/Engineering (PCM paths including btech_cs_ai, bsc_data_science)
          fallbackColleges = [
            {
              name: "RV College of Engineering",
              city: "Bangalore",
              state: "Karnataka",
              feeRange: "₹1,40,000–₹2,25,000/yr",
              admissionMode: "KCET / COMEDK",
              whyFit: "Top-tier college offering excellent tech exposure and placements."
            },
            {
              name: "PES University",
              city: "Bangalore",
              state: "Karnataka",
              feeRange: "₹1,95,000–₹3,15,000/yr",
              admissionMode: "PESSAT / KCET",
              whyFit: "Premium infrastructure and direct corporate recruiter partnerships."
            }
          ]
        }

        // Adjust fallback colleges if the budget is very low (e.g., below_20k or below_1L),
        // but only substitute to NIT Patna when no in-region affordable option already
        // exists — and disclose the substitution reason when it does happen.
        if (form.budget === 'below_20k' || form.budget === 'below_1L') {
          const inRegion = hasInRegionMatch(fallbackColleges, prefState, prefCity)
          if (!inRegion) {
            fallbackColleges = fallbackColleges.map(c => {
              if (c.name === 'RV College of Engineering' || c.name === 'PES University') {
                return {
                  ...c,
                  name: "NIT Patna",
                  city: "Patna",
                  state: "Bihar",
                  feeRange: "₹1,18,000–₹1,80,000/yr",
                  admissionMode: "JEE Main (State Quota)",
                  whyFit: "No affordable engineering college found in your region — nearest subsidized option is in Patna."
                }
              }
              return c
            })
          }
        }

        return {
          path_id: opt.path_id,
          path: opt.path,
          colleges: retrievedColleges.length > 0
            ? retrievedColleges.slice(0, 3).map(c => ({
                name: c.name,
                city: c.city,
                state: c.state,
                feeRange: `₹${c.yearly_cost_min.toLocaleString('en-IN')}–₹${c.yearly_cost_max.toLocaleString('en-IN')}/yr`,
                admissionMode: form.preferredModeOfAdmission || "Entrance Exam / Merit",
                whyFit: "Directly matches academic stream and falls within preferred budget thresholds."
              }))
            : fallbackColleges
        }
      })
    }
  }
}

/**
 * 5. Scholarship Agent
 */
export async function runScholarshipAgent(state) {
  const retrievedScholarships = state.retrievedScholarships
  // DETERMINISTIC (no LLM): scholarships come from the DB (RAG-filtered by the
  // student's income/marks/stream). Presenting them is a lookup, not reasoning —
  // and using the verified rows avoids the LLM inventing fake scholarship names.
  {
    return {
      scholarships: retrievedScholarships.length > 0
        ? retrievedScholarships.slice(0, 2).map(s => ({
            name: s.name,
            description: s.description,
            eligibility: `Marks > ${s.eligibility_marks_min}%, Income < ${s.eligibility_income_max_lakh}L`,
            amount: "Tuition waiver or ₹50,000 annual grant",
            applicationUrl: s.application_url
          }))
        : [
            {
              name: "Post-Matric Scholarship Scheme",
              description: "Provides financial assistance to students belonging to minority and backward classes.",
              eligibility: "Income < ₹2.5 Lakh/yr, Marks > 50%",
              amount: "Covers complete admission fees & monthly stipend",
              applicationUrl: "https://scholarships.gov.in"
            },
            {
              name: "HDFC Badhte Kadam Scholarship",
              description: "Corporate social responsibility initiative assisting students from low-income families.",
              eligibility: "Marks > 60%, Income < ₹6L/yr",
              amount: "₹30,000–₹1,00,000/yr",
              applicationUrl: "https://www.buddy4study.com"
            }
          ]
    }
  }
}

/**
 * 6. Study Abroad Agent
 */
export async function runStudyAbroadAgent(state) {
  const form = state.formData
  // DETERMINISTIC (no LLM): study-abroad feasibility is a simple budget-based
  // rule. Keeping it code-driven removes another LLM call and keeps the numbers
  // consistent rather than letting the model invent tuition figures.
  {
    const costLow = form.budget === 'below_2L' || form.budget === '2L-5L'
    return {
      isFeasible: !costLow,
      recommendedCountry: costLow ? "Germany (Public Universities have zero tuition)" : "United States",
      targetUniversities: costLow ? ["TUM Munich", "RWTH Aachen"] : ["ASU Phoenix", "UT Dallas"],
      requiredExams: costLow ? ["IELTS Academic", "TestDaF (German)"] : ["SAT", "IELTS / TOEFL"],
      estimatedYearlyCost: costLow ? "₹8,00,000/yr (Living expenses only)" : "₹25,00,000–₹35,00,000/yr",
      visaDifficulty: "Medium (Requires blocked account for living proof)",
      scholarshipsAvailable: ["DAAD Scholarship", "Fulbright-Nehru Grant"]
    }
  }
}

/**
 * 7. Career Roadmap Agent
 */
export async function runCareerRoadmapAgent(state) {
  const form = state.formData
  const careerPaths = state.careerPaths
  try {
    const prompt = `
    You are the Career Roadmap Agent. Generate a detailed 4-year learning roadmap for each recommended path.
    Career Options: ${JSON.stringify(careerPaths)}
    Class Level: ${form.classLevel || 'class12'}
    Student Income Range: ${form.incomeRange}

    Generate a 4-year milestone grid. If Class 10, Year 1/2 are school, Year 3/4 are college. If Class 12, Years are college 1-4.
    IMPORTANT: The "path_id" in each roadmap MUST exactly match the "path_id" from the Career Options above. Do NOT alter or omit it.
    Respond ONLY with a JSON object:
    {
      "roadmaps": [
        {
          "path_id": "Copy exactly from Career Options — do not change",
          "path": "Career/Course name",
          "years": [
            {
              "year": 1,
              "focus": "Focus of this year",
              "skills": ["Skill 1", "Skill 2"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            },
            {
              "year": 2,
              "focus": "Focus of this year",
              "skills": ["Skill 1"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            },
            {
              "year": 3,
              "focus": "Focus of this year",
              "skills": ["Skill 1"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            },
            {
              "year": 4,
              "focus": "Focus of this year",
              "skills": ["Skill 1"],
              "certifications": ["Cert 1"],
              "projects": ["Project 1"],
              "milestones": ["Milestone 1"]
            }
          ]
        }
      ]
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[CareerRoadmapAgent] Falling back to local domain-aware roadmap maker...')
    return {
      roadmaps: (careerPaths.recommendations || []).map(opt => ({
        path_id: opt.path_id,
        path: opt.path,
        years: buildRoadmapForPath(opt.path, opt.requires_entrance_exam),
      }))
    }
  }
}

// Domain-aware roadmap builder so the fallback reflects the ACTUAL path
// (medical ≠ engineering ≠ commerce ≠ law ≠ diploma), never a generic tech one.
function buildRoadmapForPath(pathName = '', exam = '') {
  const p = pathName.toLowerCase()
  const examNote = exam && exam !== 'None' ? exam : 'the relevant entrance/qualifying exam'

  const mk = (year, focus, skills, certifications, projects, milestones) =>
    ({ year, focus, skills, certifications, projects, milestones })

  // Medical (MBBS/BDS/nursing/allied/pharmacy/physio)
  if (/mbbs|bds|medic|nurs|pharm|physio|bams|bhms|doctor|allied|radiolog|optom/.test(p)) {
    return [
      mk(1, 'Build strong biology & chemistry foundations and begin exam prep', ['NCERT mastery', 'Time management', 'Note-making'], [`${examNote} foundation course`], ['Maintain a revision journal'], ['Complete Class 11 syllabus', 'Attempt first mock tests']),
      mk(2, 'Intensive entrance preparation and full syllabus revision', ['Problem-solving speed', 'Test temperament'], [`${examNote} crash course`], ['Weekly full-length mocks'], ['Score consistently in mocks', 'Clear the entrance exam']),
      mk(3, 'Enter the professional program; master clinical/theory basics', ['Anatomy/physiology or core subjects', 'Lab & practical skills'], ['College practical certifications'], ['Case studies / lab work'], ['Clear university exams', 'Start clinical exposure']),
      mk(4, 'Specialise, gain clinical hours and plan PG/licensing', ['Advanced clinical skills', 'Patient communication'], ['Internship/clinical certification'], ['Supervised clinical rotations'], ['Complete internship', 'Prepare for PG/licensing exam']),
    ]
  }
  // Commerce / finance (CA/CS/CMA/B.Com/BBA/economics)
  if (/ca\b|chartered|company secretary|cma|b\.?com|bba|bms|commerce|finance|account|econom/.test(p)) {
    return [
      mk(1, 'Build accounting, economics and quantitative foundations', ['Accounting basics', 'Business maths', 'MS Excel'], ['Foundation level (CA/CS/CMA) or NISM basics'], ['Personal budget & mock ledger project'], ['Clear foundation exams', 'Understand core commerce concepts']),
      mk(2, 'Intermediate concepts: taxation, audit, corporate law', ['Taxation basics', 'Financial analysis'], ['Intermediate professional level / advanced Excel'], ['Analyse a real company\u2019s financials'], ['Clear intermediate exams', 'Start articleship/internship if applicable']),
      mk(3, 'Practical training, internships and specialisation', ['Auditing', 'Financial modelling', 'Communication'], ['Advanced finance certification (e.g. financial modelling)'], ['Internship at a firm / live audit'], ['Complete internship', 'Build a professional network']),
      mk(4, 'Final exams, placements and career entry', ['Interview & case prep', 'Domain expertise'], ['Final professional level / MBA prep'], ['Capstone finance project'], ['Clear final exams', 'Secure a role or PG seat']),
    ]
  }
  // Law
  if (/law|llb|legal/.test(p)) {
    return [
      mk(1, 'Foundations of law, legal reasoning and language', ['Legal reasoning', 'English & GK', 'Reading speed'], [`${examNote} prep (CLAT/AILET)`], ['Debate/moot participation'], ['Clear the law entrance', 'Join a good law school']),
      mk(2, 'Core subjects: constitutional, contract, criminal law', ['Legal research', 'Drafting'], ['Legal research certification'], ['First moot court'], ['Strong grades', 'Join a legal-aid cell']),
      mk(3, 'Internships with firms/chambers and specialisation', ['Client counselling', 'Case analysis'], ['Specialisation course (corporate/IPR/etc.)'], ['Internships at law firms/courts'], ['Complete multiple internships', 'Publish a paper/blog']),
      mk(4, 'Prepare for practice, judiciary, or corporate roles', ['Advocacy or corporate law', 'Interview prep'], ['Bar exam / judiciary prep'], ['Final-year dissertation'], ['Graduate', 'Secure a firm/judiciary/LLM path']),
    ]
  }
  // Design / creative
  if (/design|b\.?des|animation|vfx|fashion|architect|fine art|ux|ui/.test(p)) {
    return [
      mk(1, 'Build design fundamentals and a starter portfolio', ['Sketching', 'Design principles', 'Basic tools (Figma/Photoshop)'], [`${examNote} prep (UCEED/NID/NIFT)`], ['Personal portfolio of 3-5 pieces'], ['Clear design entrance', 'Join a design program']),
      mk(2, 'Specialise (UI/UX, product, fashion, animation)', ['Chosen-specialisation tools', 'Design thinking'], ['Specialisation certification'], ['2-3 real briefs / client-style projects'], ['Grow portfolio', 'Win/enter a design competition']),
      mk(3, 'Internship and industry-standard workflow', ['Collaboration', 'Prototyping', 'Feedback loops'], ['Industry tool certification'], ['Internship at a studio/startup'], ['Complete internship', 'Publish case studies']),
      mk(4, 'Professional portfolio and job/freelance launch', ['Portfolio storytelling', 'Interview prep'], ['Advanced/pro certification'], ['Capstone design project'], ['Graduate with a strong portfolio', 'Secure a design role/freelance clients']),
    ]
  }
  // Diploma / vocational / lateral entry
  if (/diploma|polytechnic|iti|vocational|b\.?voc|lateral|apprentic|certification/.test(p)) {
    return [
      mk(1, 'Master the practical trade fundamentals hands-on', ['Core trade skills', 'Workshop safety', 'Tool handling'], ['Trade foundation certificate'], ['Hands-on shop-floor tasks'], ['Complete year-1 practicals', 'Build a skills logbook']),
      mk(2, 'Advance skills and prepare for lateral entry / jobs', ['Advanced trade techniques', 'Basic CAD/software for the trade'], ['Advanced skill certification'], ['A real, functional build/repair project'], ['Clear diploma exams', 'Prepare for LEET/ECET if going to B.Tech']),
      mk(3, 'Lateral entry to degree OR skilled employment', ['Applied engineering / specialisation', 'Workplace communication'], ['Industry-recognised certification'], ['Apprenticeship or 2nd-year degree projects'], ['Join B.Tech 2nd year or a skilled job', 'Gain paid experience']),
      mk(4, 'Specialise and grow into a senior/technical role', ['Supervisory skills', 'Advanced tools'], ['Sector-specific advanced certification'], ['Lead a small project/team'], ['Earn a promotion or graduate', 'Plan next skill upgrade']),
    ]
  }
  // Default: engineering / tech / science
  return [
    mk(1, 'Build core fundamentals and theoretical foundations', ['Core subject fundamentals', 'Basic programming/logic', 'Study discipline'], ['Introductory certificate (Coursera/edX/NPTEL)'], ['A small starter project'], ['Understand fundamentals', 'Set a study schedule']),
    mk(2, 'Master practical intermediate skills and tools', ['Intermediate tools', 'Teamwork & version control'], ['Domain technical certification'], ['A medium-sized project'], ['Build an online profile (LinkedIn/GitHub)', 'Join a competition/hackathon']),
    mk(3, 'Secure an internship and specialise', ['Specialisation subjects', 'Real-world problem solving'], ['Advanced/industry certification'], ['A summer internship or live project'], ['Complete an internship', 'Ship something real']),
    mk(4, 'Prepare for placements or higher studies', ['Interview & aptitude prep', 'Communication'], ['Capstone credential'], ['A production-ready capstone project'], ['Graduate with a strong portfolio', 'Secure a job or PG seat']),
  ]
}

/**
 * 8. Mentor Agent
 */
export async function runMentorAgent(state) {
  const form = state.formData
  const stream = form.stream || ''
  
  let mentors = []
  if (supabase) {
    try {
      const { data } = await supabase
        .from('mentors')
        .select('name, role, company, stream_expertise, rating, bio, cal_link')
        .limit(5)
      mentors = data || []
    } catch (_) {}
  }

  // Fallback default mentors if DB has none
  if (!mentors.length) {
    mentors = [
      { name: 'Dr. Vivek Sharma', role: 'Software Architect', company: 'Google', stream_expertise: 'Science (PCM)', rating: 4.8, bio: 'Experienced developer, mentor for IIT aspirants and computer science graduates.' },
      { name: 'Ananya Roy, CA', role: 'Audit Manager', company: 'EY', stream_expertise: 'Commerce', rating: 4.9, bio: 'CA professional helping commerce students navigate intermediate papers and internships.' },
      { name: 'Dr. Priya Nair', role: 'Senior Surgeon', company: 'Apollo Hospitals', stream_expertise: 'Science (PCB)', rating: 4.7, bio: 'Passionate medical educator guiding NEET students on careers in medicine and biotechnology.' }
    ]
  }

  // Filter or score based on stream matching
  const matched = mentors.map(m => {
    let score = 5
    if (m.stream_expertise && m.stream_expertise.includes(stream)) {
      score += 15
    }
    return { ...m, matchScore: score }
  }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 3)

  return matched
}

/**
 * 9. YouTube Resource Agent
 */
export async function runYouTubeResourceAgent(state) {
  const careerPaths = state.careerPaths || { recommendations: [] }
  const paths = (careerPaths.recommendations || []).map(r => r.path)

  const videosMap = {
    'B.Tech': [
      { title: 'Computer Science & Engineering Roadmap', channel: 'Apna College', embedId: 'V9a8Z29eM5g' },
      { title: 'IIT/NIT Life & Campus Tour', channel: 'IIT Kharagpur', embedId: 'xP8s_d57c2k' }
    ],
    'Medical': [
      { title: 'NEET Prep Strategies & Time Table', channel: 'Physics Wallah', embedId: 'HjU3s3B4g8k' },
      { title: 'MBBS Student Life in India', channel: 'Doctor V', embedId: 'KjD3s24kLs9' }
    ],
    'Commerce': [
      { title: 'CA Foundation Guidance & Prep', channel: 'CA Rachana Ranade', embedId: 'L8s2jD9fS8g' },
      { title: 'Careers in Finance & Investment Banking', channel: 'Ankur Warikoo', embedId: 'T9sL29d8k1w' }
    ]
  }

  const results = []
  for (const path of paths) {
    let matched = false
    for (const key of Object.keys(videosMap)) {
      if (path.toLowerCase().includes(key.toLowerCase())) {
        results.push(...videosMap[key].map(v => ({ ...v, path })))
        matched = true
        break
      }
    }
    if (!matched) {
      results.push({
        title: `${path} Career Guidance Video`,
        channel: 'Aage Kya? Curated',
        embedId: '3sD9fsH4kLs',
        path
      })
    }
  }

  return results.slice(0, 4)
}

/**
 * 10. Summary Agent
 */
export async function runSummaryAgent(state) {
  const form = state.formData
  const careerPaths = state.careerPaths
  const collegeRecommendations = state.collegeRecommendations
  const scholarshipRecommendations = state.scholarshipRecommendations
  try {
    const prompt = `
    You are the Summary Agent. Synthesize the findings of all career agents into a warm, encouraging summary.
    Student Profile: Name: ${form.fullName}, Marks: ${form.marks}%, Stream: ${form.stream}
    Career Paths recommended: ${JSON.stringify(careerPaths)}
    Colleges mapped: ${JSON.stringify(collegeRecommendations)}
    Scholarships found: ${JSON.stringify(scholarshipRecommendations)}

    Write a unified final guidance wrap-up.
    Respond ONLY with a JSON object:
    {
      "summary": "Warm 3-sentence summary of recommendations and opportunities.",
      "oneThingToDoThisWeek": "One specific actionable task for the student this week (e.g. check a website, talk to a mentor)."
    }
    `
    return await runLLMAgent(prompt)
  } catch (err) {
    console.warn('[SummaryAgent] Falling back to local mock synthesis...')

    // Guard preferredState interpolation: only reference state if non-empty
    // and meaningful (not just whitespace). Otherwise use generic phrasing.
    const trimmedState = (form.preferredState || '').trim()
    const geoPhrase = trimmedState
      ? `in ${trimmedState}`
      : 'across India'

    // Detect stream-exam mismatch for advisory in summary
    const mismatchResult = detectStreamExamMismatch(form.stream, form.preferredModeOfAdmission)
    const advisoryNote = mismatchResult.isMismatch
      ? ` Note: ${mismatchResult.advisory}`
      : ''

    return {
      summary: `Based on your ${form.stream || 'studies'} stream and interest in ${form.interests || 'building items'}, you have outstanding pathways ahead. By targeting top institutions ${geoPhrase} and securing active scholarship assistance, you can achieve your career objectives.${advisoryNote}`,
      oneThingToDoThisWeek: "Look up the official website of the target entrance exams and verify the application deadlines."
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// RESPONSE ASSEMBLY
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Assembles the final API response from a completed orchestration state and
 * runs it through the evidence guardrail.
 *
 * Pure function (no LLM / DB / network I/O) so the join logic — which is where
 * the frontend's contract actually lives — can be unit-tested directly:
 *  - joins careerPaths ↔ collegeRecommendations ↔ roadmaps
 *  - dedups colleges by name for the projected `realistic_colleges`
 *  - derives `avg_yearly_cost` (class10 uses the budget band, class12 the fee range)
 *  - attaches explainability + ai_status, then applies the evidence guardrail
 *
 * @param state      the orchestration state graph (see runMultiAgentOrchestrator)
 * @param formData   the raw student form (only classLevel/budget are read here)
 * @param totalDurationMs wall-clock duration reported in explainability
 */
export function assembleGuidanceResponse(state, formData = {}, totalDurationMs = 0) {
  const assembled = {
    summary: state.finalSummary.summary,
    options: ((state.careerPaths && state.careerPaths.recommendations) || []).map(opt => {
      // ── Bug #1 fix: match by path_id (strict equality) with path-text fallback ──
      // Priority 1: both sides have path_id → exact match (no ambiguity)
      // Priority 2: only one side has path_id → match on normalized path text
      const matchMapping = (m) => {
        if (opt.path_id && m.path_id) return opt.path_id === m.path_id
        // Fallback for LLMs that omit path_id: normalized exact-text comparison
        return (m.path || '').trim().toLowerCase() === (opt.path || '').trim().toLowerCase()
      }

      const mappedCol = (state.collegeRecommendations || []).find(matchMapping)
      const mappedRoad = (state.roadmaps || []).find(matchMapping)

      if (!mappedCol) {
        console.warn(`[Orchestrator] No college mapping found for path_id="${opt.path_id}" path="${opt.path}"`)
      }
      if (!mappedRoad) {
        console.warn(`[Orchestrator] No roadmap found for path_id="${opt.path_id}" path="${opt.path}"`)
      }

      // Dedup by institution name before building the response — this is the
      // only place mappedCol.colleges is projected for the frontend, so it does
      // not affect state.collegeRecommendations used elsewhere.
      const dedupedColleges = mappedCol ? dedupCollegesByName(mappedCol.colleges) : []

      // For Class 10, the user is looking at high school + local coaching cost.
      // We estimate this cost based on their selected high school/coaching budget range.
      let costStr = '₹20,000–₹60,000/yr'
      if (formData.classLevel === 'class10') {
        const b = formData.budget
        if (b === 'below_20k') costStr = '₹5,000–₹20,000/yr'
        else if (b === '20k-60k') costStr = '₹20,000–₹60,000/yr'
        else if (b === '60k-1.5L') costStr = '₹60,000–₹1,50,000/yr'
        else if (b === 'above_1.5L') costStr = '₹1,50,000–₹2,50,000/yr'
      } else {
        costStr = dedupedColleges.length ? dedupedColleges[0].feeRange : '₹80,000–₹1,50,000/yr'
      }

      return {
        path: opt.path,
        honest_take: opt.honest_take,
        requires_entrance_exam: opt.requires_entrance_exam || 'None',
        realistic_colleges: dedupedColleges.map(c => c.name),
        avg_yearly_cost: costStr,
        opens_doors_to: opt.opens_doors_to || [],
        watch_out_for: opt.watch_out_for || 'Competition is high.',
        backup_plan: opt.backup_plan || 'Look into alternative courses.',
        roadmap_steps: mappedRoad ? mappedRoad.years : []
      }
    }),
    scholarship_to_check: state.scholarshipRecommendations.length ? state.scholarshipRecommendations[0].name : FALLBACK_SCHOLARSHIP_NAME,
    one_thing_to_do_this_week: state.finalSummary.oneThingToDoThisWeek,
    scholarships_list: state.scholarshipRecommendations.map(s => ({
      name: s.name,
      application_url: s.applicationUrl,
      deadline_pattern: 'Rolling basis',
      description: `${s.description} | Eligibility: ${s.eligibility} | Value: ${s.amount}`
    })),
    study_abroad: state.studyAbroadGuidance,
    mentors: state.mentorMatches,
    youtube_videos: state.youtubeResources,
    colleges_data: (state.retrievedColleges || []).reduce((acc, c) => {
      acc[c.name] = {
        source_url:      c.source_url,
        yearly_cost_min: c.yearly_cost_min,
        yearly_cost_max: c.yearly_cost_max,
        city:            c.city,
        state:           c.state,
        college_type:    c.college_type,
      }
      return acc
    }, {}),
    explainability: {
      totalDurationMs,
      steps: state.executionLogs || [],
      profile: state.profileAnalysis
    },
    // Tell the frontend whether real AI produced this, or the LLM was
    // unavailable (rate-limited / no key) and it fell back to sample data.
    ai_status: getAiStatus(),
  }

  // ─── EVIDENCE GUARDRAIL (single, centralized check) ───────────────────────
  // Verifies every college/scholarship name surfaced in the assembled response
  // traces back to a record an agent produced (DB-verified rows when RAG
  // returned any). See applyEvidenceGuardrail for why this is an invariant
  // check rather than an LLM-hallucination filter today.
  const { result: guardedResult, guardrail } = applyEvidenceGuardrail(assembled, state, formData)
  if (guardrail.removedUnsupportedCollegeClaims > 0 || guardrail.removedUnsupportedScholarshipClaim) {
    console.warn(
      `[EvidenceGuardrail] Dropped ${guardrail.removedUnsupportedCollegeClaims} college claim(s)` +
      `${guardrail.removedUnsupportedScholarshipClaim ? ' and 1 scholarship claim' : ''} with no verified record behind them.`
    )
  } else {
    console.log('[EvidenceGuardrail] Every surfaced college/scholarship name traces back to a verified record.')
  }

  return {
    ...guardedResult,
    explainability: { ...guardedResult.explainability, guardrail },
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CENTRAL STATE-GRAPH ORCHESTRATOR
// ──────────────────────────────────────────────────────────────────────────────

export async function runMultiAgentOrchestrator(formData) {
  const startTotal = Date.now()

  // 1. Initialize State Graph
  const state = {
    formData,
    profileAnalysis: null,
    retrievedColleges: [],
    retrievedScholarships: [],
    careerPaths: [],
    collegeRecommendations: [],
    scholarshipRecommendations: [],
    studyAbroadGuidance: null,
    roadmaps: [],
    mentorMatches: [],
    youtubeResources: [],
    finalSummary: null,
    executionLogs: []
  }

  const logStep = async (agentName, action) => {
    const start = Date.now()
    try {
      const output = await action()
      const duration = Date.now() - start
      state.executionLogs.push({
        agent: agentName,
        status: 'success',
        durationMs: duration,
        timestamp: new Date().toISOString()
      })
      return output
    } catch (err) {
      const duration = Date.now() - start
      state.executionLogs.push({
        agent: agentName,
        status: 'failed',
        durationMs: duration,
        error: err.message,
        timestamp: new Date().toISOString()
      })
      console.error(`Orchestration failure in node [${agentName}]:`, err.message)
      return null
    }
  }

  // ─── STAGE 1: DB retrieval (no LLM) + ONE combined AI call ───
  // The combined agent produces profile + career paths + roadmaps + summary in
  // a single LLM request (≈75% fewer tokens than the old 4-call pipeline).
  console.log('[Orchestrator] Starting Stage 1: DB retrieval + combined guidance')
  const [ragResult, combined] = await Promise.all([
    logStep('Search & Retrieval Agent', () => runSearchRetrievalAgent(state)),
    logStep('Combined Guidance Agent', () => runCombinedGuidanceAgent(state)),
  ])

  state.retrievedColleges = ragResult?.colleges || []
  state.retrievedScholarships = ragResult?.scholarships || []

  if (combined && Array.isArray(combined.recommendations) && combined.recommendations.length > 0) {
    // Combined call succeeded — unpack it into the state shape the rest expects.
    state.profileAnalysis = combined.profile || null
    state.careerPaths = { recommendations: combined.recommendations.map(r => ({
      path_id: r.path_id, path: r.path, honest_take: r.honest_take,
      requires_entrance_exam: r.requires_entrance_exam, opens_doors_to: r.opens_doors_to,
      watch_out_for: r.watch_out_for, backup_plan: r.backup_plan,
    })) }
    state.roadmaps = combined.recommendations.map(r => ({
      path_id: r.path_id, path: r.path, years: r.roadmap_years || [],
    }))
    state.finalSummary = { summary: combined.summary, oneThingToDoThisWeek: combined.oneThingToDoThisWeek }
    state._combinedUsed = true
  } else {
    // Combined call failed (AI down / bad JSON) → fall back to the per-agent
    // pipeline (which itself degrades to deterministic mocks).
    console.warn('[Orchestrator] Combined agent unavailable — using per-agent fallback pipeline.')
    // These three MUST run sequentially: the career agent reads
    // state.profileAnalysis and the roadmap agent reads state.careerPaths, so
    // each result has to be written to state before the next agent runs.
    const profileResult = await logStep('Profile Analysis Agent', () => runProfileAnalysisAgent(state))
    state.profileAnalysis = profileResult || { academicStanding: 'Medium', financialCategory: 'Subsidized', riskAppetite: 'Balanced', keyConstraints: [], keyStrengths: [], coachingNeeds: '' }

    const careerResult = await logStep('Career Recommendation Agent', () => runCareerRecommendationAgent(state))
    state.careerPaths = careerResult || { recommendations: [] }

    const roadmapResult = await logStep('Career Roadmap Agent', () => runCareerRoadmapAgent(state))
    state.roadmaps = roadmapResult?.roadmaps || []
    state.finalSummary = null
  }

  state.profileAnalysis = state.profileAnalysis || { academicStanding: 'Medium', financialCategory: 'Subsidized', riskAppetite: 'Balanced', keyConstraints: [], keyStrengths: [], coachingNeeds: '' }

  // ─── STAGE 2: Deterministic enrichment (NO LLM) — colleges, scholarships,
  //     study-abroad, mentors, YouTube, and summary fallback if needed ───
  console.log('[Orchestrator] Starting Stage 2: Deterministic enrichment (colleges, scholarships, mentors)')
  const [collegeResult, scholarshipResult, studyAbroadResult, mentorResult, youtubeResult] = await Promise.all([
    logStep('College Recommendation Agent', () => runCollegeRecommendationAgent(state)),
    logStep('Scholarship Agent', () => runScholarshipAgent(state)),
    logStep('Study Abroad Agent', () => runStudyAbroadAgent(state)),
    logStep('Mentor Agent', () => runMentorAgent(state)),
    logStep('YouTube Resource Agent', () => runYouTubeResourceAgent(state))
  ])

  state.collegeRecommendations = collegeResult?.mappings || []
  state.scholarshipRecommendations = scholarshipResult?.scholarships || []
  state.studyAbroadGuidance = studyAbroadResult || { isFeasible: false, recommendedCountry: 'Germany', requiredExams: [], targetUniversities: [], estimatedYearlyCost: 'N/A' }
  state.mentorMatches = mentorResult || []
  state.youtubeResources = youtubeResult || []

  // If we didn't get a summary from the combined call, synthesize one (no LLM).
  if (!state.finalSummary) {
    const sum = await logStep('Summary Agent', () => runSummaryAgent(state))
    state.finalSummary = sum || { summary: 'Guidance compiled.', oneThingToDoThisWeek: 'Review your options.' }
  }

  // (Summary already produced by the combined agent, or synthesized in Stage 2.)
  const totalDuration = Date.now() - startTotal
  console.log(`[Orchestrator] Multi-Agent Execution completed successfully in ${totalDuration}ms`)

  // Assemble the structured result in the shape expected by the frontend
  // (including explainability metadata) and run the evidence guardrail.
  return assembleGuidanceResponse(state, formData, totalDuration)
}
