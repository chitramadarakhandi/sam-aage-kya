# College Recommendation Dedup & Region-Fix Bugfix Design

## Overview

Two independent defects in the college-recommendation pipeline (`server/agents/Orchestrator.js`) reduce the trustworthiness of the `realistic_colleges` list returned to the frontend for each career option:

1. **No dedup pass** — `runMultiAgentOrchestrator`'s final `options.map` builds `realistic_colleges: mappedCol.colleges.map(c => c.name)` directly from `mappedCol.colleges` with no uniqueness check. Overlapping DB rows, overlapping LLM output, or overlapping fallback branches can produce the same institution name twice in one option's list.
2. **Silent unrelated-region swap** — inside `runCollegeRecommendationAgent`, the low-budget branch (`form.budget === 'below_20k' || form.budget === 'below_1L'`) unconditionally rewrites any fallback college named "RV College of Engineering" or "PES University" to "NIT Patna", regardless of whether the student's preferred region is already Karnataka (where those two colleges are located), and regardless of whether an in-region affordable alternative exists. The substituted entry's `whyFit` text ("National Institute offering quality engineering education at subsidized fees.") never discloses that a substitution happened.

The fix adds:
- A small, pure `dedupCollegesByName` utility applied to `mappedCol.colleges` before the `realistic_colleges` name list is built.
- A region check inside the low-budget fallback branch: only substitute NIT Patna when the student's preferred region does **not** already match an existing fallback college's region; when the substitution does occur, `whyFit` is rewritten to explicitly disclose that no in-region affordable option was found.

Both fixes are scoped narrowly to the code paths described above — they do not touch the DB-retrieved-colleges path (`retrievedColleges.length > 0`), which is unaffected by budget-based substitution today and must remain unaffected.

## Glossary

- **Bug_Condition (C)**: The condition that triggers one of the two defects — either (a) a career option's college list contains duplicate institution names, or (b) a low-budget student is substituted to "NIT Patna" without a region check or disclosure.
- **Property (P)**: The desired behavior once the bug condition holds — (a) the list contains each institution name at most once, or (b) the substitution only happens when no in-region option exists, and when it does happen the `whyFit` explicitly discloses the substitution reason.
- **Preservation**: Existing ordering/content of non-duplicate lists, non-low-budget fallback behavior, in-region low-budget behavior, and the DB-retrieved-colleges path — all of which must remain byte-for-byte unchanged by this fix.
- **`mappedCol.colleges`**: The array of `{ name, city, state, feeRange, admissionMode, whyFit }` objects produced per career option by `runCollegeRecommendationAgent`, consumed by `runMultiAgentOrchestrator` when building `realistic_colleges`.
- **`fallbackColleges`**: The hardcoded, domain-specific array of default colleges (`runCollegeRecommendationAgent`) used only when `retrievedColleges.length === 0` (i.e. the DB lookup returned nothing).
- **Student region**: The student's stated study-location preference — `form.preferredState` and `form.preferredCity` from `formData` — used to decide whether an existing fallback college is already "in region".
- **Low budget**: `form.budget === 'below_20k'` or `form.budget === 'below_1L'`.

## Bug Details

### Bug Condition

**Defect 1 — Duplicate names.** The bug manifests whenever the same institution name appears more than once in `mappedCol.colleges` for a single career option (e.g. because the DB returned overlapping rows, or a fallback branch happens to list a name already present). `runMultiAgentOrchestrator` maps this array straight to `realistic_colleges` with no dedup step, so the duplicate is passed through to the frontend unchanged.

**Defect 2 — Silent region swap.** The bug manifests whenever a student has a low budget and the applicable fallback list is the default Science/Engineering list (`RV College of Engineering`, `PES University` — both Bangalore, Karnataka). The current code swaps both to "NIT Patna" (Patna, Bihar) unconditionally — it never checks `form.preferredState` / `form.preferredCity` against the colleges' own `city`/`state` fields, and it never changes `whyFit` to say a substitution occurred.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { option: CareerOption, form: FormData, mappedCol: CollegeMapping }
  OUTPUT: boolean

  isDuplicateBug :=
    hasDuplicateNames(input.mappedCol.colleges)   // same name appears >1 time

  isRegionSwapBug :=
    (input.form.budget == 'below_20k' OR input.form.budget == 'below_1L')
    AND fallbackListUsed(input.mappedCol)          // retrievedColleges was empty
    AND containsDefaultEngineeringFallback(input.mappedCol.colleges)
    AND ( swapWouldOccurRegardlessOfRegionMatch(input)     // over-aggressive swap
          OR swapOccursWithoutDisclosure(input) )           // missing disclosure

  RETURN isDuplicateBug OR isRegionSwapBug
