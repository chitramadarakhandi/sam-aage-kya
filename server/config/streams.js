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
 * EXAM VOCABULARY FOR FIT RANKING.
 *
 * Deliberately a SEPARATE map from EXAM_STREAM_MAP above:
 *  - EXAM_STREAM_MAP drives detectStreamExamMismatch and its exact key set is
 *    part of that behaviour — adding keys there (e.g. CUET) would change which
 *    stream/exam pairs get reported as mismatches.
 *  - This map answers two different questions, used by recommendation ranking:
 *      aliases       → "did the student NAME this exam?" (matched against the
 *                      student's own profile text only)
 *      trackKeywords → "is this recommendation ON that exam's track?" (matched
 *                      against the recommendation's path name / path_id only)
 *
 * Keeping those two questions on different fields is what stops naive substring
 * matching: prose like "Avoids NEET pressure" lives in a recommendation's
 * honest_take, which neither side ever consults.
 */
export const EXAM_VOCABULARY = Object.freeze({
  neet: Object.freeze({
    label: 'NEET',
    aliases: Object.freeze(['neet', 'neet-ug', 'neet ug']),
    trackKeywords: Object.freeze([
      'mbbs', 'bds', 'dental', 'dentist', 'ayush', 'bams', 'bhms', 'bums',
      'ayurved', 'homeopath', 'unani', 'siddha', 'medicine', 'medical',
      'surgeon', 'surgery', 'veterinary', 'bvsc',
    ]),
  }),
  jee: Object.freeze({
    label: 'JEE',
    aliases: Object.freeze(['jee', 'jee main', 'jee mains', 'jee advanced', 'iit jee', 'iit-jee']),
    trackKeywords: Object.freeze([
      'b.tech', 'btech', 'b tech', 'b.e.', 'bachelor of engineering', 'engineering',
    ]),
  }),
  clat: Object.freeze({
    label: 'CLAT',
    aliases: Object.freeze(['clat', 'ailet', 'lsat india']),
    trackKeywords: Object.freeze(['llb', 'law', 'legal', 'judiciary']),
  }),
  'ca foundation': Object.freeze({
    label: 'CA Foundation',
    aliases: Object.freeze(['ca foundation', 'ca-foundation', 'chartered accountancy', 'chartered accountant']),
    trackKeywords: Object.freeze(['chartered accountan', 'ca_finance', '(ca)', 'accountancy']),
  }),
  nift: Object.freeze({
    label: 'NIFT',
    aliases: Object.freeze(['nift']),
    trackKeywords: Object.freeze(['fashion', 'textile', 'nift']),
  }),
  uceed: Object.freeze({
    label: 'UCEED',
    aliases: Object.freeze(['uceed', 'ceed', 'nid dat']),
    trackKeywords: Object.freeze(['b.des', 'bdes', 'design']),
  }),
  nata: Object.freeze({
    label: 'NATA',
    aliases: Object.freeze(['nata']),
    trackKeywords: Object.freeze(['b.arch', 'barch', 'architect']),
  }),
  cuet: Object.freeze({
    label: 'CUET',
    // CUET is a general university entrance, so it has no course "track" of its
    // own — it only ever matches via a recommendation's requires_entrance_exam.
    aliases: Object.freeze(['cuet']),
    trackKeywords: Object.freeze([]),
  }),
})

/** Escape a string for safe use inside a RegExp. */
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True if `text` names the exam `examId` as a whole word/phrase. Word-boundary
 * matched, so a stray substring ("neetle") can never count as a mention.
 */
export function textNamesExam(text, examId) {
  const entry = EXAM_VOCABULARY[examId]
  if (!entry || !text) return false
  const haystack = String(text).toLowerCase()
  return entry.aliases.some((alias) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'i').test(haystack)
  )
}

/**
 * Which exams does this text explicitly name? Returns canonical ids in
 * EXAM_VOCABULARY declaration order (deterministic, so callers can rely on it).
 */
export function detectExamsInText(text) {
  if (!text) return []
  return Object.keys(EXAM_VOCABULARY).filter((id) => textNamesExam(text, id))
}

/**
 * True if `pathText` (a recommendation's path name and/or path_id) sits on the
 * exam's own course track — e.g. MBBS/BDS/AYUSH for NEET, B.Tech for JEE.
 * Substring matching is safe here because trackKeywords are course-specific.
 */
export function pathOnExamTrack(pathText, examId) {
  const entry = EXAM_VOCABULARY[examId]
  if (!entry || !pathText) return false
  const haystack = String(pathText).toLowerCase()
  return entry.trackKeywords.some((kw) => haystack.includes(kw))
}

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
