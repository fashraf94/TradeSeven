# Intraday Data — Build 1 — Adversarial Review

**Date:** 2026-09-19 · **Reviewer:** Fable, Claude Code — a fresh session, not the build session.
**Under review:** `claude/intraday-build-1-utkb37` @ `458f0d0f` (11 commits ahead of `origin/main` @ `ceffdc78`).
**Review branch:** `claude/review-intraday-build-1`, cut from `458f0d0f`. This report is the only change.
**Contract:** `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md` (V1.1). **Build report:** `docs/audits/20260919_BUILD1_INTRADAY.md`. **Step 0:** `docs/audits/20260919_BUILD1_STEP0.md`.

**Preamble (BUILD_RULES §3).** `git fetch origin` was the first action of this session (`origin/main` moved `398c528e..ceffdc78`; the build's base is current). The container was a shallow clone and was **not** unshallowed. `node_modules` was absent and was installed (`npm ci`) — a container change, not a repo change. Six `git archive 458f0d0f` snapshot trees were extracted under the session scratchpad, one per reviewer, `node_modules` symlinked, per the §2 reviewer-isolation rule; every mutation check ran inside its own tree and was reverted there. **No source file in the repo tree was edited.** No fenced file was read for modification; `agentEvalPromptAssembly.js`, `agentBattleService.js` and `agentVwapFloor.js` were READ only.

**Review method (BUILD_RULES §2).** Six lenses, five in isolated trees: (1) receipt-only replay + recursive reinitialisation; (2) observation classification + budget; (3) diagnostic isolation + deadline/retries; (4) prompt allowlists + Firestore rules; (5) repo guards + sizing + flags + purity; (6) coordinator — vendor shape, calendar, coverage denominator, `evalId`, §11, and independent verification of every finding below. **Every finding a lens reported was re-derived by the coordinator at its `file:line` before being recorded here**; the ones that did not survive are listed as REFUTED in Part C.

**Independent verification of the build's close claims** (run by the coordinator on a clean `458f0d0f` tree):

| Claim in the build report | Re-run here | Result |
|---|---|---|
| 720 files / 13,836 tests, exit 0 | `npx vitest run` | **720 passed / 3 skipped · 13,836 passed / 64 skipped · exit 0** ✅ matches |
| `npm run lint:gate` exit 0 | re-run | **exit 0** ✅ |
| `vite build` exit 0 (BUILD_RULES §2 mandatory) | `npx vite build` | **exit 0**, `✓ built in 25.48s`, pre-existing chunk warnings only ✅ |
| `vercel.json` 39 → 41 | `git diff` + parse | **exactly two new entries** ✅ |
| No fenced file edited | diff ∩ §1 fence list | **∅** ✅ |

---

## Executive verdict

# **MERGE WITH ADDENDUM.**

The build is honest, well-tested where it is tested, and does what §3 promises with the flags off. Nothing found here corrupts a trade, a score or a battle document. Three things must change before merge; the rest is follow-up.

| | |
|---|---|
| **Does it do what the contract says?** | Substantially yes. 22 deviations reviewed: **9 acceptable, 5 addendum, 4 follow-up, 4 contract-error**. The build report's own §5 list is accurate — I found no deviation it failed to disclose. |
| **Is the flags-off path safe?** | **Yes**, with one caveat. Every diagnostic surface is gated; `vintages` is byte-identical flag-off; the five failure modes leave the battle document byte-identical apart from the declared pointer fields (independently diffed). The caveat is R-4 below: three prompt readers were narrowed **unconditionally**, and nothing pins that the narrowing is output-neutral. |
| **Does the one intentional behaviour change (§11) hold up?** | Yes. Both call sites pass the new freshness arguments (`agent-evaluate.js:1013`, `:547-556`), so the gate cannot silently fail closed. |
| **The single biggest thing the founder must know** | **§15 is the gate on the whole programme, not a configuration detail.** With `VOLUME_CUTOFF_FIELD` and `CLOSING_ROW_POLICY` null, the day-2 validation document comes out with `symbolsQualified: 0` and the three headline §10.5 metrics all `unavailable`. That is *correct by the contract* — but the first production run will read like a failure unless it is written down first. Answering §15 needs one vendor page read from an environment with egress; it is worth more than any code in this build. |
| **Highest operational risk on day 1** | **R-1** — the poller's per-day seed burst is unbounded and sequential against a 60 s function limit, and units are charged before they are recorded. |
| **Verified independently** | Full suite 720 files / 13,836 tests exit 0; `lint:gate` 0; `vite build` 0; fence intersection ∅; `vercel.json` +2. All four claims match the build report exactly. |

---

# Part A — Adjudicating the build report's 22 deviations

Classification: **acceptable** (the contract over-specified) · **addendum** (must change before merge) · **follow-up** (its own build) · **contract-error** (the contract was wrong).

## The four the founder has already seen

### A·9 — The coverage denominator (§10.2) — **addendum**

**What the contract said.** `referenceCoveragePct = Σ(bar volume) / EOD volume`; below 90 % the symbol-session is `coverage: 'partial'` and excluded from qualification.

**What is actually divided by.** `validationRunner.js:97` — `const eodVolume = calcState.accumulators?.[sym]?.lastAcceptedVolume ?? null`. The denominator is the vendor's cumulative session `volume` **as carried on the last quote the accumulator accepted that day**, labelled `eodVolumeSource: 'live_v2_last_accepted_volume'` (`validator.js:245`). It is not an EOD volume and it is not from a close-of-day sweep: it is from whichever sweep last produced an `accepted` outcome, and on a 15-minute delayed feed that quote's `priceAsOf` is ~15 minutes before the last sweep. The numerator (`validator.js:59`) sums **every** 1-minute bar from open to close inclusive — including the 16:00 closing-auction row, which G4 records at 19.1 M for the founder's AAPL fixture.

**What the ratio reads.** Computed here against the committed fixture (`docs/audits/fixtures/AAPL_2026-09-17_1m.json`, 391 rows, Σ = 44,574,829; the 16:00 row alone is 19,122,063 = **42.9 % of the day**):

| last accepted quote | denominator | `referenceCoveragePct` | verdict |
|---|---|---|---|
| **15:44 ET (15-min delay)** | 22,627,048 | **197.0 %** | `full` |
| 15:59 ET (no delay, pre-auction) | 25,452,766 | 175.1 % | `full` |
| 16:00 ET (with auction) | 44,574,829 | 100.0 % | `full` |

**Is `partial` reachable?** Through the `pct < 90` leg (`validator.js:63`) — **no**, not while the bar series is complete, because the numerator structurally contains ~43 % of volume the denominator cannot. That leg is dead in the normal case and fires only in the *inverted* case: if the vendor's `volume` turns out not to be regular-session-cumulative (G7 records this as **unconfirmed**), the denominator inflates, every symbol drops below 90 %, and the qualification set silently empties on day 1. Through the `barsMissing > 0` leg (`validator.js:64`) — **yes**, and that is the leg doing the real work. So the guard functions; the number that names it is wrong by roughly 2×, and it is the number §10.5 publishes and §10.6's freeze would read.

**Is `closeQualified` checked or only recorded?** **Genuinely checked** — `validator.js:239` computes `closeQualifiedSeries = !closingUnresolved && cov.coverage === 'full'`, and `:242` sets `qualification.included = false, reason: 'close_unqualified'` on it; `:157-162` hard-replace `sma20P95AbsResidualOverPrice` and `macdEventAgreement` with `unavailable: 'close_unqualified'`. The V1.1 clause is honoured. But because `CLOSING_ROW_POLICY = null` (`intradayConfig.js:25`) makes `finalize()` stamp every session's last bucket `closeQualified: false` (`buckets.js:152`), `closingUnresolved` is **always true in build 1** — so *every* symbol-session is excluded from qualification, by design, until §15 is answered.

**Disposition.** Addendum, bounded: either (a) name the denominator honestly (`quoteCumulativeVolumeAtLastAccept`) and report the ratio as a diagnostic rather than a coverage gate, or (b) exclude the closing-auction row from the numerator and document that the ratio is intra-session-only. Do **not** ship a field called `referenceCoveragePct` that reads 197 % — §10.6's freeze is supposed to read it.

### A·11 — The qualification calendar and the §10.5 rollups (§10.5–10.6) — **follow-up (blocks Stage 4)**

**What the contract said.** §10.6: collection-only sessions report series metrics only; a 10-session characterisation from the first session with stored views; a freeze of the alignment policy, `policyVersion`, `calcVersion`, seven thresholds and minimum event counts (proposed 30 each); a fixed 10-session test period; the flip PR quotes the test period only.

**What was built.** Only `trailingRollup({ db, gradeDate, calendar, n: 10 })` (`validationRunner.js:109`, `:116`). No characterisation calendar, no frozen thresholds, no minimum event counts, no test-period rollup, no document holding any of it. The build report (item 11) says so plainly, and that is accurate — I could find no other artefact.

**Why this is more than a missing feature.** The freeze cannot begin, because the inputs it would freeze are structurally unavailable in build 1, and this compounds across three independent clauses:

1. `VOLUME_CUTOFF_FIELD = null` (`intradayConfig.js:21`) → `resolveCutoff()` returns `null` on its first line (`accumulator.js:225`) → every log entry's `estimateCutoff` is `null` (`sweepCalc.js:133`) → `alignLogEntries` excludes **every** entry with `cutoff_unconfirmed` at `validator.js:78`. **`comparisons` is 0 for every symbol, every session.** The headline metric §10.5 names first — P95 |comparisonResidual| / price — is `unavailable: 'no_aligned_comparisons'` on day 2 and on every day after.
2. `CLOSING_ROW_POLICY = null` → `closeQualifiedSeries` always false → `sma20P95AbsResidualOverPrice` and `macdEventAgreement` are `unavailable: 'close_unqualified'` (`validator.js:157-162`).
3. §10.6's calendar is keyed on "the first session with stored views" — which needs `INTRADAY_DIAGNOSTIC_ENABLED` on, which the founder flips only after the day-1 collect smoke.

So three of the seven §10.5 quantities cannot be produced at all until the vendor answers §15, and §15 could not be asked because `eodhd.com` was egress-blocked from the build session. What *does* work on day 2 is the price-source residual (`validator.js:74-77`, aligned on `priceAsOf`, independent of `estimateCutoff`) and the bucket-close residual — genuinely useful, and worth saying out loud because the build report does not distinguish them.

**Disposition.** Follow-up with its own build, and it blocks **Stage 4** outright and **Stage 2**'s scorecard in practice. The ordering consequence the founder needs now: **§15 is not a nice-to-have configuration item, it is the gate on the entire measurement programme.** Answering it (one vendor page read, from an environment with egress) is the highest-value next action in the whole arc — higher than any code in this build.

### A·5 — The second-session seed (§6.6) — **contract-error**

**What the contract said.** "if fewer than 35 are available, fetch one further prior session (5 more units), at most two sessions."

**What was built, and what it does.** `fetchSeedBuckets` (`pollRunner.js:183-210`) implements it literally, and `combineSeedSessions` (`seed.js:76-93`) then discards the older session's buckets in every reachable case. I traced it rather than trusting the build report:

- `contiguousTail(buckets, session, 60)` (`seed.js:61-68`) walks **backwards from the session's last key**, capped at 60. For a healthy 390-minute session (78 buckets) it returns the newest 60 — so `out[0].key` is the 19th bucket of the session, **not** `firstKey`.
- `combineSeedSessions` only prepends the older session when `newerFirst.key === newerFirstKey` (`seed.js:86`) — the newer tail must reach its own **first** bucket.
- The second fetch is triggered only when the newer tail is `< SEED_MIN_BUCKETS` (35). A tail shorter than 35 means the walk hit a gap after bucket 43-of-78 (or 7-of-42) — so it demonstrably did **not** reach `firstKey`, and `seed.js:86` breaks.
- The only way a tail is both `< 35` and reaches `firstKey` is a session with fewer than 35 buckets total, i.e. `sessionLenMin < 175`. I enumerated every maintained trading day: **`{"210": 3, "390": 499}`** — no such session exists in 2026–2027.

So the rule burns 5 units per symbol per trigger and can never contribute a bucket. The build report (item 5) reaches the same conclusion; I confirm it by construction, not by test.

**Disposition.** **contract-error**, not a build defect. The contract's own adjacency rule (§6.3, session-relative last→first) and its 60-bucket cap are mutually exclusive with its own `< 35` second-fetch rule. §6.6 should say: *fetch a second session only when the newer session's tail reaches its first bucket and is still short of the longest `warmupBars` (35)* — which under the 2026–2027 calendar means never, so the honest edit is to **strike the second-session rule** and let §6.4's per-indicator warmup handle a short seed. Keeping it as written costs units for nothing and implies a robustness the code does not have.

### A·13 — The `evalId` collision — **acceptable at HEAD; follow-up to keep it that way**

**The mechanism, at its source.** `api/cron/agent-evaluate.js:2187`:
```js
const evalId = `eval_${String((battle.evaluations?.length || 0) + 1).padStart(3, '0')}`;
```
against the cap at `api/cron/agent-evaluate.js:3104`: `const evaluations = [...(battle.evaluations || []), evaluation].slice(-150);`. Once the array saturates at 150, `length + 1` is pinned at 151 and every later entry is `eval_151`. `:3104` is the **only** append site in the repo; `agentBattleService.js:248` is the only initialiser.

**Every existing consumer that breaks at entry 151** — all independent of this build:
| Consumer | `file:line` | What breaks |
|---|---|---|
| Reflection prompt | `agentReflectionUtils.js:196-199` | `const key = e.evalId \|\| e.timestamp` — **deduplicates by `evalId`**, so every entry past 150 collapses to one. Silent history loss into the prompt. |
| Anticipation grounding ("heard" stamps) | `voiceLayerAnticipation.js:109-110` | `evaluations.find(e => e.evalId === evalId)` returns the **first** `eval_151`; the note is grounded on a stale check. |
| Fenced prompt render | `agentEvalPromptAssembly.js:1400` | renders `${ev.evalId}` — the agent reads "eval_151" for every recent check. |
| Tape / Why? selection | `buildTape.js:108`, `:194`, `:265-266` | first-wins feed join; duplicate React keys; `tradedEvalIds.has()` marks every later tick as traded. |
| Directive receipts | `agent-evaluate.js:2485`, `:2767` → `AgentChat.jsx:1221` | `byEvalId.get()` joins the wrong trade to the wrong entry. |
| List keys | `GameTapeView.jsx:34`, `StatusFeedTimeline.jsx:310`, `Flat6BattleView.jsx:226`, `PaneTape.jsx:64`, `LiveActivityPanel.jsx:93`, `AgentActivityFeed.jsx:69` | duplicate React keys → reconciliation updates the wrong rows. |
| **New in this build** | `evaluatorHook.js:49` | set-merge onto `intradayViews/eval_151` — every later tick overwrites the same document, and `useIntradayView.js:26,35` cannot detect it (both guards compare `eval_151` to `eval_151` and pass). |

**Can any battle exceed 150?** **No, at HEAD — and the build report does not say why.** `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`api/_utils/agentBattleService.js:35`) makes `tradingDays = [oneDay]` (`:117-121`), so each battle document is a single-day doc; G2 fixes the session at **26** evaluating ticks. Even the dormant legacy branch caps at `'5d'` (`computeTradingDays`, `dayCount = duration === '1d' ? 1 : duration === '5d' ? 5 : 3`) → 5 × 26 = **130 < 150**. No configuration the repo has ever shipped can reach 151. I cannot query Firestore from this session, but this is stronger than a data check: it is unreachable by construction. Note also that an in-code comment at `agent-evaluate.js:2265-2268` records that a **previous review already refuted** this exact concern on the same grounds — a fact the build report omits.

**Disposition.** **acceptable** for merging this build — the new consequence is real but unreachable. **follow-up**, because the guard is now load-bearing in a new place: the only thing standing between today and a silently-overwritten diagnostic record is one hard-coded constant in a **§1-fenced file**. The smallest fix is not to touch the fence: derive the id from a persisted monotonic counter instead of array length — read `battle.cronState?.evalSeq`, use `(evalSeq || evaluations.length) + 1`, and write `evalSeq` back in the same `finalUpdate` that already writes `evaluations`. One field, one line, no fence contact, and it makes every consumer above correct for good.

## The other eighteen

| # | Clause | Contract said | Built | Class |
|---|---|---|---|---|
| 1 | §5.1 | import `getSessionForDate(etDate)` from `marketSchedule.js` | Added to the canonical `api/_utils/marketSchedule.js:177` + `getPreviousSessionDate:211`. Verified **purely additive** — one hunk, zero deletions, no existing export touched, no name collision; all 45+ importers unaffected. Probed across every maintained day: `{"210": 3, "390": 499}` minutes, DST correct both sides, holidays excluded, hard `null` outside 2026–27. | **acceptable** |
| 2 | §4 | Live v2 field names | ASSUMED — `eodhd.com` egress-blocked (Step 0 §4). Parser hedges well but the day-1 smoke named in the report catches only 2 of ~8 failure modes. See Probe B·6. | **addendum** |
| 3 | precond. 4 | fixture at `docs/audits/fixtures/AAPL_2026-09-17_1m.json` | Materialised from the founder's markdown-escaped upload; 391 rows / span / Σ-volume asserted (`seed.test.js:16`). Re-parsed here: 391 rows, Σ = 44,574,829. | **acceptable** |
| 4 | §3 | "Booleans pin in `flagPinGuard.test.js`" | The guard holds no pins — it *scans* test files (`flagPinGuard.test.js:214`). Pins live in `src/config/intradayFlags.test.js`, which the guard scans. Same effect; the contract described the mechanism wrongly. | **contract-error** |
| 6 | §6.6 | `seedStatus: 'corporate_action'` (outcome named, detector not) | > 40 % close-to-close jump (`pollRunner.js:35`, `:115`). Reasonable. Note it lives in `pollRunner.js`, **not** `intradayConfig.js`, so §5.2's "changing any of these bumps `calcVersion`" does not cover it. | **acceptable** (move the constant into `intradayConfig.js` when convenient) |
| 7 | §6.2 | deadline marks the **last** bucket | Marks **every** open bucket of the session (`buckets.js:238-242`) and creates the last one if it never opened (`:247`). At most one bucket is ever open (a bucket finalises when a higher key arrives), so this is a harmless generalisation. Idempotent. | **acceptable** |
| 8 | §8.2 | `collectionStalled` (fact named, threshold not) | `COLLECTION_STALL_MS = 5 min` (`intradayConfig.js:43`) against a 1-minute poller — tolerates 5 consecutive failed sweeps. Sound. But it measures *is the poller alive*, not *is this symbol's fact fresh* — see R-3. | **acceptable** |
| 10 | §10.4 | SMA20 residual, MACD event agreement | Computed over contiguous completed buckets on both sides, seed excluded from the reference, unqualified series excluded. Correct — and unreachable in build 1 (A·9). | **acceptable** |
| 12 | §9.1 | "Tape and narrator use the same table" | Neither renders a diagnostic in build 1. The binding is enforced by a repo-wide phrase scan (`intradayDiagnosticCopy.test.js:75`) so no second table can appear. The copy module is zero-import and reads value and verdict from **one** object — BUILD_RULES §9 satisfied by construction. | **acceptable** |
| 14 | §7.3 | generation-pointer design only if the ceiling is below 30 | 30 actionable = 4.07 MB; 255 = 32.5 MB. Not below 30, so not built — correct. But the crossing is at **~81 symbols** and there is **no pre-flight refusal**. See Probe B·11. | **acceptable** (the decision point is the addendum) |
| 15 | BUILD_RULES §6 | "39/40 used … one slot remains" | 39 → **41** (`vercel.json`, exactly two new entries, verified). Justified by contract G10 ("100 cron jobs/project"). **These cannot both be right**, and BUILD_RULES §6 calls its own 40 an *assumed Pro ceiling*. Must be settled before merge — if 40 is the real ceiling the deployment is rejected. | **addendum** |
| 16 | §5.5 | pre-open quotes rejected | True and disclosed. The consequence was not costed: on a 15-minute delayed feed **every symbol is rejected or prior-session for the first ~15 minutes of every session**, and the one fixture that could have shown it clamps it away on purpose (`intradayPollHarness.js:53-54`). Chains into R-3. | **addendum** |
| 17 | §13 | smoke | Crons do not run on preview (BUILD_RULES §6); day-1 observations listed. Correct, and the list needs widening (B·6). | **acceptable** |
| 18 | §12 | rules suite | Outside the default suite by repo design; **re-run here on the live emulator: 10/10, 211 tests, exit 0**. Claim verified, not taken on trust. | **acceptable** |
| 19 | §8.4 | vintages additions | Gated: `composeVintages` returns the untouched five-key `base` unless an `intraday` object is handed in (`tickStamps.js:266-281`), and it is handed in only when a view was written. Flag-off byte-identity independently diffed. | **acceptable** |
| 20 | §10.1 | validator view lookup | Single-field range queries, no composite, no collection-group exemption (G9 respected) — and **unbounded**: `listViewsForSession` loads every view of every active-or-recently-completed battle, one sequential subcollection query per battle, on **every** invocation, before the ≤20-symbol slice. See R-5. | **addendum** |
| 21 | §3 | two stage gates `DARK_BY_DESIGN` | Verified: all five flags present and off/`'legacy'` (`featureFlags.js:2586,2604,2615,2627,2641`). The two live flags gate every named consumer. The three dark flags have **no importer at all** — `INTRADAY_RISK_ACTIVATION_ENABLED` has zero hits outside its definition; `INTRADAY_AGENT_USE_ENABLED` and `INTRADAY_PRICE_SOURCE` appear only in comments. §9.3's lint receives neither the view nor the flag (`agent-evaluate.js:2219-2225`), so the five 5-minute names are dark by construction. | **acceptable** |
| 22 | — | four repo guards reconciled | See Probe B·10. | — |

---

# Part B — Probes: what happened, not what the code intends

## B·1 — Receipt-only replay (§8.2) — **the claim is true; the test that proves it cannot fail**

With `intradaySnapshots/latest`, `intradayCalcState/{etDate}` and the actionable documents all deleted, the stored view plus `intradayDefinitions/v1` **is** sufficient: every field `evaluateIntraday`, `strikeFromView` and `renderIntradayDiagnosticLines` read is on the receipt, including `quality.closeQualified` and `evaluatedAt`. Verdicts are **frozen at write time** (`view.js:94`, `nowMs: evaluatedAt`) and `replayFromView` defaults its clock to the stored `evaluatedAt` (`view.js:144`) — so the clock is on the receipt and replay needs no live one. Measured `Date.now()` calls during a full reconstruction: **0**.

Three findings against the *guard*, not the code:

1. **`view.test.js:85` is theatre.** `replayFromView(view, definitions, opts)` (`view.js:141`) takes **no `db` handle** — verified by reading its signature. Deleting the snapshot cannot change its result, so the deletion the test performs can never fail it. Seven mutations were applied in an isolated tree; **six survived**, including dropping `as of <cutoff>` from the eligible line, rebinding that timestamp to `price.priceAsOf` (a parallel source — precisely the BUILD_RULES §9 bug family), and making `strikeFromView` never report a strike.
2. **The fixture never reaches `eligible`.** 46 sweeps = 9 completed buckets, so all three bucket indicators are `ineligible/warmup` and the estimate is `display_only`. The entire eligible branch of the copy table (`intradayDiagnosticCopy.js:101-108`) is unexercised.
3. **The strike assertion compares `false === false`.** `view.test.js:102` asserts `isVwapStrike === (estDev < -0.7)`; on its own fixture AAPL is `+0.300` and MSFT `−0.696` — both `false`. MSFT sits 0.004 pp from the band and still never exercises the true branch.
4. **Two renderings, one receipt.** `replayFromView` passes **recomputed** verdicts to the renderer (`view.js:151`); the client passes **none**, so it renders the **frozen** ones (`battleViewCopy.js:614` → `intradayDiagnosticCopy.js:95`). At `evaluatedAt + 46 min` the same view yields `5m SMA20 100.08 · completed bars · as of 16:50` (client) and `5m SMA20 unavailable · too old at the check` (replay). `replayFromView` has **no production caller** — so §8.2's claim is proven through a path nothing ships, and the shipped path is never compared against it.

## B·2 — Unchanged observations (§5.5) — **CLEAN, every assertion held**

30 post-close sweeps of an identical quote with advancing `snapshotTs`, through the real `runSweepCalc`: all eight anomaly counters **0**, `unchangedCount` **30**, accumulator byte-identical across all 30 (in fact the same object reference — `accumulator.js:178` returns `acc: cur`), **one** `strikeKey` (`a45724e694334015`), **30** distinct `observationId`s. The `strikeKey`/`observationId` split behaves exactly as §5.5 specifies.

Hold → resume: exactly **one** `held`, gap assigned exactly **once** (`den` 1000 → 1400, `num` 100000 → 140800 = 102 × 400, `samples` 1 → 2). The held observation correctly did not advance `lastAcceptedVolume`, so the resume delta is measured from the pre-regression volume — not zero, not double.

Degraded boundary: distinct `priceAsOf` → degraded on the 2nd; distinct `snapshotTs` only → degraded; **truly identical observation twice → not degraded**. Matches §5.5's "two *distinct* held observations" precisely.

Overnight reset: validate → rollover → classify (`accumulator.js:125-139`). A new ET date with 99.76 % lower volume produced `outcome: accepted`, `anomaly: null`, `rollover: true`, fresh accumulator, **zero anomalies**. The ordering bug this clause exists to prevent is not present. ET derivation is correct across the 2026-11-01 DST boundary in both directions, and no US session crosses a transition.

*One note for the ledger:* in production the `rollover` branch is **unreachable** — `intradayCalcState` is sharded per ET date (`pollRunner.js:188` loads `{today}`), so a stored accumulator's `sessionEtDate` always equals its document's date. The §5.5 requirement is met by the sharding, not the branch; `counters.rollover` will read 0 forever.

## B·3 — Recursive reinitialisation (§6.4–6.7) — **the arithmetic is exactly right; one guard is weak; one consequence inverts**

**(a) 100 buckets, 3-bucket gap at 50 — exact.** Post-gap step state vs a batch computation over buckets 53–99 alone, using the repo's own `calculateRSI`/`calculateSMA`/`calculateMACD`: **all five deltas exactly 0** at the batch functions' rounding. Re-run with a wildly different pre-gap history (closes 500–590 vs ~100) and compared **full internal state** (`toEqual` on the whole `sma20`/`rsi`/`macd` objects, not `value()`): byte-identical. **Zero pre-gap influence.**

**(b) Bucket 70 unqualified — exact.** SMA clears at **+20 exactly** (not 19, not 21); MACD/RSI never clear by elapsed bars at +21/+35/+40. Mutation (make MACD clear at `qualifiedRun ≥ 35`) **is caught** by `buckets.test.js:183`. This guard is real.

**(c) The late-seed parity test is weaker than claimed.** `buckets.test.js:236-238` compares `stepMacd.value()`, `stepWilderRsi.value()`, `stepSma.value()` — **latest values only**. It does exercise 108 bars (`segmentLen: 108` at `:241`), so ">60 bars" is true, but it never compares `fast`/`slow`/`signal` EMAs, Wilder `avgGain`/`avgLoss`, or the SMA window. Two states were constructed that agree on the latest value and diverge one bar later — RSI `avgGain/avgLoss` of `0.2/0.1` vs `0.8/0.4` both report **66.667**, then **70.455** vs **67.702**; SMA window `[99,101,…]` vs `[100×20]` both report **100**, then **100.05** vs **100**. The code is correct (a real late-seed rebuild was run and matched an always-seeded reference at *full* state); the guard is not. It also pre-seeds its "incremental" side (`:230-232`), so the late-seed **order** §6.6 names is never the thing under test.

**(d) Warmup semantics — CLEAN.** `WARMUP_BARS = { rsi5m: 15, sma20_5m: 20, macd5m: 35 }` matches §6.4. `warmupMet` is `segmentLen >= warmup`, not `completedBars` — after 60 completed bars then a gap, all three read `warmupMet: false` with `completedBars: 61, segmentLen: 1`. "Longest contiguous completed segment ending at the current bucket" is what is implemented; `incomplete`/deadline buckets break contiguity.

**(e) The inversion — better data, worse flag.** `seed.js:46` marks the seeded session's last bucket `closeQualified: false` (because `CLOSING_ROW_POLICY` is null), and `contiguousTail` **always ends at that bucket** by construction. `buckets.js:130`/`:140` then AND the flag to `false`, and it only resets through the `init` path, which needs a contiguity break — but today's 09:30 bucket **is** adjacent to yesterday's close (`buckets.js:87`). Measured over a full simulated day through the real seed pipeline:

| | segmentLen | sma | macd | rsi |
|---|---|---|---|---|
| **seeded** symbol, +389 min | 137 | true | **false** | **false** |
| **unseeded** symbol (seed failed), +389 min | 77 | true | **true** | **true** |

At §8.3, the seeded symbol's stage-4 verdicts are `close_unqualified` while the unseeded one's are `eligible`. Each clause is individually contract-conformant; the combination is a consequence the contract does not name. **Inert today** (stage 4 unbuilt, `providedToDecision: false`) and live the day stage 4 lands.

## B·4 — Diagnostic isolation (§8.1) — **battle-document isolation CLEAN; the 2 s bound is not a bound**

All five failure modes were forced and the **whole recorded `finalUpdate`** (evaluations array, `statusFeed`, `scoreUpdate`, every `cronState.*` key) was recursively diffed against a diagnostics-off run in the same process:

| mode | status | non-declared diffs |
|---|---|---|
| snapshot read throws | `read_failed` | **0** |
| snapshot read hangs > 2 s | `read_failed` | **0** |
| snapshot malformed | `snapshot_invalid` | **0** |
| view write throws | `write_failed` | **0** |
| view write hangs > 2 s | `write_failed` | **0** |

In every mode the only differing paths are the declared pointer fields, `intradayViewRef` is `null`, and `vintages` stays the five pre-existing keys. `decisionStartedAt`/`decisionCompletedAt` are assigned only inside `if (INTRADAY_DIAGNOSTIC_ENABLED)` (`agent-evaluate.js:2932-2974`), so flags-off is byte-identical — pinned at `agent-evaluate.intradayViews.flagOff.test.js:79-80,:83`. **The §8.1 isolation guarantee holds.**

**But "bounded to 2 s" is false.** `withTimeout` (`evaluatorHook.js:20-24`) is `Promise.race([promise, timeout])` with **no `AbortController` and no cancellation** — verified by reading it. The losing write is abandoned, keeps running, and lands afterwards: measured `storedViews: 0` at tick end, `storedViews: 1, lateWrites: 1` 1.2 s after the handler returned. So the entry records `write_failed` / `intradayViewRef: null` **while the document exists**. The client is protected (`useIntradayView.js:26` requires `viewRef === evalId`, and `viewRef` is null), but `listViewsForSession` selects views by an `evaluatedAt` range and never consults `intradayViewRef` — so **a view the entry explicitly disowns is still graded** in §10.4. There is no test for a hanging write; `agent-evaluate.intradayViews.test.js:208-214` covers throws only.

**Budget:** the hook costs `2(N+1)` s worst case for N battles (one invocation-level snapshot read plus one view write per battle). At N = 20 that is 42 s of a 290 s budget. It cannot by itself push the loop past `TIME_BUDGET_MS` (the gate at `:368` is a pre-battle check) and the worst admitted battle still lands inside 300 s — but `HAIKU_POST_CALL_ALLOWANCE_MS = 12_000` (`agentEvalTransport.js:36`) itemises post-call work that does **not** include the new 2 s write, so the declared margin is now 8 s, not 10, and was never re-derived.

## B·5 — Deadline and retries (§6.2, §10.1) — **one contract claim is false; two window bugs**

**Missed deadline, recovered:** the same-day close+30 invocation applies it (`marked: 4`); with that invocation skipped, the **next day's pre-open** invocation applies it (`marked: 4`), and so does the **validator** (`runValidation → deadline: {applied: true, marked: 4}`). The two prescribed recovery paths work.

**But §6.2's "runs at the start of every poller invocation … so a late or missing invocation cannot skip it" is false.** The *placement* is before the session guard (§5.1 satisfied), but the *target set* (`pollRunner.js:149-155`) is only (a) today after close+30 and (b) the immediately-previous session, and (b) only while `now < open` or today is not a trading day. Measured: mid-session invocations return `deadline: []`. So ~390 of ~540 daily invocations do zero deadline work, and **a session more than one session back can never be repaired by the poller at all**. Unrecoverable shape: Thursday's close+30 invocations lost, Friday's poller starts mid-session, Friday's validator does not run → Thursday's last bucket stays `status: 'open'` forever, so neither §6.2's "state does not advance" nor §6.7's `closeQualified: false` ever applies.

**Six hours unpublished — CLEAN and exactly as specified:** `pending → in_progress ×12 → window_closed`, one 5-unit probe per invocation, all symbols listed, `already_window_closed` thereafter, nothing relying on platform retry. `*/30 10-16 * * 2-6` gives 14 slots: 12 working, 1 closer, 1 dead.

**Published at attempt 3 — CLEAN:** `firstPublishHourUtc = 11` recorded on the succeeding attempt, progress persisted across bounded invocations, `done` at attempt 4.

**Day-of-week off-by-one — none.** A full walk of the maintained calendar: 502 trading sessions, **501 reachable as a `gradeDate`** (the one gap is a scan-window artefact at 2027-12-31, graded 2028-01-01). Monday's session is graded Tuesday; Friday's is graded Saturday; `getPreviousSessionDate` agrees. **No session is silently dropped.** Poller coverage likewise: **0** of 502 sessions have their close+30 outside `* 13-21 * * 1-5`, in either DST regime and on every early close.

Two real window bugs, both probed:
- **`windowClosesAt` is stamped once, from the first invocation's wall clock** (`validationRunner.js:62`) and checked **before any fetch** (`:72`). If the twelve earlier slots are dropped (Vercel gives no retry — G10), the state is *created* at 16:00 and immediately closed: `attempts: 0`, **zero vendor requests**, four symbols written off as `unpublished` — while the bars were available. Nineteen sessions per the calendar scan have **two** grading UTC days (the session before a holiday Monday); on the second day the stale `windowClosesAt` closes the session at the first slot with twelve usable slots remaining.
- **A transport failure is reported as `'unpublished'`.** `validationRunner.js:93-95` collapses "HTTP 500 / 401 / timeout" and "the vendor has not published" into one flag; `bars.status` and `bars.error` are discarded. Probed with bars present and every request returning HTTP 500: `status: window_closed`, `firstPublishHourUtc: null`, all four symbols `reason: 'unpublished'`, 60 units burned. §10.5 requires the `unavailable` reasons and §10.6 depends on them — an expired API key would be recorded as vendor latency.

## B·6 — The assumed vendor shape (Step 0 drift 3) — **the highest-risk item, and the named smoke catches 2 of 8**

`eodhd.com` was blocked from the build, so `observation.js:82-120` is written against the contract's field list verbatim. What the parser actually assumes:

| Assumption | How it is read | Hedging present |
|---|---|---|
| `data` is an **object keyed by symbol** | `json.data` must be a truthy object (`:85`); `pickQuote` (`:66-73`) tries `req.vendor`, `req.sym` and both uppercased | two key forms tried; **the symbol field inside the quote is never read** |
| price is `lastTradePrice` | `num(q.lastTradePrice)` (`:102`) | none |
| `lastTradeTime` is **ms** | `toMs` (`:33-38`) coerces anything `< 1e11` from seconds and **counts it** | magnitude-based — robust in both directions |
| `timestamp` is **seconds** | same `toMs`, coercion deliberately **not** counted (`:96-99`) | correct either way |
| `volume`, `averageVolume`, `high/low/open`, `previousClosePrice` | `num(q.<name>)` (`:106-114`) | none |

Every assumption was broken in turn and run end-to-end through `normalizeLiveV2 → validateObservation → applyObservation`. What **actually happened**:

| Broken assumption | Observed outcome | Day-1 signal |
|---|---|---|
| `data` is an **array** | `missing = 1`, **`shapeUnexpected = 0`** — silently indistinguishable from "vendor omitted the symbol" | `anomalies.missing` |
| `data` keyed lowercase | same — `missing = 1`, `shapeUnexpected = 0` | `anomalies.missing` |
| no `data` wrapper / bare array | `shapeUnexpected = 1` ✅ | `anomalies.shapeUnexpected` |
| price field is `close` / `last` | **`missing = 0`, `unitCoerced = 0`** → `outcome: rejected`, `reason: price_invalid`, VWAP null | `anomalies.rejected` — **the report's named check passes** |
| `lastTradeTime` in **seconds** | coerced ×1000 and counted; `accepted`, VWAP 232.00 ✅ | `anomalies.unitCoerced` |
| `lastTradeTime` in **microseconds** | `rejected`, `price_as_of_future` ✅ | `anomalies.rejected` |
| **`volume` field renamed** | `outcome: accepted`, `anomaly: volumeInvalid`, **VWAP NULL, samples 0** — the build's whole purpose dead while `missing`, `unitCoerced` and `rejected` all read clean | `anomalies.volumeInvalid` — **not in the report's list** |
| `averageVolume` renamed | `accepted`, VWAP fine, `volumePace` absent `no_reference_volume` | `volumePace.status` — **not in the list** |
| `high`/`low` absent | `accepted`, VWAP fine, `sessionHL` absent | `sessionHL.status` — **not in the list** |
| `volume` scaled ×1000 | `accepted`, **VWAP unchanged at 232.00** (the estimate is scale-invariant — `num` and `den` scale together); only `volumePace` reads 928.57 instead of 0.93 | `volumePace` magnitude |

The parser is genuinely well-hedged on the two things the contract flagged as uncertain (unit ambiguity is handled by magnitude and counted; a missing `data` object never throws). The gap is **observability, not robustness**: the build report's §6 names `anomalies.missing === 0` and `anomalies.unitCoerced === 0` as *the* §4 shape check, and those two pass cleanly under the three most likely field-name failures. The smoke additions are in Part C.

One more, feeding B·8: if the vendor's `volume` is not regular-session-cumulative (G7 explicitly unconfirmed), nothing above fires — the damage lands silently in the §10.2 denominator.

## B·7 — The calendar addition (Step 0 drift 2) — **CLEAN, no blast radius**

**Which copy:** `api/_utils/marketSchedule.js`, the canonical one (its own header names it the single holiday source). **Who else imports it:** 45+ modules across `api/` and `src/` — but the change is **one hunk, 95 added lines, zero deletions**, adding two exports and one module-private helper. No existing function was touched; no identifier collides. **No existing caller's behaviour changed.**

**Early-close agreement:** `getSessionForDate` reads the same `NYSE_EARLY_CLOSE_*` tables and the same `EARLY_CLOSE_HOUR/MIN` constants that `isMarketOpen` (`:265-271`) already uses, so the poller's session and the evaluator's market guard agree on early-close days by construction. The eight sibling holiday copies (of which `marketHolidayCheck.js`, `wireCalendar.js`, `compute-daily-baggerbomb-levels.js`, `process-draft-claims.js`, `snake-draft-daily-scores.js`, `earnings-historical-range.js`, `battleTimingV4.js`, `marketHolidays.js` are early-close-blind) are **not consulted** — correct, and §16 already files their consolidation.

Probed across the whole maintained horizon: 502 trading days, session lengths `{"210": 3, "390": 499}` and nothing else; 09:30/16:00 and 09:30/13:00 render correctly in both EDT and EST; holidays and weekends return `isTradingDay: false`; `2028-01-03` and `2025-12-31` return `null` → `calendar_missing`. One edge worth knowing: `getPreviousSessionDate('2026-01-02')` is `null` (the walk leaves the maintained horizon), so the first session of a maintained year cannot be seeded — harmless now, and the same shape will recur at 2028-01-03 when the horizon is extended.

## B·8 — The coverage denominator — see **A·9**

Answered in full there. In one line: the divisor is `lastAcceptedVolume` from whichever sweep last accepted a quote (`validationRunner.js:97`); at 15:44 with a 15-minute delay the ratio reads **197.0 %**; `coverage: 'partial'` is reachable only through the `barsMissing` leg, never the `pct < 90` leg while the bar series is complete; and `closeQualified` is genuinely **checked** (`validator.js:239`, `:242`, `:157-162`), not merely recorded — but is always false in build 1.

## B·9 — `evalId` collision — see **A·13**

Mechanism at source: `api/cron/agent-evaluate.js:2187` against the cap at `:3104`. Seven consumer families break at entry 151 (table in A·13). **Unreachable at HEAD**: `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`agentBattleService.js:35`) makes every battle a single-day document at ~26 ticks; even the dormant legacy branch caps at 5 days = 130 < 150. Not knowable from Firestore in this session, but stronger than a data check — unreachable by construction under every configuration the repo has shipped. Smallest fix: a persisted monotonic `evalSeq` on `cronState` instead of `evaluations.length`, written in the `finalUpdate` that already writes `evaluations` — one field, no fence contact.

