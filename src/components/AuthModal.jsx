import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { resolveProfileAndRole } from '../authRoleResolver'

const TABS = [
  { id: 'password', label: 'Email & Password' },
  { id: 'magic',    label: 'Magic Link' },
]

const LOGIN_AS_OPTIONS = [
  { id: 'student', label: 'Student', icon: '🎓' },
  { id: 'mentor',  label: 'Mentor',  icon: '🧭' },
  { id: 'admin',   label: 'Admin',   icon: '🔑' },
]

// "Login as" is ONLY a routing hint for where to land after a real sign-in —
// it never grants a role. The actual roles an account holds (student,
// mentor, admin) are always resolved server-side via resolveProfileAndRole,
// which checks the students table and the mentor-linking/approval workflow.
// Picking "Admin" or "Mentor" here does nothing by itself; see
// resolvePostLoginDestination below for how a mismatch is handled.
function resolvePostLoginDestination(profile, loginAs) {
  const roles = profile?.roles || []

  if (loginAs === 'admin') {
    return roles.includes('admin') ? '/admin-dashboard' : { error: "This account doesn't have admin access." }
  }
  if (loginAs === 'mentor') {
    // MentorDashboard itself shows "apply to mentor" / "pending approval"
    // screens for an account with no approved mentor link yet, so it's safe
    // to always route here rather than erroring — matches how the mentor
    // dashboard already communicates status.
    return '/mentor-dashboard'
  }
  // loginAs === 'student' (or unset): respect the explicit choice, but if
  // the account also holds other roles, offer the picker instead of hiding them.
  if (roles.length > 1) return '/choose-role'
  if (roles.includes('admin')) return '/admin-dashboard'
  if (roles.includes('mentor')) return '/mentor-dashboard'
  return '/dashboard'
}

export default function AuthModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [tab, setTab]           = useState('password')   // 'password' | 'magic'
  const [mode, setMode]         = useState('signin')     // 'signin' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loginAs, setLoginAs]   = useState('student')   // routing hint only — see resolvePostLoginDestination
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const reset = () => {
    setEmail(''); setPassword(''); setConfirm(''); setLoginAs('student')
    setErrorMsg(''); setSuccess(false); setSuccessMsg('')
    setLoading(false)
  }

  const switchTab = (t) => { reset(); setTab(t) }
  const switchMode = (m) => { reset(); setMode(m) }

  // ── Handlers ──────────────────────────────────────────────
  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email.trim()) return setErrorMsg('Please enter your email.')
    setLoading(true); setErrorMsg('')
    // Stash the routing hint so PostLoginRedirect (App.jsx) can honor it once
    // the magic link is clicked and the account's real roles are known —
    // this never grants a role, it only decides where to land afterward.
    sessionStorage.setItem('aageKyaLoginAs', loginAs)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
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
    if (!email.trim() || !password)
      return setErrorMsg('Please fill in all fields.')

    if (mode === 'signup') {
      if (password.length < 6)
        return setErrorMsg('Password must be at least 6 characters.')
      if (password !== confirm)
        return setErrorMsg('Passwords do not match.')
    }

    setLoading(true)
    // IMPORTANT: everything below must run inside try/finally. This modal
    // component doesn't unmount when closed (isOpen just hides it), so its
    // state — including `loading` — persists across opens. An uncaught
    // error here (e.g. a network hiccup while resolving roles) used to skip
    // setLoading(false) entirely, leaving the button stuck on "Signing
    // in..." forever, even the next time the modal was reopened with a
    // blank form. The finally block guarantees loading is always cleared.
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) { setErrorMsg(error.message); return }
        setSuccess(true)
        setSuccessMsg(`Account created! Check ${email} for a confirmation link.`)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setErrorMsg(error.message); return }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session: activeSession } } = await supabase.auth.getSession()
      if (!user) { onClose(); return }

      // Resolve the full set of roles this account holds (student, mentor,
      // admin) the same way AuthContext does — this also runs the mentor
      // auto-link check (matches this email to an approved mentor
      // application), so a real mentor lands on their own dashboard on the
      // very first sign-in.
      const dbProfile = await resolveProfileAndRole(user.id, user, activeSession?.access_token)
      const destination = resolvePostLoginDestination(dbProfile, loginAs)
      if (typeof destination === 'object') {
        // "Login as Admin" chosen but this account isn't actually an
        // admin — say so plainly instead of silently signing them in
        // somewhere they didn't ask for.
        setErrorMsg(destination.error)
        return
      }
      onClose()
      navigate(destination)
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
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
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 text-rose-300 text-xs mb-4 leading-relaxed">
                  ⚠️ {errorMsg}
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
                  <LoginAsPicker loginAs={loginAs} setLoginAs={setLoginAs} onClose={onClose} />
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
                    <p className="text-gray-500 text-[10px] leading-relaxed">
                      Every account starts as a student. Approved mentors automatically get mentor access on the same account — no separate signup needed.
                      Want to become a mentor? <Link to="/mentor-apply" onClick={onClose} className="text-saffron hover:underline">Apply here</Link>.
                    </p>
                  )}

                  {mode === 'signin' && (
                    <LoginAsPicker loginAs={loginAs} setLoginAs={setLoginAs} onClose={onClose} />
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── "Login as" selector ────────────────────────────────────────────────────
// Purely a routing hint — see resolvePostLoginDestination above. Choosing
// "Mentor" or "Admin" here never grants that access; it only tells the app
// where to try to land you after your REAL identity/role has been verified
// server-side. An account without that role gets a clear message instead.
function LoginAsPicker({ loginAs, setLoginAs, onClose }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-300 mb-1.5">Login as</label>
      <div className="grid grid-cols-3 gap-2">
        {LOGIN_AS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLoginAs(opt.id)}
            className={`p-3 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
              loginAs === opt.id
                ? 'bg-saffron/15 border-saffron text-white ring-2 ring-saffron/20'
                : 'bg-[#111827]/60 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200'
            }`}
          >
            <span className="text-xl">{opt.icon}</span>
            <span className="text-[11px] font-bold tracking-tight">{opt.label}</span>
          </button>
        ))}
      </div>
      {loginAs === 'mentor' && (
        <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
          Only works if this email has an approved mentor application.
          Not a mentor yet? <Link to="/mentor-apply" onClick={onClose} className="text-saffron hover:underline">Apply here</Link>.
        </p>
      )}
      {loginAs === 'admin' && (
        <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed">
          Only works if this account already has admin access.
        </p>
      )}
    </div>
  )
}
