# Build report — Close Client-Forged Proposal Data, plus the P6 Pre-Enforce Follow-ups

**Prompt:** "Build Prompt: Close Client-Forged Proposal Data, plus the P6 Pre-Enforce Follow-ups", Fable, 7 October 2026. **Session:** Claude Code, 7 October 2026, in its own worktree. **Branch:** `claude/integrity-proposal-forgery`, cut from `origin/main` at **`62d9d07e`** after `git fetch origin main` (PR #940 merged; `docs/audits/20261007_BUILD_PILOT_P6_SWAP_IDENTITY.md` present, so no STOP). The desktop app named the local branch `claude/integrity-proposal-forgery-6efbc1`; it is pushed under the prompt's name. **Fence:** none — no fenced file is edited (§0). **Decisions in force:** F1–F4 and the meeting rule (7 Oct); the Part C sign-off on PR #940 (Q1 keep provenance routing, Q2 yes to a profit-target line, Q3 confirmed, Q4 keep the beats).

---

## Executive verdict

| Question | Answer |
|---|---|
| Was the hole real? | **Yes — proven on base by a test** (§2). A player who writes `executionMode: 'copilot'` and an approved `pendingProposal` on their own battle makes the next check sell KO for AMD and file `lockedPoints: 9999`, a fake price and a fake symbol on the trade row; the following check's `bankedScore` is 9999. A planted *expired* proposal makes the cron trade a pair the agent never chose. |
| Is it closed? | **Yes** (§3). **F1:** both launch guards read one server-owned value, `LAUNCH_EXECUTION_MODE = 'autopilot'`; a planted proposal is cleared through the existing launch-guard branch and never executes. **F2:** each of the six executor calls builds its metadata from an allowlist (frozen); no value from a player-writable field reaches a trade row as a number, price, points, symbol or id — on the dormant proposal paths too, apart from four documented, pinned exceptions that only matter the day proposals return (§8 row 3). **F3:** every proposal / meeting history row the server writes carries only the server's own outcomes. The exploit test fails on head; a guard test fails CI if any executor call regresses, statically and at runtime. |
| What else did the census find? | (1) **The gameplan meeting has the same shape:** the whole `gameplanMeeting` map is player-writable, so a player can plant an "approved" meeting whose legs the cron executes — trades the agent never decided (class b). No planted *value* reaches the row or the history any more, but *which trades happen* is still the player's choice, and many legs can push old losing trades out of the score. **Your decision (§5)** — no live client can approve a meeting today, so closing it breaks nothing players use. (2) Player-writable values that **crash the check before it saves the score, freezing it through the battle's end** — filed as a separate task (§13). (3) A **pre-existing scoring bug**: a battle with more than 50 trades silently drops the oldest trades' points — filed as a separate task (§13). Nothing a player can write reaches `trades[]`, `scoreState` or `bankedScore` directly, and no live client code writes `pendingProposal`, so neither Part A STOP fired. |
| What changes for players today (`off`)? | **Only for planted or malformed records** (§9): a proposal on any battle now lapses through the launch-guard branch (before, a `copilot` battle ran it); history rows drop outcome fields a player planted, and the launch-guard row keeps only what the proposal named; a non-string or overlong preset / mode / meeting-leg text lands on a row or a feed beat as the default or capped. Every existing golden is byte-identical (§7). |
| Part C (P6 follow-ups) | **Two built, one stopped.** (1) The P6 census counts a verification on an ended battle as "enforce would refuse: battle_not_active", never as a clean match. (2) Table F V1.2: "Your profit target was set to sell [SYM], but [SYM] had already left that slot. No trade was made." — on both routes. (3) **The silent meeting-failure record is NOT built — its STOP condition holds:** after an ambiguous commit error the Admin SDK retries the transaction, and the retry can throw *after* the trade committed, so "No trade was made." could be false (§6.3, with the smallest option). The same applies to P6's own refusals at `enforce` — worth knowing before that flip. |
| Tests | Linux suite of record (CI-shaped `--maxWorkers=2`, `TZ=UTC`) at the code head `b333e8f5`: **18,969 passed, 0 failed** (19,056 rows incl. 87 skipped; exit 0). **Both flips dry-run green** (shadow and enforce: 18,969 / 0 each), and the control — the flag moved without its pin — fails exactly the pin row. The exploit test passes on base and fails on head, on Linux. `lint:gate` and `vite build`: **green** on an LF checkout of the pushed head (§11). |
| Review (BUILD_RULES §2) | Mandatory (24 files). **4 lenses — one of them the attacker — + 4 refuting verifiers + a mutation lens** (§11). 30 findings → **26 CONFIRMED, 4 PARTIAL**, none fully refuted. Two defects the build itself caused were in the **guard test** (one call site went unchecked; aliases slipped the taint trace — a probe reopened the exploit while every suite stayed green): both fixed, and the metadata object is now frozen at runtime. Two pre-existing highs → §5 and the §13 tasks. Mutation: **207 mutants, 171 caught, 12 equivalent, 24 survivors — all killed by 9 new rows.** |
| Things for you | §5 the meeting decision · §10 the questions · §4 the exact `firestore.rules` lines for the rules overhaul (F4) · §12 how to run the detection census (to learn whether anyone used the hole — run it soon: its best evidence ages out in one to two trading days). |

---

## 0. Preamble

- **Session open (BUILD_RULES §2/§3).** `git fetch origin main` first: `origin/main` = `62d9d07e` ("Merge pull request #940"). Worktree branch `claude/integrity-proposal-forgery-6efbc1` at `62d9d07e`, tree clean. Every commit staged explicit paths after re-checking the branch in the same command.
- **Commits** (`62d9d07e..`): `be3fa00c` Part A + B (the fix, the exploit and guard tests, the detection census) · `3dbce6d1` Part C (census battle status, table F V1.2) · `a6557ab2` §2 review fixes · `b333e8f5` rows that kill the mutation lens's survivors · this report.
- **Boundaries** (also checked by reviewers I2 and IV2 with `diff -rq` / `git diff --stat`). No fenced file (BUILD_RULES §1), not `firestore.rules`, not `test/rules/`, not the capture schema or serializer (`api/_utils/tickCapture/captureConfig.js`, `captureSerializer.js`), not the cockpit matcher (`api/_utils/callRecords/flip.js`, `heard.js`), no prompt module or tool schema; `SWAP_IDENTITY_MODE` is still `'off'` (`src/config/featureFlags.js:3151`); the proposal paths are neither revived nor removed. Fenced code **called**: `executeSwapServer` (`api/_utils/agentSwapExecution.js`) at its six existing sites, `buildSwapReceiptSource` (`agentRiskManager.js`), `getCurrentTradingDayServer` (`agentEvalPromptAssembly.js`, now also from `handlePendingProposal`); the guard test **reads** the fenced `closedTrade` literal. None **edited**.
- **Linux runs** used a private WSL clone (`~/pd-intg`); the shared `~/pd-amendd` was not touched. Neither census script was run against production; no credentials were loaded.
- **Citations.** `path:line` at the code head `b333e8f5` (its product code is `a6557ab2`'s; the last commit adds test rows only) unless marked *base* (`62d9d07e`). **VERIFIED** = read in this session; **ASSUMED** = taken from a read-only census helper's report and not re-read here.

---

## 1. Part A — the census of player-writable fields the cron reads

**Who can write what** (VERIFIED, `firestore.rules`): a battle's owner may update exactly `executionMode, pendingProposal, battleLedger, updatedAt, strategyPreset, gameplanMeeting, gameplanMeetingHistory, dailyGrades, feedBookmarks, reviewDecisions` (`firestore.rules:456-459`); an agent's owner may update `directives, lastViewedEvolutionCycle, starterKitCompleted, updatedAt` (`:332-335`) and create/update the agent's `rules/` and `bundles/` documents with field validation (`:351-440`). `trades`, `scoreState`, `portfolio`, `thresholdHistory`, `cronState`, `evaluations`, `proposalHistory`, `statusFeed` and `livePriceBeacon` are **not** player-writable.

**STOP checks.** (1) No player can write `trades[]`, `scoreState` or `bankedScore` — the allowlist above excludes them, and every score input is server-only; `bankedScore` is summed from `trades[].lockedPoints` (`api/cron/agent-evaluate.js:1237`, VERIFIED). **Did not fire.** (2) No live client code writes `pendingProposal`: its only writer, `resolveProposal` (`src/services/agentService.js:583-596`, VERIFIED), is called only by `ProposalCard.jsx` (imported only by `AgentStrategyTab.ARCHIVED.jsx:21`) and `ProposalBanner.jsx` (its import is commented out at `src/screens/AgentBattleScreen.jsx:106`) — both dead (VERIFIED). **Did not fire.**

Outcome classes (the prompt's): **(a)** changes a recorded trade value or the score; **(b)** causes a trade the agent did not decide or the player did not legitimately approve; **(c)** falsifies a history record. "—" = none of the three.

| # | Field | Who legitimately writes it (live client code) | What the cron does with it (base `62d9d07e`) | Worst outcome on base | After this build |
|---|---|---|---|---|---|
| 1 | `executionMode` | **Nobody live.** `updateExecutionMode` (`agentService.js:575-581`) is called only by `ExecutionModeToggle.jsx`, whose import at `AgentBattleScreen.jsx:98` is commented out (VERIFIED). Server: `'autopilot'` at creation (`agentBattleService.js:255`); the cron's migration writes **`'copilot'`** when the field is absent (`agent-evaluate.js:961`, VERIFIED) — so deleting it worked too. | The proposal handler's launch guard `if ((battle.executionMode \|\| 'autopilot') === 'autopilot')` (*base* `:4844`) — any other value opened the dormant paths. The model path forced autopilot in memory (*base* `:3439`). Stamped as `entryMode` on every trade row. Passed to prompt builders whose parameter is unused and to shadow-log labels (`decide.js:1581, :1674` — fenced, read only; downstream use ASSUMED). | **(a) + (b)** through the guard | Neither guard reads it (F1). On a row only as a capped label (≤ 64; a non-string → `'autopilot'`). The row label is still the player's value, not the governing mode (§10 Q4). |
| 2 | `pendingProposal` | **Nobody live** (STOP check 2). | Approved (*base* `:4864-5071`): `executeSwapServer` with the planted `tier` / `slotIndex`, `proposal.evaluationMetadata?.tradingDay \|\| 1` as the day (*base* `:4917` → the row's `swapDay` and the incoming position's `swappedInDay`, which steers the overnight `swapPrice` reset, `api/cron/agent-daily-scores.js:162`), the planted metadata spread LAST (*base* `:4932`) onto a row the executor builds with `...evaluationMetadata` AFTER its computed fields (`agentSwapExecution.js:403` vs `:396`), the planted snapshot (*base* `:4934`). Expired co-pilot (`proposal.mode === 'copilot'`, *base* `:5115`): the same (*base* `:5157-5169`). A pending, unexpired one muted the model every check. Every branch filed the proposal into the server-only `proposalHistory` with whatever outcome fields it carried (*base* `:4846, :5064, :5081, :5294`); the launch-guard branch filed it as `'auto_executed'`. The L1 receipt and the tick capture took its exit reason, snapshot and creation time. | **(a) + (b) + (c)** | Never executes; lapses through the launch-guard branch (F1), whose history row keeps only what the proposal named, capped. On the dormant paths no stored value reaches the row as a number / id / day / price (F2), apart from §8 row 3's pinned exceptions. History rows drop planted outcome fields (F3). **Residual (c):** the launch-guard row's `'auto_executed'` label still lets the voice layer relabel a same-pair trade (§10 Q2). |
| 3 | `gameplanMeeting` (its legs and P6's `swappedInAt` included) | **Nobody live.** `resolveGameplanMeeting` (`agentService.js:622-636`) writes the meeting back whole with `status`, `resolvedAt`, `resolvedBy`; its caller `GameplanMeetingCard.jsx` renders only from `AgentActivityFeed.jsx:758-760` when a `gameplanMeeting` prop is passed — and both live mounts (`src/screens/battleView/PaneTape.jsx:223-232`, `src/components/Agent/GameTapeView.jsx:636-645`) pass none (VERIFIED). The **server** creates meetings live (`agent-evaluate.js:2421`). *(The P6 report's "the meeting-approval card is mounted" is not accurate at this head.)* | `status: 'approved'` (*base* `:5785`): every leg whose `symbolOut` is held and `symbolIn` on the bench is executed, with none of the model path's checks — `validateTradeDecision` (cooldown, asset type, conviction), the hurdle floor, the swap cap, LOCK, the distressed-regime check — and no cap on legs. The leg's `rationale` landed on the row; its symbols formed the row's `evaluationId` and the feed text. A leg's `swappedInAt` is P6's belief. Pending with a far or unreadable `expiresAt` → the model is muted every check (the R11 pass still runs). The history rows copied the meeting. | **(b)** (+ (c) on row text, feed and history) | **(b) stays — your decision (§5).** F2: the rationale rides capped (≤ 1000, non-string → `null`), the id comes from the server's own symbols (`:5900`, unchanged for a real leg), leg symbols reach beats and records capped (`:5844`), the stored belief is type-checked (`api/_utils/swapIdentity.js:88`). F3: history rows drop planted outcome fields, on the meeting and each leg. |
| 4 | `gameplanMeetingHistory` | Nobody (no client writer in `src/`). | Appended to (`:6064, :6076, :6088`). Read by the P6 census (`legRefusals` counts). A non-iterable value makes the append throw → the check crashes before the score write (§13). | **(c)** (the player writes the history directly) | Unchanged — the rules overhaul closes it (§4). Server rows are built from server results (F3). The P6 census's meeting refusal counts are player-influenceable until then (§10 Q6). |
| 5 | `strategyPreset` | **Nobody live.** `updateStrategyPreset` (`agentService.js:614-620`) — its callers are archived or never rendered (ASSUMED for the badge). Server: `'balanced'` at creation. | `getPresetConfig(battle.strategyPreset \|\| 'balanced')` (`:1027`) selects one of three server risk tables (unknown → balanced). An inherited key (`'constructor'`, `'toString'`) returns a non-table and the check throws at `:1744` (§13). Stamped raw as `entryPreset` on every row. | **(c)** (+ the crash) | On a row only as a capped label (non-string → `'balanced'`). The crash → separate task. |
| 6 | `battleLedger` | Nobody reachable (`appendBattleLedger`, `agentService.js:598-604` — callers archived or never opened, ASSUMED). | Not read by the evaluation cron. Debate entries go into the daily-review model prompt (`api/cron/agent-batch-review.js:193-195, :245-275`, VERIFIED). | — (prompt text only) | Unchanged (§4). |
| 7 | `dailyGrades` | **Live:** `submitDailyGrades` (`agentService.js:638-644`) from the chat's grading card (ASSUMED for the call site). | Not read by the evaluation cron. Into the daily-review prompt (`agent-batch-review.js:205`) and the chat prompt (`api/agent/chat.js:728`). | — | Unchanged; validate its shape in the overhaul (§4). |
| 8 | `feedBookmarks` | **Live** (`agentService.js:646-660`; call sites ASSUMED). | No server reader. | — | Unchanged. |
| 9 | `reviewDecisions` | Nobody (archived Film Room card). | No server reader. | — | Unchanged (§4). |
| 10 | `updatedAt` | Every client writer above. | No server read. | — | Unchanged. |
| 11 | `agents/{id}.directives` | Nobody live (ASSUMED). | Rendered into the debate prompt through `renderLegacyDirectives`, which returns "No active directives" while `ARCHETYPE_INTEGRITY_MODE !== 'off'` (`api/_utils/legacyDirectiveSanitize.js:37`; the flag is `'enforce'`, `src/config/featureFlags.js:770` — VERIFIED). Deterministic stops come only from `agentContext.deployedGuardrails`, set server-side. | — | Unchanged. |
| 12 | `agents/{id}.lastViewedEvolutionCycle`, `.starterKitCompleted` | `starterKitCompleted`: live (the Forge starter kit). | No reader that decides anything (ASSUMED). | — | Unchanged. |
| 13 | `agents/{id}/rules/*`, `bundles/*` | Live (the Forge), field-validated by the rules. | Read at deploy (`decide.js`, fenced) into `battle.agentContext.activeRules`, rendered as prompt constraints only — no deterministic read of `paramValues` in agent battles (ASSUMED). Season mode turns them into trades, but its crons are unscheduled (BUILD_RULES §6). | — | Unchanged. |
| 14 | `proposalHistory` (not player-writable) | — | Its rows were copied from #2. | (c) via #2 | F3; the launch-guard row bounded (§3.3). |

---

## 2. The exploit — proof on base and on head

The base proof is a test — the base version of `api/cron/agent-evaluate.proposalForgery.test.js`, reproduced here — on the **real** `processAgentBattle` and the **real** executor, against the tick harness's in-memory store.

```js
const PLANTED_APPROVED = Object.freeze({
  proposalId: 'prop_x', symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, mode: 'copilot',
  createdAt: '2026-09-09T14:40:00.000Z', expiresAt: '2026-09-09T14:50:00.000Z',
  resolvedAt: '2026-09-09T14:45:00.000Z', resolution: 'approved', resolvedBy: 'owner-uid-1',
  evaluationMetadata: { lockedPoints: 9999, entryPrice: 0.01, exitPrice: 777, symbolOut: 'FAKE', tradingDay: 42, evaluationId: 'forged' },
});
it('a planted approved proposal executes, its planted lockedPoints/price/symbol land on trades[], and bankedScore sums them', async () => {
  const battle = makeTickBattle({ executionMode: 'copilot', pendingProposal: deepClone(PLANTED_APPROVED) });
  const first = await runTick(battle);
  expect(exec.calls).toHaveLength(1);
  const row = first.stored.trades.at(-1);
  expect(row).toMatchObject({ lockedPoints: 9999, entryPrice: 0.01, exitPrice: 777, symbolOut: 'FAKE', swapDay: 42, evaluationId: 'forged' });
  expect(first.stored.portfolio.support[0].symbol).toBe('AMD');   // the executor really sold KO; the row says FAKE
  const second = await runTick(deepClone(first.stored));
  expect(second.stored.scoreState.bankedScore).toBe(9999);
});
it('a planted EXPIRED co-pilot proposal makes the cron trade a pair the agent never chose', async () => {
  // the same proposal with no resolution and empty metadata: exec called once on slot support[0], KO → AMD, history 'auto_executed'
});
```

| Where | Result |
|---|---|
| Base `62d9d07e`, Linux | **2 passed** — the exploit reproduces (also 2 passed on the Windows worktree before any edit). |
| Head `b333e8f5` (and `3dbce6d1`), Linux | **2 failed** — `expected [] to have a length of 1 but got +0`: the executor is never called. |

The head suite (`api/cron/agent-evaluate.proposalForgery.test.js`, 26 rows) asserts the closed state: the planted proposal never executes, the trade list stays empty, the slot keeps KO, and the next check's `bankedScore` is 0. It covers a planted `'copilot'`, a deleted mode (the migration path), `'manual'`, `'copilot '` and a number, at shadow and enforce too.

---

## 3. Part B — what changed and where

### 3.1 F1 — one server-owned launch mode
| What | Where |
|---|---|
| `LAUNCH_EXECUTION_MODE = 'autopilot'`, pinned (`Pinned by:` → `api/_utils/executionAuthority.test.js`) | `api/_utils/executionAuthority.js:25` (new) |
| The model path: `const mode = LAUNCH_EXECUTION_MODE;` — the battle's `executionMode` is only logged when it disagrees | `api/cron/agent-evaluate.js:3451` |
| The proposal handler: `if (LAUNCH_EXECUTION_MODE === 'autopilot')` → the existing launch-guard branch (cleared, a history row, never executed) | `:4862` |
| The dormant proposal-feed TTL label reads the same constant | `:3960` |

Tests that drive the dormant paths mock the module: the P6 suite derives the mock from its own co-pilot fixtures in `runTick`; the `proposal_pending` exit in the call-records off golden, the tick-capture exit table and the calls-on suite runs with `dormantProposalPath: true` (so that golden still pins the dormant path byte for byte; production's handling of the same battle is pinned by its own row, §9 row 1).

### 3.2 F2 — the executor metadata allowlist
`api/_utils/executorMetadata.js` (new, pure):
- `EXECUTOR_METADATA_KEYS` (`:34`) — the documented keys (`id, action, trigger, rationale, hypothesis, evaluationId, tradingDay`) plus the twelve every server path passes today (the census of the six calls and the dormant proposal-creation literal; reviewer I3 confirmed it is exactly their union): `entryRegime, entryMarketPosture, entryConviction, entryPreset, entryMode, exitReason, swapMotive, source, archetype, hftKnobsSource, swapProvenance, trade_reasoning`. Disjoint from `EXECUTOR_COMPUTED_KEYS` (`:41`) — the fenced `closedTrade` literal's own keys, which the guard test reads off the fenced file.
- `executorMetadata(fields)` (`:71`) — the allowlisted keys in the caller's own order (the off goldens record writer arguments as JSON; the order keeps them byte-identical), **frozen** (a later `Object.assign` onto it throws).
- `clientText` (≤ 1000) / `clientToken` (≤ 64) — a string from a player-writable record, capped; anything else `null`.
- `serverTradeId(battle)`; `serverProposalDecision(battle, proposal)` — the retained, server-written `evaluations[]` entry that decided PROPOSAL for the same pair, else `null`; `serverProposalEvaluationId` its id; `proposalDescriptiveMetadata(proposal)` — only the stored descriptive strings (capped) and the reasoning's strings.

| Call | Change | Where |
|---|---|---|
| C1 risk loop | `executorMetadata({…})`; `entryPreset` / `entryMode` via `clientToken` | `:1969` |
| C2 model route | the same | `:3543` |
| C3 approved proposal (dormant) | the server's floor (receipt source, exit reason) is no longer overridable; `...proposalDescriptiveMetadata(proposal)`; `id` / `action` / `evaluationId` / `tradingDay` from the server; the day argument is `serverDay` (`getCurrentTradingDayServer`, `:4894`); the snapshot argument is `null`; the capture action and the L1 receipt take the row's exit reason, the server's decision instant (`serverDecision`, `:4895`) and `null` snapshots / regime | `:4959` |
| C4 expired proposal (dormant) | the same | `:5202` |
| C5 suppression pass | `executorMetadata({…})`; preset / mode capped | `:5570` |
| C6 approved meeting | `executorMetadata({…})`; `rationale: clientText(swap.rationale)`; preset / mode capped; the `evaluationId` from the slot's occupant and the bench asset the lookups returned (`:5900`); leg symbols capped in every beat and refusal record (`:5844`) | `:5917` |
| P6 belief (all stored beliefs) | `expectedOutOfStored` type-checks: the symbol a string ≤ 64, the instant a string ≤ 40 or `null`, anything else dropped (symbol only) | `api/_utils/swapIdentity.js:88` |

### 3.3 F3 — history rows from the server's own results
`api/_utils/historyRows.js` (new):
- `HISTORY_OUTCOME_KEYS` (`:30`): `executionFailed, executionRefusal, verification, legRefusals, systemNote, scoreAtResolution, scoreAtVeto, vetoedAtPrice, vetoedAtTimestamp, counterfactualPoints, outcomePoints, lockedPoints, closedTrade` — what the server writes on these rows as a result, plus the result fields history readers consume (the voice layer's counterfactual and outcome points).
- `proposalHistoryBase` (`:55`) / `meetingHistoryBase` (`:85`) — the record (and each meeting leg) without them, in its own key order; a record that is not a plain object contributes nothing (a spread string used to become one field per character).
- `launchGuardRecord` (`:72`) — **the launch-guard row**, the one proposal branch production runs: only what the proposal *named* (`proposalId, symbolOut, symbolIn, mode, createdAt, expiresAt`), as capped strings. Never its ids, evaluation metadata, snapshot, numbers or text.

Call sites: the launch-guard row (`:4865`), the dormant approved / vetoed / expired rows (`:5104-5105, :5122, :5341`), the three meeting rows (`:6064, :6076, :6088`). The cron then adds this resolution's own outcomes.

### 3.4 The detection census
`scripts/census-planted-proposals.mjs` (new; read-only; §12).

---

## 4. F4 — the `firestore.rules` lines for the rules overhaul (Astra security audit F01)

No rules change in this build. From the §1 table, the overhaul should close:

| Line | Today | Close to | Why (§1 row) |
|---|---|---|---|
| `firestore.rules:459` — `executionMode` | owner-writable | **remove** (server-owned; the authority arc adds an endpoint if modes return) | #1 — opened the dormant paths; still a row label |
| `:459` — `pendingProposal` | owner-writable | **remove** (no live writer; a revived approve/veto goes through an endpoint that writes only `resolution` / `userReason`) | #2 — the exploit; still produces a launch-guard history row per plant |
| `:459` — `gameplanMeeting` | owner-writable | **remove**, with an approve/reject endpoint that writes only `status` (at minimum: a rule that the update changes only `gameplanMeeting.status / resolvedAt / resolvedBy` and leaves `suggestedSwaps` equal) | #3 — class (b) |
| `:459` — `gameplanMeetingHistory` | owner-writable | **remove** (no client writer) | #4 |
| `:459` — `strategyPreset` | owner-writable | **remove**, or restrict to `in ['aggressive', 'balanced', 'defensive']` (no live writer) | #5 — the crash; a row label |
| `:459` — `reviewDecisions`, `battleLedger` | owner-writable | **remove** (no live writer) or shape-validate | #6, #9 |
| `:459` — `dailyGrades`, `feedBookmarks` | owner-writable, **live** | keep; validate shape and size (a map of date → `{trades: list ≤ N, submittedAt}`; a list of ≤ N strings) — every allowlisted field can otherwise be filled toward the 1 MiB document limit (§13) | #7, #8 |
| `:335` — `directives` | owner-writable | **remove** (no live writer; its reader is closed) | #11 |

---

## 5. Founder decision — the gameplan meeting (outcome b)

**The fact.** The whole `gameplanMeeting` map is player-writable (`firestore.rules:459`). A crafted client can write `{status: 'approved', suggestedSwaps: [{symbolOut: <any held stock>, symbolIn: <any bench stock>}, …]}`, and the next check executes every leg. Reviewers I1 and IV1 reproduced what that buys, at `off`, on the real cron:
- **any trade at any time** — no cooldown, no asset-type check (BTC → AMD executed), no LOCK, no hurdle, no swap cap, **no limit on legs**;
- **erasing banked losses:** with 50 trades at −10 banked, one planted meeting of 50 round-trip legs (KO ↔ AMD, ≈ 0 points each) pushed every old row out of the 50-row `trades[]`; the next check's `bankedScore` went from −500 to −3 (**+497 points**). (The underlying cap is a pre-existing bug for every battle — §13);
- **hiding evidence:** 101 legs whose stock is not on the bench push old beats out of the 100-beat feed;
- **steering P6's shadow census:** a leg's stored entry instant — even a well-formed one — decides that leg's verdict (`match` or `mismatch`), so the meeting rows of the shadow read are player-influenceable;
- **muting the model** with a pending meeting whose expiry is far away (also in the §13 task).

After this build no planted *value* reaches a trade row, a feed beat (beyond a capped symbol) or a history row's outcomes — but *which trades happen* is still the player's choice. No live client can approve a meeting today (the card is not mounted), so closing it breaks nothing players use.

| Option | What | Size |
|---|---|---|
| **M1 — smallest that keeps the feature (recommended)** | At creation the cron also stores the legs it proposed where the player cannot write (e.g. `cronState.gameplanLegs = {meetingId, legs: [{symbolOut, symbolIn, swappedInAt}]}`, in the same update as the meeting); at approval it executes a leg only if the meeting id and the pair match that copy (at most the stored number of legs, each once), uses the stored entry instant as P6's belief, and holds the rest with a feed beat. | ~20–25 lines in `agent-evaluate.js` (the creation write + a filter in the approved branch) + ~4 rows; no rules change; byte-identical for server-created meetings. |
| M2 — smallest overall | Stop executing approved meetings until the card returns with a server endpoint: the approved branch files the history row without trading. | ~3 lines + 2 rows; turns the (unused) meeting feature off. |
| M3 — the real fix | The rules overhaul (§4) plus an approve/reject endpoint that writes only the status. | Medium; belongs with F01. |

---

## 6. Part C — the P6 pre-enforce follow-ups

### 6.1 Census: battle status
`scripts/census-swap-identity.mjs` §2: a verification whose `battleStatus` is not exactly `'active'` (`null` and an absent key included — the executor fails closed, and `refusalOf` ranks `battle_not_active` above a mismatch) is counted per caller in a new column **"enforce would refuse: battle_not_active"**, never under its verdict, and listed; the mismatch list holds active battles only; the executor/census cross-check still runs on every executor verification. The P6 fixture's six executor verifications now carry `battleStatus: 'active'` (as the executor writes it); `scripts/__fixtures__/swapIdentityCensusBattleStatus.json` (new) holds a matching identity on a completed battle, a mismatch with a `null` status, a verification with no status key and an active one. Review additions: a launch-guard row lends no belief to the proposal join (it never executed, and its ids were a client's), and every table cell is escaped.

### 6.2 Table F V1.2 — the profit-target line
- `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md`: a dated **V1.2** note (header, table F, footer); the row `outgoing_identity_mismatch` (profit target) → "Your profit target was set to sell [SYM], but [SYM] had already left that slot. No trade was made."; and the speaker rule (the protective line now names the stops; the profit-target line an equipped profit target, on either route).
- `api/_utils/swapIdentity.js`: `REFUSAL_LINES.outgoing_identity_mismatch.profit_target`, `REFUSAL_KINDS` (three, `:123`), `PROFIT_TARGET_EXIT_REASON = 'guardrail_profitTarget'` (`:126`), `refusalKindOf(source, exitReason)` (`:143`); `refusalLine` names only the stock to be sold for the protective and profit-target speakers.
- Routing: the model route's entry refusal (`agent-evaluate.js:3849`) and the suppression pass's beat (`:5812`) pass the trade's exit reason. Both sit inside the mode ≠ off branches, so nothing changes at off. (Reviewer I3: the risk loop never produces a profit target; the model route writes no refusal beat, only the entry record.)
- Tests: the spec-vs-constants byte test now expects four rows; the §E sweep covers the new template and its rendering; a speaker row; and three rows through `processAgentBattle` — model route and suppression pass with a moved slot at enforce, plus a stop on the same route keeping the protective line.

### 6.3 The silent meeting failure — STOPPED (not built)
**The STOP condition holds: an executor path can throw after its transaction commits.** Every error the executor's own code raises happens inside its `runTransaction` callback, before `transaction.update` (`agentSwapExecution.js:266-502`), so a thrown *attempt* writes nothing. But the Admin SDK (`@google-cloud/firestore` 7.11.6) retries the whole transaction, up to five attempts, on a retryable commit error — `ABORTED, CANCELLED, UNKNOWN, DEADLINE_EXCEEDED, INTERNAL, UNAVAILABLE, UNAUTHENTICATED, RESOURCE_EXHAUSTED` (`node_modules/@google-cloud/firestore/build/src/transaction.js:390-424, :582-604`). A `DEADLINE_EXCEEDED` or `UNAVAILABLE` on a commit the backend **applied** is ambiguous. Attempt 2 opens a new transaction (`retryTransaction`, `:466-486`), re-reads the battle with the swap already in it — the slot now holds the incoming stock — and the callback throws:
- at `off` / `shadow`: the **untyped** `Invalid swap: AMD cannot replace itself`;
- at `enforce` (every caller passes a belief): P6's **typed** `SwapRefusalError` ("expected KO … found AMD").

Either way the throw comes *after* the trade committed. Reviewers I3 and IV3 reproduced both with a double that follows the SDK's retry rule: one commit, trades = 1, then the throw. A record "The swap of KO for AMD you approved did not go through. No trade was made." would be false. (Corrections from the review: the commit RPC *is* also re-sent on `RESOURCE_EXHAUSTED` / `UNAVAILABLE` by the client library's service config; `confirmTournamentSwap` swallows its own errors (`:662-683`), so after the executor returns only `refreshBattleFromDoc` can throw inside the meeting leg's `try`.)

**Smallest option for your decision:** on a throw from the executor call itself (a flag set around the call, as the suppression pass's `passExecutorInFlight` does), re-read the battle and record `executionFailed` — or a refusal — only when the server's own fresh read shows no trade row carrying this attempt's `evaluationId` (unique per attempt: `gameplan_<OUT>_<IN>_<ms>`). About 20 lines + 4 rows. **The same read belongs in front of every P6 enforce refusal record** (all six callers write "No trade was made." in that case today, and their catch blocks release a tournament reservation for a stock the battle now holds). Worth deciding before the P6 enforce flip.

---

## 7. Acceptance results

| # | Row (the prompt) | Result | Proof |
|---|---|---|---|
| 1 | The Part A exploit test fails on head: a planted proposal never executes, and `bankedScore` is unchanged | **Met** | The base version (§2) passes at `62d9d07e` and fails at the head, both on Linux (§11). The head suite `api/cron/agent-evaluate.proposalForgery.test.js` (26 rows): the planted proposal never reaches the executor, `trades` stays empty, KO keeps its slot, the next check's `bankedScore` is 0 — for a planted `'copilot'`, a deleted mode, `'manual'`, `'copilot '`, a number, and at shadow and enforce. |
| 2 | A guard test fails CI if any production executor caller passes a metadata key outside the allowlist, or a value read from a client-writable field | **Met** | `api/cron/agent-evaluate.executorMetadata.guard.test.js` (35 rows). *Static:* the cron is parsed with acorn; each call's metadata must be an `executorMetadata({…})` object (resolved in scope, never mutated, one per call) with allowlisted keys and known spreads; no argument that reaches the row — metadata, day, asset, prices, snapshot, P6 belief — may read a player-writable field except through a named sanitizer, and ids / the day / numbers not even through the text sanitizers; aliases, destructuring, reassignment and computed members are traced; synthetic defeats prove each rule bites. The player-writable list is read from `firestore.rules`; the computed keys from the fenced executor. *Behavioural:* the six callers through the real `processAgentBattle` at off, shadow and enforce, with every player-writable field planted: each reaches its own call site and branch, no planted number / id / symbol reaches an executor argument or a trade row, every row key is computed or allowlisted, text is capped; the callers cover every call line. Plus `executorMetadata()` is frozen at runtime. Mutation-checked (§11). |
| 3 | Every P6 test still passes, with the C3/C4 rows using the dormant-path mock; all P6 goldens unchanged; flips dry-run green at shadow and enforce | **Met, two departures** (§8 row 2) | `agent-evaluate.swapIdentity.test.js`: 66 rows (its 51 `it` rows unchanged in number) + 3 new V1.2 rows; the mock is derived in `runTick` from the row's own co-pilot fixture. Beyond the mock: the C3 enforce row's battle gains its deciding evaluation entry, and the launch-guard source pin follows the constant. P6's golden fixture (`api/_utils/__fixtures__/swapExecutorOffGolden.json`) and every fixture under `__fixtures__` are unchanged (reviewer I2). Flips: §11 — shadow and enforce each green on Linux, and the control fails exactly the pin row. |
| 4 | At off, every existing golden is byte-identical, except the intended changes, each with its own row | **Met** | Byte-identical: the call-records off golden (25 rows: every battle write, prompt byte, capture document and writer argument on every exit — the `proposal_pending` exit with the dormant mock), `tickStamps.flagOff`, `tickCoherence` T1, the executor off golden (16 shapes × 4 ways), `guardrailErrorFailClosed`, `callRecords.rollback` (reviewer I2: 11 files, 151 rows; a key-order mutant of `executorMetadata` fails three call-records golden rows, so the goldens are live). Reviewer I2's own base-vs-head differential: 88 scenarios through the real cron, 72 byte-identical, the other 16 exactly the intended changes. Each intended change has its rows (§9). |
| 5 | F3 holds: a planted `executionFailed` / `executionRefusal` / `verification` never reaches a server-written history row | **Met** | `agent-evaluate.proposalForgery.test.js` "F3" (8 rows): the launch-guard row, the dormant approved (success and failure, off and enforce), vetoed and expired rows, the approved / rejected / expired meeting rows and every leg, and the server's own `legRefusals` at enforce — each checked against both the module's outcome list and every key the suite plants; `api/_utils/historyRows.test.js` (9 rows). |
| 6 | Both scripts pass on fixtures; the table F lines contain no §E words | **Met** | `scripts/census-planted-proposals.test.js` (26 rows) on `scripts/__fixtures__/plantedProposalCensusBattles.json`; `scripts/census-swap-identity.test.js` (P6 rows + 5 battle-status rows + 2 review rows) on its fixtures; each script's read-only check (the planted-proposal one walks the syntax tree). `api/_utils/swapIdentity.test.js`: table F parsed from the spec and compared byte for byte with the constants (four rows); the §E sweep over every template and rendering, the profit-target line included. |
| 7 | Full suite, `lint:gate` and `vite build` pass | **Met** | §11: 18,969 passed, 0 failed on Linux (CI-shaped); `lint:gate` exit 0 and `vite build` exit 0 on an LF checkout of the pushed head |

---

## 8. Where the build departs from, or reads, the prompt

| # | The prompt said | The build does | Why |
|---|---|---|---|
| 1 | F1: "the proposal handler's launch guard reads a server-owned value … If that source is an inline literal, add one named, pinned constant that both paths read." | `LAUNCH_EXECUTION_MODE` in a new module (`api/_utils/executionAuthority.js`), not in `featureFlags.js`. | Many suites mock `featureFlags.js` with explicit factories; a new export there would throw in every one that omits it (P6's S3-1). A dedicated module is mocked only by the suites that drive the dormant paths. It is pinned by its own test, with a `Pinned by:` pointer. |
| 2 | "Every P6 test still passes, with the C3/C4 rows using the dormant-path mock." | Two P6 edits beyond the mock: the C3 enforce row's battle gains the evaluation entry that decided the proposal (its asserted `verificationId` is unchanged), and the launch-guard source pin follows the constant. | F2 says ids come from the server's own values. The stored `evaluationId` is player-writable, so the trade's id is now the server's own record of the decision (`serverProposalDecision`): kept when the server's `evaluations[]` holds it, `null` otherwise. A real proposal always has that entry; the P6 fixture omitted it. |
| 3 | F2: "no client-writable value lands on a trade row as a number, price, points, count, symbol or id" — "on the dormant proposal paths too". | Four documented exceptions on the **dormant** paths, each pinned by the guard: which slot (`tier` / `slotIndex`) and which bench stock (`symbolIn`) a proposal names (the executor then reads that slot from the live book, so the row records the slot actually traded); `proposal.mode` decides auto-execution at expiry; P6's stored belief reaches `verification.expected` (type-checked and capped). | The slot and belief are P6's identity semantics (its C3/C4 rows check the stored slot against the live one); re-resolving them, and server-held proposals, belong to the authority arc (P6 D6). F1 makes the paths unreachable today. On the **live** meeting path the leg's symbols are lookup keys whose matches are server values by construction. |
| 4 | F3: a history row "never copies … any outcome field from a client-writable record". | Stronger for the launch-guard row, the one proposal branch production runs: it keeps only what the proposal *named* (`proposalId, symbolOut, symbolIn, mode, createdAt, expiresAt`, capped), not "the record minus its outcomes". The dormant branches keep the record minus its outcomes. | Review I1-3 / IV1: the whole record filed into the server-only history let repeated plants grow the battle document toward its 1 MiB limit (the player cannot clear `proposalHistory`), and a planted evaluation id lent a false belief to the P6 census. |
| 5 | (unstated) The launch-guard row's label | Unchanged: `resolution: 'auto_executed'`, `systemNote: 'launch_guard_clear'` (the founder's May design). | Changing it moves a founder-designed record; its reader `detectTradeProvenance` is a prompt module this build may not edit. §10 Q2. |
| 6 | (unstated) `entryMode` on live rows | Still the battle's `executionMode`, now capped (a non-string → `'autopilot'`). | F2 asks descriptive strings from player-writable records to be type-checked and capped, which is done. Stamping the governing `LAUNCH_EXECUTION_MODE` instead would change rows on every migrated `'copilot'` battle — an off change outside the three listed. §10 Q4. |
| 7 | (unstated) The dormant rows' numbers and the L1 receipt | The dormant rows drop `entryConviction`, `swapProvenance`, the reasoning's conviction and the snapshot (numbers from a player record). The dormant capture action and L1 receipt take the row's exit reason, the server's decision instant (the deciding entry's timestamp, else none) and `null` snapshots / regime. | F2's numbers rule; the receipt and capture are history records the same plant reached (review I2-1 / I3-4). The server's deciding entry holds the conviction and reasoning; the authority arc can read them from there (I3-5). |
| 8 | "Meetings: … do not redesign the meeting flow here." | The meeting path gets the same F2 / F3 hardening (allowlist, capped rationale, server-symbol id, capped leg symbols in beats and refusal records, the type-checked belief) — no change to which legs run. | Sanitising values is not a redesign; the trade choice (class b) stays your decision (§5). |
| 9 | Part C 1: count verifications whose `battleStatus !== 'active'` | Read literally: `null` and an absent key both count as not active. | The executor always writes the key (`liveData.status ?? null`) and fails closed on a missing status; the P6 fixture's executor verifications now carry `'active'`, as the executor writes it. |
| 10 | Part C 3: the meeting untyped-failure record | **Not built** — the STOP condition holds (§6.3). | As the prompt directs. |
| 11 | Detection: two reads | Also lists launch-guard clears, failed approvals and rows that contradict themselves, and every read sets the verdict. | On base the history rows were the player's record copied whole, so a planted note or failure marker could hide an execution (review I4-5); since no server path creates proposals, any proposal row after the guard date is a plant. |
| 12 | (guard design) | The static half's one known limit — a value laundered through an unreviewed helper into a local name — is stated in the test's header; the behavioural half and the runtime freeze are its backstop. | Full inter-procedural taint tracking is out of proportion here. |

---

## 9. What changes at `off`

Only planted or malformed records are affected; each change has its own rows.

| # | Change | Before (base) | After | Rows |
|---|---|---|---|---|
| 1 | **Planted proposals lapse via the launch-guard branch** (any battle whose `executionMode` is not `'autopilot'` — planted, deleted and migrated to `'copilot'`, or legacy) | An approved one executed; an expired co-pilot one auto-executed; a pending one muted the model every check | Cleared on the next check, no trade; the model runs | `proposalForgery` Part A (8 rows), incl. "the production clear, pinned exactly" (one write, a full 50-row history, the server's time and score) and "the model path ignores a planted mode" |
| 2 | **History rows built only from server results** | Proposal and meeting rows copied the record whole (planted outcome fields included); the launch-guard row copied the whole proposal; a string record spread into one field per character | Outcome fields dropped on every row and leg; the launch-guard row keeps only the named identity strings, capped; a non-object record contributes nothing | `proposalForgery` F3 (8 rows) + "a planted proposal that is not an object"; `historyRows.test.js` |
| 3 | **F2 caps on live rows** (planted or malformed values only) | `entryPreset` / `entryMode` stamped raw (a number, an object); a leg's `rationale` raw — a missing one made the executor's write throw (Firestore rejects `undefined`), so the leg failed | Non-string preset / mode → `'balanced'` / `'autopilot'`, longer than 64 capped; a non-string rationale → `null` (the leg trades), longer than 1000 capped | `proposalForgery` "F2 on the live paths" (2 rows); the guard's behavioural half |
| 4 | **Meeting-leg symbols in feed beats and refusal records** | A planted leg's text reached the bench-unavailable beat raw (5,054 characters seen by IV1) — beats are visible to rivals in the tournament battle view | Capped at 64 (a non-string → `null`); a real leg's symbols are unchanged | `proposalForgery` "a meeting leg's planted symbols reach the feed … only capped" |
| — | The meeting untyped-failure record | — | **Not built** (§6.3) | — |

Everything else at `off` is byte-identical (§7 row 4). The F2 caps also apply at shadow and enforce, as do the type-checked P6 belief (a malformed stored instant is now checked by symbol only) and the V1.2 profit-target line (mode ≠ off only).

---

## 10. Founder questions

- **Q1 — The meeting (§5).** M1 (recommended: a server-held copy of the legs), M2 (stop executing approvals until the card returns) or M3 (the rules overhaul plus an endpoint).
- **Q2 — The launch-guard row's label.** It still reads `resolution: 'auto_executed'` (your May design, with `systemNote: 'launch_guard_clear'` as the honest qualifier). The voice layer's `detectTradeProvenance` (`api/_utils/voiceLayerPrompt.js:1821`, a prompt module — out of bounds here) ignores the note, so a planted proposal naming the same pair relabels a real trade within five minutes as "auto-executed at expiry" in the agent's chat context (reviewers I1, I2, I3; class c, text only). Options: a resolution value no reader counts (e.g. `'launch_guard_cleared'` — one line plus rows), the reader skipping the note (a prompt-module change), or the rules overhaul removing `pendingProposal` (§4), which stops new plants.
- **Q3 — Part C item 3 and P6 at enforce (§6.3).** Approve the re-read option (~20 lines + 4 rows) for the meeting record — and for every P6 enforce refusal record, before the enforce flip.
- **Q4 — `entryMode` on live rows.** Keep the capped player value (today), or stamp the governing `LAUNCH_EXECUTION_MODE` (a fourth off change; it also stops the P6 census from filing a migrated or planted `'copilot'` battle's aged-out model trades as proposal trades).
- **Q5 — Run the detection census now** (§12). Its best evidence — the feed beat — ages out after 100 beats, about one to two trading days.
- **Q6 — For the record: the authority arc's prerequisites** if proposals return: store proposals where players cannot write; execute only when `serverProposalDecision` finds the deciding entry, with a once-only and freshness check; take the slot, the pair and the mode from the server; read conviction and reasoning from the deciding entry. And: the P6 shadow read's **meeting** rows are player-influenceable until §5 or §4 lands (a leg's stored entry instant decides its verdict).

---

## 11. Test runs and the BUILD_RULES §2 review

### 11.1 Test runs

| Run | Where | Result |
|---|---|---|
| **Full suite, CI-shaped** (`--maxWorkers=2`, `TZ=UTC`) — **the suite of record** | WSL Ubuntu (private clone), final code head `b333e8f5` | **18,969 passed, 0 failed (19,056 rows incl. 87 skipped; 253 s; exit 0)** |
| **Flip 1 dry run** — `SWAP_IDENTITY_MODE` → `'shadow'` + its pin row | same, `b333e8f5` | **18,969 passed, 0 failed** (249 s) |
| **Flip 2 dry run** — → `'enforce'` + its pin row | same, `b333e8f5` | **18,969 passed, 0 failed** (246 s) |
| Control — the flag moved **without** its pin | same | the module exports `'shadow'`; **exactly the pin row fails** (1 of 17) — so the dry runs ran the flipped flag |
| Earlier heads (same three runs each) | `be3fa00c` (off only) · `3dbce6d1` · `a6557ab2` | 18,920 · 18,929 · 18,960 passed, **0 failed** each (87 skipped), every flip green, every control exactly the pin row |
| The exploit test, base version | Linux: `62d9d07e` / `b333e8f5` | **2 passed** at base (the exploit reproduces) / **2 failed** at head (closed); the head suite 26 / 26 |
| `npm run lint:gate` | LF checkout of the pushed head | **green** (exit 0) |
| `vite build` | LF checkout of the pushed head | **green** (exit 0) — the pushed commit is the built commit |
| Emulator rules suite | — | **not run**: `firestore.rules` and `test/rules/` untouched |
| Windows note | CRLF worktree, targeted suites | the same platform-only rows as on `main` here (`evalRun` "exactly ONE block", `tickStamps.pins` anti-vacuous, `tickCoherence` T1, `shadowCpuQuoteIntegrityFlags`, the film-tape e2e parse) — none is this build's; all pass on Linux |

### 11.2 The review

**Mandatory** (24 files, +2,927 / −155 at the code head `b333e8f5`, before this report). Run as a multi-lens adversarial review with subagents, each on **its own** LF `git archive` snapshot tree under the session scratchpad (`node_modules` linked by junction), read-only on git and on every other tree: **4 lenses** at `3dbce6d1` — **I1 the attacker** (the prompt's attacker model: get any planted value onto a trade row, into the score or into a history row), I2 the off guarantee / boundaries / flips (with its own 88-scenario base-vs-head differential), I3 domain correctness (F2 / F3 semantics, Part C, the STOP), I4 test integrity / scripts / docs; **4 verifiers** (IV1–IV4, one per lens, each on a fresh tree, told to refute every finding with a probe); and **a mutation lens** (I5) run last, on its own tree of the fix head `a6557ab2`. Ids are this build's own (I·, IV·), distinct from P6's S· and earlier builds'.

| ID | Finding (short) | Verdict | Disposition |
|---|---|---|---|
| I1-1 | Player-writable values (`suggestedSwaps: [null]` or a map, `strategyPreset: 'constructor'`) crash every check before the score is saved — the frozen score decides completion | CONFIRMED (high, pre-existing) | **Separate task** (§13). Build-caused part (a guard-test comment's premise about `getPresetConfig`): **fixed** |
| I1-2 | A planted approved meeting: unlimited legs, no cooldown / asset-type / LOCK checks; churn evicts banked losses (+497 points), floods the feed | CONFIRMED (high, pre-existing) | **Your decision (§5)**; the 50-row eviction for every battle → **separate task** (§13) |
| I1-3 | A string proposal spread into one field per character in the launch-guard row (a 150 KB string → a 1.24 MB document) | CONFIRMED (medium, pre-existing, in F3's scope); IV1: the `{}` fix is not complete — a large *plain* record still filed whole | **Fixed** — non-objects contribute nothing; the launch-guard row keeps only named identity strings, capped (§8 row 4) |
| I1-4 · I2-2 · I3-7 | The launch-guard row reads as an execution: the voice layer relabels a same-pair trade; the P6 census joins a planted evaluation id → a false mismatch | CONFIRMED (low) | Census: **fixed** (a guard clear lends no belief; the bounded row carries no ids). Voice layer: §10 Q2 |
| I1-5 | Planted meeting-leg text reaches feed beats uncapped (public to rivals) | CONFIRMED (low, pre-existing) | **Fixed** — leg symbols capped (§9 row 4) |
| I1-6 · I3-1 · I4-4 | P6's stored belief is not type-checked: at shadow a planted leg instant (a number, an object, 5,000 characters) lands on `trades[].verification` and forges a mismatch | I1/I4: CONFIRMED (medium); IV3: PARTIAL (low — the type check is right, but a well-formed wrong instant still decides the verdict: that is the meeting decision) | **Fixed** (`expectedOutOfStored`, shadow / enforce rows in the guard and the forgery suite); the residual → §5 / §10 Q6 |
| I1-7 · I2-1 · I3-4 | Dormant paths: the capture action and L1 receipt still read the proposal's exit reason, creation time, snapshot, regime; a planted slot picks the trade; a planted `scoreAtProposal` survives on the vetoed row | CONFIRMED (low, dormant) | Receipt / capture: **fixed** (server values, §8 row 7). Slot: documented exception (§8 row 3). `scoreAtProposal`: §13 |
| I1-8 | A pending meeting with a far or unreadable expiry mutes the model indefinitely | CONFIRMED (low, pre-existing) | In the §13 task |
| I1-9 | Census cells unescaped; a migrated or planted `entryMode` misfiles aged-out model trades; `battlePatternLogger` stores the raw mode | CONFIRMED (nit) | Escaping: **fixed**; the rest: §10 Q4 / §13 |
| I2-3 | The report is cited in code before it exists | CONFIRMED (nit, transient) | Resolved by this commit |
| I3-2 | The dormant paths still take the slot, the bench stock and the expiry mode from the proposal; the comment and draft report said otherwise | CONFIRMED (low) | **Fixed** — the comment and §8 row 3 state the exceptions |
| I3-3 | The STOP holds, but at enforce the post-commit retry is a *typed* refusal; §6.3 misstated the RPC retry and `confirmTournamentSwap` | PARTIAL (low as a report correction; the behaviour is P6's) | **Report corrected** (§6.3); carried to Q3 |
| I3-5 | Revived rows drop conviction / provenance the server's deciding entry holds | PARTIAL (nit) | Authority-arc note (§8 row 7, §10 Q6) |
| I3-6 | `entryMode` is the player's label, not the governing mode | CONFIRMED (nit) | Carried — §10 Q4 |
| I3-8 | Comments call the live meeting path "launch-guarded" | CONFIRMED (nit) | **Fixed** |
| I4-1 | The guard's static half resolved the model route's metadata to the risk loop's declaration — call #2 was never checked (acceptance row 2 unmet for the busiest caller) | CONFIRMED (**high**, caused by this build) | **Fixed** — in-scope resolution, no mutation, one object per call; rows prove the defeat is caught |
| I4-2 | Taint tracking missed aliases, destructuring, `let`, helpers, computed members, post-construction mutation; IV4: a post-construction `Object.assign` from the planted proposal at the risk loop **reopened the exploit** and every suite stayed green | CONFIRMED (medium, caused by this build) | **Fixed** — all traced or rejected statically; every caller now plants a proposal and a meeting; `executorMetadata()` frozen at runtime |
| I4-3 | The per-call loop was hard-coded to six | CONFIRMED (low) | **Fixed** — one row per call; the callers must cover every call line |
| I4-5 | The detection census trusted history rows the player shaped (a planted note or failure marker hid an execution; an unreadable time skipped it) | CONFIRMED (medium; the eviction sub-claim PARTIAL — the lever predates the build) | **Fixed** (§8 row 11) |
| I4-6 | The model path's F1 had only source pins | CONFIRMED (low) | **Fixed** — rows for copilot / manual / missing |
| I4-7 | Nothing pinned production's handling of the `proposal_pending` battle | CONFIRMED (low) | **Fixed** — "the production clear, pinned exactly" |
| I4-8 | The behavioural half did not check which call site a caller reached | CONFIRMED (low) | **Fixed** — stack site and branch per caller |
| I4-9 | Census wording (the feed cap; a lapsed approval counts as an execution) | PARTIAL (nit — the 100-beat cap is right for agent battles) | **Fixed** (wording) |
| I4-10 | The census's read-only check could miss a computed member or a template expression | CONFIRMED (nit) | **Fixed** — the check walks the syntax tree |
| I4-11 | An unused `eslint-disable` | CONFIRMED (nit) | **Fixed** |

**Tally (lenses I1–I4): 30 findings (merging I2-2 into I1-4) — 26 CONFIRMED, 4 PARTIAL, 0 fully REFUTED.** The verifiers refuted *parts* of four (I3-1's severity and the reach of its fix, I3-3's "untyped" and two report claims, I3-5's scope, I4-9's feed claim) and narrowed two more (I1-3's fix as incomplete, I4-5's eviction claim as pre-existing). Caused by this build: I4-1 (high) and I4-2 (medium) in the guard test, plus low and nit items — all fixed in `a6557ab2`. No defect in the fix itself let a planted value reach a row, the score or a history outcome at `off`.

### 11.3 Mutation lens (I5)

Run last, on its own LF tree of the fix head `a6557ab2`, against the ten touched test files (321 rows green at baseline) plus three golden files: **207 single-point mutants** across the F1 guard, the F2 allowlist and its call sites, F3, the belief type-check, the leg caps and both census scripts — **171 caught, 12 equivalent, 24 survived.**
- **Every base revert is caught:** `battle.executionMode || 'autopilot'` at either guard; the whole-proposal history row; `...(proposal.evaluationMetadata || {})`; the stored day (metadata and argument); the stored snapshot; the stored ids; every `{...proposal}` / `{...meeting}` history row; removing `Object.freeze`; removing any `executorMetadata()` wrapper.
- **12 equivalent, each argued:** four type-guard relaxations that no caller can reach (every caller passes an object literal; `evaluations[]` ids are server strings); two belief-guard variants that differ only for values Firestore cannot store; one key-order move on a dormant row; and five leg-cap reversions on lines that run only after the slot and bench lookups matched by strict equality (the leg's strings then *are* the server's tickers).
- **24 survivors, all killed by nine rows** in `b333e8f5` (I5-A … I5-I), each proven to fail under its mutants and pass on the code: the dormant capture action and L1 receipt values (8 mutants, dormant), the launch-guard log's cap, the caps and reasoning strings pinned, the outcome list pinned whole (and the F3 rows now iterate the planted keys too), a non-string belief symbol, and the census verdict / guard-note / boundary rows (11 mutants). Spot-checked in the worktree after landing (the `closedTrade` outcome key removed; the census verdict losing its executions term): each caught.

---

## 12. How to run the two scripts (not run by this session)

Both are **read-only by construction** — `.select()`, `.get()` and `getAll()` only; each test pins every member call to a reviewed allowlist (the planted-proposal one walks the file's syntax tree, so a write hidden in a computed member or a template expression fails CI too). Each loads `.env.local` and the Admin SDK **only inside `main()`**. The founder runs them from the repo root.

**The detection census — did anyone use the hole?**
```bash
node scripts/census-planted-proposals.mjs --out docs/audits/20261008_PLANTED_PROPOSAL_CENSUS.md --json planted-census.json
```
It reads every agent battle and prints, from the launch guard's landing (`2026-05-20T17:17:29Z` — PR #421's merge `fcbd71c5`, carrying `84254065`; `--since=<ISO>` overrides):
- **§1 — executions after the guard:** every "Coach approved" / "Auto-executed" feed beat (the server's own record — the strongest evidence) and every history row resolved approved / auto-executed — including rows that claim a launch-guard clear or a failure while a same-pair trade sits beside them, and rows whose time cannot be read — each with the trade rows it matches (`lockedPoints · entry → exit · evaluationId`). Compare `lockedPoints` and the prices with the market at that time. (An approval that lapsed because its stock had left the bench also files `approved`: its beat says "could not execute" and no trade matches.)
- **§1b / §1c — attempts that did not get through:** launch-guard clears and failed approvals after the date (still planted proposals — no server path creates one).
- **§2 — trade rows with a key outside the executor's fields and the allowlist;** **§2b — rows that contradict themselves** (a gain its own prices do not imply; a row swapped out before the one it follows).
- **§3 — each battle's retained window.**

Exit code 2 when anything is found. **Run it soon:** the feed keeps 100 beats on an agent battle (one to two trading days), `trades[]` 50 rows and `proposalHistory[]` 50. A careful forger could keep a row self-consistent and let the beat age out — so it reports what the documents still hold, not all history.

**The P6 swap-identity census** — as P6 report §11, with the new §2 column: `node scripts/census-swap-identity.mjs --since=<the shadow flip's deploy> --out docs/audits/<date>_SWAP_IDENTITY_SHADOW_READ.md`. Read *enforce would refuse: battle_not_active* apart from the verdicts: those rows are swaps on a battle that had ended (or whose status could not be read), which `enforce` refuses before comparing the identity. The **meeting** rows are player-influenceable until §5 or §4 lands.

---

## 13. Out of scope — noted, not fixed (BUILD_RULES §3)

- **Score freeze through a crashing check** (I1-1, high, pre-existing): a planted `gameplanMeeting.suggestedSwaps` that is `[null]` or not a list, a `gameplanMeetingHistory` that is not a list, or a `strategyPreset` of `'constructor'` / `'toString'` makes every check throw before it saves the score; completion then decides from the frozen score. Also a pending meeting with a far expiry mutes the model indefinitely (I1-8), and any allowlisted field can be filled toward the 1 MiB document limit. **Filed as a separate task.**
- **Banked points lost past 50 trades** (I1-2 / IV1, pre-existing scoring bug): the executor keeps the last 50 rows (`agentSwapExecution.js:489`) and `bankedScore` sums only those (`agent-evaluate.js:1237`); any battle past 50 trades silently drops the oldest rows' points, and a planted meeting can trigger it on purpose. **Filed as a separate task.**
- **P6 at enforce after an ambiguous commit** (I3-3 / IV3): every caller would record "No trade was made." for a swap that landed, and the catch blocks release a tournament reservation for a stock the battle now holds — §10 Q3, before the enforce flip.
- **The voice layer's provenance relabel** from the launch-guard row (prompt module) — §10 Q2.
- **The cron's migration still writes `executionMode: 'copilot'`** when the field is absent (`agent-evaluate.js:961`) — harmless to execution now; a row label and the P6 census's fallback caller (§10 Q4). `battlePatternLogger.js:88` stores the raw mode (telemetry).
- **A dormant vetoed row keeps a planted `scoreAtProposal`** (rendered only for vetoed / lapsed rows, which no production path writes).
- **Season mode** turns Forge rule parameters into trades, but its crons are unscheduled (BUILD_RULES §6).

---

## 14. Branch and PR

Local branch `claude/integrity-proposal-forgery-6efbc1` (the app's suffix), pushed as `claude/integrity-proposal-forgery`. Commits in §0; this report is the last commit. **Pushed, PR opened, and stopped** — the founder reads CI, decides §5 and §10, and merges. Nothing here runs on a schedule; no cron entry is added. A byte-exact copy of this report is in the session scratchpad (BUILD_RULES §3). Two pre-existing issues are filed as separate tasks (§13).

*Build report — integrity: client-forged proposal data + P6 pre-enforce follow-ups, Claude Code, 7 October 2026, base `62d9d07e`.*
