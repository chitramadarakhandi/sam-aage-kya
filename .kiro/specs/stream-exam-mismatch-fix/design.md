# Stream-Exam Mismatch Fix — Bugfix Design

## Overview

When a student selects a stream and preferred entrance exam that are incompatible (e.g., Commerce + JEE), the system silently ignores the mismatch. The `runCareerRecommendationAgent` fallback only checks stream to select career paths, and the `runSummaryAgent` fallback blindly interpolates `form.preferredState`. This fix adds a stream-exam compatibility validation layer, corrects the fallback branching logic, and sanitizes the summary interpolation.

## Glossary

- **Bug_Condition (C)**: The student's preferred entrance exam is incompatible with their declared stream (e.g., Commerce + JEE, Arts + NEET)
- **Property (P)**: When a mismatch is detected, the system surfaces an advisory and generates bridge/reconciliation recommendations instead of stream-only defaults
- **Preservation**: Compatible stream-exam pairs, no-exam cases, and successful LLM calls continue to behave exactly as today
- **EXAM_STREAM_MAP**: A new mapping object that associates each exam to its valid stream families
- **runCareerRecommendationAgent**: Function in `server/agents/Orchestrator.js` that produces career recommendations via LLM or fallback
- **runSummaryAgent**: Function in `server/agents/Orchestrator.js` that produces a summary via LLM or fallback
- **runCombinedGuidanceAgent**: Single-call LLM agent that produces all guidance at once; its prompt will gain mismatch context

## Bug Details

### Bug Condition

The bug manifests when a student selects a preferred entrance exam that does not logically align with their declared stream. The `runCareerRecommendationAgent` fallback logic branches purely on stream content (`stream.includes('PCM')`, `stream.includes('PCB')`, else → CA/BBA) without ever consulting `form.preferredModeOfAdmission` or any exam preference field. The `runSummaryAgent` fallback unconditionally interpolates `form.preferredState` into the summary text.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type StudentFormData
  OUTPUT: boolean

  LET exam = normalize(input.preferredModeOfAdmission)
  LET stream = normalize(input.stream)
  LET validStreams = EXAM_STREAM_MAP[exam]

  RETURN exam IS NOT EMPTY
         AND exam != 'none'
         AND validStreams IS DEFINED
         AND stream NOT IN validStreams
END FUNCTION
```

### Examples

- **Commerce + JEE**: Student selects "Commerce" stream and "JEE" as preferred exam. System recommends CA and BBA (stream-only fallback). Expected: advisory about mismatch + bridge paths (B.Tech via lateral entry, integrated BBA-MBA with quant focus, etc.)
- **Arts + NEET**: Student selects "Arts / Humanities" and "NEET" as preferred exam. System recommends generic arts careers. Expected: advisory + bridge paths (healthcare management, psychology, public health)
- **PCM + CA Foundation**: Compatible pair — system should continue recommending engineering/science paths as today (no mismatch detected)
- **Commerce + None**: No exam specified — system should continue recommending CA/BBA via existing stream logic
- **Summary fallback with empty state**: `form.preferredState` is empty string or undefined. Fallback produces "top institutions in undefined". Expected: omit geographic reference entirely

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When stream and exam are compatible (PCM + JEE, PCB + NEET, Commerce + CA Foundation), recommendations remain identical to current behavior
- When the LLM combined guidance call succeeds, its output is used as-is with no mismatch interception
- When no exam is specified or exam is "None", the existing stream-only fallback logic applies unchanged
- When the LLM summary call succeeds, its output is used without modification
- When `preferredState` is a valid, contextually relevant value in a successful LLM summary, geographic context remains

**Scope:**
All inputs where `isBugCondition` returns false are completely unaffected by this fix. This includes:
- Compatible stream-exam pairs
- Students who did not specify an exam
- All successful LLM calls (combined or per-agent)
- Mouse/UI interactions unrelated to the recommendation pipeline

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Exam-Stream Validation Layer**: There is no `EXAM_STREAM_MAP` or compatibility check anywhere in the pipeline. The system trusts that form inputs are always semantically consistent.

2. **Fallback Branching Ignores Exam Preference**: In `runCareerRecommendationAgent`, the fallback `else` branch (lines ~245-270) triggers for any non-PCM, non-PCB stream regardless of what exam the student selected. It only checks `stream.includes('PCM')` and `stream.includes('PCB')`, then defaults to CA/BBA for everything else.

3. **Summary Interpolation Without Guard**: In `runSummaryAgent`, the fallback template uses `${form.preferredState || 'India'}` — this interpolates raw state values (including potentially irrelevant ones like "Mizoram") without checking whether the state is contextually meaningful for the recommendations produced.

4. **Combined Agent Prompt Lacks Mismatch Context**: `runCombinedGuidanceAgent` passes the student's stream and admission mode to the LLM but does not explicitly flag incompatibility. The LLM may or may not catch it depending on its reasoning.

## Correctness Properties

Property 1: Bug Condition - Mismatch Detection and Bridge Recommendations

_For any_ student input where the preferred exam is incompatible with the declared stream (isBugCondition returns true), the fixed system SHALL detect the mismatch, include an explicit advisory message explaining the conflict, and generate bridge/reconciliation recommendations that honor both the student's stream background and their exam interest.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Compatible and No-Exam Inputs Unchanged

_For any_ student input where the stream and exam are compatible or no exam is specified (isBugCondition returns false), the fixed system SHALL produce the same recommendations and summary as the original system, preserving all existing career path selection logic and summary generation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/config/streams.js`

