# Experiment — Growth Replay (does agent growth change decisions?)

**Run:** `gr-20261008T181724` · **Base HEAD:** `7631c9e6e277175b1da6e2c6d8b227e5e7a88738` · **Seed:** `20261008` · **Date:** 8 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Prompt:** Fable, "Experiment prompt — Growth Replay", 8 Oct 2026, with the founder's checkpoint rulings of the same day · **Review:** BUILD_RULES §2 adversarial review, §9 below.

## 1. In plain terms

We took 300 real moments where the Trading Brain made a call in a real battle and asked it again offline, 10 times each. Then we asked again with parts of its prompt changed.

| Question | Answer (frozen label) |
|---|---|
| How steady is the brain when asked the same thing ten times? | **Steady.** It repeats its own call 94% of the time. |
| Does removing what the agent has learned change its calls? | **Moves decisions.** The label sits on its bar (§4.2). |
| Does giving it another agent's learning change its calls? | **Moves decisions.** The label sits near its bar (§4.2). |
| Does removing the player's loadout change its calls? | **Moves decisions.** The label sits near its bar (§4.2). |
| Would a different model decide differently, and what would it cost? | Claude Haiku 5.5 agrees on the holds and almost never makes the trades, at about an eighth of the cost. Sonnet 5.5 and Opus 5.5 could not be tested. |

- **How steady the brain is.** Asked the same question ten times, the brain gave the same call 94% of the time, so it is **steady**. When the original call was a trade, it repeated it less reliably than when it was a hold: 87% against 96%.
- **Learning removed.** This compares a grown agent with a brand-new one. The agent's learned paragraph is replaced by the line a brand-new agent sees, which tells it to "trade carefully and observe", so the comparison includes that line.
  - **The frozen rule says it moves decisions.** The agent's usual call changed on 29 of 280 moments (10%). From noise alone we would expect about 2%.
  - **Without its learning the agent traded more, not less.** Trades went from 14% to 19% of calls, despite the "trade carefully" line.
- **Learning swapped.** This tests whether the *content* of the wisdom matters, by giving an agent another agent's wisdom.
  - **The frozen rule says it moves decisions.** The usual call changed on 29 of 280 moments, the same count as removing it.
  - **With swapped-in wisdom the agents traded less:** 14% down to 8% of calls.
  - **Only three wisdom paragraphs exist in the whole corpus**, and copies of an agent share the same text. So the same-archetype swap is a swap between two Trend Follower versions.
- **Loadout removed.** Removing the player's Forge rules and standing leans **moves decisions** by the frozen rule. The usual call changed on 28 of 280 moments, and trades fell from 14% to 10% of calls. Fragments of the removed rules survive inside one news section on 41 of the 280 moments (§3).
- **How firm the three labels are.** Each is real, beyond doubt (p = 0.0005). But the frozen "moves decisions" line falls inside the margin set by an arbitrary detail: how ties between equally common calls are broken.
  - The three edits changed about the same number of calls, so this run cannot rank them.
  - Each edit changed the agent's usual call on about 1 moment in 10.
- **A different model.** Claude Haiku 5.5 is very self-consistent (99%) and costs about an eighth as much per decision: $0.0024 against $0.0206 at standard prices. But it is not a drop-in replacement:
  - **On holds it matched the production model every time.** That covers all 242 moments where production's usual call was to hold.
  - **On trades it rarely matched.** It agreed on only 6 of the 58 moments where production's usual call was a trade. It trades on 2% of calls; production trades on 18%.
  - **Claude Sonnet 5.5 and Claude Opus 5.5 could not be tested.** Both refuse the "must answer with the decision form" setting the brain uses. The founder ruled to leave them out rather than relax it.
- **Spend:** $116.34 in total, against a $150 cap.

This measures whether decisions change, not whether they improve. It is design input, not qualification evidence.

---

## 2. Gate facts

**Session preamble (BUILD_RULES §2/§3).**
- `git fetch origin` ran first.
- The worktree was clean. HEAD `7631c9e6` equals `origin/main`. The local branch is the app-suffixed `claude/experiment-growth-replay-e8b055`, pushed as `claude/experiment-growth-replay`.
- `node_modules` was a junction into the primary checkout. It is gitignored and was unlinked at session end.

**Which code ran:**
- The run's commands (`plan` 18:17Z, `pilot` 18:19Z, `submit` 18:29Z, `collect` 18:47Z) ran from the working copy of the script before its first commit. The manifest records HEAD `7631c9e6`.
- Changes made after those commands are listed in §5 and §9.
- The **analysis of record** ran from the final committed script. Every frozen measure is identical to the pre-review analysis; this was checked.
- From this commit on, every command logs the script's own SHA-256 in the manifest.

Markers: VERIFIED means read at that line at this HEAD in this session.

### G1 — Replay class: **A** (verbatim)

| Fact | Evidence |
|---|---|
| The stored outgoing body is the exact string the SDK dispatched. | The observer copies `init.body` at the fetch boundary: `api/_utils/tickCapture/captureBodyObserver.js:86-100` VERIFIED. The writer stores it with SHA-256 and byte count of the original bytes: `captureWriter.js:89-100`, `:315-323` VERIFIED. |
| It is the complete Messages request. | All 441 eligible bodies have exactly the keys `model, max_tokens, temperature, system, messages, tools, tool_choice`. That is the production literal at `api/cron/agent-evaluate.js:2876-2893` VERIFIED. The layout is `system`, then 3 messages (identity, a canned assistant line, live context), 1 tool, and a forced `tool_choice`. |
| Re-serialization is byte-identical. | `JSON.stringify(JSON.parse(body)) === body` for 441 of 441. Response SHA-256 mismatches: 0. |
| Model and sampling. | `claude-haiku-4-5-20251001` ×441. `temperature` 0.4 ×441. `max_tokens` 3072 ×398 and 2048 ×43; the 2048 bodies were captured before the Sep 25 raise. No `cache_control`, no `stream`, no `speed`. |
| Headers. | The client is built with `{ apiKey, maxRetries, fetch }` only (`agent-evaluate.js:228-232` VERIFIED). There are no default or beta headers. The SDK sends `anthropic-version: 2023-06-01`, and the replay sends the same. The key variable is `CLAUDE_API_KEY` (`:229`). |

