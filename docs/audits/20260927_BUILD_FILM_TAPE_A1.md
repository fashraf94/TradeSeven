# Build report — Film Room Build A1: the tape (spec V1.2)

**Executor:** Opus (Claude Code) · **Date:** 2026-09-27 · **Spec (authoritative):** `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md`
**Branch:** `claude/hopeful-keller-0xgl6p` · **Cut from:** `origin/main` @ `ef80da13bd0ca7ccfa6ef975808a139412129fa2` (after `git fetch origin`) · **Scope:** A1 only (close pass, candle pass, hub helper, backfill entry, export script). No A2 screen work. No PR, no merge, no flag flip, no index deploy.

---

## Executive verdict (for Flash)

> **Update, 2026-09-28: Astra's branch review.** Astra reviewed `e7e527e7` and returned DO NOT MERGE,
> with nine findings (F1–F9) and R08. All of them are fixed on this branch under spec V1.2 Amendment A
> (BA-23 to BA-30), each red first. **§8** records the round:
>
> - one row per finding;
> - the corrected claim sheet;
> - the seven-site write census;
> - the re-measured cost;
> - a 199-mutant run, now all red.
>
> §8 supersedes the §3 rows, the §4 figures and the §6.1 list that it corrects. There is still no PR,
> no merge, no flag flip and no index deploy.

**A1 is built and dark. The review found one blocker; it is fixed, as is every other confirmed finding.
The branch is pushed. Nothing is merged, flipped or deployed.**

| | |
|---|---|
| **What was built** | Everything A1 names. <br>• **Close pass** (22:15 ET): writes `agentBattles/{id}/tape/{etDate}` for every tiered battle-day. The write is merge-monotone and carries per-section coverage and the BA-21 number classes. <br>• **Candle pass** (07:00 ET): fills the BA-11 replay, plan prices and `tape/{etDate}/series/{symbol}` from prior-session 1-minute bars. It retries up to 3 times within 10 sessions, and a retry never loses what an earlier attempt saved. <br>• **Hub helper** `getReviewAvailability`: Stage 1 is live; Stage 3 is behind `FILM_ROOM_V2_ENABLED`. <br>• **Admin backfill entry**: resumable through the tape's own `passes.close.status`. <br>• **Founder read-out** `scripts/export-film-tape.js` (BA-18): every number is labelled by its class and every section is headed by its coverage line. §2 has the details with `file:line`. |
| **Dark** | Both flags are `false`, with `DARK_BY_DESIGN` in the first commit (`af61db14`). With the writer off, both handlers answer 200 `flag_off` with zero reads, zero writes and zero fetches, and every pass refuses at call time. No existing module imports a tape module. |
| **Fence** | No BUILD_RULES §1 file was edited (`git diff --name-only ef80da13..HEAD`, §2.5). The fenced scorer is imported, never copied. |
| **Verification at the tip** | Full suite on Linux: **0 failing**: 819 files, 16,271 tests (16,207 passed, 64 skipped), exit 0. Baseline was 805 files, 0 failing. Rules suite on the emulator: 18 files, 332 tests, all passed, exit 0. `npm run lint:gate`: exit 0. `vite build`: exit 0. |
| **Review (BUILD_RULES §2)** | Four lenses, one refuter per lens and a mutation lens, each on its own snapshot tree (§7). <br>• **The blocker**, found independently by three reviewers: the tape took the *bought* name's fill as the *sold* position's entry, so every replay on a captured swap was wrong by hundreds of points. The fixtures hid it. It is fixed, and it is guarded by 6 rows that go red without the fix plus a tripwire on the six capture sites. <br>• **The other confirmed findings** are fixed, each with a row named by its finding id; the review file holds 50 rows. 25 of the first 44 were red at the reviewed tip. The other 19 pin code that was already right but that no row could fail on: 18 of them go red under a named mutant, and the 19th restates a rule another row pins. The 6 rows added after the two mutation runs are each proven by their mutant (§7.3, §7.5). |
| **Founder actions owed** | 1. **Before the first candle morning:** create the two `tape` indexes by hand in the Console (§6.3). They are declared in `firestore.indexes.json` but not deployed. <br>2. Review the six HUMAN REVIEW notes on the protected-store allowlist (§6.1). <br>3. Update the BUILD_RULES §6 cron count from 41/100 to 43/100 in a founder-cited PR (§6.2). <br>4. Astra rules on the class judgments (§6.4). <br>5. Run the flip's backfill before the **Saturday 2026-10-03 candle run (07:00 ET)**. That run is the last one that serves 2026-09-21. After it, that day's tape is written `skipped: outside_candle_window` and never gets a replay; each later day gains one more session (§6.7). |
| **Not done, by instruction** | No PR, no merge, no flag flip, no index deploy. |

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
| **ghost** (sold name, as if never sold) | entry price | `trades[].entryPrice` = `closedTrade.entryPrice` (`agentSwapExecution.js:191-193`, `:255-273`, capped 50); receipt `guardrailReplay.outgoingEntryPrice` (`learningSchemas.js:155-156`). **CORRECTED IN REVIEW (§7, L1-F1 — the blocker):** this row first named `ticks.actions[].entryPrice` as the permanent source; it is NOT — every capture site writes the BOUGHT name's fill there (`entryPrice: …incomingAsset?.swapPrice`, `agent-evaluate.js:2027, 3589, 4834, 5051, 5441, 5679`), which is the bought leg's source below | none when the trade has been evicted and there is no receipt; `0` is the executor's no-entry sentinel (`swapPrice \|\| startingPrices \|\| 0`) — a day-2+ sale of a name swapped in on an earlier day records 0 (the nightly reset deletes `swapPrice`), so the leg is null with `ghost.entryPrice` named (§5) |
| | ATR | receipt `guardrailReplay.outgoingBaseATR` (`learningSchemas.js:157`). Risk and model paths record the **scoring** ATR, defaulted (`agent-evaluate.js:2160` `score.baseATR`; `:3402` `activeBaseATR ?? 2.5`); the proposal, R11 and gameplan paths record the raw slot value, null when the slot had none (`:4915`, `:5116`, `:5536`, `:5766`) | **none** when the receipt is absent or its value is null — the trade does not store ATR |
| | tier | `trades[].tier` (slot tier, `agentSwapExecution.js:259`); receipt `resolvedTier` | none when both are absent (`ticks.actions[]` carries no tier) |
| | threshold history | receipt `guardrailReplay.thresholdHistory` = `battle.thresholdHistory[symbolOut]` at the decision (`learningSchemas.js:161`; e.g. `agent-evaluate.js:3704`) | **none** without the receipt |
| | **threshold baseline** *(not named by the spec)* | derivable from recorded facts in two of three cases: **(a)** the position was swapped in the same trading day — receipt `outgoingSwappedInDay` non-null, because the nightly reset deletes `swappedInDay` together with `swapPrice` (`api/cron/agent-daily-scores.js:152-165`) — so baseline = `swapPrice` = the recorded entry price; **(b)** the swap happened on the battle's activation day (ET date of `swappedOutAt` = ET date of `activatedAt`, the evaluator's own test `agent-evaluate.js:1085-1088`) with a starting price, so baseline = `startingPrices[sym]` = the recorded entry price | **(c)** an original pick sold on a later day (or a battle deployed the evening before its session, where `isActivationDay` is false): baseline = the Guard-2-validated `previousClose` — **recorded nowhere** (trade, receipt, tick and entry all lack it; 0B §3-B2 lists the Guard-3 baseline among the executor's unpersisted intermediates, and the executor's `closedTrade` at `agentSwapExecution.js:255-273` confirms it at HEAD). **Degrade:** the ghost leg is `null` with `ghost.thresholdBaseline` in `missingInputs`. |
| **bought** (swapped-in name, from the swap) | entry price | receipt `entryMark` = `incomingAsset.swapPrice` (`learningSchemas.js:141`); the tick action's `entryPrice` records the same fill permanently (the six capture sites above) | none when neither the receipt nor a tick record exists |
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

*(§2–§7 follow; Appendix A — the anchor re-location table — comes last.)*

---

## 2. What each stage built

**Every `file:line` anchor in §2–§6 is VERIFIED.** Each was read at the branch tip named in §7.7
in this session, by a script that printed every cited line. Anchors into files the branch does
not touch (`agent-evaluate.js`, `agentSwapExecution.js`, `learningSchemas.js` and the like) were
VERIFIED at the gate (§1), and those files are unchanged since. New modules live under
`api/_utils/filmTape/` unless another path is given. None of them is imported by an existing
production module; the only importers are the two new cron handlers, the export script and the
tests. So with both flags off, no existing code path changes.

### 2.1 Stage A — the close pass, the writer, the rules, the hub helper

| Piece | Where | What it does |
|---|---|---|
| Flags | `src/config/featureFlags.js:2837-2886` | `FILM_TAPE_WRITE_ENABLED = false` (:2868) and `FILM_ROOM_V2_ENABLED = false` (:2886). Each carries a `// Pinned by: filmTapeFlags.test.js` pointer, and both are in `DARK_BY_DESIGN` (`src/config/flagPinGuard.test.js:180-183`) from the first commit, `af61db14`. They are read at call time inside each function, never at module load. The writer's docstring names the flip map and the flip prerequisites: both indexes, the two crons and the rules block. |
| Constants | `src/constants/filmTape.js` (no imports) | The vocabularies: coverage (:34-41), the BA-8 check states (:48-60), card states (:63-65) and candle statuses (:83-89). The schedules and the budget the time windows are computed from (:98-105), pinned to `vercel.json` by `tapeWiring.test.js`. The BA-21 declarations `TAPE_NUMBER_CLASSES` (:125) and `SERIES_NUMBER_CLASSES` (:235). `classOfNumber` (:260) returns exactly one match or null; `numbersWithClasses` is at :286. |
| ET time | `tapeTime.js` | ET day bounds through `Intl` (`etDayBounds` :63). Sessions from the platform calendar (`sessionFor` :78, `previousSession` :113). The close-pass window (:130). The candle window (`candleWindowStart` :156, `withinCandleWindow` :161). |
| Sources (read-only) | `tapeSources.js` | The day's ticks by `capturedAt`, plus one neighbour on each side (`readDayTicks` :39; the fallback reads the battle's ticks by `tickSeq`, §1.5-5). Receipts (:71), calls (:77), declaration presence (:83), the day's `agentEvalRuns` (:98), intraday-view presence (:105) and the stored tape (:115). Every reader returns `{ ok: false, error }` instead of throwing. **No `tickBodies` read anywhere.** |
| Assembly (pure) | `tapeAssemble.js` | **Checks:** tick, entry, deferred and `no_record` rows (`tickState` :141, `gapRow` :205, `orderChecks` :232, `gapAnalysis` :254). A lost capture whose entry survived is one row (`absorbedGap` :220). **Actions:** joined by the swap key (`swapKey` :289; `buildActions` :383). The sold entry comes from the trade, else the receipt's `outgoingEntryPrice` (:415-417). The bought fill comes from the receipt's `entryMark`, else the tick action (:420-421). A `0` entry is treated as absent and named. **Replay inputs per leg:** `ghostBaseline` :296, `buildReplayInputs` :321. **Directive cards:** a card is committed only when a directive record exists (`cardStateOf` :475). A card belongs to the first battle day on or after its filing (`directiveWindow` :512). Heard is the earlier of the first stamped entry and the first tick control, and never a suppressed one (`buildDirectives` :523, :553-563). `after` is counted from the rows (`afterOf` :493). **Plans:** at the entry's time (:596). **Rationale:** platform-written text is counted but not copied (:623; texts and prefixes :35-51). **Calls:** observed at `copiedAt` (:652). **Score:** taken from the time-ordered union of scored tick rows and scored entry rows (`buildScore` :689). **Battle block:** :721. **Evaluator slots with no run record:** `missingRunSlots` :755. **The document:** passes, per-section coverage and the class declaration (`assembleTape` :776; coverage :868-933). **`skipped_mode`:** :997. |
| Merge (pure) | `tapeMerge.js` | BA-19. Rows are unioned by key with ranked column groups (`SECTION_RULES` :88, `mergeRows` :141). Units are kept by rank: the last check keeps the later instant, the first check the earlier, and the day change keeps its reference (`mergeUnit` :186, `mergeDayChange` :203). Coverage takes the max rank, with `preservedFrom` (:213). `mergeTape` (:239) carries the candle fields from the stored row, recounts `after` from the merged rows and unions the gaps. `mergeCandles` (:348) re-queues when inputs grew or improved inside the window; outside it the status becomes `partial` with `sources_changed_outside_window`. No write happens when the content is unchanged (`contentOf` :45, `finish` :370). |
| Writer | `writeTapeDay.js` | Refuses before any read when the flag is off (:55). A non-tiered battle gets `skipped_mode`. Read, merge and write happen in ONE transaction (:98-102). `markCloseFailed` (:117) never erases a written day. |
| Close pass | `closePass.js`; `api/cron/film-tape-close.js` | **`runClosePass` (:122)** checks in order: the flag (:124), `calendar_missing` (:127), `not_a_trading_day` (:128) and `session_not_closed` (:130). It then selects active battles plus completions since the previous session's ET day (:134; `completionsSinceMs` :59). Per battle, `tapeDateFor` (:65) picks the day itself, or the final day for a completion not yet on the tape (`completionRecorded` :77). There is a 30 s floor, and a failure is recorded and isolated (`safeMarkFailed` :102). **Backfill:** `parseBackfillRange` (:171) accepts sessions only, with `calendar_missing` (:178) and `range_not_closed` (:182). `runBackfill` (:205) uses the tape's own `passes.close.status` as the queue flag, and re-merges a final day that was written before its completion (:223-224). **Handler:** cron guard (:55-57), then the flag before the Firestore handle (:61). A backfill also needs the admin secret (:67). `maxDuration: 300` (:48). The cron entries are `vercel.json:208-215`. |
| Battle result | `battleResult.js:12` | The platform's own completion comparison (`resolveCompletionDisposition`, imported from `api/cron/agent-evaluate.js`), labelled `derived`. |
| Rules | `firestore.rules:508-516`; `test/rules/filmTapeDenials.rules.mjs` | The owner reads, checked against the document's own `ownerId`, on both document kinds. Every client write is denied. |
| Hub helper | `src/utils/reviewAvailability.js` | `getReviewAvailability(battle)` (:143) returns exactly `{ ready, target, availability }` (:65). Stage 1 (`stageOne` :68) reads only the battle document. Stage 3 (`stageThree` :124) sits behind `FILM_ROOM_V2_ENABLED` (:147) and makes one bounded read (4 s). It says `pending` only for a tiered battle, with the writer on, whose owning pass is still to run (`owningPassDate` :92, `closePassStillScheduled` :101, :133-134). |

### 2.2 Stage B — the candle pass, the replay, the series

