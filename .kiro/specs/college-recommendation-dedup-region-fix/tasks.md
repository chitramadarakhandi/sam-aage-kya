# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Duplicate College Names & Silent Region Swap
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both defects exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: (a) a career option's `mappedCol.colleges` with a deliberately duplicated institution name, (b) a low-budget student (`budget: 'below_20k'` or `'below_1L'`) with `retrievedColleges: []` hitting the default Science/Engineering fallback, with `preferredState`/`preferredCity` set to Karnataka/Bangalore (in-region) and to Kerala (out-of-region)
  - Create `server/agents/Orchestrator.dedupRegion.bugCondition.test.js`
  - Test 1 (duplicate names): build a synthetic career option whose `mappedCol.colleges` array is `[{name: "AIIMS New Delhi", ...}, {name: "AIIMS New Delhi", ...}]` (same shape as `runCollegeRecommendationAgent`'s DB-retrieved-colleges output) and drive it through the same projection `runMultiAgentOrchestrator`'s final `options.map` uses (`mappedCol.colleges.map(c => c.name)`); assert `realistic_colleges` contains `"AIIMS New Delhi"` only once — per Bug_Condition `isDuplicateBug := hasDuplicateNames(mappedCol.colleges)` from design
  - Test 2 (in-region low-budget, should NOT swap): call `runCollegeRecommendationAgent` with `state.formData = { budget: 'below_20k', preferredState: 'Karnataka', preferredCity: 'Bangalore', ... }` and `state.retrievedColleges = []`, career path that maps to the default engineering fallback; assert the returned college names are still `"RV College of Engineering"`/`"PES University"` (NOT `"NIT Patna"`) — per Bug_Condition `isRegionSwapBug` clause `swapWouldOccurRegardlessOfRegionMatch(input)`
  - Test 3 (out-of-region low-budget, disclosure missing): call `runCollegeRecommendationAgent` with `state.formData = { budget: 'below_1L', preferredState: 'Kerala', preferredCity: '', ... }` and `state.retrievedColleges = []`; assert the substituted `"NIT Patna"` entry's `whyFit` explicitly discloses the region-based substitution (e.g. contains "region" and "Patna" reasoning), NOT the generic sentence "National Institute offering quality engineering education at subsidized fees." — per Bug_Condition clause `swapOccursWithoutDisclosure(input)`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist: no dedup step lets "AIIMS New Delhi" appear twice; the low-budget branch unconditionally swaps RV College/PES University to NIT Patna even when the student's preferred region is Karnataka; the substituted `whyFit` never discloses the swap)
  - Document counterexamples found (e.g., "`realistic_colleges` contains ['AIIMS New Delhi', 'AIIMS New Delhi']"; "in-region Karnataka low-budget student still gets NIT Patna instead of RV College of Engineering"; "out-of-region substitution whyFit is the generic sentence, no disclosure of the substitution reason")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Duplicate Lists, Non-Low-Budget, In-Region, and DB-Retrieved Paths Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create `server/agents/Orchestrator.dedupRegion.preservation.test.js`
  - Observe: a career option's `mappedCol.colleges` with unique names (e.g. the default humanities fallback `["Lady Shri Ram College", "St. Xavier's College Mumbai"]`) projects to `realistic_colleges` unchanged, same names/order, on unfixed code
  - Observe: `runCollegeRecommendationAgent` with a non-low budget (e.g. `budget: '1L-3L'`) and `retrievedColleges: []` returns the untouched default engineering fallback (`"RV College of Engineering"`/`"PES University"` with their original `whyFit`) on unfixed code — no substitution logic runs
  - Observe: `runCollegeRecommendationAgent` with `budget: 'below_20k'`, `preferredState: 'Karnataka'` (or `preferredCity: 'Bangalore'`/`'Bengaluru'`), `retrievedColleges: []` returns `"RV College of Engineering"`/`"PES University"` unsubstituted on unfixed code (already correct today — must remain correct after fix even though the mechanism changes from "no check" to "explicit in-region check")
  - Observe: `runCollegeRecommendationAgent` with `retrievedColleges.length > 0` (any budget) returns colleges sourced solely from `retrievedColleges.slice(0, 3)`, unaffected by budget or region, on unfixed code
  - Write property-based test: for all career options whose college list already contains only unique institution names, the deduped `realistic_colleges` projection equals the pre-dedup projection (same names, same order) — generate random college-list shapes with unique names (varying length, casing) via fast-check
  - Write property-based test: for all inputs where budget is not `below_20k`/`below_1L`, OR `retrievedColleges.length > 0`, `runCollegeRecommendationAgent`'s output colleges and `whyFit` text are identical regardless of `preferredState`/`preferredCity` — generate random budget/region/retrievedColleges combinations via fast-check
  - Write property-based test: for low-budget inputs where `preferredState`/`preferredCity` already matches Karnataka/Bangalore/Bengaluru (case/whitespace variants), the default engineering fallback names and `whyFit` remain `"RV College of Engineering"`/`"PES University"` with their original text
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for college list duplication and unrelated-region silent swap

  - [x] 3.1 Add `dedupCollegesByName` helper and apply it in `runMultiAgentOrchestrator`'s final `options.map` in `server/agents/Orchestrator.js`
    - Add module-scope pure function `dedupCollegesByName(colleges)` that iterates `colleges`, keys on `(c.name || '').trim().toLowerCase()`, keeps only the first occurrence of each key, and returns the deduped array in original order
    - In the final `options.map` inside `runMultiAgentOrchestrator`, compute `const dedupedColleges = mappedCol ? dedupCollegesByName(mappedCol.colleges) : []` once per option
    - Change `realistic_colleges: mappedCol ? mappedCol.colleges.map(c => c.name) : []` to `realistic_colleges: dedupedColleges.map(c => c.name)`
    - Change the `costStr` fallback (`mappedCol.colleges[0].feeRange` → `dedupedColleges[0].feeRange`) so the displayed fee corresponds to the first *displayed* college
    - Do NOT modify `state.collegeRecommendations`/`mappedCol` itself — dedup only at the point of building the response, per design's "Function 1" changes
    - _Bug_Condition: isDuplicateBug := hasDuplicateNames(mappedCol.colleges)_
    - _Expected_Behavior: realistic_colleges contains each institution name at most once, keeping first occurrence's position and content (Property 1 in design)_
    - _Preservation: Career options whose college list already contains only unique names produce the exact same realistic_colleges array (Property 3 in design)_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Add region-checked substitution with disclosure to the low-budget fallback branch of `runCollegeRecommendationAgent` in `server/agents/Orchestrator.js`
    - Before the budget check, compute `const prefState = (form.preferredState || '').trim().toLowerCase()` and `const prefCity = (form.preferredCity || '').trim().toLowerCase()`, treating placeholder values (`'any state'`, `'any'`, `''`) as "no preference"
    - Add helper `function hasInRegionMatch(colleges, prefState, prefCity)` that returns true if any college in the (pre-swap) `fallbackColleges` array has `city`/`state` (lower-cased, trimmed) equal to `prefCity`/`prefState`
    - Replace the unconditional `.map` swap in the `if (form.budget === 'below_20k' || form.budget === 'below_1L')` block with logic that: skips the substitution (keeps `RV College of Engineering`/`PES University` as-is, untouched `whyFit`) when `hasInRegionMatch(fallbackColleges, prefState, prefCity)` is true; performs the substitution to `"NIT Patna"` (same `name`/`city`/`state`/`feeRange`/`admissionMode` fields as today) when `hasInRegionMatch(...)` is false
    - When the substitution occurs, set `whyFit` to an explicit disclosure string, e.g. `"No affordable engineering college found in your region — nearest subsidized option is in Patna."`, instead of the generic sentence
    - Scope this change strictly to the two named colleges inside the low-budget block — all other fallback branches (commerce, humanities, medical) and the `retrievedColleges.length > 0` branch remain structurally untouched
    - _Bug_Condition: isRegionSwapBug := (budget is low) AND fallbackListUsed AND containsDefaultEngineeringFallback AND (swapWouldOccurRegardlessOfRegionMatch OR swapOccursWithoutDisclosure)_
    - _Expected_Behavior: substitution to NIT Patna only happens when no in-region match exists, and whyFit explicitly discloses the substitution whenever it occurs (Property 2 in design)_
    - _Preservation: non-low-budget students, in-region low-budget students, and the DB-retrieved-colleges path remain byte-for-byte unchanged (Property 4 in design)_
    - _Requirements: 2.2, 2.3, 3.2, 3.3, 3.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Duplicate College Names Removed & Region-Checked Fallback Substitution With Disclosure
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (deduped names, in-region preservation, out-of-region disclosure)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms both defects are fixed: no duplicate names in `realistic_colleges`; Karnataka student keeps RV College/PES University; Kerala student's NIT Patna substitution discloses the region-based reasoning)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Duplicate Lists, Non-Low-Budget, In-Region, and DB-Retrieved Paths Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — unique-name lists, non-low-budget students, in-region low-budget students, and DB-retrieved paths all behave identically to before the fix)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite (`npm test` in `server/`) to confirm both exploration and preservation tests pass
  - Verify no other tests were broken by the changes (e.g. `Orchestrator.bugCondition.test.js`, `Orchestrator.preservation.test.js` from the unrelated stream-exam-mismatch-fix spec)
  - Ensure all tests pass, ask the user if questions arise
