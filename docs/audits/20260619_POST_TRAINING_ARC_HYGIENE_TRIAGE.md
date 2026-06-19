# Triage & Resolution — Post-Training-Arc Hygiene Cleanup

**Date:** 2026-06-19 · **Branch:** `claude/beautiful-cray-jhqti6` (off `main` @ `f509696`, includes 5b-ii)
**Type:** hygiene cleanup (BUILD_RULES §2) — test + lint only · **Fence:** GO / CLEAN
**Result:** suite **3048 pass / 5 fail → 3053 pass / 0 fail**; `vite build` clean; no production code edited.

## Part A — the lint nit

`src/screens/TrainingDraftRoomScreen.jsx:49` — `onClockId` was destructured from
`useTrainingDraft(...)` and referenced nowhere else in the file (verified: sole
occurrence). Removed the dead binding. No behavior change; client build green.

## Part B — the five reds: triage table

**Common root cause:** all five lock the **superseded** training-pod design where
training pods rode the *same* ranked Monday/orchestrator pipeline (and only the
nightly leaderboard excluded them). **Slice 3 (Design B)** — ratified in
`docs/audits/2026-06-18_LEAGUE_TRAINING_SLICE3_CODE_REVIEW.md` (verdict "ship-ready,
fence clean"; Finding #1 fixed a bug *within* this design), merged, extended through
5b-ii — moved a training pod's agent layer OFF the ranked duties
(`runMondayPipeline`/`runWeekdayFanout` pass `excludeTraining:true`,
`tournamentOrchestrator.js:445-446,570`) and onto its dedicated owner,
`activateTrainingPod`/`sweepTrainingActivation` (`tournamentOrchestrator.js:695,792`).
Advancement still reads training pods (no `excludeTraining`) to give them the
"plain finish" → COMPLETE (`tournamentAdvancement.js:280-285`). **No red was a real
catch** — the production code is correct; the tests lagged. All resolutions are
test-only; no production code changed to satisfy a stale test.

| # | Test (file:line) | Why it failed | Class | Resolution |
|---|---|---|---|---|
| 1 | `p4Flips.test.js:80` — "every dispatcher duty threads includeDevGroups" | Regex required the options object to be exactly `{ includeDev: includeDevGroups }`; the 3 orchestrator calls now read `{ includeDev: includeDevGroups, excludeTraining: true }` → 0 matches | Stale assertion | **Fixed** — regex loosened to match `includeDev: includeDevGroups` regardless of trailing props; count still asserts 3 |
| 2 | `p4Flips.test.js:111` — "ONLY leaderboard passes excludeTraining; orchestrator + advancement do NOT" | The ranked orchestrator now *does* pass `excludeTraining` (Design B) | Stale assertion | **Fixed** — flipped the orchestrator assertion to `toContain('excludeTraining: true')`; leaderboard (contains) + advancement (does not) unchanged; test title + §2b narrative comments rewritten to Design B |
| 3 | `seam.test.js:404` (Stage 5) — "the writer output RUNS the agent layer like any group: Monday→BATTLE" | `runMondayPipeline` excludes the training pod → it stays FORMING → `mondaySummary.groups` 0, not 1 | Stale assertion (obsolete premise) | **Fixed** — re-targeted: Monday EXCLUDES the pod (asserted directly: `mondaySummary.groups === 0`); the training SWEEP runs the agent layer → BATTLE + 4 deploys; deploy-body contract kept verbatim |
| 4 | `seam.test.js:423` (Stage 5) — "PRESENT in banking" | Pod stuck FORMING (never reached BATTLE via Monday) → `bankGroup` skips non-BATTLE | Setup drift | **Fixed** — new helper drives the pod to BATTLE via the real interactive draft + sweep; assertion body unchanged |
| 5 | `seam.test.js:468` (Stage 5) — "ABSENT from rank + bracket, then COMPLETE" | Pod stuck FORMING → Friday advancement (BATTLE-only) skips it → stays FORMING | Setup drift | **Fixed** — same new helper; assertion body already Design-B-correct, unchanged |

### Seam Stage 5 — rewrite detail (faithful, not removed)

Stage 5's charter is the **writer-fed end-to-end seam** (real `quickPlay`/
`formTrainingDraft` output through the whole live duty chain — the P10
"untested in COMBINATION" lesson). It tests an existing invariant via a superseded
*entry path*, not a removed feature, so it was rewritten rather than deleted. The
old helper (`quickPlay({isTraining:true})` + `commitHumanBoard` + `runMondayPipeline`)
modeled training through the ranked flow. The new helper `quickPlayTrainingAndActivate`
drives the real Design B flow:

1. `formTrainingDraft` — the real writer (wraps `quickPlay({isTraining:true})`,
   initializes the live snake draft FORMING→DRAFTING).
2. `applyTrainingPick({autopick:true})` looped to completion — the 12th pick
   inline-flips DRAFTING→BATTLE (`MON_MORNING` = 08:00 ET, a pre-open today-anchor).
   Pattern mirrors the locked `trainingLifecycle.test.js:366-398`.
3. `sweepTrainingActivation` — the Design B owner: provisions the human clone + CPUs,
   produces boards (clone = model via the existing `anthropicStub`, CPUs = fallback),
   drafts the 24-name market, fans out 4 deploys.

The writer-fed exclusion invariant is preserved end to end: ABSENT from the
leaderboard read, ABSENT from career rank + bracket, PRESENT in banking, reaching
COMPLETE with `trainingCompleted:1` and zero ladder side-effects.

## Fence — GO / CLEAN

Files changed: `src/screens/TrainingDraftRoomScreen.jsx` (client),
`api/_utils/p4Flips.test.js` (test), `api/_utils/tournamentLobbyFormation.seam.test.js`
(test). None of the 8 §1 fenced files edited; no production code edited at all.

## Verification

- Full suite: **3053 pass / 0 fail** (146 files) — the 5 prior reds resolved against
  correct behavior, no new reds.
- Targeted: `p4Flips.test.js` 16/16, `tournamentLobbyFormation.seam.test.js` 9/9.
- `vite build`: clean (pre-existing chunk-size warning only).
- No Vercel smoke (test + lint only; the nit removal is a user-facing no-op).