| Piece | Where | What it does |
|---|---|---|
| Bars | `bars.js` | Converts an EODHD row to its start in ms (:36). Cuts the session in three steps: the target date, then the existing `filterToLatestSession` clamp, then the closing-row policy (`sessionBars` :50). **The price at an instant is the last bar that COMPLETED at or before it** (`priceAt` :73; the rule is at :77). Session open (:83). Ten-minute aggregation anchored on the open (:89). |
| Replay | `tapeReplay.js` | BA-11. `runLeg` (:58) scores one leg with the IMPORTED `calculateAssetScoreServer` (:34, called at :71-72), using the leg's own inputs, extremes `{}` and the mode-resolved tier stamp. `replayAction` (:93) samples three kinds of point: <br>• the swap's own check (the ghost's swap sample; it is excluded from the later checks, :105-107); <br>• the later scored checks; <br>• the close. <br>The bought leg is scored from the swap, so it uses the later checks and the close only (:136). `swapPath[0]` is the banked points (:142). It also computes `gapPoints` (:148), `closedLegDelta` (:153), `boughtVsEvidence`, market and sector change, and `missingInputs`. The fixed label is `REPLAY_LABEL` (:40). |
| Candle pass | `candlePass.js`; `api/cron/film-tape-candles.js` | **`runCandlePass` (:278):** the flag (:281), then `calendar_missing` (:287). Selection is a collection-group query on `tape` for `pending/partial/failed` with `attempts < 3`, inside the 10-session window, oldest first (:292-295). The close-out of an aged-out tape is isolated (:312-315). There is a 30 s floor (:322). A thrown attempt is counted in a transaction, from the tape as it stands (:342-355). <br>**`processTape` (:206)** runs ONE transaction (:221). It re-plans from its own read and leaves a tape that grew mid-fetch queued (:231-232). It keeps the more complete replay and price per row (`keepBetter` :199), counts symbols obtained by an earlier attempt (:247-248), writes the series (`tx.set` :255) and makes the targeted update (`tx.update` :258). <br>**Supporting functions:** the symbol set, including plan-only names (`symbolPlan` :64); the fetch through `fetchIntradayCandles` at `'1m'`, one request per symbol per session, memoised (`barsFor` :90); plan prices (:108); series documents (:125); the retry state machine (`nextCandleState` :182). <br>**Handler:** cron guard (:36-38), the flag before the Firestore handle (:42), `maxDuration: 300` (:29). |

### 2.3 Stage C — the backfill end to end, and the founder read-out

| Piece | Where | What it does |
|---|---|---|
| Read-out formatter (pure) | `tapeExport.js` | Every stored number goes through `labelled()` with the class its own document declares (:49). Counts go through `counted()` as `derived` (:56). Recorded text is printed in “quotes” (:61), and identifiers and intervals in code spans (:67). Every section starts with `coverageLine()` (:73). A closing ledger lists every numeric leaf (:261). The entry point is `formatTapeMarkdown` (:274). |
| Export script | `scripts/export-film-tape.js` | Flags: `--battle <id> --date <etDate>`; `--recent <n>`, scoped to one battle or, without `--battle`, the whole `tape` collection group; and `--out`. `runExport` is at :131. The reader has read methods only (`makeFirestoreReader` :160). There is no flag import, no fetcher and no write call. Markdown goes to stdout and the project line to stderr. `main()` sits behind the CLI guard (:180). |
| Backfill end to end | `api/cron/film-tape-backfill.e2e.test.js` | An admin request goes through the real handler over 2026-09-21..25. <br>• The run stops at the budget floor and names where to resume (:109). <br>• The same request resumes through the queue flag and leaves the written days byte-identical (:127). <br>• A third request writes nothing (:145). <br>• The next candle morning enriches every day (:155). <br>• The read-out reads everything back with the writer flag off (:171). <br>• BA-1 and BA-2 hold over the whole run (:185). |

### 2.4 Commits

| SHA | Stage | Subject |
|---|---|---|
| `af61db14` | A | the writer and screen flags, dark by design; build report §1 (gate) |
| `7f29ae6e` | A | writeTapeDay — the §4 record, merge-monotone, coverage and number classes |
| `ed88bbf7` | A | the close pass (22:15 ET) and the admin backfill entry |
| `76a42e39` | A | rules — owner read, no client write, on tape and series |
| `74d4c2ea` | A | the hub helper getReviewAvailability (spec §11) |
| `a83fdcd7` | B | the replay (BA-11) and the session bars |
| `c8d8c7d6` | B | the candle pass (07:00 ET) — selection, retry, fetch, series, targeted write |
| `3233fb2e` | B fix, found in C | the swap's own check is the swap sample, not a later check |
| `5ac942ae` | A fix, found in C | the backfill refuses a range reaching an unclosed session |
| `19f897e7` | C | the founder read-out (BA-18) and the backfill end to end — **the reviewed tip** |
| `cc4df0b2` | review | register the tape's writers and the replay's scorer call with the repo ratchets |
| `b5b96669` | review | a candle run whose tape grew mid-fetch leaves it queued, never "written" |
| `452890be` | review | the confirmed findings, fixed with red-first rows (§7). *Its message says "27 of its 44 rows were red"; the recorded run says **25** (§7.3), and this report is the correction.* |
| `4b1550aa` | review | the tape's indexes declared, the wiring pinned, the rules row tightened |
| `4121e2cb` | review | allowlist the candle pass's transactional failure record |
| this commit (the tip) | review | six more guard rows for the mutants that survived at `4121e2cb` (§7.5); a stale class declaration removed (§7.4); the flag docstring names both indexes; §2 to §7 of this report |

### 2.5 Fence, cron count and footprint (re-verified at the tip)

- **Fence.** `git diff --name-only ef80da13..HEAD` names **no** BUILD_RULES §1 file. The files checked were `decide.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentBattleService.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js` and `tournamentUserScoring.js`. The diff also does not touch the §2.3 import-boundary baseline or the prompt-honesty registry. Fenced exports are **called, never edited**: `calculateAssetScoreServer` (`tapeReplay.js:71`) and `findActiveAgentBattles` (`closePass.js:134`).
- **Crons.** `vercel.json` goes from **41 before to 43 after**: `film-tape-close` at `15 2 * * 2-6` and `film-tape-candles` at `0 11 * * 2-6`. The two tests that pin the count moved with it (`api/agent/research.dark.test.js`, `api/cron/compute-index-intelligence.axes.test.js`).
- **Footprint.** 45 files changed against `ef80da13`: 36 added and 9 existing files edited; 9,626 insertions and 6 deletions, most of the insertions tests and this report. Existing files edited, all outside the fence:
  - `src/config/featureFlags.js`: the two flags appended;
  - `src/config/flagPinGuard.test.js`: two `DARK_BY_DESIGN` rows;
  - `firestore.rules`: one block;
  - `firestore.indexes.json`: one composite and one field override (§6.3);
  - `vercel.json`: two entries;
  - the two count pins;
  - `api/_utils/flat6TierStamp.passthrough.test.js`: site count 6 → 7, naming the replay;
  - `api/_utils/compositionProtectedStoresAllowlist.json`: six keys and their notes (§6.1).

## 3. Claim sheet for Astra

There is one row per spec §8 invariant and one per §14 finding. Each row names the code that
carries the claim and the tests that fail without it. Tests are cited as `file:line` with their row
names shortened. `tapeReview.test.js` rows are named by their review finding id (§7). "A2" marks a
claim whose screen half belongs to the A2 build; for those, A1's data half is named.

### 3.1 Spec §8 — the honesty invariants

| # | Invariant | Code | Tests |
|---|---|---|---|
| 1 | Every number carries one of four classes and is labelled by it; there is no fifth | The declaration is `src/constants/filmTape.js:125` / `:235`. The resolver `classOfNumber` (:260) returns one match or null. The declaration is stored on every tape and series document (`numberClasses`). The read-out labels each number from the document's own declaration (`tapeExport.js:49`). | `writeTapeDay.test.js:72` "every number … exactly one of the four classes — on every fixture"; `candlePass.test.js:352` "every number is classed — the tape after the candle pass, and every series document"; `tapePure.test.js:125` "an ambiguous declaration is a bug", `:128` "no fifth"; `tapeExport.test.js:142` "no digit is printed outside a labelled number…", `:146` "the scan is live", `:153` "the class comes from the DOCUMENT", `:180` per-field classes, `:192` **THE DECLARATION IS PINNED** (golden, review L4-F7) |
| 2 | Nothing implies a mechanism armed, a guard held, or a datum seen that was not given — including a minute not completed at the check | Risk is a recorded decision or `null` (`riskOf`, `tapeAssemble.js:115`). Heard is never taken from a suppressed stamp (`:553-563`). Prices come from the last COMPLETED minute (`bars.js:73-79`). Diagnostics are labelled "not seen by the agent". | `bars.test.js:54` "a check at 10:07:30 ET reads the 10:06 bar…", `:60`, `:65` "before the first bar completes there is no price"; `tapeReplay.test.js:79`; `writeTapeDay.test.js:107` (BA-7); `tapeReview.test.js` L4-F2 "a suppressed stamp is never heard"; `tapeExport.test.js:304` (BA-7), `:351` (BA-14) |
| 3 | The player's words and the filed text are two fields; the paraphrase never appears; agent text appears only as attributed quotation | `buildDirectives` (`tapeAssemble.js:523`) copies `userMessage` and the filed text separately. It never copies `originalUserAsk`, the counter-offer or the rejection. A card counts as filed only with a directive record (`cardStateOf` :475). `buildRationale` (:623) never copies platform-written text, whether placeholders or guardrail overrides (:35-51). | `writeTapeDay.test.js:266` "the player's words and the filed text are two fields", `:281` "never copies the model's paraphrase…", `:150` "the platform's placeholder text is not copied"; `tapeReview.test.js` L1-F2 (guardrail override), L1-Q3 (committed gate without a record); `tapeExport.test.js:310` (BA-9), `:319` (BA-22 / invariant 3) |
| 4 | A plan gets prices, never a verdict; a call is copied, never judged | Plans carry `price.atPlan` / `atClose` and a basis, nothing else (`candlePass.js:108`); the price is sampled at the entry's time. Calls are copied with `copiedAt` (`tapeAssemble.js:652`). | `candlePass.test.js:62`, `:152`; `writeTapeDay.test.js:323`, `:330`; `tapeReview.test.js` L1-Q4; `tapeExport.test.js:326` (BA-10), `:339` (BA-16) |
| 5 | The tape never writes outside its subcollections and never reads a body | Every write is under `agentBattles/*/tape/**`: `writeTapeDay.js:98-102` and `:117-148`; `candlePass.js:221-270`, `:313` and `:343-355`. No tape module references `tickBodies`. The protected-store scan lists exactly six tape write sites (§6.1). | `writeTapeDay.test.js:506`; `candlePass.test.js:254`, `:263`; `film-tape-backfill.e2e.test.js:185`; `film-tape-close.test.js:85` |
| 6 | Writer off: no cron writes, byte-identical. V2 off: the old screen. Stage 2 changes nothing a player sees | Both handlers answer 200 `flag_off` before `getFirebaseAdmin` (`film-tape-close.js:61`, `film-tape-candles.js:42`). Every pass refuses at call time (`writeTapeDay.js:55`, `:118`; `closePass.js:124`, `:206`; `candlePass.js:281`, review L3-F4). No existing module imports a tape module. The helper's Stage 3 needs `FILM_ROOM_V2_ENABLED` (`reviewAvailability.js:147`). | `film-tape-close.test.js:69` and `film-tape-candles.test.js:57`: zero reads, zero writes and zero fetches, and the admin handle is never taken; `writeTapeDay.test.js:521`; `tapeReview.test.js` L3-F4 "every pass refuses … before any read"; `reviewAvailability.test.js:93` (Stage 2), `:149`; `filmTapeFlags.test.js:38`, `:68`; `export-film-tape.test.js:76` (reads with the flag OFF, writes nothing). The screen half is A2's: A1 changes no screen. |
| 7 | A gap renders as a gap and truncation as truncated; a later run never loses a fact; every section states its coverage | Gaps: `no_record` rows and `passes.close.gaps` (`gapRow` :205, `gapAnalysis` :254), with one row per lost capture (`absorbedGap` :220). Truncation: `deferralsTruncated`. Missing evaluator slots: `missingRunSlots` :755. Merge-monotone: `tapeMerge.js:141`, `:186-213`, `:239`. A candle retry keeps the better result (`candlePass.js:199`, `:241-248`). Coverage is stated per section (`tapeAssemble.js:868-933`). | `writeTapeDay.test.js:87`, `:100`, `:384`, `:402`, `:415`, `:444`, `:50`; `tapePure.test.js:138-158`; `tapeReview.test.js`: L2-F1 (both rows), L2-F3a / L1-F6, L1-F12, L1-Q1, L1-F10, m02–m10, C2–C6, L4-F6 m13/m15, L5 M42a (both), L5 S2; `tapeExport.test.js:113` (every section headed by its coverage) |
| 8 | The hub learns three things: ready, one availability word, and where | `reviewAvailability.js:65` builds exactly `{ ready, target, availability }`. | `reviewAvailability.test.js:43-56` "returns exactly three keys, for every state" (Stage 1 and Stage 3), `:58` "never carries a score, a result, a stage or a reason" |
| 9 | Nothing selects a decisive action, ranks outcomes, or arranges facts toward an unsupported conclusion | Neither §4 nor the code has a ranking or "biggest swing" field. Actions are in time order. The replay carries its fixed label (`REPLAY_LABEL`, `tapeReplay.js:40`), and a later trade in the same slot marks both continued lines hypothetical (`subsequentTradesInSlot`, `tapeAssemble.js` in `buildActions`; printed by `tapeExport.js:129`). | `tapeExport.test.js:332` (BA-11 label); `tapeReview.test.js` L4-F3 "a later trade in the same slot counts, and the read-out marks both continued lines hypothetical". A2 renders. |

### 3.2 Spec §14 — the Sep 27 review, finding by finding

| Finding | A1 code | A1 tests |
|---|---|---|
| 1 Replay arithmetic; the gap includes banked points; hypothetical when later trades exist | `replayAction` (`tapeReplay.js:93`): `gapPoints = (lockedPoints + bought.atClose) − ghost.atClose` (:148); `closedLegDelta` (:153); `swapPath[0]` = the banked points (:142); `subsequentTradesInSlot` is carried. The visual treatment is A2's. | `tapeReplay.test.js:47` "gapPoints 0, not −10", `:161` closedLegDelta, `:91` the swap's own check; `tapeReview.test.js` L4-F3 |
| 2 Headline wording; result only when completed; day change unavailable rather than substituted | `buildScore` (`tapeAssemble.js:689`) takes the last recorded score from ticks or entries; `buildBattleBlock` (:721). The final day learns of a completion that lands after its pass (review L1-F3 / L3-F1, `closePass.js:59-77`, `:134`, `:223`). | `writeTapeDay.test.js:345`, `:353`, `:361`, `:368` "unavailable (never a silent substitute)"; `tapeReview.test.js` L1-F5, m02, m04, and the five close-pass completion rows |
| 3 Risk wording; a missing risk record | `riskOf` (`tapeAssemble.js:115`) returns `null` without a record | `writeTapeDay.test.js:107`; `tapeExport.test.js:304` |
| 4 Directive card labels; no proposed text under "Filed"; the retained directive; the reply labelled; receipt vocabulary | `buildDirectives` (`tapeAssemble.js:523`): `cardState` from the gate statuses, and only with a directive record (:475); `canonicalText` only when committed; `retainedDirectiveText`; `heard`; `agentReplyDiffers`. A filing before the first session lands on the first tape (`directiveWindow` :512). | `writeTapeDay.test.js:266`, `:287`, `:298`, `:306`, `:314`; `tapeReview.test.js` L1-F4, L5 S3, L1-F7 (both), L1-Q3, L4-F2, d01; `tapeExport.test.js:310` |
| 5 One-day horizon verdicts; plan highs and lows; the horizon note | Plans carry two prices, a basis and the horizon note, with no highs or lows (`candlePass.js:108`, `PLAN_PRICE_NOTE` :58) | `candlePass.test.js:62`, `:152`; `tapeExport.test.js:326` |
| 6 Copy `evidence`; both legs' inputs; plan-only symbols in the fetch | `copyEvidence` (`tapeAssemble.js:99`); `buildReplayInputs` (:321), with the sold entry from the trade or receipt and the bought fill from `entryMark` or the tick (:415-421); `symbolPlan` (`candlePass.js:64`) | `writeTapeDay.test.js:115`, `:175`, `:185` (L1-F1), `:204` (L2-F7), `:214` (contract tripwire); `candlePass.test.js:82` |
| 7 Flip-day notice | A2 | — |
| 8 Ways to mislead | Invariant 9 above. The labels are stored with the data (`REPLAY_LABEL`, `PLAN_PRICE_NOTE`). | As invariant 9 |
| 9 Hub copy; unavailable vs pending; the interface narrowed | `reviewAvailability.js`. Stage 3 says `pending` only for a tiered battle, with the writer on, while the pass that will tape its completion is still to run. That pass is the next session's for a holiday, weekend or after-pass completion (review L3-F2). See the interpretation note in §6.8. | `reviewAvailability.test.js:118`, `:125` "a pre-backfill battle is never pending", `:149` "with the writer dark … never pending", `:155` (flat6), `:168-195` (the owning pass) |
| 10 Call provenance; observed-state semantics | `buildCalls` (`tapeAssemble.js:652`): `copiedAt`, `contractVersion`, `tapeWriteMode`, `recordMode: null`, and a call resolved on the day even if minted earlier | `writeTapeDay.test.js:330`; `tapePure.test.js:163`; `tapeReview.test.js` d03 |
| Inv 1 Provenance for every number | As §3.1 row 1 | As §3.1 row 1 |
| Inv 2 HOLD as assurance; diagnostics under Why?; the minute's close after the check | As §3.1 row 2. Diagnostics are carried as presence only (`diagnostics.intradayViews`). | As §3.1 row 2 |
| Inv 3 Reply/rationale contradiction | `agentReplyDiffers` and the fixed labels; guardrail-override text is never shown as the agent's words | `writeTapeDay.test.js:266`; `tapeReview.test.js` L1-F2; `tapeExport.test.js:310`, `:319` |
| Inv 7 Preservation; missingness; truncation display | As §3.1 row 7 | As §3.1 row 7 |
| Inv 8 Helper surface | As §3.1 row 8 | As §3.1 row 8 |
| Inv 6 Wording per flag | As §3.1 row 6 | As §3.1 row 6 |
| Retry path; the "next pass" promise | `nextCandleState` (`candlePass.js:182`) and the 10-session window. An aged-out tape becomes `failed retry_window_elapsed`. A retry keeps the better result. The helper's `closePassStillScheduled` promises only a pass the schedule will run. | `candlePass.test.js:138-213` (the retry rows); `tapeReview.test.js` L2-F1, L2-F4, L2-F6, o01; `reviewAvailability.test.js:168-195` |
| Cut "biggest swing" | Neither §4 nor the code has it | (absence) |
| Add per-section coverage | `tapeAssemble.js:868-933`; `candlePass.js:148-181`; the merge rule `tapeMerge.js:213` | `writeTapeDay.test.js:50`; `tapeExport.test.js:113`; `tapeReview.test.js` C2–C6, m13, m15 |

## 4. Measured cost (fixture set, in-memory store; CPU only)

Measured at the tip by a scratch harness (`zz_measure`, not committed). It runs the real
`writeTapeDay` and `runCandlePass` over the fixture set and counts the store's reads and writes.
CPU times are single runs on a shared 4-core container while other review jobs were running, so they are upper bounds, not benchmarks.

| Fixture battle-day | Status | Checks | Actions | Tape size (JSON bytes) | Assemble + merge (ms) | Firestore reads | Writes |
|---|---|---|---|---|---|---|---|
| capturedDay (26 rows incl. deferred + no_record) | written | 26 | 2 | 32,982 | 12.4 | 10 | 1 |
| noTriggerDay | written | 26 | 0 | 23,526 | 4.2 | 9 | 1 |
| budgetDay | written | 6 | 0 | 10,638 | 2.1 | 9 | 1 |
| completedDay | written | 26 | 0 | 23,573 | 4.5 | 9 | 1 |
| skippedModeDay (flat6) | skipped_mode | 0 | 0 | 4,411 | 0.6 | 2 | 1 |
| preCaptureDay | written | 2 | 1 | 10,540 | 1.1 | 9 | 1 |
| multiDay: 40 checks, each with a six-symbol evidence stamp (×5 days) | written | 40 | 0 | 71,470 – 71,805 | 10.7 – 16.5 | 9 – 10 | 1 |
| capturedDay after the candle pass | written | 26 | 2 | 43,070 | — | — | — |

- **Size.** The largest tape has 40 checks, each with a six-symbol evidence stamp, and is about
  72 KB of JSON. That is inside the spec's "well under 200 KB" and far from Firestore's 1 MiB limit.
  A series document is at most 6,312 bytes; a 14-symbol day's series total 88,312
  bytes across 14 documents.
- **Per-battle wall time.** CPU is 0.6–16.5 ms. Production time is dominated by the 9–10
  Firestore round trips per battle-day: the battle document, the day's ticks plus two neighbours,
  receipts, calls, declarations, run records, intraday views, the prior day's tape, and the
  transaction's read and write. At 30–80 ms a round trip, that is about 0.3–0.9 s per battle. The
  270 s usable budget (300 s less the 30 s floor) therefore covers roughly 300–900 battles a night.
  Beyond that, the rest are named `notReached`, and the backfill entry is their path. The
  completion re-merge (review L1-F3) adds one query per pass. It also adds one document read per
  completion already on its tape, which is skipped on that read.
- **Candle units per morning.** Each distinct (symbol, session) costs one request of 5 units
  (`api/_utils/intraday/intradayFetch.js:105`, G1; `UNITS_PER_REQUEST`, `candlePass.js:55`). The
  fixture morning selected 6 tapes: one 14-symbol day, and five 12-symbol days of another battle,
  with the shared session memoised. It made **62 requests = 310 units** in 2,141 ms
  of CPU. A production morning costs about 5 × Σ over sessions of |∪ symbols of that session's
  tapes|. For example, 20 battles × ~12 symbols, with SPY/RSP, the sector ETFs and common names
  shared, is about 150–240 requests, or **750–1,200 units**. A tape left `partial` refetches its
  whole symbol set on each of its two retry mornings (a 14-symbol day costs 70 units per retry).

## 5. `missingInputs` — the dependency list

Each missing input is carried as `null` plus the input's name, never as a guessed number (spec §6:
"a dependency, not permission to guess").