## B·10 — The four repo guards — **all four legitimate; one strengthened; zero weakened**

| Guard | What it guards | Its own prescription | The change | Verdict |
|---|---|---|---|---|
| `api/agent/research.dark.test.js` | that arc adds no cron | row title *"adds NO cron entry"*; the subject assertion is the `/research/i` path check — the count is scaffolding | `toHaveLength(39)` → `(41)`; **the `/research/i` assertion untouched** | **legitimate** |
| `api/cron/compute-index-intelligence.axes.test.js` | *"does not add a cron entry or touch the schedule (spec §5)"* | same | `.toBe(39)` → `.toBe(41)` **plus two new assertions naming both new paths** (`:120-121`) | **legitimate — strengthened** |
| `src/theme/tokens.guard.test.js` + baseline | raw core-palette hexes in guarded files (BUILD_RULES §10) | *"add each to GUARDED_FILES and regenerate the baseline IN THE SAME COMMIT"* | one file added; baseline gains `"useIntradayView.js": {}` — `{}` is the strictest possible entry | **legitimate** |
| `src/theme/motion.guard.test.js` + baseline | raw `transition={{` literals (BUILD_RULES §11) | same | one file added at **count 0** | **legitimate** |
| `api/_utils/compositionProtectedStoresAllowlist.json` | deny-by-default on protected-store writes | *"a human must review the writer and add its key … in the same PR"* | seven keys at pinned counts + a `_notes_intraday_build1` human-review block | **legitimate** |

