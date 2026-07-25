import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation, Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import {
  Spinner,
  NoApiKey,
  ErrorCard,
  ProfileStrip,
} from './Result'
import { postRoadmap } from '../api'

// ─── Backend API call ─────────────────────────────────────────────────────────

async function callGeminiRoadmap(form, option) {
  const { data: { session } } = await supabase.auth.getSession()

  const res = await postRoadmap(form, option, session?.access_token)

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

// ─── Main Roadmap Page Component ──────────────────────────────────────────────

export default function Roadmap() {
  const { classLevel = 'class12' } = useParams()
  const { state } = useLocation()
  
  // Try reading from Router state; fallback to localStorage.
  // Memoised so it doesn't create a new object every render (keeps useCallback stable).
  const formData = useMemo(() => {
    const savedFormRaw = localStorage.getItem('aageKyaFormData')
    const rawForm = state?.formData ?? (savedFormRaw ? JSON.parse(savedFormRaw) : null)
    return rawForm ? { ...rawForm, classLevel: rawForm.classLevel || classLevel } : null
  }, [state?.formData, classLevel])

  const selectedOption = state?.option

  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [status, setStatus] = useState('idle') // idle | loading | success | error | no_key
  const [roadmap, setRoadmap] = useState(null)
  const [errorMsg, setErrMsg] = useState('')
  const [optionName, setOptionName] = useState(selectedOption?.path || '')

  // Gate form state for Magic Link sign in
  const [authEmail, setAuthEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authSuccess, setAuthSuccess] = useState(false)
  const [authError, setAuthError] = useState('')

  // Load checkboxes state from localStorage so achievements are saved
  const [checkedMilestones, setCheckedMilestones] = useState(() => {
    const saved = localStorage.getItem('aageKyaCheckedMilestones')
    return saved ? JSON.parse(saved) : {}
  })

  // Listen to Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setSessionLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleMilestoneToggle = (year, index) => {
    const key = `${year}-${index}`
    setCheckedMilestones((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('aageKyaCheckedMilestones', JSON.stringify(next))
      return next
    })
  }

  // Trigger Magic Link Send
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    if (!authEmail.trim()) return

    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess(false)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail,
        options: {
          emailRedirectTo: window.location.origin + '/roadmap', // redirects directly back here
        },
      })

      if (error) throw error
      setAuthSuccess(true)
    } catch (err) {
      console.error('Gate Auth Error:', err.message)
      setAuthError(err.message || 'Failed to send login link.')
    } finally {
      setAuthLoading(false)
    }
  }

  const fetchRoadmap = useCallback(async () => {
    if (!formData || !session) return
    if (!selectedOption && !localStorage.getItem('aageKyaRoadmap')) return
    
    // Check if we have cached roadmap for THIS specific option
    const cachedRoadmapRaw = localStorage.getItem('aageKyaRoadmap')
    if (cachedRoadmapRaw) {
      const cached = JSON.parse(cachedRoadmapRaw)
      // If we clicked a specific option and it matches cached, OR if we refreshed (no selectedOption in state)
      if (!selectedOption || cached.optionPath === selectedOption.path) {
        setRoadmap(cached.roadmapData)
        setOptionName(cached.optionPath)
        setStatus('success')
        return
      }
    }

    // Otherwise, generate a new roadmap
    if (!selectedOption) return // Safety check

    setStatus('loading')
    setRoadmap(null)
    setErrMsg('')
    
    try {
      const data = await callGeminiRoadmap(formData, selectedOption)
      setRoadmap(data)
      setOptionName(selectedOption.path)
      
      // Cache the result in localStorage
      localStorage.setItem(
        'aageKyaRoadmap',
        JSON.stringify({
          optionPath: selectedOption.path,
          formData,
          roadmapData: data,
        })
      )
      setStatus('success')
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        setStatus('no_key')
      } else {
        setErrMsg(err.message)
        setStatus('error')
      }
    }
  }, [formData, selectedOption, session])

  useEffect(() => {
    if (session) {
      fetchRoadmap()
    }
  }, [session, fetchRoadmap])

  // Handle case where there's no form data at all
  if (!formData) {
    return (
      <main className="pt-24 pb-24 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto text-center py-20">
          <div className="glass-card p-10">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">No profile found</h2>
            <p className="text-gray-400 mb-8">Fill in your profile form first to get structured career roadmaps.</p>
            <Link to="/onboarding" className="btn-primary px-8 py-4 text-base inline-block">
              Start the Form →
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Handle case where page is refreshed but no roadmap is stored in localStorage
  const hasCachedRoadmap = localStorage.getItem('aageKyaRoadmap')
  if (!selectedOption && !hasCachedRoadmap && status !== 'loading' && session) {
    return (
      <main className="pt-24 pb-24 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-3xl mx-auto text-center py-20">
          <div className="glass-card p-10">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">No career selected</h2>
            <p className="text-gray-400 mb-8">Choose one of your recommended career options to view its detailed timeline.</p>
            <Link to="/result" className="btn-primary px-8 py-4 text-base inline-block">
              View My Results →
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="pt-24 pb-24 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Navigation header */}
        <div className="mb-6 flex justify-between items-center">
          <Link
            to={`/${formData?.classLevel || 'class12'}/result`}
            className="text-sm text-gray-400 hover:text-saffron transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Guidance
          </Link>
          
          <button
            onClick={() => window.print()}
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h8z" />
            </svg>
            Print / Save PDF
          </button>
        </div>

        {/* Page title */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">
              {formData?.classLevel === 'class10' ? '4-Year High School & Early College Roadmap' : '4-Year Learning & Skill Pathway'}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Your Roadmap for <br />
            <span className="gradient-text">{optionName || selectedOption?.path}</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            {formData?.classLevel === 'class10'
              ? 'A year-by-year stream and skill preparation roadmap tailored to your background, coaching access, and goals.'
              : 'A semester-by-semester build-up tailored to your background, finances, and goals.'}
          </p>
        </div>

        {/* Profile details */}
        {formData && <ProfileStrip form={formData} />}

        {/* ── States ── */}

        {/* Loading Session */}
        {sessionLoading && <Spinner />}

        {/* Not Logged In - Auth Gate Modal-Card */}
        {!sessionLoading && !session && (
          <div className="glass-card p-8 text-center border-saffron/20 max-w-md mx-auto animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-saffron/10 border border-saffron/25 flex items-center justify-center text-3xl mx-auto mb-4">
              🔒
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Unlock Your Roadmap</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Enter your email below. We&apos;ll send a secure login link to your inbox. Verification saves your progress and displays your 4-year timeline.
            </p>

            {!authSuccess ? (
              <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
                {authError && (
                  <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-rose-300 text-xs">
                    ⚠️ {authError}
                  </div>
                )}
                <div>
                  <label htmlFor="gate-email" className="block text-xs font-semibold text-gray-300 mb-1.5">Email Address</label>
                  <input
                    id="gate-email"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full bg-navy-800 border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm outline-none focus:ring-2 focus:ring-saffron/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2"
                >
                  {authLoading ? 'Sending Link...' : 'Unlock 4-Year Roadmap →'}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl mx-auto mb-3">
                  ✅
                </div>
                <p className="text-white font-medium text-sm">Link Sent Successfully!</p>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                  We sent a magic link to <span className="text-white font-semibold">{authEmail}</span>. Check your inbox (or spam) to log in instantly.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Logged In - Timeline Flow */}
        {!sessionLoading && session && (
          <>
            {/* Loading AI response */}
            {status === 'loading' && <Spinner />}

            {/* No API key */}
            {status === 'no_key' && <NoApiKey />}

            {/* Error */}
            {status === 'error' && (
              <ErrorCard message={errorMsg} onRetry={fetchRoadmap} />
            )}

            {/* Success timeline */}
            {status === 'success' && roadmap && (
              <div className="space-y-12">
                
                {/* Overview / Introduction */}
                <div
                  className="relative overflow-hidden rounded-2xl p-7 mb-4 animate-slide-up"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(15,23,42,0.8) 100%)',
                    border: '1px solid rgba(255,107,0,0.2)',
                  }}
                >
                  <div className="flex gap-3">
                    <span className="text-2xl mt-0.5">🗺️</span>
                    <div>
                      <h3 className="font-display font-semibold text-white mb-1">Path Strategy Overview</h3>
                      <p className="text-gray-300 text-sm leading-relaxed">{roadmap.overview}</p>
                    </div>
                  </div>
                </div>

                {/* Vertical timeline */}
                <div className="relative border-l-2 border-dashed border-white/10 ml-6 pl-8 space-y-10 py-2">
                  {roadmap.years.map((yearData, idx) => {
                    const yearColors = [
                      { border: 'hover:border-blue-500/30', accent: 'text-blue-400', bg: 'bg-blue-500/10' },
                      { border: 'hover:border-purple-500/30', accent: 'text-purple-400', bg: 'bg-purple-500/10' },
                      { border: 'hover:border-emerald-500/30', accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { border: 'hover:border-saffron/30', accent: 'text-saffron', bg: 'bg-saffron/10' }
                    ]
                    const color = yearColors[idx] || yearColors[0]

                    return (
                      <div
                        key={yearData.year}
                        className="relative group animate-slide-up"
                        style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                      >
                        {/* Node on the line */}
                        <div
                          className={`absolute -left-[57px] top-1.5 w-14 h-14 rounded-2xl bg-navy-800 border-2 border-white/15 flex flex-col items-center justify-center font-display font-bold text-xs text-gray-400 transition-all duration-300 group-hover:border-saffron group-hover:bg-saffron/10 group-hover:text-saffron shadow-lg shadow-black/40`}
                        >
                          {formData?.classLevel === 'class10' ? (
                            <>
                              <span className="text-[9px] uppercase font-semibold text-gray-500 group-hover:text-saffron/80">
                                {yearData.year === 1 ? 'Class' : yearData.year === 2 ? 'Class' : 'College'}
                              </span>
                              <span className="text-sm leading-none mt-0.5 font-extrabold">
                                {yearData.year === 1 ? '11' : yearData.year === 2 ? '12' : `Yr ${yearData.year - 2}`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] uppercase font-semibold text-gray-500 group-hover:text-saffron/80">Year</span>
                              <span className="text-lg leading-none mt-0.5">{yearData.year}</span>
                            </>
                          )}
                        </div>

                        {/* Glass card content */}
                        <div className={`glass-card p-6 md:p-8 ${color.border}`}>
                          {/* Year Focus */}
                          <div className="mb-5">
                            <span className={`text-[10px] font-bold tracking-wider uppercase ${color.accent} bg-white/5 border border-white/10 px-2.5 py-1 rounded-md mb-2 inline-block`}>
                              Theme & Focus
                            </span>
                            <h3 className="font-display font-bold text-xl text-white leading-snug mt-1">
                              {yearData.focus}
                            </h3>
                          </div>

                          {/* Timeline categories grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/5">
                            
                            {/* Skills */}
                            <div>
                              <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span>🛠️</span> Skills to Master
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {(yearData.skills || []).map((skill, i) => (
                                  <span
                                    key={i}
                                    className="bg-navy-800/80 border border-white/8 hover:border-saffron/20 text-gray-300 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Certifications */}
                            <div>
                              <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span>📜</span> Certifications
                              </h4>
                              <ul className="space-y-1.5">
                                {(yearData.certifications || []).map((cert, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
                                    <span className="text-saffron mt-0.5 text-xs flex-shrink-0">▸</span>
                                    <span>{cert}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Projects & Internships */}
                            <div>
                              <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span>💼</span> Projects & Internships
                              </h4>
                              <ul className="space-y-1.5">
                                {(yearData.internships_projects || []).map((proj, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed font-medium">
                                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">⚡</span>
                                    <span>{proj}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Milestones / Checklist */}
                            <div>
                              <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span>🎯</span> Year-End Milestones
                              </h4>
                              <ul className="space-y-2">
                                {(yearData.milestones || []).map((milestone, i) => {
                                  const isChecked = !!checkedMilestones[`${yearData.year}-${i}`]
                                  return (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none"
                                      onClick={() => handleMilestoneToggle(yearData.year, i)}
                                    >
                                      <div className="pt-0.5 flex-shrink-0">
                                        <div
                                          className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                                            isChecked
                                              ? 'bg-saffron border-saffron text-white'
                                              : 'border-white/20 bg-navy hover:border-saffron/60'
                                          }`}
                                        >
                                          {isChecked && (
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                      </div>
                                      <span className={isChecked ? 'line-through text-gray-500' : 'text-gray-300'}>
                                        {milestone}
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>

                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Bottom Actions CTA */}
                <div className="glass-card p-8 text-center border-saffron/20 mt-10">
                  <p className="text-white text-lg mb-2 font-medium">
                    Want to know how to execute this path?
                  </p>
                  <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                    Book a call with a mentor who did engineering, design, or commerce, and get advice on how to start learning.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      to="/mentors"
                      className="btn-primary px-8 py-3.5 text-sm"
                    >
                      Talk to a Mentor →
                    </Link>
                    <Link
                      to="/result"
                      className="btn-outline px-8 py-3.5 text-sm"
                    >
                      Change Career Option
                    </Link>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
