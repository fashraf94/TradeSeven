# Experiment — Archetype Input Ablation + Gate Intervention Census

**Date:** 13 Oct 2026 · **Prompt:** Fable, "Experiment prompt — Archetype Input Ablation + Gate Intervention Census", 13 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Base HEAD:** `433a19a4ef2fdc804c002f755ca2ef3686e18a18` (= `origin/main` after `git fetch origin` at session start; `main` has since moved to `abe6870d`, #956, which touches none of this branch's paths) · **Branch:** local `claude/experiment-archetype-ablation-f286eb` (the app's suffix), pushed as `claude/experiment-archetype-ablation`, not merged, no PR · **Script:** `scripts/experiments/archetypeAblationReplay.mjs` · **Exhibits (local only, carries player text):** `C:\Users\fashr\ft-experiment-exhibits\20261013_archetype_ablation_exhibits.md` · **Run folder (local only):** `C:\Users\fashr\ft-experiment-exhibits\archetype-ablation-run\`

Every `file:line` below was read at `433a19a4` in this session (VERIFIED) unless it is marked INFERRED. Counts come from the run folder (`census.json`, `analysis.json`), produced by the committed script. The test suite was not run (prompt §1).

---

## §0 Gate results, HEAD, and corrections to the prompt

### Position (0.1)

| Fact | Value |
|---|---|
| `main` HEAD at start | `433a19a4` = `origin/main` after fetch; tree clean |
| Experiment branch | local `claude/experiment-archetype-ablation-f286eb`, pushed by refspec as `claude/experiment-archetype-ablation` |
| `TICK_CAPTURE_ENABLED` | `true` — `src/config/featureFlags.js:2717` |
| Capture window | first record 2026-09-22 14:46 UTC → last 2026-10-13 19:46 UTC (15 trading days with records) |

### Step 0 gates

| Gate (prompt §3) | Result |
|---|---|
| Records with a complete body exist | **PASS.** 551 woken checks carry a complete body; 528 of them are eligible (model returned a valid decision, request parses, the response agrees with the record). |
| ≥ 20 woken records per archetype | **PASS for 3, unmeasurable for 3.** Trend Follower 486 woken, Contrarian 98, Diversifier 39. Speculator, Capital Preserver and Fundamental Investor: **0 woken records** (they exist only as CPU opponents; see correction 1). |
| The request can be reconstructed for replay | **PASS — verbatim resend.** 528 of 528 stored requests re-serialize byte-identically; all carry the production model, temperature and tool schema (0.6 below). |

### Corrections to the prompt's assumptions

| # | The prompt assumed | Code and records say | Effect here |
|---|---|---|---|
| 1 | Six archetypes to measure | Speculator (`degen`), Capital Preserver (`guardian`) and Fundamental Investor (`analyst`) appear only in CPU battles, and a CPU battle never calls the model: `battle.isCpu === true` → scores marked, exit `cpu_passive`, return (`api/cron/agent-evaluate.js:1317-1345`). 1,039 CPU checks for those three, 0 woken. | Unmeasurable in Part A and Part B. |
| 2 | Archetype and player are separate axes | **Each measurable archetype is exactly one owner and one agent line.** Trend Follower = owner-A (all 692 records), Contrarian = owner-H (142), Diversifier = owner-R (41). Each also carries its own rule set: TF 15 soft rules + standing leans on 153 checks; Contrarian 40 soft rules; Diversifier 5 hard rules, no soft rules, no learned text. | Every *within-record* arm comparison is clean. Every *cross-archetype* comparison is also a cross-owner, cross-agent, cross-rule-set comparison (§6). |
| 3 | Owner classes: human player / FT_QA tester / CPU | CPU is on the battle (`isCpu`). Nothing on a tick, battle or body record says which account is FT_QA. All three non-CPU owners are labelled **non-CPU**. INFERRED from the Practice Field census (`docs/audits/20261010_PHASE0_PRACTICE_FIELD_DISCOVERY.md:105, :112`): its 89 non-allowlisted Contrarian moments are this Contrarian owner, so owner-H is the third human; the two allowlisted accounts (founder, FT_QA) are owner-A (Trend Follower) and owner-R (Diversifier), in an order the records cannot tell. | The human-only table is the pooled table minus one archetype's row (§4). **Flash: which of owner-A / owner-R is FT_QA?** One line fixes it; `analyze --ftqa owner-X` recomputes. |
| 4 | The record carries the archetype | It does not. Join: the battle's frozen `agentContext.archetype` (`agent-evaluate.js:1024`, passed to the prompt builder at `:2823`). | Joined per battle; 0 records unjoined. |
| 5 | Decision fields include `swap_type` on the record | The permanent record keeps `decision.original / final / originalSymbolOut / originalSymbolIn / finalSymbolOut / finalSymbolIn / holdKind / downgraded / replacedByDeterministic` (`api/_utils/tickCapture/captureWriter.js:257-275`). `swap_type` lives only in the TTL body's `originalToolResult` (`captureWriter.js:194`, copied before any deterministic replacement at `agent-evaluate.js:2957-2959`). | Decision tuple = action + symbols from the record, `swap_type` from the body. |
| 6 | "Woken" discriminator | `model.dispatched === true`, set in the `finally` around the call (`agent-evaluate.js:2914-2918`). Skips before the call: `budget_skipped` (`:2759-2782`), `refresh_failed` (`:2745-2758`), the early exits of `captureConfig.js:112-121`. Model failures after dispatch fail closed to HOLD with `holdKind: 'default_failure'` (`agent-evaluate.js:4181`). | 0 `budget_skipped` and 0 `refresh_failed` in the window. |
| 7 | Body states complete / write_failed / expired | The permanent record says `written / truncated / copy_failed / skipped` (`captureWriter.js:409-420`). `write_failed` is a return value, never a document (`captureWriter.js:559-566`), so it can only show as a gap in `cronState.tickSeq`. Bodies expire 120 days after capture (`captureConfig.js:100`). | **0 gaps** (2,823 minted, 2,823 documents). **0 expired** (earliest expiry 2027-01-20). The 72 incomplete bodies are all `copy_failed`, and all 72 are model timeouts (the response never arrived). |
| 8 | Part B causes `fired_replaced / fired_slot_empty / mode_blocked` | None of these is on the record. The record carries `checks.{lock, distressedVeto, proposedPairValidation, conviction, hurdle, swapCap, reservation, execution}.{status, result, reason}` (`captureConfig.js:174-183`, written at `agent-evaluate.js:3452-3740`), `guardrail.{faultClass, overrideCount, sourceNote, evaluated}` (`captureWriter.js:238-246`), `decision.replacedByDeterministic` (`agent-evaluate.js:3366-3368`) and `actions[].{source, exitReason}`. `checks.conviction` is always `unknown` (`agent-evaluate.js:3500-3507`): the fenced validator returns no per-rule verdict, so the sub-cause of a pair-validation block is read from the body's `validationErrors`, which are that validator's own strings (`api/_utils/agentSwapExecution.js:31-90`). | Causes are reported in the record's own vocabulary (§5). |
| 9 | Bench technicals = RSI / MACD / RVOL; held positions get none | The only bench technicals are the `BENCH TECHNICAL CONTEXT:` block (`api/_utils/agentEvalPromptAssembly.js:1171-1177`, `:1535-1586`), which also carries trend, BB %B, ATR regime, relative strength, levels, candle pattern and composite score. Held positions get no RSI/MACD/RVOL, but do get VWAP, BB width, NR7 and range (`INTRADAY MOMENTUM SNAPSHOT`, `:1826-1863`) and, with `PROFIT_TARGET_EXECUTOR_ENABLED = true` (`featureFlags.js:1984`), LockNow / NextBonus / Levels cells (`:1464-1483`). | **A2 removes the whole block** — wider than the three named indicators. Symbols and prices stay in the BENCH table. |
| 10 | Stories have an empty-state text | They do not. With no stories nothing is pushed (`agentEvalPromptAssembly.js:1258`). Every eligible request has Forge rules, so only the rule-aware form occurs (`:1259-1270`; `api/_utils/agentNewsContext.js:207-284`); the bare form, 0. | **A1 removes the block and its separator.** Applicable only where stories were present: 79 of 528. |
| 11 | Soft preferences include a "cautious register" | The soft layer in the Trading Brain prompt is the `== STRATEGY PREFERENCES (should follow) ==` lines (`agentEvalPromptAssembly.js:809-814`) plus the `STANDING LEANS` block (`api/_utils/controlPromptRenderer.js:231-239`). The cautious register exists only in the Voice Layer prompt (`api/_utils/voiceLayerPrompt.js:2763-2769, :2787-2790`). | A3 = S-lines + leans. The cautious register does not reach the Trading Brain. |
| 12 | Learned text = lessons, wisdom, dossier | Only the wisdom paragraph reaches (`agentEvalPromptAssembly.js:774-780`). Lessons reach only by being consolidated into it; no dossier exists. Corpus probe: "LESSON"/"DOSSIER" 0 of 528; the word "memory" occurs 101 times, always inside the wisdom or brief text, never as a section. | A4 applicable (Trend Follower, Contrarian). The Diversifier is a fresh agent (no wisdom) → A4 n/a. |
| 13 | Voice-layer / market context may reach the prompt | It does not. The Voice Layer's market context ("TODAY'S MARKET CONTEXT (from the Daily Regime Brief)", `voiceLayerPrompt.js:2050`): 0 of 528. The Trading Brain has its own evaluator-computed `MACRO BENCHMARKS` and `REGIME CONTEXT` (`agentEvalPromptAssembly.js:1133-1153`), present in all 528; no arm targets them. | **A5: not applicable — the voice-layer market context does not reach the Trading Brain at HEAD.** |
| 14 | Hard-constraint rules (risk / allocation) are in every prompt | Hard = category `risk` or `allocation` (`api/_utils/ruleHardness.js:23`), rendered as `== CONSTRAINTS (must obey) ==` (`agentEvalPromptAssembly.js:803-808`). **Only the Diversifier's prompts carry any** (24 of 528: 1 risk + 4 allocation lines). Trend Follower and Contrarian prompts carry none. | A7 applies to the Diversifier only. |
| 15 | Intraday lines are logged, not sent | `INTRADAY_DIAGNOSTIC_ENABLED = false` (`featureFlags.js:2630`) and `INTRADAY_AGENT_USE_ENABLED = false` (`:2641`): at HEAD the intraday diagnostic is **neither logged nor sent**. (The `INTRADAY MOMENTUM SNAPSHOT` above is an older, different block, and it is sent.) | No intraday arm. |
| 16 | The charter is one section | The charter render sits in the system prompt under `━━━ ARCHETYPE IDENTITY ━━━` (`agentEvalPromptAssembly.js:340-346`; `api/_utils/evalIdentityBlocks.js:190-199`; `EVAL_IDENTITY_BLOCK_ENABLED = true`, `featureFlags.js:1642`). All 528 captured renders are byte-equal to the code constants (`evalIdentityBlocks.js:99-143`) with the flag-off clause (`EQUIPPED_RULE_PRECEDENCE_ENABLED = false`, `featureFlags.js:2104`). But the archetype is **also named** in the preamble ("Your archetype is Momentum chaser.", `:345` / `:550`) and in `ABOUT YOU: Archetype:` (`:754`). | A6 swaps the render only, as written. A secondary arm **A6n** also swaps the two names, and carries no bar. |
| 17 | Re-assembly might be possible (0.6) | The capture stores the request body, not the assembler's inputs, and the assembler is not pure: it reads the clock (`agentEvalPromptAssembly.js:1127-1130`, `:1293-1364`) and Firestore (`:891-934`). | **Ablation by textual removal at the assembler's own markers.** Every edited request was verified: every byte outside the targeted spans is identical (`verifyEdit`); 5 records per arm are shown in the exhibits. |
| 18 | Step 1 sampling | Read as written: more than 59 available → up to 60, ≤ 6 per battle; **20–59 available → take all.** Contrarian: 89 in 6 battles → 36. Diversifier: 24 in 3 battles → all 24. The recency preference uses the 15 most recent NYSE sessions, 23 Sep – 13 Oct (22 Sep falls to the second tier). | Had the 6-per-battle cap applied to the Diversifier, it would have 16 records, no bars, and the only A7 measurement would disappear. |
| 19 | Directive gate records | Statuses on `chatExchanges[].archetypeGate.status`: committed / no_change / no_proposal / invalid_id / fit_mismatch / no_archetype (`api/_utils/directiveGate.js:139-180, :251-300`; `src/constants/filmTape.js:65`). `fit_mismatch` is 0 by construction (`DIRECTIVE_FIT_CHECK_ENABLED = false`, `featureFlags.js:887`). Directives filed through the Cockpit call route carry no gate record by construction: `api/agent/call-response.js:111-125` writes its own exchange (`source: 'cockpit'`) and never calls the chat gate (`api/agent/chat.js:868-890`). | §5 directive table. |
| 20 | The model is a current Haiku | `claude-haiku-4-5-20251001` (`api/_utils/agentEvalTransport.js:48`), temperature 0.4, `max_tokens` 3072 (2048 on 43 records captured before the raise). | Replayed on the same model. Batch prices $0.50 / $2.50 per million tokens. |

### 0.6 Reproducibility, five records and then all

| Check | Result (528 eligible) |
|---|---|
| Stored body re-serializes byte-identically (`JSON.stringify(JSON.parse(body)) === body`) | 528 / 528 |
| SHA-256 of the stored body = the record's `requestSha256` | 528 / 528 (checked at census) |
| Keys = `model, max_tokens, temperature, system, messages, tools, tool_choice`; system + 3 messages (user / canned assistant / user); one forced tool | 528 / 528 |
| Model | `claude-haiku-4-5-20251001` × 528; matches the record's `callEnvelope.requestedModel` 528 / 528 |
| Temperature | 0.4 × 528; matches the record 528 / 528 |
| Tool schema | 3 distinct schemas (the declarations off / shadow / on variants), each resent as captured |

Decision of record for a replay reply: the first `tool_use` block (`agent-evaluate.js:2944`), judged by **production's own** `validateTradeToolResult` (`api/_utils/agentEvalToolResultValidation.js`, imported, not copied). A reply production would fail closed is "malformed".

---

## §1 In plain terms

| Archetype | Q1 — is the archetype in the thinking? | Q2 — how often do the deterministic layers overrule it? |
|---|---|---|
| Trend Follower | No: removing its learned paragraph, its 15 soft rules and leans, or its bench technicals, or swapping in the Contrarian charter, changed no more of its 60 decisions than simply asking again (stories rest on 12 records). | 19 of 433 woken checks (4%): 12 of its 33 proposed swaps were stopped because it tried to sell BTC for a stock, 7 by the hurdle floor. |
| Contrarian | Its learned paragraph is load-bearing (7 of 36 calls changed, mostly holds turning into trades, against 2 of 36 on a plain resend); its charter and soft rules are not. | 1 of 94 woken checks (1%): one swap stopped by the hurdle floor. |
| Diversifier | Its charter and its hard-constraint text are not load-bearing; removing its news passed the bar, but on 12 records and not robustly (§4). | 14 of 24 woken checks (58%, **flagged**): every one is the model trying to sell its BTC slot for a stock, a rule its prompt never states. |
| Speculator | Unmeasurable: it plays only as a CPU opponent, and CPU battles never call the model. | Unmeasurable (0 woken checks). |
| Capital Preserver | Unmeasurable, same reason. | Unmeasurable (0 woken checks). |
| Fundamental Investor | Unmeasurable, same reason. | Unmeasurable (0 woken checks). |

**The clearest thing the data says:** for the three archetypes that can be measured, swapping the archetype charter never moved decisions past the bar — the identity lives in the rules, the agent's own learned paragraph and the gates, not in the charter text — and the gate that overrules the model most is a stock-vs-crypto rule the model is never told.

---

## §2 Corpus census (0.4)

Walk: 585 `agentBattles` documents; the 124 alive on or after 2026-09-15 were read; 113 hold tick records. 2,823 tick records, 623 woken.

### 2.1 Records by archetype × owner class × woken × body

| Archetype | Owner class | Not woken | Woken, body complete | Woken, body incomplete (`copy_failed`) | Total |
|---|---|---:|---:|---:|---:|
| Trend Follower | non-CPU (owner-A) | 206 | 433 | 53 | 692 |
| Trend Follower | CPU | 260 | 0 | 0 | 260 |
| Contrarian | non-CPU (owner-H) | 44 | 94 | 4 | 142 |
| Contrarian | CPU | 259 | 0 | 0 | 259 |
| Diversifier | non-CPU (owner-R) | 2 | 24 | 15 | 41 |
| Diversifier | CPU | 390 | 0 | 0 | 390 |
| Speculator | CPU | 390 | 0 | 0 | 390 |
| Capital Preserver | CPU | 260 | 0 | 0 | 260 |
| Fundamental Investor | CPU | 389 | 0 | 0 | 389 |

FT_QA cannot be separated from the founder on the record (§0 correction 3). 15 CPU owners, 3 non-CPU owners.

### 2.2 Why a check did not wake the model

| Archetype | `cpu_passive` | `gameplan_pending` | `gameplan_created` | `no_trigger` |
|---|---:|---:|---:|---:|
| Trend Follower | 260 | 167 | 28 | 11 |
| Contrarian | 259 | 37 | 6 | 1 |
| Diversifier | 390 | 0 | 2 | 0 |
| Speculator | 390 | 0 | 0 | 0 |
| Capital Preserver | 260 | 0 | 0 | 0 |
| Fundamental Investor | 389 | 0 | 0 | 0 |

### 2.3 Woken checks by model outcome

| Archetype | Woken | ok | timeout | HTTP 400 | `invalid_tool_result` |
|---|---:|---:|---:|---:|---:|
| Trend Follower | 486 | 415 | 53 | 10 | 8 |
| Contrarian | 98 | 89 | 4 | 5 | 0 |
| Diversifier | 39 | 24 | 15 | 0 | 0 |

### 2.4 The Part A sample (Step 1)

| Archetype | Eligible (battles) | Drawn (battles) | Captured HOLD / SWAP | Bars |
|---|---:|---:|---|---|
| Trend Follower | 415 (29) | 60 (28) | 56 / 4 | apply |
| Contrarian | 89 (6) | 36 (6) | 33 / 3 | apply |
| Diversifier | 24 (3) | 24 (3) — take all | 9 / 15 | apply |
| Speculator · Capital Preserver · Fundamental Investor | 0 | 0 | — | skipped — no records |

Seed `20261013`. All drawn records fall inside the 15-session recency window. Sample ids are in the exhibits.

---

## §3 Prompt section map (0.3) and arm applicability

The Trading Brain request is `system` + three messages: the identity block, a canned assistant line, the live context (`agent-evaluate.js:2885-2902`; built at `:2822-2830`). Parts within a block are joined by a blank line (`agentEvalPromptAssembly.js:838`, `:1285`). Presence is counted over the 528 eligible requests.

| Section (literal marker) | Where | Input it renders | Varies per check? | Present | Arm |
|---|---|---|---|---:|---|
| Preamble "You are …, Your archetype is …" | system `:345` / `:550` | agent name, display-cased archetype | per battle | 528 | A6n (name) |
| `━━━ ARCHETYPE IDENTITY ━━━` + render + subordination clause | system `:346`; `evalIdentityBlocks.js:190-199` | **archetype charter** | per archetype | 528 | **A6**, A6n |
| `SCORING RULES`, `DECISION FRAMEWORK` (incl. "8. CONVICTION THRESHOLD … below 70% … MUST output HOLD"), `INTRADAY MOMENTUM SIGNALS`, `REGIME-AWARE STRATEGY` (incl. distressed exclusion), `RISK STATUS` guidance, `FORGE RULES` guidance, `DECISION PRECEDENCE`, `ANTI-THRASH`, `SURVIVAL MODE`, anticipation, `INNER MONOLOGUE FORMAT` | system `:347-533` | platform instructions (static) | no (variant by game mode) | 528 | none |
| `ABOUT YOU:` (name, `Archetype:`, risk tolerance, interval) | m0 `:752-756` | agent profile | per battle | 528 | A6n (name) |
| `YOUR STRATEGIC BRIEF`, `YOUR INITIAL PORTFOLIO RATIONALE` | m0 `:759-772` | this battle's draft call | per battle | 528 / 139 | none |
| `YOUR STRATEGIC WISDOM (learned …)` / fresh-agent line | m0 `:774-780` | **learned text** (`consolidatedInsight`) | per battle | 504 / 24 | **A4** |
| `YOUR FORGE RULES:` → `== CONSTRAINTS (must obey) ==` | m0 `:803-808` | **hard-constraint rules** (risk / allocation) | per battle | 24 | **A7** |
| `YOUR FORGE RULES:` → `== STRATEGY PREFERENCES (should follow) ==` | m0 `:809-814` | **soft rules** | per battle | 504 | **A3** |
| `When making trades:` trailer (+ precedence block) | m0 `:824-834` | static | no | 528 | none |
| `━━━ LIVE BATTLE STATE ━━━`, `MACRO BENCHMARKS TODAY` | m2 `:1133-1139` | **score / threshold state**, evaluator market lines | every check | 528 | none |
| `REGIME CONTEXT:`, `STRATEGY PRESET:` | m2 `:1150-1158` | regime classifier; battle preset | every check | 528 | none |
| `ACTIVE POSITIONS:` (ATR mult, badges, LockNow, NextBonus, Levels) | m2 `:1163-1165`, `:1458-1487` | **held positions** | every check | 528 | none |
| `BENCH (available for swap):` / `BENCH: Empty` | m2 `:1168-1169`, `:1489-1517` | bench symbols, prices, cooldown | every check | 512 / 16 | none |
| `BENCH TECHNICAL CONTEXT:` | m2 `:1172-1177`, `:1535-1586` | **bench technicals** (incl. RSI, MACD, RVOL) | every check | 512 | **A2** |
| `FUNDAMENTALS (held + bench …)` | m2 `:1182-1183` | fundamentals mirror | per day | 528 | none |
| `CLOSED TRADES THIS BATTLE:`, `TRIGGER (why you were woken up):` | m2 `:1186-1194` | trades; wake reason | every check | 287 / 528 | none |
| `INTRADAY MOMENTUM SNAPSHOT:` | m2 `:1197-1202`, `:1826-1863` | held VWAP, BB width, NR7, range | every check | 528 | none |
| `RISK STATUS:` | m2 `:1205-1208`, `:1784-1804` | risk manager verdicts (LOCKED etc.) | every check | 100 | none |
| `ACTIVE DIRECTIVE (from your Coach):` | m2 `:1228-1242`; `controlPromptRenderer.js:213-219` | **directive block** | when filed | 25 | none |
| `STANDING LEANS (user-equipped …)` | m2 `:1228-1242`; `controlPromptRenderer.js:231-239` | **soft preferences** (leans) | per battle | 153 | **A3** |
| `=== INSTITUTIONAL INTELLIGENCE ===` | m2 `:1245-1255` | 13F data | — | 0 | none |
| `FANTASYTIMES INTELLIGENCE (recent stories …)` | m2 `:1258-1276`; `agentNewsContext.js:207-284` | **FantasyTimes stories** | when stories exist | 79 | **A1** |
| `YOUR LAST 3 DECISIONS:` | m2 `:1279-1283` | recent evaluations (80-char rationale excerpts) | every check | 493 | none |
| Voice Layer market context (Daily Regime Brief) | — | — | — | **0** | A5 n/a |
| Cautious register | — | — | — | **0** | not in the Trading Brain |
| Intraday diagnostic lines | — | — | — | **0** (dark at HEAD) | — |

**Residue the arms leave behind (disclosed, not corrected).** The news block quotes rule labels and the first 40 characters of rule text ("→ Relevant rules: …", `agentNewsContext.js:266-274`). After A3, 3 of the 60 Trend Follower records still quote soft rules there. After A7, **12 of the 24 Diversifier records still quote constraint excerpts** there. Split results are in §4.4.

### Arm applicability (sampled records)

| Archetype | A0 | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A6n |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Trend Follower | 60 | 12 | 57 | 60 | 60 | — | 60 | — | 60 |
| Contrarian | 36 | — | 33 | 36 | 36 | — | 36 | — | 36 |
| Diversifier | 24 | 12 | 24 | — | — | — | 24 | 24 | 24 |

— = not applicable: the section is absent on every sampled record (A1 Contrarian, A7 TF/Contrarian, A3/A4 Diversifier), or does not reach the prompt at all (A5).

---

## §4 Part A — input ablation replay

714 requests, one Message Batch (`msgbatch_01UAe5YQrJbNhCYe9e876VaL`), 714 succeeded, 0 errored; results saved locally and the batch deleted. Each reply is compared with the **originally captured** decision. Action flip = the action differs; a reply production would fail closed counts as an action flip and is also counted on its own ("Malformed"). Symbol flip = same action, different incoming or outgoing symbol. Reason-only = same action and symbols, different `swap_type` (secondary; never in "any flip").

Columns after the bar are **descriptive, not bars**: "A0 on the same records" compares an arm with the resend of exactly the records it applied to; "If malformed → HOLD" scores a malformed reply as production's fail-closed HOLD; "If malformed → as carried" reads the decision fields the malformed reply still carries.

### 4.1 Trend Follower — A0 (noise floor) 6.7% · B0: not noisy

| Arm | n | Any flip (95% CI) | Action | Symbol | Malformed | Reason-only | HOLD→SWAP · SWAP→HOLD | Excess vs A0 (pts) | A0 on the same records → excess (sign test p) | **Bar, as written** | If malformed → HOLD | If malformed → as carried |
|---|---:|---|---:|---:|---:|---:|---|---:|---|---|---|---|
| A0 | 60 | 4 (6.7%; 2.6–15.9) | 4 | 0 | 3 | 1 | 1 · 0 | — | — | — | floor 1.7% | floor 1.7% |
| A1 stories | 12 | 0 (0%; 0–24.2) | 0 | 0 | 0 | 2 | 0 · 0 | −6.7 | 0% → 0 (1.0) | not load-bearing | not | not |
| A2 bench technicals | 57 | 2 (3.5%; 1.0–11.9) | 2 | 0 | 1 | 2 | 0 · 1 | −3.2 | 7.0% → −3.5 (0.69) | not load-bearing | not | not |
| A3 soft preferences | 60 | 4 (6.7%; 2.6–15.9) | 4 | 0 | 2 | 0 | 1 · 1 | 0.0 | 6.7% → 0 (1.0) | not load-bearing | not | not |
| A4 learned text | 60 | 4 (6.7%; 2.6–15.9) | 4 | 0 | 2 | 0 | 1 · 1 | 0.0 | 6.7% → 0 (1.0) | not load-bearing | not | not |
| A6 charter swap | 60 | 3 (5.0%; 1.7–13.7) | 3 | 0 | 2 | 2 | 1 · 0 | −1.7 | 6.7% → −1.7 (1.0) | **not load-bearing at the decision** | not | not |
| A6n charter + names | 60 | 3 (5.0%; 1.7–13.7) | 3 | 0 | 2 | 1 | 1 · 0 | −1.7 | 6.7% → −1.7 (1.0) | secondary, no bar | — | — |

### 4.2 Contrarian — A0 5.6% · B0: not noisy

| Arm | n | Any flip (95% CI) | Action | Symbol | Malformed | Reason-only | HOLD→SWAP · SWAP→HOLD | Excess vs A0 (pts) | A0 on the same records → excess (sign test p) | **Bar, as written** | If malformed → HOLD | If malformed → as carried |
|---|---:|---|---:|---:|---:|---:|---|---:|---|---|---|---|
| A0 | 36 | 2 (5.6%; 1.5–18.1) | 2 | 0 | 1 | 0 | 0 · 1 | — | — | — | floor 5.6% | floor 2.8% |
| A2 bench technicals | 33 | 4 (12.1%; 4.8–27.3) | 3 | 1 | 2 | 0 | 1 · 0 | +6.5 | 6.1% → +6.1 (0.50) | not load-bearing | not | not |
| A3 soft preferences | 36 | 4 (11.1%; 4.4–25.3) | 4 | 0 | 0 | 0 | 2 · 2 | +5.5 | 5.6% → +5.6 (0.50) | not load-bearing | not | not |
| A4 learned text | 36 | 7 (19.4%; 9.8–35.0) | 7 | 0 | 1 | 0 | **5 · 1** | **+13.8** | 5.6% → +13.9 (0.125) | **load-bearing** | load-bearing | load-bearing |
| A6 charter swap | 36 | 5 (13.9%; 6.1–28.7) | 4 | 1 | 2 | 0 | 2 · 0 | +8.3 | 5.6% → +8.3 (0.25) | **not load-bearing at the decision** | not | not |
| A6n charter + names | 36 | 4 (11.1%; 4.4–25.3) | 3 | 1 | 1 | 0 | 2 · 0 | +5.5 | 5.6% → +5.6 (0.50) | secondary, no bar | — | — |

### 4.3 Diversifier — A0 8.3% · B0: not noisy

| Arm | n | Any flip (95% CI) | Action | Symbol | Malformed | Reason-only | HOLD→SWAP · SWAP→HOLD | Excess vs A0 (pts) | A0 on the same records → excess (sign test p) | **Bar, as written** | If malformed → HOLD | If malformed → as carried |
|---|---:|---|---:|---:|---:|---:|---|---:|---|---|---|---|
| A0 | 24 | 2 (8.3%; 2.3–25.8) | 2 | 0 | 0 | 3 | 0 · 2 | — | — | — | floor 8.3% | floor 8.3% |
| A1 stories | 12 | 3 (25.0%; 8.9–53.2) | 3 | 0 | 1 | 2 | 0 · 2 | **+16.7** | **16.7% → +8.3** (1.0) | **load-bearing** | load-bearing | **not** |
| A2 bench technicals | 24 | 3 (12.5%; 4.3–31.0) | 2 | 1 | 0 | 3 | 0 · 2 | +4.2 | 8.3% → +4.2 (1.0) | not load-bearing | not | not |
| A6 charter swap | 24 | 1 (4.2%; 0.7–20.2) | 1 | 0 | 0 | 3 | 0 · 1 | −4.1 | 8.3% → −4.2 (1.0) | **not load-bearing at the decision** | not | not |
| A7 constraint text | 24 | 2 (8.3%; 2.3–25.8) | 2 | 0 | 2 | 6 | 0 · 0 | 0.0 | 8.3% → 0 (1.0) | **the model stays inside the constraints without being told** | same | same |
| A6n charter + names | 24 | 2 (8.3%; 2.3–25.8) | 2 | 0 | 1 | 5 | 0 · 1 | 0.0 | 8.3% → 0 (1.0) | secondary, no bar | — | — |

### 4.4 Bar outcomes (B0–B3, applied as written)

| Bar | Trend Follower | Contrarian | Diversifier |
|---|---|---|---|
| **B0** noise floor (> 30% = noisy) | 6.7% — not noisy | 5.6% — not noisy | 8.3% — not noisy |
| **B1** load-bearing input (≥ A0 + 10) | none of A1, A2, A3, A4 | **A4 learned text** (+13.8) | **A1 stories** (+16.7) — *fragile*: n = 12; +8.3 against the same records' resend; not load-bearing if a malformed reply is read as carried |
| **B2** charter (A6 ≥ A0 + 15) | −1.7 → **not load-bearing at the decision** | +8.3 → **not load-bearing at the decision** | −4.1 → **not load-bearing at the decision** |
| **B3** constraint text (A7 ≥ A0 + 15) | not measurable — no constraint lines in its prompts | not measurable — no constraint lines | 0.0 → **the model stays inside the constraints without being told**. Split by the news-block residue: 1 of 12 flips with constraint quotes left in, 1 of 12 without |

The A6n secondary line (charter and both name mentions swapped) moves no more than A6: TF 5.0%, Contrarian 11.1%, Diversifier 8.3%. The residual archetype name was not what kept A6 below the bar.

### 4.5 Human-only table

All Part A records are non-CPU (CPU battles never wake the model). Since each archetype is one owner, the human-only table is the pooled table above **minus the FT_QA archetype's row**: if owner-A is FT_QA, the Trend Follower row drops; if owner-R is, the Diversifier row drops. Every remaining row has n ≥ 20 and is unchanged. Contrarian (owner-H) is human under either reading (INFERRED, §0 correction 3).

---

## §5 Part B — gate intervention census

Over **every** woken, body-complete check in the window (not only the sample). "Intervened" = the executed decision differs from the model's original proposal (`decision.original*` vs `decision.final*`). The cause is the first `blocked` check in gate order (lock → distressed → pair validation → hurdle → swap cap → reservation → execution; `agent-evaluate.js:3441-3740`), or `replacedByDeterministic`, or a guardrail fault. A model failure is not an overruling: production holds by default (`holdKind: 'default_failure'`) and it is counted on its own row.

### 5.1 Proposed vs executed

| Archetype | Woken, body complete | Model ok | Executed as proposed | Changed by a deterministic layer | Model failed → fail-closed HOLD | **Intervention rate** (of woken) | Proposed swaps | Of which blocked | **B4** (≥ 20%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Trend Follower | 433 | 415 | 396 | 19 | 18 | **4.4%** | 33 | 19 (58%) | not flagged |
| Contrarian | 94 | 89 | 88 | 1 | 5 | **1.1%** | 8 | 1 (13%) | not flagged |
| Diversifier | 24 | 24 | 10 | 14 | 0 | **58.3%** | 15 | 14 (93%) | **flagged** |
| Speculator · Capital Preserver · Fundamental Investor | 0 | — | — | — | — | unmeasurable | — | — | — |

Counting every woken check (bodies incomplete included, all timeouts): Trend Follower 19 of 486 (3.9%), Contrarian 1 of 98, Diversifier 14 of 39 (35.9%, still flagged). The 72 extra checks are all model timeouts, which hold by default and have no proposal to overrule.

### 5.2 Causes, as the record carries them

| Cause | Trend Follower | Contrarian | Diversifier | What it is |
|---|---:|---:|---:|---|
| `pair_validation:asset_class_mix` | 12 | 0 | 14 | "Cannot swap stock for crypto or vice versa" (`agentSwapExecution.js:68-76`). **All 26 are the model proposing to sell its BTC position for a stock** (BTC→AMD 7, BTC→LLY 7, BTC→CEG 4, BTC→AFRM 4, BTC→PWR 2, BTC→MPC 1, BTC→META 1). The word "crypto" appears in no system prompt (0 of 528). |
| `hurdle:below_floor` | 6 | 1 | 0 | The incoming name's daily move does not clear the hurdle over the outgoing one (`api/_utils/agentRiskManager.js:337-382`; gate `agent-evaluate.js:3536-3590`). The prompt mentions "hurdle floors" only in passing (`agentEvalPromptAssembly.js:107-111`). |
| `hurdle:bench_not_positive` | 1 | 0 | 0 | The incoming name is not up on the day (`agentRiskManager.js:364`). |
| lock, distressed veto, swap cap, reservation, execution refusal, guardrail block / forced swap / fault | 0 | 0 | 0 | — |
| *Model failed → fail-closed HOLD (not an overruling)* | | | | |
| `model_failed:400` | 10 | 5 | 0 | HTTP 400 — the 8 Oct API usage-limit cluster |
| `model_failed:invalid_tool_result` | 8 | 0 | 0 | the reply failed production's validator |

**Platform actions before the model (same tick, not overrulings).** Forced exits run before the call (risk verdicts `agent-evaluate.js:1795-1831`, the forced-swap loop `:1833-2398`, the model call `:2885`) and the model then sees the post-exit book. On woken checks: Trend Follower 16 `archetype:stagnation` + 3 `risk_manager:bust_avoidance` (on 19 checks), Contrarian 5 `archetype:stagnation`, Diversifier 1 `archetype:stagnation`. They are not in the intervention rate.

### 5.3 Directive gate (asks in the window)

| Archetype | Filed | Refused | Fit-mismatch | Note |
|---|---:|---:|---:|---|
| Trend Follower | 3 | 0 | 0 | All 3 filed by answering an agent call in the Cockpit (`call-response.js:111-125`), which never runs the chat gate. |
| Contrarian | 0 | 0 | 0 | No directive asks in the window. |
| Diversifier | 0 | 2 | 0 | Both refused through the chat gate as `no_change`, classification `research_only` (`directiveGate.js:141-145`). |

`fit_mismatch` is 0 by construction (`DIRECTIVE_FIT_CHECK_ENABLED = false`).

### 5.4 B4 and the founder read

**B4 flags the Diversifier** (58.3% of woken checks). The Trend Follower (4.4%) and the Contrarian (1.1%) are not flagged. The rate is not the answer to "too restrictive"; the read is. The founder-read sample is in the exhibits, §3: 5 Trend Follower cases (of 19), 1 Contrarian (of 1) and 5 Diversifier (of 14), each with ids, what the model wanted, what the gate did and which rule did it, and a box for *right call / wrong call / can't tell*.

---

## §6 What this does NOT say

- **Nothing about decision quality.** A flip means an input is load-bearing for the decision, not that the decision got better or worse. No outcome was scored.
- **Nothing about production behavior over time.** It replays single captured moments on one model at temperature 0.4. Production also runs the deterministic layers after the model; Part A measures the model's proposal only.
- **Nothing about the Voice Layer.** Its market context, the cautious register and chat never reach the Trading Brain; this experiment does not look at what they do in chat.
- **Nothing about Speculator, Capital Preserver or Fundamental Investor.** They never woke the model in the window.
- **Not an archetype comparison.** Each measured archetype is one owner, one agent line and one rule set (§0 correction 2). "The Contrarian's learned text is load-bearing and the Trend Follower's is not" may be about those two paragraphs, not about the archetypes.
- **Not a statistical test.** The bars are frozen thresholds on point values. The sample sizes are small; the intervals and paired sign tests in §4 are descriptive. None of the paired comparisons reaches p < 0.05; the strongest is Contrarian A4 (6 records flipped only without the learned text, 1 only on the plain resend, p = 0.125).
- **The stories result rests on 12 records** for each of the Trend Follower and the Diversifier, and on none for the Contrarian (no stories in its sampled prompts).
- **The A7 result is for five Diversifier rules only**, and on half the records the news block still quoted them.

---

## §7 Cost

| Item | Value |
|---|---|
| Estimate printed before the first call | 714 calls · ≈ 9.9 M input + 0.91 M output tokens · planned $7.24 · worst case (every reply at `max_tokens`) $10.38 · caps 4,000 calls / $25 |
| Model calls made | **714** (1 Message Batch; 0 errored, 0 retried) — A0–A7 as written: 594; secondary A6n: 120 |
| Tokens (from the replies' `usage`) | 10,003,145 input · 912,284 output |
| Spend | **$7.28** at Haiku 4.5 batch prices ($0.50 / $2.50 per million) |
| Firestore | reads only (`select` / `get` / `getAll`); no write call exists in the script |

---

## §8 Observations the author wants to argue (opinion — bars untouched)

1. **The gate that does the most overruling guards a rule the prompt never states.** 26 of the 34 interventions in the window are the model trying to sell BTC for a stock. Every Diversifier intervention is this one move, repeated across checks, and the replay shows the model proposes it again when asked again (the Diversifier's captured swaps were 15 of 24, almost all BTC→stock). The model is not "too restricted"; it is uninformed. One line in the system prompt — a crypto slot swaps only for crypto — would probably remove most of B4's flag. That is a prompt-honesty fix, not a gate-narrowing one, and it touches the fenced assembler.
2. **The charter result is the headline, but read it with the owner confound.** No measured archetype's charter moved decisions past the bar, and swapping the names too (A6n) changed nothing. Together with the Contrarian's learned-text result, the data points to "the identity that steers the model is the agent's own learned paragraph and its rules, not the six-line charter." But each archetype here is one player's agent; a charter that does nothing for this Trend Follower might matter for an agent with no rules and no wisdom.
3. **The noise floor is mostly formatting, not indecision.** 3 of the Trend Follower's 4 resend flips are malformed replies; read as production's fail-closed HOLD, its floor is 1.7%. Under that reading every Trend Follower arm stays below the bar, so the conclusion does not move, but a future run might score malformed replies the way production does.
4. **Frozen-bar comparisons against a whole-sample floor favour arms that apply to a subset.** A1 for the Diversifier passes the bar against the full-sample floor (8.3%) but not against the floor on its own 12 records (16.7%). A future prompt could define the bar on matched records.
5. **The Contrarian finding repeats the 8 Oct growth replay.** There, removing learned text moved decisions most in the Contrarian, and trades rose. Here, 5 of the 7 changes are holds turning into swaps. Two independent samples, same direction.
6. **Three archetypes have never been played by a human in the capture window.** Any per-archetype setup design for Speculator, Capital Preserver and Fundamental Investor will be untested against the Trading Brain until someone deploys one.
7. **15 of 39 Diversifier woken checks timed out** (38%, against 11% for the Trend Follower and 4% for the Contrarian). Outside this experiment's question; worth separate tasking.

---

## Appendix — method and re-run

```
node scripts/experiments/archetypeAblationReplay.mjs census        # Step 0, Step 1, Part B — reads only
node scripts/experiments/archetypeAblationReplay.mjs plan          # builds and verifies every arm request; prints the estimate; stops over a cap
node scripts/experiments/archetypeAblationReplay.mjs submit --go   # one Message Batch; refuses a plan over 4,000 calls or $25 worst case
node scripts/experiments/archetypeAblationReplay.mjs status --wait
node scripts/experiments/archetypeAblationReplay.mjs collect       # saves results, deletes the batch, retries server errors once
node scripts/experiments/archetypeAblationReplay.mjs analyze [--ftqa owner-X]
node scripts/experiments/archetypeAblationReplay.mjs selftest      # 44 synthetic checks: edits, verification, flip rules, bars, sampling
```

Each command logs the script's SHA-256 and HEAD in the run manifest. The census and plan that fed the batch ran from commit `2f8af76e` (script SHA-256 `c94d6f7f…`); the analysis of record ran from the final commit of this branch.