I specifically hunted the failure mode where a regenerated baseline silently absorbs unrelated violations, because `motionGuardBaseline.json` shows **74 changed lines**. Parsed both revisions and compared entry by entry:

```
entries before: 35   after: 36
ADDED   : src/screens/battleView/useIntradayView.js = 0
REMOVED : (none)
COUNT CHANGES on pre-existing entries: 0
```

**The hypothesis is REFUTED.** The 74 lines are 36 `authority` prose strings whose `—` (U+2014) and `§` (U+00A7) were re-encoded as `—` / `§` — semantically identical after `JSON.parse`. Same result for the token baseline (38 → 39 entries, 1 added, 0 removed, 0 semantic changes), and re-running its prescribed regen reproduces the committed file byte-for-byte. Every one of the four was mutation-checked in an isolated tree and went red under the defect it names, with actionable `file:line`.

Two process notes, both minor: the motion baseline was **not** produced by its own prescribed regen command (`JSON.stringify` does not escape non-ASCII), so the next person who follows the remedy text literally lands a 72-line unrelated diff reverting the escapes; and the reconciliations landed in `87be90a1`/`ab490626` rather than in the commits that broke them, against both guards' "IN THE SAME COMMIT" wording.

**One claim in the build report does not hold.** Executive row 1 says the nine commits were *"each with the suite green at the time of the commit"*, while §5 item 22 says *"four standing guards red on the first full run."* Verified read-only: at `7055695d` and `fe02bdbe`, `vercel.json` carries 41 crons while `compute-index-intelligence.axes.test.js` still pins **39**; at `87be90a1` the theme guards' "every `battleView/` file is listed" row is still unsatisfied. **At least three of the nine commits do not build green.** The final tree is green — which is what merges — but the row should be corrected.

