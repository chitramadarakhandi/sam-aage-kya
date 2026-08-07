import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { runMultiAgentOrchestrator } from './agents/Orchestrator.js'
import { HISTORICAL_CUTOFFS } from './cutoffsData.js'
import { recommendPathways } from './ai/pathwayAdvisor.js'
import { getAiStatus, callLLM } from './ai/llmClient.js'
import { pickCollegeMatch, escapeIlikePattern } from './domain/colleges/matchCollegeName.js'
import {
  QUESTION_BANK,
  DOMAINS,
  scoreDomains,
  pickFollowUpQuestions,
} from './data/indiaPathways.js'

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const originalPort = process.env.PORT
dotenv.config({ path: path.join(__dirname, '.env'), override: true })
if (originalPort) {
  process.env.PORT = originalPort
}

const app = express()
app.set('trust proxy', 1) // Trust first proxy (Railway, Render, Vercel)

// CORS — allow origins from ALLOWED_ORIGINS env var (comma-separated)
// Falls back to all origins in development
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null

app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} not allowed`))
      }
    : true,
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import xss from 'xss'

// 1. HTTP Security Headers
app.use(helmet())

// 2. Global Rate Limiting (200 requests per 15 minutes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(globalLimiter)

// 3. XSS Input Sanitization Middleware
const sanitizeObject = (obj) => {
  if (typeof obj === 'string') return xss(obj)
  if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach((key) => {
      obj[key] = sanitizeObject(obj[key])
    })
  }
  return obj
}

app.use((req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body)
  if (req.query) req.query = sanitizeObject(req.query)
  if (req.params) req.params = sanitizeObject(req.params)
  next()
})

// Structured Logger Middleware
app.use((req, res, next) => {
  const start = Date.now()
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const authHeader = req.headers.authorization ? 'Yes' : 'No'
    console.log(`[${new Date().toISOString()}] INFO: ${req.method} ${req.originalUrl} from ${ip} - ${res.statusCode} (Latency: ${duration}ms) [Auth: ${authHeader}]`)
  })
  
  next()
})

// In-Memory Rate Limiter Store
const rateLimitStore = new Map() // key -> Array of timestamps

function createRateLimiter(limit, windowMs, message) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const key = `${ip}:${req.baseUrl || ''}${req.path}`
    const now = Date.now()
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, [])
    }
    
    let timestamps = rateLimitStore.get(key)
    timestamps = timestamps.filter(t => now - t < windowMs)
    rateLimitStore.set(key, timestamps)
    
    if (timestamps.length >= limit) {
      const oldestTimestamp = timestamps[0]
      const resetTimeMs = windowMs - (now - oldestTimestamp)
      const resetMinutes = Math.ceil(resetTimeMs / 60000)
      console.warn(`[${new Date().toISOString()}] WARN: Rate limit hit for ${key}. Limit: ${limit}/${windowMs}ms`)
      return res.status(429).json({
        error: 'RATE_LIMIT',
        message: message || `Too many requests. Please try again in ${resetMinutes} minute(s).`
      })
    }
    
    timestamps.push(now)
    next()
  }
}

const isDev = process.env.NODE_ENV !== 'production'
const guidanceLimiter = createRateLimiter(isDev ? 50 : 5, 86400000, "You can only generate 5 career guidance reports per day to prevent system abuse. Please try again tomorrow.")
const roadmapLimiter  = createRateLimiter(isDev ? 50 : 5, 86400000, "You can only generate 5 career roadmaps per day to prevent system abuse. Please try again tomorrow.")
const mentorApplyLimiter = createRateLimiter(isDev ? 50 : 3, 3600000, "You can only submit a few applications per hour. Please try again later.")
const transcribeLimiter  = createRateLimiter(15, 3600000, "You have exceeded the transcription rate limit. Please try again in an hour.")



const PORT = process.env.PORT || 5000

// Initialize Supabase Client (anon key — for auth token validation)
// Use a syntactically valid placeholder URL so createClient() never throws at
// startup when Supabase isn't configured. isSupabaseConfigured() still treats
// the placeholder as "not configured", so DB-backed features degrade gracefully
// instead of crashing the whole server.
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key'

let supabase = null
let supabaseAdmin = null
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
  // Admin Supabase client (service role key — bypasses RLS for aggregate queries)
  // SUPABASE_SERVICE_ROLE_KEY is optional; analytics endpoint disabled without it.
  supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null
} catch (err) {
  console.warn(`[startup] Supabase client not initialized: ${err.message}. DB-backed features will be disabled.`)
}

// Server-authored rows (guidance_results, roadmaps) are written with the
// service-role admin client — NEVER the user's bearer-scoped client — so a
// student token can never forge or tamper with AI-authored guidance. Falls
// back to the anon client only when no service role key is configured (dev).
const guidanceWriter = () => supabaseAdmin || supabase

// Consistent error for datastore failures so callers can fail loudly instead
// of silently swallowing DB errors.
function datastoreError(context, cause) {
  const err = new Error(`${context} failed: ${cause?.message || 'unknown datastore error'}`)
  err.code = 'DATASTORE_ERROR'
  err.cause = cause
  return err
}

class UnifiedAIClient {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY
    this.openaiApiKey = process.env.OPENAI_API_KEY
    if (!this.groqApiKey && !this.openaiApiKey) {
      throw new Error('NO_API_KEY')
    }
  }

  get chat() {
    return {
      completions: {
        create: async ({ model, messages, temperature, max_tokens, response_format }) => {
          let url, headers, bodyModel
          if (this.groqApiKey) {
            url = 'https://api.groq.com/openai/v1/chat/completions'
            headers = {
              'Authorization': `Bearer ${this.groqApiKey}`,
              'Content-Type': 'application/json'
            }
            bodyModel = model || 'llama-3.3-70b-versatile'
          } else {
            url = 'https://api.openai.com/v1/chat/completions'
            headers = {
              'Authorization': `Bearer ${this.openaiApiKey}`,
              'Content-Type': 'application/json'
            }
            bodyModel = 'gpt-4o-mini'
          }

          const body = {
            model: bodyModel,
            messages,
            temperature: temperature ?? 0.7,
            max_tokens: max_tokens ?? 2048,
          }

          if (response_format) {
            body.response_format = response_format
          }

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          })

          if (!response.ok) {
            const errText = await response.text()
            throw new Error(`AI API error (${response.status}): ${errText}`)
          }

          const data = await response.json()
          return {
            choices: [
              {
                message: {
                  content: data.choices[0].message.content
                }
              }
            ]
          }
        }
      }
    }
  }
}

// Initialize Groq client
const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    if (process.env.OPENAI_API_KEY) {
      return new UnifiedAIClient()
    }
    throw new Error('NO_API_KEY')
  }
  return new Groq({ apiKey })
}


// User-scoped Supabase client helper to respect Row Level Security (RLS)
function getSupabaseClient(authHeader) {
  if (authHeader) {
    const token = authHeader.split(' ')[1]
    if (token === 'demo-student-token' || token === 'demo-admin-token') {
      return supabaseAdmin || createClient(supabaseUrl, supabaseAnonKey)
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Resilient student profile upsert (prunes missing columns dynamically)
async function resilientUpsertStudent(client, studentData) {
  let { error } = await client.from('students').upsert(studentData)
  if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('class_level'))) {
    const allowedKeys = [
      'id', 'full_name', 'state', 'board', 'stream', 'marks', 
      'income_range', 'first_gen_college', 'preferred_cities', 
      'interests', 'biggest_fear', 'updated_at', 'role'
    ]
    const prunedData = {}
    for (const key of allowedKeys) {
      if (studentData[key] !== undefined) {
        prunedData[key] = studentData[key]
      }
    }
    const { error: retryError } = await client.from('students').upsert(prunedData)
    if (retryError) throw retryError
  } else if (error) {
    throw error
  }
}

// Retrieve authenticated user from Supabase token; also fetches role from students table
async function getAuthUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.split(' ')[1]

  // Developer/Demo bypass for local development or testing
  if (token === 'demo-student-token') {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo-student@aagekya.com',
      role: 'student',
      user_metadata: { user_type: 'student' }
    }
  }
  if (token === 'demo-admin-token') {
    return {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'demo-admin@aagekya.com',
      role: 'admin',
      user_metadata: { user_type: 'admin' }
    }
  }
  if (token === 'demo-mentor-token') {
    return {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'demo-mentor@aagekya.com',
      role: 'mentor',
      user_metadata: { user_type: 'mentor' }
    }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    // Attach role from students profile (defaults 'student' if row doesn't exist yet)
    try {
      const { data: profile } = await supabase
          .from('students')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
      user.role = profile?.role || 'student'
    } catch (_) {
      user.role = 'student'
    }
    return user
  } catch (err) {
    return null
  }
}

// Middleware: require a specific role (or any of a list of roles)
function requireRole(...roles) {
  return async (req, res, next) => {
    const user = await getAuthUser(req.headers.authorization)
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: `Requires role: ${roles.join(' or ')}` })
    }
    req.authUser = user
    next()
  }
}

// Middleware: require any authenticated user (student, mentor, parent)
function requireAuth() {
  return async (req, res, next) => {
    const user = await getAuthUser(req.headers.authorization)
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    req.authUser = user
    next()
  }
}

// Reuse labels from frontend structure
const INCOME_LABELS = {
  'below_2.5L': 'Below ₹2.5 Lakh/yr',
  '2.5L-5L':   '₹2.5L–₹5L/yr',
  '5L-10L':    '₹5L–₹10L/yr',
  'above_10L': 'Above ₹10L/yr',
}
const CITY_LABELS = {
  same_city: 'Same City',
  nearby:    'Nearby Cities',
  anywhere:  'Anywhere in India',
}
// Income upper bounds in lakh (for scholarship eligibility filtering)
const INCOME_TO_LAKH = {
  'below_2.5L': 2.5,
  '2.5L-5L':   5,
  '5L-10L':    10,
  'above_10L': 99,
}

// ─── RAG Helpers ──────────────────────────────────────────────────────────────

function isSupabaseConfigured() {
  return supabaseUrl && 
         !supabaseUrl.includes('your-supabase') && 
         !supabaseUrl.includes('your-project-ref') && 
         supabaseUrl !== 'https://your-project-ref.supabase.co'
}

// Fetch real colleges for this student from the DB
async function fetchCollegesForStudent(form) {
  if (!isSupabaseConfigured()) return []
  const marks        = Number(form.marks) || 0
  const stream       = form.stream || ''
  const state        = form.state  || ''
  const classLevel   = form.classLevel || 'class12'
  
  // New fields
  const preferredState = form.preferredState || ''
  const preferredCity  = (form.preferredCity  || '').trim().toLowerCase()
  const budget         = form.budget || ''
  const mode           = form.preferredModeOfAdmission || ''

  try {
    // Fetch all colleges matching this stream (GIN index makes this fast)
    const { data, error } = await supabase
      .from('colleges')
      .select('name, state, city, yearly_cost_min, yearly_cost_max, college_type, national, source_url, min_marks, max_marks')
      .contains('streams', [stream])

    if (error) { console.warn('College fetch warning:', error.message); return [] }

    const collegesWithScores = (data || []).map(c => {
      let score = 0

      // 1. Marks compatibility score (primary eligibility check)
      const isWithinRange = (c.min_marks <= marks + 15) && (c.max_marks >= marks - 10)
      if (!isWithinRange) {
        // Still compatible but penalized if outside marks compatibility band
        score -= 20
      } else {
        score += 15
        if (marks >= c.min_marks && marks <= c.max_marks) {
          score += 10 // Perfect fit
        }
      }

      // 2. Preferred State compatibility
      if (preferredState && preferredState !== 'Any State') {
        if (c.state === preferredState) {
          score += 25
        } else if (c.national) {
          score += 5 // National institutions are still good candidates
        } else {
          score -= 10 // Penalize if it doesn't match preferred state
        }
      } else {
        // Fallback to home state matching if no preferredState is specified
        if (c.state === state) {
          score += 10
        }
      }

      // 3. Preferred City compatibility
      if (preferredCity && preferredCity !== 'any') {
        const collegeCity = c.city.toLowerCase()
        if (collegeCity.includes(preferredCity) || preferredCity.includes(collegeCity)) {
          score += 25
        }
      }

      // 4. Budget Compatibility
      // Budget limits (INR per year)
      let budgetLimit = 9999999
      if (classLevel === 'class10') {
        if (budget === 'below_20k') budgetLimit = 20000
        else if (budget === '20k-60k') budgetLimit = 60000
        else if (budget === '60k-1.5L') budgetLimit = 150000
      } else {
        if (budget === 'below_1L') budgetLimit = 100000
        else if (budget === '1L-3L') budgetLimit = 300000
        else if (budget === '3L-6L') budgetLimit = 600000
      }

      // Compare college cost with budget limit
      if (c.yearly_cost_min > budgetLimit) {
        score -= 30 // Strong penalty if min cost exceeds budget
      } else if (c.yearly_cost_max <= budgetLimit) {
        score += 15 // Good fit: max cost is within budget
      } else {
        score += 5 // Partial fit: min is within, max exceeds
      }

      // 5. Preferred Mode of Admission / Target Exam compatibility (Class 12)
      if (classLevel === 'class12' && mode) {
        const nameUpper = c.name.toUpperCase()
        if (mode === 'JEE Advanced') {
          // IITs
          if (nameUpper.startsWith('IIT') || nameUpper.includes('INDIAN INSTITUTE OF TECHNOLOGY')) {
            score += 35
          } else {
            score -= 15
          }
        } else if (mode === 'JEE Main') {
          // NITs, IIITs, DTU, NSUT, or national-intake institutions
          if (nameUpper.includes('NIT') || nameUpper.includes('NATIONAL INSTITUTE OF TECHNOLOGY') || nameUpper.includes('IIIT') || nameUpper.includes('DTU') || nameUpper.includes('NSUT') || c.national) {
            score += 35
          }
        } else if (mode === 'NEET') {
          // Medical institutions
          if (nameUpper.includes('AIIMS') || nameUpper.includes('MEDICAL') || nameUpper.includes('JIPMER') || nameUpper.includes('CMC') || nameUpper.includes('MEDICINE') || stream === 'Science (PCB)') {
            score += 35
          }
        } else if (mode === 'KCET') {
          // Karnataka state colleges
          if (c.state === 'Karnataka') {
            score += 35
          } else {
            score -= 15
          }
        } else if (mode === 'COMEDK') {
          // Karnataka private/deemed colleges
          if (c.state === 'Karnataka' && (c.college_type === 'private' || c.college_type === 'deemed')) {
            score += 35
          } else {
            score -= 15
          }
        } else if (mode === 'CUET') {
          // Central universities (Arts/Commerce focus or Central college type)
          if (c.college_type === 'central' || nameUpper.includes('COLLEGE DELHI') || nameUpper.includes('UNIVERSITY OF DELHI') || nameUpper.includes('JNU') || nameUpper.includes('BHU')) {
            score += 35
          }
        } else if (mode === 'Management Quota') {
          // Private / Deemed colleges
          if (c.college_type === 'private' || c.college_type === 'deemed') {
            score += 25
          }
        } else if (mode === 'State CET') {
          // State government colleges matching preferred or home state
          if (c.college_type === 'state' && (c.state === preferredState || c.state === state)) {
            score += 35
          }
        } else if (mode === 'Diploma Lateral Entry') {
          // State/private colleges accepting lateral entry
          if (c.college_type === 'state' || c.college_type === 'private') {
            score += 20
          }
        }
      }

      return { college: c, score }
    })

    // Filter, sort by score descending, and slice top 15
    return collegesWithScores
      .filter(x => x.score >= -10) // Filter out extremely poor fits
      .sort((a, b) => b.score - a.score)
      .map(x => x.college)
      .slice(0, 15)

  } catch (err) {
    console.warn('College fetch failed:', err.message)
    return []
  }
}

// Fetch relevant scholarships for this student from the DB
async function fetchScholarshipsForStudent(form) {
  if (!isSupabaseConfigured()) return []
  const marks       = Number(form.marks) || 0
  const incomeLakh  = INCOME_TO_LAKH[form.incomeRange] || 99
  const stream      = form.stream || ''
  const state       = form.state  || ''

  try {
    const { data, error } = await supabase
      .from('scholarships')
      .select('name, description, application_url, deadline_pattern, eligibility_marks_min, eligibility_income_max_lakh, eligible_streams, eligible_states')

    if (error) { console.warn('Scholarship fetch warning:', error.message); return [] }

    return (data || []).filter(s => {
      const streams = s.eligible_streams || []
      const states  = s.eligible_states  || []
      const streamOk = streams.includes('All') || streams.length === 0 || streams.includes(stream)
      const stateOk  = states.includes('All')  || states.length === 0  || states.includes(state)
      const marksOk  = (s.eligibility_marks_min || 0) <= marks
      const incomeOk = (s.eligibility_income_max_lakh || 99) >= incomeLakh
      return streamOk && stateOk && marksOk && incomeOk
    }).slice(0, 8)
  } catch (err) {
    console.warn('Scholarship fetch failed:', err.message)
    return []
  }
}

// Format colleges as a numbered text block for injection into the prompt
function formatCollegesForPrompt(colleges) {
  if (!colleges.length) return ''
  return colleges.map((c, i) => {
    const costMin = Math.round(c.yearly_cost_min / 1000)
    const costMax = Math.round(c.yearly_cost_max / 1000)
    return `${i + 1}. ${c.name} (${c.city}, ${c.state}) | ₹${costMin}K–₹${costMax}K/yr | ${c.college_type} | Entry ~${c.min_marks}%+`
  }).join('\n')
}

// Format scholarships as a numbered text block for injection into the prompt
function formatScholarshipsForPrompt(scholarships) {
  if (!scholarships.length) return ''
  return scholarships.map((s, i) => {
    const desc = s.description.length > 100 ? s.description.slice(0, 100) + '…' : s.description
    return `${i + 1}. ${s.name}: ${desc} | Apply: ${s.application_url}`
  }).join('\n')
}

// Build a lookup map: college name → { source_url, yearly_cost_min, yearly_cost_max, city }
function buildCollegesDataMap(colleges) {
  const map = {}
  for (const c of colleges) {
    map[c.name] = {
      source_url:      c.source_url,
      yearly_cost_min: c.yearly_cost_min,
      yearly_cost_max: c.yearly_cost_max,
      city:            c.city,
      state:           c.state,
      college_type:    c.college_type,
    }
  }
  return map
}

// Find the scholarship object whose name best matches what Gemini chose
function matchScholarship(scholarships, chosenName) {
  if (!chosenName || !scholarships.length) return null
  const lower = chosenName.toLowerCase()
  // Exact match first
  let match = scholarships.find(s => s.name.toLowerCase() === lower)
  if (match) return match
  // Partial match — find the one with the most word overlap
  const words = lower.split(/\s+/).filter(w => w.length > 3)
  let best = null, bestScore = 0
  for (const s of scholarships) {
    const sLower = s.name.toLowerCase()
    const score = words.filter(w => sLower.includes(w)).length
    if (score > bestScore) { bestScore = score; best = s }
  }
  return bestScore > 0 ? best : scholarships[0] // fallback to first if no match
}

const BUDGET_LABELS_10 = {
  'below_20k': 'Below ₹20,000 / year (Highly Affordable / Govt)',
  '20k-60k': '₹20,000 – ₹60,000 / year (Moderate / Private School)',
  '60k-1.5L': '₹60,000 – ₹1.5 Lakh / year (Private School + Tuition)',
  'above_1.5L': 'Above ₹1.5 Lakh / year (No budget constraint)'
}

const BUDGET_LABELS_12 = {
  'below_1L': 'Below ₹1 Lakh / year (Highly Subsidised / Govt)',
  '1L-3L': '₹1 Lakh – ₹3 Lakh / year (Moderate / State colleges)',
  '3L-6L': '₹3 Lakh – ₹6 Lakh / year (Premium / Private colleges)',
  'above_6L': 'Above ₹6 Lakh / year (No budget constraint)'
}

// Onboarding Prompt Builder (now accepts real DB data for RAG grounding)
function buildPrompt(form, colleges = [], scholarships = []) {
  const income   = INCOME_LABELS[form.incomeRange] || form.incomeRange || 'Not specified'
  const cities   = (form.preferredCities || []).map((c) => CITY_LABELS[c] || c).join(', ') || 'Not specified'
  const firstGen = form.firstGenCollege === true ? 'Yes' : form.firstGenCollege === false ? 'No' : 'Not specified'
  const classLevel = form.classLevel || 'class12'

  if (classLevel === 'class10') {
    const parentPressureText = form.parentPressure === true
      ? `Yes (Notes: ${form.parentExpectations || 'None'})`
      : 'No'
    const coachingAccessText = form.coachingAccess === true ? 'Yes' : 'No'
    const budgetText = BUDGET_LABELS_10[form.budget] || form.budget || 'Not specified'
    
    return `You are an honest, caring guide for Indian students after 10th grade. Give REAL, specific advice. Not generic. Not motivational fluff.

