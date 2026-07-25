/*
 * NOT ROUTED — NON-FUNCTIONAL. DO NOT RE-ROUTE THIS PAGE.
 *
 * This component is kept on disk as reference work only. It is deliberately not
 * registered in `src/App.jsx` and has no navigation entry anywhere in `src/`,
 * because it cannot run:
 *
 *  - The API helpers it imports, `getVerifiedFeePlan` and `getVerifiedFeePlans`,
 *    do not exist in `src/api.js`. Calling them throws a runtime TypeError as
 *    soon as the page fetches. Rollup does not fail the build on missing named
 *    imports, so CI would not catch this if the page were routed.
 *  - The backend endpoints those helpers would call — `GET /api/fees/pilot`,
 *    `GET /api/fees/pilot/:id`, and `POST /api/fees/calculate` — were never
 *    implemented in `server/index.js`. They exist only as an interface proposal
 *    in `docs/FEE_RESEARCH_PILOT.md`.
 *
 * Do not re-add a route or nav link until BOTH exist: the `/api/fees/*` routes
 * backed by sourced, verified fee data (with source, effective period and
 * verification state per component, per the data-provenance rules in
 * `docs/CURRENT_STATE_AUDIT.md` §25), and the matching `src/api.js` helpers.
 * Fabricating fee figures is explicitly out of bounds for this project.
 */
import { useEffect, useMemo, useState } from 'react'
import { getVerifiedFeePlan, getVerifiedFeePlans } from '../api'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const initialAssumptions = { books: 0, travel: 0, laptop: 0, personal: 0 }

function coverageLabel(value) {
  if (value === 'semester') return 'One semester'
  if (value === 'academic_year') return 'First academic year'
  return 'Complete course'
}

function Skeleton() {
  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 animate-pulse" aria-label="Loading fee plans">
      <div className="h-96 rounded-2xl bg-white/5" />
      <div className="h-[560px] rounded-2xl bg-white/5" />
    </div>
  )
}

function ErrorState({ message, retry }) {
  return (
    <div role="alert" className="max-w-xl mx-auto text-center glass-card p-8">
      <p className="text-red-300 font-semibold">Verified fee data could not be loaded.</p>
      <p className="text-gray-400 text-sm mt-2">{message}</p>
      <button type="button" onClick={retry} className="btn-primary mt-5">Try again</button>
    </div>
  )
}

function PlanList({ plans, selectedId, onSelect }) {
  return (
    <aside aria-label="Verified fee plans" className="space-y-3">
      {plans.map(plan => (
        <button
          type="button"
          key={plan.id}
          onClick={() => onSelect(plan.id)}
          aria-pressed={selectedId === plan.id}
          className={`w-full text-left rounded-2xl border p-4 transition-all ${
            selectedId === plan.id
              ? 'border-saffron bg-saffron/10 shadow-saffron'
              : 'border-white/10 bg-navy-800/70 hover:border-white/25'
          }`}
        >
          <span className="block text-[11px] uppercase tracking-wider text-saffron font-bold">
            {coverageLabel(plan.coverage)} · {plan.academicYear}
          </span>
          <span className="block text-white font-bold mt-1">{plan.institutionName}</span>
          <span className="block text-gray-400 text-xs mt-1">{plan.studentCategory}</span>
          <span className="block text-2xl text-white font-display font-bold mt-3">
            {money.format(plan.netConfirmed.expected)}
          </span>
          {plan.confirmedAid.expected > 0 && (
            <span className="block text-emerald-300 text-xs mt-1">
              after {money.format(plan.confirmedAid.expected)} official tuition remission
            </span>
          )}
        </button>
      ))}
    </aside>
  )
}

