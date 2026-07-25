# Foundation implementation record

Implementation date: 2026-07-19  
Last updated: 2026-07-26 (third reconciliation pass — see “Second pass” and “Third pass” below)

This slice addresses immediate trust, security, configuration, and deployability defects. It does not complete the production rebuild described in the roadmap.

## Completed in code (first pass, 2026-07-19)

- Removed tracked Supabase values from `server/.env.example` and documented mandatory rotation/history scanning.
- Added environment parsing and production validation in `server/config/env.js`.
- Added honest degraded local mode, capability health, dependency readiness, request IDs, basic security headers, structured request logging, strict production CORS requirements, 404 handling, and centralized unexpected-error handling.
- Introduced `VITE_API_URL`/same-origin construction in `src/api.js`. This bullet originally claimed all frontend requests had been migrated and hard-coded localhost origins removed; that was not accurate — 21 call sites across 12 files still built their own `http://localhost:5000` URLs and were migrated in the second pass below.
- Kept the SPA renderable without frontend Supabase variables while auth/persistence fail closed.
- Removed fake backend/frontend mentor fallbacks, fabricated testimonials/adoption metrics, unconditional “free/online” promises, and simulated persistence success.
- Hid mentors until review and made an unavailable datastore return a truthful empty/error state.
- Made prototype seed/cutoff fallback data opt-in only in non-production and blocked accidental production seeding.
- Reframed the cutoff feature as an uncalibrated historical comparison, with descriptive position labels and explicit methodological limitations.
- Keyed guidance and roadmap caches by a canonical input fingerprint so changed profiles/options do not receive an unrelated cached result.
- Changed database-backed guidance labels and prompts from “verified” to prototype/unverified until evidence review exists.
- Added a forward security migration that protects role changes, requires reviewed mentor visibility, hides unreviewed colleges/scholarships/cutoffs, removes anonymous direct mentor-application inserts, and narrows Q&A, session, notification, and chat authorization.
- Corrected scholarship retrieval to include the marks field used by its current filter.
- Protected the analytics API with authenticated `admin` role middleware.
- Replaced deployment-key instructions in the student UI with an honest temporary-unavailability state.
- Cleared the existing frontend lint baseline and enabled the previously unused reviewed-feedback empty state.
- Upgraded Vite from the vulnerable 4.x line to 6.4.3 and removed the npm audit vulnerabilities reported at that time. (No longer true as an absolute statement — see the second pass; two moderate `react-router` advisories are currently accepted.)
- Added a least-privilege GitHub Actions CI workflow for clean installs, lint, build, tests, and frontend/server dependency audits. The audit steps originally gated at `--audit-level=critical`, so high-severity advisories could not fail CI; both now gate at `--audit-level=high` (third pass, below), and the workflow comments record the two moderate `react-router` advisories that are knowingly left unblocked.
- Rewrote setup, limitations, security, migration, and verification documentation.

## Verification results

Two columns: the first-pass result recorded on 2026-07-19, and the re-measured result on 2026-07-26.

| Check | 2026-07-19 | 2026-07-26 |
|---|---|---|
| `npm run lint` | Pass, zero warnings/errors | Pass, zero warnings/errors |
| `npm run build` | Pass with Vite 6.4.3 | Pass with Vite 6.4.3; Rollup still warns that the main chunk exceeds 500 kB (659.52 kB) because all routes remain eager |
| `npm test` | Pass: 13 tests across environment validation and API degraded mode | Pass: 156 tests / 28 suites, 156 pass, 0 fail, 0 cancelled, 0 skipped (was 141 / 26 before the third pass added shared-AI-client coverage) |
| `npm audit --audit-level=high` | Pass: zero vulnerabilities reported | Pass at the high threshold: root has 0 critical / 0 high / 2 moderate (`react-router`), `server/` has 0. CI now gates at `high` as well, so this threshold is enforced rather than advisory |
| `node --check server/index.js` | Pass | Pass |

The API tests prove that missing configuration is visible, readiness fails closed, prototype cutoff data is not served by default, mentors are not fabricated, and writes do not report simulated success.

## Second pass (2026-07-26)

This pass was correctness and honesty work on top of the first slice. It did not advance Phase 1 of the roadmap.

### Completed in code