### G2 — Corpus

There was no collection-group query. The script walked every battle alive on or after 2026-09-01 (149); capture shipped 2026-09-21. Of those, 97 had tick records.

| Count | n |
|---|---|
| All ticks | 2,384 |
| Ticks that dispatched a model call | 508 |
| Model returned a parsed, schema-valid tool result (`model.outcome = ok`) | 441 |
| Excluded at the model step | 67 (60 timeout, 7 `invalid_tool_result`) |
| Body present, not incomplete, SHA-256 verifies, request parses, sections parse and agree with the battle's snapshot | 441 |
| **Eligible** | **441** |

| Breakdown of the 441 | |
|---|---|
| By archetype | Trend Follower (`momentum_chaser`) 350 · Contrarian 71 · Diversifier 20 |
| By original decision | hold 389 · action 52 (11.8%) |
| By battle | 31 battles |
| By date (UTC) | Sep 22: 18 · Sep 23: 10 · Sep 25: 15 · Sep 28: 30 · Sep 29: 49 · Sep 30: 40 · Oct 1: 31 · Oct 2: 18 · Oct 5: 62 · Oct 6: 70 · Oct 7: 70 · Oct 8: 28 |
| LEARNED section | present 421 · empty (fresh agent) 20 |
| Agents | 7. Six have learned content but **only 3 distinct learned texts**, because clones inherit the source agent's insight (`api/_utils/trainingClone.js:73` VERIFIED). None of the three equals or contains the hard-coded insight in the legacy test seeder (`src/services/agentService.js:542`); this was checked. |

### Sample

- **Size and spread.** N = 300, seeded (`20261008`). Battles were picked round-robin. The 15% cap is 45 per battle; the largest share any battle supplied was 12, from 31 battles.
- **Decision balance.** All 52 actions plus 248 holds, so actions are 17.3% of the sample against 11.8% natural. Supply allowed no closer to 50/50.
- **Archetypes.** Trend Follower 231 (24 battles) · Contrarian 49 (5) · Diversifier 20 (2).
- **Arm 2 subset (LEARNED present): 280 ticks.** Trend Follower 231 · Contrarian 49. The Diversifier ticks have no learned content.
- **Every arm-2 tick has EQUIPPED content.** Rules are on all 280; standing leans are on 82.
- **Swap donors.** Every arm-2 tick has one, seeded:

| Donor pairing | Ticks |
|---|---|
| `donor_same_archetype` | 178 (Trend Follower version A → B: 168; B → A: 10) |
| `donor_other_archetype` | 102 (Contrarian → Trend Follower A: 45; Trend Follower A → Contrarian: 53; Contrarian → Trend Follower B: 4) |

The two Trend Follower texts are genuinely different. They share only the section header (common prefix 68 chars) and have a word-overlap Jaccard of 0.44.

**Repeats** (N ≥ 150): baseline 10, each memory variant 10, the ladder model 5.

---

## 3. Section map (G3/G4/G5)

The assembler is fenced, `api/_utils/agentEvalPromptAssembly.js`, read only. Line numbers are VERIFIED at this HEAD. The three prompt parts are built at `agent-evaluate.js:2814-2820`.

### messages[0] — the identity block (`:746-839`, parts joined by a blank line at `:838`)

| Section (literal header) | Data source | Class |
|---|---|---|
| `ABOUT YOU:` (`:752-756`) | Name, archetype, risk tolerance (`agentData.config.risk`, the archetype default config: `agentBattleService.js:209`, `create-profile.js:111`), evaluation interval. | STATE / ARCHETYPE: untouched |
| `YOUR STRATEGIC BRIEF (from when you built this portfolio):` (`:759-762`) | `agentData.lastDecision.strategyBrief`, from this battle's draft call (`agentBattleService.js:184`). | STATE: untouched. Note: the draft prompt itself carries the wisdom (`agentPromptAssembly.js:84-86`), so learning can reach the brief. Not stripped. |
| `YOUR INITIAL PORTFOLIO RATIONALE:` (`:765-772`) | Same draft call (`agentBattleService.js:185`). | STATE: untouched |
| **`YOUR STRATEGIC WISDOM (learned over multiple consolidation cycles):`** (`:775-777`) | `agentContext.consolidatedInsight`, frozen at battle creation from the agent doc (`agentBattleService.js:211`). See the provenance note below the tables. | **LEARNED** |
| **`YOUR FORGE RULES:`** (`:783-836`) | `agentContext.activeRules`, re-projected from the current equipped state at deploy (`decide.js:233-273`, `agentBattleService.js:186`). Includes the `C_INST` lag note when institutional rules are equipped (`:816-822`) and the "When making trades" trailer (`:824-834`). | **EQUIPPED** |

**Provenance of `consolidatedInsight`:**
- The consolidation writer composes it (`agentConsolidationApply.js:273, :304`).
- It is copied to training and casual clones (`trainingClone.js:73`, `:117-118`; `casualClone.js:58`, `:93`).
- Empty strings are written at agent and CPU creation.
- The legacy client test seeder (`agentService.js:520-566`) hard-codes one. Its creates are now denied (`firestore.rules:307-308`), and none of the corpus texts matches it.

### messages[1]

| Section | Class |
|---|---|
| The fixed assistant line (`agent-evaluate.js:2883`) | INSTRUCTIONS: untouched |

### messages[2] — live context (`:1122-1286`, joined at `:1285`)

