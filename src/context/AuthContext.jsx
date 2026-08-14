import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { resolveProfileAndRole } from '../authRoleResolver'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null) // students row, includes derived .roles (see authRoleResolver)

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user, session.access_token)
      setLoading(false)
    })

    // Listen for auth changes (magic link click, password sign-in, sign out).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Flag a fresh sign-in (magic link click or a brand-new tab picking
        // up a password sign-in) so a one-time post-login redirect/role-picker
        // can run once profile.roles is available — see PostLoginRedirect in
        // App.jsx. Cleared once that redirect has happened.
        if (event === 'SIGNED_IN') {
          sessionStorage.setItem('aageKyaJustSignedIn', '1')
        }
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id, session.user, session.access_token)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, sessionUser, accessToken) {
    const data = await resolveProfileAndRole(userId, sessionUser, accessToken)
    setProfile(data)
  }

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem('aageKyaRoadmap')
    localStorage.removeItem('aageKyaResult')
    localStorage.removeItem('aageKyaFormData')
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id, user, session?.access_token)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
