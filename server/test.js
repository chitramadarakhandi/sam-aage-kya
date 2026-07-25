/**
 * Aage Kya? — Express Integration Test Suite
 *
 * Runs endpoints validation, rate limiters checks, and input schema tests.
 * Uses Node's built-in test runner (available in Node 18+).
 *
 * Boots a real server as a child process on an OS-assigned free port and waits
 * on /api/health for readiness. Startup wait is configurable via
 * TEST_SERVER_START_TIMEOUT_MS (default 60000) so the suite stays reliable when
 * it runs alongside the rest of the files under `node --test`.
 *
 * Usage:
 *   cd server
 *   node test.js            # or: npm run test:integration
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// How long to wait for the child server to become reachable. Generous by
// default because this file also runs under `node --test`, where ~26 test
// files compete for CPU and a cold Express boot can take well over 10s.
const START_TIMEOUT_MS = Number(process.env.TEST_SERVER_START_TIMEOUT_MS || 60000)

let BASE_URL = ''
let serverProcess
// Buffered child output. Deliberately NOT echoed line-by-line: this file's
// stdout is the test runner's own (V8-serialized) reporting channel, and
// funnelling a server log firehose through it is a source of corrupted frames.
// The buffer is only surfaced when startup fails, where it's actually useful.
const serverOutput = []

function recordOutput(label, data) {
  serverOutput.push(`[${label}] ${data.toString().trim()}`)
  if (serverOutput.length > 200) serverOutput.shift()
}

// Ask the OS for a free port instead of hardcoding 5001, which collides with a
// locally running dev server or a second concurrent test run.
function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function waitForHealth(url, deadline) {
  let lastError
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(
        `Test server exited early (code=${serverProcess.exitCode}, signal=${serverProcess.signalCode})\n` +
        serverOutput.join('\n')
      )
    }
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.status === 200) return
      lastError = new Error(`health check returned ${res.status}`)
    } catch (err) {
      lastError = err
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(
    `Test server did not become ready within ${START_TIMEOUT_MS}ms ` +
    `(last error: ${lastError && lastError.message})\n` +
    serverOutput.join('\n')
  )
}

before(async () => {
  const port = await findFreePort()
  BASE_URL = `http://127.0.0.1:${port}`

  // Strip the parent test-runner's own environment before handing it to the
  // grandchild. NODE_TEST_CONTEXT in particular makes a plain `node index.js`
  // believe it is a test-runner child and emit serialized reporter frames.
  const childEnv = { ...process.env }
  delete childEnv.NODE_TEST_CONTEXT
  delete childEnv.NODE_OPTIONS
  delete childEnv.NODE_V8_COVERAGE
  childEnv.PORT = String(port)
  childEnv.SUPABASE_SERVICE_ROLE_KEY = ''

  serverProcess = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  serverProcess.stdout.on('data', (data) => recordOutput('server stdout', data))
  serverProcess.stderr.on('data', (data) => recordOutput('server stderr', data))

  const spawnFailure = new Promise((_, reject) => {
    serverProcess.once('error', reject)
  })

  await Promise.race([
    waitForHealth(BASE_URL, Date.now() + START_TIMEOUT_MS),
    spawnFailure
  ])
})

// Stop server after tests finish, and wait for it to actually go away so its
// pipes are closed before this process starts tearing down.
after(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) return
  const exited = new Promise((resolve) => serverProcess.once('exit', resolve))
  serverProcess.kill()
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
})

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Aage Kya? API Integration Tests', () => {

  // 1. Health check
  test('GET /api/health should return status ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    assert.strictEqual(res.status, 200)
    
    const data = await res.json()
    assert.deepStrictEqual(data, { status: 'ok' })
  })

  // 2. Mentors roster
  test('GET /api/mentors should return list of active mentors', async () => {
    const res = await fetch(`${BASE_URL}/api/mentors`)
    assert.strictEqual(res.status, 200)
    
    const data = await res.json()
    assert.ok(Array.isArray(data))
    assert.ok(data.length > 0)
    assert.ok(data[0].hasOwnProperty('name'))
    assert.ok(data[0].hasOwnProperty('cal_link'))
  })

  // 3. Mentors apply endpoint validation
  test('POST /api/mentors/apply should return 400 when missing fields', async () => {
    const res = await fetch(`${BASE_URL}/api/mentors/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rahul' }) // missing other fields
    })
    
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'BAD_REQUEST')
  })

  // 4. Rate-limiter on volunteer applications (1 per hour)
  test('POST /api/mentors/apply should rate limit on subsequent calls', async () => {
    const validBody = {
      name: 'Test Mentor',
      email: 'test@example.com',
      college: 'Test College',
      degree: 'B.Tech',
      stream: 'PCM to CSE',
      story: 'Test advice.'
    }

    // First request should succeed
    const res1 = await fetch(`${BASE_URL}/api/mentors/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody)
    })
    assert.strictEqual(res1.status, 200)

    // Second request immediately after should be rate limited (429)
    const res2 = await fetch(`${BASE_URL}/api/mentors/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody)
    })
    assert.strictEqual(res2.status, 429)
    const data2 = await res2.json()
    assert.strictEqual(data2.error, 'RATE_LIMIT')
  })

  // 5. Guidance validation
  test('POST /api/guidance should return 400 when missing formData', async () => {
    const res = await fetch(`${BASE_URL}/api/guidance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    assert.strictEqual(res.status, 400)
  })

  // 6. Roadmap validation
  test('POST /api/roadmap should return 400 when missing formData or option', async () => {
    const res = await fetch(`${BASE_URL}/api/roadmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData: {} }) // missing option
    })
    assert.strictEqual(res.status, 400)
  })

  // 7. Transcribe validation
  test('POST /api/transcribe should return 400 when missing audio data', async () => {
    const res = await fetch(`${BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    assert.strictEqual(res.status, 400)
  })
})
