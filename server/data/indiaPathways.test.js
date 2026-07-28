/**
 * Guards the class-level split of the adaptive questionnaire's broad bank.
 *
 * Before this change, QUESTION_BANK.broad was a single flat array asked to
 * every student regardless of class level (10 vs 12). scoreDomains() and
 * pickFollowUpQuestions() had no notion of classLevel either. This meant a
 * Class 10 student (choosing a STREAM) and a Class 12 student (choosing a
 * COURSE) saw the exact same questions and could get identical domain
 * rankings for the same yes/no pattern — the class-level split wasn't
 * actually taking effect anywhere.
 *
 * This file proves:
 *  - class10 and class12 broad banks are genuinely separate (no id overlap)
 *  - every question's domains map only uses real DOMAINS ids
 *  - scoreDomains resolves answers against the correct class-level bank
 *  - scoreDomains defaults to class12 behaviour when no classLevel is passed
 *    (backward compatibility for pathwayAdvisor.js's existing call site)
 *  - pickFollowUpQuestions still returns questions for both class levels
 *  - the same yes/no PATTERN applied to the two different question SETS
 *    produces genuinely different ranked domain output (the user's explicit
 *    validation requirement)
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import {
  DOMAINS,
  QUESTION_BANK,
  scoreDomains,
  pickFollowUpQuestions,
} from './indiaPathways.js'

const DOMAIN_IDS = new Set(DOMAINS.map((d) => d.id))

test('class10 and class12 broad banks both exist and are non-empty', () => {
  assert.ok(Array.isArray(QUESTION_BANK.broad.class10))
  assert.ok(Array.isArray(QUESTION_BANK.broad.class12))
  assert.ok(QUESTION_BANK.broad.class10.length > 0)
  assert.ok(QUESTION_BANK.broad.class12.length >= 10, 'class12 bank should have at least 10-12 questions per the task')
})

test('class10 and class12 broad banks share ZERO overlapping question ids', () => {
  const class10Ids = new Set(QUESTION_BANK.broad.class10.map((q) => q.id))
  const class12Ids = new Set(QUESTION_BANK.broad.class12.map((q) => q.id))
  const overlap = [...class10Ids].filter((id) => class12Ids.has(id))
  assert.deepEqual(overlap, [], 'class10 and class12 must be genuinely separate banks, not the same array referenced twice')
})

test('class10 and class12 broad banks have genuinely different question TEXT', () => {
  const class10Texts = new Set(QUESTION_BANK.broad.class10.map((q) => q.text))
  const class12Texts = new Set(QUESTION_BANK.broad.class12.map((q) => q.text))
  const sharedText = [...class10Texts].filter((t) => class12Texts.has(t))
  assert.deepEqual(sharedText, [], 'banks must not be relabeled duplicates of each other')
})

test('every question in both broad banks and the focused bank uses only valid DOMAINS ids', () => {
  const allQuestions = [
    ...QUESTION_BANK.broad.class10,
    ...QUESTION_BANK.broad.class12,
    ...Object.values(QUESTION_BANK.focused).flat(),
  ]
  for (const q of allQuestions) {
    assert.ok(q.domains && typeof q.domains === 'object', `question ${q.id} must have a domains map`)
    const keys = Object.keys(q.domains)
    assert.ok(keys.length > 0, `question ${q.id} domains map must not be empty`)
    for (const domId of keys) {
      assert.ok(DOMAIN_IDS.has(domId), `question ${q.id} references invalid domain id "${domId}"`)
    }
  }
})

test('scoreDomains resolves a class10 question id when classLevel=class10', () => {
  const class10Question = QUESTION_BANK.broad.class10[0]
  const { ranked } = scoreDomains([{ questionId: class10Question.id, answer: 'yes' }], 'class10')
  const scoredDomainIds = new Set(ranked.map((r) => r.id))
  const expectedDomainIds = Object.keys(class10Question.domains)
  assert.ok(expectedDomainIds.some((d) => scoredDomainIds.has(d)), 'a class10 question answered under classLevel=class10 must contribute to scoring')
})

test('a class10-only question id contributes NOTHING when scored under classLevel=class12', () => {
  const class10Ids = new Set(QUESTION_BANK.broad.class10.map((q) => q.id))
  const class12Ids = new Set(QUESTION_BANK.broad.class12.map((q) => q.id))
  const focusedIds = new Set(Object.values(QUESTION_BANK.focused).flat().map((q) => q.id))

  const class10OnlyQuestion = QUESTION_BANK.broad.class10.find(
    (q) => !class12Ids.has(q.id) && !focusedIds.has(q.id)
  )
  assert.ok(class10OnlyQuestion, 'expected to find a class10 question id absent from class12 and focused banks')

  const { scores: baselineScores } = scoreDomains([], 'class12')
  const { scores: withClass10Answer } = scoreDomains(
    [{ questionId: class10OnlyQuestion.id, answer: 'yes' }],
    'class12'
  )
  assert.deepEqual(withClass10Answer, baselineScores, 'answering a class10-only id under classLevel=class12 must be a no-op (the qById lookup must exclude it)')
})

test('scoreDomains(answers) with no classLevel arg defaults to class12 behaviour', () => {
  const class12Question = QUESTION_BANK.broad.class12[0]
  const answers = [{ questionId: class12Question.id, answer: 'yes' }]
  const noArgResult = scoreDomains(answers)
  const explicitClass12Result = scoreDomains(answers, 'class12')
  assert.deepEqual(noArgResult, explicitClass12Result, 'omitting classLevel must behave identically to explicitly passing class12 (backward compat for pathwayAdvisor.js)')
})

test('pickFollowUpQuestions returns questions for a plausible ranked-domains input, for both class levels', () => {
  const rankedDomains = [
    { id: 'computing', score: 5, name: 'Computers & IT' },
    { id: 'engineering', score: 3, name: 'Engineering & Technology' },
    { id: 'commerce', score: 2, name: 'Commerce, Finance & Business' },
  ]
  const class10FollowUps = pickFollowUpQuestions(rankedDomains, 4, 'class10')
  const class12FollowUps = pickFollowUpQuestions(rankedDomains, 4, 'class12')
  assert.ok(class10FollowUps.length > 0, 'class10 follow-ups must not be empty')
  assert.ok(class12FollowUps.length > 0, 'class12 follow-ups must not be empty')
})

test('pickFollowUpQuestions defaults to class12 behaviour when classLevel is omitted', () => {
  const rankedDomains = [{ id: 'law', score: 4, name: 'Law & Legal Studies' }]
  const defaulted = pickFollowUpQuestions(rankedDomains, 4)
  const explicit = pickFollowUpQuestions(rankedDomains, 4, 'class12')
  assert.deepEqual(defaulted, explicit)
})

test('END-TO-END: identical yes/no PATTERN on different class-level question SETS produces different ranked domain output', () => {
  // Answer "yes" to the first 5 questions of each class level's respective
  // broad list, "no" to the rest — the same PATTERN, but against different
  // question ids (and therefore different underlying domain weights).
  const buildAnswers = (bank) =>
    bank.map((q, i) => ({ questionId: q.id, answer: i < 5 ? 'yes' : 'no' }))

  const class10Answers = buildAnswers(QUESTION_BANK.broad.class10)
  const class12Answers = buildAnswers(QUESTION_BANK.broad.class12)

  const class10Result = scoreDomains(class10Answers, 'class10')
  const class12Result = scoreDomains(class12Answers, 'class12')

  assert.notDeepEqual(
    class10Result.ranked,
    class12Result.ranked,
    'the same yes/no pattern applied to different class-level question sets must not coincidentally produce identical ranked domains'
  )
})

test('property: cross-bank question ids never contribute to the wrong class level score', () => {
  fc.assert(
    fc.property(
      fc.subarray(QUESTION_BANK.broad.class10.map((q) => q.id)),
      fc.subarray(QUESTION_BANK.broad.class12.map((q) => q.id)),
      (class10Ids, class12Ids) => {
        // Score class10 ids as answers under classLevel=class12 — none of
        // these ids exist in the class12 broad bank, so scores must match
        // the baseline (empty-answers) result exactly.
        const answers = class10Ids
          .filter((id) => !class12Ids.includes(id)) // avoid accidental id clashes (there are none, but be defensive)
          .map((id) => ({ questionId: id, answer: 'yes' }))
        const { scores: baseline } = scoreDomains([], 'class12')
        const { scores: result } = scoreDomains(answers, 'class12')
        return JSON.stringify(baseline) === JSON.stringify(result)
      }
    ),
    { numRuns: 100 }
  )
})