| Section (literal header) | Data source | Class |
|---|---|---|
| `━━━ LIVE BATTLE STATE ━━━` + `MACRO BENCHMARKS TODAY:` (`:1133-1139`) | Battle score state, macro prices. | STATE / MARKET |
| `## Vision State` (`:1144-1147`, `:1040-1100`) | `battle.vision` (`agent-evaluate.js:1629-1655`), the battle's thesis. 0 occurrences in the corpus. | STATE |
| `REGIME CONTEXT:` (`:1150-1153`, `:1762-1779`) | Regime classifier. | MARKET |
| `STRATEGY PRESET:` (`:1156-1158`) | `battle.strategyPreset`, default `balanced` (`agentBattleService.js:256`). "The user's chosen strategic posture" (`agentPresetConfig.js:4`), but a battle setting, not set through equip. | STATE: untouched, listed |
| `ACTIVE POSITIONS:` (`:1163-1165`, `:1458-1487`) | Portfolio. | STATE |
| `BENCH (available for swap):` / `BENCH: Empty …` (`:1168-1169`, `:1489-1517`) | Bench. The equipped watchlist shapes bench membership (`agentBattleService.js:198-200`) but has no section of its own. | STATE / MARKET: untouched, listed |
| `BENCH TECHNICAL CONTEXT:` (`:1172-1177`, `:1535-1586`) | Rankings, technical scores. | MARKET |
| `FUNDAMENTALS (held + bench; …)` (`:1182-1183`; `fundamentalsRender.js:134-179`) | Fundamentals mirror. | MARKET |
| `CLOSED TRADES THIS BATTLE:` (`:1186-1187`, `:1728-1755`) | Trades. | STATE |
| `TRIGGER (why you were woken up):` (`:1190-1194`) | Fired triggers. | STATE |
| `INTRADAY MOMENTUM SNAPSHOT:` (`:1197-1202`, `:1826-1863`) | VWAP, BB width, NR7. | MARKET |
| `RISK STATUS:` (`:1205-1208`, `:1784-1804`) | Risk manager. | STATE |
| `ACTIVE DIRECTIVE (from your Coach):` (`:1228-1242`; `controlPromptRenderer.js:213-219`) | `battle.directive`, filed during this battle. 11 corpus ticks. | INSTRUCTIONS / STATE: untouched |
| **`STANDING LEANS (user-equipped persistent adjustments):`** (`:1228-1242`; `controlPromptRenderer.js:231-239`) | `agentContext.standingLeans`, frozen at creation (`agentBattleService.js:202-208`; `leanRevalidation.js:289-307`). | **EQUIPPED** |
| `=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===` (`:1245-1255`, `:891-994`) | Market data, fetched only when institutional rules are equipped. 0 occurrences. | MARKET: untouched, listed as coupled to the loadout |
| **`FANTASYTIMES INTELLIGENCE (recent stories from your newsroom):`** (`:1258-1276`; `agentNewsContext.js:207-284`) | News stories, ranked against the equipped rules. When rules are equipped it **quotes them**: "Your <Category> rules are most relevant" (`:221-229`), `→ Relevant rules: C<n> (<rule text cut to 40 chars>)` (`:266-274`), and a closing paragraph on following "your Forge rules" (`:281-284`). On 51 of 300 sampled ticks (41 of the 280 arm-2 ticks); 19 of those 41 quote rule labels and excerpts. | **MIXED** (MARKET + EQUIPPED): untouched, listed |
| `FANTASYTIMES BREAKING NEWS:` (`agentNewsContext.js:293-301`) | Bare headlines, used when no rules are equipped. 0 corpus ticks. | MARKET |
| `YOUR LAST 3 DECISIONS:` (`:1279-1283`, `:1389-1402`) | This battle's recent evaluations, including 80-char rationale excerpts (`:1398`) written by earlier calls that had the wisdom and rules in context. | STATE: untouched. An upstream path for learning, like the brief. |

### System prompt and tools

| Section | Class |
|---|---|
| System prompt (`:340-534`; tournament variant `:549-`): preamble; `━━━ ARCHETYPE IDENTITY ━━━` (`evalIdentityBlocks.js:190-199`); `━━━ SCORING RULES ━━━`, `━━━ DECISION FRAMEWORK ━━━` (helpers `:89-330`), intraday signals, regime strategy, `━━━ FORGE RULES ━━━` guidance (static), anti-thrash, `━━━ SURVIVAL MODE ━━━`, anticipation, `━━━ INNER MONOLOGUE FORMAT ━━━` | ARCHETYPE (identity) / INSTRUCTIONS: untouched |
| `tools`, `tool_choice` | INSTRUCTIONS: byte-identical in every variant |

**MIXED: one section, the rule-aware FANTASYTIMES INTELLIGENCE news block.** As the prompt requires, it is left untouched. The consequence for the `loadout` variant is that, on 41 of the 280 arm-2 ticks, the edited prompt still names equipped rules the identity block no longer shows. On 19 of those it quotes rule excerpts.

Every LEARNED and EQUIPPED section that was edited sits in its own part, with its own header and its own provenance.

### G4 — empty renderings

| Section | Empty rendering (from code) | Cross-check against real captures |
|---|---|---|
| LEARNED | The literal line `You are a fresh agent with no battle history yet. Trade carefully and observe.` replaces the part (`:778-780`). | 20 captured ticks really were empty. All 20 render exactly that line, and all 20 sit on battles with no `consolidatedInsight`. The 421 learned ticks all sit on battles that have one. |
| Forge rules | The whole part is omitted, separator included (guard `:784`, join `:838`). | No captured tick had zero rules (441 of 441 have them), so this rests on the code. The code is an explicit guarded push. |
| Standing leans | `renderLeansBlock` returns null (`controlPromptRenderer.js:233`). Nothing is pushed (`:1241`), so the block and its separator are absent (`:1285`). | 306 captured ticks without leans have no block. 135 with leans have one. Each matches its battle's snapshot exactly. |

### G5 — decision key

The tool schema is `api/_utils/agentEvalToolSchema.js`: `decision` enum `HOLD | SWAP` (`:12-16`), `symbolOut` (`:18-20`), `symbolIn` (`:22-25`).

| Key | Values |
|---|---|
| **coarse** | `HOLD` · `SWAP` · `malformed` |
| **fine** | `HOLD` · `SWAP:OUT>IN` · `malformed` |