## B·11 — Sizing — **the crossing is 81 symbols, and nothing refuses**

**(a) Why 125,827 B.** First, a correction to the premise: **there is no ~35 KB estimate.** Neither the contract nor the build report states one; §7.3 names only what to measure and the 1 MiB / 10 MiB ceilings. Instrumented breakdown of the largest actionable document:

| field | bytes | share |
|---|---:|---:|
| `logJson` (420 entries) | **107,328** | **85.3 %** |
| `ringJson` (60 buckets) | 16,751 | 13.3 % |
| `stateJson` | 1,624 | 1.3 % |
| everything else | 117 | 0.1 % |

No single key dominates the log — eleven roughly equal keys paid 420 times, because §7.2 stores the log as a JSON *string*. The real driver is **constant-valued repetition**: `calcVersion: 1` (6,300 B for one constant), `experimental: true` (7,980 B), and `estimateCutoff: null` + `volumeCutoffAsOf: null` (**18,480 B of nulls** while §15 is open). Those four are 39,060 B = 31 % of the document for zero information.

**(b) Logged but never read.** `alignLogEntries` (`validator.js:68-90`) is the log's only reader. Of the eleven keys it reads four (`priceAsOf`, `price`, `estimate`, `estimateCutoff`), copies two through without reading them (`sweepAt`, `strikeKey` — the strike replay keys off the *view's* `strikeKey` at `:187`, not the log's), and never touches five (`snapshotTs`, `experimental`, `volumeCutoffAsOf`, `calcVersion`, `generation`). Strictly untouched: **41,472 B = 33 %** of the document; including the copied-but-unread: **63,732 B = 50.6 %**. No key is a defect — all eleven are §7.1-mandated and pinned in order at `pollRunner.test.js:78` — but the contract is buying half its largest document as provenance nothing currently reads.

