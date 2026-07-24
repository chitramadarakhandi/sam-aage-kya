import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPathwayStartQuestions,
  postPathwayNextQuestions,
  postPathwayRecommend,
} from '../api'
import { STATE_NAMES, citiesForState } from '../data/indiaLocations'

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function AnswerButton({ label, emoji, active, onClick, tone }) {
  const toneMap = {
    yes: active ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10',
    no: active ? 'bg-rose-500 border-rose-400 text-white' : 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10',
    skip: active ? 'bg-gray-500 border-gray-400 text-white' : 'border-white/15 text-gray-400 hover:bg-white/5',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${toneMap[tone]}`}
    >
      <span>{emoji}</span> {label}
    </button>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
      <div className="h-full bg-saffron transition-all duration-500" style={{ width: `${value}%` }} />
    </div>
  )
}

const FIT_COLORS = {
  'Strong Fit': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  'Good Fit': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
  'Stretch Option': 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'Safe Option': 'bg-sky-500/10 border-sky-500/30 text-sky-300',
}
const DIFFICULTY_LABEL = { low: 'Beginner-friendly', moderate: 'Moderate', high: 'Challenging', very_high: 'Very demanding' }

// ─── Result card ────────────────────────────────────────────────────────────

function OptionCard({ opt, index, compareOn, isCompared, onToggleCompare }) {
  const [open, setOpen] = useState(index === 0)
  const isStream = opt.type === 'stream'
  return (
    <div className={`glass-card rounded-2xl overflow-hidden animate-slide-up ${isCompared ? 'border-saffron/50 ring-1 ring-saffron/30' : 'border-white/10'}`} style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-start">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 text-left p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02]">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${FIT_COLORS[opt.fit_label] || FIT_COLORS['Good Fit']}`}>
                {opt.fit_label}
              </span>
              <span className="text-[10px] text-gray-500 border border-white/10 rounded-md px-2 py-0.5">
                {DIFFICULTY_LABEL[opt.difficulty] || opt.difficulty}
              </span>
              {!isStream && opt.demand === 'very_high' && (
                <span className="text-[10px] text-emerald-400 border border-emerald-500/20 rounded-md px-2 py-0.5">🔥 High demand</span>
              )}
              {opt.verified && (
                <span className="text-[10px] text-sky-300 border border-sky-500/25 bg-sky-500/10 rounded-md px-2 py-0.5" title="Fact-checked against our curated dataset">✓ Verified</span>
              )}
              {opt.confidence && (
                <span className="text-[10px] border border-white/15 rounded-md px-2 py-0.5 text-gray-300" title={`Confidence: ${opt.confidence.score}%`}>
                  {opt.confidence.emoji} {opt.confidence.score}% {opt.confidence.label}
                </span>
              )}
              {opt.faithfulness?.checked && (
                <span className={`text-[10px] rounded-md px-2 py-0.5 border ${opt.faithfulness.faithful ? 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' : 'text-amber-300 border-amber-500/25 bg-amber-500/10'}`}
                  title={opt.faithfulness.faithful ? 'Passed independent AI fact-check' : opt.faithfulness.issue}>
                  {opt.faithfulness.faithful ? '⚖️ Fact-checked' : '⚖️ Revised'}
                </span>
              )}
            </div>
            <h3 className="text-white font-display font-bold text-base leading-snug">{opt.name}</h3>
            <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">{opt.why_this_fits}</p>
          </div>
          <span className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {compareOn && (
          <button
            onClick={() => onToggleCompare(opt.id)}
            title="Add to compare"
            className={`m-3 flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-all ${isCompared ? 'bg-saffron border-saffron text-white' : 'border-white/15 text-gray-500 hover:border-saffron/40'}`}
          >
            {isCompared ? '✓' : '+'}
          </button>
        )}
      </div>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 border-t border-white/5">
          <p className="text-gray-300 text-sm leading-relaxed">{opt.description}</p>

          <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3">
            <span className="text-amber-400 text-sm">💡</span>
            <p className="text-amber-200/90 text-xs leading-relaxed">{opt.honest_note}</p>
          </div>

          {isStream ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <InfoBlock title="✅ Good if" items={opt.good_if} />
              <InfoBlock title="⚠️ Think twice if" items={opt.avoid_if} />
              <InfoBlock title="🎯 Leads to" items={opt.leads_to} />
              <InfoBlock title="🔄 Can switch to" items={opt.switch_to} />
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <InfoBlock title="🎓 Entrance exams" items={opt.entrance_exams} />
                <InfoBlock title="💼 Careers" items={opt.careers} />
                <KeyVal label="Duration" value={`${opt.duration_years} years`} />
                <KeyVal label="Approx. yearly fee" value={opt.approx_annual_fee} />
              </div>
              {opt.affordability && <AffordabilityBlock a={opt.affordability} />}
              {opt.confidence && <ConfidenceBlock c={opt.confidence} />}
              {opt.colleges && opt.colleges.length > 0 && (
                <CollegeList colleges={opt.colleges} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CollegeList({ colleges }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">🏛️ Colleges to consider {colleges.some((c) => c.nearby) && <span className="text-emerald-400 normal-case">· nearest first</span>}</p>
      <ul className="space-y-2">
        {colleges.map((col, i) => (
          <li key={i} className="flex items-start justify-between gap-3 bg-white/[0.02] rounded-lg px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {col.source_url ? (
                  <a href={col.source_url} target="_blank" rel="noreferrer" className="text-white text-xs font-semibold hover:text-saffron">{col.name}</a>
                ) : (
                  <span className="text-white text-xs font-semibold">{col.name}</span>
                )}
                {col.nearby && <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded">📍 Near you</span>}
              </div>
              <p className="text-gray-500 text-[10px] mt-0.5">{col.city}, {col.state} · {col.type}{col.national ? ' · all-India' : ''}</p>
            </div>
            <span className="text-gray-400 text-[10px] whitespace-nowrap">{col.approx_fee}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const AFFORD_COLORS = {
  'Very affordable': 'text-emerald-400',
  'Affordable': 'text-emerald-400',
  'Moderate cost': 'text-amber-400',
  'High investment': 'text-rose-400',
}

function AffordabilityBlock({ a }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">💰 Honest cost & earning check</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500 block text-[10px]">Total course cost</span>
          <span className="text-white">{a.total_cost_range}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Typical starting salary</span>
          <span className="text-white">{a.starting_salary_range}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Affordability</span>
          <span className={`font-semibold ${AFFORD_COLORS[a.affordability] || 'text-gray-300'}`}>{a.affordability}</span>
        </div>
        {a.payback_years != null && (
          <div>
            <span className="text-gray-500 block text-[10px]">Rough payback</span>
            <span className="text-white">~{a.payback_years} yr of starting salary</span>
          </div>
        )}
      </div>
      <p className="text-gray-500 text-[10px] mt-2 italic">{a.salary_note}</p>
    </div>
  )
}

function ConfidenceBar({ label, value }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>{label}</span><span className="text-gray-300">{value}%</span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function ConfidenceBlock({ c }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">🎯 How confident are we?</p>
        <span className="text-xs font-bold text-white">{c.emoji} {c.score}% · {c.label}</span>
      </div>
      <div className="space-y-2">
        <ConfidenceBar label="Fits your marks / stream" value={c.breakdown.profile_match} />
        <ConfidenceBar label="Matches your interests" value={c.breakdown.interest_match} />
        <ConfidenceBar label="Backed by verified data" value={c.breakdown.data_grounding} />
      </div>
    </div>
  )
}

function InfoBlock({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-gray-300 text-xs leading-relaxed">• {it}</li>
        ))}
      </ul>
    </div>
  )
}

function KeyVal({ label, value }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">{label}</p>
      <p className="text-white text-sm font-semibold">{value}</p>
    </div>
  )
}

// ─── Compare modal (side-by-side) ─────────────────────────────────────────────

function CompareModal({ options, onClose }) {
  const isStream = options[0]?.type === 'stream'
  const rows = isStream
    ? [
        { label: 'Fit', get: (o) => o.fit_label },
        { label: 'Difficulty', get: (o) => DIFFICULTY_LABEL[o.difficulty] || o.difficulty },
        { label: 'Subjects', get: (o) => (o.subjects || []).join(', ') },
        { label: 'Good if', get: (o) => (o.good_if || []).join(' · ') },
        { label: 'Leads to', get: (o) => (o.leads_to || []).join(', ') },
        { label: 'Can switch to', get: (o) => (o.switch_to || []).join(', ') },
      ]
    : [
        { label: 'Fit', get: (o) => o.fit_label },
        { label: 'Difficulty', get: (o) => DIFFICULTY_LABEL[o.difficulty] || o.difficulty },
        { label: 'Demand', get: (o) => o.demand },
        { label: 'Duration', get: (o) => `${o.duration_years} yrs` },
        { label: 'Yearly fee', get: (o) => o.approx_annual_fee },
        { label: 'Entrance exams', get: (o) => (o.entrance_exams || []).join(', ') },
        { label: 'Careers', get: (o) => (o.careers || []).join(', ') },
        { label: 'Top colleges', get: (o) => (o.colleges || []).slice(0, 3).map((c) => c.name).join(', ') || '—' },
      ]

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-navy/95 backdrop-blur flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-display font-bold text-white text-base">⚖️ Side-by-side comparison</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center">✕</button>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="text-[10px] uppercase text-gray-500 font-bold p-2 w-28"></th>
                {options.map((o) => (
                  <th key={o.id} className="text-white text-sm font-bold p-2 align-bottom min-w-[140px]">{o.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-white/5">
                  <td className="text-[10px] uppercase text-gray-500 font-bold p-2 align-top">{row.label}</td>
                  {options.map((o) => (
                    <td key={o.id} className="text-gray-300 text-xs p-2 align-top leading-relaxed">{row.get(o) || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Explore() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('setup')       // setup | broad | focused | loading | results
  const [classLevel, setClassLevel] = useState('class12')
  const [marks, setMarks] = useState('')
  const [stream, setStream] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [incomeRange, setIncomeRange] = useState('')

  const [broadQuestions, setBroadQuestions] = useState([])
  const [focusedQuestions, setFocusedQuestions] = useState([])
  const [questions, setQuestions] = useState([])     // active question set
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState([])         // [{questionId, answer}]
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [compareOn, setCompareOn] = useState(false)
  const [compareIds, setCompareIds] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [judging, setJudging] = useState(false)

  // Load broad questions once
  useEffect(() => {
    getPathwayStartQuestions()
      .then((r) => r.json())
      .then((d) => setBroadQuestions(d.questions || []))
      .catch(() => setError('Could not load questions. Is the server running?'))
  }, [])

  const answerCurrent = (answer) => {
    const q = questions[idx]
    if (!q) return
    const next = [...answers.filter((a) => a.questionId !== q.id), { questionId: q.id, answer }]
    setAnswers(next)

    if (idx + 1 < questions.length) {
      setIdx(idx + 1)
    } else if (phase === 'broad') {
      // Fetch adaptive follow-ups based on broad answers
      loadFollowUps(next)
    } else {
      // Focused done → get recommendations
      runRecommend(next)
    }
  }

  const loadFollowUps = async (allAnswers) => {
    setPhase('loading')
    try {
      const res = await postPathwayNextQuestions(allAnswers)
      const data = await res.json()
      if (data.questions && data.questions.length > 0) {
        setFocusedQuestions(data.questions)
        setQuestions(data.questions)
        setIdx(0)
        setPhase('focused')
      } else {
        runRecommend(allAnswers)
      }
    } catch {
      runRecommend(allAnswers)
    }
  }

  const [lastAnswers, setLastAnswers] = useState([])

  const runRecommend = useCallback(async (allAnswers, useJudge = false) => {
    setPhase('loading')
    setError('')
    setLastAnswers(allAnswers)
    try {
      const formData = { classLevel, marks, stream, state, city, incomeRange }
      const res = await postPathwayRecommend(formData, allAnswers, useJudge)
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setResult(data)
      setPhase('results')
    } catch {
      setError('Could not generate recommendations. Please try again.')
      setPhase(focusedQuestions.length ? 'focused' : 'broad')
    }
  }, [classLevel, marks, stream, state, city, incomeRange, focusedQuestions.length])

  // Re-run the SAME recommendation but with the decoupled LLM fact-check on.
  const runFactCheck = async () => {
    if (!lastAnswers.length) return
    setJudging(true)
    try {
      const formData = { classLevel, marks, stream, state, city, incomeRange }
      const res = await postPathwayRecommend(formData, lastAnswers, true)
      if (res.ok) setResult(await res.json())
    } catch { /* keep existing result */ }
    finally { setJudging(false) }
  }

  const startQuestions = () => {
    setQuestions(broadQuestions)
    setIdx(0)
    setAnswers([])
    setPhase('broad')
  }

  const restart = () => {
    setResult(null); setAnswers([]); setIdx(0); setFocusedQuestions([])
    setCompareOn(false); setCompareIds([]); setShowCompare(false)
    setPhase('setup')
  }

  const toggleCompare = (id) => {
    setCompareIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= 3 ? prev : [...prev, id]))
  }

  const goBack = () => {
    if (idx > 0) setIdx(idx - 1)
  }

  // ── Render ──
  const totalForProgress = broadQuestions.length + (focusedQuestions.length || 3)
  const answeredCount = answers.length
  const progress = Math.min(100, Math.round((answeredCount / totalForProgress) * 100))

  return (
    <main className="pt-24 pb-24 min-h-screen px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">Discover Your Path · All of India · Every Field</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Not sure what to study? <span className="gradient-text">Let&apos;s find out.</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            Answer a few quick yes/no questions. We&apos;ll match you to real courses and streams — even ones you didn&apos;t know existed.
          </p>
        </div>

        {error && (
          <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center mb-4">⚠️ {error}</p>
        )}

        {/* ── SETUP ── */}
        {phase === 'setup' && (
          <div className="glass-card border-white/10 rounded-2xl p-6 space-y-5 animate-slide-up">
            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-2">I am in</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'class10', label: 'Class 10', sub: 'Choosing a stream' },
                  { id: 'class12', label: 'Class 12', sub: 'Choosing a course' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setClassLevel(c.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${classLevel === c.id ? 'bg-saffron/15 border-saffron ring-2 ring-saffron/20' : 'border-white/10 hover:border-white/25'}`}
                  >
                    <div className="text-white font-bold text-sm">{c.label}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{c.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-1.5">
                {classLevel === 'class10' ? 'Class 9/10 marks %' : 'Class 12 marks %'} <span className="text-gray-600">(optional)</span>
              </label>
              <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="e.g. 75"
                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-saffron" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-1.5">State <span className="text-gray-600">(for nearby colleges)</span></label>
                <select value={state} onChange={(e) => { setState(e.target.value); setCity('') }}
                  className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-saffron">
                  <option value="">Select state</option>
                  {STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-1.5">City <span className="text-gray-600">(nearest hub)</span></label>
                <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!state}
                  className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-saffron disabled:opacity-40">
                  <option value="">{state ? 'Select city' : 'Pick a state first'}</option>
                  {citiesForState(state).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {classLevel === 'class12' && (
              <div>
                <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-1.5">Your Class 12 stream <span className="text-gray-600">(optional)</span></label>
                <select value={stream} onChange={(e) => setStream(e.target.value)}
                  className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-saffron">
                  <option value="">Prefer not to say / not sure</option>
                  <option>Science (PCM)</option>
                  <option>Science (PCB)</option>
                  <option>Science (PCMB)</option>
                  <option>Commerce with Maths</option>
                  <option>Commerce</option>
                  <option>Arts / Humanities</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs uppercase font-bold tracking-wider text-gray-400 mb-1.5">Family income <span className="text-gray-600">(optional — helps suggest affordable options)</span></label>
              <select value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)}
                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-saffron">
                <option value="">Prefer not to say</option>
                <option value="below_2.5L">Below ₹2.5 Lakh/yr</option>
                <option value="2.5L-5L">₹2.5L – ₹5L/yr</option>
                <option value="5L-10L">₹5L – ₹10L/yr</option>
                <option value="above_10L">Above ₹10L/yr</option>
              </select>
            </div>

            <button onClick={startQuestions} disabled={broadQuestions.length === 0}
              className="w-full btn-primary py-3.5 text-sm disabled:opacity-50">
              Start · {broadQuestions.length} quick questions →
            </button>
          </div>
        )}

        {/* ── QUESTION (broad or focused) ── */}
        {(phase === 'broad' || phase === 'focused') && questions[idx] && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <ProgressBar value={progress} />
              <span className="text-xs text-gray-500 whitespace-nowrap">{answeredCount} / ~{totalForProgress}</span>
            </div>

            {phase === 'focused' && (
              <p className="text-center text-indigo-300 text-xs font-semibold">🎯 Zooming in on what you like…</p>
            )}

            <div className="glass-card border-white/10 rounded-2xl p-8 min-h-[180px] flex flex-col justify-center">
              <p className="text-white font-display font-semibold text-xl text-center leading-relaxed">
                {questions[idx].text}
              </p>
            </div>

            <div className="flex gap-3">
              <AnswerButton label="Yes" emoji="👍" tone="yes" onClick={() => answerCurrent('yes')} />
              <AnswerButton label="Not sure" emoji="🤔" tone="skip" onClick={() => answerCurrent('skip')} />
              <AnswerButton label="No" emoji="👎" tone="no" onClick={() => answerCurrent('no')} />
            </div>

            {idx > 0 && (
              <button onClick={goBack} className="text-gray-500 hover:text-white text-xs mx-auto block">← Back</button>
            )}
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-5 py-20">
            <div className="w-12 h-12 border-3 border-saffron border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Matching you to real pathways across India…</p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && result && (
          <div className="space-y-5 animate-fade-in">
            {/* AI busy banner — the course facts are still 100% real (from our
                dataset); only the written explanations use AI. */}
            {result.ai_status && result.ai_status.available === false && (
              <div className="flex items-start gap-3 rounded-2xl px-5 py-4 bg-amber-500/10 border border-amber-500/30">
                <span className="text-xl flex-shrink-0">⚡</span>
                <div>
                  <p className="text-amber-300 text-sm font-semibold">AI explanations are limited right now — the course data below is still fully accurate.</p>
                  <p className="text-amber-200/70 text-xs mt-0.5">
                    Every course, exam and college shown comes from our verified dataset. Only the friendly write-ups use AI, which is briefly rate-limited.
                  </p>
                </div>
              </div>
            )}

            {/* Discovery highlight — the app's core value */}
            {result.discovery && result.discovery.new_fields_count > 0 && (
              <div className="rounded-2xl p-5 text-center animate-slide-up"
                style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.15), rgba(15,23,42,0.6))', border: '1px solid rgba(255,107,0,0.3)' }}>
                <div className="text-3xl mb-2">🧭</div>
                <p className="text-white font-display font-bold text-lg">{result.discovery.message}</p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {result.discovery.new_fields.map((f) => (
                    <span key={f} className="text-xs bg-white/10 border border-white/15 text-white px-3 py-1 rounded-full">✨ {f}</span>
                  ))}
                </div>
                <p className="text-gray-400 text-xs mt-3">Most students arrive knowing 2-3 options. You just widened that.</p>
              </div>
            )}

            {result.rankedDomains?.length > 0 && (
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-2">Your interests point towards</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {result.rankedDomains.slice(0, 4).map((d) => (
                    <span key={d.id} className="text-xs bg-saffron/10 border border-saffron/25 text-saffron px-3 py-1 rounded-full font-semibold">{d.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Overall confidence + independent fact-check control */}
            {result.overall_confidence && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{result.overall_confidence.emoji}</span>
                  <div>
                    <p className="text-white text-sm font-bold">{result.overall_confidence.score}% · {result.overall_confidence.label} confidence</p>
                    <p className="text-gray-500 text-[10px]">Based on your marks, interests & our verified data</p>
                  </div>
                </div>
                {result.judge?.enabled ? (
                  <span className="text-[11px] text-emerald-300 border border-emerald-500/25 bg-emerald-500/10 rounded-lg px-3 py-1.5" title={`Judge model: ${result.judge.model}`}>
                    ⚖️ Fact-checked by a 2nd AI · {result.judge.flagged || 0} flagged
                  </span>
                ) : (
                  <button onClick={runFactCheck} disabled={judging}
                    className="text-[11px] font-semibold text-sky-300 border border-sky-500/25 hover:bg-sky-500/10 rounded-lg px-3 py-1.5 disabled:opacity-50">
                    {judging ? 'Checking…' : '⚖️ Run independent fact-check'}
                  </button>
                )}
              </div>
            )}

            <div className="glass-card border-saffron/20 bg-saffron/5 rounded-2xl p-5">
              <p className="text-white text-sm leading-relaxed">{result.overall_advice}</p>
            </div>

            {/* Compare toolbar */}
            {result.options.length > 1 && (
              <div className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5">
                <button
                  onClick={() => { setCompareOn((v) => !v); setCompareIds([]) }}
                  className={`text-xs font-semibold flex items-center gap-1.5 ${compareOn ? 'text-saffron' : 'text-gray-400 hover:text-white'}`}
                >
                  ⚖️ {compareOn ? 'Compare mode ON — pick up to 3' : 'Compare options side by side'}
                </button>
                {compareOn && compareIds.length >= 2 && (
                  <button onClick={() => setShowCompare(true)} className="btn-primary text-xs py-1.5 px-4">
                    Compare {compareIds.length} →
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              {result.options.map((opt, i) => (
                <OptionCard
                  key={opt.id}
                  opt={opt}
                  index={i}
                  compareOn={compareOn}
                  isCompared={compareIds.includes(opt.id)}
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>

            {showCompare && (
              <CompareModal
                options={result.options.filter((o) => compareIds.includes(o.id))}
                onClose={() => setShowCompare(false)}
              />
            )}

            {result.explore_next && (
              <div className="flex items-start gap-2 bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-4">
                <span className="text-indigo-400">🧭</span>
                <p className="text-indigo-200/90 text-sm leading-relaxed"><strong>Worth exploring:</strong> {result.explore_next}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button onClick={restart} className="btn-outline text-sm px-6 py-3">↺ Start Over</button>
              <button onClick={() => navigate('/mentors')} className="btn-outline text-sm px-6 py-3">
                💬 Talk to a Mentor
              </button>
              <button onClick={() => navigate('/onboarding')} className="btn-primary text-sm px-6 py-3">
                Get Full AI Guidance →
              </button>
            </div>

            {/* Provenance — makes the anti-hallucination story visible */}
            {result.provenance && (
              <div className="flex items-start gap-2 bg-sky-500/8 border border-sky-500/20 rounded-xl p-3 mt-2">
                <span className="text-sky-400 text-sm">🛡️</span>
                <p className="text-sky-200/80 text-[11px] leading-relaxed">
                  <strong>Why you can trust this:</strong> every course, exam and fee is drawn from our curated {result.provenance.coverage} dataset
                  (v{result.provenance.version}, last verified {result.provenance.lastVerified}) — never invented by AI. Only the explanations are AI-written.
                  Fees are approximate ranges; always confirm with the institution.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
