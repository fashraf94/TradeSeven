# Build report — Command Center hub, slice S2a

Claude Code (Opus 5.5), October 16, 2026, for Flash. The build prompt was the founder's "FantasyTrades Command Center — implementation kickoff, S2a: eligibility and attempt selectors" of October 16, with rulings R-S2A-1 … R-S2A-5. This report covers S2a only (spec V1.2 §11.2). It builds the pure eligibility selector (§3.1, correction C1), the request-ownership predicates (§5.3, C2), the attempt vocabulary and translation table (§5.2, C3), the attempt reducer with its dismissal, retry, cooldown and orphan rules (§5.4), and the fixtures for every C1–C3 acceptance row. It also carries the one-line Q1 change left over from S1. Everything is pure code behind `COMMAND_CENTER_HUB_ENABLED = false`, which stays false. Nothing reads data, nothing is wired to deployment, nothing is activated or merged.

## Verdict

| Item | Result |
|---|---|
| Starting check | Every seam the prompt names matches the spec and the S1 report at `1d6d5d4a` (§2). No conflict, so the build did not stop. |
| Q1 (R-S2A-1) | First commit `db5a2fd6`. The stacked order now reads next action → stage → Deploy → area panel → Games → Activity → Brief, and the rows that pinned it moved with it. The move is visual only: S1's one grid keeps the DOM, and so the keyboard focus order, as it was (founder question Q-S2A-1, §11). |
| The selector (C1) | `deriveHubDeployState` applies the §3.1 table in its order, first match wins. It computes the retained gate first, independently of the poll's status, with the shipped `deriveDeployGate`, never a capacity constant or `agent.activeBattleId`. One row per table row, the precedence rows, every §11.3 "Eligibility C1" case by name, and gate parity with the helper (8 live lists × both flag values × 3 poll statuses) all pass. |
| Ownership (C2) | `captureIdentity` and `isCurrent` require both the auth identity/epoch and the attempt epoch. Returning to the same uid after a switch (A→B→A) never revives an old request. Each §11.3 "Ownership C2" case is listed by name, either with the row that exercises it or deferred to the slice that owns it (S2b/R1: append, stash, navigation, "server battle remains"). |
| Vocabulary (C3) | Typed constants, the §5.2 translation row for row, and the display translation. Untyped results fail closed to `uncertain` (R-S2A-2), today's `{ success:true, agentBattleId }` included. The one exception is the 409 `hypothesis_review_due` refusal, which keeps the server's words exactly. Every §11.3 "Vocabulary C3" case runs as a named reducer sequence. |
| The reducer (§5.2–§5.4) | Pure, frozen, refuses stale or foreign actions by returning the same object. A 1.2-million-step random-sequence probe by the reducer lens found no invariant violation (§8.2). |
| The hub consumes it (R-S2A-3) | `CommandCenterHub.jsx` calls `deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS)`. Every input is unresolved, so it reads `checking` ("Checking eligibility…"): nothing a user sees changes. |
| Display vocabulary | All 18 display states have their words in `hubCopy.js`, with the spec's words where the spec gives them. The strip and the Deploy card show each state's one action (disabled until S2b wires it) and the freshness notes. The strip's two lines now wrap in full: measured in headless Edge, the S2a words clipped under S1's two-line clamp (S1 review L3-13, §7). |
| With the flag off | Re-proved by the A4 lens and its refuter on Windows builds of `main` and the branch. The entry has the same 1,115 modules; it grows by 38 B, half because `deriveDeployGate` is no longer specialised to the constant flag (behaviour unchanged at `true`) and half for two new entry exports. `index.html` is identical but for the hash, with no preload. The CSS is byte-identical. Only the hub chunk changes. On Linux at the merged head the build holds no preload and no hub reference in `index.html` (§7). |
| Tests | 6 new test files and 2 new fixture modules; 10 test files extended. 777 rows in the 22 hub test files, all green (§7). |
| Mutation | Builder pass 12 / 12 killed. The test-integrity lens (A5) ran 257 mutants (211 killed) and 27 guard plants (14 red). Its refuter confirmed the gaps, and the fix round added the rows and guard checks. The re-run of the survivors and the new guard checks: **46 / 46 killed**, each by the row written for it (§8.4). |
| `vite build` | Exit 0 on Linux at the merged head `a40d5375`. Hub chunk `CommandCenterHub-*.js` 67.58 kB, gzip 20.23 kB (S1: 57.15 kB), still its own chunk, reached only through the gate's lazy import; `index.html` has 0 `modulepreload` and no hub reference. |
| `lint:gate` | Exit 0 (Linux, merged head). |
| Full suite (Linux, CI-shaped) | Exit 0 at the merged head `a40d5375` (WSL Ubuntu, private clone, Node 20.20.2, `TZ=UTC`, `vitest run --maxWorkers=2`): `Test Files 1017 passed \| 7 skipped (1024)`, 22,093 passed, 88 skipped, 0 failed. |
| §2 review | Five lenses, each with its own refuter on its own snapshot, the mutating lens last: A1 spec conformance, A2 ownership and epochs, A3 reducer invariants, A4 flag-off parity, A5 test integrity. **49 findings: 30 CONFIRMED, 15 PARTLY, 4 REFUTED**, plus 1 new NIT from the A4 refuter. No MAJOR survived its refuter (A3-1 was downgraded to MINOR as latent). No finding was a defect in what users get with the flag off. Details in §8. |
| Fenced files, services, api | None edited. Nothing under `src/services/` or `api/` changed; no cron; no flag. |
| Founder questions | Q-S2A-1 focus order in the stacked composition; Q-S2A-2 the strip's height with the longest words; Q-S2A-3 typing the 429 and no-POST refusals first in R1 (§11). |
| Next | R1 and R2 (separate repair PRs by their owners), then S3. |

