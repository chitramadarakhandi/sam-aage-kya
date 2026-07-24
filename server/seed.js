/**
 * Aage Kya? — Database Seed Script (Phase 3 RAG Data)
 *
 * Seeds the `colleges` and `scholarships` reference tables in Supabase.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.
 *
 * Usage:
 *   cd server
 *   node seed.js
 *
 * To add more colleges: edit the COLLEGES array below.
 * To add more scholarships: edit the SCHOLARSHIPS array below.
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
  console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ─── COLLEGES DATA ────────────────────────────────────────────────────────────
// Fields:
//   name            — Official institution name (must be unique)
//   state           — Indian state / UT
//   city            — City where campus is located
//   streams         — Array of streams this institution serves:
//                     "Science (PCM)", "Science (PCB)", "Commerce", "Arts / Humanities"
//   min_marks       — Approximate minimum 12th % to be competitive (±10% buffer applied at query time)
//   max_marks       — Always 100
//   yearly_cost_min — Conservative estimate of annual cost in INR (tuition + hostel + misc)
//   yearly_cost_max — Upper estimate of annual cost in INR
//   college_type    — "central" | "state" | "private" | "deemed"
//   national        — true if institution accepts students from all states (JEE/NEET/national entrance)
//   source_url      — Official website or NIRF profile URL

const COLLEGES = [
  // ─── Science (PCM) — Engineering / Technology ────────────────────────────

  // Central / IITs (national, competitive, subsidised)
  { name: 'IIT Bombay',              state: 'Maharashtra',  city: 'Mumbai',          streams: ['Science (PCM)'], min_marks: 95, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 380000, college_type: 'central', national: true,  source_url: 'https://www.iitb.ac.in/' },
  { name: 'IIT Delhi',               state: 'Delhi',        city: 'Delhi',           streams: ['Science (PCM)'], min_marks: 95, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 375000, college_type: 'central', national: true,  source_url: 'https://home.iitd.ac.in/' },
  { name: 'IIT Madras',              state: 'Tamil Nadu',   city: 'Chennai',         streams: ['Science (PCM)'], min_marks: 95, max_marks: 100, yearly_cost_min: 255000, yearly_cost_max: 380000, college_type: 'central', national: true,  source_url: 'https://www.iitm.ac.in/' },
  { name: 'IIT Kanpur',              state: 'Uttar Pradesh',city: 'Kanpur',          streams: ['Science (PCM)'], min_marks: 93, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 370000, college_type: 'central', national: true,  source_url: 'https://www.iitk.ac.in/' },
  { name: 'IIT Kharagpur',           state: 'West Bengal',  city: 'Kharagpur',       streams: ['Science (PCM)'], min_marks: 92, max_marks: 100, yearly_cost_min: 245000, yearly_cost_max: 365000, college_type: 'central', national: true,  source_url: 'https://www.iitkgp.ac.in/' },
  { name: 'IIT Roorkee',             state: 'Uttarakhand',  city: 'Roorkee',         streams: ['Science (PCM)'], min_marks: 92, max_marks: 100, yearly_cost_min: 248000, yearly_cost_max: 368000, college_type: 'central', national: true,  source_url: 'https://www.iitr.ac.in/' },
  { name: 'IIT Hyderabad',           state: 'Telangana',    city: 'Hyderabad',       streams: ['Science (PCM)'], min_marks: 88, max_marks: 100, yearly_cost_min: 240000, yearly_cost_max: 355000, college_type: 'central', national: true,  source_url: 'https://www.iith.ac.in/' },
  { name: 'IIT Guwahati',            state: 'Assam',        city: 'Guwahati',        streams: ['Science (PCM)'], min_marks: 87, max_marks: 100, yearly_cost_min: 235000, yearly_cost_max: 350000, college_type: 'central', national: true,  source_url: 'https://www.iitg.ac.in/' },
  { name: 'IIT BHU Varanasi',        state: 'Uttar Pradesh',city: 'Varanasi',        streams: ['Science (PCM)'], min_marks: 86, max_marks: 100, yearly_cost_min: 235000, yearly_cost_max: 348000, college_type: 'central', national: true,  source_url: 'https://www.iitbhu.ac.in/' },
  { name: 'IIT Indore',              state: 'Madhya Pradesh',city: 'Indore',         streams: ['Science (PCM)'], min_marks: 85, max_marks: 100, yearly_cost_min: 232000, yearly_cost_max: 345000, college_type: 'central', national: true,  source_url: 'https://www.iiti.ac.in/' },

  // NITs (national, JEE Main, subsidised)
  { name: 'NIT Trichy',              state: 'Tamil Nadu',   city: 'Tiruchirappalli', streams: ['Science (PCM)'], min_marks: 85, max_marks: 100, yearly_cost_min: 145000, yearly_cost_max: 220000, college_type: 'central', national: true,  source_url: 'https://www.nitt.edu/' },
  { name: 'NIT Warangal',            state: 'Telangana',    city: 'Warangal',        streams: ['Science (PCM)'], min_marks: 84, max_marks: 100, yearly_cost_min: 142000, yearly_cost_max: 215000, college_type: 'central', national: true,  source_url: 'https://www.nitw.ac.in/' },
  { name: 'NIT Surathkal',           state: 'Karnataka',    city: 'Mangalore',       streams: ['Science (PCM)'], min_marks: 83, max_marks: 100, yearly_cost_min: 140000, yearly_cost_max: 210000, college_type: 'central', national: true,  source_url: 'https://www.nitk.ac.in/' },
  { name: 'NIT Calicut',             state: 'Kerala',       city: 'Kozhikode',       streams: ['Science (PCM)'], min_marks: 83, max_marks: 100, yearly_cost_min: 138000, yearly_cost_max: 208000, college_type: 'central', national: true,  source_url: 'https://nitc.ac.in/' },
  { name: 'NIT Rourkela',            state: 'Odisha',       city: 'Rourkela',        streams: ['Science (PCM)'], min_marks: 82, max_marks: 100, yearly_cost_min: 132000, yearly_cost_max: 200000, college_type: 'central', national: true,  source_url: 'https://nitrkl.ac.in/' },
  { name: 'NIT Jaipur (MNIT)',       state: 'Rajasthan',    city: 'Jaipur',          streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 128000, yearly_cost_max: 195000, college_type: 'central', national: true,  source_url: 'https://mnit.ac.in/' },
  { name: 'NIT Bhopal (MANIT)',      state: 'Madhya Pradesh',city: 'Bhopal',         streams: ['Science (PCM)'], min_marks: 78, max_marks: 100, yearly_cost_min: 122000, yearly_cost_max: 188000, college_type: 'central', national: true,  source_url: 'https://www.manit.ac.in/' },
  { name: 'NIT Patna',               state: 'Bihar',        city: 'Patna',           streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 118000, yearly_cost_max: 180000, college_type: 'central', national: true,  source_url: 'https://www.nitp.ac.in/' },

  // Other central institutions
  { name: 'BITS Pilani',             state: 'Rajasthan',    city: 'Pilani',          streams: ['Science (PCM)'], min_marks: 82, max_marks: 100, yearly_cost_min: 410000, yearly_cost_max: 580000, college_type: 'deemed',  national: true,  source_url: 'https://www.bits-pilani.ac.in/' },
  { name: 'BITS Hyderabad',          state: 'Telangana',    city: 'Hyderabad',       streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 415000, yearly_cost_max: 590000, college_type: 'deemed',  national: true,  source_url: 'https://www.bits-pilani.ac.in/hyderabad/' },
  { name: 'BITS Goa',                state: 'Goa',          city: 'Goa',             streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 410000, yearly_cost_max: 580000, college_type: 'deemed',  national: true,  source_url: 'https://www.bits-pilani.ac.in/goa/' },
  { name: 'IIIT Hyderabad',          state: 'Telangana',    city: 'Hyderabad',       streams: ['Science (PCM)'], min_marks: 88, max_marks: 100, yearly_cost_min: 280000, yearly_cost_max: 420000, college_type: 'deemed',  national: true,  source_url: 'https://www.iiit.ac.in/' },
  { name: 'IIIT Delhi',              state: 'Delhi',        city: 'Delhi',           streams: ['Science (PCM)'], min_marks: 85, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 390000, college_type: 'state',   national: true,  source_url: 'https://www.iiitd.ac.in/' },

  // State engineering colleges
  { name: 'DTU (Delhi Technological University)', state: 'Delhi', city: 'Delhi',  streams: ['Science (PCM)'], min_marks: 85, max_marks: 100, yearly_cost_min: 175000, yearly_cost_max: 255000, college_type: 'state',   national: false, source_url: 'https://dtu.ac.in/' },
  { name: 'NSUT Delhi',              state: 'Delhi',        city: 'Delhi',           streams: ['Science (PCM)'], min_marks: 82, max_marks: 100, yearly_cost_min: 150000, yearly_cost_max: 230000, college_type: 'state',   national: false, source_url: 'https://www.nsut.ac.in/' },
  { name: 'Jadavpur University',     state: 'West Bengal',  city: 'Kolkata',         streams: ['Science (PCM)', 'Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 120000, college_type: 'state', national: false, source_url: 'https://jadavpur.edu/' },
  { name: 'COEP Technological University', state: 'Maharashtra', city: 'Pune',      streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 118000, yearly_cost_max: 182000, college_type: 'state',   national: false, source_url: 'https://coep.org.in/' },

  // Private / Deemed engineering (national intake)
  { name: 'VIT Vellore',             state: 'Tamil Nadu',   city: 'Vellore',         streams: ['Science (PCM)'], min_marks: 70, max_marks: 100, yearly_cost_min: 210000, yearly_cost_max: 360000, college_type: 'deemed',  national: true,  source_url: 'https://vit.ac.in/' },
  { name: 'SRM Institute of Science and Technology', state: 'Tamil Nadu', city: 'Chennai', streams: ['Science (PCM)'], min_marks: 65, max_marks: 100, yearly_cost_min: 180000, yearly_cost_max: 320000, college_type: 'deemed', national: true, source_url: 'https://www.srmist.edu.in/' },
  { name: 'Manipal Institute of Technology', state: 'Karnataka', city: 'Manipal',   streams: ['Science (PCM)'], min_marks: 70, max_marks: 100, yearly_cost_min: 260000, yearly_cost_max: 430000, college_type: 'deemed',  national: true,  source_url: 'https://manipal.edu/mit.html' },
  { name: 'Thapar Institute of Engineering and Technology', state: 'Punjab', city: 'Patiala', streams: ['Science (PCM)'], min_marks: 76, max_marks: 100, yearly_cost_min: 258000, yearly_cost_max: 395000, college_type: 'deemed', national: true, source_url: 'https://www.thapar.edu/' },
  { name: 'Amrita School of Engineering Coimbatore', state: 'Tamil Nadu', city: 'Coimbatore', streams: ['Science (PCM)'], min_marks: 72, max_marks: 100, yearly_cost_min: 200000, yearly_cost_max: 330000, college_type: 'deemed', national: true, source_url: 'https://www.amrita.edu/school/engineering/' },
  { name: 'Chandigarh University',   state: 'Punjab',       city: 'Mohali',          streams: ['Science (PCM)'], min_marks: 60, max_marks: 100, yearly_cost_min: 155000, yearly_cost_max: 285000, college_type: 'deemed',  national: true,  source_url: 'https://www.cuchd.in/' },
  { name: 'Lovely Professional University', state: 'Punjab', city: 'Phagwara',       streams: ['Science (PCM)'], min_marks: 55, max_marks: 100, yearly_cost_min: 130000, yearly_cost_max: 255000, college_type: 'private', national: true,  source_url: 'https://www.lpu.in/' },
  { name: 'Amity University Noida',  state: 'Uttar Pradesh',city: 'Noida',           streams: ['Science (PCM)', 'Commerce', 'Arts / Humanities'], min_marks: 60, max_marks: 100, yearly_cost_min: 210000, yearly_cost_max: 370000, college_type: 'private', national: true, source_url: 'https://www.amity.edu/' },
  { name: 'KIIT University',         state: 'Odisha',       city: 'Bhubaneswar',     streams: ['Science (PCM)'], min_marks: 65, max_marks: 100, yearly_cost_min: 170000, yearly_cost_max: 295000, college_type: 'deemed',  national: true,  source_url: 'https://kiit.ac.in/' },

  // Private engineering (state-based intake)
  { name: 'RV College of Engineering', state: 'Karnataka', city: 'Bangalore',        streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 140000, yearly_cost_max: 225000, college_type: 'private', national: false, source_url: 'https://www.rvce.edu.in/' },
  { name: 'BMS College of Engineering', state: 'Karnataka', city: 'Bangalore',       streams: ['Science (PCM)'], min_marks: 72, max_marks: 100, yearly_cost_min: 125000, yearly_cost_max: 215000, college_type: 'private', national: false, source_url: 'https://www.bmsce.ac.in/' },
  { name: 'PES University',          state: 'Karnataka',    city: 'Bangalore',        streams: ['Science (PCM)'], min_marks: 72, max_marks: 100, yearly_cost_min: 195000, yearly_cost_max: 315000, college_type: 'deemed',  national: false, source_url: 'https://pes.edu/' },
  { name: 'MS Ramaiah Institute of Technology', state: 'Karnataka', city: 'Bangalore', streams: ['Science (PCM)'], min_marks: 70, max_marks: 100, yearly_cost_min: 140000, yearly_cost_max: 235000, college_type: 'private', national: false, source_url: 'https://www.msrit.edu/' },
  { name: 'PSG College of Technology', state: 'Tamil Nadu', city: 'Coimbatore',      streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 115000, yearly_cost_max: 188000, college_type: 'private', national: false, source_url: 'https://www.psgtech.edu/' },
  { name: 'KJ Somaiya College of Engineering', state: 'Maharashtra', city: 'Mumbai', streams: ['Science (PCM)'], min_marks: 70, max_marks: 100, yearly_cost_min: 190000, yearly_cost_max: 290000, college_type: 'private', national: false, source_url: 'https://kjsieit.somaiya.edu/' },
  { name: 'Symbiosis Institute of Technology', state: 'Maharashtra', city: 'Pune',   streams: ['Science (PCM)'], min_marks: 72, max_marks: 100, yearly_cost_min: 215000, yearly_cost_max: 340000, college_type: 'private', national: false, source_url: 'https://www.sitpune.edu.in/' },
  { name: 'Nirma University',        state: 'Gujarat',      city: 'Ahmedabad',        streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 192000, yearly_cost_max: 308000, college_type: 'deemed',  national: false, source_url: 'https://nirmauni.ac.in/' },
  { name: 'DAIICT',                  state: 'Gujarat',      city: 'Gandhinagar',      streams: ['Science (PCM)'], min_marks: 78, max_marks: 100, yearly_cost_min: 215000, yearly_cost_max: 330000, college_type: 'deemed',  national: false, source_url: 'https://www.daiict.ac.in/' },

  // ─── Science (PCB) — Medical / Life Sciences ──────────────────────────────

  { name: 'AIIMS New Delhi',         state: 'Delhi',        city: 'Delhi',            streams: ['Science (PCB)'], min_marks: 98, max_marks: 100, yearly_cost_min: 50000,  yearly_cost_max: 115000,  college_type: 'central', national: true,  source_url: 'https://www.aiims.edu/' },
  { name: 'AIIMS Mumbai',            state: 'Maharashtra',  city: 'Mumbai',           streams: ['Science (PCB)'], min_marks: 96, max_marks: 100, yearly_cost_min: 55000,  yearly_cost_max: 125000,  college_type: 'central', national: true,  source_url: 'https://aiimsmumbai.edu.in/' },
  { name: 'AIIMS Bhopal',            state: 'Madhya Pradesh', city: 'Bhopal',         streams: ['Science (PCB)'], min_marks: 94, max_marks: 100, yearly_cost_min: 52000,  yearly_cost_max: 118000,  college_type: 'central', national: true,  source_url: 'https://www.aiimsbhopal.edu.in/' },
  { name: 'AIIMS Jodhpur',           state: 'Rajasthan',    city: 'Jodhpur',          streams: ['Science (PCB)'], min_marks: 93, max_marks: 100, yearly_cost_min: 52000,  yearly_cost_max: 118000,  college_type: 'central', national: true,  source_url: 'https://www.aiimsjodhpur.edu.in/' },
  { name: 'JIPMER Puducherry',       state: 'Puducherry',   city: 'Puducherry',       streams: ['Science (PCB)'], min_marks: 93, max_marks: 100, yearly_cost_min: 45000,  yearly_cost_max: 108000,  college_type: 'central', national: true,  source_url: 'https://jipmer.edu.in/' },
  { name: 'CMC Vellore',             state: 'Tamil Nadu',   city: 'Vellore',          streams: ['Science (PCB)'], min_marks: 92, max_marks: 100, yearly_cost_min: 200000, yearly_cost_max: 430000,  college_type: 'private', national: true,  source_url: 'https://www.cmch-vellore.edu/' },
  { name: 'Maulana Azad Medical College', state: 'Delhi',   city: 'Delhi',            streams: ['Science (PCB)'], min_marks: 93, max_marks: 100, yearly_cost_min: 45000,  yearly_cost_max: 108000,  college_type: 'state',   national: false, source_url: 'https://mamc.ac.in/' },
  { name: 'Madras Medical College',  state: 'Tamil Nadu',   city: 'Chennai',          streams: ['Science (PCB)'], min_marks: 90, max_marks: 100, yearly_cost_min: 48000,  yearly_cost_max: 102000,  college_type: 'state',   national: false, source_url: 'https://mmc.ac.in/' },
  { name: 'Grant Medical College Mumbai', state: 'Maharashtra', city: 'Mumbai',       streams: ['Science (PCB)'], min_marks: 88, max_marks: 100, yearly_cost_min: 55000,  yearly_cost_max: 108000,  college_type: 'state',   national: false, source_url: 'https://grantmedicalcollege.in/' },
  { name: 'BJ Medical College Pune', state: 'Maharashtra',  city: 'Pune',             streams: ['Science (PCB)'], min_marks: 87, max_marks: 100, yearly_cost_min: 52000,  yearly_cost_max: 102000,  college_type: 'state',   national: false, source_url: 'https://www.bjmcpune.org/' },
  { name: 'Osmania Medical College', state: 'Telangana',    city: 'Hyderabad',        streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 58000,  yearly_cost_max: 118000,  college_type: 'state',   national: false, source_url: 'https://www.osmaniamedicallcollege.ac.in/' },
  { name: 'Bangalore Medical College and Research Institute', state: 'Karnataka', city: 'Bangalore', streams: ['Science (PCB)'], min_marks: 87, max_marks: 100, yearly_cost_min: 55000, yearly_cost_max: 112000, college_type: 'state', national: false, source_url: 'https://www.bmcri.org/' },
  { name: 'KMC Manipal',             state: 'Karnataka',    city: 'Manipal',          streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 850000, yearly_cost_max: 1650000, college_type: 'deemed',  national: true,  source_url: 'https://manipal.edu/kmc-manipal.html' },
  { name: 'Kasturba Medical College Mangalore', state: 'Karnataka', city: 'Mangalore', streams: ['Science (PCB)'], min_marks: 83, max_marks: 100, yearly_cost_min: 900000, yearly_cost_max: 1700000, college_type: 'deemed', national: true, source_url: 'https://manipal.edu/kmc-mangalore.html' },
  { name: "St. John's Medical College", state: 'Karnataka', city: 'Bangalore',        streams: ['Science (PCB)'], min_marks: 87, max_marks: 100, yearly_cost_min: 720000, yearly_cost_max: 1300000, college_type: 'private', national: false, source_url: 'https://stjohns.in/medical-college/' },
  { name: 'MS Ramaiah Medical College', state: 'Karnataka', city: 'Bangalore',        streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 820000, yearly_cost_max: 1500000, college_type: 'private', national: false, source_url: 'https://www.msrmc.ac.in/' },
  { name: 'JSS Medical College',     state: 'Karnataka',    city: 'Mysore',           streams: ['Science (PCB)'], min_marks: 83, max_marks: 100, yearly_cost_min: 750000, yearly_cost_max: 1380000, college_type: 'deemed',  national: false, source_url: 'https://jssuni.edu.in/' },
  { name: 'Sri Ramachandra Medical College', state: 'Tamil Nadu', city: 'Chennai',    streams: ['Science (PCB)'], min_marks: 83, max_marks: 100, yearly_cost_min: 780000, yearly_cost_max: 1420000, college_type: 'deemed',  national: false, source_url: 'https://srmc.ac.in/' },
  { name: 'Amrita School of Medicine', state: 'Tamil Nadu', city: 'Coimbatore',       streams: ['Science (PCB)'], min_marks: 82, max_marks: 100, yearly_cost_min: 820000, yearly_cost_max: 1480000, college_type: 'deemed',  national: true,  source_url: 'https://www.amrita.edu/school/medicine/' },
  { name: 'KGMU Lucknow',            state: 'Uttar Pradesh', city: 'Lucknow',         streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 58000,  yearly_cost_max: 118000,  college_type: 'state',   national: false, source_url: 'https://www.kgmu.org/' },
  { name: 'SN Medical College Agra', state: 'Uttar Pradesh', city: 'Agra',            streams: ['Science (PCB)'], min_marks: 80, max_marks: 100, yearly_cost_min: 50000,  yearly_cost_max: 102000,  college_type: 'state',   national: false, source_url: 'https://www.snmc.ac.in/' },
  { name: "Nizam's Institute of Medical Sciences", state: 'Telangana', city: 'Hyderabad', streams: ['Science (PCB)'], min_marks: 83, max_marks: 100, yearly_cost_min: 520000, yearly_cost_max: 980000, college_type: 'state', national: false, source_url: 'https://www.nims.edu.in/' },
  { name: 'Government Medical College Kozhikode', state: 'Kerala', city: 'Kozhikode', streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 102000, college_type: 'state', national: false, source_url: 'https://gmckozhikode.kerala.gov.in/' },

  // ─── Commerce ──────────────────────────────────────────────────────────────

  { name: 'Shri Ram College of Commerce', state: 'Delhi', city: 'Delhi',             streams: ['Commerce'], min_marks: 93, max_marks: 100, yearly_cost_min: 58000,  yearly_cost_max: 108000,  college_type: 'central', national: false, source_url: 'https://www.srcc.edu/' },
  { name: 'Lady Shri Ram College',   state: 'Delhi',        city: 'Delhi',            streams: ['Commerce', 'Arts / Humanities'], min_marks: 90, max_marks: 100, yearly_cost_min: 52000, yearly_cost_max: 102000, college_type: 'central', national: false, source_url: 'https://www.lsr.edu.in/' },
  { name: 'Hindu College Delhi',     state: 'Delhi',        city: 'Delhi',            streams: ['Commerce', 'Arts / Humanities'], min_marks: 90, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 98000, college_type: 'central', national: false, source_url: 'https://www.hinducollege.ac.in/' },
  { name: 'Hansraj College',         state: 'Delhi',        city: 'Delhi',            streams: ['Commerce', 'Arts / Humanities'], min_marks: 88, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 96000, college_type: 'central', national: false, source_url: 'https://www.hansrajcollege.ac.in/' },
  { name: 'Shaheed Sukhdev College of Business Studies', state: 'Delhi', city: 'Delhi', streams: ['Commerce'], min_marks: 88, max_marks: 100, yearly_cost_min: 48000, yearly_cost_max: 92000, college_type: 'state', national: false, source_url: 'https://sscbs.du.ac.in/' },
  { name: 'Ramjas College',          state: 'Delhi',        city: 'Delhi',            streams: ['Commerce', 'Arts / Humanities'], min_marks: 86, max_marks: 100, yearly_cost_min: 48000, yearly_cost_max: 92000, college_type: 'central', national: false, source_url: 'https://ramjas.du.ac.in/' },
  { name: 'HR College of Commerce and Economics', state: 'Maharashtra', city: 'Mumbai', streams: ['Commerce'], min_marks: 85, max_marks: 100, yearly_cost_min: 85000, yearly_cost_max: 158000, college_type: 'private', national: false, source_url: 'https://hrcollege.edu/' },
  { name: 'Narsee Monjee College of Commerce', state: 'Maharashtra', city: 'Mumbai',  streams: ['Commerce'], min_marks: 85, max_marks: 100, yearly_cost_min: 95000, yearly_cost_max: 168000, college_type: 'private', national: false, source_url: 'https://nmcollege.in/' },
  { name: 'Mithibai College',        state: 'Maharashtra',  city: 'Mumbai',           streams: ['Commerce', 'Arts / Humanities'], min_marks: 83, max_marks: 100, yearly_cost_min: 82000, yearly_cost_max: 155000, college_type: 'private', national: false, source_url: 'https://mithibaicollege.in/' },
  { name: "St. Xavier's College Mumbai", state: 'Maharashtra', city: 'Mumbai',        streams: ['Commerce', 'Arts / Humanities'], min_marks: 85, max_marks: 100, yearly_cost_min: 92000, yearly_cost_max: 172000, college_type: 'private', national: false, source_url: 'https://xaviers.edu/' },
  { name: 'Symbiosis College of Arts and Commerce', state: 'Maharashtra', city: 'Pune', streams: ['Commerce', 'Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 128000, yearly_cost_max: 215000, college_type: 'private', national: false, source_url: 'https://scac.ac.in/' },
  { name: 'Fergusson College Pune',  state: 'Maharashtra',  city: 'Pune',             streams: ['Commerce', 'Arts / Humanities'], min_marks: 78, max_marks: 100, yearly_cost_min: 62000,  yearly_cost_max: 122000,  college_type: 'state',   national: false, source_url: 'https://www.fergusson.edu/' },
  { name: 'Christ University',       state: 'Karnataka',    city: 'Bangalore',        streams: ['Commerce', 'Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 155000, yearly_cost_max: 292000, college_type: 'deemed',  national: false, source_url: 'https://christuniversity.in/' },
  { name: "St. Joseph's College of Commerce", state: 'Karnataka', city: 'Bangalore',  streams: ['Commerce'], min_marks: 80, max_marks: 100, yearly_cost_min: 108000, yearly_cost_max: 192000, college_type: 'private', national: false, source_url: 'https://stjosephs.in/college-of-commerce/' },
  { name: 'Loyola College Chennai',  state: 'Tamil Nadu',   city: 'Chennai',          streams: ['Commerce', 'Arts / Humanities'], min_marks: 82, max_marks: 100, yearly_cost_min: 82000, yearly_cost_max: 158000, college_type: 'private', national: false, source_url: 'https://www.loyolacollege.edu/' },
  { name: 'Stella Maris College',    state: 'Tamil Nadu',   city: 'Chennai',          streams: ['Commerce', 'Arts / Humanities'], min_marks: 82, max_marks: 100, yearly_cost_min: 80000, yearly_cost_max: 152000, college_type: 'private', national: false, source_url: 'https://stellamariscollege.edu.in/' },
  { name: 'Presidency College Kolkata', state: 'West Bengal', city: 'Kolkata',        streams: ['Commerce', 'Arts / Humanities'], min_marks: 85, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 100000, college_type: 'state',   national: false, source_url: 'https://www.presiuniv.ac.in/' },
  { name: "St. Xavier's College Kolkata", state: 'West Bengal', city: 'Kolkata',      streams: ['Commerce', 'Arts / Humanities'], min_marks: 83, max_marks: 100, yearly_cost_min: 82000, yearly_cost_max: 158000, college_type: 'private', national: false, source_url: 'https://sxccal.edu/' },
  { name: 'NMIMS Mumbai (BBA/B.Com)', state: 'Maharashtra', city: 'Mumbai',           streams: ['Commerce'], min_marks: 80, max_marks: 100, yearly_cost_min: 320000, yearly_cost_max: 540000, college_type: 'deemed',  national: false, source_url: 'https://www.nmims.edu/' },
  { name: 'IIM Indore IPM',          state: 'Madhya Pradesh', city: 'Indore',         streams: ['Commerce'], min_marks: 85, max_marks: 100, yearly_cost_min: 430000, yearly_cost_max: 660000, college_type: 'central', national: true,  source_url: 'https://www.iimidr.ac.in/ipm/' },

  // ─── Arts / Humanities ────────────────────────────────────────────────────

  { name: "St. Stephen's College",   state: 'Delhi',        city: 'Delhi',            streams: ['Arts / Humanities'], min_marks: 92, max_marks: 100, yearly_cost_min: 58000, yearly_cost_max: 112000, college_type: 'central', national: false, source_url: 'https://www.ststephens.edu/' },
  { name: 'Miranda House',           state: 'Delhi',        city: 'Delhi',            streams: ['Arts / Humanities'], min_marks: 92, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 100000, college_type: 'central', national: false, source_url: 'https://mirandahouse.ac.in/' },
  { name: 'Jawaharlal Nehru University (JNU)', state: 'Delhi', city: 'Delhi',         streams: ['Arts / Humanities'], min_marks: 75, max_marks: 100, yearly_cost_min: 30000,  yearly_cost_max: 65000,   college_type: 'central', national: true,  source_url: 'https://www.jnu.ac.in/' },
  { name: 'Delhi School of Economics', state: 'Delhi',      city: 'Delhi',            streams: ['Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 38000,  yearly_cost_max: 80000,   college_type: 'central', national: false, source_url: 'https://econdse.org/' },
  { name: 'Banaras Hindu University', state: 'Uttar Pradesh', city: 'Varanasi',       streams: ['Arts / Humanities'], min_marks: 75, max_marks: 100, yearly_cost_min: 52000,  yearly_cost_max: 108000,  college_type: 'central', national: true,  source_url: 'https://www.bhu.ac.in/' },
  { name: 'Hyderabad Central University', state: 'Telangana', city: 'Hyderabad',      streams: ['Arts / Humanities'], min_marks: 75, max_marks: 100, yearly_cost_min: 42000,  yearly_cost_max: 92000,   college_type: 'central', national: true,  source_url: 'https://www.uohyd.ac.in/' },
  { name: 'University of Hyderabad', state: 'Telangana',    city: 'Hyderabad',        streams: ['Arts / Humanities'], min_marks: 73, max_marks: 100, yearly_cost_min: 40000,  yearly_cost_max: 90000,   college_type: 'central', national: true,  source_url: 'https://uohyd.ac.in/' },
  { name: 'TISS Mumbai',             state: 'Maharashtra',  city: 'Mumbai',           streams: ['Arts / Humanities'], min_marks: 78, max_marks: 100, yearly_cost_min: 85000,  yearly_cost_max: 165000,  college_type: 'central', national: true,  source_url: 'https://www.tiss.edu/' },
  { name: 'Aligarh Muslim University', state: 'Uttar Pradesh', city: 'Aligarh',       streams: ['Arts / Humanities', 'Commerce'], min_marks: 72, max_marks: 100, yearly_cost_min: 52000, yearly_cost_max: 108000, college_type: 'central', national: true, source_url: 'https://www.amu.ac.in/' },
  { name: 'Madras Christian College', state: 'Tamil Nadu',  city: 'Chennai',          streams: ['Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 82000,  yearly_cost_max: 158000,  college_type: 'private', national: false, source_url: 'https://www.mcc.edu.in/' },
  { name: 'Wilson College Mumbai',   state: 'Maharashtra',  city: 'Mumbai',           streams: ['Arts / Humanities'], min_marks: 75, max_marks: 100, yearly_cost_min: 82000,  yearly_cost_max: 158000,  college_type: 'private', national: false, source_url: 'https://wilsoncollege.edu/' },
  { name: 'Jai Hind College',        state: 'Maharashtra',  city: 'Mumbai',           streams: ['Arts / Humanities', 'Commerce'], min_marks: 78, max_marks: 100, yearly_cost_min: 82000, yearly_cost_max: 158000, college_type: 'private', national: false, source_url: 'https://jaihindcollege.com/' },
  { name: 'Jadavpur University (Arts)', state: 'West Bengal', city: 'Kolkata',        streams: ['Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 50000,  yearly_cost_max: 122000,  college_type: 'state',   national: false, source_url: 'https://jadavpur.edu/' },
  { name: 'Symbiosis School of Liberal Arts', state: 'Maharashtra', city: 'Pune',     streams: ['Arts / Humanities'], min_marks: 78, max_marks: 100, yearly_cost_min: 255000, yearly_cost_max: 415000,  college_type: 'deemed',  national: false, source_url: 'https://ssla.edu.in/' },
  { name: 'Kirori Mal College Delhi', state: 'Delhi',       city: 'Delhi',            streams: ['Arts / Humanities', 'Commerce'], min_marks: 85, max_marks: 100, yearly_cost_min: 48000, yearly_cost_max: 92000, college_type: 'central', national: false, source_url: 'https://www.kmc.du.ac.in/' },

  // ─── EXPANSION BATCH: broader city & tier coverage ─────────────────────────
  // More engineering (Tier-2 cities & additional states)
  { name: 'IIIT Bangalore',          state: 'Karnataka',    city: 'Bengaluru',        streams: ['Science (PCM)'], min_marks: 85, max_marks: 100, yearly_cost_min: 300000, yearly_cost_max: 400000, college_type: 'state',   national: true,  source_url: 'https://www.iiitb.ac.in/' },
  { name: 'Dayananda Sagar College of Engineering', state: 'Karnataka', city: 'Bengaluru', streams: ['Science (PCM)'], min_marks: 60, max_marks: 100, yearly_cost_min: 120000, yearly_cost_max: 220000, college_type: 'private', national: false, source_url: 'https://www.dsce.edu.in/' },
  { name: 'JSS Science & Technology University', state: 'Karnataka', city: 'Mysuru',    streams: ['Science (PCM)'], min_marks: 60, max_marks: 100, yearly_cost_min: 110000, yearly_cost_max: 200000, college_type: 'private', national: false, source_url: 'https://jssstuniv.in/' },
  { name: 'Siddaganga Institute of Technology', state: 'Karnataka', city: 'Tumakuru',  streams: ['Science (PCM)'], min_marks: 55, max_marks: 100, yearly_cost_min: 90000, yearly_cost_max: 170000, college_type: 'private', national: false, source_url: 'https://www.sit.ac.in/' },
  { name: 'College of Engineering Pune (COEP)', state: 'Maharashtra', city: 'Pune',    streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 90000, yearly_cost_max: 160000, college_type: 'state', national: false, source_url: 'https://www.coep.org.in/' },
  { name: 'VJTI Mumbai',             state: 'Maharashtra',  city: 'Mumbai',           streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 80000, yearly_cost_max: 150000, college_type: 'state', national: false, source_url: 'https://vjti.ac.in/' },
  { name: 'PICT Pune',               state: 'Maharashtra',  city: 'Pune',             streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 120000, yearly_cost_max: 200000, college_type: 'private', national: false, source_url: 'https://pict.edu/' },
  { name: 'IIIT Allahabad',          state: 'Uttar Pradesh', city: 'Prayagraj',       streams: ['Science (PCM)'], min_marks: 85, max_marks: 100, yearly_cost_min: 200000, yearly_cost_max: 300000, college_type: 'central', national: true, source_url: 'https://iiita.ac.in/' },
  { name: 'MNNIT Allahabad',         state: 'Uttar Pradesh', city: 'Prayagraj',       streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 130000, yearly_cost_max: 200000, college_type: 'central', national: true, source_url: 'https://www.mnnit.ac.in/' },
  { name: 'IIT Gandhinagar',         state: 'Gujarat',      city: 'Gandhinagar',      streams: ['Science (PCM)'], min_marks: 90, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 370000, college_type: 'central', national: true, source_url: 'https://iitgn.ac.in/' },
  { name: 'SVNIT Surat',             state: 'Gujarat',      city: 'Surat',            streams: ['Science (PCM)'], min_marks: 78, max_marks: 100, yearly_cost_min: 130000, yearly_cost_max: 200000, college_type: 'central', national: true, source_url: 'https://www.svnit.ac.in/' },
  { name: 'IIEST Shibpur',           state: 'West Bengal',  city: 'Howrah',           streams: ['Science (PCM)'], min_marks: 78, max_marks: 100, yearly_cost_min: 130000, yearly_cost_max: 200000, college_type: 'central', national: true, source_url: 'https://www.iiests.ac.in/' },
  { name: 'CET Trivandrum',          state: 'Kerala',       city: 'Thiruvananthapuram', streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 60000, yearly_cost_max: 120000, college_type: 'state', national: false, source_url: 'https://www.cet.ac.in/' },
  { name: 'Osmania University College of Engineering', state: 'Telangana', city: 'Hyderabad', streams: ['Science (PCM)'], min_marks: 70, max_marks: 100, yearly_cost_min: 60000, yearly_cost_max: 130000, college_type: 'state', national: false, source_url: 'https://www.uceou.edu/' },
  { name: 'CBIT Hyderabad',          state: 'Telangana',    city: 'Hyderabad',        streams: ['Science (PCM)'], min_marks: 70, max_marks: 100, yearly_cost_min: 110000, yearly_cost_max: 190000, college_type: 'private', national: false, source_url: 'https://www.cbit.ac.in/' },
  { name: 'SSN College of Engineering', state: 'Tamil Nadu', city: 'Chennai',         streams: ['Science (PCM)'], min_marks: 75, max_marks: 100, yearly_cost_min: 100000, yearly_cost_max: 180000, college_type: 'private', national: false, source_url: 'https://www.ssn.edu.in/' },
  { name: 'Anna University (CEG Campus)', state: 'Tamil Nadu', city: 'Chennai',       streams: ['Science (PCM)'], min_marks: 80, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 110000, college_type: 'state', national: false, source_url: 'https://www.annauniv.edu/' },

  // More medical (across states)
  { name: 'AIIMS Rishikesh',         state: 'Uttarakhand',  city: 'Rishikesh',        streams: ['Science (PCB)'], min_marks: 92, max_marks: 100, yearly_cost_min: 52000, yearly_cost_max: 118000, college_type: 'central', national: true, source_url: 'https://www.aiimsrishikesh.edu.in/' },
  { name: 'AIIMS Patna',             state: 'Bihar',        city: 'Patna',            streams: ['Science (PCB)'], min_marks: 90, max_marks: 100, yearly_cost_min: 52000, yearly_cost_max: 118000, college_type: 'central', national: true, source_url: 'https://www.aiimspatna.edu.in/' },
  { name: 'Kasturba Medical College Manipal', state: 'Karnataka', city: 'Manipal',    streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 900000, yearly_cost_max: 1700000, college_type: 'deemed', national: true, source_url: 'https://manipal.edu/kmc-manipal.html' },
  { name: 'Christian Medical College Ludhiana', state: 'Punjab', city: 'Ludhiana',    streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 300000, yearly_cost_max: 700000, college_type: 'private', national: false, source_url: 'https://www.cmcludhiana.in/' },
  { name: 'King George Medical University', state: 'Uttar Pradesh', city: 'Lucknow',  streams: ['Science (PCB)'], min_marks: 88, max_marks: 100, yearly_cost_min: 55000, yearly_cost_max: 120000, college_type: 'state', national: false, source_url: 'https://www.kgmu.org/' },
  { name: 'Government Medical College Nagpur', state: 'Maharashtra', city: 'Nagpur',  streams: ['Science (PCB)'], min_marks: 85, max_marks: 100, yearly_cost_min: 50000, yearly_cost_max: 105000, college_type: 'state', national: false, source_url: 'https://www.gmcnagpur.edu.in/' },

  // More commerce / management (Tier-2)
  { name: 'Christ University (Commerce)', state: 'Karnataka', city: 'Bengaluru',      streams: ['Commerce', 'Arts / Humanities'], min_marks: 80, max_marks: 100, yearly_cost_min: 155000, yearly_cost_max: 292000, college_type: 'deemed', national: false, source_url: 'https://christuniversity.in/' },
  { name: 'Jain University',          state: 'Karnataka',    city: 'Bengaluru',        streams: ['Commerce', 'Arts / Humanities', 'Science (PCM)'], min_marks: 60, max_marks: 100, yearly_cost_min: 150000, yearly_cost_max: 280000, college_type: 'deemed', national: false, source_url: 'https://www.jainuniversity.ac.in/' },
  { name: 'Symbiosis Centre for Management Studies', state: 'Maharashtra', city: 'Pune', streams: ['Commerce'], min_marks: 80, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 400000, college_type: 'deemed', national: false, source_url: 'https://www.scmspune.ac.in/' },
  { name: 'Christ University (Commerce) Delhi NCR', state: 'Delhi (NCT)', city: 'Delhi', streams: ['Commerce'], min_marks: 78, max_marks: 100, yearly_cost_min: 150000, yearly_cost_max: 280000, college_type: 'deemed', national: false, source_url: 'https://christuniversity.in/' },

  // More arts / law / design (broader)
  { name: 'National Law School of India University', state: 'Karnataka', city: 'Bengaluru', streams: ['Arts / Humanities', 'Commerce'], min_marks: 80, max_marks: 100, yearly_cost_min: 280000, yearly_cost_max: 350000, college_type: 'state', national: true, source_url: 'https://www.nls.ac.in/' },
  { name: 'NALSAR University of Law', state: 'Telangana',    city: 'Hyderabad',        streams: ['Arts / Humanities', 'Commerce'], min_marks: 80, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 340000, college_type: 'state', national: true, source_url: 'https://www.nalsar.ac.in/' },
  { name: 'National Institute of Design Ahmedabad', state: 'Gujarat', city: 'Ahmedabad', streams: ['Arts / Humanities', 'Science (PCM)'], min_marks: 60, max_marks: 100, yearly_cost_min: 300000, yearly_cost_max: 450000, college_type: 'central', national: true, source_url: 'https://www.nid.edu/' },
  { name: 'NIFT Delhi',              state: 'Delhi (NCT)',  city: 'Delhi',            streams: ['Arts / Humanities', 'Commerce', 'Science (PCM)'], min_marks: 55, max_marks: 100, yearly_cost_min: 250000, yearly_cost_max: 400000, college_type: 'central', national: true, source_url: 'https://www.nift.ac.in/delhi/' },
  { name: 'Srishti Manipal Institute', state: 'Karnataka',  city: 'Bengaluru',        streams: ['Arts / Humanities', 'Science (PCM)'], min_marks: 55, max_marks: 100, yearly_cost_min: 300000, yearly_cost_max: 500000, college_type: 'deemed', national: false, source_url: 'https://srishtimanipalinstitute.in/' },
]

// ─── SCHOLARSHIPS DATA ────────────────────────────────────────────────────────
// Fields:
//   name                          — Official scholarship name (must be unique)
//   description                   — 1-2 sentence description of eligibility and benefit
//   eligibility_income_max_lakh   — Max family income in lakh/yr to qualify (99 = no limit)
//   eligibility_marks_min         — Minimum 12th % required (0 = no minimum)
//   eligible_streams              — Array of streams, or ['All'] for all streams
//   eligible_states               — Array of states, or ['All'] for national
//   application_url               — Direct URL to apply or get info
//   deadline_pattern              — When to apply each year

const SCHOLARSHIPS = [
  {
    name: 'Central Sector Scheme of Scholarships (CSS)',
    description: 'For college/university students in the top 80th percentile of their state board. ₹10,000–₹20,000 per year for 3-5 years.',
    eligibility_income_max_lakh: 6, eligibility_marks_min: 80,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'July–October annually on NSP',
  },
  {
    name: 'NSP Post-Matric Scholarship for SC Students',
    description: 'For Scheduled Caste students at post-matric level. Variable amount based on course type and state — covers tuition and maintenance allowance.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'July–November annually on NSP',
  },
  {
    name: 'NSP Post-Matric Scholarship for OBC Students',
    description: 'For Other Backward Class students pursuing post-matric studies. Covers tuition and maintenance costs based on course.',
    eligibility_income_max_lakh: 1.5, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'August–November annually on NSP',
  },
  {
    name: 'NSP Post-Matric Scholarship for ST Students',
    description: 'For Scheduled Tribe students pursuing post-matric education. Covers full tuition at government institutions plus maintenance allowance.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'July–November annually on NSP',
  },
  {
    name: 'NSP Scholarship for Minorities (Pre/Post-Matric)',
    description: 'For students from minority communities (Muslim, Christian, Sikh, Buddhist, Zoroastrian, Jain). ₹3,000–₹10,000/yr plus maintenance allowance.',
    eligibility_income_max_lakh: 1, eligibility_marks_min: 50,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'August–October annually on NSP',
  },
  {
    name: 'Ishan Uday Scholarship for North-East Students',
    description: 'Special scholarship for students from North-Eastern states pursuing higher education outside their home state. ₹5,400–₹7,800/month.',
    eligibility_income_max_lakh: 4.5, eligibility_marks_min: 0,
    eligible_streams: ['All'],
    eligible_states: ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'July–September annually on NSP',
  },
  {
    name: 'INSPIRE Scholarship for Higher Education (SHE)',
    description: 'For students in the top 1% of their class board or NTSE/KVPY scholars pursuing natural sciences or medicine. ₹80,000/year.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 0,
    eligible_streams: ['Science (PCM)', 'Science (PCB)'], eligible_states: ['All'],
    application_url: 'https://online-inspire.gov.in', deadline_pattern: 'October–November annually',
  },
  {
    name: 'Pragati Scholarship for Girl Students (AICTE)',
    description: 'For girls admitted to AICTE-approved degree/diploma engineering programs. ₹50,000/year for 4 years.',
    eligibility_income_max_lakh: 8, eligibility_marks_min: 0,
    eligible_streams: ['Science (PCM)'], eligible_states: ['All'],
    application_url: 'https://www.aicte-pragati-saksham-gov.in', deadline_pattern: 'October–December annually',
  },
  {
    name: 'AICTE Swanath Scholarship Scheme',
    description: 'For orphans, wards of defence/paramilitary martyrs, and state police martyrs pursuing technical education. ₹50,000/year.',
    eligibility_income_max_lakh: 8, eligibility_marks_min: 0,
    eligible_streams: ['Science (PCM)', 'Commerce'], eligible_states: ['All'],
    application_url: 'https://www.aicte-india.org/schemes/students-development-schemes/Swanath', deadline_pattern: 'October–December annually',
  },
  {
    name: 'SBI Asha Scholarship Programme',
    description: 'For meritorious graduation students from economically weak families. ₹15,000/year. 75%+ marks in previous exam required.',
    eligibility_income_max_lakh: 3, eligibility_marks_min: 75,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://www.sbischolarship.com', deadline_pattern: 'June–October annually',
  },
  {
    name: "HDFC Bank Parivartan's ECS Scholarship",
    description: 'For students facing financial crisis due to death or incapacitation of the family breadwinner. Up to ₹75,000/year.',
    eligibility_income_max_lakh: 3.6, eligibility_marks_min: 55,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://www.buddy4study.com/scholarship/hdfc-bank-parivartans-ecs', deadline_pattern: 'June–September annually',
  },
  {
    name: 'Tata Capital Pankh Scholarship',
    description: 'For meritorious students from economically weaker backgrounds pursuing graduation. ₹10,000–₹12,000/year.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 60,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://www.tatacapital.com/about-us/tata-pankh-scholarship.html', deadline_pattern: 'June–August annually',
  },
  {
    name: 'Reliance Foundation Undergraduate Scholarship',
    description: 'Merit-cum-means scholarship for UG students at top colleges. ₹2–₹4 lakh/year. Strong focus on first-gen college students.',
    eligibility_income_max_lakh: 6, eligibility_marks_min: 60,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.reliancefoundation.org', deadline_pattern: 'August–October annually',
  },
  {
    name: 'Vidyasiri Scholarship Karnataka',
    description: 'For SC/ST/OBC/Minority students domiciled in Karnataka pursuing post-matric education. Covers tuition and maintenance.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 50,
    eligible_streams: ['All'], eligible_states: ['Karnataka'],
    application_url: 'https://sevasindhu.karnataka.gov.in', deadline_pattern: 'August–November annually',
  },
  {
    name: 'SVMCM West Bengal Scholarship',
    description: 'Swami Vivekanand Merit-cum-Means Scholarship for West Bengal students with family income below ₹2.5 lakh. ₹1,000–₹5,000/month.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 75,
    eligible_streams: ['All'], eligible_states: ['West Bengal'],
    application_url: 'https://svmcm.wbhed.gov.in', deadline_pattern: 'September–November annually',
  },
  {
    name: 'Prime Minister\'s Scholarship for Central Armed Police Forces',
    description: 'For wards of CAPF/AR/RPF martyrs or those disabled in service. ₹30,000–₹36,000/year for UG technical and professional courses.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 60,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://wards.desw.gov.in', deadline_pattern: 'July–September annually',
  },
  {
    name: 'NTSE National Talent Search Scholarship',
    description: 'Highly prestigious scholarship for NTSE Stage 2 qualifiers. ₹1,250–₹2,000/month, renewable through all stages of education.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://ncert.nic.in/programmes.php?ln=en', deadline_pattern: 'November–January (Stage 1 exam via state)',
  },
  {
    name: 'Maharashtra Government Post-Matric Scholarship',
    description: 'For SC/ST/VJ-NT/SBC/OBC students domiciled in Maharashtra. Covers full tuition at government colleges plus maintenance.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['Maharashtra'],
    application_url: 'https://mahaeschol.maharashtra.gov.in', deadline_pattern: 'August–November annually',
  },
  {
    name: 'Tamil Nadu Chief Minister\'s Kalaignar Scholarship',
    description: 'For meritorious Tamil Nadu students with family income below ₹2.5 lakh pursuing higher education. Variable amount based on course.',
    eligibility_income_max_lakh: 2.5, eligibility_marks_min: 60,
    eligible_streams: ['All'], eligible_states: ['Tamil Nadu'],
    application_url: 'https://www.tn.gov.in/scheme/data_view/4847', deadline_pattern: 'July–September annually',
  },
  {
    name: 'Buddy4Study Scholarship Portal',
    description: 'Aggregates 1,000+ scholarships for Indian students from Class 1 to PhD. Filter by stream, income, and state to find all schemes you qualify for.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://www.buddy4study.com', deadline_pattern: 'Varies by scholarship',
  },
  {
    name: 'GATE Scholarship (M.Tech Research Fellowship)',
    description: 'For M.Tech/ME students admitted via GATE score in government/central institutions. ₹12,400/month — plan for this at the end of B.Tech.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 0,
    eligible_streams: ['Science (PCM)'], eligible_states: ['All'],
    application_url: 'https://gate2025.iitr.ac.in/', deadline_pattern: 'With M.Tech admissions (June–July)',
  },
  {
    name: 'Saksham Scholarship for Differently Abled Students (AICTE)',
    description: 'For students with 40%+ disability pursuing AICTE-approved technical education. ₹50,000/year.',
    eligibility_income_max_lakh: 8, eligibility_marks_min: 0,
    eligible_streams: ['Science (PCM)'], eligible_states: ['All'],
    application_url: 'https://www.aicte-pragati-saksham-gov.in', deadline_pattern: 'October–December annually',
  },
  {
    name: 'Maulana Azad National Fellowship (MANF)',
    description: 'For minority students pursuing M.Phil or PhD. Not for UG, but important to plan for if considering research. Full funding.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 55,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://www.scholarships.gov.in', deadline_pattern: 'January–March annually (PG level)',
  },
  {
    name: 'UGC Single Girl Child Scholarship',
    description: 'For the single/lone girl child of a family pursuing Post-Graduation. ₹3,100/month — plan for PG now. Merit-based, no income limit.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 55,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://ugc.ac.in/schemesandprojects', deadline_pattern: 'January–March annually (PG level)',
  },
  {
    name: 'National Scholarship Portal (NSP) — Master Portal',
    description: 'One portal for 50+ central government scholarship schemes. Create an account and check all schemes you qualify for by your profile.',
    eligibility_income_max_lakh: 99, eligibility_marks_min: 0,
    eligible_streams: ['All'], eligible_states: ['All'],
    application_url: 'https://scholarships.gov.in', deadline_pattern: 'July–November annually (varies by scheme)',
  },
]

// ─── MENTORS DATA ─────────────────────────────────────────────────────────────
const MENTORS = [
  {
    name: 'Rahul S.',
    initials: 'RS',
    college: 'PES University',
    degree: 'B.E. Electronics & Communication',
    stream: 'PCB → ECE',
    stream_category: 'Science (PCB)',
    city: 'Bengaluru',
    cal_link: 'https://calendly.com/rahul-s-mentor/20min',
    story: "I missed NEET by 8 marks. Ended up in ECE. Here's what I wish someone told me.",
    tags: ['NEET dropout', 'Bio to Engineering', 'Career pivot'],
    gradient: 'from-blue-500/30 to-blue-600/10',
    border: 'border-blue-500/25',
    tag_color: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    initials_bg: 'bg-blue-500/20 text-blue-300',
    available: true,
  },
  {
    name: 'Priya M.',
    initials: 'PM',
    college: 'NIT Surathkal',
    degree: 'B.Tech Computer Science',
    stream: 'PCM → CSE',
    stream_category: 'Science (PCM)',
    city: 'Mangaluru',
    cal_link: 'https://calendly.com/priya-m-mentor/20min',
    story: "First in my family to leave home for college. It was terrifying. I'll tell you exactly what helped.",
    tags: ['First-gen student', 'Hostel life', 'Scholarships'],
    gradient: 'from-purple-500/30 to-purple-600/10',
    border: 'border-purple-500/25',
    tag_color: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    initials_bg: 'bg-purple-500/20 text-purple-300',
    available: true,
  },
  {
    name: 'Arjun K.',
    initials: 'AK',
    college: 'Manipal University',
    degree: 'BBA + Certification Finance',
    stream: 'Commerce',
    stream_category: 'Commerce',
    city: 'Pune',
    cal_link: 'https://calendly.com/arjun-k-mentor/20min',
    story: "Family wanted CA. I wanted something else. Here's how I navigated that conversation.",
    tags: ['Family pressure', 'Commerce', 'Non-CA path'],
    gradient: 'from-emerald-500/30 to-emerald-600/10',
    border: 'border-emerald-500/25',
    tag_color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    initials_bg: 'bg-emerald-500/20 text-emerald-300',
    available: true,
  },
]

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedColleges() {
  console.log(`\n📚 Seeding ${COLLEGES.length} colleges...`)
  let upserted = 0, errors = 0

  for (const college of COLLEGES) {
    const { error } = await supabase
      .from('colleges')
      .upsert(college, { onConflict: 'name' })

    if (error) {
      console.error(`  ❌ ${college.name}: ${error.message}`)
      errors++
    } else {
      upserted++
      process.stdout.write('.')
    }
  }

  console.log(`\n  ✅ ${upserted} colleges upserted, ${errors} errors`)
}

async function seedScholarships() {
  console.log(`\n🎓 Seeding ${SCHOLARSHIPS.length} scholarships...`)
  let upserted = 0, errors = 0

  for (const scholarship of SCHOLARSHIPS) {
    const { error } = await supabase
      .from('scholarships')
      .upsert(scholarship, { onConflict: 'name' })

    if (error) {
      console.error(`  ❌ ${scholarship.name}: ${error.message}`)
      errors++
    } else {
      upserted++
      process.stdout.write('.')
    }
  }

  console.log(`\n  ✅ ${upserted} scholarships upserted, ${errors} errors`)
}

async function seedMentors() {
  console.log(`\n👥 Seeding ${MENTORS.length} mentors...`)
  let upserted = 0, errors = 0

  for (const mentor of MENTORS) {
    const { error } = await supabase
      .from('mentors')
      .upsert(mentor, { onConflict: 'name' }) // Supposing name is unique for seeds

    if (error) {
      console.error(`  ❌ ${mentor.name}: ${error.message}`)
      errors++
    } else {
      upserted++
      process.stdout.write('.')
    }
  }

  console.log(`\n  ✅ ${upserted} mentors upserted, ${errors} errors`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Aage Kya? — Database Seed Script')
  console.log(`   Supabase: ${supabaseUrl}`)

  // Quick connectivity check
  const { error: pingErr } = await supabase.from('colleges').select('id').limit(1)
  if (pingErr) {
    console.error(`\n❌ Cannot connect to Supabase: ${pingErr.message}`)
    console.error('   Make sure you ran supabase_schema.sql in the Supabase SQL Editor first.')
    process.exit(1)
  }

  await seedColleges()
  await seedScholarships()
  await seedMentors()

  console.log('\n✅ Seed complete! Your RAG and Mentor data is ready.')
  console.log('   Restart the server and test GET /api/health to confirm.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