- Migrated every remaining hard-coded backend URL in the SPA to `src/api.js`, which is now the single networking entry point. Added `postReOnboard`, `putWallet`, `postScenario`, `getScenarios`, `deleteScenario`, `getQAPosts`, `postQAQuestion`, `postChat`, `getCollegeDetails`, `getCourseFeedback`, and `postGenerateCareerPath`. No `localhost` literal remains under `src/` outside two explanatory comments in `src/api.js`; 15 modules import the client. The first pass claimed this was already done — it was not, the constants had simply been left in the page components.
- Fixed a college data-integrity defect: `/api/college-details` matched on the first word of the requested name and trusted the first row, so institutions sharing a first word served each other's fees, cutoffs, and placements. Matching now uses `pickCollegeMatch` in `server/domain/colleges/matchCollegeName.js` — normalized whole-name exact match, then whole-name containment accepted only when exactly one row qualifies, otherwise no database match. Frontend enrichment moved to `src/data/collegeEnrichment.js`, keyed by full institution name with exact-match-only lookup plus an explicit alias map; the same defect class was fixed in `src/data/courseReality.js`. Added `src/utils/location.js` to collapse duplicated city/state display for union territories.
- Deleted the local `callGemini` helper from `server/index.js`. `/api/roadmap` and `/api/generate-career-path` now use the shared `callLLM()` from `server/ai/llmClient.js`, so they inherit the provider chain (Groq → Gemini → OpenRouter → OpenAI), the token-budget estimate, and the 429 circuit breaker.
- Deleted the exploratory “v2” guidance stack, which no route ever reached: `server/ai/guidanceOrchestrator.js`, `server/ai/providerGateway.js`, `server/ai/providers/groqProvider.js`, `server/ai/contracts.js`, `server/domain/profile/normalizeStudentProfile.js`, `server/domain/recommendations/rankCandidates.js`, `server/domain/scholarships/evaluateScholarshipRules.js`, `server/domain/exams/inferExamRoutes.js`, `server/domain/fees/feeEngine.js`, `server/data/verifiedFeePilot.js`, and their seven test files. `server/ai/` now contains only `llmClient.js` and `pathwayAdvisor.js`; `server/domain/` contains only `verification/verifyEvidence.js` and `colleges/matchCollegeName.js`. The one piece worth keeping, `enforceGuidanceEvidence`, is wired into the live orchestrator pipeline. The zod-validated contracts, provider gateway, and evidence-coverage tracing in that stack were never reachable implementation and are still target design only.
- Fixed the flaky server integration suite. Root cause was a 10-second startup cap in the `before()` hook of `server/test.js`, which starved when 26 test files run in parallel under `node --test`; the “deserialize cloned data” error blamed earlier was never reproducible. The harness now uses an OS-assigned port, `/api/health` readiness polling, a 60-second budget configurable via `TEST_SERVER_START_TIMEOUT_MS`, and a sanitized child environment.
- Dependency posture: Vite `^6.4.3`, `@vitejs/plugin-react` `^4.7.0`, `react-router-dom` held at 6.30.4 in `package.json` and the lockfile. The lockfile had drifted to `react-router-dom` 7.18.1, which carried a high-severity RSC CSRF advisory; reverting cleared the highs. `server/` transitive `body-parser` patched to 1.20.6 via express 4.22.2, leaving `server/` at zero vulnerabilities.
- Added a root `.nvmrc` pinning Node 22 to match CI.

### Known open items from this pass

- **Two moderate `react-router` advisories are accepted, not fixed.** They affect `6.0.0 - 7.17.0`: an open redirect via backslash in `<Link>`/`useNavigate`, and arbitrary constructor injection through `deserializeErrors()` during SSR hydration. The machine-readable audit output additionally lists an open-redirect-to-XSS advisory against `react-router-dom` 6.30.2–6.30.4 itself. There is no patched 6.x release; the advertised fix is `>=7.18.0`, which is the line that carried the high-severity advisory, and clearing them properly means migrating to `react-router` 8 across two majors. The SSR path is unreachable in a client-only SPA, so the residual risk is redirect handling. This needs its own planned slice.
- **LLM consolidation is incomplete.** Three raw `groq-sdk` call sites remain: `/api/transcribe` (Whisper audio, which legitimately needs the SDK), `/api/parent-summary`, and `/api/chat`. `getGroqClient()` and the `groq-sdk` import stay for those, and those paths have no provider fallback, circuit breaker, or budget accounting.
- **AI observability regressed.** Fixed in the third pass below: structured per-call telemetry now lives inside `callLLM`, so it covers every call site through the shared client instead of one route helper.
- **Fee Explorer is broken.** Still non-functional, but the diagnosis was wrong: the page was never routed. `src/App.jsx` has no import or `<Route>` for `src/pages/FeeExplorer.jsx` and nothing under `src/` links to it, so there was nothing to take off the routes. It still imports `getVerifiedFeePlan` and `getVerifiedFeePlans`, which do not exist in `src/api.js`, and the `/api/fees/pilot`, `/api/fees/pilot/:id`, and `/api/fees/calculate` routes it depends on were never implemented in `server/index.js` — they appear only in `docs/FEE_RESEARCH_PILOT.md`. The file is kept on disk as reference work with a header comment recording all of that; Rollup would still not fail the build on the missing named imports if it were routed. Building it needs the sourced `/api/fees/*` routes plus the matching client helpers.
- **Dead and orphaned code left in place deliberately.** Cleared in the third pass below: `getMockGuidance` is deleted, and the orphaned `zod` and `@google/generative-ai` dependencies are out of `server/package.json`. `zod` returns when the Phase 1 typed contracts are built.
- **Runtime versions disagree.** Still open. `.nvmrc` and CI use Node 22, `server/package.json` declares `engines.node >=20`, and local development runs Node 18.20.8, which `@supabase/supabase-js` is deprecating. Local, declared, and CI runtimes should be aligned.
- **`isAiAvailable()` under-reports availability.** Fixed in the third pass below.

