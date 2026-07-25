/**
 * Guards the /api/roadmap fallback contract.
 *
 * The endpoint's contract is { career_path, overview, years }. Before the LLM
 * client consolidation, an AI failure on this route silently returned
 * GUIDANCE-shaped mock data ({ summary, options, ... }), which wrote nulls into
 * the roadmaps table and shipped wrong-shaped JSON to the frontend.
 *
 * server/index.js is a monolith that calls app.listen() at import time, so we
 * cannot import it here. Instead we extract getMockRoadmap's real source from
 * the file and evaluate it in isolation, and assert the route wires it up.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.js')
const source = readFileSync(indexPath, 'utf8')

/** Pull a top-level `function name(...) { ... }` out of the source by brace matching. */
function extractFunction(src, name) {
  const signature = `function ${name}(`
  const start = src.indexOf(signature)
  assert.notEqual(start, -1, `${name} not found in index.js`)
  const bodyStart = src.indexOf('{', start)
  let depth = 0
  for (let i = bodyStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error(`Unbalanced braces while extracting ${name}`)
}

const getMockRoadmap = new Function(`${extractFunction(source, 'getMockRoadmap')}; return getMockRoadmap`)()

test('getMockRoadmap returns roadmap-shaped data, not guidance-shaped', () => {
  const mock = getMockRoadmap({ marks: '91' }, { path: 'Data Analyst' })

  assert.equal(mock.career_path, 'Data Analyst')
  assert.equal(typeof mock.overview, 'string')
  assert.ok(mock.overview.length > 0)
  assert.ok(Array.isArray(mock.years))
  assert.ok(mock.years.length > 0)

  // Guidance-shaped keys must NOT leak into a roadmap response.
  assert.equal(mock.options, undefined)
  assert.equal(mock.summary, undefined)
})

test('getMockRoadmap years carry the fields the frontend renders', () => {
  const mock = getMockRoadmap({}, { path: 'Architect' })
  for (const year of mock.years) {
    assert.equal(typeof year.year, 'number')
    assert.equal(typeof year.focus, 'string')
    assert.ok(Array.isArray(year.skills))
    assert.ok(Array.isArray(year.milestones))
  }
})

test('getMockRoadmap tolerates a missing option', () => {
  const mock = getMockRoadmap({}, undefined)
  assert.equal(typeof mock.career_path, 'string')
  assert.ok(Array.isArray(mock.years))
})

test('/api/roadmap falls back to getMockRoadmap, and callGemini is gone', () => {
  const routeStart = source.indexOf("app.post('/api/roadmap'")
  assert.notEqual(routeStart, -1, '/api/roadmap route not found')
  const routeEnd = source.indexOf("app.post('/api/generate-career-path'", routeStart)
  const route = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd)

  assert.ok(route.includes('callLLM('), 'roadmap route should use the shared callLLM')
  assert.ok(route.includes('getMockRoadmap(formData, option)'), 'roadmap route should fall back to getMockRoadmap')
  assert.ok(!route.includes('getMockGuidance'), 'roadmap route must not fall back to guidance-shaped mock')
  assert.ok(!source.includes('callGemini'), 'the local callGemini helper should be removed')
})
