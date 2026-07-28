import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation, Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import AuthModal from '../components/AuthModal'
import CourseReality from '../components/CourseReality'
import ExamDetails from '../components/ExamDetails'
import CourseOverlayPanel from '../components/CourseOverlayPanel'
import CollegeDetailCard from '../components/CollegeDetailCard'
import RankPredictor from '../components/RankPredictor'
import { getMentors, postGuidance, postScenario, postSync } from '../api'

// ─── Framer Motion Variants ──────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
}

const cardRevealVariant = {
  hidden: { opacity: 0, y: 28, scale: 0.97, filter: 'blur(4px)' },
  show: { 
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } 
  },
}

const pillPopVariant = {
  hidden: { opacity: 0, scale: 0.8 },
  show: (i) => ({
    opacity: 1, scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 15, delay: i * 0.05 }
  }),
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_LABELS = {
  'below_2.5L': 'Below ₹2.5 Lakh/yr',
  '2.5L-5L':   '₹2.5L–₹5L/yr',
  '5L-10L':    '₹5L–₹10L/yr',
  'above_10L': 'Above ₹10L/yr',
}
// ─── Backend API call ─────────────────────────────────────────────────────────

async function callGemini(form) {
  const { data: { session } } = await supabase.auth.getSession()

  const res = await postGuidance(form, session?.access_token)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (res.status === 401 && err?.error === 'NO_API_KEY') {
      throw new Error('NO_API_KEY')
    }
    const msg = err?.message || err?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }

  return await res.json()
}

// ─── Micro-components ────────────────────────────────────────────────────────

export function Spinner() {
  return (
    <div className="space-y-6 py-4">
      {/* Summary skeleton */}
      <div className="rounded-2xl p-7 sm:p-9 border border-saffron/20" style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.08) 0%, rgba(15,23,42,0.5) 100%)' }}>
        <div className="space-y-3">
          <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-4 w-48 rounded" />
          <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-5 w-full rounded" />
          <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-5 w-3/4 rounded" />
        </div>
      </div>
      {/* Card skeletons */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass-card p-6 sm:p-8 space-y-4" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="flex items-center gap-4">
            <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-5 w-2/3 rounded" />
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-3 w-20 rounded" />
            </div>
          </div>
          <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-16 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-3 w-24 rounded" />
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-4 w-full rounded" />
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-4 w-4/5 rounded" />
            </div>
            <div className="space-y-2">
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-3 w-20 rounded" />
              <div className="animate-shimmer bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 bg-[length:1000px_100%] h-6 w-36 rounded" />
            </div>
          </div>
        </div>
      ))}
      {/* Thinking indicator at bottom */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-saffron animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-gray-400 text-sm">AI is reading your answers carefully</p>
      </div>
    </div>
  )
}

export function NoApiKey() {
  return (
    <div className="glass-card p-8 text-center border-amber-500/30">
      <div className="text-5xl mb-4">🔑</div>
      <h2 className="font-display text-xl font-bold text-white mb-2">API Key Missing</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
        Add your Groq API key to the <code className="bg-navy-800 px-2 py-0.5 rounded text-saffron text-xs">server/.env</code> file to generate personalised guidance.
      </p>
      <div className="bg-navy-800 border border-white/10 rounded-xl p-4 text-left text-sm font-mono text-emerald-400 mb-6">
        GROQ_API_KEY=your_key_here
      </div>
      <a
        href="https://console.groq.com/keys"
        target="_blank"
        rel="noreferrer"
        className="btn-primary text-sm px-6 py-3 inline-block"
      >
        Get Free Groq API Key →
      </a>
      <p className="text-gray-600 text-xs mt-4">Free tier · No credit card needed</p>
    </div>
  )
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div className="glass-card p-8 text-center border-rose-500/25">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="font-display text-xl font-bold text-white mb-2">Something went wrong</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto font-mono bg-navy-800 rounded-lg px-4 py-3 border border-white/8">
        {message}
      </p>
      <button onClick={onRetry} className="btn-primary text-sm px-8 py-3">
        Try Again
      </button>
    </div>
  )
}

function NoFormData() {
  return (
    <div className="glass-card p-10 text-center">
      <div className="text-5xl mb-4">📋</div>
      <h2 className="font-display text-2xl font-bold text-white mb-3">No answers found</h2>
      <p className="text-gray-400 mb-8">Fill in the form first so we can personalise your guidance.</p>
      <Link to="/onboarding" className="btn-primary px-8 py-4 text-base inline-block">
        Start the Form →
      </Link>
    </div>
  )
}

