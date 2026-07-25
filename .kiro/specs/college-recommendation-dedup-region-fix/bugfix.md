# Bugfix Requirements Document

## Introduction

The career-option recommendation pipeline builds a `realistic_colleges` / institution list for each recommended career option in `server/agents/Orchestrator.js`. A code audit against career-card consistency rules found two defects in how this list is produced:

1. No deduplication pass exists anywhere in the pipeline before `realistic_colleges` is returned to the frontend, so the same institution name can appear twice within one option's list (e.g. from overlapping DB rows, overlapping LLM output, or overlapping fallback branches).
2. In `runCollegeRecommendationAgent`, when a student's budget is `below_20k` or `below_1L`, the fallback college list silently overwrites "RV College of Engineering" and "PES University" with "NIT Patna" — regardless of the student's actual state/city — with no check for an in-region affordable alternative and no disclosure that an out-of-region institute was substituted. This violates the rule that institutions must be filtered by the user's stated location/region, and that out-of-region results are only acceptable when no better regional match exists and the substitution reason is stated explicitly.

Both defects reduce the trustworthiness of the recommendation cards: duplicate entries look like a data bug, and a silent unrelated-region swap misleads students about why a distant institution was recommended.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the retrieved-colleges list, LLM output, or fallback branches contain overlapping/duplicate institution names for the same career option THEN the system returns a `realistic_colleges` list containing duplicate entries for that option
1.2 WHEN a student's `budget` is `below_20k` or `below_1L` and the default fallback colleges include "RV College of Engineering" or "PES University" THEN the system silently replaces them with "NIT Patna" regardless of the student's actual state or city, without checking whether an in-region affordable option already exists
1.3 WHEN the silent swap in 1.2 occurs THEN the system labels the substituted institution with a generic `whyFit` ("National Institute offering quality engineering education at subsidized fees.") that does not disclose that an out-of-region substitution was made or why

### Expected Behavior (Correct)

2.1 WHEN building the final institution list for any career option THEN the system SHALL deduplicate entries by institution name before returning `realistic_colleges`, so no institution name appears more than once in a single option's list
2.2 WHEN a student's `budget` is `below_20k` or `below_1L` and the fallback logic considers replacing a default college THEN the system SHALL first check whether the student's actual state/city has a comparable affordable option in the retrieved or fallback data, and SHALL only substitute an out-of-region institute (e.g. NIT Patna) when no such in-region option exists
2.3 WHEN the system substitutes an out-of-region institute per 2.2 THEN the system SHALL set an explicit disclosure reason in `whyFit` (e.g. "No affordable engineering college found in your region — nearest subsidized option is in Patna.") stating that no in-region affordable match was found, rather than presenting it as an ordinary regional match

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a career option's institution list contains no duplicate names THEN the system SHALL CONTINUE TO return the same institutions in the same order as before
3.2 WHEN a student does NOT have a low budget (i.e. `budget` is not `below_20k` or `below_1L`) THEN the system SHALL CONTINUE TO return the existing fallback/retrieved colleges unchanged, with no NIT Patna substitution logic applied
3.3 WHEN a student has a low budget but their region already has a comparable affordable option in the retrieved/fallback data THEN the system SHALL CONTINUE TO recommend that region-appropriate option instead of substituting an out-of-region institute
3.4 WHEN colleges are retrieved from the database (`retrievedColleges.length > 0`) THEN the system SHALL CONTINUE TO use the DB-verified, budget/marks/location-scored colleges as the primary source, with the fallback-swap logic only affecting the static fallback lists
