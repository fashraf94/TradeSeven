# Build report — Measured Trend Evidence, slice 1 (P3): the `tf-setup-v1` evaluator

Claude Code (Claude Fable 5.1), October 28, 2026, for Flash. The build prompt was `20261028_P3_SLICE1_BUILD_PROMPT_V3.md` (the consolidated V3 prompt of October 28, under the founder's rulings FD-P3-1 option (a) — pattern-scoped missing facts — and FD-P3-2 — raw basis — and the six resolution points), started by the founder's explicit instruction of October 28, 2026 ("I approve implementation of Measured Trend Evidence Slice 1 using 20261028_P3_SLICE1_BUILD_PROMPT_V3.md"). The founder's instruction also ruled: initial golden-baseline creation reported explicitly and the cross-revision rejection cases tested on controlled fixtures; the saved October 13 capture only; date-only evidence preserved; the 60-call EODHD limit; the COP, XBI and LLY fixtures omitted. Nothing here is merged, deployed, activated or wired live. Done authorizes nothing further.

Every number below carries its class: **recorded** (read from a stored record or a file as written), **derived** (computed by this build's code from recorded inputs), **rebuilt** (reconstructed by a script from stored inputs), **market** (a bar as EODHD served it). Every codebase claim carries `file:line` with VERIFIED (read at the stated commit in this session) or ASSUMED.

## 0. Verdict

| Item | Result |
|---|---|
| **Status** | **Draft PR pushed, STOP.** Nothing merged, nothing deployed, no flag, no cron, no writer, no live use, no production capture read. (The push and PR state are in §19.) |
| Branch and head | Local branch `claude/measured-trend-evidence-slice-1-1c45de` (the desktop app's worktree name, cut at `origin/main` `24495eba`), pushed by refspec as the prompt's `claude/tf-setup-evaluator-slice1`. The code head is `78d37087`; the commits after it carry only this report and fixes recorded in §17. |
| Preamble | `git fetch origin` first; `origin/main` = `24495eba` (26 Oct, the #998 merge), unchanged through the build; working tree clean at the start; every §2 anchor VERIFIED (§2); no STOP condition held. |
| Slice 1 required items (V3 §1) | 1 thresholds and identity: built (§4). 2 the pure entry and holding evaluator: built (§5). 3 the rule-agnostic daily-bars adapter: built (§6). 4 tests, golden, baseline, mutation: 291 rows in seven new files, all green; 34 of 34 mutants killed (§8, §9). 5 the first replay over the saved 13 Oct capture: run, 29 of the 60 allowed EODHD calls, reported as coverage with ten receipts (§10). 6 this report, the review record (§17) and the docs commit (§11). |
| Engineering correctness | Every defined rule and unknown path has a row asserting its correct result; every synthetic scenario reproduces its complete record from the committed golden; the verdict recomputed from each record's own `checks` and `patterns` equals the record's; 34 mutants each red at least one row (§9). |
| Golden baseline | **Initial baseline creation.** The base revision carries no evaluator, golden or baseline, so the cross-revision check reports `mode: initial`, verifies the working tree's own integrity and claims no historical comparison. The rejection cases (a changed golden under an unchanged id, a rewritten or removed history entry, a sha mismatch at either ref, an id change without a new entry, a thresholds-hash change without a new `setupVersion`) are proven on controlled fixtures in `scripts/experiments/tf-setup-golden-baseline-check.test.js` (17 rows) and by mutant M20 on the real files (§7, §9). |
| Replay coverage | 486 woken Trend Follower checks, 33 proposed and 14 executed swap-ins (all 14 coincide with their proposals), 18 incoming and 16 outgoing names, 29 battles; 36 (symbol, asOf, role) pairs, 47 rows. Entry verdicts by pair: 3 `valid/pullback_resume`, 10 `invalid(regime)`, 5 `invalid(no_setup)`, 1 `unknown(basis_discontinuity)`. Data-unknown share 1 of 19 equity entry pairs = **5.3%**, within the one-quarter limit (§10). |
| Behavioral differentiation | **Not measured** by slice 1 (M3 after P4). The join to the Oct 14 scorer reached 30 rows and is reported as counts only (§10.8); no statement is made from it. |
| Partnership usefulness | **Not claimed.** The founder's read of the ten receipts (§10.7) is the completion step for the basis. |
| Market performance | **Not claimed.** |
| Fence | Fenced functions called: **none.** Fenced files edited: **none.** Existing source or test files edited: **none.** Existing documents edited: exactly two — `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` (clarification C1 appended; the text above it byte-identical, §11) and `docs/README.md` (rows). |
| Deviations from the prompt's letter | Nine, each small and each listed with its reason in §12 (one extra pure module for the shared volume policy; one extra test file for the baseline check's rejection cases; the fixture's `evidenceClass.bars = 'synthetic'`; the holding record carrying `patterns` and `regime`; the evaluator accepting an adapter refusal; the window cut to `minBars`; refusals carrying `checks`; three small env helpers restated in the replay; `requestedAsOf` and `refusal` as additive record fields). |
| Review | BUILD_RULES §2 review at the threshold (19 files, +14,419 lines): five lenses on their own `git archive` trees, a refuter per lens, the mutating lens last — the record is §17. |
| Final checks | Linux (WSL, `TZ=UTC`, `--maxWorkers=8`, `flock`): §18. |
| Founder questions | Q-TE-1 … Q-TE-7 (§15). None blocks the receipt read. |
| Preview URL | Not applicable (no UI, no endpoint, no cron). |

## 1. Preamble

- `git fetch origin` was the first git command of the session; `origin/main` = `24495eba456d6cf7832ae13547cd9b75da0fb0f9` (recorded), and the worktree's branch HEAD equalled it with a clean tree: `git status --short --branch` printed only the branch line (recorded).
- Local branch `claude/measured-trend-evidence-slice-1-1c45de` (the desktop app suffixes the prompt's name); the remote branch and the PR head carry the prompt's `claude/tf-setup-evaluator-slice1` (pushed by refspec, §19).
- The other app-created branch `claude/measured-trend-evidence-slice-1-27c046` points at `0fc78b02`, an ancestor of `origin/main` with zero commits of its own (VERIFIED by `git merge-base --is-ancestor`); it was left alone.
- Session rules kept: Claude Code directly, no WMUX, no delegated workers; subagents only for the §2 review (§17); no production store read; EODHD reads capped at 60 (29 made); no write, no watcher, no model call; the EODHD key read by name from the primary checkout's `.env.local`, never printed; no owner id printed anywhere; committed artifacts carry no owner or raw battle id.

## 2. Preamble checks (V3 §2), VERIFIED at `24495eba`

| Anchor | Found | Result |
|---|---|---|
| `api/_utils/setupEvaluator/`, `scripts/experiments/tf-setup-*.mjs` | Absent; `git grep` for `tf-setup`, `setupEvaluator`, `evaluateTfEntry`, `TF_SETUP_V1` outside `docs/` found nothing; `claude/measured-trend-evidence-slice-1-27c046` = `0fc78b02`, an ancestor of `origin/main` | no implementation anywhere; nothing to reconcile |
| `api/_utils/marketDataCache.js:313-343` `mapDailyRows` | Newest-first `{date, open, high, low, close, rawClose, volume}`; `close = toFiniteNumber(adjusted_close) \|\| toFiniteNumber(close)` (`:318`); rows with a non-finite close/high/low dropped (`:322-325`); zeros pass (`toFiniteNumber` at `:277-280` returns 0 for 0); **no field says whether `adjusted_close` was present** | shape as expected |
| `api/_utils/technicalCalculations.js` | `calculateSMA(closes, period)` newest-first, `toFixed(4)` (`:19-24`); `calculateATR(highs, lows, closes, 14)` mean of the last 14 true ranges, null below `period + 1` bars, `.value` 4 dp (`:285-325`); `calculateVolumeProfile` (`:336-365`) with its 10-of-20 rule (`:342-345`) — **not used** | conventions as expected |
| `api/_utils/analyticalPrimitives.js:44-96` | `findSwingHighsLows` is a two-bar-each-side pivot detector — **not used** for S3 | — |
| `api/_utils/marketSchedule.js:26-29, :82-116`; `src/utils/marketCalendar.js:69, :117-127` | `MAINTAINED_HOLIDAY_YEARS = [2026, 2027]`; `getSessionForDate` (null outside the maintained years; `{isTradingDay, isEarlyClose, openMs, closeMs, previousEtDate}`), `getPreviousSessionDate`, `isEarlyCloseDay`, `getPreviousTradingDay` (`:102-116`, a local-time `Date` walk over the holiday table) | exports as expected |
| `api/_utils/marketDataCache.js:1064-1082, :76-90` | `toEtParts`, `isCryptoSymbol`, `getCleanSymbol`, `formatEODHDSymbol` exported | — |
| `api/_utils/tickCapture/captureSerializer.js:68-127`, `captureConfig.js:108` | `PERMANENT_FIELD_KINDS` as named (`capturedAt` is a permanent field of the Firestore record; the saved capture does not carry it, see the last row); `TICK_CAPTURE_BODY_RETENTION_DAYS = 120` | unused by the first run |
| `src/config/featureFlags.js` | `ARCHETYPE_VECTORS_V2_ENABLED = false` (`:2054`), `ARCHETYPE_REFRESH_MENU_ENABLED = false` (`:2066`), `TICK_CAPTURE_ENABLED = true` (`:2729`), `PILOT_JOURNEY_MODE = 'off'` (`:3282`) | recorded; nothing flips |
| `api/_utils/agentBattleService.js:41` | `const AGENT_BATTLE_DURATION_MODE = 'fullday';` fenced, untouched; `src/utils/stockAdmissionWindow.js` exists and is not a dependency | — |
| `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` | §8 table equals §4 slot for slot; line 19 delegates the fact mapping to P3's Phase 0; 85 lines, no clarification note; the committed blob is LF (the checkout is CRLF under `core.autocrlf=true`) | as expected |
| `docs/audits/20261021_FABLE_REVIEW_ARCHETYPE_PROPOSAL.md` | Absent on `main`; the founder's file in Downloads is 29,558 bytes, SHA-256 `74c7261188f080a5f766a300e22264666c6df5ee8d9f99e5def890bc5becbb14` | committed byte-identical (§11) |
| `%USERPROFILE%\ft-experiment-exhibits\archetype-ablation-run\records.json` | Present (2,308,748 bytes, SHA-256 `8bc76a9e20d03c7e…`, mtime 2026-10-13T23:40:01Z); a JSON array of 2,823 records; keys `applicable, archetype, battleId, bodyState, decision, envelope, etDate, gate, k, origTuple, owner, ownerClass, tickId, woken` (the prompt's named keys all present; the others are not read); `decision.{original, final, originalSymbolOut, originalSymbolIn, finalSymbolOut, finalSymbolIn, …}`; **`etDate` is the only time-shaped field**; **`tickId` is `<battleId>:<seq>`**; window 2026-09-22 … 2026-10-13; `momentum_chaser` 952 records (recorded) | fields as verified on 28 Oct; the replay re-verifies them before defining its path (`verifyCaptureFields`) |

No new importer of `agentArchetypeConfig.js` / `archetypeScoring.js`; no prompt-contributing module (VERIFIED: the new modules import only `thresholds.js`, `volumePolicy.js`, `technicalCalculations.js`, `marketSchedule.js`, two helpers of `marketDataCache.js`, and `src/utils/marketCalendar.js` in the fixture).

## 3. The strategy card and the Phase 0 mapping

The strategy card of the 28 Oct decision report §2 is reproduced verbatim in the doc comment of `api/_utils/setupEvaluator/tfSetupV1.js:16-29`. The Phase 0 mapping (definition line 19) as built, recorded in `SEMANTICS_NOTES` (`thresholds.js:62-74`):

| Fact | Data | Decision |
|---|---|---|
| `C` | `bars[0].close`, the **raw** close (the adapter maps `rawClose` → `close`, never the adjusted value; `dailyBarsAdapter.js:140`) | FD-P3-2: raw basis for every fact |
| `SMA_fast`, `SMA_slow`, `SMA_slow_5ago` | `calculateSMA` over closes of bars 0..19, 0..49 and 5..54 (`tfSetupV1.js:107-114`); null when any close in the window is null or ≤ 0, or when the bars do not reach (`priceSlice`) | the 4-dp rounding of the primitive is part of the semantics; never pass a null into the primitive (it would add it as 0) |
| `swingHigh`, `swingLow` | max high / min low over bars **1..20**, bar 0 excluded, with the date of the extreme; the most recent bar wins a tie (`tfSetupV1.js:116-117`, `extremeOf`) | computed here; the pivot detector `findSwingHighsLows` answers a different question and is not reused |
| `ATR` | `calculateATR` over bars 0..14 (14 true ranges) `.value` (`tfSetupV1.js:119-123`) | the primitive's 4-dp rounding kept; the window passed explicitly so the record's window is exact |
| `V`, `V_avg` | the §6.3 policy, one function `classifyVolume` (`volumePolicy.js`) for the adapter and the evaluator: usable = finite and > 0; `V` = bar 0 or null; `V_avg` = the mean of bars 1..20 only when all 20 are usable, else null with the unusable dates listed (`tfSetupV1.js:126-141`) | the platform's 10-of-20 rule not adopted; no reduced-sample mean |
| Expected session | computed from the calendar before any row is read (`expectedCompletedSession`, `dailyBarsAdapter.js:60-75`); rows after it dropped; `rows[0].date` must equal it, else `missing_bar {expected, latest}` | resolution point 2: never redefined to an older row |
| Adjustment provenance and the split heuristic | `attachAdjustedClose(rows, payload)` sets `adjustedClose` per row (finite or null); metadata `present` only when every window row carries a finite value; the heuristic (ratio `adjustedClose / close`, day-over-day change > 10% → `basis_discontinuity`) runs only then; otherwise `splitCheck: 'not_available'` with the typed reason (`dailyBarsAdapter.js:186-213`) | resolution point 3: a ratio of 1 proves nothing; presence never inferred. Stated limits: the vendor's adjustment must already be applied; a special dividend above 10% trips it; a restated series is invisible; it is not proof of split-free data |
| Regime | uptrend when `regime_stack` and `slow_rising` are true; downtrend when both mirrors are true; otherwise no_trend; unknown when any of the four regime facts is null (`deriveRegime`) | the four regime checks are recorded on every record |
| Patterns and the verdict | `derivePatterns` (satisfied / failed only when every check is evaluable / untestable) and `deriveEntryVerdict` (V3 §6.4 rules 1–6) read `checks`, `patterns` and the bar count and nothing else | BUILD_RULES §9: the verdict derives from what the record shows |

## 4. Thresholds and identity (`api/_utils/setupEvaluator/thresholds.js`)

- `TF_SETUP_V1_THRESHOLDS`: S1 20, S2 50, S3 20, S4 14, S5 20, S6 5, S7 1.5, S8 3, S9 `'none'`, S10 2.0 — frozen, in the declared key order (VERIFIED against the definition §8).
- `SETUP_VERSION = 'tf-setup-v1'`; `THRESHOLDS_HASH = '26f3f411b566'` (derived: sha256 of `JSON.stringify` in the declared key order, first 12 hex), computed by `hashThresholds` at module load — a source-text tripwire in `thresholds.test.js` fails if it is ever pasted as a constant; a changed value or key order changes it (rows).
- `SEMANTICS_ID = 'tf-setup-v1/sem-1'`; `SEMANTICS_NOTES` (ten frozen strings) names C1, the pattern-assessment rule, the raw basis, the bar order, the windows, the equality boundaries, the volume policy, the rounding, the calendar-expected session rule, the split heuristic and provenance rule, and the regime rule.
- `MIN_COMPLETED_BARS = 55` (the smallest count that fills every window: `SMA_slow_5ago` reads bars 5..54).
- `describeRuleSet()` → `{ setupVersion, thresholdsHash, semanticsId }`, frozen, on every record.

## 5. The evaluator (`api/_utils/setupEvaluator/tfSetupV1.js`)

Pure: no clock, no I/O; imports `thresholds.js`, `volumePolicy.js` and `calculateSMA` / `calculateATR` only. `computeTfFacts(evidence)` → the nine facts and the `evidence` block; `entryChecks` → the nine checks (`regime_stack`, `slow_rising`, `regime_stack_down`, `slow_falling`, `breakout_close`, `breakout_volume`, `pullback_touch`, `pullback_close`, `extension`, each `{ id, lhs, op, rhs, result: true | false | 'unknown', facts }`); `evaluateTfEntry(evidence)` and `evaluateTfHolding(evidence, { anchorSwingLow })` assemble the records of V3 §5. The holding record carries the four regime checks plus `close_below_slow`, `structure_break` (unknown when the anchor is absent or non-finite; `anchorSwingLow: { value, provenance: 'supplied' | 'absent' }`) and `regime_flip`; `chartLeg` = broken / intact / unknown from those three and nothing else; `reasons` lists the true checks. The holding never reads an entry verdict (a row attaches a valid and an invalid(extended) entry record and proves the chart leg unchanged).

C1 as applied (FD-P3-1 option (a)), the six verdict rules of V3 §6.4, in `deriveEntryVerdict`:
1. fewer than 55 bars → `unknown(insufficient_history)`, regime `unknown`;
2. any regime fact null → `unknown(missing_fact)`, regime `unknown`, every fact recorded;
3. regime not uptrend → `invalid(regime)`;
4. in uptrend each pattern is `satisfied` (every check true), `failed` (every check evaluable, at least one false) or `untestable` (a check unknown) — recorded in `patterns` on every record, whatever the regime;
5. any pattern satisfied → the extension check: ATR null → `unknown(missing_fact)`; false → `invalid(extended)` (the satisfied patterns still listed); else `valid`, `pattern` the first satisfied in the order breakout, pullback_resume, `patternsSatisfied` all of them — a missing breakout volume never invalidates a supported pullback;
6. none satisfied: all failed → `invalid(no_setup)`; any untestable → `unknown(missing_fact)` listing the missing facts.

An adapter refusal (`ok: false`) evaluates to `unknown(<the adapter's reason>)` with every fact null, every check unknown, both patterns untestable and a `refusal: { reason, detail }` field, so the replay's rows have one shape (a deviation reported in §12).

## 6. The adapter (`api/_utils/setupEvaluator/dailyBarsAdapter.js`)

`expectedCompletedSession({ asOf, now })`, `attachAdjustedClose(rows, payload)` and `buildDailyEvidence({ rows, asOf, now, minBars, source, sourceMeta, symbol, barsClass })`, the ten rules of V3 §8 in order (`:95-230`): the symbol class; the expected completed session from the calendar before any row; the raw mapping and the drop of rows after the expected session (counted in `dropped`); `rows[0].date === expected` or `missing_bar {expected, latest}`; strictly decreasing dates (a malformed date is `unordered_bars`); `insufficient_history`; the window = the newest `minBars` rows; inside it a null or ≤ 0 close/high/low is `missing_fact {fact, date, value}` (never dropped, never filled) and every volume is classified (`volumeClass`) with its value preserved; adjacency by `getPreviousTradingDay` when both years are maintained, else `checks.adjacency = 'not_available'`; the split heuristic with explicit provenance; the window with `basis: 'raw'`, `source`, `sourceMeta`, `evidenceClass: { bars }`, `checks { completedSession, adjacency, splitCheck, splitCheckReason }`, `adjustment { metadata, missingDates }`, `dropped`, `asOf = bars[0].date`, `requestedAsOf`. The clock is injected: a missing or invalid `now` throws; `minBars` is the caller's (the adapter knows no Trend Follower rule).

## 7. The golden-verdict fixture and the baseline (V3 §4.3)

- `__fixtures__/syntheticBars.js`: 40 deterministic scenarios (31 entry, 9 holding) on hand-checkable arithmetic (closes 100 − 0.25·i, range ±1.5 or ±0.5, one volume); dates walk the calendar of record backwards from 2026-10-09. The "at the guard" scenario is constructed so every number is dyadic and `C = SMA_fast + 2·ATR` exactly (ATR 1.1875, guard 100.0000 = C).
- `__fixtures__/goldenVerdicts.json` (canonical form: sorted keys, 2-space, LF): the complete record of every scenario under `tf-setup-v1 / 26f3f411b566 / tf-setup-v1/sem-1`; canonical SHA-256 `d3501e5fcd5af6f4675094449ebeebadad61b60f55ddb67276c2b685a395f9b2` (derived).
- `__fixtures__/goldenBaseline.json`: one entry — `{ semanticsId: 'tf-setup-v1/sem-1', goldenSha256: 'd3501e5f…', recordedAt: '2026-10-28T16:14:20.772Z', note: 'Initial baseline … Initial baseline creation: no earlier baseline exists at the base revision.' }`.
- In-revision (`golden.test.js`, 46 rows): every scenario reproduces its full record; the file is in canonical form; the baseline's last entry carries the golden's canonical sha and `SEMANTICS_ID`; ids unique and in order; `recordedAt` ISO; the note names C1 and FD-P3-1; the golden computed now hashes to the last entry's sha.
- Cross-revision (`scripts/experiments/tf-setup-golden-baseline-check.mjs --base <ref>`): reads the baseline, the golden and `thresholds.js` at the base ref via `git show` (the base `thresholds.js` is imported from a temp copy, removed afterwards) and at the working tree; `compareRevisions` is pure and tested on controlled fixtures (17 rows). **Output against the merge-base** (`git merge-base HEAD origin/main` = `24495eba`), recorded:

```
tf-setup golden baseline check — mode: initial (initial baseline creation)
  base 24495eba456d6cf7832ae13547cd9b75da0fb0f9 = 24495eba456d6cf7832ae13547cd9b75da0fb0f9: no evaluator baseline, golden or thresholds
  head (working tree, HEAD ed34f2128e2c2ab72bbf596c1e8ac4b71f67a8be): tf-setup-v1/sem-1, golden d3501e5fcd5a…, thresholds tf-setup-v1/26f3f411b566, 1 entry
  note: initial baseline creation: the base ref carries no evaluator baseline; only the working tree's own integrity is verified and no historical comparison is claimed
  result: PASS
```

No historical comparison is claimed: there is no earlier baseline. The rejection cases are proven on fixtures (§8) and, for the one that matters most, on the real files by mutant M20 (§9): with the golden regenerated under a changed evaluator and the id unchanged, `golden.test.js` reds (the baseline sha row) and the script against `--base HEAD` fails with three named failures (the sha mismatch, the changed golden under an unchanged id, no appended entry).

## 8. The fixture matrix and the test files

Seven new test files, 291 rows, all green on Windows (the mutation baseline run) and on Linux (§18): `thresholds.test.js` 7 · `tfSetupV1.entry.test.js` 130 · `tfSetupV1.holding.test.js` 30 · `dailyBarsAdapter.test.js` 45 · `golden.test.js` 46 · `tf-setup-corpus-replay.test.js` 16 · `tf-setup-golden-baseline-check.test.js` 17. Every V3 §9.1–§9.5 and §9.7 row has a test; §9.6 (historical cases) is omitted because no case was supplied (the founder's instruction). Real imports throughout (the dependency-surface guards named in each file's header); `pinTimezoneUtc.js` first in every file that builds a `Date`; no network; nothing mocked.

The golden scenarios and their pinned outcomes (derived; every row also asserted in the entry/holding test files):

| Scenario | Kind | Outcome | Regime | Missing | breakout / pullback_resume |
|---|---|---|---|---|---|
| `uptrend_no_setup` | entry | invalid(no_setup) | uptrend | — | failed / failed |
| `breakout_at_swing_high` | entry | valid / breakout (C = swingHigh exactly) | uptrend | — | satisfied / failed |
| `breakout_volume_exact_1_5x` | entry | valid / breakout (V = 1.5 × V_avg exactly) | uptrend | — | satisfied / failed |
| `breakout_one_tick_below` | entry | invalid(no_setup) | uptrend | — | failed / failed |
| `breakout_volume_1_49x` | entry | invalid(no_setup) | uptrend | — | failed / failed |
| `pullback_touch_bar2_exact` | entry | valid / pullback_resume (low of bar 2 = SMA_fast exactly) | uptrend | — | failed / satisfied |
| `pullback_touch_bar3_only` | entry | invalid(no_setup) | uptrend | — | failed / failed |
| `close_at_sma_fast` | entry | invalid(regime); `pullback_close` false | no_trend | — | failed / failed |
| `close_below_sma_fast` | entry | invalid(regime); `pullback_close` false | no_trend | — | failed / failed |
| `both_patterns` | entry | valid / breakout, both listed | uptrend | — | satisfied / satisfied |
| `extended_pullback` | entry | invalid(extended) | uptrend | — | failed / satisfied |
| `extended_breakout` | entry | invalid(extended) | uptrend | — | satisfied / failed |
| `at_extension_guard` | entry | valid / pullback_resume (C = SMA_fast + 2·ATR exactly) | uptrend | — | failed / satisfied |
| `flat_slow_sma` | entry | invalid(regime) (SMA_slow = SMA_slow_5ago) | no_trend | — | failed / satisfied |
| `downtrend_mirror` | entry | invalid(regime) | downtrend | — | failed / failed |
| `bounce_fast_below_slow` | entry | invalid(regime) | no_trend | — | failed / failed |
| `bars_54` | entry | unknown(insufficient_history) | unknown | SMA_slow_5ago | failed / failed |
| `bars_55` | entry | invalid(no_setup) (evaluable) | uptrend | — | failed / failed |
| `c1_pullback_null_bar0_volume` | entry | valid / pullback_resume | uptrend | V | untestable / satisfied |
| `c1_breakout_price_unusable_volume` | entry | unknown(missing_fact), not no_setup | uptrend | V | untestable / failed |
| `c1_zero_volume_in_window` | entry | valid / pullback_resume | uptrend | V_avg | untestable / satisfied |
| `volume_bar0_{null, zero, negative, non_finite}` (4) | entry | unknown(missing_fact); bar 0 classified with its reason | uptrend | V | untestable / failed |
| `volume_window_{null, zero, negative, non_finite}` (4) | entry | unknown(missing_fact); bar 7 listed with its reason, 19 usable | uptrend | V_avg | untestable / failed |
| `null_high_bar5` | entry | unknown(missing_fact) | uptrend | swingHigh, ATR | untestable / failed |
| `null_high_bar20` | entry | unknown(missing_fact) | uptrend | swingHigh | untestable / failed |
| `holding_close_below_slow` | holding | broken [close_below_slow] | no_trend | anchor 80 | — |
| `holding_structure_break` | holding | broken [structure_break] | uptrend | anchor 100.5 | — |
| `holding_regime_flip` | holding | broken [close_below_slow, regime_flip] | downtrend | anchor 50 | — |
| `holding_anchor_absent_all_false` | holding | unknown (structure_break unknown, provenance absent) | uptrend | absent | — |
| `holding_anchor_absent_close_below_slow` | holding | broken [close_below_slow] | no_trend | absent | — |
| `holding_intact_with_anchor` | holding | intact | uptrend | anchor 90 | — |
| `holding_extended_series_intact` | holding | intact (the entry is invalid(extended)) | uptrend | anchor 90 | — |
| `holding_no_setup_series_intact` | holding | intact (the entry is invalid(no_setup)) | uptrend | anchor 90 | — |
| `holding_short_history` | holding | unknown (10 bars, every check unknown) | unknown | absent | — |

Also asserted outside the golden: a null regime fact (a null close at bar 30) → `unknown(missing_fact)` with every other fact recorded; `V_avg` as the mean of all 20 bars (1,000,210 from 1,000,020 … 1,000,400); a non-positive close → `C` null; the adapter refusal record; the holding's independence from any attached entry record; every record's shape; determinism and unmutated frozen inputs; the end-to-end adapter → entry record on the shared EOD fixture series re-dated onto sessions (`invalid(regime)` / downtrend with the nine facts pinned).

One observation for the record: `regime_flip` cannot be true in isolation — the downtrend mirror (`C < SMA_fast < SMA_slow`) puts `C` below `SMA_slow`, so `close_below_slow` is true whenever `regime_flip` is; the row says so.

## 9. The mutation table (V3 §9.8)

Run on a scratch `git archive` tree of the code head (never committed; `node_modules` junctioned; `TZ=UTC`), one mutant at a time with the seven test files, the file restored after each. Baseline 291/291. **34 of 34 killed; no survivor; every §9.8 mutant present (M1–M20) plus fourteen more.** (The first pass of this table was discarded: the driver had snapshotted the golden after M20's regeneration, so M21 onward ran against a mutated golden; the driver was fixed and the whole pass re-run clean — the counts below are the clean pass's.)

| Mutant | What changed | Result | A row that went red |
|---|---|---|---|
| M1 | `>=` → `>` on the breakout close | KILLED (37 red of 291) | golden: `breakout_at_swing_high`; entry: C equal to swingHigh is valid |
| M2 | 1.5 → 1.0 | KILLED (46) | thresholds: the hash literal; entry: 1.49× is no_setup |
| M3 | swing window includes bar 0 | KILLED (39) | golden: `uptrend_no_setup`; entry: swingHigh 101.25 on bar 1 |
| M4 | extension guard removed | KILLED (7) | golden: `extended_pullback`; entry: invalid(extended) |
| M5 | rising window 5 → 1 | KILLED (48) | adapter end-to-end pinned record; thresholds slot |
| M6 | regime needs only `C > SMA_fast` | KILLED (3) | golden: `bounce_fast_below_slow`; entry: no_trend |
| M7 | pullback window 3 → 5 | KILLED (61) | entry: a touch on bar 3 only is not a pullback |
| M8 | unusable `V` treated as 0 | KILLED (15) | golden: `c1_pullback_null_bar0_volume`; entry: missing [V] |
| M9 | `V_avg` over 19 usable bars | KILLED (11) | golden: `c1_zero_volume_in_window`; entry: V_avg null, 19 usable |
| M10 | zero volume usable | KILLED (8) | adapter: a zero volume classified `zero`; entry: `volume_bar0_zero` |
| M11 | the adapter keeps the current-session row | KILLED (3) | adapter: today at 15:59 ET expects the previous session |
| M12 | the adapter falls back to the newest remaining row | KILLED (2) | adapter: the expected previous-session row missing is `missing_bar`, never a fallback |
| M13 | `minBars` 55 → 50 | KILLED (8) | adapter: 54 rows is insufficient_history; entry: 54 bars |
| M14 | `structure_break` with a null anchor returns false | KILLED (8) | golden: `holding_anchor_absent_all_false`; holding: structure_break unknown |
| M15 | the holding reads the entry verdict | KILLED (1) | holding: the same chart leg with a valid, an invalid or no entry attached |
| M16 | the split heuristic runs with `adjustedClose` absent | KILLED (2) | adapter: rows without the key → metadata absent, not_available |
| M17 | `THRESHOLDS_HASH` from a constant | KILLED (1) | thresholds: the source-text tripwire |
| M18 | `factsUsed.SMA_fast` re-derived (drifts one tick) | KILLED (43) | adapter end-to-end pinned facts; entry: SMA_fast 97.625 |
| M19 | `checks` dropped while the verdict stays | KILLED (112) | golden: every entry scenario; entry: the verdict recomputed from checks |
| M20 | the golden regenerated with `SEMANTICS_ID` unchanged (under M1) | KILLED (2 of 46 in-revision) + the cross-revision script FAILS (3 failures) | golden: the baseline's last sha; script: "golden bytes changed but SEMANTICS_ID is still tf-setup-v1/sem-1" |
| M21 | a pattern with one false and one unknown check reads failed (short-circuit) | KILLED (25) | golden: `c1_pullback_null_bar0_volume`; entry: breakout untestable |
| M22 | `V_avg` window includes bar 0 | KILLED (24) | golden: `breakout_at_swing_high`; entry: `volume_bar0_null` keeps V_avg |
| M23 | `pullback_close` `>` → `>=` | KILLED (34) | entry: a close at SMA_fast is not a resume |
| M24 | extension `<=` → `<` | KILLED (34) | entry: C exactly at the guard is valid |
| M25 | the adapter's adjacency check removed | KILLED (2) | adapter: a removed weekday inside the window is missing_bar |
| M26 | the adapter never drops rows after the expected session | KILLED (4) | adapter: today before the close drops the current row |
| M27 | the adapter ignores the early close | KILLED (3) | adapter: 27 Nov at 13:00 ET is complete |
| M28 | the adapter treats a zero close as a price | KILLED (1) | adapter: a 0 close is missing_fact |
| M29 | replay `asOf` = the check's own session | KILLED (4) | replay: 13 Oct reads 12 Oct |
| M30 | replay call cap off by one | KILLED (1) | replay: the 61st request refused |
| M31 | replay reads the owner into a row | KILLED (2) | replay: never carries the owner |
| M32 | the baseline check accepts a changed golden under an unchanged id | KILLED (1) | baseline: REJECTS a changed golden under an unchanged id |
| M33 | the baseline check accepts a rewritten history entry | KILLED (2) | baseline: REJECTS a rewritten historical entry |
| M34 | replay population includes CPU owners | KILLED (1) | replay: the population filter |

## 10. The first replay run (V3 §10)

Run `tfs-20261028T162026` in `%USERPROFILE%\tf-setup-replay-runs\` (outside the repo; `rows.local.json` carries battle and tick ids and is never committed; `manifest.json`, `evaluations.json`, `summary.json` and `report.md` carry none). Provenance recorded in the manifest and in every output: HEAD `ed34f212` at `plan` / `bars` and `78d37087` at the final `evaluate` / `report` (the script's report-rendering fix, §12 D9, landed between; the evaluations are identical), tree clean, script sha `c3afa719…`, module hashes, `ruleSet { tf-setup-v1, 26f3f411b566, tf-setup-v1/sem-1 }`, the capture's sha, size, record count, keys and time fields, the run instant `2026-10-28T16:24:48.616Z`. Commands: `selftest` (7/7) · `plan` · `bars` · `evaluate` · `report`.

**10.1 Scope and the fields (re-verified before the path was defined).** The saved 13 Oct capture only; no Firestore read; the `owner` field never read. `verifyCaptureFields` confirmed `etDate` as the only time-shaped field and `tickId = <battleId>:<seq>` on all 2,823 records before `plan` defined the path (recorded in the manifest).

**10.2 Population (recorded).** Trend Follower non-CPU records 692; woken 486; battles 29; proposed swap-ins 33; executed 14; proposed and executed coincide on all 14; distinct incoming names 18 (`AFRM AMAT AMD COP CTVA CVX DHR GEV MAR META MPC MSFT MU PANW PLTR PM SNOW V`); distinct outgoing names 16 (`AMD AMZN BE BTC CEG DE ETN GME GOOGL LLY LRCX MAR META PANW PWR RKLB`); woken checks per month 2026-09: 170, 2026-10: 316. These equal the counts the prompt expected (486 / 33 / 14 / 18).

**10.3 The cutoff.** `asOf = getPreviousSessionDate(etDate)` — the last session strictly before the check's ET date, never the check's own; 0 rows `calendar_missing`; each row carries `decisionInstant: { etDate, precision: 'date' }` and `evidenceClass: { decision: 'contemporaneous', bars: 'later_reconstruction', verdict: 'derived' }`; `now` = the run instant, so the adapter's expected session equalled `asOf` on every pair (`checks.completedSession = 'complete'` throughout; rows after `asOf` dropped, 0–14 per pair).

**10.4 The plan (printed before any provider call, recorded).** 36 (symbol, asOf, role) pairs — 19 entry (incoming names) and 17 holding (outgoing names) — over 29 distinct equity symbols → **29 EODHD calls (cap 60)**; `BTC` skipped as crypto (its holding rows unevaluated, counted); `from` 2026-05-14 (the earliest asOf 2026-09-21 − 130 days), `to` 2026-10-09 (the latest asOf). Bars: one `/eod/` request per symbol (`period=d&order=d&fmt=json`, symbol via `formatEODHDSymbol(getCleanSymbol(s), false)`), 103 rows each (market), cached in the run folder with `fetchedAt`, mapped by `mapDailyRows` (0 rows dropped by the mapper) then `attachAdjustedClose`; every window had adjustment metadata present and the heuristic ran on all 36.

| Symbol | asOf | Role | Rows | Result (derived) |
|---|---|---|---|---|
| GOOGL | 2026-09-21 | holding | 2 | unknown |
| MU | 2026-09-21 | entry | 2 | valid / pullback_resume (uptrend) |
| DE | 2026-09-22 | holding | 2 | unknown |
| META | 2026-09-22 | holding | 1 | unknown |
| PANW | 2026-09-22 | entry | 1 | valid / pullback_resume (uptrend) |
| PLTR | 2026-09-22 | entry | 2 | valid / pullback_resume (uptrend) |
| AMD | 2026-09-25 | holding | 2 | unknown |
| DHR | 2026-09-25 | entry | 2 | invalid(no_setup) (uptrend) |
| ETN | 2026-09-25 | holding | 2 | unknown |
| MAR | 2026-09-25 | entry | 2 | invalid(regime) (no_trend) |
| AMAT | 2026-09-28 | entry | 2 | invalid(regime) (no_trend) |
| PANW | 2026-09-28 | holding | 2 | unknown |
| MAR | 2026-09-29 | holding | 2 | unknown |
| PANW | 2026-09-29 | entry | 2 | invalid(no_setup) (uptrend) |
| PWR | 2026-09-29 | holding | 2 | unknown |
| SNOW | 2026-09-29 | entry | 2 | invalid(regime) (no_trend) |
| GEV | 2026-09-30 | entry | 2 | invalid(regime) (no_trend) |
| PANW | 2026-09-30 | holding | 2 | unknown |
| AFRM | 2026-10-02 | entry | 3 | invalid(regime) (no_trend) |
| AMD | 2026-10-05 | entry | 13 | invalid(no_setup) (uptrend) |
| CEG | 2026-10-05 | holding | 3 | broken [close_below_slow] |
| LRCX | 2026-10-05 | holding | 2 | unknown |
| PANW | 2026-10-05 | holding | 1 | unknown |
| CTVA | 2026-10-06 | entry | 2 | unknown(basis_discontinuity) |
| MPC | 2026-10-06 | entry | 1 | invalid(no_setup) (uptrend) |
| MSFT | 2026-10-06 | entry | 1 | invalid(no_setup) (uptrend) |
| RKLB | 2026-10-06 | holding | 3 | unknown |
| AMZN | 2026-10-07 | holding | 2 | unknown |
| BE | 2026-10-07 | holding | 4 | unknown |
| COP | 2026-10-07 | entry | 2 | invalid(regime) (no_trend) |
| CVX | 2026-10-07 | entry | 2 | invalid(regime) (no_trend) |
| LLY | 2026-10-07 | holding | 2 | unknown |
| PM | 2026-10-07 | entry | 2 | invalid(regime) (no_trend) |
| V | 2026-10-07 | entry | 2 | invalid(regime) (no_trend) |
| GME | 2026-10-09 | holding | 1 | unknown |
| META | 2026-10-09 | entry | 2 | invalid(regime) (no_trend) |

**10.5 Verdicts (derived; counts only).** Entry, by pair: valid/pullback_resume 3, invalid(regime) 10, invalid(no_setup) 5, unknown(basis_discontinuity) 1; no valid/breakout, no invalid(extended), no missing_fact. Entry, by row (47): valid/pullback_resume 5, invalid(regime) 21, invalid(no_setup) 19, unknown(basis_discontinuity) 2. Regime by row: uptrend 24, no_trend 21, unknown 2 (no downtrend). Pattern assessments by row: breakout failed / pullback failed 33; breakout failed / pullback satisfied 12; both untestable 2. Missing facts: only the two refused rows (all nine). Holding, by row (35): unknown 32, broken 3 (CEG as of 2026-10-05, `close_below_slow`); `structure_break` unknown on every row (the anchor is ID-1's record, absent throughout); no `regime_flip`.

**10.6 Data-unknown share.** Unknown verdicts 1 ÷ equity (symbol, asOf) entry evaluations attempted 19 = **5.3%** (limit one quarter: within; nothing rejected). The one unknown is `CTVA` as of 2026-10-06: `basis_discontinuity` at 2026-10-01 — the adjusted/raw ratio is 0.1500 on the rows before that date and 1 after (the vendor's adjustment factor shows a corporate action on 1 Oct 2026 that the raw series carries as a ~6.7× price step), so every window straddling it is refused as designed. The verdict is honest (`unknown`, never `invalid`); how a split-adjusted raw series could serve such windows is an adapter question for a later slice, not a definition change (Q-TE-3). Crypto: `BTC` on the outgoing side of 12 rows, not fetched, reported separately; `calendar_missing` 0.

**10.7 The ten receipts** (the earliest check per verdict class until ten; derived; rendered by the replay's own report so no number is retyped):

#### Receipt 1: DHR as of 2026-09-25 — invalid(no_setup), regime uptrend

- facts: C=224.49, SMA_fast=211.397, SMA_slow=205.8886, SMA_slow_5ago=203.8348, swingHigh=226.65, swingLow=199.09, ATR=5.3889, V=4423721, V_avg=3921854.4
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [224.49,211.397] > [211.397,205.8886] → true; slow_rising 205.8886 > 203.8348 → true; regime_stack_down [224.49,211.397] < [211.397,205.8886] → false; slow_falling 205.8886 < 203.8348 → false; breakout_close 224.49 >= 226.65 → false; breakout_volume 4423721 >= 5882781.6 → false; pullback_touch 219 <= 211.397 → false; pullback_close 224.49 > 211.397 → true; extension 224.49 <= 222.1748 → false
- volume: bar0 {"date":"2026-09-25","value":4423721,"usable":true,"reason":null}; avg {"value":3921854.4,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 2: MAR as of 2026-09-25 — invalid(regime), regime no_trend

- facts: C=352.03, SMA_fast=339.4345, SMA_slow=352.8082, SMA_slow_5ago=354.737, swingHigh=358.16, swingLow=320.91, ATR=7.3122, V=1353100, V_avg=1615756.25
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [352.03,339.4345] > [339.4345,352.8082] → false; slow_rising 352.8082 > 354.737 → false; regime_stack_down [352.03,339.4345] < [339.4345,352.8082] → false; slow_falling 352.8082 < 354.737 → true; breakout_close 352.03 >= 358.16 → false; breakout_volume 1353100 >= 2423634.375 → false; pullback_touch 345.37 <= 339.4345 → false; pullback_close 352.03 > 339.4345 → true; extension 352.03 <= 354.0589 → true
- volume: bar0 {"date":"2026-09-25","value":1353100,"usable":true,"reason":null}; avg {"value":1615756.25,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 3: CTVA as of 2026-10-06 — unknown(basis_discontinuity), regime unknown

- facts: C=null, SMA_fast=null, SMA_slow=null, SMA_slow_5ago=null, swingHigh=null, swingLow=null, ATR=null, V=null, V_avg=null
- missing: ["C","SMA_fast","SMA_slow","SMA_slow_5ago","swingHigh","swingLow","ATR","V","V_avg"]; patterns: {"breakout":"untestable","pullback_resume":"untestable"}
- checks: regime_stack [null,null] > [null,null] → unknown; slow_rising null > null → unknown; regime_stack_down [null,null] < [null,null] → unknown; slow_falling null < null → unknown; breakout_close null >= null → unknown; breakout_volume null >= null → unknown; pullback_touch null <= null → unknown; pullback_close null > null → unknown; extension null <= null → unknown
- volume: bar0 {"date":null,"value":null,"usable":false,"reason":"null"}; avg {"value":null,"barsUsable":0,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck tripped

#### Receipt 4: MU as of 2026-09-21 — valid / pullback_resume, regime uptrend

- facts: C=1043.96, SMA_fast=963.4595, SMA_slow=928.5502, SMA_slow_5ago=927.5794, swingHigh=1042.4, swingLow=887.61, ATR=44.3664, V=28174400, V_avg=24835970
- missing: []; patterns: {"breakout":"failed","pullback_resume":"satisfied"}
- checks: regime_stack [1043.96,963.4595] > [963.4595,928.5502] → true; slow_rising 928.5502 > 927.5794 → true; regime_stack_down [1043.96,963.4595] < [963.4595,928.5502] → false; slow_falling 928.5502 < 927.5794 → false; breakout_close 1043.96 >= 1042.4 → true; breakout_volume 28174400 >= 37253955 → false; pullback_touch 953.5 <= 963.4595 → true; pullback_close 1043.96 > 963.4595 → true; extension 1043.96 <= 1052.1923000000002 → true
- volume: bar0 {"date":"2026-09-21","value":28174400,"usable":true,"reason":null}; avg {"value":24835970,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 5: PANW as of 2026-09-29 — invalid(no_setup), regime uptrend

- facts: C=388.41, SMA_fast=362.255, SMA_slow=357.986, SMA_slow_5ago=354.5816, swingHigh=396.3, swingLow=321.39, ATR=18.8636, V=5101600, V_avg=7109435
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [388.41,362.255] > [362.255,357.986] → true; slow_rising 357.986 > 354.5816 → true; regime_stack_down [388.41,362.255] < [362.255,357.986] → false; slow_falling 357.986 < 354.5816 → false; breakout_close 388.41 >= 396.3 → false; breakout_volume 5101600 >= 10664152.5 → false; pullback_touch 367.27 <= 362.255 → false; pullback_close 388.41 > 362.255 → true; extension 388.41 <= 399.9822 → true
- volume: bar0 {"date":"2026-09-29","value":5101600,"usable":true,"reason":null}; avg {"value":7109435,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 6: AMAT as of 2026-09-28 — invalid(regime), regime no_trend

- facts: C=486.76, SMA_fast=453.064, SMA_slow=489.3878, SMA_slow_5ago=498.353, swingHigh=487.68, swingLow=411.51, ATR=18.0779, V=6092100, V_avg=6371815
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [486.76,453.064] > [453.064,489.3878] → false; slow_rising 489.3878 > 498.353 → false; regime_stack_down [486.76,453.064] < [453.064,489.3878] → false; slow_falling 489.3878 < 498.353 → true; breakout_close 486.76 >= 487.68 → false; breakout_volume 6092100 >= 9557722.5 → false; pullback_touch 460.55 <= 453.064 → false; pullback_close 486.76 > 453.064 → true; extension 486.76 <= 489.2198 → true
- volume: bar0 {"date":"2026-09-28","value":6092100,"usable":true,"reason":null}; avg {"value":6371815,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 7: PANW as of 2026-09-22 — valid / pullback_resume, regime uptrend

- facts: C=374.57, SMA_fast=356.121, SMA_slow=354.5816, SMA_slow_5ago=350.4122, swingHigh=387.33, swingLow=321.39, ATR=18.8336, V=8105300, V_avg=7043580.25
- missing: []; patterns: {"breakout":"failed","pullback_resume":"satisfied"}
- checks: regime_stack [374.57,356.121] > [356.121,354.5816] → true; slow_rising 354.5816 > 350.4122 → true; regime_stack_down [374.57,356.121] < [356.121,354.5816] → false; slow_falling 354.5816 < 350.4122 → false; breakout_close 374.57 >= 387.33 → false; breakout_volume 8105300 >= 10565370.375 → false; pullback_touch 356 <= 356.121 → true; pullback_close 374.57 > 356.121 → true; extension 374.57 <= 393.78819999999996 → true
- volume: bar0 {"date":"2026-09-22","value":8105300,"usable":true,"reason":null}; avg {"value":7043580.25,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 8: PLTR as of 2026-09-22 — valid / pullback_resume, regime uptrend

- facts: C=184.99, SMA_fast=176.508, SMA_slow=160.4842, SMA_slow_5ago=155.6074, swingHigh=188.37, swingLow=164.55, ATR=7.0527, V=21991700, V_avg=27899425.6
- missing: []; patterns: {"breakout":"failed","pullback_resume":"satisfied"}
- checks: regime_stack [184.99,176.508] > [176.508,160.4842] → true; slow_rising 160.4842 > 155.6074 → true; regime_stack_down [184.99,176.508] < [176.508,160.4842] → false; slow_falling 160.4842 < 155.6074 → false; breakout_close 184.99 >= 188.37 → false; breakout_volume 21991700 >= 41849138.400000006 → false; pullback_touch 172 <= 176.508 → true; pullback_close 184.99 > 176.508 → true; extension 184.99 <= 190.6134 → true
- volume: bar0 {"date":"2026-09-22","value":21991700,"usable":true,"reason":null}; avg {"value":27899425.6,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 9: AMD as of 2026-10-05 — invalid(no_setup), regime uptrend

- facts: C=631.75, SMA_fast=574.1985, SMA_slow=515.7302, SMA_slow_5ago=506.9552, swingHigh=645.46, swingLow=458, ATR=24.7886, V=13717500, V_avg=22703815
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [631.75,574.1985] > [574.1985,515.7302] → true; slow_rising 515.7302 > 506.9552 → true; regime_stack_down [631.75,574.1985] < [574.1985,515.7302] → false; slow_falling 515.7302 < 506.9552 → false; breakout_close 631.75 >= 645.46 → false; breakout_volume 13717500 >= 34055722.5 → false; pullback_touch 601.5 <= 574.1985 → false; pullback_close 631.75 > 574.1985 → true; extension 631.75 <= 623.7756999999999 → false
- volume: bar0 {"date":"2026-10-05","value":13717500,"usable":true,"reason":null}; avg {"value":22703815,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 10: SNOW as of 2026-09-29 — invalid(regime), regime no_trend

- facts: C=330.31, SMA_fast=332.0655, SMA_slow=319.337, SMA_slow_5ago=313.2948, swingHigh=384.56, swingLow=303.89, ATR=13.9869, V=5712000, V_avg=5599780
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [330.31,332.0655] > [332.0655,319.337] → false; slow_rising 319.337 > 313.2948 → true; regime_stack_down [330.31,332.0655] < [332.0655,319.337] → false; slow_falling 319.337 < 313.2948 → false; breakout_close 330.31 >= 384.56 → false; breakout_volume 5712000 >= 8399670 → false; pullback_touch 316.63 <= 332.0655 → true; pullback_close 330.31 > 332.0655 → false; extension 330.31 <= 360.03929999999997 → true
- volume: bar0 {"date":"2026-09-29","value":5712000,"usable":true,"reason":null}; avg {"value":5599780,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

**10.8 The join to the Oct 14 scorer (counts only).** `%USERPROFILE%\growth-replay-runs\cms-20261014T202814\results.local.json` was present; join on `battleId` + `tickId` + the swap's call (`SWAP:OUT>IN`) against the scorer's scored control rows (swap vs holding at the close; tie = within 1 point): **30 rows joined** (≥ 20). Per verdict class: invalid(no_setup) beat 2 / lost 7 / tied 0; invalid(regime) beat 8 / lost 6 / tied 0; unknown(basis_discontinuity) beat 0 / lost 2 / tied 0; valid/pullback_resume beat 3 / lost 0 / tied 2. These are counts of a join; behavioral differentiation is not measured by slice 1 and no statement is made from them.

**10.9 EODHD calls and reconstruction limits.** 29 of 60; 0 failures. Bars are a later reconstruction (the series as served at `fetchedAt`); a restated series is invisible; the split heuristic needs the vendor's adjustment already applied, trips on a special dividend above 10%, and is not proof of split-free data; the decision instant is date-only and no instant is invented; the anchor swing low is absent on every holding row; volume facts come from the EOD series, never from the rankings document the agent was shown (ID-6); verdicts are what the rule says on the series as served, dated to the prior session, never what the agent could have known.

**10.10 Historical cases (V3 §9.6).** None supplied (the founder omitted COP, XBI and LLY because their exact dates remain unavailable); `historicalCases.test.js` and `__fixtures__/historical/` do not exist; the replay's `bars --symbol X --asOf D --fixture` path exists for a later run and was not used.

## 11. The docs commit (V3 §11)

- **C1 appended** to `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` as a final section "Clarification C1 — 28 Oct 2026 (founder ruling FD-P3-1)" with the prescribed content (pattern-scoped missing facts; the four verdict requirements; a missing breakout volume never invalidates a supported pullback; the raw basis; thresholds, patterns and `setupVersion` unchanged; recorded under `tf-setup-v1/sem-1`; future rule changes subject to §7). The diff against `24495eba` is **12 insertions, 0 deletions** (`git diff --stat`), the committed blob is LF, and the appended bytes were written with the checkout's own line endings so the prefix is byte-identical (verified by the append script: prefix identical = true).
- **The review** `docs/audits/20261021_FABLE_REVIEW_ARCHETYPE_PROPOSAL.md`: committed byte-identical; the committed blob is 29,558 bytes, SHA-256 `74c7261188f080a5f766a300e22264666c6df5ee8d9f99e5def890bc5becbb14` (recorded, equal to the founder's file).
- **README rows**: the definition's row gained one sentence naming C1; rows added for the review and for this report after the changed-moments row.
- **Not committed by this build**: the Growth Loop Map (Film Room B2.1's), Practice Field V3 and Amendment A, the decision report, the resolution summary, the V3 prompt. No docs-only PR.

## 12. Deviations from the prompt's letter (each reported, none hidden)

| Id | What | Why |
|---|---|---|
| D1 | `api/_utils/setupEvaluator/volumePolicy.js` — one pure module (no imports) holding `classifyVolume`, not in V3 §3's file list | Resolution point 1 asks for ONE policy for the adapter, the evaluator, the tests and the report; the adapter may import only the calendar and two cache helpers, the evaluator only thresholds and the two primitives, so neither can host it for the other without widening its import list. One shared module keeps the policy in one place (mutant M10 proves both consumers read it). |
| D2 | `scripts/experiments/tf-setup-golden-baseline-check.test.js` — not in §3 | The founder's start instruction: "test the cross-revision rejection cases using controlled fixtures". |
| D3 | The synthetic fixture labels its evidence `evidenceClass.bars = 'synthetic'`, a third value beside §5's `later_reconstruction \| contemporaneous` | A synthetic series is neither; the honest label is kept and only the test fixture emits it. The adapter emits only the two §5 values (`barsClass`, default `later_reconstruction`). Q-TE-4. |
| D4 | The holding record carries `patterns` and `regime` | §5's common block lists `patterns` for "every entry and holding record"; `regime` is the fact `regime_flip` derives from (definition §2: "always recorded"). The holding reads no entry verdict (M15). |
| D5 | The evaluator accepts an adapter refusal (`ok: false`) and returns `unknown(<adapter reason>)` with a `refusal` field | One record shape for every replay row and report count; the derivation rule still holds (every check unknown → unknown). |
| D6 | The adapter cuts the window to the newest `minBars` rows after the expected-row and ordering checks, before the price, adjacency and split checks | "Inside the window" (§8.7–§8.9) is bounded; a bad row older than the window never affects a verdict and must not refuse one. |
| D7 | Refusals carry `checks` (and `adjustment` when computed) beside `{ ok, reason, detail, asOf, basis, source, symbol }`; ok results carry `requestedAsOf` and `symbol` | Additive; the replay's receipts show `splitCheck: 'tripped'` on the refused pair. |
| D8 | `parseEnvText`, `primaryCheckoutRoot`, `redactSecrets` restated in the replay script instead of imported from `growth-replay/growthReplay.js` | That module cannot be loaded by vitest's transform (a hermetic test imports the replay); the three helpers are ten lines each, behaviour identical. |
| D9 | The replay script's report rendering was fixed after the first `report` (a pipe inside a markdown cell; the adapter's `checks` kept on a refused pair) and `evaluate` / `report` re-run at the committed head | The evaluations are identical; the manifest's command log records every run with its head and script sha. |

## 13. Boundaries and handoff dependencies (V3 §12, preserved)

Slice 2 (the `setupVerdicts/{sessionDate}` writer and the menu label) is not built; nothing here touches `archetypeCandidateMenu.js`; the §5 record is the shape slice 2 and ID-1's snapshot will carry — the fields ID-1 names (`setupVersion`, verdict, reason, pattern, regime, the anchor swing low, basis, source, asOf) are all present, additive changes only. ID-1 (activation evidence) is not built; a missing anchor reads unknown (`structure_break`) and the provenance says `absent`. ID-6 is not built; the replay's volume facts come from the EOD series. ID-2 / P4, ID-4, FD-1 / FD-2: untouched; the battle stays one day. Practice Field: every record is labelled retrospective by its `evidenceClass`; `unknown` is never `invalid` or `broken`; every comparison names its `asOf` and basis; `chartLeg` is one leg and never decides a holding policy. Protection and execution keep their owners: no output here fires, suppresses or replaces a protective action.

## 14. Five separate conclusions (never merged)

1. **Engineering correctness — established.** Every rule and unknown path has a row asserting its correct result; the golden pins every scenario's complete record under `tf-setup-v1/sem-1`; the verdict recomputed from each record's own `checks` and `patterns` equals the record's; 34 mutants all killed; the adapter's ten rules each guarded; the replay's helpers hermetically tested; the cross-revision check's rejection cases proven on fixtures and on the real files.
2. **Replay coverage — reported, bounded.** 36 pairs over 47 rows from 486 woken checks; 29 calls; data-unknown 5.3%; one honest refusal (a corporate-action basis break); the anchor absent on every holding row; verdicts dated to the prior session on date-only evidence.
3. **Behavioral differentiation — not measured** (M3 after P4). The 30-row join is counts only.
4. **Partnership usefulness — not claimed.** The founder's read of the ten receipts (§10.7) blesses or amends the basis.
5. **Market performance — not claimed.**

## 15. Founder questions (none blocks the receipt read)

| Id | Question | Recommendation |
|---|---|---|
| Q-TE-1 | V3 §6.4 rule 4 reads "failed (all evaluable, at least one false)". So a pattern with one check false and its other check unknown (e.g. `breakout_close` false and `breakout_volume` unknown because `V` is unusable, with no pullback) is `untestable`, and the verdict is `unknown(missing_fact)` rather than `invalid(no_setup)`. The build follows the letter (M21 pins it). A short-circuit reading ("a false check fails the pattern whatever the other says") would call it `failed`. | Keep the letter: a missing fact never manufactures a definite verdict (C1's spirit), and the record shows which check was false. If the short-circuit reading is preferred, it is a `sem-2` change (new baseline entry), no threshold change. |
| Q-TE-2 | The holding evaluator evaluates each check from its own facts (per V3 §7 "`'unknown'` when either is null"), so on a short history `close_below_slow` can still be `true` (C and SMA_slow present, SMA_slow_5ago absent). The adapter enforces 55 bars on every real path, so this only shows on direct calls with fewer bars. | Keep as built; confirm that the holding carries no `MIN_COMPLETED_BARS` rule of its own. |
| Q-TE-3 | CTVA as of 2026-10-06 is `unknown(basis_discontinuity)`: EODHD's adjustment factor steps from 0.15 to 1 on 2026-10-01 while the raw series shows the price step. Under FD-P3-2 (raw) the window straddling a corporate action cannot be evaluated. | Keep the refusal (honest, typed). A later adapter slice could carry a split-adjusted raw series with the factor recorded; the definition is untouched either way. |
| Q-TE-4 | D3: the fixture's `evidenceClass.bars = 'synthetic'`. | Accept the third label for test records only, or rename it `'synthetic_test'`; the adapter never emits it. |
| Q-TE-5 | The swing extreme's date on a tie is the most recent bar (the lowest index). The value is unaffected; only `evidence.swingHigh.date` could differ under the opposite rule. | Record as a `SEMANTICS_NOTES` line (a one-line follow-up, no id change needed since no record value changes… the date in `evidence.swingHigh` is a record value, so a changed tie rule would be `sem-2`). |
| Q-TE-6 | The replay joined 30 rows to the Oct 14 scorer, above the 20-row floor, so the per-class counts are shown. They are not a measurement of anything slice 1 claims. | Read them as a coverage note only; M3 after P4 is the measurement. |
| Q-TE-7 | The definition's §4 lists `regime_flip` beside `close_below_slow`, but a downtrend regime implies `C < SMA_slow`, so `regime_flip` is never the sole reason. | No action; recorded so a future "regime_flip alone" row is not expected. |

## 16. The STOP list and the CI follow-up

- STOP conditions (V3 §0, §2): none held. Fence contact: none. Scope creep past §3: the two extra files of §12 D1–D2, reported, not scoped out.
- Follow-up outside slice 1 (one line, edits `.github/workflows/tests.yml`): run `node scripts/experiments/tf-setup-golden-baseline-check.mjs --base <merge-base with main>` as a CI step so a golden regenerated under an unchanged `SEMANTICS_ID` can never pass CI. Until then the script runs in a build's final checks (§18).
- Not in slice 1 and not assumed built: everything in V3 §1's exclusion list.

## 17. The BUILD_RULES §2 review record

<!-- REVIEW -->

## 18. Final checks

<!-- FINAL -->

## 19. Delivery state

<!-- DELIVERY -->