**(c) The 10 MiB crossing.** Fitting the two measured points properly (the relationship has a fixed component, so a naive divide is wrong by ~1.6 symbols):

```
m = (32,467,806 − 4,071,540) / (255 − 30) = 126,205.6 B per actionable symbol
b = 4,071,540 − 30m                       =   285,371 B fixed
A* = (10,485,760 − 285,371) / m           =      80.8
```

The per-symbol slope (126,206 B) matches the independently measured single actionable document (125,827 B) and the intercept matches snapshot + universe calc-state (250,649 + 47,575 = 298,224) — so the model is validated, not assumed. An exact additive model reproducing both measurements to **0 bytes** puts the last safe count at **80** and the first over-limit count at **81** (10,512,866 B = 100.26 %).

**The founder must have decided the generation-pointer question by 81 actionable symbols** — roughly 7 concurrent battles at held ∪ bench. The contract's own trigger (§7.3: *"only if the transaction ceiling is below 30"*) is mis-calibrated by ~2.7×, so "not built" is defensible as written while the operational decision point is nearly three times higher than the clause implies.

**(d) Does the sizing guard refuse? NO.** `firestoreDocBytes` (`intradayStore.js:204`) is exported and consumed **only by `intradaySizing.test.js`** — verified by enumerating its callers. `publishSweep` (`intradayStore.js:154-172`) checks the lease and goes straight to `tx.set`; there is no size constant anywhere in `intradayConfig.js`. A constructed oversized publish was **attempted**, not refused: `bytes staged = 12,005,940 (11.45 MiB)`, `publishSweep → THREW: Transaction too big.` See R-6 for why this stalls permanently.

