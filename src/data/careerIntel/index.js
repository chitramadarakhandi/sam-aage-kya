/**
 * ============================================================
 * AI Career Intelligence Hub — Data Layer Entry Point
 * ============================================================
 * Public API for the module's knowledge base. Nothing outside
 * src/pages/careerIntel and src/components/careerIntel should need to
 * import from schema.js/careerBuilder.js/seeds.js directly — import from
 * here instead, so the internal representation can evolve freely.
 * ============================================================
 */
import { CATEGORIES, RANKING_METRICS } from './schema'
import { buildCareer, USD_INR_RATE } from './careerBuilder'
import { CAREER_SEEDS } from './seeds'

export { CATEGORIES, RANKING_METRICS, USD_INR_RATE }

// Fully expanded, ready-to-render career records (built once at module load).
export const CAREERS = CAREER_SEEDS.map(buildCareer)

const BY_ID = new Map(CAREERS.map((c) => [c.id, c]))

export function getCareerById(id) {
  return BY_ID.get(id) || null
}

export function getRelatedCareers(career) {
  if (!career) return []
  return (career.relatedCareers || []).map((id) => BY_ID.get(id)).filter(Boolean)
}

/** Simple fuzzy-ish substring match across name/category/tags for autocomplete. */
export function searchCareers(query, limit = 8) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  const scored = CAREERS.map((c) => {
    const name = c.name.toLowerCase()
    let score = 0
    if (name === q) score = 100
    else if (name.startsWith(q)) score = 80
    else if (name.includes(q)) score = 60
    else if (c.category.toLowerCase().includes(q)) score = 40
    else if ((c.tags || []).some((t) => t.toLowerCase().includes(q))) score = 30
    else if ((c.requiredSkills || []).some((s) => s.toLowerCase().includes(q))) score = 20
    return { c, score }
  }).filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.c)
}

/**
 * AI Suggestions: a lightweight, explainable "you might also like" engine.
 * Not an LLM call — ranks the full catalogue by tag/category overlap with
 * a seed career, so the suggestion is always traceable to shared attributes.
 */
export function getAiSuggestions(seedCareer, limit = 4) {
  if (!seedCareer) return CAREERS.slice(0, limit)
  const seedTags = new Set([seedCareer.category, ...(seedCareer.tags || [])])
  const scored = CAREERS
    .filter((c) => c.id !== seedCareer.id)
    .map((c) => {
      const overlap = [c.category, ...(c.tags || [])].filter((t) => seedTags.has(t)).length
      const relatedBonus = seedCareer.relatedCareers?.includes(c.id) ? 5 : 0
      return { c, score: overlap + relatedBonus }
    })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.c)
}

export function filterCareers({ category, stream, minSalary, maxAiRisk, minDemand, govtOnly, studyAbroadOnly } = {}) {
  return CAREERS.filter((c) => {
    if (category && category !== 'All' && c.category !== category) return false
    if (stream && stream !== 'All' && !c.streams.includes(stream) && !c.streams.includes('Any Stream')) return false
    if (minSalary && c.salary.mid < minSalary) return false
    if (maxAiRisk != null && c.aiRisk.score > maxAiRisk) return false
    if (minDemand && c.demand.current < minDemand) return false
    if (govtOnly && !c.govtCareer) return false
    if (studyAbroadOnly && !c.studyAbroadFriendly) return false
    return true
  })
}

/** Ranks the full catalogue by one of RANKING_METRICS and returns top N. */
export function rankCareers(metricId, limit = 100) {
  const valueOf = (c) => {
    switch (metricId) {
      case 'salary': return c.salary.senior
      case 'demand': return c.demand.current
      case 'jobStability': return c.jobStability.score
      case 'aiRiskLow': return 100 - c.aiRisk.score
      case 'roi': return c.roi.score
      case 'growth': return c.industryGrowth.percent
      case 'govt': return c.govtCareer ? 1 : 0
      case 'studyAbroad': return c.studyAbroadFriendly ? 1 : 0
      case 'workLife': return c.workLifeBalance.score
      case 'entrepreneur': return c.entrepreneurshipScope.score
      case 'emerging': return c.subCategory === 'Emerging Careers' || c.tags?.includes('Emerging') ? 1 : 0
      case 'global': return c.globalOpportunities.score
      default: return 0
    }
  }
  return [...CAREERS]
    .map((c) => ({ career: c, value: valueOf(c) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}
