/**
 * Shared LLM client tests — availability gating + structured call telemetry.
 *
 * REGRESSION FOCUS (availability):
 *   `isAiAvailable()` used to gate on only GROQ_API_KEY / OPENAI_API_KEY while
 *   `buildProviderChain()` builds from FOUR keys, so a Gemini-only or
 *   OpenRouter-only deployment was reported unavailable and `callLLM` threw
 *   AI_UNAVAILABLE before trying the provider that would have worked.
 *
 * DETERMINISM: no network. `global.fetch` is always replaced with an in-process
 * stub; provider-key env vars are patched per test and restored in teardown.
 *
 * ISOLATION: the circuit breaker is module-level state, so tests that open the
 * breaker import a FRESH module instance via a cache-busting import query.
 */

import { describe, test, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'

const PROVIDER_KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY']
const MANAGED_ENV = [...PROVIDER_KEYS, 'GROQ_MODEL', 'GEMINI_MODEL', 'OPENROUTER_MODEL']

const SAVED_ENV = {}
for (const key of MANAGED_ENV) SAVED_ENV[key] = process.env[key]

const REAL_FETCH = global.fetch
const REAL_LOG = console.log
const REAL_WARN = console.warn
const REAL_ERROR = console.error

function clearProviderKeys() {
  for (const key of MANAGED_ENV) delete process.env[key]
}

function restoreEnv() {
  for (const key of MANAGED_ENV) {
    if (SAVED_ENV[key] === undefined) delete process.env[key]
    else process.env[key] = SAVED_ENV[key]
  }
}

/** Fresh module instance (independent breaker state) — no network at import. */
let freshCounter = 0
function freshClient() {
  freshCounter += 1
  return import(`./llmClient.js?testInstance=${freshCounter}`)
}

/** Capture console output as parsed-JSON lines plus the raw strings. */
function captureConsole() {
  const lines = { log: [], error: [], warn: [] }
  console.log = (...args) => lines.log.push(args.join(' '))
  console.warn = (...args) => lines.warn.push(args.join(' '))
  console.error = (...args) => lines.error.push(args.join(' '))
  return {
    lines,
    events(stream) {
      return lines[stream]
        .map((line) => { try { return JSON.parse(line) } catch { return null } })
        .filter(Boolean)
    },
  }
}

function restoreConsole() {
  console.log = REAL_LOG
  console.warn = REAL_WARN
  console.error = REAL_ERROR
}

function llmOk(payload, usage = { total_tokens: 42 }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage }),
  }
}

afterEach(() => {
  restoreConsole()
  global.fetch = REAL_FETCH
})

after(() => {
  restoreConsole()
  global.fetch = REAL_FETCH
  restoreEnv()
})

// ════════════════════════════════════════════════════════════════════════════
//  isAiAvailable() / getAiStatus() key gating
// ════════════════════════════════════════════════════════════════════════════

