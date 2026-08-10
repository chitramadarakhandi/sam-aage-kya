/**
 * ============================================================
 * AI Career Intelligence Hub — Explainable AI (XAI) Engine
 * ============================================================
 * Every function here is a pure, deterministic calculation over the
 * career records (src/data/careerIntel) and the logged-in student's
 * Profile Builder data (the `students` table row already exposed via
 * useAuth().profile — see supabase_schema.sql for its fields: stream,
 * marks, interests, risk_comfort, income_range, class_level).
 *
 * "Explainable AI" here means: no score is an opaque LLM guess computed
 * at request time. Every score is a weighted formula over named inputs,
 * and every score is returned together with a human-readable `explain`
 * string built by SUBSTITUTING THE ACTUAL INPUT VALUES into a template —
 * so clicking a score always shows the real numbers that produced it.
 *
 * This module has no dependency on the multi-agent backend, RAG
 * pipeline, or Supabase client — it only reads plain JS objects that are
 * already loaded into the page (career record + profile object).
 * ============================================================
 */

// Stream -> career-category affinity map used for Interest/Academic fit.
// Kept as an explicit, inspectable table (not a black box) so the
// "why" behind a match score is always traceable to this table.
const STREAM_CATEGORY_AFFINITY = {
  'Science (PCM)': { Engineering: 1, Research: 0.9, Government: 0.5, Defence: 0.6, Aviation: 0.8, Design: 0.4 },
  'Science (PCB)': { Medical: 1, Research: 0.8, Agriculture: 0.7, Government: 0.4 },
  Commerce: { Commerce: 1, Business: 0.9, Entrepreneurship: 0.8, Law: 0.5, Government: 0.5 },
  'Arts / Humanities': { Arts: 1, Media: 0.8, Law: 0.7, Education: 0.8, Government: 0.6, Design: 0.5 },
  'Any Stream': { Government: 0.7, Business: 0.6, Entrepreneurship: 0.7, Media: 0.6, Vocational: 0.6, Hospitality: 0.6, Sports: 0.5, Law: 0.5, Education: 0.6 },
}

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)) }

/**
 * Interest Match: keyword-overlaps the student's free-text `interests`
 * field against the career's tags/skills/name. Every matched keyword is
 * listed in the explanation so the score is auditable, not a black box.
 */
export function computeInterestMatch(career, profile) {
  const interestsText = (profile?.interests || '').toLowerCase()
  if (!interestsText.trim()) {
    return { score: 50, explain: 'No interests were captured in your Profile Builder, so this uses a neutral baseline score of 50/100. Fill in "Interests" on your profile for a personalized match.' }
  }
  const words = interestsText.split(/[,.\s]+/).filter((w) => w.length > 2)
  const haystack = [career.name, career.category, career.subCategory, ...(career.tags || []), ...(career.requiredSkills || [])]
    .join(' ').toLowerCase()
  const matched = words.filter((w) => haystack.includes(w))
  const score = clamp(30 + matched.length * 18)
  const explain = matched.length > 0
    ? `Matched ${matched.length} keyword(s) from your stated interests ("${matched.join('", "')}") against this career's tags/skills/name — each match adds to the score, capped at 100.`
    : `None of the words in your stated interests ("${profile.interests}") appeared in this career's tags, skills, or name, so the score falls back to a low baseline of 30/100.`
  return { score, explain }
}

/**
 * Skill Match: compares the career's requiredSkills against a simple
 * proxy — stream-implied skill exposure — since Profile Builder does not
 * yet capture a structured skills list. Transparent about that limitation
 * in the explanation itself rather than pretending false precision.
 */
export function computeSkillMatch(career, profile) {
  const stream = profile?.stream || ''
  const affinity = STREAM_CATEGORY_AFFINITY[stream] || STREAM_CATEGORY_AFFINITY['Any Stream']
  const categoryAffinity = affinity[career.category] ?? 0.3
  const learningPenalty = career.learningDifficulty.score > 75 ? 10 : 0
  const score = clamp(Math.round(categoryAffinity * 85) - learningPenalty + 15)
  const explain = `Your stream (${stream || 'not set'}) has a ${Math.round(categoryAffinity * 100)}% typical skill-overlap with ${career.category} careers `
    + `based on standard curriculum alignment. `
    + (learningPenalty ? `This career's learning difficulty is high (${career.learningDifficulty.score}/100), so 10 points were subtracted to reflect the extra skill-building runway needed. ` : '')
    + `Set specific skills in your profile for a more precise match.`
  return { score, explain }
}

