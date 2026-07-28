# Per-Option Card Integrity Fix — Bugfix Design

## Overview

Four related defects in `server/agents/Orchestrator.js` cause a student's per-option recommendation cards to misrepresent the specific degree path they describe, whenever that path is `bsc_biotech` or `bpt_physiotherapy` (or shares a fallback bucket/hardcoded literal with another option):

1. **Institution↔program mismatch** — the medical fallback branch of `runCollegeRecommendationAgent` hands `bsc_biotech` and `bpt_physiotherapy` the exact same two NEET-UG institutions (`AIIMS New Delhi`, `Madras Medical College`) used for genuinely NEET-gated paths (MBBS/BDS/AYUSH), even though `bsc_biotech`'s real entrance route is CUET/Merit. This also affects the DB-retrieved path: `retrievedColleges` is only stream-tagged (`"Science (PCB)"`), never degree-tagged, so `retrievedColleges.slice(0, 3)` is handed to every option in that stream identically, regardless of whether the option is MBBS or Biotech.
2. **Wrong exam named in prose** — the PCB fallback's `bsc_biotech` `honest_take` says "Avoids NEET pressure…" even though NEET never gated that degree (`requires_entrance_exam: "CUET / None"`). Nothing validates that an exam named in prose is an exam that actually gates the degree, on either the fallback or LLM-success path.
3. **Cost inherited from a sibling** — `avg_yearly_cost` is derived from `dedupedColleges[0].feeRange`; once defect 1 is fixed, two options that used to share a college list (and therefore a cost) will diverge, but the *fallback-to-hardcoded-literal* case (`'₹80,000–₹1,50,000/yr'` for any option with zero colleges) still silently duplicates across every such option.
4. **No per-card financial aid** — no `financial_aid` field exists on any option card; a low-income student's cards give no indication that aid exists, even though `state.scholarshipRecommendations` already carries verified scheme data.

The fix:
- Splits the shared "prestigious medical institutions" fallback bucket so only genuinely NEET-gated paths (containing `doctor`/`neet`/`mbbs`) keep AIIMS/Madras Medical College. `bsc_biotech`/`bpt_physiotherapy`-classified options get an **empty** institution list plus an explicit `institution_match_note`, because no institution in `server/seed.js` or the `colleges` table is tagged by specific degree program (only by 12th-stream eligibility) — fabricating a plausible-sounding institution or reusing the NEET-UG list would both violate this project's anti-fabrication rule. This program-match filter applies identically whether the source would have been the fallback list **or** `retrievedColleges` — the DB rows are exactly as degree-untagged as the fallback rows, so the filter is applied at the join step regardless of which branch produced the raw candidate list.
- Adds a pure, reusable exam-claim validator (`sanitizeExamMismatchInHonestTake`) that reuses the existing `EXAM_VOCABULARY` / `detectExamsInText` / `pathOnExamTrack` / `textNamesExam` helpers from `server/config/streams.js` (already built for `rankRecommendations`) to catch a `honest_take` naming an exam that neither the option's own path/track nor its own `requires_entrance_exam` supports — applied in `assembleGuidanceResponse` so both the fallback path and the LLM-success path are covered. The bsc_biotech fallback's own hardcoded `honest_take` text is also corrected at the source.
- Replaces the shared hardcoded cost literal with an explicit `'Cost data not available for this specific program yet.'` marker, so an option with no cost-bearing institution data never silently duplicates another option's number.
- Adds a `financial_aid` section, built once per response from `state.scholarshipRecommendations` (or the existing `FALLBACK_SCHOLARSHIP_NAME`), attached to every option **only** when `formData.incomeRange === 'below_2.5L'` — reusing the exact threshold `runSearchRetrievalAgent` already uses for its +15 central/state college-scoring bonus. No new income band is introduced.

All four fixes live in `server/agents/Orchestrator.js`; `server/config/streams.js` gets one additive export (`escapeRegExp`, already defined there, just not previously exported) so the new validator can reuse it without a second regex-escaping implementation.

## Glossary