Student Profile (Class 10 Student):
- Board: ${form.board || 'Not specified'}
- Marks (9th/10th Pre-boards): ${form.marks || 'Not specified'}%
- Home State: ${form.state || 'Not specified'}
- Family Income: ${income}
- First Generation College Student: ${firstGen}
- Location Constraints/Preferences: ${cities}
- Preferred Study State: ${form.preferredState || 'Not specified'}
- Preferred Study City: ${form.preferredCity || 'Not specified'}
- Preferred Annual School & Coaching Budget: ${budgetText}
- Favorite Subjects & School Topics: ${form.favoriteSubjects || 'Not specified'}
- Hobbies & General Interests: ${form.interests || 'Not specified'} (Stream leaning: ${form.stream || 'Undecided'})
- Long-term Career Goals & Dreams: ${form.careerGoals || 'Not specified'}
- Parent Pressure/Expectations: ${parentPressureText}
- Risk Comfort (Safe vs Exploratory): ${form.riskComfort || 'Not specified'}
- Coaching Access Nearby: ${coachingAccessText}
- Biggest Fear about Stream Selection: ${form.biggestFear || 'Not specified'}

Recommend 3-4 specific high school stream or education tracks that fit this student's profile. Choose from:
- Science (PCM) — Physics, Chemistry, Maths — leads to JEE/engineering
- Science (PCB) — Physics, Chemistry, Biology — leads to NEET/medicine
- Science (PCMB) — all four sciences — maximum flexibility
- Commerce — Accounts, Business Studies, Economics — leads to BBA/CA/finance
- Arts / Humanities — History, Political Science, Psychology — leads to BA/law/civil services
- Diploma / Polytechnic — 3-year technical diploma after 10th, leads to direct technical jobs or lateral entry to B.Tech
- ITI / Vocational — Government ITI trades (electrician, fitter, COPA, etc.) — leads to skilled trade jobs, apprenticeships
Only recommend streams that genuinely fit this student's profile.

CRITICAL STREAM ALIGNMENT RULE:
- Technical 'Diploma / Polytechnic' programs (leading to B.Tech) are engineering/maths-focused. If a student is interested in Biology, Medicine, or Healthcare, do NOT recommend standard engineering diplomas as aligning with their bio interest. 
- If you recommend a diploma for a biology-interested student, explicitly guide them toward medical/biological vocational diplomas (like DMLT — Diploma in Medical Laboratory Technology, or Diploma in Agriculture/Veterinary) and warn them that a standard polytechnic diploma is an engineering path, not a medical one.
- Remind them that MBBS/MD or B.Pharm requires Class 12 Science (PCB/PCMB) rather than standard polytechnic diplomas.

CRITICAL for avg_yearly_coaching_cost: This is NOT college tuition. This is the realistic yearly cost for Class 11/12 school fees PLUS any coaching or tuition classes. Typical realistic ranges:
- Government school + no coaching: ₹5,000–₹20,000/yr
- Private school + local tuition: ₹40,000–₹1,20,000/yr  
- Private school + JEE/NEET coaching: ₹80,000–₹2,50,000/yr
- Diploma/ITI programs: ₹10,000–₹60,000/yr
Do NOT return college-level fees (₹3L–₹15L) for this field.

Respond ONLY in this exact JSON structure (no markdown, no backticks, just raw JSON):
{
  "summary": "A warm, honest 2-3 sentence summary of this student's current situation and core choices. Be specific to their marks, interests, and parental expectations.",
  "options": [
    {
      "path": "Stream option name (e.g. Science (PCM), Diploma / Polytechnic)",
      "honest_take": "2-3 sentences of brutally honest, specific advice for THIS Class 10 student. Explain why this fits their interests/risk/marks, and the difficulty level.",
      "requires_entrance_exam": "Entrance exams they will face post-12th if they choose this stream (e.g. JEE Main, NEET-UG, CLAT, NATA, Polytechnic CET, or None) — be specific",
      "realistic_colleges": ["3-4 target institutions or pathways they should aim for in future based on this stream"],
      "avg_yearly_cost": "Realistic yearly cost for Class 11/12 school + coaching/tuition only (NOT college fees). Format: ₹X–₹Y/yr. Stay within ₹5,000–₹2,50,000 range.",
      "opens_doors_to": ["3-4 specific future degrees or career roles this stream leads to"],
      "watch_out_for": "One specific, honest warning/pitfall about this stream path",
      "backup_plan": "A practical backup plan if they find the stream too difficult in Class 11/12 or change their mind"
    }
  ],
  "scholarship_to_check": "Name of a relevant scholarship they can check (or search on National Scholarship Portal)",
  "one_thing_to_do_this_week": "One actionable task they must do this week to validate this choice"
}
`
  }

  // Class 12 prompt logic:
  const entranceExamContext = ''
  const grounded = colleges.length > 0 || scholarships.length > 0
  const budgetText = BUDGET_LABELS_12[form.budget] || form.budget || 'Not specified'

  const collegesSection = colleges.length > 0
    ? `\nVERIFIED COLLEGE LIST for this student (stream: ${form.stream}, state: ${form.state}, marks: ${form.marks}%):\n${formatCollegesForPrompt(colleges)}\n`
    : ''

  const scholarshipsSection = scholarships.length > 0
    ? `\nVERIFIED SCHOLARSHIPS this student qualifies for:\n${formatScholarshipsForPrompt(scholarships)}\n`
    : ''

  const groundingInstruction = grounded
    ? `\nCRITICAL INSTRUCTIONS:\n- For "realistic_colleges": ONLY recommend college names from the VERIFIED COLLEGE LIST above. Do NOT invent college names not in that list. Pick the most relevant ones for each career option.\n- For "scholarship_to_check": use the name of ONE scholarship from the VERIFIED SCHOLARSHIPS list above, the one most relevant to this student.\n- For "avg_yearly_cost": use the cost ranges from the verified college list, don't invent figures.\n`
    : ''

  return `You are an honest, caring guide for Indian students after 12th grade. Give REAL, specific advice. Not generic. Not motivational fluff.

Student Profile:
- Board: ${form.board || 'Not specified'}
- Stream: ${form.stream || 'Not specified'}
- Marks: ${form.marks || 'Not specified'}%
- Home State: ${form.state || 'Not specified'}
- Family Income: ${income}
- First Generation College Student: ${firstGen}
- Preferred Location/Constraint: ${cities}
- Preferred Study State: ${form.preferredState || 'Not specified'}
- Preferred Study City: ${form.preferredCity || 'Not specified'}
- Preferred Annual College Fee Budget: ${budgetText}
- Preferred Mode of Admission / Target Exam: ${form.preferredModeOfAdmission || 'Not specified'}
- Interests: ${form.interests || 'Not specified'}
- Biggest Fear: ${form.biggestFear || 'Not specified'}
${entranceExamContext}
${collegesSection}${scholarshipsSection}${groundingInstruction}
Respond ONLY in this exact JSON structure (no markdown, no backticks, just raw JSON):
{
  "summary": "A warm, honest 2-3 sentence summary of this student's situation. Be specific to their actual marks and stream. If they are PCB without NEET prep, acknowledge that MBBS is not in the picture right now and that's okay — there are great alternatives.",
  "options": [
    {
      "path": "Career / course path name",
      "honest_take": "2-3 sentences of brutally honest, specific advice for THIS student. If this path requires a competitive entrance exam, say exactly which exam, how competitive it is, and what they'd need to do. If it is direct admission, say so clearly.",
      "requires_entrance_exam": "NEET-UG / JEE Main / JEE Advanced / State CET / CLAT / None — be specific",
      "realistic_colleges": ["3-4 real colleges realistic for this option and the student's marks and state. Use verified list if provided. Heavily prioritize colleges matching their preferred mode of admission and budget."],
      "avg_yearly_cost": "Realistic total yearly cost range in INR/year (tuition + hostel + misc)",
      "opens_doors_to": ["3-4 specific career roles or further study options this path leads to"],
      "watch_out_for": "One specific, honest warning — what most people don't tell you about this path",
      "backup_plan": "A practical backup plan if they find college entry too competitive or fail key exams (e.g. switching from BTech to BCA, or from NEET to BSc Nursing)"
    }
  ],
  "scholarship_to_check": "Name of a relevant scholarship they can check",
  "one_thing_to_do_this_week": "One actionable task they must do this week"
}`
}