function AssumptionEditor({ assumptions, setAssumptions, officialTotal }) {
  const fields = [
    ['books', 'Books and materials'],
    ['travel', 'Travel to campus'],
    ['laptop', 'Laptop/equipment'],
    ['personal', 'Other personal costs'],
  ]
  const additional = Object.values(assumptions).reduce((sum, value) => sum + (Number(value) || 0), 0)

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold">Add your own costs</h3>
          <p className="text-gray-400 text-xs mt-1">These are your assumptions, not institution-published fees.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Personal planning total</p>
          <p className="text-xl text-amber-200 font-bold">{money.format(officialTotal + additional)}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {fields.map(([key, label]) => (
          <label key={key} className="text-xs text-gray-300">
            {label}
            <span className="mt-1 flex items-center rounded-xl border border-white/10 bg-navy-900 focus-within:border-saffron">
              <span className="pl-3 text-gray-500">₹</span>
              <input
                type="number"
                min="0"
                step="500"
                value={assumptions[key]}
                onChange={event => setAssumptions(current => ({ ...current, [key]: event.target.value }))}
                className="w-full bg-transparent px-2 py-2.5 text-white outline-none"
              />
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}

function PlanDetail({ detail, assumptions, setAssumptions }) {
  const calculation = detail.calculation
  const year = calculation.years[0]
  const grouped = useMemo(() => Object.entries(year.categories).sort((a, b) => b[1].expected - a[1].expected), [year.categories])
  const sources = useMemo(() => {
    const unique = new Map()
    for (const component of year.components) {
      if (component.source) unique.set(component.source.url, component.source)
    }
    for (const aid of year.aid) {
      if (aid.source) unique.set(aid.source.url, aid.source)
    }
    return [...unique.values()]
  }, [year])

  return (
    <article className="space-y-5">
      <section className="glass-card p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
              Official sources reviewed
            </span>
            <h2 className="font-display text-2xl font-bold text-white mt-3">{calculation.institutionName}</h2>
            <p className="text-gray-400 text-sm mt-1">{calculation.courseName}</p>
            <p className="text-gray-500 text-xs mt-2">Category: {detail.studentContext.category}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Confirmed cash requirement</p>
            <p className="text-3xl font-display font-bold text-white">{money.format(calculation.totals.netConfirmed.expected)}</p>
            <p className="text-saffron text-xs font-bold mt-1">{coverageLabel(calculation.coverage)} only</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          {[
            ['Published components', calculation.totals.gross.expected],
            ['Confirmed remission', calculation.totals.confirmedAid.expected],
            ['Monthly planning rate', calculation.expectedMonthlyBurden],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/8 bg-navy-900/70 p-3">
              <p className="text-gray-500 text-[11px]">{label}</p>
              <p className="text-white font-bold mt-1">{money.format(value)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-white/8 p-5">
          <h3 className="text-white font-bold">Component breakdown</h3>
          <p className="text-gray-500 text-xs mt-1">Refundable deposits are included because the money is needed at admission.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {grouped.map(([category, band]) => (
            <div key={category} className="bg-navy-800 p-4">
              <p className="text-gray-500 text-xs capitalize">{category.replaceAll('_', ' ')}</p>
              <p className="text-white font-semibold mt-1">{money.format(band.expected)}</p>
            </div>
          ))}
        </div>
        <details className="border-t border-white/8 group">
          <summary className="cursor-pointer list-none p-5 text-sm font-bold text-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron">
            Show every published line item ({year.components.length})
          </summary>
          <div className="px-5 pb-5 divide-y divide-white/5">
            {year.components.map(component => (
              <div key={component.code} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="text-gray-200">{component.label}</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    {component.refundable ? 'Refundable deposit · ' : ''}{component.notes}
                  </p>
                </div>
                <span className="text-white font-semibold whitespace-nowrap">{money.format(component.amount.expected)}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <AssumptionEditor assumptions={assumptions} setAssumptions={setAssumptions} officialTotal={calculation.totals.netConfirmed.expected} />

      <section className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5">
        <h3 className="text-red-200 font-bold">Read before comparing</h3>
        <ul className="mt-3 space-y-2 text-sm text-gray-300 list-disc pl-5">
          {calculation.limitations.map(item => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-white font-bold">Evidence</h3>
        <div className="mt-3 space-y-3">
          {sources.map(source => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-white/8 bg-navy-900/60 p-4 hover:border-saffron/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            >
              <span className="text-saffron text-sm font-bold">Open official circular ↗</span>
              <span className="block text-gray-200 text-sm mt-1">{source.title}</span>
              <span className="block text-gray-500 text-xs mt-1">
                {source.academicYear} · checked {new Date(source.lastCheckedAt).toLocaleDateString('en-IN')} · confidence {Math.round(source.confidence * 100)}%
              </span>
            </a>
          ))}
        </div>
        <p className="text-gray-500 text-xs mt-4">{detail.disclaimer}</p>
      </section>
    </article>
  )
}

export default function FeeExplorer() {
  const [plans, setPlans] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [assumptions, setAssumptions] = useState(initialAssumptions)

  const loadPlans = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getVerifiedFeePlans()
      if (!response.ok) throw new Error(`Server returned ${response.status}`)
      const data = await response.json()
      setPlans(data.plans)
      setSelectedId(current => current || data.plans[0]?.id || '')
    } catch (loadError) {
      setError(loadError.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPlans() }, [])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    setDetailLoading(true)
    setAssumptions(initialAssumptions)
    getVerifiedFeePlan(selectedId)
      .then(response => {
        if (!response.ok) throw new Error(`Server returned ${response.status}`)
        return response.json()
      })
      .then(data => { if (active) setDetail(data) })
      .catch(loadError => { if (active) setError(loadError.message || 'Unknown error') })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedId])

  return (
    <main className="min-h-screen bg-navy px-4 pb-20 pt-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl mb-8">
          <p className="text-saffron text-xs font-bold uppercase tracking-[0.2em]">Affordability evidence</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mt-3">Know what the fee figure includes.</h1>
          <p className="text-gray-400 mt-4 leading-relaxed">
            Compare reviewed 2026-27 official circulars line by line. Coverage is shown prominently so a semester figure is never mistaken for a full-course cost.
          </p>
        </div>

        {loading ? <Skeleton /> : error && plans.length === 0 ? (
          <ErrorState message={error} retry={loadPlans} />
        ) : (
          <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
            <div className="lg:sticky lg:top-24">
              <PlanList plans={plans} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            {detailLoading || !detail ? <div className="h-[560px] rounded-2xl bg-white/5 animate-pulse" /> : (
              <PlanDetail detail={detail} assumptions={assumptions} setAssumptions={setAssumptions} />
            )}
          </div>
        )}
      </div>
    </main>
  )
}