- **Bug_Condition (C)**: Any of the four conditions below that cause a per-option card to misrepresent its own degree path.
- **Property (P)**: The desired behavior once a bug condition holds — see Correctness Properties.
- **Preservation**: Every other fallback branch, the existing dedup/evidence-guardrail/stream-level-mismatch behavior, and non-low-income cards, all of which must remain byte-for-byte unchanged.
- **Program-matching filter**: The check that classifies a career option as `bsc_biotech`-like or `bpt_physiotherapy`-like (non-NEET-gated) versus genuinely NEET-gated (MBBS/BDS/AYUSH/doctor-named), used to decide which institution source (if any) is safe to surface.
- **`institution_match_note`**: A new, additive per-option field set when the program-matching filter determined no verified institution data exists for that specific program; `null` otherwise.
- **`financial_aid`**: A new, additive per-option field present only for low-income students (`incomeRange === 'below_2.5L'`), listing scheme names/eligibility/application URLs sourced from `state.scholarshipRecommendations`.
- **`EXAM_VOCABULARY` / `detectExamsInText` / `pathOnExamTrack` / `textNamesExam`**: Existing pure helpers in `server/config/streams.js`, built for `rankRecommendations`, reused here (not duplicated) to answer "does this prose name an exam?" and "does this degree's own path/track/requirement support that exam?".
- **`dedupedColleges`**: The institution list for one option after `dedupCollegesByName`, used both for `realistic_colleges` and (post-fix) the per-option `avg_yearly_cost` derivation.
- **Low-income trigger**: `formData.incomeRange === 'below_2.5L'` — the app's existing lowest income band (`INCOME_TO_LAKH` in `server/index.js` defines only `below_2.5L` / `2.5L-5L` / `5L-10L` / `above_10L`; there is no ₹8L/EWS band).

## Bug Details

### Bug Condition

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { option: CareerOption, mappedCol: CollegeMapping, formData: FormData, state: OrchestrationState }
  OUTPUT: boolean

  LET pathId    = input.option.path_id || ''
  LET pathLower = lower(input.option.path || '')

  isBiotechLike      := pathId == 'bsc_biotech' OR (contains(pathLower, 'biotech') AND NOT contains(pathLower, 'mbbs'))
  isPhysiotherapyLike:= pathId == 'bpt_physiotherapy' OR contains(pathLower, 'physiotherapy')
  isNeetGatedMedical := NOT isBiotechLike AND NOT isPhysiotherapyLike
                        AND (contains(pathLower,'doctor') OR contains(pathLower,'neet') OR contains(pathLower,'mbbs'))

  // Defect 1 — institution list does not match the option's real admission pathway
  isInstitutionMismatchBug :=
    (isBiotechLike OR isPhysiotherapyLike)
    AND institutionListSurfaced(input.mappedCol)   // non-empty colleges returned (fallback NEET bucket OR raw retrievedColleges slice)

  // Defect 2 — an exam named in honest_take is not an exam that gates this degree
  LET identity    = lower(input.option.path + ' ' + pathId)
  LET requirement = input.option.requires_entrance_exam || ''
  LET namedExams  = detectExamsInText(input.option.honest_take)
  isExamClaimBug := EXISTS examId IN namedExams WHERE
                      NOT pathOnExamTrack(identity, examId) AND NOT textNamesExam(requirement, examId)

  // Defect 3 — cost derivation shares a value across unrelated options
  isCostSharingBug :=
    dedupedColleges(input.mappedCol).length == 0
    AND costWouldBeHardcodedSharedLiteral(input)   // '₹80,000–₹1,50,000/yr' today

  // Defect 4 — low-income student, no financial-aid section on the card
  isMissingAidBug :=
    input.formData.incomeRange == 'below_2.5L'
    AND NOT hasField(input.option, 'financial_aid')

  RETURN isInstitutionMismatchBug OR isExamClaimBug OR isCostSharingBug OR isMissingAidBug
