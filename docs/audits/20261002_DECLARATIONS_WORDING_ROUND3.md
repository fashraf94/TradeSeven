# Experiment: declarations wording, round 3 (batch replay of the 1a text, two variants, and a synthetic-directive sub-sample)

**Date:** 2026-10-02 (ET) · **Builder:** Claude Code (local session; the window has no `ANTHROPIC_API_KEY` — only the script spent, with `CLAUDE_API_KEY` from `.env.local`) · **Branch:** `claude/declarations-wording-round3` · **Scripts:** `scripts/declarations-wording-experiment.mjs` (now takes `--round=3`, with the `collect` subcommand), `scripts/declarationsWordingArms.mjs` (arms 1A-C and 1A-CF), `scripts/declarationsWordingDirective.mjs` (new: the S2 insertion rule and directive pool)
**Context:** Round 1 is `docs/audits/20261001_DECLARATIONS_WORDING_EXPERIMENT.md`, round 2 is `docs/audits/20261001_DECLARATIONS_WORDING_ROUND2.md`, and the Build 1a report is `docs/audits/20261002_BUILD1A_ANSWER_LOOP.md` (its §10.3 item 6 names the two inaccuracies 1A-C corrects). Round 3 qualifies the `on` text that will flip with Build 2, and tests whether a fork ("Crossroads") nudge makes the agent offer a choice when a player's directive rules out its first pick.