// Roadmap Prompt Builder
function buildRoadmapPrompt(form, option) {
  const income  = INCOME_LABELS[form.incomeRange] || form.incomeRange || 'Not specified'
  const cities  = (form.preferredCities || []).map((c) => CITY_LABELS[c] || c).join(', ') || 'Not specified'
  const firstGen = form.firstGenCollege === true ? 'Yes' : form.firstGenCollege === false ? 'No' : 'Not specified'
  const classLevel = form.classLevel || 'class12'

  const budgetText = classLevel === 'class10'
    ? (BUDGET_LABELS_10[form.budget] || form.budget || 'Not specified')
    : (BUDGET_LABELS_12[form.budget] || form.budget || 'Not specified')

  const customInstruction = classLevel === 'class10'
    ? `Since the student is in Class 10 choosing a stream, generate a detailed 4-year learning, skill, exam, and preparation roadmap.
The years MUST represent:
- Year 1: Class 11 (Focus on stream mastery, basic concepts, early certifications/courses, and building foundational skills)
- Year 2: Class 12 (Focus on Board prep, final mock tests for entrance exams, simple projects/coding/design challenges)
- Year 3: College Year 1 (Focus on early college adaptation, starting personal projects, joining community and coding clubs)
- Year 4: College Year 2 (Focus on advanced skill acquisition, early internship hunting, and open source/portfolio building)`
    : `Generate a detailed 4-year learning, skill, project, and certification roadmap to achieve a career as a "${option.path}" (Honest Take context: ${option.honest_take}).
The years represent College Year 1, 2, 3, and 4.`

  return `You are an expert career counsellor, mentor, and academic advisor for Indian students.
${customInstruction}
Tailor this roadmap specifically to this student's profile:
- Board: ${form.board || 'Not specified'}
- Marks: ${form.marks || 'Not specified'}%
- Home State: ${form.state || 'Not specified'}
- Family Income: ${income}
- First Generation College Student: ${firstGen}
- Preferred Study Location: ${cities}
- Preferred Study State: ${form.preferredState || 'Not specified'}
- Preferred Study City: ${form.preferredCity || 'Not specified'}
- Preferred Fee Budget: ${budgetText}
- Interests & Hobbies: ${form.interests || 'Not specified'}
- Biggest Fear: ${form.biggestFear || 'Not specified'}
${classLevel === 'class10'
  ? `- Favorite Subjects: ${form.favoriteSubjects || 'Not specified'}\n- Career Goals: ${form.careerGoals || 'Not specified'}\n- Leaning Stream: ${form.stream || 'Undecided'}`
  : `- Preferred Mode of Admission / Entrance Exam: ${form.preferredModeOfAdmission || 'Not specified'}\n- Career Path Leaning: ${option.path}`
}

Income-Based Customization:
If family income is low (e.g. Below 2.5L or 2.5-5L), prioritize free/affordable learning resources, certifications (like Google Career Certificates on Coursera with financial aid, NPTEL/Swayam which is free/low cost in India, FreeCodeCamp), and open-source contributions. Avoid expensive bootcamps or paid certifications.

Academic Customization:
If marks are low (below 75%), focus the advice on building a strong portfolio, networking on LinkedIn, off-campus placements, or stable alternative pathways.

Biggest Fear Customization:
Integrate specific activities or milestones directly addressing their biggest fear during these 4 years.

Respond ONLY in this exact JSON structure (no markdown, no backticks, just raw JSON):
{
  "career_path": "${option.path}",
  "overview": "A warm, honest 2-3 sentence overview of this 4-year skill-building journey tailored to their stream, marks, and constraints. Be highly specific.",
  "years": [
    {
      "year": 1,
      "focus": "Theme/focus of Year 1",
      "skills": ["3-4 specific skills to master this year"],
      "certifications": ["1-2 specific, highly valuable certifications to aim for"],
      "internships_projects": ["2 specific, practical projects or open-source tasks to complete"],
      "milestones": ["2 key milestones to achieve by the end of Year 1"]
    },
    {
      "year": 2,
      "focus": "Theme/focus of Year 2",
      "skills": ["3-4 specific skills"],
      "certifications": ["1-2 certifications"],
      "internships_projects": ["2 specific projects, internships, or open-source tasks"],
      "milestones": ["2 key milestones"]
    },
    {
      "year": 3,
      "focus": "Theme/focus of Year 3",
      "skills": ["3-4 specific skills"],
      "certifications": ["1-2 certifications"],
      "internships_projects": ["2 specific projects, internships, or open-source tasks"],
      "milestones": ["2 key milestones"]
    },
    {
      "year": 4,
      "focus": "Theme/focus of Year 4",
      "skills": ["3-4 specific skills"],
      "certifications": ["1-2 certifications"],
      "internships_projects": ["2 specific projects, internships, or open-source tasks"],
      "milestones": ["2 key milestones"]
    }
  ]
}`
}

// Compute AI confidence score from form field completeness
function computeConfidence(form) {
  const KEY_FIELDS = ['fullName', 'state', 'board', 'stream', 'marks', 'incomeRange', 'firstGenCollege', 'preferredCities', 'interests', 'biggestFear']
  const filled = KEY_FIELDS.filter(k => {
    const v = form[k]
    if (v === null || v === undefined) return false
    if (typeof v === 'string') return v.trim().length > 3
    if (Array.isArray(v)) return v.length > 0
    return true
  }).length
  const score = Math.round((filled / KEY_FIELDS.length) * 100)
  const label = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const reason = score >= 80
    ? 'All key details provided — recommendation is well-tailored.'
    : score >= 50
    ? 'Some details missing — guidance is good but could improve with more context.'
    : 'Several fields are incomplete — filling them in will significantly improve accuracy.'
  return { confidence_score: score, confidence_label: label, confidence_reason: reason }
}

function getMockRoadmap(form, option) {
  const pathName = option?.path || 'Selected Career'
  return {
    career_path: pathName,
    overview: `A realistic 4-year plan to excel in ${pathName}, designed around your academic level (${form?.marks || '85'}%) and financial considerations.`,
    years: [
      {
        year: 1,
        focus: "Fundamentals & Basic Foundations",
        skills: ["Fundamental Concepts", "Essential Tools & Frameworks", "Basic Coding/Analysis"],
        certifications: ["Introductory Free Course Certificate (Coursera/freeCodeCamp)"],
        internships_projects: ["Personal portfolio website", "Small static data analysis project"],
        milestones: ["Master basic command line and version control", "Build 2 small personal projects"]
      },
      {
        year: 2,
        focus: "Intermediate Skills & Collaboration",
        skills: ["Advanced Tools", "Database Management / SQL", "Technical Writing"],
        certifications: ["Google Career Certificate / NPTEL Swayam Certificate"],
        internships_projects: ["Collaborative open-source contribution", "Medium-sized full-stack application"],
        milestones: ["Build a LinkedIn presence", "Get first freelance gig or hackathon participation"]
      },
      {
        year: 3,
        focus: "Specialisation & Practical Internships",
        skills: ["Advanced Architecture", "System Design", "Cloud Computing Basics"],
        certifications: ["AWS Cloud Practitioner or equivalent specialization"],
        internships_projects: ["2-month summer internship in a local startup", "Live project with active users"],
        milestones: ["Secure a paid summer internship", "Achieve 500+ connections on professional networks"]
      },
      {
        year: 4,
        focus: "Graduation & Industry Transition",
        skills: ["Placement Preparation", "Advanced Interview Coding/Cases", "Negotiation Skills"],
        certifications: ["Final Capstone Project Credential"],
        internships_projects: ["Major graduation project", "Production-level deployment of an app"],
        milestones: ["Secure a pre-placement offer (PPO) or clear target exams", "Graduate with a strong resume and portfolio"]
      }
    ]
  }
}

// --- Endpoints ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// AI availability — lets the frontend show an honest "AI busy" banner instead
// of silently serving sample data when the token quota is exhausted.
app.get('/api/ai-status', (req, res) => {
  res.json(getAiStatus())
})

// ─── Rank Predictor (Historical Cutoff Comparison) ───────────────────────────
// Data source: server/cutoffsData.js (HISTORICAL_CUTOFFS)
// These endpoints power src/components/RankPredictor.jsx.
// NOTE: Labels compare a rank against the latest stored closing rank. They are
// historical comparisons, NOT calibrated admission probabilities.

// Default category per exam, used as a fallback when the requested category
// has no rows for a given college/course.
const DEFAULT_CATEGORY = { KCET: 'GM', JEE: 'General', NEET: 'General' }

// Group flat cutoff rows into { college_name, course, trends: [{year, closing_rank}] }
// filtered by exam + category (with graceful fallback to the exam default category).
function buildCutoffGroups(exam, category) {
  const examRows = HISTORICAL_CUTOFFS.filter(
    (r) => r.exam === (exam || '').toUpperCase()
  )
  const fallbackCategory = DEFAULT_CATEGORY[(exam || '').toUpperCase()] || 'General'

  const groups = new Map()
  for (const row of examRows) {
    const key = `${row.college_name}||${row.course}`
    if (!groups.has(key)) {
      groups.set(key, {
        college_name: row.college_name,
        course: row.course,
        rowsByCategory: {},
      })
    }
    const g = groups.get(key)
    if (!g.rowsByCategory[row.category]) g.rowsByCategory[row.category] = []
    g.rowsByCategory[row.category].push(row)
  }

  const result = []
  for (const g of groups.values()) {
    // Pick requested category, else fall back to the exam default.
    let rows = g.rowsByCategory[category]
    if (!rows || rows.length === 0) rows = g.rowsByCategory[fallbackCategory]
    if (!rows || rows.length === 0) continue

    const trends = rows
      .map((r) => ({ year: r.year, closing_rank: r.closing_rank }))
      .sort((a, b) => a.year - b.year)

    result.push({
      college_name: g.college_name,
      course: g.course,
      trends,
      latest_closing_rank: trends[trends.length - 1].closing_rank,
    })
  }
  return result
}

// Classify a rank against the latest closing rank (not a probability).
function classifyLikelihood(rank, latestClosingRank) {
  if (rank <= latestClosingRank * 0.8) return 'Well within latest cutoff'
  if (rank <= latestClosingRank) return 'Within latest cutoff'
  if (rank <= latestClosingRank * 1.15) return 'Near latest cutoff'
  return 'Outside latest cutoff'
}

// GET /api/predictor/options?exam=JEE — unique colleges + courses-per-college
// (for the simulator dropdowns)
app.get('/api/predictor/options', (req, res) => {
  const exam = (req.query.exam || 'JEE').toString().toUpperCase()
  const rows = HISTORICAL_CUTOFFS.filter((r) => r.exam === exam)
  const colleges = [...new Set(rows.map((r) => r.college_name))].sort()
  const courses = [...new Set(rows.map((r) => r.course))].sort()

  // Map each college to the courses it offers, so the frontend can populate the
  // course dropdown instantly without an extra request.
  const collegeCourses = {}
  for (const r of rows) {
    if (!collegeCourses[r.college_name]) collegeCourses[r.college_name] = new Set()
    collegeCourses[r.college_name].add(r.course)
  }
  const collegeCoursesObj = {}
  for (const [c, set] of Object.entries(collegeCourses)) {
    collegeCoursesObj[c] = [...set].sort()
  }

  res.json({ exam, colleges, courses, collegeCourses: collegeCoursesObj })
})

// GET /api/predictor/predict?exam=JEE&rank=1500&category=General&state=...
// Reverse finder — returns matching college/course options for a rank.
app.get('/api/predictor/predict', (req, res) => {
  const exam = (req.query.exam || 'JEE').toString().toUpperCase()
  const category = (req.query.category || DEFAULT_CATEGORY[exam] || 'General').toString()
  const rank = parseInt(req.query.rank, 10)

  if (!rank || isNaN(rank) || rank < 1) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid positive rank is required.' })
  }

  const groups = buildCutoffGroups(exam, category)

  // Keep options that are realistically relevant to this rank (within ~2x the
  // latest closing rank), so the list stays meaningful instead of dumping every
  // college. Sort best-fit (lowest closing rank) first.
  const results = groups
    .filter((g) => rank <= g.latest_closing_rank * 2)
    .sort((a, b) => a.latest_closing_rank - b.latest_closing_rank)
    .map((g) => ({
      college_name: g.college_name,
      course: g.course,
      trends: g.trends,
      likelihood: classifyLikelihood(rank, g.latest_closing_rank),
    }))

  res.json({ exam, category, rank, results })
})

// GET /api/predictor/simulate?college=..&course=..&exam=..&rank=..&category=..
// Compare a single college/course option against the user's rank.
app.get('/api/predictor/simulate', (req, res) => {
  const exam = (req.query.exam || 'JEE').toString().toUpperCase()
  const category = (req.query.category || DEFAULT_CATEGORY[exam] || 'General').toString()
  const rank = parseInt(req.query.rank, 10)
  const college = (req.query.college || '').toString()
  const course = (req.query.course || '').toString()

  if (!rank || isNaN(rank) || rank < 1) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid positive rank is required.' })
  }
  if (!college || !course) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'college and course are required.' })
  }

  const groups = buildCutoffGroups(exam, category)
  const match = groups.find(
    (g) => g.college_name === college && g.course === course
  )

  if (!match) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'No historical data for that college/course combination.' })
  }

  res.json({
    college: match.college_name,
    course: match.course,
    trends: match.trends,
    likelihood: classifyLikelihood(rank, match.latest_closing_rank),
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  PATHWAY ADVISOR — adaptive questionnaire + anti-hallucination recommender
//  Powers the "I don't know what to pick" discovery flow (all-India, all domains)
// ═══════════════════════════════════════════════════════════════════════════

// Resolve + validate a classLevel value, warning (not throwing) when it's
// missing or invalid so callers still get a sensible default response.
function resolveClassLevel(classLevel, routeLabel) {
  if (classLevel === 'class10' || classLevel === 'class12') return classLevel
  if (!classLevel) {
    console.warn(`[PathwayAdvisor] ${routeLabel} called with no classLevel param — defaulting to class12. This should be treated as a bug in the caller, not silently accepted long-term.`)
  } else {
    console.warn(`[PathwayAdvisor] ${routeLabel} called with invalid classLevel="${classLevel}" — defaulting to class12.`)
  }
  return 'class12'
}

// GET /api/pathways/questions/start — the first (broad) round of yes/no questions
app.get('/api/pathways/questions/start', (req, res) => {
  const resolvedClassLevel = resolveClassLevel(req.query.classLevel, 'GET /api/pathways/questions/start')
  res.json({
    stage: 'broad',
    classLevel: resolvedClassLevel,
    instructions: 'Answer Yes / No / Not sure. There are no wrong answers.',
    domains: DOMAINS,
    questions: (QUESTION_BANK.broad[resolvedClassLevel] || QUESTION_BANK.broad.class12).map((q) => ({ id: q.id, text: q.text })),
  })
})

// POST /api/pathways/questions/next — given broad answers, return focused follow-ups
// body: { answers: [{ questionId, answer }], classLevel }
app.post('/api/pathways/questions/next', (req, res) => {
  const answers = Array.isArray(req.body.answers) ? req.body.answers : []
  if (answers.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'answers array required' })
  }
  const resolvedClassLevel = resolveClassLevel(req.body.classLevel, 'POST /api/pathways/questions/next')
  const { ranked } = scoreDomains(answers, resolvedClassLevel)
  const followUps = pickFollowUpQuestions(ranked, 4, resolvedClassLevel)
  res.json({
    stage: 'focused',
    classLevel: resolvedClassLevel,
    topDomains: ranked.slice(0, 5),
    questions: followUps.map((q) => ({ id: q.id, text: q.text })),
    done: followUps.length === 0,
  })
})