## 1. Branch, HEAD and preamble

- `git fetch origin` ran first. `origin/main` was `1d6d5d4a` (the merge of S1, PR #974), the branch's base, and the tree was clean.
- `origin/main` moved during the build to `17947fdd`: PR #975 (BaggerBomb thresholds blockers) and PR #976 (research modal wiring), 26 files, none in the hub. One touches S2a's ground: `src/services/agentDeploy.js` gained a stock-admission retry time near its top, which moved the lines S2a's fixture labels had cited. `main` was merged at `754d0c9b` (through the app's sync) before the final checks, and `a40d5375` makes the labels name each shape instead of its line. The final checks ran on that merged tree.
- Local branch `claude/command-center-hub-s2a-8f0cca` (the desktop app's worktree name), pushed as the prompt's `claude/command-center-hub-s2a`.
- Commits:

| Commit | What |
|---|---|
| `db5a2fd6` | Q1: Deploy above the area panel in `STACKED_ORDER`, and the rows that pin the order (R-S2A-1) |
| `890f53b0` | The selectors, the vocabulary, the reducer, the display table and copy, the hub wiring, the fixtures, the guards and the theme registrations |
| `212372d3` | The strip's two lines wrap in full (S1 review L3-13, after measurement) |
| `e507ee5b` | Pre-review tightening: a typed `orphaned` outcome moves the epoch; a stale block reaches the strip; one row renamed — **the commit lenses A1–A4 reviewed** |
| `65ec600b` | The fix round for A1–A4 and their refuters — **the commit A5 reviewed** |
| `801120cf` | The test-integrity fix round for A5 and its refuter (tests and guards only) |
| `754d0c9b` | `origin/main` (`17947fdd`) merged |
| `a40d5375` | The fixture labels name the service's shapes, not its lines — **the code head** |
| (the report commit) | This report and its README row |

## 2. Starting check (BUILD_RULES §3)

Every anchor below was read in this session at `1d6d5d4a` (VERIFIED).

| Seam | At `1d6d5d4a` | Status |
|---|---|---|
| S1's `deploy` prop | `src/components/CommandCenter/hub/hubModel.js:20` `{ displayState, canStart, reason? }`; `:31` `HUB_S1_SECTIONS` | VERIFIED; replaced by the selector's result |
| Display table | `hub/deployDisplay.js:24` six states; `:28` an unknown state fails closed to `checking` | VERIFIED; extended, still fail-closed |
| Stacked order | `hub/composition.js:116` `STACKED_ORDER` | VERIFIED; Q1 |
| Copy and its guard | `hub/hubCopy.js`; `hubCopy.guard.test.js` (AST scan, numbers row 1.3 and 10, banned claims) | VERIFIED; S2a's words obey it |
| Mount guard | `commandCenterHub.mount.guard.test.js`: the permitted terminals list is exact, the hub-side activity and URL scans walk the whole directory | VERIFIED; three terminals added (§5) |
| Retained gate | `src/utils/commandCenterLiveBattles.js:152-168` `deriveDeployGate({ liveBattles, agent, concurrencyEnabled })`; `:121` `sortLiveBattles`; `:136` `DEPLOY_BLOCK_REASON`; flag off, `deployBlockReason` is null | VERIFIED |
| Concurrency flag | `src/config/featureFlags.js:237` `CASUAL_CLONE_CONCURRENCY_ENABLED = true`, read at render by `CommandDashboard.jsx:157` and `CommandDashboardDesktop.jsx:105` | VERIFIED |
| Ownership key | `src/App.jsx:3928` the active poll filters `agentBattles` by `ownerId == auth.currentUser.uid`, so the captured identity is the Firebase uid | VERIFIED |
| Training-clone rule | `src/constants/leagueTournament.js:392` `TRAINING_CLONE_ID_PREFIX`; the poll drops those battles (`App.jsx` ≈ :3940); casual clones stay | VERIFIED |
| Cooldown sources | `DeployCeremony.jsx:31` `DEPLOY_LOCK_MS = 120000`, `:134-139` target `lastDeployedAt + 120 s`; `api/agent/decide.js:184` and `:193` answer 429. **No Retry-After header exists** in `decide.js` or `agentDeploy.js`, so none is ever read | VERIFIED |
| Service result shapes | `src/services/agentDeploy.js`: `:35` no-agent, `:71` auth-required (both `postIssued:false`), `:133` network, `:156` non-JSON, `:175` JSON failure with the review-due line at `:172-177`, `:215` handoff, `:227` success. No typed `outcome` yet | VERIFIED; read only, nothing edited |
| Review-due code | `src/constants/hypothesisRecords.js:140-141` `DEPLOY_REFUSAL_CODE`, `DUE_DEPLOY_LINE`; the server answers it at `api/_utils/hypothesisRecords/carriage.js:298` | VERIFIED |
| Ceremony vocabulary | `useCeremonyStageMachine.js:109` phases theater / verifying / reveal / error; error tones confirmed / lost_contact (`CeremonyError.jsx`) | VERIFIED; reused as the ceremony vocabulary |

## 3. Q1 as applied (R-S2A-1)

`STACKED_ORDER` is `['next', 'stage', 'deploy', 'panel', 'games', 'activity', 'brief']` (src/components/CommandCenter/hub/composition.js:121). The rows that pin it are composition.test.js (the constant), CommandCenterHub.reviewFixes.jsdom.test.jsx (the grid template, with and without a next action) and CommandCenterHub.jsdom.test.jsx (each part's grid area at 614 px). The S1 report's measurement of this order (§9 there: the hold at 746–816 of 1000 at 614 × 1000 and 772–842 at 549 × 900) is the basis.

One consequence, recorded in the code and raised as Q-S2A-1. S1 made the three wide compositions one CSS grid so that a width change remounts nothing (S1 review L3-1). The stacked order is therefore the grid's: on screen Deploy sits above the panel, but in the DOM the panel still comes first. Keyboard focus and a screen reader meet the stage's area tabs, then the panel, then Deploy, while the eye sees Deploy before the panel.

## 4. The rulings as applied, and the builder's interpretations

- **R-S2A-2.** `translateServiceResult` (src/components/CommandCenter/hub/selectors/attemptVocabulary.js:175) accepts only the six typed outcomes. Anything else is `uncertain`, with the result attached unchanged as evidence and never an id. The 409 + `hypothesis_review_due` exception keeps `details` exactly. When the words are missing it shows the shared `DUE_DEPLOY_LINE`, which is what the server always sends.
  - Read literally, the two `postIssued:false` preflights (`no-agent`, `auth-required`) and the definitive 429 cooldown refusal also become `uncertain` until R1 types them. So does the 503 stock-admission refusal, whose player line is not shown. The user sees "Couldn't confirm the deploy" for them (Q-S2A-3).
- **R-S2A-3.** `HUB_S2A_DEPLOY_INPUTS` (src/components/CommandCenter/hub/hubModel.js:111) has no identity, no resolved reader, no attempt, hold, cooldown or clock. Read through §3.1 that would be `signed_out` (row 1) or `loading_agent` (row 5), not the `checking` the ruling names.
  - The resolution follows spec §3's own rule that loading is never resolved absence. An identity that has not resolved reads `checking` and admits nothing; only a resolved `{ signedIn: false }` is `signed_out` (src/components/CommandCenter/hub/selectors/deployState.js:157-162).
  - The agent's loading state shows the same words as `checking` ("Checking eligibility…"): eligibility cannot be known before the agent, and one line avoids a flicker of two.
- **R-S2A-4.** No smoke branch.
- **R-S2A-5.** S2a claims, charges and commits no hold.
  - The selector reads a hold `{ controlId, holdToken, holdEpoch, phase }`. A charging or locked hold denies every competing control and reads `ready` (disclosed D2).
  - `canCommit(holdToken, inputs)` exempts only that charging token at a valid epoch, then re-runs the whole table.
  - The reducer admits a request from a hold only once that hold is committed (locked), and releases it with the attempt it started. Tagging a hold with its claimer's identity was refuted as R2/S2b claim work (A1-3, A2-1).

Further decisions, each recorded in code (the brief's D1–D12):
- **Row 3 is the attempt's own words**, kept over a newly seen live game. A Retry is offered only when the request that would replace the attempt is admitted now. The §3.1 table is run again with the attempt replaced and the attempt's own committed hold released: ownership, cooldown, agent and retained gate all count, an open modal does not (Retry lives in the ceremony's overlay). Otherwise `retryBlock` says which row it would meet, and the card and strip show those words, e.g. "Next deploy at 10:43 AM ET" (fix round, A1-2/A3-2/A3-3).
- **Cooldown** (src/components/CommandCenter/hub/selectors/attemptReducer.js:88):
  - The bound is the latest of a Retry-After instant (none exists today) and a valid `lastDeployedAt + 120 s`.
  - It is keyed by captured owner and resolved target, never lowered and never fabricated.
  - A bound that names no owner applies to nobody. A known bound survives `authChanged` but never applies to another uid (D6).
  - Times are milliseconds given by the caller; the selectors hold no `Date`.
- **`firstDeploymentCandidate`** follows §3.1 literally, so it can be true on a stale clear list (D7).
- **Concurrency off.** The helper gives no reason, so a block reads "Unavailable" / "Deploy unavailable" (D8).
- **The `blocked` layout fixture** is now a stale active BaggerBomb with its live row (D9). The design's "session not eligible" block cannot come out of the retained gate.
- **Today's optimistic App entry** has no `ownerId`, so the owner filter drops it (D11; R1 adds the owner, spec §3).
- **The reducer is not imported by the hub chunk yet** (D12); S2b's provider will call it.

## 5. What S2a built, by `file:line` (at the code head `a40d5375`)

**New, all pure, under `src/components/CommandCenter/hub/selectors/`**
- `deployState.js`:
  - `ELIGIBILITY_STATES` (:47) and `ownedLiveBattles` (:77): stored `ownerId`, training clones out, casual clones in.
  - `retainedGate` (:117), computed first.
  - `deriveHubDeployState` (:152). Rows 1–2 at :157–171; row 3, the attempt with Retry readiness, then the hold, at :172–211; row 4 at :213; row 5 at :221; row 6 at :230; rows 7–8 at :239; rows 9–11 at :245.
  - `canCommit` (:262) and `firstDeploymentCandidate` (:277).
- `ownership.js`: `captureIdentity` (:38) and `isCurrent` (:56).
- `attemptVocabulary.js`:
  - The constants `ATTEMPT_PHASES`, `SERVICE_OUTCOMES`, `RECONCILIATION`, `HOLD_PHASES`, `CEREMONY_PHASES`, `ERROR_TONES`, `RESOLUTION_KINDS`, `RESULT_KINDS`, `ATTEMPT_DISPLAY`, `ATTEMPT_ACTIONS` (:35–125).
  - `realId` (:130), `translateServiceResult` (:175) and `displayForAttempt` (:231).
- `attemptReducer.js`:
  - `DEPLOY_COOLDOWN_MS` (:45), with a tripwire to `decide.js` and `DeployCeremony.jsx`; `ATTEMPT_ACTION_TYPES` (:47); `initialAttemptState` (:68); `cooldownUntilFrom` (:88); `cooldownFor` (:97).
  - The handlers: `begin` (:160), `targetResolved` (:173), `serviceResult` (:182), the reconciliation pair (:200, :206), `ceremonyPhase` (:235), `dismiss` (:244), `retry` (:270), `cooldownEvidence` (:288), `authChanged` (:312), `orphanCleaned` (:324), `flagDisabled` (:332) and `unmount` (:340).
  - `attemptReducer` itself is at :365.

**Changed in the hub**
- `hub/hubModel.js`: the selector's input contract and the reducer's action payloads (the header, :35–93), `HUB_S1_SECTIONS` without a hand-written deploy (:95), and `HUB_S2A_DEPLOY_INPUTS` (:111).
- `hub/deployDisplay.js`: `DEPLOY_DISPLAY_STATES`, the 18 states (:32); the fail-closed `known` (:69); and `deployDisplay` (:127). The latter covers the strip's two lines with the stale and refreshing notes, a withheld Retry's words, the one action per state, the in-flight and terminal control labels, the card line and the card note.
- `hub/hubCopy.js`: the 18 states' words (:186), "Battle confirmed" (:207), the freshness and stale lines (:214–218), and the ET suffix (:222). The header (:25–42) lists which words are the spec's, which are the ceremony's and which are the build's.
- `hub/hubDate.js`: `formatHubTime` (:35), an ET clock time rounded up for "next deploy at".
- `hub/composition.js`: Q1 (:121).
- `CommandCenterHub.jsx`: `HUB_S2A_DEPLOY = deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS)` (:354), the default sections (:355) and the root (:362).
- `DeployStrip.jsx`: both lines wrap (:35, :64, :66); the action button goes through `onAction(kind)`.
- `sections/DeploySection.jsx`: the line's action and the freshness note (`ActionLink` :28, :68–77).
- `__fixtures__/hubLayoutFixtures.js`: every scenario carries `deployInputs`, its battle documents included, and its deploy is the selector's result.

**New test files:** `hub/selectors/deployState.test.js`, `ownership.test.js`, `attemptVocabulary.test.js`, `attemptReducer.test.js`, `selectors.purity.guard.test.js`; `CommandCenterHub.s2a.jsdom.test.jsx`; and the fixtures `__fixtures__/deployStateFixtures.js` and `attemptFixtures.js`.

**Extended:**
- `hub/deployDisplay.test.js`, rewritten for the vocabulary. S1's row that kept `existing` and `uncertain` out of the display keys is revised, because §5.2 uses both as display words.
- `hub/composition.test.js`, `hub/hubDate.test.js`, `CommandCenterHub.jsdom.test.jsx` and `.reviewFixes.jsdom.test.jsx` (Q1).
- `hubCopy.guard.test.js`: `reason` is a copy property, and the selectors hold no phrases.
- `commandCenterHub.mount.guard.test.js`: three permitted terminals (`commandCenterLiveBattles.js`, `leagueTournament.js`, `hypothesisRecords.js`, each already in the main graph) and a selectors row.
- `CommandCenterHubGate.chunk.jsdom.test.jsx`: the first-evaluation wait, see A4-1.
- The theme guards and their baselines register the six new files.

**Outside the hub directory:** only `src/theme/tokens.guard.test.js`, `motion.guard.test.js`, `tokenGuardBaseline.json` and `motionGuardBaseline.json` (registrations). Nothing under `src/services/`, `api/`, `src/config/`, `src/App.jsx` or any fenced file.

## 6. The contract S3 and S2b build to

The selector's inputs (src/components/CommandCenter/hub/hubModel.js:35–93). Every time is in ms since the epoch. Every reader result names the owner and auth epoch it was read for; `ownerUid: null` means "not resolved", never an account change.

| Input | Shape | Supplied by |
|---|---|---|
| `auth` | `null` (not resolved: reads checking) · `{ signedIn: false }` · `{ signedIn: true, uid, authEpoch }`, where `authEpoch` goes up by 1 on every identity change, A→B→A included | S2b (the reducer's `authUid`/`authEpoch`) |
| `agent` | `{ status: 'loading'\|'ready'\|'error', agent: null \| the ranked agent doc (its `stats.gamesPlayed` is read for the first deployment), ownerUid, ownerEpoch, error }` | S3 |
| `poll` | `{ status` of the CURRENT request, `liveBattles`: the RETAINED successful list of battle docs (`ownerId`, `agentId`, `groupId`, `status`), or null before any success, `ownerUid`, `ownerEpoch` of that list, `lastSuccessfulAt`, `error`, `refreshing }` | S3 (voided-group battles already dropped by the poll) |
| `completed` | `{ status, rows, ownerUid, ownerEpoch }`, read for the first-deployment candidate only | S3 |
| `attempt` | the provider record (attemptVocabulary.js), or null | S2b (reducer state) |
| `hold` | `{ controlId, holdToken, holdEpoch, phase: 'idle'\|'charging'\|'locked' }` or null; a hold with no valid epoch commits nothing | S2b / R2 |
| `cooldown` | `{ ownerUid, targetAgentId, cooldownUntil }` from `cooldownFor(state, owner, resolvedTarget)`, or null; a bound naming no owner applies to nobody | S2b |
| `now` | the clock, used for the cooldown only; with no clock, a bound holds | S2b |
| `concurrencyEnabled` | `CASUAL_CLONE_CONCURRENCY_ENABLED` as the shells read it at render; anything but `true` is the legacy any-live gate | S3 |
| `modalOpen` | a sheet, the Forge or the ceremony is open: no control may start, the words do not change | S2b |

The reducer's actions carry their own payloads (`hubModel.js` lists them): `begin`, `targetResolved`, `serviceResult` (the service result as returned), `reconciliationPending`, `reconciliationResult` (`{ status: found\|clear\|error, battle?: { id, ownerId }, admitted? }` from the target-scoped verifier), `ceremonyPhase`, `dismiss`, `retry` (a tap: no token), `cooldownEvidence`, `authChanged`, `orphanCleaned` (with the orphan's `attemptEpoch`), `flagDisabled` and `unmount`.

**Before dispatching `begin` or `retry`, the provider asks the selector:** `canCommit` for a hold, `canStart` for a tap, and the `retry` action for a Retry. The selector runs the §3.1 table with every reader, the cooldown included. The reducer re-checks only what it holds itself: the guard, the hold, and a Retry's cooldown. **`begin` reads no cooldown** (A3-4, recorded for S2b).

## 7. Checks

| Check | Command / place | Result |
|---|---|---|
| The selectors | `hub/selectors/*.test.js`: one row per §3.1 row, precedence, C1 by name, gate parity, canCommit, the first deployment, ownership and C2 by name, the §5.2 translation (every typed outcome, every `agentDeploy.js` shape), the reducer's every action and the C3 sequences by name, purity and display guards | deployState 124, ownership 29, attemptVocabulary 79, attemptReducer 82, purity guard 8 — 322 / 322 |
| The display and the wiring | `hub/deployDisplay.test.js` 61, `CommandCenterHub.s2a.jsdom.test.jsx` 30, `hub/hubDate.test.js` 13, `hub/composition.test.js` 36, `commandCenterHub.mount.guard.test.js` 41, `hubCopy.guard.test.js` 13, the chunk test 3 | all green |
| All hub test files | `npx vitest run src/components/CommandCenter` (Windows, merged head) | 777 / 777 in 22 files |
| Headless Edge, the strip | Every display state, with a short and a long watchlist name, at 360 and 390 px, on the final display code (below) | 124 rows: 0 clipped, 0 horizontal overflow; strip 63–117 px at 360, 63–100 px at 390 |
| `vite build` | Linux, merged head `a40d5375`; and the LF archive of the pushed report head before the push (result in the PR description) | Exit 0. 4,002 modules transformed; `CommandCenterHub-XuRzsniH.js` 67.58 kB (gzip 20.23 kB); entry `index-*.js` 4,773.80 kB; 0 `modulepreload`, no hub reference in `index.html` |
| `lint:gate` | Linux, merged head | Exit 0 |
| Full suite, Linux CI shape | WSL Ubuntu, private clone, Node 20.20.2, `TZ=UTC`, `vitest run --maxWorkers=2` | Exit 0 at `a40d5375`: `Test Files 1017 passed \| 7 skipped (1024)`, 22,093 passed, 88 skipped, 0 failed |

**The strip, measured (headless Edge, playwright-core, device scale 1).** With S1's two-line clamp, four kinds of line clipped:
- the block reason with no live row (3–4 lines);
- the block reason behind a live game at 360 (3 lines);
- a long watchlist beside a ranked game at 360 (3 lines);
- the review-due refusal (3–4 lines).

Both lines now wrap. The page's clearance follows the strip's measured height (S1's `useNavClearance`). Tallest cases at 360:

| State | Height |
|---|---|
| block reason, no live row, long watchlist or stale | 117 px |
| block reason, no live row | 103 px |
| review-due refusal | 95 px |
| block reason beside a live game | 81 px |

Most states stay at S1's 63–69 px. A block with no live row needs the Games reader and the poll to disagree, which S3 can avoid by feeding Games from the same poll (Q-S2A-2).

**Windows-only notes (not S2a defects).**
- `src/config/shadowCpuQuoteIntegrityFlags.test.js` "registers it as dark by design" fails on a CRLF checkout. It is a pre-existing line-ending row and passes on Linux.
- Under heavy parallel load (the reviewers' builds alongside), S1's mount-guard row "the main graph reaches the hub directory only through App → …" (1.7 s alone; it reads every `src` file) and `src/config/backingBetaFlags.test.js` timed out at vitest's 5 s default. Each passes alone.

## 8. The BUILD_RULES §2 review record

The threshold is met on both measures: against the merged `main` the code head changes 33 files (12 added, 21 modified) and adds 4,436 lines; this report and its README row make 35.

### 8.1 How it ran

- **Isolation.** Each reviewer and each refuter worked on its own `git -c core.autocrlf=false archive` extraction with `node_modules` junctioned. Each was read-only on git and on the working tree and returned text only. The briefs (`BRIEF.md` with D1–D12, the prompt, the diffs, each lens's findings for its refuter) sat in a shared read-only folder.
- **Order.** A1–A4 ran in parallel on `e507ee5b`, and each lens's findings went to a separate refuter on a fresh snapshot. The fix round followed the refuters' rulings, including where they narrowed or refuted a proposed fix (`65ec600b`). A5, the mutating lens, ran last on `65ec600b`, then its refuter on a fresh snapshot; that fix round is `801120cf`.
- **Ids.** Review ids are A1-n … A5-n, so they do not collide with S1's L1-n … L5-n, which code comments cite.

### 8.2 Findings and dispositions, A1–A4

Verdicts are the refuters'. "Fixed" names the commit; every fix has a row.

| ID | Finding (short) | Lens sev. | Refuter | Disposition |
|---|---|---|---|---|
| A1-1 | The strip dropped §3.1 rows 9–10's stale and refreshing notes; on the phone the strip is the only deploy surface | MINOR | CONFIRMED (narrower fix: no Retry on the strip) | FIXED `65ec600b`: line 2 carries "Couldn't refresh" alone, "As of {t} · couldn't refresh" beside a live game, "Refreshing · as of {t}"; the read's Retry stays on the card |
| A1-2 | Retry offered while the owner + target cooldown still applies; the reducer then refuses it silently | MINOR | CONFIRMED | FIXED: Retry readiness and `retryBlock` with its words |
| A1-3 | A hold carries no owner, so a leftover hold could read "ready" | MINOR | PARTLY (premise refuted: `authChanged` empties the slot in the same step; tagging is R2/S2b claim work) | ACCEPTED as D2; no tagging |
| A1-4 | The card kept "Hold to deploy" through failed / existing / uncertain | MINOR | CONFIRMED (fix: label the control with the phase rather than drop it) | FIXED: the control reports the phase |
| A1-5 | `canCommit` accepted a null `holdEpoch` | NIT | CONFIRMED | FIXED |
| A1-6 | The C2 boundary rows were labels on two calls; no by-name list | NIT | PARTLY | FIXED: per-boundary staleness rows, `C2_CASES` by name with checked cross-references and deferrals |
| A1-7 | The C3 "inherits neither countdown nor guard" sequence had no A attempt | NIT | CONFIRMED | FIXED |
| A1-8 | A read's Retry should name its reader | NIT | REFUTED (no spec text; every `retryRead` comes with a non-null `retryAction`) | No change |
| A2-1 | The hold has no owner or epoch; `canCommit` accepts a null epoch | MINOR | PARTLY (only the null epoch holds) | FIXED (epoch); ownership refuted |
| A2-2 | A found reconciliation does not check training clones or the target | MINOR | REFUTED (the shipped verifier is target-scoped: `agentBattleVerify.js:97-108`) | No change |
| A2-3 | A typed `orphaned` outcome left a locked hold stranded | MINOR | CONFIRMED (latent) | FIXED |
| A2-4 | `orphanCleaned` matched by id alone | MINOR | PARTLY (needs two caller mistakes) → NIT | FIXED: it carries the orphan's epoch |
| A2-5 | An ownerless cooldown applied to whoever is signed in | MINOR | PARTLY (unreachable from the reducer) → NIT | FIXED: it applies to nobody |
| A2-6 | Evidence patched an old-epoch orphan's `cooldownUntil` | NIT | PARTLY (only the test gap) | FIXED with rows |
| A2-7 | = A1-6 | NIT | PARTLY | FIXED with A1-6 |
| A2-8 | No transition for a missing or foreign existing document | NIT | REFUTED (the Open action's read, §5.4; S2b) | S2b carry list |
| A3-1 | Retry refused the attempt's own committed hold unless the spent token was passed again | MAJOR | CONFIRMED, downgraded to MINOR (latent) | FIXED: a Retry is a tap, the locked hold is released with the terminal, only a charging hold blocks |
| A3-2 | = A1-2 (the refused path) | MINOR | CONFIRMED | FIXED |
| A3-3 | Nothing rechecked readiness for a Retry | MINOR | CONFIRMED | FIXED (the same predicate) |
| A3-4 | `begin` reads no cooldown, `retry` does | MINOR | PARTLY → NIT (the prompt's begin row names none; a begin-time check misses the unresolved clone target) | Recorded for S2b, with a row stating it |
| A3-5 | = A2-3 | MINOR | CONFIRMED → NIT | FIXED |
| A3-6 | A charging (uncommitted) hold's token was admitted by `begin` | MINOR | CONFIRMED | FIXED: only a locked hold |
| A3-7 | A committed hold was stuck under `flagDisabled` | MINOR | CONFIRMED → NIT | FIXED: the committed request still starts (option A) |
| A3-8 | Accepted no-ops returned new objects | NIT | CONFIRMED (optional) | FIXED |
| A3-9 | Implausible cooldown evidence pins a bound for the provider's life | NIT | CONFIRMED | Recorded for S3's timestamp conversion |
| A3-10 | = A2-4 | NIT | CONFIRMED | FIXED |
| A3-11 | Evidence is held by reference, unfrozen | NIT | CONFIRMED | ACCEPTED (display never reads it; a deep clone could fail) |
| A3-12 | The selector has no flag input | NIT | PARTLY (moot with the flag off) | S2b carry list (a dead Retry on §4's root surface) |
| A4-1 | The chunk test's wait comment and D10 misattributed the slowdown | MINOR | PARTLY (S2a does add 7 modules, ~149 KB; S1's bound did not flake in 27 runs; the labels were nominal) | FIXED: comment states the measured numbers |
| A4-2 | The entry grows by 38 B | NIT | CONFIRMED, cause corrected (19 B de-specialised gate + 19 B two entry exports) | Recorded here |
| A4-3 | The guard comment named the wrong path for `hypothesisRecords` | NIT | CONFIRMED, path corrected (App → the Command dashboards → `agentDeploy`) | FIXED |
| A4R-1 | (refuter's) 5 other lazy chunks get new export alias letters | NIT | — | Recorded: cache churn only, sizes equal |

The reducer lens (A3) also ran a property probe: 2 modes × 10,000 random sequences × 60 steps, about 1.2 million reducer steps. It checked epochs, the guard, phases, freezing, the cooldown and its key, hold paths, and the cross-check with the selector, and found zero violations. Its own planted mutants were each killed.

### 8.3 The mutating lens (A5) and its refuter

A5 ran on `65ec600b`: **257 mutants, 211 killed, 46 survived**, and **27 guard plants, 14 red**. Its refuter re-applied every survivor and wrote each proposed row as a probe: 69 probes, all green on the code and red on their mutants. It also showed that six survivors A5 had called equivalent are not, and that two are equivalent only through the selector.

| ID | Finding (short) | Lens sev. | Refuter | Disposition (`801120cf`) |
|---|---|---|---|---|
| A5-1 | The evidence-epoch row could not fail | MINOR | CONFIRMED | Row |
| A5-2 | "Agent loading beats a block" had no live battle | MINOR | CONFIRMED (with the faithful DS-59b) | Fixture rows split; precedence row added |
| A5-3 | Review-due fixtures used the fallback line, so "verbatim" couldn't be told apart | MINOR | CONFIRMED (latent) | Rows with the server's own and padded words |
| A5-4 | The completed read's owner was unpinned | MINOR | PARTLY → NIT | Row |
| A5-5 | An unknown poll status had no row | MINOR | CONFIRMED → NIT | Row |
| A5-6 | The hold's control and token compares were unpinned | MINOR | CONFIRMED | Rows |
| A5-7 | The handoff forms were unpinned | MINOR | PARTLY → NIT | Rows |
| A5-8 | The display guard missed `includes`, aliases, computed and lookup forms, and display constants | MINOR | PARTLY (keep the ceremony action's own `action.phase`; tables only with display keys) | Guard extended, plants in its self-test |
| A5-9 | The copy guard missed `reason:` and a returned phrase | MINOR | PARTLY | `reason` is copy; the selectors hold no phrases |
| A5-10 | The hold gate with a handler was untested on the card and strip | MINOR | CONFIRMED (latent) | Row with `onDeploy` |
| A5-11 | The orphan patch guard was unpinned | NIT | CONFIRMED | Row |
| A5-12 | The no-time fallbacks were unpinned | NIT | CONFIRMED | Rows |
| A5-13 | Three selector outputs were unpinned | NIT | CONFIRMED | Rows |
| A5-14 | Five record-level rules had no row (one, AR-57, MINOR on §5.4) | NIT | CONFIRMED | Rows |
| A5-15 | Dots, an icon and two build words were unpinned | NIT | CONFIRMED | Rows |
| A5-16 | The purity scan missed Intl, `Function`, `Promise`, computed `Math.random` | NIT | CONFIRMED | Banned, plants in its self-test |
| A5-17 | Rows that could not fail, or only on text | NIT | PARTLY (the determinism row can fail) | Reworded or kept; recorded |
| A5-18 | S1's L3-10 rows flake the 5 s default | NIT | REFUTED (0.28–0.57 s alone; a load artifact) | No change |

**The not-equivalent survivors**, now pinned:
- DS-23: `holdControlId` for a non-string control.
- DS-47: the first deployment with no poll.
- AV-29: a creation's error tone.
- AV-30: an orphan's `postIssued`.
- DD-16: the confirmed control's phase label on the strip.
- DD-29: a `ready_stale` retry block.
- AR-61 (b and c): ownerless evidence, and an empty uid.
- SE-01 / ST-05: the hold with a handler.

**Truly equivalent** (no row possible): AR-19, AR-20, AR-42, AR-44, OW-08 and HB-03, plus LF-03 on current data. For AR-19 and AR-20 the refuter ran a depth-5 exhaustive search: 34,753 reachable states and 1.52 million action comparisons, and proved an invariant beyond that depth.

### 8.4 Mutation records

| Round | At | Mutants | Result |
|---|---|---|---|
| Builder | `e507ee5b` | 12 on the core rules: Q1, row order, the 409 exception, `success:true`, the begin guard, the result's ownership check, the flag, the auth epoch, the first deployment, `ready_stale`, dismissed uncertainty, the retry cooldown | 12 / 12 killed, each by its own row |
| A3 (lens) | `e507ee5b` | 6 planted against its property probe | 6 / 6 killed |
| A5 (lens) | `65ec600b` | 257 behaviour mutants; 27 guard plants | 211 killed, 46 survived; 14 red, 13 green |
| A5 (refuter) | `65ec600b` | 32 survivors re-applied, 22 equivalence and reconstruction mutants, 18 spot-checks of kills | Survivors confirmed; 6 not equivalent; 18 / 18 spot-checks killed by rows stating the rule |
| Re-run | `801120cf` | A5's 32 row-needed survivors (with the refuter's faithful DS-59b), the 9 not-equivalent ones, and 5 mutants of the new guard checks — 46 in all | **46 / 46 killed**, each by one named row |

## 9. Accepted items and notes for later slices

- **Accepted in S2a:**
  - A3-11: evidence is held by reference.
  - D2: a hold reads `ready` whatever it would otherwise show. Reversing it is a founder choice.
  - D7: the first-deployment candidate on stale clear data.
  - D8: "Unavailable" with concurrency off.
  - The entry's 38 B and the alias churn in five lazy chunks (A4-2, A4R-1).
- **For R1** (typed service outcomes):
  - Type the legacy results the translator now reads as `uncertain`: `no-agent` and `auth-required` as `refused` with `postIssued:false`, the 429 cooldown as `refused` (with any Retry-After), the 503 stock-admission refusal as `refused` with its line, the handoff as `handoff_failed` with `battleId`, the existing battle as `existing_battle` with `existingBattleId`.
  - Give App's optimistic entry its `ownerId`.
- **For R2 / S2b** (the hold):
  - Tag the hold with its claimer's identity at claim if that is wanted (A1-3, A2-1: refuted as S2a work).
  - Revoke a charging hold on owner or epoch loss.
  - `canCommit` is the threshold recheck.
- **For S2b** (the provider):
  - Call `canStart`/`canCommit` and the selector's `retry` action before `begin`/`retry`; `begin` reads no cooldown (A3-4).
  - Dispatch `orphanCleaned` with the orphan's epoch, and `authChanged` on every identity change.
  - The existing battle's owned-document read and its "unavailable / retry" belong to the Open action (A2-8).
  - The ceremony bridge reads `attempt.errorTone`.
  - With a runtime disable, §4's minimal root surface must not offer a Retry the reducer refuses (A3-12).
- **For S3** (the readers):
  - Tag every result with `ownerUid` / `ownerEpoch`; the poll's retained list carries its own.
  - Convert `lastDeployedAt` to ms with a plausibility bound (A3-9).
  - Decide whether a background poll sets `refreshing`: the strip's line 2 shows "Refreshing · as of {t}" whenever it does.
  - Feed Games from the same poll the gate reads, so a block always has its live row (Q-S2A-2).
- **Process note:** under heavy parallel load on Windows, S1's mount-guard src walk can exceed vitest's 5 s default (§7).

## 10. Files outside the repository

The report's copy, byte-identical to this file: `C:\Users\fashr\Documents\FantasyTrades\CommandCenter\20261016_BUILD_COMMAND_CENTER_HUB_S2A.md` (its sha256 is in the PR description). The review briefs, each lens's findings, the mutation specs and their results, and the strip measurement output are in this session's scratchpad (`review-brief/`, `mutants-*.json`, `measure-snap/measure-final.txt`).

## 11. Founder questions

None blocks S2a: the flag is dark, the deploy state reads `checking`, and no action is wired.

**Q-S2A-1 — focus order in the stacked composition.**
- R-S2A-1 moved Deploy above the area panel. S1's one grid (S1 review L3-1) moves it on screen only, so keyboard focus and screen readers still meet the panel before Deploy in the stacked composition (desktop sites narrower than 700 px).
- Moving Deploy in the DOM too would remount the Deploy card when the hub crosses 700 px within the desktop site. A charging hold there would cancel.
- **Asked:** keep the visual-only order, or reorder the DOM for stacked and accept the remount at that boundary?

**Q-S2A-2 — the strip's height with the longest words.**
- The strip's lines now wrap instead of clipping. The longest S2a lines make it taller than S1's 63–69 px: 117 px at 360 for a block with no live row, 95 px for the review-due refusal.
- **Asked:** accept the taller strip, or shorten what the strip says in those two cases? For example, "Unavailable" with the reason on the Loadout tab, or "Deployment failed" with "Open in the Forge" only. That is a design call.

**Q-S2A-3 — typing the legacy refusals first in R1.**
- Under R-S2A-2 the 429 cooldown refusal, the two no-POST preflights and the 503 stock-admission refusal read "Couldn't confirm the deploy" with Check deployment, although each is definitive.
- **Asked:** should R1 type these first (refused, with `postIssued` and any Retry-After), so that the hub shows "Deployment failed" with the server's words?

## 12. Next

R1 (typed service outcomes, App handoff ownership, the existing-battle ceremony terminal) and R2 (hold claim and atomic commitment, charging cancellation on hidden, blur and capture loss) are separate repair PRs by their owners, built to the vocabulary S2a commits. Then S3: the games and completed readers, outcomes and the Film Room coordinator. S5, S6 and S7 depend only on S1 and may run alongside. S2b waits for reviewed R1 and R2.
