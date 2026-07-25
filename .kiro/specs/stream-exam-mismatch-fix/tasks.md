# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Stream-Exam Mismatch Produces Wrong Recommendations
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: Commerce+JEE and Arts+NEET mismatch pairs
  - Test `runCareerRecommendationAgent` fallback with `{ stream: 'Commerce', preferredModeOfAdmission: 'JEE' }` — assert output does NOT contain CA/BBA as top recommendations and DOES contain bridge/reconciliation paths and a mismatch advisory
  - Test `runCareerRecommendationAgent` fallback with `{ stream: 'Arts / Humanities', preferredModeOfAdmission: 'NEET' }` — assert output does NOT contain generic arts careers and DOES contain healthcare-adjacent bridge paths
  - Test `runSummaryAgent` fallback with `{ preferredState: '', stream: 'Commerce' }` — assert output does NOT produce "top institutions in undefined" or broken geographic placeholder
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: fallback ignores exam preference and produces CA/BBA; summary leaks state placeholders)
  - Document counterexamples found (e.g., "runCareerRecommendationAgent({stream:'Commerce', preferredModeOfAdmission:'JEE'}) returns CA/BBA instead of bridge paths")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Compatible Stream-Exam Pairs Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `runCareerRecommendationAgent` fallback with `{ stream: 'Science (PCM)', preferredModeOfAdmission: 'JEE' }` returns B.Tech/engineering recommendations on unfixed code
  - Observe: `runCareerRecommendationAgent` fallback with `{ stream: 'Science (PCB)', preferredModeOfAdmission: 'NEET' }` returns MBBS/BDS/Biotech recommendations on unfixed code
  - Observe: `runCareerRecommendationAgent` fallback with `{ stream: 'Commerce', preferredModeOfAdmission: '' }` returns CA/BBA recommendations on unfixed code (correct for no-exam case)
  - Observe: `runSummaryAgent` fallback with a valid `preferredState` value produces geographic text on unfixed code
  - Write property-based test: for all compatible stream-exam pairs (PCM+JEE, PCB+NEET, Commerce+CA Foundation, no-exam cases), the fallback output matches the currently observed behavior exactly
  - Write property-based test: for all inputs where `isBugCondition` returns false, `runCareerRecommendationAgent` produces the same result before and after fix
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for stream-exam mismatch and summary state leak

  - [x] 3.1 Add EXAM_STREAM_MAP and detectStreamExamMismatch to server/config/streams.js
    - Define `EXAM_STREAM_MAP` frozen object mapping normalized exam names to arrays of compatible streams: `'jee' → ['science (pcm)']`, `'neet' → ['science (pcb)', 'science (pcmb)']`, `'ca foundation' → ['commerce']`, `'clat' → ['arts / humanities', 'commerce']`, `'nift'/'uceed' → ['science (pcm)', 'arts / humanities']`
    - Create `detectStreamExamMismatch(stream, exam)` pure function that returns `{ isMismatch: boolean, advisory: string, bridgePaths: [...] }`
    - Function normalizes inputs, checks compatibility against EXAM_STREAM_MAP, and produces pre-computed bridge recommendations for known mismatch pairs
    - _Bug_Condition: isBugCondition(input) where exam is not empty, not 'none', validStreams is defined, and normalized stream NOT IN validStreams_
    - _Expected_Behavior: detectStreamExamMismatch returns isMismatch=true with advisory and bridge paths for mismatched inputs_
    - _Preservation: Returns isMismatch=false for compatible pairs and no-exam cases_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3_

  - [x] 3.2 Update runCareerRecommendationAgent fallback in server/agents/Orchestrator.js
    - Before the `if (stream.includes('PCM'))` chain, call `detectStreamExamMismatch(form.stream, form.preferredModeOfAdmission)`
    - If mismatch detected, return bridge recommendations from the detection result instead of falling through to generic `else` branch
    - Include advisory text in the response
    - For Commerce+JEE: recommend "B.Tech via lateral entry after B.Com", "Integrated BBA-MBA (Quant Finance)", "B.Sc Economics (Quantitative)"
    - For Arts+NEET: recommend "Healthcare Management (BHA)", "B.Sc Psychology", "Public Health"
    - _Bug_Condition: isBugCondition(input) where stream is incompatible with exam_
    - _Expected_Behavior: Fallback returns bridge/reconciliation paths with advisory instead of stream-only defaults_
    - _Preservation: Compatible pairs and no-exam cases continue through existing if/else chain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3_

  - [x] 3.3 Update runCombinedGuidanceAgent prompt in server/agents/Orchestrator.js
    - Before constructing the LLM prompt, run mismatch detection
    - If mismatch detected, append a paragraph to the prompt instructing the LLM to acknowledge the conflict and suggest reconciliation paths
    - This ensures LLM-based guidance also benefits from mismatch awareness
    - _Bug_Condition: isBugCondition(input) where combined agent prompt lacks mismatch context_
    - _Expected_Behavior: Prompt includes mismatch advisory so LLM can produce relevant reconciliation guidance_
    - _Preservation: When no mismatch, prompt remains unchanged_
    - _Requirements: 2.1, 2.2, 3.2_

  - [x] 3.4 Guard preferredState interpolation in runSummaryAgent fallback in server/agents/Orchestrator.js
    - Replace `${form.preferredState || 'India'}` with conditional check: only reference state if non-empty, meaningful, and contextually relevant
    - If state is empty, undefined, or not relevant to the recommendations, use generic phrasing like "across India" or omit geographic reference
    - If mismatch was detected, include advisory reference in the fallback summary
    - _Bug_Condition: preferredState is empty/undefined/irrelevant and fallback produces broken interpolation_
    - _Expected_Behavior: Summary omits geographic reference when state is not meaningful_
    - _Preservation: Valid, relevant state values in successful LLM summaries remain unchanged_
    - _Requirements: 2.4, 3.4, 3.5_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Stream-Exam Mismatch Produces Correct Bridge Recommendations
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (mismatch advisory + bridge paths)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — mismatch is detected, advisory is surfaced, bridge paths are returned)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Compatible Stream-Exam Pairs Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — compatible pairs, no-exam cases, successful LLM calls all behave identically)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm both exploration and preservation tests pass
  - Verify no other tests were broken by the changes
  - Ensure all tests pass, ask the user if questions arise
