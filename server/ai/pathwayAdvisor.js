/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PATHWAY ADVISOR — agentic, anti-hallucination recommendation engine
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Pipeline (each stage rechecks the previous one):
 *
 *   1. RETRIEVAL      Score questionnaire answers -> rank domains -> pull a
 *                     candidate list of REAL pathways from indiaPathways.js.
 *                     (Deterministic. No LLM. Cannot hallucinate.)
 *
 *   2. RECOMMENDATION The LLM ranks/selects from ONLY the candidate list and
 *                     writes student-friendly explanations. It is given the
 *                     exact allowed ids and told it may not invent any.
 *
 *   3. VERIFICATION   Every returned path_id is checked against the dataset.
 *                     Unknown ids are DROPPED. Facts (exams, eligibility,
 *                     duration, fees) are OVERWRITTEN from the dataset so the
 *                     LLM can never corrupt them. This is the recheck layer.
 *
 *   4. FALLBACK       If the LLM fails entirely, we return the top candidates
 *                     straight from the dataset with template explanations.
 *                     The user still gets accurate options, just less prose.
 *
 *  Net effect: explanations are AI-generated, but every fact and every course
 *  name is guaranteed to come from the verified dataset.
 */

import { createClient } from '@supabase/supabase-js'
import {
  scoreDomains,
  getCoursesByDomains,
  getCoursesForStream,
  getPathwaysForClassLevel,
  findPathwayById,
  computeAffordability,
  DATASET_META,
  DOMAINS,
  AFTER_CLASS_10,
} from '../data/indiaPathways.js'
import { callLLM as sharedCallLLM, getAiStatus } from './llmClient.js'

// ── Supabase (read-only college lookup) — lazy, resilient ────────────────────
let _sb = null
function getSupabase() {
  if (_sb !== null) return _sb
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key || url.includes('your-project-ref')) { _sb = false; return false }
  try {
    _sb = createClient(url, key, { auth: { persistSession: false } })
  } catch { _sb = false }
  return _sb
}

// Which college "streams" (as stored in the colleges table) serve each domain.
const DOMAIN_TO_COLLEGE_STREAMS = {
  engineering:  ['Science (PCM)'],
  computing:    ['Science (PCM)', 'Commerce'],
  medical:      ['Science (PCB)'],
  pure_science: ['Science (PCM)', 'Science (PCB)'],
  commerce:     ['Commerce'],
  management:   ['Commerce', 'Arts / Humanities'],
  law:          ['Arts / Humanities', 'Commerce'],
  design:       ['Arts / Humanities', 'Science (PCM)'],
  architecture: ['Science (PCM)'],
  arts:         ['Arts / Humanities'],
  media:        ['Arts / Humanities'],
  performing:   ['Arts / Humanities'],
  agriculture:  ['Science (PCB)'],
  hospitality:  ['Commerce', 'Arts / Humanities'],
  education:    ['Arts / Humanities'],
  defence:      ['Science (PCM)'],
  vocational:   ['Science (PCM)', 'Commerce', 'Arts / Humanities'],
}

/**
 * Find real colleges (from the seeded Supabase table) for a course, ranked by
 * proximity to the student's city/state, then by fit to marks/budget.
 * Returns [] if the DB isn't available (feature degrades gracefully).
 */
// Normalise common city name variants so "Bengaluru" matches DB "Bangalore" etc.
const CITY_ALIASES = {
  bengaluru: 'bangalore', bangalore: 'bangalore',
  mysuru: 'mysore', mysore: 'mysore',
  mangaluru: 'mangalore', mangalore: 'mangalore',
  'hubli-dharwad': 'hubli', hubli: 'hubli',
  mumbai: 'mumbai', 'navi mumbai': 'mumbai',
  prayagraj: 'allahabad', allahabad: 'allahabad',
  kochi: 'kochi', cochin: 'kochi',
  thiruvananthapuram: 'thiruvananthapuram', trivandrum: 'thiruvananthapuram',
  puducherry: 'puducherry', pondicherry: 'puducherry',
  vadodara: 'vadodara', baroda: 'vadodara',
  kozhikode: 'kozhikode', calicut: 'kozhikode',
  gurugram: 'gurgaon', gurgaon: 'gurgaon',
  'new delhi': 'delhi', delhi: 'delhi',
  tiruchirappalli: 'tiruchirappalli', trichy: 'tiruchirappalli',
}
function normCity(name) {
  const k = (name || '').trim().toLowerCase()
  return CITY_ALIASES[k] || k
}