**`malformed`** follows production exactly:
- It reads the **first** `tool_use` block (`agent-evaluate.js:2935`).
- It fails when that block is missing or fails `validateTradeToolResult`'s checks (`agentEvalToolResultValidation.js:92`), in the same order: required → type/enum/range → the SWAP ticker pair.
- It validates against **production's validation schema**, the declarations-off tool (`agentEvalToolSchema.js:504`). For all 300 sampled requests this equals the request's own schema minus `declarations`: 193 requests carry `declarations`, 107 do not, and 300 of 300 matched. The check can be re-run (appendix).
- A stricter key that also validates `declarations` is reported as a sensitivity check (§4.2).

### Standing-lean provenance (founder ruling 3)

**All 82 lean moments belong to one agent.** It is agent `w8EPjT…`, a Trend Follower, not a clone, across 9 battles. Its battle snapshots carry leans `TF-01` and `TF-03`. On the agent document those two were equipped on 2026-09-16 at 03:37:49Z and 03:37:51Z, 1.7 s apart. The document also holds two Diversifier pins, `DV-01` and `DV-04` (2026-08-17), which the battle snapshot omits as off-menu.

- **What the record shows.** The record cannot tell who set them. Each lean entry stores only `{adjustmentId, version, equippedAt}`, and the battle snapshot only `{adjustmentId, version, text}`. Neither has an initiator field.
- **What the code shows: one live writer.** That writer is the owner-authenticated equip endpoint, `api/agent/equip-lean.js`: auth at `:94-95`, owner check at `:132`, write at `:216-232`. Its only in-repo caller is the Forge character screen's equip / re-confirm buttons (`CharacterArea.jsx:187-189` → `agentService.js:461-470`).
- **The other two writers only remove leans.** These are unequip (`unequip-lean.js:101`) and a one-shot trim script (`mastery-preflip-normalize.js:218`).
- **Clients cannot write leans directly** (`firestore.rules:283`, `:332-335`).
- **No automatic path writes leans.** No debrief, reflection, consolidation, suggestion, cron or clone path does: clones inherit no leans, because `standingLeans` is absent from `trainingClone.js:59-84`.

**Conclusion.** By the code, these leans were set by an owner-authenticated request of the kind the player's Forge screen sends, not by an automatic path. The stored record alone cannot prove a human click. An owner-authenticated request from outside the UI would look the same. The equip event is also logged to the GCS shadow stream `signal_drops` (`equip-lean.js:262-273`, fire-and-forget). That stream is outside this experiment's read-only Firestore scope and was not read.

---

## 4. Results

### 4.1 Arm 1 — noise floor

300 ticks × 10 repeats on `claude-haiku-4-5-20251001`. All 3,000 returned.

| Measure | All (fine / coarse) | Original action (52) | Original hold (248) |
|---|---|---|---|
| **Mean agreement (modal share)** | **94.3%** / 94.9% | 86.9% / 89.6% | 95.9% / 96.0% |
| Unanimous ticks | 69.0% / 70.7% | 46.2% / 55.8% | 73.8% / 73.8% |
| Ticks with ≥ 2 distinct decisions | 31.0% / 29.3% | 53.8% / 44.2% | 26.2% / 26.2% |
| Per-call match with the original captured decision | 90.5% / 91.1% | 77.5% / 81.0% | 93.2% / 93.2% |
| Modal decision = original | 93.7% / 94.0% | 86.5% / 88.5% | 95.2% / 95.2% |
| **Split-half modal agreement (5 v 5)** | **97.1%** / 97.7% | 88.6% / 91.5% | 98.9% / 99.0% |
| Malformed rate | 2.6% | 3.1% | 2.5% |
| Action rate | 17.6% | 81.0% | 4.3% |

**Label: steady** (94.3% ≥ 90%).

By archetype (fine agreement): Trend Follower 94.5% (231 ticks) · Contrarian 93.9% (49) · Diversifier 93.0% (20).

The prompt calls split-half agreement "the ceiling for every comparison below". Splitting 10 repeats gives two halves of 5. That makes the figure a *lower* bound on how often two 10-repeat groups agree, so it bounds arm-2 noise conservatively.

### 4.2 Arm 2 — memory sensitivity

280 ticks with LEARNED content × 10 repeats per variant. All 8,400 returned.

- **T** is the mean total-variation distance between the baseline and variant fine-key distributions.
- **The null** is 2,000 within-tick label permutations, seeded.
- **p = 0.0005 = 1/2001** means no permutation reached the observed T.
- **Flip** means the variant's modal decision differs from the baseline's.

| Variant | T | Null mean | Null p95 | p | Flip rate | Null flip | **Excess flip** | **Label** |
|---|---|---|---|---|---|---|---|---|
| `strip` | 0.144 | 0.071 | 0.077 | 0.0005 | 10.4% (29/280) | 5.3% | **+5.0 pts** (5.04) | **moves decisions** |
| `swap` | 0.124 | 0.062 | 0.067 | 0.0005 | 10.4% (29/280) | 4.2% | **+6.1 pts** | **moves decisions** |
| `loadout` | 0.125 | 0.066 | 0.072 | 0.0005 | 10.0% (28/280) | 4.6% | **+5.4 pts** | **moves decisions** |

#### How to read the excess-flip column (review B1, B9)

The frozen excess flip is the observed flip minus the flip rate of the *permutation* null. That null pools each tick's baseline and variant draws. When the variant really differs, the pool is more mixed, so the null flip rate rises with the effect being measured. The differences between the three excess figures come from their nulls (5.3 / 4.2 / 4.6%), not from their raw flips, which are nearly equal (29 / 29 / 28 of 280).

Two descriptive figures put the raw flips in context. Neither sets a label:

| | `strip` | `swap` | `loadout` |
|---|---|---|---|
| Flip rate expected with **no** effect: two 10-draw groups from each tick's own baseline, parametric bootstrap | 1.9% | 1.9% | 1.9% |
| Raw flips beyond that no-effect floor | +8.5 pts | +8.5 pts | +8.1 pts |
| Excess flip under the **opposite** deterministic tie rule | +4.8 pts → *measurable but small* | +4.6 pts → *measurable but small* | +4.9 pts → *measurable but small* |