**Addition**: `EXAM_STREAM_MAP` constant and `detectStreamExamMismatch` utility

**Specific Changes**:
1. **Define EXAM_STREAM_MAP**: A frozen object mapping exam names (normalized) to arrays of compatible streams:
   - `'jee'` → `['science (pcm)']`
   - `'neet'` → `['science (pcb)', 'science (pcmb)']`
   - `'ca foundation'` → `['commerce']`
   - `'clat'` → `['arts / humanities', 'commerce']`
   - `'nift'` / `'uceed'` → `['science (pcm)', 'arts / humanities']`
   - Additional exams as needed

2. **Create `detectStreamExamMismatch(stream, exam)` function**: Returns `{ isMismatch: boolean, advisory: string, bridgePaths: [...] }` — a pure function that checks compatibility and produces pre-computed bridge recommendations for known mismatch pairs.

**File**: `server/agents/Orchestrator.js`

**Function**: `runCareerRecommendationAgent` (fallback branch)

**Specific Changes**:
3. **Add mismatch check before fallback branching**: Before the `if (stream.includes('PCM'))` chain, call `detectStreamExamMismatch(form.stream, form.preferredModeOfAdmission)`. If mismatch detected, return bridge recommendations instead of falling through to the generic `else`.

4. **Bridge recommendations for known mismatch pairs**: For Commerce+JEE: recommend "B.Tech via lateral entry after B.Com", "Integrated BBA-MBA (Quant Finance)", "B.Sc Economics (Quantitative)". For Arts+NEET: recommend "Healthcare Management (BHA)", "B.Sc Psychology", "Public Health". Include the advisory text in the response.

**Function**: `runCombinedGuidanceAgent`

**Specific Changes**:
5. **Inject mismatch context into LLM prompt**: Before constructing the prompt, run the mismatch detection. If mismatch detected, append a paragraph to the prompt instructing the LLM to acknowledge the conflict and suggest reconciliation paths.

**Function**: `runSummaryAgent` (fallback branch)

**Specific Changes**:
6. **Guard `preferredState` interpolation**: Replace `${form.preferredState || 'India'}` with a conditional check — only reference the state if it is a non-empty, meaningful value AND the recommendations are geographically relevant. Otherwise, use a generic phrase like "across India" or omit the geographic reference.

