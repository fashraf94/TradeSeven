# Experiment: declarations wording, round 2 (paired offline replay)

**Date:** 2026-10-01 (ET) · **Builder:** Claude Code · **Branch:** `claude/declarations-wording-round2` · **Scripts:** `scripts/declarations-wording-experiment.mjs` (now takes `--round=2`), `scripts/declarationsWordingArms.mjs` (adds arm D2)
**Context:** Round 1 is `docs/audits/20261001_DECLARATIONS_WORDING_EXPERIMENT.md`. The founder ruled that shadow will not resume, and that D-style wording will run only in battles where the player can see the cockpit. This round tests D as written in round 1 and D2, a variant of D that changes only the called-shot `said` text.

**Session preamble (BUILD_RULES §2, §3).**
- `git fetch origin` ran first, then `git checkout main && git pull` ("Already up to date"), then `git checkout -b claude/declarations-wording-round2`. HEAD at the start was `88d73387d157cb0c377ba8980cceeaf1443ac725` (Merge PR #920), equal to `origin/main`. Between round 1's base (`2440b7a6`) and this HEAD, the only changes under `api/`, `src/data`, `src/config` and `scripts/` are the two experiment scripts and one film-tape test. The tool schema and the evaluator are unchanged.
- The tree had three untracked files at the start, none from this task: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json` and `vwap-exit-dating-census-report.json`. None is committed here.
- **API key:** handled as in round 1. `CLAUDE_API_KEY` is loaded from `.env.local` through `scripts/loadLocalEnv.js`. The check confirms only that the key exists and starts with `sk-ant-`. The key was never printed.
- **Production access was read-only.** The script uses only Firestore `.get()`, `.select()` and `getAll()`. No flag was changed, and no fenced file or `agentEvalToolSchema.js` was edited. Fence status (BUILD_RULES §1): nothing fenced was edited or called. The script's imports are the same non-fenced modules as in round 1.
- **Raw data** (per-call records, the sample with its recorded request bodies, and the analysis output) is in `experiments/declarations-wording/raw/round2/`. That folder sits inside the already git-ignored `experiments/declarations-wording/raw/` (`.gitignore:108`), so nothing raw is committed.
- **Round 1 still reproduces exactly.** Run without `--round=2`, the edited script gives round 1's defaults. Rerunning `analyze` on round 1's raw records produced a `results.md` byte-identical to the one behind the round-1 report.

## Executive verdict

| Question | Answer |
|---|---|
| **Was the replay valid?** | **Yes.** The round-1 gate was rerun in full. 193 of 207 model-ok checks are recoverable byte-for-byte (SHA-256 and byte length match, none truncated). All 193 recorded tools byte-match HEAD's arm A (43) or arm B (150). A transient probe confirmed that, with `tools` removed, the requests are byte-identical between `off` and `shadow`, and between `off` and `on`. |
| **Sample** | **All 193 recoverable checks**, with no stratification cap: 185 `momentum_chaser` and 8 `contrarian`, in 13 battles over 7 ET days. **3 arms × 2 reps = 1,158 calls. All returned on the first attempt, with no failures.** |
| **Cost** | **$23.68 spent** (16.43 M input tokens, 1.45 M output). The pre-run estimate was $28.59, under the $35 ceiling, so the run proceeded. |
| **Pass table (frozen bars)** | **D: FAIL · D2: FAIL.** |
| **D (round-1 text)** | Passes anticipation (+3.9 %, CI −3.1 % to +11.0 %), declaration rate (19.4 %), horizon (78.4 %), decision agreement (94.3 % against a 91.9 % floor) and health (`invalid_tool_result` 2.33 %, Fisher p = 0.071, no `max_tokens` stops). **It fails on added conditions in `said`: 13.8 % (23 of 167) against a limit of 10 %.** |
| **D2 (D + `said` override)** | Passes anticipation (+7.1 %, CI +0.2 % to +14.6 %), declaration rate (36.3 %), horizon (83.4 %) and decision agreement (96.1 %). **It fails `said` at 19.1 % (60 of 314) and fails health: `invalid_tool_result` is 3.89 % (15 of 386), above both the 3 % cap and the Fisher bar (p = 0.003).** |
| **D, round 1 vs round 2** | D's figures are stable from round 1 to round 2: declaration rate 21.3 % → 19.4 %, long-horizon share 78.5 % → 78.4 %, minted calls per declaring call 2.32 → 2.23. Anticipation moved from −4.0 % to +3.9 %, with overlapping CIs. Under the round-2 `said` rule, round 1's D lines score 19.0 % (15 of 79), against 13.8 % this round. |
| **Anything needed from you?** | **A ruling on the table.** As the brief requires, this report makes no wording recommendation. |

## 0. The gate (round 1's, rerun)

### 0.1 Byte-for-byte recovery

The test is the one round 1 used (round-1 report §0.1). It requires permanent `body.status === 'written'`, `request.body` to be a string, `request.truncated` to be false, and the SHA-256 and byte length of `request.body` to equal the permanent `requestSha256` / `requestBytes`. It also checks that model, temperature, `tool_choice` and key order equal production's values.

| Gate result (ET days Sep 21 to Oct 1) | Round 2 | Round 1 |
|---|---|---|
| Model-ok checks (finite `callMs`, no `haikuError`) | 207 | 207 |
| No tick document (battle `SNZ9…`, contrarian, ran before capture) | 14 | 14 |
| Body status other than `written` | 0 | 0 |
| Request absent / truncated / hash mismatch | 0 / 0 / 0 | 0 / 0 / 0 |
| Parameter mismatch (model, temperature, `tool_choice`, keys) | 0 | 0 |
| **Recoverable** | **193** | **193** |
| Recorded `max_tokens` 2,048 / 3,072 | 43 / 150 | 43 / 150 |
| Recorded tool byte-identical to HEAD arm A (baseline window) | 43 of 43 | 43 of 43 |
| Recorded tool byte-identical to HEAD arm B (shadow window) | 150 of 150 | 150 of 150 |

As in round 1, every replay call sends production's `max_tokens` of 3,072. The 43 baseline-window checks were recorded at 2,048, before `bdf277a7` raised the ceiling.

### 0.2 Only `tools` differs between modes

The round-1 transient probe was rebuilt. It was a temporary copy of `api/cron/agent-evaluate.tickStamps.callsOn.test.js` with one `describe` added, run under vitest and then deleted. It ran the real `processAgentBattle` on one battle at `off` and again at `shadow`, then at `off` and again at `on`, and compared the `messages.create` arguments.

| Pair | Keys | `system` / `messages` chars | Everything except `tools` | `tools` |
|---|---|---|---|---|
| `off` vs `shadow` | same 7, same order | 16,602 / 4,047 | byte-identical | differ |
| `off` vs `on` | same 7, same order | 16,602 / 4,047 | byte-identical | differ |

Both rows passed (2 of 2). The `on` row is new this round, because D-style wording is meant for `on` battles. The probe file was deleted, and `git status` afterwards showed the tree unchanged. The probe was never committed.

**Gate: PASS.** A pair that swaps only `tools` is valid for D and D2.

## 1. The sample

- **Population and sample are the same set:** all 193 recoverable checks, no cap. By archetype: `momentum_chaser` 185, `contrarian` 8. By window: baseline 43, shadow 150.
- **By battle (checks):** `DRgA4…` 18 · `jR53k…` 10 · `xKLKt…` 15 (baseline, Sep 22/23/25) · `NTNj4…` 16 · `dZYtJ…` 14 (Sep 28) · `jR12B…` 16 · `d3T2J…` 16 · `NScUW…` 8 (contrarian) · `lk1Cm…` 9 (Sep 29) · `2yNCA…` 17 · `bzfCE…` 23 (Sep 30) · `lwXrd…` 15 · `d3GNk…` 16 (Oct 1).
- **By ET day:** Sep 22: 18 · Sep 23: 10 · Sep 25: 15 · Sep 28: 30 · Sep 29: 49 · Sep 30: 40 · Oct 1: 31.
- Each battle falls on a single ET day, so "battle-day" in the pacing table means one battle on its one day.

## 2. The arms

The arms differ only in `tools`. Before any call, `assertDescriptionOnlyDiff(['D', 'D2'])` checked that D and D2 equal B once every `description` key is stripped (order-sensitive JSON), and that each differs from B in full. **Both assertions passed.** A separate check confirmed that D2 equals D with only `calledShots.items.properties.said.description` replaced.

| Arm | Tool | Serialized chars | `countTokens` (largest request) |
|---|---|---|---|
| A: off | `buildTradeDecisionTool({ declarations: false })` at HEAD | 8,537 | 16,289 |
| D | B + round-1 §2.2 overrides (`ARM_D_*`), unchanged | 13,565 | 17,633 |
| D2 | D with the called-shot `said` replaced by `ARM_D2_SAID` (the brief's text, verbatim) | 13,634 | 17,646 |

## 3. Cost and execution

- **Estimate before any call: $28.59.** That is `countTokens` on the largest sampled request, per arm, × 386 calls, plus 1,500 output tokens per call, at Haiku 4.5 list prices ($1 / $5 per M). The ceiling was $35, so the run proceeded.
- **Spent:** 16,433,276 input + 1,448,526 output tokens = **$23.68**, with no cache reads or writes.
- **Execution:** concurrency 4, with the same retry policy as round 1. **All 1,158 calls returned on the first attempt, with no failures.** The client timeout was 120 s.

## 4. Measures and method notes

Anticipation, declaration rate, horizon, decision agreement and the `max_tokens` / invalid counts are computed exactly as in round 1 (round-1 report §4). This round adds or changes the following:

- **Declaration-rate bar:** between 15 % and 40 % of calls.
- **"Added conditions in `said`" rule**, applied exactly as frozen in the brief to every minted called shot. A line is flagged if it matches, case-insensitive, any of: `volume`, `rvol`, `candle`, `consecutive` (each a word-start, so they also match "volumes" or "candles"), `if confirmed`, `on confirmation`, `confirmation of`, `close(s) above|below`, or `hold(s|ing) above|below` followed later in the line by a whole-word `for` or `through`. On a `next_check` horizon it is also flagged for `by|before the close`, `end of (the) day|session`, or `on the day`. On any other horizon it is also flagged for `next check|next eval`. Bare thesis language ("would confirm the breakout") matches nothing. Wording outside these phrases is not flagged. For example, "holds above $283.50 by close" (no `for`/`through`) and "before session close" are not. The matched terms for every flag are listed in §5.
- **Health bar:** `max_tokens` rate ≤ 2 %, **and** `invalid_tool_result` rate ≤ 3 %, **and** a one-sided Fisher exact test of the arm's invalid count against A's (2×2 table; the alternative is "arm higher") with p ≥ 0.05. The function was checked against a known value: 6/160 vs 2/160 gives p = 0.141.
- **Health detail by field:** `invalidField` and `reason` from `validateTradeToolResult` (`api/_utils/agentEvalToolResultValidation.js:92`), the first failing field, as production records it.
- **Pacing:** for each battle-day and rep, the number of checks whose declarations survive `captureDeclarations` with `phase === 'expected'` (declaring checks), and the number of calls those checks mint. The two reps are averaged, then summarized across battle-days by archetype. The denominators are the **recoverable model-ok checks** of each battle-day (the whole population, since this round has no cap), not every cron tick.
- **D, round 1 vs round 2:** round 1's D figures are read from round 1's own `results.json`. Round 1's D called shots were also re-validated and re-scored under the round-2 `said` rule, so that row compares like with like.
- **Random `said` lines:** 20 per arm, a seeded draw from every minted called shot, flagged or not, marked **FLAGGED** where the rule trips.

## 5. Results

All figures below are generated by `node scripts/declarations-wording-experiment.mjs analyze --round=2` from the 1,158 raw records. 193 checks are complete (all six calls present), so 386 calls are analyzed per arm.

### Measures by arm

| Measure | A: off | D: on (draft) | D2: D + said override |
|---|---|---|---|
| Calls analyzed (complete checks × 2) | 386 | 386 | 386 |
| Anticipation candidates per call (mean) | 1.20 | 1.25 | 1.29 |
| Paired difference vs A (relative) | — | 3.9% [-3.1%, 11.0%] | 7.1% [0.2%, 14.6%] |
| Declaration rate (calls) | 0.0% (0) | 19.4% (75) | 36.3% (140) |
| Checks with ≥1 declaring rep | 0.0% | 34.2% | 56.5% |
| Minted calls per declaring call | n/a | 2.23 | 2.24 |
| Calls on this_session / this_battle | n/a of 0 | 78.4% of 167 | 83.4% of 314 |
| …called shots only | n/a | 78.4% | 83.4% |
| `said` inconsistency (called shots) | n/a (0/0) | 13.8% (23/167) | 19.1% (60/314) |
| Decision agreement with A (rep-aligned) | 100.0% | 94.3% | 96.1% |
| `max_tokens` stop rate | 0.00% (0) | 0.00% (0) | 0.00% (0) |
| `invalid_tool_result` rate | 0.78% (3) | 2.33% (9) | 3.89% (15) |
| …one-sided Fisher p vs A | — | 0.071 | 0.003 |
| No `tool_use` block | 0 | 0 | 0 |
| Output tokens p50 / p95 | 1159 / 1700 | 1234 / 1887 | 1331 / 1950 |
| Input tokens (mean, billed) | 13291 | 14635 | 14648 |
| Tool size (serialized chars) | 8537 | 13565 | 13634 |
| `countTokens` input, largest request | 16289 | 17633 | 17646 |

**Noise floor (A rep 1 vs A rep 2):** anticipation 0.0% [-9.0%, 10.0%]; decision agreement 96.9%.

### Kind mix, horizon mix, validator removals

| Arm | Kinds | Horizons (all calls; fork = next_check) | Removed by validator |
|---|---|---|---|
| A | — | — | — |
| D | called_shot 117, confirmation 50 | this_session 131, next_check 36 | calledShots:malformed 16, block:malformed_block 9, calledShots:no_slot_before_battle_end 4, calledShots:explicit_invalid 1 |
| D2 | called_shot 213, confirmation 101, watching 21 | this_session 262, next_check 52 | calledShots:malformed 22, block:malformed_block 17, calledShots:explicit_invalid 2, calledShots:no_slot_before_battle_end 2 |

### Pass table (§5, frozen bars)

| Bar | D | D2 |
|---|---|---|
| Anticipation: paired diff ≥ −10% and CI low ≥ −20% | PASS | PASS |
| Declaration rate 15%–40% of calls | PASS | PASS |
| ≥ 50% of calls this_session / this_battle | PASS | PASS |
| Added conditions in `said` ≤ 10% of called shots | FAIL | FAIL |
| Decision agreement ≥ A1-vs-A2 − 5 pts | PASS | PASS |
| `max_tokens` ≤ 2%, invalid ≤ 3% and Fisher p ≥ 0.05 | PASS | FAIL |
| **Overall** | **FAIL** | **FAIL** |

### Pacing per battle-day, by archetype (mean of the two reps; mean · median · min–max across battle-days)

| Arm | Archetype | Battle-days | Checks per battle-day | Declaring checks per battle-day | Minted calls per battle-day |
|---|---|---|---|---|---|
| A | contrarian | 1 | 8.0 · 8.0 · 8.0–8.0 | 0.0 · 0.0 · 0.0–0.0 | 0.0 · 0.0 · 0.0–0.0 |
| A | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 0.0 · 0.0 · 0.0–0.0 | 0.0 · 0.0 · 0.0–0.0 |
| D | contrarian | 1 | 8.0 · 8.0 · 8.0–8.0 | 1.5 · 1.5 · 1.5–1.5 | 3.5 · 3.5 · 3.5–3.5 |
| D | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 3.0 · 2.0 · 0.0–6.5 | 6.7 · 5.0 · 0.0–15.5 |
| D2 | contrarian | 1 | 8.0 · 8.0 · 8.0–8.0 | 3.0 · 3.0 · 3.0–3.0 | 7.0 · 7.0 · 7.0–7.0 |
| D2 | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 5.6 · 5.0 · 3.5–9.0 | 12.5 · 10.5 · 6.0–25.0 |

### Health detail by field (`invalid_tool_result`, first failing field as production records it)

| Arm | Invalid / returned | Distinct checks | By field | By reason |
|---|---|---|---|---|
| A | 3 / 386 | 3 | conviction 2, hypothesis 1 | required field 'conviction' is missing 1, required field 'hypothesis' is missing 1, 'conviction' is not integer 1 |
| D | 9 / 386 | 9 | conviction 4, swap_type 3, anticipationCandidates 1, hypothesis 1 | 'swap_type' is not one of defensive_cut|profit_take|momentum_rotation|upgrade 3, required field 'conviction' is missing 3, 'anticipationCandidates' is not array 1, required field 'hypothesis' is missing 1, 'conviction' is not integer 1 |
| D2 | 15 / 386 | 15 | conviction 4, hypothesis 4, swap_type 3, trade_reasoning 2, riskAssessment 1, anticipationCandidates 1 | required field 'hypothesis' is missing 4, 'swap_type' is not one of defensive_cut|profit_take|momentum_rotation|upgrade 3, 'conviction' is not integer 2, 'trade_reasoning' is not object|null 2, required field 'conviction' is missing 2, required field 'riskAssessment' is missing 1, 'anticipationCandidates' is not array 1 |

### `said` flags by matched term (a line can match more than one)

| Arm | Terms |
|---|---|
| A | — |
| D | close(s) above/below 9, volume 6, holds/holding above/below … for/through 4, next check/eval (not next_check) 3, consecutive 2 |
| D2 | holds/holding above/below … for/through 23, volume 20, close(s) above/below 11, if confirmed 7, next check/eval (not next_check) 3, candle 1, confirmation of 1, consecutive 1 |

### D: round 1 vs round 2

| Measure | D, round 1 | D, round 2 |
|---|---|---|
| Checks (complete) | 80 | 193 |
| Calls analyzed | 160 | 386 |
| Anticipation per call (mean) | 1.34 | 1.25 |
| Paired difference vs A | -4.0% [-14.0%, 6.4%] | 3.9% [-3.1%, 11.0%] |
| Declaration rate | 21.3% (34) | 19.4% (75) |
| Minted calls per declaring call | 2.32 | 2.23 |
| this_session / this_battle share | 78.5% of 79 | 78.4% of 167 |
| `said` flagged, round-1 rule | 10.1% (8/79) | not computed |
| `said` flagged, round-2 rule | 19.0% (15/79) | 13.8% (23/167) |
| Decision agreement with A | 95.6% | 94.3% |
| A1-vs-A2 agreement (noise floor) | 97.5% | 96.9% |
| `max_tokens` stops | 0.63% (1) | 0.00% (0) |
| `invalid_tool_result` | 3.75% (6) | 2.33% (9) |
| Output tokens p50 / p95 | 1296 / 1928 | 1234 / 1887 |

### Flagged `said` lines (up to 10 per arm, agent text only)

**Arm A** (0 flagged of 0)
- none

**Arm D** (23 flagged of 167)
- `AMD` · `this_session`: "AMD reaches +1.0x ATR bonus (+$7.33 = $625.04) — if it holds above this level through close, lock in +15 pts and evaluate sector rotation." — *holds/holding above/below … for/through*
- `PWR` · `next_check`: "If PWR closes below $643.50 (entry), I would swap to EMR (Industrials, +1.67%, technicalScore 86, RS vs SPY strong)." — *close(s) above/below*
- `BE` · `this_session`: "If BE holds above $290 through the next 2 hours without further extension, I would consider swapping it into Support tier to capture residual momentum." — *holds/holding above/below … for/through*
- `LRCX` · `this_session`: "If LRCX closes below 323 (entry level) and the NR7 breakout fails, I would rotate it out." — *close(s) above/below*
- `HOOD` · `this_session`: "HOOD reaches +1.0x ATR bonus (+$7.78 = $131.26) — if it holds above this level through close, lock in +15 pts and consider profit-taking into COIN." — *holds/holding above/below … for/through*
- `AMAT` · `next_check`: "AMAT breaks above $515 on the next 15-min check with volume confirmation, I would hold through bonus window." — *volume*
- `CRWD` · `this_session`: "CRWD exits below $266.50 (0.15x ATR below current) if momentum stalls without volume confirmation by close." — *volume*
- `NVDA` · `this_session`: "NVDA holds above $232.65 (its next resistance) through the close, I hold for the +1.0x ATR bonus." — *holds/holding above/below … for/through*
- `AMAT` · `this_session`: "If AMAT closes below 507 (entry level) and the NR7 breakout fails, I would rotate it out." — *close(s) above/below*
- `MU` · `this_session`: "MU exits if it trades below entry ($1065.08) and closes below daily VWAP by end of session." — *close(s) above/below*

**Arm D2** (60 flagged of 314)
- `PWR` · `this_session`: "PWR below $630 triggers -1.0x ATR Bust; would rotate to PANW or INTC if confirmed." — *if confirmed*
- `NVDA` · `this_session`: "NVDA holds above $235 (buyback story bid support) through end of day — bullish catalyst holding." — *holds/holding above/below … for/through*
- `HOOD` · `next_check`: "HOOD below $123.00 on the next 15-min candle signals NR7 setup failure; would rotate out." — *candle*
- `MU` · `next_check`: "MU below $1,070 on declining volume by next check would signal NR7 breakdown; reconsider hold." — *volume*
- `NVDA` · `this_session`: "NVDA below 228.24 (reversing 0.25x ATR from peak) would trigger S6 exit condition; I would rotate to INTC or AMD if confirmed." — *if confirmed*
- `GME` · `this_session`: "GME below -1.0x ATR (23.65) by close would trigger Bust penalty; monitor for defensive exit if volume surges down." — *volume*
- `INTC` · `this_session`: "INTC exits Star if it trades below $119.50 (approx -0.5x ATR support) on volume, signaling choppy regime breakdown." — *volume*
- `EMR` · `this_session`: "EMR holds above 159.0 through close, confirming defensive entry thesis." — *holds/holding above/below … for/through*
- `AMD` · `next_check`: "AMD below $608.00 (current entry) by next check would trigger -0.56x ATR threshold; if confirmed, defensive swap to healthcare warranted." — *if confirmed*
- `TXN` · `this_session`: "TXN holds above $278 (-1.25% from entry) through close = no exit." — *holds/holding above/below … for/through*

### 20 randomly sampled `said` lines per arm, flagged or not (seeded, agent text only)

**Arm A** (0 of 0)
- none

**Arm D** (20 of 167)
1. `SNOW` · `this_session`: "SNOW trades above $354.34 (1.0x ATR bonus level) by close."
2. `AMAT` · `next_check`: "AMAT trades below entry ($512.01) on the next check, I would evaluate a swap to INTC (+2.63% today, technicalScore=85)."
3. `SNOW` · `next_check`: "SNOW trades above $347.50 (NR7 resistance) by next check: NR7 breakout confirmed, squeeze has fired."
4. `AMD` · `this_session`: "If AMD breaks below 605.46 (1.0x ATR support), I'm watching for a regime shift from directional_expansion to choppy."
5. `ORCL` · `this_session`: "ORCL trading below $138.11 (entry) by end of session would signal entry failure; I would hold unless it breaches -1.0x ATR ($127.62)."
6. `BE` · `this_session`: "If BE holds above 295.0 and consolidates, I would consider swapping it into Core tier to capture the momentum setup."
7. `AMD` · `this_session`: "AMD exits Star if it trades below $620.00 by close (0.25x ATR reversal from peak)."
8. `PANW` · `this_session`: "If PANW breaks below 391.45 (approaching -1.0x ATR Bust at -7.6%), I would rotate it out to a bench candidate like SNOW or INTC."
9. `MU` · `this_session`: "MU trading below $1048.75 (0.5x ATR below current) before close would signal NR7 setup failure and warrant exit consideration."
10. `MAR` · `this_session`: "MAR trades above $360.51 by end of session, confirming the +1.0x ATR bonus is in reach."
11. `TXN` · `this_session`: "TXN trading below $279.50 before session end would signal NR7 compression failure; I would reconsider hold."
12. `AMD` · `this_session`: "AMD trades below $575.00 (Bust threshold, -1.0x ATR) before session end, I will exit to protect banked points."
13. `MU` · `next_check`: "MU will trade below $1044.42 (−0.5x ATR) by the next check, triggering S36 automatic swap."
14. **FLAGGED** `AMAT` · `this_session`: "AMAT trades below $512 (entry price) for 2 consecutive 15-min checks; S15 would trigger, but I will hold pending NR7 breakout confirmation." — *consecutive*
15. `MU` · `this_session`: "MU trades above $1100 (+2.5% from current) and HOOD fails NR7 breakout, I rotate MU into Core."
16. `PWR` · `this_session`: "PWR above $647.96 (entry price) before close triggers BaggerBomb bonus entry."
17. `HOOD` · `this_session`: "HOOD trades below $122.50 (entry -0.9%) by close, I exit to protect the Star slot."
18. `TXN` · `this_session`: "TXN holds above $283.50 (entry +0.70%) by close, the NR7 breakout confirms and I stay."
19. `NVDA` · `next_check`: "NVDA trades above 232.65 (R +1.51%) by the next check."
20. `LRCX` · `this_session`: "LRCX trades below $312 (approximately -2.5% from current, or -0.35x ATR) before the close."

**Arm D2** (20 of 314)
1. **FLAGGED** `MSFT` · `this_session`: "MSFT exits Support if it trades below $489.01 (current support level) on above-average volume before session close." — *volume*
2. **FLAGGED** `ETN` · `this_session`: "ETN closes below $438 on heavy volume — exit Support tier to reduce drag." — *volume; close(s) above/below*
3. `META` · `this_session`: "META below 726.75 (breaking -0.5x ATR at -3.3%) would trigger Core rotation."
4. `GME` · `next_check`: "GME above $25.28 (0.50x ATR) by next check — momentum confirmed, hold through bonus."
5. `META` · `this_session`: "META below $720 (approaching -0.5x ATR) would trigger rotation consideration."
6. `HOOD` · `this_session`: "HOOD breaks above $124.65 (NR7 upper breakout level) by end of day."
7. `MSFT` · `this_session`: "MSFT trades above $500.00 (BB squeeze breakout), confirming volatility expansion."
8. `AMD` · `this_session`: "AMD below $628 (lower NR7 band) by close signals squeeze failure; would exit."
9. `HOOD` · `this_session`: "HOOD below $120.50 (1.0x ATR down from entry) triggers Bust penalty — would exit to protect banked points if this level breaks intraday."
10. `AMD` · `next_check`: "AMD breaks below $627.50 on the next check, I would consider a defensive exit despite the green."
11. **FLAGGED** `AMD` · `this_session`: "AMD closes below -0.9x ATR (Bust imminent) before bench stocks unlock at 2:01 PM — defensive exit to protect banked points." — *close(s) above/below*
12. **FLAGGED** `TXN` · `this_session`: "TXN breaks below $279.00 (7-day low) on volume, signaling downside resolution of NR7 contraction." — *volume*
13. `HOOD` · `this_session`: "HOOD above 132.68 (reaching +0.5x ATR bonus at +6.8%) by session close."
14. `AMD` · `this_session`: "AMD breaks above +0.5x ATR ($633.58) by end of session, confirming S1 Volatility Squeeze Breakout."
15. `INTC` · `this_session`: "INTC above entry ($121.06) by close locks in breakeven and justifies holding through close."
16. **FLAGGED** `CRWD` · `this_session`: "CRWD holds above $265 through close or I rotate it out." — *holds/holding above/below … for/through*
17. `ETN` · `this_session`: "ETN breaks below entry ($437.98) on the session — exit to stop the bleed."
18. `AMD` · `this_session`: "AMD above $658.76 (+6.6% from entry, +0.5x ATR breakout) by end of session would confirm NR7 release and approach BaggerBomb threshold."
19. `AMD` · `next_check`: "AMD above 631.76 (breakout above NR7 high) by next check confirms momentum continuation."
20. `AMD` · `this_session`: "AMD above $631.08 (+1.0x ATR bonus threshold, +2.3% from current) by end of session would lock +15 bonus pts at Star tier."

### Example `declarations` blocks (five per arm, seeded pick, agent text only)

**Arm A**: no declaring call

**Arm D**

1. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "NVDA",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 228.38
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "NVDA trading below entry ($228.38) would signal failed breakout; I would reconsider hold if it closes below entry with no recovery attempt."
  },
  {
   "symbol": "SNOW",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 339.56
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "SNOW trading below entry ($339.56) would signal failed NR7 breakout; I would reconsider hold if it closes below entry."
  },
  {
   "symbol": "GME",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 23
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "GME trading below $23.00 (1.5x ATR below entry) would trigger Bust territory; I would exit defensively if it breaches this level."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

2. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "NVDA",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 232.65
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "NVDA trades above 232.65 (R +1.51%) by the next check."
  },
  {
   "symbol": "SNOW",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 344.91
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "SNOW trades above 344.91 (R +1.54%) by the next check."
  },
  {
   "symbol": "GME",
   "direction": "entry",
   "slot": "support",
   "condition": {
    "side": "above",
    "level": 24.65
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "GME trades above 24.65 (entry price) by the next check, confirming NR7 upside breakout."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

3. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "MU",
   "direction": "exit",
   "slot": "core",
   "counterpart": "MSFT",
   "condition": {
    "side": "below",
    "level": 1065.08
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "MU trades below $1065 (entry price) for 2 consecutive 15-min checks, triggering S15 auto-swap to MSFT."
  },
  {
   "symbol": "AMAT",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 512.01
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMAT trades below $512 (entry price) for 2 consecutive 15-min checks; S15 would trigger, but I will hold pending NR7 breakout confirmation."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

4. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "MU",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 1045.41
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "If MU trades below 1045.41 (breaking the NR7 support), I would consider rotating to a bench candidate with directional_expansion setup."
  },
  {
   "symbol": "TXN",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 276.71
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "If TXN breaks below 276.71 (NR7 support), I'm watching for a reversal signal before acting."
  },
  {
   "symbol": "BE",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 295
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "If BE holds above 295.0 and consolidates, I would consider swapping it into Core tier to capture the momentum setup."
  },
  {
   "symbol": "AMD",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 605.46
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "If AMD breaks below 605.46 (1.0x ATR support), I'm watching for a regime shift from directional_expansion to choppy."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

5. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "TXN",
   "direction": "exit",
   "slot": "star",
   "counterpart": "AMD",
   "condition": {
    "side": "below",
    "level": 279.5
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "TXN trading below $279.50 before session end would signal NR7 compression failure; I would reconsider hold."
  },
  {
   "symbol": "TXN",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 283.5
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "TXN trading above $283.50 before session end would confirm NR7 breakout and validate the hold thesis."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

**Arm D2**

1. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "MU",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 1068
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "MU breaks below $1068 before close, I would exit to lock in +9 pts and rotate to MSFT or INTC."
  },
  {
   "symbol": "CRWD",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 264
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "CRWD breaks below $264 before close, I would exit to lock in +16 pts and rotate to SNOW or INTC."
  },
  {
   "symbol": "MAR",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 357
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "MAR breaks below $357 on the next check, I would rotate to MSFT or INTC for sector rotation."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

2. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "TXN",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 280.21
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "TXN below $280.21 (entry $281.69 minus 0.5x ATR) would signal NR7 breakout failed; would reconsider hold."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

3. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "MSFT",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 489.01
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "MSFT exits Support if it trades below $489.01 (current support level) on above-average volume before session close."
  },
  {
   "symbol": "PLTR",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 189
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "PLTR enters Core if it holds above $189 at the next check, contingent on MSFT failing to break its BB squeeze."
  },
  {
   "symbol": "CRWD",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 258
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "CRWD enters Star if it holds above $258 and an active Tech position (INTC/AMD) reverses below -0.5x ATR."
  },
  {
   "symbol": "INTC",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 119.5
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "INTC exits Star if it trades below $119.50 (approx -0.5x ATR support) on volume, signaling choppy regime breakdown."
  }
 ],
 "watching": [
  "PLTR",
  "CRWD",
  "MSFT",
  "ETN",
  "INTC",
  "AMD"
 ],
 "playerAsk": null,
 "fork": null
}
```

4. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "AMD",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 620
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "AMD trades below $620 (NR7 support) by close, I exit to lock in learning and rotate to bench strength."
  },
  {
   "symbol": "INTC",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 120
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "INTC trades below $120 (NR7 support) by close, I exit to stop the bleed."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

5. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "SNOW",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 347.5
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "SNOW trades above $347.50 (NR7 upper resistance) by end of session."
  },
  {
   "symbol": "AMAT",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 536.2
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMAT reaches +1.0x ATR (~$536.20) before close."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

## 6. Limits of this read

- **Archetype coverage:** 185 of 193 checks are `momentum_chaser`. The `contrarian` pacing row is a single battle-day (8 checks).
- **The baseline window is 43 checks in 3 battles,** all `momentum_chaser`. Those checks were recorded at `max_tokens` 2,048 and are replayed at 3,072.
- **The `said` rule is lexical and literal.** It flags the frozen phrases and nothing else. Lines that add conditions in other words (e.g. "holds above … by close", "and the NR7 breakout fails", "contingent on MSFT failing") are not flagged, and the random samples above show some of them. The rule was not adjusted after the data was seen.
- **Pacing counts checks the model actually answered** and that were recorded, not every scheduled tick. A battle-day in production would also include no-model exits.
- **The universe for fork validation** is read from today's battle documents, as in round 1. No arm produced a surviving fork.
- **The replay measures what the model writes, not what happens next.** No call was minted, graded or flipped, and no player saw a tile.
