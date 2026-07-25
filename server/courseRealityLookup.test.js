/**
 * Guards getCourseReality (src/data/courseReality.js) against first-word
 * cross-matching: the fuzzy tier used `key.split(' ')[0]`, so
 * "Science (PCB) with Research" could fall into the "Science (PCM)" entry.
 * Full-string containment (the documented "Science (PCM) with Tech Focus" →
 * "Science (PCM)" behaviour) must still work.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { COURSE_REALITY, getCourseReality } from '../src/data/courseReality.js'

test('exact keys still resolve to themselves', () => {
  for (const key of Object.keys(COURSE_REALITY)) {
    assert.equal(getCourseReality(key), COURSE_REALITY[key])
  }
})

test('intended full-substring match is preserved', () => {
  assert.equal(getCourseReality('Science (PCM) with Tech Focus'), COURSE_REALITY['Science (PCM)'])
  assert.equal(getCourseReality('  science (pcm)  '), COURSE_REALITY['Science (PCM)'])
})

test('shared first word no longer cross-matches a different stream', () => {
  const pcm = COURSE_REALITY['Science (PCM)']
  const pcb = COURSE_REALITY['Science (PCB)']

  // Previously: split(' ')[0] === 'science' matched the first "Science …" key.
  assert.equal(getCourseReality('Science (PCB) with Research'), pcb)
  assert.notEqual(getCourseReality('Science (PCB) with Research'), pcm)

  // A bare, ambiguous first word must not silently pick PCM's pros/cons.
  const bare = getCourseReality('Diploma in Medical Laboratory Technology')
  assert.notEqual(bare, pcm)
})

test('unknown course keys return null', () => {
  assert.equal(getCourseReality('Underwater Basket Weaving'), null)
  assert.equal(getCourseReality(''), null)
  assert.equal(getCourseReality(null), null)
})