7. **Include mismatch advisory in summary if applicable**: If the mismatch was detected earlier in the pipeline, the fallback summary should reference it rather than producing a generic stream-only summary.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Call `runCareerRecommendationAgent` and `runSummaryAgent` with mismatch inputs (Commerce+JEE, Arts+NEET) on the UNFIXED code and assert that the output contains nonsensical recommendations (CA for a JEE aspirant) and leaked state placeholders.

**Test Cases**:
1. **Commerce+JEE Fallback Test**: Invoke fallback with `{ stream: 'Commerce', preferredModeOfAdmission: 'JEE' }` — will return CA/BBA (wrong)
2. **Arts+NEET Fallback Test**: Invoke fallback with `{ stream: 'Arts / Humanities', preferredModeOfAdmission: 'NEET' }` — will return CA/BBA (wrong)
3. **Summary State Leak Test**: Invoke summary fallback with `{ preferredState: 'Mizoram', stream: 'Commerce' }` — will produce "top institutions in Mizoram" even when irrelevant
4. **Summary Empty State Test**: Invoke summary fallback with `{ preferredState: '', stream: 'Commerce' }` — will produce "top institutions in India" (acceptable but not ideal)

**Expected Counterexamples**:
- Career fallback returns CA/BBA for Commerce+JEE input (ignores JEE entirely)
- Summary produces geographic text with raw state value regardless of relevance
- Possible causes: fallback branching only checks stream, summary uses unconditional interpolation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := runCareerRecommendationAgent_fixed(input)
  ASSERT result.mismatchAdvisory IS NOT EMPTY
  ASSERT result.recommendations ARE bridge/reconciliation paths
  ASSERT result.recommendations DO NOT contain stream-only defaults (CA for Commerce+JEE)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT runCareerRecommendationAgent_original(input) = runCareerRecommendationAgent_fixed(input)
  ASSERT runSummaryAgent_original(input) = runSummaryAgent_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of compatible stream-exam pairs automatically
- It catches edge cases where normalization might differ (casing, whitespace)
- It provides strong guarantees that existing behavior is unchanged for all non-mismatch inputs

**Test Plan**: Observe behavior on UNFIXED code first for compatible inputs (PCM+JEE, PCB+NEET, Commerce+CA Foundation, no-exam cases), then write property-based tests capturing that behavior.

**Test Cases**:
1. **PCM+JEE Preservation**: Verify `runCareerRecommendationAgent` returns B.Tech/B.Sc recommendations for PCM stream — unchanged after fix
2. **PCB+NEET Preservation**: Verify PCB stream returns Biotech/BPT recommendations — unchanged after fix
3. **Commerce+No Exam Preservation**: Verify Commerce with no exam returns CA/BBA — unchanged after fix
4. **Summary LLM Success Preservation**: Verify that when LLM succeeds, summary output is passed through unmodified

### Unit Tests

- Test `detectStreamExamMismatch` with all known exam-stream combinations
- Test `EXAM_STREAM_MAP` completeness — every exam in the map has at least one valid stream
- Test normalization edge cases (casing, whitespace, abbreviations)
- Test fallback branching with mismatch inputs returns bridge paths
- Test fallback branching with compatible inputs returns original paths
- Test summary fallback with empty/undefined/irrelevant `preferredState`

### Property-Based Tests

- Generate random `(stream, exam)` pairs from the known domain; verify mismatch detection is consistent with `EXAM_STREAM_MAP`
- Generate random compatible pairs; verify fallback output is identical to original function
- Generate random `preferredState` values (empty, undefined, valid states, garbage); verify summary never produces broken interpolation

### Integration Tests

- Full orchestrator flow with Commerce+JEE: verify final response includes advisory and bridge paths
- Full orchestrator flow with PCM+JEE: verify final response is identical to current behavior
- Full orchestrator flow with empty exam preference: verify no mismatch detection triggered
- Summary output with various state values: verify no geographic leak for irrelevant states
