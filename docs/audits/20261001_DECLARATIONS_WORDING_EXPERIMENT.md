# Experiment: declarations wording, paired offline replay

**Date:** 2026-10-01 (ET) · **Builder:** Claude Code · **Branch:** `claude/declarations-wording-experiment` · **Scripts:** `scripts/declarations-wording-experiment.mjs`, `scripts/declarationsWordingArms.mjs`
**Why:** shadow read #1 (`docs/audits/20261001_CALL_RECORDS_SHADOW_READ_1.md`) found a 2.4 % declaration rate, `next_check` on every call, `said` lines claiming more than their fields, and a −30.4 % drop in anticipation candidates. This replay holds the request fixed and changes only the tool definition, so the schema's effect can be separated from day-to-day variance.

**Session preamble (BUILD_RULES §2, §3).**
- `git fetch origin` ran first. Then `git checkout main && git pull` ("Already up to date") and `git checkout -b claude/declarations-wording-experiment`. HEAD at the start was `2440b7a6bde3bb39609db08d923bae859c0260b1` (Merge PR #918), equal to `origin/main`.
- The tree had three untracked files at the start, none from this task: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json` and `vwap-exit-dating-census-report.json`. They are not committed here.
- **API key (founder's change to §0 step 2):** the script reads `CLAUDE_API_KEY` from `.env.local` through `scripts/loadLocalEnv.js` and passes it to the Anthropic SDK as `apiKey`. `ANTHROPIC_API_KEY` is not used. The check confirmed only that the key exists and starts with `sk-ant-`. It was never printed.
- **Production access was read-only.** The script calls only Firestore `.get()`, `.select()` and `getAll()`. It has no `set`, `update`, `delete`, `create`, `runTransaction`, `batch` or `bulkWriter` call. No flag was changed, and `agentEvalToolSchema.js` was not edited.
- **Fence (BUILD_RULES §1):** no fenced file was edited and no fenced function was called. The script imports non-fenced modules only: `agentEvalToolSchema.js`, `agentEvalToolResultValidation.js`, `agentEvalTransport.js` (constants), `callRecords/validate.js`, `callRecords/horizon.js`, `src/data/battleUniverse.js`, `firebaseAdmin.js` and `loadLocalEnv.js`.
- **One transient probe** (§0 step 4): a temporary copy of `api/cron/agent-evaluate.tickStamps.callsOn.test.js`, with one row added, ran under vitest and was deleted. It was never committed. `git status` afterwards showed the tree unchanged.
- **Raw data:** per-call records, the sample (including recorded request bodies) and the analysis output are in `experiments/declarations-wording/raw/`, which this branch adds to `.gitignore`. They stay on this machine.

## Executive verdict

| Question | Answer |
|---|---|
| **Was the replay valid?** | **Yes.** 193 of 207 model-ok checks (Sep 21 to Oct 1) have their request stored byte-for-byte. Each one's SHA-256 matches the permanent record, none is truncated, and every recorded tool byte-matches HEAD's arm A or arm B. At HEAD, `system` and `messages` are byte-identical between `off` and `shadow`; only `tools` differs. |
| **Sample** | **80 checks × 4 arms × 2 reps = 640 calls. All 640 returned and none failed.** The 80 checks are 18 baseline and 62 shadow; 72 `momentum_chaser` and 8 `contrarian`; 13 battles across 7 ET days. |
| **Cost** | **$13.37 spent** (9.25 M input tokens, 0.82 M output) against a pre-run estimate of $15.85 and a $25 ceiling. |
| **Pass table (§5)** | **B FAIL · C FAIL · D FAIL.** No arm clears every bar. Details are in §5. |
| **B (current text)** | Declares on 10 % of calls, puts 96 % of its calls on `next_check`, and 74 % of its `said` lines are flagged. The paired anticipation change is −6.7 % (CI −15.2 % to +2.5 %), which passes. **The −30.4 % production drop does not reproduce at that size.** |
| **C (shadow, revised)** | Passes declaration rate (54 %), horizon (82.5 % `this_session`) and `said` (8.1 %). It **fails anticipation** (−11.2 %, CI low −20.2 %; both bars missed narrowly) and **fails health** (`invalid_tool_result` 2.50 % vs A's 1.25 % + 1 pt). |
| **D (on, draft)** | Passes anticipation (−4.0 %), declaration rate (21 %) and horizon (78.5 %). It **fails `said`** (10.1 %, 8 of 79, against ≤ 10 %) and **fails health** (`invalid_tool_result` 3.75 %). |
| **Health bar, all three arms** | **Arm A had 2 invalid results in 160 calls**, both on one check (`lk1C…:eval_004`), so A's rate plus 1 point allows at most 3 invalid results per arm. B had 7, C 4 and D 6. The failures are spread across fields (`conviction`, `hypothesis`, `trade_reasoning`, `riskAssessment`) and checks. None names the `declarations` property. |
| **Anything needed from you?** | **A ruling on the table.** By the frozen bars, no arm passes. Per the brief, this report recommends no wording. |

## 0. The reconciliation gate

### 0.1 What `tickBodies` stores (§0 step 3)

All citations below are VERIFIED (read this session at `2440b7a6`).

| Item | Stored? | Where, and how it is recovered |
|---|---|---|
| The exact request (`model`, `max_tokens`, `temperature`, `system`, `messages`, `tools`, `tool_choice`) | **Yes, byte-for-byte** | The observing fetch copies the outgoing entity body string as dispatched, auth headers excluded (`api/_utils/tickCapture/captureBodyObserver.js:86-91`). It is stored as `request.body` with its UTF-8 byte count and SHA-256 (`captureWriter.js:96-100`), written into the `tickBodies` document (`captureWriter.js:189`). The permanent `ticks` document keeps the same `requestSha256` and `requestBytes` (`captureWriter.js:318-320`). |
| The model's response | Yes | The raw response bytes are cloned before SDK parsing and hashed as bytes (`captureBodyObserver.js:113-125`, `captureWriter.js:106-126`), and stored as `response.body` (`captureWriter.js:190`). The original tool result is also stored as `originalToolResult` (`captureWriter.js:194`). |
| Size limits | Recorded, never silent | A body over 128 KiB (`captureConfig.js:91`) is truncated and marked `truncated` (`captureWriter.js:380-388`). A document over 700 KiB (`captureConfig.js:97`) sheds `request.body` last (`captureWriter.js:443-444`). `body.status` records `written` / `truncated` / `copy_failed` (`captureWriter.js:409-420`). |
| Spec | — | `docs/specs/CAPTURE_BUILD_SPEC_V1_4.md` §3, "Body document": "the outgoing HTTP entity body as dispatched (UTF-8, auth headers excluded) … each with a SHA-256". |

**Recoverability test applied to every check:** permanent `body.status === 'written'`, `request.body` is a string, `request.truncated` is false, and SHA-256 and byte length of `request.body` equal the permanent `requestSha256` and `requestBytes`.

| Gate result (ET days Sep 21 to Oct 1) | Count |
|---|---|
| Model-ok checks (finite `callMs`, no `haikuError`) | 207 |
| No tick document (all 14 in battle `SNZ9…`, contrarian, Sep 21: it ran before capture was on and has no `tickSeq`) | 14 |
| Body status other than `written` | 0 |
| Request absent / truncated / hash mismatch | 0 / 0 / 0 |
| Any recorded parameter other than production's (see the `max_tokens` note) | 0 |
| **Recoverable** | **193** |
| Recorded tool byte-identical to HEAD arm A (baseline-window checks) | 43 of 43 |
| Recorded tool byte-identical to HEAD arm B (shadow-window checks) | 150 of 150 |

### 0.2 Only `tools` differs between modes (§0 step 4)

- **The request literal** is `api/cron/agent-evaluate.js:2767-2782`. `system` is `systemPrompt` (line 2771), and `messages` are `identityBlock`, a fixed assistant line, and `liveContextBlock` (2772-2776). All three come from `buildPrompt` (2704-2711), whose arguments carry no call-records state. The only mode-dependent key is `tools: [buildTradeDecisionTool({ declarations: callsActive(callsCtx.mode) })]` (line 2780). VERIFIED.
- **The prompt assemblers** (`agentEvalPromptAssembly.js`, `agentPromptAssembly.js`) contain no reference to `callRecords`, `CALL_RECORDS`, `callsCtx` or `declarations` (grep, this session). VERIFIED.
- **The off-golden proof** (`api/cron/agent-evaluate.callRecords.offGolden.test.js:436-447`) pins `off`: the tool schema and "every prompt byte" equal a frozen pre-change fixture. Separately, `agent-evaluate.tickStamps.callsOn.test.js:751-771` pins `shadow`: `messages` and `system` are byte-identical with and without call-record state on the battle. VERIFIED.
- **No existing test compares `off` with `shadow` on one battle.** A transient probe filled that gap: the `callsOn` harness ran one battle at `off` and again at `shadow`. With `tools` removed, the two `messages.create` arguments were byte-identical (`model,max_tokens,temperature,system,messages,tool_choice`; `system` 16,602 chars, `messages` 4,047 chars), and `tools` differed. The probe passed, then its file was deleted.

**Gate: PASS.** Swapping only `tools` is a valid pair.

### 0.3 Production request parameters (§0 step 5)

| Parameter | Value | Source (VERIFIED) |
|---|---|---|
| Model | `claude-haiku-4-5-20251001` | `api/_utils/agentEvalTransport.js:48`, used at `agent-evaluate.js:2768` |
| `max_tokens` | 3,072 | `agentEvalTransport.js:64`, used at `agent-evaluate.js:2769` |
| `temperature` | 0.4 | `agent-evaluate.js:2770` |
| `tool_choice` | `{ type: 'tool', name: 'submit_trade_decision' }` | `agent-evaluate.js:2781` |

**`max_tokens` note (a deviation from the recorded body, disclosed here).** All 43 baseline-window checks (Sep 22, 23 and 25) were recorded with `max_tokens: 2048`. The ceiling was raised to 3,072 by `bdf277a7` (2026-09-25 15:43 −05:00), after those checks ran. Per §0 step 5 ("the replay uses exactly those values"), every replay call in every arm sends 3,072. That was the only parameter that differed: the gate confirmed that model, temperature, `tool_choice` and key order match production on all 193 recoverable checks. `system` and `messages` are the recorded bytes, unchanged.

## 1. The sample

- **Population:** 193 recoverable checks in 13 battles (12 `momentum_chaser`, 1 `contrarian`). The only other non-`momentum_chaser` battle, `SNZ9…`, is excluded because it has no recorded requests (§0.1).
- **Stratification:** every battle is included, with at most 8 checks per battle. The non-`momentum_chaser` battle `NScUW…` got all 8 of its checks. The other 72 were spread round-robin, in seeded order, across the 12 `momentum_chaser` battles (6 each). Within a battle, the checks are sorted by time and split into k equal bins, and one check is drawn per bin. That spreads the sample across each battle's day.
- **Window** is read from each recorded request's own tool: a `declarations` property means shadow. **Seed:** `20261001` (mulberry32, seeded Fisher–Yates). Rerunning `select` on the same data reproduces this list.

| Cut | Counts |
|---|---|
| By archetype | `momentum_chaser` 72 · `contrarian` 8 |
| By window | baseline 18 · shadow 62 |
| By ET day | Sep 22: 6 (baseline) · Sep 23: 6 (baseline) · Sep 25: 6 (baseline) · Sep 28: 12 · Sep 29: 26 · Sep 30: 12 · Oct 1: 12 (shadow) |

**Selected checks** (the full list, for reproduction):

| Battle | Archetype | Window | ET day | Eligible | Sampled | evalIds |
|---|---|---|---|---|---|---|
| `DRgA4vrEIZ0kN574vexk` | momentum_chaser | baseline | 2026-09-22 | 18 | 6 | 001, 006, 009, 012, 014, 019 |
| `jR53kNbElhXSAL0LSwo8` | momentum_chaser | baseline | 2026-09-23 | 10 | 6 | 001, 003, 007, 008, 009, 011 |
| `xKLKthncJhPcYzloF42M` | momentum_chaser | baseline | 2026-09-25 | 15 | 6 | 001, 004, 007, 011, 012, 016 |
| `NTNj46p7dAmAZ4ObPZGi` | momentum_chaser | shadow | 2026-09-28 | 16 | 6 | 001, 003, 008, 009, 011, 015 |
| `dZYtJZznAgpQSr14L8SQ` | momentum_chaser | shadow | 2026-09-28 | 14 | 6 | 002, 004, 007, 010, 011, 014 |
| `jR12Be56QNCKfVQi1vUs` | momentum_chaser | shadow | 2026-09-29 | 16 | 6 | 001, 005, 007, 010, 014, 016 |
| `d3T2JZcGAX7u1aiqFTMm` | momentum_chaser | shadow | 2026-09-29 | 16 | 6 | 002, 006, 009, 010, 015, 018 |
| `NScUWgRyhGH9wSs9g6jv` | contrarian | shadow | 2026-09-29 | 8 | 8 | 001, 002, 004, 006, 007, 008, 009, 010 |
| `lk1CmAN46sdJAk7VHz8G` | momentum_chaser | shadow | 2026-09-29 | 9 | 6 | 001, 004, 005, 008, 009, 011 |
| `2yNCARN1NkOcJlsKgVP0` | momentum_chaser | shadow | 2026-09-30 | 17 | 6 | 001, 003, 006, 013, 015, 018 |
| `bzfCEJYCyK0I9wLKMYse` | momentum_chaser | shadow | 2026-09-30 | 23 | 6 | 002, 006, 008, 015, 018, 025 |
| `lwXrd9405FlQG6zc3M23` | momentum_chaser | shadow | 2026-10-01 | 15 | 6 | 002, 004, 006, 012, 014, 018 |
| `d3GNkrizM0zeBx4G9cKV` | momentum_chaser | shadow | 2026-10-01 | 16 | 6 | 002, 004, 007, 010, 013, 017 |

## 2. The arms

The arms differ only in `tools`. Before any call, the script asserted (`assertDescriptionOnlyDiff`) that C and D equal B once every `description` key is stripped, comparing order-sensitive JSON, and that each one differs from B in full. **Both assertions passed.** The arm texts are the exported constants in `scripts/declarationsWordingArms.mjs`, copied verbatim from the brief §2.1 and §2.2.

| Arm | Tool | Serialized chars | `countTokens` (largest sampled request) |
|---|---|---|---|
| A: off | `buildTradeDecisionTool({ declarations: false })` at HEAD | 8,537 | 16,289 |
| B: shadow (current) | `buildTradeDecisionTool({ declarations: true })` at HEAD | 13,164 | 17,540 |
| C: shadow, revised | B + §2.1 overrides (block, `horizonPhrase`, called-shot `said`) | 13,526 | 17,615 |
| D: on (draft) | B + §2.2 overrides (block, `horizonPhrase`, called-shot `said`, `fork`, `playerAsk`) | 13,565 | 17,633 |

## 3. Cost and execution

- **Estimate before any call:** $15.85. That is `countTokens` on the largest sampled request, per arm, × 160 calls, plus 1,500 output tokens per call, at Haiku 4.5 list prices ($1 / $5 per M). It was under the $25 ceiling, so the run proceeded.
- **Spent:** 9,250,728 input + 823,103 output tokens = **$13.37**. No cache reads or writes.
- **Execution:** concurrency 4, with retries on 429, 5xx and connection errors (backoff honours `retry-after`). **640 / 640 calls returned on the first attempt; 0 failures were recorded.** The client timeout was 120 s, not production's 20 s: the replay measures content, not latency.

## 4. Measures and method notes

- **Anticipation (primary).** The count of `anticipationCandidates` in the raw `tool_use` input. Production lints these after the call; the replay counts what the model returned. Per check, each arm's mean over its 2 reps is compared with A's mean over its 2 reps. The relative difference is Σ(arm − A) ÷ Σ A. The 95 % CI resamples checks 10,000 times (seeded). The noise floor compares A rep 1 with A rep 2, single reps, so its interval is wider than the arm-vs-A intervals, which average two reps.
- **Declaration rate.** The share of calls whose `declarations` survive the repo's own `captureDeclarations` (`api/_utils/callRecords/validate.js:364`) with `phase === 'expected'`. The validator gets the battle universe (`selectBattleUniverse` on the battle as read today) and a horizon resolver bound to the original check's instants (`bindHorizon`, with `promptBuiltAt` and `promptBuiltAt + callMs`). The §5 bar uses this per-call rate. The share of checks with at least one declaring rep is shown beside it.
- **Horizon bar.** It is measured over every minted call. A fork would count as `next_check`, its validator horizon, but no arm produced a surviving fork. The called-shots-only share is identical here.
- **`said` rule** (§4.4, applied as frozen). On `next_check`, the line is flagged if it matches `/\b(close|closes|closing|holds|holding|through)\b|\bon the day\b|\bend of day\b|\bconfirm/i`. On any other horizon, it is flagged if it matches `/next check|next eval/i`. "confirm" is matched as a prefix (so it catches confirms and confirmed); the other words must be whole words.
  - *Descriptive breakdown, not used by the bar.* This count runs before horizon validation, so its shot counts differ slightly from the table. Of the flagged lines, the share that trips on the "confirm" stem alone is: B 11 of 23, C 15 of 18, D 7 of 8. Most C and D flags are lines like "trading above $X by next check would confirm the NR7 breakout", where "confirm" describes the thesis, not an extra condition. B's other flags add "holds through next check", "on volume", "2 consecutive 15-min candles" and similar.
- **Decision drift.** Arm rep r is compared with A rep r. Two results agree when `decision` matches, and when both are SWAP, `symbolOut` and `symbolIn` also match.
- **Health.** `invalid_tool_result` means a `tool_use` block was present but `validateTradeToolResult` (`agentEvalToolResultValidation.js:92`) rejected it. That is the production classification (`agent-evaluate.js:2825`, `2868-2870`).

## 5. Results (measures §4, pass table §5, examples)

All figures below are generated by `node scripts/declarations-wording-experiment.mjs analyze` from the 640 raw records. Calls analyzed per arm: 160 (80 checks, all complete).

### Measures by arm

| Measure | A: off | B: shadow (current) | C: shadow, revised | D: on (draft) |
|---|---|---|---|---|
| Calls analyzed (complete checks × 2) | 160 | 160 | 160 | 160 |
| Anticipation candidates per call (mean) | 1.40 | 1.31 | 1.24 | 1.34 |
| Paired difference vs A (relative) | — | -6.7% [-15.2%, 2.5%] | -11.2% [-20.2%, -1.9%] | -4.0% [-14.0%, 6.4%] |
| Declaration rate (calls) | 0.0% (0) | 10.0% (16) | 54.4% (87) | 21.3% (34) |
| Checks with ≥1 declaring rep | 0.0% | 18.8% | 70.0% | 38.8% |
| Minted calls per declaring call | n/a | 1.69 | 2.56 | 2.32 |
| Calls on this_session / this_battle | n/a of 0 | 3.7% of 27 | 82.5% of 223 | 78.5% of 79 |
| …called shots only | n/a | 3.7% | 82.5% | 78.5% |
| `said` inconsistency (called shots) | n/a (0/0) | 74.1% (20/27) | 8.1% (18/223) | 10.1% (8/79) |
| Decision agreement with A (rep-aligned) | 100.0% | 95.6% | 93.8% | 95.6% |
| `max_tokens` stop rate | 0.00% (0) | 0.00% (0) | 0.00% (0) | 0.63% (1) |
| `invalid_tool_result` rate | 1.25% (2) | 4.38% (7) | 2.50% (4) | 3.75% (6) |
| No `tool_use` block | 0 | 0 | 0 | 0 |
| Output tokens p50 / p95 | 1195 / 1699 | 1264 / 1826 | 1350 / 2077 | 1296 / 1928 |
| Input tokens (mean, billed) | 13474 | 14725 | 14800 | 14818 |
| Tool size (serialized chars) | 8537 | 13164 | 13526 | 13565 |
| `countTokens` input, largest request | 16289 | 17540 | 17615 | 17633 |

**Noise floor (A rep 1 vs A rep 2):** anticipation -1.8% [-13.7%, 11.0%]; decision agreement 97.5%.

### Kind mix, horizon mix, validator removals

| Arm | Kinds | Horizons (all calls; fork = next_check) | Removed by validator |
|---|---|---|---|
| A | — | — | — |
| B | called_shot 24, confirmation 3 | next_check 26, this_session 1 | calledShots:no_slot_before_battle_end 4 |
| C | called_shot 140, confirmation 83 | this_session 184, next_check 39 | calledShots:malformed 14, block:malformed_block 3 |
| D | called_shot 57, confirmation 22, watching 2 | this_session 62, next_check 17 | block:malformed_block 7, calledShots:malformed 4, calledShots:no_slot_before_battle_end 1 |

### Pass table (§5, frozen bars)

| Bar | B | C | D |
|---|---|---|---|
| Anticipation: paired diff ≥ −10% and CI low ≥ −20% | PASS | FAIL | PASS |
| Declaration rate ≥ 15% | FAIL | PASS | PASS |
| ≥ 50% of calls this_session / this_battle | FAIL | PASS | PASS |
| `said` inconsistency ≤ 10% | FAIL | PASS | FAIL |
| Decision agreement ≥ A1-vs-A2 − 5 pts | PASS | PASS | PASS |
| `max_tokens` ≤ 2% and invalid ≤ A + 1 pt | FAIL | FAIL | FAIL |
| **Overall** | **FAIL** | **FAIL** | **FAIL** |

### Flagged `said` lines (up to 10 per arm, agent text only)

**Arm A** (0 flagged of 0)
- none

**Arm B** (20 flagged of 27)
- `HOOD` · `next_check`: "HOOD breaks above +0.5x ATR (131.48) before next eval → confirms NR7 breakout, locks in BaggerBomb bonus trajectory."
- `TXN` · `next_check`: "If TXN breaks above $287 on volume, the NR7 breakout is confirmed and I hold for the +5.2% threshold."
- `AMD` · `next_check`: "If AMD breaks above $615 (upper NR7 band) by next eval, the NR7 breakout confirms and I hold for +0.5x ATR extension."
- `MU` · `next_check`: "MU breaks above $1,079 (NR7 upper bound) by next eval; if confirmed, the squeeze breakout is live and I hold through the bonus run."
- `ORCL` · `next_check`: "If ORCL holds above $139.23 (+0.75x ATR from entry) through the next check, I will hold the Star position and let it run toward the +1.0x ATR bonus."
- `SNOW` · `next_check`: "If SNOW breaks above $347.50 on the next check, I'm holding it for the bonus run — no swap action, just patience on the setup I've been watching."
- `NVDA` · `next_check`: "NVDA breaks above 232.65 (+1.0x ATR bonus level) and holds through next check — validates the NR7 squeeze breakout thesis."
- `AMD` · `next_check`: "If AMD breaks above $642.31 (NR7 upper band) by next check, I'm holding to ride the breakout momentum toward +1.0x ATR."
- `HOOD` · `next_check`: "HOOD breaks above 125.59 (1.0x ATR bonus trigger) within next 2h, confirming NR7 breakout."
- `MU` · `next_check`: "If MU breaks above $1,100 and holds for 2 consecutive 15-min candles, the NR7 breakout thesis is confirmed and I hold for the +6.8% threshold."

**Arm C** (18 flagged of 223)
- `MU` · `next_check`: "MU trading above $1,080 by next check would confirm NR7 breakout upside and validate hold thesis."
- `AMD` · `next_check`: "AMD trading above 612 by next check would confirm NR7 breakout and validate hold thesis."
- `PLTR` · `next_check`: "PLTR holding above $192.15 at next check would confirm momentum setup for potential rotation entry."
- `TXN` · `next_check`: "TXN trading above $282.50 by next check would confirm NR7 breakout and validate the hold."
- `MU` · `next_check`: "MU trading above $1,079 (NR7 upper bound) would confirm volatility breakout and trigger BaggerBomb bonus."
- `ETN` · `next_check`: "ETN trading above $445 by next 15-minute check would validate NR7 breakout and warrant holding through the move."
- `AMAT` · `next_check`: "AMAT trading above $515 by next check would confirm NR7 breakout upside and validate hold thesis."
- `KLAC` · `next_check`: "If KLAC holds above 200 at the next check, it would meet the +0.5x ATR outperformance threshold vs. BE and warrant a swap into Support tier."
- `TXN` · `next_check`: "TXN trades above 283.03 by the next check, confirming the NR7 breakout."
- `MSFT` · `next_check`: "MSFT trading above $512 on the next check would confirm BB squeeze breakout and validate the hold."

**Arm D** (8 flagged of 79)
- `AMAT` · `next_check`: "AMAT breaks above $512.50 on the next check — NR7 contraction resolves upward, confirming directional_expansion momentum."
- `ETN` · `next_check`: "ETN trading above $441.55 (+0.5x ATR) by the next check would confirm the NR7 breakout; I hold through that confirmation."
- `MU` · `next_check`: "MU trading above $1,079 (NR7 upper bound) by the next check would confirm breakout momentum and validate the hold."
- `INTC` · `next_check`: "INTC trades above $125.50 (upper NR7 band) by next check, confirming breakout."
- `AMD` · `next_check`: "AMD trades above $632 (upper NR7 band) by next check, confirming breakout."
- `AMD` · `next_check`: "AMD trading above $632.50 (entry + 0.5x ATR) by next check would signal NR7 squeeze breakout confirmation."
- `MU` · `next_check`: "MU trading below entry ($1069.37) on next check would signal NR7 breakout failure; would favor rotating to BE if confirmed."
- `TXN` · `next_check`: "TXN trading below entry ($281.16) on next check would signal NR7 breakout failure; would favor rotating to AMAT if confirmed."

### Example `declarations` blocks (five per arm, seeded pick, agent text only)

**Arm A**: no declaring call

**Arm B**

1. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "MU",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 1100
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "If MU breaks above $1,100 and holds for 2 consecutive 15-min candles, the NR7 breakout thesis is confirmed and I hold for the +6.8% threshold."
  },
  {
   "symbol": "TXN",
   "direction": "entry",
   "slot": "support",
   "condition": {
    "side": "above",
    "level": 287
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "If TXN breaks above $287 on volume, the NR7 breakout is confirmed and I hold for the +5.2% threshold."
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
   "symbol": "ETN",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 437
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "If ETN breaks below $437 (NR7 setup fails), I'd reconsider holding it — but won't act unless conviction for a replacement exceeds 70%."
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
   "symbol": "HOOD",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 125.59
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "HOOD breaks above 125.59 (1.0x ATR bonus trigger) within next 2h, confirming NR7 breakout."
  },
  {
   "symbol": "AMD",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 625.02
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "AMD breaks above 625.02 (1.0x ATR bonus trigger) within next 2h, confirming NR7 breakout."
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
   "symbol": "AMD",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 615
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "If AMD breaks above $615 (upper NR7 band) by next eval, the NR7 breakout confirms and I hold for +0.5x ATR extension."
  },
  {
   "symbol": "MU",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 1085
   },
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "If MU holds above $1085 (upper NR7 band) by next eval, momentum breakout is confirmed and I hold for the +1.0x ATR bonus run."
  },
  {
   "symbol": "PWR",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 635
   },
   "horizonPhrase": "next_check",
   "defaultAction": "act",
   "said": "If PWR breaks below $635 (-0.41x ATR) by next eval, I would rotate to MSFT or EMR to stop the bleed."
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
   "horizonPhrase": "next_check",
   "defaultAction": "hold",
   "said": "If SNOW breaks above $347.50 on the next check, I'm holding it for the bonus run — no swap action, just patience on the setup I've been watching."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

**Arm C**

1. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "AMAT",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 531.66
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMAT trading below $531.66 (0.25x ATR reversal from peak) before session end would break S6 threshold lock and trigger reconsideration."
  },
  {
   "symbol": "SNOW",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 332.04
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "SNOW trading below $332.04 (NR7 lower support) before session end would invalidate the squeeze setup and warrant exit evaluation."
  },
  {
   "symbol": "AMAT",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 536.2
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMAT trading above $536.20 (+1.0x ATR bonus threshold) before session end would lock in the BaggerBomb bonus and validate the hold thesis."
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
   "symbol": "MU",
   "direction": "exit",
   "slot": "core",
   "counterpart": "none",
   "condition": {
    "side": "below",
    "level": 1050
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "MU trades below 1050 by close, I would consider exit to protect against Bust threshold breach."
  },
  {
   "symbol": "AMAT",
   "direction": "exit",
   "slot": "core",
   "counterpart": "none",
   "condition": {
    "side": "below",
    "level": 504
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMAT trades below 504 by close, I would consider exit to protect against Bust threshold breach."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

3. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "AMD",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 598
   },
   "horizonPhrase": "next_check",
   "defaultAction": "act",
   "said": "AMD trades below $598 (approximately -0.9x ATR) by the next 15-minute check."
  },
  {
   "symbol": "ETN",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 420
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "ETN trades below $420 (-0.8x ATR) on elevated volume (RVOL > 1.2x) before end of session."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

4. momentum_chaser, rep 2
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
   "said": "MSFT trading below lower Bollinger Band support at $489.01 (current $498.31) would signal squeeze failure; I would exit if it closes below that level on volume."
  },
  {
   "symbol": "ETN",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 385.88
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "ETN support at $385.88 is 11.86% below current price; if it breaks that level, I would reconsider the position, but current momentum does not warrant preemptive action."
  },
  {
   "symbol": "AMD",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 570
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMD is my strongest holding (directional_expansion, rsPercentile=96); I would only exit if it breaks below $570 on heavy volume, signaling regime shift."
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
   "symbol": "NVDA",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 232.65
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "NVDA trading above 232.65 (its +1.0x ATR threshold) by end of session would lock the BaggerBomb bonus."
  },
  {
   "symbol": "SHOP",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 148.26
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "SHOP trading below 148.26 (its entry price) would trigger S4 constraint release and make it swappable."
  },
  {
   "symbol": "MSFT",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 520
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "MSFT trading above 520.0 (1.99% from current) would signal sustained momentum and make it a primary rotation candidate if a slot opens."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

**Arm D**

1. momentum_chaser, rep 1
```json
{
 "calledShots": [
  {
   "symbol": "MU",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 1079
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "MU will trade above $1,079 (its +1.0x ATR threshold) before the close, locking the BaggerBomb bonus."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

2. contrarian, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "MSFT",
   "direction": "exit",
   "slot": "support",
   "condition": {
    "side": "below",
    "level": 489.56
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "MSFT trading below $489.56 (lower support) by close would signal BB squeeze failure; would favor exit to bench candidate."
  },
  {
   "symbol": "MU",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 1090
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "MU trading above $1090 (upper NR7 breakout level) would confirm directional expansion; would favor holding Star tier given momentum confirmation."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

3. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "HOOD",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 123.48
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "HOOD trading below entry ($123.48) on the session would trigger a reassessment of the NR7 setup."
  },
  {
   "symbol": "AMD",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 617.71
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMD trading below entry ($617.71) would signal NR7 setup failure; hold unless volume spikes."
  },
  {
   "symbol": "ETN",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 448.06
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "ETN reaching +1.0x ATR ($448.06) would lock in the bonus and validate the breakout thesis."
  },
  {
   "symbol": "GME",
   "direction": "entry",
   "slot": "support",
   "condition": {
    "side": "above",
    "level": 24.73
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "GME trading above +1.0x ATR ($24.73) would make it a candidate to replace MSFT if MSFT fails to break out."
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
   "symbol": "SNOW",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 317.04
   },
   "horizonPhrase": "next_check",
   "defaultAction": "act",
   "said": "SNOW trades below $317.04 (support) by next check — exit to protect baseline."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

5. momentum_chaser, rep 2
```json
{
 "calledShots": [
  {
   "symbol": "AMD",
   "direction": "exit",
   "slot": "star",
   "condition": {
    "side": "below",
    "level": 625
   },
   "horizonPhrase": "this_session",
   "defaultAction": "act",
   "said": "AMD trading below $625 on volume >1.2x would signal NR7 breakdown; I would exit to a bench alternative."
  },
  {
   "symbol": "PWR",
   "direction": "exit",
   "slot": "core",
   "condition": {
    "side": "below",
    "level": 650
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "PWR trading below $650 on volume would signal NR7 breakdown; I would consider taking the +1.27% profit."
  },
  {
   "symbol": "AMD",
   "direction": "entry",
   "slot": "star",
   "condition": {
    "side": "above",
    "level": 632.5
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "AMD trading above $632.50 on volume >1.2x would confirm NR7 breakout; I would hold for continuation."
  },
  {
   "symbol": "PWR",
   "direction": "entry",
   "slot": "core",
   "condition": {
    "side": "above",
    "level": 655
   },
   "horizonPhrase": "this_session",
   "defaultAction": "hold",
   "said": "PWR trading above $655 on volume >1.2x would confirm NR7 breakout; I would hold for continuation."
  }
 ],
 "watching": [],
 "playerAsk": null,
 "fork": null
}
```

## 6. `invalid_tool_result` detail (the health bar)

| Arm | Invalid | Field (count) | Checks |
|---|---|---|---|
| A | 2 | `conviction` missing (2) | both reps of `lk1C…:eval_004` |
| B | 7 | `trade_reasoning` not object (3), `hypothesis` missing (2), `conviction` not integer (2) | 7 different checks |
| C | 4 | `conviction` missing (2), `conviction` not integer (2) | 4 different checks |
| D | 6 | `hypothesis` missing (2), `conviction` (2), `trade_reasoning` (1), `riskAssessment` missing (1) | 6 different checks |

None of the failing fields is `declarations`: the trade validator does not read that property (`agentEvalToolSchema.js:209-211`). The counts are small (2 to 7 in 160), and the bar allows at most 3 (A's 1.25 % + 1 pt). This is reported as measured; the bar stands as frozen.

## 7. Limits of this read

- **Archetype coverage:** 72 of 80 checks are `momentum_chaser`. The only other replayable archetype is one `contrarian` battle (8 checks).
- **The baseline window is 18 checks in 3 battles,** all of them `momentum_chaser`.
- **The universe for fork validation** is read from today's battle documents, not frozen at each check. No arm produced a fork, so this did not affect any number.
- **The replay measures what the model writes, not what happens next.** No call was minted, graded or flipped.