- **The tie rule.** The pre-declared rule breaks ties toward the lexically smallest key, which is in the code that ran. Under it, all three labels read **moves decisions**. Under the opposite rule, all three read **measurable but small**.
- **What is solid.** The labels of record follow the pre-declared rule; the bar was not moved. All three effects are real (p = 0.0005 on T under every variant, key and tie rule). They are of similar size: about one moment in ten changes its usual call, against roughly 2–3 in a hundred from noise alone. The arm-1 split-half disagreement of 2.9% is a conservative upper bound on that noise.
- **What is fragile.** Where each edit falls relative to the 5-point bar sits inside a tie-breaking detail, so this run does not rank the three edits.

| Variant | Action rate, baseline → variant | Malformed, baseline → variant | Coarse key (excess / label) |
|---|---|---|---|
| `strip` | 13.9% → **19.1%** | 2.6% → 2.7% | +4.6 pts / measurable but small |
| `swap` | 13.9% → **8.3%** | 2.6% → 2.5% | +5.8 pts / moves decisions |
| `loadout` | 13.9% → **10.4%** | 2.6% → 3.3% | +4.5 pts / measurable but small |

**Swap by donor pairing:**

| Pairing | Ticks | T | Excess flip | Label |
|---|---|---|---|---|
| `donor_same_archetype` (Trend Follower ↔ Trend Follower) | 178 | 0.128 | +6.2 pts | moves decisions |
| `donor_other_archetype` | 102 | 0.116 | +6.0 pts | moves decisions |

**By archetype** (descriptive, same test on each subset):

| Variant | Trend Follower (231) | Contrarian (49) |
|---|---|---|
| `strip` | +4.5 pts · measurable but small | +7.7 pts · moves decisions |
| `swap` | +6.6 pts · moves decisions | +3.8 pts · measurable but small |
| `loadout` | +4.7 pts · measurable but small | +8.6 pts · moves decisions |

**Key-of-record sensitivity:**

- **Production's validator** (the key of record): strip 5.04.
- **The stricter key**, which also fails replies whose `declarations` value is the wrong type: **strip 4.91 (measurable but small)**, swap 6.19, loadout 5.28. Every p is 0.0005 under both keys.

How the key of record was chosen:

1. The first analysis pass used the stricter key.
2. A malformed-reason tally then showed production never validates `declarations`.
3. The key was moved to production's semantics *before* recomputing.
4. Both passes are kept: `analysis.json` (of record), `analysis.first-pass-strict-key.json`, and `analysis.pre-review.json`.

**Edit sizes:**

| Variant | Requests | Mean chars removed | Mean chars added | Max removed | Max added |
|---|---|---|---|---|---|
| `strip` | 280 | 1,586 | 78 | 1,738 | 78 |
| `swap` | 280 | 1,586 | 1,591 | 1,738 | 1,738 |
| `loadout` | 280 | 3,132 | 0 | 4,441 | 0 |

**What the edits were checked against.**
- **At submit:** every edit was asserted to leave all bytes outside the message contents identical: system, the canned line, tools, tool_choice, model and sampling.
- **In this review:** the check now also confines changes *within* the edited message to the targeted span (review A4).
- **Same bytes either way.** The edits are built from the same slices, so the requests are byte-identical under both checks.

### 4.3 Arm 3 — model ladder (descriptive, no label)

| Model | Ticks × repeats | Modal agreement with production (fine / coarse) | Self-agreement | Action rate | Malformed | Mean input / output tokens | Cost per decision, standard prices |
|---|---|---|---|---|---|---|---|
| `claude-haiku-4-5-20251001` (production, arm 1) | 300 × 10 | — | 94.3% | 17.6% | 2.6% | 14,215 / 1,285 | **$0.0206** |
| `claude-haiku-5-5` | 300 × 5 | 82.0% / 82.7% | 99.3% | **2.1%** | 0.7% | 19,269 / 1,035 | **$0.0024** |

**Agreement split by production's own usual call** (review B4):

| Production's usual call | Ticks | Haiku 5.5 agrees (fine / coarse) |
|---|---|---|
| Hold | 242 | **100% / 100%** |
| Trade | 58 | **6.9% / 10.3%** (4 / 6 of 58) |

The overall 82% is the hold base rate.

**Haiku 5.5's thinking.** It reported 0 thinking tokens on all 1,500 calls: a forced tool call skips thinking.

Response diagnostics:
- Every response stopped on `tool_use` except 3 `max_tokens` stops: 1 in strip, 2 in swap.
- No cache tokens anywhere.

---

## 5. Field changes, skips, completeness, deviations

### Fields changed per arm

| Arm | Change |
|---|---|
| 1 | None. The request was sent as recorded, inside the batch envelope. No `stream`/`speed` was present, and `max_tokens` was kept as recorded (2048 on 28 sampled ticks). |
| 2 | Only the targeted spans in `messages[0].content` and/or `messages[2].content`. |
| 3 — Haiku 5.5 | `model` changed. **`temperature` removed.** The pilot returned HTTP 400 "`temperature` is deprecated for this model". |

**Comparability caveats for Haiku 5.5:**
- Its tokenizer reads the same prompt as about 1.36× the tokens.
- It thinks by default, but the forced tool call made it skip thinking.
- It runs at its default sampling instead of 0.4.

### SKIPPED

- **Claude Sonnet 5.5 and Claude Opus 5.5.** Both returned HTTP 400 `tool_choice: type "tool" and "any" are not supported for this model.` in the pilot. Changing `tool_choice` is not a sampling-parameter drop, so it is not sanctioned. **Founder ruling (checkpoint, 8 Oct): they stay out; the decision-form setting is not relaxed.** Both were listed by `GET /v1/models` (14 models) as `claude-sonnet-5-5` / `claude-opus-5-5`.
- **Arm 2 on the Diversifier.** Its 20 ticks have no LEARNED content.