END FUNCTION
```

### Examples

- **Duplicate example**: A career option's `mappedCol.colleges` is `[{name: "AIIMS New Delhi", ...}, {name: "AIIMS New Delhi", ...}]` (e.g. overlapping DB rows survived the guardrail filter because both rows had distinct row ids but identical names). Expected: `realistic_colleges` contains `"AIIMS New Delhi"` once. Actual: it appears twice.
- **Region-swap example (out of region, correct swap but no disclosure)**: A student in Kerala with `budget: 'below_1L'` and no DB colleges (`retrievedColleges.length === 0`) gets the default Science/Engineering fallback. Expected: since Kerala has no in-region entry in the fallback list, NIT Patna is substituted **and** `whyFit` says something like "No affordable engineering college found in your region — nearest subsidized option is in Patna." Actual: NIT Patna is substituted with the generic `whyFit` "National Institute offering quality engineering education at subsidized fees." — no disclosure.
- **Region-swap example (in region, swap should NOT occur)**: A student who set `preferredState: 'Karnataka'` (or `preferredCity: 'Bangalore'`/`'Bengaluru'`) with `budget: 'below_20k'` and no DB colleges. Expected: RV College of Engineering / PES University are kept as-is (they are already in the student's preferred region), no substitution. Actual: both are unconditionally swapped to NIT Patna, taking the student further from their stated preference.
- **Edge case — no preferred region set**: `preferredState` is `''` or `'Any State'` and `preferredCity` is `''`. There is no in-region match to find (nothing to compare against), so the substitution proceeds as today, but still with the explicit disclosure `whyFit`.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Career options whose `mappedCol.colleges` already contain no duplicate names must continue to return the exact same institutions, in the exact same order, as `realistic_colleges`.
- Students who are NOT low budget (`budget` not `below_20k`/`below_1L`) must continue to get the untouched fallback/retrieved colleges — no substitution logic runs for them at all.
- Students who ARE low budget but whose preferred region already matches an existing fallback college (e.g. `preferredState: 'Karnataka'` with the default Science/Engineering fallback) must continue to be recommended that region-appropriate option, not NIT Patna.
- Whenever `retrievedColleges.length > 0`, the DB-verified, budget/marks/location-scored colleges remain the sole source for that option — the fallback-swap logic must never run against DB-retrieved data, only against the static `fallbackColleges` arrays.
- All non-engineering fallback branches (commerce/finance, humanities/arts, medical/biotech) are completely untouched by this fix — the swap logic only ever inspected `RV College of Engineering` / `PES University`.

**Scope:**
All inputs that do NOT involve (a) a duplicate-name list, or (b) a low-budget student hitting the default engineering fallback, are completely unaffected by this fix. This includes:
- Career options with unique college names already.
- Non-low-budget students of any stream.
- Low-budget students whose preferred region already has an affordable match in the fallback data.
- Any option backed by `retrievedColleges` (DB path).

## Hypothesized Root Cause

1. **Missing dedup step**: `runMultiAgentOrchestrator`'s final `options.map` was written assuming `mappedCol.colleges` is already unique (true when only one source populates it), but as more branches were added (DB rows, guardrail filtering, fallback arrays) nothing enforces uniqueness before the `.map(c => c.name)` projection.

2. **Budget-only gate on the swap**: The low-budget branch in `runCollegeRecommendationAgent` was written as a blanket rule ("if budget is low, this specific pair of expensive colleges becomes NIT Patna") without ever consulting `form.preferredState`/`form.preferredCity`, likely because the original author treated "low budget → cheaper national institute" as sufficient justification without considering regional relevance.

3. **No disclosure mechanism**: `whyFit` for the substituted entry was hardcoded as a generic sentence at author time; there is no branch that distinguishes "this is the original regional entry" from "this is a substituted out-of-region entry," so the same generic text is used either way.

4. **Fallback-only scope, correctly isolated already**: The swap logic already only executes inside the `else` branch that is used when `retrievedColleges.length === 0`, so Requirement 3.4 (DB path untouched) is already satisfied by the existing structure — this is a preservation requirement to keep intact, not a root cause to fix.

## Correctness Properties

Property 1: Bug Condition - Duplicate College Names Removed

_For any_ career option's college list containing one or more institution names that occur more than once, the fixed `realistic_colleges` construction SHALL contain each institution name at most once, keeping the first occurrence's position and content.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Region-Checked Fallback Substitution With Disclosure

_For any_ low-budget input (`budget` is `below_20k` or `below_1L`) that reaches the default engineering fallback (`retrievedColleges.length === 0`), the fixed `runCollegeRecommendationAgent` SHALL substitute "RV College of Engineering"/"PES University" with "NIT Patna" only when the student's preferred state/city does not match any existing fallback college's state/city, and SHALL set an explicit disclosure `whyFit` (stating that no in-region affordable option was found) whenever that substitution occurs.

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - Non-Duplicate Lists Unchanged

_For any_ career option whose college list already contains only unique institution names, the fixed code SHALL produce exactly the same `realistic_colleges` array (same names, same order) as the original code.

**Validates: Requirements 3.1**

Property 4: Preservation - Non-Low-Budget, In-Region, and DB-Retrieved Paths Unchanged

_For any_ input where the budget is not low, OR the student's preferred region already matches an existing fallback college, OR `retrievedColleges.length > 0`, the fixed code SHALL produce exactly the same college list and `whyFit` text as the original code.

**Validates: Requirements 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/agents/Orchestrator.js`

