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

---

## Appendix A — answers-document anchors re-located (spec §9 item 3)

Produced by a read-only subagent on this checkout (no writes, no git state change), from the
answers document at `463a375f` to HEAD `ef80da13`. **Lead spot-checks (re-read at HEAD by the lead):**
rows 1 (`agent-evaluate.js:183`), 2 (`:208`), 61 (`:3938`), 82 (`:4257`), 103 (`:6265`), 131
(`captureWriter.js:214-215`) and 267 (`agentEvalTransport.js:178-188`) — all match. The "another
session" the method paragraph mentions is this build (its own report and flag edits, made while the
subagent ran); no reported line shifted.

### Anchor relocation: `docs/2026-09-22_CC_ARC_ANSWERS_TO_FILM_ROOM.md`, OLD → NEW

**OLD** `463a375fc4192c51dfa1cce669ff8a5a13305c6a` (the SHA every anchor in the answers doc was taken at) → **NEW** `ef80da13bd0ca7ccfa6ef975808a139412129fa2` (HEAD, 165 commits later; OLD is an ancestor; `git status` showed no tracked modifications, so every cited file on disk is HEAD's blob). **Method:** I aligned OLD and NEW for every cited file with a full-context `git diff -U100000000 OLD NEW -- <file>`. Unchanged context lines map one-to-one. For each anchor I printed the OLD range with `git show OLD:<path> | sed -n 'A,Bp'` and the mapped NEW range with `sed -n` on the working tree, then compared the two outputs byte for byte. **SAME** and **MOVED** rows are byte-identical and contiguous. **CHANGED** rows were diffed OLD against NEW, and the diff is summarised in the row. Every NEW line number in this file was printed with `sed`/`grep` at NEW in this session. The pass was read-only: nothing in the repo or in git state was touched, and I ran no `git fetch` because both SHAs are local. After my reads, another session (branch `claude/hopeful-keller-0xgl6p`) began uncommitted appends to `featureFlags.js` (after `:2829`) and `flagPinGuard.test.js` (after `:179`). I re-checked every anchor in those two files against `git show HEAD:`, and no reported line shifts.

**Scope:** 378 code-anchor citations in the answers doc, deduped to **316 distinct anchors** across 43 files. Anchors into `docs/**/*.md` are excluded (spec V1.4 `:29-47`, `:41`, `:94`, …; audit docs). The answers doc was added once, in `539abfa0`, and has not been edited since. 33 of the 43 cited files are byte-identical between OLD and NEW, so all their anchors are SAME. Only 10 files changed: `agent-evaluate.js`, `featureFlags.js`, `flagPinGuard.test.js`, `captureConfig.js`, `captureWriter.js`, `captureSerializer.js`, `captureContext.js`, `agentEvalTransport.js`, `firestore.rules` and `firestore.indexes.json`.

**Legend.** *Section* is the answers-doc section, then the doc line(s) (`L…`) where the anchor is cited. Rows are ordered by the build-priority file list, then by OLD line. **†** means the doc cites a bare `:NNN` whose nearest explicitly named file is a *different* file. I resolved it by content and file length, and the alternative file's lines do not match. For example, §B2's `:242-248` / `:69-73` / `:108-110` / `:112-123` / `:162-178` … come after `chat.js:1080-1082` but are **directiveGate.js**. §D4's `:255-273` comes after an audit `.md` but is **agentSwapExecution.js**. §E3's `:2341-2343` / `:2372-2385` … come after `featureFlags.js:1482` but are **agent-evaluate.js**; featureFlags.js OLD 2341-2385 is the tick-stamps and SHOW IT docstrings. The F1 table's bare numbers follow the doc's own convention ("All writers are in `api/cron/agent-evaluate.js` unless named", L124) and are not marked. No anchor remained ambiguous after these checks. **‡** means the line the doc cites does not hold what the doc says is there, **even at OLD**. The correct line is given in the row.

| # | answers-doc section | anchor @OLD | what is there (≤12 words) | anchor @NEW | status |
|---|---|---|---|---|---|
| 1 | §A3 — L56 | `api/cron/agent-evaluate.js:170` | `TIME_BUDGET_MS = 290_000` handler time budget | `api/cron/agent-evaluate.js:183` | MOVED |
| 2 | §E1 — L112 | `api/cron/agent-evaluate.js:195` | first capture hook: observing fetch under `TICK_CAPTURE_ENABLED` | `api/cron/agent-evaluate.js:208` | MOVED |
| 3 | §0 r8 · §A3 — L22, L56 | `api/cron/agent-evaluate.js:390-396` | time-budget break: deferred count, log line, `summary.skipped` | `api/cron/agent-evaluate.js:423-436` | CHANGED: deferred set is now `activeBattles.slice(index)`; ids stored on `evalRun.deferredBattleIds`/`deferredAt` (:429-431); new `summary.deferred` (:432) |
| 4 | §A3 — L56 | `api/cron/agent-evaluate.js:394` | `summary.skipped += remaining` (budget deferrals) | `api/cron/agent-evaluate.js:432-433` | CHANGED: `summary.skipped += remaining` replaced by `summary.deferred += deferred.length` (:432) + `summary.skipped += deferred.length` (:433) |
| 5 | §F2 — L135 | `api/cron/agent-evaluate.js:679-688` | `cronState.tickSeq` minted +1 inside the admission transaction | `api/cron/agent-evaluate.js:848-857` | MOVED |
| 6 | §A3 — L56 | `api/cron/agent-evaluate.js:691-694` | lock-skip branch: log, `summary.skipped++`, return | `api/cron/agent-evaluate.js:860-867` | CHANGED: `summary.lockSkipped` counter + comment inserted (:862-865); `summary.skipped++` kept (:866) |
| 7 | §F1 C-3 · §F2 — L130, L145 | `api/cron/agent-evaluate.js:805` | `STATUS_FEED_CAP = battle.agentId ? 100 : 50` | `api/cron/agent-evaluate.js:1000` | MOVED |
| 8 | §F1 C-1 — L128 | `api/cron/agent-evaluate.js:869-870` | capture stage `quotes_checked`, exit `degraded_quotes` | `api/cron/agent-evaluate.js:1066-1067` | MOVED |
| 9 | §A3 · §A4 — L58, L62 | `api/cron/agent-evaluate.js:1026-1030` | `scoreState` active/banked/current/opponent/lastScoredAt writes | `api/cron/agent-evaluate.js:1223-1227` | MOVED |
| 10 | §0 r6 — L20 | `api/cron/agent-evaluate.js:1037-1045` | capture stages + `tickCapture.scores({...})` | `api/cron/agent-evaluate.js:1234-1242` | MOVED |
| 11 | §A3 — L58 | `api/cron/agent-evaluate.js:1037-1046` | capture stages, `tickCapture.scores(...)`, `tickCapture.universe(...)` | `api/cron/agent-evaluate.js:1234-1243` | MOVED |
| 12 | §A4 · §F1 C-5 — L66, L131 | `api/cron/agent-evaluate.js:1039-1045` | `tickCapture.scores({ active, banked, total, opponent, bankedBadgePoints })` | `api/cron/agent-evaluate.js:1236-1242` | MOVED |
| 13 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:1046` | `tickCapture.universe({ heldSymbols, benchSymbols, candidateSymbols })` | `api/cron/agent-evaluate.js:1243` | MOVED |
| 14 | §A4 — L62 | `api/cron/agent-evaluate.js:1051-1052` | `scoreState.peakScore` / `peakScoreAt` writes | `api/cron/agent-evaluate.js:1248-1249` | MOVED |
| 15 | §F1 C-1 — L128 | `api/cron/agent-evaluate.js:1091` | capture exit `cpu_passive` | `api/cron/agent-evaluate.js:1293` | MOVED |
| 16 | §B1 — L75 | `api/cron/agent-evaluate.js:1486-1503` | `recordControlEpochIfNeeded({...})` args + catch (call opens :1484/:1691) | `api/cron/agent-evaluate.js:1693-1710` | MOVED |
| 17 | §F1 C-3 — L130 | `api/cron/agent-evaluate.js:1513` | VWAP strike with `vwapDeadBandPct ?? 0.5` dead band | `api/cron/agent-evaluate.js:1720` | MOVED |
| 18 | §F1 C-1 — L128 | `api/cron/agent-evaluate.js:1543-1552` | `evaluateRisk(...)` per held symbol into `riskStatus` | `api/cron/agent-evaluate.js:1750-1759` | MOVED |
| 19 | §0 r6 · §A3 · §F1 C-1 — L20, L58, L128 | `api/cron/agent-evaluate.js:1566-1577` | `tickCapture.risk({ verdicts{action,reason}, three counts })` | `api/cron/agent-evaluate.js:1773-1784` | MOVED |
| 20 | §D4 — L106 | `api/cron/agent-evaluate.js:1748-1757` | risk-exit metadata: `evaluationId: risk_…`, `exitReason`, `source` | `api/cron/agent-evaluate.js:1955-1964` | MOVED |
| 21 | §F1 C-3 — L130 | `api/cron/agent-evaluate.js:1845-1858` | status-feed entry `Risk: ${detail}`, `citedRules`, `triggeredBy` | `api/cron/agent-evaluate.js:2052-2065` | MOVED |
| 22 | §C2 — L95 | `api/cron/agent-evaluate.js:2133-2146` | gameplan `skip_haiku`: deterministic pass, update, exit `gameplan_pending` | `api/cron/agent-evaluate.js:2351-2374` | CHANGED: additive Calls wiring: `callsCtx` passed to the pass (:2352), observation freeze (:2356-2363), `runExitCallsHook` after the capture exit (:2371-2372) |
| 23 | §0 r6 · §F1 C-1 — L20, L128 | `api/cron/agent-evaluate.js:2286-2313` | risk/trigger stages, universe, no-trigger path to `exit('no_trigger')` | `api/cron/agent-evaluate.js:2526-2563` | CHANGED: Calls observation freeze inserted between the feed append and the update (:2548-2557) |
| 24 | §A3 — L58 | `api/cron/agent-evaluate.js:2287` | `tickCapture.stage('trigger_evaluated')` | `api/cron/agent-evaluate.js:2527` | MOVED |
| 25 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:2288-2292` | `tickCapture.universe({ held, bench, candidates })` | `api/cron/agent-evaluate.js:2528-2532` | MOVED |
| 26 | §0 r6 · §A3 — L20, L58 | `api/cron/agent-evaluate.js:2295-2315` | `if (!shouldEvaluate)` early return: one update, no entry | `api/cron/agent-evaluate.js:2535-2567` | CHANGED: Calls freeze (:2548-2557) before the update and `runExitCallsHook` after the capture exit (:2564-2565); live because `CALL_RECORDS_MODE = 'shadow'` |
| 27 | §A3 — L58 | `api/cron/agent-evaluate.js:2302` | `cronState.triggerGatePassCount` increment | `api/cron/agent-evaluate.js:2542` | MOVED |
| 28 | §A3 · §F1 C-3 — L58, L130 | `api/cron/agent-evaluate.js:2303` | `finalizeCronState(scoreUpdate, { vwapTicks, … })` | `api/cron/agent-evaluate.js:2543` | MOVED |
| 29 | §A3 — L58 | `api/cron/agent-evaluate.js:2304-2307` | status-feed append capped at `STATUS_FEED_CAP` | `api/cron/agent-evaluate.js:2544-2547` | MOVED |
| 30 | §A3 — L58 | `api/cron/agent-evaluate.js:2308` | `await battleRef.update(scoreUpdate)` — the no-trigger write | `api/cron/agent-evaluate.js:2558` | MOVED |
| 31 | §A3 — L58 | `api/cron/agent-evaluate.js:2312` | `tickCapture.exit('no_trigger')` | `api/cron/agent-evaluate.js:2562` | MOVED |
| 32 | §E3 — L116 | `api/cron/agent-evaluate.js:2341-2343` † | `let guardrailFault = null`, separate from `haikuFailure` | `api/cron/agent-evaluate.js:2593-2595` | MOVED |
| 33 | §A3 — L57 | `api/cron/agent-evaluate.js:2371` | `budget = shouldStartHaikuCall({ elapsedMs, timeBudgetMs })` | `api/cron/agent-evaluate.js:2626` | CHANGED: call now passes `callsReserveMs: callsReserveMsFor(callsCtx.mode)` (+4,000 ms at shadow/on); comment :2623-2625 |
| 34 | §E3 — L116 | `api/cron/agent-evaluate.js:2372-2385` † | `refreshFailure` → `failureClass: 'refresh_failed'`, fallback HOLD | `api/cron/agent-evaluate.js:2627-2640` | MOVED |
| 35 | §A3 — L57 | `api/cron/agent-evaluate.js:2386-2393` | `!budget.proceed` → `budget_skipped`, `fallbackHold = true` | `api/cron/agent-evaluate.js:2641-2648` | MOVED |
| 36 | §A3 — L57 | `api/cron/agent-evaluate.js:2395-2397` | `tickCapture.model({ outcome: 'failed', failureClass: 'budget_skipped' })` | `api/cron/agent-evaluate.js:2662-2664` | MOVED |
| 37 | §B3 — L88 | `api/cron/agent-evaluate.js:2547` † | `tickCapture.originalToolResult(toolUse?.input)` — pre-lint copy | `api/cron/agent-evaluate.js:2838` | MOVED |
| 38 | §E1 · §E3 — L112, L116 | `api/cron/agent-evaluate.js:2731-2741` † | `evalSeq` minted from `cronState.evalSeq`; `evalId` | `api/cron/agent-evaluate.js:3033-3043` | MOVED |
| 39 | §B3 — L88 | `api/cron/agent-evaluate.js:2769-2770` | `lintEnforcing` / `lintActive` from the lint mode | `api/cron/agent-evaluate.js:3071-3072` | MOVED |
| 40 | §B3 — L88 | `api/cron/agent-evaluate.js:2773-2779` | `buildPresentSignals({...})` from the tick's in-memory objects | `api/cron/agent-evaluate.js:3075-3081` | MOVED |
| 41 | §B3 — L88 | `api/cron/agent-evaluate.js:2782-2830` | per-candidate threshold lint: keep/drop, console + GCS receipts | `api/cron/agent-evaluate.js:3084-3132` | MOVED |
| 42 | §B3 — L88 | `api/cron/agent-evaluate.js:2797-2803` † | comment: the 'on' flip PR owes a durable receipt | `api/cron/agent-evaluate.js:3099-3105` | MOVED |
| 43 | §B3 — L88 | `api/cron/agent-evaluate.js:2804-2807` | console line: threshold lint DROPPED/flagged | `api/cron/agent-evaluate.js:3106-3109` | MOVED |
| 44 | §B3 — L88 | `api/cron/agent-evaluate.js:2808-2830` | `logAnticipation({ errorStep: 'threshold_absent_signal', … })` GCS record | `api/cron/agent-evaluate.js:3110-3132` | MOVED |
| 45 | §F1 C-1 — L128 | `api/cron/agent-evaluate.js:2984` | `tickCapture.guardrail({ faultClass: 'guardrail_error' })` | `api/cron/agent-evaluate.js:3286` | MOVED |
| 46 | §F1 C-1 — L128 | `api/cron/agent-evaluate.js:2996-3003` | `tickCapture.guardrail({ sourceNote, overrideCount, evaluated, deployedCount })` | `api/cron/agent-evaluate.js:3298-3305` | MOVED |
| 47 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3017-3023` | `tickCapture.check('lock', …)` | `api/cron/agent-evaluate.js:3319-3325` | MOVED |
| 48 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3036-3044` | `tickCapture.check('distressedVeto', …)` | `api/cron/agent-evaluate.js:3338-3346` | MOVED |
| 49 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3052-3059` | `tickCapture.check('proposedPairValidation', …)` | `api/cron/agent-evaluate.js:3354-3361` | MOVED |
| 50 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3065-3071` | `tickCapture.check('conviction', { status: 'unknown' })` | `api/cron/agent-evaluate.js:3367-3373` | MOVED |
| 51 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3130` | `tickCapture.check('hurdle', …)` | `api/cron/agent-evaluate.js:3432` | MOVED |
| 52 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3138` | `tickCapture.check('swapCap', …)` | `api/cron/agent-evaluate.js:3440` | MOVED |
| 53 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3244` | `tickCapture.check('reservation', …)` | `api/cron/agent-evaluate.js:3546` | MOVED |
| 54 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3256` | `tickCapture.check('execution', …)` | `api/cron/agent-evaluate.js:3558` | MOVED |
| 55 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3288` | `check('execution', { status: 'evaluated', result: 'passed' })` | `api/cron/agent-evaluate.js:3592` | MOVED |
| 56 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3446-3450` | `check('execution', { status: 'failed' })` after executor throw | `api/cron/agent-evaluate.js:3750-3754` | MOVED |
| 57 | §B1 — L75 | `api/cron/agent-evaluate.js:3573` | status-feed `directiveThreadId` (model echo), proposal entry | `api/cron/agent-evaluate.js:3877` | MOVED |
| 58 | §B1 — L75 | `api/cron/agent-evaluate.js:3593` | status-feed `directiveThreadId` (model echo), swap/hold entry | `api/cron/agent-evaluate.js:3897` | MOVED |
| 59 | §A3 — L57 | `api/cron/agent-evaluate.js:3618` | `const evaluation = {` — entry composition opens | `api/cron/agent-evaluate.js:3922` | MOVED |
| 60 | §A3 — L57 | `api/cron/agent-evaluate.js:3627-3630` | placeholder rationale 'Evaluation skipped — cron budget too low…' | `api/cron/agent-evaluate.js:3931-3934` | MOVED |
| 61 | §B1 — L75 | `api/cron/agent-evaluate.js:3634` | `ignoredDirectiveIds` on the entry (model echo) | `api/cron/agent-evaluate.js:3938` | MOVED |
| 62 | §B1 — L75 | `api/cron/agent-evaluate.js:3636` | `directiveThreadId` on the entry (model echo) | `api/cron/agent-evaluate.js:3940` | MOVED |
| 63 | §F1 C-1 — L128 | `api/cron/agent-evaluate.js:3641` | `triggers: triggers.map(t => t.type)` | `api/cron/agent-evaluate.js:3945` | MOVED |
| 64 | §F1 C-5 — L131 | `api/cron/agent-evaluate.js:3642-3646` | entry `scores: { active, banked, total }` | `api/cron/agent-evaluate.js:3946-3950` | MOVED |
| 65 | §F1 C-3 — L130 | `api/cron/agent-evaluate.js:3651` | `guardrailOverrides` on the entry | `api/cron/agent-evaluate.js:3955` | MOVED |
| 66 | §A3 · §E3 — L57, L116 | `api/cron/agent-evaluate.js:3657` | `haikuError: { ...haikuFailure, evalId }` | `api/cron/agent-evaluate.js:3961` | MOVED |
| 67 | §E3 — L116 | `api/cron/agent-evaluate.js:3664-3666` | `promptBuiltAt`, `buildMs`, `callMs` (NEW also adds `tickMs` :3975) | `api/cron/agent-evaluate.js:3972-3974` | MOVED |
| 68 | §A3 · §E3 — L57, L116 | `api/cron/agent-evaluate.js:3678` † | `holdKind: 'default_failure'` on a fallback HOLD | `api/cron/agent-evaluate.js:3987` | MOVED |
| 69 | §E3 — L116 | `api/cron/agent-evaluate.js:3681` † | `guardrailFault: { ...guardrailFault, evalId }` — own field | `api/cron/agent-evaluate.js:3990` | MOVED |
| 70 | §E1 — L112 | `api/cron/agent-evaluate.js:3686-3738` | intraday hook comment + `INTRADAY_DIAGNOSTIC_ENABLED` branch | `api/cron/agent-evaluate.js:3995-4047` | MOVED |
| 71 | §E3 — L116 | `api/cron/agent-evaluate.js:3696` | `if (INTRADAY_DIAGNOSTIC_ENABLED) {` | `api/cron/agent-evaluate.js:4005` | MOVED |
| 72 | §0 r5 — L19 | `api/cron/agent-evaluate.js:3696-3738` | diagnostic branch: view build/write + pointer-field composer | `api/cron/agent-evaluate.js:4005-4047` | MOVED |
| 73 | §E3 — L116 | `api/cron/agent-evaluate.js:3713` | `writeIntradayView(db, { battleId, view })` | `api/cron/agent-evaluate.js:4022` | MOVED |
| 74 | §E3 — L116 | `api/cron/agent-evaluate.js:3728-3738` | `Object.assign(evaluation, composeIntradayEntryFields({...}))` | `api/cron/agent-evaluate.js:4037-4047` | MOVED |
| 75 | §A3 · §B1 — L57, L75 | `api/cron/agent-evaluate.js:3762` † | `if (TICK_STAMPS_ENABLED && promptBuilt) {` | `api/cron/agent-evaluate.js:4071` | MOVED |
| 76 | §B1 — L76 | `api/cron/agent-evaluate.js:3798-3800` | `tickCapture.controls / controlsText / controlSourceText` | `api/cron/agent-evaluate.js:4107-4109` | MOVED |
| 77 | §B3 — L86 | `api/cron/agent-evaluate.js:3802-3805` | `composeTickStamps({ promptBuilt, controlResolution, …` (linted candidates) | `api/cron/agent-evaluate.js:4111-4114` | MOVED |
| 78 | §B1 — L75 | `api/cron/agent-evaluate.js:3802-3821` | `Object.assign(evaluation, composeTickStamps({...}))` + catch | `api/cron/agent-evaluate.js:4111-4130` | MOVED |
| 79 | §F2 — L163 | `api/cron/agent-evaluate.js:3837` | `tickCapture.identify({ evalId, day, battlePhase })` | `api/cron/agent-evaluate.js:4156` | MOVED |
| 80 | §F1 C-2 — L129 | `api/cron/agent-evaluate.js:3862` | manifest `evidenceKeys: Object.keys(evaluation.evidence)` | `api/cron/agent-evaluate.js:4181` | MOVED |
| 81 | §A3 — L57 | `api/cron/agent-evaluate.js:3872-3893` | `eval_degraded` status-feed beat on `haikuFailure \|\| guardrailFault` | `api/cron/agent-evaluate.js:4191-4212` | MOVED |
| 82 | §A2 · §A4 · §E3 · §F2 — L53, L65, L116, L145 | `api/cron/agent-evaluate.js:3938` † | `evaluations = [...].slice(-150)` | `api/cron/agent-evaluate.js:4257` | MOVED |
| 83 | §A4 · §E3 — L65, L116 | `api/cron/agent-evaluate.js:3951` † | `scoreState.evaluationCount: evaluations.length` | `api/cron/agent-evaluate.js:4270` | MOVED |
| 84 | §A4 — L62 | `api/cron/agent-evaluate.js:3951-3954` | `evaluationCount` + `holdCount` writes | `api/cron/agent-evaluate.js:4270-4273` | MOVED |
| 85 | §A3 — L57 | `api/cron/agent-evaluate.js:3964` | `totalHaikuCalls` increments only when `haikuAttempted` | `api/cron/agent-evaluate.js:4283` | MOVED |
| 86 | §A3 — L57 | `api/cron/agent-evaluate.js:3969` | `lastEvalStartedAt` written only when `haikuAttempted` | `api/cron/agent-evaluate.js:4288` | MOVED |
| 87 | §A3 — L57 | `api/cron/agent-evaluate.js:3978-3981` | `consecutiveEvalFailures` via `nextConsecutiveEvalFailures(...)` | `api/cron/agent-evaluate.js:4297-4300` | MOVED |
| 88 | §E3 — L116 | `api/cron/agent-evaluate.js:3982-3986` † | evalSeq comment + `'cronState.evalSeq': evalSeq` | `api/cron/agent-evaluate.js:4301-4305` | MOVED |
| 89 | §A3 · §E1 — L57, L112 | `api/cron/agent-evaluate.js:3986` | `'cronState.evalSeq': evalSeq` on the append update | `api/cron/agent-evaluate.js:4305` | MOVED |
| 90 | §F2 — L145 | `api/cron/agent-evaluate.js:3996` † | ‡ comment 'The ≤20 cap is…'; `.slice(-20)` is :4018/:4337 | `api/cron/agent-evaluate.js:4315` | MOVED |
| 91 | §A3 — L57 | `api/cron/agent-evaluate.js:3998-4006` | `faultRows.push({...haikuFailure...})` → `cronState.cronErrors` | `api/cron/agent-evaluate.js:4317-4325` | MOVED |
| 92 | §B1 — L76 | `api/cron/agent-evaluate.js:4224-4249` | `effectiveControlFacts()` — directive/lean ids, hashes, `controlEpoch` | `api/cron/agent-evaluate.js:4574-4599` | MOVED |
| 93 | §B1 — L76 | `api/cron/agent-evaluate.js:4252-4259` | `effectiveControlText()` — `directiveText`, `standingLeanTexts` | `api/cron/agent-evaluate.js:4602-4609` | MOVED |
| 94 | §E1 — L112 | `api/cron/agent-evaluate.js:4280` | `if (!TICK_CAPTURE_ENABLED) return;` — last capture hook | `api/cron/agent-evaluate.js:4630` | MOVED |
| 95 | §A4 — L64 | `api/cron/agent-evaluate.js:5637` | `result` = win/loss/draw from the scores | `api/cron/agent-evaluate.js:5999` | MOVED |
| 96 | §A4 — L64 | `api/cron/agent-evaluate.js:5692` | `export async function completeBattle(...)` | `api/cron/agent-evaluate.js:6054` | MOVED |
| 97 | §A4 — L62 | `api/cron/agent-evaluate.js:5727-5729` | reads cached `fresh.scoreState.currentScore` inside the transaction | `api/cron/agent-evaluate.js:6089-6091` | MOVED |
| 98 | §A4 · §F1 C-5 — L64, L131 | `api/cron/agent-evaluate.js:5812-5847` | completion `updatePayload`: status, completedAt, pendingReflection, feed | `api/cron/agent-evaluate.js:6174-6209` | MOVED |
| 99 | §F2 — L141 | `api/cron/agent-evaluate.js:5813` | `status: 'completed'` | `api/cron/agent-evaluate.js:6175` | MOVED |
| 100 | §A4 — L64 | `api/cron/agent-evaluate.js:5840-5846` | `battle_complete` status-feed entry carrying `score` | `api/cron/agent-evaluate.js:6202-6208` | MOVED |
| 101 | §A4 — L64 | `api/cron/agent-evaluate.js:5842` | `message: disposition.statusMessage` (the feed sentence) | `api/cron/agent-evaluate.js:6204` | MOVED |
| 102 | §A4 — L64 | `api/cron/agent-evaluate.js:5850-5852` | `completionContext` for tournament battles | `api/cron/agent-evaluate.js:6212-6214` | MOVED |
| 103 | §A4 · §F1 C-5 — L64, L131 | `api/cron/agent-evaluate.js:5903` | `const result = disposition.result` (agent-stats path) | `api/cron/agent-evaluate.js:6265` | MOVED |
| 104 | §F2 — L135 | `api/_utils/tickCapture/captureConfig.js:38` | `TICK_CAPTURE_SCHEMA_VERSION = 1` (NEW adds v2 at :46) | `api/_utils/tickCapture/captureConfig.js:38` | SAME |
| 105 | §F2 — L163 | `api/_utils/tickCapture/captureConfig.js:41` | `TICK_CAPTURE_DEADLINE_MS = 3_000` | `api/_utils/tickCapture/captureConfig.js:78` | MOVED |
| 106 | §F2 — L163 | `api/_utils/tickCapture/captureConfig.js:44` | `TICK_CAPTURE_MIN_REMAINING_BUDGET_MS = 10_000` | `api/_utils/tickCapture/captureConfig.js:81` | MOVED |
| 107 | §A2 · §F2 — L53, L144 | `api/_utils/tickCapture/captureConfig.js:63` | `TICK_CAPTURE_BODY_RETENTION_DAYS = 120` | `api/_utils/tickCapture/captureConfig.js:100` | MOVED |
| 108 | §F2 — L135 | `api/_utils/tickCapture/captureConfig.js:66-67` | `TICKS_SUBCOLLECTION` / `TICK_BODIES_SUBCOLLECTION` names | `api/_utils/tickCapture/captureConfig.js:103-104` | MOVED |
| 109 | §0 r8 · §A3 — L22, L56 | `api/_utils/tickCapture/captureConfig.js:69-73` | docstring: lease refusal and budget deferral are pre-admission | `api/_utils/tickCapture/captureConfig.js:106-110` | MOVED |
| 110 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:75-84` | `EXIT_REASONS` — the eight exits | `api/_utils/tickCapture/captureConfig.js:112-121` | MOVED |
| 111 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:87-99` | `STAGES` — admitted … finalized | `api/_utils/tickCapture/captureConfig.js:124-136` | MOVED |
| 112 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:101-106` | docstring: the shipped `failureClass` values | `api/_utils/tickCapture/captureConfig.js:138-143` | MOVED |
| 113 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:108` | `MODEL_OUTCOMES = ['ok','failed','not_attempted']` | `api/_utils/tickCapture/captureConfig.js:145` | MOVED |
| 114 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:118` | `GUARDRAIL_FAULT_CLASSES = ['guardrail_error']` | `api/_utils/tickCapture/captureConfig.js:155` | MOVED |
| 115 | §F1 C-2 — L129 | `api/_utils/tickCapture/captureConfig.js:120-149` | check-status docstring, `CHECK_STATUSES`, `CHECK_RESULTS` | `api/_utils/tickCapture/captureConfig.js:157-186` | MOVED |
| 116 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:126-133` | V1.4 amendment docstring: `failed` as fifth status | `api/_utils/tickCapture/captureConfig.js:163-170` | MOVED |
| 117 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:134` | `CHECK_STATUSES` — five values incl. `failed` | `api/_utils/tickCapture/captureConfig.js:171` | MOVED |
| 118 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:149` | `CHECK_RESULTS = ['passed','blocked','faulted']` | `api/_utils/tickCapture/captureConfig.js:186` | MOVED |
| 119 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:158` | `BODY_STATUSES` written/truncated/copy_failed/skipped | `api/_utils/tickCapture/captureConfig.js:195` | MOVED |
| 120 | §F2 — L141 | `api/_utils/tickCapture/captureConfig.js:165-171` | `CAPTURE_DISPOSITIONS` list | `api/_utils/tickCapture/captureConfig.js:202-208` | MOVED |
| 121 | §D4 — L106 | `api/_utils/tickCapture/captureConfig.js:174-180` | `ACTION_SOURCES` list | `api/_utils/tickCapture/captureConfig.js:211-217` | MOVED |
| 122 | §F2 — L135 | `api/_utils/tickCapture/captureWriter.js:6-11` | header: `ticks` + `tickBodies` written in one batch | `api/_utils/tickCapture/captureWriter.js:6-11` | SAME |
| 123 | §F2 — L141 | `api/_utils/tickCapture/captureWriter.js:17-21` | header: timeout is `unknown`; export checks presence | `api/_utils/tickCapture/captureWriter.js:17-21` | SAME |
| 124 | §A3 · §F1 C-2 — L58, L129 | `api/_utils/tickCapture/captureWriter.js:139-145` | `defaultChecks()` — untouched checks are `not_evaluated` | `api/_utils/tickCapture/captureWriter.js:139-145` | SAME |
| 125 | §A2 · §F2 — L53, L144 | `api/_utils/tickCapture/captureWriter.js:170` | `expireAt = now + TICK_CAPTURE_BODY_RETENTION_DAYS` | `api/_utils/tickCapture/captureWriter.js:170` | SAME |
| 126 | §F2 — L139 | `api/_utils/tickCapture/captureWriter.js:174-204` | body-document composer (`tickBodies`) | `api/_utils/tickCapture/captureWriter.js:181-211` | CHANGED: `schemaVersion` is now `schema.version` (:182) — 1, or 2 when calls are shadow/on |
| 127 | §F2 — L135 | `api/_utils/tickCapture/captureWriter.js:179` | body `evalId: state.evalId` | `api/_utils/tickCapture/captureWriter.js:186` | MOVED |
| 128 | §A2 — L53 | `api/_utils/tickCapture/captureWriter.js:181` | body `expireAt` | `api/_utils/tickCapture/captureWriter.js:188` | MOVED |
| 129 | §B3 — L88 | `api/_utils/tickCapture/captureWriter.js:187` | `originalToolResult: state.originalTool` | `api/_utils/tickCapture/captureWriter.js:194` | MOVED |
| 130 | §B1 — L76 | `api/_utils/tickCapture/captureWriter.js:191` | `controlsAsRendered: state.controlTexts` | `api/_utils/tickCapture/captureWriter.js:198` | MOVED |
| 131 | §F2 — L137, L163 | `api/_utils/tickCapture/captureWriter.js:207-337` | permanent-document composer (`ticks`) | `api/_utils/tickCapture/captureWriter.js:214-347` | CHANGED: `schemaVersion: schema.version` (:215); `calls[]` spread added for schema v2 (:277-279) |
| 132 | §F2 — L135 | `api/_utils/tickCapture/captureWriter.js:212` | permanent `evalId: state.evalId` | `api/_utils/tickCapture/captureWriter.js:219` | MOVED |
| 133 | §F1 C-2 — L129 | `api/_utils/tickCapture/captureWriter.js:221` | `universeSize: universe.size` | `api/_utils/tickCapture/captureWriter.js:228` | MOVED |
| 134 | §F1 C-1 — L128 | `api/_utils/tickCapture/captureWriter.js:231-239` | permanent `guardrail: {...}` block | `api/_utils/tickCapture/captureWriter.js:238-246` | MOVED |
| 135 | §F1 C-1 — L128 | `api/_utils/tickCapture/captureWriter.js:244-249` | `risk: { verdicts, lockedCount, forcedExitCount, evaluatedCount }` | `api/_utils/tickCapture/captureWriter.js:251-256` | MOVED |
| 136 | §B1 — L76 | `api/_utils/tickCapture/captureWriter.js:270-286` | `controls: {...}` directive/lean ids and hashes | `api/_utils/tickCapture/captureWriter.js:280-296` | MOVED |
| 137 | §A4 · §F1 C-5 — L66, L131 | `api/_utils/tickCapture/captureWriter.js:314-320` | `scores: { active, banked, total, opponent, bankedBadgePoints }` | `api/_utils/tickCapture/captureWriter.js:324-330` | MOVED |
| 138 | §F2 — L141 | `api/_utils/tickCapture/captureWriter.js:334` | `disposition: 'written'` | `api/_utils/tickCapture/captureWriter.js:344` | MOVED |
| 139 | §A3 — L57 | `api/_utils/tickCapture/captureWriter.js:400-401` | `body.status = 'skipped'` when nothing was dispatched | `api/_utils/tickCapture/captureWriter.js:410-411` | MOVED |
| 140 | §F2 — L141 | `api/_utils/tickCapture/captureWriter.js:479-495` | finalizer entry: `skipped` / `skipped_budget`, one deadline | `api/_utils/tickCapture/captureWriter.js:489-505` | MOVED |
| 141 | §F2 — L135 | `api/_utils/tickCapture/captureWriter.js:531-534` | one `db.batch()` sets the `ticks` and `tickBodies` docs | `api/_utils/tickCapture/captureWriter.js:541-544` | MOVED |
| 142 | §F2 — L135 | `api/_utils/tickCapture/captureWriter.js:546` | `batch.commit()` under the deadline | `api/_utils/tickCapture/captureWriter.js:556` | MOVED |
| 143 | §F2 — L141 | `api/_utils/tickCapture/captureWriter.js:553` | `timed_out` vs `write_failed` disposition | `api/_utils/tickCapture/captureWriter.js:563` | MOVED |
| 144 | §F1 C-2 — L129 | `api/_utils/tickCapture/captureSerializer.js:16-19` | symbol admitted only if in the tick's own universe | `api/_utils/tickCapture/captureSerializer.js:16-19` | SAME |
| 145 | §F1 — L124 | `api/_utils/tickCapture/captureSerializer.js:27-31` | undeclared path is a violation — default deny | `api/_utils/tickCapture/captureSerializer.js:27-31` | SAME |
| 146 | §A2 · §F1 · §F2 — L53, L124, L137 | `api/_utils/tickCapture/captureSerializer.js:63-185` | `PERMANENT_FIELD_KINDS` — the permanent-record allowlist | `api/_utils/tickCapture/captureSerializer.js:66-196` | CHANGED: three `calls.*.{callId,n,kind}` entries + comment inserted (:135-141); still no `candidates` path |
| 147 | §F1 C-3 — L130 | `api/_utils/tickCapture/captureSerializer.js:94-95` | `risk.verdicts.*.action` / `.reason` admitted as ids | `api/_utils/tickCapture/captureSerializer.js:97-98` | MOVED |
| 148 | §F1 C-1 — L128 | `api/_utils/tickCapture/captureSerializer.js:94-98` | risk verdict ids + the three risk counts | `api/_utils/tickCapture/captureSerializer.js:97-101` | MOVED |
| 149 | §D4 · §F2 — L106, L135 | `api/_utils/tickCapture/captureContext.js:130` | `tickId: ${battleId}:${tickSeq}` | `api/_utils/tickCapture/captureContext.js:133` | MOVED |
| 150 | §A3 — L58 | `api/_utils/tickCapture/captureContext.js:144` | `modelFacts` default `outcome: 'not_attempted'` | `api/_utils/tickCapture/captureContext.js:147` | MOVED |
| 151 | §D4 — L106 | `api/_utils/tickCapture/captureContext.js:246-261` | `action()` pushes `{ actionId, n, kind, source, exitReason, … }` | `api/_utils/tickCapture/captureContext.js:256-271` | MOVED |
| 152 | §D4 · §F2 — L106, L135 | `api/_utils/tickCapture/captureContext.js:249` | `actionId: ${state.tickId}:${n}` | `api/_utils/tickCapture/captureContext.js:259` | MOVED |
| 153 | §A3 · §F2 — L59, L163 | `api/_utils/tickCapture/captureCoverage.js:12` | comment: minted `cronState.tickSeq` is the coverage denominator | `api/_utils/tickCapture/captureCoverage.js:12` | SAME |
| 154 | §A3 · §F2 — L59, L163 | `api/_utils/tickCapture/captureCoverage.js:48` | `@property mintedTickSeq` — the persisted `cronState.tickSeq` | `api/_utils/tickCapture/captureCoverage.js:48` | SAME |
| 155 | §B1 — L75 | `api/_utils/tickStamps.js:13-21` | header: `heard` from the cron's own `resolveControls` | `api/_utils/tickStamps.js:13-21` | SAME |
| 156 | §C3 — L97 | `api/_utils/tickStamps.js:22-34` | header: `evidence` fields; `rsPercentile` bench-only | `api/_utils/tickStamps.js:22-34` | SAME |
| 157 | §C3 — L97 | `api/_utils/tickStamps.js:28-32` | prompt renders `rsPercentile` for BENCH names only | `api/_utils/tickStamps.js:28-32` | SAME |
| 158 | §B3 — L86 | `api/_utils/tickStamps.js:103-105` | `CANDIDATE_FIELDS` list | `api/_utils/tickStamps.js:103-105` | SAME |
| 159 | §B1 — L75 | `api/_utils/tickStamps.js:108` | `HEARD_SUPPRESSED_REASONS` malformed/mode_not_enforce/epoch_killed | `api/_utils/tickStamps.js:108` | SAME |
| 160 | §B1 — L75 | `api/_utils/tickStamps.js:138-151` | `deriveHeardStamp(controlResolution)` | `api/_utils/tickStamps.js:138-151` | SAME |
| 161 | §F1 C-1 — L128 | `api/_utils/tickStamps.js:160-165` | `composeRisk(verdict)` → `{action}` or `{action, reason}` | `api/_utils/tickStamps.js:160-165` | SAME |
| 162 | §C3 · §F1 C-3 — L97, L130 | `api/_utils/tickStamps.js:192-209` | `composeEvidenceStamp(...)` per held symbol | `api/_utils/tickStamps.js:192-209` | SAME |
| 163 | §F1 C-1 — L128 | `api/_utils/tickStamps.js:211` | ‡ `return evidence;` (the `risk` key is :208) | `api/_utils/tickStamps.js:211` | SAME |
| 164 | §B3 — L86 | `api/_utils/tickStamps.js:293-309` | `composeCandidatesStamp()` — `threshold` via `strOrNull` | `api/_utils/tickStamps.js:293-309` | SAME |
| 165 | §A3 — L57 | `api/_utils/tickStamps.js:314-320` | docstring: gate is `promptBuilt === true` | `api/_utils/tickStamps.js:314-320` | SAME |
| 166 | §B2 — L81 | `src/config/featureFlags.js:813-833` | FLIP ORDER docstring: never with grounding canary/on | `src/config/featureFlags.js:813-833` | SAME |
| 167 | §0 r3 · §0.1 · §B2 — L17, L34, L81 | `src/config/featureFlags.js:887` | `DIRECTIVE_FIT_CHECK_ENABLED = false` | `src/config/featureFlags.js:887` | SAME |
| 168 | §0.1 · §E3 — L42, L116 | `src/config/featureFlags.js:1482` | `SHADOW_ASSEMBLY_ENABLED = false` | `src/config/featureFlags.js:1482` | SAME |
| 169 | §0.1 · §C4 — L40, L99 | `src/config/featureFlags.js:2271` | `VOICE_GROUNDING_MODE = 'shadow'` | `src/config/featureFlags.js:2271` | SAME |
| 170 | §0.1 — L40 | `src/config/featureFlags.js:2274` | `VOICE_GROUNDING_MODES` off/shadow/canary/on | `src/config/featureFlags.js:2274` | SAME |
| 171 | §0.1 — L41 | `src/config/featureFlags.js:2420` | `SHOW_IT_ENABLED = false` | `src/config/featureFlags.js:2420` | SAME |
| 172 | §B3 — L89 | `src/config/featureFlags.js:2531` | docstring naming `api/_utils/anticipationThresholdLint.js` | `src/config/featureFlags.js:2556` | MOVED |
| 173 | §0 r4 · §0.1 · §B3 — L18, L35, L88 | `src/config/featureFlags.js:2563` | `ANTICIPATION_THRESHOLD_LINT_MODE = 'off'` | `src/config/featureFlags.js:2588` | MOVED |
| 174 | §0.1 — L35 | `src/config/featureFlags.js:2566` | `ANTICIPATION_THRESHOLD_LINT_MODES` off/shadow/on | `src/config/featureFlags.js:2591` | MOVED |
| 175 | §0.1 — L37 | `src/config/featureFlags.js:2581-2584` | docstring 'FLIPPED TRUE on 2026-09-21 by `39e5c48a`' | `src/config/featureFlags.js:2606-2609` | MOVED |
| 176 | §0.1 — L37 | `src/config/featureFlags.js:2587` | `INTRADAY_COLLECT_ENABLED = true` | `src/config/featureFlags.js:2612` | MOVED |
| 177 | §0 r5 · §0.1 — L19, L38 | `src/config/featureFlags.js:2605` | `INTRADAY_DIAGNOSTIC_ENABLED = false` | `src/config/featureFlags.js:2630` | MOVED |
| 178 | §0.1 — L39 | `src/config/featureFlags.js:2606-2649` | Stage 2–4 exports false/'legacy'/false (NEW :2641, :2653, :2667) | `src/config/featureFlags.js:2631-2674` | MOVED |
| 179 | §0.1 — L36 | `src/config/featureFlags.js:2684-2686` | docstring 'FALSE is now the ROLLBACK' | `src/config/featureFlags.js:2709-2711` | MOVED |
| 180 | §0 r1 · §0.1 · §A1 — L15, L36, L51 | `src/config/featureFlags.js:2692` | `TICK_CAPTURE_ENABLED = true` | `src/config/featureFlags.js:2717` | MOVED |
| 181 | §0.1 — L39 | `src/config/flagPinGuard.test.js:79` | `DARK_BY_DESIGN` key `INTRADAY_AGENT_USE_ENABLED` | `src/config/flagPinGuard.test.js:79` | SAME |
| 182 | §0.1 · §D6 — L39, L108 | `src/config/flagPinGuard.test.js:81` | `DARK_BY_DESIGN` key `INTRADAY_RISK_ACTIVATION_ENABLED` | `src/config/flagPinGuard.test.js:81` | SAME |
| 183 | §0.1 — L41 | `src/config/flagPinGuard.test.js:123` | `DARK_BY_DESIGN` key `SHOW_IT_ENABLED` | `src/config/flagPinGuard.test.js:123` | SAME |
| 184 | §0 r3 · §0.1 — L17, L34 | `src/config/flagPinGuard.test.js:172` | `DARK_BY_DESIGN` key `DIRECTIVE_FIT_CHECK_ENABLED` | `src/config/flagPinGuard.test.js:172` | SAME |
| 185 | §0.1 — L42 | `src/config/flagPinGuard.test.js:176` | `DARK_BY_DESIGN` key `SHADOW_ASSEMBLY_ENABLED` | `src/config/flagPinGuard.test.js:176` | SAME |
| 186 | §A4 — L63 | `vercel.json:65-66` | agent-daily-scores schedule `45 1 * * 2-6` | `vercel.json:65-66` | SAME |
| 187 | §A4 — L63 | `vercel.json:157-158` | agent-evaluate schedule `*/15 13,…,21 * * 1-5` | `vercel.json:157-158` | SAME |
| 188 | §D1 — L103 | `vercel.json:165-166` | intraday-validate schedule `*/30 10-16 * * 2-6` | `vercel.json:165-166` | SAME |
| 189 | §E3 · §F2 — L116, L146 | `firestore.rules:448-452` | `intradayViews/{evalId}`: owner read, `allow write: if false` | `firestore.rules:470-474` | MOVED |
| 190 | §A2 · §F2 — L53, L144 | `firestore.indexes.json:612-630` | `tickBodies.expireAt` TTL field override | `firestore.indexes.json:644-662` | MOVED |
| 191 | §F2 — L144 | `firestore.indexes.json:671-689` | `signalDropCache.expiresAt` TTL field override | `firestore.indexes.json:703-721` | MOVED |
| 192 | §D4 — L106 | `api/_utils/agentSwapExecution.js:255-273` † | `closedTrade` trade-entry shape (symbolOut … snapshot) | `api/_utils/agentSwapExecution.js:255-273` | SAME |
| 193 | §D4 · §F2 — L106, L145 | `api/_utils/agentSwapExecution.js:354` | `trades = [...].slice(-50)` | `api/_utils/agentSwapExecution.js:354` | SAME |
| 194 | §A4 — L62 | `api/_utils/agentSwapExecution.js:363` | `scoreState.tradeCount` increment | `api/_utils/agentSwapExecution.js:363` | SAME |
| 195 | §A4 — L62 | `api/_utils/agentBattleService.js:274-286` | fenced initial `scoreState` shape | `api/_utils/agentBattleService.js:274-286` | SAME |
| 196 | §D4 — L106 | `api/_utils/learning/captureReceipt.js:406-411` | `learningReceipts/{battleId}/receipts/{receiptId}` ref | `api/_utils/learning/captureReceipt.js:406-411` | SAME |
| 197 | §D4 — L106 | `api/_utils/learning/captureReceipt.js:420` | `await ref.create(receipt)` — create-only | `api/_utils/learning/captureReceipt.js:420` | SAME |
| 198 | §D4 — L106 | `api/_utils/learning/learningSchemas.js:122-134` | receipt identity/decision fields incl. `receiptSeq`, `source`, `exitReason` | `api/_utils/learning/learningSchemas.js:122-134` | SAME |
| 199 | §F1 C-3 — L130 | `api/_utils/learning/learningSchemas.js:155-164` | `guardrailReplay` null-flagged highWaterMark/trail fields | `api/_utils/learning/learningSchemas.js:155-164` | SAME |
| 200 | §A4 — L63 | `api/cron/agent-daily-scores.js:4` | header 'Schedule: 45 1 * * 2-6 … 8:45 PM' | `api/cron/agent-daily-scores.js:4` | SAME |
| 201 | §A4 — L63 | `api/cron/agent-daily-scores.js:23` | `import { findActiveAgentBattles }` | `api/cron/agent-daily-scores.js:23` | SAME |
| 202 | §A4 — L63 | `api/cron/agent-daily-scores.js:171-194` | builds the one per-battle `battleRef.update(updates)` | `api/cron/agent-daily-scores.js:171-194` | SAME |
| 203 | §A4 — L63 | `api/cron/agent-daily-scores.js:174` | `thresholdHistory: resetHistory` | `api/cron/agent-daily-scores.js:174` | SAME |
| 204 | §A4 — L63 | `api/cron/agent-daily-scores.js:175` | `portfolio: updatedPortfolio` | `api/cron/agent-daily-scores.js:175` | SAME |
| 205 | §A4 — L63 | `api/cron/agent-daily-scores.js:176-181` | `bankedBadgePoints.total` increment + `.breakdown.{dayKey}` | `api/cron/agent-daily-scores.js:176-181` | SAME |
| 206 | §A4 · §F1 C-5 — L63, L131 | `api/cron/agent-daily-scores.js:182-187` | `scoreState.dailyScores.{dayKey}` badge-points receipt | `api/cron/agent-daily-scores.js:182-187` | SAME |
| 207 | §A4 — L63 | `api/cron/agent-daily-scores.js:188-189` | `timing.currentTradingDay` / `timing.lastDailyResetAt` | `api/cron/agent-daily-scores.js:188-189` | SAME |
| 208 | §A4 — L63 | `api/cron/agent-daily-scores.js:248-266` | day-end price fetch loop | `api/cron/agent-daily-scores.js:248-266` | SAME |
| 209 | §A4 — L67 | `api/cron/agent-daily-scores.js:252-266` | Guard-2 daily-series price fetch | `api/cron/agent-daily-scores.js:252-266` | SAME |
| 210 | §A4 — L63 | `api/cron/agent-daily-scores.js:279` | `for (const battle of battles)` per-battle loop | `api/cron/agent-daily-scores.js:279` | SAME |
| 211 | §0 r12 · §E1 — L26, L112 | `api/cron/agent-batch-review.js:189` | `todayEvals = evaluations.filter(e => e.day === currentDay)` | `api/cron/agent-batch-review.js:189` | SAME |
| 212 | §B1 — L74 | `api/_utils/directiveGate.js:12-13` | `originalUserAsk` is NEVER read into `directive.text` | `api/_utils/directiveGate.js:12-13` | SAME |
| 213 | §B2 — L82 | `api/_utils/directiveGate.js:69-73` † | `renderDirectiveStatus()` → `no_change` + status line | `api/_utils/directiveGate.js:69-73` | SAME |
| 214 | §B2 — L83 | `api/_utils/directiveGate.js:75` † | `VALID_CLASSIFICATIONS` — five classifications | `api/_utils/directiveGate.js:75` | SAME |
| 215 | §B2 — L80 | `api/_utils/directiveGate.js:87-96` | root-cause comment: membership proved, fit never | `api/_utils/directiveGate.js:87-96` | SAME |
| 216 | §B2 — L82 | `api/_utils/directiveGate.js:108-110` † | `fit_mismatch` reports `no_change` on the wire | `api/_utils/directiveGate.js:108-110` | SAME |
| 217 | §B2 — L82 | `api/_utils/directiveGate.js:112-123` † | stated limit: grounding marker gates the status line | `api/_utils/directiveGate.js:112-123` | SAME |
| 218 | §B2 — L82 | `api/_utils/directiveGate.js:124-129` | `normalizeForQuote` / `replyQuotesCanonical` (case-sensitive) | `api/_utils/directiveGate.js:124-129` | SAME |
| 219 | §B2 — L83 | `api/_utils/directiveGate.js:140` † | repair reason `no_proposal` | `api/_utils/directiveGate.js:140` | SAME |
| 220 | §B2 — L83 | `api/_utils/directiveGate.js:141-145` † | `DELIBERATE_NULL` classifications → `status: 'no_change'` | `api/_utils/directiveGate.js:141-145` | SAME |
| 221 | §B2 — L82 | `api/_utils/directiveGate.js:152` | `DIRECTIVE_FIT_CHECK_ENABLED && !replyQuotesCanonical(...)` | `api/_utils/directiveGate.js:152` | SAME |
| 222 | §B2 — L82 | `api/_utils/directiveGate.js:152-161` | `fit_mismatch` verdict with `fitCheck { expected, quoted: false }` | `api/_utils/directiveGate.js:152-161` | SAME |
| 223 | §B2 — L83 | `api/_utils/directiveGate.js:162-178` † | committed verdict `{ text: canonical, …, status: 'committed' }` | `api/_utils/directiveGate.js:162-178` | SAME |
| 224 | §B1 — L72 | `api/_utils/directiveGate.js:166-176` | ‡ committed-directive fields; `text: canonical` is :165 | `api/_utils/directiveGate.js:166-176` | SAME |
| 225 | §B2 — L83 | `api/_utils/directiveGate.js:179` † | repair reason `invalid_id` | `api/_utils/directiveGate.js:179` | SAME |
| 226 | §B1 · §B2 — L74, L82 | `api/_utils/directiveGate.js:242-248` † | `readForensics()` sanitizes the three forensics fields | `api/_utils/directiveGate.js:242-248` | SAME |
| 227 | §B1 — L74 | `api/_utils/directiveGate.js:251-290` | `result()` builds the `archetypeGate` outcome record | `api/_utils/directiveGate.js:251-290` | SAME |
| 228 | §B1 — L74 | `api/_utils/directiveGate.js:257-260` | `classification`, `selectedAdjustmentId`, `status`, `repairUsed` | `api/_utils/directiveGate.js:257-260` | SAME |
| 229 | §B1 · §E3 — L74, L116 | `api/_utils/directiveGate.js:261-262` | comment: forensics ADDITIVE AND ALWAYS ON | `api/_utils/directiveGate.js:261-262` | SAME |
| 230 | §B1 — L74 | `api/_utils/directiveGate.js:281-283` | comment: forensics taken from the FIRST proposal | `api/_utils/directiveGate.js:281-283` | SAME |
| 231 | §B1 — L74 | `api/_utils/directiveGate.js:284` | `...forensics` spread | `api/_utils/directiveGate.js:284` | SAME |
| 232 | §B1 · §B2 — L74, L82 | `api/_utils/directiveGate.js:285-287` | `fitCheck` spread only on `fit_mismatch` | `api/_utils/directiveGate.js:285-287` | SAME |
| 233 | §B2 — L83 | `api/_utils/directiveGate.js:353` † | null write carrying `verdict.reason` (no_proposal/invalid_id) | `api/_utils/directiveGate.js:353` | SAME |
| 234 | §B1 — L74 | `api/_utils/directiveFiling.js:29-43` | `buildDirectiveRecord()` — the exchange directive shape | `api/_utils/directiveFiling.js:29-43` | SAME |
| 235 | §B1 — L72 | `api/_utils/directiveFiling.js:46-48` | slot docstring: latest-wins, whole object set | `api/_utils/directiveFiling.js:46-48` | SAME |
| 236 | §B1 — L72 | `api/_utils/directiveFiling.js:50-61` | `buildDirectiveSlot()` — the `battle.directive` shape | `api/_utils/directiveFiling.js:50-61` | SAME |
| 237 | §B1 — L72 | `api/_utils/directiveFiling.js:56-59` | `adjustmentId` / `canonicalTextVersion` only when minted | `api/_utils/directiveFiling.js:56-59` | SAME |
| 238 | §B1 · §B2 — L73, L82 | `api/agent/chat.js:1009` | `directiveThreadId = randomUUID()` only for a linted directive | `api/agent/chat.js:1009` | SAME |
| 239 | §B1 — L74 | `api/agent/chat.js:1027-1067` | ‡ exchange fields `agentResponse`…`groundingVersion`; `userMessage` is :1026 | `api/agent/chat.js:1027-1067` | SAME |
| 240 | §B1 — L74 | `api/agent/chat.js:1028` | ‡ `scratchpad: cleanScratchpad`; `userMessage` is :1026 | `api/agent/chat.js:1028` | SAME |
| 241 | §B1 — L74 | `api/agent/chat.js:1052-1054` † | ‡ end of `groupId` spread; spread is :1050-1052 | `api/agent/chat.js:1052-1054` | SAME |
| 242 | §B1 — L74 | `api/agent/chat.js:1056` † | `...(gateOutcome ? { archetypeGate: gateOutcome } : {})` | `api/agent/chat.js:1056` | SAME |
| 243 | §B1 — L74 | `api/agent/chat.js:1061` † | `researchLint: 'withheld'` spread | `api/agent/chat.js:1061` | SAME |
| 244 | §B1 — L74 | `api/agent/chat.js:1066` † | `groundingVersion` spread (grounded turns only) | `api/agent/chat.js:1066` | SAME |
| 245 | §0 r2 · §B1 — L16, L73 | `api/agent/chat.js:1071-1083` | `battleRef.update`: exchange arrayUnion, budget, directive slot | `api/agent/chat.js:1071-1083` | SAME |
| 246 | §B1 · §F2 — L73, L145 | `api/agent/chat.js:1072` | `chatExchanges: FieldValue.arrayUnion(exchange)` | `api/agent/chat.js:1072` | SAME |
| 247 | §B1 — L73 | `api/agent/chat.js:1077` | budget `FieldValue.increment(1)` (non-league asks) | `api/agent/chat.js:1077` | SAME |
| 248 | §B1 · §B2 — L73, L82 | `api/agent/chat.js:1080-1082` | directive slot written only when a thread id minted | `api/agent/chat.js:1080-1082` | SAME |
| 249 | §C1 — L93 | `api/agent/chat.js:1093-1097` | `agents/{id}` `lessons` + `forgeSuggestions` arrayUnion | `api/agent/chat.js:1093-1097` | SAME |
| 250 | §A3 — L57 | `src/screens/battleView/deriveHeard.js:32-35` | presence-gated; `budget_skipped` entries carry no `heard` | `src/screens/battleView/deriveHeard.js:32-35` | SAME |
| 251 | §B1 — L75 | `src/screens/battleView/deriveHeard.js:37-42` | mid-tick filing is stamped on the NEXT entry | `src/screens/battleView/deriveHeard.js:37-42` | SAME |
| 252 | §0 r11 · §D5 — L25, L107 | `src/hooks/useAgentBattle.js:26-28` | `doc(db, 'agentBattles', id)` + `onSnapshot(` | `src/hooks/useAgentBattle.js:26-28` | SAME |
| 253 | §0 r11 · §D5 — L25, L107 | `src/hooks/useAgentBattle.js:32` | `setBattle({ id, ...snapshot.data() })` — the whole document | `src/hooks/useAgentBattle.js:32` | SAME |
| 254 | §0 r11 · §D5 — L25, L107 | `src/hooks/useAgentBattle.js:49` | `statusFeed = battle?.statusFeed \|\| []` | `src/hooks/useAgentBattle.js:49` | SAME |
| 255 | §C2 — L95 | `src/data/archetypeAdjustments.js:89` | `cautiousRegister` — TF archetype | `src/data/archetypeAdjustments.js:89` | SAME |
| 256 | §C2 — L95 | `src/data/archetypeAdjustments.js:116` | `cautiousRegister` — CN archetype | `src/data/archetypeAdjustments.js:116` | SAME |
| 257 | §C2 — L95 | `src/data/archetypeAdjustments.js:143` | `cautiousRegister` — SP archetype | `src/data/archetypeAdjustments.js:143` | SAME |
| 258 | §C2 — L95 | `src/data/archetypeAdjustments.js:175` | `cautiousRegister` — CP archetype | `src/data/archetypeAdjustments.js:175` | SAME |
| 259 | §C2 — L95 | `src/data/archetypeAdjustments.js:203` | `cautiousRegister` — DV archetype | `src/data/archetypeAdjustments.js:203` | SAME |
| 260 | §F1 C-3 — L130 | `api/_utils/agentGuardrails.js:175-182` | override typedef: `threshold`, `actual`, `action`, … | `api/_utils/agentGuardrails.js:175-182` | SAME |
| 261 | §F1 C-3 — L130 | `api/_utils/agentGuardrails.js:538-546` | `overrides.push` forced_exit `{ threshold, actual, … }` | `api/_utils/agentGuardrails.js:538-546` | SAME |
| 262 | §B1 — L75 | `api/_utils/controlSuppressionTelemetry.js:30` | `controlEpochLog` entry-shape comment | `api/_utils/controlSuppressionTelemetry.js:30` | SAME |
| 263 | §B1 — L75 | `api/_utils/controlSuppressionTelemetry.js:234` | `battleRef.update({ controlEpochLog: arrayUnion(entry) })` | `api/_utils/controlSuppressionTelemetry.js:234` | SAME |
| 264 | §E3 — L116 | `api/_utils/intraday/evaluatorHook.js:17` | `VIEWS_SUBCOLLECTION = 'intradayViews'` | `api/_utils/intraday/evaluatorHook.js:17` | SAME |
| 265 | §E3 — L116 | `api/_utils/intraday/evaluatorHook.js:63-76` | `composeIntradayEntryFields()` — the eight pointer fields | `api/_utils/intraday/evaluatorHook.js:63-76` | SAME |
| 266 | §E3 — L116 | `api/_utils/agentEvalTransport.js:117` | comment: persisted as `haikuError.timeoutKind` | `api/_utils/agentEvalTransport.js:122` | MOVED |
| 267 | §A3 — L57 | `api/_utils/agentEvalTransport.js:167-176` | `shouldStartHaikuCall()` — remaining vs required ms | `api/_utils/agentEvalTransport.js:178-188` | CHANGED: new `callsReserveMs = 0` param (:184) added into `requiredMs` (:187) |
| 268 | §F2 — L146 | `scripts/export-tick-capture.js:1-40` | read-only Admin-SDK export header + imports | `scripts/export-tick-capture.js:1-40` | SAME |
| 269 | §B1 — L73 | `api/agent/file-directive.js:172-174` | 404 unless `getVoiceGroundingMode(uid) === 'on'` | `api/agent/file-directive.js:172-174` | SAME |
| 270 | §B1 — L73 | `api/agent/file-directive.js:196` | `db.runTransaction(async (tx) => {` | `api/agent/file-directive.js:196` | SAME |
| 271 | §B1 — L73 | `api/agent/file-directive.js:274-276` | slot + filed exchange (`buildDirectiveRecord`) built | `api/agent/file-directive.js:274-276` | SAME |
| 272 | §B1 — L73 | `api/agent/file-directive.js:283-284` | writes `chatExchanges` arrayUnion + `directive: slot` | `api/agent/file-directive.js:283-284` | SAME |
| 273 | §D2 — L104 | `api/_utils/intradayConfig.js:11` | `UNIVERSE_CADENCE_MIN = 5` | `api/_utils/intradayConfig.js:11` | SAME |
| 274 | §E3 — L116 | `api/_utils/intradayConfig.js:102` | `CALC_VERSION = 2` | `api/_utils/intradayConfig.js:102` | SAME |
| 275 | §D2 — L104 | `api/_utils/intraday/intradayStore.js:7-12` | layout comment: `intradaySnapshots/latest`, actionable ring | `api/_utils/intraday/intradayStore.js:7-12` | SAME |
| 276 | §D2 — L104 | `api/_utils/intraday/intradayStore.js:24-38` | collection-name constants + ref helpers | `api/_utils/intraday/intradayStore.js:24-38` | SAME |
| 277 | §D1 — L103 | `api/_utils/intraday/intradayStore.js:30` | `VALIDATION_COLLECTION = 'intradayValidation'` | `api/_utils/intraday/intradayStore.js:30` | SAME |
| 278 | §D1 — L103 | `api/_utils/intraday/intradayStore.js:38` | `validationRef(db, etDate)` | `api/_utils/intraday/intradayStore.js:38` | SAME |
| 279 | §C3 — L97 | `api/_utils/agentEvalPromptAssembly.js:1535` | `buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap)` | `api/_utils/agentEvalPromptAssembly.js:1535` | SAME |
| 280 | §C3 — L97 | `api/_utils/agentEvalPromptAssembly.js:1610-1612` | RSI push | `api/_utils/agentEvalPromptAssembly.js:1610-1612` | SAME |
| 281 | §C3 — L97 | `api/_utils/agentEvalPromptAssembly.js:1614-1620` | MACD phrase with cross state | `api/_utils/agentEvalPromptAssembly.js:1614-1620` | SAME |
| 282 | §C3 — L97 | `api/_utils/agentEvalPromptAssembly.js:1634-1642` | BB %B band | `api/_utils/agentEvalPromptAssembly.js:1634-1642` | SAME |
| 283 | §C3 — L97 | `api/_utils/agentEvalPromptAssembly.js:1645` | ATR regime push | `api/_utils/agentEvalPromptAssembly.js:1645` | SAME |
| 284 | §C3 — L97 | `api/_utils/agentEvalPromptAssembly.js:1652-1658` | `renderBenchVolumeLine` — RVOL from the volume profile | `api/_utils/agentEvalPromptAssembly.js:1652-1658` | SAME |
| 285 | §A4 — L65 | `api/agent/reflect.js:127` | `evaluationCount: (battleDoc.evaluations \|\| []).length` | `api/agent/reflect.js:127` | SAME |
| 286 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:120` | `bustBuffer` default −0.85 | `api/_utils/agentRiskManager.js:120` | SAME |
| 287 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:122` | `trailATR = trailStopATR ?? 1.5` | `api/_utils/agentRiskManager.js:122` | SAME |
| 288 | §D6 — L108 | `api/_utils/agentRiskManager.js:127-134` | EMERGENCY_SWAP `bust_avoidance` | `api/_utils/agentRiskManager.js:127-134` | SAME |
| 289 | §F1 C-1 — L128 | `api/_utils/agentRiskManager.js:127-196` | risk ladder: bust, VWAP, LOCK, trail, stagnation, HOLD | `api/_utils/agentRiskManager.js:127-196` | SAME |
| 290 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:132` | bust `detail` prose | `api/_utils/agentRiskManager.js:132` | SAME |
| 291 | §D6 — L108 | `api/_utils/agentRiskManager.js:138-147` | VWAP-failure SWAP_OUT (streak + dead band) | `api/_utils/agentRiskManager.js:138-147` | SAME |
| 292 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:145` | VWAP `detail` prose | `api/_utils/agentRiskManager.js:145` | SAME |
| 293 | §D6 — L108 | `api/_utils/agentRiskManager.js:149-161` | LOCK `threshold_proximity` | `api/_utils/agentRiskManager.js:149-161` | SAME |
| 294 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:158` | LOCK `detail` prose | `api/_utils/agentRiskManager.js:158` | SAME |
| 295 | §D6 · §F1 C-1 — L108, L128 | `api/_utils/agentRiskManager.js:164-171` | TRAIL_STOP `stepped_trail` (needs `sma20_5m`) | `api/_utils/agentRiskManager.js:164-171` | SAME |
| 296 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:165` | trail condition consuming `intradaySnapshot.sma20_5m` | `api/_utils/agentRiskManager.js:165` | SAME |
| 297 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:169` | trail `detail` prose | `api/_utils/agentRiskManager.js:169` | SAME |
| 298 | §D6 — L108 | `api/_utils/agentRiskManager.js:185-192` | stagnation SWAP_OUT (`source: 'archetype'`) | `api/_utils/agentRiskManager.js:185-192` | SAME |
| 299 | §F1 C-3 — L130 | `api/_utils/agentRiskManager.js:191` | stagnation `detail` prose | `api/_utils/agentRiskManager.js:191` | SAME |
| 300 | §A4 — L65 | `api/_utils/shadowAssemblyCapture.js:430` | `evaluationCount: (freshBattle.evaluations ?? []).length` | `api/_utils/shadowAssemblyCapture.js:430` | SAME |
| 301 | §0 r2 · §B3 — L16, L87 | `src/screens/battleView/selectBench.js:157-170` | `selectFlagged()` — uncapped, roster order | `src/screens/battleView/selectBench.js:157-170` | SAME |
| 302 | §B3 — L88 | `api/_utils/shadowLogger.js:44-60` | `appendToStream()` GCS write; `false` when disabled | `api/_utils/shadowLogger.js:44-60` | SAME |
| 303 | §B3 — L88 | `api/_utils/shadowLogger.js:154` | `logAnticipation = (r) => appendToStream('anticipation', r)` | `api/_utils/shadowLogger.js:154` | SAME |
| 304 | §A1 — L51 | `src/config/tickCaptureFlags.test.js:31-35` | pin `expect(TICK_CAPTURE_ENABLED).toBe(true)` | `src/config/tickCaptureFlags.test.js:31-35` | SAME |
| 305 | §D5 — L107 | `src/screens/battleView/useIntradayView.js:31` | `getDoc(doc(db, …, 'intradayViews', evalId))` — one read | `src/screens/battleView/useIntradayView.js:31` | SAME |
| 306 | §D2 — L104 | `api/_utils/intraday/universe.js:16` | `UNIVERSE_STOCKS` — the universe tier | `api/_utils/intraday/universe.js:16` | SAME |
| 307 | §D1 — L103 | `api/_utils/intraday/universe.js:34` | `actionableFromBattles(battles)` | `api/_utils/intraday/universe.js:34` | SAME |
| 308 | §B3 · §E1 — L86, L112 | `api/_utils/voiceLayerAnticipation.js:60-61` | `ANTICIPATION_ENTRY_FIELDS = ['evalId','timestamp']` allowlist | `api/_utils/voiceLayerAnticipation.js:60-61` | SAME |
| 309 | §B3 — L86 | `api/_utils/voiceLayerAnticipation.js:117-139` | grounded composer exchange (`slot`, no `threshold`) | `api/_utils/voiceLayerAnticipation.js:117-139` | SAME |
| 310 | §B3 — L86 | `api/_utils/voiceLayerAnticipation.js:351-369` | shipped anticipation exchange object | `api/_utils/voiceLayerAnticipation.js:351-369` | SAME |
| 311 | §B3 — L86 | `api/_utils/voiceLayerAnticipation.js:361` | `messageType: 'anticipation'` | `api/_utils/voiceLayerAnticipation.js:361` | SAME |
| 312 | §B3 — L86 | `api/_utils/voiceLayerAnticipation.js:362` | `anticipationSource: 'haiku'` | `api/_utils/voiceLayerAnticipation.js:362` | SAME |
| 313 | §B3 — L86 | `api/_utils/voiceLayerAnticipation.js:363-368` | `anticipationContext { symbol, direction, threshold, evaluationId }` | `api/_utils/voiceLayerAnticipation.js:363-368` | SAME |
| 314 | §B3 — L86 | `api/_utils/voiceLayerAnticipation.js:379-381` | `chatExchanges` arrayUnion only | `api/_utils/voiceLayerAnticipation.js:379-381` | SAME |
| 315 | §D1 — L103 | `api/_utils/intraday/validationRunner.js:106` | `validationRef(db, gradeDate).set(aggregateValidation(...))` | `api/_utils/intraday/validationRunner.js:106` | SAME |
| 316 | §D1 — L103 | `api/_utils/intraday/validationRunner.js:136` | `firstPublishHourUtc = new Date(now()).getUTCHours()` | `api/_utils/intraday/validationRunner.js:136` | SAME |

## Summary

**Counts (316 distinct anchors):** SAME **157** · MOVED **148** · CHANGED **11** · NOT FOUND **0**.

**By build-priority file:**

| File | Anchors | Status |
|---|---|---|
| `api/cron/agent-evaluate.js` | 103 | MOVED 96, CHANGED 7. The offset grows from +13 at `:170` to +362 at `:5903`. |
| `api/_utils/tickCapture/*.js` | 51 | `captureConfig` 18 (SAME 1 / MOVED 17)<br>`captureWriter` 22 (SAME 4 / MOVED 16 / CHANGED 2)<br>`captureSerializer` 5 (SAME 2 / MOVED 2 / CHANGED 1)<br>`captureContext` 4 (MOVED)<br>`captureCoverage` 2 (SAME) |
| `api/_utils/tickStamps.js` | 11 | SAME |
| `src/config/featureFlags.js` | 15 | SAME 6 (through `:2420`), MOVED 9 (+25 from `:2531` on) |
| `src/config/flagPinGuard.test.js` | 5 | SAME |
| `vercel.json` | 3 | SAME |
| `firestore.rules` | 1 | MOVED (+22) |
| `firestore.indexes.json` | 2 | MOVED (+32) |
| `api/_utils/agentScoring.js` | 0 | Not cited in the answers doc |
| `api/_utils/agentSwapExecution.js` | 3 | SAME |
| `api/_utils/agentBattleService.js` | 1 | SAME |
| `api/_utils/learning/*.js` | 4 | SAME (`captureReceipt.js` 2, `learningSchemas.js` 2) |
| `api/cron/agent-daily-scores.js` | 11 | SAME |
| `api/cron/agent-batch-review.js` | 1 | SAME |
| `api/_utils/directiveGate.js` | 22 | SAME |
| `api/_utils/directiveFiling.js` | 4 | SAME |
| `api/agent/chat.js` | 12 | SAME |
| `src/screens/battleView/deriveHeard.js` | 2 | SAME |
| `src/hooks/useAgentBattle.js` | 3 | SAME |
| `api/_utils/marketDataCache.js` | 0 | Not cited in the answers doc |
| All other cited files | — | SAME, except `agentEvalTransport.js` (MOVED 1 / CHANGED 1) |

### Every CHANGED row

1. **#3** `agent-evaluate.js:390-396` → `:423-436`. The time-budget break now counts the deferred set directly from the list (`activeBattles.slice(index)`), which fixes the R2 double count. It records the ids on `evalRun.deferredBattleIds`/`deferredAt` and adds a separate `summary.deferred`. `evalRun` is persisted to `agentEvalRuns/{runId}` (writer `:562-572`, called at `:500`).
2. **#4** `agent-evaluate.js:394` → `:432-433`. `summary.skipped += remaining` is gone. In its place are `summary.deferred += deferred.length` (`:432`) and `summary.skipped += deferred.length` (`:433`).
3. **#6** `agent-evaluate.js:691-694` → `:860-867`. A lock-skip also increments `summary.lockSkipped` (`:865`), so lock-skips and deferrals are now separable. `skipped` stays their sum.
4. **#22** `agent-evaluate.js:2133-2146` → `:2351-2374`. The gameplan-pending exit still runs only the deterministic pass and exits `gameplan_pending`. It now also passes `callsCtx`, freezes a Calls observation before the write (`:2356-2363`) and runs `runExitCallsHook` after it (`:2371-2372`).
5. **#23** `agent-evaluate.js:2286-2313` → `:2526-2563`. Same code, plus a 10-line Calls observation freeze inside the range (`:2548-2557`).
6. **#26** `agent-evaluate.js:2295-2315` → `:2535-2567`. The no-trigger early return still writes no entry and one `battleRef.update(scoreUpdate)` (`:2558`). It now also freezes a Calls observation (`:2548-2557`) and runs `runExitCallsHook` after the capture exit (`:2564-2565`). Calls are live (below), so "one update, then return" is no longer the whole path.
7. **#33** `agent-evaluate.js:2371` → `:2626`. `shouldStartHaikuCall` is now called with `callsReserveMs: callsReserveMsFor(callsCtx.mode)`. At `'shadow'` the pre-call requirement is therefore 48 s, not 44 s (`CALLS_RESERVE_MS = 4_000`, `api/_utils/callRecords/publish.js:54`).
8. **#126** `captureWriter.js:174-204` → `:181-211`. The body composer's `schemaVersion` is now `schema.version`, resolved by `resolveCaptureSchema` (`captureWriter.js:177`). It is 1 when calls are off and 2 at shadow/on.
9. **#131** `captureWriter.js:207-337` → `:214-347`. Same `schemaVersion` change (`:215`). A new `calls: [{ callId, n, kind }]` container is emitted in schema v2 only (`:277-279`), and it is live now.
10. **#146** `captureSerializer.js:63-185` → `:66-196`. The permanent allowlist gains `calls.*.callId` / `.n` / `.kind` (`:139-141`). No `candidates` path was added, so the §A2/§F2 finding still stands.
11. **#267** `agentEvalTransport.js:167-176` → `:178-188`. `shouldStartHaikuCall` gains a `callsReserveMs = 0` parameter (`:184`) that is added into `requiredMs` (`:187`).

**NOT FOUND:** none. All anchored code still exists at NEW.

### ‡ Doc mis-anchors (wrong at OLD too; the files are unchanged, so these rows are SAME)

- **#239 / #240** `chat.js:1027-1067` and `:1028`: `userMessage: sanitizedMessage` is at **`:1026`**. The exchange object opens at `:1025`, and `:1028` is `scratchpad`.
- **#241** `chat.js:1052-1054`: the `groupId` spread is at **`:1050-1052`**. Lines `:1053-1054` are the archetypeGate comment.
- **#224** `directiveGate.js:166-176`: `text: canonical` is at **`:165`**, one line above the range.
- **#163** `tickStamps.js:211` is `return evidence;`. The `risk` key is at **`:208`**.
- **#90** `agent-evaluate.js:3996` is the comment that states the ≤20 cap. The `.slice(-20)` itself is OLD `:4018` → NEW `:4337`.

### Context the build needs (unchanged anchors whose meaning moved)

- **Deferred battles are no longer "nothing written."** The instrumentation the answers doc (§A3, §F4) said was on no branch landed between OLD and NEW:
  - A run document, always on: `agentEvalRuns/{runId}` (`agent-evaluate.js:500` → writer `:562-572`; rules `firestore.rules:935`).
  - A deferred status-feed beat, built dark: `EVAL_DEFERRED_BEAT_ENABLED = false` (`featureFlags.js:2778`), called at `agent-evaluate.js:479-481`, gated at `:597`, with a DARK_BY_DESIGN entry at `flagPinGuard.test.js:178`.
- **Calls ("Cockpit Build 0") are live at `CALL_RECORDS_MODE = 'shadow'`** (`featureFlags.js:2826`; the mode is resolved once per tick at `agent-evaluate.js:907`).
  - Every tick-capture record is now emitted at **schema version 2**, with the permanent `calls[]` container (`TICK_CAPTURE_SCHEMA_VERSION_CALLS = 2`, `captureConfig.js:46`; selected at `agent-evaluate.js:915`).
  - Row #104 (`captureConfig.js:38`, `= 1`) is SAME, but it now describes only the calls-off shape.
  - Early exits run a Calls hook after their write, and the Haiku start budget carries a +4,000 ms reserve.
- **Evaluation entries gained two fields:** `tickMs` (`agent-evaluate.js:3975`, restamped at `:4382`) and `declarationsPhase` (`:4145`). They sit beside the §E3 transport-hygiene anchors (#67).
- **Still true at NEW (spot-checked):**
  - `vercel.json` still has 41 crons.
  - `firestore.rules` still has no `ticks`/`tickBodies` match block. The new blocks are `declarations`, `calls` and `callObservations` (`:485`, `:490`, `:495`), `agentEvalRuns` (`:935`) and `callSweepQueue` (`:944`).
  - The only TTL fields are still `tickBodies.expireAt` (`firestore.indexes.json:647`) and `signalDropCache.expiresAt` (`:706`). The 32 new lines are composite indexes (`backingStakes` `:566`, `calls` `:580`).
  - `api/_utils/directiveTransaction.js`, `dropReceipt`, `exitBounds`, `scoreState.result` and `FLAGGED_DISPLAY_CAP` are still absent from `api/` and `src/`.
  - The two files the doc cites without line numbers, `test/rules/tickCaptureDenials.rules.mjs` and `api/_utils/anticipationThresholdLint.js`, are byte-identical.