### INCOMPLETE

None. Missing share was 0% in every arm: 12,900 of 12,900 succeeded, with 0 errored, canceled or expired. No retry batch was needed.

### Deviations from the prompt, and limits, stated

1. **Eligibility.** "Returned a parsed tool result" was read as `model.outcome = ok`, a schema-valid result. The 7 `invalid_tool_result` ticks are excluded and counted above.
2. **Decision key.** This is the production-validator key (§3 G5, §4.2). The stricter key is reported beside it.
3. **Pilot calls.** 7 billable calls plus 3 HTTP-400 rejections, which are not billed: 10 attempts in all.
4. **Budget estimate.** Caps were checked against the *larger* of two estimates:
   - one from the pilot's tokens, as the prompt asks ($107.51 planned / $165.74 worst);
   - one from the sample's captured token means ($119.17 / $171.18).
   - The Haiku 5.5 input estimate scaled production's tokens by the pilot's same-tick tokenizer ratio.
5. **Batch size.** Batches were capped at about 40 MB per upload, inside the prompt's 100 MB / 10,000-request bound: 14 batches of 651–1,010 requests.
6. **Modal ties** are broken by the lexically smallest key, identically in the observed statistic and in every permutation. §4.2 reports the sensitivity to the opposite rule.
7. **Donor choice.** The donor agent is chosen uniformly among eligible agents (same archetype first), then the donor tick uniformly among that agent's ticks. Seeded.
8. **The corpus walk** covered battles alive on or after 2026-09-01. Capture began 2026-09-21, so the walk is complete.
9. **There is no transport ceiling** (review A6). Production gives each call 20 s and falls back to HOLD on a timeout (`agent-evaluate.js:2893`). 60 of 508 dispatched production calls timed out. Batch replies have no ceiling, so a reply production would have discarded counts here as a decision. This applies to every arm alike.
10. **Each condition ran in its own batches** (review B8). Tasks were submitted in condition order: baseline, strip, swap, loadout, ladder. A batch-level difference would therefore look like an edit effect. This run cannot rule one out, though all 14 batches ran on the same model within 17 minutes.
    - The script now interleaves conditions across batches for any future run.
    - An A/A replicate (the baseline re-run in its own batches, about $31) would close this. It is offered, not done.
11. **Post-run code changes:**
    - SHA-256 moved to the one-shot `crypto.hash()`; digests are identical, checked.
    - Analysis-only additions: response diagnostics, per-archetype tests, the dual key, the no-effect floor, the tie-rule sensitivity, and the production-call split.
    - All review fixes (§9).
    - The frozen measures of the run are identical before and after; checked.

---

## 6. Spend

| | USD |
|---|---|
| Planned (cap basis) / worst case | $119.17 / $171.18 (caps $150 / $185) |
| **Actual, from `usage` at batch prices** | **$116.23** |
| — baseline | $30.96 |
| — strip | $28.35 |
| — swap | $28.61 |
| — loadout | $26.48 |
| — Haiku 5.5 | $1.83 |
| Pilot (synchronous, standard prices) | $0.11 |
| **Total** | **$116.34** |

Timing:
- 14 batches were created 18:29:50Z–18:31:02Z on 8 Oct 2026, well before the 2026-10-10T23:00Z deadline.
- All ended by 18:46Z.
- Results were saved, line counts verified, and all 14 batches deleted on Anthropic's side.

---

## 7. Read-only proof and selftest

**Firestore writes.** Grep over `scripts/experiments/growth-replay/growthReplay.js` at the final commit for any write call:

```
grep -nE "\.(set|update|delete|add|create)[[:space:]]*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete"
→ no matches (exit 1)
```

**Firestore methods used:** `.collection(` ×5, `.doc(` ×3, `.get(` ×4 (one is `Headers.get`), `.getAll(` ×1, `.select(` ×2.

**AST scanner.** The repo's protected-store scanner sees 0 write sites in the file (`compositionProtectedStores.scan.test.js` passes; §9).

**Imports:**
- Node built-ins, plus `firebase-admin/app` and `firebase-admin/firestore`, loaded dynamically.
- **No module under `api/` or `src/` is imported.** Fenced functions called: none. Fenced files edited: none.

**Model calls:**
- Plain `fetch`, to `api.anthropic.com` only; the origin is asserted before the key is sent.
- The one `'DELETE'` in the file is the Anthropic batch cleanup: `DELETE /v1/messages/batches/{id}`.
- No product handler is called, so no capture record, cron state or battle document was written.

**Selftest** (seeded; it gates `analyze`). It is strengthened in review B2. The synthetic arm-2 cases:

| Case | T | Null mean | p | Excess flip | Label |
|---|---|---|---|---|---|
| Pure noise | 0.133 | 0.134 | 0.535 | +0.4 pts | **no measurable effect** ✓ |
| Planted shift in 30% of ticks | 0.357 | 0.155 | 0.0005 | +9.9 pts | **moves decisions** ✓ |
| Small consistent shift (90/10 → 70/30) | 0.209 | 0.137 | 0.0005 | +3.2 pts | **measurable but small** ✓ |

Calibration: 0 of 20 fresh noise datasets crossed p < 0.05. The gate requires 3 or fewer; for a calibrated test, P(≥ 4) is about 1.6%.

There are 21 known-answer rows, all passing:
- **TV distance:** 4 rows.
- **Ties and shuffle:** the modal tie rule, and shuffle uniformity.
- **Exact permutation nulls**, from hypergeometric reasoning:
  - one separated tick (observed T, null mean, null flip, 95th percentile);
  - unequal group sizes;
  - the within-tick-only null.
- **Bars and split-half:** both frozen bars at their exact boundaries; split-half exact answers.
- **Sampler:** the cap lifting only to 60, the hold-first balance, and the cap kept under a reduction.
- **Donors:** never the same agent or the same text.
- **Budget:** worst case at `max_tokens`, and the cut order.

**PASS.** The mutation check is in §9.