**Function 1**: `runMultiAgentOrchestrator` (final `options.map`)

**Specific Changes**:
1. **Add a small dedup utility**: Introduce a pure helper near the top of the file (module scope, no exports needed beyond internal use, or exported for direct unit testing):
   ```js
   function dedupCollegesByName(colleges) {
     const seen = new Set()
     const result = []
     for (const c of colleges || []) {
       const key = (c.name || '').trim().toLowerCase()
       if (seen.has(key)) continue
       seen.add(key)
       result.push(c)
     }
     return result
   }
   ```
2. **Apply the dedup before building `realistic_colleges`**: In the final `options.map`, change
   `realistic_colleges: mappedCol ? mappedCol.colleges.map(c => c.name) : []`
   to first dedup `mappedCol.colleges`, then map to names — e.g. compute `const dedupedColleges = mappedCol ? dedupCollegesByName(mappedCol.colleges) : []` once per option and use `dedupedColleges` both for `realistic_colleges` and for the `costStr` fallback (`mappedCol.colleges[0].feeRange` → `dedupedColleges[0].feeRange`) so the fee shown always corresponds to the first *displayed* college.
3. **No change to `mappedCol` itself**: the dedup is applied only at the point of building the final response so `state.collegeRecommendations` (used elsewhere, e.g. the guardrail step) is untouched — this keeps the change minimal and scoped to the observable symptom.

**Function 2**: `runCollegeRecommendationAgent` (low-budget fallback branch)

**Specific Changes**:
1. **Compute the student's preferred region once**: Before the budget check, derive `const prefState = (form.preferredState || '').trim().toLowerCase()` and `const prefCity = (form.preferredCity || '').trim().toLowerCase()`, excluding placeholder values like `'any state'`/`'any'`.
2. **Add an in-region check against the current fallback entries**: Add a helper `function hasInRegionMatch(colleges, prefState, prefCity)` that returns true if any college in the (pre-swap) `fallbackColleges` array has `city`/`state` (lower-cased, trimmed) equal to `prefCity`/`prefState`.
3. **Gate the substitution on the region check**: Replace the unconditional `.map` swap with logic that:
   - Skips the substitution entirely (keeps `RV College of Engineering` / `PES University` as-is) when `hasInRegionMatch(...)` is true.
   - Performs the substitution to "NIT Patna" when `hasInRegionMatch(...)` is false, exactly as today for the `name`/`city`/`state`/`feeRange`/`admissionMode` fields.
4. **Disclose the substitution in `whyFit`**: When the substitution occurs, set `whyFit` to an explicit disclosure string, e.g. `"No affordable engineering college found in your region — nearest subsidized option is in Patna."` instead of the generic sentence. When the substitution does NOT occur (in-region match found), leave the original college object (name/city/state/feeRange/whyFit) completely untouched.
5. **Scope check**: This logic only touches the `if (form.budget === 'below_20k' || form.budget === 'below_1L')` block and only the two named colleges — all other fallback branches (commerce, humanities, medical) and the DB-retrieved branch (`retrievedColleges.length > 0`) are structurally unreachable from this change and remain untouched.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate both defects on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both defects BEFORE implementing the fix, and confirm the root cause analysis.

**Test Plan**: Write tests that (a) feed `runMultiAgentOrchestrator`/the final `options.map` logic a college list with a deliberately duplicated name and assert on `realistic_colleges`, and (b) call `runCollegeRecommendationAgent` with a low-budget student whose `preferredState`/`preferredCity` is Karnataka/Bangalore and assert the fallback should NOT be swapped, plus a low-budget student in a different region and assert `whyFit` should disclose the substitution. Run these on the UNFIXED code to observe failures.

