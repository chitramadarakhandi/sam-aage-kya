import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null) // students row

  useEffect(() => {
    // Check if there is a stored demo session first — but only use it if
    // there is NOT also a real Supabase session. A stale demo flag left
    // over from a previous "Demo Sandbox Bypass" click must never shadow a
    // real logged-in account (that was causing every mentor to see demo
    // data instead of their own).
    const storedDemo = localStorage.getItem('aageKyaDemoSession')
    if (storedDemo) {
      supabase.auth.getSession().then(({ data: { session: realSession } }) => {
        if (realSession?.user) {
          // A real session exists — the demo flag is stale, drop it and use the real one.
          localStorage.removeItem('aageKyaDemoSession')
          setSession(realSession)
          setUser(realSession.user)
          fetchProfile(realSession.user.id, realSession.user)
          setLoading(false)
          return
        }
        try {
          const { demoSession, demoProfile } = JSON.parse(storedDemo)
          setSession(demoSession)
          setUser(demoSession.user)
          setProfile(demoProfile)
        } catch (err) {
          console.error('Failed to parse demo session', err)
          localStorage.removeItem('aageKyaDemoSession')
        }
        setLoading(false)
      })
      return
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (localStorage.getItem('aageKyaDemoSession')) return

        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id, session.user)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, sessionUser) {
    let { data } = await supabase
      .from('students')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!data && sessionUser) {
      const userType = sessionUser.user_metadata?.user_type || 'class12'
      let role = 'student'
      let class_level = 'class12'
      if (userType === 'class10') {
        role = 'student'
        class_level = 'class10'
      } else if (userType === 'other') {
        role = 'other'
        class_level = 'other'
      } else if (userType === 'admin') {
        role = 'admin'
        class_level = 'other'
      } else if (userType === 'mentor') {
        role = 'mentor'
        class_level = 'other'
      }

      let { data: insertedData, error } = await supabase
        .from('students')
        .insert({
          id: userId,
          role,
          class_level,
          full_name: '',
        })
        .select()
        .maybeSingle()

      if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('class_level'))) {
        const { data: retryData, error: retryError } = await supabase
          .from('students')
          .insert({
            id: userId,
            role,
            full_name: '',
          })
          .select()
          .maybeSingle()
        insertedData = retryData
        error = retryError
      }

      if (!error && insertedData) {
        data = insertedData
      }
    }
    setProfile(data)
  }

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem('aageKyaDemoSession')
    localStorage.removeItem('aageKyaRoadmap')
    localStorage.removeItem('aageKyaResult')
    localStorage.removeItem('aageKyaFormData')
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  function loginAsDemo(role, customEmail, classLevel = 'class12') {
    const emailVal = customEmail || (
      role === 'admin' ? 'demo-admin@aagekya.com' :
      role === 'mentor' ? 'demo-mentor@aagekya.com' :
      'demo-student@aagekya.com'
    )
    const demoSession = {
      access_token: role === 'admin' ? 'demo-admin-token' : role === 'mentor' ? 'demo-mentor-token' : 'demo-student-token',
      user: {
        id: role === 'admin' ? '00000000-0000-0000-0000-000000000002' :
            role === 'mentor' ? '00000000-0000-0000-0000-000000000003' :
            '00000000-0000-0000-0000-000000000001',
        email: emailVal,
        user_metadata: { user_type: role }
      }
    }
    const demoProfile = {
      id: demoSession.user.id,
      role: role,
      full_name: role === 'admin' ? 'Demo Admin' :
                 role === 'mentor' ? 'Demo Mentor' :
                 (emailVal.split('@')[0] || 'Demo Student'),
      class_level: classLevel,
    }
    setSession(demoSession)
    setUser(demoSession.user)
    setProfile(demoProfile)
    localStorage.setItem('aageKyaDemoSession', JSON.stringify({ demoSession, demoProfile }))
  }

  async function refreshProfile() {
    if (user && !localStorage.getItem('aageKyaDemoSession')) {
      await fetchProfile(user.id)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, signOut, refreshProfile, loginAsDemo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
