import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CAREERS, CATEGORIES, RANKING_METRICS,
  searchCareers, filterCareers, rankCareers, getAiSuggestions,
} from '../../data/careerIntel'
import { PieChart } from '../../components/careerIntel'

// ─── Small building blocks ─────────────────────────────────────────────────

function CareerCard({ career, compact = false }) {
  return (
    <Link
      to={`/career-intel/${career.id}`}
      className="glass-card border-white/5 hover:border-saffron/30 p-4 sm:p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{career.emoji}</span>
          <div>
            <h3 className="font-display font-bold text-white text-sm group-hover:text-saffron transition-colors">{career.name}</h3>
            <p className="text-gray-500 text-[11px]">{career.category}</p>
          </div>
        </div>
        {career.govtCareer && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex-shrink-0">GOVT</span>}
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 rounded-lg py-1.5">
            <p className="text-white text-xs font-bold">₹{career.salary.senior}L</p>
            <p className="text-gray-500 text-[9px]">Senior Salary</p>
          </div>
          <div className="bg-white/5 rounded-lg py-1.5">
            <p className="text-emerald-400 text-xs font-bold">{career.demand.current}</p>
            <p className="text-gray-500 text-[9px]">Demand</p>
          </div>
          <div className="bg-white/5 rounded-lg py-1.5">
            <p className={`text-xs font-bold ${career.aiRisk.score >= 60 ? 'text-rose-400' : 'text-emerald-400'}`}>{career.aiRisk.score}</p>
            <p className="text-gray-500 text-[9px]">AI Risk</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {career.tags.slice(0, 3).map((t) => (
          <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">{t}</span>
        ))}
      </div>
    </Link>
  )
}

function RankedRow({ rank, career, metric }) {
  const valueDisplay = () => {
    switch (metric.id) {
      case 'salary': return `₹${career.salary.senior}L/yr`
      case 'growth': return `${career.industryGrowth.percent >= 0 ? '+' : ''}${career.industryGrowth.percent}%/yr`
      case 'govt': return career.govtCareer ? '✅ Govt Path' : '—'
      case 'studyAbroad': return career.studyAbroadFriendly ? '✅ Abroad-Friendly' : '—'
      case 'emerging': return (career.subCategory === 'Emerging Careers' || career.tags?.includes('Emerging')) ? '✅ Emerging' : '—'
      case 'aiRiskLow': return `${100 - career.aiRisk.score}/100 (Low Risk)`
      default: return `${career[metric.id]?.score ?? career.demand.current}/100`
    }
  }
  return (
    <Link to={`/career-intel/${career.id}`} className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-white/5 transition-colors border border-white/5">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs flex-shrink-0 ${
        rank <= 3 ? 'bg-saffron text-white' : 'bg-white/10 text-gray-400'
      }`}>{rank}</span>
      <span className="text-xl flex-shrink-0">{career.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{career.name}</p>
        <p className="text-gray-500 text-[10px]">{career.category}</p>
      </div>
      <span className="text-saffron font-bold text-xs flex-shrink-0">{valueDisplay()}</span>
    </Link>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CareerIntelligenceHub() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [category, setCategory] = useState('All')
  const [stream, setStream] = useState('All')
  const [govtOnly, setGovtOnly] = useState(false)
  const [studyAbroadOnly, setStudyAbroadOnly] = useState(false)
  const [maxAiRisk, setMaxAiRisk] = useState(100)
  const [minSalary, setMinSalary] = useState(0)
  const [rankingMetric, setRankingMetric] = useState('salary')
  const searchRef = useRef(null)

  const suggestions = useMemo(() => searchCareers(query, 6), [query])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = useMemo(() => filterCareers({
    category, stream, minSalary, maxAiRisk, govtOnly, studyAbroadOnly,
  }), [category, stream, minSalary, maxAiRisk, govtOnly, studyAbroadOnly])

  const ranked = useMemo(() => rankCareers(rankingMetric, 20), [rankingMetric])

  const categoryDistribution = useMemo(() => {
    const counts = {}
    CAREERS.forEach((c) => { counts[c.category] = (counts[c.category] || 0) + 1 })
    const colors = ['#FF6B00', '#6366F1', '#10B981', '#F43F5E', '#0EA5E9', '#F59E0B', '#8B5CF6', '#22C55E', '#EC4899', '#14B8A6']
    return Object.entries(counts).map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
  }, [])

  const activeSeed = filtered[0] || CAREERS[0]
  const aiSuggestions = useMemo(() => getAiSuggestions(activeSeed, 4), [activeSeed])

  const handleSubmitSearch = (e) => {
    e.preventDefault()
    const top = suggestions[0]
    if (top) navigate(`/career-intel/${top.id}`)
  }

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="fixed inset-0 bg-mesh-gradient pointer-events-none" />
      <div className="max-w-7xl mx-auto relative z-10">

        {/* ── Header ── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-5 py-2 mb-5">
            <span className="text-lg">🧭</span>
            <span className="text-saffron text-sm font-semibold">AI Career Intelligence Hub</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black text-white mb-3">Explore Every Career. Understand the Data.</h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
            Search {CAREERS.length}+ professions across Engineering, Medical, Commerce, Law, Design, Government, Defence, and more —
            every score comes with an explanation of <em>why</em>, not just a number.
          </p>
        </div>

        {/* ── Search + autocomplete ── */}
        <div className="max-w-2xl mx-auto mb-8 relative" ref={searchRef}>
          <form onSubmit={handleSubmitSearch}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search any career — e.g. 'software engineer', 'doctor', 'pilot'..."
                className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-2xl pl-11 pr-4 py-4 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20"
              />
            </div>
          </form>
          {showSuggestions && query.trim() && (
            <div className="absolute z-30 top-full mt-2 w-full bg-[#0D1117] border border-white/10 rounded-2xl overflow-hidden shadow-elevated animate-fade-in">
              {suggestions.length === 0 ? (
                <p className="p-4 text-gray-500 text-sm text-center">No matches. Try "engineer", "medical", "design"...</p>
              ) : suggestions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setShowSuggestions(false); navigate(`/career-intel/${c.id}`) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <span className="text-xl">{c.emoji}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{c.name}</p>
                    <p className="text-gray-500 text-[11px]">{c.category}</p>
                  </div>
                  <span className="text-saffron text-xs">→</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Category chips ── */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {['All', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                category === cat
                  ? 'bg-saffron text-white border-saffron shadow-lg shadow-saffron/20'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Filters row ── */}
        <div className="glass-card border-white/5 p-4 sm:p-5 mb-10 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Stream</label>
            <select value={stream} onChange={(e) => setStream(e.target.value)} className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-saffron/60">
              {['All', 'Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts / Humanities', 'Any Stream'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Min. Senior Salary (₹L/yr)</label>
            <input type="range" min="0" max="80" step="5" value={minSalary} onChange={(e) => setMinSalary(Number(e.target.value))} className="w-full accent-saffron" />
            <p className="text-saffron text-[11px] font-bold mt-0.5">₹{minSalary}L+</p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Max AI Risk</label>
            <input type="range" min="0" max="100" step="5" value={maxAiRisk} onChange={(e) => setMaxAiRisk(Number(e.target.value))} className="w-full accent-saffron" />
            <p className="text-saffron text-[11px] font-bold mt-0.5">{maxAiRisk}/100 or lower</p>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={govtOnly} onChange={(e) => setGovtOnly(e.target.checked)} className="accent-saffron w-4 h-4" />
              Government only
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={studyAbroadOnly} onChange={(e) => setStudyAbroadOnly(e.target.checked)} className="accent-saffron w-4 h-4" />
              Abroad-friendly
            </label>
          </div>
        </div>

        {/* ── AI Suggestions ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">✨ AI Suggestions <span className="text-gray-500 text-xs font-normal">based on {activeSeed.name}</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {aiSuggestions.map((c) => <CareerCard key={c.id} career={c} compact />)}
          </div>
        </div>

        {/* ── Filtered results grid ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-display text-lg font-bold text-white">Browse Careers ({filtered.length})</h2>
            <Link to="/career-intel/compare" className="text-saffron text-xs font-semibold hover:underline">⇄ Compare up to 3 careers →</Link>
          </div>
          {filtered.length === 0 ? (
            <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">No careers match these filters. Try widening your search.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => <CareerCard key={c.id} career={c} />)}
            </div>
          )}
        </div>

        {/* ── Global Rankings — Top careers by metric ── */}
        <div className="mb-12">
          <h2 className="font-display text-xl font-bold text-white mb-1">🏆 Global Rankings</h2>
          <p className="text-gray-500 text-xs mb-5">Top careers ranked by the metric of your choice — every ranking is a transparent sort over the same underlying dataset.</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {RANKING_METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setRankingMetric(m.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                  rankingMetric === m.id
                    ? 'bg-saffron text-white border-saffron'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {ranked.map((r, i) => (
              <RankedRow key={r.career.id} rank={i + 1} career={r.career} metric={RANKING_METRICS.find((m) => m.id === rankingMetric)} />
            ))}
          </div>
        </div>

        {/* ── Category distribution visual ── */}
        <div className="mb-8">
          <PieChart
            title="Catalogue Coverage by Category"
            explain="This chart counts how many careers in the current knowledge base belong to each category — it's a coverage map of the dataset itself, not a ranking of career quality."
            slices={categoryDistribution}
            size={220}
          />
        </div>
      </div>
    </main>
  )
}