## Third pass (2026-07-26)

A reconciliation pass that closed open items created by the second pass. It did not advance Phase 1 either.

### Completed in code

- Raised both CI audit gates from `--audit-level=critical` to `--audit-level=high`, so any high or critical advisory now fails the build. The workflow comment states plainly which two moderate `react-router` advisories stay unblocked and why.
- Made `isAiAvailable()` consistent with the provider chain. It and `getAiStatus()` now derive key presence from `hasAnyProviderKey()`, which calls the same `buildProviderChain()` that a real call uses, so a Gemini-only or OpenRouter-only deployment reports AI as available and the availability check cannot drift from the chain again.
- Restored structured AI telemetry inside the shared client: `callLLM` emits `ai_call` on success, `ai_call_attempt` for each failed provider attempt (so fallback hops are visible, which the pre-`callGemini` logging never showed), and `ai_call_error` on terminal failure, each with `ts`, `callType`, `studentId`, `promptTokens`, `provider`, `model`, `latencyMs`, and `parseOk`. `callLLM` accepts optional `callType`/`studentId` attribution — `/api/roadmap` passes `roadmap`, `/api/generate-career-path` passes `custom_career`, and unattributed calls log `unspecified` — so no existing call site had to change.
- Removed the orphaned `zod` and `@google/generative-ai` dependencies from `server/package.json` and regenerated the lockfile. Neither had a consumer; the live Gemini path uses Google's OpenAI-compatible REST endpoint via `fetch`, not the SDK.
- Deleted the dead `getMockGuidance` from `server/index.js`. `getMockRoadmap` and `getMockCustomCareerPath` are still live and untouched.
- Documented `src/pages/FeeExplorer.jsx` as unrouted and non-functional in a header comment on the file itself, after confirming it was never registered in `src/App.jsx` or linked from anywhere in `src/`. Nothing was removed from the router because nothing was there.
- Test coverage went from 141 tests / 26 suites to 156 / 28, the added tests covering shared-AI-client availability and the telemetry contract.

## Required owner/operator actions

These cannot be completed from a local code change:

1. Rotate/revoke the previously tracked Supabase service-role and anon/JWT credentials immediately, update deployment secrets, and review logs.
2. Run secret scanning over full Git history. Coordinate any history rewrite because it disrupts clones and does not replace rotation.
3. Back up and clone the database to staging; apply `supabase/migrations/202607190001_security_foundation.sql`; run role/RLS tests; then deploy it through an approved migration job.
4. Do not mark seed rows verified. Re-ingest a narrow pilot scope from authoritative current-cycle documents using the source policy.
5. Configure reviewed mentor records through a staff-only workflow before making the mentor service public.
6. Run browser/device/accessibility E2E in an environment reachable from the browser runner; the local in-app browser could not reach the host Vite process during this audit.

## Still intentionally open

- The server remains a JavaScript monolith and output schemas are not fully runtime validated.
- The database is still the legacy model plus an emergency migration, not the target normalized schema.
- In-memory rate limiting is not suitable for multiple instances.
- Recommendation caching does not yet include full profile/data/prompt/model versions.
- The recommendation and scholarship algorithms remain prototype filters; hiding unreviewed records prevents false trust but does not create production data.
- The cutoff comparison is not a calibrated admission model.
- Consent, retention, guardian/minor safeguards, moderation, data export/delete, OpenAPI, jobs, observability, E2E, and full accessibility/multilingual/PWA work remain phased deliverables. CI exists only as the lint/build/test/audit workflow; there is no deployment pipeline, preview environment, or migration job in it.

The next implementation step is Phase 1 in `IMPLEMENTATION_ROADMAP.md`: typed contracts and modular domains, server-controlled role memberships, policy tests, migrations/CI, durable limits/jobs, consent, and observability.