async function findCollegesForCourse(course, formData, allColleges) {
  if (!allColleges || allColleges.length === 0) return []
  const wantStreams = new Set(DOMAIN_TO_COLLEGE_STREAMS[course.domain] || [])
  const marks = Number(formData.marks) || 0
  const city = normCity(formData.city)
  const stateName = (formData.state || '').replace(/\s*\(.*\)$/, '').toLowerCase() // strip "(NCT)" etc.

  // For specialised domains, only keep colleges that clearly serve that domain
  // (by name keywords), so e.g. a Design course doesn't list a Law university.
  const NAME_KEYWORDS = {
    design: ['design', 'nift', 'nid', 'srishti', 'fashion'],
    performing: ['fine art', 'music', 'performing', 'srishti', 'design'],
    law: ['law', 'legal', 'nlsiu', 'nalsar', 'nlu'],
    medical: ['medical', 'aiims', 'medicine', 'kmc', 'jipmer', 'cmc', 'nursing', 'dental'],
    architecture: ['architecture', 'planning', 'spa', 'design'],
    agriculture: ['agriculture', 'agri', 'veterinary', 'horticulture', 'farm'],
  }
  const keywords = NAME_KEYWORDS[course.domain]

  const scored = allColleges
    .filter((c) => {
      if (wantStreams.size === 0) return true
      const streamOk = (c.streams || []).some((s) => wantStreams.has(s))
      if (!streamOk) return false
      // Specialised-domain relevance guard (only if we have enough matches).
      if (keywords) {
        const name = (c.name || '').toLowerCase()
        return keywords.some((k) => name.includes(k))
      }
      return true
    })
    .map((c) => {
      let score = 0
      const cCity = normCity(c.city)
      const cState = (c.state || '').toLowerCase()
      // Proximity: same city >> same state >> national institutes >> rest
      if (city && cCity === city) score += 100
      else if (stateName && cState === stateName) score += 60
      if (c.national) score += 15
      // Marks fit (guidance only)
      if (marks > 0) {
        if (marks >= (c.min_marks || 0)) score += 20
        else if (marks + 10 >= (c.min_marks || 0)) score += 8
        else score -= 15
      }
      return { c, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ c }) => ({
      name: c.name,
      city: c.city,
      state: c.state,
      type: c.college_type,
      national: c.national,
      approx_fee: `₹${Number(c.yearly_cost_min || 0).toLocaleString('en-IN')}–₹${Number(c.yearly_cost_max || 0).toLocaleString('en-IN')}/yr`,
      source_url: c.source_url || null,
      nearby: city ? normCity(c.city) === city : (stateName ? (c.state || '').toLowerCase() === stateName : false),
    }))

  return scored
}

// ── LLM caller (lazy env read — same reasoning as Orchestrator fix) ──────────
// Thin wrapper over the shared LLM client so this module benefits from the same
// token circuit breaker, provider fallback and env handling as everything else.
async function callLLM(prompt, { json = true, maxTokens = 1200, modelOverride = null, temperature = 0.15 } = {}) {
  return sharedCallLLM(prompt, { json, maxTokens, modelOverride, temperature })
}

