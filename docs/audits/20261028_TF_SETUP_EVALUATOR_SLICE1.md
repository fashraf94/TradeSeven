# Build report — Measured Trend Evidence, slice 1 (P3): the `tf-setup-v1` evaluator

Claude Code (Claude Fable 5.1), October 28, 2026, for Flash; the closeout after the founder's rulings on the build's questions (§20) by Claude Code (Claude Opus 5.5), the same day. The build prompt was `20261028_P3_SLICE1_BUILD_PROMPT_V3.md` (the consolidated V3 prompt of October 28, under the founder's rulings FD-P3-1 option (a) — pattern-scoped missing facts — and FD-P3-2 — raw basis — and the six resolution points), started by the founder's explicit instruction of October 28, 2026 ("I approve implementation of Measured Trend Evidence Slice 1 using 20261028_P3_SLICE1_BUILD_PROMPT_V3.md"). The founder's instruction also ruled: initial golden-baseline creation reported explicitly and the cross-revision rejection cases tested on controlled fixtures; the saved October 13 capture only; date-only evidence preserved; the 60-call EODHD limit; the COP, XBI and LLY fixtures omitted. Nothing here is merged, deployed, activated or wired live. Done authorizes nothing further.

Every number below carries its class: **recorded** (read from a stored record or a file as written), **derived** (computed by this build's code from recorded inputs), **rebuilt** (reconstructed by a script from stored inputs), **market** (a bar as EODHD served it). Every codebase claim carries `file:line` with VERIFIED (read at the stated commit in this session) or ASSUMED.

## 0. Verdict

| Item | Result |
|---|---|
| **Status** | **Draft PR pushed, STOP.** Nothing merged, nothing deployed, no flag, no cron, no writer, no live use, no production capture read. (The push and PR state are in §19.) |
| Branch and head | Local branch `claude/measured-trend-evidence-slice-1-1c45de` (the desktop app's worktree name, cut at `origin/main` `24495eba`), pushed by refspec as the prompt's `claude/tf-setup-evaluator-slice1`. Code head: `e7907900` — the review fix round is `c9c02fc4` (+ `f3ae1bd1`), the mutating lens's test round `a2264f48` (+ `d04e2918`, `e7907900`); the source modules have not changed since `c9c02fc4`. The commits after it carry this report and its README row (§19). **Closeout (§20):** the corrections at `4c033d1f`; `origin/main` `62380f14` merged at `8522e656`; this report, the definition's C2 and the README rows after it. |
| Preamble | `git fetch origin` first; `origin/main` = `24495eba` (26 Oct, the #998 merge), unchanged through the build; working tree clean at the start; every §2 anchor VERIFIED (§2); no STOP condition held. |
| Slice 1 required items (V3 §1) | 1 thresholds and identity: built (§4). 2 the pure entry and holding evaluator: built (§5). 3 the rule-agnostic daily-bars adapter: built (§6). 4 tests, golden, baseline, mutation: 358 rows in seven new files at the build head (382 after the closeout, §20), all green on Windows and Linux; 79 of 79 mutants killed (§8, §9). 5 the first replay over the saved 13 Oct capture: run, 29 of the 60 allowed EODHD calls, reported as coverage with ten receipts (§10). 6 this report with the review record (§17) and the docs commit (§11). |
| Engineering correctness | Every defined rule and unknown path has a row asserting its correct result; every synthetic scenario (49) reproduces its complete record from the committed golden; the verdict recomputed from each record's own `checks` and `patterns` equals the record's; 79 mutants each red at least one row (§9). The closeout's corrections are covered by their own rows and eight spot mutants (§20.6), not by the 79. |
| Golden baseline | **Initial baseline creation.** The base revision carries no evaluator, golden or baseline, so the cross-revision check reports `mode: initial`, verifies the working tree's own integrity and claims no historical comparison. The rejection cases (a changed golden under an unchanged id, a rewritten or removed history entry, a sha mismatch at either ref, an id change without a new entry, a thresholds-hash change without a new `setupVersion`) are proven on controlled fixtures (19 rows) and by mutant M20 on the real files (§7, §9). The single entry was re-recorded during the build (after the review fix round and after the mutating lens's scenarios), before any base revision carried it (§7). **The closeout re-recorded it a fourth time, still before acceptance:** `471fce6f…` → `796e75d1…` (the `synthetic` bars class and the added `requestedAsOf`; no verdict changed), and the entry's note now carries the full trail with every previous and new hash (§20.4). `main` still carries no baseline at `62380f14`, so this remains initial baseline creation. |
| Replay coverage | 486 woken Trend Follower checks, 33 proposed and 14 executed swap-ins (all 14 coincide with their proposals), 18 incoming and 16 outgoing names, 29 battles; **33 moments** (one row per moment), 36 (symbol, asOf, role) pairs. Entry verdicts by pair: 3 `valid/pullback_resume`, 10 `invalid(regime)`, 5 `invalid(no_setup)`, 1 `unknown(basis_discontinuity)`. Data-unknown share 1 of 19 equity entry pairs = **5.3%**, within the one-quarter limit (§10). Since the closeout the run of record is run 3, `tfs-20261028T194805`, made from the cached payloads with 0 calls and identical to run 2 in every count, the join and the ten receipts (§20.5). |
| Behavioral differentiation | **Not measured** by slice 1 (M3 after P4). The join to the Oct 14 scorer's control units reached **17 moments, below the 20-moment floor: "coverage insufficient for any behavioral statement"**, and none is made (§10.8). |
| Partnership usefulness | **Not claimed.** The founder's read of the ten receipts (§10.7) is the completion step for the basis. |
| Market performance | **Not claimed.** |
| Fence | Fenced functions called: **none.** Fenced files edited: **none.** Existing source or test files edited: **none.** Existing documents edited: exactly two — `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` (clarification C1 appended by the build and C2 by the closeout; the text above each byte-identical, §11, §20) and `docs/README.md` (rows). The pilot spec V1.4's §5 wording is not touched: the record contract is reconciled only in the definition's C2. |
| Deviations from the prompt's letter | Fourteen, each small, each listed with its reason in §12; four of them are tightenings the review asked for (the holding's bar gate, a non-positive anchor read as absent, adjustment metadata requiring positive adjusted closes, the symmetric split threshold) and go to the founder as Q-TE-2, Q-TE-11, Q-TE-12 and Q-TE-13, all four confirmed by the founder's rulings (§15). The closeout adds D15 and D16, both founder-directed. |
| Review | BUILD_RULES §2 review at the threshold (20 files, +17,766 lines at the code head): five lenses on their own `git archive` trees, a refuter per lens, the mutating lens last on the fixed head — the record is §17. It covers the build head `c5602832`, **not the closeout's code** (§20): that is the independent Astra review's, which is the next step. |
| Final checks | Linux (WSL, `TZ=UTC`, `--maxWorkers=8`, `flock`): at the fix-round code head `c9c02fc4` the full suite 26,285 passed, 89 skipped, 0 failed, `lint:gate` 0, `vite build` 0, the baseline check PASS (initial); the run at the pushed head is §18. |
| Founder questions | Q-TE-1 … Q-TE-13 (§15), **all ruled by the founder on 28 Oct 2026**; the rulings are recorded in §15 and, where they bear on the definition, in its clarification C2. |
| Preview URL | Not applicable (no UI, no endpoint, no cron). |

## 1. Preamble

- `git fetch origin` was the first git command of the session; `origin/main` = `24495eba456d6cf7832ae13547cd9b75da0fb0f9` (recorded), and the worktree's branch HEAD equalled it with a clean tree: `git status --short --branch` printed only the branch line (recorded).
- Local branch `claude/measured-trend-evidence-slice-1-1c45de` (the desktop app suffixes the prompt's name); the remote branch and the PR head carry the prompt's `claude/tf-setup-evaluator-slice1` (pushed by refspec, §19).
- The other app-created branch `claude/measured-trend-evidence-slice-1-27c046` points at `0fc78b02`, an ancestor of `origin/main` with zero commits of its own (VERIFIED by `git merge-base --is-ancestor`); it was left alone.
- Session rules kept: Claude Code directly, no WMUX, no delegated workers; subagents only for the §2 review (§17); no production store read; EODHD reads capped at 60 (29 made, once; the second replay run reused the first run's hash-verified payloads with 0 calls); no write, no watcher, no model call; the EODHD key read by name from the primary checkout's `.env.local`, never printed; no owner id printed anywhere; committed artifacts carry no owner or raw battle id.

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

The strategy card of the 28 Oct decision report §2 is reproduced verbatim in the doc comment of `api/_utils/setupEvaluator/tfSetupV1.js` (the review's refuter TEV1 diffed it: byte-identical). The Phase 0 mapping (definition line 19) as built, recorded in `SEMANTICS_NOTES` (`thresholds.js`):

| Fact | Data | Decision |
|---|---|---|
| `C` | `bars[0].close`, the **raw** close (the adapter maps `rawClose` → `close`, never the adjusted value) | FD-P3-2: raw basis for every fact |
| `SMA_fast`, `SMA_slow`, `SMA_slow_5ago` | `calculateSMA` over closes of bars 0..19, 0..49 and 5..54; null when any close in the window is null or ≤ 0, or when the bars do not reach (`priceSlice`) | the 4-dp rounding of the primitive is part of the semantics; never pass a null into the primitive (it would add it as 0) |
| `swingHigh`, `swingLow` | max high / min low over bars **1..20**, bar 0 excluded, with the date of the extreme; the most recent bar wins a tie (named in `SEMANTICS_NOTES` after review TE5-7) | computed here; the pivot detector `findSwingHighsLows` answers a different question and is not reused |
| `ATR` | `calculateATR` over bars 0..14 (14 true ranges) `.value` | the primitive's 4-dp rounding kept; the window passed explicitly so the record's window is exact |
| `V`, `V_avg` | the §6.3 policy, one function `classifyVolume` (`volumePolicy.js`) for the adapter and the evaluator: usable = finite and > 0; `V` = bar 0 or null; `V_avg` = the mean of bars 1..20 only when all 20 are usable, else null with the unusable dates listed | the platform's 10-of-20 rule not adopted; no reduced-sample mean |
| Expected session | computed from the calendar before any row is read (`expectedCompletedSession`); rows after it dropped (rows after today's ET date counted apart); `rows[0].date` must equal it, else `missing_bar {expected, latest}` | resolution point 2: never redefined to an older row |
| Adjustment provenance and the split heuristic | `attachAdjustedClose(rows, payload)` sets `adjustedClose` per row (finite or null); metadata `present` only when every window row carries a finite adjustedClose **greater than zero** (review TE2-1); the heuristic — ratio `adjustedClose / close`, day over day, symmetric `1 − min/max > 0.10` (review TE2-5) → `basis_discontinuity` — runs only then; otherwise `splitCheck: 'not_available'` with the typed reason (`adjustment_metadata_absent`, `adjusted_close_missing`, `adjusted_close_nonpositive`) | resolution point 3: a ratio of 1 proves nothing; presence never inferred. Stated limits: the vendor's adjustment must already be applied; a special dividend above 10% trips it; a restated series is invisible; it is not proof of split-free data |
| Regime | uptrend when `regime_stack` and `slow_rising` are true; downtrend when both mirrors are true; otherwise no_trend; unknown when any of the four regime facts is null; the chained checks read unknown before false, symmetrically (review TE1-4) | the four regime checks are recorded on every record |
| Patterns and the verdict | `derivePatterns` (satisfied / failed only when every check is evaluable / untestable) and `deriveEntryVerdict` (V3 §6.4 rules 1–6) read `checks`, `patterns` and the bar count and nothing else | BUILD_RULES §9: the verdict derives from what the record shows |
| The holding | the three chart-leg checks from their own facts; every check unknown below `MIN_COMPLETED_BARS` (review TE5-3); the anchor is a price — null, non-finite or non-positive reads absent (review TE1-3); no pattern assessment on a held name's record (reviews TE1-2, TE5-6) | the record says `history { count, required, sufficient }` and `anchorSwingLow { value, provenance }` |

## 4. Thresholds and identity (`api/_utils/setupEvaluator/thresholds.js`)

- `TF_SETUP_V1_THRESHOLDS`: S1 20, S2 50, S3 20, S4 14, S5 20, S6 5, S7 1.5, S8 3, S9 `'none'`, S10 2.0 — frozen, in the declared key order (VERIFIED against the definition §8).
- `SETUP_VERSION = 'tf-setup-v1'`; `THRESHOLDS_HASH = '26f3f411b566'` (derived: sha256 of `JSON.stringify` in the declared key order, first 12 hex), computed by `hashThresholds` at module load — a source-text tripwire in `thresholds.test.js` fails if it is ever pasted as a constant; a changed value or key order changes it (rows).
- `SEMANTICS_ID = 'tf-setup-v1/sem-1'`; `SEMANTICS_NOTES` (thirteen frozen strings) names C1, the pattern-assessment rule, the raw basis, the bar order, the windows, the equality boundaries, the volume policy, the rounding, the calendar-expected session rule, the split heuristic and provenance rule (with the symmetric threshold and the positive-adjusted-close requirement), the regime rule, the swing tie rule, and the holding's bar gate and anchor rule.
- `MIN_COMPLETED_BARS = 55` (the smallest count that fills every window: `SMA_slow_5ago` reads bars 5..54).
- `describeRuleSet()` → `{ setupVersion, thresholdsHash, semanticsId }`, frozen, on every record.

## 5. The evaluator (`api/_utils/setupEvaluator/tfSetupV1.js`)

Pure: no clock, no I/O; imports `thresholds.js`, `volumePolicy.js` and `calculateSMA` / `calculateATR` only. `computeTfFacts(evidence)` → the nine facts and the `evidence` block; `entryChecks` → the nine checks (`regime_stack`, `slow_rising`, `regime_stack_down`, `slow_falling`, `breakout_close`, `breakout_volume`, `pullback_touch`, `pullback_close`, `extension`, each `{ id, lhs, op, rhs, result: true | false | 'unknown', facts }`); `evaluateTfEntry(evidence)` and `evaluateTfHolding(evidence, { anchorSwingLow })` assemble the records of V3 §5. The holding record carries the four regime checks plus `close_below_slow`, `structure_break` (unknown when the anchor is absent, non-finite or non-positive; `anchorSwingLow: { value, provenance: 'supplied' | 'absent' }`) and `regime_flip`; `chartLeg` = broken / intact / unknown from those three and nothing else; `reasons` lists the true checks; `history { count, required: 55, sufficient }` says whether the checks were gated. The holding never reads an entry verdict (a row attaches a valid and an invalid(extended) entry record and proves the chart leg unchanged) and carries no `patterns`.

C1 as applied (FD-P3-1 option (a)), the six verdict rules of V3 §6.4, in `deriveEntryVerdict`:
1. fewer than 55 bars → `unknown(insufficient_history)`, regime `unknown`;
2. any regime fact null → `unknown(missing_fact)`, regime `unknown`, every fact recorded;
3. regime not uptrend → `invalid(regime)`;
4. in uptrend each pattern is `satisfied` (every check true), `failed` (every check evaluable, at least one false) or `untestable` (a check unknown) — recorded in `patterns` on every entry record, whatever the regime;
5. any pattern satisfied → the extension check: ATR null → `unknown(missing_fact)` (the `c1_pullback_null_atr` scenario and mutant M4b pin this branch, review TE1-1); false → `invalid(extended)` (the satisfied patterns still listed); else `valid`, `pattern` the first satisfied in the order breakout, pullback_resume, `patternsSatisfied` all of them — a missing breakout volume never invalidates a supported pullback;
6. none satisfied: all failed → `invalid(no_setup)`; any untestable → `unknown(missing_fact)` listing the missing facts.

An adapter refusal (`ok: false`) evaluates to `unknown(<the adapter's reason>)` with every fact null, every check unknown, both patterns untestable (entry) and a `refusal: { reason, detail }` field (copied, never shared), so the replay's rows have one shape (a deviation reported in §12). Records share no object with their input (`sourceMeta` and `adjustment` copied).

## 6. The adapter (`api/_utils/setupEvaluator/dailyBarsAdapter.js`)

`expectedCompletedSession({ asOf, now })`, `attachAdjustedClose(rows, payload)` and `buildDailyEvidence({ rows, asOf, now, minBars, source, sourceMeta, symbol, barsClass })`, the ten rules of V3 §8 in order: the symbol class; the expected completed session from the calendar before any row (a malformed `asOf` is `calendar_missing` with `why: 'malformed_date'`); the raw mapping and the drop of rows after the expected session (counted in `dropped`, those after today's ET date also in `droppedAfterToday`); `rows[0].date === expected` or `missing_bar {expected, latest}`; strictly decreasing dates (a malformed date is `unordered_bars`); `insufficient_history`; the window = the newest `minBars` rows; inside it a window row dated on a non-session is `unordered_bars { why: 'non_session_date', date }`, a null or ≤ 0 close/high/low is `missing_fact {fact, date, value}` (never dropped, never filled) and every volume is classified (`volumeClass`) with its value preserved; adjacency by `getPreviousTradingDay` when both years are maintained, else `checks.adjacency = 'not_available'`; the split heuristic with explicit provenance; the window with `basis: 'raw'`, `source`, `sourceMeta`, `evidenceClass: { bars }`, `checks { completedSession, adjacency, splitCheck, splitCheckReason }`, `adjustment { metadata, missingDates }`, `dropped`, `droppedAfterToday`, `asOf = bars[0].date`, `requestedAsOf`. Every refusal carries the requested `asOf`, `expected` (once the calendar named it), `basis`, `source`, `symbol`, `evidenceClass` and the one `checks` shape. The clock is injected: a missing or invalid `now` throws; `minBars` is the caller's (the adapter knows no Trend Follower rule).

An upstream fact, stated in the adapter's header and in the replay's report (review TE2-3): `mapDailyRows` drops a row whose close (after the adjusted fallback), high or low is not finite before the adapter sees it, so such a session reads as `missing_bar` here, not `missing_fact`; the replay names it (`why: 'mapper_dropped_row'` with the null fields) and counts the mapper's drops on its EODHD line. The mapper is an existing file and was not edited.

## 7. The golden-verdict fixture and the baseline (V3 §4.3)

- `__fixtures__/syntheticBars.js`: 49 deterministic scenarios (35 entry, 14 holding) on hand-checkable arithmetic (closes 100 − 0.25·i, range ±1.5 or ±0.5, one volume); dates walk the calendar of record backwards from 2026-10-09. The "at the guard" scenario is constructed so every number is dyadic and `C = SMA_fast + 2·ATR` exactly (ATR 1.1875, guard 100.0000 = C). The fixture labels its evidence `source: 'synthetic'` and, since the closeout, `evidenceClass.bars: 'synthetic'` (the founder's ruling on Q-TE-4; it read `'later_reconstruction'` before, §20).
- `__fixtures__/goldenVerdicts.json` (canonical form: sorted keys, 2-space, LF): the complete record of every scenario under `tf-setup-v1 / 26f3f411b566 / tf-setup-v1/sem-1`; canonical SHA-256 `796e75d1486c5581245edf43cdcd79f52b0f2d4e49010d0f8ba9ec79a8424b03` since the closeout (derived; `471fce6fdd094753c6e02720b81425fcd853f426ec61a07ca9ab7aca192cf4e9` at the build head; the trail is §20.4).
- `__fixtures__/goldenBaseline.json`: one entry — `{ semanticsId: 'tf-setup-v1/sem-1', goldenSha256: '471fce6f…', recordedAt: '2026-10-28T17:36:40.299Z', note: 'Initial baseline … Initial baseline creation: no earlier baseline exists at the base revision. Re-recorded during the build, before any base revision carried an entry: after the §2 review fix round (three scenarios added, holding records without pattern assessments, symmetric regime chains) and after the mutating lens (six scenarios added …).' }`. **The re-recording is stated, not hidden:** the first entry (golden `d3501e5f…`, recorded 16:14 UTC) was replaced after the review fix round changed the catalogue and the holding record shape (`34e3ec85…`), and again after the mutating lens added six scenarios (`471fce6f…`); the base revision carries no baseline, so the §4.3 append-only rule had nothing to append to, and the cross-revision check against the base stays in `initial` mode — it has no teeth until an entry is on `main` (lens TE3-13), which is why the review's refuters read the regenerations on the branch, not against the base. After merge, the same kind of change costs a new entry (Q-TE-8). **The closeout re-recorded the entry once more before acceptance** (`471fce6f…` → `796e75d1…`, recordedAt `2026-10-28T19:45:07.229Z`), and the note now lists all four regenerations with their previous and new hashes (§20.4).
- In-revision (`golden.test.js`, 55 rows): every scenario reproduces its full record; the file is in canonical form; the baseline's last entry carries the golden's canonical sha and `SEMANTICS_ID`; ids unique and in order; `recordedAt` ISO; the note names C1 and FD-P3-1; the golden computed now hashes to the last entry's sha.
- Cross-revision (`scripts/experiments/tf-setup-golden-baseline-check.mjs --base <ref>`): reads the baseline, the golden and `thresholds.js` at the base ref via `git show` (the base `thresholds.js` is imported from a temp copy, removed afterwards) and at the working tree; `compareRevisions` is pure and tested on controlled fixtures (19 rows); the history is ordered by `(setupVersion, sem)` so a new `setupVersion` may restart at `sem-1` (review TE5-8). **Output against the merge-base** (`git merge-base HEAD origin/main` = `24495eba`), recorded at the code head:

```
tf-setup golden baseline check — mode: initial (initial baseline creation)
  base 24495eba456d6cf7832ae13547cd9b75da0fb0f9 = 24495eba456d6cf7832ae13547cd9b75da0fb0f9: no evaluator baseline, golden or thresholds
  head (working tree, HEAD e79079005e3c00b0e7ab21833de1aab403f76c38): tf-setup-v1/sem-1, golden 471fce6fdd09…, thresholds tf-setup-v1/26f3f411b566, 1 entry
  note: initial baseline creation: the base ref carries no evaluator baseline; only the working tree's own integrity is verified and no historical comparison is claimed
  result: PASS
```

No historical comparison is claimed: there is no earlier baseline. The rejection cases are proven on fixtures (§8) and, for the one that matters most, on the real files by mutant M20 (§9): with the golden regenerated under a changed evaluator and the id unchanged, `golden.test.js` reds (the baseline sha row) and the script against `--base HEAD` fails with three named failures (the sha mismatch, the changed golden under an unchanged id, no appended entry).

## 8. The fixture matrix and the test files

Seven new test files, **358 rows** (`thresholds.test.js` 7 · `tfSetupV1.entry.test.js` 151 · `tfSetupV1.holding.test.js` 45 · `dailyBarsAdapter.test.js` 55 · `golden.test.js` 55 · `tf-setup-corpus-replay.test.js` 26 · `tf-setup-golden-baseline-check.test.js` 19; **382** after the closeout, with `dailyBarsAdapter.test.js` at 77 and `tf-setup-corpus-replay.test.js` at 28, §20), all green on Windows (the mutation baseline run) and on Linux (§18). Every V3 §9.1–§9.5 and §9.7 row has a test; §9.6 (historical cases) is omitted because no case was supplied (the founder's instruction). Real imports throughout (the dependency-surface guards named in each file's header); `pinTimezoneUtc.js` first in every file that builds a `Date`; no network; nothing mocked.

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
| `bounce_fast_below_slow` | entry | invalid(regime) (SMA_fast < SMA_slow, SMA_slow not rising) | no_trend | — | failed / failed |
| `stack_fast_below_slow_rising` | entry | invalid(regime) (C > SMA_fast, SMA_fast < SMA_slow, SMA_slow rising) | no_trend | — | failed / failed |
| `stack_middle_inequality_only` | entry | invalid(regime) (C 110 above both averages, SMA_fast 95.75 < SMA_slow 101.3, SMA_slow rising: only the middle inequality fails) | no_trend | — | failed / satisfied |
| `stack_down_slow_not_falling` | entry | invalid(regime) (the mirror stack holds but SMA_slow is not falling) | no_trend | — | failed / failed |
| `bars_54` | entry | unknown(insufficient_history) | unknown | SMA_slow_5ago | failed / failed |
| `bars_55` | entry | invalid(no_setup) (evaluable) | uptrend | — | failed / failed |
| `c1_pullback_null_bar0_volume` | entry | valid / pullback_resume | uptrend | V | untestable / satisfied |
| `c1_breakout_price_unusable_volume` | entry | unknown(missing_fact), not no_setup | uptrend | V | untestable / failed |
| `c1_zero_volume_in_window` | entry | valid / pullback_resume | uptrend | V_avg | untestable / satisfied |
| `c1_pullback_null_atr` | entry | unknown(missing_fact): the pullback satisfied, the extension check unknown (rule 5) | uptrend | swingLow, ATR | failed / satisfied |
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
| `holding_history_54_close_below_slow` | holding | unknown (54 bars: every check gated, though C < SMA_slow and C > the anchor) | unknown | anchor 80 | — |
| `holding_anchor_zero` | holding | unknown (a non-positive anchor reads absent) | uptrend | absent | — |
| `holding_stack_down_slow_not_falling` | holding | broken [close_below_slow] only (the mirror stack holds, SMA_slow not falling, so regime_flip is false) | no_trend | anchor 40 | — |
| `holding_regime_unknown_only` | holding | unknown (55 bars, a null close at bar 52: regime_flip alone unknown, never intact) | unknown | anchor 90 | — |
| `holding_boundaries_equal` | holding | intact (a flat series at 100 with the anchor at 100: both checks strict) | no_trend | anchor 100 | — |

Also asserted outside the golden: a null regime fact (a null close at bar 30) → `unknown(missing_fact)` with every other fact recorded and the chained regime checks unknown symmetrically; `V_avg` as the mean of all 20 bars (1,000,210 from 1,000,020 … 1,000,400); a non-positive close → `C` null; a non-price low in the touch window recorded as null in `pullbackLows`; `swingLow` ignoring a bar-0 low below every other low; the swing tie date on `flat_slow_sma` (bars 1..4 tie at 102.5 → bar 1's date); the preserved unusable bar-0 volume value (−5, 0); the adapter refusal record with its detail deep-copied (a nested array not shared); the holding's independence from any attached entry record; anchors 0, −0 and −1 beside the non-finite ones; a 55-bar holding evaluating with `history.sufficient`; a one-cent drop on a flat series breaking all three holding checks (by the definition a downtrend); every record's shape; determinism and unmutated frozen inputs with no shared object; the adapter's `minBars` validation, the ET date against the UTC date at 22:00 ET, the previous-session calendar gap, a non-positive `high`, both edges of the adjacency window; the replay's tie band at ±1 exactly, the quarter limit at exactly 0.25, receipt ordering by date before symbol, the tick-id colon; equal `recordedAt` on consecutive baseline entries; the end-to-end adapter → entry record on the shared EOD fixture series re-dated onto sessions (`invalid(regime)` / downtrend with the nine facts pinned).

One observation for the record: `regime_flip` cannot be true in isolation — the downtrend mirror (`C < SMA_fast < SMA_slow`) puts `C` below `SMA_slow`, so `close_below_slow` is true whenever `regime_flip` is; the row says so (Q-TE-7).

## 9. The mutation table (V3 §9.8)

Run on a scratch `git archive` tree of the code head (never committed; `node_modules` junctioned; `TZ=UTC`), one mutant at a time with the seven test files, the file restored after each and the tree proved identical to the committed blobs afterwards. **Pass 4 (at the refuter TEV3's rows, `c5602832`): baseline 358/358; 9 of 9 killed (M70–M78). Pass 3 (at the mutating lens's round, `a2264f48` → `e7907900`): baseline 354/354; 70 of 70 killed. Together 79 of 79, no survivor** — every §9.8 mutant (M1–M20), twenty-nine from the four non-mutating lenses and their refuters (M4b, M21–M49), twenty from the mutating lens TE3 (M50–M69) and nine from its refuter TEV3 (M70–M78). Pass 2 (at `c9c02fc4` + `f3ae1bd1`) was 49 of 49; pass 1 (at `78d37087`, before the fix round) 34 of 34, its first run discarded because the driver had snapshotted the golden after M20's regeneration — the driver was fixed and the pass re-run clean. Three corrections are recorded as such: M42's find string matched two lines and was narrowed; M45 survived until a row was added for a plan and a report on the same dirty tree; M50 survived TE3's own proposed row (with `C` below `SMA_slow` the dropped middle inequality still reads false) until a scenario with `C` above both averages was added — the kill is by the golden and a named row.

| Mutant | What changed | Result | A row that went red |
|---|---|---|---|
| M1 | `>=` → `>` on the breakout close | KILLED (38 red of 316) | golden: `breakout_at_swing_high`; entry: C equal to swingHigh is valid |
| M2 | 1.5 → 1.0 | KILLED (49) | thresholds: the hash literal; entry: 1.49× is no_setup |
| M3 | swing window includes bar 0 | KILLED (41) | golden: `uptrend_no_setup`; entry: swingHigh 101.25 on bar 1 |
| M4 | extension guard removed | KILLED (7) | golden: `extended_pullback`; entry: invalid(extended) |
| M4b | the ATR-null extension branch removed (a satisfied pattern falls through to valid) | KILLED (3) | golden: `c1_pullback_null_atr`; entry: rule 5 (review TE1-1) |
| M5 | rising window 5 → 1 | KILLED (52) | adapter end-to-end pinned record; thresholds slot |
| M6 | regime needs only `C > SMA_fast` | KILLED (4) | golden: `bounce_fast_below_slow`; entry: no_trend |
| M7 | pullback window 3 → 5 | KILLED (64) | entry: a touch on bar 3 only is not a pullback |
| M8 | unusable `V` treated as 0 | KILLED (15) | golden: `c1_pullback_null_bar0_volume`; entry: missing [V] |
| M9 | `V_avg` over 19 usable bars | KILLED (11) | golden: `c1_zero_volume_in_window`; entry: V_avg null, 19 usable |
| M10 | zero volume usable | KILLED (8) | adapter: a zero volume classified `zero`; entry: `volume_bar0_zero` |
| M11 | the adapter keeps the current-session row | KILLED (5) | adapter: today at 15:59 ET expects the previous session |
| M12 | the adapter falls back to the newest remaining row | KILLED (2) | adapter: the expected previous-session row missing is `missing_bar`, never a fallback |
| M13 | `minBars` 55 → 50 | KILLED (35) | adapter: 54 rows is insufficient_history; entry: 54 bars; holding: the 54-bar gate |
| M14 | `structure_break` with a null anchor returns false | KILLED (10) | golden: `holding_anchor_absent_all_false`; holding: structure_break unknown |
| M15 | the holding reads the entry verdict | KILLED (1) | holding: the same chart leg with a valid, an invalid or no entry attached |
| M16 | the split heuristic runs with `adjustedClose` absent | KILLED (3) | adapter: rows without the key → metadata absent, not_available |
| M17 | `THRESHOLDS_HASH` from a constant | KILLED (1) | thresholds: the source-text tripwire |
| M18 | `factsUsed.SMA_fast` re-derived (drifts one tick) | KILLED (46) | adapter end-to-end pinned facts; entry: SMA_fast 97.625 |
| M19 | `checks` dropped while the verdict stays | KILLED (118) | golden: every entry scenario; entry: the verdict recomputed from checks |
| M20 | the golden regenerated with `SEMANTICS_ID` unchanged (under M1) | KILLED (2 of 49 in-revision) + the cross-revision script FAILS (3 failures) | golden: the baseline's last sha; script: "golden bytes changed but SEMANTICS_ID is still tf-setup-v1/sem-1" |
| M21 | a pattern with one false and one unknown check reads failed (short-circuit) | KILLED (25) | golden: `c1_pullback_null_bar0_volume`; entry: breakout untestable |
| M22 | `V_avg` window includes bar 0 | KILLED (24) | golden: `breakout_at_swing_high`; entry: `volume_bar0_null` keeps V_avg |
| M23 | `pullback_close` `>` → `>=` | KILLED (35) | entry: a close at SMA_fast is not a resume |
| M24 | extension `<=` → `<` | KILLED (35) | entry: C exactly at the guard is valid |
| M25 | the adapter's adjacency check removed | KILLED (2) | adapter: a removed weekday inside the window is missing_bar |
| M26 | the adapter never drops rows after the expected session | KILLED (5) | adapter: today before the close drops the current row |
| M27 | the adapter ignores the early close | KILLED (4) | adapter: 27 Nov at 13:00 ET is complete |
| M28 | the adapter treats a zero close as a price | KILLED (1) | adapter: a 0 close is missing_fact |
| M29 | replay `asOf` = the check's own session | KILLED (4) | replay: 13 Oct reads 12 Oct |
| M30 | replay call cap off by one | KILLED (1) | replay: the 61st request refused |
| M31 | replay reads the owner into a row | KILLED (2) | replay: never carries the owner |
| M32 | the baseline check accepts a changed golden under an unchanged id | KILLED (1) | baseline: REJECTS a changed golden under an unchanged id |
| M33 | the baseline check accepts a rewritten history entry | KILLED (2) | baseline: REJECTS a rewritten historical entry |
| M34 | replay population includes CPU owners | KILLED (1) | replay: the population filter |
| M35 | the holding's history gate removed | KILLED (7) | golden: `holding_short_history`, `holding_history_54_close_below_slow` |
| M36 | a non-positive anchor counts as supplied | KILLED (3) | golden: `holding_anchor_zero`; holding: anchors 0, −0, −1 absent |
| M37 | the regime chain short-circuits on a false pair before checking for a null operand | KILLED (1) | entry: the chained regime checks read unknown symmetrically |
| M38 | a zero adjusted close counts as adjustment metadata | KILLED (1) | adapter: a zero or negative adjusted close is not metadata |
| M39 | the split threshold back to the asymmetric form | KILLED (1) | adapter: a 9.5% step is ok in either direction, 11% trips in either |
| M40 | non-session rows accepted inside the window | KILLED (2) | adapter: weekend and holiday dates refuse by name |
| M41 | the replay emits two rows for a coinciding proposed and executed swap | KILLED (1) | replay: a coinciding pair is ONE row of kind both |
| M42 | the replay join counts a moment twice | KILLED (1) | replay: a moment counted once even if two rows share the tick and the call |
| M43 | holding records carry a pattern assessment again | KILLED (23) | golden: every holding scenario; holding: no `patterns` |
| M44 | `pullbackLows` records a non-price low as a number | KILLED (1) | entry: a non-price low recorded as null, as the check reads it |
| M45 | replay provenance drift ignores a dirty or unknown report-time tree | KILLED (1) | replay: plan and report on the same dirty or unknown tree are drift |
| M46 | the baseline history ordered by sem alone (version-blind) | KILLED (1) | baseline: a new version may restart at sem-1 |
| M47 | the capture's `etDate` checked by regex only | KILLED (1) | replay: 2026-02-30 refused |
| M48 | the summary keeps the capture's key names | KILLED (1) | replay: the summary carries no `keys` |
| M49 | refusals carry no evidence class | KILLED (2) | adapter: every refusal carries the bars class |
| M50 | TE3 T12: the regime stack's middle inequality dropped (`C > SMA_fast && C > SMA_slow`) | KILLED (3 of 354) | golden: `stack_middle_inequality_only`; entry: C above both averages with SMA_fast < SMA_slow is no_trend |
| M51 | TE3 T1: the downtrend needs only `regime_stack_down` | KILLED (5) | golden: `stack_down_slow_not_falling`; entry: the mirror stack with SMA_slow not falling is no_trend |
| M52 | TE3 T2: `deriveChartLeg` ignores `regime_flip` | KILLED (3) | golden: `holding_regime_unknown_only`; holding: regime_flip alone unknown → chart leg unknown |
| M53 | TE3 T3: the adapter's price check omits `high` | KILLED (1) | adapter: a zero or negative high is missing_fact |
| M54 | TE3 T4: adjacency stops one pair before the oldest edge | KILLED (1) | adapter: the gap check reaches both edges of the window |
| M55 | TE3 T5: `previousEtDate` null no longer `calendar_missing` | KILLED (1) | adapter: today before the close with no maintained previous session |
| M56 | TE3 T6: the join's beat threshold `> 0` | KILLED (1) | replay: the tie band is exactly ±1 point |
| M57 | TE3 T7: the quarter limit `>=` | KILLED (1) | replay: a share of exactly 0.25 is within |
| M58 | TE3 T8: receipts ordered by symbol only | KILLED (1) | replay: the earliest check wins inside a class |
| M59 | TE3 T9: baseline `recordedAt` `<` → `<=` | KILLED (1) | baseline: two entries at the same instant are in order |
| M60 | TE3 T10: `swingLow` window includes bar 0 | KILLED (11) | entry: a bar-0 low below every other low is not the swing low; adapter end-to-end |
| M61 | TE3 T11: the swing tie rule flipped | KILLED (4) | entry: a tie records the most recent bar's date; golden: `flat_slow_sma` |
| M62 | TE3 T13: `close_below_slow` `<` → `<=` | KILLED (3) | golden: `holding_boundaries_equal`; holding: C equal to SMA_slow is intact |
| M63 | TE3 T14: `structure_break` `<` → `<=` | KILLED (3) | golden: `holding_boundaries_equal`; holding: C equal to the anchor is intact |
| M64 | TE3 T15: `today` = the UTC date of `now` | KILLED (1) | adapter: at 22:00 ET the next date is still in the future |
| M65 | TE3 T16: `minBars` validation dropped | KILLED (1) | adapter: minBars must be a positive integer |
| M66 | TE3 T17: refusal detail shallow-copied | KILLED (1) | entry: a nested detail array is not shared |
| M67 | TE3 T18: tickId prefix without the colon | KILLED (1) | replay: `b10:3` under `b1` is flagged |
| M68 | TE3 T21: `bar0.value` nulled when unusable | KILLED (5) | golden: `volume_bar0_zero`; entry: the observed value preserved |
| M69 | the holding gate `>` instead of `>=` at 55 | KILLED (5) | golden: `holding_regime_unknown_only`; holding: 55 bars evaluate |
| M70 | TEV3-1: the adapter refuses exactly `minBars` rows (`<` → `<=`) | KILLED (1) | adapter: exactly 55 rows is ok |
| M71 | TEV3-2: the join ignores `controlMainRows` | KILLED (1) | replay: a moment keyed only in the scorer's main control set joins |
| M72 | TEV3-3: drift ignores the evaluate-time provenance | KILLED (1) | replay: a report at another head than its evaluate is DRIFT |
| M73 | TEV3-4: refusal records carry no `checks` | KILLED (2) | entry: the nine ids on a refusal; holding: the seven |
| M74 | TEV3-5: the join's `status` guard dropped | KILLED (1) | replay: a `not_scored` point does not join |
| M75 | TEV3-5: the join's numeric-delta guard dropped | KILLED (1) | replay: a scored point without a delta does not join |
| M76 | TEV3-6: only the last entry's sha format checked | KILLED (1) | baseline: entry 0's malformed sha fails integrity |
| M77 | TEV3-7: the adjustment's `missingDates` array shared with the input | KILLED (1) | entry: the record's dates array is a copy |
| M78 | TEV3-8: `pickReceipts` no longer skips entry-less rows | KILLED (1) | replay: an unfetched pair is skipped, never thrown on |

## 10. The first replay run (V3 §10)

Three runs were made, all in `%USERPROFILE%\tf-setup-replay-runs\` (outside the repo; `rows.local.json` carries battle and tick ids and is never committed; `manifest.json`, `evaluations.json`, `summary.json` and `report.md` carry none). **Since the closeout the run of record is run 3, `tfs-20261028T194805` (§20.5), identical to run 2 in every count, the join and the ten receipts; this section describes run 2, `tfs-20261028T170355`,** produced at head `10f534b2` (clean, plan / evaluate / report provenance identical, no drift) after the review fix round; it reused run 1's 29 cached EODHD payloads (each re-verified against its `payloadSha256`; 0 new calls). **Run 1, `tfs-20261028T162026`** (plan and bars at `ed34f212`, 29 calls), is superseded: it emitted two rows for each of the 14 moments whose proposed and executed swap coincide (review TE5-1), so its per-row tables and its 30-row join double-counted them; its (symbol, asOf, role) evaluations are identical to run 2's. The founder's "60-call" limit was spent once: 29 calls in total.

Provenance recorded in run 2's manifest and in every output: HEAD `10f534b2` at every command, tree clean at every command, script sha `a256088277e1…`, module hashes (`thresholds a288db4b7414…`, `volumePolicy f05f58a3c53f…`, `tfSetupV1 55c1acb7d711…`, `dailyBarsAdapter 90ca74210f25…`), `ruleSet { tf-setup-v1, 26f3f411b566, tf-setup-v1/sem-1 }`, the capture's sha `8bc76a9e20d0…`, size, record count and time fields, the run instant `2026-10-28T17:03:58.481Z`. Commands: `selftest` (8/8) · `plan` · `bars` (29 cached) · `evaluate` · `report`.

**10.1 Scope and the fields (re-verified before the path was defined).** The saved 13 Oct capture only; no Firestore read; the `owner` field never read. `verifyCaptureFields` confirmed `etDate` as the only time-shaped field, every `etDate` a real calendar date, and `tickId = <battleId>:<seq>` on all 2,823 records before `plan` defined the path (recorded in the manifest).

**10.2 Population (recorded).** Trend Follower non-CPU records 692; woken 486; battles 29; proposed swap-ins 33; executed 14; proposed and executed coincide on all 14; distinct incoming names 18 (`AFRM AMAT AMD COP CTVA CVX DHR GEV MAR META MPC MSFT MU PANW PLTR PM SNOW V`); distinct outgoing names 16 (`AMD AMZN BE BTC CEG DE ETN GME GOOGL LLY LRCX MAR META PANW PWR RKLB`); woken checks per month 2026-09: 170, 2026-10: 316; malformed symbols 0. These equal the counts the prompt expected (486 / 33 / 14 / 18). **Rows (moments): 33** — 19 proposed-only (the model proposed, the platform did not execute) and 14 `both`; 0 executed-only.

**10.3 The cutoff.** `asOf = getPreviousSessionDate(etDate)` — the last session strictly before the check's ET date, never the check's own; 0 rows `calendar_missing`; each row carries `decisionInstant: { etDate, precision: 'date' }` and `evidenceClass: { decision: 'contemporaneous', bars: 'later_reconstruction', verdict: 'derived' }`; `now` = the run instant, so the adapter's expected session equalled `asOf` on every pair (`checks.completedSession = 'complete'` throughout; rows after `asOf` dropped, 0–14 per pair; 0 rows after today).

**10.4 The plan (printed before any provider call, recorded).** 36 (symbol, asOf, role) pairs — 19 entry (incoming names) and 17 holding (outgoing names) — over 29 distinct equity symbols → **29 EODHD calls (cap 60)**; `BTC` skipped as crypto (its holding side unevaluated on 12 rows, counted); `from` 2026-05-14 (the earliest asOf 2026-09-21 − 130 days), `to` 2026-10-09 (the latest asOf). Bars: one `/eod/` request per symbol (`period=d&order=d&fmt=json`, symbol via `formatEODHDSymbol(getCleanSymbol(s), false)`), 103 rows each (market), cached in the run folder with `fetchedAt`, mapped by `mapDailyRows` (0 rows dropped by the mapper) then `attachAdjustedClose`; every window had adjustment metadata present and the heuristic ran on all 36.

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

(The "Rows" column counts run 1's rows per pair, as planned; run 2 plans the same pairs with one row per moment.)

**10.5 Verdicts (derived; counts only).** Entry, by pair (19): valid/pullback_resume 3, invalid(regime) 10, invalid(no_setup) 5, unknown(basis_discontinuity) 1; no valid/breakout, no invalid(extended), no missing_fact. Entry, by moment (33 rows): valid/pullback_resume 3, invalid(regime) 13, invalid(no_setup) 16, unknown(basis_discontinuity) 1. Regime by moment: uptrend 19, no_trend 13, unknown 1 (no downtrend). Pattern assessments by moment: breakout failed / pullback failed 24; breakout failed / pullback satisfied 8; both untestable 1. Missing facts: only the one refused moment (all nine). Holding, by moment (21 rows with an equity outgoing name): unknown 18, broken 3 (CEG as of 2026-10-05, `close_below_slow`); `structure_break` unknown on every row (the anchor is ID-1's record, absent throughout); no `regime_flip`.

**10.6 Data-unknown share.** Over distinct equity (symbol, asOf) entry pairs: 1 unknown of 19 attempted = **5.3%** (limit one quarter: within; nothing rejected). The one unknown is `CTVA` as of 2026-10-06: `basis_discontinuity` at 2026-10-01 — the adjusted/raw ratio is 0.1500 on the rows before that date and 1 after (the vendor's adjustment factor shows a corporate action on 1 Oct 2026 that the raw series carries as a ~6.7× price step), so every window straddling it is refused as designed; the refuter TEV2 reproduced the behaviour on a synthetic series and confirmed the refusal is confined to windows that straddle the step. The verdict is honest (`unknown`, never `invalid`); how a split-adjusted raw series could serve such windows is an adapter question for a later slice, not a definition change (Q-TE-3). Crypto: `BTC` on the outgoing side of 12 moments, not fetched, reported separately; `calendar_missing` 0; malformed symbols 0; unfetched pairs 0; mapper-dropped rows 0.

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

#### Receipt 8: AMD as of 2026-10-05 — invalid(no_setup), regime uptrend

- facts: C=631.75, SMA_fast=574.1985, SMA_slow=515.7302, SMA_slow_5ago=506.9552, swingHigh=645.46, swingLow=458, ATR=24.7886, V=13717500, V_avg=22703815
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [631.75,574.1985] > [574.1985,515.7302] → true; slow_rising 515.7302 > 506.9552 → true; regime_stack_down [631.75,574.1985] < [574.1985,515.7302] → false; slow_falling 515.7302 < 506.9552 → false; breakout_close 631.75 >= 645.46 → false; breakout_volume 13717500 >= 34055722.5 → false; pullback_touch 601.5 <= 574.1985 → false; pullback_close 631.75 > 574.1985 → true; extension 631.75 <= 623.7756999999999 → false
- volume: bar0 {"date":"2026-10-05","value":13717500,"usable":true,"reason":null}; avg {"value":22703815,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 9: SNOW as of 2026-09-29 — invalid(regime), regime no_trend

- facts: C=330.31, SMA_fast=332.0655, SMA_slow=319.337, SMA_slow_5ago=313.2948, swingHigh=384.56, swingLow=303.89, ATR=13.9869, V=5712000, V_avg=5599780
- missing: []; patterns: {"breakout":"failed","pullback_resume":"failed"}
- checks: regime_stack [330.31,332.0655] > [332.0655,319.337] → false; slow_rising 319.337 > 313.2948 → true; regime_stack_down [330.31,332.0655] < [332.0655,319.337] → false; slow_falling 319.337 < 313.2948 → false; breakout_close 330.31 >= 384.56 → false; breakout_volume 5712000 >= 8399670 → false; pullback_touch 316.63 <= 332.0655 → true; pullback_close 330.31 > 332.0655 → false; extension 330.31 <= 360.03929999999997 → true
- volume: bar0 {"date":"2026-09-29","value":5712000,"usable":true,"reason":null}; avg {"value":5599780,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

#### Receipt 10: PLTR as of 2026-09-22 — valid / pullback_resume, regime uptrend

- facts: C=184.99, SMA_fast=176.508, SMA_slow=160.4842, SMA_slow_5ago=155.6074, swingHigh=188.37, swingLow=164.55, ATR=7.0527, V=21991700, V_avg=27899425.6
- missing: []; patterns: {"breakout":"failed","pullback_resume":"satisfied"}
- checks: regime_stack [184.99,176.508] > [176.508,160.4842] → true; slow_rising 160.4842 > 155.6074 → true; regime_stack_down [184.99,176.508] < [176.508,160.4842] → false; slow_falling 160.4842 < 155.6074 → false; breakout_close 184.99 >= 188.37 → false; breakout_volume 21991700 >= 41849138.400000006 → false; pullback_touch 172 <= 176.508 → true; pullback_close 184.99 > 176.508 → true; extension 184.99 <= 190.6134 → true
- volume: bar0 {"date":"2026-09-22","value":21991700,"usable":true,"reason":null}; avg {"value":27899425.6,"barsUsable":20,"unusable":[]}
- adjustment: {"metadata":"present","missingDates":[]}; splitCheck heuristic_ok

**10.8 The join to the Oct 14 scorer (counts only).** `%USERPROFILE%\growth-replay-runs\cms-20261014T202814\results.local.json` was present; the join is on `battleId` + `tickId` + the swap's call (`SWAP:OUT>IN`) against the scorer's **control units** (every scored swap vs holding at the close, 64 + 66 units; not its 28 record moments — the decision report §6's sentence is the one out of step, review TEV5-1), tie = within 1 point, each moment once: **17 moments joined, below the 20-moment floor, so the report states "coverage insufficient for any behavioral statement" and makes none.** (Run 1's 30 "joined rows" was the double count of §10's opening paragraph: 30 − 13 coinciding moments that joined = 17.) The per-class counts exist in `summary.json` for a later, larger run and are not reproduced here.

**10.9 EODHD calls and reconstruction limits.** 29 of 60, once; 0 failures. Bars are a later reconstruction (the series as served at `fetchedAt`); a restated series is invisible; the split heuristic needs the vendor's adjustment already applied, trips on a special dividend above 10%, and is not proof of split-free data; the decision instant is date-only and no instant is invented; the anchor swing low is absent on every holding row; volume facts come from the EOD series, never from the rankings document the agent was shown (ID-6); a session whose row the mapper dropped would read as `missing_bar` (none did); verdicts are what the rule says on the series as served, dated to the prior session, never what the agent could have known.

**10.10 Historical cases (V3 §9.6).** None supplied (the founder omitted COP, XBI and LLY because their exact dates remain unavailable); `historicalCases.test.js` and `__fixtures__/historical/` do not exist; the replay's `bars --symbol X --asOf D --fixture` path exists for a later run (its own cache file, its write recorded in the manifest) and was not used.

## 11. The docs commit (V3 §11)

- **C1 appended** to `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` as a final section "Clarification C1 — 28 Oct 2026 (founder ruling FD-P3-1)" with the prescribed content (pattern-scoped missing facts; the four verdict requirements; a missing breakout volume never invalidates a supported pullback; the raw basis; thresholds, patterns and `setupVersion` unchanged; recorded under `tf-setup-v1/sem-1`; future rule changes subject to §7). The diff against `24495eba` is **12 insertions, 0 deletions** (`git diff --stat`), the committed blob is LF, and the appended bytes were written with the checkout's own line endings so the prefix is byte-identical (verified by the append script: prefix identical = true; re-verified by lens TE5: the first 5,829 bytes equal the base blob).
- **The review** `docs/audits/20261021_FABLE_REVIEW_ARCHETYPE_PROPOSAL.md`: committed byte-identical; the committed blob is 29,558 bytes, SHA-256 `74c7261188f080a5f766a300e22264666c6df5ee8d9f99e5def890bc5becbb14` (recorded, equal to the founder's file; re-verified by lens TE5 in its snapshot).
- **README rows**: the definition's row gained one sentence naming C1; rows added for the review and for this report after the changed-moments row (the report row was committed with the first draft, before the record it describes existed — review TE5-10; this report closes that gap before the PR is read).
- **C2 appended at the closeout** to the same file, after C1: the founder's rulings that bear on the definition (Q-TE-1, -2, -3, -7, -9, -11, -12, -13) and the record contract (Q-TE-4, -5, -10). The diff is **24 insertions, 0 deletions**; the LF-normalized working copy begins byte for byte with `main`'s blob and with the C1 version. The README's definition row gained one sentence naming C2, and the report's row a closeout clause (§20).
- **Not committed by this build**: the Growth Loop Map (Film Room B2.1's), Practice Field V3 and Amendment A, the decision report, the resolution summary, the V3 prompt. No docs-only PR.

## 12. Deviations from the prompt's letter (each reported, none hidden)

| Id | What | Why |
|---|---|---|
| D1 | `api/_utils/setupEvaluator/volumePolicy.js` — one pure module (no imports) holding `classifyVolume`, not in V3 §3's file list; the evaluator and the adapter each import one more module than §3/§8's "imports only" sentences say | Resolution point 1 asks for ONE policy for the adapter, the evaluator, the tests and the report; neither module may host it for the other without widening its import list. One shared module keeps the policy in one place (mutant M10 proves both consumers read it). Judged a justified deviation by lens TE5 and its refuter. |
| D2 | `scripts/experiments/tf-setup-golden-baseline-check.test.js` — not in §3 | The founder's start instruction: "test the cross-revision rejection cases using controlled fixtures". |
| D3 | The holding record carries `regime` (§5 lists it under "entry only") and a `history { count, required, sufficient }` block | `regime` is the fact `regime_flip` derives from (definition §2: "always recorded"); `history` says whether the chart-leg checks were gated (D12). Additive. |
| D4 | The holding record carries **no** `patterns`, although §5's common block lists `patterns` for "every entry and holding record" | A pattern assessment on a held name's record could neither be reconstructed from the record's own checks (BUILD_RULES §9) nor be read safely beside a held name (Amendment A, A6: an entry pattern failure never tags the held name) — reviews TE1-2 / TE5-6, both refuters. Q-TE-5. |
| D5 | The evaluator accepts an adapter refusal (`ok: false`) and returns `unknown(<adapter reason>)` with a `refusal` field; the entry `reason` on `unknown` is therefore the union of §6.4's two reasons and the adapter's nine | One record shape for every replay row and report count; the derivation rule still holds (every check unknown → unknown); Amendment A's `entry_on_unknown` is reason-agnostic (review TE5-11). |
| D6 | The adapter cuts the window to the newest `minBars` rows after the expected-row and ordering checks, before the price, adjacency and split checks; the ordering and date-format checks still run over the whole input | "Inside the window" (§8.7–§8.9) is bounded; a bad row older than the window never affects a verdict and must not refuse one. The whole-input ordering check over-refuses only (review TE2-6, left as is). |
| D7 | Refusals carry `expected`, `evidenceClass`, one `checks` shape (and `adjustment` when computed) beside `{ ok, reason, detail, asOf, basis, source, symbol }`; ok results carry `requestedAsOf`, `symbol` and `droppedAfterToday` | Additive (reviews TE2-7, TE5-2, TEV2-1, TEV2-3). |
| D8 | `parseEnvText`, `primaryCheckoutRoot`, `redactSecrets` restated in the replay script instead of imported from `growth-replay/growthReplay.js` | That module cannot be loaded by vitest's transform (a hermetic test imports the replay); the three helpers are ten lines each, behaviour identical. |
| D9 | Two replay runs; the run of record is the second | Run 1's report rendering and its two-rows-per-coinciding-moment shape were review findings (TE4-1, TE5-1); run 2 reused run 1's hash-verified payloads with 0 new calls and carries plan/evaluate/report provenance at one clean head (§10). |
| D10 | A window row dated on a non-session is refused as `unordered_bars { why: 'non_session_date' }` rather than a tenth typed reason | §8's reason list is nine; the shape error is named in `detail` and the evaluator passes any reason through (review TE2-2; Q-TE-9). |
| D11 | `splitCheckReason` has a third value, `adjusted_close_nonpositive`, beside §8.9's two | A vendor's zero adjusted close is not metadata (review TE2-1); naming it apart from a missing value keeps the diagnosis honest. |
| D12 | **Tightening:** the holding evaluator's three checks are `unknown` below `MIN_COMPLETED_BARS`, where V3 §7's letter gates each check only on its own facts | A 50–54-bar series would otherwise read `broken` on the holding side while the entry side says `unknown(insufficient_history)` (review TE5-3, confirmed). Every real path passes through the adapter's 55-bar rule, so only direct callers see it. Fails safe. Q-TE-2. |
| D13 | **Tightening:** a non-positive anchor swing low reads `absent` (structure_break unknown), where §7's letter says "absent or non-finite" | The anchor is a price and the evaluator's own `swingLow` can never be ≤ 0 (review TE1-3, confirmed); a corrupt anchor can no longer produce `intact`. Fails safe. Q-TE-11. |
| D14 | **Calculation refinements under `sem-1`, pre-merge:** adjustment metadata requires every window adjustedClose finite and > 0; the split threshold is the symmetric `1 − min/max > 0.10`; both named in `SEMANTICS_NOTES` and pinned by rows and mutants | Both are review findings (TE2-1, TE2-5) fixed before any base revision carried the semantics id; the baseline is initial, so no entry is owed yet. After merge, either change would be `sem-2`. Q-TE-12, Q-TE-13. |
| D15 | **Closeout, additive:** every record carries `requestedAsOf`; a refusal record carries `refusal.expected`; refused evidence carries the caller's `sourceMeta` | The founder's closeout instruction (provenance on refused evidence, with the requested date and the expected session kept apart). V3 §5 lists `asOf` and `sourceMeta` only; the record's `asOf` keeps its meaning. Recorded in the definition's C2 (Q-TE-10). |
| D16 | **Closeout:** `evidenceClass.bars` admits `'synthetic'`, beside V3 §5's two values | The founder's ruling on Q-TE-4: synthetic test evidence only. The adapter's default and the replay stay `later_reconstruction`; recorded in C2. |

## 13. Boundaries and handoff dependencies (V3 §12, preserved)

Slice 2 (the `setupVerdicts/{sessionDate}` writer and the menu label) is not built; nothing here touches `archetypeCandidateMenu.js`; the §5 record is the shape slice 2 and ID-1's snapshot will carry — the fields ID-1 names (`setupVersion`, verdict, reason, pattern, regime, the anchor swing low, basis, source, asOf) are all present, additive changes only. **Shape notes for the consumers** (reviews TE5-11, TE5-12): the entry `reason` on `unknown` is one of `insufficient_history | missing_fact | unsupported_symbol_class | calendar_missing | asOf_not_a_session | asOf_in_future | missing_bar | unordered_bars | basis_discontinuity`; the record's field names follow V3 §5 (`regime` and `pattern` at the top level, `evidence.pullbackLows`), not the definition's phrasing ("a fact in `factsUsed`", `setupPattern`) — V3 §5 governs the record, the definition governs the rules. ID-1 (activation evidence) is not built; a missing anchor reads unknown (`structure_break`) and the provenance says `absent`. ID-6 is not built; the replay's volume facts come from the EOD series. ID-2 / P4, ID-4, FD-1 / FD-2: untouched; the battle stays one day. Practice Field: every record is labelled by its `evidenceClass`; `unknown` is never `invalid` or `broken`; every comparison names its `asOf` and basis; `chartLeg` is one leg and never decides a holding policy. Protection and execution keep their owners: no output here fires, suppresses or replaces a protective action.

## 14. Five separate conclusions (never merged)

1. **Engineering correctness — established.** Every rule and unknown path has a row asserting its correct result; the golden pins every scenario's complete record under `tf-setup-v1/sem-1`; the verdict recomputed from each record's own `checks` and `patterns` equals the record's; 79 mutants all killed; the adapter's ten rules each guarded; the replay's helpers hermetically tested; the cross-revision check's rejection cases proven on fixtures and on the real files; the review's two HIGH findings (provenance, the double-counted moments) fixed and re-proven.
2. **Replay coverage — reported, bounded.** 36 pairs over 33 moments from 486 woken checks; 29 calls; data-unknown 5.3%; one honest refusal (a corporate-action basis break); the anchor absent on every holding row; verdicts dated to the prior session on date-only evidence.
3. **Behavioral differentiation — not measured** (M3 after P4). The join reached 17 moments, below the 20-moment floor; no statement.
4. **Partnership usefulness — not claimed.** The founder's read of the ten receipts (§10.7) blesses or amends the basis.
5. **Market performance — not claimed.**

## 15. Founder questions and the founder's rulings (28 Oct 2026)

| Id | Question | Recommendation | Founder's ruling (28 Oct 2026) and where it is applied |
|---|---|---|---|
| Q-TE-1 | V3 §6.4 rule 4 reads "failed (all evaluable, at least one false)". So a pattern with one check false and its other check unknown (e.g. `breakout_close` false and `breakout_volume` unknown because `V` is unusable, with no pullback) is `untestable`, and the verdict is `unknown(missing_fact)` rather than `invalid(no_setup)`; a zero-volume bar 0 therefore counts against the one-quarter rule although no volume could rescue the pattern (lens TE5-5). The build follows the letter (M21 pins it). | Keep the letter: a missing fact never manufactures a definite verdict (C1's spirit), and the record shows which check was false. If the short-circuit reading is preferred, it is a `sem-2` change (new baseline entry), no threshold change. | **Kept.** The approved conservative `unknown` stands when a required pattern check is unknown, even when another check is false; each check keeps its own result. No change; recorded in C2. |
| Q-TE-2 | D12: the holding evaluator's three checks are unknown below 55 bars (a tightening beyond §7's per-check letter), with `history` on the record. | Confirm the tightening. | **Accepted.** The holding evaluator needs 55 bars for this baseline, as the adapter contract does (D12). No change; recorded in C2. |
| Q-TE-3 | CTVA as of 2026-10-06 is `unknown(basis_discontinuity)`: EODHD's adjustment factor steps from 0.15 to 1 on 2026-10-01 while the raw series shows the price step. Under FD-P3-2 (raw) the window straddling a corporate action cannot be evaluated. | Keep the refusal (honest, typed). A later adapter slice could carry a split-adjusted raw series with the factor recorded; the definition is untouched either way. | **Kept.** CTVA stays a typed `basis_discontinuity` refusal; corporate-action normalization is later adapter work (§16). No change; recorded in C2. |
| Q-TE-4 | The synthetic fixture labels its bars `evidenceClass.bars = 'later_reconstruction'` with `source: 'synthetic'`, inside §5's closed enum; the refuter TEV5 argued the honest label is a third value `'synthetic'` (test evidence only). | Decide whether to admit `'synthetic'` to the enum for test records; the adapter never emits it either way. | **`synthetic` for synthetic test evidence.** Applied at the closeout: the fixture labels its bars `synthetic`; the adapter default and the replay stay `later_reconstruction` (D16, §20.2). |
| Q-TE-5 | D4: holding records carry no `patterns` (A6), a deviation from §5's common block. | Confirm, and read §5's `patterns` as entry-only; or restore it with the pattern checks carried on holding records (more A6 exposure, per TEV5). | **Entry records only.** Pattern assessments stay off holding records (D4). No change; recorded in C2. |
| Q-TE-6 | The join reached 17 moments against the scorer's control units, below the 20-moment floor; the per-class counts sit in `summary.json`. | Read nothing from them; M3 after P4 is the measurement. | **No claim.** No behavioral or performance claim is made from the 17 joined moments; crossing the 20-moment floor alone would not establish an edge either (§14). |
| Q-TE-7 | The definition's §4 lists `regime_flip` beside `close_below_slow`, but a downtrend regime implies `C < SMA_slow`, so `regime_flip` is never the sole reason. | No action; recorded so a future "regime_flip alone" row is not expected. | **Retained.** `regime_flip` stays an explanatory reason despite its overlap with `close_below_slow`. No change; recorded in C2. |
| Q-TE-8 | By §4.3's letter, any change of the golden's bytes under an unchanged `SEMANTICS_ID` fails the cross-revision check after merge — including adding a scenario whose existing records do not change (refuter TEV1 noted this). | Keep the letter for now (a scenario addition after merge costs a `sem-N` entry with a note), or refine the rule in a later slice to compare existing scenarios' records rather than bytes. | **Strict guard kept for now.** Test-catalog versioning is a separate refinement (§16). No change. |
| Q-TE-9 | D10: a non-session row inside the window is `unordered_bars { why: 'non_session_date' }` rather than a tenth reason. | Accept, or add a typed reason in a later revision of §8. | **Accepted.** `unordered_bars` with `why: non_session_date` (D10). No change; recorded in C2. |
| Q-TE-10 | The record's naming follows V3 §5 (`regime`, `pattern`, `pullbackLows`) where the definition says "regime is a fact in `factsUsed`" and `setupPattern` (lens TE5-12). | Record the naming in a later clarification note or leave §5 as the governing shape. | **The implemented names are authoritative.** Recorded in the definition's C2 with the full record shape; the specification wording is reconciled there (§20.3). |
| Q-TE-11 | D13: a non-positive anchor reads `absent` (a widening of §7's "absent or non-finite" in the safe direction). | Confirm. | **Accepted.** A non-positive anchor is unavailable for `structure_break` (D13). No change; recorded in C2. |
| Q-TE-12 | D14: adjustment metadata requires positive adjusted closes (a vendor's zero adjusted close is not metadata), fixed pre-merge under `sem-1`. | Confirm; after merge the same change would be `sem-2`. | **Required.** Adjustment metadata needs positive, finite adjusted closes (D14). No change; recorded in C2. |
| Q-TE-13 | D14: the split threshold is the symmetric `1 − min/max > 0.10` (a 9.1–10% step no longer trips in one direction), fixed pre-merge under `sem-1`. | Confirm; same note as Q-TE-12. | **Accepted, comment corrected.** The symmetric `1 − min / max > 0.10` stands; the adapter's header now states it (§20.2). Recorded in C2. |

## 16. The STOP list, follow-ups and out-of-fence items

- STOP conditions (V3 §0, §2): none held. Fence contact: none. Scope creep past §3: the two extra files of §12 D1–D2, reported, not scoped out.
- **CI follow-up** (one line, edits `.github/workflows/tests.yml`): run `node scripts/experiments/tf-setup-golden-baseline-check.mjs --base <merge-base with main>` as a CI step so a golden regenerated under an unchanged `SEMANTICS_ID` can never pass CI. Until then the script runs in a build's final checks (§18).
- **Out of the fence, reported for separate tasking** (BUILD_RULES §3): `.gitignore` carries `*.local` but not `*.local.json` (review TE4-8; the run folders live outside any repo, so the rule only matters for a copy into the tree); `src/utils/marketCalendar.js` `getPreviousSessionDate` does not validate the day of month (`2026-02-30` walks to `2026-02-27`; review TE2-9; the replay guards itself); `mapDailyRows` drops a row with a non-finite high or low before any adapter sees it, so such a session reads as `missing_bar` downstream (review TE2-3; named, not fixed).
- **Later work named by the founder's rulings:** corporate-action normalization in the adapter (Q-TE-3); test-catalog versioning for the golden guard (Q-TE-8).
- Not in slice 1 and not assumed built: everything in V3 §1's exclusion list.

## 17. The BUILD_RULES §2 review record

The diff crossed BUILD_RULES §2's threshold (at `c5602832`, the code and test head: 20 files, +17,826 lines, −1 line). Five lenses, each a subagent on its own `git -c core.autocrlf=false archive` tree under the session scratchpad with `node_modules` junctioned, read-only on git and on the shared working tree; a refuter per lens on its own tree, instructed to refute every finding with a reproduction; the mutating lens (TE3, test integrity) last, on its own tree of the fixed head. Finding ids take the unused prefix `TE` (lenses TE1–TE5, refuters TEV1–TEV5), chosen after a grep of the ids the repository already cites. Reviewers returned findings as text; nothing they wrote touched the repository. The four non-mutating lenses reviewed `78d37087`; the fix round `c9c02fc4` answered them; TE3 reviewed the fixed head.

### 17.1 Lenses and what each covered

| Lens | Scope | Findings | Refuter's verdicts |
|---|---|---|---|
| TE1 domain correctness | every operator and boundary, the windows, the regime and C1 rules, the volume policy, null prices, the record contract, the holding, determinism, the strategy card, the fixture arithmetic | 5 (1 MED, 3 LOW, 1 NIT) | TEV1: 5 CONFIRMED (+2 found) |
| TE2 adapter, calendar, cutoff | the expected session, the never-a-fallback rule, ordering, adjacency across the maintained years, raw prices and volumes, the split heuristic and provenance, the replay's cutoff and fetch window, the output contract, the adapter rows | 9 (1 MED, 3 LOW, 5 NIT) | TEV2: 8 CONFIRMED, 1 PARTLY (+3 found) |
| TE3 test integrity (mutating) | §9 completeness, vacuous and tautological rows, the golden/baseline tripwire, its own mutants, the dependency-surface guards, hygiene | see 17.3 | TEV3: see 17.3 |
| TE4 read-only guarantees, secrets, redaction | every write and read of the two scripts, the key's paths, identifiers in committed-able outputs, the cap, no Firestore / model, the baseline script's git use, provenance | 8 (1 HIGH, 1 MED, 4 LOW, 2 NIT) | TEV4: 6 CONFIRMED, 2 PARTLY (+3 found) |
| TE5 cross-document consistency and scope | §1 exclusions, the fence, §3's file list, the §5 record vs its consumers (slice 2, ID-1, Amendment A), SEMANTICS_NOTES vs §4.2, C1's wording, the README rows, the review doc's bytes, the replay scope, §12 boundaries | 12 (1 HIGH, 2 MED, 7 LOW, 2 NIT) | TEV5: 11 CONFIRMED, 1 PARTLY (+4 found) |

Claims attacked and NOT broken (each lens listed its own): every equality boundary and window; MIN_COMPLETED_BARS; the six §6.4 rules in order; the volume policy; null-price handling through `priceSlice`; the record's reconstructibility (entry); the holding's independence; determinism; the strategy card byte-identical; the fixture arithmetic re-derived by hand; the expected-session rule across DST days, midnight boundaries, early closes and a Saturday clock; the never-a-fallback rule under oldest-first, duplicate and weekend-first inputs; adjacency equal to the calendar on all 728 maintained dates under nine time zones; the window cut; the CTVA refusal confined to windows straddling the step; the cutoff (no evaluation can read the check's own session); the fetch pad (≥ 87 sessions in any 130-day window through 2027); every write of both scripts enumerated and inside the run folder; `owner` never read; raw ids out of `summary.json` / `report.md` by an allowlist; the key in the URL only, every error path redacted; the cap refuse-before-increment and persisted before the fetch; one `fetch` call site, no Firestore, no model; the review doc's sha; C1 append-only; the README diff; the golden in canonical form; the thresholds and notes; the fence; the §4 import guards; §1's exclusions; the §5 fields ID-1 and Amendment A need; §8's ten rules in order; §10's scope, filter, counts, cutoff, cap and report shape.

### 17.2 Findings and dispositions

Severity is the lens's; the verdict is the refuter's. "Fixed" means the fix is in `c9c02fc4` (or `f3ae1bd1`), with a row and, where listed, a mutant that pins it.

| Id | Sev. | Finding | Verdict | Disposition |
|---|---|---|---|---|
| TE4-1 | HIGH | The replay's `summary.json` / `report.md` quoted plan-time provenance (head, dirty, script and module shas); the first run's report named a head and "(clean)" that did not produce its verdicts (the second `evaluate` ran with the script edited, uncommitted) | CONFIRMED (TEV4: the report's content was only producible by the later script) | **Fixed** — every command stamps head, dirty flag, script and module shas; `evaluate` and `report` refuse a dirty tree (`--allow-dirty` recorded) and `report` refuses a script that changed since `evaluate` (`--allow-drift`); the summary carries plan, evaluate and report provenance and a `drift` flag; the report prints a DRIFT line. Run 2 re-run at one clean head (§10). Rows; mutant M45 |
| TE5-1 | HIGH | A moment whose proposed and executed swap coincide became two rows, double-counting 14 moments in every per-row table and in the join (30 "joined rows") | CONFIRMED (TEV5: the double count is real; the lens's "30 > 28" inference was wrong — the join set is the scorer's control units, which can exceed 28) | **Fixed** — one row of kind `both`; the join counts a moment once; run 2: 33 moments, 17 joined → below the floor, no statement (§10.8). Rows; mutants M41, M42 |
| TE1-1 | MED | V3 §6.4 rule 5's "ATR null → unknown" branch had no scenario and no row; a mutant deleting it survived | CONFIRMED (TEV1: 258/258 green under the mutant; reachable only by direct callers, the adapter refuses a null low first) | **Fixed** — scenario `c1_pullback_null_atr`, an entry row; mutant M4b |
| TE2-1 | MED | A window whose every adjustedClose is 0 (or negative) read `metadata: present` and `heuristic_ok` (0/0 ratios are NaN and never trip) | CONFIRMED (TEV2 reproduced; a single zero tripped under the wrong name) | **Fixed** — `present` requires finite and > 0; `adjusted_close_nonpositive`; rows; mutant M38; `SEMANTICS_NOTES`. D11, D14, Q-TE-12 |
| TE4-2 | MED | `bars --fixture` shared the run's cache file: with `--refetch` it shortened the planned series silently, without it the fixture was not written; `evaluate` never checked the cache window; the repo-tree write was not in the manifest | PARTLY (TEV4: `evaluations.json` did show the shortened window; the summary and report did not; `--symbol` outside the plan was fetchable) | **Fixed** — fixture fetches use `bars/<SYMBOL>@<asOf>.json`; `evaluate` refuses a cache ending before `asOf` by name; `stamp` records flags and written paths; a symbol outside the plan only with `--fixture` |
| TE5-2 | MED | `evidenceClass.bars` left §5's enum: the fixture's `'synthetic'` pinned in the golden; null on every adapter refusal | CONFIRMED (TEV5: honesty argues for admitting `'synthetic'` instead) | **Fixed** — refusals carry `evidenceClass` (mutant M49); the fixture uses `'later_reconstruction'` with `source: 'synthetic'`; Q-TE-4 asks whether to admit the third value |
| TE5-3 | MED | The holding evaluator had no bar minimum: a 52-bar series read `broken` while the entry side read `unknown(insufficient_history)` | CONFIRMED (TEV5: a tightening that fails safe; `holding_short_history` unchanged) | **Fixed** — every holding check unknown below 55 with `history` on the record; scenario `holding_history_54_close_below_slow`; mutant M35. D12, Q-TE-2 |
| TE1-2 = TE5-6 | LOW | The holding record's `patterns` could not be reconstructed from its own checks; and a pattern failure printed beside a held name is the misread A6 warns of | CONFIRMED / PARTLY (TEV1: reconstructible from `factsUsed` + `pullbackLows`; TEV5: dropping is safest for A6, but it departs from §5's common block) | **Fixed** — holding records carry no `patterns`; mutant M43. D4, Q-TE-5 |
| TE1-3 | LOW | A non-positive anchor was `supplied` and `structure_break` deterministically false | CONFIRMED (TEV1: a corrupt input, never a swing low; fails safe) | **Fixed** — `isPrice`; `absent`; note; rows for 0, −0, −1; scenario `holding_anchor_zero`; mutant M36. D13, Q-TE-11 |
| TE1-4 | LOW | `chain()` short-circuited on a false pair so the mirror regime checks disagreed on the same null fact; its comment was wrong | CONFIRMED (TEV1: no verdict effect, no golden change) | **Fixed** — unknown-first chain; row; mutant M37 |
| TE2-2 | LOW | A weekend or holiday row inside the window was refused as `missing_bar` naming a session that was present | CONFIRMED (TEV2) | **Fixed** — `unordered_bars { why: 'non_session_date', date }` before the adjacency walk; rows; mutant M40. D10, Q-TE-9 |
| TE2-3 | LOW | `mapDailyRows` drops a row with a null high/low before the adapter, so the session reads `missing_bar` and the mapper's count never reached the report | CONFIRMED (TEV2) | **Fixed in the replay** — refusals carry `mapperDropped`; a missing session whose raw row is in the payload is named `mapper_dropped_row` with the null fields; the EODHD line counts the drops; the adapter's header states it. The mapper is outside the fence (§16) |
| TE2-4 | LOW | The "removed weekend date → ok" row removed nothing | CONFIRMED (TEV2: 90 rows before and after) | **Fixed** — the calendar-day fixture is refused by name and ok once filtered to sessions, with the removal asserted |
| TE4-3 | LOW | `--symbol` / `--asOf` and the capture's symbols flowed unvalidated into file names and the URL | CONFIRMED (TEV4: a path escape needs a 200 JSON array from EODHD for the mangled path; a guard gap) | **Fixed** — `SYMBOL_RE`, a real-date check, plan membership; malformed symbols listed and never fetched; rows |
| TE4-4 | LOW | Provenance "in every output" held only by co-location for `rows.local.json`, the bars files and `evaluations.json` | CONFIRMED (TEV4) | **Fixed** — `evaluations.json` and the bars files carry a provenance block; the header names `manifest.json` as the provenance of record |
| TE4-5 | LOW | `summary.json` carried the capture's key NAMES (incl. `owner`); the test's `"owner"` assertion passed only because its manifest had no `keys` | PARTLY (TEV4: names only, not a leak under the prompt's wording; the test was vacuous) | **Fixed** — `keys` stay in the manifest; the test plants `keys` and asserts on planted values; mutant M48 |
| TE4-6 | LOW | The cap is per run folder and per process | CONFIRMED (TEV4) | **Documented** in the script header |
| TE5-4 | LOW | Two files outside §3's list; the "imports only" sentences no longer literal | CONFIRMED (TEV5: justified, must be reported) | **Reported** — D1, D2 |
| TE5-5 | LOW | A price-defeated pattern with an unknown volume reads `untestable` (the letter) | CONFIRMED | **Founder question** Q-TE-1 |
| TE5-7 | LOW | The swing tie rule was pinned by the golden but named nowhere in `SEMANTICS_NOTES` | CONFIRMED | **Fixed** — a note |
| TE5-8 | LOW | The baseline check ordered history by `sem-<n>` alone, so `tf-setup-v2/sem-1` after `v1/sem-1` was rejected | CONFIRMED (TEV5 probe) | **Fixed** — ordered by `(setupVersion, seq)`; rows; mutant M46 |
| TE5-9 | LOW | "unknown verdicts 1" beside a row table showing 2 | CONFIRMED | **Fixed** — "distinct equity (symbol, asOf) entry pairs: N unknown of M attempted" |
| TE5-10 | LOW | The README row described this report before it existed | CONFIRMED (by design; closed before the PR) | **Closed** by this report |
| TE1-5 | NIT | `sourceMeta` shared by reference (TEV1: `refusal.detail` too) | CONFIRMED | **Fixed** — copied; rows |
| TE2-5 | NIT | The split threshold was asymmetric; the stated "above 10%" tripped at 9.1% in the dividend direction | PARTLY (TEV2 corrected the crossover to 9.09%; the lens's symmetric form would still trip above 9.09%) | **Fixed** — `1 − min/max > 0.10`; rows at 9.5% and 11% in both directions; mutant M39; note. D14, Q-TE-13 |
| TE2-6 | NIT | Ordering and date-format checks run over the whole input (over-refusal only) | CONFIRMED | **Documented** — D6 |
| TE2-7 | NIT | Refusals carried the requested `asOf` only | CONFIRMED | **Fixed** — `expected` on refusals |
| TE2-8 | NIT | A never-fetched symbol read `missing_bar` with its cause only in `detail` | CONFIRMED (TEV2: the failures were on the EODHD line already) | **Fixed** — `unfetchedPairs` counted and printed beside the unknown table |
| TE2-9 | NIT | `getPreviousSessionDate('2026-02-30')` walks to a real date; the replay regex-checked `etDate` only | CONFIRMED (TEV2: a UTC round trip, not `Date.parse`) | **Fixed in the replay** (`isRealDate`; mutant M47); the calendar module is outside the fence (§16) |
| TE4-7 | NIT | `redactEodhd` masked the parameter, not a bare key | CONFIRMED | **Fixed** — the key value masked in fetch errors |
| TE4-8 | NIT | `*.local.*` is a convention, not a `.gitignore` rule; `report` printed the home path | CONFIRMED | **Fixed** (relative paths); `.gitignore` is outside the fence (§16) |
| TE5-11 | NIT | The `reason` enum on `unknown` is the union of §6.4's and the adapter's | CONFIRMED | **Documented** — §13 |
| TE5-12 | NIT | Naming follows V3 §5, not the definition's phrasing | CONFIRMED | **Documented** — §13, Q-TE-10 |
| TEV1-1 | NIT | `pullbackLows` recorded a non-price low by `isNum` while the check read `isPrice` | found by the refuter | **Fixed** — row; mutant M44 |
| TEV1-2 | NIT | A guard row compared `deriveRegime` with itself on the insufficient-history branch | found by the refuter | **Fixed** — the plain assertion |
| TEV2-1 | NIT | `checks` absent on early refusals, present with nulls later | found by the refuter | **Fixed** — one `checks` shape on every result; row |
| TEV2-2 | NIT | `calendar_missing` conflated a malformed `asOf` with an unmaintained year | found by the refuter | **Fixed** — `why: 'malformed_date'`; row |
| TEV2-3 | NIT | Rows dated after today folded into `dropped` silently | found by the refuter | **Fixed** — `droppedAfterToday`; row |
| TEV4-1 | LOW | A null dirty state rendered "(clean)"; a null head printed | found by the refuter | **Fixed** — three-state rendering; `plan` stops without a head or tree state |
| TEV4-2 | LOW | The cache's `payloadSha256` was written but never checked | found by the refuter | **Fixed** — `evaluate` stops on a mismatch; run 2's 29 files verified |
| TEV4-3 | NIT | `loadEnv` merges every variable; only the key is read | found by the refuter | **Noted** (the growth replay's shape) |
| TEV5-1 | — | The join set is the scorer's control units, not its 28 record moments; the decision report §6's sentence is out of step | found by the refuter | **Documented** — §10.8 and the replay's report line |
| TEV5-2 | — | The golden had 40 records, not 39 | found by the refuter | noted (43 after the fix round) |
| TEV5-3 | — | A fix to `selectPopulation` invalidates `rows.local.json`; the report must be regenerated through `plan → evaluate → report` | found by the refuter | **Done** — run 2, the cache reused (§10) |
| TEV5-4 | — | The golden's pre-merge regeneration under `sem-1` must be stated | found by the refuter | **Stated** — §7, Q-TE-8 |

Refuted in part (the only refutations): TE4-2's "silently" (the shortened window was visible in `evaluations.json`); TE4-5's "leak" (names, never values); TE2-5's numbers (9.09% is the crossover and does not trip); TE5-6's "contract breach" (the letter of §5 carries `patterns` on holding records — the fix is a deviation, hence Q-TE-5); TE5-1's "30 > 28 proves duplication" (the control units exceed 28 legitimately; the duplication was proven from the code and run 2's count).

### 17.3 Lens TE3 (test integrity, mutating) and refuter TEV3

Lens TE3 reviewed the fixed head `c9c02fc4` on its own tree with its own mutation harness (23 mutants, four of them controls that died as expected; every file restored and sha-verified). It found no product defect — every survivor's discriminating fixture behaved correctly on the clean tree — and thirteen coverage gaps. Refuter TEV3 installed each mutant in place on its own tree, re-ran the 316-row suite and the proposed probe clean and mutated, and restored byte-for-byte: 12 CONFIRMED, 1 PARTLY (TE3-1's survivor is real, its proposed row is wrong), 0 REFUTED, plus eight more survivors of its own with verified kill rows (TEV3-1 … TEV3-8). The build answered with scenarios and rows at `a2264f48`, `d04e2918`, `e7907900` (the mutating lens's round) and `c5602832` (the refuter's rows), and re-ran the mutants: 29 of 29 killed (M50–M78).

| Id | Sev. | Finding (a mutant that survived 316 rows) | Verdict | Disposition |
|---|---|---|---|---|
| TE3-1 | HIGH | The regime stack's middle inequality (`SMA_fast > SMA_slow`) was discriminated by no row and no scenario: `bounce_fast_below_slow` also fails the rising test, and no scenario had `C` above both averages with the slow one above the fast | PARTLY (TEV3: the survivor is real; the lens's proposed row keeps `C` below `SMA_slow`, so the dropped inequality still reads false under the mutant — the build's own M50 run showed the same) | **Fixed** — scenarios `stack_fast_below_slow_rising` (slow rising, stack false) and `stack_middle_inequality_only` (`C` 110 above both averages, `SMA_fast` 95.75 < `SMA_slow` 101.3, rising); rows; mutant M50 |
| TE3-2 | MED | `deriveChartLeg` ignoring `regime_flip` survived: its only independent effect is the unknown path (a true `regime_flip` always comes with `close_below_slow`) | CONFIRMED | **Fixed** — scenario `holding_regime_unknown_only` (55 bars, a null close at bar 52); row; mutant M52 |
| TE3-3 | MED | The adjacency loop stopping one pair before the window's oldest edge survived | CONFIRMED | **Fixed** — rows for the newest and the oldest gap; mutant M54 |
| TE3-4 | MED | `today` as the UTC date survived (every `now` in the file had the same date in UTC and ET) | CONFIRMED | **Fixed** — a row at 22:00 ET (02:00Z next day); mutant M64 |
| TE3-5 | MED | The adapter's price check without `high` survived | CONFIRMED | **Fixed** — rows for a zero and a negative high; mutant M53 |
| TE3-6 | MED | The `previousEtDate` null → `calendar_missing` branch had no row | CONFIRMED | **Fixed** — rows through `expectedCompletedSession` and `buildDailyEvidence`; mutant M55 |
| TE3-7 | MED | The downtrend's second condition (`slow_falling`) was not discriminated | CONFIRMED | **Fixed** — scenarios `stack_down_slow_not_falling` and `holding_stack_down_slow_not_falling`; rows; mutant M51 |
| TE3-8 | MED | `close_below_slow` and `structure_break` with `<=` survived (no scenario at equality) | CONFIRMED | **Fixed** — scenario `holding_boundaries_equal` and a one-cent-below row; mutants M62, M63 |
| TE3-9 | MED | The join's ±1 tie band and the one-quarter limit were unpinned at their boundaries | CONFIRMED | **Fixed** — rows at 1, 0.5, −1, 1.5, −1.5 and at a share of exactly 0.25; mutants M56, M57 |
| TE3-10 | MED | Receipt ordering was not isolated from alphabetical order | CONFIRMED | **Fixed** — a row where the earliest check carries the later symbol; mutant M58 |
| TE3-11 | LOW | The swing tie rule and the preserved unusable bar-0 volume were pinned only by the golden | CONFIRMED | **Fixed** — named rows (`flat_slow_sma`'s tie date; the −5 / 0 values); mutants M61, M68 |
| TE3-12 | LOW | Guard rows missing: `minBars` validation, a nested refusal detail, the tick-id colon, equal `recordedAt` | CONFIRMED (TEV3: the `minBars` row must assert the typed message, not `TypeError` alone, because `minBars` 0 throws an untyped one under the mutant) | **Fixed** — rows (`toThrow(/positive integer/)`); mutants M65, M66, M67, M59 |
| TE3-13 | LOW | The cross-revision check has no teeth until an entry is on `main`; the regeneration was read on the branch | CONFIRMED | **Stated** — §7 |
| TE3 note | — | `swingLow` reading bar 0 was killed only by the adapter's end-to-end row and the golden | CONFIRMED (TEV3: seven rows, none named) | **Fixed** — a named row (a bar-0 low of 90 is not the swing low); mutant M60 |
| TEV3-1 | MED | The adapter refusing exactly `minBars` rows survived | found by the refuter | **Fixed** — a 55-row ok row; mutant M70 |
| TEV3-2 | MED | The join ignoring `controlMainRows` survived (the scorer writes two control sets) | found by the refuter | **Fixed** — a row keyed only in the main set; mutant M71 |
| TEV3-3 | MED | Drift ignoring the evaluate-time provenance survived | found by the refuter | **Fixed** — rows with `evaluate` at another head or dirty; mutant M72 |
| TEV3-4 | MED | Refusal records with no `checks` survived (an all-unknown assertion is vacuous on an empty array) | found by the refuter | **Fixed** — the nine and the seven ids pinned on refusals; mutant M73. Stated by design: a refusal's reason is the adapter's, not reproducible from its own checks, so the §9 recompute row rightly covers ok records only |
| TEV3-5 | LOW | The join's `status` and numeric-delta guards each survived alone | found by the refuter | **Fixed** — a row with a `not_scored` point and a scored point without a delta; mutants M74, M75 |
| TEV3-6 | LOW | A historical entry's sha format was unchecked by any row | found by the refuter | **Fixed** — a row; mutant M76 |
| TEV3-7 | LOW | The adjustment's `missingDates` array shared with the input survived (every fixture's was empty) | found by the refuter | **Fixed** — a row on a non-empty fixture; mutant M77 |
| TEV3-8 | LOW | `pickReceipts` no longer skipping entry-less rows survived (it would throw on an unfetched pair) | found by the refuter | **Fixed** — a row; mutant M78 |

Equivalent mutants both sides considered and did not count: the ATR and SMA windows one bar longer (the primitives slice to their period); dropping `asOf === today` in the incomplete-session branch; `jump >= SPLIT_RATIO_JUMP` (1 − 0.9 is 0.0999… in binary, so the exact-10% boundary is unreachable); `volWindowComplete` with `>=` (at 20 bars only 19 window bars exist); the holding's `sufficient ? deriveRegime : 'unknown'` guard below 55 bars (`SMA_slow_5ago` is always null there).

### 17.4 Totals

| | Count |
|---|---|
| Lenses | 5, each on its own snapshot tree; TE3 (mutating) last, on the fixed head |
| Refuters | 5, one per lens, each on its own tree |
| Distinct findings | 55 (34 by the four non-mutating lenses, 13 by TE3; 8 found by refuters TEV1/TEV2/TEV4/TEV5, 8 by TEV3 — of which 2 were noted beside a lens finding and counted once) |
| CONFIRMED | 43 |
| PARTLY | 6 (TE4-2, TE4-5, TE2-5, TE5-6, TE5-1's inference, TE3-1's row) |
| REFUTED outright | 0 |
| Fixed in this PR | 46 (every CONFIRMED or PARTLY item that named a defect or a missing row) |
| Documented, raised as a founder question, or named as a follow-up outside the fence | 9 |
| Mutants, all passes | 79 run (M1–M78 with M4b), 79 killed, 0 surviving; 3 needed a second row or a narrowed find string before they died (M42, M45, M50), each recorded in §9 |

## 18. Final checks

Every check below ran in CI shape on Linux: WSL Ubuntu, a detached worktree of the shared `~/pd-ci` clone at the named commit (fetched by full SHA from the Windows repository, `node_modules` symlinked, the lockfile hash `22fa2b71904c` equal on both sides so no `npm ci` was needed), `TZ=UTC`, the full suite under `flock /tmp/pd-suite.lock` with `--maxWorkers=8`, Node v22.22.2 (the Node 20 runtime the CI workflow pins is not installed in this WSL; the repository's own CI run on the PR is the record for that version). The branch was cut at `origin/main` `24495eba` and `origin/main` did not move during the build (re-fetched before the push), so the merged tree is the branch itself. At the closeout `origin/main` had moved to `62380f14`; it was merged at `8522e656` before the closeout's run, so that run is on the tree CI tests.

| Head | What it is | Full suite | `npm run lint:gate` | `vite build` | Baseline check |
|---|---|---|---|---|---|
| `78d37087` | the code before the review | 1,196 files passed, 8 skipped; 26,260 rows passed, 89 skipped, 0 failed; 272 s | exit 0 | exit 0 (15.9 s) | PASS, `initial` |
| `c9c02fc4` | the review fix round | 1,196 / 8; 26,285 passed, 89 skipped, 0 failed; 303 s | exit 0 | exit 0 (19.8 s) | PASS, `initial` |
| `e7907900` | the mutating lens's rows and scenarios | 1,196 / 8; 26,323 passed, 89 skipped, 0 failed; 214 s | exit 0 | exit 0 (15.5 s) | PASS, `initial` (the output is in §7) |
| `c5602832` | the code and test head (the refuter TEV3's rows) | 1,196 / 8; **26,327 passed, 89 skipped, 0 failed**; 260 s | exit 0 | exit 0 (13.1 s); entry chunk `index-BvBYFcJi.js` 4,902.07 kB, gzip 1,320.89 kB — byte-identical to the base's (no `src/` change) | PASS, `initial` (§7's four lines with HEAD `c5602832`) |
| `d7037574` | the build's pushed head (this document only after `c5602832`) | 1,196 / 8; 26,327 passed, 89 skipped, 0 failed; 253 s | exit 0 | exit 0 (12.8 s); the same entry chunk | PASS, `initial` |
| `8522e656` | **the closeout**: the corrections at `4c033d1f` with `origin/main` `62380f14` merged (§20) | 1,205 / 8; **26,473 passed, 89 skipped, 0 failed**; 278 s | exit 0 | exit 0 (14.0 s); entry chunk `index-CLx1U8Yq.js` 4,904.38 kB, gzip 1,321.42 kB — larger than at the build because #999 changed `src/` on `main`; this PR changes no `src/` file | PASS, `initial`, against the new merge-base `62380f14` |

The seven new files are 358 of those rows; the other 25,969 are the suite `main` already carries, untouched by this build. At `8522e656` the seven files are 382 of 26,473 rows; the other 26,091 are `main`'s at `62380f14`. The closeout's pushed head is its documents commit on top of `8522e656` (this report, the definition's C2, the README rows); its `vite build` and baseline check ran on Linux before the push and are quoted in the PR description. Platform-only rows: none observed (every run was on Linux; the Windows runs of the seven new files were green as well, 358/358). The Firestore rules suite was not run: nothing under `firestore.rules` changed.

## 19. Delivery state

| Item | State |
|---|---|
| Branch | `claude/tf-setup-evaluator-slice1` on `origin`, pushed by refspec `HEAD:refs/heads/claude/tf-setup-evaluator-slice1` from the build worktree's branch (V3 §13); cut at `origin/main` `24495eba`, which did not move during the build (re-fetched before the push), so the merged tree was the branch itself at the build. At the closeout `origin/main` had moved to `62380f14` (the #999 merge); it was merged into the branch at `8522e656`, and the merge-base for the cross-revision check is now `62380f14` (§20) |
| Commits | `6f3f275d` (the slice) · `f3d5d38f` (C1, the review doc byte-identical, the README rows) · `ed34f212` · `78d37087` · `c9c02fc4` (the review fix round) · `10f534b2` (report, first draft) · `f3ae1bd1` (M45's row) · `ea88228e` (report, second draft) · `a2264f48`, `d04e2918`, `e7907900` (the mutating lens's round) · `de981027` (report, third draft) · `c5602832` (the refuter TEV3's rows) · `d7037574` (the report's §0, §8, §9, §17, §18 and §19) · closeout: `4c033d1f` (the three corrections, the golden re-recorded), `8522e656` (`origin/main` merged), then the closeout's documents commit (this report, the definition's C2, the README rows) |
| Code and test head | `c5602832` at the build; `4c033d1f` at the closeout, after which only the merge of `origin/main` and documents follow |
| Pull request | a **draft** against `main`, opened from the pushed head after this commit with `open-pr.mjs` (REST, `draft: true`; no `gh` on this machine). Its number is recorded in the PR and in the delivery message, not in this report: the report is committed before the PR exists, and a later commit carrying the number would move the pushed head past the one §18 checked |
| Final checks on the pushed head | run on Linux after this commit, by full SHA (§18's last row); the figures are quoted in the PR description |
| Delivered | the draft PR; this report (the verdict table §0; the review record §17; the final checks §18); the test results (§8, §18), the review results (§17), the replay coverage (§10) and the ten evidence receipts (§10.7); the open questions Q-TE-1 … Q-TE-13 (§15) |
| STOP | delivery ends at pushed (V3 §13; BUILD_RULES §2, pushed ≠ merged): no CI watching, no review request, no merge, no flag, no cron, no deploy, no activation, no live wiring, no production capture expansion. The follow-ups in §16 wait for the founder's instruction |
| Pull request at the closeout | #1001, still a **draft**; its description updated at the closeout by a body-only REST call, the draft flag untouched |
| Merge-readiness | not asserted; the independent Astra review of the closeout branch is the next step |

## 20. Closeout (28 Oct 2026, after the founder's rulings)

Claude Code (Claude Opus 5.5), in the same session, under the founder's bounded closeout instruction of 28 Oct 2026. It authorized three corrections, the thirteen rulings recorded, focused verification, documentation updates and a push to the existing draft PR. It excluded merge, deploy, activation, live consumers and any later slice. The five-lens review and the 79-mutant campaign were not repeated, as instructed: they cover the build head `c5602832`, not this section's code. The independent Astra review of the resulting branch is the next step.

### 20.1 State at the start (VERIFIED)

- The local branch `claude/measured-trend-evidence-slice-1-1c45de` was at `d7037574`, equal to `refs/heads/claude/tf-setup-evaluator-slice1` on `origin` (the PR head), with a clean working tree. PR #1001 was open, a draft, with no reviews.
- `origin/main` had moved from `24495eba` to `62380f14` (the #999 merge, 15 commits). None of its 57 changed files is a file of this PR.
- `main` carries no `api/_utils/setupEvaluator/` at `62380f14`, so no evaluator baseline has been accepted. This is still initial baseline creation.

### 20.2 The three corrections (code at `4c033d1f`)

1. **Provenance on refused evidence.**
   - The adapter copies the caller's `sourceMeta` onto every result, refusals included (`api/_utils/setupEvaluator/dailyBarsAdapter.js:136-137`). The copy keeps only the keys supplied, is null when none was supplied, and is never filled from the bars. The ok result's `sourceMeta` is now a copy too (`:244`); before, it was the caller's own object.
   - Every record carries `requestedAsOf` (`api/_utils/setupEvaluator/tfSetupV1.js:297`, `:308`). On ok evidence, `asOf` is the completed session and `requestedAsOf` the caller's date. On a refusal record both are the caller's date (`:335`), and `refusal.expected` is the calendar's expected session, null when the adapter refused before naming one (`:336`). The record's `asOf` keeps its meaning. The header states the two dates (`:51-58`).
   - The replay's two hand-built refusals, an unfetched symbol and a cache window that ends before asOf, now go through one exported helper (`scripts/experiments/tf-setup-corpus-replay.mjs:321`, called at `:730` and `:736`). The cache's own `fetchedAt`, `from` and `to` ride as `sourceMeta`, and its bars stay `later_reconstruction`. With no cache, `sourceMeta` is null.
2. **Synthetic evidence labelled.** The fixture's evidence builder labels its bars `evidenceClass.bars = 'synthetic'` (`api/_utils/setupEvaluator/__fixtures__/syntheticBars.js:80`). The adapter's default stays `later_reconstruction`, the replay passes `later_reconstruction` explicitly, and the adapter's JSDoc names `synthetic` as test-only (`dailyBarsAdapter.js:124`). The adapter does not validate the class, as before; no behaviour was added.
3. **The split-heuristic header** now states `1 − min / max` of the two days' ratios (`dailyBarsAdapter.js:33`), matching the code at `:227`. The formula and the 0.10 threshold are unchanged.

No strategy rule, threshold, pattern or semantics id changed.

### 20.3 The rulings recorded

The founder's rulings on Q-TE-1 … Q-TE-13 are the fourth column of §15. The ones that bear on the definition, and the record contract (Q-TE-4, Q-TE-5, Q-TE-10), are appended to `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` as **Clarification C2**: 24 insertions, 0 deletions, with C1 and the blessed text above it byte-identical (§11). C2 names the implemented field names as the authoritative record shape. It reconciles the definition's wording, which calls `regime` a fact in `factsUsed` and the pattern `setupPattern`. The pilot spec V1.4's §5 is not touched.

### 20.4 The golden and the baseline: the pre-acceptance trail

The golden was regenerated once at the closeout. Every regeneration is listed below; each "previous → new" is the golden's canonical SHA-256 (derived), and the same trail, with full hashes, is the baseline entry's note.

| # | Commit | Previous | New | Why |
|---|---|---|---|---|
| 0 | `6f3f275d` | — | `d3501e5fcd5af6f4675094449ebeebadad61b60f55ddb67276c2b685a395f9b2` | the first golden, 40 scenarios |
| 1 | `c9c02fc4` | `d3501e5f…` | `34e3ec85ccefd9b503994f611bb37e20a3aaa86eca4e8fd3017ade4a0bb58c2c` | the §2 review fix round: 3 scenarios added (43), holding records without pattern assessments, symmetric regime chains |
| 2 | `a2264f48` | `34e3ec85…` | `b54a38dc0ac372d4123f873cbf6bca903cbe0111b8fe01051386378fc442cae0` | the mutating lens: 5 scenarios added (48) |
| 3 | `d04e2918` | `b54a38dc…` | `471fce6fdd094753c6e02720b81425fcd853f426ec61a07ca9ab7aca192cf4e9` | `stack_middle_inequality_only` added (49; mutant M50) |
| 4 | `4c033d1f` | `471fce6f…` | `796e75d1486c5581245edf43cdcd79f52b0f2d4e49010d0f8ba9ec79a8424b03` | the closeout: the `synthetic` bars class and the added `requestedAsOf` |

- **What regeneration 4 changed (derived, field by field).** Exactly two paths differ, on all 49 records: `evidenceClass.bars`, from `later_reconstruction` to `synthetic`, and the added `requestedAsOf`, equal to `asOf` on every synthetic record. No verdict, reason, check, fact, pattern, window or date changed. The golden holds no refusal record, so the refusal provenance does not reach it.
- **The baseline** is still one entry under `tf-setup-v1/sem-1`, re-recorded in place: `goldenSha256` `796e75d1…`, `recordedAt` `2026-10-28T19:45:07.229Z`. Its note keeps C1, FD-P3-1 and the initial-creation statement, and it adds the four transitions above with their previous and new hashes. The generator refused to run unless the committed entry was exactly the expected one.
- **The cross-revision check** against the new merge-base `62380f14` reports `mode: initial` and PASS (§18). The same check against the previous PR head `d7037574` **fails, by design**, exit 1, with three named failures: entry 0 was rewritten; the golden bytes changed under the unchanged `SEMANTICS_ID`; no entry was appended. That is the post-acceptance rule. It shows the guard has teeth, and it does not apply until an entry is on `main` (Q-TE-8, kept strict).

### 20.5 The replay: run 3 of record, from the cached payloads

- `tfs-20261028T194805`: `plan` at `4c033d1f` (clean) from the saved 13 Oct capture. Run 2's 29 payload files were copied byte for byte, and each was re-verified against its `payloadSha256`. `bars` was **not run**, so no provider call was possible: the manifest records 0 calls. `evaluate` and `report` ran at `4c033d1f`, clean, with no drift.
- **Compared with run 2 (derived):** the population, the plan, the 36 pairs, every count in `summary.json`, the entry tallies, the data-unknown share (1 of 19, 5.3%), the 17-moment join and the ten receipts are identical. `summary.json` differs only in the run id, two timestamps and the provenance stamps (15 keys). `report.md` differs in 6 lines: the title, the timestamp, three provenance lines and the run instant. The receipts in §10.7 are line-identical in run 3's report.
- `evaluations.json` differs in three record paths only. `requestedAsOf` is new on 36 of 36 records. On the one refused pair, CTVA as of 2026-10-06 (`basis_discontinuity`), `sourceMeta` is now `{ fetchedAt: 2026-10-28T16:20:29.425Z, from: 2026-05-14, to: 2026-10-09 }` and `refusal.expected` is `2026-10-06`; run 2 carried neither.
- EODHD calls at the closeout: 0. Across the slice: 29 of 60, unchanged. No production store was read. The evidence stays date-only.

### 20.6 Verification

| Check | Result |
|---|---|
| The seven test files, Windows | **382 rows, all green** (358 + 24: the adapter file 77, with a table over all nine refusals, early and late, each with and without `sourceMeta`, through both record kinds, plus partial and absent metadata, the ok record's two dates and the bars-class guard; the replay file 28) |
| `eslint` on the changed source and test files | exit 0 |
| Spot mutants on the new rows | 8 of 8 killed (below) |
| Linux, CI shape, at `8522e656` (the closeout with `origin/main` merged) | 1,205 test files passed, 8 skipped; **26,473 rows passed, 89 skipped, 0 failed** (278 s); `npm run lint:gate` exit 0; `vite build` exit 0 (14.0 s); the baseline check PASS (§18) |
| Baseline check against `62380f14` | PASS, `mode: initial` |

| Mutant | Change | Result |
|---|---|---|
| MC1 | refusals drop `sourceMeta` | KILLED (19 red) |
| MC2 | the ok result shares the caller's `sourceMeta` object | KILLED (1) |
| MC3 | an absent `sourceMeta` becomes an empty object | KILLED (10) |
| MC4 | refusal records drop `refusal.expected` | KILLED (12) |
| MC5 | refusal records lose `requestedAsOf` | KILLED (12) |
| MC6 | ok records report the session as the requested date | KILLED (1) |
| MC7 | the short-cache refusal drops its provenance | KILLED (1) |
| MC8 | the fixture labels synthetic bars `later_reconstruction` again | KILLED (86) |

- **A working-copy artifact, recorded.** The mutants ran in place on the committed code and were restored with `git checkout`. On this machine (`core.autocrlf=true`) that restore rewrote files with CRLF endings. The replay script's first line, a shebang, then fails to parse under vitest on Windows: MC8's run collected 354 rows, not 382, though 86 of them failed, so it is still killed. MC2's multi-line find string no longer matched, and it was re-run after the files were rewritten from their LF blobs (raw hash equal to each blob). The seven files were then green again, 382 of 382. Committed blobs are LF, so Linux and CI are unaffected.

### 20.7 Files changed at the closeout

- **Code** (`4c033d1f`): `api/_utils/setupEvaluator/dailyBarsAdapter.js`, `api/_utils/setupEvaluator/tfSetupV1.js`, `api/_utils/setupEvaluator/__fixtures__/syntheticBars.js`, `scripts/experiments/tf-setup-corpus-replay.mjs`.
- **Fixtures:** `goldenVerdicts.json` (regenerated) and `goldenBaseline.json` (the one entry re-recorded).
- **Tests:** `dailyBarsAdapter.test.js` (+22 rows), `tf-setup-corpus-replay.test.js` (+2), `tfSetupV1.entry.test.js` and `tfSetupV1.holding.test.js` (rows amended for `refusal.expected`, `requestedAsOf` and the `synthetic` class).
- **Documents:** this report, `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` (C2 appended) and `docs/README.md` (two rows).
- **Merge:** `8522e656` merges `origin/main` `62380f14` and touches no file of this PR.
- Every file is one this PR introduced, except the definition and the README, the two documents V3 allows. No existing source or test file is edited.

### 20.8 Open after the closeout

- The independent Astra review of the branch.
- The follow-ups of §16, now with the two later-work items the rulings named: corporate-action normalization (Q-TE-3) and test-catalog versioning for the golden guard (Q-TE-8).
- The founder's read of the ten receipts (§10.7), which are unchanged.
- STOP: the PR stays a draft. Nothing is merged, deployed, activated or wired.