**(e) The §3 table is stale.** Re-run at HEAD: snapshot **252,689** (report: 250,649), actionable doc **125,832** (125,827), publish@30 **4,073,730** (4,071,540), publish@255 **32,471,121** (32,467,806). Four of five rows drifted because the table was measured at `5c6e9c55` and two later commits changed the shapes (`facts.js:108-114` added a `cutoff` to `volumePace`, +8 B × 255; `intradayStore.js:45-57` added `seed`, +5 B per actionable doc). The report calls the rows *"standing assertions"*; the test asserts only the ceilings, so nothing pinned them.

## B·12 — Allowlists and the sent prompt (§9.2) — **no whitelisted real field; the guard is genuine**

All three non-fenced readers use the same **positive-pick** shape (an explicit frozen key list plus `for (const k of FIELDS) if (k in entry) out[k] = entry[k]`) — **none is a denylist**, so none fails open on a new field:

- `voiceLayerGrounding.js:357-368` — `RECORD_ENTRY_FIELDS` (19 keys), applied at `:371`
- `voiceLayerAnticipation.js:61-67` — `ANTICIPATION_ENTRY_FIELDS = ['evalId','timestamp']`, applied at `:112`
- `agentReflectionUtils.js:161-168` — `REFLECTION_EVALUATION_FIELDS` (6 keys), applied at `:171`

**All eight pointer fields are absent from all three.** Confirmed.

**The fenced assembler is untouched:** `git diff origin/main..458f0d0f --stat -- api/_utils/agentEvalPromptAssembly.js` → no output. A mechanical intersection of the BUILD_RULES §1 eleven-file fence list against all 83 changed files is **empty**.

**The on/off prompt diff has no allowed-difference list at all.** `agent-evaluate.intradayPromptDiff.honesty.test.js:181` is raw `expect(JSON.stringify(requestOn)).toBe(JSON.stringify(requestOff))` under `vi.useFakeTimers` + a frozen system time and a mocked model — nondeterminism is removed by construction rather than whitelisted. So the question "did a real field get whitelisted to make the test pass?" has a clean answer: **there is no whitelist to hide one in.** The only normalisation list in the file applies to the persisted *entry*, and every item in it is a field the contract **mandates** (the eight §8.1 pointers, the two §8.4 vintages keys), each pinned exactly elsewhere (`agent-evaluate.intradayViews.test.js:181-188`). One item is weaker than it should be: `c.vintages.vwap` is **forced** to `'tick'` rather than asserted; a mutation smuggling a diagnostic string through that field leaves this test green (it is caught by the sibling suite).

**Mutation-checked:** leaking a real intraday VWAP estimate into the `liveContextBlock` actually sent to the model turns the test **RED** at `:181`. It is a genuine guard.

One residual: `'vintages'` is admitted **wholesale** by the narrator allowlist, and this build writes two pointer values *inside* that object (`tickStamps.js:275-281`). They never render only because `provenanceLine` (`src/data/decisionRecord.js:1086-1097`) is key-explicit on three unrelated keys — a file this build does not touch and no §9.2 test pins. §9.2's "pointer fields are not prompt inputs under any allowlist" is therefore true in effect but not by construction.

## B·13 — Firestore rules (§8.1) — **exact principal mirror; suite re-run green; one untested surface**

Side by side:

```
firestore.rules:430-431   allow read: if request.auth != null
                                      && resource.data.ownerId == request.auth.uid;

firestore.rules:449-450   allow read: if request.auth != null
                                      && get(/databases/$(database)/documents/agentBattles/$(battleId)).data.ownerId == request.auth.uid;
```

Token by token: `request.auth != null &&` identical; `== request.auth.uid` identical; the middle term is a different *expression* for the **same document and the same field** — the parent battle's `ownerId`. **Same principal set: exactly the battle owner, no more and no fewer.** No wildcard can reach the path (the only `{document=**}` rules are a different collection and the terminal deny). Client write is `if false` (`:451`).

**The trap I went looking for is not present.** The rule reads the **parent** via `get()`, not a denormalised `resource.data.ownerId` on the view. Verified all three legs: `buildIntradayView` writes no `ownerId` (`view.js:98-107`), the rules fixture carries none, and **the owner read still succeeds on the live emulator** — positive proof the rule does not depend on a field the writer never sets. It fails closed on a missing parent and on a parent without `ownerId`.

**The suite was re-run, not taken on trust:** `npm run test:rules` → emulator up, `intradayViewsDenials.rules.mjs` **10/10**, 211 tests, exit 0. The ten cases cover owner read, non-owner denied, privileged-claims denied, **unauthenticated denied**, missing-parent fails closed, four write verbs × four identities, and the parent's own execution-control update still working. Every case from the checklist — unauthenticated read, a rival with a valid session, update/delete not just create — is **present**.

**The one missing surface: `list`/query.** Every read in the suite is a single `getDoc`. Because the rule never references `resource`, `list` evaluates identically to `get` — so **the owner can enumerate and download the entire `intradayViews` subcollection**, which is wider than §8.1's stated client behaviour ("one `get` … never subscribes"). No confidentiality impact (owner, own battle; a rival's list is denied, and a collection-group query is denied even for the owner), but it is an untested surface a future rule edit could widen through 10/10.

## B·14 — Budget before publish (§5.3, §7.4) — **the core requirement holds; the ordering does not**

**The stated requirement is met.** A sweep whose publish aborts on `lease_expired`: `unitsRecorded: 25`, and `intradayBudget/{etDate}` **already holds** `{ unitsRequested: 25, unitsBySource: {live_v2: 4, live_v1_crypto: 1, intraday_1m_seed: 20}, sweeps: 1 }` while `calcStateWritten: false` and the write log is empty. `publishSweep` aborts before any `tx.set` (`intradayStore.js:159-160`). On the first sweep of a day with the budget document absent, `recordUnits` (`:122-140`) does `dataOf(snap) || {}` and stores cleanly — no throw, no NaN.

**`FieldValue.increment`: none in this build.** Repo-wide grep returns 18 hits, all pre-existing and unrelated (`agentSettingsTx.js:21`, `agent-daily-scores.js:176`, `chat.js:1077`, and others). The counter is a genuine read-add-write. The source tripwire (`intradayStore.test.js:100-107`) **is** a real guard — planting an increment in `intradayStore.js` turns it red — but it is **file-scoped, not behaviour-scoped**: the same sentinel written into `pollRunner.js`, against the same budget document, leaves it green.

**But units are not recorded "immediately."** §5.3 orders it *"before any calculation or publication."* Between `fetchQuotes` (`pollRunner.js:183`) and `recordUnits` (`:201`) sit four more I/O steps: `loadCalcState` (`:188`), `loadActionableDocs` (`:189`), `planSeeds` (`:190`) and **an unbounded sequential loop of 5-unit seed fetches** (`:193-197`). Forcing `loadCalcState` to throw: `vendorCallsMade: 2`, `budgetDocExists: false`. See R-1.

**What the tests cannot prove, stated plainly.** `inMemoryFirestore.js:145-158` runs the transaction callback **exactly once**, applies writes immediately, and has no isolation, contention detection, rollback or retry. Two concurrent `recordUnits` calls on one document lose an update silently (`returnedA: 100`, `returnedB: 200`, `stored: 200` — expected 300). The production code is nevertheless correct under real Firestore, which retries on contention — but that correctness is **inherited from the SDK, not demonstrated by this suite**, and `intradayStore.test.js:77,:84` (`expect(writeLog).toEqual([])`) prove only that `publishSweep` returns *before* calling `tx.set`, not that a transaction rolls back.

## B·15 — Flags and pins (§3) — **CLEAN, with one false docstring**

All five present and off / `'legacy'`: `featureFlags.js:2586, 2604, 2615, 2627, 2641`. Both live flags gate every named consumer **before any I/O** — `intraday-poll.js:34` and `intraday-validate.js:61` sit after cron auth and before `getFirebaseAdmin()`; `agent-evaluate.js:341` and `:2932` enclose the entire added surface; `useIntradayView.js:26` gates the client. All three dark flags have **no importer**: `INTRADAY_RISK_ACTIVATION_ENABLED` has zero hits outside its definition and pins, and `INTRADAY_PRICE_SOURCE` is uniquely well-guarded by an importer-scan at `intradayPriceSourceFlags.test.js:32-48`.

Pin files present; `flagPinGuard.test.js` mutation-checked — flipping a flag without moving its pin goes red naming **both** the pin's and the definition's `file:line`. The string enum (invisible to that guard by design) is covered by `intradayPriceSourceFlags.test.js:20`, also mutation-checked. `PROMPT_CONTRIBUTING_MODULES` is **unchanged** (0 diff lines), correct since the shadow-line renderer registers at stage 2.