/**
 * Academic Fit: uses the student's marks + stream against the career's
 * typical entrance competitiveness (competitionLevel score is used as a
 * proxy for how marks-sensitive entry into this field usually is).
 */
export function computeAcademicFit(career, profile) {
  const marks = Number(profile?.marks) || 0
  const stream = profile?.stream || ''
  const streamOk = career.streams.includes(stream) || career.streams.includes('Any Stream')
  if (!marks) {
    return { score: 50, explain: 'No marks were captured in your Profile Builder, so this uses a neutral baseline of 50/100. Add your marks for a personalized academic-fit score.' }
  }
  const competitiveness = career.competitionLevel.score // higher = tougher entry
  // A high-marks student comfortably clears a high-competition field; a
  // low-marks student needs a low-competition field for a good fit score.
  const marksGap = marks - competitiveness // e.g. 92 marks vs 80 competitiveness = +12
  let score = clamp(60 + marksGap * 1.1)
  if (!streamOk) score = clamp(score - 25)
  const explain = `Your marks (${marks}%) vs. this career's typical entry competitiveness (${competitiveness}/100) gives a gap of ${marksGap >= 0 ? '+' : ''}${Math.round(marksGap)}, `
    + `which shifts the baseline score of 60 accordingly. `
    + (streamOk ? `Your stream (${stream}) is a recognized entry path for this career.` : `Your stream (${stream || 'not set'}) is NOT a typical entry path for this career, so 25 points were subtracted.`)
  return { score: Math.round(score), explain }
}

/**
 * Overall Career Fit Score — a weighted blend of the three sub-scores
 * above. Weights are fixed and disclosed in the explanation, so the
 * final number is fully reconstructible by the reader.
 */
export function computeCareerFitScore(career, profile) {
  const interest = computeInterestMatch(career, profile)
  const skill = computeSkillMatch(career, profile)
  const academic = computeAcademicFit(career, profile)
  const weights = { interest: 0.4, skill: 0.3, academic: 0.3 }
  const score = Math.round(interest.score * weights.interest + skill.score * weights.skill + academic.score * weights.academic)
  const explain = `Career Fit = (Interest Match × ${weights.interest}) + (Skill Match × ${weights.skill}) + (Academic Fit × ${weights.academic}) `
    + `= (${interest.score} × ${weights.interest}) + (${skill.score} × ${weights.skill}) + (${academic.score} × ${weights.academic}) = ${score}/100.`
  return { score: clamp(score), explain, breakdown: { interest, skill, academic } }
}

/** Strengths derived from whichever sub-scores are highest for this student+career pair. */
export function computeStrengths(career, profile, breakdown) {
  const strengths = []
  if (breakdown.interest.score >= 65) strengths.push(`Strong personal interest alignment with ${career.category}`)
  if (breakdown.academic.score >= 65) strengths.push(`Your academic record comfortably supports entry into this field`)
  if (breakdown.skill.score >= 65) strengths.push(`Your stream builds transferable skills for this career`)
  if (career.workLifeBalance.score >= 65) strengths.push('This career typically offers sustainable work-life balance')
  if (career.jobStability.score >= 75) strengths.push('High job security reduces long-term career risk')
  return strengths.length ? strengths : ['Complete your Profile Builder (interests, marks, stream) for personalized strengths.']
}

/** Skill gaps derived from the career's requiredSkills vs. weak sub-scores. */
export function computeSkillGaps(career, breakdown) {
  const gaps = []
  if (breakdown.skill.score < 55) {
    gaps.push(...career.requiredSkills.slice(0, 3).map((s) => `Build foundational exposure to: ${s}`))
  }
  if (breakdown.academic.score < 50) {
    gaps.push(`Entry competitiveness for this field is ${career.competitionLevel.score}/100 — consider strengthening academic performance or an alternate entry route.`)
  }
  if (career.learningDifficulty.score >= 75) {
    gaps.push(`This field has a steep learning curve (${career.learningDifficulty.score}/100) — plan for a longer skill-building runway.`)
  }
  return gaps.length ? gaps : ['No major skill gaps detected relative to your current profile — you appear well-positioned to begin exploring this path.']
}