// ── STAGE 1: Retrieval — build the candidate list (deterministic) ────────────
export function retrieveCandidates(formData, answers) {
  const classLevel = formData.classLevel || 'class12'
  const { scores, ranked } = scoreDomains(answers || [])

  if (classLevel === 'class10') {
    // For class 10, score each STREAM by how many of the student's top domains it unlocks.
    const topDomains = ranked.slice(0, 6).map((d) => d.id)
    const streams = AFTER_CLASS_10.map((s) => {
      let score = 0
      for (const dom of (s.domainsUnlocked || [])) {
        const rank = topDomains.indexOf(dom)
        if (rank !== -1) score += (6 - rank) // higher-ranked domains contribute more
      }
      return { ...s, _score: score }
    })
    streams.sort((a, b) => b._score - a._score)
    // Keep all streams that scored, but ensure at least 4 candidates for choice.
    const scored = streams.filter((s) => s._score > 0)
    const candidates = (scored.length >= 3 ? scored : streams).slice(0, 6)
    return { classLevel, rankedDomains: ranked, scores, candidates }
  }

  // class12: candidates = courses in the top domains, filtered by the student's stream.
  const topDomainIds = ranked.slice(0, 5).map((d) => d.id)
  let byDomain = getCoursesByDomains(topDomainIds.length ? topDomainIds : ['computing', 'commerce', 'arts'])

  // Filter to the student's stream eligibility (if they've chosen one).
  const streamId = formData.streamId || mapStreamNameToId(formData.stream)
  if (streamId) {
    const eligibleIds = new Set(getCoursesForStream(streamId).map((c) => c.id))
    const filtered = byDomain.filter((c) => eligibleIds.has(c.id))
    if (filtered.length >= 3) byDomain = filtered
  }

  // Attach a domain-rank score so the LLM sees our ordering.
  const candidates = byDomain
    .map((c) => {
      const rank = topDomainIds.indexOf(c.domain)
      return { ...c, _score: rank === -1 ? 0 : (5 - rank) }
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 14) // cap candidate list so the prompt stays focused

  return { classLevel, rankedDomains: ranked, scores, candidates }
}

// Map a human stream name (from onboarding) to a dataset stream id.
function mapStreamNameToId(streamName) {
  if (!streamName) return null
  const s = streamName.toLowerCase()
  if (s.includes('pcmb')) return 'science_pcmb'
  if (s.includes('pcm')) return 'science_pcm'
  if (s.includes('pcb')) return 'science_pcb'
  if (s.includes('commerce') && s.includes('math')) return 'commerce_maths'
  if (s.includes('commerce')) return 'commerce_plain'
  if (s.includes('art') || s.includes('humanities')) return 'arts_humanities'
  return null
}

// ── STAGE 2 + 3: Recommend with the LLM, then verify against the dataset ─────
export async function recommendPathways(formData, answers, options = {}) {
  const { useJudge = false } = options
  const { classLevel, rankedDomains, candidates } = retrieveCandidates(formData, answers)

  // Give the LLM ONLY the candidate ids + minimal context. It selects & explains.
  const allowedIds = candidates.map((c) => c.id)
  const candidateBrief = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    difficulty: c.difficulty,
    demand: c.demand,
    entranceExams: c.entranceExams,
  }))

  const isClass10 = classLevel === 'class10'
  const prompt = `You are an honest Indian career counsellor helping a ${isClass10 ? 'Class 10 student choose a STREAM for Classes 11-12' : 'Class 12 student choose a course/career after 12th'}.

STUDENT CONTEXT:
- Class level: ${classLevel}
- Marks: ${formData.marks || 'unknown'}%
- Home state: ${formData.state || 'unknown'}
- Family income band: ${formData.incomeRange || 'unknown'}
- Stated interests: ${formData.interests || 'not specified'}
- Their answered interest areas (ranked): ${rankedDomains.slice(0, 5).map((d) => d.name).join(', ') || 'unclear'}

CANDIDATE ${isClass10 ? 'STREAMS' : 'COURSES'} (you MUST choose only from these — do NOT invent any):
${JSON.stringify(candidateBrief, null, 0)}

STRICT RULES:
1. Select the best 3-5 options ONLY from the candidate list above, using their exact "id".
2. NEVER invent a course, stream, exam, or fact. If unsure, pick fewer options.
3. Order them best-fit first, based on the student's interests, marks, and budget.
4. Always include at least one "safe / more accessible" option and be honest about difficulty.
5. Explanations must be simple, encouraging, and specific to THIS student (mention their interest).

Respond ONLY with JSON:
{
  "recommendations": [
    {
      "id": "exact id from candidate list",
      "why_this_fits": "2 warm sentences on why it suits THIS student's interests/marks",
      "honest_note": "1 honest sentence about difficulty, cost, or competition",
      "fit_label": "Strong Fit | Good Fit | Stretch Option | Safe Option"
    }
  ],
  "overall_advice": "2-3 sentence honest summary tying it together",
  "explore_next": "1 sentence nudging them to explore an adjacent option they might not have considered"
}`

  let llmResult = null
  let usedFallback = false
  try {
    llmResult = await callLLM(prompt)
  } catch (err) {
    console.warn('[PathwayAdvisor] LLM failed, using deterministic fallback:', err.message)
    usedFallback = true
  }

  // ── STAGE 3: VERIFICATION — recheck every id, overwrite facts from dataset ──
  const allowedSet = new Set(allowedIds)
  let verified = []
  const dropped = []

  if (llmResult && Array.isArray(llmResult.recommendations)) {
    for (const rec of llmResult.recommendations) {
      if (!allowedSet.has(rec.id)) {
        dropped.push(rec.id) // hallucinated or out-of-scope — drop it
        continue
      }
      const truth = findPathwayById(rec.id)
      if (!truth) { dropped.push(rec.id); continue }
      verified.push(buildOption(truth, {
        why_this_fits: sanitizeText(rec.why_this_fits),
        honest_note: sanitizeText(rec.honest_note),
        fit_label: ['Strong Fit', 'Good Fit', 'Stretch Option', 'Safe Option'].includes(rec.fit_label) ? rec.fit_label : 'Good Fit',
      }, isClass10))
    }
  }

  // ── STAGE 4: FALLBACK — ensure the student always gets accurate options ─────
  if (verified.length === 0) {
    usedFallback = true
    verified = candidates.slice(0, 4).map((truth) =>
      buildOption(truth, {
        why_this_fits: isClass10
          ? `This stream matches your interests and keeps strong options open for the future.`
          : `This course aligns with your interests${formData.interests ? ` in ${formData.interests}` : ''} and your stream.`,
        honest_note: difficultyNote(truth),
        fit_label: 'Good Fit',
      }, isClass10)
    )
  }

  // ── STAGE 5: Attach REAL colleges (class12 only), ranked by nearness ────────
  let collegesAvailable = false
  if (!isClass10) {
    const sb = getSupabase()
    if (sb) {
      try {
        const { data: allColleges, error } = await sb.from('colleges').select('*')
        if (!error && allColleges) {
          collegesAvailable = true
          for (const opt of verified) {
            const course = findPathwayById(opt.id)
            opt.colleges = await findCollegesForCourse(course, formData, allColleges)
          }
        }
      } catch (e) {
        console.warn('[PathwayAdvisor] college lookup failed:', e.message)
      }
    }
  }

  // ── STAGE 6: CONFIDENCE — score each option (0-100 + breakdown) ─────────────
  for (const opt of verified) {
    opt.confidence = scoreConfidence(opt, formData, rankedDomains, isClass10)
  }

  // ── STAGE 7: JUDGE (optional) — decoupled LLM fact-check of the prose ───────
  // A SEPARATE model reviews each explanation against the verified facts and
  // flags contradictions. Off by default (adds a call); enable per-request.
  let judgeSummary = null
  if (useJudge && verified.length > 0 && !usedFallback) {
    try {
      const verdicts = await judgeFaithfulness(verified, isClass10)
      let checked = 0, flagged = 0
      for (const opt of verified) {
        const v = verdicts.get(opt.id)
        if (!v) { opt.faithfulness = { checked: false }; continue }
        checked++
        const faithful = v.faithful !== false
        if (!faithful) {
          flagged++
          // Prose contradicted the data → drop the risky explanation, keep facts.
          opt.honest_note = difficultyNote(findPathwayById(opt.id))
          const issue = (sanitizeText(v.issue) || 'a possible inconsistency').replace(/\.+$/, '')
          opt.why_this_fits = `This option matches your profile. (Explanation auto-revised after our fact-check flagged: ${issue}.)`
          // A flagged item loses confidence.
          if (opt.confidence) opt.confidence.score = Math.max(0, opt.confidence.score - 25)
        }
        opt.faithfulness = { checked: true, faithful, issue: faithful ? '' : sanitizeText(v.issue) }
      }
      judgeSummary = { enabled: true, model: process.env.JUDGE_MODEL || 'openai/gpt-oss-20b', checked, flagged }
    } catch (e) {
      console.warn('[PathwayAdvisor] judge failed (non-fatal):', e.message)
      judgeSummary = { enabled: true, error: 'judge_unavailable' }
    }
  }

  // ── Discovery metric: how many NEW fields did this student uncover? ─────────
  const discovery = computeDiscovery(formData, verified, rankedDomains, isClass10)

  // Overall confidence = average of option confidences (for a headline number).
  const avgConfidence = verified.length
    ? Math.round(verified.reduce((s, o) => s + (o.confidence?.score || 0), 0) / verified.length)
    : 0

  return {
    classLevel,
    rankedDomains,
    location: { state: formData.state || '', city: formData.city || '' },
    provenance: DATASET_META,
    discovery,
    overall_confidence: { score: avgConfidence, ...labelForScore(avgConfidence) },
    judge: judgeSummary,
    options: verified,
    overall_advice: (llmResult && sanitizeText(llmResult.overall_advice)) ||
      'These options are matched to your interests and your marks. Explore each one before deciding — there is no single right answer.',
    explore_next: (llmResult && sanitizeText(llmResult.explore_next)) ||
      'Try answering a few more questions differently to discover adjacent fields you might enjoy.',
    ai_status: getAiStatus(),
    meta: {
      candidateCount: candidates.length,
      droppedHallucinations: dropped,
      usedFallback,
      grounded: true, // every fact comes from the dataset
      collegesAvailable,
    },
  }
}