// ─── Grounding Badge ─────────────────────────────────────────────────────────

function DataGroundingBadge({ grounded }) {
  if (grounded) {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        College & scholarship data verified from our database
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
      <span className="text-base leading-none">⚠️</span>
      AI-estimated college data — verify costs directly with each institution
    </div>
  )
}

// ─── Confidence Badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ label, reason }) {
  if (!label) return null
  const colors = {
    High:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Low:    'text-rose-400 bg-rose-500/10 border-rose-500/20',
  }
  const icons = { High: '🎯', Medium: '⚡', Low: '📝' }
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs font-semibold border rounded-full px-3 py-1.5 ${colors[label] || colors.Medium}`}
      title={reason}
    >
      <span>{icons[label] || '⚡'}</span>
      {label} Confidence
    </div>
  )
}

// ─── Result display components ────────────────────────────────────────────────

function SummaryCard({ summary, name }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl p-7 sm:p-9 mb-6"
      style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.18) 0%, rgba(255,107,0,0.06) 60%, rgba(15,23,42,0) 100%)', border: '1px solid rgba(255,107,0,0.3)' }}>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-saffron via-saffron-light to-transparent" />
      {/* Glow orb */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-saffron/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">✨</span>
          <span className="text-saffron text-xs font-bold uppercase tracking-widest">Your Honest Summary</span>
        </div>
        {name && (
          <p className="text-gray-400 text-sm mb-2">
            For <span className="text-white font-semibold">{name}</span>
          </p>
        )}
        <p className="text-white text-lg leading-relaxed font-medium">{summary}</p>
      </div>
    </motion.div>
  )
}

function OptionCard({ option, index, formData, collegesData }) {
  const colorMap = ['border-blue-500/25', 'border-purple-500/25', 'border-emerald-500/25']
  const accentMap = ['text-blue-400', 'text-purple-400', 'text-emerald-400']
  const bgMap = ['bg-blue-500/8', 'bg-purple-500/8', 'bg-emerald-500/8']
  const [showCoursePanel, setShowCoursePanel] = useState(false)
  const [showAllColleges, setShowAllColleges] = useState(false)

  const allColleges = option.realistic_colleges || []
  const visibleColleges = showAllColleges ? allColleges : allColleges.slice(0, 3)
  const hiddenCount = allColleges.length - visibleColleges.length

  return (
    <motion.div
      variants={cardRevealVariant}
      whileHover={{ y: -4, boxShadow: '0 0 40px rgba(255,107,0,0.2)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`glass-card p-6 sm:p-8 flex flex-col gap-5 ${colorMap[index] || 'border-white/15'}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl ${bgMap[index]} flex items-center justify-center font-display font-bold text-lg ${accentMap[index]} border border-current/20 flex-shrink-0`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-xl text-white leading-tight">{option.path}</h3>
          <p className={`text-xs font-semibold mt-1 ${accentMap[index]}`}>Option {index + 1}</p>
        </div>
        {/* Explore Course Button */}
        <button
          onClick={() => setShowCoursePanel(v => !v)}
          className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
            showCoursePanel
              ? 'bg-saffron/15 border-saffron text-saffron'
              : 'bg-white/5 border-white/10 text-gray-400 hover:border-saffron/40 hover:text-saffron'
          }`}
        >
          <span>📚</span>
          <span className="hidden sm:inline">{showCoursePanel ? 'Close' : 'Explore'}</span>
        </button>
      </div>

      {/* Course Overview Panel */}
      <CourseOverlayPanel
        path={option.path}
        isOpen={showCoursePanel}
        onClose={() => setShowCoursePanel(false)}
      />

      {/* Honest take */}
      <div className="bg-white/4 border border-white/8 rounded-xl p-4">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">💬 Honest Take</p>
        <p className="text-gray-200 text-sm leading-relaxed">{option.honest_take}</p>
      </div>

      {/* Grid: colleges + cost */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            {formData?.classLevel === 'class10' ? '🏫 Target Paths / Institutions' : '🏫 Realistic Colleges'}
          </p>
          <p className="text-gray-500 text-[10px] mb-2 italic">Click each college for fees, cutoffs & more ↓</p>
          <ul className="space-y-1">
            {visibleColleges.map((c, i) => {
              const dbEntry = collegesData?.[c]
              return (
                <li key={i}>
                  <CollegeDetailCard
                    collegeName={c}
                    sourceUrl={dbEntry?.source_url}
                  />
                </li>
              )
            })}
          </ul>

          {/* Explore more colleges — reveals the remaining matched colleges,
              each expandable to the same fees/cutoffs/links detail card. */}
          {allColleges.length > 3 && (
            <button
              onClick={() => setShowAllColleges(v => !v)}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-saffron hover:text-saffron-light bg-saffron/10 hover:bg-saffron/15 border border-saffron/25 rounded-lg px-3 py-1.5 transition-all"
            >
              <span>{showAllColleges ? '▲ Show fewer colleges' : `＋ Explore ${hiddenCount} more college${hiddenCount > 1 ? 's' : ''}`}</span>
            </button>
          )}
        </div>

        <div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            {formData?.classLevel === 'class10' ? '📚 Est. Coaching Cost/yr' : '💰 Avg Yearly Cost'}
          </p>
          <p className="text-white font-display font-bold text-xl">{option.avg_yearly_cost}</p>
          <p className="text-gray-500 text-xs mt-1">
            {formData?.classLevel === 'class10' ? 'school fees + coaching / tuition' : 'tuition + hostel + misc'}
          </p>

          <div className="mt-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">🚀 Opens Doors To</p>
            <div className="flex flex-wrap gap-1.5">
              {(option.opens_doors_to || []).map((d, i) => (
                <motion.span 
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: i * 0.06 }}
                  className="text-xs bg-navy-700 border border-white/10 text-gray-300 px-2.5 py-1 rounded-lg"
                >
                  {d}
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Watch out */}
      <div className="flex items-start gap-3 bg-rose-500/8 border border-rose-500/20 rounded-xl p-4">
        <span className="text-rose-400 text-lg flex-shrink-0 mt-0.5">⚠️</span>
        <div>
          <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">Watch Out For</p>
          <p className="text-rose-200 text-sm leading-relaxed">{option.watch_out_for}</p>
        </div>
      </div>

      {/* Backup Plan */}
      {option.backup_plan && (
        <div className="flex items-start gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4">
          <span className="text-emerald-400 text-lg flex-shrink-0 mt-0.5">🛡️</span>
          <div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Backup Plan</p>
            <p className="text-emerald-200 text-sm leading-relaxed">{option.backup_plan}</p>
          </div>
        </div>
      )}

      {/* Roadmap CTA */}
      <Link
        to={`/${formData?.classLevel || 'class12'}/roadmap`}
        state={{ option, formData }}
        className="btn-primary mt-2 py-3.5 text-sm flex items-center justify-center gap-2 group/btn"
      >
        <span>View 4-Year Roadmap</span>
        <svg
          className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </motion.div>
  )
}

