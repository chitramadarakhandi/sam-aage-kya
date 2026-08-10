import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { resolveProfileAndRole } from '../authRoleResolver'

const TABS = [
  { id: 'password', label: 'Email & Password' },
  { id: 'magic',    label: 'Magic Link' },
]

// Supabase's rate-limit error message text (matches both "email rate limit
// exceeded" and generic "too many requests" wording across API versions).
// Used to decide whether the demo-sandbox offer makes sense — it should
// NEVER be offered for a wrong password or unconfirmed email, since clicking
// it does not sign in to the real account; it loads a hardcoded demo profile.
function isRateLimitError(message) {
  const m = (message || '').toLowerCase()
  return m.includes('rate limit') || m.includes('too many requests')
}

export default function AuthModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { loginAsDemo } = useAuth()
  const [tab, setTab]           = useState('password')   // 'password' | 'magic'
  const [mode, setMode]         = useState('signin')     // 'signin' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [userType, setUserType] = useState('student')   // student | admin
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const handleDemoLogin = (role, classLevel = 'class12') => {
    loginAsDemo(role, email, classLevel)
    onClose()
    if (role === 'admin') {
      navigate('/admin-dashboard')
    } else if (role === 'mentor') {
      navigate('/mentor-dashboard')
    } else {
      navigate('/dashboard')
    }
  }

  const reset = () => {
    setEmail(''); setPassword(''); setConfirm(''); setUserType('student')
    setErrorMsg(''); setSuccess(false); setSuccessMsg('')
    setLoading(false)
  }

  const switchTab = (t) => { reset(); setTab(t) }
  const switchMode = (m) => { reset(); setMode(m) }

  // ── Handlers ──────────────────────────────────────────────
  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email.trim()) return setErrorMsg('Please enter your email.')
    // Clear any leftover demo session — otherwise AuthContext's auth-state
    // listener ignores real sign-ins while this flag is present, and the
    // user keeps seeing demo/sandbox data instead of their real account.
    localStorage.removeItem('aageKyaDemoSession')
    setLoading(true); setErrorMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { user_type: userType }
      },
    })
    setLoading(false)
    if (error) return setErrorMsg(error.message)
    setSuccess(true)
    setSuccessMsg(`Magic link sent to ${email}. Click it to log in!`)
  }

  const handleEmailPassword = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    // Clear any leftover demo session — otherwise AuthContext's auth-state
    // listener ignores real sign-ins while this flag is present, and the
    // user keeps seeing demo/sandbox data instead of their real account.
    localStorage.removeItem('aageKyaDemoSession')
    if (!email.trim() || !password)
      return setErrorMsg('Please fill in all fields.')

    if (mode === 'signup') {
      if (password.length < 6)
        return setErrorMsg('Password must be at least 6 characters.')
      if (password !== confirm)
        return setErrorMsg('Passwords do not match.')
    }

    setLoading(true)
    let error
    if (mode === 'signup') {
      const { error: e } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { user_type: userType }
        },
      })
      error = e
      if (!error) {
        setSuccess(true)
        setSuccessMsg(`Account created! Check ${email} for a confirmation link.`)
      }
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password })
      error = e
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: { session: activeSession } } = await supabase.auth.getSession()
        if (user) {
          // Resolve role the same way AuthContext does — this also runs the
          // mentor auto-link check (matches this email to an approved mentor
          // application), so a real mentor lands on their own dashboard on
          // the very first sign-in instead of getting stuck on 'student'
          // because that link previously only ran once already inside
          // /mentor-dashboard.
          const dbProfile = await resolveProfileAndRole(user.id, user, activeSession?.access_token)

          const userRole = dbProfile?.role || 'student'
          onClose()
          if (userRole === 'admin') {
            navigate('/admin-dashboard')
          } else if (userRole === 'mentor') {
            navigate('/mentor-dashboard')
          } else {
            navigate('/dashboard')
          }
        } else {
          onClose()
        }
        return
      }
    }
    setLoading(false)
    if (error) setErrorMsg(error.message)
  }

  // ── Spinner ────────────────────────────────────────────────
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )

  const inputClass = "w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/30"

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="relative w-full max-w-md animate-scale-in">

        {/* Card */}
        <div className="glass-card border-white/10 p-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-saffron/50 to-transparent" />

          {/* Close */}
          <button
            onClick={() => { reset(); onClose() }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Success state */}
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-4xl mx-auto mb-4">
                ✉️
              </div>
              <h2 className="font-display text-2xl font-bold text-white mb-2">Check your email!</h2>
              <p className="text-gray-300 text-sm leading-relaxed max-w-xs mx-auto mb-6">{successMsg}</p>
              <button onClick={() => { reset(); onClose() }} className="btn-primary px-8 py-3 text-sm">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-saffron/10 border border-saffron/30 flex items-center justify-center text-2xl mx-auto mb-3">
                  {mode === 'signup' ? '🚀' : '✨'}
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-gray-400 text-sm mt-1">Save your results &amp; chat with mentors</p>
              </div>

              {/* Tab switcher */}
              <div className="flex bg-white/5 rounded-xl p-1 mb-5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => switchTab(t.id)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      tab === t.id
                        ? 'bg-saffron text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 text-rose-300 text-xs mb-4 leading-relaxed flex flex-col gap-2">
                  <span>⚠️ {errorMsg}</span>
                  {/* Only offer the demo sandbox for an ACTUAL rate-limit error.
                      Showing it for wrong-password/unconfirmed-email errors made
                      it look like "sign in instantly as me", but it logs into a
                      hardcoded fake account with the same demo data every time —
                      never your real mentor profile. */}
                  {isRateLimitError(errorMsg) && email.trim() && (
                    <button
                      type="button"
                      onClick={() => handleDemoLogin(userType)}
                      className="mt-1 text-left text-saffron hover:underline font-bold"
                    >
                      ⚡ Try the Demo Sandbox instead (not your real account) →
                    </button>
                  )}
                </div>
              )}

              {/* ── Magic Link Form ── */}
              {tab === 'magic' && (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email Address</label>
                    <input
                      type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. aditya@gmail.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">User Type</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {[
                        { id: 'student', label: 'Student', icon: '🎓' },
                        { id: 'mentor', label: 'Mentor', icon: '🧭' },
                        { id: 'admin', label: 'Admin', icon: '🔑' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setUserType(t.id)}
                          className={`p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                            userType === t.id
                              ? 'bg-saffron/15 border-saffron text-white ring-2 ring-saffron/20'
                              : 'bg-[#111827]/60 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200'
                          }`}
                        >
                          <span className="text-xl">{t.icon}</span>
                          <span className="text-[11px] font-bold tracking-tight">{t.label}</span>
                        </button>
                      ))}
                    </div>
                    {userType === 'mentor' && (
                      <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
                        Log in as a mentor to answer student questions and track your application status.
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm gap-2 disabled:opacity-60">
                    {loading ? <Spinner /> : null}
                    {loading ? 'Sending...' : 'Send Magic Link →'}
                  </button>
                  <p className="text-center text-gray-500 text-[10px]">
                    We'll email you a one-click login link. No password needed.
                  </p>
                </form>
              )}

              {/* ── Email + Password Form ── */}
              {tab === 'password' && (
                <form onSubmit={handleEmailPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email Address</label>
                    <input
                      type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. aditya@gmail.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">Password</label>
                    <input
                      type="password" required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                      className={inputClass}
                    />
                  </div>
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Confirm Password</label>
                      <input
                        type="password" required value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat your password"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">User Type</label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {[
                          { id: 'student', label: 'Student', icon: '🎓' },
                          { id: 'mentor', label: 'Mentor', icon: '🧭' },
                          { id: 'admin', label: 'Admin', icon: '🔑' },
                        ].map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setUserType(t.id)}
                            className={`p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                              userType === t.id
                                ? 'bg-saffron/15 border-saffron text-white ring-2 ring-saffron/20'
                                : 'bg-[#111827]/60 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200'
                            }`}
                          >
                            <span className="text-xl">{t.icon}</span>
                            <span className="text-[11px] font-bold tracking-tight">{t.label}</span>
                          </button>
                        ))}
                      </div>
                      {userType === 'mentor' && (
                        <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
                          Mentors answer student questions and get application updates in their dashboard.
                          Want to become one? <Link to="/mentor-apply" onClick={onClose} className="text-saffron hover:underline">Apply here</Link>.
                        </p>
                      )}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-sm gap-2 disabled:opacity-60">
                    {loading ? <Spinner /> : null}
                    {loading
                      ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
                      : (mode === 'signup' ? 'Create Account →' : 'Sign In →')
                    }
                  </button>

                  {/* Toggle signup/signin */}
                  <p className="text-center text-gray-500 text-xs">
                    {mode === 'signin' ? (
                      <>Don&apos;t have an account?{' '}
                      <button type="button" onClick={() => switchMode('signup')} className="text-saffron hover:underline font-semibold">
                        Sign up free
                      </button>
                      </>
                    ) : (
                      <>Already have an account?{' '}
                      <button type="button" onClick={() => switchMode('signin')} className="text-saffron hover:underline font-semibold">
                        Sign in
                      </button>
                      </>
                    )}
                  </p>
                </form>
              )}

              {/* Demo Login Options */}
              <div className="relative my-5 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <span className="relative z-10 px-3 bg-[#111827] text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Demo Sandbox (Sample Data — Not a Real Login)</span>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('student', 'class10')}
                    className="py-2.5 rounded-xl border border-white/10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-all duration-200"
                  >
                    🧪 Demo Student (10th)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('student', 'class12')}
                    className="py-2.5 rounded-xl border border-white/10 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-all duration-200"
                  >
                    🧪 Demo Student (12th)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('mentor')}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition-all duration-200"
                >
                  🧪 Demo Mentor (sample data, not your account)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