**One thing is not true.** `featureFlags.js:2608-2611` and contract §9.3 both say `INTRADAY_AGENT_USE_ENABLED` gates the threshold lint's five 5-minute names. The lint accepts `{ intradayView, intradayAgentUseEnabled }` (`anticipationThresholdLint.js:270`), but its **one production call site** (`agent-evaluate.js:2219-2225`) passes neither, and the flag is not imported there. The branch is unreachable in production and flipping the flag today changes nothing. The §12 row for §9.3 calls `buildPresentSignals` directly with the parameter, so the unit passes while the production path cannot reach it. Not a flags-off behaviour change — but the stage-2 flip is not the one-line change §3 implies.

Also worth one line in the PR body: §3's "byte-identical to today" is a *data* claim. Two new cron entries now fire every minute (13–21 UTC, Mon–Fri) and every 30 minutes, returning `{skipped: true, reason: 'flag_off'}`. No data surface changes, but the platform surface does.

## B·16 — Pure-module hygiene — **zero genuine clock reads; the tripwire covers 7 of 13**

`grep -n 'Date\.now\|new Date()'` across every module the contract calls pure returns **9 hits, all inside header comments asserting the opposite** (`observation.js:4`, `accumulator.js:5`, `buckets.js:4`, `facts.js:5`, `sweepCalc.js:6`, `stepIndicators.js:4`, `eligibility.js:5`, `view.js:5`, `validator.js:5`). `seed.js`, `priceAdapter.js`, `etTime.js`, `universe.js`: zero. `marketSchedule.js`'s two additions use `new Date(Date.UTC(...))` and `new Date(cursor)` — deterministic functions of their `etDate` argument. **The runtime claim is true.**

**The guard behind it is not.** `intradayStore.test.js:104` enumerates seven files — `sweepCalc, accumulator, buckets, facts, seed, observation, stepIndicators` — and omits `eligibility.js`, `view.js`, `validator.js`, `priceAdapter.js`, `etTime.js`, `universe.js`, three of which declare *"PURE, no `Date.now()`"* in their own headers. Planting `Date.now()` in all six simultaneously and running every intraday suite plus both cron handler suites: **19 files, 155 tests, all passed.** `eligibility.js` is the one that matters — §8.3 makes `evaluateIntraday(…, { nowMs })` the stage-4 pre-action gate and §12 requires the verdict to flip on `nowMs` alone while the persisted view is unchanged; a clock read there would silently break the §8.2 replay contract. The fix is one line: iterate the directory, or derive the list from the headers that declare `PURE`.

**Version stamps.** `calcVersion` and `policyVersion` are both present on views, `intradayDefinitions/v1`, and `intradayValidation/{etDate}`. They are **not both** present on the two the build report names: `intradaySnapshots/latest` carries `calcVersion` only, and the **log entry carries `calcVersion` but not `policyVersion`** (`sweepCalc.js:126-138` — the eleven keys, verified directly). So executive row 7 of the build report ("`calcVersion: 1`, `policyVersion: 1` on every record — snapshot, log entries, views, definitions, validation documents") is **false for two of the five it lists**. The code is right and the contract is the defect — see the ledger.

---

# Part C — Verdict

# **MERGE WITH ADDENDUM**

Nothing found here corrupts a trade, a score, a prompt or a battle document, and the §8.1 isolation guarantee — the one that protects live trading — holds under all five failure modes when independently diffed. The build's own deviation list is honest and complete. What stops a clean merge is a small set of bounded changes, most of them one-line, plus one founder ruling.

## The addendum — seven bounded items

| # | Clause | Change | Why before merge |
|---|---|---|---|
| **A1** | §5.3 step 4 | Move `recordUnits` to directly after `fetchQuotes` and record seed units in a second call right after the seed loop; **cap `plan.attempt` per invocation** and stamp `seedLastAttemptAt` **before** the fetch rather than after. | The contract's own words are *"record units immediately … before any calculation or publication."* Today four I/O steps sit in between. This is the day-1 unit-burn risk (R-1). |
| **A2** | §8.3 | Move the age check above the `cutoff === null` branch in `eligibility.js:71-79`, or bound `display_only` by `nowMs − facts.availableAt`. | One line. Without it the Why? panel shows yesterday's VWAP as a current diagnostic every morning (R-3). |
| **A3** | §5.5 / §7.1 | Cap `heldObservationIds` at 2 and keep a plain `heldCount` (`accumulator.js:163`). | Behaviour-preserving — only `.includes()` and `.length >= 2` are ever read, and `degraded` is sticky. Removes an unbounded-growth path that can push `intradayCalcState` past 1 MiB and wedge the poller (R-7). |
| **A4** | §7.3 | Either add a pre-flight size refusal to `publishSweep`, or pin the **81-symbol** ceiling as a standing assertion and state it in the PR body. | There is no refusal today; an over-limit publish is attempted, throws, and stalls the sweep permanently while units keep burning (R-6). |
| **A5** | §10.2 | Rename the denominator honestly (e.g. `quoteCumulativeVolumeAtLastAccept`) and report it as a diagnostic, **or** exclude the closing-auction row from the numerator. | The field called `referenceCoveragePct` reads **197 %**, and §10.6's freeze is specified to read it (A·9). |
| **A6** | BUILD_RULES §6 vs contract G10 | **Founder ruling required.** §6 says 39/40 with one slot left; G10 says 100/project; the build ships 41 and both cron pins now *enforce* 41. | If §6's ceiling is the real one the deployment is rejected — and crons do not run on preview, so nothing catches it before the day-1 smoke. Cheap to settle; expensive to discover live. |
| **A7** | §13 | Widen the day-1 smoke with the six observations in the table below, and correct the three inaccurate statements in the build report (executive row 1 "each commit green"; row 7 version stamps; the stale §3 sizing table). | The founder reads that report to decide. Two of its rows are false and one table has drifted (B·10, B·11e, B·16). |

## Follow-up — own build, with what each blocks

| Finding | Clause | Blocks |
|---|---|---|
| `withTimeout` cannot cancel; the abandoned write lands after the entry says `write_failed` | §8.1 | nothing today; corrupts §10.4's evidence set (R-2) |
| No golden pins the three prompt allowlists as output-neutral | §9.2 | nothing today; a silent flags-off prompt regression (R-4) |
| `windowClosesAt` stamped once; transport failure reported as `'unpublished'`; `listViewsForSession` unbounded | §10.1 | the validator's own reliability (R-5) |
| Receipt-only replay test cannot fail; purity tripwire covers 7 of 13; late-seed parity compares latest values only | §12 | the guards behind §8.2, §5.4–5.6, §6.6 (R-8/9/10) |
| Seeding pins MACD/RSI `closeQualified: false` all day — **better data, worse flag** | §6.7 | **Stage 4** (R-11) |
| Poller deadline targets only two sessions, not "every invocation" | §6.2 | a session two days back can never be repaired (R-12) |
| §9.3 lint receives neither the view nor the flag; `INTRADAY_AGENT_USE_ENABLED` has no importer | §9.3 | **Stage 2** — the flip is not one line (R-14) |
| `evalId` from `evaluations.length` against a 150 cap | §8.1 | nothing today (unreachable); a persisted `evalSeq` makes it safe for good (A·13) |
| The §10.6 qualification calendar, thresholds and test-period rollup | §10.5–10.6 | **Stage 4** (A·11) |

## Ranked findings, worst first