function ScholarshipBox({ scholarship, scholarshipData }) {
  // Prefer the verified DB application URL. When it's missing, fall back to an
  // official-search link (National Scholarship Portal for govt schemes, else a
  // targeted Google search on the exact scheme name) so the button always works.
  const rawUrl = scholarshipData?.application_url
  const deadline = scholarshipData?.deadline_pattern
  const isValidUrl = typeof rawUrl === 'string' && /^https?:\/\//i.test(rawUrl)
  const applyUrl = isValidUrl
    ? rawUrl
    : `https://www.google.com/search?q=${encodeURIComponent((scholarship || 'scholarship') + ' official application apply India')}`

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 flex items-start gap-5 animate-slide-up"
      style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(15,23,42,0.8) 100%)', border: '1px solid rgba(34,197,94,0.25)' }}
    >
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-2xl flex-shrink-0">
        🎓
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">Scholarship to Check This Week</p>
        <p className="text-white text-base leading-relaxed font-medium">{scholarship}</p>
        {deadline && (
          <p className="text-gray-500 text-xs mt-1">⏰ Deadline: {deadline}</p>
        )}
        <a
          href={applyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 hover:border-emerald-400/40 rounded-lg px-3 py-1.5 transition-all"
        >
          {isValidUrl ? 'Apply / Learn More' : 'Find Official Application'}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        {!isValidUrl && (
          <p className="text-gray-500 text-[11px] mt-2">Tip: also check the National Scholarship Portal — scholarships.gov.in</p>
        )}
      </div>
    </div>
  )
}

