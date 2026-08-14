/**
 * Aage Kya? — Seed 3 low-friction test login accounts
 *
 * Creates one Student, one Mentor, and one Admin account directly via the
 * Supabase Admin API — emails are pre-confirmed, so no confirmation/magic
 * link email is ever sent and the Supabase Auth email rate limit never
 * applies to these. Use them for fast manual testing.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.
 *
 * Usage (from the server/ folder):
 *   node seedTestAccounts.js
 *
 * SECURITY: these are throwaway local test accounts with simple passwords.
 * Do not run this against a production Supabase project.
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env'), override: true })

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || supabaseUrl.includes('your-supabase')) {
  console.error('❌ SUPABASE_URL is not configured in server/.env')
  process.exit(1)
}
if (!serviceRoleKey || serviceRoleKey.includes('your-supabase')) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not configured in server/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const ACCOUNTS = {
  student: {
    email: 'test-student@aagekya.com',
    password: 'Student@123',
    fullName: 'Test Student',
  },
  mentor: {
    email: 'test-mentor@aagekya.com',
    password: 'Mentor@123',
    name: 'Test Mentor Seed',
    profile: {
      initials: 'TM',
      college: 'IIT Bombay',
      degree: 'B.Tech CSE',
      stream: 'Science (PCM)',
      stream_category: 'Science (PCM)',
      city: 'Mumbai',
      linkedin: '',
      story: 'Seeded test mentor account for local development.',
      tags: ['Engineering', 'Test Account'],
      available: true,
    },
  },
  admin: {
    email: 'test-admin@aagekya.com',
    password: 'Admin@123',
    fullName: 'Test Admin',
  },
}

// Create the auth user (or reuse + reset password if it already exists).
async function ensureAuthUser(email, password) {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pre-confirmed — no email is ever sent for this account
  })
  if (!createErr) return created.user.id

  if (/already been registered|already exists/i.test(createErr.message)) {
    const { data: list } = await supabase.auth.admin.listUsers()
    const existing = (list?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (!existing) throw new Error(`Account ${email} exists but could not be found via listUsers().`)
    await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    console.log(`   ℹ️  ${email} already existed — password reset to the seeded value.`)
    return existing.id
  }
  throw createErr
}

async function seedStudent() {
  const { email, password, fullName } = ACCOUNTS.student
  console.log(`\n🎓 Seeding student account: ${email}`)
  const userId = await ensureAuthUser(email, password)
  const { error } = await supabase
    .from('students')
    .upsert({ id: userId, role: 'student', full_name: fullName }, { onConflict: 'id' })
  if (error) throw error
  console.log('   ✅ Student account ready.')
}

async function seedAdmin() {
  const { email, password, fullName } = ACCOUNTS.admin
  console.log(`\n🔑 Seeding admin account: ${email}`)
  const userId = await ensureAuthUser(email, password)
  // role = 'admin' is set here via the service-role client, which the
  // protect_student_role DB trigger (if applied) explicitly allows —
  // clients can never self-grant this role, only this trusted server script can.
  const { error } = await supabase
    .from('students')
    .upsert({ id: userId, role: 'admin', full_name: fullName }, { onConflict: 'id' })
  if (error) throw error
  console.log('   ✅ Admin account ready.')
}

async function seedMentor() {
  const { email, password, name, profile } = ACCOUNTS.mentor
  console.log(`\n🧭 Seeding mentor account: ${email}`)
  const userId = await ensureAuthUser(email, password)

  // Keep students.role = 'student' (the default) — mentor access is granted
  // purely by linking a mentors row to this user_id, never by overwriting
  // role. This mirrors exactly how a real approved mentor account works.
  const { error: studErr } = await supabase
    .from('students')
    .upsert({ id: userId, role: 'student', full_name: name }, { onConflict: 'id' })
  if (studErr) throw studErr

  // An approved application record, so the admin dashboard and the mentor's
  // own "application status" banner show consistent, real data.
  const { data: existingApp } = await supabase
    .from('mentor_applications').select('id').eq('email', email).maybeSingle()
  if (!existingApp) {
    const { error } = await supabase.from('mentor_applications').insert({
      name, email, story: profile.story, status: 'approved',
      college: profile.college, degree: profile.degree,
    })
    if (error) console.warn('   ⚠️  mentor_applications insert warning:', error.message)
  }

  // The mentors row, linked directly to this account.
  const { data: existingMentor } = await supabase
    .from('mentors').select('id').eq('name', name).maybeSingle()
  if (existingMentor) {
    const { error } = await supabase
      .from('mentors').update({ user_id: userId, email }).eq('id', existingMentor.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('mentors').insert({ name, ...profile, user_id: userId, email })
    if (error) throw error
  }
  console.log('   ✅ Mentor account ready and linked to an approved mentor profile.')
}

async function main() {
  console.log('🔧 Seeding 3 test accounts (student, mentor, admin)...')
  await seedStudent()
  await seedMentor()
  await seedAdmin()

  console.log('\n🎉 Done! Test logins (Email & Password tab — no email ever sent):\n')
  console.log(`   Student  → ${ACCOUNTS.student.email} / ${ACCOUNTS.student.password}`)
  console.log(`   Mentor   → ${ACCOUNTS.mentor.email} / ${ACCOUNTS.mentor.password}`)
  console.log(`   Admin    → ${ACCOUNTS.admin.email} / ${ACCOUNTS.admin.password}`)
  console.log('\n   Use the "Login as" selector matching each account\'s role when signing in.\n')
}

main().catch((err) => {
  console.error('\n❌ Failed:', err.message)
  process.exit(1)
})
