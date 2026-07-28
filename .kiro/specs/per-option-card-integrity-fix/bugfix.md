# Bugfix Requirements Document

## Introduction

Each recommended career option is rendered as its own card carrying `realistic_colleges`, `honest_take`, `requires_entrance_exam`, and `avg_yearly_cost`. These per-option fields are produced by `runCareerRecommendationAgent` and `runCollegeRecommendationAgent` in `server/agents/Orchestrator.js` and joined by the exported pure helper `assembleGuidanceResponse`. A code audit confirmed four defects that make sibling cards misrepresent genuinely different degree paths:

1. **Institution lists do not match the option's admission pathway.** The medical/biotech fallback branch in `runCollegeRecommendationAgent` is a single "prestigious medical institutions" bucket (`AIIMS New Delhi` and `Madras Medical College`, both with `admissionMode: "NEET-UG"`) shared by `bsc_biotech` and `bpt_physiotherapy`. Per `server/data/indiaPathways.js`, `bsc_biotech` has `entranceExams: ['CUET', 'Merit']` — so a B.Sc/B.Tech Biotechnology student is handed two MBBS/NEET-track institutions that do not offer the program they were recommended.

2. **`honest_take` names the wrong admission exam.** The PCB fallback's `bsc_biotech` entry says "Avoids NEET pressure…" while its own `requires_entrance_exam` is `"CUET / None"`. Nothing validates that the exam named in the prose is the exam that actually gates the degree. `detectStreamExamMismatch` in `server/config/streams.js` validates exam↔**stream** compatibility only; there is no exam↔**degree** check.

3. **`avg_yearly_cost` is copied between sibling options.** In `assembleGuidanceResponse`, `costStr = dedupedColleges.length ? dedupedColleges[0].feeRange : '₹80,000–₹1,50,000/yr'`. Because two different options can map to the same fallback college list (defect 1), they inherit the same first institution's `feeRange` and render byte-identical costs for different degrees.

4. **No per-card financial-aid callout for low-income students.** No `financial_aid` field exists on option cards anywhere in the codebase. Income affects only college scoring (`form.incomeRange === 'below_2.5L'` adds +15 for central/state colleges), scholarship eligibility filtering, and `profileAnalysis.financialCategory`. Aid reaches the student only as one top-level `scholarship_to_check` string plus a `scholarships_list` array — never attached to the option the student is actually evaluating.

All four defects apply on the fallback path **and** on the LLM-success path: when the combined LLM agent succeeds it supplies `honest_take` and `requires_entrance_exam` per recommendation, and RAG/LLM college names flow through the same join, so validation must be applied to the assembled card regardless of which producer filled it.

One scoping decision is captured explicitly rather than assumed: the app's income bands are `below_2.5L`, `2.5L-5L`, `5L-10L`, `above_10L`, mapped by `INCOME_TO_LAKH` in `server/index.js` to 2.5 / 5 / 10 lakh. There is **no ₹8L band**, so the EWS ₹8L threshold does not exist in the app today and must be introduced deliberately if it is to be used.

## Bug Analysis

### Current Behavior (Defect)

**Institution↔program mismatch**

1.1 WHEN a career option has `path_id === 'bsc_biotech'` (or its path text contains "biotech") and no DB colleges were retrieved THEN the system returns the shared medical fallback list — `AIIMS New Delhi` and `Madras Medical College`, both with `admissionMode: "NEET-UG"` — even though that degree's real entrance route is CUET / Merit

1.2 WHEN a career option has `path_id === 'bpt_physiotherapy'` and no DB colleges were retrieved THEN the system returns the identical two NEET-UG medical institutions, because the fallback branch groups doctor / NEET / MBBS / biotech / physiotherapy into one bucket

1.3 WHEN institution names reach a card from any source (DB-retrieved colleges, LLM output, or a fallback branch) THEN the system performs no check that the institution actually offers the recommended program or admits via that program's admission route, so a program-institution mismatch is rendered silently

**Exam named in prose vs exam that gates the degree**

1.4 WHEN the PCB fallback produces the `bsc_biotech` recommendation THEN its `honest_take` references NEET ("Avoids NEET pressure but requires higher education to secure top roles.") while its own `requires_entrance_exam` is `"CUET / None"`, presenting NEET-specific framing for a degree NEET does not gate

1.5 WHEN the combined LLM agent succeeds and supplies `honest_take` and `requires_entrance_exam` per recommendation THEN the system accepts both verbatim with no validation that the exam named in the prose matches the exam that gates that degree, so an LLM-produced wrong-exam claim is rendered exactly like a fallback-produced one