function OneActionBox({ action }) {
  return (
    <div
      className="rounded-2xl p-6 sm:p-8 animate-slide-up"
      style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.12) 0%, rgba(15,23,42,0.9) 100%)', border: '1px solid rgba(255,107,0,0.3)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-saffron/20 border border-saffron/30 flex items-center justify-center text-xl">
          ⚡
        </div>
        <p className="text-saffron text-xs font-bold uppercase tracking-widest">Your One Action This Week</p>
      </div>
      <p className="text-white text-xl font-display font-bold leading-snug">{action}</p>
      <div className="mt-5 flex items-center gap-2">
        <div className="flex-1 h-px bg-saffron/20" />
        <span className="text-saffron/60 text-xs">Do this before anything else</span>
        <div className="flex-1 h-px bg-saffron/20" />
      </div>
    </div>
  )
}

// ─── Student profile pill strip ───────────────────────────────────────────────

export function ProfileStrip({ form }) {
  const pills = [
    form.board,
    form.stream,
    form.marks && `${form.marks}%`,
    form.state,
    INCOME_LABELS[form.incomeRange],
  ].filter(Boolean)

  return (
    <motion.div 
      className="flex flex-wrap gap-2 mb-8"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {pills.map((p) => (
        <motion.span 
          key={p} 
          variants={pillPopVariant}
          className="text-xs bg-navy-800 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full font-medium"
        >
          {p}
        </motion.span>
      ))}
      <motion.span variants={pillPopVariant}>
        <Link to="/onboarding" className="text-xs text-saffron border border-saffron/30 px-3 py-1.5 rounded-full font-medium hover:bg-saffron/10 transition-colors inline-block">
          ✏️ Edit Answers
        </Link>
      </motion.span>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── Save Results Banner (unauthenticated users) ─────────────────────────────

function SaveResultsBanner({ onSave }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-4 mb-6 animate-slide-up"
      style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.10) 0%, rgba(15,23,42,0.8) 100%)', border: '1px solid rgba(255,107,0,0.25)' }}>
      <div className="flex items-center gap-3">
        <span className="text-xl flex-shrink-0">💾</span>
        <div>
          <p className="text-white text-sm font-semibold leading-tight">Save your results</p>
          <p className="text-gray-400 text-xs mt-0.5">Sign in to access these anywhere — even 6 months later.</p>
        </div>
      </div>
      <button
        onClick={onSave}
        className="flex-shrink-0 text-xs font-semibold bg-saffron hover:bg-saffron-light text-white px-4 py-2 rounded-xl transition-colors"
      >
        Save →
      </button>
    </div>
  )
}

// ─── Mentor Teaser Box (Phase 4 — Real Mentor Connect) ───────────────────────