// Build a fully dataset-grounded option object (facts NEVER come from the LLM).
function buildOption(truth, aiText, isClass10) {
  if (isClass10) {
    return {
      id: truth.id,
      type: 'stream',
      name: truth.name,
      subjects: truth.subjects || [],
      difficulty: truth.difficulty,
      why_this_fits: aiText.why_this_fits,
      honest_note: aiText.honest_note,
      fit_label: aiText.fit_label,
      good_if: truth.goodIf || [],
      avoid_if: truth.avoidIf || [],
      leads_to: (truth.leadsTo || []).map((id) => findPathwayById(id)?.name).filter(Boolean).slice(0, 5),
      switch_to: (truth.switchTo || []).map((id) => findPathwayById(id)?.name).filter(Boolean),
      description: truth.description,
      verified: true, // fact-checked against the curated dataset
    }
  }
  return {
    id: truth.id,
    type: 'course',
    name: truth.name,
    domain: truth.domain,
    difficulty: truth.difficulty,
    demand: truth.demand,
    duration_years: truth.durationYears,
    entrance_exams: truth.entranceExams,
    careers: truth.careers,
    higher_studies: truth.higherStudies,
    approx_annual_fee: truth.approxAnnualFee,
    affordability: computeAffordability(truth), // honest ROI / cost view
    why_this_fits: aiText.why_this_fits,
    honest_note: aiText.honest_note,
    fit_label: aiText.fit_label,
    description: truth.description,
    verified: true, // fact-checked against the curated dataset
  }
}

