import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteScenario, getScenarios } from '../api'

function ScenarioCard({ scenario, selected, onSelect, onDelete }) {
  const form = scenario.form_data || {}
  const result = scenario.guidance_result || {}
  const date = new Date(scenario.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className={`rounded-2xl border p-5 cursor-pointer transition-all relative group
        ${selected
          ? 'border-saffron bg-saffron/8 shadow-lg shadow-saffron/10'
          : 'border-white/10 bg-white/4 hover:border-white/20'
        }`}
      onClick={onSelect}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-saffron flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 pr-6">
        <h3 className="font-bold text-white text-sm leading-tight">{scenario.label}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-rose-400 p-1 -mt-1 shrink-0"
          title="Delete scenario"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {form.stream && <span className="text-[10px] bg-navy-800 border border-white/8 text-gray-300 px-2 py-0.5 rounded">{form.stream}</span>}
        {form.marks && <span className="text-[10px] bg-navy-800 border border-white/8 text-gray-300 px-2 py-0.5 rounded">{form.marks}%</span>}
        {form.state && <span className="text-[10px] bg-navy-800 border border-white/8 text-gray-300 px-2 py-0.5 rounded">{form.state}</span>}
      </div>
      <p className="text-gray-400 text-xs leading-snug mt-2 line-clamp-2">{result.summary}</p>
      <p className="text-gray-600 text-[10px] mt-2">{date}</p>
    </div>
  )
}

function CompareView({ a, b }) {
  const optA = (a.guidance_result?.options || []).slice(0, 3)
  const optB = (b.guidance_result?.options || []).slice(0, 3)

  return (
    <div className="mt-8 animate-slide-up">
      <h2 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>⚖️</span>
        <span>Side-by-Side Comparison</span>
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {[{ s: a, opts: optA }, { s: b, opts: optB }].map(({ s, opts }, si) => (
          <div key={si} className="bg-white/4 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="pb-3 border-b border-white/8">
              <h3 className="font-bold text-white text-sm">{s.label}</h3>
              <p className="text-gray-400 text-xs mt-1 leading-snug">{s.guidance_result?.summary}</p>
            </div>
            {opts.map((opt, i) => (
              <div key={i} className="bg-white/4 rounded-xl p-3">
                <p className="text-saffron text-xs font-bold uppercase tracking-wider mb-1">Option {i + 1}</p>
                <p className="text-white text-sm font-semibold leading-tight">{opt.path}</p>
                <p className="text-gray-400 text-xs mt-1 leading-snug line-clamp-3">{opt.honest_take}</p>
                <p className="text-gray-500 text-xs mt-1">💰 {opt.avg_yearly_cost}</p>
                {opt.backup_plan && (
                  <p className="text-emerald-400 text-[11px] mt-1.5">🛡️ {opt.backup_plan}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Scenarios() {
  const { user, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  const load = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    try {
      const res = await getScenarios(session.access_token)
      const data = await res.json()
      setScenarios(data.scenarios || [])
    } catch (err) {
      setError('Failed to load scenarios.')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!session?.access_token) return
    try {
      await deleteScenario(id, session.access_token)
      setScenarios(prev => prev.filter(s => s.id !== id))
      setSelected(prev => prev.filter(sid => sid !== id))
    } catch { setError('Delete failed.') }
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id)
      if (prev.length >= 2) return [prev[1], id]  // max 2 selected
      return [...prev, id]
    })
  }

  const selectedScenarios = selected.map(id => scenarios.find(s => s.id === id)).filter(Boolean)

  if (authLoading || loading) {
    return (
      <main className="pt-24 pb-16 min-h-screen flex items-center justify-center bg-[#0A0F1E]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-saffron border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading your scenarios...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white">
              What-If <span className="gradient-text">Scenarios</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Save different paths and compare them before you decide.
            </p>
          </div>
          <Link to="/result" className="btn-outline text-sm py-2.5 px-5 shrink-0">
            ← Back to Guidance
          </Link>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-4 text-rose-300 text-sm mb-6">{error}</div>
        )}

        {/* Compare hint */}
        {scenarios.length >= 2 && (
          <div className="bg-saffron/10 border border-saffron/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <span className="text-xl">💡</span>
            <p className="text-gray-300 text-sm">
              Select <strong className="text-white">two scenarios</strong> to compare them side-by-side below.
              {selected.length > 0 && <span className="text-saffron ml-1">{selected.length}/2 selected.</span>}
            </p>
          </div>
        )}

        {/* Scenarios grid */}
        {scenarios.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="font-display font-bold text-white text-xl mb-2">No scenarios saved yet</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              After getting your guidance, click "Save as Scenario" to archive that pathway. You can save multiple what-if versions and compare them here.
            </p>
            <Link to="/result" className="btn-primary py-2.5 px-6 text-sm">
              Get Guidance First
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {scenarios.map(s => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                selected={selected.includes(s.id)}
                onSelect={() => toggleSelect(s.id)}
                onDelete={() => handleDelete(s.id)}
              />
            ))}
          </div>
        )}

        {/* Side-by-side compare */}
        {selectedScenarios.length === 2 && (
          <CompareView a={selectedScenarios[0]} b={selectedScenarios[1]} />
        )}
      </div>
    </main>
  )
}
