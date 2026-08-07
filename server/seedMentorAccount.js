/**
 * Aage Kya? — Create a Mentor Login Account
 *
 * Creates a real email/password account you can use to log in as a mentor,
 * links it to a mentor profile (so student questions/bookings show up), and
 * sets the account's role to 'mentor'.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.
 *
 * Usage (from the project root or server/ folder):
 *   node server/seedMentorAccount.js
 *   node server/seedMentorAccount.js mentor@example.com MyPass123 "Arjun K."
 *
 * Args (all optional — defaults below are used if omitted):
 *   1. email     2. password     3. mentor name to link/create
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env'), override: true })

// ─── Configuration (edit these defaults or pass as CLI args) ──────────────────
const EMAIL    = process.argv[2] || 'mentor@aagekya.com'
const PASSWORD = process.argv[3] || 'Mentor@123'
const NAME     = process.argv[4] || 'Arjun K.'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || supabaseUrl.includes('your-supabase')) {
  console.error('❌ SUPABASE_URL is not configured in server/.env')
  process.exit(1)
}
if (!serviceRoleKey || serviceRoleKey.includes('your-supabase')) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not configured in server/.env')
  console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// A sensible default mentor profile (used only if one with NAME doesn't exist).
const DEFAULT_PROFILE = {
  name: NAME,
  initials: NAME.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 3) || 'M',
  college: 'Manipal University',
  degree: 'BBA + Certification Finance',
  stream: 'Commerce',
  stream_category: 'Commerce',
  city: 'Pune',
  linkedin: '',
  story: "Family wanted CA. I wanted something else. Here's how I navigated that conversation.",
  tags: ['Family pressure', 'Commerce', 'Non-CA path'],
  available: true,
}

async function main() {
  console.log(`\n🔧 Provisioning mentor login: ${EMAIL}\n`)

  // 1. Create (or find) the auth account, email pre-confirmed so it can log in now.
  let userId
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { user_type: 'mentor' },
  })

  if (createErr) {
    // Account may already exist — look it up instead.
    if (/already been registered|already exists/i.test(createErr.message)) {
      console.log('ℹ️  An account with that email already exists — reusing it.')
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = (list?.users || []).find((u) => (u.email || '').toLowerCase() === EMAIL.toLowerCase())
      if (!existing) throw new Error('Account exists but could not be found via listUsers().')
      userId = existing.id
      // Reset the password so the one you pass is guaranteed to work.
      await supabase.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true })
      console.log('🔑 Password reset to the provided value.')
    } else {
      throw createErr
    }
  } else {
    userId = created.user.id
    console.log('✅ Auth account created.')
  }

  // 2. Ensure a students row with role = 'mentor'.
  const { error: studErr } = await supabase
    .from('students')
    .upsert({ id: userId, role: 'mentor', full_name: NAME }, { onConflict: 'id' })
  if (studErr) console.warn('⚠️  students upsert warning:', studErr.message)
  else console.log("✅ Account role set to 'mentor'.")

  // 3. Find an existing mentor profile by name, else create one. Link user_id + email.
  const { data: existingMentor } = await supabase
    .from('mentors').select('id').eq('name', NAME).maybeSingle()

  if (existingMentor) {
    const { error } = await supabase
      .from('mentors').update({ user_id: userId, email: EMAIL }).eq('id', existingMentor.id)
    if (error) throw error
    console.log(`✅ Linked existing mentor profile "${NAME}" to this account.`)
  } else {
    const { error } = await supabase
      .from('mentors').insert({ ...DEFAULT_PROFILE, user_id: userId, email: EMAIL })
    if (error) throw error
    console.log(`✅ Created and linked a new mentor profile "${NAME}".`)
  }

  console.log('\n🎉 Done! You can now log in as a mentor:')
  console.log(`   Email:    ${EMAIL}`)
  console.log(`   Password: ${PASSWORD}`)
  console.log('   → Open the app, click Sign In, choose "Email & Password", and sign in.\n')
}

main().catch((err) => {
  console.error('\n❌ Failed:', err.message)
  process.exit(1)
})