| Missing input (as named on the tape) | When | What would close it |
|---|---|---|
| `ghost.thresholdBaseline` | An original pick sold on a day other than the battle's activation day, or a battle deployed the evening before its first session. The scorer's Guard-2 `previousClose` baseline is recorded nowhere (§1.2 case c). | Persist the baseline the executor used on the receipt (`guardrailReplay.thresholdBaseline`). The executor computes it inside the fenced `agentSwapExecution.js:218-233`, so this is founder-gated fence contact or an evaluator-side copy — a separate task. |
| `ghost.entryPrice` | The trade was evicted (the 50 cap) and there is no receipt. **Or** the recorded entry is `0`, the executor's no-entry sentinel (`swapPrice \|\| startingPrices \|\| 0`, `agentSwapExecution.js:191-193`). That happens on **every day-2+ sale of a name swapped in on an earlier day**, because the nightly reset deletes `swapPrice` (`agent-daily-scores.js:152-165`) and `startingPrices` holds only the creation portfolio. The tape treats `0` as absent and names it (review L2-F7). | Keep the position's entry through the nightly reset. That is a live-scoring question too (§6.9). |
| `ghost.atr`, `ghost.thresholdHistory` | There is no learning receipt for the swap: capture flags were off at the time, or `classifyEvidence` ≠ `live_agent` | None in A1; the receipt is their only durable home (§1.2) |
| `bought.entryPrice` | There is neither a receipt (`entryMark`) nor a tick record of the action (its `entryPrice` is the bought fill) | None |
| `bought.atr` | No receipt (`entryATR`) | None in A1 |
| `ghost.atr` / `bought.atr` (a null value) | The proposal, R11 and gameplan paths record the slot's raw `baseATR`, which is null when the slot had none. The live scorer then defaulted to 2.5 internally; the tape does not assume that. | Record the scoring ATR on those three receipt paths |
| `ghost.tier` / `bought.tier` | Neither the trade (capped at 50) nor the receipt survives | None; tick actions carry no tier |
| `bars:SYMBOL` | The fetch returned no regular-session bars for the symbol | The candle pass retries up to 3 mornings within 10 sessions; after that the tape says `failed` |
| `price:SYMBOL@<tickSeq \| swap \| close>` | The sample instant came before the session's first minute completed, or the bars have a hole there | None; the sample stays null |
| `lockedPoints` | An action row without recorded locked points | None |
| `replayReason: crypto_not_supported` (a reason, not an input; BA-3's "reason" is stored as `replayReason`, review L1-Q5) | Crypto legs and crypto plans | Out of scope (BA-3) |
| Deferral instant | `agentEvalRuns` keeps no per-battle deferral time, so a `deferred` row carries its run's `startedAt` | Persist `deferredAt` per id on the run record |
| `recordMode` (calls) | The call record carries no minting mode at V1.4 | Add it to the call record contract |
| Shared bar cache (the `source`) | None exists at HEAD: the intraday ring holds 5-minute buckets for actionable symbols only (`api/_utils/intradayConfig.js:107`), so `source` is always `eodhd_1m` | A 1-minute session cache, if one is ever built |

## 6. Found, not fixed — for the founder

1. **Protected-store allowlist: human review owed.** The repo's deny-by-default write scan
   (`api/_utils/compositionProtectedStores.scan.test.js`) requires "a human must review the writer"
   for every new unresolved write site. The six tape sites are listed at count 1, each with a
   `_notes_film_tape_a1` note, in `api/_utils/compositionProtectedStoresAllowlist.json`:
   - `writeTapeDay::set`
   - `markCloseFailed::set`
   - `markCloseFailed::update`
   - `processTape::set` (the series)
   - `processTape::update` (the targeted update)
   - `runCandlePass::update` (the transactional failure record)

   Your review of those six notes is the human step.
2. **The BUILD_RULES §6 cron budget text** still reads 41/100. After this merges it is 43/100.
   BUILD_RULES changes only by founder-cited PR, so it is not edited here.
3. **Indexes to create by hand in the Console.** Both are declared in `firestore.indexes.json` on
   this branch, per the index-drift rule's dual write (`FIRESTORE_INDEX_DRIFT_CLEANUP.md` (repo root),
   "Related notes"). **This build deploys neither** and never runs
   `firebase deploy --only firestore:indexes`.

   | # | Console entry | Serves | When it is needed |
   |---|---|---|---|
   | 1 | **Composite**: collection ID `tape`, query scope **Collection group**, fields **`passes.candles.status` Ascending, `etDate` Ascending** | The candle pass's selection: `collectionGroup('tape').where('passes.candles.status','in',[pending,partial,failed]).where('etDate','>=',…).orderBy('etDate','asc')` (`candlePass.js:292-295`) | **Before the first candle morning after the writer flip.** Without it the query fails `FAILED_PRECONDITION`, the handler returns 500, and nothing is processed. The failure is loud and loses nothing if the index is made inside the 10-session window. |
   | 2 | **Single-field exemption**: collection ID `tape`, field **`etDate`**. Add **Descending** at **Collection group** scope and keep the collection-scope defaults (asc, desc, array-contains). | `export-film-tape --recent <n>` **without** `--battle`: `collectionGroup('tape').orderBy('etDate','desc')` (`scripts/export-film-tape.js:169-170`) | Only for that read-out mode. No cron needs it. A battle-scoped `--recent` needs nothing. |

   **Nothing else.** Every other query is a single-field range on one collection, served by the
   automatic indexes: `agentBattles.completedAt`, `ticks.capturedAt`, `ticks.tickSeq`,
   `agentEvalRuns.startedAt` and `intradayViews.evaluatedAt`. The issued queries are checked
   against the file by `tapeWiring.test.js:74-109`, which goes red without the entries.
4. **Class judgments for Astra.** BA-21 has no fifth class.
   - **(a)** A missing check's `tickSeq` (in a `no_record` row, and in `passes.close.gaps[]` /
     `unattributedGaps[]`) is now classed **`recorded` everywhere**. That settles review
     L1-F9a / L4-F8a, where the same number carried two classes. The declaration is per path, and
     `checks[].tickSeq` must stay `recorded` for tick rows. The number is an identifier the counter
     minted, not a measurement. Two refuters proposed `derived` instead. For the gaps lists that is
     one line each in `src/constants/filmTape.js`. For the `no_record` row it would also need the
     number moved to a field of its own, because the declaration is per path.
   - **(b)** `boughtVsEvidence.pxDelta` / `chgDelta` and `closedLegDelta` are arithmetic between a
     rebuilt or market value and a recorded one. They are labelled `rebuilt`.
   - **(c)** `bought.thresholdHistory` {0, 0} is labelled `recorded`. It is the executor's own write
     at the swap (`agentSwapExecution.js:307-311`), and review L1-F9b / L4-F8b was refuted on that
     ground.
5. **Coverage notes carry counts inside prose**, for example "1 minted check(s) of this day have
   no record (tickSeq 13)". The read-out prints a note as the tape's own quoted words. Every number
   a note repeats is classed at its numeric home, and the read-out test proves no *stored* number
   hides inside quotes. A2 should render a note as the section's coverage statement, not as numbers.
6. **H-2** (a final-day legacy review dated the day after) is untouched, per spec §11 and §12. It
   is its own one-line PR.
7. **Backfill timing against the candle window** (review L3-Q2). A backfilled day is written
   `pending` for candles only while the next candle run still serves it; otherwise it is written
   `skipped: outside_candle_window`, and that is final. The last candle run that serves
   **2026-09-21** is **Saturday 2026-10-03, 07:00 ET** (`candleWindowStart('2026-10-03')` =
   2026-09-21). Each later day gains one session. So the flip PR's backfill should run before that
   morning, and earlier still if retries are wanted, because a day backfilled at the edge gets one
   attempt.
8. **Two spec widenings made in review, for the record.**
   - **§5 selection.** The spec selects "completed with `completedAt` on the ET date". Tiered
     battles expire at 20:00 ET, after the evaluator's last run, and so complete on a later date:
     the next weekday's sweep, a holiday or a weekend redeploy (review L1-F3 / L3-F1, which also
     found the gap in the spec's sentence). The pass therefore selects completions since the
     previous session's ET day and re-merges the final day. The backfill re-merges a final day that
     was written before its completion.
   - **§11 Stage 3.** The spec says "`'pending'` only when the battle completed today and tonight's
     close pass is scheduled for it". The helper now says `pending` until **the pass that will tape
     the completion** has run. That is the next session's pass for a weekend or holiday completion,
     or for one after the night's pass started. It never says `pending` for a flat6 battle (its pass
     writes `skipped_mode`) and never with the writer dark. This keeps §11's rule, "never 'pending'
     for work nothing will do", now that such completions are taped. Stage 3 cannot be reached until
     flip (2).
9. **Out of scope, for separate tasking (unverified).** Live scoring of a position swapped in on an
   earlier day may use an entry of `0` from day 2. The nightly reset deletes `swapPrice`,
   `previousSwapPrice` is never read, and `startingPrices` has no swap-in writer (raised by L2 and
   its refuter). The tape does not depend on it (§5 `ghost.entryPrice`). Whether live scoring does
   is a question for the scoring owner.
10. **The close cron's import graph** (review L3-Q3, judged not a finding). `battleResult.js`
    imports `api/cron/agent-evaluate.js` to reach the pure `resolveCompletionDisposition`. That
    adds about 60–130 ms to the close cron's cold start. The refuter found no import-time side
    effects, and the candle cron does not import it. Optional follow-up: move that function into an
    `api/_utils` module that `agent-evaluate.js` re-exports.
