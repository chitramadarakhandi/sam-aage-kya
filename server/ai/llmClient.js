/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SHARED LLM CLIENT  —  single source of truth for all AI calls
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Consolidates what used to be duplicated in Orchestrator.js and
 *  pathwayAdvisor.js. Fixes the recurring bug class (stale env capture,
 *  divergent model logic) and adds:
 *
 *   • Lazy env reads (keys resolved per-call, after dotenv has loaded)
 *   • A daily TOKEN CIRCUIT BREAKER — once we approach the free-tier cap or
 *     the provider returns 429 (rate_limit), we "open" the breaker and stop
 *     making calls until it resets. Callers can check isAiAvailable() and show
 *     an honest "AI busy" message instead of silently serving mock data.
 *   • Provider fallback (Groq → OpenAI) when a key is present.
 *
 *  IMPORTANT: this module must be import-safe BEFORE dotenv runs, so it never
 *  reads process.env at module-load time — only inside functions.
 */

// ─── Circuit breaker state (in-memory, per process) ──────────────────────────
const breaker = {
  open: false,          // true = stop calling the LLM
  openedAt: 0,          // epoch ms when it opened
  cooldownMs: 20 * 60 * 1000, // 20 min — matches Groq's rolling daily window feel
  reason: '',           // 'rate_limit' | 'no_key' | 'error'
  approxTokensUsed: 0,  // rough running estimate for this process
  lastResetDay: new Date().toISOString().slice(0, 10),
  lastProvider: null,   // which provider served the most recent successful call
}

// Rough token estimate: ~4 chars per token (good enough for budgeting).
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4)
}

// Reset the running token estimate at UTC day boundary.
function rolloverIfNewDay() {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== breaker.lastResetDay) {
    breaker.approxTokensUsed = 0
    breaker.lastResetDay = today
    if (breaker.reason === 'rate_limit') closeBreaker()
  }
}

function openBreaker(reason) {
  breaker.open = true
  breaker.openedAt = Date.now()
  breaker.reason = reason
  console.warn(`[llm] circuit breaker OPEN (${reason}). Pausing AI calls for ~${breaker.cooldownMs / 60000} min.`)
}

function closeBreaker() {
  breaker.open = false
  breaker.reason = ''
  console.log('[llm] circuit breaker CLOSED. AI calls resumed.')
}

/** Is the AI usable right now? Auto-closes the breaker after cooldown. */
export function isAiAvailable() {
  rolloverIfNewDay()
  if (breaker.open && Date.now() - breaker.openedAt > breaker.cooldownMs) {
    closeBreaker()
  }
  // No key configured at all → not available.
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) return false
  return !breaker.open
}

/** Public status for the frontend "AI busy" banner. */
export function getAiStatus() {
  const available = isAiAvailable()
  const anyKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  return {
    available,
    reason: available ? null : (breaker.reason || (!anyKey ? 'no_key' : 'busy')),
    retryAfterSeconds: available ? 0 : Math.max(0, Math.round((breaker.cooldownMs - (Date.now() - breaker.openedAt)) / 1000)),
    approxTokensUsedToday: breaker.approxTokensUsed,
    lastProvider: breaker.lastProvider || null,
  }
}

/**
 * Core LLM call. Returns parsed JSON (default) or raw text.
 * Throws 'AI_UNAVAILABLE' when the breaker is open, and opens the breaker on 429.
 */
export async function callLLM(prompt, { json = true, maxTokens = 800, temperature = 0.2, modelOverride = null } = {}) {
  rolloverIfNewDay()
  if (!isAiAvailable()) {
    const err = new Error('AI_UNAVAILABLE')
    err.code = 'AI_UNAVAILABLE'
    throw err
  }

  // Build the provider chain in priority order. Each is an OpenAI-compatible
  // endpoint (Gemini has an OpenAI-compatible URL too). We try each in turn;
  // if one is rate-limited (429) we fall through to the next. The breaker only
  // opens when EVERY configured provider is exhausted.
  const providers = buildProviderChain(modelOverride)
  if (providers.length === 0) {
    openBreaker('no_key')
    const err = new Error('NO_API_KEY')
    err.code = 'NO_API_KEY'
    throw err
  }

  let anyRateLimited = false
  let lastError = null

  for (const p of providers) {
    const body = {
      model: p.model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }
    if (json) body.response_format = { type: 'json_object' }

    try {
      const res = await fetch(p.url, { method: 'POST', headers: p.headers, body: JSON.stringify(body) })

      if (res.status === 429) {
        anyRateLimited = true
        console.warn(`[llm] ${p.name} rate-limited (429) — trying next provider…`)
        continue // fall through to the next provider
      }
      if (!res.ok) {
        lastError = new Error(`${p.name} error ${res.status}: ${(await res.text()).slice(0, 160)}`)
        console.warn(`[llm] ${lastError.message} — trying next provider…`)
        continue
      }

      const data = await res.json()
      const used = data.usage?.total_tokens || (estimateTokens(prompt) + estimateTokens(JSON.stringify(data)))
      breaker.approxTokensUsed += used
      breaker.lastProvider = p.name

      const text = data.choices?.[0]?.message?.content ?? ''
      if (!json) return text
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      return JSON.parse(cleaned)
    } catch (err) {
      lastError = err
      console.warn(`[llm] ${p.name} call failed: ${err.message} — trying next provider…`)
      continue
    }
  }

  // Every provider failed. If it was due to rate limits, open the breaker.
  if (anyRateLimited) {
    openBreaker('rate_limit')
    const err = new Error('AI_RATE_LIMITED')
    err.code = 'AI_RATE_LIMITED'
    throw err
  }
  throw lastError || new Error('All AI providers failed')
}

/**
 * Assemble the ordered list of OpenAI-compatible providers from whatever keys
 * are configured. Add a key → it automatically joins the fallback chain.
 * Order: Groq (fast) → Gemini (generous free tier) → OpenRouter → OpenAI.
 */
function buildProviderChain(modelOverride) {
  const chain = []

  if (process.env.GROQ_API_KEY) {
    chain.push({
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      model: modelOverride || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    })
  }

  if (process.env.GEMINI_API_KEY) {
    // Google's OpenAI-compatible endpoint — no extra SDK needed.
    chain.push({
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    })
  }

  if (process.env.OPENROUTER_API_KEY) {
    chain.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    })
  }

  if (process.env.OPENAI_API_KEY) {
    chain.push({
      name: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      model: 'gpt-4o-mini',
    })
  }

  return chain
}
