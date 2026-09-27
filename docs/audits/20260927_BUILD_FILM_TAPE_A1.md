# Build report — Film Room Build A1: the tape (spec V1.2)

**Executor:** Opus (Claude Code) · **Date:** 2026-09-27 · **Spec (authoritative):** `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md`
**Branch:** `claude/hopeful-keller-0xgl6p` · **Cut from:** `origin/main` @ `ef80da13bd0ca7ccfa6ef975808a139412129fa2` (after `git fetch origin`) · **Scope:** A1 only (close pass, candle pass, hub helper, backfill entry, export script). No A2 screen work. No PR, no merge, no flag flip, no index deploy.

---

## Executive verdict (for Flash)

*(Filled in at the end of the build — see the bottom of this section once stages A–C are complete.)*

---

## 1. Gate results (spec §9, run before any code)

Every `file:line` below was read in this session at `ef80da13` (VERIFIED) unless marked otherwise.
The answers document's anchors were taken at `463a375f`; 165 commits separate the two SHAs, so every
one was re-located (item 3, appendix A).

### 1.0 Session record (BUILD_RULES §2, §3)

| Item | Value |
|---|---|
| First command | `git fetch origin` — exit 0 (new remote branches listed; no error) |
| Branch | `claude/hopeful-keller-0xgl6p` (the session's designated branch; its tip equalled `origin/main` at session start, so it is a fresh cut from `main`) |
| Cut SHA | `ef80da13bd0ca7ccfa6ef975808a139412129fa2` = `origin/main` = `HEAD` |
| `git status --porcelain` | empty (clean tree) |
| Fetch/deepen of history | none beyond `git fetch origin` |

### 1.1 The gate, item by item

| # | Spec §9 item | Result | Evidence |
|---|---|---|---|
| 1 | fetch; branch from `origin/main`; SHA; clean tree | **PASS** | §1.0 |
| 2 | Governing docs on `main` | **PASS** — all seven present at `origin/main` | spec `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md` (262 lines, `caadb3ec`); `docs/2026-09-22_CC_ARC_ANSWERS_TO_FILM_ROOM.md` (188, `539abfa0`); `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_3_20260915.md` (422, `caadb3ec`); `docs/audits/20260915_PHASE0B_FILM_ROOM_DISCOVERY.md` (886, `caadb3ec`); `docs/audits/20260915_PHASE0A_ARCHETYPE_IDENTITY_INVENTORY.md` (701, `caadb3ec`); `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` (124, `f152fccd`); `docs/audits/20260927_ASTRA_REVIEW_FILM_ROOM_SPEC_V1_1.md` (83, `caadb3ec`). Also present: `docs/specs/CAPTURE_BUILD_SPEC_V1_4.md`, `docs/audits/20260921_BUILD_TICK_CAPTURE.md`. PR #896 (`agentEvalRuns`, `tickMs`) is merged (`1ee84a07`). |
| 3 | Re-locate every answers-document anchor | **DONE** — appendix A (re-located by a read-only subagent on this checkout; the anchors the build depends on were re-read by the lead and are cited in §1.2) | appendix A |
| 4 | `TICK_CAPTURE_ENABLED === true`; `ticks` exist for ≥ 1 battle-day; fixture shapes | **PASS (flag) · production count UNVERIFIED IN SANDBOX** | `src/config/featureFlags.js:2717` `export const TICK_CAPTURE_ENABLED = true;`. The sandbox has no Firestore credentials (`FIREBASE_ADMIN_CREDENTIALS` unset), so the count of `agentBattles/*/ticks` documents per battle-day could not be run; **the founder runs it locally** (query in §1.4). Fixture shapes were taken from the writers at HEAD (§1.3) and, where the composer is pure, the fixtures are produced BY that composer (`buildCaptureDocuments`, `composeTickStamps`) so they cannot drift from it. |
| 5 | Scorer import + signature; required `asset` fields; persistent source of each replay input for both legs | **PASS with a finding — degrade, not STOP** | `api/_utils/agentScoring.js:224` `calculateAssetScoreServer(asset, priceChange, history = {}, extremes = {}, thresholdPriceChange = null)`; `asset` = `{ symbol, baseATR, tier, direction, tierMultiplier? }` (`:212-215`); `baseATR` defaults to 2.5 inside the scorer (`:225`). Per-leg table §1.2; **a fifth input the spec did not name** — the threshold baseline — has no persistent source in one case (§1.2, §5). |
| 6 | `fetchIntradayCandles` accepts `'1m'` and a date window; the regular-session clamp's export | **PASS with a qualification** | `api/_utils/marketDataCache.js:792` accepts `interval` (`:793`; `'1m'` documented `:785`). Its only window is `hoursBack` (`:800-804`): `from = now − hoursBack`, `to = now` — a NOW-anchored window, not an absolute date window. The candle pass therefore computes `hoursBack` from the target session's open so the window contains that session, and cuts everything outside it (no change to the fetcher — "a new caller, not new code", design note §6.2). The clamp is exported: `filterToLatestSession` (`:1040`; bounds `:963-966`, applied `:1067-1077`). It anchors on the **latest** ET date in the data, so the candle pass first filters bars to the target ET date, then applies the clamp. The clamp's upper bound is inclusive of 16:00 (`:1070-1073`); the platform's closing-row policy of record is `CLOSING_ROW_POLICY = 'continuous_session'` (`api/_utils/intradayConfig.js:84`; rationale `api/_utils/intraday/buckets.js:39-50`: the closing-auction print lands in the 16:00 row, "the clean continuous session is 09:30–15:59"), so rows starting at or after the calendar close are also excluded. |
| 7 | Film Room route id and entry points; is the legacy review only `dailyReviews[]` | **PASS** | The route is the App screen id **`'filmRoom'`** (`src/App.jsx:9465`), rendered with the battle object. Entry points: in-battle banner `src/App.jsx:9446` → `src/screens/AgentBattleScreen.jsx:2305-2307` (gated on `dailyReviews.length >= 1`); battle history `src/App.jsx:9734` → `src/screens/BattleHistoryScreen.jsx:322-324`; Command Dashboard `src/components/Dashboard/CommandDashboard.jsx:284` (desktop `src/components/Dashboard/CommandDashboardDesktop.jsx:192`). The legacy review is **only** `dailyReviews[]` on the battle document, appended at `api/cron/agent-batch-review.js:336`; no separate review document exists. Its queue flag is `reviewPending` (set by completion, `api/cron/agent-evaluate.js:6200`; drained by `findReviewPendingBattles`, `api/cron/agent-batch-review.js:43-51`; cleared in the same write as the append, `:335`). |
| 8 | Fence check | **PASS at gate; re-verified at the end (§2.5)** | `agentScoring.js`, `agentSwapExecution.js`, `agentBattleService.js`, `agentRiskManager.js`, `agentEvalPromptAssembly.js` read, not edited. The build only *imports* `calculateAssetScoreServer` (Stage B). |
| 9 | `vercel.json` entries before / after | **41 before** (`node -e` over the `crons` array); after: see §2.5 | — |
| 10 | Baseline suite on Linux | **PASS — 0 failing files** | `npx vitest run` (JSON reporter, output redirected): **805 files, 15,993 tests: 15,929 passed, 64 skipped, 0 failed; exit 0.** Rules suite on the emulator (`npm run test:rules`): **17 files, 311 tests passed; exit 0.** |

### 1.2 Item 5 in full — the replay inputs, per leg, and where each is durably recorded

The scorer is called on every agent path with **empty extremes** (held scoring
`api/cron/agent-evaluate.js:1150-1156`; sale lock `api/_utils/agentSwapExecution.js:248`), so the
replay passes `{}` too. Its inputs, and how the live evaluator fills them for a held position
(`api/cron/agent-evaluate.js:1107-1157`):

- `priceChange` = (price − entry) / entry × 100, entry = `swapPrice || startingPrices[sym]` (`:1109`);
- `thresholdPriceChange` = (price − baseline) / baseline × 100, **baseline** = `swapPrice`, else on
  the activation day `startingPrices[sym] || previousClose`, else the Guard-2-validated
  `previousClose` (`:1144-1148`; the executor uses the same precedence through `resolveThresholdBaseline`, `agentSwapExecution.js:218-233`);
- `history` = `battle.thresholdHistory[sym]` (`:1115`, `:1154`), the ratcheting multiplier extremes.

| Leg | Input | Persistent source (VERIFIED) | Gaps |
|---|---|---|---|
| **ghost** (sold name, as if never sold) | entry price | `ticks.actions[].entryPrice` (`captureContext.js:256-270`, permanent); `trades[].entryPrice` (`agentSwapExecution.js:255-273`, capped 50); receipt `guardrailReplay.outgoingEntryPrice` (`learningSchemas.js:155-156`) | none |
| | ATR | receipt `guardrailReplay.outgoingBaseATR` (`learningSchemas.js:157`). Risk and model paths record the **scoring** ATR, defaulted (`agent-evaluate.js:2160` `score.baseATR`; `:3402` `activeBaseATR ?? 2.5`); the proposal, R11 and gameplan paths record the raw slot value, null when the slot had none (`:4915`, `:5116`, `:5536`, `:5766`) | **none** when the receipt is absent or its value is null — the trade does not store ATR |
| | tier | `trades[].tier` (slot tier, `agentSwapExecution.js:259`); receipt `resolvedTier` | none when both are absent (`ticks.actions[]` carries no tier) |
| | threshold history | receipt `guardrailReplay.thresholdHistory` = `battle.thresholdHistory[symbolOut]` at the decision (`learningSchemas.js:161`; e.g. `agent-evaluate.js:3704`) | **none** without the receipt |
| | **threshold baseline** *(not named by the spec)* | derivable from recorded facts in two of three cases: **(a)** the position was swapped in the same trading day — receipt `outgoingSwappedInDay` non-null, because the nightly reset deletes `swappedInDay` together with `swapPrice` (`api/cron/agent-daily-scores.js:152-165`) — so baseline = `swapPrice` = the recorded entry price; **(b)** the swap happened on the battle's activation day (ET date of `swappedOutAt` = ET date of `activatedAt`, the evaluator's own test `agent-evaluate.js:1085-1088`) with a starting price, so baseline = `startingPrices[sym]` = the recorded entry price | **(c)** an original pick sold on a later day (or a battle deployed the evening before its session, where `isActivationDay` is false): baseline = the Guard-2-validated `previousClose` — **recorded nowhere** (trade, receipt, tick and entry all lack it; 0B §3-B2 lists the Guard-3 baseline among the executor's unpersisted intermediates, and the executor's `closedTrade` at `agentSwapExecution.js:255-273` confirms it at HEAD). **Degrade:** the ghost leg is `null` with `ghost.thresholdBaseline` in `missingInputs`. |
| **bought** (swapped-in name, from the swap) | entry price | receipt `entryMark` = `incomingAsset.swapPrice` (`learningSchemas.js:141`) | none without the receipt (the slot's `swapPrice` is mutable and cleared nightly) |
| | ATR | receipt `entryATR` = `incomingAsset.baseATR`, with `entryAtrSource` (`learningSchemas.js:142-148`) | none without the receipt |
| | tier | the same slot: `trades[].tier`; receipt `resolvedTier` | as ghost |
| | threshold history | **{ maxMultiplier: 0, minMultiplier: 0 }** — the executor resets it for the incoming symbol at the swap (`agentSwapExecution.js:307-311`); a code invariant, not a stored value | none |
| | threshold baseline | `swapPrice` (the position was swapped in at this instant) = the receipt `entryMark` | none without the receipt |

**Receipt coverage.** Receipts are written on all six executor paths (risk `agent-evaluate.js:2127`,
model `:3668`, approved proposal `:4880`, expired proposal `:5088`, R11 `:5515`, gameplan `:5740`),
gated on `LEARNING_L1_CAPTURE_ENABLED && LEARNING_L1_CAPTURE_EXPANSION_ENABLED` (both `true`,
`featureFlags.js:1167`, `:1187`) and `classifyEvidence(...) === 'live_agent'`; create-only at
`learningReceipts/{battleId}/receipts/{agentId}_seq{receiptSeq}` (`captureReceipt.js:405-421`), with
`timestamp = closedTrade.swappedOutAt` — the BA-5 join key.

Crypto legs are out of scope by BA-3 and carry `replay: null` with reason `crypto_not_supported`.

### 1.3 Item 4 — fixture shapes, from the writers at HEAD (production unreachable)

| Source | Shape at HEAD | Writer |
|---|---|---|
| `evaluations[].candidates` | `[{ symbol, direction, signalSummary, threshold, signalSource? }]`, key absent when none | `api/_utils/tickStamps.js:293-309`, spread `api/cron/agent-evaluate.js:4111-4128` under `TICK_STAMPS_ENABLED && promptBuilt` |
| `evaluations[].heard` | `{ directiveThreadId, suppressed: null \| 'malformed' \| 'mode_not_enforce' \| 'epoch_killed' }`, absent when no directive was active | `tickStamps.js:138-151` |
| `evaluations[].evidence` | `{ [heldSym]: { px, chg, atrX, vwapDev, bbPct, nr7, regime, risk } }` | `tickStamps.js:192-210`; its observation instant is the entry's `promptBuiltAt` (`agent-evaluate.js:2724-2725`), which is non-null whenever a stamp exists (same gate) |
| entry identity/timing | `evalId, timestamp (ISO, after the model returned — agent-evaluate.js:3156), day, decision, scores {active,banked,total}, rationale, hypothesis, haikuError, promptBuiltAt, tickMs, holdKind` | `agent-evaluate.js:3922-3991`; array `slice(-150)` `:4257`; `tickMs` restamped `:4382` |
| `chatExchanges[].archetypeGate` | `{ classification, selectedAdjustmentId, status, repairUsed, originalUserAsk, counterOfferText, rejectionReason, fitCheck? }`; exchange `{ userMessage, agentResponse, hasDirective, directive, directiveThreadId, timestamp, mode, archetypeGate? }` | `api/agent/chat.js:1025-1067`; `directive` = `buildDirectiveRecord` `{ text, expiry, directiveThreadId, adjustmentId?, canonicalTextVersion? }` (`api/_utils/directiveFiling.js:29-43`) |
| `ticks.actions[]` | `{ actionId: '${tickId}:${n}', n, kind: 'swap', source, exitReason, symbolOut, symbolIn, swappedOutAt, lockedPoints, entryPrice, committed }` | `api/_utils/tickCapture/captureContext.js:256-270` |
| `ticks/{tickId}` | `tickId = '${battleId}:${tickSeq}'` (`captureContext.js:133`); `capturedAt` ISO (`captureWriter.js:169`); `exitReason`, `stageReached`, `model.{outcome, failureClass}`, `risk.verdicts.{sym}.{action,reason}`, `guardrail.{evaluated, deployedCount}`, `decision.{original, final, holdKind}`, `controls.{directiveThreadId, directiveSuppressed}`, `scores.{active, banked, total, opponent, bankedBadgePoints}`, `evalId` | `captureWriter.js:214-347` |
| `agentEvalRuns/{runId}` | `runId` = the run's start ISO (`agent-evaluate.js:370`); `{ startedAt, endedAt, wallMs, budgetMs, battlesTotal, evaluated, lockSkipped, deferred, deferredBattleIds (first 200), deferredTruncated (COUNT of unlisted ids), triggered, modelCalls, budgetSkipped }`. **The deferral instant is not persisted** (`evalRun.deferredAt` stays in memory) — the tape uses the run's `startedAt` as "that run's time". | `agent-evaluate.js:538-557`, cap `:514`, written `:572` |
| `calls/{callId}` | `{ callId, kind, battleId, evalId, evalSeq, mintedAt (ms), symbol, direction, slot, counterpart, condition, horizon: { phrase, expiresAt (ms), basis }, defaultAction, said, evidence: { tickId, availability, priceAsOf }, hypothesisRef, origin, provenanceReason?, state, stateChangedAt (ms), stateSource, playerResponse, directiveThreadId, outcome, refused }` | `api/_utils/callRecords/candidate.js:141-172`. **The record carries no minting mode** — so `recordMode` is always `null` (BA-16: never inferred). There is no `resolvedAt` field; the tape reports `resolvedAt = stateChangedAt` for a non-`open` state, and says so. |
| `declarations/{evalId}` | create-once per check, only when the block is non-null; the entry carries `declarationsPhase: 'none' \| 'expected'` at shadow/on | contract §2.1; entry `agent-evaluate.js:4145` |

### 1.4 The production count the founder runs (item 4)

```
# READ-ONLY — Admin SDK, one project. Counts tick documents per battle per ET date since the flip.
node -e "…collectionGroup('ticks').where('capturedAt','>=','2026-09-21T04:00:00Z').select('battleId','capturedAt').get() → group by battleId × ET date"
```
(The export script shipped in Stage C, `scripts/export-film-tape.js`, reads the same records; the
tick-capture export `scripts/export-tick-capture.js --from 2026-09-21` already prints coverage.)

### 1.5 Findings the gate raised (carried into the build, none a STOP)

1. **A fifth scorer input** (threshold baseline) has no persistent source for an original pick sold
   on a non-activation day — degrade per item 5 (§1.2, §5).
2. **The fetcher's window is NOW-anchored** (`hoursBack`), not an absolute date window; the candle
   pass computes it from the target session (§1.1 item 6).
3. **The run record keeps no deferral instant** — "check deferred" rows carry the run's `startedAt`.
4. **Call records carry no minting mode** — `recordMode` is always `null`.
5. **`evaluations[]` carry no `tickSeq`** — the spec's ticks fallback ("the `tickSeq` range from the
   day's first and last `evaluations[]` entries") is not constructible; the fallback reads the
   battle's `ticks` ordered by `tickSeq` and filters to the ET date instead.
6. **Budget-skipped and failed-call entries carry platform-authored rationale text**
   ("Evaluation skipped — cron budget too low…", "Haiku call failed — defaulting to HOLD",
   `agent-evaluate.js:3931-3934`). BA-22 renders `rationale` as "the agent's words", so those rows
   are not copied into `rationale[]`; the check's own state carries the fact.

*(Appendix A — the anchor re-location table — follows §6.)*
