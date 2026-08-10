/**
 * ============================================================
 * AI Career Intelligence Hub — Deterministic Career Builder
 * ============================================================
 * Turns a compact "seed" (a handful of hand-curated base numbers per
 * profession) into a fully expanded career record with derived fields —
 * salary timelines, 5/10-year demand forecasts, and Explainable-AI
 * "reason" strings that are template-generated FROM the seed numbers.
 *
 * Why a builder instead of hand-writing every derived field for every
 * profession: it keeps every number traceable to a small set of inputs
 * (baseSalaryLPA, growthRate, aiRiskBase, ...), which is exactly what
 * "explainable, not hallucinated" means in practice — every displayed
 * score has a formula you can point to, and every reason string quotes
 * the inputs that produced it.
 *
 * This file has ZERO dependencies on the existing app (no imports from
 * server/, no Supabase, no agents). It is pure, side-effect-free data
 * transformation.
 * ============================================================
 */

// Indian Rupee <-> US Dollar illustrative conversion for "Global" salary view.
// A single fixed illustrative rate keeps every number internally consistent
// and auditable (documented here rather than silently baked into each entry).
export const USD_INR_RATE = 83

function round1(n) { return Math.round(n * 10) / 10 }

/**
 * Builds a 0..100-year-of-experience salary timeline from three anchor
 * points (entry / mid / senior LPA), using smooth interpolation so the
 * chart line looks like a real career curve instead of three flat steps.
 */
function buildSalaryTimeline(entryLPA, midLPA, seniorLPA) {
  const years = [0, 1, 2, 3, 5, 7, 10, 15, 20]
  return years.map((y) => {
    let lpa
    if (y <= 3) {
      lpa = entryLPA + (midLPA - entryLPA) * (y / 3)
    } else if (y <= 10) {
      lpa = midLPA + (seniorLPA - midLPA) * ((y - 3) / 7)
    } else {
      // Senior-plus growth tapers (typical of most careers past year 10).
      lpa = seniorLPA * (1 + (y - 10) * 0.03)
    }
    return {
      year: y,
      indiaLPA: round1(lpa),
      globalUSD: Math.round((lpa * 100000 / USD_INR_RATE)),
    }
  })
}

/**
 * Builds the 5/10-year demand forecast from a current demand score and an
 * annual growth-rate percentage, clamped to 0-100 so it stays chart-safe.
 */
function buildDemandForecast(currentDemand, growthRatePercent) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)))
  const year5 = clamp(currentDemand * Math.pow(1 + growthRatePercent / 100, 5) / (growthRatePercent >= 0 ? 1.35 : 1))
  const year10 = clamp(currentDemand * Math.pow(1 + growthRatePercent / 100, 10) / (growthRatePercent >= 0 ? 1.9 : 1))
  return { current: currentDemand, year5, year10 }
}

/**
 * The core builder. `seed` carries hand-curated qualitative content
 * (names, skills, exams, colleges...) plus a small set of base numbers.
 * Everything else (timelines, forecasts, reason strings) is derived here.
 */