describe('isAiAvailable — key gating matches the provider chain', () => {
  test('REGRESSION: true with ONLY GEMINI_API_KEY set', async () => {
    const { isAiAvailable } = await freshClient()
    clearProviderKeys()
    process.env.GEMINI_API_KEY = 'test-key-never-sent-anywhere'
    assert.equal(isAiAvailable(), true)
  })

  test('REGRESSION: true with ONLY OPENROUTER_API_KEY set', async () => {
    const { isAiAvailable } = await freshClient()
    clearProviderKeys()
    process.env.OPENROUTER_API_KEY = 'test-key-never-sent-anywhere'
    assert.equal(isAiAvailable(), true)
  })

  test('true with ONLY GROQ_API_KEY and with ONLY OPENAI_API_KEY', async () => {
    const { isAiAvailable } = await freshClient()
    for (const key of ['GROQ_API_KEY', 'OPENAI_API_KEY']) {
      clearProviderKeys()
      process.env[key] = 'test-key-never-sent-anywhere'
      assert.equal(isAiAvailable(), true, `expected available with only ${key}`)
    }
  })

  test('false with NO provider key set', async () => {
    const { isAiAvailable } = await freshClient()
    clearProviderKeys()
    assert.equal(isAiAvailable(), false)
  })

  test('false when the breaker is open despite a key being present', async () => {
    const { isAiAvailable, callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GEMINI_API_KEY = 'test-key-never-sent-anywhere'
    captureConsole()

    // A 429 from every configured provider opens the breaker.
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' })
    await assert.rejects(callLLM('ping'), (err) => err.code === 'AI_RATE_LIMITED')
    restoreConsole()

    assert.equal(isAiAvailable(), false, 'breaker is open, so AI must be unavailable')
    // And the key is still there — availability is gated by the breaker, not the key.
    assert.equal(process.env.GEMINI_API_KEY, 'test-key-never-sent-anywhere')
  })

  test('getAiStatus stays consistent with isAiAvailable for each single-key config', async () => {
    const { isAiAvailable, getAiStatus } = await freshClient()
    for (const key of PROVIDER_KEYS) {
      clearProviderKeys()
      process.env[key] = 'test-key-never-sent-anywhere'
      const status = getAiStatus()
      assert.equal(status.available, true, `getAiStatus().available should be true with only ${key}`)
      assert.equal(status.available, isAiAvailable())
      assert.equal(status.reason, null)
      assert.equal(status.retryAfterSeconds, 0)
    }

    clearProviderKeys()
    const noKeyStatus = getAiStatus()
    assert.equal(noKeyStatus.available, false)
    assert.equal(noKeyStatus.available, isAiAvailable())
    assert.equal(noKeyStatus.reason, 'no_key')
  })

  test('getAiStatus keeps the shape the frontend banner reads', async () => {
    const { getAiStatus } = await freshClient()
    clearProviderKeys()
    process.env.OPENROUTER_API_KEY = 'test-key-never-sent-anywhere'
    const status = getAiStatus()
    for (const field of ['available', 'reason', 'retryAfterSeconds', 'approxTokensUsedToday', 'lastProvider']) {
      assert.ok(field in status, `getAiStatus() is missing "${field}"`)
    }
  })

  /**
   * Property: availability tracks "at least one provider key configured" for
   * ANY subset of the four keys (breaker closed, no network touched).
   */
  test('Property: isAiAvailable() is true exactly when some provider key is set', async () => {
    const { isAiAvailable } = await freshClient()
    fc.assert(
      fc.property(
        fc.subarray(PROVIDER_KEYS),
        (present) => {
          clearProviderKeys()
          for (const key of present) process.env[key] = 'test-key-never-sent-anywhere'
          assert.equal(isAiAvailable(), present.length > 0)
        }
      ),
      { numRuns: 50 }
    )
    clearProviderKeys()
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  Structured per-call telemetry
// ════════════════════════════════════════════════════════════════════════════

describe('callLLM — structured ai_call / ai_call_error telemetry', () => {
  test('a successful call emits one ai_call line with provider, tokens, latency and parseOk', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    process.env.GROQ_MODEL = 'stub-model-1'
    const cap = captureConsole()
    global.fetch = async () => llmOk({ ok: true }, { total_tokens: 123 })

    const result = await callLLM('a prompt with some length to it', { callType: 'roadmap', studentId: 'stu-1' })
    restoreConsole()

    assert.deepStrictEqual(result, { ok: true })

    const calls = cap.events('log').filter((e) => e.event === 'ai_call')
    assert.equal(calls.length, 1)
    const line = calls[0]
    assert.equal(line.provider, 'groq')
    assert.equal(line.model, 'stub-model-1')
    assert.equal(line.callType, 'roadmap')
    assert.equal(line.studentId, 'stu-1')
    assert.equal(line.parseOk, true)
    assert.equal(line.totalTokens, 123)
    assert.equal(typeof line.promptTokens, 'number')
    assert.ok(line.promptTokens > 0)
    assert.equal(typeof line.latencyMs, 'number')
    assert.ok(line.latencyMs >= 0)
    assert.equal(typeof line.ts, 'string')
    assert.ok(!Number.isNaN(Date.parse(line.ts)))
  })

  test('callType defaults to "unspecified" so existing call sites keep working', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    const cap = captureConsole()
    global.fetch = async () => llmOk({ ok: true })

    // Exactly the existing call-site signature — no telemetry options passed.
    await callLLM('prompt', { json: true, maxTokens: 800, temperature: 0.2 })
    restoreConsole()

    const line = cap.events('log').find((e) => e.event === 'ai_call')
    assert.ok(line)
    assert.equal(line.callType, 'unspecified')
    assert.equal(line.studentId, null)
  })

  test('a provider fallback is visible: failed attempt line then ai_call on the next provider', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    process.env.GEMINI_API_KEY = 'test-key-never-sent-anywhere'
    const cap = captureConsole()
    global.fetch = async (url) => (
      String(url).includes('groq')
        ? { ok: false, status: 500, text: async () => 'boom' }
        : llmOk({ served: 'gemini' })
    )

    const result = await callLLM('prompt', { callType: 'guidance' })
    restoreConsole()

    assert.deepStrictEqual(result, { served: 'gemini' })

    const attempts = cap.events('error').filter((e) => e.event === 'ai_call_attempt')
    assert.equal(attempts.length, 1)
    assert.equal(attempts[0].provider, 'groq')
    assert.equal(attempts[0].attempt, 1)
    assert.equal(attempts[0].ok, false)
    assert.equal(typeof attempts[0].latencyMs, 'number')

    const success = cap.events('log').filter((e) => e.event === 'ai_call')
    assert.equal(success.length, 1)
    assert.equal(success[0].provider, 'gemini')
    assert.equal(success[0].attempt, 2)
  })

  test('a terminal rate-limited failure emits ai_call_error with code AI_RATE_LIMITED', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    const cap = captureConsole()
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' })

    await assert.rejects(callLLM('prompt', { callType: 'guidance' }), (err) => err.code === 'AI_RATE_LIMITED')
    restoreConsole()

    const errors = cap.events('error').filter((e) => e.event === 'ai_call_error')
    assert.equal(errors.length, 1)
    assert.equal(errors[0].code, 'AI_RATE_LIMITED')
    assert.equal(errors[0].error, 'AI_RATE_LIMITED')
    assert.equal(errors[0].callType, 'guidance')
    assert.equal(errors[0].parseOk, false)
    assert.equal(errors[0].provider, 'groq')
    assert.equal(typeof errors[0].latencyMs, 'number')
  })

  test('an unavailable AI (no key) emits ai_call_error with code AI_UNAVAILABLE', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    const cap = captureConsole()
    let fetchCalls = 0
    global.fetch = async () => { fetchCalls++; throw new Error('should never be called') }

    await assert.rejects(callLLM('prompt'), (err) => err.code === 'AI_UNAVAILABLE')
    restoreConsole()

    assert.equal(fetchCalls, 0)
    const errors = cap.events('error').filter((e) => e.event === 'ai_call_error')
    assert.equal(errors.length, 1)
    assert.equal(errors[0].code, 'AI_UNAVAILABLE')
    assert.equal(errors[0].attempts, 0)
  })

  test('a non-JSON provider body falls through and reports parse failure per attempt', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    const cap = captureConsole()
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }], usage: { total_tokens: 5 } }),
    })

    await assert.rejects(callLLM('prompt'))
    restoreConsole()

    const attempts = cap.events('error').filter((e) => e.event === 'ai_call_attempt')
    assert.equal(attempts.length, 1)
    assert.equal(attempts[0].parseOk, false)
    const errors = cap.events('error').filter((e) => e.event === 'ai_call_error')
    assert.equal(errors.length, 1)
    assert.equal(errors[0].provider, 'groq')
  })

  test('json:false returns raw text and still logs ai_call', async () => {
    const { callLLM } = await freshClient()
    clearProviderKeys()
    process.env.GROQ_API_KEY = 'test-key-never-sent-anywhere'
    const cap = captureConsole()
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'plain text answer' } }] }),
    })

    const text = await callLLM('prompt', { json: false })
    restoreConsole()

    assert.equal(text, 'plain text answer')
    const line = cap.events('log').find((e) => e.event === 'ai_call')
    assert.ok(line)
    assert.equal(line.parseOk, true)
    assert.equal(line.totalTokens, null)
  })
})
