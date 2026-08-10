import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CAREERS, getCareerById, searchCareers } from '../../data/careerIntel'
import { LineChart, BarChart, RadarChart } from '../../components/careerIntel'

const SLOT_COLORS = ['#FF6B00', '#6366F1', '#10B981']

function CareerPicker({ slotIndex, career, onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const suggestions = useMemo(() => searchCareers(query, 6), [query])

  if (career) {
    return (
      <div className="glass-card border-white/5 p-4 flex items-center gap-3" style={{ borderColor: `${SLOT_COLORS[slotIndex]}40` }}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SLOT_COLORS[slotIndex] }} />
        <span className="text-2xl flex-shrink-0">{career.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{career.name}</p>
          <p className="text-gray-500 text-[10px]">{career.category}</p>
        </div>
        <button onClick={onClear} className="text-gray-500 hover:text-rose-400 text-lg flex-shrink-0" aria-label="Remove">&times;</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={`Add career #${slotIndex + 1} to compare...`}
        className="w-full bg-white/[0.05] border border-dashed border-white/15 hover:border-white/30 focus:border-saffron/60 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 text-sm transition-all outline-none"
      />
      {open && query.trim() && (
        <div className="absolute z-30 top-full mt-1 w-full bg-[#0D1117] border border-white/10 rounded-xl overflow-hidden shadow-elevated">
          {suggestions.length === 0 ? (
            <p className="p-3 text-gray-500 text-xs text-center">No matches.</p>
          ) : suggestions.map((c) => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-white/5 text-left border-b border-white/5 last:border-0"
            >
              <span className="text-lg">{c.emoji}</span>
              <div><p className="text-white text-xs font-semibold">{c.name}</p><p className="text-gray-500 text-[10px]">{c.category}</p></div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CompareRow({ label, values, formatter = (v) => v }) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 px-3 text-gray-400 text-xs font-semibold sticky left-0 bg-[#0A0F1E]">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-3 px-3 text-center">
          <span className="text-white text-sm font-bold">{v == null ? '—' : formatter(v)}</span>
        </td>
      ))}
    </tr>
  )
}

export default function CareerCompare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialIds = (searchParams.get('ids') || '').split(',').filter(Boolean)
  const [slotIds, setSlotIds] = useState([initialIds[0] || null, initialIds[1] || null, initialIds[2] || null])

  const careers = slotIds.map((id) => (id ? getCareerById(id) : null))
  const activeCareers = careers.filter(Boolean)

  const updateSlot = (idx, id) => {
    const next = [...slotIds]
    next[idx] = id
    setSlotIds(next)
    setSearchParams({ ids: next.filter(Boolean).join(',') })
  }

  const radarAxes = [
    { key: 'salary', label: 'Salary' }, { key: 'demand', label: 'Demand' },
    { key: 'stability', label: 'Stability' }, { key: 'lowAiRisk', label: 'Low AI Risk' },
    { key: 'roi', label: 'ROI' }, { key: 'workLife', label: 'Work-Life' }, { key: 'global', label: 'Global' },
  ]
  const radarSeries = activeCareers.map((c, i) => ({
    name: c.name, color: SLOT_COLORS[i],
    values: {
      salary: Math.min(100, c.salary.senior * 1.2), demand: c.demand.current,
      stability: c.jobStability.score, lowAiRisk: 100 - c.aiRisk.score,
      roi: c.roi.score, workLife: c.workLifeBalance.score, global: c.globalOpportunities.score,
    },
  }))

  const salarySeries = activeCareers.map((c, i) => ({
    name: c.name, color: SLOT_COLORS[i],
    points: c.salaryTimeline.map((p) => ({ x: p.year, y: p.indiaLPA })),
  }))

  const salaryBars = activeCareers.map((c, i) => ({ label: c.name, value: c.salary.senior, color: SLOT_COLORS[i] }))
  const demandBars = activeCareers.map((c, i) => ({ label: c.name, value: c.demand.current, color: SLOT_COLORS[i] }))

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <Link to="/career-intel" className="text-gray-400 hover:text-white text-xs">← Back to Hub</Link>
          <h1 className="font-display text-2xl sm:text-4xl font-black text-white mt-3">⇄ Compare Careers</h1>
          <p className="text-gray-400 text-sm mt-2">Pick up to 3 professions — every chart below updates together in real time.</p>
        </div>

        {/* Slot pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[0, 1, 2].map((i) => (
            <CareerPicker
              key={i}
              slotIndex={i}
              career={careers[i]}
              onSelect={(id) => updateSlot(i, id)}
              onClear={() => updateSlot(i, null)}
            />
          ))}
        </div>

        {activeCareers.length < 2 ? (
          <div className="glass-card border-white/5 p-16 text-center text-gray-400 text-sm">
            Add at least 2 careers above to see a side-by-side comparison.
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {CAREERS.slice(0, 6).map((c) => (
                <button key={c.id} onClick={() => updateSlot(activeCareers.length, c.id)} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-saffron/40 text-gray-300">
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Synchronized chart grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BarChart title="Senior-Level Salary (₹L/yr)" explain="Compares each career's senior-level (10+ years) salary anchor point from its salary timeline model." bars={salaryBars} valueFormatter={(v) => `₹${v}L`} />
              <BarChart title="Current Demand Score" explain="Compares each career's current market demand score (0-100), based on active hiring signal." bars={demandBars} />
            </div>

            <LineChart
              title="Salary Progression — Synchronized Timeline"
              explain="All selected careers plotted on the same year-of-experience axis, so growth trajectories can be compared directly."
              series={salarySeries}
              xLabel="Year"
              valueFormatter={(v) => `₹${v}L`}
            />

            <RadarChart
              title="Multi-Axis Career Profile Comparison"
              explain="Every axis is normalized to 0-100 with 'higher is always better' (Low AI Risk is inverted from raw AI Risk). Overlapping shapes make trade-offs visually obvious at a glance."
              axes={radarAxes}
              series={radarSeries}
              size={340}
            />

            {/* Detailed comparison table */}
            <div className="glass-card border-white/5 overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-3 px-3 text-left text-gray-500 text-xs sticky left-0 bg-[#0A0F1E]">Metric</th>
                      {activeCareers.map((c, i) => (
                        <th key={c.id} className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1.5 text-white text-xs font-bold">
                            <span className="w-2 h-2 rounded-full" style={{ background: SLOT_COLORS[i] }} /> {c.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label="Entry Salary" values={activeCareers.map((c) => c.salary.entry)} formatter={(v) => `₹${v}L`} />
                    <CompareRow label="Senior Salary" values={activeCareers.map((c) => c.salary.senior)} formatter={(v) => `₹${v}L`} />
                    <CompareRow label="Demand Score" values={activeCareers.map((c) => c.demand.current)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Job Stability" values={activeCareers.map((c) => c.jobStability.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="AI Risk" values={activeCareers.map((c) => c.aiRisk.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="ROI" values={activeCareers.map((c) => c.roi.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Work-Life Balance" values={activeCareers.map((c) => c.workLifeBalance.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Global Opportunities" values={activeCareers.map((c) => c.globalOpportunities.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Competition Level" values={activeCareers.map((c) => c.competitionLevel.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Learning Difficulty" values={activeCareers.map((c) => c.learningDifficulty.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Entrepreneurship Scope" values={activeCareers.map((c) => c.entrepreneurshipScope.score)} formatter={(v) => `${v}/100`} />
                    <CompareRow label="Government Career?" values={activeCareers.map((c) => (c.govtCareer ? '✅' : '—'))} />
                    <CompareRow label="Study Abroad Friendly?" values={activeCareers.map((c) => (c.studyAbroadFriendly ? '✅' : '—'))} />
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              {activeCareers.map((c) => (
                <Link key={c.id} to={`/career-intel/${c.id}`} className="text-saffron text-xs font-semibold hover:underline">
                  View full {c.name} report →
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