function MentorTeaserBox({ mentor }) {
  if (!mentor) return null

  // Ensure matching styling tags / colors
  const border = mentor.border || 'border-blue-500/25'
  const initialsBg = mentor.initials_bg || 'bg-blue-500/20 text-blue-300'

  return (
    <div
      className={`glass-card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 animate-slide-up border ${border}`}
      style={{ background: `linear-gradient(135deg, rgba(255,107,0,0.06) 0%, rgba(15,23,42,0.8) 100%)` }}
    >
      <div className={`w-16 h-16 rounded-2xl ${initialsBg} flex items-center justify-center font-display font-bold text-xl flex-shrink-0 border border-current/10`}>
        {mentor.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-saffron text-xs font-bold uppercase tracking-widest mb-1">Recommended Mentor For You</p>
        <h4 className="text-white text-lg font-display font-bold leading-tight">{mentor.name}</h4>
        <p className="text-gray-400 text-xs mt-0.5">{mentor.degree} · {mentor.college}</p>
        <p className="text-gray-300 text-sm mt-2.5 leading-relaxed italic">&ldquo;{mentor.story}&rdquo;</p>
      </div>
      <div className="w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-0">
        {mentor.cal_link && mentor.cal_link.trim() !== '#' ? (
          <>
            <a
              href={mentor.cal_link}
              target="_blank"
              rel="noreferrer"
              className="btn-primary py-3 px-6 text-sm flex items-center justify-center gap-2 group/btn w-full sm:w-auto text-center"
            >
              <span>Book Free Call</span>
              <svg className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <p className="text-center text-gray-600 text-[10px] mt-1.5">20 min · Completely free</p>
          </>
        ) : (
          <>
            <Link
              to="/mentors"
              className="btn-primary py-3 px-6 text-sm flex items-center justify-center gap-2 group/btn w-full sm:w-auto text-center"
            >
              <span>Connect with a Mentor</span>
              <svg className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <p className="text-center text-gray-600 text-[10px] mt-1.5">Chat free on the Mentors page</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function Result() {
  const { classLevel = 'class12' } = useParams()
  const { state } = useLocation()

  // Memoize formData — prevents fetchGuidance from firing on every render
  const formData = useMemo(() => {
    const savedRaw = localStorage.getItem('aageKyaFormData')
    const rawForm  = state?.formData ?? (savedRaw ? JSON.parse(savedRaw) : null)
    return rawForm ? { ...rawForm, classLevel: rawForm.classLevel || classLevel } : null
  }, [classLevel, state?.formData])


  const [status,   setStatus]   = useState('idle')   // idle | loading | success | error
  const [result,   setResult]   = useState(null)
  const [errorMsg, setErrMsg]   = useState('')
  const [session,  setSession]  = useState(null)
  const [isAuthOpen, setAuthOpen] = useState(false)
  const [parentMode, setParentMode] = useState(false)
  const [matchedMentor, setMatchedMentor] = useState(null)
  const [scenarioSaved, setScenarioSaved] = useState(false)
  const [scenarioSaving, setScenarioSaving] = useState(false)

  // Track auth state to know if we should show the save banner
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Match a mentor based on student stream or class level
  useEffect(() => {
    if (!formData) return
    getMentors()
      .then((res) => {
        if (!res.ok) throw new Error('API failed')
        return res.json()
      })
      .then((data) => {
        const match = data.find((m) => {
          if (formData.classLevel === 'class10') {
            return m.stream_category === 'Class 10 / Stream Selection' && m.available
          }
          // For Class 12: try exact stream match first, then fall back to any available mentor
          return m.stream_category === formData.stream && m.available
        }) || (formData.classLevel === 'class12'
          ? data.find((m) => m.available) // any available mentor as fallback for Class 12
          : null)
        if (match) {
          setMatchedMentor(match)
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch matched mentor:', err)
      })
  }, [formData])

  // On sign-in, silently sync any localStorage results to the database
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' && newSession && formData && result) {
        try {
          await postSync(formData, result, newSession.access_token)
          console.log('Synced offline results to Supabase.')
        } catch (err) {
          console.error('Failed to sync offline results:', err)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [formData, result])

  const fetchGuidance = useCallback(async () => {
    if (!formData) return
    setStatus('loading')
    setResult(null)
    setErrMsg('')
    setScenarioSaved(false)
    try {
      const data = await callGemini(formData)
      setResult(data)
      localStorage.setItem('aageKyaLastResult', JSON.stringify(data))
      localStorage.setItem('aageKyaLastFormData', JSON.stringify(formData))
      setStatus('success')
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        setStatus('no_key')
      } else {
        setErrMsg(err.message)
        setStatus('error')
      }
    }
  }, [formData])

  const saveScenario = async () => {
    if (!session || !result || !formData) return
    setScenarioSaving(true)
    try {
      const label = `${formData.stream || 'My Path'} — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      await postScenario(label, formData, result, session.access_token)
      setScenarioSaved(true)
    } catch (err) {
      console.error('Failed to save scenario:', err)
    }
    finally { setScenarioSaving(false) }
  }

  useEffect(() => {
    fetchGuidance()
  }, [fetchGuidance])

  return (
    <main className="pt-24 pb-24 min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">AI-Powered · Honest · Specific to You</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Your Personalised{' '}
            <span className="gradient-text">Guidance</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg">
            Based on <em>your</em> actual situation — not generic advice.
          </p>
        </div>

        {/* Profile pills */}
        {formData && <ProfileStrip form={formData} />}

        {/* ── States ── */}

        {/* No form data */}
        {!formData && <NoFormData />}

        {/* Loading */}
        {formData && status === 'loading' && <Spinner />}

        {/* No API key */}
        {status === 'no_key' && <NoApiKey />}

        {/* Error */}
        {status === 'error' && (
          <ErrorCard message={errorMsg} onRetry={fetchGuidance} />
        )}

        {/* Auth modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setAuthOpen(false)}
        />

        {/* Success */}
        {status === 'success' && result && (
          <div className="space-y-6">

            {/* AI busy banner — honest signal when the LLM quota is exhausted
                and results fell back to sample/template data. */}
            {result.ai_status && result.ai_status.available === false && (
              <div className="flex items-start gap-3 rounded-2xl px-5 py-4 bg-amber-500/10 border border-amber-500/30">
                <span className="text-xl flex-shrink-0">⚡</span>
                <div>
                  <p className="text-amber-300 text-sm font-semibold">
                    {result.ai_status.reason === 'no_key'
                      ? 'AI is not configured — showing sample guidance.'
                      : 'Our AI is busy right now — showing sample guidance.'}
                  </p>
                  <p className="text-amber-200/70 text-xs mt-0.5">
                    {result.ai_status.reason === 'no_key'
                      ? 'Add an AI API key on the server to get personalised results.'
                      : `The daily AI limit was reached. Personalised results resume in about ${Math.max(1, Math.round((result.ai_status.retryAfterSeconds || 0) / 60))} min — tap Regenerate then.`}
                  </p>
                </div>
              </div>
            )}

            {/* Save results nudge for guests */}
            {!session && (
              <SaveResultsBanner onSave={() => setAuthOpen(true)} />
            )}

            {/* Print and Parent Mode preview bar */}
            <div className="flex flex-wrap justify-between items-center gap-3 no-print bg-white/4 border border-white/8 rounded-2xl p-4">
              <button
                onClick={() => setParentMode(!parentMode)}
                className={`text-xs px-4 py-2.5 rounded-xl border font-semibold transition-all flex items-center gap-1.5
                  ${parentMode
                    ? 'bg-saffron/15 border-saffron text-saffron'
                    : 'bg-navy-800 border-white/10 text-gray-400 hover:border-saffron/30 hover:text-white'
                  }`}
              >
                <span>🛡️</span>
                <span>{parentMode ? 'Back to Student View' : 'Parent Mode View'}</span>
              </button>

              <Link
                to={`/${formData?.classLevel || 'class12'}/result/print`}
                className="btn-outline text-xs py-2.5 px-4 flex items-center gap-1.5 hover:bg-white/5"
              >
                <span>🖨️</span>
                <span>Print / Save PDF</span>
              </Link>
            </div>

            {/* Data grounding + confidence badges + save scenario */}
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-wrap gap-2">
                <DataGroundingBadge grounded={result.grounded} />
                <ConfidenceBadge label={result.confidence_label} reason={result.confidence_reason} />
              </div>
              {session && (
                <button
                  onClick={saveScenario}
                  disabled={scenarioSaving || scenarioSaved}
                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all flex items-center gap-1.5
                    ${scenarioSaved
                      ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                      : 'border-white/15 text-gray-400 hover:text-white hover:border-saffron/40'
                    }`}
                >
                  {scenarioSaved ? '✓ Scenario Saved' : scenarioSaving ? 'Saving…' : '+ Save as Scenario'}
                </button>
              )}
            </div>

            {/* AI Explainability Agent Trace */}
            {result.explainability && (
              <div className="glass-card p-5 border-saffron/20 bg-saffron/5 rounded-2xl">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      <div className="text-left">
                        <h4 className="font-display font-bold text-sm text-white group-hover:text-saffron transition-colors">
                          AI Orchestrator Agent Trace & Explainability
                        </h4>
                        <p className="text-gray-400 text-xs mt-0.5">
                          Click to view step-by-step latency & agent thought process details
                        </p>
                      </div>
                    </div>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform duration-200">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    {/* Summary of execution */}
                    <div className="flex items-center justify-between text-xs text-gray-400 bg-white/5 p-3 rounded-xl border border-white/5">
                      <span>Total Orchestration Latency:</span>
                      <span className="font-mono text-saffron font-bold">
                        {result.explainability.totalDurationMs} ms
                      </span>
                    </div>

                    {/* Profile metrics extracted */}
                    {result.explainability.profile && (
                      <div className="bg-navy-800/80 border border-white/5 rounded-xl p-3.5 space-y-2 text-left">
                        <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span>📋</span> Profile Agent Extraction:
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                          <div>Academic Standing: <span className="text-white">{result.explainability.profile.academicStanding}</span></div>
                          <div>Financial Category: <span className="text-white">{result.explainability.profile.financialCategory}</span></div>
                          <div>Risk Appetite: <span className="text-white">{result.explainability.profile.riskAppetite}</span></div>
                          <div>Coaching Needs: <span className="text-white">{result.explainability.profile.coachingNeeds}</span></div>
                        </div>
                      </div>
                    )}

                    {/* Step log list */}
                    <div className="space-y-2 text-left">
                      <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>⛓️</span> Executed Nodes:
                      </h5>
                      <div className="space-y-1.5">
                        {(result.explainability.steps || []).map((step, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className={step.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                                {step.status === 'success' ? '●' : '✕'}
                              </span>
                              <span className="font-medium text-gray-300">{step.agent}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-mono">{step.durationMs} ms</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                step.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {step.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* 1 — Summary */}
            <SummaryCard
              summary={result.summary}
              name={formData?.fullName}
            />

            {/* 2 — Options */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              {(result.options || []).map((opt, i) => (
                <motion.div key={i} variants={cardRevealVariant} className="space-y-2">
                  <OptionCard option={opt} index={i} formData={formData} collegesData={result.colleges_data} />
                  <CourseReality streamKey={opt.path} />
                  {parentMode && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 sm:p-6">
                      <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <span>👨‍👩‍👧</span>
                        <span>Why This Fits Your Child</span>
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        This recommendation directly aligns with their subject interest in <strong className="text-white">&ldquo;{formData?.interests}&rdquo;</strong> and matches their academic performance of <strong className="text-white">{formData?.marks}%</strong>.
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* 3 — Scholarships List */}
            {result.scholarships_list && result.scholarships_list.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 pt-2">
                  <span className="text-xl">🎓</span>
                  <h3 className="font-display font-bold text-lg text-white">Matching Scholarships Sourced For You</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {result.scholarships_list.map((s, idx) => (
                    <ScholarshipBox key={idx} scholarship={s.name} scholarshipData={s} />
                  ))}
                </div>
              </div>
            ) : (
              result.scholarship_to_check && (
                <ScholarshipBox scholarship={result.scholarship_to_check} scholarshipData={result.scholarship_data} />
              )
            )}

            {/* 3.5 — Entrance Exam Details (Class 12 only) */}
            {classLevel === 'class12' && (
              <div className="pt-2">
                <ExamDetails stream={formData?.stream} />
              </div>
            )}

            {/* 3.55 — Historical Cutoff Comparison / Rank Predictor (Class 12 only) */}
            {classLevel === 'class12' && (
              <div className="pt-2">
                <RankPredictor formData={formData} />
              </div>
            )}

            {/* 3.6 — Recommended Mentor Connect */}
            {matchedMentor && (
              <MentorTeaserBox mentor={matchedMentor} />
            )}

            {/* 4 — One action */}
            {result.one_thing_to_do_this_week && (
              <OneActionBox action={result.one_thing_to_do_this_week} />
            )}

            {/* ── Bottom CTA ── */}
            <div className="pt-4 space-y-4">
              <div className="glass-card p-7 text-center border-white/10">
                <p className="text-gray-300 text-base mb-2 font-medium">
                  Want to speak to other seniors who figured it out?
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  Browse our directory of volunteer mentors across engineering, medicine, commerce, and arts.
                </p>
                <Link
                  to="/mentors"
                  id="mentor-cta"
                  className="btn-outline px-10 py-3 text-sm inline-block"
                >
                  Browse All Mentors →
                </Link>
              </div>

              {/* Retry / redo */}
              <div className="flex justify-center gap-4 text-sm">
                <button
                  onClick={fetchGuidance}
                  className="text-gray-500 hover:text-saffron transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
                <span className="text-gray-700">·</span>
                <Link to="/onboarding" className="text-gray-500 hover:text-white transition-colors">
                  Change My Answers
                </Link>
              </div>

              <p className="text-center text-gray-700 text-xs">
                {result.grounded
                  ? 'College and scholarship data sourced from our curated database. Costs are estimates — verify directly with each institution before applying.'
                  : 'Results generated by Groq AI. College names and costs may not be accurate — always verify directly with institutions before applying.'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