11. **No per-fetch time bound** (an L2 question). `fetchIntradayCandles` uses a bare `fetch`, and
    the 30 s floor is checked between tapes. A tape started with more than 30 s left could be killed
    at 300 s. Its attempt is then not counted, because the kill skips the transactional failure
    record, and the tape stays selectable. Not measured against EODHD latency.

    **Double invocation** (also L2's). A double-fired cron or a manual run on the same morning spends two attempts, because there is no per-run idempotency key. The third attempt is terminal, so a tape can lose a retry that way.

## 7. The §2 adversarial review — the written record

### 7.1 How it ran

- **Four lenses** reviewed the stage-C tip, `19f897e7`. Each worked on its own `git archive`
  snapshot, with `node_modules` symlinked. Each was told to *break* the build and to prove every
  finding with a scratch repro kept in its snapshot:
  - **L1** — tape domain correctness: assembly, merge, the writer and the close pass;
  - **L2** — the candle pass, the replay and the bars;
  - **L3** — wiring, lifecycle, the flag-off guarantee, the rules, the crons and the hub helper;
  - **L4** — test integrity and the founder read-out. L4 used a mutation harness of 51 mutants
    over the tape suites.
- **One refuter per lens** (R-L1 to R-L4), each on its own snapshot, re-ran the repros and tried to
  refute each finding. Each gave a verdict and its own severity.
- **The coordinator** found one defect while the lenses ran: a candle run whose tape grew mid-fetch
  was marked `written` (`b5b96669`; L2-F4 and L4-F4 then found the same thing). The coordinator also
  caught two repo ratchets through the full suite (`cc4df0b2`).
- **The mutation lens L5 ran last**, on its own snapshot of `4b1550aa`. That is the fixed code; the
  one later commit, `4121e2cb`, changes only the allowlist JSON. **The coordinator also re-ran L4's
  mutants at `4121e2cb`** (§7.5).
- No subagent wrote to the main working tree. Read-only git commands outside the permitted form are
  disclosed in §7.6.

### 7.2 Verdicts and dispositions

Severity is the lens's severity, then the refuter's. "Row" names the guard: a `tapeReview.test.js`
row by its finding id unless another file is given.

| Finding | Severity (lens → refuter) | Refuter verdict | Disposition |
|---|---|---|---|
| **L1-F1 = L4-F1 = R-L2 NEW-1** — the tick action's `entryPrice` is the BOUGHT name's fill, but it was read as the SOLD position's entry. The ghost leg, `gapPoints`, `closedLegDelta` and the read-out's "entry" were all wrong on every captured swap (e.g. `gapPoints` 665.5 instead of 70.5), and the fixture hid it. | **BLOCKER → BLOCKER** (three reviewers independently) | CONFIRMED | **Fixed** `452890be`. The sold entry now comes from `trades[].entryPrice`, else the receipt's `outgoingEntryPrice`. The tick value is the bought basis. The fixture's tick actions carry what the writers write. Rows: `writeTapeDay.test.js:185`, `:204`, and `:214` (a contract tripwire on the six capture sites). Six rows go red with the old assembler. §1.2's table is corrected in place. |
| L1-F2 — guardrail-override text was copied as the agent's words | major → major | CONFIRMED | Fixed (`PLATFORM_RATIONALE_PREFIXES`). Row L1-F2. |
| **L1-F3 = L3-F1** — a completion that lands after the final day's pass (on a holiday, a weekend, or after that night's pass) never reached the final-day tape, and the backfill could not repair it | major → major; R-L1: wider than filed; R-L3: latent until the flip, 12 of 318 sessions through 2027 | CONFIRMED | Fixed. The pass selects completions since the previous session's ET day and re-merges the final day; the backfill re-merges a final day written before its completion; a completion already recorded is skipped on one read. Five rows (the close-pass completion block). Spec §5 widening: §6.8. |
| L1-F4 — a directive filed before the first session was on no tape, while its coverage said `complete` | major → major | CONFIRMED | Fixed (`directiveWindow`). Row L1-F4. |
| L1-F5 — the last score ignored a later check known only by its entry | major → minor | CONFIRMED | Fixed (the time-ordered union in `buildScore`). Row L1-F5. |
| **L1-F6 = L2-F3a** — a re-run whose receipts read failed wiped the saved replay inputs while coverage said `complete` / preserved | major → major (R-L1); minor (R-L2) | CONFIRMED | Fixed. The input group is ranked by how many legs it holds. Row L2-F3a / L1-F6. |
| L1-F7 — heard could come out late; a re-run could move it later | minor, latent | CONFIRMED | Fixed. Heard is the earlier of entry and tick, and the merge keeps the earlier. Two rows. |
| L1-F8 — first check, `after` counts and `lockedPoints` could be lost on eviction | minor, latent | CONFIRMED | Fixed. First check ranks earliest, `after` is recounted from the merged rows, and `lockedPoints` and `entryPrice` are column groups. Guarded by the merge rows (m02, m10), L5 M42a's first-check row and `tapePure.test.js:138`. |
| L1-F9 / L4-F8 — number classes | (a) nit, (b) —, (c) minor latent | (a) CONFIRMED, (b) **REFUTED** by both, (c) CONFIRMED | (a) Minted tickSeqs are classed `recorded` everywhere, a class judgment for Astra (§6.4). (b) No change. (c) `hypothesisVersion` is declared. The golden is `tapeExport.test.js:192`. |
| L1-F10 — a phantom `preservedFrom`, and one extra write | minor → nit | PARTIALLY | Fixed; only surviving leftovers count as carried. Row L1-F10. |
| L1-F11 — the close pass could tape a session still in progress | minor | CONFIRMED | Fixed (`session_not_closed`). Row L1-F11. |
| L1-F12 — a missing run record (a killed run) read as `complete` | minor | CONFIRMED | Fixed (`missingRunSlots`). Row L1-F12. |
| L1-F13 — "not being minted" was asserted without reading the mode | minor → nit | CONFIRMED | Fixed. The note now states facts, not a conclusion. Rows L1-F13 and m15. |
| L1-Q1 — a lost capture with a surviving entry was shown as two rows | question → minor | CONFIRMED | Fixed (`absorbedGap`). Row L1-Q1. |
| **L1-Q2 = L2-F3b** (and R-L4's outside-list item) — inputs that became complete never re-queued the candle pass | question → minor / note | CONFIRMED | Fixed. Improved inputs re-queue within the window. Row L2-F3b. |
| L1-Q3 — a committed gate with no directive record read as filed | question → minor, latent | CONFIRMED | Fixed. A card counts as committed only with a directive record. Row L1-Q3. |
| L1-Q4 — the plan time was the tick's capture time | question → nit | PARTIALLY | Fixed; the plan uses the entry's time. Row L1-Q4. |
| L1-Q5 — `replayReason` vs BA-3's "reason" | question | **REFUTED** | No change. The key is named in §5. |
| L2-F1 — a candle retry recomputed and wiped earlier facts | major → major | CONFIRMED | Fixed. The better result is kept per row, and earlier-obtained symbols count. Two L2-F1 rows. |
| L2-F2 — the bought leg was sampled before its purchase; `swapPath[0]` ≠ `lockedPoints` | major → major | CONFIRMED | Fixed. The bought leg is scored from later checks and the close only, and `swapPath[0]` is the banked points. Guarded by `tapeReplay.test.js` (the fork and early-instant rows). |
| **L2-F4 = L4-F4** — the candle write came from a stale plan; the thrown path counted from a stale snapshot | minor → minor (R-L2); major (L4) | CONFIRMED at `19f897e7` | Main part fixed in `b5b96669` (`candlePass.test.js:289`, red first). The thrown path is fixed in `452890be`, which counts attempts in a transaction (row L2-F4). |
| L2-F5 — outside the window, a grown tape kept a stale `written` | minor → note (latent) | PARTIALLY | Fixed: `partial`, with an outside-window note. Row L2-F5 / o02. |
| L2-F6 — one failed aged-out marker cost the whole morning | minor | CONFIRMED | Fixed; the close-out is isolated. Row L2-F6. |
| L2-F7 — a `0` entry was not named | minor → note (minor once NEW-1 was fixed) | PARTIALLY | Fixed; `0` is treated as absent and named. `writeTapeDay.test.js:204`. |
| **L2-F8 = L3-F6 = L4-F9** — no index declared for the tape's collection-group queries | minor (must precede the flip) | CONFIRMED / PARTIALLY | Fixed by declaration in `4b1550aa`, checked by `tapeWiring.test.js:74-109`. Console creation is owed (§6.3). |
| R-L2 NEW-2 — fixture timing (the swap was recorded on a later check) | note | — | Fixed in the fixture. |
| L3-F2 — Stage 3 said `pending` on a holiday; `gameMode` was ignored (the refuter's adjacent find) | minor → minor | PARTIALLY | Fixed: `owningPassDate`, and tiered only. `reviewAvailability.test.js:155`, `:181-195`. Spec §11 widening: §6.8. |
| L3-F3 — the schedules were not tied to the constants | minor → minor | PARTIALLY (the `maxDuration` half REFUTED) | Fixed: `tapeWiring.test.js:115-128`. |
| L3-F4 — `runCandlePass` did not read the flag | minor → note | CONFIRMED | Fixed; every pass refuses. Row L3-F4. |
| L3-F5 — the backfill auth comment was wrong | minor → note | CONFIRMED | Fixed: `film-tape-close.js:19-33`, `film-tape-close.test.js:109`. |
| L3-F7 — after the maintained calendar ends, the pass went quiet instead of loud | minor → note | CONFIRMED | Fixed (`calendar_missing` in all three passes). Row L3-F7. |
| L3-F8 — the report pointed to sections that did not exist yet | minor (docs) | — | This report's §2–§7. |
| L3-Q1 / Q2 / Q3 | questions | Q3: **not a finding** | §6.2, §6.7, §6.10. |
| L4-F2 — no fixture had a suppressed stamp | major → major | CONFIRMED | Row L4-F2 (red under d02). |
| L4-F3 — `subsequentTradesInSlot > 0` was never exercised | major → major | CONFIRMED | Row L4-F3 (red under o04 and o05). |
| L4-F5 — six merge rules could be deleted with the suite green | major → minor | PARTIALLY (5 of 6; m04 an equivalent mutant) | Rows m02–m10 (all red under their mutants, m04 included). |
| L4-F6 — seven BA-20 reasons could be deleted with the suite green | major → major | CONFIRMED (7 of 7) | Rows C2–C6 at `452890be`. **m13 and m15 were still uncovered at `4121e2cb`** (the refuter flagged this; the re-run confirmed it). The final commit adds rows L4-F6 m13 and m15, each red under its mutant. |
| L4-F7 — the read-out test's quote and code-span exemption hid numbers; classes were pinned for four paths only | major → major | CONFIRMED | Fixed: the scan was tightened, per-field class rows added, and the golden declaration at `tapeExport.test.js:192`. e01–e04 are now red. |
| L4-F10 — named cases no test could fail on | minor → minor | PARTIALLY (4 of 5; o02 unreachable) | Rows d01, d03, o01, o03, and o02 anyway. |
| L4-F11 — the rules source row sliced to the end of the file | minor | **REFUTED** as a guard gap (the emulator rows catch it) | Tightened anyway (`4b1550aa`). |
| L4-F12 — the fixture header wrongly said no composer existed | minor → nit | CONFIRMED | Fixed. Run records now come from `composeEvalRunRecord`. |

**Tally.** One blocker, found independently by three reviewers.

- **Refuted outright:** L1-Q5, and L4-F11 as a guard gap.
- **Refuted in part:** L1-F9b / L4-F8b, L4-F8c, the `maxDuration` half of L3-F3, L4-F5's m04 (an equivalent mutant) and L4-F10's o02 (unreachable).
- **Not a finding:** L3-Q3.

Everything else was confirmed or partly confirmed. **Every confirmed finding is fixed**, including the ones judged latent or a nit. The open questions that were not fixed are carried to §6 (6.7, 6.9, 6.10, 6.11).

### 7.3 Red first

- **`tapeReview.test.js` against `19f897e7`'s source**, with the review's fixtures: **25 of 44 rows
  red** (`scratchpad redfirst.log`). The commit message of `452890be` says 27; that is wrong, and
  this is the correction. The 19 rows that were green close guards that could not fail: L4-F2, d01
  (×2), d03, o01, o03, L4-F3, m02, m04–m07, m10, C2–C6, and L2-F1's later-success row. Their proof
  is the mutant, not the old tree: 18 of them go red under a named mutant (§7.5). The 19th, L2-F1's
  later-success row, is a companion. The rule it restates (a later success clears the tape) is pinned
  by `candlePass.test.js:181`, which goes red when `keepBetter` always keeps the stored result;
  the review row itself stays green under that mutant.
- **The blocker's rows.** With `19f897e7`'s `tapeAssemble.js`, **6** `writeTapeDay.test.js` rows
  go red. The seventh, the contract tripwire, reads the capture sites' source and is green by design.
- **`b5b96669`'s row** was red first: the tape read `written` with attempts 1.
- **The final commit's six rows** (L4-F6 m13 and m15; L5 M42a and its first-check twin; L5 S2; L5 S3) pass on the real code, and each is red under its mutant (§7.5). They guard code that was already right but that no row could fail on.

### 7.4 What changed, by commit

| Commit | Content |
|---|---|
| `cc4df0b2` | The repo ratchets the full suite caught. The replay's scorer call carries the mode-resolved tier stamp, and the flat6 site pin moves 6 → 7. The tape's write sites are allowlisted with HUMAN REVIEW notes. |
| `b5b96669` | A candle run whose tape grew mid-fetch leaves it queued. |
| `452890be` | Every confirmed L1–L4 finding in the tape, merge, candle, replay, close-pass and helper code, with the 44 review rows. |
| `4b1550aa` | Both indexes declared; the wiring pins (queries against the index file; schedules and budget against the constants); the rules source row reads exactly the tape block. |
| `4121e2cb` | The transactional failure record is allowlisted (the sixth site). |
| this commit (the tip) | Six guard rows for the mutants that survived at `4121e2cb`: L4-F6 m13 and m15 (from L4's re-run), and L5 M42a with its first-check twin, L5 S2 and L5 S3 (from L5). Each is red under its mutant. A stale class declaration removed: `actions[].replay.bought.atSwap`, which no longer exists since L2-F2. The flag docstring names both indexes. The report's §2–§7. |

### 7.5 Mutation results

**L5, the mutation lens** (its own snapshot of `4b1550aa`; each mutant applied alone, its tests run,
the file restored and checked with `cmp`):

L5's baseline on the unmutated tree was 14 files / 272 tests green, and the rules suite was 21 tests green under the emulator. **58 of 59 named runs went red.** The one hollow named guard is **M42a**, and the extra probes found **S1–S3** hollow in the same way. The final commit's rows now cover all four (see below).

| id | Edit (file:line at `4b1550aa`) | Result | First failing test |
|---|---|---|---|
| M1 | `tapeReplay.js:149` `gapPoints` without the banked points | RED (5) | "a sale banking 10 … → gapPoints 0, not −10" |
| M2 | `bars.js:77` price from the bar containing the instant | RED (6) | "a check at 10:07:30 ET reads the 10:06 bar …" |
| M3 | `tapeMerge.js:169` stored leftover rows dropped | RED (2) | "a stored row the new read lacks is kept …" |
| M4 | `tapeMerge.js:165` candle columns from the new row | RED (2) | "a close pass AFTER the candle pass keeps every candle field" |
| M5 | `tapeMerge.js:214` coverage is the new coverage | RED (3) | L2-F3a (preservedFrom) |
| M6 | `tapeAssemble.js:84` `evictionPossible = false` | RED (1) | "multi-day at 150 …" |
| M7 | `reviewAvailability.js:71-73` a fourth key `stage: 1` | RED (7) | "stage 1 returns exactly three keys" |
| M8 | `film-tape-close.js:60` the admin handle before the flag | RED (1) | "FLAG OFF: … the admin handle is never taken" |
| M9 | `writeTapeDay.js:55` flag throw deleted | RED (1) | "flag off: writeTapeDay refuses before any read or write" |
| M10 | `candlePass.js:281` flag throw deleted | RED (1) | L3-F4 |
| M11 | `tapeReplay.js:71-74` a local scorer | RED (5) | "swap the imported scorer and every rebuilt number follows it" |
| M12 | `candlePass.js:187` no attempts-exhausted branch | RED (1) | "… a fourth morning never selects it" |
| M13 | `tapeExport.js:52` `labelled()` prints the bare value | RED (11) | the digit scan |
| M14 | `tapeExport.js:208` Plans without its coverage line | RED (1) | "plans: the line after its heading is its coverage" |
| M15 | `tapeExport.js:110` raw `c.tickMs` | RED (2) | the digit scan |
| M16 | `tapeExport.js:164` `lockedPoints` smuggled through `quoted()` | RED (3) | the digit scan |
| M17 | `filmTape.js:202` `gapPoints` declared `recorded` | RED (3) | the declaration pin |
| M18 | `closePass.js:224` backfill never skips written days | RED (3) | e2e "request 2 … written days are skipped" |
| M19 | `closePass.js:182` `range_not_closed` deleted | RED (2) | "the backfill entry validates its range" |
| M20 | `tapeReplay.js:106-107` own-check exclusion removed | RED (1) | "the check that made the swap is the swap sample …" |
| M21 | `tapeAssemble.js:415` **the blocker re-introduced** (tick `entryPrice` first) | RED (6) | "the tick action's entryPrice is the BOUGHT name's fill (L1-F1)" |
| M22 | `tapeAssemble.js:56` `pos` accepts 0 | RED (1) | L2-F7 |
| M23 | `tapeAssemble.js:46-49` prefixes emptied | RED (1) | L1-F2 |
| M24 | `tapeAssemble.js:513` `directiveWindow` → the ET day | RED (1) | L1-F4 (the first-day branch; see S3) |
| M25 | `tapeAssemble.js:693` the score from tick rows only | RED (1) | L1-F5 |
| M26 | `tapeAssemble.js:563` heard prefers the entry | RED (1) | L1-F7 |
| M27 | `tapeAssemble.js:556, 558` suppression ignored (each half alone is also RED) | RED (1) | L4-F2 |
| M28 | `tapeAssemble.js:480` a committed gate is always filed | RED (1) | L1-Q3 |
| M29 | `tapeAssemble.js:756` `missingRunSlots` → `[]` | RED (1) | L1-F12 |
| M30 | `tapeAssemble.js:221` `absorbedGap` → false | RED (1) | L1-Q1 |
| M31 | `tapeMerge.js:96` input group by anchor presence | RED (1) | L2-F3a / L1-F6 |
| M32 | `tapeMerge.js:109` heard as a plain group | RED (1) | L1-F7 (merge) |
| M33 | `tapeMerge.js:358` `|| improved` dropped | RED (1) | L2-F3b |
| M34 | `tapeMerge.js:362` outside-window re-queue dropped | RED (1) | L2-F5 / o02 |
| M35 | `candlePass.js:199` `keepBetter` → fresh (the plan half alone is also RED) | RED (1) | L2-F1 |
| M36 | `candlePass.js:248` `obtainedBefore` ignored | RED (1) | L2-F1 |
| M37 | `candlePass.js:312-318` aged-out try/catch removed | RED (1) | L2-F6 |
| M38 | `tapeReplay.js:136` bought leg over all samples | RED (2) | `price:INX@swap`; scorer call count |
| M39 | `closePass.js:61` completions since today only | RED (4) | the holiday / weekend / after-pass rows |
| M40a | `firestore.rules:509` tape read → any signed-in user | RED (6) | 5 emulator rows + the text pin |
| M40b | `firestore.rules:514` series write → any signed-in user | RED (4) | 3 emulator write-denial rows + the text pin |
| M41 | `reviewAvailability.js:94` `owningPassDate` → own date | RED (3) | "a weekend completion … Monday's pass" |
| **M42a** | `tapeMerge.js:265` `lastCheck` takes the new read | **GREEN 272/272 — hollow** | none |
| M42b–f | `tapeMerge.js` result rank / intraday views / `deferralsTruncated` / sectors / span `from` | RED (1 each) | m04, m05, m06, m07, m10 |
| M43a–e | `tapeAssemble.js` the five C-row reasons deleted | RED (1 each) | C2, C3, C4, C5, C6 |
| M44 | `filmTape.js:65` NO_CHANGE → `['no_change']` | RED (2) | d01 |
| M45 | `candlePass.js:299` newest first | RED (1) | o01 |
| M46 | `tapeAssemble.js:468` `subsequentTradesInSlot = 0` | RED (1) | L4-F3 |
| M47 | `firestore.indexes.json` the tape composite deleted | RED (1) | the composite pin |
| M48 | `vercel.json:210` `15 3 * * 2-6` | RED (1) | the close-pass schedule pin |

**L5's extra probes**, each run against all 14 files:

| id | Edit | Result |
|---|---|---|
| S1 | `tapeMerge.js:266` `firstCheck` takes the new read | **GREEN — hollow** |
| S2 | `tapeMerge.js:222` span `to` from the new read | **GREEN — hollow** |
| S3 | `tapeAssemble.js:519` the later-day window → the ET day (a weekend filing lands on no tape) | **GREEN — hollow** |
| S4 | `film-tape-candles.js:41` the admin handle before the flag | RED |
| S5 | `writeTapeDay.js:118` `markCloseFailed`'s flag throw deleted | RED |
| S6 / S7 | `closePass.js:124` / `:206` the pass and backfill flag throws, each alone | RED / RED |

**Closed in the final commit.** The rows are "L5 M42a" (the last check), its first-check twin (S1),
"L5 S2" (the span's end) and "L5 S3" (the weekend filing). The code was right in each case; no row
could fail on it. Each row passes on the real code and is **red under its mutant**, re-run in a fresh
snapshot. L5 also noted two things that are not findings: M38's rows pin the cause (the swap is left
out of the bought leg's samples) rather than the downstream ratchet, and M43a is caught by C2's note,
not its status.

**The re-run of L4's mutants at `4121e2cb`.** L4's harness (`mut.mjs`) was pointed at two fresh
snapshots. It ran 46 mutants over the tape suites, the close and candle handler suites, the export
script, the helper and the flag pins; the backfill e2e was left out for speed, since leaving a file
out can only hide a red, never make one. Before any mutant, each tree's baseline was 265/265 green.
The mutants: the 25 that survived L4 at `19f897e7`, three of them re-targeted to the changed code
(m02, m15, o02); the e05 control; o06; m08 and m09; and 17 of L4's originally-red r-mutants that
still apply.

- **44 of 46 went red.** r15 went red on a second run. It needs the byte-identical copy of the scorer
  (`agentScoringLocalCopy.js`) that L4 had created by hand; with the copy in place for the run, and
  deleted after, it goes red on 2 rows.
- **2 survived: m13 and m15.** These are the L4-F6 reasons the refuter had flagged. The final commit
  adds a row for each. Re-run against the new rows, **both go red** (1 row each).

| Mutant | Defect | Red | First red row |
|---|---|---|---|
| d01 | NO_CHANGE statuses narrowed to `no_change` | 2 | `tapeReview.test.js` — L1 — the tape document L4-F10 d01: gate status no_proposal is a "no change" card |
| d02 | heard ignores suppression (entry and tick) | 1 | `tapeReview.test.js` — L1 — the tape document L4-F2: a suppressed stamp is never "heard" — on the entry or on the tick |
| d03 | a call resolved on the day but minted earlier is dropped | 1 | `tapeReview.test.js` — L1 — the tape document L4-F10 d03: a call minted the day before and resolved on the day is on the day's tape |
| e01 | `lockedPoints` printed as quoted text | 3 | `tapeExport.test.js` — BA-21 — every number labelled by the class its document declares no digit is printed outside a labelled number… |
| e02 | `lockedPoints` printed as a code span | 3 | `tapeExport.test.js` — BA-21 — every number labelled by the class its document declares no digit is printed outside a labelled number… |
| e03 | `ghost.atClose` labelled through another field (prints `recorded`) | 1 | `tapeExport.test.js` — the class each printed number carries is its own field's (review L4-F7) replay, reconciliation, comparables an… |
| e04 | seven rebuilt/market declarations flipped to `recorded` | 2 | `tapeExport.test.js` — the class each printed number carries is its own field's (review L4-F7) replay, reconciliation, comparables an… |
| e05 | control: one bare unlabelled number | 3 | `tapeExport.test.js` — BA-21 — every number labelled by the class its document declares no digit is printed outside a labelled number… |
| m02b | score units taken from the new read (re-targeted) | 1 | `tapeReview.test.js` — L4-F5 — the merge keeps facts a later read lost m02: the day change keeps its reference when the prior day's t… |
| m04 | battle result / final taken from the new read | 1 | `tapeReview.test.js` — L4-F5 — the merge keeps facts a later read lost m04: a stored result is not replaced by a derived one |
| m05 | intraday-view presence taken from the new read | 1 | `tapeReview.test.js` — L4-F5 — the merge keeps facts a later read lost m05: intraday views seen once stay "present" |
| m06 | `deferralsTruncated` not sticky | 1 | `tapeReview.test.js` — L4-F5 — the merge keeps facts a later read lost m06: a truncated deferral list stays recorded when the run rec… |
| m07 | sectors not unioned | 1 | `tapeReview.test.js` — L4-F5 — the merge keeps facts a later read lost m07: a sector seen once stays among the comparables |
| m08 | coverage taken from the new read | 1 | `writeTapeDay.test.js` — BA-19 — merge-monotone monotonicity: write, evict the source, write again — every fact kept, the section marke… |
| m09 | `preservedFrom` never set | 2 | `tapeReview.test.js` — L2 — the candle pass never loses what it saved L2-F3a / L1-F6: a re-run whose receipts are gone keeps the save… |
| m10 | coverage span not unioned | 1 | `tapeReview.test.js` — L4-F5 — the merge keeps facts a later read lost m10: a section's span never shrinks |
| m11 | the "entry absent" reason removed | 1 | `tapeReview.test.js` — L4-F6 — every BA-20 reason lowers its section C5: a tick naming an evalId whose entry is absent → plans, ratio… |
| m12 | actions always provable | 1 | `tapeReview.test.js` — L4-F6 — every BA-20 reason lowers its section C6: capture incomplete with trades[] at its 50 cap → actions par… |
| m13 | the "heard stamp may be missing" reason removed | 0 → 1 | **survived at `4121e2cb`** → the final commit's row goes red (1) |
| m14 | the "declarations record absent" reason removed | 1 | `tapeReview.test.js` — L4-F6 — every BA-20 reason lowers its section C4: an expected declarations record that is absent → calls parti… |
| m15b | the "no declarations phase" note removed (re-targeted) | 0 → 1 | **survived at `4121e2cb`** → the final commit's row goes red (1) |
| m16 | the "run records unreadable" reason removed | 1 | `tapeReview.test.js` — L4-F6 — every BA-20 reason lowers its section C2: run records unreadable → checks partial, and says why |
| m17 | the "receipts unreadable" reason removed | 1 | `tapeReview.test.js` — L4-F6 — every BA-20 reason lowers its section C3: learning receipts unreadable → actions not complete, and say… |
| o01 | candle selection newest first | 2 | `tapeReview.test.js` — L2 — the candle pass never loses what it saved L4-F10 o01: oldest first — with the floor reached after one tap… |
| o02b | re-queue ignores the candle window (re-targeted) | 1 | `tapeReview.test.js` — L2 — the candle pass never loses what it saved L2-F5 / L4-F10 o02: outside the candle window, an action added … |
| o03 | plan-set growth never re-queues | 1 | `tapeReview.test.js` — L2 — the candle pass never loses what it saved L4-F10 o03: a plan added after the candle pass re-queues it |
| o04 | `subsequentTradesInSlot` always 0 | 1 | `tapeReview.test.js` — L2 — the candle pass never loses what it saved L4-F3: a later trade in the same slot counts, and the read-out … |
| o05 | the read-out drops "both continued lines hypothetical" | 1 | `tapeReview.test.js` — L2 — the candle pass never loses what it saved L4-F3: a later trade in the same slot counts, and the read-out … |
| o06 | `closedLegDelta` sign flipped | 2 | `tapeReplay.test.js` — reconciliation and comparables closedLegDelta is the rebuilt ghost at the sale minus the banked points |
| r01 | close handler without the flag check | 1 | `film-tape-close.test.js` — the handler — guard, flag, wiring FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin ha… |
| r02 | candle handler without the flag check | 1 | `film-tape-candles.test.js` — film-tape-candles handler FLAG OFF: 200 flag_off — zero reads, zero writes, zero fetches, the admin handle nev… |
| r03 | writer without the flag check | 1 | `writeTapeDay.test.js` — boundaries (BA-1, BA-2, BA-3) and the flag flag off: writeTapeDay refuses before any read or write |
| r04 | flag captured at module load | 1 | `film-tape-close.test.js` — the handler — guard, flag, wiring FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin ha… |
| r05 | always write (no unchanged check) | 1 | `writeTapeDay.test.js` — BA-19 — merge-monotone idempotence: the same inputs write the same document — the second run writes nothing |
| r06 | `gapPoints` without the banked points | 5 | `candlePass.test.js` — the morning after — replay, plan prices, series replays every action, prices every plan, writes a series per s… |
| r07 | price from the bar CONTAINING the instant | 6 | `bars.test.js` — price at an instant = the close of the last minute COMPLETED at or before it (BA-11) a check at 10:07:30 ET re… |
| r08 | price from two bars back | 6 | `bars.test.js` — price at an instant = the close of the last minute COMPLETED at or before it (BA-11) a check at 10:07:30 ET re… |
| r09 | plan-only symbols not fetched | 2 | `candlePass.test.js` — the morning after — replay, plan prices, series a plan-only symbol is fetched and has its own series, role "pl… |
| r10 | no terminal state after three attempts | 1 | `candlePass.test.js` — retry (§6) — attempts, the 10-session window, failed after three counts each morning; the third unsuccessful a… |
| r11 | a thrown run not counted | 2 | `candlePass.test.js` — retry (§6) — attempts, the 10-session window, failed after three a thrown run still counts as an attempt |
| r12 | writer without a transaction | 1 | `writeTapeDay.test.js` — BA-19 — merge-monotone the close pass never erases candle fields — sequential and mid-transaction |
| r13 | writer merges a stale pre-read | 1 | `writeTapeDay.test.js` — BA-19 — merge-monotone the close pass never erases candle fields — sequential and mid-transaction |
| r15 | the scorer imported from a byte-identical local copy | 2 | `tapeReplay.test.js` — THE SCORER IS THE IMPORTED ONE — swap the imported scorer and every rebuilt number follows it |
| r18 | the replay section without its coverage line | 1 | `tapeExport.test.js` — BA-20 — every section is headed by its coverage line replay: the line after its heading is its coverage, with … |
| r19 | candle fields taken from the new read | 3 | `candlePass.test.js` — the write — targeted, and safe against the close pass in either order a close pass AFTER the candle pass keeps… |
| r20 | missing bars guessed from another symbol | 2 | `candlePass.test.js` — never guessed — a missing symbol goes to symbolsMissing; its dependents are null with the input named; the pas… |

### 7.6 Process deviations (disclosed)

- **R-L1** ran `git -C /home/user/TradeSeven status --porcelain` once. It is read-only but may
  refresh the index's stat cache. Nothing was written.
- **R-L2** ran three read-only commands beyond the permitted `git show <sha>:<path>`:
  - `git show b5b96669 --stat`
  - `git show b5b96669 -- <two paths>`
  - `git log --oneline` over `19f897e7..b5b96669`
- **R-L3** attempted one `git show --stat 19f897e7` from the main tree. It failed and changed
  nothing.
- **R-L4** ran read-only `git log`, `git merge-base --is-ancestor`, `git cat-file -e` and one
  `git status --porcelain` in the main tree. Nothing was written.
- **The coordinator's first launch of the re-run failed** (relative spec paths) before any mutant
  was applied. Its three-way parallel baseline also timed out two heavy rows under load: the e2e
  candle morning took 10.4 s against its normal 2.2 s, and the candle-pass morning took 5.5 s
  against its normal 0.6 s. The re-run was relaunched on two trees, and both baselines were green.
- **The lenses and refuters ran no emulator** (as instructed). The rules mutations are L5's:
  M40a and M40b, both RED under the emulator. L5's final emulator confirmation was skipped at the
  coordinator's request, because the coordinator's own rules run held the port; that run passed
  (§7.7).

### 7.7 Verification at the tip

| Check | Result |
|---|---|
| Tip | the commit that carries this report, the branch tip at push (parent `4121e2cb`). A commit cannot name its own SHA, so it is posted with the push. The code verified here is that commit's code; no code changed after these runs on `claude/hopeful-keller-0xgl6p` |
| Full suite, Linux (`npx vitest run`, JSON reporter, output redirected) | **819 files, 16,271 tests: 16,207 passed, 64 skipped, 0 failed; exit 0.** The baseline at `ef80da13` was 805 files and 15,993 tests (15,929 passed, 64 skipped, 0 failed). The difference is exactly the 14 new tape test files and their 278 tests. No pre-existing file fails. |
| Rules suite on the emulator (`npm run test:rules`) | **18 files, 332 tests, all passed; exit 0.** The baseline was 17 files and 311 tests; the difference is `test/rules/filmTapeDenials.rules.mjs` (21 tests). |
| `npm run lint:gate` | exit 0 (`eslint . --config eslint.gate.config.js --max-warnings 0`) |
| `npx vite build` | exit 0; built in 19.6 s. Its four `css-syntax-error` warnings are pre-existing: the same four appear in the build before the review fixes, and this branch adds no CSS. |
| Fence | `git diff --name-only ef80da13..HEAD` names no §1 file (§2.5) |
| Crons | 41 → 43 (`node -e` over `vercel.json`) |

---

## 8. Astra findings and fixes (spec V1.2 Amendment A)

Astra reviewed the branch at `e7e527e7` (`docs/audits/20260928_ASTRA_REVIEW_FILM_TAPE_A1_BRANCH.md`)
and found nine things: F1–F9, plus the unpromoted R08. Amendment A
(`docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_A_20260928.md`) rules on them as BA-23 to BA-30,
and those rulings override V1.2. This section records the fix round. It **supersedes** the §3 rows
it corrects (§8.3), §4's round trips (§8.5) and §6.1's six-site list (§8.4). Everything else above
stands as written for `e7e527e7`.

**Same rules as the build.** No PR, no merge, no flag flip, no index deploy. No BUILD_RULES §1
file is edited: `git diff --name-only e7e527e7..HEAD` names none. **Not fixed, by instruction:** the
live-scoring defect in Astra's §7 (§6.9 here, repro R21) is routed to the Command Center arc. Nothing
outside Astra's table was widened. Astra's evidence zip was not attached to the request, so nothing
from it is committed; every repro below was rebuilt from the review's text.

### 8.1 Gate

| Item | Result |
|---|---|
| Branch and tip | `claude/hopeful-keller-0xgl6p` fetched. The tip was `e7e527e7b2f475333bcfdeccba18da90eaedae0d`, as named, and the tree was clean |
| The two documents, committed first (docs only) | `b6b6b649`. The amendment (sha256 `c1e92810…53dd`) and Astra's review (sha256 `ad785469…a0ec`) are byte-exact to the attachments |
| Baseline at `e7e527e7`, Linux | Tape suites: **14 files / 278 tests, all passed.** Rules suite on the emulator: **18 files / 332 tests, all passed** |
| Astra §2 and §3 | Read in full. Every repro was rebuilt as a row and **seen red** before its fix (§8.2) |

### 8.2 One row per finding

"Red first" names the tip each row was red at before its fix commit. Every row is in
`api/_utils/filmTape/tapeAstraReview.test.js` unless another file is named. The mutants are in §8.6,
and each is red under its row.

| Finding (Astra's severity) | Ruling | Commit | The fix | Red-first rows (red at) | Mutants (§8.6) |
|---|---|---|---|---|---|
| **F1** (blocker). The candle pass could write outside the authorized tape paths (R01). | BA-23 | `4fbd78c9` | Every collection-group result is validated before any expiry, failure record, fetch or write. The path must be exactly `agentBattles/{battleId}/tape/{etDate}` with a real date (`tapeIdOf`), and the document must name that battle and day (`idOfResult`). Every reference is then built from those ids (`tapeRef`). A result that fails is skipped and counted in `invalid`. | F1 R01; F1 (enrichment), F1 (expiry) and F1 (failure record), each with a sanctioned positive control; the malformed/mismatched row. All red at `e7e527e7`. F1 (self-named) was added after the mutation run. | 4. F1-doc was red. F1-parent, F1-depth and F1-date survived; each is red under F1 (self-named). |
| **F9** (minor). The six-entry allowlist was not the physical write census. | BA-23 | `4268ceab` | The close-out is now the named writer `markRetryWindowElapsed`: a transaction that re-reads the tape and marks it only while it is still waiting. The allowlist gains its seventh key, and all seven notes are refreshed. | The F9 census row, red at `4fbd78c9`: the scan saw one `runCandlePass::update` where two ran. The F9 writer row was added after the mutation run. | 3. F9-allow and F9-direct were red. F9-guard survived; it is red under the F9 writer row. |
| **F2** (major). A hole through the close was presented as a complete replay (R02), and M11 was hollow. | BA-24 | `25e7e9ed` | `sampleAt` (5-minute freshness), `expectedSeriesBars` (from the calendar) and `sampleCanExist`. A null sample carries its bar's close and names its input. A retryable input keeps the tape queued. An incomplete series makes the pass `partial` (`bars_incomplete`), and `symbolsIncomplete` names it. | F2 R02 and the every-sample-kind row, red at `4268ceab`. F2 (M11): the real `processTape` over the 2026-11-27 early close must keep 21 bars and write the pass. That is the guard M11 lacked, so its red-first is under M11. | 16, plus Astra M01 and M11. 13 were red. F2-exist-never and F2-gap-stale survived and are red under F2 (hole); F2-plan-close survived and is red under F2 (plan close). |
| **F3** (major). A retry could delete a more complete series (R03). | BA-25 | `f9f2b52d` | The saved series are read in the candle transaction with one `getAll`. `keepSeries` keeps the better of saved and new, and the kept series carries `preservedFrom`. A kept series is judged by its own bars. | F3 R03, red at `25e7e9ed` (AAPL had 1 bar, not 39). The saved-short-series row, red at `25e7e9ed` on its note. The longer-response row is the positive control. | 8. 6 were red. F3-tie survived and is red under F3 (tie); F3-uncovered survived and is red under F4 (kept series). |
| **F4** (major). Recovered checks did not invalidate the candle output (R06). | BA-25 | `cfaac86f` | The candle pass stores `candleInputFingerprint` (checks, evidence, actions, plans, symbols), and the close merge compares it. Inside the window a change re-queues (`pending`, `inputs_changed`). Outside it the pass becomes `partial` and the coverage is labelled. | F4 R06 (still `written`) and the outside-window row, both red at `f9f2b52d`; the unchanged re-run; the fingerprint row. | 13. 12 were red. F4-stack survived and is red under F4 (one label). |
| **F5** (major). Source uncertainty became "complete" (R05, R14, R12), and the R13 cap rule. | BA-26, BA-20 amended | `2bf34836` | Each reason is a caveat or a limit. An absent entry is evicted or lost. `unknownChecks` counts what is unknown. The calls note states only what was observed. The merge unions caveats and keeps the larger `unknownChecks`. | F5 R05, R14 and R12, red at `cfaac86f`. F5 R13 documents both halves of the amended cap rule. | 11, plus Astra M10. 9 were red. F5-evicted-cap survived and is red under F5 (lost, not evicted); F5-unknown-max survived and is red under F5 (sticky count). |
| **F7** (major). A stale assembly could regress a completed tape to active (R11). | BA-27 | `af96c7af` | The battle block merges as an ordered lifecycle, and the writer re-reads the battle in its transaction. | F7 R11 (the merge) and the writer row, both red at `2bf34836`. | 4, all red. |
| **F6** (major). Helper readiness and writer selection disagreed (R04, R17, R09). | BA-28 | `30cd7dad`, and the follow-up `8719ce96` | One calendar module (`src/utils/marketCalendar.js`) and one rule module (`src/utils/tapeSchedule.js`), shared by the close pass and the helper; `closePassWillTape`. **The follow-up was found in verification:** the first fix followed only the owning pass, but the writer re-selects a completion on the next session night, and it tapes a final day later than the completion. The helper now follows both. | F6 R04, R17 and R09, red at `af96c7af`; the identity row. The follow-up: F6 (second pass), F6 (early completion) and the updated `reviewAvailability.test.js` row, red at `1c343f47`. | 8, plus F6-onepass for the follow-up. 5 were red, F6-onepass included. Four survived, and each is red under a new row: F6-final under F6 (impossible final day), F6-next-past-calendar under F6 (calendar edge), F6-tapedatefor under F6 (final day untaped), and F6-malformed-read under the new `reviewAvailability.test.js` read row. |
| **F8** (minor). An aged-out pending tape could fall behind the scan forever (R20). | BA-29 | `0b135ae3` | A bounded, resumable sweep that runs first each morning (§8.8). | F8 R20; bounded and resumable; the terminal-and-page row; the sweep's path row. All red at `30cd7dad`. | 11. 6 were red. Five survived, and each is red under its bound row: F8-terminal under F8 (cost), F8-lookback under F8 (look-back), F8-isolate under F8 (isolated), F8-maxreads under F8 (read bound), and F8-floor under F8 (time floor). |
| **R08** (unpromoted). The aftermath recount ignored preserved directives. | BA-30 | `1c343f47` | `after` is recounted on every merge, from all merged directives. | R08, red at `0b135ae3`. | 2, both red. |

Two more commits carry no finding. `0d78b6d7` drops an unused import from the Astra rows.
`124f5782` adds the rows the mutation run called for (§8.6).

### 8.3 The claim sheet, corrected

These rows replace the §3 rows of the same name. Astra's dispositions are quoted from its §4.

| §3 row | Astra | Corrected claim, and the code that carries it | Rows that fail without it |
|---|---|---|---|
| **§3.1 #5**: the tape writes only under its subcollections and never reads a body | **REFUTED** (R01 / F1; the six-site census, F9) | Every write goes to `agentBattles/{battleId}/tape/{etDate}` or its `series/{symbol}`, through a reference `tapeRef` builds from ids (`tapeSources.js:18`). The close pass builds it from the battle it selected (`writeTapeDay.js:98`, `:135`). The candle pass first validates every collection-group result (BA-23). Its path must be exactly `agentBattles/{battleId}/tape/{etDate}` with a real calendar date (`tapeIdOf`, `candlePass.js:103`), and its document must name that battle and that day (`idOfResult`, `:419`). The reference is then built from those ids (`:313`, `:509`). A result that fails is skipped and listed in `summary.invalid`; the query's own reference is never written to. This holds in the selection and in the expiry sweep. The census is seven named sites, all on the allowlist (§8.4). No tape module reads `tickBodies`; that part is unchanged. | `tapeAstraReview.test.js`: F1 R01, F1 (enrichment), F1 (expiry), F1 (failure record), the malformed/mismatched row, F1 (self-named), F8 (BA-23), the F9 census and the F9 writer row; `compositionProtectedStores.scan.test.js`; and §3's path rows |
| **§3.1 #7**: a gap renders as a gap, truncation as truncated; a later run never loses a fact; every section states its coverage | **REFUTED** (R02 / R03 / R05 / R06 / R12 / R14; F2–F5) | §3's mechanisms stand, and four were added. **(BA-24)** A sample stands for an instant only when its bar completed within 5 minutes of it (`sampleAt`, `bars.js:97`). A stale sample is null, with its bar's close beside it, and its input is named. A series is whole only with the calendar's count of 10-minute bars (`expectedSeriesBars`, `bars.js:112`: 39, or 21 on an early close) and a fresh price at every check (`seriesGaps`, `candlePass.js:207`). Otherwise the tape stays queued (`partial`, `bars_incomplete`) and `symbolsIncomplete` names the symbol. **(BA-25)** A retry reads the saved series in its transaction and keeps the better of saved and new (`keepSeries`, `candlePass.js:235`). Candle output whose inputs changed is re-queued inside the window, or labelled outside it (`candleInputFingerprint`, `candleInputs.js:63`; `mergeCandles`, `tapeMerge.js:394`). **(BA-26)** Each coverage reason is a caveat or a limit (`tapeAssemble.js:863-873`). Caveats survive every merge (`mergeCoverage`, `tapeMerge.js:232`), and `unknownChecks` holds plans, rationale, evidence, calls and directives at most `partial` (`:885-886`). **(BA-27)** The battle's lifecycle never moves backward (row 2 below). | F2 R02, the every-sample-kind row, F2 (M11); F3 R03 and its two rows; F4 R06, the outside-window row, the unchanged re-run, the fingerprint row; F5 R05, R14, R12, R13; the F7 rows; and §3's rows |
| **§3.1 #9**: nothing selects a decisive action, ranks outcomes, or arranges facts toward an unsupported conclusion | **REFUTED** for the full claim (R02 / F2; R05, R14 / F5). The ordering and label mechanisms held | §3's mechanisms stand, and no reconstruction now claims more than its inputs support. A close sample from bars that end early is null with its stale bar's time and named in `missingInputs`, so replay and series coverage cannot be `complete` (F2, R02). The calls note states only what was observed: "no model check recorded among the N known check(s); M check(s) have no record" (`tapeAssemble.js:967`). It is never the categorical "no check of this day reached the model", and it is not written when a known check reached the model (F5, R05 / R14). | F2 R02; F5 R05, R14; L1-F13 (rewritten, §8.7); and §3's rows |
| **§3.2 row 2**: headline wording; result only when completed; day change unavailable rather than substituted | **REFUTED** as a whole (R11 / F7) | §3's mechanisms stand, and the battle block is now an ordered lifecycle (BA-27). The later state wins whole: status, `completedAt`, final, result and `battleStatusAtWrite` move together (`tapeMerge.js:308-331`). The writer also re-reads the battle document inside its transaction, and rebuilds the block when the battle completed meanwhile (`writeTapeDay.js:104-113`). | F7 R11; the F7 writer row; and §3's rows |
| **§3.2 row 8**: ways to mislead | **REFUTED** as the broad disposition (R02 / R05 / R14) | As §3.1 #9, corrected above. | As §3.1 #9 |
| **§3.2 row 9**: hub copy; unavailable vs pending; the interface narrowed | **REFUTED** (R04 / R09 / R17; F6) | Stage 3 says `pending` only when the close pass's own selection will tape the final day (BA-28). The rule is `closePassWillTape` (`src/utils/tapeSchedule.js:172`), over the one calendar (`src/utils/marketCalendar.js`), which the server's `marketSchedule.js` re-exports. Every `timing.tradingDays` entry must be a session of the maintained calendar (`validFinalTradingDay`, `:155`). The passes followed are the owning pass (`owningPassDate`, `:141`, null beyond the calendar) and each next session's pass whose completion window still holds `completedAt`, since the writer re-selects a completion the next night (the F6 follow-up). One of them must still be to run, and at that pass the close pass's own `tapeDateFor` must name the final day. Otherwise the answer is `unavailable`. The helper still returns exactly three keys. | F6 R04, R17, R09, F6 (second pass), F6 (early completion), the F6 identity row, the F6 rows added after the mutation run; and `reviewAvailability.test.js` Stage 3 (the Tuesday row updated, §8.7) |
| **Inv 7**: preservation; missingness; truncation display | **REFUTED** (F2–F5) | As §3.1 #7, corrected above. | As §3.1 #7 |
| **Retry path**; the "next pass" promise | **REFUTED** (R03; R20; R04 / R17) | `nextCandleState` (`candlePass.js:268`) and the 10-session window, as §3, with three corrections. A retry never replaces a saved series with a poorer one (F3). A bounded, resumable sweep closes out every non-terminal tape older than the scan, and it runs first each morning (`sweepExpired`, `candlePass.js:432`, BA-29; bounds in §8.8). The helper promises only a pass the writer's own selection will run (F6). An aged-out tape becomes `failed`, `retry_window_elapsed`, through the named writer `markRetryWindowElapsed` (`:312`), which never rewrites a terminal tape. | F3 rows; F8 R20, bounded and resumable, the terminal-and-page row, F8 (BA-23); the F9 writer row; F6 rows; and §3's retry rows |
| **Add per-section coverage** | **REFUTED** (R02 / R05 / R12 / R14; M11 hollow) | §3's mechanism stands, with F2 (series and replay coverage judged against the calendar's session and fresh samples) and F5 (caveats, limits and `unknownChecks`, merged as evidence). **Astra's M11 is now red** (§8.6). | F2 R02, F2 (M11), F5 R05, R14, R12, R13; and §3's rows |

Every other §3 row stands as written. Astra confirmed each of them, within the scope its §4 states, and no fix here changes what they claim. Their `file:line` anchors are at `e7e527e7`.

### 8.4 The write census: seven physical sites

Astra counted seven physical Firestore write sites against six allowlist keys. The close-out
`ref.update` off the collection-group reference was invisible to the scan (F9). It is now a named
writer, `markRetryWindowElapsed`. Every site writes through a reference built by `tapeRef`
(`tapeSources.js:18`) from ids the writer was given or validated. The candle pass validates every
query result's path and document identity first (`tapeIdOf` `candlePass.js:103`, `idOfResult` `:419`),
so the query's own reference is never written to (BA-23).

| # | Site at the tip | Function | Operation | Destination (how the reference is built) | Allowlist key (count) |
|---|---|---|---|---|---|
| 1 | `writeTapeDay.js:116` | `writeTapeDay` | `tx.set` | `tapeRef(db, battleId, etDate)` (`:98`) | `writeTapeDay::set` (1) |
| 2 | `writeTapeDay.js:141` | `markCloseFailed` | `tx.update` | `tapeRef(db, battle.id, etDate)` (`:135`) | `markCloseFailed::update` (1) |
| 3 | `writeTapeDay.js:147` | `markCloseFailed` | `tx.set` | the same reference | `markCloseFailed::set` (1) |
| 4 | `candlePass.js:404` | `processTape` | `tx.set` | `ref.collection('series').doc(symbol)`, where `ref` is `tapeRef` from validated ids (`:509`) | `processTape::set` (1) |
| 5 | `candlePass.js:405` | `processTape` | `tx.update` | that `ref` | `processTape::update` (1) |
| 6 | `candlePass.js:319` | `markRetryWindowElapsed` | `tx.update` | `tapeRef(db, battleId, etDate)` from validated ids (`:313`). Called by the inline close-out (`:525`) and by the sweep (`:452`) | `markRetryWindowElapsed::update` (1), **new** |
| 7 | `candlePass.js:559` | `runCandlePass` | `tx.update` | that `ref` (the thrown attempt's failure record) | `runCandlePass::update` (1) |

The close pass and the backfill write only through sites 1–3. The candle handler and the close
handler write nothing themselves. No other tape module writes to Firestore.

The F9 row runs every write path the tape has and records each write **call** with its stack. It
maps each call to its enclosing function by the scanner's own rule. The row asserts that the
runtime census by function, method and count equals the scanner's, and totals seven. The
allowlist (`api/_utils/compositionProtectedStoresAllowlist.json`) holds the seven keys at count 1,
each with a refreshed `_notes_film_tape_a1` note. **The founder's human review now covers seven
notes, not six** (§6.1).

### 8.5 Cost, re-measured

The build's harness (`zz_measure`) was never committed, so a scratch harness of the same shape was
written and run on two snapshots: `e7e527e7`, and the fix tip before the mutation rows (which
change tests only). It runs the real `writeTapeDay` and `runCandlePass` over the fixture set on the
in-memory store and counts operations. A `getAll` of N documents is **one
round trip** that bills N document reads. CPU times are single runs on a shared 4-core container
while mutation runs were going, so they are upper bounds.

**The close pass, per battle-day.** "Reads" counts every read operation: document gets, queries and
reads inside the transaction. "Round trips" adds the transaction's commit.

| Fixture battle-day | Status | Tape size, JSON bytes (`e7e527e7` → tip) | Reads | Round trips | Writes |
|---|---|---|---|---|---|
| capturedDay | written | 32,974 → 35,264 | 10 → **11** | 11 → **12** | 1 |
| noTriggerDay | written | 23,526 → 23,744 | 9 → **10** | 10 → **11** | 1 |
| budgetDay | written | 10,636 → 10,854 | 9 → **10** | 10 → **11** | 1 |
| completedDay | written | 23,573 → 23,791 | 9 → **10** | 10 → **11** | 1 |
| skippedModeDay (flat6) | skipped_mode | 4,411 → 4,448 | 2 → 2 | 3 → 3 | 1 |
| preCaptureDay | written | 10,536 → 10,927 | 9 → **10** | 10 → **11** | 1 |
| multiDay, 40 checks × 5 days | written | 33,634 – 71,608 → 33,999 – 71,826 | 9 – 10 → **10 – 11** | 10 – 11 → **11 – 12** | 1 |

- **+1 read and +1 round trip for each tiered battle-day.** This is the battle document re-read
  inside the write transaction (F7, BA-27). A flat6 day does not re-read, because it builds no
  battle block. The fixes add no other close-pass read and no write.
- **Size.** Tapes grew by 218–2,290 bytes: the coverage `caveats` and `unknownChecks` (F5), and the
  capturedDay's longer caveat notes. The largest is still about 72 KB, well inside the spec's
  "well under 200 KB".
- **Budget.** At 30–80 ms per round trip, a battle-day is now about 0.33–0.96 s (it was
  0.30–0.88 s). The 270 s usable budget covers roughly **280–820 battles a night** (it was
  300–900). Beyond that, battles are named `notReached`, and the backfill entry is their path, as
  before.

**The candle pass, per morning.** The fixture morning is 2026-09-26: capturedDay plus multiDay's five
days, so 6 tapes and 70 series. A `getAll` of N documents is one round trip that bills N reads.

| | `e7e527e7` | tip |
|---|---|---|
| Requests / API units | 58 / 290 | 58 / 290 (unchanged) |
| Read operations | 7: the selection query, and 6 tape reads in the transactions | **80**: 3 sweep queries, the selection query, 6 tape reads, and **70 saved-series reads in 6 `getAll`s** |
| Round trips | 13 | **22**: +3 sweep queries and +6 `getAll`s |
| Writes | 76 (70 series + 6 tape updates) | 76 |
| CPU | 3,635 ms | 3,472 ms |
| The next morning (nothing selectable) | 1 query | 4 queries (the 3 sweep queries find nothing) |

- **+1 round trip per selected tape.** The saved series are read inside the transaction (F3,
  BA-25). This bills one document read per saved series, 12–14 for a typical tape. At 20 battles
  that is about 240–280 extra document reads a morning.
- **+3 queries a morning** for the sweep (BA-29). Each extra page costs one more query, and each
  close-out costs one transaction (1 read, 1 write). The sweep is capped at 100 close-outs and
  1,000 documents read per run (§8.8).
- **Units are unchanged.** A retried tape refetches its whole symbol set, as before. The build's
  §4 quoted 62 requests for its own fixture morning; the harness here makes 58 at both SHAs, so the
  fixes change no request count.

### 8.6 Mutation results

**How it ran.** Each mutant was applied alone, in a `git archive` snapshot of `0d78b6d7` with
`node_modules` symlinked; three trees ran in parallel, and the working tree was never mutated. After
each mutant the 17 tape suites ran with the JSON reporter: the 14 tape files,
`tapeAstraReview.test.js`, the protected-store scan and the calendar's session rows. The file was
then restored from memory and byte-checked. Each tree's baseline was **327 / 327 green**.

The per-test timeout was raised to 120 s. At vitest's default 5 s, the first launch produced one
false red: the backfill end-to-end row timed out under three-way load (F2-exist-never, 5.97 s).
That launch was discarded and everything re-ran. **No red below is a timeout**, and none is a file
that failed to load.

**The mutants: 199.**

- **The build's own set** (§7.5), re-targeted to the code at `0d78b6d7`: **63 L5** (M1–M48,
  including M42a–f and M43a–e, and S1–S7) and **46 L4** (d, e, m, o, r). Four read-only agents did
  the re-targeting, one per file group, and each edit was reviewed here before it ran. Where a fix
  had restructured the code, the mutant puts the same defect back where that behaviour now lives:
  - M36's `obtainedBefore` is now the saved series read in the transaction;
  - M33 and o03 also break the matching part of the F4 fingerprint (without it they would be
    equivalent mutants);
  - M39 and M41 moved to `src/utils/tapeSchedule.js`;
  - M37 is the inline close-out's isolation. The sweep's isolation is F8-isolate, below.

  M40a/b (the rules) were not re-run: `firestore.rules` is unchanged since `e7e527e7`, and they
  need the emulator.
- **Astra's nine named mutants** (M01–M06, M08, M10, M11).
- **81 mutants of the fixes themselves**, several per finding.

**Result: all 199 are red.** All 118 build and Astra mutants were red on the first run, **M11
included** (hollow at `e7e527e7`; now 5 rows). Astra's counts differ from these because it ran a
narrower file set.

60 of the 81 fix mutants were red on the first run. **21 survived.** Some were masked by another
mechanism:
- the document-identity check masked the path rule (F1-parent, F1-depth, F1-date);
- the callers' pre-checks masked the close-out writer's own guard (F9-guard), and that guard
  masked the sweep's pre-check (F8-terminal);
- a missing ten-minute bucket, or a stale replay sample, masked the stale-sample and plan-close
  paths (F2-exist-never, F2-gap-stale, F2-plan-close).

For the rest, no existing row reached the boundary:
- the tie-break, and a kept series older than a check;
- a stacked label;
- a lost entry older than every surviving one, and a lower later count;
- the helper at a final day that cannot exist, at the calendar's edge, and at a final day no pass
  tapes, plus the read it must not spend;
- the sweep's look-back, read, time and isolation bounds.

Each survivor now has a row (`124f5782`, 18 rows) that passes on the real code. Each goes **red
under its mutant** in a fresh snapshot of `124f5782`, whose baseline was **345 / 345** green.

**Astra's nine named mutants** (its §8; there is no M07 or M09). Astra ran each on a narrower file set than the 17 here.

| id | Defect introduced | Astra at `e7e527e7` | Now | First red row |
|---|---|---|---|---|
| M01 | select the containing minute instead of the completed minute | 3 / 13 fail | **RED (6)** | bars.test.js: a check at 10:07:30 ET reads the 10:06 bar (completed 10:07:00), never the 10:07 bar that contains it |
| M02 | omit the locked banked points from the gap | 4 / 16 fail | **RED (5)** | candlePass.test.js: replays every action, prices every plan, writes a series per symbol, and marks the pass written |
| M03 | use the bought tick fill as the sold entry | 6 / 40 fail | **RED (6)** | writeTapeDay.test.js: come from ticks.actions[], joined to trades[] and the receipt; who made the exit by the line th… |
| M04 | overwrite candle values from the close assembly | 1 / 40 fail | **RED (6)** | candlePass.test.js: a close pass AFTER the candle pass keeps every candle field (write candles, run the close pass, c… |
| M05 | add `score` to the hub helper's return | 16 / 23 fail | **RED (19)** | reviewAvailability.test.js: stage 1 returns exactly three keys, for every state |
| M06 | bypass the close handler's writer-flag gate | 1 / 18 fail | **RED (1)** | film-tape-close.test.js: FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin handle is never ta… |
| M08 | accept a suppressed heard entry | 1 / 50 fail | **RED (1)** | tapeReview.test.js: L4-F2: a suppressed stamp is never "heard" — on the entry or on the tick |
| M10 | ignore evaluation-cap eviction | 2 / 90 fail | **RED (4)** | F5 R13 (BA-20 amended): at the 150 cap with the oldest surviving entry before this day nothing of the day was evicted… |
| M11 | reduce any sub-390-minute nonempty session to one minute | **HOLLOW**: 70 / 70 pass | **RED (5)** | F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |

**The build's L5 set**: 63 mutants, 63 red.

| id | Defect introduced | Now | First red row |
|---|---|---|---|
| M6 | `evictionPossible = false` | RED (3) | F5 R13 (BA-20 amended): at the 150 cap with the oldest surviving entry before this day nothing of the day was evicted… |
| M21 | the blocker re-introduced (tick `entryPrice` first) | RED (6) | writeTapeDay.test.js: come from ticks.actions[], joined to trades[] and the receipt; who made the exit by the line th… |
| M22 | `pos` accepts 0 — L2-F7 | RED (1) | writeTapeDay.test.js: an entry price of 0 is the executor's no-entry sentinel: absent and named, never a price (revie… |
| M23 | prefixes emptied — L1-F2 | RED (1) | tapeReview.test.js: L1-F2: guardrail-override text the platform wrote is not copied as the agent's words |
| M24 | `directiveWindow` → the ET day — L1-F4 (the first-day branch) | RED (2) | tapeReview.test.js: L1-F4: a directive filed the evening before the battle's first session is on its first tape, and … |
| M25 | the score from tick rows only — L1-F5 | RED (1) | tapeReview.test.js: L1-F5: a later admitted check known only by its entry is the day's last recorded score |
| M26 | heard prefers the entry — L1-F7 | RED (1) | tapeReview.test.js: L1-F7: heard is the EARLIER of the first stamped entry and the first tick control |
| M27 | suppression ignored (both halves together) — L4-F2 | RED (1) | tapeReview.test.js: L4-F2: a suppressed stamp is never "heard" — on the entry or on the tick |
| M28 | a committed gate is always filed — L1-Q3 | RED (1) | tapeReview.test.js: L1-Q3: a committed gate with no directive record (OBSERVE mode, a withheld turn) filed nothing |
| M29 | `missingRunSlots` → `[]` — L1-F12 | RED (1) | tapeReview.test.js: L1-F12: an evaluator slot with no run record (a killed run) keeps the checks section from claimin… |
| M30 | `absorbedGap` → false — L1-Q1 | RED (1) | tapeReview.test.js: L1-Q1: a check whose capture failed but whose entry survives is ONE row — its number stays among … |
| M43a | `tapeAssemble.js` the C2 reason deleted ("run records unreadable") | RED (1) | tapeReview.test.js: C2: run records unreadable → checks partial, and says why |
| M43b | `tapeAssemble.js` the C3 reason deleted ("learning receipts unreadable") | RED (1) | tapeReview.test.js: C3: learning receipts unreadable → actions not complete, and says why |
| M43c | `tapeAssemble.js` the C4 reason deleted ("expected a declarations record that is absent") | RED (1) | tapeReview.test.js: C4: an expected declarations record that is absent → calls partial |
| M43d | `tapeAssemble.js` the C5 reason deleted ("recorded an evalId whose evaluation entry is absent") | RED (1) | tapeReview.test.js: C5: a tick naming an evalId whose entry is absent → plans, rationale and evidence partial |
| M43e | `tapeAssemble.js` the C6 reason deleted ("… trades[] is at its 50-entry cap …") | RED (1) | tapeReview.test.js: C6: capture incomplete with trades[] at its 50 cap → actions partial (a swap on an unrecorded che… |
| M46 | `subsequentTradesInSlot = 0` — L4-F3 | RED (1) | tapeReview.test.js: L4-F3: a later trade in the same slot counts, and the read-out marks both continued lines hypothe… |
| S3 | the later-day window → the ET day (a weekend filing lands on no tape) — row "L5 S3" | RED (1) | tapeReview.test.js: L5 S3: on a later trading day the window opens where the previous one closed — a weekend filing l… |
| M7 | reviewAvailability.js:71-73 a fourth key `stage: 1` on Stage 1's returns | RED (7) | reviewAvailability.test.js: stage 1 returns exactly three keys, for every state |
| M8 | film-tape-close.js:60 the admin handle taken before the flag check | RED (1) | film-tape-close.test.js: FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin handle is never ta… |
| M9 | writeTapeDay.js:55 writeTapeDay's flag throw deleted | RED (1) | writeTapeDay.test.js: flag off: writeTapeDay refuses before any read or write |
| M13 | tapeExport.js:52 `labelled()` prints the bare value | RED (12) | tapeExport.test.js: no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text |
| M14 | tapeExport.js:208 the Plans section without its coverage line | RED (1) | tapeExport.test.js: plans: the line after its heading is its coverage, with the stored status |
| M15 | tapeExport.js:110 raw `c.tickMs` in the Checks table | RED (2) | tapeExport.test.js: no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text |
| M16 | tapeExport.js:164 the action's `lockedPoints` smuggled through `quoted()` | RED (3) | tapeExport.test.js: no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text |
| M17 | src/constants/filmTape.js:202 `actions[].replay.gapPoints` declared `recorded` | RED (4) | tapeExport.test.js: replay, reconciliation, comparables and plan prices print the class their field declares |
| M18 | closePass.js:224 the backfill never skips written days | RED (4) | film-tape-backfill.e2e.test.js: request 2 (the same request): the written days are skipped by their own passes.close.… |
| M19 | closePass.js:182 `range_not_closed` deleted | RED (2) | film-tape-close.test.js: the backfill entry validates its range |
| M39 | closePass.js:61 completionsSinceMs → completions since today only | RED (8) | reviewAvailability.test.js: unavailable: completed with no tape and no pass scheduled (a pre-backfill battle is never… |
| M41 | reviewAvailability.js:94 `owningPassDate` → the completion's own ET date | RED (3) | reviewAvailability.test.js: a weekend completion is taped by the next session's pass (review L3-F1/F2): pending until… |
| M44 | src/constants/filmTape.js:65 NO_CHANGE_GATE_STATUSES → ['no_change'] | RED (2) | tapeReview.test.js: L4-F10 d01: gate status no_proposal is a "no change" card |
| M47 | firestore.indexes.json — the tape collection-group composite (passes.candles.status, etDate) deleted | RED (1) | tapeWiring.test.js: the candle pass's queries — the expiry sweep (BA-29) and the selection — all need the tape collec… |
| M48 | vercel.json:210 the close-pass schedule → `15 3 * * 2-6` | RED (1) | tapeWiring.test.js: the close pass: 15 2 * * 2-6 UTC, built from the hour and minute the close-pass window uses |
| S4 | film-tape-candles.js:41 the admin handle taken before the flag check (probe) | RED (1) | film-tape-candles.test.js: FLAG OFF: 200 flag_off — zero reads, zero writes, zero fetches, the admin handle never tak… |
| S5 | writeTapeDay.js:118 markCloseFailed's flag throw deleted (probe) | RED (1) | writeTapeDay.test.js: flag off: writeTapeDay refuses before any read or write |
| S6 | closePass.js:124 runClosePass's flag throw deleted, alone (probe) | RED (1) | tapeReview.test.js: L3-F4: every pass refuses with the writer flag off — before any read |
| S7 | closePass.js:206 runBackfill's flag throw deleted, alone (probe) | RED (1) | tapeReview.test.js: L3-F4: every pass refuses with the writer flag off — before any read |
| M1 | tapeReplay.js:149 `gapPoints` without the banked points | RED (5) | candlePass.test.js: replays every action, prices every plan, writes a series per symbol, and marks the pass written |
| M2 | bars.js:77 price from the bar containing the instant | RED (6) | bars.test.js: a check at 10:07:30 ET reads the 10:06 bar (completed 10:07:00), never the 10:07 bar that contains it |
| M10 | candlePass.js:281 flag throw deleted | RED (1) | tapeReview.test.js: L3-F4: every pass refuses with the writer flag off — before any read |
| M11 | tapeReplay.js:71-74 a local scorer | RED (4) | tapeReplay.test.js: a check at 10:07:30 ET samples the 10:06 bar close, never 10:07 |
| M12 | candlePass.js:187 no attempts-exhausted branch | RED (1) | candlePass.test.js: counts each morning; the third unsuccessful attempt is terminal; a fourth morning never selects it |
| M20 | tapeReplay.js:106-107 own-check exclusion removed | RED (1) | tapeReplay.test.js: the check that made the swap is the swap sample, never also a later check |
| M35 | candlePass.js:199 `keepBetter` -> fresh | RED (1) | tapeReview.test.js: L2-F1: an outage on the retry morning keeps morning 1's replays, prices, series and coverage |
| M36 | candlePass.js:248 `obtainedBefore` ignored | RED (2) | F3: a saved series whose refetch fails stands, and the coverage judges it by its own bars — never "no bars", never co… |
| M37 | candlePass.js:312-318 aged-out try/catch removed | RED (1) | tapeReview.test.js: L2-F6: one failed close-out marker never costs the morning — the other tapes are processed |
| M38 | tapeReplay.js:136 bought leg over all samples | RED (2) | tapeReplay.test.js: an instant before any minute of the session has completed has no price: a visible null, never int… |
| M45 | candlePass.js:299 newest first | RED (1) | tapeReview.test.js: L4-F10 o01: oldest first — with the floor reached after one tape, the newer one waits |
| M3 | tapeMerge.js:169 @4b1550aa — stored leftover rows dropped (first failing: "a stored row the new rea… | RED (3) | R08: a later committed filing that left the source but stays on the tape still ends the earlier directive's aftermath |
| M4 | tapeMerge.js:165 @4b1550aa — candle columns from the new row (first failing: "a close pass AFTER th… | RED (6) | candlePass.test.js: a close pass AFTER the candle pass keeps every candle field (write candles, run the close pass, c… |
| M5 | tapeMerge.js:214 @4b1550aa — coverage is the new coverage (first failing: L2-F3a / L1-F6 (preserved… | RED (5) | F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| M31 | tapeMerge.js:96 @4b1550aa — input group ranked by anchor presence (first failing: L2-F3a / L1-F6) | RED (1) | tapeReview.test.js: L2-F3a / L1-F6: a re-run whose receipts are gone keeps the saved replay inputs whole |
| M32 | tapeMerge.js:109 @4b1550aa — heard as a plain group (first failing: L1-F7 (merge)) | RED (1) | tapeReview.test.js: L1-F7 (merge): a re-run never replaces a saved heard stamp with a later one |
| M33 | tapeMerge.js:358 @4b1550aa — `\|\| improved` dropped: inputs that became complete never re-queue th… | RED (2) | F4: each named input moves its own part; replay, prices, candle status and coverage move nothing |
| M34 | tapeMerge.js:362 @4b1550aa — outside-window re-queue dropped: a changed tape outside the candle win… | RED (2) | F4: outside the window, changed inputs lower a written pass to partial and name what changed; the output stays, label… |
| M42a | tapeMerge.js:265 @4b1550aa — `lastCheck` takes the new read (row "L5 M42a") | RED (1) | tapeReview.test.js: L5 M42a: the last check keeps the later instant when a re-run cannot see that check |
| M42b | tapeMerge.js @4b1550aa — battle result rank dropped: result taken from the new read (first failing:… | RED (1) | tapeReview.test.js: m04: a stored result is not replaced by a derived one |
| M42c | tapeMerge.js @4b1550aa — intraday views from the new read (first failing: m05) | RED (1) | tapeReview.test.js: m05: intraday views seen once stay "present" |
| M42d | tapeMerge.js @4b1550aa — `deferralsTruncated` not sticky (first failing: m06) | RED (2) | F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| M42e | tapeMerge.js @4b1550aa — sectors not unioned (first failing: m07) | RED (1) | tapeReview.test.js: m07: a sector seen once stays among the comparables |
| M42f | tapeMerge.js:222 @4b1550aa — coverage span `from` from the new read (first failing: m10) | RED (1) | tapeReview.test.js: m10: a section's span never shrinks |
| S1 | tapeMerge.js:266 @4b1550aa — `firstCheck` takes the new read (row "L5 M42a (first check)", the S1 t… | RED (1) | tapeReview.test.js: L5 M42a (first check): the first check keeps the earlier instant when a re-run cannot see that ch… |
| S2 | tapeMerge.js:222 @4b1550aa — coverage span `to` from the new read (row "L5 S2") | RED (1) | tapeReview.test.js: L5 S2: a section's span end never moves earlier |

**The build's L4 set**: 46 mutants, 46 red.

| id | Defect introduced | Now | First red row |
|---|---|---|---|
| d02 | heard ignores suppression (entry and tick) | RED (1) | tapeReview.test.js: L4-F2: a suppressed stamp is never "heard" — on the entry or on the tick |
| d03 | a call resolved on the day but minted earlier is dropped | RED (1) | tapeReview.test.js: L4-F10 d03: a call minted the day before and resolved on the day is on the day's tape |
| m11 | the "entry absent" reason removed — C5 | RED (1) | tapeReview.test.js: C5: a tick naming an evalId whose entry is absent → plans, rationale and evidence partial |
| m12 | actions always provable — C6 | RED (1) | tapeReview.test.js: C6: capture incomplete with trades[] at its 50 cap → actions partial (a swap on an unrecorded che… |
| m13 | the "heard stamp may be missing" reason removed | RED (1) | tapeReview.test.js: L4-F6 m13: entries at the 150 cap with capture incomplete — a heard stamp may be missing, and the… |
| m14 | the "declarations record absent" reason removed — C4 | RED (1) | tapeReview.test.js: C4: an expected declarations record that is absent → calls partial |
| m15b | the "no declarations phase" note removed (re-targeted) | RED (1) | tapeReview.test.js: L4-F6 m15: a day whose entries carry no declarations phase says so — a fact, so nothing is missing |
| m16 | the "run records unreadable" reason removed — C2 | RED (1) | tapeReview.test.js: C2: run records unreadable → checks partial, and says why |
| m17 | the "receipts unreadable" reason removed — C3 | RED (1) | tapeReview.test.js: C3: learning receipts unreadable → actions not complete, and says why |
| o04 | `subsequentTradesInSlot` always 0 | RED (1) | tapeReview.test.js: L4-F3: a later trade in the same slot counts, and the read-out marks both continued lines hypothe… |
| d01 | NO_CHANGE gate statuses narrowed to `no_change` | RED (2) | tapeReview.test.js: L4-F10 d01: gate status no_proposal is a "no change" card |
| e01 | the action's `lockedPoints` printed as quoted text | RED (3) | tapeExport.test.js: no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text |
| e02 | the action's `lockedPoints` printed as a code span | RED (3) | tapeExport.test.js: no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text |
| e03 | `ghost.atClose` labelled through another field (prints `recorded`) | RED (1) | tapeExport.test.js: replay, reconciliation, comparables and plan prices print the class their field declares |
| e04 | seven rebuilt/market declarations flipped to `recorded` | RED (3) | tapeExport.test.js: replay, reconciliation, comparables and plan prices print the class their field declares |
| e05 | control: one bare unlabelled number printed | RED (3) | tapeExport.test.js: no digit is printed outside a labelled number, an instant, an identifier or quoted recorded text |
| o05 | the read-out drops "both continued lines hypothetical" | RED (1) | tapeReview.test.js: L4-F3: a later trade in the same slot counts, and the read-out marks both continued lines hypothe… |
| r01 | close handler without the flag check | RED (1) | film-tape-close.test.js: FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin handle is never ta… |
| r02 | candle handler without the flag check | RED (1) | film-tape-candles.test.js: FLAG OFF: 200 flag_off — zero reads, zero writes, zero fetches, the admin handle never tak… |
| r03 | writer without the flag check | RED (1) | writeTapeDay.test.js: flag off: writeTapeDay refuses before any read or write |
| r04 | writer flag captured at module load (close handler) | RED (1) | film-tape-close.test.js: FLAG OFF: 200 flag_off — zero Firestore reads, zero writes, and the admin handle is never ta… |
| r05 | always write (no unchanged check) | RED (1) | writeTapeDay.test.js: idempotence: the same inputs write the same document — the second run writes nothing |
| r12 | writer without a transaction | RED (3) | film-tape-backfill.e2e.test.js: request 1: writes the range in order until the budget floor, then says where to resume |
| r13 | writer merges a stale pre-read | RED (1) | writeTapeDay.test.js: the close pass never erases candle fields — sequential and mid-transaction |
| r18 | the Replay section without its coverage line | RED (1) | tapeExport.test.js: replay: the line after its heading is its coverage, with the stored status |
| o01 | candle selection newest first | RED (1) | tapeReview.test.js: L4-F10 o01: oldest first — with the floor reached after one tape, the newer one waits |
| o06 | `closedLegDelta` sign flipped | RED (2) | tapeReplay.test.js: closedLegDelta is the rebuilt ghost at the sale minus the banked points |
| r06 | `gapPoints` without the banked points | RED (5) | candlePass.test.js: replays every action, prices every plan, writes a series per symbol, and marks the pass written |
| r07 | price from the bar CONTAINING the instant | RED (6) | bars.test.js: a check at 10:07:30 ET reads the 10:06 bar (completed 10:07:00), never the 10:07 bar that contains it |
| r08 | price from two bars back | RED (6) | bars.test.js: a check at 10:07:30 ET reads the 10:06 bar (completed 10:07:00), never the 10:07 bar that contains it |
| r09 | plan-only symbols not fetched | RED (3) | candlePass.test.js: a plan-only symbol is fetched and has its own series, role "plan" |
| r10 | no terminal state after three attempts | RED (1) | candlePass.test.js: counts each morning; the third unsuccessful attempt is terminal; a fourth morning never selects it |
| r11 | a thrown run not counted | RED (3) | candlePass.test.js: a thrown run still counts as an attempt |
| r15 | the scorer imported from a byte-identical local copy | RED (2) | tapeReplay.test.js: every rebuilt point comes from calculateAssetScoreServer, called with the leg's own inputs and em… |
| r20 | missing bars guessed from another symbol | RED (7) | candlePass.test.js: goes to symbolsMissing; its dependents are null with the input named; the pass is partial, and re… |
| m02b | score units taken from the new read (re-targeted at 4121e2cb) | RED (3) | tapeReview.test.js: m02: the day change keeps its reference when the prior day's tape cannot be read on a re-run |
| m04 | battle result / final taken from the new read | RED (1) | tapeReview.test.js: m04: a stored result is not replaced by a derived one |
| m05 | intraday-view presence taken from the new read | RED (1) | tapeReview.test.js: m05: intraday views seen once stay "present" |
| m06 | `deferralsTruncated` not sticky | RED (2) | F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| m07 | sectors not unioned | RED (1) | tapeReview.test.js: m07: a sector seen once stays among the comparables |
| m08 | coverage taken from the new read | RED (1) | writeTapeDay.test.js: monotonicity: write, evict the source, write again — every fact kept, the section marked preser… |
| m09 | `preservedFrom` never set | RED (2) | tapeReview.test.js: L2-F3a / L1-F6: a re-run whose receipts are gone keeps the saved replay inputs whole |
| m10 | coverage span not unioned | RED (2) | tapeReview.test.js: m10: a section's span never shrinks |
| o02b | re-queue ignores the candle window (re-targeted at 4121e2cb) | RED (2) | F4: outside the window, changed inputs lower a written pass to partial and name what changed; the output stays, label… |
| o03 | plan-set growth never re-queues | RED (2) | F4: each named input moves its own part; replay, prices, candle status and coverage move nothing |
| r19 | candle fields taken from the new read | RED (6) | candlePass.test.js: a close pass AFTER the candle pass keeps every candle field (write candles, run the close pass, c… |

**The fixes' own mutants**: 81 mutants. 60 were red on the first run; the other 21 survived, and each now has a row (`124f5782`), re-run red in a fresh snapshot.

| Finding | id | Defect introduced | First run | Now, and the row that fails |
|---|---|---|---|---|
| F1 | F1-parent | tapeIdOf accepts any parent collection | **survived** | **RED (1)**: F1 (self-named): a document that names the very ids its path spells — at a foreign parent, one level too deep, or on … |
| F1 | F1-depth | tapeIdOf accepts any depth | **survived** | **RED (1)**: F1 (self-named): a document that names the very ids its path spells — at a foreign parent, one level too deep, or on … |
| F1 | F1-date | a YYYY-MM-DD-shaped but impossible etDate is accepted | **survived** | **RED (1)**: F1 (self-named): a document that names the very ids its path spells — at a foreign parent, one level too deep, or on … |
| F1 | F1-doc | the document need not name the battle and day of its path | red | RED (1): F1: a sanctioned-looking path whose etDate is malformed, or whose document names another battle or day, is skipped |
| F9 | F9-allow | the close-out writer dropped from the protected-store allowlist | red | RED (1): compositionProtectedStores.scan.test.js: DENY-BY-DEFAULT: every protected-or-unresolved write site is on the explicit… |
| F9 | F9-direct | the inline close-out writes directly off the reference again (not the named writer) | red | RED (1): F9: the scanner's census of the tape's write sites equals the write sites that actually run — by function, method and… |
| F9 | F9-guard | the close-out writer does not re-check the tape inside its transaction | **survived** | **RED (1)**: F9: the close-out writer re-reads the tape in its own transaction — it marks a tape still waiting, never a written, e… |
| F2 | F2-age | a sample may be a day old | red | RED (2): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |
| F2 | F2-valid | sampleAt never marks a sample stale | red | RED (2): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |
| F2 | F2-exist-never | sampleCanExist always false (no missing sample is retryable) | **survived** | **RED (1)**: F2 (hole): a six-minute hole inside an otherwise whole AAPL session — the 10:00:20 ET check has no fresh price, so th… |
| F2 | F2-exist-always | sampleCanExist always true (a pre-09:31 null is retryable) | red | RED (26): film-tape-backfill.e2e.test.js: the next candle morning enriches every backfilled day inside the retry window |
| F2 | F2-expected-1 | a whole session is one ten-minute bar | red | RED (2): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |
| F2 | F2-expected-39 | every session expects 39 bars (early close ignored) | red | RED (1): F2 (M11): an early-close session is a whole session — the real processTape keeps 21 ten-minute bars (from the calenda… |
| F2 | F2-plan-close | a plan's stale close price is not retryable | **survived** | **RED (1)**: F2 (plan close): a plan-only name whose bars stop at 15:53 ET — its series is whole and every check priced, but the p… |
| F2 | F2-plan-stale | a plan's stale price stands for the instant | red | RED (1): F2: every sample kind obeys the age rule — the bought leg, a plan's two prices, the comparables — null with the stale… |
| F2 | F2-atcheck | a series check price from a stale bar | red | RED (1): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |
| F2 | F2-replay | replay samples ignore freshness | red | RED (2): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |
| F2 | F2-evidence | the bought-vs-evidence reconciliation uses a stale bar | red | RED (1): F2: every sample kind obeys the age rule — the bought leg, a plan's two prices, the comparables — null with the stale… |
| F2 | F2-comparables | comparables use stale bars | red | RED (1): F2: every sample kind obeys the age rule — the bought leg, a plan's two prices, the comparables — null with the stale… |
| F2 | F2-incomplete | an incomplete series still lets the pass be written | red | RED (2): F3: a LONGER response replaces the saved series — the whole session wins over a saved hole, and nothing is marked pre… |
| F2 | F2-gap-stale | seriesGaps ignores checks with no fresh price | **survived** | **RED (1)**: F2 (hole): a six-minute hole inside an otherwise whole AAPL session — the 10:00:20 ET check has no fresh price, so th… |
| F2 | F2-gap-bars | seriesGaps ignores a short bar count | red | RED (2): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |
| F3 | F3-fresh | a retry always replaces the saved series with its own response | red | RED (1): F3 R03: morning 1 saves AAPL whole (39 bars) while SPY fails; morning 2 brings SPY but one AAPL minute — the 39 bars … |
| F3 | F3-tie | the checks-priced tie-break dropped | **survived** | **RED (1)**: F3 (tie): a response covering as many minutes as the saved series but pricing fewer checks does not replace it |
| F3 | F3-noread | the saved series is not read in the transaction | red | RED (3): F3 R03: morning 1 saves AAPL whole (39 bars) while SPY fails; morning 2 brings SPY but one AAPL minute — the 39 bars … |
| F3 | F3-nofresh | a saved series whose refetch fails is dropped | red | RED (2): F3: a saved series whose refetch fails stands, and the coverage judges it by its own bars — never "no bars", never co… |
| F3 | F3-preserved | the series coverage never says preservedFrom | red | RED (1): F3 R03: morning 1 saves AAPL whole (39 bars) while SPY fails; morning 2 brings SPY but one AAPL minute — the 39 bars … |
| F3 | F3-keptgaps | a kept series is not judged by its own bars | red | RED (1): F3: a saved series whose refetch fails stands, and the coverage judges it by its own bars — never "no bars", never co… |
| F3/F4 | F3-uncovered | uncoveredChecks never reports checks recorded after the series was built | **survived** | **RED (1)**: F4 (kept series): tick 10 recovered, then a shorter AAPL response keeps the saved series — built before tick 10, so i… |
| F4 | F4-checks | the fingerprint ignores the checks | red | RED (3): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F4 | F4-evidence | the fingerprint ignores the evidence | red | RED (1): F4: each named input moves its own part; replay, prices, candle status and coverage move nothing |
| F4 | F4-actions | the fingerprint ignores the actions | red | RED (1): F4: each named input moves its own part; replay, prices, candle status and coverage move nothing |
| F4 | F4-plans | the fingerprint ignores the plans | red | RED (1): F4: each named input moves its own part; replay, prices, candle status and coverage move nothing |
| F4 | F4-symbols | the fingerprint ignores the symbol set | red | RED (1): F4: each named input moves its own part; replay, prices, candle status and coverage move nothing |
| F4 | F4-compare | the close pass never compares fingerprints | red | RED (2): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F4 | F4-store | the candle pass never stores its fingerprint | red | RED (3): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F4 | F4-label | candle coverage is not labelled when its inputs changed | red | RED (3): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F4 | F4-outside | outside the window a written pass stays written after its inputs changed | red | RED (2): F4: outside the window, changed inputs lower a written pass to partial and name what changed; the output stays, label… |
| F4 | F4-attempts | a re-queue keeps the spent attempts | red | RED (4): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F4 | F4-export | the export drops "inputs changed since it was built" | red | RED (1): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F5 | F5-unknown | unknown checks are never counted | red | RED (3): F5 R05: the model check lost its tick, its entry and its run — no section that would have read it is complete, and th… |
| F5 | F5-lost | an absent entry nothing could have evicted is not a caveat | red | RED (2): F5 R14: a tick names its evalId but the entry is absent — calls and directives are no longer complete, and nothing cl… |
| F5 | F5-evicted-cap | an absent entry counts as evicted without the array being at its cap | **survived** | **RED (2)**: F5 (lost, not evicted): below the cap, an absent entry older than every surviving one is LOST — a caveat that is kept… |
| F5 | F5-cap-rule | BA-20 amended reverted: the cap alone lowers coverage | red | RED (3): F5 R13 (BA-20 amended): at the 150 cap with the oldest surviving entry before this day nothing of the day was evicted… |
| F5 | F5-caveat-union | a stored caveat is dropped by the merge | red | RED (1): F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| F5 | F5-caveat-status | a standing caveat does not hold the status at partial | red | RED (1): F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| F5 | F5-unknown-max | unknownChecks taken from the new read only | **survived** | **RED (1)**: F5 (sticky count): a later read that sees fewer unknown checks never lowers the stored count — the count and its cave… |
| F5 | F5-callnote | the calls note is categorical again when an entry is lost | red | RED (1): F5 R14: a tick names its evalId but the entry is absent — calls and directives are no longer complete, and nothing cl… |
| F5 | F5-caveats-kept | caveats are not kept on the section | red | RED (1): F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| F7 | F7-rank | active and completed rank equal | red | RED (2): F7 R11: an ACTIVE day assembled before the completion, merged after the completed day landed — the battle stays compl… |
| F7 | F7-stored-later | a later stored lifecycle state does not win | red | RED (1): F7 R11: an ACTIVE day assembled before the completion, merged after the completed day landed — the battle stays compl… |
| F7 | F7-status-at-write | battleStatusAtWrite taken from the new read | red | RED (1): F7 R11: an ACTIVE day assembled before the completion, merged after the completed day landed — the battle stays compl… |
| F7 | F7-reread | the writer does not act on the battle it re-reads in its transaction | red | RED (1): F7: the writer re-reads the battle inside its transaction — a stale active battle handed to it cannot write "active" … |
| F6 | F6-final | the final trading day is not validated as a session | **survived** | **RED (2)**: reviewAvailability.test.js: a final day that cannot exist (2026-02-30) is never read — unavailable, no read spent |
| F6 | F6-owning-own | a completion outside the calendar is owned by its own date | red | RED (1): F6 R09: an owning pass beyond the maintained calendar (2028) — "unavailable", and the close pass refuses calendar_mis… |
| F6 | F6-next-past-calendar | the next-session walk runs past the maintained calendar | **survived** | **RED (1)**: F6 (calendar edge): a completion after the calendar's last pass (2027-12-31, 22:00 ET) — the next session is beyond t… |
| F6 | F6-tapedatefor | the helper skips tapeDateFor — any pass still to run is enough | **survived** | **RED (1)**: F6 (final day untaped): a battle completed two sessions before its final day — a pass is still to run, but none will … |
| F6-followup | F6-onepass | only the owning pass is followed (the follow-up reverted) | red | RED (3): reviewAvailability.test.js: unavailable: completed with no tape and no pass scheduled (a pre-backfill battle is never… |
| F6 | F6-forever | pending whatever the time — a pass that has run still counts | red | RED (6): reviewAvailability.test.js: unavailable: completed with no tape and no pass scheduled (a pre-backfill battle is never… |
| F6 | F6-malformed-read | the helper reads a final day that cannot exist | **survived** | **RED (1)**: reviewAvailability.test.js: a final day that cannot exist (2026-02-30) is never read — unavailable, no read spent |
| F6 | F6-copy-rule | the close pass carries its own copy of tapeDateFor | red | RED (1): F6: one calendar and one rule — the server schedule and the helper use the same module functions, and the helper keep… |
| F6 | F6-copy-calendar | the server calendar wraps its own getSessionForDate | red | RED (1): F6: one calendar and one rule — the server schedule and the helper use the same module functions, and the helper keep… |
| F8 | F8-nosweep | the sweep never runs | red | RED (5): F8 R20: a pending 2026-09-01 tape — behind the 2026-09-25 scan (which starts 2026-09-03) — is closed out: failed, ret… |
| F8 | F8-status | the sweep skips retryable failed tapes | red | RED (2): F8: terminal tapes are never rewritten, and a pending tape behind more of them than a page still gets closed out |
| F8 | F8-terminal | the sweep does not skip terminal tapes before the close-out | **survived** | **RED (1)**: F8 (cost): a terminal tape behind the scan costs the sweep a query result, never a transaction |
| F8 | F8-cursor | the sweep never pages past its first page | red | RED (1): F8: terminal tapes are never rewritten, and a pending tape behind more of them than a page still gets closed out |
| F8 | F8-maxmarks | the sweep ignores maxMarks | red | RED (1): F8: bounded and resumable — at most maxMarks close-outs a run; the next morning continues where this one stopped |
| F8 | F8-validate | the sweep does not validate the result path | red | RED (1): F8 (BA-23): the sweep validates every path too — an old foreign tape is skipped and counted, never closed out |
| F8 | F8-lookback | the retryable-failed lookback bound is ignored | **survived** | **RED (1)**: F8 (look-back): a retryable failed tape older than the 60-session look-back is left as it is — the stated bound; one … |
| F8 | F8-order | the sweep reads newest first | red | RED (1): tapeWiring.test.js: the candle pass's queries — the expiry sweep (BA-29) and the selection — all need the tape collec… |
| R08 | R08-assembled | aftermath bounded by the new read's directives only | red | RED (1): R08: a later committed filing that left the source but stays on the tape still ends the earlier directive's aftermath |
| R08 | R08-norecount | after is never recounted on merge | red | RED (1): R08: a later committed filing that left the source but stays on the tape still ends the earlier directive's aftermath |
| F8 | F8-isolate | a failing sweep close-out is not isolated (it aborts the morning) | **survived** | **RED (1)**: F8 (isolated): one close-out the sweep cannot write never costs the morning — the other old tape is closed out and th… |
| F8 | F8-maxreads | the sweep does not count what it reads (maxReads never binds) | **survived** | **RED (1)**: F8 (read bound): the sweep stops at maxReads and says it is incomplete — the rest waits for the next morning |
| F8 | F8-floor | the sweep ignores the time floor | **survived** | **RED (1)**: F8 (time floor): with the budget spent, the sweep reads nothing and says it is incomplete |
| F5 | F5-limit-as-caveat | a limit of one read is kept as a caveat (it can never clear) | red | RED (1): writeTapeDay.test.js: monotonicity: write, evict the source, write again — every fact kept, the section marked preser… |
| F5 | F5-caveat-as-limit | a caveat is treated as a limit (the merge may drop it) | red | RED (1): F5 R12: a late run record whose deferred list was truncated lowers a complete checks section on the re-run — and the … |
| F4 | F4-reason | a changed input is always called sources_changed | red | RED (2): F4 R06: tick 10 recovered after the candle pass re-queues it — pending, inputs_changed; the earlier output stays, lab… |
| F4 | F4-stack | the built-before label stacks instead of being replaced | **survived** | **RED (1)**: F4 (one label): a second close run over the same changed inputs keeps ONE "built before" label — and writes nothing |
| F3 | F3-doc-preserved | a kept series document is never marked preservedFrom | red | RED (1): F3 R03: morning 1 saves AAPL whole (39 bars) while SPY fails; morning 2 brings SPY but one AAPL minute — the 39 bars … |
| F2 | F2-export-age | the read-out drops a null sample's bar age | red | RED (1): F2 R02: AMD with only its first 61 bars (the last closes 10:31 ET) — no close replay, the input named, the stale bar'… |

### 8.7 Existing rows that changed, and why

Each change is stated in its commit. None weakens what the row pinned.

| Row (file) | Commit | What changed, and why |
|---|---|---|
| L2-F6 "one failed close-out marker never costs the morning" (`tapeReview.test.js`) | F1 `4fbd78c9` | It injected its failure by replacing the query reference's `update`, which the fix no longer calls. It now fails the aged tape's path through the store's `beforeWrite` hook. The intent is the same, and the row is still red when the close-out's try/catch is removed (M37, §8.6). |
| L1-F13 (`tapeReview.test.js`) | F5 `2bf34836` | Emptying `evaluations[]` kept tick 9's `evalId`: that is R14's defect, and the row asserted it as correct. The row now makes check 9 a no-trigger check, so no check of the day reached the model, and it asserts the new wording. |
| the missing-plan-symbol price (`candlePass.test.js`) | F2 `25e7e9ed` | Its exact expectation gains the new `retryableInputs` field. |
| the pre-09:31 replay row (`tapeReplay.test.js`) | F2 `25e7e9ed` | It now also asserts that nothing in it is retryable (`retryableInputs: []`); its comment states BA-24. |
| the §4 shape row, and capturedDay's calls coverage (`writeTapeDay.test.js`) | F5 `2bf34836` | The shape row expects `caveats` and `unknownChecks`. capturedDay's calls coverage is now `partial` with `unknownChecks: 1`: tick 13 was minted and left no record, so its declarations phase is unknown. |
| the declaration golden (`tapeExport.test.js`) | F5 `2bf34836` | It gains `coverage.*.unknownChecks: 'derived'`, the one new number (a count of recorded ids). |
| the index pin and its red twin (`tapeWiring.test.js`) | F8 `0b135ae3` | The recording store gains `startAfter`. The pin now checks every query the candle pass issues (the sweep's three and the selection) against the declared composite; it checked one before. |
| the calendar's session rows (`api/_utils/marketSchedule.sessions.test.js`) | F6 `30cd7dad` | A comment only: its unmocked import is now the BUILD_RULES §4 dependency-surface guard for `src/utils/marketCalendar.js` too. |
| "unavailable: completed with no tape and no pass scheduled" (`reviewAvailability.test.js`) | F6 follow-up `8719ce96` | Its `TUE_0221_UTC` assertion encoded the owning-pass-only rule. The next session's pass re-selects the completion and tapes the final day, so the row now expects `pending` there and `unavailable` at `WED_0220_UTC`. The THU and failed-tape assertions are unchanged. |

The fixtures grew. The in-memory store gains four things: a `beforeWrite` hook, under which a
transaction checks every write before applying any; write call-site recording at the call;
`Transaction#getAll`; and Firestore's `startAfter` value cursor. The fixture set gains
`earlyCloseDay` (2026-11-27), and `sessionRuns` now takes the session's open and close.

### 8.8 Bounds and design choices, stated

- **BA-24, freshness.** A sample is valid only when its bar completed within 5 minutes of the
  instant (`SAMPLE_MAX_AGE_MS`), so a close price needs a bar completed at or after 15:55 ET, or
  12:55 on an early close. A whole series has `ceil(session minutes / 10)` bars, from the calendar
  (39, or 21 on an early close). Before 09:31 ET no price exists at all. That null is the record's
  shape, not a hole, so it is never retried (`sampleCanExist`).
- **BA-25, which series is kept.** More minutes covered wins, then more checks priced, and a tie
  goes to the new build. The fingerprint has five parts: checks, evidence, actions, plans and
  symbols. It is strings only, so there is no number to class. **A reading of BA-25, stated:**
  outside the window BA-25 says `partial`. Only a `written` pass is lowered to `partial`. A `partial`
  pass already is; a `failed` pass keeps its status, records `changedInputs`, and its coverage label
  names what changed. Turning a closed-out tape (`failed`, `retry_window_elapsed`) back to
  `partial` would make it non-terminal again, and the sweep would close it out again the next
  morning, every morning.
- **BA-26, caveat or limit.** A caveat is a fact about the day's record: a gap, a lost entry, a
  truncated list, a missing run slot, an absent declarations record. It survives every merge. A
  limit belongs to one read: a source unreadable, an array at its cap. Preserved facts make up for
  it, and a later read that can see clears it. `unknownChecks` counts the `no_record` rows, the
  minted numbers whose day cannot be placed, and the entries lost without eviction. **A reading of
  BA-26, stated:** "reasons and notes are unioned" is applied to caveats. When a later read is
  poorer only because of a limit, the stored coverage stands with its own note, marked
  `preservedFrom`: that is "facts keep their earlier rank" (BA-19), and the monotonicity rows
  require it. A caveat from either run is always carried, and it holds the status at most
  `partial`.
- **BA-27, lifecycle.** `active` ranks 1 and `completed` ranks 2. The close pass selects no other
  status: a `pending` battle has no trading day yet.
- **BA-28, the passes followed.** The owning pass, then each next session's pass while its
  completion window still holds `completedAt`. In practice that is at most two passes: the
  completion's own night and the next session's. `closePassStillScheduled` stays exported as the
  owning pass's schedule, and its rows still pin `owningPassDate`. Stage 3 decides by
  `closePassWillTape`.
- **BA-29, the sweep.** `EXPIRY_SWEEP` (`candlePass.js:85`): at most 100 close-outs, pages of 100,
  and 1,000 documents read per run. It runs first each morning and respects the 30 s floor.
  Pending and partial tapes are swept over their whole history. Each close-out removes the tape
  from its query, so a stopped sweep resumes the next morning where it stopped. A **retryable
  `failed`** tape is looked for only within **60 sessions** before the scan: terminal failures stay
  `failed`, so an unbounded look would re-read them every morning. A retryable failure older than
  that keeps its status and its stale reason. Reaching that state needs a sweep that has not run
  for 60 sessions after the tape aged out.
- **BA-30.** `after` is recounted on every merge, from all merged directives. The first write, and
  an identical re-run (which writes nothing), are unchanged.
- **Out of scope, kept out.** The scoring defect (Astra §7, R21, §6.9 here) is not touched. The
  close pass can target a malformed final day, such as `2026-02-30`: `writeTapeDay` then refuses
  it, and `markCloseFailed` records the failure at that id. That is outside Astra's table, so it is
  not widened here. The helper never promises such a day (F6). Astra's review numbers its mutants
  M01–M06, M08, M10 and M11; there is no M07 or M09.

### 8.9 Verification at the tip

| Check | Result |
|---|---|
| Code tip | `124f5782`. The report commit that follows changes only this file, and no test reads it. |
| Full suite, Linux (`npx vitest run`, JSON reporter, output redirected) | **820 files, 16,322 tests: 16,258 passed, 64 skipped, 0 failed; exit 0.** At `e7e527e7` it was 819 files and 16,271 tests (16,207 passed, 64 skipped, 0 failed). The difference is exactly `tapeAstraReview.test.js` (50 rows) and one `reviewAvailability.test.js` row. No pre-existing file fails. The same run at `0d78b6d7`, before the mutation rows, gave 820 files and 16,304 tests (16,240 passed, 64 skipped, 0 failed), exit 0. |
| Tape suites | 15 files, 329 tests, all passed. The original 14 files went from 278 to 279 tests, and `tapeAstraReview.test.js` has 50. With the protected-store scan and the calendar's session rows, the mutation run's 17 files hold 345. |
| Rules suite on the emulator (`npm run test:rules`) | **18 files, 332 tests, all passed; exit 0.** The same as the baseline: this round touches no rule. |
| `npm run lint:gate` | exit 0 |
| `npx vite build` | exit 0; built in 27.4 s. The same four pre-existing `css-syntax-error` warnings. |
| Mutation | 199 mutants, all red (§8.6) |
| Fence | `git diff --name-only e7e527e7..HEAD` names no §1 file |
| Flags, crons, rules, indexes | `featureFlags.js` (both tape flags `false`), `vercel.json` (43 crons), `firestore.rules` and `firestore.indexes.json` are unchanged since `e7e527e7`. Nothing is deployed. |

### 8.10 Founder actions, updated

§6's list stands, with these changes:

1. **Human review: seven notes, not six** (§6.1). The seventh is
   `candlePass.js::markRetryWindowElapsed::update`. All seven notes were refreshed to say how each
   reference is built (§8.4).
2. **Indexes: nothing new.** The sweep's three queries use the same declared composite
   (`passes.candles.status` ==, then an `etDate` range, ordered by `etDate` ascending), and the
   wiring pin checks all four queries against it. The two Console entries in §6.3 are still the
   whole list, and still not deployed.
3. **One new class declaration for Astra:** `coverage.*.unknownChecks` is `derived`, a count of
   recorded ids (§6.4).
4. **BA-20 amended is in force.** The cap rule is the spec's (R13). An evaluations-sourced section
   at the 150 cap is lowered when its oldest surviving entry is on or after the day's start. An
   absent entry of the day lowers it in any case (F5).
5. **Astra §9, item by item.**
   - Items 1–5 are the fixes above. Item 1's human review is item 1 of this list.
   - Item 6, a recovery path for pending tapes older than the scan: the sweep now closes them out
     (F8), and BA-29 names the backfill entry as your repair path.
   - Item 7 is still owed: re-run the Linux full suite and the intended emulator version in your
     normal validation environment.
6. **Routed, not fixed:** the live-scoring defect (§6.9; Astra §7, R21) goes to the Command Center
   arc.

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
