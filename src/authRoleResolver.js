import { supabase } from './supabaseClient'
import { getMentorWorkspace } from './api'

// ─── Shared post-login profile + mentor auto-link resolver ────────────────────
// Used by both AuthContext (magic-link / session-restore path) and AuthModal
// (email+password sign-in path) so they never disagree about a user's role.
//
// Why this exists: an approved mentor's `students.role` starts out as
// 'student' (or whatever they signed up as) and only ever gets flipped to
// 'mentor' server-side inside GET /api/mentor/workspace, once it matches
// their email to an approved mentor_applications row. Previously that
// endpoint was only ever called from inside the MentorDashboard page itself
// — but nothing routed a freshly-logged-in mentor there (the nav bar and the
// password sign-in redirect both read the still-stale 'student' role first),
// so real mentors could never reach the page that would fix their own role.
// Calling the same auto-link check immediately after login breaks that loop.
export async function resolveProfileAndRole(userId, sessionUser, accessToken) {
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
      .insert({ id: userId, role, class_level, full_name: '' })
      .select()
      .maybeSingle()

    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('class_level'))) {
      const { data: retryData, error: retryError } = await supabase
        .from('students')
        .insert({ id: userId, role, full_name: '' })
        .select()
        .maybeSingle()
      insertedData = retryData
      error = retryError
    }

    if (!error && insertedData) {
      data = insertedData
    }
  }

  // Auto-claim: if this email has an approved mentor application, the
  // workspace endpoint links the mentors row and flips students.role to
  // 'mentor' server-side. Run it right after login — not only once the user
  // is already on /mentor-dashboard — so routing and nav reflect it right away.
  if (accessToken && data && data.role !== 'admin') {
    try {
      const res = await getMentorWorkspace(accessToken)
      if (res.ok) {
        const { mentor } = await res.json()
        if (mentor && data.role !== 'mentor') {
          data = { ...data, role: 'mentor' }
        }
      }
    } catch {
      // Network hiccup — fall back to whatever role we already have rather
      // than blocking sign-in on this best-effort check.
    }
  }

  return data
}
