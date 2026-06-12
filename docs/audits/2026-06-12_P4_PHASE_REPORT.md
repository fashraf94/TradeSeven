# P4 — THE FENCE ENTRY: Phase Report

**Phase:** P4 — §7 engine parameterization (Spec §1.4; the build's only sanctioned fence entry)
**Branch:** `claude/gifted-turing-ysj2e3` · cut from `main` @ `5b03257` (= origin/main)
**Date:** June 12, 2026
**Stage 0 artifact:** `P4_STAGE0_FENCE_EDIT_MAP.md` (founder-approved verbatim: map as written, zero-delta calibration table signed, two-stage smoke choreography approved, D1–D12 as recommended; one scope addition — the null-opponent disposition in companion (b), executed and tested).

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | All 7 contract items landed? | YES — one coherent commit per slice, battery green at every commit (§3). |
| 2 | Tiered-mode invariant held? | YES, continuously proven — the Commit-1 battery (photographs of untouched fence behavior) passed unchanged at every subsequent commit; the only re-pinned snapshot (enrichPortfolio source) carries a behavioral photograph as its identity proof. |
| 3 | Gate flipped safely? | YES — same PR as the prescribed entry path; dev-group exclusion (companion a) keeps the production orchestrator off smoke groups. |
| 4 | Founder's null-opponent addition? | EXECUTED — `resolveCompletionDisposition` (pure, exported, behaviorally tested): tournament battles complete with `result: null`, no stats mutation, `completionContext: 'tournament_group_scored'`; no path throws on `opponent: null`. |
| 5 | Zero new cron entries? | YES — 38/40 untouched. |
| 6 | /code-review (mandatory, max effort)? | RUN — findings + dispositions in §6. |
| 7 | Test state | FULL SUITE GREEN at the final commit (counts per commit in §3). |

## 2. The 7-item contract — disposition register

| # | Item | Disposition | Key anchors (at the P4 tip) |
|---|---|---|---|
| 1 | Prescribed-portfolio entry path | LANDED — `decide.js` tournament dispatch + `runPrescribedTournamentDeploy`; bad prescriptions are loud 4xx, never an improvised portfolio | `api/agent/decide.js` (dispatch after auth; the new branch) |
| 2 | flat6 mode config | LANDED — `src/constants/agentGameModes.js` (gameMode-keyed, frozen, tiered default); container = 2/2/2 slot labels; flatness = per-asset `tierMultiplier` stamp (D2/D3) | `agentGameModes.js`; `createAgentBattle` stampMode; scorer override sites |
| 3 | Deploy auth | LANDED — Bearer `CRON_SECRET` internal callers (rate-limit exempt via `skipRateLimit`), `ownerOdUserId` ownership assertion; Firebase-token + uid ownership for clients; tournament fields internal-only; legacy client attaches the token | `decide.js` auth block; `decide.auth.test.js`; `agentDeploy.js` |
| 4 | Joint `gameMode`+`groupId` stamp | LANDED — `createAgentBattle` throws on a half stamp (ruling B3); negative space asserted on tiered docs | `agentBattleService.js`; battery flat6/tiered doc photographs |
| 5 | CPU/passive marker + consumer | LANDED — `isCpu` stamped at creation; eval cron skips everything triggered after persisting scores (6th `finalizeCronState` site); CPU completion skips reflection | `agentBattleService.js`; `agent-evaluate.js` skip block; `p4Flips.test.js` |
| 6 | Sanitizer collapse | LANDED — canonical export in `agentPromptAssembly.js`; eval twin replaced by the import; port → re-export; tripwire retired with a note, zero-copy guards + behavioral battery preserved | `tournamentPromptSanitizer.{js,test.js}` |
| 7 | Scoring-constants collapse | LANDED — `agentScoring.js` re-exports the canonical `src` constants (V4-fix pattern, dependency-surface-guarded); copy census after P4: canonical + dead doc snapshot, zero live copies | `agentScoring.js` head; battery constants-equality |

Riders/companions: rider #6 deploy-time half (orchestrator payload → `agentContext.tournament`, awaited in the creation write); companions (a) dev exclusion, (b) CPU skip + null-opponent disposition, (c) client minimum-correctness, (d) client token attach + rider payload.

No-edit dispositions (recorded): `PORTFOLIO_TOOL` (no Haiku call on prescribed deploys — schema snapshot asserts unchanged); `agentPromptAssembly` deploy-prompt flat6 text (no caller until training mode); `buildFallbackPortfolio` (no tournament fallback by design); `agentRiskManager.js` (mode-awareness lives in the archetype-config resolver).

## 3. Commit log (battery state at each; hashes post committer-identity rebase — tree-identical)

| Commit | Content | Suite |
|---|---|---|
| `0d9834b` | Commit 1 — the battery (zero fence edits): 192-case scorer grid + canonical equality, flatten parity, constants equality, verbatim prompt photographs, battle-doc photograph, decide.js source tripwires, tool-schema snapshots | 2,476 green |
| `19031df` | Slice i — constants collapse + per-asset tierMultiplier override (both scorers, port contract) | 2,480 green; grid snapshot unchanged |
| `29f773f` | Slice ii — mode config, prescribed path, joint stamp, isCpu, rider #6 | 2,498 green; all photographs unchanged (enrichPortfolio source snapshot deliberately re-pinned; behavioral photograph = identity proof) |
| `1e1eb7d` | Slice iii — deploy auth + client token | 2,507 green |
| `2b00cfb` | Slice iv — sanitizer collapse | 2,507 green |
| `21e0447` | Slice v — flat6 eval-prompt variant + hftConfig resolver (zero-delta table) | 2,512 green |
| `beda224` | Final — gate flip + companions (a)(b)(c) + flat6 matrix | 2,525 green |
| `c43d413` | Code-review fixes (mode constant; flat6 CLOSED TRADES de-tiered) | 2,525 green |

## 4. The founder-signed calibration table

Zero deltas — flat6 resolves the identical per-archetype hftConfig (asserted by object reference in the Gate-1 fixtures). The `hftConfigByMode` hook exists so any future flat6 recalibration is a config entry, never code.

## 5. Gate-1 flat6 status

Fixtures green (archetype differentiation persists under flat6; override hook proven). The live `[Gate1]` probe now carries the mode tag. Live-observation checklist items 1–3/6–7 ride the smoke (Stage A/B); items 4–5 ride the first real bracket.

## 6. /code-review findings + dispositions (max effort: 9 finder angles → verification → sweep)

**Fixed in `c43d413`:**
1. `agent-evaluate.js` — `resolveCompletionDisposition` compared the hardcoded `'baggerbomb_tournament'` literal instead of the schema constant; a constant rename would have silently misclassified tournament completions as tiered W/L. Now imports `TOURNAMENT_GAME_MODE`.
2. `agentEvalPromptAssembly.js` — the CLOSED TRADES table still named tiers on flat6 battles, contradicting the flat6 system prompt ("tournament mode has NO tier multipliers"). Now mode-selected like the portfolio CSV; tiered rows byte-identical.

**Accepted costs (documented, not changed):**
3. `attachRiderSix` board reads are sequential (4/group/day) — the 20s deploy-pacing floor dwarfs the read latency; parallelizing would buy nothing real.
4. CPU battles fetch ~9 prices (6 portfolio + 3 macro) before the passivity skip — those prices ARE the scoring inputs; nothing wasted at flat6 shape (no bench/opponent/hotBench).
5. Seeder stamps `isDev` via update-after-create (2 writes) — dev-only endpoint; factories return plain literals (verified — no freeze hazard), and routing isDev through the validated factory would loosen its schema.
6. `FLAT6_TIERS` presentation copy lives in the screen rather than the mode config — the full tournament battle view is P7's; this stopgap renders honestly and dies there.
7. `includeDevGroups` explicit threading through the duty runners — deliberate: auditable at each entry point, locked by the p4Flips wiring guards.
8. The flat6 eval prompt duplicates mode-neutral sections — deliberate (Fence-Edit Map §11): byte-safety of the tiered text of record outranks DRY; both templates snapshot-locked.
9. `===` secret comparison + lowercase `authorization` assumption — matches the in-repo pattern of record (claims cron `process-draft-claims.js:523-527`); a timing-safe-compare hardening pass across ALL secret checks is flagged for separate tasking (§7.6).

**Refuted (with the disproving mechanism):**
- "hotBench swap-ins miss the flat stamp" — every swap funnels through `executeSwapServer`, which stamps from `liveData.gameMode` (all five call sites; `agentSwapExecution.js` swap-in block).
- "stampMode shares array refs between portfolio and initialPortfolio" — each call wraps a fresh `deepCopyArrayWithSector` array.
- "`options.tournament = {}` breaks downstream" — every field defaults (`|| []`) inside the spread block.
- "stale tiered rationale rides flat6 identity blocks" — the prescribed path synthesizes `lastDecision.innerMonologue` with no per-tier rationales; `agentContext` snapshots per battle.
- "CRON_SECRET captured at module load" — JS default params evaluate per call.
- "partial-state on mid-deploy throw creates duplicate battles" — semantics identical to the legacy path's documented self-heal (existing-battle check re-syncs).
- "constants re-export breaks identity consumers" — no identity consumers exist; values asserted equal.
- "isDev === true misses falsy-non-true" — only `true` is ever written; strict check is the house style (matches `isCpu`).

**Pre-existing, out of P4 scope (reported for separate tasking):** weekday catch-up silently skips when the draft stream read fails (P3b behavior); the deploy-vs-`agentDeploy` token-expiry UX nuance.

## 7. Out-of-task observations (report, don't fix — BUILD_RULES §3)

1. **Flaky test:** `api/_utils/screenStocks.test.js` › determinism › "identical input yields identical output" failed once in a full-suite run, passes consistently in isolation and on re-runs. Worth separate tasking.
2. **Pre-existing client null-slot hazard:** `AgentPortfolioStrip` pills would throw on a null tier slot (`asset.symbol` deref) — pre-P4 behavior, unreachable for flat6 docs (always 6 non-null assets); noted for completeness.
3. **Pre-existing lint debt:** 35 problems in the touched-file set, count identical before/after P4 (baseline-compared via stash).
4. **Eval user-prompt CLOSED TRADES table** still carries a Tier column for flat6 battles (slot labels, harmless); the system prompt states labels are slot names only. P7's tournament view can revisit.
5. **D12 register gap:** the P3a/P3b phase reports remain founder-workspace originals; per the docs provenance rule they must be founder-uploaded, not regenerated — committing them stays a founder action.

## 8. Smoke choreography (approved, two-stage)

As approved in the Stage-0 report §14 — Stage A on the preview deployment (seed dev bracket → Monday duty → 4 real stamped/prescribed/ledger-confirmed deploys → idempotency re-click → legacy client deploy proof → live auth matrix curls), Stage B post-merge (composite day: flip, claim, nightly banking, reconciliation verified-holders, CPU passivity, production-orchestrator inertness on the dev group), cleanup plan retiring all dev data. Preconditions: preview env carries `CRON_SECRET`, the admin secret, and `TOURNAMENT_DEPLOY_BASE_URL` → the preview URL.

## 9. PR

(PR link + fence-entry record summary added at PR creation.)
