# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Institution List Matches Admission Pathway, Honest-Take Exam Claim, Per-Option Cost, Financial Aid
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all four defects exist
  - **Scoped PBT Approach**: Scope to concrete failing cases: `bsc_biotech` and `bpt_physiotherapy` options with `retrievedColleges: []`; the same two options with a non-empty stream-tagged `retrievedColleges`; the PCB fallback's `bsc_biotech` recommendation; a synthetic zero-college option pair; a `below_2.5L`-income assembled response
  - Create `server/agents/Orchestrator.optionCardIntegrity.bugCondition.test.js`
  - Test 1 (institution mismatch, fallback path): call `runCollegeRecommendationAgent` with `state.careerPaths.recommendations = [{path_id:'bsc_biotech', path:'B.Sc Biotechnology / Genetics'}, {path_id:'bpt_physiotherapy', path:'Bachelor of Physiotherapy (BPT)'}]` and `state.retrievedColleges = []`; assert BOTH options' `colleges` currently equal `[{name:'AIIMS New Delhi',...}, {name:'Madras Medical College',...}]` — per Bug_Condition `isInstitutionMismatchBug` from design
  - Test 2 (institution mismatch, DB path): same two options with `state.retrievedColleges` populated with stream-tagged (not degree-tagged) rows (e.g. AIIMS Rishikesh, Kasturba Medical College, King George Medical University); assert both options currently receive the identical `retrievedColleges.slice(0, 3)` names
  - Test 3 (exam claim): call `runCareerRecommendationAgent`'s fallback with a PCB stream and no LLM (simulate the fallback branch); assert the returned `bsc_biotech` recommendation's `honest_take` currently contains "NEET" while `requires_entrance_exam` is `"CUET / None"`
  - Test 4 (cost sharing): build two synthetic options whose `mappedCol.colleges` are both `[]`, drive them through `assembleGuidanceResponse`; assert both currently render `avg_yearly_cost === '₹80,000–₹1,50,000/yr'` with no marker distinguishing "no data" from a real verified figure
  - Test 5 (missing aid): call `assembleGuidanceResponse` with `formData.incomeRange === 'below_2.5L'` and a populated `state.scholarshipRecommendations`; assert no option in the result currently has a `financial_aid` key
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist: biotech/physio share the NEET-UG bucket and the DB slice; the biotech honest_take misnames NEET; zero-college options share a hardcoded literal; no financial_aid field exists anywhere)
  - Document counterexamples found (e.g., "bsc_biotech and bpt_physiotherapy both return ['AIIMS New Delhi', 'Madras Medical College']"; "bsc_biotech honest_take contains 'NEET' despite requires_entrance_exam='CUET / None'"; "two zero-college options both render '₹80,000–₹1,50,000/yr'"; "no financial_aid key present for a below_2.5L income response")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Unrelated Branches, Non-Mismatched Honest-Take, Non-Empty-College Cost, Non-Low-Income Cards
  - **IMPORTANT**: Follow observation-first methodology
  - Create `server/agents/Orchestrator.optionCardIntegrity.preservation.test.js`
  - Observe: `runCollegeRecommendationAgent` with an `mbbs`/doctor-named path and `retrievedColleges: []` returns `["AIIMS New Delhi", "Madras Medical College"]` with the original `whyFit` text on unfixed code
  - Observe: the commerce/finance fallback (`ca_finance`/`bba_finance`) and the humanities fallback (`arts_humanities`) return their existing institutions/fee ranges/admission modes/`whyFit` unchanged on unfixed code, regardless of this fix
  - Observe: a recommendation whose `honest_take` names an exam that IS its own `requires_entrance_exam` (e.g. an MBBS option naming NEET) is surfaced verbatim on unfixed code
  - Observe: an option with a non-empty deduped college list derives `avg_yearly_cost` from `dedupedColleges[0].feeRange` on unfixed code
  - Observe: `assembleGuidanceResponse` with `formData.incomeRange` set to `'2.5L-5L'`, `'5L-10L'`, `'above_10L'`, or unset produces options with no `financial_aid` key on unfixed code
  - Observe: `formData.classLevel === 'class10'` continues to get `colleges: []` and budget-band `avg_yearly_cost` regardless of path text, on unfixed code
  - Write property-based test: for all `path`/`path_id` combinations that do NOT classify as biotech-like or physiotherapy-like (including near-miss text like "Biomedical Engineering", "Physiology"), `runCollegeRecommendationAgent`'s output is unchanged from the pre-fix baseline — generate random path text via fast-check, excluding the biotech/physio keyword set
  - Write property-based test: for all `(honest_take, requires_entrance_exam, path)` combinations where every exam named in `honest_take` either matches the path's own track or its own `requires_entrance_exam`, the sanitizer (once written) is a no-op — generate random consistent triples via fast-check
  - Write property-based test: for all `incomeRange` values other than `'below_2.5L'`, no option in the assembled response has a `financial_aid` key — generate random incomeRange values via fast-check
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [ ] 3. Fix for per-option card integrity (institution mismatch, exam claim, cost sharing, missing aid)

  - [ ] 3.1 Split the shared medical fallback bucket in `runCollegeRecommendationAgent` (`server/agents/Orchestrator.js`)
    - Add `NO_VERIFIED_INSTITUTION_MATCH_NOTE` exported constant near the top of the file (module scope), e.g. `'No verified institution match for this specific program — only stream-level (not degree-specific) college data is available today.'`
    - Inside the existing `.map(opt => ...)` in `runCollegeRecommendationAgent`, compute `const pathLower = (opt.path || '').toLowerCase()` and `const isBiotechLike = opt.path_id === 'bsc_biotech' || (pathLower.includes('biotech') && !pathLower.includes('mbbs'))` and `const isPhysiotherapyLike = opt.path_id === 'bpt_physiotherapy' || pathLower.includes('physiotherapy')`
    - When either is true, return `{ path_id: opt.path_id, path: opt.path, colleges: [], programMatchNote: NO_VERIFIED_INSTITUTION_MATCH_NOTE }` immediately, BEFORE the `retrievedColleges.length > 0` branch is consulted — this must short-circuit ahead of the DB-retrieved-colleges path too, since DB rows are stream-tagged, not degree-tagged
    - Remove `pathId === 'bsc_biotech'`, `pathId === 'bpt_physiotherapy'`, `pathLower.includes('biotech')`, and `pathLower.includes('physiotherapy')` from the medical-fallback `else if` condition, leaving only `pathLower.includes('doctor') || pathLower.includes('neet') || pathLower.includes('mbbs')`
    - _Bug_Condition: isInstitutionMismatchBug := (isBiotechLike OR isPhysiotherapyLike) AND institutionListSurfaced(mappedCol)_
    - _Expected_Behavior: realistic_colleges is [] with a non-null institution_match_note for biotech/physio-like options, regardless of source (Property 1 in design)_
    - _Preservation: genuinely NEET-gated options (doctor/neet/mbbs) keep AIIMS New Delhi / Madras Medical College unchanged (Property 5 in design)_
    - _Requirements: 2.1, 2.2, 2.3, 3.11_

  - [ ] 3.2 Correct the `bsc_biotech` fallback's `honest_take` text in `runCareerRecommendationAgent` (`server/agents/Orchestrator.js`)
    - Replace the PCB fallback's `bsc_biotech` `honest_take` (`"Great research and lab-oriented career. Avoids NEET pressure but requires higher education to secure top roles."`) with text that does not name NEET at all, e.g. `"Great research and lab-oriented career via CUET/merit admission. An M.Sc or Ph.D is usually needed to secure top roles."`
    - _Bug_Condition: isExamClaimBug for the specific hardcoded bsc_biotech honest_take_
    - _Expected_Behavior: honest_take names only exams consistent with requires_entrance_exam ("CUET / None") (Property 2 in design)_
    - _Requirements: 2.4_

  - [ ] 3.3 Add `sanitizeExamMismatchInHonestTake` to `server/agents/Orchestrator.js`, exporting `escapeRegExp` from `server/config/streams.js`
    - In `server/config/streams.js`, change the existing private `function escapeRegExp(s) {...}` to `export function escapeRegExp(s) {...}` (no behavior change)
    - In `server/agents/Orchestrator.js`, import `escapeRegExp` alongside the existing `EXAM_VOCABULARY`/`detectExamsInText`/`pathOnExamTrack`/`textNamesExam` imports from `../config/streams.js`
    - Add exported pure function `sanitizeExamMismatchInHonestTake(rec)` that: computes `identity = pathIdentityText(rec)` (reuse existing helper), `requirement = String(rec.requires_entrance_exam || '').toLowerCase()`, `namedExams = detectExamsInText(rec.honest_take)`; for each `examId` in `namedExams`, if `!pathOnExamTrack(identity, examId) && !textNamesExam(requirement, examId)`, replace every word-boundary occurrence of that exam's aliases (from `EXAM_VOCABULARY[examId].aliases`, regex built with `escapeRegExp`) in `rec.honest_take` with `"the relevant entrance exam"`
    - Return `{ honestTake, corrected: boolean, mismatchedExams: string[] }`; when no mismatch is found, `honestTake === rec.honest_take` exactly (no re-formatting, no trimming changes)
    - _Bug_Condition: isExamClaimBug := EXISTS examId IN namedExams WHERE NOT pathOnExamTrack(identity, examId) AND NOT textNamesExam(requirement, examId)_
    - _Expected_Behavior: sanitized honest_take never contains a mismatched exam alias (Property 2 in design)_
    - _Preservation: honest_take is returned byte-identical when every named exam is on-track or matches requires_entrance_exam (Property 5 in design)_
    - _Requirements: 2.4, 2.5, 2.6, 3.4_

  - [ ] 3.4 Wire the exam sanitizer into `assembleGuidanceResponse` (`server/agents/Orchestrator.js`)
    - Inside the `options.map` in `assembleGuidanceResponse`, compute `const { honestTake: sanitizedHonestTake } = sanitizeExamMismatchInHonestTake(opt)` and use `sanitizedHonestTake` in place of `opt.honest_take` when building the returned option object
    - This applies on both the LLM-success path and the fallback path, since both flow through the same `assembleGuidanceResponse` join
    - _Bug_Condition: isExamClaimBug applies identically regardless of which agent produced honest_take_
    - _Expected_Behavior: every surfaced honest_take is exam-claim-consistent (Property 2 in design)_
    - _Preservation: consistent honest_take text is surfaced verbatim (Property 5 in design)_
    - _Requirements: 2.5, 3.11_

  - [ ] 3.5 Replace the shared hardcoded cost literal and add `institution_match_note` in `assembleGuidanceResponse` (`server/agents/Orchestrator.js`)
    - Add exported constant `COST_DATA_UNAVAILABLE = 'Cost data not available for this specific program yet.'` near the top of the file
    - Change the class12 `costStr` fallback from `dedupedColleges.length ? dedupedColleges[0].feeRange : '₹80,000–₹1,50,000/yr'` to `dedupedColleges.length ? dedupedColleges[0].feeRange : COST_DATA_UNAVAILABLE`
    - Add `institution_match_note: (mappedCol && mappedCol.programMatchNote) || null` to the returned option object
    - _Bug_Condition: isCostSharingBug := dedupedColleges(option).length == 0 AND costWouldBeHardcodedSharedLiteral(input)_
    - _Expected_Behavior: zero-college options get an explicit unavailable marker instead of a shared fabricated-looking literal; non-empty-college options still derive cost from their own first institution (Property 3 in design)_
    - _Preservation: options with real institution data are completely unaffected (Property 5 in design)_
    - _Requirements: 2.7, 2.8, 3.7, 3.10_

  - [ ] 3.6 Add `buildFinancialAidSection` and wire it into `assembleGuidanceResponse` (`server/agents/Orchestrator.js`)
    - Add exported constant `LOW_INCOME_AID_TRIGGER = 'below_2.5L'` near the top of the file
    - Add exported pure function `buildFinancialAidSection(formData, state)` that returns `null` unless `formData.incomeRange === LOW_INCOME_AID_TRIGGER`; otherwise returns `{ income_band: formData.incomeRange, schemes: schemes }` where `schemes` is `state.scholarshipRecommendations.map(s => ({ name: s.name, eligibility: s.eligibility, application_url: s.applicationUrl }))` when non-empty, or `[{ name: FALLBACK_SCHOLARSHIP_NAME, eligibility: null, application_url: null }]` when empty
    - Inside `assembleGuidanceResponse`, compute `const financialAid = buildFinancialAidSection(formData, state)` once before the `options.map`, then inside the map spread `...(financialAid ? { financial_aid: financialAid } : {})` into each returned option object
    - _Bug_Condition: isMissingAidBug := formData.incomeRange == 'below_2.5L' AND NOT hasField(option, 'financial_aid')_
    - _Expected_Behavior: every option carries a financial_aid section sourced from state.scholarshipRecommendations/FALLBACK_SCHOLARSHIP_NAME for below_2.5L incomes (Property 4 in design)_
    - _Preservation: no financial_aid key for any other incomeRange (Property 6 in design)_
    - _Requirements: 2.9, 2.10, 2.11, 2.12, 3.5, 3.6_

  - [ ] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Institution List Matches Admission Pathway, Honest-Take Exam Claim, Per-Option Cost, Financial Aid
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for all four defects
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all four defects are fixed: biotech/physio return empty college lists with a match note regardless of source; the biotech honest_take no longer misnames NEET; zero-college options show the explicit unavailable marker instead of a shared literal; below_2.5L responses carry financial_aid on every option)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [ ] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Unrelated Branches, Non-Mismatched Honest-Take, Non-Empty-College Cost, Non-Low-Income Cards
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — NEET-gated medical options, commerce/arts fallbacks, consistent honest_take text, non-empty-college cost derivation, non-low-income cards, and class10 behavior are all unchanged)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite (`npm test` in `server/`) to confirm both exploration and preservation tests pass
  - Verify no other tests were broken by the changes (e.g. `Orchestrator.ranking.test.js`, `Orchestrator.dedupRegion.*.test.js`, `Orchestrator.bugCondition.test.js`, `Orchestrator.preservation.test.js`, `Orchestrator.evidenceGuardrail.test.js`, `Orchestrator.pipeline.test.js`)
  - Confirm the total suite count grew (new files added) with 0 failures
  - Ensure all tests pass, ask the user if questions arise
