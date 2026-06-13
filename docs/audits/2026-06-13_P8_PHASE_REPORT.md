# P8 — Integration Sweep · Hygiene Ledger · Catalog #9: Phase Report

**Phase:** P8 (Spec §4 — integration pass + signal-capture verification). **No new product.**
**Branch:** `claude/sharp-clarke-lztgcb` · cut from `main` @ `9e05b51` (post-P7-B+C, PR #501) · **PR #502.**
**Date:** 2026-06-13.
**Stage 0 artifact:** `docs/audits/2026-06-13_P8_STAGE0_SWEEP_REPORT.md` (the read-only seam map + ledger triage delivered at the HARD STOP).
**Founder rulings at the STOP (all honored):** Catalog #9 = **tag-only**, **groupId-only** (bracketGameId/roundNumber NOT stamped at deploy — fence contact; recovered downstream via the groupId→group-doc join); item 1 = **correct the double-negation + test**; items 3/4/6 = **document-and-watch**; item 5 = **converge** (server); the V4-training short bug = **separate ticket** (out of scope).
**Commits:** 5 (item 1 · toIso converge · Catalog #9 · docs · code-review clarity), signed, suite green.

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | Do the eight phases compose? Any seam mismatch? | **NO MISMATCH** — all 11 handoffs agree field-for-field; the `gameMode` alias (the one risk point) is test-locked. |
| 2 | Item 1 short double-negation fixed? | **YES** — scorer called without `direction` (`AgentBattleScreen.jsx:626`); byte-identical long path; locked by `agentBattleScoring.test.js`. |
| 3 | Catalog #9 built per ruling? | **YES** — `groupId` field-spread on the awaited `chatExchanges` write (`chat.js:445`), tournament-only; never the `:418` shadow log; zero extra reads. |
| 4 | Item 5 converged? | **YES** — four private `toIso` copies → `tournamentTime.toIso`; no cycle. |
| 5 | Items 2/3/4/6 dispositioned? | **YES** — document-and-watch in `docs/LAUNCH_READINESS_WATCH_LEDGER.md`. |
| 6 | Zero fence / zero cron / zero new rules? | **YES** — 38/40 cron; no `firestore.rules` change; no fenced file edited (scorer & createAgentBattle untouched). |
| 7 | Flag stays false? | **YES** — `TOURNAMENT_TAB_ENABLED` still false (P9 flips it). |
| 8 | `/code-review` at max effort? | **RUN** — 2 finder passes + verify + sweep; 0 correctness defects in the diff; 1 clarity finding applied. |
| 9 | Tests | **2737 pass** (2726 + 11 new); client build clean. |
| 10 | Lint | Delta = none on touched lines (the AgentBattleScreen baseline classes — `motion`/unused vars/exhaustive-deps — are pre-existing, untouched lines). |

## 2. What the founder should know in three sentences

The League is genuinely one system, not eight tested islands: every Monday-to-champion handoff was traced and the field each writer writes is the field its reader reads, with the single riskiest seam (the tournament game-mode string) proven to be one shared, test-locked constant — so P9's flip can be a confident one. The one real correctness fix — a dormant short-scoring sign-flip on the live agent-battle screen — is corrected with a test that proves the long path (the only one live today) is untouched, and the ninth signal-capture event now tags each tournament Film Room exchange with its group, riding the durable write exactly as the rider demands. Everything else was either verified safe and written into a launch-readiness watch list that P9 inherits, or — in the case of the same short bug living in the shipped *training* game where players can actually short — split out as its own ticket because it isn't a tournament item.

## 3. The integration sweep (the deliverable)

Traced as one weekly trace; **no producer/consumer mismatch found.** Detail + file:line on both sides of each seam: `docs/audits/2026-06-13_P8_STAGE0_SWEEP_REPORT.md` §1. Highlights:
- **gameMode chain (the risk point):** orchestrator `buildDeployRequest` sends `TOURNAMENT_GAME_MODE`; `decide.js:195` routes on `FLAT6_GAME_MODE`; `createAgentBattle` stamps it; banking/reconcile/incumbent filter on it. `agentGameModes.js:37` aliases the two to one string; test-locked (`agentGameModes.test.js:29`, `leagueTournament.test.js:125`).
- **Composite chain:** banking writes `closeScores[uid].{totalPoints,agentPoints,compositePoints,agentScoresCarried}`; `getWeeklyScore`/`getWeeklyComposite`/`isFinalSnapshotDegraded` read exactly those.
- **Advancement chain:** `lockTopTwo` → bracket `finalScores`(composite)+`finalUserScores` → `applyLockedGameToRanks` + `resolveRoundBoundary`; side-effects gated on `sideEffectsAt`.
- **Flag-flip blast radius / dev-prod boundary / idempotency:** mapped; the only P9 flip is the client flag, the dev `isDev` exclusion holds at every duty, and the banking→advancement deferral coupling composes.

## 4. What shipped (file:line)

- **Item 1** — `src/screens/AgentBattleScreen.jsx:626` (`{ ...asset, baseATR, tier, direction: undefined }`) + `src/utils/agentBattleScoring.test.js` (new, 9 tests).
- **Item 5** — `import { toIso } from './tournamentTime.js'` in `tournamentAgentBoards.js`, `tournamentAgentDraft.js`, `tournamentAgentLedger.js`, `tournamentBoardAutoCommit.js`; local copies removed.
- **Catalog #9** — `api/agent/chat.js:451` (the `groupId` field-spread) + `api/agent/chat.test.js` (2 tests) + `import { TOURNAMENT_GAME_MODE }`.
- **Docs** — `docs/LAUNCH_READINESS_WATCH_LEDGER.md` (new, the P9 watch list) + `docs/audits/2026-06-13_P8_STAGE0_SWEEP_REPORT.md` + this report.

## 5. /code-review (max effort) — findings + dispositions

Two independent finder passes (correctness; cross-file/import-cycle/test-quality), verify, sweep. **Zero correctness defects in the diff.** Verified clean: long-path byte-identity, `direction: undefined` harmless (scorer reads it only at `baggerBombUtils.js:539`; the enrichAsset return spreads the original `asset`), the corrected short sign + direction-adjusted `history`, no import cycle (`tournamentTime`→`marketSchedule`, both self-contained), `leagueTournament.js` Node-clean for the `chat.js` import, `chatExchanges` readers tolerate the optional field, tests non-vacuous.
- **Applied (clarity):** the item-1 test/comment wording implied `BaggerBombTrainingBattleViewV4.jsx` was corrected here — reworded to state it is NOT (separate ticket); trimmed a trailing blank line. Comment/cosmetic only.

## 6. Guardrails / deploy status (house shape)

- **Cron:** none added — **38/40.**
- **Firestore rules:** **none added/changed → no Console deploy required by this PR.** (P9's separate gate: *deploy the existing* tournament rules blocks before flipping the flag — watch-ledger 🚩 G1.)
- **Index / sharding:** none landed; my-group composite index + leaderboard sharding are documented-and-watched with triggers (a Console index deploy is flagged *for when triggered*).
- **Fence:** zero contact — `calculateAssetScoreV3` called not copied; no fenced file edited; `createAgentBattle` doc shape untouched (the reason #9 is groupId-only).
- **Flag:** `TOURNAMENT_TAB_ENABLED` stays **false**.
- **Pushed ≠ deployed:** Vercel preview is the smoke surface; crons don't run on preview (tournament branches are unit/integration-covered + first-production-run observation).

## 7. Out of scope (separate ticket — founder-opened)

`BaggerBombTrainingBattleViewV4.jsx:396-420` carries the same double-negation as item 1, and there users can short crypto → a potential live sign-flip in the shipped training game. Not a tournament item; tracked as watch-ledger **X1**. Same fix shape (call the scorer without `direction`) once reachability is verified.

## 8. The security-pass agenda P9 inherits (enumerated, not executed)

In `docs/LAUNCH_READINESS_WATCH_LEDGER.md`: 🚩 the rules deploy gate; claim-window/cap server enforcement; the WHY allowlist projection; the client mutation callers + deploy auth; the known best-effort gaps. P9 owns the consolidated security pass.

## 9. Status

P8 complete at merge. **Remaining: P9** — flag flip + launch checklist + 5-days-clean reconciliation + the consolidated security pass, all citing the watch ledger.