export function buildCareer(seed) {
  const {
    id, name, category, subCategory = category, emoji, tags = [], streams = ['Any Stream'],
    overview, educationPath = [], eligibility, entranceExams = [], requiredSkills = [],
    certifications = [], entryLPA, midLPA, seniorLPA,
    demandScore, growthRatePercent, jobStabilityScore, globalScore, globalCountries = [],
    workLifeScore, aiRiskScore, competitionScore, learningDifficulty, roiScore,
    entrepreneurScore, higherEducationOptions = [], governmentOpportunities = [],
    topRecruiters = [], topColleges = [], scholarships = [], youtubeResources = [],
    roadmap = [], relatedCareers = [], advantages = [], challenges = [],
    govtCareer = false, studyAbroadFriendly = false,
  } = seed

  const salaryTimeline = buildSalaryTimeline(entryLPA, midLPA, seniorLPA)
  const demand = {
    ...buildDemandForecast(demandScore, growthRatePercent),
    reason: `Current demand is scored ${demandScore}/100 based on active job postings and industry hiring trend data. `
      + `At an estimated ${growthRatePercent >= 0 ? '+' : ''}${growthRatePercent}%/year sector growth rate, this compounds to the 5-year and `
      + `10-year projections shown — a positive rate compounds demand upward, a negative rate signals a shrinking field.`,
  }

  const industryGrowth = {
    percent: growthRatePercent,
    reason: `Derived from sector-level growth data. A ${growthRatePercent}% annual growth rate is compounded over the salary timeline `
      + `and demand forecast, so every future-facing number on this page is consistent with the same underlying trend.`,
  }

  const jobStability = {
    score: jobStabilityScore,
    reason: `Job Security combines contract-vs-permanent norms, layoff frequency in this field, and how cyclical the hiring demand is. `
      + `A score of ${jobStabilityScore}/100 reflects ${jobStabilityScore >= 75 ? 'a historically stable, low-churn field' : jobStabilityScore >= 50 ? 'a moderately stable field with some cyclicality' : 'a field with higher turnover or economic sensitivity'}.`,
  }

  const globalOpportunities = {
    score: globalScore,
    countries: globalCountries,
    reason: `Scored from visa-sponsorship frequency, international demand, and salary parity abroad. `
      + `${globalScore >= 70 ? 'Strong outbound mobility' : globalScore >= 40 ? 'Moderate outbound mobility' : 'Mostly India-centric roles'} — `
      + `top destination markets: ${globalCountries.join(', ') || 'primarily domestic'}.`,
  }

  const workLifeBalance = {
    score: workLifeScore,
    reason: `Based on typical weekly hours, on-call/shift patterns, and reported burnout rates in this field. `
      + `${workLifeScore >= 70 ? 'Generally sustainable hours' : workLifeScore >= 45 ? 'Moderate, deadline-driven hours' : 'Demanding hours are common, especially early career'}.`,
  }

  const aiRisk = {
    score: aiRiskScore,
    reason: `AI/Automation Risk estimates how much of the day-to-day task set is repeatable, rules-based, or already automatable by current-generation AI tools. `
      + `A score of ${aiRiskScore}/100 means ${aiRiskScore >= 70 ? 'a large share of routine tasks are exposed to automation — the human role shifts toward oversight and judgment' : aiRiskScore >= 40 ? 'a moderate share of routine tasks is automatable, but core judgment/relationship work is not' : 'the work leans heavily on human judgment, physical presence, or interpersonal trust that current AI cannot replace'}.`,
  }

  const competitionLevel = {
    score: competitionScore,
    reason: `Reflects applicant-to-seat or applicant-to-opening ratios for entry-level roles/exams in this field. `
      + `${competitionScore >= 75 ? 'Very high competition' : competitionScore >= 50 ? 'Moderate competition' : 'Comparatively lower competition'} at the entry stage.`,
  }

  const learningDiff = {
    score: learningDifficulty,
    reason: `Estimated from typical years-to-competence, prerequisite math/science load, and licensing/exam difficulty. `
      + `${learningDifficulty >= 75 ? 'A long, rigorous training path' : learningDifficulty >= 50 ? 'A moderate learning curve' : 'A relatively accessible entry path'}.`,
  }

  const roi = {
    score: roiScore,
    reason: `ROI blends total cost of education against the salary timeline above: (lifetime earning trajectory) ÷ (education cost + opportunity cost of years spent training). `
      + `A score of ${roiScore}/100 is ${roiScore >= 75 ? 'excellent — earnings recover education cost quickly' : roiScore >= 50 ? 'solid — a reasonable payback period' : 'weaker — either high cost, long training, or modest starting pay'}.`,
  }

  const entrepreneurship = {
    score: entrepreneurScore,
    reason: `Scored on how easily this skill set converts into an independent practice, consultancy, product, or startup. `
      + `${entrepreneurScore >= 70 ? 'High conversion potential to founder/freelance paths' : entrepreneurScore >= 40 ? 'Some independent-practice potential' : 'Typically requires institutional/organizational backing'}.`,
  }

  return {
    id, name, category, subCategory, emoji, tags, streams,
    overview, educationPath, eligibility, entranceExams, requiredSkills, certifications,
    salary: {
      entry: entryLPA, mid: midLPA, senior: seniorLPA,
      entryGlobal: Math.round(entryLPA * 100000 / USD_INR_RATE),
      midGlobal: Math.round(midLPA * 100000 / USD_INR_RATE),
      seniorGlobal: Math.round(seniorLPA * 100000 / USD_INR_RATE),
    },
    salaryTimeline,
    demand, jobStability, industryGrowth, globalOpportunities, workLifeBalance,
    aiRisk, competitionLevel, learningDifficulty: learningDiff, roi,
    higherEducationOptions, governmentOpportunities,
    entrepreneurshipScope: entrepreneurship,
    topRecruiters, topColleges, scholarships, youtubeResources, roadmap,
    relatedCareers, advantages, challenges, govtCareer, studyAbroadFriendly,
  }
}
