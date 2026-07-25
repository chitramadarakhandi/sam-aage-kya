# Bugfix Requirements Document

## Introduction

When a student selects a stream (e.g., "Commerce") and a preferred entrance exam that is incompatible with that stream (e.g., "JEE" — an engineering exam), the system silently ignores the mismatch and recommends careers based solely on the stream. This produces nonsensical guidance (e.g., recommending CA for a Commerce student who expressed interest in JEE). Additionally, the summary agent's fallback references `form.preferredState` verbatim, causing irrelevant geographic placeholders (e.g., "top institutions in Mizoram") to appear in the summary even when the state has no bearing on the recommendation context.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a student's stream is "Commerce" and their preferred entrance exam is "JEE" THEN the system's fallback career recommendation logic ignores the exam preference entirely and recommends "Chartered Accountancy (CA)" and "BBA" based only on the stream field

1.2 WHEN a student's stream and preferred exam are incompatible (e.g., Commerce + JEE, Arts + NEET) THEN the system does not detect or surface the mismatch and produces recommendations that conflict with the student's stated exam preference

1.3 WHEN the combined guidance LLM call fails and the fallback is triggered THEN the `runCareerRecommendationAgent` fallback's `else` branch recommends CA and BBA for any non-PCM/non-PCB stream regardless of the preferred admission mode or exam

1.4 WHEN the summary agent's LLM call fails THEN the fallback summary uses `form.preferredState` as a raw string interpolation, producing text like "top institutions in Mizoram" even when the state value is a placeholder, unexpected, or irrelevant to the recommendations

### Expected Behavior (Correct)

2.1 WHEN a student's stream and preferred entrance exam are incompatible (e.g., Commerce + JEE) THEN the system SHALL detect the mismatch and include an explicit advisory in the response explaining the conflict (e.g., "JEE is an engineering exam — it doesn't directly apply to Commerce")

2.2 WHEN a stream-exam mismatch is detected THEN the system SHALL provide recommendations that reconcile both inputs — such as bridge paths (B.Tech via lateral entry, integrated programs), or paths relevant to the exam preference, rather than silently defaulting to stream-only recommendations

2.3 WHEN the combined guidance LLM call fails and the fallback is triggered for a student whose preferred exam does not match their stream THEN the `runCareerRecommendationAgent` fallback SHALL use the exam preference to select appropriate recommendations instead of falling through to the generic stream-only `else` branch

2.4 WHEN the summary agent's LLM call fails THEN the fallback summary SHALL only reference the student's preferred state if it is a meaningful, non-empty value that is contextually relevant to the recommendations produced, and SHALL omit geographic references otherwise

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a student's stream and preferred exam are compatible (e.g., PCM + JEE, PCB + NEET, Commerce + CA Foundation) THEN the system SHALL CONTINUE TO recommend career paths matching the stream as it does today

3.2 WHEN the LLM combined guidance call succeeds THEN the system SHALL CONTINUE TO use the LLM-generated recommendations without modification by the mismatch detection logic

3.3 WHEN a student does not specify a preferred entrance exam or specifies "None" THEN the system SHALL CONTINUE TO recommend based on the stream alone using the existing fallback logic

3.4 WHEN the summary agent's LLM call succeeds THEN the system SHALL CONTINUE TO use the LLM-generated summary without modification

3.5 WHEN a student's preferred state is a valid, relevant value and is used in a successful LLM summary THEN the system SHALL CONTINUE TO include geographic context in the summary as it does today