**Test Cases**:
1. **Duplicate Name Test**: Build a career option whose `mappedCol.colleges` contains the same name twice; assert `realistic_colleges` has only one occurrence (will fail on unfixed code).
2. **In-Region Low-Budget Test**: `budget: 'below_20k'`, `preferredState: 'Karnataka'`, `retrievedColleges: []`; assert the returned fallback college names are still `RV College of Engineering`/`PES University` (will fail on unfixed code — currently always swapped).
3. **Out-of-Region Low-Budget Disclosure Test**: `budget: 'below_1L'`, `preferredState: 'Kerala'`, `retrievedColleges: []`; assert the substituted college's `whyFit` mentions the region/substitution explicitly (e.g. contains "region" or "Patna" reasoning), not the generic sentence (will fail on unfixed code).
4. **Edge Case — No Preferred Region**: `preferredState: ''`, `preferredCity: ''`, low budget; observe current (pre-fix) substitution behavior to confirm it still swaps (may already "pass" since there's nothing to match against — used to confirm this edge case is intentionally preserved as a swap-with-disclosure case).

**Expected Counterexamples**:
- `realistic_colleges` containing the same name twice for case 1.
- Fallback colleges swapped to NIT Patna even though the student's preferred region is Karnataka for case 2.
- Generic, non-disclosing `whyFit` text for case 3.
- Possible causes confirmed: missing dedup step; budget-only gate with no region check; hardcoded generic `whyFit`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
    // duplicate names collapsed to one occurrence, OR
    // region-checked substitution with explicit disclosure whyFit
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of budget, preferred region, and college-list shapes automatically.
- It catches edge cases (empty region strings, casing/whitespace variants, single-item lists) that manual unit tests might miss.
- It provides strong guarantees that non-buggy inputs (non-low-budget, in-region, DB-retrieved, already-unique lists) are byte-for-byte unchanged.

**Test Plan**: Observe behavior on UNFIXED code first for non-low-budget students, in-region low-budget students, and DB-retrieved-college paths, then write property-based tests capturing those exact observations as the preservation baseline.

**Test Cases**:
1. **Non-Low-Budget Preservation**: For budgets other than `below_20k`/`below_1L`, verify the fallback colleges (RV College/PES University, or any other domain's fallback) are returned completely untouched, with the original `whyFit`.
2. **DB-Retrieved Path Preservation**: When `retrievedColleges.length > 0`, verify the swap logic never runs — output colleges come solely from `retrievedColleges.slice(0, 3)` as before.
3. **Already-Unique List Preservation**: For college lists with no duplicate names, verify `realistic_colleges` is identical (names and order) before and after the fix.
4. **In-Region Low-Budget Preservation**: For low-budget students whose preferred state/city matches Karnataka/Bangalore (aliases included, e.g. "Bengaluru"), verify RV College/PES University remain unsubstituted with their original `whyFit`.

### Unit Tests

- `dedupCollegesByName` with: empty array, no duplicates, one duplicate, all duplicates, case/whitespace-varying duplicate names.
- `hasInRegionMatch` with: matching state only, matching city only, matching neither, empty/placeholder preferred region values ("", "Any State").
- `runCollegeRecommendationAgent` low-budget branch with in-region vs out-of-region `preferredState`/`preferredCity`, asserting both the college fields and the `whyFit` text.
- `runMultiAgentOrchestrator`'s option-building step with a synthetic `mappedCol.colleges` array containing duplicates, asserting `realistic_colleges` and `avg_yearly_cost`.

### Property-Based Tests

- Generate random college-list shapes (with and without duplicate names, varying case/whitespace) and verify the deduped `realistic_colleges` always has unique names and preserves first-occurrence order.
- Generate random `budget` values crossed with random `preferredState`/`preferredCity` values (including Karnataka/Bangalore variants and unrelated states) and verify the substitution only ever happens when no in-region match exists, and `whyFit` discloses it whenever it does.
- Generate random non-low-budget / DB-retrieved-path inputs and verify output is identical to the pre-fix baseline (preservation).

### Integration Tests

- Full `runMultiAgentOrchestrator` invocation for a low-budget, out-of-region student with no DB colleges — confirm the final `options[].realistic_colleges` contains "NIT Patna" with a disclosing `whyFit` reachable through the whole pipeline (mapping → college guardrail → final response shape).
- Full `runMultiAgentOrchestrator` invocation for a low-budget, in-region (Karnataka) student with no DB colleges — confirm "NIT Patna" never appears in the final response.
- Full `runMultiAgentOrchestrator` invocation with a DB-retrieved-colleges scenario that happens to include a duplicate name (e.g. simulated overlapping rows) — confirm `realistic_colleges` has no duplicates in the final response.