/** A short, ordered learning path grounded in the career's own roadmap + skill gaps. */
export function computeLearningPath(career, breakdown) {
  const steps = []
  if (breakdown.academic.score < 50) steps.push('Strengthen core academics / consider foundation courses for entrance exams')
  steps.push(...(career.roadmap || []).slice(0, 2).map((r) => `${r.phase}: ${r.detail}`))
  if (career.certifications?.length) steps.push(`Consider an early certification: ${career.certifications[0]}`)
  return steps
}

/**
 * ─────────────────────────── Parent Insights ───────────────────────────
 * A separate lens over the SAME underlying career data, but reframed
 * around the questions parents typically care about: security, cost,
 * ROI, and long-term risk — rather than personal interest fit.
 */
export function computeParentInsights(career, profile) {
  const incomeRange = profile?.income_range || ''
  // Very rough, transparent cost-sensitivity heuristic: lower stated
  // income band + a long/expensive training path raises "financial risk".
  const costSignal = career.learningDifficulty.score >= 75 || career.id === 'pilot-commercial' ? 70
    : career.learningDifficulty.score >= 55 ? 45 : 25
  const incomeAdjustment = /below|2\.5l|low/i.test(incomeRange) ? 15 : 0
  const financialRisk = clamp(costSignal + incomeAdjustment)

  return {
    jobSecurity: {
      score: career.jobStability.score,
      explain: career.jobStability.reason,
    },
    salaryPotential: {
      score: clamp(Math.round((career.salary.senior / 1) )), // raw LPA also shown separately in UI
      raw: career.salary,
      explain: `Entry ₹${career.salary.entry}L → Mid ₹${career.salary.mid}L → Senior ₹${career.salary.senior}L per annum, based on the salary timeline model for this field.`,
    },
    futureStability: {
      score: clamp(Math.round((career.demand.year10 + career.jobStability.score) / 2)),
      explain: `Blends the 10-year demand forecast (${career.demand.year10}/100) with job stability (${career.jobStability.score}/100) to estimate how durable this career is likely to be over a child's working lifetime.`,
    },
    roi: {
      score: career.roi.score,
      explain: career.roi.reason,
    },
    financialRisk: {
      score: financialRisk,
      explain: `Based on training cost/duration signal (${costSignal}/100) `
        + (incomeAdjustment ? `plus a +${incomeAdjustment} adjustment because your stated household income band ("${incomeRange}") may make upfront education costs feel riskier. ` : 'with no income-based adjustment since no lower-income band was indicated. ')
        + `Higher = more financial risk to plan for (scholarships/loans may be relevant — see the Scholarships section).`,
    },
    costOfEducation: {
      explain: career.id === 'pilot-commercial'
        ? 'Very high upfront cost (₹25-40 lakh for flight training) — among the most expensive career entry paths in this dataset.'
        : career.learningDifficulty.score >= 75
        ? 'Above-average cost due to a long training/education pipeline (postgraduate study, licensing, or multi-year specialization).'
        : 'Moderate — typically a standard undergraduate degree is sufficient to begin this career.',
    },
    placementPotential: {
      score: career.demand.current,
      explain: `Current market demand score of ${career.demand.current}/100, based on active hiring signal across ${career.topRecruiters.slice(0, 3).join(', ')} and similar employers.`,
    },
    longTermGrowth: {
      score: career.industryGrowth.percent,
      explain: career.industryGrowth.reason,
    },
  }
}

/** Convenience bundle used by the report page for the Student Insights section. */
export function computeStudentInsights(career, profile) {
  const fit = computeCareerFitScore(career, profile)
  return {
    fit,
    strengths: computeStrengths(career, profile, fit.breakdown),
    skillGaps: computeSkillGaps(career, fit.breakdown),
    learningPath: computeLearningPath(career, fit.breakdown),
  }
}
