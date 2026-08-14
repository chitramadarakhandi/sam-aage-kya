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
    // SECURITY: a brand-new account is ALWAYS created as a plain 'student'
    // from the client, regardless of what user_metadata.user_type says.
    // user_metadata is client-controlled at signup time — trusting it for
    // role would let anyone self-grant 'admin' or 'mentor' access. Mentor
    // access is only ever granted server-side (via an approved
    // mentor_applications row, checked further below); admin access is
    // never grantable through this signup path at all.
    const userType = sessionUser.user_metadata?.user_type || 'class12'
    const role = 'student'
    let class_level = 'class12'
    if (userType === 'class10') {
      class_level = 'class10'
    } else if (userType === 'other' || userType === 'mentor' || userType === 'admin') {
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

  // ─── Multi-role support ──────────────────────────────────────────────────
  // One Supabase Auth account (one email) can be BOTH a student and a
  // mentor. We no longer overwrite `students.role` when a mentor link is
  // found — instead we compute the full set of roles this account currently
  // holds and attach it as `data.roles` (e.g. ['student'], ['mentor'],
  // ['student', 'mentor']). `data.role` is left untouched as the account's
  // base/default role (almost always 'student', or 'admin').
  //
  // `data.mentorStatus` is one of:
  //   null        — never applied to be a mentor
  //   'pending'   — applied, awaiting admin review
  //   'rejected'  — application was rejected (rejectionReason may be set)
  //   'approved'  — approved AND linked to a mentors row (full mentor access)
  const roles = new Set()
  let mentorStatus = null
  let mentorRejectionReason = null
  let mentorApplicationEmail = null

  if (data) {
    if (data.role === 'admin') {
      roles.add('admin')
    } else {
      roles.add('student')
    }

    if (accessToken) {
      try {
        const res = await getMentorWorkspace(accessToken)
        if (res.ok) {
          const { application, mentor } = await res.json()
          if (mentor) {
            // Linked to an approved mentor profile — full mentor access.
            roles.add('mentor')
            mentorStatus = 'approved'
          } else if (application) {
            mentorStatus = application.status || 'pending'
            mentorRejectionReason = application.rejection_reason || null
            mentorApplicationEmail = application.email || null
          }
        }
      } catch {
        // Network hiccup — fall back to student-only rather than blocking sign-in.
      }
    }
  }

  return data
    ? { ...data, roles: Array.from(roles), mentorStatus, mentorRejectionReason, mentorApplicationEmail }
    : data
}