function difficultyNote(truth) {
  const d = truth.difficulty
  if (d === 'very_high') return 'This is a very demanding path — be ready for tough competition and sustained effort.'
  if (d === 'high') return 'This path is challenging and competitive, so consistent preparation matters.'
  if (d === 'moderate') return 'A balanced path — manageable with steady effort.'
  return 'A more accessible path that lets you start building skills quickly.'
}

// Strip anything that isn't a plain string; guard against prompt-injection echoes.
function sanitizeText(t) {
  if (typeof t !== 'string') return ''
  return t.replace(/[<>]/g, '').trim().slice(0, 400)
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIDENCE SCORER  (adapted from the capstone RAG ConfidenceScorer, but for
//  STRUCTURED data instead of vector retrieval)
// ═══════════════════════════════════════════════════════════════════════════
//  Three signals, weighted, → 0-100 + label + breakdown:
//    - profile_match : how well the student's marks/stream fit this pathway
//    - interest_match: how strongly their answers pointed at this domain
//    - data_grounding: how complete our verified data is (colleges found? etc.)
const CONFIDENCE_LABELS = [
  [85, 'Very High', '🟢'],
  [70, 'High', '🟡'],
  [50, 'Medium', '🟠'],
  [30, 'Low', '🔴'],
  [0, 'Very Low', '⚫'],
]

function labelForScore(score) {
  for (const [threshold, label, emoji] of CONFIDENCE_LABELS) {
    if (score >= threshold) return { label, emoji }
  }
  return { label: 'Very Low', emoji: '⚫' }
}

function scoreConfidence(option, formData, rankedDomains, isClass10) {
  // 1. Profile match — marks vs the pathway's rough expectation.
  const marks = Number(formData.marks) || 0
  const truth = findPathwayById(option.id)
  let profileMatch = 60 // neutral default when marks unknown
  if (marks > 0) {
    const need = isClass10 ? 0 : (truth?.minMarks12 || 0)
    if (marks >= need) profileMatch = 90
    else if (marks + 10 >= need) profileMatch = 65
    else profileMatch = 35
  }
  // Stream eligibility (class 12): if their stream can't take this course, drop it.
  if (!isClass10 && formData.stream) {
    const streamId = mapStreamNameToId(formData.stream)
    const eligible = truth?.eligibleStreams?.includes('any') || truth?.eligibleStreams?.includes(streamId)
    if (streamId && eligible === false) profileMatch = Math.min(profileMatch, 40)
  }

  // 2. Interest match — how high this option's domain ranked in the quiz.
  let interestMatch = 50
  const domain = isClass10 ? (truth?.domainsUnlocked || []) : [option.domain]
  const topIds = rankedDomains.map((d) => d.id)
  const bestRank = Math.min(...domain.map((d) => { const i = topIds.indexOf(d); return i === -1 ? 99 : i }))
  if (bestRank === 0) interestMatch = 95
  else if (bestRank === 1) interestMatch = 85
  else if (bestRank === 2) interestMatch = 72
  else if (bestRank <= 4) interestMatch = 58
  else interestMatch = 40

  // 3. Data grounding — do we have concrete verified data to back this up?
  let dataGrounding = 70 // course facts always come from the dataset
  if (!isClass10) {
    if (option.colleges && option.colleges.length > 0) {
      dataGrounding = option.colleges.some((c) => c.nearby) ? 95 : 82
    } else {
      dataGrounding = 60 // course verified, but no matching colleges found
    }
  } else {
    dataGrounding = 85 // stream data is fully specified
  }

  const score = Math.round(profileMatch * 0.4 + interestMatch * 0.35 + dataGrounding * 0.25)
  const { label, emoji } = labelForScore(score)
  return {
    score,
    label,
    emoji,
    breakdown: {
      profile_match: Math.round(profileMatch),
      interest_match: Math.round(interestMatch),
      data_grounding: Math.round(dataGrounding),
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  JUDGE LLM  (decoupled faithfulness check — from the capstone RAG framework)
// ═══════════════════════════════════════════════════════════════════════════
//  A SEPARATE model call reviews the generator's prose against the verified
//  dataset facts and flags any statement that contradicts the data (e.g. the
//  explanation says "no entrance exam" when the data lists JEE). This catches
//  subtle prose hallucinations that the deterministic id-check can't see.
//  Uses a different model from the generator to reduce self-preference bias.
async function judgeFaithfulness(options, isClass10) {
  // Build a compact "claims vs facts" payload for the judge. Include difficulty
  // and demand so subjective-sounding words ("competitive", "demanding") are
  // actually grounded in facts and don't get mis-flagged.
  const items = options.map((o) => ({
    id: o.id,
    name: o.name,
    facts: isClass10
      ? { subjects: o.subjects, leads_to: o.leads_to, difficulty: o.difficulty }
      : { entrance_exams: o.entrance_exams, duration_years: o.duration_years, careers: o.careers, approx_annual_fee: o.approx_annual_fee, difficulty: o.difficulty, demand: o.demand },
    ai_explanation: `${o.why_this_fits} ${o.honest_note}`,
  }))

  const prompt = `You are a FACT-CHECK JUDGE. For each item you are given VERIFIED FACTS and an AI-written EXPLANATION.
Your only job: flag ONLY DIRECT CONTRADICTIONS between the explanation and the facts.

Mark faithful=false ONLY when the explanation states something the facts directly disprove, such as:
- claims "no entrance exam" when exams ARE listed
- states a wrong duration (e.g. "3 years" when facts say 4)
- names a career or fee the facts contradict

Do NOT flag for being incomplete, mentioning only one of several exams, tone, opinions,
encouragement, or general advice. Mentioning a subset of the listed facts is FINE (faithful=true).
Subjective descriptions are FINE and faithful — e.g. calling a high-difficulty course
"competitive/demanding/tough", or a high-demand course "in demand", matches the facts.
Only DIRECT factual contradictions count. When in doubt, mark faithful=true.

ITEMS:
${JSON.stringify(items, null, 0)}

Respond ONLY with JSON:
{
  "verdicts": [
    { "id": "item id", "faithful": true or false, "issue": "short reason if not faithful, else empty string" }
  ]
}`

  // Judge model: a DIFFERENT model family than the generator (llama) to reduce
  // self-preference bias, and a capable, future-proof one (gpt-oss).
  const judgeModel = process.env.JUDGE_MODEL || 'openai/gpt-oss-20b'
  const result = await callLLM(prompt, { json: true, maxTokens: 800, modelOverride: judgeModel, temperature: 0 })
  const verdicts = Array.isArray(result?.verdicts) ? result.verdicts : []
  const byId = new Map(verdicts.map((v) => [v.id, v]))
  return byId
}

/**
 * "Discovery" metric — the app's core value: surfacing options a student
 * didn't already have in mind. We infer what they came in thinking about from
 * their free-text interests, then count recommended fields NOT in that set.
 */
function computeDiscovery(formData, options, rankedDomains, isClass10) {
  const interestText = (formData.interests || '').toLowerCase()

  // For streams, "field" = the domains each stream unlocks; for courses, the domain.
  const recommendedDomains = new Set()
  for (const opt of options) {
    if (isClass10) {
      const stream = findPathwayById(opt.id)
      for (const d of (stream?.domainsUnlocked || [])) recommendedDomains.add(d)
    } else {
      recommendedDomains.add(opt.domain)
    }
  }

  // A domain is "already in mind" if the student's typed interest clearly names it.
  const alreadyInMind = new Set()
  for (const dom of DOMAINS) {
    const words = dom.name.toLowerCase().split(/[ ,&/]+/).filter((w) => w.length > 3)
    if (words.some((w) => interestText.includes(w)) || interestText.includes(dom.id)) {
      alreadyInMind.add(dom.id)
    }
  }

  const newFields = [...recommendedDomains]
    .filter((d) => !alreadyInMind.has(d))
    .map((d) => DOMAINS.find((x) => x.id === d)?.name)
    .filter(Boolean)

  return {
    total_fields_shown: recommendedDomains.size,
    already_considered: alreadyInMind.size,
    new_fields_count: newFields.length,
    new_fields: newFields.slice(0, 6),
    message: newFields.length > 0
      ? `You explored ${newFields.length} field${newFields.length > 1 ? 's' : ''} you may not have considered.`
      : 'We confirmed the fields that match your interests.',
  }
}