**Lint:** `npx eslint scripts/experiments/growth-replay/growthReplay.js` passes clean, and so does the CI lint gate config. The full test suite was not run (prompt rule 9; Linux CI is the suite of record).

---

## 8. Fixed caveats

- "This measures whether decisions change, not whether they improve."
- "Only the model's proposed decision is compared. Guardrails, the risk manager and the executor were not run."
- "The Voice Layer was not tested. Learning may affect what the agent says more than what it does."
- "The corpus is founder and tester play from a pre-launch product."
- "This is not qualification evidence under the Agent Learning Charter or pilot spec P7."

**Further limits of this run, stated as facts:**

- **Thin learning.** The learned material is three paragraphs: two Trend Follower versions and one Contrarian. They are spread across six agents, mostly clones. "Learning" here means *these three texts*, not agent growth in general.
- **Trend Follower dominates.** 231 of the 280 arm-2 ticks are Trend Follower; the Contrarian subset has 49.
- **Learning upstream of this call was not stripped.** Learning can also act through two paths that were left as captured:
  - the draft that built this battle's portfolio and brief, because the draft prompt carries the wisdom;
  - the last three decisions' rationale excerpts, which were written with the wisdom in context.
- **Rule-shaped news was left in place.** The loadout strip removed the rules and leans sections. The MIXED news block was left as captured: on 41 arm-2 ticks it still ranks stories against the rules, and on 19 it quotes them. The rule-gated institutional block (0 ticks) was also left.
- **Leans are one agent.** Every lean in the sample belongs to that single agent (§3).
- **Production timeouts are not mirrored, and no A/A batch replicate was run** (§5, items 9–10).
- **The labels sit near the bar.** All three arm-2 labels fall within a tie-breaking detail of the frozen 5-point bar (§4.2). Read them as "real, and of similar size", not as a ranking.

---

## 9. BUILD_RULES §2 review record

**Why a review was required.** The cumulative branch diff is 4 files and about 2,600 lines, over the 1,500-line threshold.

**How it was run:**
- **Lenses.** Three independent reviewers, each on its own LF `git archive` snapshot of `7010a1df` and read-only on git and on the shared tree:
  - **A**, replay fidelity: section spans, edits, decision key, citations;
  - **B**, statistics, sampling and analysis, including a mutation run;
  - **C**, safety, spend, batch lifecycle and repo integration.
- **Verification.** Every finding then went to a separate verifier, on its own snapshot, instructed to **refute** it with a concrete repro.

**Result:** 32 verdict rows (C12 was split into two halves): **31 CONFIRMED, 1 REFUTED**. Severities are after verification.

| ID | Finding | Verdict | Disposition |
|---|---|---|---|
| A1 | The news block quotes equipped rules: MIXED, misclassified as MARKET | CONFIRMED, medium | Report: reclassified MIXED, loadout caveat with counts (§3, §8). The code leaves MIXED untouched, as the prompt requires. |
| A2 | `parseIdentity` can mis-locate the LEARNED span (insight containing the rules header, no rules equipped) | CONFIRMED, low, latent | Fixed: `plan` excludes ticks whose parsed sections disagree with the battle's snapshot. 0 such ticks in this run. |
| A3 | `findLeans` can mis-locate the leans span (directive text containing a whole fake block) | CONFIRMED, low, latent | Fixed: same guard. |
| A4 | `assertOnlySpansMoved` could not see changes inside the message contents | CONFIRMED, low | Fixed: the changed region must lie inside the targeted span. Pilot and submit call it. |
| A5 | The schema-equality claim had no reproducible path | CONFIRMED, low | Report: reproducible command in the appendix (300 / 300). |
| A6 | Production's 20 s timeout is not mirrored | CONFIRMED, low | Report: caveat (§5 item 9). |
| A7 | Block lookup differed from production (first named vs first `tool_use`) | CONFIRMED, low, unreachable | Fixed: production's lookup. Results identical. |
| A8 | "Written only by the consolidation writer" was wrong | CONFIRMED, low | Report corrected. None of the 3 texts is the seed fixture (checked). |
| A9 | `YOUR LAST 3 DECISIONS` is an upstream learning path | CONFIRMED, low | Report: noted (§3, §8). |
| B1 | The excess-flip null grows with the effect; "only just" and the ranking are unsupported | CONFIRMED, medium | Report reframed: raw flips, no-effect floor, tie-rule sensitivity, no ranking. Analysis adds them. Frozen labels unchanged. |
| B2 | The selftest could not fail under many defects in the statistic | CONFIRMED, low | Fixed: 21 known-answer rows, three synthetic cases, false-positive gate. Mutation check below. |
| B3 | Split-half shown as 97.2%, but it is 97.1%; and it is a lower bound | CONFIRMED, low | Report fixed (§4.1). |
| B4 | Arm-3 82% agreement is the hold base rate | CONFIRMED, low | Analysis adds the split by production call; report states it (§1, §4.3). |
| B5 | `reduceSample` could break the 15% cap after a budget cut | CONFIRMED, low, latent | Fixed: a seeded redraw under the cap at the smaller N. |
| B6 | `drawSample`'s greedy balance could miss a feasible 50/50 | CONFIRMED, low, latent | Fixed: actions-first and holds-first; the more balanced wins, and a tie keeps the original. This run's sample is unchanged. |
| B7 | The literal cut order never restores N after dropping Opus | CONFIRMED, low, latent | Kept: the prompt's literal order. A founder call for a future prompt. Moot here (no Opus). |
| B8 | Each condition ran in its own batches | CONFIRMED, low | Fixed for future runs (seeded interleave). This run disclosed (§5 item 10). A/A replicate offered. |
| B9 | The strip label sits inside the tie-rule sensitivity | CONFIRMED, low | Analysis adds the opposite-rule figures: **all three** variants read "measurable but small" under it. Report says so. |
| B10 | INCOMPLETE gated no label | CONFIRMED, low, latent | Fixed: `INCOMPLETE (…)` on labels (same fix as C8). |
| C1 | A lost create response could orphan a batch and bill the chunk twice on rerun | CONFIRMED, medium | Fixed: the intent is written before every POST; `submit`/`collect` reconcile through the batch list. Stub-tested. |
| C2 | `pilot --force` under existing batches remapped custom ids; submit trusted the stored cost | CONFIRMED, low | Fixed: pilot refuses once batches exist; submit recomputes cost from tasks at current prices plus pilot spend; pilot spend accumulates. |
| C3 | No run lock; `status` rewrote a stale manifest; shared temp file | CONFIRMED, low | Fixed: an exclusive run lock for pilot/submit/collect; `status` is read-only; per-process temp file. Stub-tested. |
| C4 | Secrets could reach stderr (double-encoded credential path error; key with an interior newline; JSON parse echo) | CONFIRMED, low | Fixed: fixed-message credential parsing, a strict key format, and redaction of all printed errors. Tested with fake secrets: nothing echoed. |
| C5 | The retry batch was not chunked; the 100 MB limit was in MiB; no final body-size assert | CONFIRMED, nit | Fixed. |
| C6 | A spend-limit result blocked collecting and deleting later batches | CONFIRMED, low | Fixed: it blocks new spend only. Stub-tested (saved, deleted, exit 3, no retry). |
| C7 | A failed DELETE was never retried | CONFIRMED, low | Fixed: retried on every collect. Stub-tested. |
| C8 | INCOMPLETE was not on the labels | CONFIRMED, nit | Fixed (with B10). |
| C9 | The pilot record was only written at the end; a transient error marked a model "rejected" | CONFIRMED, low | Fixed: progress is written after every call; a transient error is retried once, then marked *unavailable*. |
| C10 | The manifest could not prove which code ran | CONFIRMED, low | Fixed: a per-command log with the script's SHA-256. Report states which code ran (§2). |
| C11 | Credential precedence was per key, not per credential | CONFIRMED, nit | Fixed: the credential is chosen whole, from the highest-priority source. |
| C12a | `results_url` received the key without an origin check | **REFUTED**: the URL comes from the TLS-authenticated API response, and the official SDK does the same | The origin check, added before the verdict, is kept as harmless hardening. |
| C12b | `plan` advanced `latest.txt` before its gate | CONFIRMED, nit | Fixed: only a run that passes its gate becomes the default. |