// POST /api/pathways/recommend — full agentic recommendation (retrieve→LLM→verify)
// body: { formData: {...}, answers: [{ questionId, answer }] }
const pathwayLimiter = createRateLimiter(30, 3600000, 'Too many recommendation requests. Please wait a bit.')
app.post('/api/pathways/recommend', pathwayLimiter, async (req, res) => {
  try {
    const formData = req.body.formData || {}
    const answers = Array.isArray(req.body.answers) ? req.body.answers : []
    const useJudge = req.body.useJudge === true // optional decoupled LLM fact-check
    const result = await recommendPathways(formData, answers, { useJudge })
    res.json(result)
  } catch (err) {
    console.error('[PathwayAdvisor] error:', err.message)
    if (err.message === 'NO_API_KEY') {
      return res.status(401).json({ error: 'NO_API_KEY', message: 'AI key missing' })
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

const validateGuidanceBody = (req, res, next) => {
  if (!req.body.formData) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing formData' })
  }
  next()
}

// Guidance Results Endpoint (Phase 3: RAG-grounded)
app.post('/api/guidance', validateGuidanceBody, guidanceLimiter, async (req, res) => {
  try {
    const { formData } = req.body


    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)

    if (user) {
      const client = getSupabaseClient(authHeader)

      // Fetch the stored student profile so we can tell whether the incoming
      // answers still match what generated the cached guidance.
      const { data: storedStudent } = await client
        .from('students')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      // Only reuse cached guidance if the student's key answers are unchanged.
      // Otherwise the user re-did onboarding with new answers and expects fresh
      // guidance (this was the "results ignore my new query" bug).
      const answersUnchanged = storedStudent && (
        (storedStudent.stream || '') === (formData.stream || '') &&
        Number(storedStudent.marks || 0) === (Number(formData.marks) || 0) &&
        (storedStudent.interests || '') === (formData.interests || '') &&
        (storedStudent.class_level || 'class12') === (formData.classLevel || 'class12') &&
        (storedStudent.state || '') === (formData.state || '') &&
        (storedStudent.income_range || '') === (formData.incomeRange || '')
      )

      // Check if guidance results are already cached in DB
      const { data: cached, error: cacheError } = answersUnchanged
        ? await client
            .from('guidance_results')
            .select('*')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null, error: null }
      if (cacheError) throw datastoreError('Guidance cache lookup', cacheError)

      if (cached) {
        // Fetch matching scholarships for the student dynamically to show the list
        const student = storedStudent

        let scholarships_list = []
        if (student) {
          const mappedForm = {
            stream: student.stream,
            state: student.state,
            marks: student.marks,
            incomeRange: student.income_range
          }
          const scholarships = await fetchScholarshipsForStudent(mappedForm)
          scholarships_list = scholarships.map(s => ({
            name: s.name,
            application_url: s.application_url,
            deadline_pattern: s.deadline_pattern,
            description: s.description,
          }))
        }

        return res.json({
          summary: cached.summary,
          options: cached.options,
          scholarship_to_check: cached.scholarship_to_check,
          one_thing_to_do_this_week: cached.one_thing_to_do_this_week,
          cached: true,
          grounded: false, // cached results predate the RAG enrichment
          scholarships_list
        })
      }
    }

    // ── Phase 3: Run the Multi-Agent Orchestrator ──────────────────────────
    const confidence = computeConfidence(formData)
    console.log(`[Multi-Agent] Running state graph orchestrator for ${formData.fullName || 'student'}`)
    const agentResult = await runMultiAgentOrchestrator(formData)

    const matchedScholarship = (agentResult.scholarships_list || []).find(s => s.name === agentResult.scholarship_to_check)
    const scholarship_data = matchedScholarship
      ? {
          name:             matchedScholarship.name,
          application_url:  matchedScholarship.application_url,
          deadline_pattern: matchedScholarship.deadline_pattern,
          description:      matchedScholarship.description,
        }
      : null

    // Save to DB if authenticated
    if (user) {
      const client = getSupabaseClient(authHeader)
      // Save student profile
      await resilientUpsertStudent(client, {
        id: user.id,
        full_name: formData.fullName || '',
        state: formData.state || '',
        board: formData.board || '',
        stream: formData.stream || '',
        marks: Number(formData.marks) || 0,
        income_range: formData.incomeRange || '',
        first_gen_college: formData.firstGenCollege === true,
        preferred_cities: formData.preferredCities || [],
        interests: formData.interests || '',
        biggest_fear: formData.biggestFear || '',
        class_level: formData.classLevel || 'class12',
        parent_pressure: formData.parentPressure === true,
        parent_expectations: formData.parentExpectations || '',
        risk_comfort: formData.riskComfort || '',
        coaching_access: formData.coachingAccess === true,
        updated_at: new Date().toISOString()
      })

      // Save results using the service-role writer (server-authored rows must
      // never be mutable by a student's bearer-scoped client).
      const admin = guidanceWriter()
      const { error: guidanceWriteError } = await admin.from('guidance_results').insert({
        student_id: user.id,
        summary: agentResult.summary,
        options: agentResult.options,
        scholarship_to_check: agentResult.scholarship_to_check,
        one_thing_to_do_this_week: agentResult.one_thing_to_do_this_week,
        confidence_score: confidence.confidence_score,
        confidence_label: confidence.confidence_label,
        confidence_reason: confidence.confidence_reason,
        scholarships_list: agentResult.scholarships_list
      })
      if (guidanceWriteError) throw datastoreError('Guidance result write', guidanceWriteError)
      // Send guidance-ready email notification (fire-and-forget)
      sendEmail(
        user.email,
        'Your Career Guidance Is Ready — Aage Kya?',
        `<p>Hi! Your personalised career guidance report has been generated. <a href="https://aagekya.in/result">View it here.</a></p>`
      )
    }

    res.json({
      ...agentResult,
      grounded: true,
      scholarship_data,
      ...confidence,
    })
  } catch (err) {
    console.error('Guidance API Error:', err.message)
    if (err.message === 'NO_API_KEY') {
      res.status(401).json({ error: 'NO_API_KEY', message: 'API Key is missing' })
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
    }
  }
})

const validateRoadmapBody = (req, res, next) => {
  if (!req.body.formData || !req.body.option) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing formData or option' })
  }
  next()
}

// Roadmap Endpoint
app.post('/api/roadmap', validateRoadmapBody, roadmapLimiter, async (req, res) => {
  try {
    const { formData, option } = req.body


    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)

    if (user) {
      const client = getSupabaseClient(authHeader)
      // Check cache in DB
      const { data: cached } = await client
        .from('roadmaps')
        .select('*')
        .eq('student_id', user.id)
        .eq('career_path', option.path)
        .maybeSingle()

      if (cached) {
        return res.json({
          career_path: cached.career_path,
          overview: cached.overview,
          years: cached.years,
          cached: true
        })
      }
    }

    // Call the shared LLM client if not cached
    const prompt = buildRoadmapPrompt(formData, option)
    let result
    try {
      result = await callLLM(prompt, { json: true, maxTokens: 2048, temperature: 0.7, callType: 'roadmap', studentId: user?.id || null })
    } catch (aiErr) {
      // A missing key is a configuration problem, not a transient AI outage —
      // let the outer catch surface it as a 401 instead of serving a mock.
      if (aiErr.code === 'NO_API_KEY' || aiErr.message === 'NO_API_KEY') throw aiErr
      console.warn('[Roadmap] AI generation failed, falling back to mock:', aiErr.message)
      result = getMockRoadmap(formData, option)
    }

    // Save to DB if authenticated
    if (user) {
      const client = getSupabaseClient(authHeader)
      await client.from('roadmaps').insert({
        student_id: user.id,
        career_path: option.path,
        overview: result.overview,
        years: result.years
      })
    }

    res.json(result)
  } catch (err) {
    console.error('Roadmap API Error:', err.message)
    if (err.message === 'NO_API_KEY') {
      res.status(401).json({ error: 'NO_API_KEY', message: 'API Key is missing' })
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
    }
  }
})

// Custom Career Path Helper & Endpoint
function buildCustomCareerPathPrompt(profession, form = {}) {
  const marks = form.marks || '75'
  const stream = form.stream || 'PCM'
  const classLevel = form.classLevel || 'class12'
  const budget = form.budget || 'below_1L'
  const state = form.state || 'Any State'

  return `You are an expert career guidance counselor in India.
Generate a structured, highly realistic career roadmap for a student who wants to become a "${profession}".

Tailor it to this student's profile:
- Class Level: ${classLevel}
- Current Stream: ${stream}
- Current Academic Marks: ${marks}%
- Financial/Annual Budget: ${budget}
- Location: ${state}

You must respond ONLY with a JSON object in this exact format (no markdown formatting, no backticks, just raw JSON):
{
  "id": "${profession.toLowerCase().replace(/[^a-z0-9]+/g, '_')}",
  "title": "${profession}",
  "icon": "Choose a single emoji representing the profession",
  "color": "from-purple-500/20 to-violet-500/10",
  "stages": [
    {
      "id": "current",
      "label": "Current Stage",
      "icon": "📍",
      "desc": "Describe the student's current high school status and general prep target.",
      "skills": ["Skill 1", "Skill 2"],
      "certs": [],
      "salary": "N/A",
      "demand": "N/A",
      "next": ["Action step 1", "Action step 2"]
    },
    {
      "id": "entrance",
      "label": "Entrance Exams",
      "icon": "📝",
      "desc": "Specify concrete Indian entrance exams needed (e.g. JEE, CUET, NEET, CLAT, etc. or Direct admission).",
      "skills": ["Exam prep", "Time management"],
      "certs": [],
      "salary": "N/A",
      "demand": "Very High",
      "next": ["Study syllabus", "Take mock tests"]
    },
    {
      "id": "college",
      "label": "Undergraduate College",
      "icon": "🏫",
      "desc": "Target degree (e.g., B.Sc, B.Tech, B.Com, BA, MBBS, etc.) and realistic tiers fitting their budget/marks.",
      "skills": ["Core technical skills", "Project development"],
      "certs": ["Any relevant online/professional certifications"],
      "salary": "N/A",
      "demand": "High",
      "next": ["Build portfolio", "Seek internships"]
    },
    {
      "id": "internship",
      "label": "Internships & Experience",
      "icon": "💼",
      "desc": "Type of internship or training phase after college.",
      "skills": ["Professional skills", "Industry tools"],
      "certs": [],
      "salary": "Typical monthly stipend range (e.g. ₹10K–₹30K/month)",
      "demand": "High",
      "next": ["Apply on LinkedIn", "Network"]
    },
    {
      "id": "first_job",
      "label": "First Job",
      "icon": "🚀",
      "desc": "Starting entry-level job title and responsibilities.",
      "skills": ["Job-specific skills"],
      "certs": ["Professional certificate"],
      "salary": "Typical starting salary (e.g. ₹5–₹8 LPA)",
      "demand": "High",
      "next": ["Gain experience", "Upskill"]
    },
    {
      "id": "senior",
      "label": "Ultimate Goal",
      "icon": "👑",
      "desc": "Senior role or ultimate career target in 10-15 years.",
      "skills": ["Leadership", "Expert domain knowledge"],
      "certs": [],
      "salary": "High-tier salary (e.g. ₹25–₹50+ LPA)",
      "demand": "Very High",
      "next": ["Mentor others", "Set strategies"]
    }
  ]
}
`
}

function getMockCustomCareerPath(profession, form = {}) {
  const title = profession.charAt(0).toUpperCase() + profession.slice(1)
  const id = profession.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const stream = form.stream || 'PCM'
  return {
    id,
    title,
    icon: "🌟",
    color: "from-blue-500/20 to-indigo-500/10",
    stages: [
      {
        id: 'current',
        label: 'Current Stage',
        icon: '📍',
        desc: `High school student interested in becoming a ${title} (Stream: ${stream})`,
        skills: ['Basic Interest', 'Research skills', 'Logical thinking'],
        certs: [],
        salary: 'N/A',
        demand: 'N/A',
        next: [`Study hard to clear school exams with ${form.marks || 75}%+`, `Read articles about the ${title} industry trends`]
      },
      {
        id: 'entrance',
        label: 'Entrance Exams',
        icon: '📝',
        desc: 'Standard entrance examinations or merit-based admissions',
        skills: ['Aptitude', 'Time Management', 'Subject Knowledge'],
        certs: [],
        salary: 'N/A',
        demand: 'High',
        next: ['Determine if CUET, JEE, or state CET is required', 'Prepare standard syllabus']
      },
      {
        id: 'college',
        label: 'College/Degree',
        icon: '🏫',
        desc: `Undergraduate degree relevant to ${title} matching budget ${form.budget || 'Moderate'}`,
        skills: ['Practical learning', 'Soft skills', 'Domain foundations'],
        certs: ['Coursera / edX beginner certification'],
        salary: 'N/A',
        demand: 'High',
        next: ['Build a strong academic record', 'Start coding or creating sample works']
      },
      {
        id: 'internship',
        label: 'Internships',
        icon: '💼',
        desc: 'Hands-on practical training during or post graduation',
        skills: ['Collaboration', 'Industry tools', 'Client interaction'],
        certs: [],
        salary: '₹10k - ₹25k / month',
        demand: 'Very High',
        next: ['Apply via LinkedIn or campus cell', 'Develop a professional resume']
      },
      {
        id: 'first_job',
        label: 'First Job',
        icon: '🚀',
        desc: `Entry level role as a ${title}`,
        skills: ['Technical proficiency', 'Problem Solving'],
        certs: ['Professional specialization certification'],
        salary: '₹5L - ₹10L / year',
        demand: 'High',
        next: ['Learn organizational structures', 'Find a mentor']
      },
      {
        id: 'senior',
        label: 'Ultimate Goal',
        icon: '👑',
        desc: `Lead/Senior position in the ${title} field`,
        skills: ['Leadership', 'Strategic Planning', 'Mentorship'],
        certs: [],
        salary: '₹20L - ₹50L+ / year',
        demand: 'High',
        next: ['Contribute to major projects', 'Stay updated with cutting-edge tech']
      }
    ]
  }
}

app.post('/api/generate-career-path', async (req, res) => {
  const { profession, formData } = req.body
  if (!profession) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing profession' })
  }

  try {
    const prompt = buildCustomCareerPathPrompt(profession, formData || {})
    const result = await callLLM(prompt, { json: true, maxTokens: 2048, temperature: 0.7, callType: 'custom_career' })
    res.json(result)
  } catch (err) {
    console.warn('[CustomCareerPath] AI generation failed, falling back to mock:', err.message)
    const fallback = getMockCustomCareerPath(profession, formData || {})
    res.json(fallback)
  }
})

// ── Course Catalog: AI generator ─────────────────────────────────────────────
function buildCourseInfoPrompt(courseName) {
  return `You are an expert Indian education and admissions counselor.
Generate a detailed, realistic course/degree guide for: "${courseName}" (as offered in India).

Respond ONLY with a raw JSON object (no markdown, no backticks) in EXACTLY this shape:
{
  "category": "Short category like 'Science & Engineering', 'Commerce & Management', 'Arts & Humanities', 'Healthcare & Science', 'Vocational & ITI', etc.",
  "title": "${courseName}",
  "icon": "A single emoji representing the course",
  "duration": "e.g. 3 Years / 4 Years",
  "eligibility": "Entry eligibility (class 10/12, stream, marks)",
  "description": "2-3 sentence overview of the course",
  "subjects": "Comma-separated key subjects covered",
  "requiredSkills": "Comma-separated skills a student needs",
  "entranceExams": "Relevant Indian entrance exams or admission mode",
  "futureScope": "Comma-separated job roles / career options",
  "salary": "Realistic starting salary range in INR",
  "higherStudies": "Comma-separated higher study options",
  "importantInfo": "One practical, honest tip about this course in India"
}`
}