1.6 WHEN an exam name appears in per-option prose THEN the system has no exam-to-degree mapping to validate it against; `EXAM_STREAM_MAP` / `detectStreamExamMismatch` only map exams to compatible streams (JEE→PCM, NEET→PCB), which cannot distinguish MBBS/BDS/AYUSH/nursing (NEET-gated) from engineering biotech (JEE / state CET) or B.Sc biotech (CUET / merit) within the same stream

**Cost inherited from a sibling option**

1.7 WHEN two sibling options resolve to the same fallback college list THEN `assembleGuidanceResponse` derives `avg_yearly_cost` from `dedupedColleges[0].feeRange` for both, so two cards for genuinely different degree paths render byte-identical `avg_yearly_cost`

1.8 WHEN an option has no colleges at all THEN `avg_yearly_cost` falls back to the single hardcoded literal `'₹80,000–₹1,50,000/yr'` for every such option, again producing identical costs across unrelated degrees

**Missing per-card financial aid**

1.9 WHEN a student's family income is low (e.g. `incomeRange === 'below_2.5L'`) THEN no option card carries any financial-aid information: there is no `financial_aid` field on cards anywhere in the codebase, and aid is surfaced only as one top-level `scholarship_to_check` string plus a `scholarships_list` array covering the whole response

1.10 WHEN a low-income student's cards are assembled THEN income influences only college scoring (+15 for central/state colleges at `below_2.5L`), scholarship eligibility filtering, and `profileAnalysis.financialCategory` — a card with no aid callout is treated as complete and valid

1.11 WHEN a low-income threshold is needed to decide whether aid must be surfaced THEN no such threshold exists: `INCOME_TO_LAKH` in `server/index.js` defines only 2.5 / 5 / 10 lakh bands, so the EWS ₹8L threshold cannot be expressed by any current form value

**No sibling-card divergence check**

1.12 WHEN two sibling options have different `path` titles but byte-identical `realistic_colleges`, `honest_take`, or `avg_yearly_cost` THEN the system renders them as-is with no diff, no warning, and no validation failure

### Expected Behavior (Correct)

**Institution↔program mismatch**

2.1 WHEN a career option's degree path is B.Sc / B.Tech Biotechnology THEN the system SHALL only surface institutions that actually offer that program, with an `admissionMode` consistent with that program's real admission route (CUET / merit for B.Sc biotech; JEE or state engineering CET for engineering biotech), and SHALL NOT surface NEET-UG-only medical institutions for it

2.2 WHEN a career option's degree path is Bachelor of Physiotherapy THEN the system SHALL surface institutions that actually offer BPT with a BPT-valid admission route, drawn independently of the biotech option's list rather than from a shared "prestigious medical institutions" bucket

2.3 WHEN institution names reach a card from any source (DB-retrieved, LLM, or fallback) THEN the system SHALL validate that each surfaced institution is associated with the recommended program and its admission route, and SHALL treat a program-institution mismatch as a validation failure for that card rather than rendering it

**Exam named in prose vs exam that gates the degree**

2.4 WHEN a recommendation's `honest_take` names an entrance exam THEN the system SHALL verify that exam is one that actually gates the recommended degree, and SHALL NOT emit NEET-specific framing for a degree whose `requires_entrance_exam` is CUET / None

2.5 WHEN the combined LLM agent supplies `honest_take` and `requires_entrance_exam` THEN the system SHALL apply the same exam-to-degree validation it applies to fallback content, so a wrong-exam claim is caught regardless of which path produced it

2.6 WHEN exam-to-degree validation is implemented THEN the system SHALL use a degree-level exam mapping (NEET → MBBS / BDS / AYUSH / nursing; JEE or state engineering CET → engineering biotech; CUET / merit → B.Sc biotech), and the design SHALL state explicitly whether this extends `EXAM_STREAM_MAP` in `server/config/streams.js` or is a separate degree-level map, keeping the existing stream-level `detectStreamExamMismatch` behavior intact

**Cost derived per option**

2.7 WHEN `avg_yearly_cost` is derived for an option THEN the system SHALL derive it from that option's own institutions/program cost data, never inherited from a sibling option's list, so two cards for different degree paths do not share a cost value merely because they shared a college list

2.8 WHEN an option has no cost-bearing institution data THEN the system SHALL make the absence of per-option cost data explicit (a clearly marked unavailable/needs-sourcing value) rather than emitting a generic literal that silently duplicates across unrelated options

**Per-card financial aid**

2.9 WHEN a student's income falls under the defined low-income threshold THEN every relevant option card SHALL carry a required financial-aid section listing the applicable schemes (central/state government scholarships, EWS quota where applicable, fee waivers) for that option

2.10 WHEN a card that requires a financial-aid section does not have one THEN the system SHALL treat that as a validation failure for that card, not as a complete card