**Mutation check of the strengthened selftest** (run last, on its own scratch copy):
- One defect was injected at a time, and the selftest was rerun.
- **32 of 33 mutants killed.**
  - Inequality flips and bar moves.
  - The `+1` correction.
  - An unshuffled or cross-tick null.
  - The excess ignoring, or halving, the null.
  - Three wrong TV definitions, and a cyclic-only (Sattolo) shuffle.
  - Anti-conservative p, a wrong p95 index, and a null mean that reports T.
  - The arm-1 bars and their boundaries.
  - Split-half against itself or unshuffled.
  - The cap removed, balance removed, and a cap-blind reduction.
  - A self-donor, the wrong first cut, and a worst case without `max_tokens`.
- **The survivor** swaps the two groups' sizes in the permutation. TV distance and modal flips are symmetric in group order, so that mutant is *equivalent*: it changes no output.

**Offline lifecycle tests** of the fixed `submit` / `status` / `collect` / `pilot` paths:
- They ran against a stubbed `fetch`, with a fake key and a fake home directory. No network was used.
- They covered:
  - a lost create response, then reconciliation by adoption, with no resend;
  - `status` leaving the manifest byte-identical;
  - a failed DELETE retried on the next collect;
  - `pilot --force` refused once batches exist;
  - a held lock refused;
  - `analyze` on the stub results;
  - a spend-limit result: results saved, batch deleted, exit 3, no retry batch;
  - no lock left behind.

**Builds and scanners:**
- `vite build` passes on the LF `git archive` of the pushed head (see the PR).
- The protected-store AST scan, writer census and runbook gates — the three repo tests that walk `scripts/` — pass: 3 files, 31 tests.
- ESLint, and the CI lint gate, report 0 errors and 0 warnings.

---

## Appendix — files and re-checks

- **Committed:**
  - `scripts/experiments/growth-replay/growthReplay.js` (subcommands `plan | pilot | submit --go | status [--wait] | collect | analyze | selftest`)
  - `scripts/experiments/growth-replay/README.md`
  - this report
  - its row in `docs/README.md`
- **Run folder, outside git:** `%USERPROFILE%/growth-replay-runs/gr-20261008T181724/`. Contents: `manifest.json`, `source-requests.jsonl`, `donor-learned-texts.json`, `pilot-responses.jsonl`, `requests/`, `results/`, `analysis.json` (of record), `analysis.pre-review.json`, `analysis.first-pass-strict-key.json`, `GROWTH_REPLAY_REPORT.md` (a copy of this report) and `GROWTH_REPLAY_EXHIBITS.local.md`. **The exhibits file contains player text and is never committed.**
- **Re-check of the G5 schema equality** (A5). From the repo root, with the run folder present, this prints the counts. It reads the run's own source requests; the schema module it imports has no imports of its own.

  ```
  node --input-type=module -e "import{readFileSync}from'node:fs';import{TRADE_DECISION_TOOL as T}from'./api/_utils/agentEvalToolSchema.js';const sh=s=>JSON.stringify({r:s.required,p:Object.fromEntries(Object.entries(s.properties).sort().map(([k,v])=>[k,[v.type,v.enum??null,v.minimum??null,v.maximum??null]]))});const c={};for(const l of readFileSync(process.env.USERPROFILE+'/growth-replay-runs/gr-20261008T181724/source-requests.jsonl','utf8').split('\n')){if(!l.trim())continue;const s=JSON.parse(l).request.tools[0].input_schema;const{declarations:d,...p}=s.properties;const k='decl='+!!d+' equal='+(sh({...s,properties:p})===sh(T.input_schema));c[k]=(c[k]||0)+1;}console.log(c)"
  ```
  This session's result: `decl=true equal=true: 193`, `decl=false equal=true: 107`.