END FUNCTION
```

### Examples

- **Institution mismatch**: A PCB student with no DB colleges gets `bsc_biotech` and `bpt_physiotherapy` as two options. Expected: both cards show `realistic_colleges: []` with distinct `institution_match_note`s (each computed independently, never derived from the other). Actual (unfixed): both show `["AIIMS New Delhi", "Madras Medical College"]`.
- **Institution mismatch via DB path**: Same student, but `retrievedColleges` is non-empty (stream-filtered to `"Science (PCB)"`, e.g. AIIMS Rishikesh, Kasturba Medical College). Expected: `bsc_biotech` still shows `realistic_colleges: []` — the DB rows are stream-tagged, not biotech-tagged, so they cannot honestly back a biotech-specific claim either. Actual (unfixed): `bsc_biotech` shows the same top-3 DB rows as an MBBS option in the same response.
- **Wrong exam in prose**: The PCB fallback's `bsc_biotech` `honest_take` is `"Great research and lab-oriented career. Avoids NEET pressure but requires higher education to secure top roles."` with `requires_entrance_exam: "CUET / None"`. Expected: `honest_take` never names NEET given NEET does not gate this degree. Actual (unfixed): NEET is named.
- **Cost sharing**: Two unrelated options both have zero colleges (e.g. `bsc_biotech` after the defect-1 fix, and a hypothetical option whose fallback happens to also return nothing). Expected: both cards show the explicit `'Cost data not available for this specific program yet.'` marker — this is intentionally the SAME literal, but it is now a marked "unavailable" state rather than a fabricated shared number, and no card with actual institution data ever shares it. Actual (unfixed): the same fabricated-looking dollar range appears for both.
- **Missing aid**: A `below_2.5L`-income student's response has `scholarship_to_check` and `scholarships_list` populated at the top level, but zero option cards mention aid. Expected: every option card carries a `financial_aid` section built from the same verified `scholarshipRecommendations`. Actual (unfixed): no `financial_aid` field exists anywhere in the option shape.
- **Edge case — genuinely NEET-gated options are untouched**: An MBBS option (`path` contains `"mbbs"`) with no DB colleges. Expected AND actual: `realistic_colleges: ["AIIMS New Delhi", "Madras Medical College"]`, unchanged, no `institution_match_note`.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Genuinely NEET-gated options (MBBS/BDS/AYUSH/doctor-named — matched via `doctor`/`neet`/`mbbs` in the path text) keep the AIIMS New Delhi / Madras Medical College fallback exactly as today.
- Commerce/finance and arts/humanities fallback branches return their existing institutions, fee ranges, admission modes, and `whyFit` text unchanged.
- `dedupCollegesByName` continues to dedupe by institution name before `realistic_colleges` is built.
- The evidence guardrail (`applyEvidenceGuardrail` / `enforceGuidanceEvidence`) continues to filter college/scholarship names against the allow-list for class-12 profiles, and continues to leave a legitimate fallback `scholarship_to_check` unblanked.
- `detectStreamExamMismatch` / `EXAM_STREAM_MAP` / `BRIDGE_PATHS` (stream-level exam mismatch) are completely untouched by the new degree-level exam-claim validator — they are a separate, pre-existing check.
- A student whose income is not `below_2.5L` gets no `financial_aid` key on any card, and no other field is altered by the aid feature.
- The top-level `scholarship_to_check` (including `FALLBACK_SCHOLARSHIP_NAME`) and `scholarships_list` continue to be produced exactly as today — `financial_aid` is additive.
- `formData.classLevel === 'class10'` continues to derive `avg_yearly_cost` from the student's budget band, and continues to get `colleges: []` / no `institution_match_note` for every option (class10 never had per-program institutions to begin with).
- `runSearchRetrievalAgent`'s marks/budget/state scoring — including the `below_2.5L` +15 central/state bonus — is completely untouched; the program-matching filter is applied only at the college-mapping join step, never inside the scoring function itself.
- The response shape's other top-level and per-option keys (`options`, `summary`, `one_thing_to_do_this_week`, `study_abroad`, `mentors`, `youtube_videos`, `colleges_data`, `explainability`, `ai_status`, `path`, `requires_entrance_exam`, `opens_doors_to`, `watch_out_for`, `backup_plan`, `roadmap_steps`) are emitted exactly as before.
- When a recommendation's `honest_take` and `requires_entrance_exam` are already consistent with the degree's real admission route (the overwhelming majority of options), the text is surfaced verbatim, unchanged, on both the LLM-success and fallback paths.

**Scope:**
All inputs that are NOT `bsc_biotech`/`bpt_physiotherapy`-classified, do NOT name a mismatched exam in `honest_take`, are NOT zero-college options relying on the hardcoded cost literal, and belong to students who are NOT `below_2.5L` income, are completely unaffected by this fix.

## Hypothesized Root Cause

1. **One fallback bucket for three genuinely different admission routes**: the medical fallback branch's condition (`pathId === 'bsc_biotech' || pathId === 'bpt_physiotherapy' || pathLower.includes('doctor') || ... || pathLower.includes('biotech') || pathLower.includes('physiotherapy')`) was written as "anything vaguely medical/life-science" without distinguishing NEET-gated clinical degrees from CUET/merit-gated science degrees — likely because at the time only NEET-gated options existed in that branch and biotech/physio were added later without re-checking admission-route compatibility.

2. **No institution↔program join at all**: neither the fallback lists nor the DB `colleges` table carry a degree-program tag (only a 12th-stream tag), so nothing in the pipeline can currently ask "does this specific institution actually offer this specific degree?" — the join simply never existed.

3. **`honest_take` text was authored once and never re-validated**: the bsc_biotech fallback's "Avoids NEET pressure" phrasing was probably written when comparing it against MBBS/BDS in the same list, but nothing mechanically checks prose against `requires_entrance_exam`, so a stale or inaccurate claim can persist indefinitely, and an LLM-produced recommendation has exactly the same exposure.

4. **Cost derivation reuses whatever college happened to be first**: `dedupedColleges[0].feeRange` was a reasonable proxy for "this option's cost" only because, before this fix, every option always had at least one shared-bucket college; the `'₹80,000–₹1,50,000/yr'` fallback literal was written as a generic placeholder for the (assumed rare) zero-college case without anticipating that the institution-mismatch fix would make zero-college options common.

5. **Income only ever fed college scoring/eligibility, never card content**: `below_2.5L` was wired into `runSearchRetrievalAgent`'s scoring and `profileAnalysis.financialCategory`, and scholarships were wired into one top-level field — nobody connected either signal to the per-option card shape, likely because the card shape was designed before scholarships/financial category existed.

## Correctness Properties

Property 1: Bug Condition - Institution List Matches Admission Pathway

_For any_ career option classified as `bsc_biotech`-like or `bpt_physiotherapy`-like (non-NEET-gated), the fixed system SHALL return `realistic_colleges: []` together with a non-null `institution_match_note` explaining that no verified institution match exists for that specific program, regardless of whether the raw candidate source would have been the NEET-UG fallback bucket or `retrievedColleges`, and SHALL NOT surface `"AIIMS New Delhi"` or `"Madras Medical College"` for such an option.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - Honest-Take Exam Claim Matches Gating Exam

_For any_ recommendation whose `honest_take` names an entrance exam that is neither on that recommendation's own path/track (`pathOnExamTrack`) nor named by its own `requires_entrance_exam` (`textNamesExam`), the fixed system SHALL neutralize that specific exam reference in the surfaced `honest_take` (replacing it with a non-exam-specific phrase) on both the fallback-produced and LLM-produced paths, using the existing `EXAM_VOCABULARY` degree/track vocabulary rather than a new mapping, and SHALL leave `detectStreamExamMismatch`'s stream-level behavior untouched.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 3: Bug Condition - Per-Option Cost Never Shared or Fabricated

_For any_ option whose deduped institution list is empty, the fixed system SHALL set `avg_yearly_cost` to an explicit, clearly marked "cost data not available" string instead of the previous generic hardcoded literal, and _for any_ option with a non-empty deduped institution list, `avg_yearly_cost` SHALL continue to be derived solely from that option's own first institution's `feeRange`, never a sibling's.

**Validates: Requirements 2.7, 2.8**

Property 4: Bug Condition - Per-Card Financial Aid for Low-Income Students

_For any_ response where `formData.incomeRange === 'below_2.5L'`, the fixed system SHALL attach a `financial_aid` object to every option card containing scheme names/eligibility/application URLs sourced exclusively from `state.scholarshipRecommendations` (or the existing `FALLBACK_SCHOLARSHIP_NAME` when none were surfaced), using the app's existing income bands with no new threshold introduced.

**Validates: Requirements 2.9, 2.10, 2.11, 2.12**

Property 5: Preservation - Unrelated Branches, Dedup, Guardrail, and Stream-Level Checks Unchanged

_For any_ option that is NOT `bsc_biotech`/`bpt_physiotherapy`-classified and does NOT name a mismatched exam in its `honest_take`, the fixed system SHALL produce byte-identical `realistic_colleges`, `honest_take`, dedup behavior, evidence-guardrail behavior, `detectStreamExamMismatch` stream-level behavior, and class10 budget-band cost derivation as the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

Property 6: Preservation - Non-Low-Income Cards Carry No Financial-Aid Section

_For any_ response where `formData.incomeRange !== 'below_2.5L'`, the fixed system SHALL NOT add a `financial_aid` key to any option card, and SHALL NOT alter any other field as a side effect of the financial-aid feature.

**Validates: Requirements 3.5**

## Fix Implementation

### Changes Required

**File**: `server/agents/Orchestrator.js`

**Function 1**: `runCollegeRecommendationAgent`

**Specific Changes**:
1. **Add a program-classification step before the fallback-selecting `if/else` chain**: compute `isBiotechLike` (`pathId === 'bsc_biotech'` or `pathLower` contains `'biotech'` but not `'mbbs'`) and `isPhysiotherapyLike` (`pathId === 'bpt_physiotherapy'` or `pathLower` contains `'physiotherapy'`) per option, inside the existing `.map`.
2. **Short-circuit both classifications to an empty, noted result BEFORE consulting `retrievedColleges` or any fallback list**: when either classification is true, return `{ path_id, path, colleges: [], programMatchNote: NO_VERIFIED_INSTITUTION_MATCH_NOTE }` immediately — this applies the program-match filter uniformly whether the raw candidate source would have been `retrievedColleges.slice(0, 3)` or a fallback bucket, satisfying "program-matching applied as an additional filter rather than a replacement of that scoring" (the scoring in `runSearchRetrievalAgent` itself is never touched).
3. **Remove `pathId === 'bsc_biotech'`, `pathId === 'bpt_physiotherapy'`, `pathLower.includes('biotech')`, and `pathLower.includes('physiotherapy')` from the existing medical-fallback condition**, leaving `pathLower.includes('doctor') || pathLower.includes('neet') || pathLower.includes('mbbs')` as the sole trigger for the AIIMS/Madras Medical College bucket — this is exactly the genuinely-NEET-gated set per the scoping decision.
4. **Add the `NO_VERIFIED_INSTITUTION_MATCH_NOTE` constant** near the top of the file (module scope, exported for direct unit testing).

**Function 2**: `runCareerRecommendationAgent` (PCB fallback branch)

**Specific Changes**:
5. **Correct the `bsc_biotech` fallback's hardcoded `honest_take`** to remove the false NEET framing, e.g. replace `"Avoids NEET pressure but requires higher education to secure top roles."` with wording that states the real route (CUET/merit) and the real caveat (PG usually needed) without naming an exam that never gated the degree.

**Function 3 (new, exported)**: `sanitizeExamMismatchInHonestTake(rec)`

**Specific Changes**:
6. **Add a pure function** that: computes `identity = pathIdentityText(rec)` (reusing the existing helper), reads `requirement = rec.requires_entrance_exam || ''`, calls `detectExamsInText(rec.honest_take)` to find every exam named in the prose, and for each named exam checks `pathOnExamTrack(identity, examId)` OR `textNamesExam(requirement, examId)`. Any exam satisfying neither is "mismatched."
7. **On a mismatch, replace only that exam's alias occurrences** (word-boundary regex built from `EXAM_VOCABULARY[examId].aliases`, using the newly-exported `escapeRegExp` from `server/config/streams.js`) with the neutral phrase `"the relevant entrance exam"`, leaving the rest of the sentence untouched. Returns `{ honestTake, corrected, mismatchedExams }`.

**Function 4**: `assembleGuidanceResponse`

**Specific Changes**:
8. **Apply the sanitizer per option**: before building the returned option object, compute `const { honestTake: sanitizedHonestTake } = sanitizeExamMismatchInHonestTake(opt)` and use `sanitizedHonestTake` in place of `opt.honest_take`.
9. **Replace the shared hardcoded cost literal**: change the class12 `costStr` fallback from `'₹80,000–₹1,50,000/yr'` to the new `COST_DATA_UNAVAILABLE` constant (`'Cost data not available for this specific program yet.'`). The `dedupedColleges.length ? dedupedColleges[0].feeRange : ...` structure is otherwise unchanged, so any option with real institution data still derives its own cost from its own first institution.
10. **Add `institution_match_note`** to each returned option: `(mappedCol && mappedCol.programMatchNote) || null`.
11. **Compute `financial_aid` once per response** (not per option) via the new `buildFinancialAidSection(formData, state)`, then spread it conditionally into every option: `...(financialAid ? { financial_aid: financialAid } : {})`.

**Function 5 (new, exported)**: `buildFinancialAidSection(formData, state)`

**Specific Changes**:
12. **Add a pure function** that returns `null` unless `formData.incomeRange === LOW_INCOME_AID_TRIGGER` (`'below_2.5L'`); otherwise builds `{ income_band, schemes }` where `schemes` maps `state.scholarshipRecommendations` (`name`, `eligibility`, `application_url`) when non-empty, or a single-item list using the existing `FALLBACK_SCHOLARSHIP_NAME` constant when empty — never inventing a name/figure not already present in the codebase's verified scholarship data.

**File**: `server/config/streams.js`

**Specific Changes**:
13. **Export the existing (currently private) `escapeRegExp` helper** — a one-word addition (`export function escapeRegExp...`), no behavior change, so the new validator in Orchestrator.js can reuse it instead of re-implementing regex escaping.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate all four defects on unfixed code, then verify each fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each of the four defects BEFORE implementing any fix.

**Test Plan**: Drive `runCollegeRecommendationAgent`, the (to-be-added) `sanitizeExamMismatchInHonestTake`, and `assembleGuidanceResponse` with the concrete fixtures from bugfix.md's Bug Analysis section, and assert the CURRENT (buggy) behavior to confirm each defect exists.

**Test Cases**:
1. **Institution Mismatch Test**: `bsc_biotech` and `bpt_physiotherapy` options with `retrievedColleges: []` both currently return `["AIIMS New Delhi", "Madras Medical College"]` (will "pass" on unfixed code showing the bug, then the fix makes them return `[]` + note — scoped as a Property-1 exploration test that fails until the fix lands).
2. **Institution Mismatch via DB Path**: same options with a non-empty `retrievedColleges` (stream-tagged, not degree-tagged) currently return the identical top-3 DB rows for both options.
3. **Exam Claim Test**: the PCB fallback's `bsc_biotech` recommendation currently has `honest_take` containing "NEET" while `requires_entrance_exam` is `"CUET / None"`.
4. **Cost Sharing Test**: two options with zero colleges currently both get the literal `'₹80,000–₹1,50,000/yr'` with no marker distinguishing "no data" from "verified ₹80k–1.5L".
5. **Missing Aid Test**: a `below_2.5L`-income student's assembled options currently have no `financial_aid` key anywhere.

**Expected Counterexamples**:
- `bsc_biotech`/`bpt_physiotherapy` sharing NEET-UG institutions with MBBS-track options.
- `honest_take` naming NEET for a CUET/merit-gated degree.
- Two structurally different options rendering byte-identical `avg_yearly_cost`.
- No `financial_aid` field present anywhere in the option shape.

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL option WHERE isBiotechLike(option) OR isPhysiotherapyLike(option) DO
  result := runCollegeRecommendationAgent_fixed(option)
  ASSERT result.colleges == [] AND result.programMatchNote != null
END FOR

FOR ALL rec WHERE examNamedInHonestTakeMismatchesGatingExam(rec) DO
  result := sanitizeExamMismatchInHonestTake(rec)
  ASSERT NOT containsMismatchedExamName(result.honestTake)
END FOR

FOR ALL option WHERE dedupedColleges(option).length == 0 DO
  ASSERT assembleGuidanceResponse_fixed(...).options[i].avg_yearly_cost == COST_DATA_UNAVAILABLE
END FOR

FOR ALL formData WHERE formData.incomeRange == 'below_2.5L' DO
  ASSERT every option in assembleGuidanceResponse_fixed(...).options HAS financial_aid != null
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where none of the four bug conditions hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL option WHERE NOT isBiotechLike(option) AND NOT isPhysiotherapyLike(option) DO
  ASSERT runCollegeRecommendationAgent_original(option) = runCollegeRecommendationAgent_fixed(option)
END FOR

FOR ALL rec WHERE NOT examNamedInHonestTakeMismatchesGatingExam(rec) DO
  ASSERT sanitizeExamMismatchInHonestTake(rec).honestTake == rec.honest_take
END FOR

FOR ALL formData WHERE formData.incomeRange != 'below_2.5L' DO
  ASSERT assembleGuidanceResponse_fixed(...).options[i] HAS NO financial_aid key
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of `path_id`/`path` text, `requires_entrance_exam`, and `incomeRange` automatically.
- It catches edge cases (casing/whitespace drift in path text, exam names embedded in longer words) that manual unit tests might miss.
- It provides strong guarantees that every option NOT matching one of the four bug conditions is byte-for-byte unchanged.

**Test Plan**: Observe behavior on UNFIXED code first for MBBS/BDS/doctor-named options, commerce/arts fallback branches, non-mismatched `honest_take` text, non-empty college lists, and non-`below_2.5L` incomes, then write property-based tests capturing those exact observations as the preservation baseline.

**Test Cases**:
1. **NEET-Gated Medical Preservation**: MBBS/doctor-named options with no DB colleges keep AIIMS/Madras Medical College, no `institution_match_note`.
2. **Commerce/Arts Fallback Preservation**: those branches' institutions, fee ranges, admission modes, and `whyFit` are untouched.
3. **Consistent Honest-Take Preservation**: recommendations whose named exam IS on-track or IS their own `requires_entrance_exam` are surfaced verbatim.
4. **Non-Empty-College Cost Preservation**: options with real institutions still derive `avg_yearly_cost` from their own first institution's `feeRange`.
5. **Non-Low-Income Preservation**: no `financial_aid` key appears for any `incomeRange` other than `below_2.5L`.
6. **Class10 Preservation**: `colleges: []`, no `institution_match_note`, budget-band cost, regardless of the new logic.
7. **Dedup / Evidence-Guardrail / Stream-Mismatch Preservation**: unchanged as today.

### Unit Tests

- `runCollegeRecommendationAgent` with `bsc_biotech`/`bpt_physiotherapy` path_ids and with equivalent free-text `path` values (LLM-success shape), both with and without `retrievedColleges`.
- `sanitizeExamMismatchInHonestTake` with: a mismatched exam name, a correctly-matching exam name, no exam named at all, multiple exams named (one matching, one not), empty `honest_take`.
- `buildFinancialAidSection` with: `below_2.5L` + populated `scholarshipRecommendations`, `below_2.5L` + empty `scholarshipRecommendations`, and every other income band.
- `assembleGuidanceResponse` cost derivation for zero-college vs. non-zero-college options.

### Property-Based Tests

- Generate random `path`/`path_id` strings (including near-miss text like "Biomedical Engineering" that must NOT trigger the biotech classification) and verify the program-matching filter classifies only genuine biotech/physiotherapy paths.
- Generate random `honest_take` prose containing zero, one, or many exam aliases crossed with random `requires_entrance_exam` values, and verify the sanitizer neutralizes exactly the mismatched aliases and leaves everything else byte-identical.
- Generate random `incomeRange` values and verify `financial_aid` is present if and only if the value is `below_2.5L`.
- Generate random college-list shapes (empty vs. non-empty) and verify `avg_yearly_cost` is the unavailable marker if and only if the deduped list is empty.

### Integration Tests

- Full `runMultiAgentOrchestrator` invocation for a PCB student whose combined-agent recommendations are `bsc_biotech` and `mbbs` — confirm the two final `options[]` entries have disjoint `realistic_colleges`, distinct `avg_yearly_cost`, and neither's `honest_take` claims an exam that does not gate it.
- Full invocation for a `below_2.5L`-income student — confirm every option in the final response carries a `financial_aid` section sourced from the same scholarships as `scholarships_list`.
- Full invocation for a non-`below_2.5L`-income, non-biotech/physio student — confirm the final response is identical to pre-fix output (no `financial_aid` key, no `institution_match_note` behavior change, same colleges/cost).