function getMockCourse(courseName) {
  return {
    category: 'General',
    title: courseName,
    icon: '📘',
    duration: 'Varies',
    eligibility: 'Class 12 pass (check specific institute requirements)',
    description: `${courseName} is a course option in India. Detailed AI generation was unavailable, so please verify specifics with official institute sources.`,
    subjects: 'Core foundational subjects relevant to the field',
    requiredSkills: 'Discipline, curiosity, subject aptitude',
    entranceExams: 'Varies by college — check CUET / state CETs / institute tests',
    futureScope: 'Multiple roles depending on specialization',
    salary: '₹3 LPA – ₹8 LPA (indicative)',
    higherStudies: 'Postgraduate degree in the same or allied field',
    importantInfo: 'Always verify eligibility, fees, and accreditation on the official institute website.',
  }
}

app.post('/api/generate-course', async (req, res) => {
  const { courseName } = req.body
  if (!courseName || !courseName.trim()) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing courseName' })
  }
  try {
    const prompt = buildCourseInfoPrompt(courseName.trim())
    const result = await callLLM(prompt, { json: true, maxTokens: 1024, temperature: 0.6, callType: 'course_info' })
    res.json(result)
  } catch (err) {
    console.warn('[CourseInfo] AI generation failed, falling back to mock:', err.message)
    res.json(getMockCourse(courseName.trim()))
  }
})