2.11 WHEN schemes are surfaced in a card's financial-aid section THEN every scheme name, eligibility figure, and income cap SHALL come from the existing verified scholarship data (`server/seed.js` / the `scholarships` table / `fetchScholarshipsForStudent`, i.e. fields `eligibility_income_max_lakh`, `eligibility_marks_min`, `eligible_streams`, `eligible_states`, `application_url`), or SHALL be clearly marked as requiring sourced data — no scheme names or figures may be invented, consistent with this project's data-provenance rules

2.12 WHEN the low-income threshold is defined THEN the requirement SHALL be satisfied using the app's existing income bands (`below_2.5L`, `2.5L-5L`, `5L-10L`, `above_10L` via `INCOME_TO_LAKH`); if an EWS-style ₹8L threshold is required, introducing it is an explicit, documented change (a new band and/or a new mapping) and SHALL NOT be assumed to already exist

**Sibling-card divergence check**

2.13 WHEN two sibling options have different `path` titles THEN the system SHALL diff their `realistic_colleges`, `honest_take`, and `avg_yearly_cost`, and SHALL treat byte-identical values across genuinely different degree paths as a defect rather than silently rendering them

2.14 WHEN a byte-identical value across differently-titled sibling options is genuinely legitimate THEN the underlying data SHALL be independently verified per option (each option's own institutions/cost/prose sourced separately) rather than defaulted or copied from a sibling

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a career option's institution list contains duplicate names THEN the system SHALL CONTINUE TO dedupe by institution name via `dedupCollegesByName` before projecting `realistic_colleges`

3.2 WHEN a low-budget student (`budget` of `below_20k` / `below_1L`) has no in-region affordable option THEN the system SHALL CONTINUE TO substitute the out-of-region institute only via `hasInRegionMatch` and SHALL CONTINUE TO disclose the substitution reason in `whyFit`; when an in-region match exists it SHALL CONTINUE TO skip the substitution

3.3 WHEN the evidence guardrail runs THEN `applyEvidenceGuardrail` / `enforceGuidanceEvidence` SHALL CONTINUE TO filter surfaced college and scholarship names against the allow-list, with college filtering applied to class-12 profiles only, and SHALL CONTINUE TO leave a legitimate fallback `scholarship_to_check` unblanked

3.4 WHEN a student's stream and preferred exam are incompatible THEN `detectStreamExamMismatch` SHALL CONTINUE TO produce the same stream-level advisory and bridge paths from `EXAM_STREAM_MAP` / `BRIDGE_PATHS`, unchanged by the new degree-level exam validation

3.5 WHEN a student's income is not under the low-income threshold THEN their option cards SHALL CONTINUE TO render exactly as today, with no financial-aid section added and no other field altered

3.6 WHEN the response is assembled THEN the top-level `scholarship_to_check` (including the `FALLBACK_SCHOLARSHIP_NAME` fallback) and `scholarships_list` SHALL CONTINUE TO be produced as they are today; the per-card financial-aid section is additive

3.7 WHEN `formData.classLevel === 'class10'` THEN `avg_yearly_cost` SHALL CONTINUE TO be derived from the student's budget band (`below_20k`, `20k-60k`, `60k-1.5L`, `above_1.5L`), untouched by the per-option class-12 cost changes

3.8 WHEN colleges are retrieved from the database (`retrievedColleges.length > 0`) THEN the system SHALL CONTINUE TO use the DB-verified, marks/budget/state-scored rows (including the `below_2.5L` +15 central/state bonus) as the source for that option, with program-matching applied as an additional filter rather than a replacement of that scoring

3.9 WHEN the commerce/finance and arts/humanities fallback branches are selected THEN they SHALL CONTINUE TO return their existing institutions, fee ranges, admission modes, and `whyFit` text unchanged

3.10 WHEN an option is joined to its college mapping and roadmap THEN `assembleGuidanceResponse` SHALL CONTINUE TO match on `path_id` with the normalized path-text fallback, and SHALL CONTINUE TO emit every field the frontend consumes (`options`, `summary`, `scholarship_to_check`, `one_thing_to_do_this_week`, `scholarships_list`, `study_abroad`, `mentors`, `youtube_videos`, `colleges_data`, `explainability`, `ai_status`)

3.11 WHEN a recommendation's `honest_take` and `requires_entrance_exam` are already consistent with the degree's real admission route THEN the system SHALL CONTINUE TO surface that prose verbatim, on both the LLM-success and fallback paths

3.12 WHEN the existing test suite runs THEN all 156 tests across 28 suites SHALL CONTINUE TO pass, using the project's `node:test` + `node:assert/strict` conventions
