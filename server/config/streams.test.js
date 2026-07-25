import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { EXAM_STREAM_MAP, detectStreamExamMismatch, normalizeStream } from './streams.js'

describe('EXAM_STREAM_MAP', () => {
  test('every exam has at least one valid stream', () => {
    for (const [exam, streams] of Object.entries(EXAM_STREAM_MAP)) {
      assert.ok(streams.length > 0, `${exam} should have at least one valid stream`)
    }
  })

  test('contains expected exam entries', () => {
    assert.ok('jee' in EXAM_STREAM_MAP)
    assert.ok('neet' in EXAM_STREAM_MAP)
    assert.ok('ca foundation' in EXAM_STREAM_MAP)
    assert.ok('clat' in EXAM_STREAM_MAP)
    assert.ok('nift' in EXAM_STREAM_MAP)
    assert.ok('uceed' in EXAM_STREAM_MAP)
  })

  test('jee maps to science (pcm)', () => {
    assert.deepEqual(EXAM_STREAM_MAP['jee'], ['science (pcm)'])
  })

  test('neet maps to science (pcb) and science (pcmb)', () => {
    assert.deepEqual(EXAM_STREAM_MAP['neet'], ['science (pcb)', 'science (pcmb)'])
  })

  test('map is frozen', () => {
    assert.throws(() => { EXAM_STREAM_MAP['new_exam'] = ['test'] }, TypeError)
  })
})

describe('detectStreamExamMismatch', () => {
  describe('returns isMismatch=false for compatible pairs', () => {
    test('Science (PCM) + JEE', () => {
      const result = detectStreamExamMismatch('Science (PCM)', 'JEE')
      assert.equal(result.isMismatch, false)
      assert.equal(result.advisory, '')
      assert.deepEqual(result.bridgePaths, [])
    })

    test('Science (PCB) + NEET', () => {
      const result = detectStreamExamMismatch('Science (PCB)', 'NEET')
      assert.equal(result.isMismatch, false)
    })

    test('Commerce + CA Foundation', () => {
      const result = detectStreamExamMismatch('Commerce', 'CA Foundation')
      assert.equal(result.isMismatch, false)
    })

    test('Arts / Humanities + CLAT', () => {
      const result = detectStreamExamMismatch('Arts / Humanities', 'CLAT')
      assert.equal(result.isMismatch, false)
    })

    test('Commerce + CLAT', () => {
      const result = detectStreamExamMismatch('Commerce', 'CLAT')
      assert.equal(result.isMismatch, false)
    })
  })

  describe('returns isMismatch=false for no-exam cases', () => {
    test('empty exam string', () => {
      const result = detectStreamExamMismatch('Commerce', '')
      assert.equal(result.isMismatch, false)
    })

    test('null exam', () => {
      const result = detectStreamExamMismatch('Commerce', null)
      assert.equal(result.isMismatch, false)
    })

    test('undefined exam', () => {
      const result = detectStreamExamMismatch('Commerce', undefined)
      assert.equal(result.isMismatch, false)
    })

    test('exam is "none"', () => {
      const result = detectStreamExamMismatch('Commerce', 'none')
      assert.equal(result.isMismatch, false)
    })

    test('exam is "None" (casing)', () => {
      const result = detectStreamExamMismatch('Commerce', 'None')
      assert.equal(result.isMismatch, false)
    })
  })

  describe('returns isMismatch=false for unknown exams', () => {
    test('unknown exam not in map', () => {
      const result = detectStreamExamMismatch('Commerce', 'GATE')
      assert.equal(result.isMismatch, false)
    })
  })

  describe('detects mismatches correctly', () => {
    test('Commerce + JEE', () => {
      const result = detectStreamExamMismatch('Commerce', 'JEE')
      assert.equal(result.isMismatch, true)
      assert.ok(result.advisory.length > 0)
      assert.ok(result.bridgePaths.length > 0)
      assert.ok(result.bridgePaths.includes('B.Tech via lateral entry after B.Com'))
      assert.ok(result.bridgePaths.includes('Integrated Management-Engineering (Quant Finance)'))
      assert.ok(result.bridgePaths.includes('B.Sc Economics (Quantitative)'))
    })

    test('Arts / Humanities + NEET', () => {
      const result = detectStreamExamMismatch('Arts / Humanities', 'NEET')
      assert.equal(result.isMismatch, true)
      assert.ok(result.advisory.length > 0)
      assert.ok(result.bridgePaths.includes('Healthcare Management (BHA)'))
      assert.ok(result.bridgePaths.includes('B.Sc Psychology'))
      assert.ok(result.bridgePaths.includes('Public Health'))
    })

    test('Arts / Humanities + JEE', () => {
      const result = detectStreamExamMismatch('Arts / Humanities', 'JEE')
      assert.equal(result.isMismatch, true)
      assert.ok(result.bridgePaths.length > 0)
    })

    test('Commerce + NEET', () => {
      const result = detectStreamExamMismatch('Commerce', 'NEET')
      assert.equal(result.isMismatch, true)
      assert.ok(result.bridgePaths.length > 0)
    })
  })

  describe('handles normalization edge cases', () => {
    test('handles extra whitespace in stream', () => {
      const result = detectStreamExamMismatch('  Commerce  ', 'JEE')
      assert.equal(result.isMismatch, true)
    })

    test('handles casing variations in exam', () => {
      const result = detectStreamExamMismatch('Commerce', 'jee')
      assert.equal(result.isMismatch, true)
    })

    test('handles mixed casing in exam', () => {
      const result = detectStreamExamMismatch('Science (PCM)', 'Jee')
      assert.equal(result.isMismatch, false)
    })

    test('handles whitespace in exam', () => {
      const result = detectStreamExamMismatch('Commerce', '  CA Foundation  ')
      assert.equal(result.isMismatch, false)
    })
  })

  describe('advisory content', () => {
    test('advisory mentions the exam name', () => {
      const result = detectStreamExamMismatch('Commerce', 'JEE')
      assert.ok(result.advisory.includes('JEE'))
    })

    test('advisory mentions the stream', () => {
      const result = detectStreamExamMismatch('Commerce', 'JEE')
      assert.ok(result.advisory.includes('Commerce'))
    })

    test('advisory mentions valid streams for the exam', () => {
      const result = detectStreamExamMismatch('Commerce', 'JEE')
      assert.ok(result.advisory.includes('science (pcm)'))
    })
  })
})