// Sync local cache data to server DB upon user logging in
app.post('/api/sync', async (req, res) => {
  try {
    const { formData, result } = req.body
    if (!formData || !result) {
      return res.status(400).json({ error: 'Missing formData or result' })
    }

    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)

    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Auth token is invalid or missing' })
    }

    const client = getSupabaseClient(authHeader)

    // Upsert Student Profile
    await resilientUpsertStudent(client, {
      id: user.id,
      full_name: formData.fullName || '',
      state: formData.state || '',
      board: formData.board || '',
      stream: formData.stream || '',
      marks: Number(formData.marks) || 0,
      income_range: formData.incomeRange || '',
      first_gen_college: formData.firstGenCollege === true,
      preferred_cities: formData.preferredCities || [],
      interests: formData.interests || '',
      biggest_fear: formData.biggestFear || '',
      class_level: formData.classLevel || 'class12',
      parent_pressure: formData.parentPressure === true,
      parent_expectations: formData.parentExpectations || '',
      risk_comfort: formData.riskComfort || '',
      coaching_access: formData.coachingAccess === true,
      updated_at: new Date().toISOString()
    })

    // Upsert Guidance Results
    const { data: existing } = await client
      .from('guidance_results')
      .select('id')
      .eq('student_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!existing) {
      const admin = guidanceWriter()
      const { error: guidanceWriteError } = await admin.from('guidance_results').insert({
        student_id: user.id,
        summary: result.summary,
        options: result.options,
        scholarship_to_check: result.scholarship_to_check,
        one_thing_to_do_this_week: result.one_thing_to_do_this_week
      })
      if (guidanceWriteError) throw datastoreError('Guidance result write', guidanceWriteError)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Sync API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Academic Wallet Update Endpoint
app.put('/api/wallet', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Auth token is invalid or missing' })
    }

    const { wallet } = req.body
    if (!Array.isArray(wallet)) {
      return res.status(400).json({ error: 'INVALID_DATA', message: 'wallet must be an array' })
    }

    const client = getSupabaseClient(authHeader)
    const { data, error } = await client
      .from('students')
      .update({ academic_wallet: wallet, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()

    if (error) throw error

    res.json({ success: true, wallet: data[0]?.academic_wallet || [] })
  } catch (err) {
    console.error('Wallet API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Re-onboard (archive current guidance results before re-running onboarding)
app.post('/api/re-onboard', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    const user = await getAuthUser(authHeader)
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Auth token is invalid or missing' })
    }

    const client = getSupabaseClient(authHeader)

    // Fetch current student profile
    const { data: student, error: studentErr } = await client
      .from('students')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (studentErr) throw studentErr
    if (!student) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found' })
    }

    // Fetch latest guidance result
    const { data: guidance, error: guidanceErr } = await client
      .from('guidance_results')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (guidanceErr) throw guidanceErr

    // Fetch roadmaps
    const { data: roadmaps, error: roadmapsErr } = await client
      .from('roadmaps')
      .select('*')
      .eq('student_id', user.id)

    if (roadmapsErr) throw roadmapsErr

    // Only archive if there is actually some guidance content to archive
    if (guidance) {
      const snapshot = {
        timestamp: new Date().toISOString(),
        profile: {
          fullName: student.full_name,
          state: student.state,
          board: student.board,
          stream: student.stream,
          marks: student.marks,
          incomeRange: student.income_range,
          firstGenCollege: student.first_gen_college,
          preferredCities: student.preferred_cities,
          interests: student.interests,
          biggestFear: student.biggest_fear,
          classLevel: student.class_level,
          parentPressure: student.parent_pressure,
          parentExpectations: student.parent_expectations,
          riskComfort: student.risk_comfort,
          coachingAccess: student.coaching_access
        },
        guidance: {
          summary: guidance.summary,
          options: guidance.options,
          scholarship_to_check: guidance.scholarship_to_check,
          one_thing_to_do_this_week: guidance.one_thing_to_do_this_week,
          created_at: guidance.created_at
        },
        roadmaps: (roadmaps || []).map(r => ({
          career_path: r.career_path,
          overview: r.overview,
          years: r.years,
          created_at: r.created_at
        }))
      }

      const history = Array.isArray(student.history) ? student.history : []
      const updatedHistory = [snapshot, ...history].slice(0, 5)

      // Update student profile history
      const { error: updateErr } = await client
        .from('students')
        .update({ history: updatedHistory })
        .eq('id', user.id)

      if (updateErr) throw updateErr

      // Delete current guidance results & roadmaps so user can re-generate a new
      // cache. Server-authored rows are removed via the service-role writer.
      const admin = guidanceWriter()
      const [{ error: guidanceDeleteError }, { error: roadmapDeleteError }] = await Promise.all([
        admin.from('guidance_results').delete().eq('student_id', user.id),
        admin.from('roadmaps').delete().eq('student_id', user.id)
      ])
      if (guidanceDeleteError) throw datastoreError('Guidance result delete', guidanceDeleteError)
      if (roadmapDeleteError) throw datastoreError('Roadmap delete', roadmapDeleteError)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Re-onboard API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ─── Analytics Endpoint (pitch-deck data) ─────────────────────────────────────
// GET /api/analytics
// Returns: { by_stream: [{stream, count}], by_state: [{state, count}], total_students: N }
// Requires SUPABASE_SERVICE_ROLE_KEY in server/.env to bypass Row Level Security.
app.get('/api/analytics', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({
      error: 'ANALYTICS_UNAVAILABLE',
      message: 'Set SUPABASE_SERVICE_ROLE_KEY in server/.env to enable analytics.',
    })
  }

  try {
    // Count students per stream
    const { data: streamRows, error: streamErr } = await supabaseAdmin
      .from('students')
      .select('stream')

    if (streamErr) throw streamErr

    // Count students per state
    const { data: stateRows, error: stateErr } = await supabaseAdmin
      .from('students')
      .select('state')

    if (stateErr) throw stateErr

    // Aggregate in JS (Supabase JS client doesn't expose GROUP BY directly without RPC)
    const countBy = (rows, key) => {
      const map = {}
      for (const row of rows) {
        const val = row[key] || 'Unknown'
        map[val] = (map[val] || 0) + 1
      }
      return Object.entries(map)
        .map(([value, count]) => ({ [key]: value, count }))
        .sort((a, b) => b.count - a.count)
    }

    res.json({
      total_students: streamRows.length,
      by_stream: countBy(streamRows, 'stream'),
      by_state:  countBy(stateRows,  'state'),
    })
  } catch (err) {
    console.error('Analytics API Error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ─── Mentors Endpoints (Phase 4 — Real Mentor Connect) ──────────────────────────


const HARDCODED_MENTORS = [
  {
    id: 'fallback-1',
    name: 'Rahul S.',
    initials: 'RS',
    college: 'PES University',
    degree: 'B.E. Electronics & Communication',
    stream: 'PCB → ECE',
    stream_category: 'Science (PCB)',
    city: 'Bengaluru',
    linkedin: '',
    story: "I missed NEET by 8 marks. Ended up in ECE. Here's what I wish someone told me.",
    tags: ['NEET dropout', 'Bio to Engineering', 'Career pivot'],
    gradient: 'from-blue-500/30 to-blue-600/10',
    border: 'border-blue-500/25',
    tag_color: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    initials_bg: 'bg-blue-500/20 text-blue-300',
    available: true,
  },
  {
    id: 'fallback-2',
    name: 'Priya M.',
    initials: 'PM',
    college: 'NIT Surathkal',
    degree: 'B.Tech Computer Science',
    stream: 'PCM → CSE',
    stream_category: 'Science (PCM)',
    city: 'Mangaluru',
    linkedin: '',
    story: "First in my family to leave home for college. It was terrifying. I'll tell you exactly what helped.",
    tags: ['First-gen student', 'Hostel life', 'Scholarships'],
    gradient: 'from-purple-500/30 to-purple-600/10',
    border: 'border-purple-500/25',
    tag_color: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    initials_bg: 'bg-purple-500/20 text-purple-300',
    available: true,
  },
  {
    id: 'fallback-3',
    name: 'Arjun K.',
    initials: 'AK',
    college: 'Manipal University',
    degree: 'BBA + Certification Finance',
    stream: 'Commerce',
    stream_category: 'Commerce',
    city: 'Pune',
    linkedin: '',
    story: "Family wanted CA. I wanted something else. Here's how I navigated that conversation.",
    tags: ['Family pressure', 'Commerce', 'Non-CA path'],
    gradient: 'from-emerald-500/30 to-emerald-600/10',
    border: 'border-emerald-500/25',
    tag_color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    initials_bg: 'bg-emerald-500/20 text-emerald-300',
    available: true,
  },
  {
    id: 'fallback-4',
    name: 'Anjali D.',
    initials: 'AD',
    college: 'Delhi University',
    degree: 'B.A. Psychology',
    stream: 'Class 10 → Humanities',
    stream_category: 'Class 10 / Stream Selection',
    city: 'Delhi',
    linkedin: '',
    story: "I spent months stressing over whether to take PCM or Arts. I chose Arts and it was the best decision of my life. Let's figure out what fits you.",
    tags: ['Stream selection', 'Humanities', 'Parent pressure'],
    gradient: 'from-amber-500/30 to-amber-600/10',
    border: 'border-amber-500/25',
    tag_color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    initials_bg: 'bg-amber-500/20 text-amber-300',
    available: true,
  },
]

// Fetch active mentors list
app.get('/api/mentors', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json(HARDCODED_MENTORS)
    }

    const { data, error } = await supabase
      .from('mentors')
      .select('*')
      .eq('available', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      return res.json(HARDCODED_MENTORS)
    }

    res.json(data)
  } catch (err) {
    console.warn('Mentors API error, returning fallback:', err.message)
    res.json(HARDCODED_MENTORS)
  }
})

const validateApplyBody = (req, res, next) => {
  const { name, email, story } = req.body
  // name/email/story are the only hard requirements; the two application forms
  // differ in whether they send college/degree/stream vs profession/stream_category.
  if (!name || !email || !story) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Name, email and your story are required.' })
  }
  next()
}

app.post('/api/mentors/apply', validateApplyBody, mentorApplyLimiter, async (req, res) => {
  try {
    const { name, email, college, degree, stream, story, profession, streamExpertise, yearsExp, linkedIn } = req.body


    if (!supabaseAdmin || !isSupabaseConfigured()) {
      console.warn(`Volunteer signup simulated for ${name} (${email}) - Supabase not fully configured`)
      return res.json({ success: true, simulated: true })
    }

    const { error } = await supabaseAdmin
      .from('mentor_applications')
      .insert({
        name,
        email,
        college: college || '',
        degree: degree || '',
        stream_transition: stream || '',
        story,
        profession: profession || '',
        stream_category: streamExpertise || '',
        experience_years: parseInt(yearsExp, 10) || 0,
        linkedin: linkedIn || '',
        status: 'pending'
      })

    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    console.error('Mentor application error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/mentors/book — "Book Mentor" request (replaces Cal.com) ────────
// All mentor sessions are conducted online — there is no mode selection.
// Saves a booking request in mentor_sessions (status: 'pending'), then
// notifies the student and admin by email (best-effort, non-blocking).
const mentorBookLimiter = createRateLimiter(5, 3600000, 'You can only submit a few booking requests per hour. Please try again later.')
app.post('/api/mentors/book', requireAuth(), mentorBookLimiter, async (req, res) => {
  const user = req.authUser
  const {
    mentorId,
    contactName,
    contactEmail,
    contactPhone,
    classLevel,
    areaOfInterest,
    preferredLanguage,
    preferredDateTime,
    guidanceQuery,
  } = req.body

  if (!mentorId || !contactName || !contactEmail || !classLevel || !areaOfInterest || !preferredLanguage || !guidanceQuery) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please fill in all required fields.' })
  }

  // Demo/dev accounts (loginAsDemo on the frontend) use fake UUIDs that have
  // no matching auth.users row, so they can never satisfy the students
  // foreign key. Simulate success instead of attempting a real DB write.
  const authHeaderToken = (req.headers.authorization || '').split(' ')[1]
  if (authHeaderToken === 'demo-student-token' || authHeaderToken === 'demo-admin-token' || authHeaderToken === 'demo-mentor-token') {
    console.warn(`Mentor booking simulated for demo user ${user.email} — demo accounts are not persisted to the database`)
    return res.json({ success: true, simulated: true })
  }

  try {
    const client = getSupabaseClient(req.headers.authorization)

    const { data: mentorRow, error: mentorErr } = await client
      .from('mentors')
      .select('id, name')
      .eq('id', mentorId)
      .maybeSingle()
    if (mentorErr || !mentorRow) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Mentor not found.' })
    }

    // mentor_sessions.student_id references public.students(id), not
    // auth.users(id) directly. A user who is authenticated but has never
    // completed onboarding may not have a students row yet, which would
    // otherwise fail the insert below with a foreign key violation.
    const { data: existingStudent } = await client
      .from('students')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (!existingStudent) {
      await resilientUpsertStudent(client, { id: user.id, full_name: contactName })
    }

    const { data: booking, error: insertErr } = await client
      .from('mentor_sessions')
      .insert({
        student_id: user.id,
        mentor_id: mentorId,
        session_date: preferredDateTime || null,
        status: 'pending',
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone || '',
        class_level: classLevel,
        area_of_interest: areaOfInterest,
        preferred_language: preferredLanguage,
        guidance_query: guidanceQuery,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    // Fire-and-forget email notifications — booking still succeeds if these fail.
    const mentorName = mentorRow.name || 'your mentor'
    sendEmail(
      contactEmail,
      'Your Mentor Session Request — Aage Kya?',
      `<p>Hi ${contactName},</p>
       <p>Your mentor session request with <strong>${mentorName}</strong> has been received.</p>
       <p>Further details will be shared with you at this email address once the mentor confirms.</p>
       <p><strong>What you asked for:</strong> ${guidanceQuery}</p>
       <p>— Team Aage Kya?</p>`
    ).catch(() => {})

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      sendEmail(
        adminEmail,
        'New Mentor Booking Request',
        `<p>A new mentor booking request was submitted.</p>
         <ul>
           <li><strong>Student:</strong> ${contactName} (${contactEmail})</li>
           <li><strong>Mentor:</strong> ${mentorName}</li>
           <li><strong>Class Level:</strong> ${classLevel}</li>
           <li><strong>Area of Interest:</strong> ${areaOfInterest}</li>
           <li><strong>Preferred Language:</strong> ${preferredLanguage}</li>
           <li><strong>Preferred Date/Time:</strong> ${preferredDateTime || 'Not specified'}</li>
           <li><strong>Guidance Needed:</strong> ${guidanceQuery}</li>
         </ul>`
      ).catch(() => {})
    }

    res.json({ success: true, booking })
  } catch (err) {
    console.error('Mentor booking error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Best-effort lookup of a mentor's account email via their linked user_id.
// Requires the service-role admin client; returns null if unavailable.
async function getMentorAccountEmail(userId) {
  if (!userId || !supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return null
    return data?.user?.email || null
  } catch {
    return null
  }
}

// ── POST /api/mentors/ask — "Ask Mentor" async question (replaces Chat Now) ──
// Stores the question, then notifies the admin and the assigned mentor.
const mentorAskLimiter = createRateLimiter(isDev ? 50 : 10, 3600000, 'You can only send a few questions per hour. Please try again later.')
app.post('/api/mentors/ask', requireAuth(), mentorAskLimiter, async (req, res) => {
  const user = req.authUser
  const { mentorId, contactName, contactEmail, subject, category, question, classLevel } = req.body

  if (!mentorId || !contactName || !contactEmail || !subject || !category || !question) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please fill in all required fields.' })
  }

  // Demo/dev accounts use fake UUIDs with no auth.users row — simulate success.
  const askToken = (req.headers.authorization || '').split(' ')[1]
  if (askToken === 'demo-student-token' || askToken === 'demo-admin-token' || askToken === 'demo-mentor-token') {
    console.warn(`Mentor question simulated for demo user ${user.email} — demo accounts are not persisted`)
    return res.json({ success: true, simulated: true })
  }

  try {
    const client = getSupabaseClient(req.headers.authorization)

    const { data: mentorRow, error: mentorErr } = await client
      .from('mentors')
      .select('id, name, user_id')
      .eq('id', mentorId)
      .maybeSingle()
    if (mentorErr || !mentorRow) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Mentor not found.' })
    }

    let { data: message, error: insertErr } = await client
      .from('mentor_messages')
      .insert({
        student_id: user.id,
        mentor_id: mentorId,
        contact_name: contactName,
        contact_email: contactEmail,
        subject,
        category,
        question,
        class_level: classLevel || '',
        status: 'pending',
      })
      .select()
      .single()

    // Fall back if class_level hasn't been migrated yet.
    if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703' || /class_level/.test(insertErr.message || ''))) {
      console.warn('[mentor ask] mentor_messages.class_level column missing — run supabase_mentor_dashboard_migration.sql. Inserting without it.')
      const retry = await client
        .from('mentor_messages')
        .insert({
          student_id: user.id,
          mentor_id: mentorId,
          contact_name: contactName,
          contact_email: contactEmail,
          subject,
          category,
          question,
          status: 'pending',
        })
        .select()
        .single()
      message = retry.data; insertErr = retry.error
    }

    if (insertErr) throw insertErr

    const mentorName = mentorRow.name || 'the mentor'

    // Notify the mentor (best-effort).
    const mentorEmail = await getMentorAccountEmail(mentorRow.user_id)
    if (mentorEmail) {
      sendEmail(
        mentorEmail,
        `New Student Question: ${subject}`,
        `<p>Hi ${mentorName},</p>
         <p>A student has sent you a question on Aage Kya?.</p>
         <ul>
           <li><strong>From:</strong> ${contactName} (${contactEmail})</li>
           ${classLevel ? `<li><strong>Class:</strong> ${classLevel}</li>` : ''}
           <li><strong>Category:</strong> ${category}</li>
           <li><strong>Subject:</strong> ${subject}</li>
         </ul>
         <p><strong>Question:</strong> ${question}</p>
         <p>Sign in to your Mentor Dashboard → Student Queries to reply.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    // Notify the admin (best-effort).
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminEmail) {
      sendEmail(
        adminEmail,
        'New Ask Mentor Question',
        `<p>A student asked a mentor a question.</p>
         <ul>
           <li><strong>Student:</strong> ${contactName} (${contactEmail})</li>
           ${classLevel ? `<li><strong>Class:</strong> ${classLevel}</li>` : ''}
           <li><strong>Mentor:</strong> ${mentorName}</li>
           <li><strong>Category:</strong> ${category}</li>
           <li><strong>Subject:</strong> ${subject}</li>
         </ul>
         <p><strong>Question:</strong> ${question}</p>`
      ).catch(() => {})
    }

    res.json({ success: true, message })
  } catch (err) {
    console.error('Mentor ask error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/mentor/messages/:id/reply — mentor answers a question ─────────
app.patch('/api/mentor/messages/:id/reply', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const reply = (req.body?.reply || '').trim()
  const user = req.authUser
  if (!reply) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Reply cannot be empty.' })

  // Demo mentor — simulate a successful reply (no real rows to update).
  const replyToken = (req.headers.authorization || '').split(' ')[1]
  if (replyToken === 'demo-mentor-token') {
    return res.json({ success: true, simulated: true, message: { id, reply, status: 'answered', replied_at: new Date().toISOString() } })
  }

  try {
    // Verify the mentor owns the mentor profile the message is assigned to.
    const { data: mentorRow } = await supabase.from('mentors').select('id, name').eq('user_id', user.id).maybeSingle()
    if (!mentorRow) return res.status(403).json({ error: 'FORBIDDEN', message: 'No mentor profile found.' })

    const client = getSupabaseClient(req.headers.authorization)
    const { data: message, error } = await client
      .from('mentor_messages')
      .update({ reply, status: 'answered', replied_at: new Date().toISOString() })
      .eq('id', id)
      .eq('mentor_id', mentorRow.id)
      .select()
      .single()
    if (error) throw error

    // Notify the student their question was answered (best-effort).
    if (message?.contact_email) {
      sendEmail(
        message.contact_email,
        `Your Mentor Replied: ${message.subject || 'Your question'}`,
        `<p>Hi ${message.contact_name || 'there'},</p>
         <p><strong>${mentorRow.name}</strong> has replied to your question on Aage Kya?.</p>
         <p><strong>Your question:</strong> ${message.question}</p>
         <p><strong>Reply:</strong> ${reply}</p>
         <p>Sign in and open "My Mentor Requests" to see the full conversation.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true, message })
  } catch (err) {
    console.error('Mentor reply error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/mentor/messages — fetch student's own mentor requests ────────────
app.get('/api/mentor/messages', requireAuth(), async (req, res) => {
  const user = req.authUser
  try {
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('mentor_messages')
      .select('*, mentors(name, initials, college)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ messages: data || [] })
  } catch (err) {
    console.error('Fetch mentor messages error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/mentor/workspace — everything the mentor dashboard needs ─────────
// Returns the mentor's application status (approved | rejected | pending) plus,
// once their account is linked to an approved mentor profile, the student
// questions and booking requests they've received. Auto-claims a matching
// mentor profile by email on first visit.
app.get('/api/mentor/workspace', requireAuth(), async (req, res) => {
  const user = req.authUser
  const token = (req.headers.authorization || '').split(' ')[1]

  // Demo mentor — return a friendly simulated workspace so the UI is explorable.
  if (token === 'demo-mentor-token') {
    const nowIso = new Date().toISOString()
    return res.json({
      application: { status: 'approved', created_at: nowIso },
      mentor: {
        id: 'demo-mentor', name: 'Demo Mentor', initials: 'DM',
        college: 'IIT Bombay', degree: 'B.Tech CSE', stream_category: 'Science (PCM)',
        available: true, story: 'Here to help students navigate their choices.', linkedin: '',
        initials_bg: 'bg-indigo-500/20 text-indigo-300',
      },
      bookings: [],
      messages: [
        {
          id: 'demo-msg-1', subject: 'Confused between PCM and PCB',
          contact_name: 'Aarav Gupta', contact_email: 'aarav@example.com',
          category: 'Stream / Subject Choice',
          question: 'I enjoy biology but also like physics. How should I decide between PCM and PCB?',
          status: 'pending', reply: '', created_at: nowIso,
        },
      ],
    })
  }

  const admin = supabaseAdmin || getSupabaseClient(req.headers.authorization)
  try {
    // 1. Most recent application filed under this account's email.
    let application = null
    if (user.email) {
      const { data: apps } = await admin
        .from('mentor_applications')
        .select('id, name, email, status, rejection_reason, created_at')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
      application = (apps && apps[0]) || null
    }

    // 2. Mentor profile — linked by user_id first, else claim by matching email.
    let mentor = null
    const { data: byUser } = await admin.from('mentors').select('*').eq('user_id', user.id).maybeSingle()
    mentor = byUser || null

    if (!mentor && user.email) {
      // Guarded: the email column may not be migrated yet.
      try {
        const { data: byEmail } = await admin
          .from('mentors').select('*').eq('email', user.email).is('user_id', null).maybeSingle()
        if (byEmail) {
          const { data: claimed } = await admin
            .from('mentors').update({ user_id: user.id }).eq('id', byEmail.id).select().maybeSingle()
          mentor = claimed || byEmail
        }
      } catch (claimErr) {
        console.warn('[mentor workspace] claim-by-email skipped:', claimErr.message)
      }
    }

    // 3. Once linked to a real profile, make sure their role is 'mentor' so the
    //    reply endpoint (requireRole('mentor')) accepts them.
    if (mentor) {
      await admin.from('students').update({ role: 'mentor' }).eq('id', user.id)
    }

    // 4. Received questions + booking requests for the linked mentor.
    let messages = []
    let bookings = []
    if (mentor) {
      const { data: msgs } = await admin
        .from('mentor_messages').select('*').eq('mentor_id', mentor.id).order('created_at', { ascending: false })
      messages = msgs || []
      const { data: sess } = await admin
        .from('mentor_sessions').select('*').eq('mentor_id', mentor.id).order('created_at', { ascending: false })
      bookings = sess || []
    }

    res.json({ application, mentor, messages, bookings })
  } catch (err) {
    console.error('Mentor workspace error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/mentor/sessions/:id/respond — mentor accepts/declines a booking ─
// The mentor approves the request or declines it, optionally including a message
// (e.g. the time they're actually available). The student is notified by email
// and sees the status + message on their "My Mentor Requests" page.
app.patch('/api/mentor/sessions/:id/respond', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const user = req.authUser
  const status = (req.body?.status || '').trim()        // 'accepted' | 'declined' | 'rescheduled' | 'completed'
  const response = (req.body?.response || '').trim()     // mentor's note / availability / suggested time
  const allowed = ['accepted', 'declined', 'rescheduled', 'completed']
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid status.' })
  }
  if (status === 'rescheduled' && !response) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Please suggest an alternative time in your message.' })
  }

  // Demo mentor — simulate success (no real rows to update).
  const token = (req.headers.authorization || '').split(' ')[1]
  if (token === 'demo-mentor-token') {
    return res.json({ success: true, simulated: true, booking: { id, status, mentor_response: response } })
  }

  try {
    const { data: mentorRow } = await supabase.from('mentors').select('id, name').eq('user_id', user.id).maybeSingle()
    if (!mentorRow) return res.status(403).json({ error: 'FORBIDDEN', message: 'No mentor profile found.' })

    const client = getSupabaseClient(req.headers.authorization)
    let { data: booking, error } = await client
      .from('mentor_sessions')
      .update({ status, mentor_response: response })
      .eq('id', id)
      .eq('mentor_id', mentorRow.id)
      .select()
      .single()
    // Fall back if the mentor_response column hasn't been migrated yet.
    if (error && (error.code === 'PGRST204' || error.code === '42703' || /mentor_response/.test(error.message || ''))) {
      console.warn('[mentor booking] mentor_response column missing — run supabase_mentor_dashboard_migration.sql. Updating status only.')
      const retry = await client
        .from('mentor_sessions').update({ status }).eq('id', id).eq('mentor_id', mentorRow.id).select().single()
      booking = retry.data; error = retry.error
    }
    if (error) throw error

    // Notify the student who booked (best-effort).
    if (booking?.contact_email) {
      const label = status === 'accepted' ? 'confirmed ✅'
        : status === 'declined' ? 'not available right now'
        : status === 'rescheduled' ? 'a new time was suggested 🕒'
        : status
      sendEmail(
        booking.contact_email,
        `Your Mentor Booking Update — Aage Kya?`,
        `<p>Hi ${booking.contact_name || 'there'},</p>
         <p><strong>${mentorRow.name}</strong> has responded to your session request. Status: <strong>${label}</strong>.</p>
         ${response ? `<p><strong>Message from your mentor:</strong> ${response}</p>` : ''}
         <p>Sign in and open "My Mentor Requests" to see the details.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true, booking })
  } catch (err) {
    console.error('Mentor booking respond error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/student/bookings — a student's own booking requests + responses ──
app.get('/api/student/bookings', requireAuth(), async (req, res) => {
  const user = req.authUser
  const token = (req.headers.authorization || '').split(' ')[1]
  if (token === 'demo-student-token' || token === 'demo-admin-token' || token === 'demo-mentor-token') {
    return res.json({ bookings: [] })
  }
  try {
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('mentor_sessions')
      .select('*, mentors(name, initials, college)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ bookings: data || [] })
  } catch (err) {
    console.error('Fetch student bookings error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Transcription Endpoint (Phase 7 — Voice Input)
// Uses Groq Whisper (whisper-large-v3) — accepts base64 audio from the client
app.post('/api/transcribe', transcribeLimiter, async (req, res) => {
  try {
    const { audio, mimeType } = req.body
    if (!audio) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing audio data' })
    }

    const client = getGroqClient()

    // Convert base64 audio to a Buffer and wrap as a File-like object for the Groq SDK
    const audioBuffer = Buffer.from(audio, 'base64')
    const ext = (mimeType || 'audio/webm').includes('mp4') ? 'mp4'
              : (mimeType || '').includes('ogg') ? 'ogg'
              : 'webm'
    const filename = `audio.${ext}`

    // Groq SDK accepts a File object — create one from the buffer
    const audioFile = new File([audioBuffer], filename, { type: mimeType || 'audio/webm' })

    const transcriptionResponse = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      response_format: 'text',
      language: 'en', // Whisper auto-detects but we bias toward English output
    })

    // transcriptionResponse is the raw text string when response_format is 'text'
    const text = typeof transcriptionResponse === 'string'
      ? transcriptionResponse.trim()
      : (transcriptionResponse.text || '').trim()

    res.json({ transcription: text })
  } catch (err) {
    console.error('Transcription API Error:', err.message)
    if (err.message === 'NO_API_KEY') {
      res.status(401).json({ error: 'NO_API_KEY', message: 'API Key is missing' })
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
    }
  }
})

// ─── Phase 3 Endpoints ────────────────────────────────────────────────────────

// ── Email helper (Resend) ────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: 'Aage Kya? <noreply@aagekya.in>', to, subject, html }),
    })
    const data = await res.json()
    if (!res.ok) console.error('[email] Resend error:', data)
    else console.log(`[email] Sent "${subject}" to ${to}`)
  } catch (err) {
    console.error('[email] Send failed:', err.message)
  }
}

// ── POST /api/clarify — detect incomplete fields before guidance ─────────────
const clarifyLimiter = createRateLimiter(20, 3600000, 'Too many clarify requests.')
app.post('/api/clarify', clarifyLimiter, (req, res) => {
  const { formData } = req.body
  if (!formData) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing formData' })

  const CLARIFY_FIELDS = [
    { key: 'interests',    question: 'What subjects or activities excite you the most right now?', label: 'Interests' },
    { key: 'biggestFear', question: 'What\'s your biggest worry about choosing a stream or career path?', label: 'Biggest Fear' },
    { key: 'stream',      question: 'Which stream are you currently leaning towards (e.g. Science, Commerce, Arts)?', label: 'Stream Preference' },
    { key: 'incomeRange', question: 'What is your approximate family income per year?', label: 'Family Income' },
    { key: 'preferredCities', question: 'Are you open to studying away from home, or do you prefer staying close?', label: 'Location Preference' },
  ]

  const missing = CLARIFY_FIELDS.filter(f => {
    const v = formData[f.key]
    if (v === null || v === undefined) return true
    if (typeof v === 'string') return v.trim().length < 5
    if (Array.isArray(v)) return v.length === 0
    return false
  })

  res.json({ needs_clarification: missing.length > 0, missing_fields: missing })
})

// ── POST /api/parent-summary — AI rewrite in parent-friendly language ─────────
const parentSummaryLimiter = createRateLimiter(10, 3600000, 'Too many parent summary requests.')
app.post('/api/parent-summary', parentSummaryLimiter, requireAuth(), async (req, res) => {
  const { guidanceResultId } = req.body
  const user = req.authUser
  if (!guidanceResultId) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing guidanceResultId' })

  try {
    const client = getSupabaseClient(req.headers.authorization)

    // Fetch guidance result (RLS ensures student can only see their own)
    const { data: gr, error } = await client
      .from('guidance_results')
      .select('*')
      .eq('id', guidanceResultId)
      .eq('student_id', user.id)
      .maybeSingle()

    if (error || !gr) return res.status(404).json({ error: 'NOT_FOUND', message: 'Guidance result not found' })

    // Return cached parent summary if already generated
    if (gr.parent_summary && gr.parent_summary.length > 20) {
      return res.json({ parent_summary: gr.parent_summary, cached: true })
    }

    // Build parent-rewrite prompt
    const optionsSummary = (gr.options || []).map((o, i) =>
      `Option ${i+1}: ${o.path}\nHonest Take: ${o.honest_take}\nBackup: ${o.backup_plan || 'N/A'}`
    ).join('\n\n')

    const parentPrompt = `You are a calm, clear communicator writing for Indian parents.
Rewrite the following AI-generated student career guidance in simple, reassuring parent-friendly language.
Focus on: stability of career outcome, expected education cost, and backup safety net.
Avoid jargon. Write in plain Hindi-English mixed style if helpful (but prefer English).
Keep it under 200 words total.

Summary for student: ${gr.summary}

Recommended paths:\n${optionsSummary}

Write a warm parent briefing. Include: 1. Why this suits your child, 2. Expected cost range, 3. Backup safety plan. Output only the briefing text, no JSON.`

    let parentSummaryText
    try {
      const text = await callLLM(parentPrompt, {
        json: false,
        maxTokens: 512,
        temperature: 0.6,
        modelOverride: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        callType: 'parent_summary',
        studentId: user.id,
      })
      parentSummaryText = text.trim()
    } catch (err) {
      console.error('Parent summary AI call error:', err.message)
      console.warn(`[WARN] Parent summary AI call failed. Falling back to mock summary...`)
      
      const firstPath = gr.options?.[0]?.path || 'Commerce / Business studies'
      const firstBackup = gr.options?.[0]?.backup_plan || 'preparing for MBA or specialized certifications'
      
      parentSummaryText = `Dear Parent,

Based on your child's profile, we have suggested career options that balance their natural strengths with stable opportunities. 

1. **Why this suits them:** They show strong analytic skills and interest in business/management. Paths like BBA or finance courses are highly structured and aligned.
2. **Expected Cost:** The target colleges range from ₹50,000 to ₹2,50,000 per year, making it affordable.
3. **Backup Plan:** If admissions are highly competitive, the backup is to pursue ${firstBackup}. This ensures complete career security.`
    }

    // Cache it back to guidance_results via the service-role writer.
    const admin = guidanceWriter()
    await admin.from('guidance_results').update({ parent_summary: parentSummaryText }).eq('id', guidanceResultId)

    res.json({ parent_summary: parentSummaryText, cached: false })
  } catch (err) {
    console.error('Parent summary endpoint error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/scenarios ─────────────────────────────────────────────────────────
app.get('/api/scenarios', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('scenarios')
      .select('id, label, form_data, guidance_result, created_at')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ scenarios: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/scenarios ────────────────────────────────────────────────────────
const scenarioLimiter = createRateLimiter(20, 86400000, 'Too many scenarios saved today.')
app.post('/api/scenarios', requireAuth(), scenarioLimiter, async (req, res) => {
  const user = req.authUser
  const { label, formData, guidanceResult } = req.body
  if (!formData || !guidanceResult) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing formData or guidanceResult' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('scenarios')
      .insert({ student_id: user.id, label: label || 'Saved Scenario', form_data: formData, guidance_result: guidanceResult })
      .select()
      .single()
    if (error) throw error
    res.json({ scenario: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── DELETE /api/scenarios/:id ──────────────────────────────────────────────────
app.delete('/api/scenarios/:id', requireAuth(), async (req, res) => {
  const user = req.authUser
  const { id } = req.params
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { error } = await client.from('scenarios').delete().eq('id', id).eq('student_id', user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/mentor-sessions ──────────────────────────────────────────────────
const sessionCreateLimiter = createRateLimiter(5, 86400000, 'Too many session requests today.')
app.post('/api/mentor-sessions', requireAuth(), sessionCreateLimiter, async (req, res) => {
  const user = req.authUser
  const { mentorId, sessionDate } = req.body
  if (!mentorId) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing mentorId' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('mentor_sessions')
      .insert({ student_id: user.id, mentor_id: mentorId, session_date: sessionDate || null, status: 'pending' })
      .select()
      .single()
    if (error) throw error
    // Send confirmation email (fire-and-forget)
    const { data: profile } = await supabase.auth.admin?.getUserById?.(user.id).catch(() => ({ data: null })) || {}
    sendEmail(
      user.email,
      'Mentor Session Requested — Aage Kya?',
      `<p>Hi there! Your mentor session request has been submitted. Your mentor will confirm shortly.</p>`
    )
    res.json({ session: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/mentor-sessions ───────────────────────────────────────────────────
app.get('/api/mentor-sessions', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    // Students see their own; mentors see sessions for their profile
    let query
    if (user.role === 'mentor') {
      // Find mentor record by user_id
      const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', user.id).maybeSingle()
      if (!mentorRow) return res.json({ sessions: [] })
      const { data, error } = await client.from('mentor_sessions').select('*, mentors(name)').eq('mentor_id', mentorRow.id).order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ sessions: data || [] })
    } else {
      const { data, error } = await client.from('mentor_sessions').select('*, mentors(name)').eq('student_id', user.id).order('created_at', { ascending: false })
      if (error) throw error
      return res.json({ sessions: data || [] })
    }
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/mentor-sessions/:id/rate ───────────────────────────────────────
app.patch('/api/mentor-sessions/:id/rate', requireAuth(), async (req, res) => {
  const { id } = req.params
  const { rating, ratingComment } = req.body
  const user = req.authUser
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Rating must be 1–5' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('mentor_sessions')
      .update({ rating: Number(rating), rating_comment: ratingComment || '' })
      .eq('id', id).eq('student_id', user.id)
      .select().single()
    if (error) throw error
    res.json({ session: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/mentor-sessions/:id/notes — mentor writes session notes ─────────
app.patch('/api/mentor-sessions/:id/notes', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const { notes, status } = req.body
  const user = req.authUser
  try {
    // Verify the mentor owns this session
    const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', user.id).maybeSingle()
    if (!mentorRow) return res.status(403).json({ error: 'FORBIDDEN', message: 'No mentor profile found' })
    const client = getSupabaseClient(req.headers.authorization)
    const update = {}
    if (notes !== undefined) update.notes = notes
    if (status) update.status = status
    const { data, error } = await client
      .from('mentor_sessions').update(update).eq('id', id).eq('mentor_id', mentorRow.id)
      .select().single()
    if (error) throw error
    res.json({ session: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/qa ────────────────────────────────────────────────────────────────
app.get('/api/qa', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = 20
  const offset = (page - 1) * limit
  const streamTag = req.query.stream || null
  try {
    let query = supabase
      .from('qa_posts')
      .select('id, question, answer, answered_at, stream_tag, created_at, mentor_id, mentors(name, initials)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (streamTag) query = query.eq('stream_tag', streamTag)
    const { data, error } = await query
    if (error) throw error
    res.json({ posts: data || [], page })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── POST /api/qa ───────────────────────────────────────────────────────────────
const qaPostLimiter = createRateLimiter(5, 3600000, 'Too many Q&A posts. Please wait an hour.')
app.post('/api/qa', requireAuth(), qaPostLimiter, async (req, res) => {
  const user = req.authUser
  const { question, streamTag } = req.body
  if (!question || question.trim().length < 10) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Question must be at least 10 characters' })
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('qa_posts')
      .insert({ author_id: user.id, question: question.trim(), stream_tag: streamTag || '' })
      .select().single()
    if (error) throw error
    res.json({ post: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/qa/:id/answer — mentor posts an answer ─────────────────────────
app.patch('/api/qa/:id/answer', requireRole('mentor'), async (req, res) => {
  const { id } = req.params
  const { answer } = req.body
  const user = req.authUser
  if (!answer || answer.trim().length < 5) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Answer too short' })
  try {
    const { data: mentorRow } = await supabase.from('mentors').select('id').eq('user_id', user.id).maybeSingle()
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('qa_posts')
      .update({ answer: answer.trim(), answered_at: new Date().toISOString(), mentor_id: mentorRow?.id || null })
      .eq('id', id)
      .select().single()
    if (error) throw error
    res.json({ post: data })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── GET /api/notifications ─────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth(), async (req, res) => {
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    res.json({ notifications: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────
app.patch('/api/notifications/:id/read', requireAuth(), async (req, res) => {
  const { id } = req.params
  const user = req.authUser
  const client = getSupabaseClient(req.headers.authorization)
  try {
    const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ─── Chatbot Endpoint (lightweight, for new users) ────────────────────────────

const chatLimiter = createRateLimiter(10, 3600000, 'Too many chat messages. Please try again in an hour.')

const CHAT_SYSTEM_PROMPT = `You are a helpful, concise, and honest guide for Indian students asking general questions about education, courses, streams, and careers.

RULES:
1. Answer factual, general questions directly and clearly (e.g. "What is PCM?", "What is CUET?", "What can I do after Commerce?").
2. Keep answers short — under 150 words. Use bullet points if listing things.
3. Be honest and specific to Indian education context.
4. If the question requires knowing the student's personal situation (marks, income, state, family background, interests, risk comfort), do NOT try to answer it. Instead set handoff=true.
5. Examples of questions that need handoff: "Which stream is best for me?", "What college should I apply to?", "Will I get into NIT?", "Am I eligible for NEET?", "What should I do after my results?".
6. Examples that do NOT need handoff (answer directly): "What is JEE?", "What is the difference between NEET and JEE?", "What careers can I get in Commerce?", "What is ITI?", "How long is MBBS?".

RESPONSE FORMAT: Always respond in this exact JSON structure (no markdown, no backticks):
{
  "message": "Your answer here",
  "handoff": false,
  "handoff_reason": ""
}
If handoff is true, message should acknowledge the question and explain why personalised guidance is needed. handoff_reason should be 1 sentence explaining what personal context is missing.`

function getMockChatResponse(messages, profile) {
  const lastMsg = messages[messages.length - 1].content.toLowerCase()
  let response = "That's an interesting question! Can you tell me more about your current stream and what interests you?"
  let handoff = false
  let handoff_reason = ""

  if (profile) {
    const name = profile.full_name ? ` ${profile.full_name}` : ''
    const stream = profile.stream || 'your selected stream'
    const classLevel = profile.class_level === 'class10' ? 'Class 10' : profile.class_level === 'class12' ? 'Class 12' : 'school'
    
    if (lastMsg.includes('engineering') || lastMsg.includes('btech') || lastMsg.includes('b.tech') || lastMsg.includes('computer')) {
      if (profile.class_level === 'class12' && (profile.stream === 'Science' || profile.stream === 'Science (PCM)')) {
        response = `Hey${name}, since you are in Class 12 Science (marks: ${profile.marks || 'N/A'}, state: ${profile.state || 'N/A'}), engineering is a great path. You should prepare for exams like JEE and KCET/COMEDK. Your preferred admission mode is ${profile.preferred_admission || 'KCET'}.`
      } else {
        response = `Hi${name}, you mentioned you are in ${classLevel} with ${stream} stream. Typically, engineering requires Science (PCM) in Class 12. Let me know if you want to know about other options!`
      }
    } else if (lastMsg.includes('commerce') || lastMsg.includes('ca') || lastMsg.includes('bba')) {
      response = `Hi${name}, since you are in ${classLevel} and interested in Commerce/CA, you should focus on Accounting and Economics. We recommend checking BBA or B.Com programs in your preferred cities.`
    } else if (lastMsg.includes('scholarship') || lastMsg.includes('fee') || lastMsg.includes('cost')) {
      response = `Hi${name}, based on your profile (State: ${profile.state || 'N/A'}, Marks: ${profile.marks || 'N/A'}), we suggest checking the Scholarships tab on your Dashboard to see matching national and state benefits.`
    } else {
      response = `Hey${name}, based on your ${classLevel} ${stream} profile, how else can I help guide your education planning?`
    }
  } else {
    if (lastMsg.includes('engineering') || lastMsg.includes('btech') || lastMsg.includes('b.tech') || lastMsg.includes('computer')) {
      response = "Engineering (especially Computer Science) is highly popular. For high-quality, honest advice tailored to you, please fill out our Onboarding form so I know your class board, marks, and state."
      handoff = true
      handoff_reason = "Need student board and marks to suggest realistic engineering options."
    } else if (lastMsg.includes('commerce') || lastMsg.includes('ca') || lastMsg.includes('bba')) {
      response = "Commerce fields like CA, BBA, and finance offer amazing opportunities. I can give you a personalized 4-year roadmap if you complete the Onboarding profile first."
      handoff = true
      handoff_reason = "Requires family income range and preferred cities to tailor finance options."
    } else if (lastMsg.includes('scholarship') || lastMsg.includes('fee') || lastMsg.includes('cost')) {
      response = "We have mapped several state-specific and national scholarships in our database. Complete the onboarding so we can filter ones matching your family income!"
      handoff = true
      handoff_reason = "Requires family income range and state to filter scholarships."
    }
  }

  return {
    message: response,
    handoff,
    handoff_reason
  }
}

app.post('/api/chat', chatLimiter, async (req, res) => {
  const { messages, profile } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing messages array' })
  }
  // Validate message structure
  const validMessages = messages
    .filter(m => m.role && m.content && typeof m.content === 'string')
    .slice(-6) // max 6 messages context window
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 1000) }))

  if (validMessages.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'No valid messages found' })
  }

  try {
    let systemPrompt = CHAT_SYSTEM_PROMPT
    if (profile) {
      systemPrompt += `\n\nCURRENT STUDENT PROFILE CONTEXT:
- Name: ${profile.full_name || 'N/A'}
- Class: ${profile.class_level === 'class10' ? 'Class 10' : profile.class_level === 'class12' ? 'Class 12' : 'Other'}
- Stream: ${profile.stream || 'N/A'}
- Academic Marks: ${profile.marks || 'N/A'}
- State: ${profile.state || 'N/A'}
- Preferred Admission Mode: ${profile.preferred_admission || 'N/A'}

You MUST use this context when answering the student's questions. For example, if they ask for stream recommendations and they are in Class 10 with 85% marks, you can give tailored advice directly instead of triggering a handoff (since you already have the profile info!). Only trigger handoff (handoff=true) if they ask a highly specific personalized question whose required details are NOT in the profile above.`
    }

    const conversationLines = validMessages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'Student'}: ${m.content}`)
      .join('\n')

    const fullPrompt = `${systemPrompt}\n\nCONVERSATION SO FAR:\n${conversationLines}\n\nRespond to the latest student message per the RESPONSE FORMAT rules above.`

    const result = await callLLM(fullPrompt, {
      json: true,
      maxTokens: 512,
      temperature: 0.5,
      modelOverride: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      callType: 'chat',
    })
    res.json({
      message: result.message || 'Sorry, I couldn\'t generate a response. Please try again.',
      handoff: result.handoff === true,
      handoff_reason: result.handoff_reason || '',
    })
  } catch (err) {
    console.error('Chat API Error:', err.message)
    console.warn(`[WARN] Chat API failed: ${err.message}. Falling back to mock chat response...`)
    const result = getMockChatResponse(validMessages, profile)
    res.json({
      message: result.message,
      handoff: result.handoff,
      handoff_reason: result.handoff_reason
    })
  }
})

// ─── College Details Endpoint ─────────────────────────────────────────────────

// GET /api/college-details?name=RVCE
// Returns enriched college data from Supabase or AI-generated factsheet
app.get('/api/college-details', async (req, res) => {
  const name = (req.query.name || '').trim()
  if (!name || name.length < 2) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing college name' })
  }

  try {
    // 1. Try Supabase first — FULL-NAME match only.
    //    Tier 1: case-insensitive exact match on the whole name.
    //    Tier 2: the whole name as an ilike pattern (never the first word), and
    //            only accepted when it resolves to a single unambiguous row.
    //    Anything less confident is treated as "no DB match" and falls through
    //    to the AI path — returning a same-first-word institution's fees or
    //    cutoffs as authoritative data is worse than returning nothing.
    if (isSupabaseConfigured()) {
      const pattern = escapeIlikePattern(name)
      let match = null

      const { data: exactRows, error: exactError } = await supabase
        .from('colleges')
        .select('*')
        .ilike('name', pattern)
        .limit(5)

      if (!exactError) match = pickCollegeMatch(exactRows, name)

      if (!match) {
        const { data: fuzzyRows, error: fuzzyError } = await supabase
          .from('colleges')
          .select('*')
          .ilike('name', `%${pattern}%`)
          .limit(5)

        if (!fuzzyError) match = pickCollegeMatch(fuzzyRows, name)
      }

      if (match) {
        const c = match
        return res.json({
          source: 'database',
          fullName: c.name,
          city: c.city || null,
          state: c.state || null,
          type: c.college_type || null,
          website: c.source_url || null,
          fees: {
            govtQuota: c.yearly_cost_min ? `₹${(c.yearly_cost_min/1000).toFixed(0)}K–₹${(c.yearly_cost_max/1000).toFixed(0)}K/yr (Govt quota)` : null,
            managementQuota: null
          },
          cutoffs: { note: 'Check official counselling portal for latest cutoffs' },
          placements: { avgPackage: c.avg_package || 'See official placement reports' },
          reviews: c.review_snippet || null,
        })
      }
    }

    // 2. AI-generated fallback for unknown colleges
    const prompt = `You are an educational information expert. Provide a concise factsheet for this Indian college: "${name}"

    If you do not have reliable, specific information about THIS institution's fees, cutoffs, or placements, return null for that field. Do not estimate, generalize, or reuse figures from other institutions or from a generic 'typical Indian college' template.

    Respond ONLY with valid JSON in this exact structure (use null for unknown fields):
    {
      "fullName": "Full official name",
      "city": "City name",
      "state": "State name",
      "type": "Government/Private Aided/Private/Deemed University",
      "established": year_number_or_null,
      "naac": "Grade or null",
      "website": "https://official-url.edu or null",
      "fees": {
        "govtQuota": "Fee range string for govt quota seats or null",
        "managementQuota": "Fee range string for management quota or null"
      },
      "cutoffs": {
        "jee": "JEE rank range needed or null",
        "neet": "NEET rank range or null",
        "kcet": "KCET rank range or null",
        "note": "General note about admission process"
      },
      "placements": {
        "avgPackage": "Average package string",
        "topRecruiters": ["Company1", "Company2", "Company3"]
      },
      "reviews": "One line student review or general reputation note"
    }`

    try {
      const parsed = await callLLM(prompt, { json: true, maxTokens: 700, temperature: 0.1, callType: 'college_details' })
      return res.json({ ...parsed, source: 'ai_generated' })
    } catch (err) {
      console.warn('[college-details] AI fallback unavailable:', err.message)
      return res.json({ source: 'not_found' })
    }
  } catch (err) {
    console.error('College details error:', err.message)
    return res.json({ source: 'error', fullName: name })
  }
})

// ─── Course Feedback Endpoints ───────────────────────────────────────────────

// GET /api/course-feedback?stream=Science (PCM)
// Returns approved public feedback for a given stream/path
app.get('/api/course-feedback', async (req, res) => {
  const streamKey = req.query.stream
  if (!streamKey || streamKey.trim().length < 2) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing stream query param' })
  }
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ feedback: [] })
    }
    const { data, error } = await supabase
      .from('course_feedback')
      .select('id, content, created_at')
      .eq('stream_key', streamKey.trim())
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    res.json({ feedback: data || [] })
  } catch (err) {
    console.error('Course feedback fetch error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/course-feedback — authenticated students submit feedback
const courseFeedbackLimiter = createRateLimiter(3, 3600000, 'You can only submit 3 feedback entries per hour.')
app.post('/api/course-feedback', requireAuth(), courseFeedbackLimiter, async (req, res) => {
  const user = req.authUser
  const { streamKey, content } = req.body
  if (!streamKey || !content || content.trim().length < 20) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Feedback must be at least 20 characters and include a stream key.' })
  }
  if (content.trim().length > 1000) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Feedback must be under 1000 characters.' })
  }
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ success: true, simulated: true })
    }
    const client = getSupabaseClient(req.headers.authorization)
    const { data, error } = await client
      .from('course_feedback')
      .insert({
        stream_key: streamKey.trim(),
        author_id: user.id,
        content: content.trim(),
        approved: false // requires moderation before appearing publicly
      })
      .select('id')
      .single()
    if (error) throw error
    res.json({ success: true, id: data.id, message: 'Feedback submitted — it will appear after review.' })
  } catch (err) {
    console.error('Course feedback submit error:', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

// GET /api/admin/mentor-bookings — Fetch all "Book Mentor" requests
app.get('/api/admin/mentor-bookings', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('mentor_sessions')
      .select('*, mentors(name, initials, stream_category)')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ bookings: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// GET /api/admin/mentor-messages — Fetch all student -> mentor questions (monitoring)
app.get('/api/admin/mentor-messages', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('mentor_messages')
      .select('*, mentors(name, initials)')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ messages: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// GET /api/admin/mentor-applications — Fetch all applications
app.get('/api/admin/mentor-applications', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('mentor_applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ applications: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/mentor-applications/:id/approve — Approve a mentor application
app.post('/api/admin/mentor-applications/:id/approve', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const client = supabaseAdmin || supabase
  try {
    // 1. Get the application details
    const { data: app, error: getErr } = await client
      .from('mentor_applications')
      .select('*')
      .eq('id', id)
      .single()
    if (getErr || !app) return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found' })

    // 2. Insert into public.mentors
    const initials = app.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3) || 'M'
    
    // Choose a gradient/styling based on degree
    const styles = [
      { gradient: 'from-blue-500/30 to-blue-600/10', border: 'border-blue-500/25', tag_color: 'bg-blue-500/10 text-blue-300 border-blue-500/20', initials_bg: 'bg-blue-500/20 text-blue-300' },
      { gradient: 'from-amber-500/30 to-amber-600/10', border: 'border-amber-500/25', tag_color: 'bg-amber-500/10 text-amber-300 border-amber-500/20', initials_bg: 'bg-amber-500/20 text-amber-300' },
      { gradient: 'from-emerald-500/30 to-emerald-600/10', border: 'border-emerald-500/25', tag_color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', initials_bg: 'bg-emerald-500/20 text-emerald-300' }
    ]
    const chosenStyle = styles[Math.floor(Math.random() * styles.length)]

    const mentorRow = {
      name: app.name,
      initials,
      college: app.college || app.profession || 'N/A',
      degree: app.degree || app.profession || 'N/A',
      stream: app.stream_transition || app.stream_category || 'General',
      stream_category: app.stream_category || 'Other',
      city: 'Online',
      linkedin: app.linkedin || '',
      story: app.story,
      email: app.email || null,      // link key: matches the mentor's login email
      tags: [app.degree || app.profession || 'Mentor', 'Approved'],
      available: true,
      ...chosenStyle
    }

    let { error: insertErr } = await client.from('mentors').insert(mentorRow)
    // If the `email` column hasn't been migrated yet, retry without it so the
    // approval still succeeds (run supabase_mentor_dashboard_migration.sql).
    if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703' || /email/.test(insertErr.message || ''))) {
      console.warn('[mentor approve] mentors.email column missing — run supabase_mentor_dashboard_migration.sql. Inserting without email.')
      const { email, ...noEmail } = mentorRow
      const retry = await client.from('mentors').insert(noEmail)
      insertErr = retry.error
    }
    if (insertErr && insertErr.code !== '23505') { // ignore duplicate name error
      throw insertErr
    }

    // 3. Update application status to approved
    const { error: updateErr } = await client
      .from('mentor_applications')
      .update({ status: 'approved' })
      .eq('id', id)

    if (updateErr) throw updateErr

    // 3b. Best-effort: if the applicant already has an account, link their
    // mentor profile to it and flip their role so their dashboard works
    // immediately. Otherwise it auto-links on their next login (by email).
    if (supabaseAdmin && app.email) {
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers()
        const acct = (list?.users || []).find(u => (u.email || '').toLowerCase() === app.email.toLowerCase())
        if (acct) {
          await supabaseAdmin.from('mentors').update({ user_id: acct.id }).eq('name', app.name)
          await supabaseAdmin.from('students').update({ role: 'mentor' }).eq('id', acct.id)
        }
      } catch (linkErr) {
        console.warn('[mentor approve] account auto-link skipped:', linkErr.message)
      }
    }

    // Notify the applicant that they've been approved (best-effort).
    if (app.email) {
      sendEmail(
        app.email,
        'Your Mentor Application Was Approved — Aage Kya?',
        `<p>Hi ${app.name},</p>
         <p>Great news — your application to become a mentor on Aage Kya? has been <strong>approved</strong>.</p>
         <p>Your profile is now live and students can book sessions with you. Welcome aboard!</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/mentor-applications/:id/reject — Reject a mentor application
// Accepts an optional { reason } so the applicant is told why.
app.post('/api/admin/mentor-applications/:id/reject', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const reason = (req.body?.reason || '').trim()
  const client = supabaseAdmin || supabase
  try {
    // Fetch applicant details for the notification email.
    const { data: app } = await client
      .from('mentor_applications')
      .select('name, email')
      .eq('id', id)
      .maybeSingle()

    let { error } = await client
      .from('mentor_applications')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', id)
    // If the rejection_reason column hasn't been migrated yet, fall back to
    // updating just the status so the reject still succeeds (the reason is
    // still delivered to the applicant by email below).
    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('rejection_reason'))) {
      console.warn('[mentor reject] rejection_reason column missing — run supabase_mentor_application_fields.sql. Falling back to status-only update.')
      const retry = await client
        .from('mentor_applications')
        .update({ status: 'rejected' })
        .eq('id', id)
      error = retry.error
    }
    if (error) throw error

    // Notify the applicant with the rejection reason (best-effort).
    if (app?.email) {
      sendEmail(
        app.email,
        'Update on Your Mentor Application — Aage Kya?',
        `<p>Hi ${app.name || 'there'},</p>
         <p>Thank you for applying to become a mentor on Aage Kya?. After review, we're
         unable to approve your application at this time.</p>
         ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
         <p>You're welcome to apply again in the future. Thank you for your interest in
         helping students.</p>
         <p>— Team Aage Kya?</p>`
      ).catch(() => {})
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// GET /api/admin/course-feedback — Fetch all course feedback
app.get('/api/admin/course-feedback', requireRole('admin'), async (req, res) => {
  const client = supabaseAdmin || supabase
  try {
    const { data, error } = await client
      .from('course_feedback')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ feedback: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// POST /api/admin/course-feedback/:id/approve — Approve a feedback entry
app.post('/api/admin/course-feedback/:id/approve', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const client = supabaseAdmin || supabase
  try {
    const { error } = await client
      .from('course_feedback')
      .update({ approved: true })
      .eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// DELETE /api/admin/course-feedback/:id — Delete a feedback entry
app.delete('/api/admin/course-feedback/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params
  const client = supabaseAdmin || supabase
  try {
    const { error } = await client
      .from('course_feedback')
      .delete()
      .eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
  }
})

// Serve Vite frontend build (dist) if present, or fallback root API response
const distPath = path.join(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Aage Kya API Server is running' })
  })
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})