**Session preamble (BUILD_RULES §2, §3).**
- `git fetch origin` ran first, then `git checkout main && git pull` ("Already up to date"), then `git checkout -b claude/declarations-wording-round3`. HEAD at the start was `e6a844450543bb11580624b0771ff88fcd776372` (Merge PR #924), equal to `origin/main`.
- The tree had six untracked files at the start, none from this task: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json`, `lifecycle-ogbL.txt`, `tape-0922.md`, `tape-0928.md` and `vwap-exit-dating-census-report.json`. None is committed here.
- **API key:** handled as in rounds 1 and 2. `CLAUDE_API_KEY` is loaded from `.env.local` through `scripts/loadLocalEnv.js`; the script checks only that it exists and starts with `sk-ant-`, and never prints it.
- **Production was read-only.** The only production access is round 2's unchanged `select` step: Firestore `.get()`, `.select()` and `getAll()`. No flag, rule, schema module or product source was changed.
- **Fence (BUILD_RULES §1).** No fenced file was edited. One fenced function is called by the scripts: `getCurrentTradingDayServer` (`api/_utils/agentEvalPromptAssembly.js:1370`), reached through the non-fenced `isDirectiveActive` (`api/_utils/directiveUtils.js:83`) when S2 checks that its directives are active. With the empty calendar S2 passes, it returns 1 on its first line; reaching it loads the fenced assembler module and its imports. The transient probe (§0.3) ran the real `processAgentBattle`, which calls the fenced assembler, as the round-1 and round-2 probes did.
- **Import-boundary ratchet (BUILD_RULES §1, Spec §2.3).** The new module imports `src/data/archetypeAdjustments.js`, a legacy-table basename. The ratchet inventories production modules under `api/` and `src/` only (`api/_utils/archetypeRegistry.test.js:243-244`), and seven existing scripts already import legacy tables without a baseline entry, so the baseline is unchanged.
- **Raw data** (the sample with its recorded request bodies, the S2 requests, the batch manifest, per-call records and the analysis output) is in `experiments/declarations-wording/raw/round3/`, inside the git-ignored `experiments/declarations-wording/raw/` (`.gitignore:108`). Nothing raw is committed.
- **Rounds 1 and 2 still reproduce exactly.** Run without `--round=3`, `analyze` and `analyze --round=2` produce a `results.md` byte-identical to the ones behind the round-1 and round-2 reports, and a `results.json` identical except for its `analyzedAt` time.
- **One transient probe** (§0.3) was built from the harness of `api/cron/agent-evaluate.tickStamps.callsOn.test.js`, run under vitest, and deleted; `git status` afterwards showed the tree unchanged.

## Executive verdict

| Question | Answer |
|---|---|
| **Was the replay valid?** | **Yes.** Round 2's gate, rerun unchanged: 193 of 207 model-ok checks are recoverable byte-for-byte, the same 193 as round 2. The probe confirms that `off`, `shadow` and `on` requests differ only in `tools`. The reuse gate passed: A and D are round 2's exact tool bytes, and all 772 of their records were reused, not re-run. |
| **Sample** | **All 193 recoverable checks** (185 `momentum_chaser`, 8 `contrarian`; 13 battles; 7 ET days) × 1A, 1A-C, 1A-CF × 2 reps = 1,158 calls. **S2:** 40 checks with one canonical directive inserted × 1A-C, 1A-CF × 2 reps = 160 calls. |
| **Cost** | **$13.96 actual**, at batch prices (19.38 M input, 1.71 M output tokens). The pre-run estimate was $16.59 against the $20 stop. **All 1,318 requests succeeded** (0 errored, 0 expired, 0 canceled). |
| **Pass table (frozen bars)** | **1A: FAIL · 1A-C: PASS · 1A-CF: FAIL.** |
| **1A (the shipped text)** | Passes anticipation (−0.2 %, CI −7.8 % to +8.2 %), declaration rate (33.7 %), horizon (82.8 %) and decision agreement (94.0 % against a 91.9 % floor). **It fails health: `invalid_tool_result` 3.37 % (13 of 386), above the 3 % cap, Fisher p = 0.010.** |
| **1A-C (corrected)** | **Passes all five gated bars:** anticipation +3.9 % (CI −3.1 % to +11.0 %), declaration rate 36.8 %, horizon 76.9 %, agreement 93.5 %, health 1.81 % (7 of 386, p = 0.170). `said` (reported, not gated): 10.2 %. |
| **1A-CF (corrected + fork nudge)** | Passes bars 1–4. **Fails health (3.11 %, 12 of 386, p = 0.017), bar 7 (S2 fork rate 0 %) and bar 9 (no fork to survive).** Bar 8 is met only because no fork was offered. |
| **Forks** | **No arm offered a fork in any of the 1,318 calls**: not on the main sample, not on S2, with or without the nudge, with or without a directive. The nudge did not make the agent offer a choice. Bar 10 was withdrawn before the run; there is no S2 fork to list. |
| **Did the agent see the S2 directive?** | Yes. It echoed the directive's `directiveThreadId` on 24 of 80 1A-C calls and 34 of 80 1A-CF calls, and held on 75 of 80 in both arms. |
| **How close are the health results?** | The 3 % cap allows at most 11 invalid results in 386 calls. 1A has 13, 1A-CF 12, 1A-C 7. Those three counts are not statistically distinguishable from one another (two-sided Fisher p = 0.26 for 1A vs 1A-C, 0.35 for 1A-CF vs 1A-C). This is context only, not a bar. |
| **Review** | The branch is above 1,500 changed lines, so the BUILD_RULES §2 review ran: six lenses on isolated trees, every finding sent to a refuting verifier, a 30-mutant battery last, and an explicit `vite build` (exit 0). 41 findings: 30 confirmed, 11 confirmed with a correction, 0 refuted. **None changes a number or a verdict of this run.** Every finding that called for a code change was fixed. Seven notes needed no code and are recorded. One pre-existing hazard at HEAD (VC-1) is reported for separate tasking. The mutation battery's two real survivors were fixed and re-checked. See §7. |
| **Anything needed from you?** | **A ruling on the table.** As the brief requires, this report makes no wording recommendation. |

## 0. The gate

### 0.1 PR #924 is merged (brief §0 step 1)

`api/_utils/agentEvalToolSchema.js` exports `TEXT_1A_OVERRIDES` (`:437`; keys `declarations, horizonPhrase, said, fork, playerAsk`), and `buildTradeDecisionTool({ declarations: 'on' })` serializes to SHA-256 **`81499cbcf2655ceba51a5b721d33ff918ce21382a4c3b76d9cc34e6bae1f1806`** (13,595 chars, 13,605 UTF-8 bytes). **PASS.**

### 0.2 Byte-for-byte recovery (round 2's gate, rerun unchanged)

`node scripts/declarations-wording-experiment.mjs select --round=3` runs round 2's `select()` with its logic unchanged and writes `raw/round3/sample.json`. The edits above it are line-neutral and keep round 1's and round 2's values: the round guard, the two sample-size constants, the cost ceiling, the raw folder, one import line and one comment line.

| Gate result (ET days Sep 21 to Oct 1) | Round 3 | Round 2 |
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

The 193 checks are round 2's 193, in the same order, with the same `tickId`, the same permanent `requestSha256` and the same request bytes. The reuse gate (§0.4) asserts this.

### 0.3 Only `tools` differs between modes

The round-1 and round-2 probe was rebuilt. It is a temporary file made of the first 215 lines of `api/cron/agent-evaluate.tickStamps.callsOn.test.js` (its harness: the real `processAgentBattle` with a mocked SDK and mocked market data) plus the probe rows. It ran under vitest and was then deleted.

| Pair | Keys | `system` / `messages` (JSON chars) | Everything except `tools` | `tools` |
|---|---|---|---|---|
| `off` vs `shadow` | same 7, same order | 16,602 / 4,047 | byte-identical | differ (8,539 vs 13,166 chars) |
| `off` vs `on` | same 7, same order | 16,602 / 4,047 | byte-identical | differ (8,539 vs 13,597 chars) |

Both rows passed. The `system` and `messages` sizes equal rounds 1 and 2 to the character. The same probe also proves the S2 insertion (§2.2). **Gate: PASS.**

### 0.4 The reuse gate (brief §0 step 3)

`reuseGate3()` runs before every round-3 step that can lead to spend (`s2`, `estimate`, `submit`) and throws on any mismatch.

| Condition | Result |
|---|---|
| Arm A at HEAD = the tool round 2 sent | **Yes.** HEAD's A serializes to `91c19f51…` (8,537 chars). Round 2's A, rebuilt from round 2's own commit `6f45dbc4` (its arms module and schema module extracted with `git archive`), has the same bytes. HEAD's A also equals the off tool recorded in all 43 baseline-window requests. |
| Arm D's tool | **`2a90e67b34a8b1fa2f4d1ad38f3e978858e47b395dfb6762a3c554e2126a3ee3`** (13,565 chars), identical at round 2's commit and at HEAD. |
| Model, temperature, `max_tokens`, `tool_choice` | `claude-haiku-4-5-20251001`, 0.4, 3,072, `{type: tool, name: submit_trade_decision}`. The recorded request bytes are round 2's to the byte. `EVAL_MAX_OUTPUT_TOKENS` is 3,072 at HEAD, and also 3,072 in `api/_utils/agentEvalTransport.js` as extracted from round 2's own commit. All 1,158 of round 2's records report the same model. |
| Both reps for every recoverable check | **772 of 772** A and D records (193 checks × 2 arms × 2 reps), each on the check's own `tickId`. |
| Also enforced | Round 2's own gate recorded that its arm A equalled the same 43 recorded off tools (`storedToolDrift.baseline` = 43 / 0). Every recorded request body still hashes to its permanent Firestore `requestSha256` (193 of 193). Battle metadata (archetype, universe, expiry) is identical to round 2's sample. |

**Reuse gate: PASS.** A and D were not re-run.

## 1. The arms

The arms differ only in `tools`. 1A is the schema module's own `on` object. 1A-C and 1A-CF are built in `scripts/declarationsWordingArms.mjs` from a deep clone of it. Every text is an exported constant copied verbatim from the brief, and the schema module is not edited.

| Arm | Tool | SHA-256 | Serialized chars | `countTokens` (largest request) |
|---|---|---|---|---|
| A: off (reused) | `buildTradeDecisionTool({ declarations: 'off' })` | `91c19f51…` | 8,537 | 16,289 (round 2) |
| D: on draft (reused) | round 1's D | `2a90e67b…` | 13,565 | 17,633 (round 2) |
| **1A** | `buildTradeDecisionTool({ declarations: 'on' })`, PR #924 | `81499cbc…` | 13,595 | 17,638 |
| **1A-C** | 1A + (a) the answer sentence + (b) the fork `said` | `7388755a…` | 13,623 | 17,639 |
| **1A-CF** | 1A-C + the fork nudge + `fork.respondsToDirective` | `a62b9ff7…` | 14,031 | 17,730 |

`assertRound3Arms()` ran before every spending step and passed:
- **1A → 1A-C:** exactly two leaves differ. The first is `declarations.description`: the 1a block with one sentence replaced, and the replaced sentence is asserted to occur exactly once. The second is `declarations.properties.fork.properties.said.description`. With every `description` stripped, 1A-C equals 1A.
- **1A-C → 1A-CF:** exactly two leaves differ. The first is `fork.description`. The second is the added `fork.properties.respondsToDirective` = `{ type: 'boolean', description: 'True only if the player's current directive is why you offer this choice; otherwise false or omit.' }`, placed last in the fork's properties and absent from `required`. With that property removed and descriptions stripped, 1A-CF equals 1A-C.
- The calls validator projects a fork onto `slot, swapOut, options, said` (`api/_utils/callRecords/validate.js:175-178`), so the added field can never make a fork fail validation. The analysis reads `respondsToDirective` from the raw tool input.
- `submit` re-checked every one of the 1,318 requests before sending, against these pins:
  - the tool hashes to its arm's pinned SHA-256;
  - `max_tokens` is 3,072 and the key order is production's;
  - every other byte equals the recorded body (main) or the S2 body (S2).

## 2. S2: the synthetic-directive sub-sample (a labeled departure from byte-identical replay)

### 2.1 Selection, and the founder's ruling

Before any S2 data existed, this session reported that **no canonical directive on either menu in the sample names a sector**. TF-03, "Narrow to the single strongest sector(s)", is the only sector-type entry, and the prompt carries no sector ranking, so bar 10 could not be judged "by the battle universe's sector data". The founder ruled:

> Each S2 check gets a seeded pick among its own archetype's sector or style restrictions (TF-01/02/03/06/08; CN-01/02/04/06), excluding any directive already equipped as a lean on that battle. Bars 7–9 are judged as written. Bar 10 is withdrawn as unmeasurable before any S2 data exists. In its place, the report lists every S2 1A-CF fork — the directive's canonical text, the options with their why, and respondsToDirective — for the founder to judge compliance by reading. 1A-CF's pass/fail is bars 1–9.

What the script does (`deriveS2`, `scripts/declarations-wording-experiment.mjs`):
- **Eligibility.** A check is eligible when its recorded live context shows a bench (`BENCH (available for swap):`): a fork needs candidates. 5 of 193 checks show `BENCH: Empty` and are excluded, leaving **188 eligible**. This filter is the session's addition and is stated here. No recorded check carries a directive, so none had to be skipped for that reason.
- **Spread across battles.** S2 has its own seed (20261002), so it never touches the main sample's draws. Battles in seeded order get round-robin quota up to 40: 12 battles get 3 checks and `dZYtJ…` gets 4. Within a battle, the checks are split into k time bins with one seeded pick per bin. **Every archetype is present: 37 `momentum_chaser`, 3 `contrarian`.**
- **The directive.** Each check gets a seeded pick from its archetype's pool, minus the battle's equipped leans. The leans are read back from the recorded leans block and mapped from text to id through the archetype's own menu. Four battles carry the leans TF-01 and TF-03, so their 13 checks drew from TF-02, TF-06 and TF-08. Draws: TF-02 ×14, TF-06 ×9, TF-08 ×6, TF-01 ×5, TF-03 ×3, CN-01, CN-02, CN-06 ×1 each.
- **The slot** is built by the chip route's own builder (`directiveFiling.js` `buildDirectiveSlot`, as `api/agent/file-directive.js:270-278` uses it): `{ text: <canonical>, expiry: 'end_of_battle', directiveThreadId: <a seeded version-4 UUID>, createdAt: <promptBuiltAt − 10 min>, adjustmentId, canonicalTextVersion }`.

### 2.2 The insertion point, and its proof

The block is rendered by the assembler's own read (`agentEvalPromptAssembly.js:1229-1242`): `isDirectiveActive` → `resolveControls` (with the flags' values, `ARCHETYPE_INTEGRITY_MODE = 'enforce'`, `STANDING_LEANS_ENABLED = true`) → `renderControlBlocks` → `renderDirectiveBlock` (`controlPromptRenderer.js:213-219`). Lean overrides and the epoch log are passed empty: a fresh thread id can match neither. The battle's leans must re-render exactly as recorded, both with and without the directive.

The brief names `buildActiveDirectiveBlock`, but that function is the voice layer's narration builder (`api/_utils/voiceLayerPrompt.js:3717`, "ACTIVE COACH DIRECTIVE …"). The evaluator's request uses the path above, which renders "ACTIVE DIRECTIVE (from your Coach):", so S2 uses that path.

`buildLiveContextBlock` (`agentEvalPromptAssembly.js:1122`) joins its parts with `'\n\n'` (`:1285`). The controls are pushed at 3e3b (`:1229-1242`), after Trigger, the Intraday Momentum Snapshot and Risk Status (`:1190-1208`), and before Institutional Intelligence, News and the Recent Evaluation History (`:1244-1283`). The block therefore goes immediately before the first later part that is present (leans, institutional, news, history), or at the end when none is.

**The proof is end to end.** The transient probe ran the real `processAgentBattle` twice on the same battle, without and with an ordinary canonical directive. In all 8 layouts (end of context, before the evaluation history, before a leans block, before a news block; each at `off` and at `shadow`):
- the with-directive request equals `insertDirectiveBlock(without, renderDirectiveBlock(slot))` byte for byte;
- everything else in the request is unchanged.

The S2 review lens (§7) extended this to **48 rows**: 16 layouts × `off`/`shadow`/`on`. They cover institutional intelligence, news intelligence, risk status, leans with nothing after, tournament and contrarian battles. All pass, and they pass again on the final, hardened rule. The rule throws rather than guess in three cases:
- CR line endings;
- a part before the insertion point that is not the trigger, the momentum snapshot or risk status;
- a later part's header not followed by that part's own rows.

**The insertion point is determined, so S2 ran.**

Two more facts make this replay faithful:
- **The directive path did not change during the recording window.** The assembler and the renderer have no diff since Sep 20. `directiveUtils.js` changed only by the additive Build 1a call-family branch, which ordinary directives never enter. `ARCHETYPE_INTEGRITY_MODE` has been `'enforce'` since Jul 18 and `STANDING_LEANS_ENABLED` has been `true` since Jul 12.
- **Each S2 request is a pure insertion.** It is the recorded request with only the live-context string changed, and that string is the recorded one plus `'\n\n' + block`. A rerun re-derives all 40 from the sample and requires byte equality.

Where the block landed: before the leans block 13 times, before the news-intelligence block 3, before the evaluation history 23, and at the end once.

### 2.3 The 40 checks

| Battle | evalId | ET day | Archetype | Directive | Equipped leans | Inserted before |
|---|---|---|---|---|---|---|
| `2yNCA…` | eval_001 | 2026-09-30 | momentum_chaser | TF-06 | TF-01, TF-03 | STANDING LEANS |
| `2yNCA…` | eval_008 | 2026-09-30 | momentum_chaser | TF-08 | TF-01, TF-03 | STANDING LEANS |
| `2yNCA…` | eval_016 | 2026-09-30 | momentum_chaser | TF-02 | TF-01, TF-03 | STANDING LEANS |
| `DRgA4…` | eval_001 | 2026-09-22 | momentum_chaser | TF-02 | — | FANTASYTIMES INTELLIGENCE |
| `DRgA4…` | eval_011 | 2026-09-22 | momentum_chaser | TF-08 | — | YOUR LAST 3 DECISIONS |
| `DRgA4…` | eval_017 | 2026-09-22 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `NScUW…` | eval_002 | 2026-09-29 | contrarian | CN-06 | — | YOUR LAST 3 DECISIONS |
| `NScUW…` | eval_006 | 2026-09-29 | contrarian | CN-02 | — | YOUR LAST 3 DECISIONS |
| `NScUW…` | eval_008 | 2026-09-29 | contrarian | CN-01 | — | YOUR LAST 3 DECISIONS |
| `NTNj4…` | eval_001 | 2026-09-28 | momentum_chaser | TF-01 | — | (end) |
| `NTNj4…` | eval_010 | 2026-09-28 | momentum_chaser | TF-01 | — | FANTASYTIMES INTELLIGENCE |
| `NTNj4…` | eval_014 | 2026-09-28 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `bzfCE…` | eval_006 | 2026-09-30 | momentum_chaser | TF-08 | — | YOUR LAST 3 DECISIONS |
| `bzfCE…` | eval_013 | 2026-09-30 | momentum_chaser | TF-06 | — | YOUR LAST 3 DECISIONS |
| `bzfCE…` | eval_020 | 2026-09-30 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `d3GNk…` | eval_006 | 2026-10-01 | momentum_chaser | TF-06 | — | YOUR LAST 3 DECISIONS |
| `d3GNk…` | eval_012 | 2026-10-01 | momentum_chaser | TF-03 | — | YOUR LAST 3 DECISIONS |
| `d3GNk…` | eval_016 | 2026-10-01 | momentum_chaser | TF-03 | — | YOUR LAST 3 DECISIONS |
| `d3T2J…` | eval_002 | 2026-09-29 | momentum_chaser | TF-03 | — | FANTASYTIMES INTELLIGENCE |
| `d3T2J…` | eval_013 | 2026-09-29 | momentum_chaser | TF-01 | — | YOUR LAST 3 DECISIONS |
| `d3T2J…` | eval_015 | 2026-09-29 | momentum_chaser | TF-01 | — | YOUR LAST 3 DECISIONS |
| `dZYtJ…` | eval_003 | 2026-09-28 | momentum_chaser | TF-02 | TF-01, TF-03 | STANDING LEANS |
| `dZYtJ…` | eval_005 | 2026-09-28 | momentum_chaser | TF-08 | TF-01, TF-03 | STANDING LEANS |
| `dZYtJ…` | eval_009 | 2026-09-28 | momentum_chaser | TF-02 | TF-01, TF-03 | STANDING LEANS |
| `dZYtJ…` | eval_015 | 2026-09-28 | momentum_chaser | TF-06 | TF-01, TF-03 | STANDING LEANS |
| `jR12B…` | eval_004 | 2026-09-29 | momentum_chaser | TF-02 | TF-01, TF-03 | STANDING LEANS |
| `jR12B…` | eval_007 | 2026-09-29 | momentum_chaser | TF-02 | TF-01, TF-03 | STANDING LEANS |
| `jR12B…` | eval_017 | 2026-09-29 | momentum_chaser | TF-02 | TF-01, TF-03 | STANDING LEANS |
| `jR53k…` | eval_004 | 2026-09-23 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `jR53k…` | eval_005 | 2026-09-23 | momentum_chaser | TF-06 | — | YOUR LAST 3 DECISIONS |
| `jR53k…` | eval_012 | 2026-09-23 | momentum_chaser | TF-08 | — | YOUR LAST 3 DECISIONS |
| `lk1Cm…` | eval_003 | 2026-09-29 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `lk1Cm…` | eval_007 | 2026-09-29 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `lk1Cm…` | eval_011 | 2026-09-29 | momentum_chaser | TF-02 | — | YOUR LAST 3 DECISIONS |
| `lwXrd…` | eval_002 | 2026-10-01 | momentum_chaser | TF-06 | TF-01, TF-03 | STANDING LEANS |
| `lwXrd…` | eval_007 | 2026-10-01 | momentum_chaser | TF-06 | TF-01, TF-03 | STANDING LEANS |
| `lwXrd…` | eval_016 | 2026-10-01 | momentum_chaser | TF-08 | TF-01, TF-03 | STANDING LEANS |
| `xKLKt…` | eval_005 | 2026-09-25 | momentum_chaser | TF-06 | — | YOUR LAST 3 DECISIONS |
| `xKLKt…` | eval_010 | 2026-09-25 | momentum_chaser | TF-06 | — | YOUR LAST 3 DECISIONS |
| `xKLKt…` | eval_014 | 2026-09-25 | momentum_chaser | TF-01 | — | YOUR LAST 3 DECISIONS |

Directive texts: TF-01 "Prefer fresh breakouts over extended / late-stage entries" · TF-02 "Require stronger confirmation before entering" · TF-03 "Narrow to the single strongest sector(s)" · TF-06 "Avoid low-liquidity / thin momentum names" · TF-08 "Pause adds after a failed breakout" · CN-01 "Require a deeper washout before entering (greater oversold depth)" · CN-02 "Require a clearer technical turn/stabilization before entering" · CN-06 "Demand a stronger fundamental reason underneath the name".

## 3. Cost and execution

- **Estimate before any call: $16.59, under the $20 stop.** Method: for each arm, `countTokens` on the largest request it would send, times its call count (1A 386; 1A-C and 1A-CF 466 each), plus 1,500 output tokens per call, at Haiku 4.5 batch prices ($0.50 / $2.50 per M). It is above the brief's ≈ $13–14 because it prices every call at the largest request (17.6–17.7 k tokens); the mean billed input turned out to be about 14.7 k.
- **Two batches, created before any poll, ids on disk first** (`raw/round3/batches.json`):
  - S2 `msgbatch_01TuCh3GwzX46gRQD4RZYzEA`: 160 requests, 7.8 MB, ended 22:51:45 UTC.
  - Main `msgbatch_01TycLdmmFcj4qrTwQAUiUKf`: 1,158 requests, 55.1 MB, ended 23:01:43 UTC.
  - Both were created at 22:44:48–22:44:54 UTC and polled every 60 s.
- **`custom_id` (a disclosed deviation).** The Batches API accepts only `^[a-zA-Z0-9_-]{1,64}$`, so the brief's `arm:rep:battleId:evalId[:s2]` uses `__` in place of `:`, e.g. `1A-CF__1__NScUWgRyhGH9wSs9g6jv__eval_002__s2`. A manifest in `batches.json` maps every id back to its arm, rep, check and sample, with the SHA-256 of the request it sent.
- **Results:** S2 160 succeeded and main 1,158 succeeded; 0 errored, 0 expired, 0 canceled. Nothing was resubmitted.
- **Actual cost: $13.96** = (19,383,998 input × $0.50 + 1,707,509 output × $2.50) / 1 M. There were no cache reads or writes.
- A later session could have collected with `node scripts/declarations-wording-experiment.mjs collect --round=3`; `batches.json` alone is enough.

## 4. Measures and method notes

Every main-sample measure is computed as in round 2, by the same code. `analyze()`'s per-arm body was moved, unchanged, into `measureArm()` (and the noise floor into `noiseFloor()`), and rounds 1 and 2 still reproduce byte-for-byte through them. Round 3 calls them with round 2's options (the round-2 `said` rule, pacing, flag terms) for A, D, 1A, 1A-C and 1A-CF, over the checks that have all ten calls (193 of 193).

- **A and D are round 2's records, recomputed.** As a check on the code path, their measures are recomputed on round 2's own paired set (193 checks). They are compared field by field with round 2's original `results.json`, whose bytes are pinned by SHA-256 (`3fb9006a…`), so a later rerun of round 2's analysis cannot be mistaken for the original. **A, D, D's Fisher p and the noise floor all reproduce exactly.**
- **Bars** are compared with a 10⁻⁹ tolerance, so an exact tie passes despite binary rounding. A missing number never passes.
- **Forks.**
  - A fork is *offered* when `fork` is an object carrying at least one of `slot`, `swapOut`, `options` or `said`. It may sit in the `declarations` block, or in a block the model sent as a JSON string; the validator removes such a block whole, so its fork is offered but never survives. Any other non-null `fork` value (`{}`, `false`, a bare string) is counted separately, as a placeholder.
  - A fork *survives* only as production would carry it to the player. First, the trade result must be valid: production captures declarations on that branch alone (`api/cron/agent-evaluate.js:2851-2866`). Second, the calls validator (`captureDeclarations`) must keep the fork.
  - Fork options are judged against a per-check universe: the battle's roster as read on 2026-10-02, plus every held and bench name that check's own prompt showed. Production freezes the universe at each check's model seam (`api/_utils/callRecords/observe.js:102-104`) and stores only its size.
  - `respondsToDirective` is read from the raw tool input.
  - These rules come from the review (§7) and were tightened after the run. They change no number: none of the 1,318 outputs contains a fork, or even a placeholder fork value.
- **"A directive in the recorded prompt"** is detected by the directive block's first line, `ACTIVE DIRECTIVE (from your Coach):`, in the recorded live context. None of the 193 recorded checks carries one.
- **Bars 7–9.**
  - Bar 7 compares offered-fork rates on S2.
  - Bar 8's denominator is 1A-CF's main-sample forks offered. With no main-sample fork there can be no false attribution, so the bar is met.
  - Bar 9 pools main and S2 (surviving ÷ offered). With no fork anywhere, survival is unproven and the bar is not met.
  - These edge rules were written down before any result existed.
- **Bar 10** is withdrawn (founder ruling). §5.6 would list every S2 1A-CF fork; there are none.
- **Cost** is computed from each result's `usage` at Haiku 4.5 batch prices.

## 5. Results

All figures below are generated by `node scripts/declarations-wording-experiment.mjs analyze --round=3` from the 1,318 new records plus round 2's 772 A and D records. 193 main-sample checks are complete (all ten calls), so 386 calls are analyzed per arm. All 40 S2 checks are complete.

### 5.1 Measures by arm (main sample)

| Measure | A: off | D: on draft | 1A: shipped text | 1A-C: corrected | 1A-CF: + fork nudge |
|---|---|---|---|---|---|
| Calls analyzed (complete checks × 2) | 386 | 386 | 386 | 386 | 386 |
| Anticipation candidates per call (mean) | 1.20 | 1.25 | 1.20 | 1.25 | 1.24 |
| Paired difference vs A (relative) [95 % CI] | — | +3.9 % [−3.1 %, +11.0 %] | −0.2 % [−7.8 %, +8.2 %] | +3.9 % [−3.1 %, +11.0 %] | +3.2 % [−3.4 %, +10.4 %] |
| Declaration rate (calls) | 0.0 % (0) | 19.4 % (75) | 33.7 % (130) | 36.8 % (142) | 35.0 % (135) |
| …calls with ≥ 1 called shot (forks and watch-only blocks excluded; reported) | 0.0 % | 19.4 % | 33.7 % | 36.8 % | 35.0 % |
| Checks with ≥ 1 declaring rep | 0.0 % | 34.2 % | 50.8 % | 55.4 % | 52.3 % |
| Minted calls per declaring call | n/a | 2.23 | 2.28 | 2.28 | 2.39 |
| Calls on `this_session` / `this_battle` | n/a | 78.4 % of 167 | 82.8 % of 297 | 76.9 % of 324 | 77.3 % of 322 |
| …called shots only (a pick would count as `next_check` above) | n/a | 78.4 % | 82.8 % | 76.9 % | 77.3 % |
| `said` added conditions (round-2 rule; reported) | n/a | 13.8 % (23/167) | 12.1 % (36/297) | 10.2 % (33/324) | 13.0 % (42/322) |
| Decision agreement with A (rep-aligned) | 100.0 % | 94.3 % | 94.0 % | 93.5 % | 93.5 % |
| `max_tokens` stops | 0 | 0 | 0 | 0 | 0 |
| `invalid_tool_result` | 0.78 % (3) | 2.33 % (9) | 3.37 % (13) | 1.81 % (7) | 3.11 % (12) |
| …one-sided Fisher p vs A | — | 0.071 | 0.010 | 0.170 | 0.017 |
| No `tool_use` block | 0 | 0 | 0 | 0 | 0 |
| Forks offered / surviving the validator | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Output tokens p50 / p95 | 1,159 / 1,700 | 1,234 / 1,887 | 1,261 / 1,938 | 1,309 / 1,983 | 1,266 / 1,985 |
| Input tokens (mean, billed) | 13,291 | 14,635 | 14,640 | 14,641 | 14,732 |

**Noise floor (A rep 1 vs A rep 2):** anticipation 0.0 % [−9.0 %, +10.0 %]; decision agreement 96.9 %, so bar 4's floor is 91.9 %.

As in round 2, the declaration rate counts every declaring call, including the few whose trade result is invalid; production would mint nothing for those. Counting only the calls production would mint, the rates are D 18.9 %, 1A 32.4 %, 1A-C 36.8 % and 1A-CF 33.7 %. That excludes 2, 5, 0 and 5 calls; every arm stays inside bar 2's 15–40 % band.

D's and 1A-C's anticipation rows match to one decimal by coincidence. Both arms total exactly 482 candidates over the same A base, so the paired relative is equal. Their per-call counts differ on 158 of 386 calls, no tool input is shared, and the CI bounds differ in the third decimal.

### 5.2 Pass table (brief §5, frozen bars)

| Bar | 1A | 1A-C | 1A-CF |
|---|---|---|---|
| 1. Anticipation: paired diff ≥ −10 % and CI low ≥ −20 % | PASS | PASS | PASS |
| 2. Declaration rate 15 %–40 % of calls | PASS | PASS | PASS |
| 3. ≥ 50 % of calls `this_session` / `this_battle` | PASS | PASS | PASS |
| 4. Decision agreement ≥ A1-vs-A2 − 5 pts (91.9 %) | PASS | PASS | PASS |
| 5. `max_tokens` ≤ 2 %, invalid ≤ 3 % and Fisher p ≥ 0.05 | **FAIL** (3.37 %, p 0.010) | PASS | **FAIL** (3.11 %, p 0.017) |
| 6. `said` added conditions — reported, not gated | 12.1 % | 10.2 % | 13.0 % |
| 7. S2 fork rate ≥ 25 % and ≥ 1A-C's + 15 pts | — | — | **FAIL** (0 % vs 0 %) |
| 8. `respondsToDirective` true with no directive ≤ 5 % of forks | — | — | PASS (no fork offered) |
| 9. Forks surviving the validator ≥ 80 % (main + S2) | — | — | **FAIL** (no fork offered) |
| 10. S2 fork options avoid the restriction | — | — | withdrawn (founder ruling) |
| **Overall** | **FAIL** | **PASS** | **FAIL** |

### 5.3 Kind mix, horizon mix, validator removals

| Arm | Kinds | Horizons (all calls) | Removed by validator |
|---|---|---|---|
| D | called_shot 117, confirmation 50 | this_session 131, next_check 36 | calledShots:malformed 16, block:malformed_block 9, calledShots:no_slot_before_battle_end 4, calledShots:explicit_invalid 1 |
| 1A | called_shot 184, confirmation 113, watching 11 | this_session 246, next_check 51 | calledShots:malformed 21, block:malformed_block 7 |
| 1A-C | called_shot 210, confirmation 114, watching 9 | this_session 249, next_check 75 | calledShots:malformed 45, block:malformed_block 5 |
| 1A-CF | called_shot 233, confirmation 89, watching 6 | this_session 249, next_check 73 | calledShots:malformed 28, block:malformed_block 2 |

Two observations, descriptive only:
- **Every malformed called shot has the same cause, in every arm:** the model wrote `direction: "hold"`, but `direction` accepts only `entry` or `exit` (D 16, 1A 21, 1A-C 45, 1A-CF 28).
- **`malformed_block` means the model sent `declarations` as a JSON string** instead of an object.

### 5.4 Health detail (`invalid_tool_result`, first failing field as production records it)

| Arm | Invalid / returned | By field |
|---|---|---|
| A | 3 / 386 | conviction 2, hypothesis 1 |
| D | 9 / 386 | conviction 4, swap_type 3, anticipationCandidates 1, hypothesis 1 |
| 1A | 13 / 386 | hypothesis 5, conviction 4, swap_type 2, trade_reasoning 1, cited_forge_rules 1 |
| 1A-C | 7 / 386 | conviction 5, hypothesis 1, swap_type 1 |
| 1A-CF | 12 / 386 | hypothesis 6, anticipationCandidates 2, swap_type 2, conviction 2 |

None of the failures names `declarations`; all are trade-result fields.

The bar-5 verdicts rest on small counts:
- **The cap:** 3 % of 386 is 11.58, so 11 invalid results pass and 12 fail.
- **Pairwise context, not a bar:** 1A vs 1A-C, two-sided Fisher p = 0.26; 1A-CF vs 1A-C, p = 0.35.

### 5.5 Forks on the main sample

| Arm | Calls | Forks offered | Surviving | `respondsToDirective` true | …on checks with no directive |
|---|---|---|---|---|---|
| A | 386 | 0 | 0 | 0 | 0 |
| D | 386 | 0 | 0 | 0 | 0 |
| 1A | 386 | 0 | 0 | 0 | 0 |
| 1A-C | 386 | 0 | 0 | 0 | 0 |
| 1A-CF | 386 | 0 | 0 | 0 | 0 |

Recorded checks carrying a directive block: 0 of 193. Placeholder `fork` values (non-null but not a fork): 0 in every arm.

To rule out a counting miss, every raw output was scanned for a `fork` key anywhere. It appears in 47 of the 1,318 new outputs:
- in 4, as `declarations.fork: null`;
- in 43, as a stray top-level `fork: null` outside `declarations`.

None is non-null, and `respondsToDirective` appears in no output.

### 5.6 S2: the synthetic directive

| Arm | Calls | Forks offered | Fork rate | Surviving | `respondsToDirective` true | Declaration rate | Decisions | `directiveThreadId` echoed | Invalid / `max_tokens` |
|---|---|---|---|---|---|---|---|---|---|
| 1A-C (control) | 80 | 0 | 0.0 % | 0 | 0 | 28.7 % | HOLD 75, SWAP 5 | 24 | 4 / 0 |
| 1A-CF (nudge) | 80 | 0 | 0.0 % | 0 | 0 | 31.3 % | HOLD 75, SWAP 5 | 34 | 1 / 0 |

**Every S2 1A-CF fork** (the founder's listing in place of bar 10): **none was offered.** For the same reason there are no five 1A-C example forks. The agent did see the directive: it echoed the directive's thread id on 24 (1A-C) and 34 (1A-CF) of 80 calls.

### 5.7 Pacing per battle-day, by archetype (mean of the two reps; mean · median · min–max across battle-days)

| Arm | Archetype | Battle-days | Checks per battle-day | Declaring checks per battle-day | Minted calls per battle-day |
|---|---|---|---|---|---|
| D | contrarian | 1 | 8.0 | 1.5 | 3.5 |
| D | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 3.0 · 2.0 · 0.0–6.5 | 6.7 · 5.0 · 0.0–15.5 |
| 1A | contrarian | 1 | 8.0 | 4.5 | 7.5 |
| 1A | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 5.0 · 5.0 · 2.0–12.5 | 11.8 · 9.5 · 3.5–38.5 |
| 1A-C | contrarian | 1 | 8.0 | 4.5 | 10.0 |
| 1A-C | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 5.5 · 5.0 · 3.5–12.5 | 12.7 · 10.5 · 5.0–35.5 |
| 1A-CF | contrarian | 1 | 8.0 | 5.5 | 11.5 |
| 1A-CF | momentum_chaser | 12 | 15.4 · 16.0 · 9.0–23.0 | 5.2 · 4.0 · 2.0–14.5 | 12.5 · 8.5 · 4.0–43.5 |

### 5.8 `said` flags by matched term (reported, not gated; a line can match more than one)

| Arm | Terms |
|---|---|
| D | close(s) above/below 9, volume 6, holds/holding above/below … for/through 4, next check/eval (not next_check) 3, consecutive 2 |
| 1A | volume 15, holds/holding above/below … for/through 13, close(s) above/below 5, if confirmed 2, next check/eval (not next_check) 2, consecutive 1 |
| 1A-C | holds/holding above/below … for/through 17, volume 10, close(s) above/below 5, rvol 2, next check/eval (not next_check) 1 |
| 1A-CF | volume 16, holds/holding above/below … for/through 13, close(s) above/below 10, consecutive 2, next check/eval (not next_check) 2, if confirmed 2, rvol 2 |

**Flagged `said` lines** (up to 10 per arm, seeded pick, agent text only; D's ten are in the round-2 report §5)

**Arm 1A** (36 flagged of 297)
- `MU` · `this_session`: "MU breaks above $1100 (resistance) with volume confirmation, I would consider rotating it into Core tier to capture the momentum breakout." — *volume*
- `AMD` · `next_check`: "AMD breaks above $641 (upper BB) on volume within the next 15 minutes, confirming NR7 breakout." — *volume*
- `MU` · `this_session`: "MU enters Core if it holds above $1070 with volume confirmation, replacing META or ETN if their setups fail." — *volume*
- `PANW` · `this_session`: "PANW holds above $378.50 (within 0.2x ATR of BaggerBomb threshold) through close." — *holds/holding above/below … for/through*
- `NVDA` · `this_session`: "NVDA trades below $229.00 by close, I reconsider the hold if volume confirms the reversal." — *volume*
- `PLTR` · `this_session`: "PLTR trades above $193.00 (fresh high), I would consider bringing it into Support as a momentum confirmation play if it holds that level through the next check." — *next check/eval (not next_check)*
- `DHR` · `next_check`: "DHR holds above $226.13 (entry price) through the next check, I will hold for momentum confirmation." — *holds/holding above/below … for/through*
- `AMAT` · `this_session`: "AMAT will trade above 511.30 (upper Bollinger Band) by end of session if the NR7 squeeze breakout confirms with volume." — *volume*
- `LRCX` · `next_check`: "LRCX holds above $322.13 through the next check, or I reassess the breakout thesis." — *holds/holding above/below … for/through*
- `MSFT` · `this_session`: "MSFT holds above $519.00 (+0.2%) through close — confirms bench strength and makes it a viable late-session swap target if SNOW deteriorates." — *holds/holding above/below … for/through*

**Arm 1A-C** (33 flagged of 324)
- `ACN` · `this_session`: "ACN holds above $217 and MACD histogram turns positive on 5-min, I consider swapping it in for GME if GME breaks down first." — *holds/holding above/below … for/through*
- `NVDA` · `this_session`: "NVDA trades below $228.38 (entry price) before close, I would consider rotating to AMAT if volume confirms the breakdown." — *volume*
- `ACN` · `this_session`: "ACN holds above $216 through 2:00 PM (when S14 expires), I would evaluate it as a rotation target into the star slot." — *holds/holding above/below … for/through*
- `MU` · `next_check`: "MU holds above +0.5x ATR ($1,083) through the next check, confirming NR7 breakout bullish." — *holds/holding above/below … for/through*
- `PANW` · `this_session`: "If PANW reverses below $378.00 (below +3.5% gain) on volume, exit to protect the +4.21% gain before close." — *volume*
- `SNOW` · `this_session`: "SNOW trading below $339.92 (entry price) would break the NR7 setup; I would exit if it closes below entry." — *close(s) above/below*
- `DHR` · `next_check`: "DHR holds above $228 through the next 15-min check, confirming the entry is sound." — *holds/holding above/below … for/through*
- `HUM` · `this_session`: "HUM holds above $402 through close, confirming sustained outperformance." — *holds/holding above/below … for/through*
- `PLTR` · `this_session`: "PLTR trading above $190.00 with sustained volume (>1.1x RVOL) through the session would make it a candidate to replace BTC in Support tier." — *volume; rvol*
- `BE` · `this_session`: "If BE holds above $300 (current +1.95%) through the next 2 hours, I'd reconsider a Core-tier swap if MU/TXN stall." — *holds/holding above/below … for/through*

**Arm 1A-CF** (42 flagged of 322)
- `META` · `this_session`: "If META breaks below $730.00 (-0.5x ATR) on volume >1.2x, exit becomes justified to protect Core tier." — *volume*
- `SNOW` · `this_session`: "If SNOW closes below $317.04 (support), the squeeze setup fails and I will rotate." — *close(s) above/below*
- `AMD` · `this_session`: "AMD falls below 612.04 (entry - 0.5x ATR) on volume > 1.2x, I would consider a defensive exit from Star, but only if the $1T momentum story reverses." — *volume*
- `MSFT` · `this_session`: "MSFT breaks above $500 on volume confirmation, I would elevate it to Core tier." — *volume*
- `ETN` · `next_check`: "ETN trading below $437 support on volume >1.2x would signal NR7 breakdown — exit to RKLB or PWR." — *volume*
- `AMAT` · `this_session`: "If AMAT closes below $505 (breaking NR7 range low), I would rotate it out to protect the position." — *close(s) above/below*
- `LRCX` · `this_session`: "If LRCX closes below $322 (breaking NR7 range low), I would rotate it out to avoid downside acceleration." — *close(s) above/below*
- `NVDA` · `this_session`: "NVDA holds above 228 through close; if it breaks below, momentum reversal is in play." — *holds/holding above/below … for/through*
- `MU` · `next_check`: "MU trades above $1,079 (NR7 upper bound) by next check — if confirmed, I reassess whether to hold for +1.0x ATR bonus or rotate to AMAT." — *if confirmed*
- `PLTR` · `next_check`: "PLTR holding above $190 with volume >1.1x RVOL would confirm breakout — entry to replace META." — *volume; rvol*

### 5.9 Example `declarations` blocks (five per arm, seeded pick, agent text only)

Each called shot is shown as: symbol, direction · slot · side and level · horizon · default action — the `said` line. The blocks are shown as the calls validator kept them; none of the fifteen carries a fork or a `playerAsk`, and a non-empty `watching` list is shown where present.

**1A**

1. momentum_chaser, rep 2
   - `ETN` exit · core · below 424.64 · `next_check` · act — "ETN trading below -0.3x ATR (below $424.64) by the next check would signal NR7 setup failure; I would exit."
2. momentum_chaser, rep 1
   - `HOOD` exit · star · below 122 · `this_session` · act — "HOOD trades below $122.00 before close, I will exit the Star position — NR7 setup failed, -0.8x ATR penalty risk."
   - `AMD` exit · star · below 610 · `this_session` · act — "AMD trades below $610.00 before close, I will exit the Star position — NR7 setup failed, -0.8x ATR penalty risk."
   - `META` exit · core · below 735 · `this_session` · hold — "META trades below $735.00, I am watching for -0.25x ATR breach — potential swap trigger if it accelerates."
3. momentum_chaser, rep 1
   - `AMD` exit · star · below 604 · `this_session` · act — "AMD trading below $604.0 (approaching -0.65x ATR) before close would signal further deterioration and trigger exit consideration."
4. momentum_chaser, rep 2
   - `LRCX` exit · support · below 319.5 · `this_session` · hold — "LRCX will hold above $319.5 (entry -1.5%) through close; if it breaks below, NR7 setup has failed and I would exit."
   - `TXN` exit · star · below 278 · `this_session` · hold — "TXN will hold above $278.0 (-1.25%) through close; if it breaks, the NR7 contraction has resolved downward and exit is warranted."
   - `LRCX` exit · support · above 328 · `this_session` · act — "If LRCX trades above $328.0 (+1.4%) before 4:00 PM, the NR7 breakout is confirmed and I will hold through the +4.3% bonus target."
5. contrarian, rep 1
   - `MSFT` exit · support · below 489.56 · `this_session` · act — "MSFT trading below $489.56 (lower Bollinger Band, -3.20% from entry) would trigger exit from Support tier."

**1A-C**

1. momentum_chaser, rep 1
   - `AMD` exit · star (counterpart INTC) · below 625.19 · `this_session` · act — "AMD trading below -1.0x ATR ($625.19) triggers Survival Mode exit."
   - `ETN` exit · core (counterpart QCOM) · below 429.56 · `this_session` · act — "ETN trading below -1.0x ATR ($429.56) triggers Survival Mode exit."
2. momentum_chaser, rep 2
   - `NVDA` exit · star (counterpart TBD) · below 228.38 · `next_check` · hold — "NVDA below entry ($228.38) on the next check would signal downside squeeze break; I would exit before penalty acceleration."
3. momentum_chaser, rep 2
   - `HOOD` exit · star · below 119.78 · `this_session` · act — "HOOD trades below -1.0x ATR ($119.78) before close, I exit to protect the Star tier multiplier."
   - `AMD` exit · star · below 609.51 · `this_session` · act — "AMD trades below -1.0x ATR ($609.51) before close, I exit to protect the Star tier multiplier."
4. momentum_chaser, rep 2
   - `NVDA` exit · core · below 228.5 · `this_session` · act — "NVDA trading below 228.50 before close would signal momentum failure; I would exit to protect the +14 pts banked."
   - `AMAT` exit · core · below 505.34 · `this_session` · act — "AMAT trading below 505.34 (entry - 1.0x ATR) before close would trigger Bust penalty; I would cut it to lock in -8 pts rather than -18 pts."
5. momentum_chaser, rep 1
   - `ETN` exit · core · below 438.18 · `this_session` · hold — "ETN holds above entry ($438.18) through session close; if it breaks below, I reassess the NR7 thesis."
   - `CRM` entry · support · above 239.63 · `next_check` · hold — "CRM trades above $239.63 (current) by next check; if it does, it becomes a candidate to replace a weaker support name on a future evaluation."

**1A-CF**

1. contrarian, rep 2
   - `MU` exit · star (counterpart ORCL) · below 1090 · `next_check` · hold — "MU trades below $1,090 by next check: if NR7 setup fails, consider rotating to ORCL (pending 50-day SMA confirmation)."
2. momentum_chaser, rep 2
   - `MU` exit · star (counterpart AMAT) · above 1079 · `next_check` · hold — "MU trades above $1,079 (NR7 upper bound) by next check — if confirmed, I reassess whether to hold for +1.0x ATR bonus or rotate to AMAT."
   - `PANW` exit · core (counterpart AMAT) · below 317.59 · `this_session` · act — "PANW breaks below $317.59 (-1.0x ATR, Bust threshold) before close — if triggered, I exit immediately to AMAT to stop the bleeding."
   - `AMD` exit · star · above 621.37 · `this_session` · hold — "AMD reaches $621.37 (+1.0x ATR, BaggerBomb threshold) by close — if hit, I hold to lock in the +15 point bonus."
3. momentum_chaser, rep 2
   - `GME` exit · star · below 24.5 · `next_check` · hold — "GME trades below $24.50 by the next check — NR7 fails to resolve upward, triggering defensive exit consideration."
   - `AMAT` exit · core · below 510 · `next_check` · hold — "AMAT trades below $510.00 by the next check — NR7 fails to resolve, triggering defensive exit consideration."
   - `LRCX` exit · support · below 326 · `next_check` · hold — "LRCX trades below $326.00 by the next check — NR7 fails to resolve, triggering defensive exit consideration."
4. momentum_chaser, rep 1
   - `MU` exit · core (counterpart AMAT) · below 1053.98 · `this_session` · hold — "MU exits if it trades below $1,053.98 (entry price) on volume >1.2x average before close, invalidating the NR7 setup."
5. momentum_chaser, rep 2
   - `HOOD` entry · star · above 132.1 · `this_session` · hold — "HOOD trades above +0.5x ATR (+7.0% from entry, ~$132.10) before 3:00 PM, confirming NR7 breakout and unlocking +1.0x ATR bonus momentum."
   - `AMD` entry · star · above 658.71 · `this_session` · hold — "AMD trades above +0.5x ATR (+6.5% from entry, ~$658.71) before 3:00 PM, confirming NR7 breakout and unlocking +1.0x ATR bonus momentum."
   - `META` exit · core · below 735.04 · `this_session` · act — "META trades below -1.5x ATR (-1.65% from entry, ~$735.04), triggering Crash penalty. If this occurs, rotate to INTC or NVDA to stop the bleed."

### 5.10 Other observations (descriptive; no bar)

- **Stray top-level keys.** On 238–250 of 386 calls per 1A-family arm (round 2's D: 304), the model also writes `watching`, `fork` or `playerAsk` at the top level of the tool input, outside `declarations`. The top-level `watching` list is usually non-empty. No production reader consumes them: the trade validator checks known properties only, and the calls validator reads only `declarations` (`api/_utils/callRecords/validate.js:262`, `candidate.js:208`). Only the tick capture keeps them, as part of its stored copy of the original tool result. They change no measure here.

## 6. Limits of this read

- **Archetype coverage.** 185 of 193 checks are `momentum_chaser`, and the `contrarian` rows are one battle-day (8 checks). S2 has 3 contrarian checks.
- **S2 is constructed.** Its directives were never filed by a player. The canonical menus contain no sector-naming directive, and in 75 of 80 calls per arm the agent held, so few S2 checks may have offered a "first choice" for a directive to rule out. The fork result (0 of 160) measures the agent's behavior on these inputs, not every situation a player could create.
- **The `said` rule is lexical** and was not changed (round-2 report §6).
- **The fork universe is rebuilt, not recorded.** Production freezes each check's universe in memory and stores only its size, so a fork's options would be judged against the battle's roster as read on 2026-10-02 plus the names that check's prompt showed. The rebuilt set can differ from production's in both directions:
  - narrower: on 124 of 193 checks, the prompt shows at least one bench name the stored roster lacks;
  - wider: the stored roster keeps rival-held names, which production filters out, and later hot-bench additions.
  Called shots are never judged against the universe. With no fork offered, this changes nothing here.
- **The bootstrap CI is seeded per arm.** Its Monte Carlo spread is about 0.1–0.2 points, which could matter only for a CI low within that distance of −20 %. The closest here is −7.8 %.
- **The replay measures what the model writes, not what happens next.** No call was minted, graded or flipped, and no player saw a tile.
- **The baseline window is 43 checks in 3 battles**, recorded at `max_tokens` 2,048 and replayed at 3,072.

## 7. Review (BUILD_RULES §2)

**Why.** The branch changes more than 1,500 lines (four files: three scripts and this report), so the review is mandatory.

**How.**
- **Six lenses, each on its own snapshot tree.** Each tree is an archive of HEAD, the branch's three scripts, a `node_modules` junction and a private copy of the raw data. There was no `.env.local`, no key and no network; nothing touched the shared tree.
  - L1: request fidelity and the gates
  - L2: S2 faithfulness
  - L3: the analysis and the bars
  - L4: batches, cost and failure paths
  - L5: non-regression
  - L6: mutation, run last on the final code
- **Every finding was handed to a verifier told to refute it with a concrete repro**, each verifier in its own tree: VA (L1, L2), VB (L3, L4), VC (L5).
- **`vite build`:** exit 0 (46.5 s).
- **Coupled tests:** `agentEvalToolSchema.build1a.test.js` 15/15 and `copy.test.js` 22/22.
- **One platform-only failure.** `archetypeRegistry.test.js` has one failing row (Windows path separators in the ratchet scan). It fails identically on an LF archive of the base commit `e6a84445`, so it is not caused by this branch.

**Outcome.**

| | Count |
|---|---|
| Findings raised by the lenses | 41: L1 9, L2 4, L3 11, L4 11, L5 6. Some are the same defect seen by several lenses, about 33 distinct. |
| Confirmed as written | 30 |
| Confirmed with a correction (part of the claim refuted, or severity or reachability lowered) | 11: L1-5, L2-1, L2-4, L3-1, L3-8, L4-2, L4-3, L4-5, L4-6, L4-7, L5-5 |
| Refuted outright | 0 |
| New items found by the verifiers | 4: VA-1, VB-1, VB-2, VC-1 |
| **Findings that change a number or a verdict of this run** | **0.** Every finding sits on a failure path that did not occur (all 1,318 requests succeeded) or concerns forks, and no fork was offered. |

The refuted parts:
- **L4-3:** its MAJOR rating was lowered to MINOR. It is a misleading diagnostic line, and no measure or bar changes.
- **L4-7:** "a retrieve error aborts collect" is false. Poll errors are caught; only the results download aborts.
- **L5-5:** "the product test breaks at import" is false. vitest yields `undefined`; plain Node fails.
- **L3-1:** round 2's string blocks are not parseable JSON, and none held a fork.
- **L2-1:** the universe mismatch runs both ways (narrower and wider), and the roster is the one read on 2026-10-02.
- **L4-5 and L4-6:** reachable only through operator error, or already mitigated by the `pending` marker.

**Findings and dispositions.** Severities are as verified. "Fixed" means fixed on this branch. After every fix, round 3 was re-analyzed: every measure and every bar is unchanged (0 differences against the pre-fix results), and rounds 1 and 2 still reproduce byte-for-byte.

| ID | Sev. | Finding | Disposition |
|---|---|---|---|
| L1-1 · L3-4 · L4-3 · L5-2 | MINOR | The "round 2 reproduced" line reads NO when any new call fails, because it used round 3's five-arm paired set. | **Fixed:** recomputed on round 2's own paired set (193). |
| L1-2 · L3-2 · VB-2 | MINOR | An exact tie on bar 7 (or bar 4) fails through binary rounding (e.g. 34/80 vs 22/80). | **Fixed:** bars compare with a 10⁻⁹ tolerance (`atLeast` / `atMost`). Rounds 1–2's own tables are unchanged, for reproduction. |
| L1-3 | NOTE | The arm gate checks the texts against their own constants, never against the brief. | No code change. The texts were checked verbatim against the brief by L1 and VA (§1). |
| L1-4 | NOTE | The reuse gate never read round 2's own record that its A equalled the recorded off tool. | **Fixed:** it now requires `storedToolDrift.baseline` = 43 / 0. |
| L1-5 | NOTE | `max_tokens` 3,072 is a pinned constant; round 2's records cannot prove it. | Disclosed (§0.4): the constant is read from round 2's own commit. Round 2's largest output, 2,729 tokens, shows the 2,048 cap was not in force. |
| L1-6 | NOTE | Equal battle metadata was computed but not enforced. | **Fixed:** enforced. |
| L1-7 | NOTE | Submit's "recorded body" check compared an object with itself. | **Fixed:** the reuse gate re-hashes every body against its Firestore `requestSha256` (193 of 193). |
| L1-8 | NOTE | `--dry-run` returned before the check that the batches on record match the plan. | **Fixed:** that check now runs first, and the dry run reports `priorPlanMatches: true`. |
| L1-9 · L4-8 | NOTE | `collect` never checked that every request came back. | **Fixed:** missing and duplicate ids are detected and recorded in `collect.json` (`complete`). |
| L2-1 | MAJOR (latent) | Fork options were judged against one stored universe per battle, while production uses a per-check universe. | **Fixed (best available):** the stored roster plus the names the check's prompt showed; the approximation is disclosed in §6. No effect here: no fork, and called shots never use the universe. |
| L2-2 | MINOR | The S2 eligibility filter was missing from `results.md`. | **Fixed:** an S2 population line with split exclusion counts. Also disclosed in §2.1. |
| L2-3 | NOTE | The brief names the voice layer's directive builder. | Recorded in §2.2; S2 used the evaluator's renderer. |
| L2-4 | NOTE | Insertion could be silently misplaced on CR text, or on a stray header late in a pre-directive part. | **Fixed:** the rule throws on CR, and on any part before the insertion point other than trigger / momentum / risk. After the mutation battery (M15) it also throws when a later part's header is not followed by its own rows. The 48-row probe still passes. |
| L3-1 | MAJOR (latent) | Bar 9 could overstate survival: forks in string blocks were uncounted, and forks on trade-invalid calls counted as surviving. | **Fixed:** string-block forks count as offered and not surviving. A fork survives only with a valid trade result, as in production (`agent-evaluate.js:2851-2866`). |
| L3-3 | MINOR | Placeholder `fork` values (`{}`, `false`…) counted as offered. | **Fixed:** they are tallied apart; there are 0 in this run. |
| L3-5 · L4-4 | MINOR | With no data, bars 1, 4 and 5 showed PASS (null compared as 0). | **Fixed:** a missing number never passes, and bar 5 needs returned calls. Rounds 1–2 unchanged. |
| L3-6 | MINOR | The S2 fork listing covered only complete checks, and showed non-object options as `null`. | **Fixed:** it lists every returned record and shows such options raw. |
| L3-7 · VB-1 | MINOR / NOTE | Forks would lift bar 2 and lower bar 3, and the "called shots only" rows were missing. | **Fixed:** both rows are rendered (reported, not gated). |
| L3-8 · L4-9 | MINOR | `results.md` omitted round 2's random `said` lines, spend and counts, and the S2 and pooled survival figures. | **Fixed:** all are rendered. |
| L3-9 | NOTE | The bootstrap CI's Monte Carlo spread is 0.1–0.5 points. | Disclosed in §6; the nearest CI low is −7.8 % against the −20 % bar. |
| L3-10 · L5-6 | NOTE | `saidInconsistent` defaulted to round 1's rule under `--round=3`. | **Fixed:** `round >= 2`, in place; rounds 1–2 unchanged. |
| L3-11 | NOTE | The analysis never tied records to what was submitted. | **Fixed:** each record must match the manifest, and every request on disk must re-hash to its `paramsSha256`. |
| L4-1 | MINOR | `collect` ignored an unconfirmed create (`pending`). | **Fixed:** it refuses with a STOP. |
| L4-2 | MINOR | The analysis ran on a partial collection without warning. | **Fixed:** it refuses unless `--allow-partial`, and the run header shows the counts. |
| L4-5 | MINOR | `batches.json` was rewritten in place on every poll. | **Fixed:** atomic temp-file-and-rename writes. A second `collect` started during an upload remains an operator error (disclosed). |
| L4-6 | MINOR | A new batch id reached the screen only after the save. | **Fixed:** printed first. |
| L4-7 | MINOR | One transient error on the results download aborted `collect`, and a permanent 4xx polled forever. | **Fixed:** reads retry, each batch is downloaded whole (up to 3 attempts), and a permanent 4xx stops. |
| L4-10 | NOTE | Cache writes are priced at the 5-minute rate. | No change: 0 cache markers and 0 cache tokens. |
| L4-11 | NOTE | The S2 table mixed denominators. | **Fixed:** one denominator. |
| L5-1 | MINOR | Re-running round 2's analysis rewrites its `results.json`, which the said-lint corpus and the reproduction check read. | **Fixed:** the reproduction is pinned to round 2's original file by SHA-256. This session's reproduction runs used a scratch copy; the real originals are unchanged (`2719fdae…`, `3fb9006a…`), and the corpus still rebuilds to its pin (`2513b3d8…`). |
| L5-3 | NOTE | Four Build 1a report citations into these scripts now point elsewhere. Both name their commit, so they remain true. | No change. New positions: `validate` at `:581-584`; the minted-shot loop at `:465-490` inside `measureArm` (`:440`), called shots at `:474-486`; `ARMS_ROUND3` at `declarationsWordingArms.mjs:140`; `case '1A'` at `:167`. |
| L5-4 | NOTE | The lint block's line range is enforced only by review. | No change: the block is byte-identical and still at `:376-397`. |
| L5-5 | MINOR | The arms module's two new named imports would break its load (and rounds 1–2) if a later PR renamed them. | **Fixed:** a namespace import inside `assertRound3Arms`, with a type guard. |
| VA-1 | NOTE | A fork written at the top level, outside `declarations`, was invisible. | **Fixed:** counted apart as "stray top-level forks"; 0 in this run (all 43 such keys are `null`). |
| VC-1 | NOTE (pre-existing at HEAD) | Re-running `select --round=2` would rewrite round 2's `sample.json` `createdAt`, which the pinned corpus records. | **Reported for separate tasking, not fixed** (BUILD_RULES §3). This branch writes to `round3` and never triggers it. |

**Mutation battery (L6, last, on the final code).**

Each guard was broken on purpose, in L6's own tree, and the command that should catch the break was run. Every guard command first passed on the pristine tree. All files were restored and re-verified by SHA-256 after every run; 3,136 files match the baseline.

The real data has no fork, so the fork guards were proven on synthetic records built from copies of the real ones.

| Mutant | Guard | Result |
|---|---|---|
| M1–M5 | the arm gate: one character of the 1A-C block text; an extra leaf; `respondsToDirective` first, required, or nullable | KILLED (each throws with the defect named) |
| M6 | the pinned 1A-C tool hash | KILLED by `submit --dry-run` |
| M7–M11 | the reuse gate: a missing D rep; one byte of a recorded request; round 2's drift record; one universe symbol; `max_tokens` | KILLED |
| M12a, M12b | the block placed after the leans block, with and without the "part before" guard | KILLED (the guard, the S2 re-derivation, and 12–14 failing probe rows) |
| M13 | equipped leans not excluded from the pool | KILLED (the directive would not render as a pure insertion) |
| M14 | the CR guard | KILLED (without it, a CRLF context silently gets the block at the end) |
| **M15** | a stray "YOUR LAST 3 DECISIONS:" inside a one-paragraph RISK STATUS | **SURVIVED, then fixed.** The rule now also requires the line after a later part's header to be that part's own row format, and throws otherwise. Re-checked: the mutant now throws; all 40 S2 insertions, the dry run and the 50-row probe still pass; round 3's `results.md` is byte-identical. |
| M16, M17a, M17b | `max_tokens` not swapped; the 1A tool sent for 1A-C | KILLED (reuse gate, submit pins, analysis request hash) |
| M18 | a missing record | KILLED (STOP unless `--allow-partial`) |
| M19a | a 1A record relabelled 1A-C | KILLED (manifest tie) |
| **M19b** | a 1A-C record relabelled 1A | **Got through under `--allow-partial`, then fixed.** The analysis now requires each record to sit in the file its own fields name, never twice. Re-checked: the mutant now STOPs even with `--allow-partial`; round 3's output is unchanged. |
| M20 | one byte of an S2 request on disk | KILLED |
| M21 | bar tolerance removed, on an exact +15-point tie (22/80 vs 34/80) | KILLED (bar 7 passes with the fix, fails without) |
| M22 | a fork on a trade-invalid call counted as surviving | KILLED |
| M23 | string-block fork detection removed | KILLED |
| M24 | the reproduction back on round 3's paired set, with one record missing | KILLED (the fix still says yes on 193) |
| M25 | the pin on round 2's original `results.json` | KILLED (the rewritten file is reported as not the original) |
| M26 | `collect` while `pending` is set | KILLED (STOP before any client exists) |
| X1, X2, X4 | (extras) placeholder forks; the per-check universe; `submit` while `pending` is set | KILLED |
| X3 | (extra) the reproduction judged with round 3's universe | SURVIVED as an **equivalent** mutant: round 2's A and D records carry no fork, so the universe cannot matter there |

Total: 30 mutants. 27 were killed, 2 were real survivors (fixed and re-checked), and 1 is equivalent.

## 8. Reproduction

From the repo root, in order:
1. `node scripts/declarations-wording-experiment.mjs select --round=3` reruns the gate (Firestore reads only).
2. `node scripts/declarations-wording-experiment.mjs s2 --round=3` runs the reuse gate and the arm gate, then builds S2.
3. `node scripts/declarations-wording-experiment.mjs estimate --round=3` runs `countTokens` and the $20 stop.
4. `node scripts/declarations-wording-experiment.mjs submit --round=3` checks every request, creates the two batches and collects. `--dry-run` runs the checks and sends nothing.
5. `node scripts/declarations-wording-experiment.mjs collect --round=3` resumes from `batches.json`.
6. `node scripts/declarations-wording-experiment.mjs analyze --round=3` writes `raw/round3/results.json` and `results.md`.
