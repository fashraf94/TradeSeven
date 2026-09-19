# Intraday Data — Build 1 — Build Report

**Date:** 2026-09-19 · **Branch:** `claude/intraday-build-1-utkb37` · **Base:** `origin/main` @ `ceffdc78` (PR #870 merge; clean tree at session open)
**Contract implemented:** `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md` (V1.1). Spec V3 and Amendment A are the ledger record only.
**Step 0 record:** `docs/audits/20260919_BUILD1_STEP0.md` (commit `4a95b744`) — the drift list this build acted on.
**Delivery ends at pushed (BUILD_RULES §2).** No PR is opened; the contract's §2 adversarial review runs first, in its own session. This report does not claim that review.

**Preamble (BUILD_RULES §3):** `git fetch origin` was the first step of the session (recorded in the Step 0 report; `origin/main` = `ceffdc78`, the branch cut from it). The container was a shallow clone and was not unshallowed. **Fence:** `agentEvalPromptAssembly.js` (`formatRecentEvals`), `agentRiskManager.js` (`calculate5minSMA20`), `agentBattleService.js` (`findActiveAgentBattles`), `agentScoring.js` (`flattenBenchServer`) and `agentPresetConfig.js` were READ and CALLED; **no fenced file was edited** — `git diff origin/main --name-only` was checked against the BUILD_RULES §1 list at close (zero hits). **External calls:** 0 EODHD calls, 0 units; `eodhd.com` is egress-blocked from this environment (Step 0 §4). The Firestore emulator ran locally for the rules suite.

---

## Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | Contract §3–§11 implemented | **Yes**, in nine commits grouped by section (table §1 below). **Correction (addendum A7):** this row originally read "each with the suite green at the time of the commit", which contradicted §5 item 22 of this same report ("four standing guards red on the first full run") and was not true. Verified read-only by the §2 review: `7055695d` and `fe02bdbe` carry a 41-entry `vercel.json` against a `compute-index-intelligence.axes.test.js` pin still reading 39; `fe02bdbe` and `87be90a1` predate `useIntradayView.js` joining the theme guards' guarded-file lists. **Three of the nine commits do not build green in isolation.** The final tree is green and always was — that is what merges — but the intermediate claim was wrong. The addendum's own eight commits were each verified with a full `npx vitest run` before committing. |
| 2 | Every flag ships off / `'legacy'` | **Yes.** `INTRADAY_COLLECT_ENABLED`, `INTRADAY_DIAGNOSTIC_ENABLED`, `INTRADAY_AGENT_USE_ENABLED`, `INTRADAY_RISK_ACTIVATION_ENABLED` = `false`; `INTRADAY_PRICE_SOURCE` = `'legacy'`. Pinned (`src/config/intradayFlags.test.js`, `src/config/intradayPriceSourceFlags.test.js`); the two stage gates registered `DARK_BY_DESIGN`. |
| 3 | The one flags-off behaviour change (§11) | **Intentional and isolated in its own commit** (`5d0de9ee`): `isVwapSessionUsable` gains a mandatory freshness clause; the legacy candle path passes its newest session candle's timestamp; `VWAP_LEGACY_MAX_AGE_MS = 45 min`; a stalled feed is refused. Independently tested. Every golden byte-identical (the harness candles were re-dated, OHLCV untouched). |
| 4 | Fenced files | **None edited** (§14). |
| 5 | `FieldValue.increment` | **None.** The budget counter is a read-add-write transaction (D-105), asserted by a source tripwire. |
| 6 | `Date.now()` in pure modules | **None.** Every pure intraday module takes `nowMs`; asserted by a comment-stripped source tripwire. |
| 7 | `calcVersion: 1`, `policyVersion: 1` on every record | **Corrected (addendum A7).** Both versions ride **views, `intradayDefinitions/v1` and `intradayValidation/{etDate}`**. `intradaySnapshots/latest` and the log entries carry **`calcVersion` only** — per §7.1, whose eleven-key log entry omits `policyVersion` and which `pollRunner.test.js:78` pins in order. The original row claimed both on all five. §7.1 is right on the merits: a log entry records an estimate, not an eligibility verdict, and §10.7 itself scopes `policyVersion` to §8.3. **§10.7's "Both on every view, log entry and validation document" is a contract error**, filed for V1.2. |
| 8 | The copy table for player surfaces | **One module**, `src/data/intradayDiagnosticCopy.js`; a repo-wide scan asserts no other module carries its phrases. |
| 9 | Sizing (§7.3) | Measured (table §3). Publish transaction at 30 actionable = **3.9 MiB < 8 MiB** — no STOP. At 255 actionable = 31 MiB, over the 10 MiB ceiling; reported, not a STOP (the contract's STOP line is the 30 case). |
| 10 | Close | Full suite: **720 files passed / 3 skipped, 13,836 tests passed / 64 skipped, exit 0** (`npx vitest run`, unpiped to a log, exit code recorded; run on the final tree after the guard reconciliation). `npm run lint:gate` exit **0**. `vite build` exit **0**. Honesty suite green including the new sent-prompt on/off diff. Rules suite against the emulator **10/10**. |
| 11 | Review threshold (BUILD_RULES §2) | Cumulative branch diff **76 files, +7,253 / −45** — far past the ≥ 10 files / ≥ 1,500 lines threshold. The mandatory multi-lens adversarial review is the contract's §2 review, a separate Fable session, per the task prompt. **Not performed here; not claimed.** |

---

## 1. Contract section → files

| Contract | Files (new unless marked M) | Commit |
|---|---|---|
| Step 0 | `docs/audits/20260919_BUILD1_STEP0.md` | `4a95b744` |
| §6.5 step functions, batch parity | `api/_utils/intraday/stepIndicators.js`, `stepIndicators.test.js` | `036e7012` |
| §4 normalization, §5.4–5.6 accumulator/classification/rollover, §6.1–6.4/6.7 buckets, §6.6 seeding (pure), §5.2 config, §8.2 fact blocks | `api/_utils/intradayConfig.js`, `api/_utils/intraday/{observation,accumulator,buckets,seed,facts,sweepCalc}.js` + tests, `api/_utils/__fixtures__/intradaySessions.js`, `docs/audits/fixtures/AAPL_2026-09-17_1m.json` | `9e76aa01` |
| §7 storage, lease, publication, budget; §5.3 fetch; §7.3 sizing | `api/_utils/intraday/{intradayStore,intradayFetch}.js` + tests, `api/_utils/intraday/intradaySizing.test.js` | `5c6e9c55` |
| §8.1–8.5 records, eligibility, adapter, evaluator hook, rules; §3 flags; §9.1 copy table | `api/_utils/intraday/{eligibility,view,priceAdapter,evaluatorHook}.js` + tests, `src/data/intradayDiagnosticCopy.js` + test, `src/config/featureFlags.js` (M), `src/config/{intradayFlags,intradayPriceSourceFlags}.test.js`, `src/config/flagPinGuard.test.js` (M), `firestore.rules` (M), `test/rules/intradayViewsDenials.rules.mjs`, `api/_utils/tickStamps.js` (M), `api/cron/agent-evaluate.js` (M), `api/cron/agent-evaluate.test.js` (M — call-site pin), `api/cron/agent-evaluate.intradayViews.test.js`, `api/cron/agent-evaluate.intradayViews.flagOff.test.js` | `7c143085` |
| §5.1 poller, §10 validator, G5 calendar | `api/_utils/marketSchedule.js` (M — `getSessionForDate`, `getPreviousSessionDate`) + `marketSchedule.sessions.test.js`, `api/_utils/intraday/{etTime,universe,pollRunner,validator,validationRunner}.js` + tests, `api/_utils/__fixtures__/intradayPollHarness.js`, `api/cron/intraday-poll.js`, `api/cron/intraday-validate.js` + handler tests, `vercel.json` (M — 39 → 41) | `7055695d` |
| §9.1 player surface, §9.2 allowlists, §9.3 lint | `src/screens/battleView/useIntradayView.js` + jsdom test, `src/screens/battleView/WhyPanel.jsx` (M) + `WhyPanel.intraday.render.test.jsx`, `src/screens/battleView/battleViewCopy.js` (M), `src/screens/AgentBattleScreen.jsx` (M), `api/_utils/anticipationThresholdLint.js` (M) + `anticipationThresholdLint.intraday.test.js`, `api/_utils/agentReflectionUtils.js` (M), `api/_utils/voiceLayerGrounding.js` (M), `api/_utils/voiceLayerAnticipation.js` (M), `api/_utils/intradayPromptExclusions.test.js`, `api/cron/agent-evaluate.intradayPromptDiff.honesty.test.js` | `fe02bdbe` |
| (pin) | `api/cron/compute-index-intelligence.axes.test.js` (M — the vercel.json count pin, 39 → 41) | `87be90a1` |
| (guards) | `api/agent/research.dark.test.js` (M — the same cron-count pin), `src/theme/tokens.guard.test.js` + `tokenGuardBaseline.json` (M), `src/theme/motion.guard.test.js` + `motionGuardBaseline.json` (M — the new hook joins both guarded lists, hazard 34), `api/_utils/compositionProtectedStoresAllowlist.json` (M — the seven intraday write sites at their scanned counts, human-review note) | `ab490626` |
| §11 legacy gate | `api/_utils/agentVwapFloor.js` (M), `agentVwapFloor.test.js` (M), `api/cron/agent-evaluate.js` (M — two call sites), `agent-evaluate.test.js` (M — pin), `api/cron/agentVwapFloor.replay.test.js` (M), `api/_utils/__fixtures__/tickStampsHarness.js` (M — candle dates) | `5d0de9ee` |
| Report | `docs/audits/20260919_BUILD1_INTRADAY.md` | (this commit) |

Fenced functions **called** (never edited): `formatRecentEvals` (test only), `calculate5minSMA20` (parity test only), `findActiveAgentBattles` (poll and validate handlers), `flattenBenchServer` (pre-existing call in the evaluator), `getPresetConfig` (non-fenced).

---

## 2. The §11 change, stated as intentional

`isVwapSessionUsable({ sessionDate, todayET, coverageCount, asOfMs, nowMs, maxAgeMs })` — the freshness clause is **mandatory**: a missing or non-finite `asOfMs`/`nowMs` fails closed, and `nowMs − asOfMs > VWAP_LEGACY_MAX_AGE_MS (45 min)` is refused. The legacy candle path (`api/cron/agent-evaluate.js`, the A1 gate) passes `newestCandleAsOfMs(sessionCandles)` and `Date.now()`; the cascade re-qualification (`qualifyCascadeReplacement` → `isReplacementQualified`) passes the same. `sessionCandleCount` remains accepted as an alias of `coverageCount`. Effect with every flag off: a feed that published today-dated bars and then stalled no longer arms the floor or the trailing stop after 45 minutes — the age-blind hole of the 2026-09-18 discovery (§1.2) is closed. Tests: `api/_utils/agentVwapFloor.test.js:59-104` (the 09:35-then-nothing shape refused; the 45-minute boundary; the mandatory clause; the parser), `:145-149` (cascade). The tick-harness candles were re-dated 13:30–13:50Z → 14:35–14:55Z with OHLCV untouched so the pre-§11 suites and every golden keep asserting the VWAP-present path byte-for-byte (`tickStampsHarness.js` `makeIntradayCandles`, comment states why).

---

## 3. Sizing (§7.3) — measured

Method: `api/_utils/intraday/intradaySizing.test.js` runs the real `runSweepCalc` for 420 sweeps over a generated 255-symbol universe (every 5th sweep) with 30, then 255, actionable symbols; documents are sized with Firestore's documented storage accounting (`intradayStore.firestoreDocBytes`: UTF-8 string bytes + 1, 8 per number, 1 per boolean/null, key bytes + 1 per map field, 32 per document + name). The rows are standing assertions.

**Re-measured at HEAD (addendum A7).** The original table was measured at `5c6e9c55` and never re-measured; by the time the §2 review re-ran it, four of five rows had drifted (`facts.js` gained a `cutoff` on `volumePace`, `serializeActionable` gained `seed`). It drifted again here, deliberately: A3 adds `heldCount` to every accumulator. The rows below are HEAD.

| Measurement | Bytes | vs ceiling |
|---|---|---|
| `intradaySnapshots/latest` at 255 symbols | **252,689** | 24.1 % of 1 MiB |
| `intradayCalcState/{etDate}` at 255 accumulators | 52,165 | 5.0 % of 1 MiB |
| one actionable document at 420 sweeps (ring 60 + state + 420 log entries) | **125,832** | 12.0 % of 1 MiB |
| publish transaction at **30** actionable | **4,078,320** | 38.9 % of 10 MiB — **under the 8 MiB STOP line** |
| publish transaction at **255** actionable | **32,475,711** | 309.7 % of 10 MiB — exceeds |
| **fitted per actionable symbol / fixed component** | **126,211 / 292,001** | the fit agrees with the measured single document to < 5 % |
| **10 MiB crossing** | **80.8 actionable symbols** | now a STANDING assertion (`≥ 80`), not a number in a report |

Reading: the transaction supports the actionable set the contract prices (held ∪ bench across active battles; 30 in §13's arithmetic) **with room to 80 symbols — not ~70, as this row originally said.** The crossing is at **81 actionable symbols, roughly 7 concurrent battles**, and that is the count by which the founder must have decided the generation-pointer question. §7.3's own trigger ("only if the transaction ceiling is below 30") is mis-calibrated by ~2.7× and is filed as a contract error for V1.2. Addendum A4 makes an over-limit publish **refuse** rather than attempt: `PUBLISH_MAX_BYTES = 9 MiB`, logged as `publish_oversize` with the byte and symbol counts.

---

## 4. Every §12 test, mapped

| §12 row | File : row |
|---|---|
| Receipt-only replay (§8.2): snapshot deleted, strikes and lines from view + definitions alone | `api/_utils/intraday/view.test.js:85` |
| Unchanged observation → no update, no anomaly | `api/_utils/intraday/accumulator.test.js:83` |
| Volume-only advance | `api/_utils/intraday/accumulator.test.js:97` |
| Regressed vs unchanged distinction | `api/_utils/intraday/accumulator.test.js:110` (resume `:124`, degraded `:137`) |
| Rollover before comparison; overnight reset not an anomaly | `api/_utils/intraday/accumulator.test.js:165`, `:190` |
| Numeric validation with volume-invalid leaving price indicators intact | `api/_utils/intraday/accumulator.test.js:151` (and `:44`) |
| `strikeKey` unchanged across a refreshed `snapshotTs` | `api/_utils/intraday/observation.test.js:93`; on the accumulator `accumulator.test.js:83` |
| Missed-deadline invocation finalised by the next invocation | `api/_utils/intraday/pollRunner.test.js:130` |
| … and separately by the validator | `api/_utils/intraday/validationRunner.test.js:106` |
| §8.1 four failure modes (no_snapshot, snapshot_invalid, read_failed ×2 forms, write_failed) byte-identical apart from the pointer fields | `api/cron/agent-evaluate.intradayViews.test.js:216` (the `cases` loop, `:208-214`); flag-off byte-identity `agent-evaluate.intradayViews.flagOff.test.js:54` |
| Subcollection rules: owner read, non-owner denied, client write denied | `test/rules/intradayViewsDenials.rules.mjs:79`, `:83`, `:87`, `:90`, `:93`, `:101` (emulator; `npm run test:rules`) |
| Live v2 `data`-keyed parse and omitted symbol | `api/_utils/intraday/observation.test.js:20`; shape-unexpected `:44`; unit coercion `:60` |
| Early-close seed of 42 buckets with per-indicator readiness | `api/_utils/intraday/seed.test.js:47` |
| Second-session fetch when < 35 | `api/_utils/intraday/pollRunner.test.js:164`; the pure combiner `seed.test.js:90` |
| Log-entry provenance fields | `api/_utils/intraday/pollRunner.test.js:59` (the eleven keys, in order) |
| Units recorded when publish fails | `api/_utils/intraday/pollRunner.test.js:96` |
| Sent-prompt on/off diff | `api/cron/agent-evaluate.intradayPromptDiff.honesty.test.js:170` |
| `closeQualified` cleared for SMA20 by window exit, for MACD/RSI only by qualified reinitialisation | `api/_utils/intraday/buckets.test.js:183`; unqualified seed `:213` |
| §10.2 exclusion of unqualified series | `api/_utils/intraday/validator.test.js:72`; per-symbol `:129` |
| Parity at N ∈ {35, 61, 120} to 1e-9 (all four step functions) | `api/_utils/intraday/stepIndicators.test.js` (EMA `:78`, SMA `:108`, RSI `:124`, MACD `:157`) |
| Verdict flips as `nowMs` crosses an age limit, persisted view unchanged | `api/_utils/intraday/eligibility.test.js:37`; on a stored view `view.test.js:127` |
| Late-seed rebuild parity over > 60 bars | `api/_utils/intraday/buckets.test.js:224` |
| Lease busy / lost / expired; one-generation publish; nothing written on abort | `api/_utils/intraday/intradayStore.test.js:21`, `:49`, `:75` |
| Budget read-add-write; no increment sentinel; no clock in pure modules | `api/_utils/intraday/intradayStore.test.js:90`, `:100` |
| §8.5 adapter: every consumer field, timestamp units, nullable previousClose, crypto path | `api/_utils/intraday/priceAdapter.test.js:12`, `:30`, `:41` |
| §9.2 (a) reflection input has no diagnostic key | `api/_utils/intradayPromptExclusions.test.js:67` |
| §9.2 (b) `formatRecentEvals` byte-identical ± pointer fields | `api/_utils/intradayPromptExclusions.test.js:38` |
| §9.2 (c) narrator record block and anticipation note likewise | `api/_utils/intradayPromptExclusions.test.js:46`, `:54` |
| §9.3 five names never present with the flag false; present only with view + flag | `api/_utils/anticipationThresholdLint.intraday.test.js:10`, `:20`; vocabulary rows `:31` |
| §11 stalled feed refused, boundary, mandatory clause, cascade | `api/_utils/agentVwapFloor.test.js:59`, `:70`, `:75`, `:145` |
| §7.3 sizing | `api/_utils/intraday/intradaySizing.test.js:48` |
| §5.1 `calendar_missing`, session guard, lease busy | `api/_utils/intraday/pollRunner.test.js:34`, `:40`, `:50` |
| §10.1 state machine: unpublished attempt, ≤ 20 / 60 s, done, window_closed | `api/_utils/intraday/validationRunner.test.js:32`, `:56`, `:75`, `:90` |
| Client: one get on open, evalId match | `src/screens/battleView/useIntradayView.jsdom.test.jsx:46`, `:56` |
| Client: the diagnostic block with the fixed header | `src/screens/battleView/WhyPanel.intraday.render.test.jsx:30` |
| Flag pins | `src/config/intradayFlags.test.js:28-40`, `src/config/intradayPriceSourceFlags.test.js:19` |
| G5 calendar sessions (EDT/EST/early close/horizon) | `api/_utils/marketSchedule.sessions.test.js:8-49` |
| §8.2 definitions immutable, `venue: 'vendor_unconfirmed'` | `api/_utils/intraday/view.test.js:76` |
| All V1 tests retained | every pre-existing suite runs unchanged except the two pins moved with their call sites (`agent-evaluate.test.js:869`, `compute-index-intelligence.axes.test.js:114`) and the §11 rows given fresh instants (`agentVwapFloor.test.js`, `agentVwapFloor.replay.test.js`). |

---

## 5. Not implemented exactly as written — with the clause and why

1. **§5.1 `getSessionForDate(etDate)`** did not exist (Step 0 §3). Added to the canonical `api/_utils/marketSchedule.js` with `getPreviousSessionDate`, Intl-resolved, `null` outside `MAINTAINED_HOLIDAY_YEARS` → `calendar_missing`. Non-fenced.
2. **§4 Live v2 field names are ASSUMED** — `eodhd.com` is egress-blocked from this environment (Step 0 §4). The adapter parses exactly the contract's names; a response with no `data` object is `shapeUnexpected` (every requested symbol `missing`); a `lastTradeTime` in seconds is coerced to ms and counted `unitCoerced`. **Day-1 smoke check:** `anomalies.missing === 0` and `anomalies.unitCoerced === 0` on a known-good symbol.
3. **Precondition 4** — the fixture was uploaded as `docs/audits/AAPL_2026-09-17_1m.json.md` (markdown-escaped). Materialised, values unchanged, at the contract path `docs/audits/fixtures/AAPL_2026-09-17_1m.json`; asserted 391 rows / span / Σ volume (`seed.test.js:16`).
4. **§3 "Booleans pin in `flagPinGuard.test.js`"** — the guard holds no pins; it scans test files. The four booleans are pinned in `src/config/intradayFlags.test.js`, which the guard scans and whose name each docstring carries (`Pinned by:`). Same effect, the guard's own shape.
5. **§6.6 second-session fetch** is implemented literally (5 more units when the newer tail < 35). Adjacency is session-relative (last → first), so the older session's buckets connect only when the newer tail reaches the newer session's first bucket. Under the 2026–2027 calendar a complete session is ≥ 42 buckets, so the second fetch is reached only for a gapped newer session — and then adds units but no buckets (`pollRunner.test.js:164`). Stated; the founder may wish to retire the rule.
6. **§6.6 `seedStatus: 'corporate_action'`** — the contract names the outcome, not the detector. Implemented as a > 40 % price jump between the seed's last close and today's first bucket close (`CORPORATE_ACTION_JUMP_FRACTION`); the seed is refused and today's buckets warm on their own.
7. **§6.2 deadline** marks every still-open bucket of the session `incomplete`/`deadline`, not only the last: any open bucket at close + 30 min was not normally completed. The last bucket is created as `incomplete` when it never opened (and the session had buckets). State never advances across an incomplete bucket.
8. **§8.2 `collectionStalled`** — the contract names the fact, not the threshold. A snapshot whose `lastSuccessfulSweepAt` is older than `COLLECTION_STALL_MS = 5 min` at the check marks every symbol stalled (every indicator ineligible with that reason).
9. **§10.2 EOD volume** — no source is named and no unit is budgeted for it. Coverage uses the vendor's cumulative session `volume` at the last accepted quote (`intradayCalcState.accumulators[sym].lastAcceptedVolume`, labelled `eodVolumeSource: 'live_v2_last_accepted_volume'`), at zero units. Its cutoff is itself unconfirmed (§15); `referenceCoveragePct` should be read as indicative until §15 answers.
10. **§10.4 SMA20 residual and MACD event agreement** are computed over the session's contiguous completed buckets on BOTH sides (the ring's closes vs the reference 5-minute closes at the same keys, both warmed within the window). The seed is not carried into the reference side. Unqualified series are excluded (§10.2).
11. **§10.5 test-period rollup / §10.6 qualification calendar** — only the trailing-10 rollup is built (`trailingRollup`). The characterisation/test-session calendar, the seven thresholds and the minimum event counts are the founder's freeze at stage 4; no document holds them yet. **Not built**; the `intradayValidation/{etDate}` document carries everything the freeze will read.
12. **§9.1 "Tape and narrator use the same table"** — neither renders a diagnostic in build 1 (the tape has no view without a fetch; the narrator's prompt readers exclude views by §9.2). The binding is enforced by the repo-wide phrase scan in `intradayDiagnosticCopy.test.js:75`: no other module may carry the table's phrases, so any future render must import the one module.
13. **§8.1 `evalId`** — pre-existing: `evalId` is `evaluations.length + 1` against an array capped at 150, so every entry past 150 is `eval_151` (noted in the cron at the shadow-log call). The view's set-merge would then overwrite `intradayViews/eval_151` each tick. Not fixed here (BUILD_RULES §3: report, don't fix); reported for separate tasking.
14. **§7.3** the 255-actionable transaction exceeds 10 MiB (table §3). Not a STOP by the contract's wording; the generation-pointer design is not needed at ≤ 30.
15. **BUILD_RULES §6 ceiling** — `vercel.json` goes 39 → 41 under contract G10 (100/project); §16 files the §6 "40" as hygiene. Stated so the founder sees it before merge.
16. **§5.5 in production during the first ~15 minutes** — a delayed feed can return pre-open last trades; those are rejected `price_as_of_before_open` and counted `anomalies.rejected`. Expected; the test vendor clamps to the open so the suites exercise in-session paths.
17. **§13 smoke** — crons do not run on Vercel preview (BUILD_RULES §6). The day-1 observations the founder reads are listed in §6 below.
18. **Rules suite** — `test/rules/intradayViewsDenials.rules.mjs` runs under the emulator (`npm run test:rules`), by repo design outside the default suite; it passed here (10/10, rules sha256 printed in its log).
19. **§8.4 vintages** — `intradaySnapshotId`/`intradayGeneration` and `vwap ∈ {diagnostic, tick, absent}` are added only when a view was actually written; otherwise the block is today's five keys (pinned by seven pre-existing suites).
20. **Validator view lookup** (`listViewsForSession`) — a single-field range query on `completedAt` and on `evaluatedAt` (no composite, no collection-group exemption: G9), plus an in-code range guard.
21. **`DARK_BY_DESIGN`** — the two stage gates are registered; `INTRADAY_COLLECT_ENABLED` and `INTRADAY_DIAGNOSTIC_ENABLED` are ordinary pinned flags the founder flips after the day-1 smoke (one line each + the pin row).
22. **Repo guards reconciled in their own commit** — four standing guards red on the first full run (two vercel.json cron-count pins at 39; the token and motion guards' "every battleView file is listed" rows for the new hook; the protected-store write scan's deny-by-default row for the seven new transactional write sites). Each was reconciled the way its own guard prescribes (pin moved, list + regenerated baseline, allowlist entry with the human-review note). No guard was weakened.

---

## 6. Day-1 smoke (§13) — what the founder observes after flipping `INTRADAY_COLLECT_ENABLED`

- `intradaySnapshots/latest`: `etDate` today; `generation` advancing once per minute during RTH; `lease: null` between sweeps; `symbols[sym].price.priceAsOf` 10–30 min behind `availableAt`; `anomalies.missing === 0` and `anomalies.unitCoerced === 0` for known-good names (the §4 shape check); `anomalies.rejected` non-zero only in the first ~15 minutes (pre-open trades); `unchangedCount` non-zero after the close; `anomalies.held` near zero.
- `intradayBudget/{etDate}.unitsRequested` ≈ 84 × |universe ∖ actionable| + 420 × |actionable| + 5 × |actionable| (seed), within the day's `anomalies.missing`.
- `intradayCalcState/{etDate}/actionable/{sym}`: `seedStatus: 'seeded'` with 60 buckets; `logJson` growing one entry per sweep; `closeLagMs` on completed buckets; one `generation` per sweep across all documents.
- No battle document touched (`INTRADAY_DIAGNOSTIC_ENABLED` still off).
- Day 2: `intradayValidation/{day1}` with `referenceCoveragePct`, `firstPublishHourUtc`, `unavailable.evaluationLinked: 'no_evaluation_evidence'`, every VWAP comparison excluded `cutoff_unconfirmed` (§15 open).
- After flipping `INTRADAY_DIAGNOSTIC_ENABLED`: the Why? panel block under its header; `intradayViews/{evalId}` with per-indicator verdicts and `presetBand`; `shadowLines` present; the sent prompt unchanged.

---

### 6a. The §4 vendor-shape checks (addendum A7, from the §2 review's probe B·6)

`eodhd.com` was egress-blocked from the build, so every Live v2 field name is ASSUMED. The review broke each assumption in turn and ran it end to end through `normalizeLiveV2 → validateObservation → applyObservation`. The two checks this report originally named — `anomalies.missing === 0` and `anomalies.unitCoerced === 0` — **pass cleanly under the three most likely field-name failures.** A renamed `volume` is the worst of them: the quote is *accepted*, VWAP is silently null, and all three of the originally named counters read clean.

Read these on the first `intradaySnapshots/latest` for a known-good liquid symbol:

| # | Observe | Catches |
|---|---|---|
| S1 | `anomalies.shapeUnexpected === 0` | the response has no `data` object |
| S2 | `anomalies.rejected === 0` **after the first 20 minutes** | `lastTradePrice` renamed; `lastTradeTime` in the wrong magnitude |
| S3 | **`anomalies.volumeInvalid === 0`** | `volume` renamed — today this is silent: accepted quote, null VWAP, every originally named check green |
| S4 | `symbols[SYM].indicators.vwap.value !== null` **and** `quality.samples ≥ 3` by mid-session | the accumulator never advancing, for any reason |
| S5 | `indicators.volumePace.status !== 'absent'` with reason ≠ `no_reference_volume`, and the value within ~0.3–3.0 | `averageVolume` renamed, or `volume` on a different scale |
| S6 | `indicators.sessionHL.value.high/low` non-null, and `price.previousClose` non-null | `high` / `low` / `open` / `previousClosePrice` renamed |
| S7 | day 2: `quoteCumulativeVolumeRatio` **between 1.7 and 2.2** | the field is A5's renamed diagnostic. ~1.97 is the *expected* reading — the denominator is the last accepted quote's cumulative volume, which omits the closing auction. A value near 1.0 or below 0.9 says the vendor's `volume` is not regular-session-cumulative, which G7 records as unconfirmed |

Two more the addendum added instrumentation for: `seedsDeferred` / `seedsDeferredForBudget` on the poll result (A1 — non-zero on the first sweep of a day is expected and healthy; persistently non-zero later means the seed loop is not keeping up), and `reason: 'publish_oversize'` with its `bytes` and `symbols` (A4 — should never appear below ~80 actionable symbols).

---

## 7. Bugs found outside scope (BUILD_RULES §3 — reported, not fixed)

1. `evalId` collision past 150 entries (item 13 above) — pre-existing, now with a second consequence (view overwrite).
2. The seed's second-session rule (item 5) is structurally inert under the maintained calendar — a contract observation, not a code bug.

---

## 8. Close

| Check | Result |
|---|---|
| Full suite (`npx vitest run`, unpiped to a log, exit code asserted) | 720 files passed / 3 skipped · 13,836 tests passed / 64 skipped · exit 0 · 130 s |
| `npm run lint:gate` | exit 0 |
| `vite build` | exit 0 (`✓ built`; pre-existing chunking warnings only) |
| Honesty suite incl. `agent-evaluate.intradayPromptDiff.honesty.test.js` | green |
| Rules suite (emulator) | 10 / 10 |
| `git diff origin/main --name-only` ∩ BUILD_RULES §1 fence list | ∅ |
| Cumulative diff | 76 files, +7,253 / −45 |

Push: `git push -u origin claude/intraday-build-1-utkb37`. No PR. STOP.

---

# Addendum — 2026-09-19 (post-review, Opus)

**Branch:** the same `claude/intraday-build-1-utkb37`, continued — not a new one. **Base at addendum start:** `458f0d0f`, clean tree. **`git fetch origin` was the first action** (BUILD_RULES §3); `origin/main` unchanged at `ceffdc78`. **Fence:** no file below is on the BUILD_RULES §1 list — verified mechanically before the first edit. **Container:** shallow clone, not unshallowed; `node_modules` was absent and installed.

**Spec:** `docs/audits/20260919_BUILD1_INTRADAY_REVIEW.md` (the contract's §2 adversarial review, on `claude/review-intraday-build-1`). Its verdict was *merge with addendum*; these are the seven addendum items plus the two findings the founder promoted from follow-up to addendum (A8, A9).

**Every commit below was verified with a full `npx vitest run` and `npm run lint:gate` on its own tree before committing** — the correction to executive row 1 is the reason that is stated rather than assumed.

## The founder ruling carried here

**A6 — the cron ceiling.** Vercel's per-project cron limit is **100 on all plans** (raised January 2026; verified by the founder's reviewer 2026-09-18). Contract G10 already recorded it. `docs/BUILD_RULES.md` §6 said "39/40 … assumed Pro ceiling … one slot remains" — a stated assumption, never a measured limit, and the one thing the review could not resolve on its own. §6 now reads 41/100 and keeps the "prefer branching inside existing handlers" preference. **No STOP on the 41-entry `vercel.json`.**

## Item → commit → files → tests

| Item | Commit | Files | Test rows added |
|---|---|---|---|
| **A6** cron ceiling (founder ruling) | `cba6f29e` | `docs/BUILD_RULES.md` | none — markdown only; verified no test reads the file |
| **A1** units before anything; bounded seed loop | `28c12f43` | `api/_utils/intraday/pollRunner.js`, `intradayStore.js`, `api/_utils/intradayConfig.js`, `pollRunner.test.js` | +5 — budget survives a post-fetch throw; one invocation is one sweep; a kill at 40 s stamps and charges only the attempted; a sweep that dies before publishing still leaves the stamp; the lease expires before the function |
| **A2** age before the cutoff-null branch | `98649f3e` | `eligibility.js`, `eligibility.test.js`, `view.test.js`, `agent-evaluate.intradayViews.test.js` | +4 — an 18-hour carried-forward fact is stale not display_only; the window is the consumer's maxAgeMs from `availableAt` (at the limit, one ms past, fresh); no cutoff and no `availableAt` is never display_only; a confirmed indicator is unaffected |
| **A3** cap `heldObservationIds` | `e2745109` | `accumulator.js`, `accumulator.test.js` | +3 — 400 distinct holds leave the array at 2 with `heldCount` 400; the cap is behaviour-preserving; rollover clears both |
| **A4** pre-flight publish refusal | `13a11b49` | `intradayStore.js`, `intradayConfig.js`, `pollRunner.js`, `intradayStore.test.js`, `intradaySizing.test.js` | +3 and a new assertion group — the refusal names bytes and symbols and opens no transaction; a publish inside the ceiling still goes through; the 10 MiB crossing is pinned at ≥ 80 |
| **A5** the coverage number | `852169af` | `validator.js`, `validationRunner.js`, `validator.test.js`, `validationRunner.test.js` | coverage row rewritten +1 — the gate is bar completeness, the ratio rides beside it; the founder's fixture at a 15:44 quote reads ~1.97, diagnostic, coverage full |
| **A8** validator window, reasons, evidence set | `5a5fd03b` | `validationRunner.js`, `api/cron/intraday-validate.js`, both test files | +7 — first invocation at 16:00 UTC records attempts 1; a second grading day gets its own window; HTTP 500 yields `transport_error` with `firstPublishHourUtc: null`; a genuine non-publication still reads `unpublished`; an orphaned view is not graded; a battle referencing nothing costs no read; an `evalId`/id mismatch is refused |
| **A9** golden pins for the three prompt readers | `5bfd048a` | `intradayPromptExclusions.test.js`, `agent-evaluate.intradayPromptDiff.honesty.test.js` | +4 — the three allowlists pinned against a maximal entry; the narrator record block pinned verbatim; `vintages.vwap` asserted rather than forced in the on/off diff |
| **A7** smoke and report corrections | this commit | `docs/audits/20260919_BUILD1_INTRADAY.md` | — |

**Mutation-checked, every one** (BUILD_RULES §2: *a row that cannot fail under the defect it names is not a guard*). Two rows failed their own mutation on the first attempt and were rewritten rather than kept:

- A1's stamp row passed under the mutation that deleted the pre-fetch stamp, because a *successful* publish writes the stamp anyway. It now kills the publish transaction first, and goes red.
- A9's whole point is the review's M4 — dropping `'vintages'` from `RECORD_ENTRY_FIELDS`, which deleted the provenance line from a sent prompt with every flag off while the full suite stayed green at 13,836 passing. It now turns **two rows red**.

A2 is worth one more line: the first implementation applied the `availableAt` bound to *every* verdict, and the existing suite caught it — the row asserting that age comes from the indicator's own cutoff, not the quote's, went red. The bound is now scoped to the null-cutoff path, that row is kept, and a positive counterpart was added.

## What this addendum did NOT change, and why

- **`calcVersion` stays 1.** §5.2 says changing `LEASE_MS` is "a founder PR that bumps `calcVersion`", and A1 changes it (90 s → 50 s). A bump would reset §10.6's qualification calendar and make every stored `calcVersion: 1` view fail `replayFromView`'s definitions check. Nothing has ever run — both live flags are still `false` — so the choice is free today and reversible. **Flagged for the founder rather than decided silently:** if the reading of §5.2 is strict, the bump is a one-line follow-up before the first collect run.
- **`heldCount` (A3) joins `lastAcceptedPrice` and `holding`** as accumulator fields §7.1's list does not name. Filed for V1.2.
- The nine contract errata, the `withTimeout` cancellation (R-2's hook side — the validator side is A8), the `evalId` monotonic counter, the §9.3 lint wiring, the seed `closeQualified` inversion, the poller's deadline reach, the qualification calendar and the remaining test-guard weaknesses are **out of scope by the founder's own list**, each with what it blocks.

## Close (addendum)

| Check | Result |
|---|---|
| Full suite, exit code asserted, unpiped | **720 files passed / 3 skipped · 13,863 tests passed / 64 skipped · exit 0** |
| `npm run lint:gate` | exit **0** |
| `vite build` | exit **0** |
| Rules suite (emulator, `npm run test:rules`) | **9 files / 211 tests, exit 0**, the `intradayViewsDenials` subcollection suite (10 rows) among them; the suite prints the rules sha256 it loaded — `625df5fd…`, unchanged from the pre-addendum tree |
| `git diff origin/main --name-only` ∩ BUILD_RULES §1 fence list | **∅** |
| Cumulative branch diff vs `origin/main` | **84 files, +8,507 / −86** (the addendum adds 8 commits on top of the build's 11) |

Push to `claude/intraday-build-1-utkb37`. **No PR — the founder opens it.**
