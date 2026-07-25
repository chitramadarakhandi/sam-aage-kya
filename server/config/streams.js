/**
 * Shared stream constants for the backend.
 *
 * Single source of truth for all stream value strings used in:
 *   - College filtering in runSearchRetrievalAgent
 *   - Seed data (server/seed.js) — comments reference these exact strings
 *   - Scholarship stream eligibility checks
 *
 * Both sides must use these exact strings. Normalisation is handled by
 * normalizeStream() to gracefully handle minor casing / whitespace drift.
 */

/** Canonical stream values exactly as used in seed data and DB */
export const STREAM_VALUES = Object.freeze([
  'Science (PCM)',
  'Science (PCB)',
  'Commerce',
  'Arts / Humanities',
])

/**
 * Normalize a stream string for comparison:
 * trim whitespace, collapse internal runs of whitespace, lowercase.
 * @param {string} s
 * @returns {string}
 */
export function normalizeStream(s) {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Check whether two stream strings refer to the same stream
 * after normalization. Safe against minor casing/whitespace drift.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function streamsMatch(a, b) {
  return normalizeStream(a) === normalizeStream(b)
}

/**
 * Maps normalized exam names to arrays of compatible streams (normalized).
 * Used by detectStreamExamMismatch to validate stream-exam compatibility.
 */
export const EXAM_STREAM_MAP = Object.freeze({
  'jee': Object.freeze(['science (pcm)']),
  'jee main': Object.freeze(['science (pcm)']),
  'jee advanced': Object.freeze(['science (pcm)']),
  'neet': Object.freeze(['science (pcb)', 'science (pcmb)']),
  'neet-ug': Object.freeze(['science (pcb)', 'science (pcmb)']),
  'ca foundation': Object.freeze(['commerce']),
  'clat': Object.freeze(['arts / humanities', 'commerce']),
  'nift': Object.freeze(['science (pcm)', 'arts / humanities']),
  'uceed': Object.freeze(['science (pcm)', 'arts / humanities']),
})

/**
 * Pre-computed bridge recommendations for known mismatch pairs.
 * Key format: "stream::exam" (both normalized).
 */
const BRIDGE_PATHS = Object.freeze({
  'commerce::jee': Object.freeze([
    'B.Tech via lateral entry after B.Com',
    'Integrated Management-Engineering (Quant Finance)',
    'B.Sc Economics (Quantitative)',
  ]),
  'commerce::jee main': Object.freeze([
    'B.Tech via lateral entry after B.Com',
    'Integrated Management-Engineering (Quant Finance)',
    'B.Sc Economics (Quantitative)',
  ]),
  'commerce::jee advanced': Object.freeze([
    'B.Tech via lateral entry after B.Com',
    'Integrated Management-Engineering (Quant Finance)',
    'B.Sc Economics (Quantitative)',
  ]),
  'arts / humanities::neet': Object.freeze([
    'Healthcare Management (BHA)',
    'B.Sc Psychology',
    'Public Health',
  ]),
  'arts / humanities::neet-ug': Object.freeze([
    'Healthcare Management (BHA)',
    'B.Sc Psychology',
    'Public Health',
  ]),
  'arts / humanities::jee': Object.freeze([
    'B.Tech via lateral entry',
    'B.Des (Design Engineering)',
    'Integrated M.Sc (Applied Sciences)',
  ]),
  'arts / humanities::jee main': Object.freeze([
    'B.Tech via lateral entry',
    'B.Des (Design Engineering)',
    'Integrated M.Sc (Applied Sciences)',
  ]),
  'arts / humanities::jee advanced': Object.freeze([
    'B.Tech via lateral entry',
    'B.Des (Design Engineering)',
    'Integrated M.Sc (Applied Sciences)',
  ]),
  'commerce::neet': Object.freeze([
    'Healthcare Management (BHA)',
    'B.Sc Biostatistics',
    'Health Economics',
  ]),
  'commerce::neet-ug': Object.freeze([
    'Healthcare Management (BHA)',
    'B.Sc Biostatistics',
    'Health Economics',
  ]),
  'science (pcm)::neet': Object.freeze([
    'MBBS via NEET (PCB recommended)',
    'B.Sc Biomedical Engineering',
    'Integrated BS-MS (Life Sciences)',
  ]),
  'science (pcm)::neet-ug': Object.freeze([
    'MBBS via NEET (PCB recommended)',
    'B.Sc Biomedical Engineering',
    'Integrated BS-MS (Life Sciences)',
  ]),
  'science (pcb)::jee': Object.freeze([
    'B.Tech Biotechnology',
    'B.Tech Biomedical Engineering',
    'B.Sc Computational Biology',
  ]),
  'science (pcb)::jee main': Object.freeze([
    'B.Tech Biotechnology',
    'B.Tech Biomedical Engineering',
    'B.Sc Computational Biology',
  ]),
  'science (pcb)::jee advanced': Object.freeze([
    'B.Tech Biotechnology',
    'B.Tech Biomedical Engineering',
    'B.Sc Computational Biology',
  ]),
})

/**
 * Detect whether a student's stream and preferred exam are incompatible.
 *
 * Pure function — no side effects. Normalizes inputs, checks compatibility
 * against EXAM_STREAM_MAP, and produces pre-computed bridge recommendations
 * for known mismatch pairs.
 *
 * @param {string} stream - Student's declared stream (e.g., "Commerce")
 * @param {string} exam - Student's preferred entrance exam (e.g., "JEE")
 * @returns {{ isMismatch: boolean, advisory: string, bridgePaths: string[] }}
 */
export function detectStreamExamMismatch(stream, exam) {
  const normalizedExam = (exam || '').trim().toLowerCase()
  const normalizedStream = normalizeStream(stream)

  // No mismatch if exam is empty, 'none', or unknown
  if (!normalizedExam || normalizedExam === 'none') {
    return { isMismatch: false, advisory: '', bridgePaths: [] }
  }

  const validStreams = EXAM_STREAM_MAP[normalizedExam]

  // If exam is not in our map, we can't determine mismatch — treat as compatible
  if (!validStreams) {
    return { isMismatch: false, advisory: '', bridgePaths: [] }
  }

  // Check if the normalized stream is in the list of valid streams for this exam
  const isCompatible = validStreams.some(
    (valid) => normalizedStream === valid || normalizedStream.includes(valid) || valid.includes(normalizedStream)
  )

  if (isCompatible) {
    return { isMismatch: false, advisory: '', bridgePaths: [] }
  }

  // Mismatch detected — produce advisory and bridge paths
  const advisory = `${exam.trim()} is typically associated with ${validStreams.join(' or ')} streams — it doesn't directly align with ${stream.trim()}. Consider bridge pathways that combine both interests.`

  const bridgeKey = `${normalizedStream}::${normalizedExam}`
  const bridgePaths = BRIDGE_PATHS[bridgeKey]
    ? [...BRIDGE_PATHS[bridgeKey]]
    : [
        `Explore interdisciplinary programs combining ${stream.trim()} background with ${exam.trim()} preparation`,
        `Consider lateral entry or bridge courses`,
        `Look into integrated programs that accept diverse stream backgrounds`,
      ]

  return { isMismatch: true, advisory, bridgePaths }
}
