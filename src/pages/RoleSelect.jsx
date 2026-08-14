import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ─── Role picker ────────────────────────────────────────────────────────────
// Shown right after a real sign-in when a single account holds more than one
// role (e.g. it's both a student and an approved mentor). The same email/
// password or magic link signs in to ONE Supabase Auth account — this page
// just lets that account choose which dashboard to enter, instead of the app
// silently guessing (which previously meant a mentor could get stuck seeing
// only their student view, or vice versa).
export default function RoleSelect() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()

  const roles = profile?.roles || []
  const rolesKey = roles.join(',')

  useEffect(() => {
    if (loading) return
    if (!user) { navigate('/'); return }
    // Nothing to choose — bounce straight to the single dashboard this
    // account has, so this page never becomes a dead end for single-role users.
    if (roles.length <= 1) {
      if (roles.includes('admin')) navigate('/admin-dashboard', { replace: true })
      else if (roles.includes('mentor')) navigate('/mentor-dashboard', { replace: true })
      else navigate('/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, rolesKey, navigate])

  if (loading || !user || roles.length <= 1) {
    return (
      <main className="pt-24 pb-16 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="pt-24 pb-16 min-h-screen px-4 sm:px-6 lg:px-8 font-sans flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div className="text-4xl mb-4">👋</div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">Welcome back!</h1>
        <p className="text-gray-400 text-sm mb-8">
          This account is set up as both a student and a mentor. Which dashboard would you like to open?
        </p>

        <div className="space-y-3">
          {roles.includes('student') && (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full glass-card border-white/10 hover:border-saffron/40 p-5 flex items-center gap-4 text-left transition-all"
            >
              <span className="text-3xl flex-shrink-0">🎓</span>
              <div>
                <p className="text-white font-semibold text-sm">Student Dashboard</p>
                <p className="text-gray-500 text-xs mt-0.5">Your guidance, roadmap, and mentor conversations.</p>
              </div>
            </button>
          )}
          {roles.includes('mentor') && (
            <button
              onClick={() => navigate('/mentor-dashboard')}
              className="w-full glass-card border-white/10 hover:border-saffron/40 p-5 flex items-center gap-4 text-left transition-all"
            >
              <span className="text-3xl flex-shrink-0">🌟</span>
              <div>
                <p className="text-white font-semibold text-sm">Mentor Dashboard</p>
                <p className="text-gray-500 text-xs mt-0.5">Student questions and booking requests sent to you.</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