1. **R-1 · `pollRunner.js:183→201`, `:193-197`** — units are charged to the vendor before they are recorded, across an **unbounded sequential seed loop** (`FETCH_TIMEOUT_MS = 10 s` each, no concurrency, no cap) inside a function with `maxDuration: 60` (`intraday-poll.js:26`) and **no internal time budget** (unlike `agent-evaluate.js`'s `TIME_BUDGET_MS`). The first sweep of **every** trading day must seed every actionable symbol, because `intradayCalcState` is sharded per ET date. Seven timing-out symbols exhaust the budget. A kill mid-loop writes no budget record and no `seedLastAttemptAt`, so the next minute replans the same seeds — and `LEASE_MS = 90 s` > `maxDuration = 60 s`, so the killed invocation's lease blocks the next one, producing an alternating burn of ~150 units (30 symbols × 5) every two minutes against a ~31,800-unit day. Independently reproduced two ways: forcing `loadCalcState` to throw gives `vendorCallsMade: 2, budgetDocExists: false`.
2. **R-2 · `evaluatorHook.js:20-24`** — "bounded to 2 s" is `Promise.race` with no `AbortController`. Measured: `storedViews: 0` at tick end, `storedViews: 1` 1.2 s later. The entry records `write_failed` / `intradayViewRef: null` while the document exists, and `listViewsForSession` selects by `evaluatedAt` range without consulting `intradayViewRef` — so a view the entry disowns is graded in §10.4. No test covers a hanging write.
3. **R-3 · `eligibility.js:71-79` + `sweepCalc.js:53` + `accumulator.js:62`** — a three-link chain, all verified: on a 15-minute delayed feed every symbol is rejected or prior-session for the first ~15 minutes of **every** session; `sweepCalc.js:53` carries the previous snapshot's facts forward unchanged; `collectionStalled` measures whether the *poller* is alive, not whether the *fact* is fresh; and the `cutoff === null` branch returns `display_only` **before** reaching the age check. Measured: an 18-hour-old VWAP renders as `display_only` with `collectionStalled: false`. Player-facing, under a header that reads *"recorded at the check."* BUILD_RULES §9 in spirit — the label and the number disagree. The one fixture that would have shown it clamps it away on purpose (`intradayPollHarness.js:53-54`).
4. **R-4 · `voiceLayerGrounding.js:371`, `voiceLayerAnticipation.js:112`, `agentReflectionUtils.js:171`** — three prompt readers were narrowed **with no flag gate**, i.e. on the flags-off path, and **nothing pins that the narrowing is output-neutral**. Every §9.2 test compares post-build against post-build, so a missing allowlist entry is missing identically on both arms. Dropping `'vintages'` deletes the whole provenance line from the narrator's sent prompt — and the full suite still reports **720 files / 13,836 tests passed**, exactly the build report's numbers. The lists are complete today (verified field by field); the guard is absent.
5. **R-5 · `validationRunner.js:62,:72` and `:93-95`** — `windowClosesAt` is stamped once from the first invocation's wall clock and checked before any fetch, so a first invocation at/after 16:00 UTC closes the session with `attempts: 0`, **zero vendor requests**, and four symbols written off as `unpublished` while the bars were available; nineteen sessions per year have two grading days and hit the same path. Separately, any non-2xx or timeout is reported as `reason: 'unpublished'` with `bars.status`/`bars.error` discarded — so an expired API key reads as vendor latency in the one metric §10.5 exists to produce. And `listViewsForSession` loads every view of every active battle, one sequential query per battle, on every invocation, **before** the ≤20-symbol slice, inside a budget anchored before it.
6. **R-6 · `intradayStore.js:154-172`** — no pre-flight size check; `firestoreDocBytes` is test-only. At ≥81 actionable symbols the publish throws, nothing is written, the same document is reloaded and one more log entry appended, so the **next attempt is the same size and fails identically** — the sweep stalls for the rest of the session while units keep being charged. Because the log grows through the day, this fails **near the close**, taking exactly the data the validator needs.
7. **R-7 · `accumulator.js:163`** — `heldObservationIds` grows one id per distinct held observation with no cap, cleared only by the per-date document. At 255 symbols × 420 sweeps the calc-state document reaches **1,868,275 B = 178 % of 1 MiB**; the §7.3 measurement never produces a held observation, so the condition is unmeasured.
8. **R-8 · `view.test.js:85`** — the guard behind §8.2 cannot fail: `replayFromView` takes no `db` handle, so the snapshot deletion is inert. Six of seven mutations survived, including rebinding a rendered timestamp to `price.priceAsOf` — the exact BUILD_RULES §9 defect family. The fixture never reaches an `eligible` verdict and the strike assertion compares `false === false`.
9. **R-9 · `intradayStore.test.js:104`** — the purity tripwire lists 7 of 13 pure modules; `Date.now()` planted in the other six (three of which declare themselves PURE, including `eligibility.js`) leaves 19 files / 155 tests green.
10. **R-10 · `buckets.test.js:236-238`** — the late-seed parity row compares `value()` only. Two states were constructed that agree on the latest value and diverge one bar later (RSI 66.667 → 70.455 vs 67.702). The code is correct; the guard is not. Its "incremental" side is also pre-seeded, so the late-seed **order** is never tested.
11. **R-11 · `seed.js:46` + `buckets.js:130,140`** — every seed necessarily ends on the previous session's unqualified last bucket, and the sticky AND never recovers without a contiguity break that adjacency prevents. A **seeded** symbol carries `macd/rsi closeQualified: false` all day; an **unseeded** one carries `true`. Inert today; inverts stage 4's evidence gate the day it lands.
12. **R-12 · `pollRunner.js:149-155`** — §6.2's "runs on every invocation … cannot skip it" is false; ~390 of ~540 daily invocations do no deadline work and a session two days back is unreachable by the poller.
13. **R-13 · `vercel.json` 39 → 41** — BUILD_RULES §6 says one slot remained and says to STOP on disagreement; the build flagged and continued, and both pins now enforce 41.
14. **R-14 · `agent-evaluate.js:2219-2225`** — §9.3's wiring does not exist; `INTRADAY_AGENT_USE_ENABLED` has no importer and the docstring claiming it gates the lint is false.
15. **Report accuracy** — executive row 1 ("each with the suite green at the time of the commit") is contradicted by its own item 22 and by the tree: `7055695d` and `fe02bdbe` carry 41 crons against a 39 pin. Row 7's version-stamp claim is false for the snapshot and the log entry. The §3 sizing table drifted in four of five rows after two later commits.

### Refuted
- **"The 74-line `motionGuardBaseline.json` diff absorbed unrelated violations."** Parsed entry by entry: 1 added at count 0, **0 removed, 0 count changes**. The diff is em-dash and `§` re-encoding. Same for the token baseline, whose prescribed regen reproduces the committed file byte-for-byte.
- **"The rules rule reads a denormalised `ownerId` the writer never sets."** It reads the parent via `get()`; the owner read succeeds on the live emulator against a fixture with no `ownerId` on the view.
- **"`anomalies.volumeInvalid` / `gapAssigned` are declared but never incremented."** They are set through a ternary (`accumulator.js:199`) and dispatched dynamically (`sweepCalc.js:85`) — a static grep misses both. All four counters work.
- **"The `evalId` collision is live."** Unreachable at HEAD under every shipped configuration (A·13).
- **"The §11 freshness clause could silently disarm the VWAP floor."** Both call sites pass `asOfMs` and `nowMs` (`agent-evaluate.js:1013`, `:547-556`). One residual worth watching on day 1: for a genuinely untraded name the newest completed 5-minute bar can exceed 45 minutes, so the floor disarms for very thin symbols — arguably correct, but it is a behaviour change beyond "a stalled feed is refused."

## Smoke additions for day 1 (from Probe B·6)

The build report names `anomalies.missing === 0` and `anomalies.unitCoerced === 0`. Those two pass cleanly under the three most likely field-name failures. Add these, all readable from the first `intradaySnapshots/latest` on a known-good liquid symbol:

| # | Observe | Catches |
|---|---|---|
| S1 | `anomalies.shapeUnexpected === 0` | the response has no `data` object |
| S2 | `anomalies.rejected === 0` **after the first 20 minutes** | `lastTradePrice` renamed; `lastTradeTime` in the wrong magnitude |
| S3 | **`anomalies.volumeInvalid === 0`** | `volume` renamed — today this is silent: the quote is *accepted*, VWAP is null, and all three named checks pass |
| S4 | `symbols[SYM].indicators.vwap.value !== null` **and** `quality.samples ≥ 3` by mid-session | the accumulator never advancing for any reason |
| S5 | `indicators.volumePace.status !== 'absent'` with reason ≠ `no_reference_volume`; and the value within ~0.3–3.0 | `averageVolume` renamed, or `volume` on a different scale |
| S6 | `indicators.sessionHL.value.high/low` non-null, and `price.previousClose` non-null | `high`/`low`/`open`/`previousClosePrice` renamed |
| S7 | day 2: `referenceCoveragePct` **between 90 and 110** | it will read ~197 today (A·9); a value below 90 means the vendor's `volume` is not regular-session-cumulative, and the qualification set is empty for a different reason |

## For the ledger — what the contract itself got wrong

1. **§6.6, the second-session seed.** Mutually exclusive with §6.3's session-relative adjacency and the 60-bucket cap: the rule can never contribute a bucket under any session in the maintained calendar, and costs 5 units per trigger. **Strike it**, and let §6.4's per-indicator warmup handle a short seed.
2. **§10.7 vs §7.1, `policyVersion` on log entries.** §10.7 says *"Both on every view, log entry and validation document"*; §7.1's eleven-key list omits `policyVersion`. The build followed §7.1 and pinned it hard. **§7.1 is right on the merits** — a log entry records an estimate, not an eligibility verdict, and §10.7 itself scopes `policyVersion` to §8.3. **Amend §10.7** to "both on every view and validation document; `calcVersion` on every log entry."
3. **§3, "Booleans pin in `flagPinGuard.test.js`."** The guard holds no pins; it *scans* test files. Amend to name the scanned pin file.
4. **§10.2, `referenceCoveragePct`.** The contract names a quantity no data source in build 1 can produce: there is no EOD volume and no unit budgeted for one. The clause should either name the proxy explicitly or drop the 90 % gate in favour of `barsMissing`, which is what actually works.
5. **§7.3, the generation-pointer trigger.** *"Only if the transaction ceiling is below 30"* is mis-calibrated by ~2.7×. The real crossing is **81 actionable symbols**; the clause should name a ceiling, not a comparison against the arithmetic's own example.
6. **§6.2, deadline processing.** *"Runs at the start of every poller invocation … so a late or missing invocation cannot skip it"* describes neither what was built nor what the cron schedule permits. Amend to the two-session reality, or widen the requirement to "every session with an open last bucket past close + 30."
7. **§3 / §9.3, `INTRADAY_AGENT_USE_ENABLED`.** Both describe a gate on the threshold lint that has no wiring. Either state that the wiring lands at stage 2, or require it now.
8. **§8.2, "every displayed line."** Ambiguous between the frozen verdicts the client renders and the recomputed ones `replayFromView` produces; at any instant other than `evaluatedAt` they differ. Name which one the clause means.
9. **§15 is the programme's gate, not a configuration item.** With `VOLUME_CUTOFF_FIELD` and `CLOSING_ROW_POLICY` null, three of the seven §10.5 metrics are structurally unavailable, every VWAP comparison is excluded `cutoff_unconfirmed`, and `symbolsQualified` is 0 for every symbol every day. The contract should say so where the founder will read it, so the first production run is not mistaken for a failure.

---

*Review performed on `claude/review-intraday-build-1` @ `458f0d0f`. Six lenses, five in isolated `git archive` trees per BUILD_RULES §2; every finding re-derived by the coordinator at its `file:line`; refuted claims recorded above. No source file changed — this report is the only addition.*
