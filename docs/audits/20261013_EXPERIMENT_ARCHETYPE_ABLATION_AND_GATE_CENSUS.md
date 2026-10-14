# Experiment — Archetype Input Ablation + Gate Intervention Census

**Date:** 13 Oct 2026 · **Prompt:** Fable, "Experiment prompt — Archetype Input Ablation + Gate Intervention Census", 13 Oct 2026 · **Session:** Claude Code desktop, local Windows, Opus 5.5 · **Base HEAD:** `433a19a4ef2fdc804c002f755ca2ef3686e18a18` (= `origin/main` after `git fetch origin` at session start; `main` has since moved to `abe6870d`, #956, which touches none of this branch's paths) · **Branch:** local `claude/experiment-archetype-ablation-f286eb` (the app's suffix), pushed as `claude/experiment-archetype-ablation`, not merged, no PR · **Script:** `scripts/experiments/archetypeAblationReplay.mjs` · **Exhibits (local only, carries player text):** `C:\Users\fashr\ft-experiment-exhibits\20261013_archetype_ablation_exhibits.md` · **Run folder (local only):** `C:\Users\fashr\ft-experiment-exhibits\archetype-ablation-run\`

Every `file:line` below was read at `433a19a4` in this session (VERIFIED) unless it is marked INFERRED. Every count comes from a file in the run folder: `census.json` and `records.json` (the census), `analysis.json` (Part A), `facts.json` (offline counts over the stored requests). Which script version wrote each file is in the appendix. The test suite was not run (prompt §1). The BUILD_RULES §2 review of this branch is §9.

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
| 2 | Archetype and player are separate axes | **Each measurable archetype is exactly one owner and one agent line.** Trend Follower = owner-A (all 692 records), Contrarian = owner-H (142), Diversifier = owner-R (41). Each also carries its own rule set (`facts.json`, eligible requests): Trend Follower 15 soft rules on all 415, standing leans on 153 (all owner-A); Contrarian 40 soft rules on all 89; Diversifier 5 hard rules (1 risk, 4 allocation) on all 24, no soft rules, no learned text. No request carries both hard and soft rules. | Every *within-record* arm comparison is clean. Every *cross-archetype* comparison is also a cross-owner, cross-agent, cross-rule-set comparison (§6). |
| 3 | Owner classes: human player / FT_QA tester / CPU | CPU is on the battle (`isCpu`). Nothing on a tick, battle or body record says which account is FT_QA. All three non-CPU owners are labelled **non-CPU**. INFERRED from the Practice Field census (`docs/audits/20261010_PHASE0_PRACTICE_FIELD_DISCOVERY.md:105, :112`): its 89 non-allowlisted Contrarian moments are this Contrarian owner, so owner-H is the third human; the two allowlisted accounts (founder, FT_QA) are owner-A (Trend Follower) and owner-R (Diversifier), in an order the records cannot tell. | The human-only table is the pooled table minus one archetype's row (§4). **Flash: which of owner-A / owner-R is FT_QA?** One line fixes it; `analyze --ftqa owner-X` recomputes. |
| 4 | The record carries the archetype | It does not. Join: the battle's frozen `agentContext.archetype` (`agent-evaluate.js:1024`, passed to the prompt builder at `:2823`). | Joined per battle; 0 records unjoined. |
| 5 | Decision fields include `swap_type` on the record | The permanent record keeps `decision.original / final / originalSymbolOut / originalSymbolIn / finalSymbolOut / finalSymbolIn / holdKind / downgraded / replacedByDeterministic` (`api/_utils/tickCapture/captureWriter.js:257-275`). On the tick capture, `swap_type` lives only in the TTL body's `originalToolResult` (`captureWriter.js:194`, copied before any deterministic replacement at `agent-evaluate.js:2957-2959`); an executed swap also carries it on the battle's trade as `swapMotive` (`agent-evaluate.js:3642-3644`). `decision.final*` restates the proposal (`:4122-4123` → `:4363-4364`); the symbols the executor actually swapped are on `checks.execution` and `actions[]` (`:3730-3739`). | Decision tuple = action + symbols from the record, `swap_type` from the body. |
| 6 | "Woken" discriminator | `model.dispatched === true`, set in the `finally` around the call (`agent-evaluate.js:2914-2918`). Skips before the call: `budget_skipped` (`:2759-2782`), `refresh_failed` (`:2745-2758`), the early exits of `captureConfig.js:112-121`. Model failures after dispatch fail closed to HOLD with `holdKind: 'default_failure'` (`agent-evaluate.js:4181`). | 0 `budget_skipped` and 0 `refresh_failed` in the window. |
| 7 | Body states complete / write_failed / expired | The permanent record says `written / truncated / copy_failed / skipped` (`captureWriter.js:409-420`). `write_failed` is a return value, never a document (`captureWriter.js:559-566`), so it can only show as a gap in `cronState.tickSeq`. Bodies expire 120 days after capture (`captureConfig.js:100`). | **0 gaps, per battle** (2,823 minted, 2,823 documents; every battle's sequence runs 1…n; the 11 walked battles with no tick documents minted none — a separate read-only check). **0 expired** (earliest expiry 2027-01-20). The 72 incomplete bodies are all `copy_failed`, and all 72 are model timeouts (the response never arrived). |
| 8 | Part B causes `fired_replaced / fired_slot_empty / mode_blocked` | None of these is on the record. The record carries `checks.{lock, distressedVeto, proposedPairValidation, conviction, hurdle, swapCap, reservation, execution}.{status, result, reason}` (`captureConfig.js:174-183`, written at `agent-evaluate.js:3452-3740`), `guardrail.{faultClass, overrideCount, sourceNote, evaluated}` (`captureWriter.js:238-246`), `decision.replacedByDeterministic` (`agent-evaluate.js:3366-3368`) and `actions[].{source, exitReason}`. `checks.conviction` is always `unknown` (`agent-evaluate.js:3500-3507`): the fenced validator returns no per-rule verdict, so the sub-cause of a pair-validation block is read from the body's `validationErrors`, which are that validator's own strings (`api/_utils/agentSwapExecution.js:31-90`). An executor exception and an unknown execution outcome both record `checks.execution.status = 'failed'` (`agent-evaluate.js:3908-3927`), so the record cannot tell them apart. | Causes are reported in the record's own vocabulary (§5). |
| 9 | Bench technicals = RSI / MACD / RVOL; held positions get none | The only bench technicals are the `BENCH TECHNICAL CONTEXT:` block (`api/_utils/agentEvalPromptAssembly.js:1171-1177`, `:1535-1586`), which also carries trend, BB %B, ATR regime, relative strength, levels, candle pattern and composite score. Held positions get no RSI/MACD/RVOL, but do get VWAP, BB width, NR7 and range (`INTRADAY MOMENTUM SNAPSHOT`, `:1826-1863`) and, with `PROFIT_TARGET_EXECUTOR_ENABLED = true` (`featureFlags.js:1984`), LockNow / NextBonus / Levels cells (`:1464-1483`). | **A2 removes the whole block** — wider than the three named indicators. Symbols and prices stay in the BENCH table. |
| 10 | Stories have an empty-state text | They do not. With no stories nothing is pushed (`agentEvalPromptAssembly.js:1258`). Every eligible request has Forge rules, so only the rule-aware form occurs (`:1259-1270`; `api/_utils/agentNewsContext.js:207-284`); the bare form, 0. | **A1 removes the block and its separator.** Applicable only where stories were present: 79 of 528. |
| 11 | Soft preferences include a "cautious register" | The soft layer in the Trading Brain prompt is the `== STRATEGY PREFERENCES (should follow) ==` lines (`agentEvalPromptAssembly.js:809-814`) plus the `STANDING LEANS` block (`api/_utils/controlPromptRenderer.js:231-239`). The cautious register's only renderers are in the Voice Layer prompt, and both return nothing unless `DIRECTIVE_FIT_CHECK_ENABLED` (`api/_utils/voiceLayerPrompt.js:2760-2761, :2787-2789`), which is `false` (`featureFlags.js:887`). | A3 = S-lines + leans. **The cautious register renders nowhere at HEAD** — not in the Trading Brain (0 of 528, `facts.json`) and not in the Voice Layer. |
| 12 | Learned text = lessons, wisdom, dossier | Only the wisdom paragraph reaches (`agentEvalPromptAssembly.js:774-780`). Lessons reach only by being consolidated into it; no dossier exists. Corpus probe: "LESSON"/"DOSSIER" in 0 of 528 requests. The word "memory" is present in 101 of 528 requests, never as a section: inside the Contrarian's wisdom paragraph (89) and inside the Diversifier's strategic brief (12) (`facts.json`). | A4 applicable (Trend Follower, Contrarian). The Diversifier is a fresh agent (no wisdom) → A4 n/a. |
| 13 | Voice-layer / market context may reach the prompt | It does not. The Voice Layer's market context ("TODAY'S MARKET CONTEXT (from the Daily Regime Brief)", `voiceLayerPrompt.js:2050`): 0 of 528. The Trading Brain has its own evaluator-computed `MACRO BENCHMARKS` and `REGIME CONTEXT` (`agentEvalPromptAssembly.js:1133-1153`), present in all 528; no arm targets them. | **A5: not applicable — the voice-layer market context does not reach the Trading Brain at HEAD.** |
| 14 | Hard-constraint rules (risk / allocation) are in every prompt | Hard = category `risk` or `allocation` (`api/_utils/ruleHardness.js:23`), rendered as `== CONSTRAINTS (must obey) ==` (`agentEvalPromptAssembly.js:803-808`). **Only the Diversifier's prompts carry any** (24 of 528: 1 risk + 4 allocation lines). Trend Follower and Contrarian prompts carry none. | A7 applies to the Diversifier only. |
| 15 | Intraday lines are logged, not sent | `INTRADAY_DIAGNOSTIC_ENABLED = false` (`featureFlags.js:2630`) and `INTRADAY_AGENT_USE_ENABLED = false` (`:2641`): at HEAD the intraday diagnostic is **neither logged nor sent**. (The `INTRADAY MOMENTUM SNAPSHOT` above is an older, different block, and it is sent.) | No intraday arm. |
| 16 | The charter is one section | The charter render sits in the system prompt under `━━━ ARCHETYPE IDENTITY ━━━` (`agentEvalPromptAssembly.js:340-346`; `api/_utils/evalIdentityBlocks.js:190-199`; `EVAL_IDENTITY_BLOCK_ENABLED = true`, `featureFlags.js:1642`). All 528 captured renders are byte-equal to the code constants (`evalIdentityBlocks.js:99-143`) with the flag-off clause (`EQUIPPED_RULE_PRECEDENCE_ENABLED = false`, `featureFlags.js:2104`). But the archetype is **also named** in the preamble ("Your archetype is Momentum chaser.", `:345` / `:550`) and in `ABOUT YOU: Archetype:` (`:754`). | A6 swaps the render only, as written. A secondary arm **A6n** also swaps the two names, and carries no bar. |
| 17 | Re-assembly might be possible (0.6) | The capture stores the request body, not the assembler's inputs, and the assembler is not pure: it reads the clock (`agentEvalPromptAssembly.js:1127-1130`, `:1293-1364`) and Firestore (`:891-934`). | **Ablation by textual removal at the assembler's own markers.** All 714 submitted requests pass two checks: every byte outside the declared spans is unchanged (`verifyEdit`), and the spans were the right ones — the targeted marker is gone, every other section marker keeps its count, no empty part is left, the neighbouring part is one the assembler would place there, the partner charter is present and the own charter absent (`assertArmSemantics`, added in review and re-run over all 714 after the fact). 5 records per arm are shown in the exhibits. |
| 18 | Step 1 sampling | Read as written: more than 59 available → up to 60, ≤ 6 per battle; **20–59 available → take all.** Contrarian: 89 in 6 battles → 36. Diversifier: 24 in 3 battles (12 / 8 / 4) → all 24. The recency preference uses the 15 most recent NYSE sessions, 23 Sep – 13 Oct (22 Sep falls to the second tier). **This reading is not monotone:** 59 records in 3 battles would all be taken, 60 would be capped to 18. If "available" means after the 6-per-battle cap, the Diversifier has 16 records and no bars. | **Question for Flash / Fable:** which reading did the prompt mean? Every Diversifier bar outcome (A1, A2, A6, A7) exists only under the take-all reading; Part B is unaffected. |
| 19 | Directive gate records | Statuses on `chatExchanges[].archetypeGate.status`: committed / no_change / no_proposal / invalid_id / fit_mismatch (`api/_utils/directiveGate.js:139-180, :251-300`) and no_archetype (`:324`); the three "no change" statuses are listed at `src/constants/filmTape.js:65`. Under `ARCHETYPE_INTEGRITY_MODE = 'enforce'` every battle-mode chat turn is gated and stamped (`chat.js:868-890`, `:1087`), so a gate record marks a chat turn, not necessarily a directive ask: `research_only` is a deliberate null for a research question (`directiveGate.js:76, :141-145`). `fit_mismatch` is 0 by construction (`DIRECTIVE_FIT_CHECK_ENABLED = false`, `featureFlags.js:887`). Directives filed through the Cockpit call route carry no gate record by construction: `api/agent/call-response.js:111-131` writes its own exchange (`source: 'cockpit'`) and never calls the chat gate. | §5 directive table. |
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

### 0.2 The capture record, field by field

| What | Where it is | Source |
|---|---|---|
| Collection path | `agentBattles/{battleId}/ticks/{tickId}` (permanent, no free text) and `agentBattles/{battleId}/tickBodies/{tickId}` (all text, 120-day TTL), written in one batch | `captureWriter.js:540-544`; names `captureConfig.js:103-104` |
| Document identity | `tickId = "${battleId}:${tickSeq}"`; `tickSeq` minted per battle in the admission transaction; `evalId` stamped at decision time | `captureContext.js:133`; `captureWriter.js:214-219` (permanent), `:181-186` (body); `agent-evaluate.js:3167-3168`, `:4362` |
| Request | `tickBodies.request.{body, bytes, sha256, truncated}` — the exact string the SDK dispatched; `ticks.body.requestSha256` | `captureWriter.js:96-100`, `:189`, `:318` |
| Response | `tickBodies.response.{body, bytes, sha256, truncated, status, returnedModel}` | `captureWriter.js:105-127`, `:190`, `:319` |
| Archetype | not on the record — joined from the battle's `agentContext.archetype` | §0 correction 4 |
| Decision, woken, body state | §0 corrections 5–7 | — |

### 0.5 Archetype identifiers

| Code id (on `agentContext.archetype`) | Constitution name | Label the prompt prints ("Your archetype is …", "Archetype: …") | Records in the window |
|---|---|---|---:|
| `momentum_chaser` | Trend Follower | Momentum chaser | 952 |
| `contrarian` | Contrarian | Contrarian | 401 |
| `diversifier` | Diversifier | Diversifier | 431 |
| `degen` | Speculator | Degen | 390 |
| `analyst` | Fundamental Investor | Analyst | 389 |
| `guardian` | Capital Preserver | Guardian | 260 |

Sources: the id → constitution map is at `evalIdentityBlocks.js:86-93`, and the renders are at `:99-143`. The printed label is the code id with underscores turned into spaces and the first letter capitalised (`agentEvalPromptAssembly.js:751`; `agent-evaluate.js:2691`). So the brain is told "Momentum chaser", "Degen", "Analyst" and "Guardian", never the constitution names, except inside the charter render itself. `'unknown'` is a value that can be persisted, not a seventh archetype (`evalIdentityBlocks.js:165-167`); 0 records in the window carry it.

---

## §1 In plain terms

| Archetype | Q1 — is the archetype in the thinking? | Q2 — how often do the deterministic layers overrule it? |
|---|---|---|
| Trend Follower | No: removing its learned paragraph, its 15 soft rules and leans, or its bench technicals, or swapping in the Contrarian charter, changed no more of its 60 decisions than simply asking again (stories rest on 12 records). | 19 of its 433 woken checks with a full record (4%): of its 33 proposed swaps, 12 were stopped because it tried to sell BTC for a stock and 7 by the hurdle floor. |
| Contrarian | Its learned paragraph is load-bearing (7 of 36 calls changed, mostly holds turning into trades, against 2 of 36 on a plain resend); its charter and soft rules are not. | 1 of its 94 woken checks with a full record (1%): one swap stopped by the hurdle floor. |
| Diversifier | Its charter and its hard-constraint text are not load-bearing; removing its news passed the bar, but on 12 records and not robustly (§4). All of this rests on reading the sampling rule as "take all 24" (§0, 18). | 14 of its 24 woken checks with a full record (58%, **flagged**; 14 of 39 woken = 36%): every one is the model trying to sell its BTC slot for a stock. The prompt shows BTC as "Crypto" but never states that crypto swaps only for crypto. |
| Speculator | Unmeasurable: it plays only as a CPU opponent, and CPU battles never call the model. | Unmeasurable (0 woken checks). |
| Capital Preserver | Unmeasurable, same reason. | Unmeasurable (0 woken checks). |
| Fundamental Investor | Unmeasurable, same reason. | Unmeasurable (0 woken checks). |

**The clearest thing the data says:** for the three archetypes that can be measured, swapping the archetype charter never moved decisions past the bar; the only input that passed robustly was the Contrarian's own learned paragraph; and 26 of the 34 overrulings in the window come from one stock-vs-crypto rule the prompt never states.

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
| Cautious register | — | — | — | **0** | renders nowhere at HEAD (flag dark) |
| Intraday diagnostic lines | — | — | — | **0** (dark at HEAD) | — |

**What A3 and A7 leave behind (disclosed, not corrected).**
- **An empty rules part.** No request carries both soft and hard rules, so the chunk each arm removes is the only one in its `YOUR FORGE RULES:` part. The part stays, holding only its trailer (`agentEvalPromptAssembly.js:824-834`): "When making trades: — Check ALL constraints before executing… — Use strategy preferences to rank opportunities… — If no strategy preference matches, trade on your own analysis", then the DECISION PRECEDENCE block. This is so on all 96 A3 requests (Trend Follower, Contrarian) and all 24 A7 requests (Diversifier) (`facts.json`). With no rules at all, production renders no FORGE RULES part (`:783-836`) and switches the news to the bare-headline format (`:1259-1275`); the capture cannot rebuild that format. So A3 and A7 are "the rule lines removed", not "the prompt production would build without rules". A1, A2, A4 and A6 are unaffected.
- **Rule quotes in the news block.** The news block quotes rule labels and the first 40 characters of rule text ("→ Relevant rules: …", `agentNewsContext.js:266-274`). After A3, 3 of the 60 Trend Follower records still quote soft rules there. After A7, **12 of the 24 Diversifier records still quote constraint excerpts** there. Split results are in §4.4.
- **The archetype's name in the brief.** A6n swaps the two template mentions of the name, but the agent's own strategic brief may name it too: Trend Follower 10 of 60, Contrarian 6 of 36, **Diversifier 24 of 24** (`facts.json`).

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

The excess is computed from the flip counts (not from rounded percentages). Columns after the bar are **descriptive, not bars**: "A0 on the same records" compares an arm with the resend of exactly the records it applied to; "If malformed → HOLD" scores a malformed reply as production's fail-closed HOLD; "If malformed → as carried" reads the decision fields the malformed reply still carries.

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
| A2 bench technicals | 33 | 4 (12.1%; 4.8–27.3) | 3 | 1 | 2 | 0 | 1 · 0 | +6.6 | 6.1% → +6.1 (0.50) | not load-bearing | not | not |
| A3 soft preferences | 36 | 4 (11.1%; 4.4–25.3) | 4 | 0 | 0 | 0 | 2 · 2 | +5.6 | 5.6% → +5.6 (0.50) | not load-bearing | not | not |
| A4 learned text | 36 | 7 (19.4%; 9.8–35.0) | 7 | 0 | 1 | 0 | **5 · 1** | **+13.9** | 5.6% → +13.9 (0.125) | **load-bearing** | load-bearing | load-bearing |
| A6 charter swap | 36 | 5 (13.9%; 6.1–28.7) | 4 | 1 | 2 | 0 | 2 · 0 | +8.3 | 5.6% → +8.3 (0.25) | **not load-bearing at the decision** | not | not |
| A6n charter + names | 36 | 4 (11.1%; 4.4–25.3) | 3 | 1 | 1 | 0 | 2 · 0 | +5.6 | 5.6% → +5.6 (0.50) | secondary, no bar | — | — |

### 4.3 Diversifier — A0 8.3% · B0: not noisy

| Arm | n | Any flip (95% CI) | Action | Symbol | Malformed | Reason-only | HOLD→SWAP · SWAP→HOLD | Excess vs A0 (pts) | A0 on the same records → excess (sign test p) | **Bar, as written** | If malformed → HOLD | If malformed → as carried |
|---|---:|---|---:|---:|---:|---:|---|---:|---|---|---|---|
| A0 | 24 | 2 (8.3%; 2.3–25.8) | 2 | 0 | 0 | 3 | 0 · 2 | — | — | — | floor 8.3% | floor 8.3% |
| A1 stories | 12 | 3 (25.0%; 8.9–53.2) | 3 | 0 | 1 | 2 | 0 · 2 | **+16.7** | **16.7% → +8.3** (1.0) | **load-bearing** | load-bearing | **not** |
| A2 bench technicals | 24 | 3 (12.5%; 4.3–31.0) | 2 | 1 | 0 | 3 | 0 · 2 | +4.2 | 8.3% → +4.2 (1.0) | not load-bearing | not | not |
| A6 charter swap | 24 | 1 (4.2%; 0.7–20.2) | 1 | 0 | 0 | 3 | 0 · 1 | −4.2 | 8.3% → −4.2 (1.0) | **not load-bearing at the decision** | not | not |
| A7 constraint text | 24 | 2 (8.3%; 2.3–25.8) | 2 | 0 | 2 | 6 | 0 · 0 | 0.0 | 8.3% → 0 (1.0) | **the model stays inside the constraints without being told** | same | same |
| A6n charter + names | 24 | 2 (8.3%; 2.3–25.8) | 2 | 0 | 1 | 5 | 0 · 1 | 0.0 | 8.3% → 0 (1.0) | secondary, no bar | — | — |

### 4.4 Bar outcomes (B0–B3, applied as written)

| Bar | Trend Follower | Contrarian | Diversifier |
|---|---|---|---|
| **B0** noise floor (> 30% = noisy) | 6.7% — not noisy | 5.6% — not noisy | 8.3% — not noisy |
| **B1** load-bearing input (≥ A0 + 10) | none of A1, A2, A3, A4 | **A4 learned text** (+13.9) | **A1 stories** (+16.7) — *fragile*: the arm applied to 12 records, fewer than the 20 the prompt requires before an archetype gets bars at all (split 7 / 3 / 2 across 3 battles); both of the archetype's A0 flips fall inside those 12, so against the same records' resend it is +8.3; not load-bearing if a malformed reply is read as carried |
| **B2** charter (A6 ≥ A0 + 15) | −1.7 → **not load-bearing at the decision** | +8.3 → **not load-bearing at the decision** | −4.2 → **not load-bearing at the decision** |
| **B3** constraint text (A7 ≥ A0 + 15) | not measurable — no constraint lines in its prompts | not measurable — no constraint lines | 0.0 → **the model stays inside the constraints without being told**. Read with two caveats (§3): the rules part's trailer ("Check ALL constraints before executing…") stays in every A7 request, and 12 of 24 still quote constraint excerpts in the news block — 1 of 12 flipped with those quotes, 1 of 12 without |

The A6n secondary line (charter and both template name mentions swapped) moved no more than A6 for the Trend Follower (5.0% each) and the Contrarian (11.1% vs 13.9%). For the Diversifier it moved 8.3% against A6's 4.2% — both at or below its 8.3% floor. The template name mentions were not what kept A6 below the bar for the Trend Follower and the Contrarian. For the Diversifier this cannot be said: its strategic brief names the archetype on all 24 records, and A6n leaves the brief untouched (§3).

### 4.5 Human-only table

All Part A records are non-CPU (CPU battles never wake the model). Since each archetype is one owner, the human-only table is the pooled table above **minus the FT_QA archetype's row**: if owner-A is FT_QA, the Trend Follower row drops; if owner-R is, the Diversifier row drops. Every remaining row has n ≥ 20 and is unchanged. Contrarian (owner-H) is human under either reading (INFERRED, §0 correction 3).

---

## §5 Part B — gate intervention census

Over **every** woken, body-complete check in the window (not only the sample). "Intervened" = the executed decision differs from the model's original proposal (`decision.original*` vs `decision.final*`). The cause is the first `blocked` check in gate order (lock → distressed → pair validation → hurdle → swap cap → reservation → execution; `agent-evaluate.js:3441-3740`), or `replacedByDeterministic`, or a guardrail fault. A model failure is not an overruling: production holds by default (`holdKind: 'default_failure'`) and it is counted on its own row.

### 5.1 Proposed vs executed

| Archetype | Woken, body complete | Model ok | Executed as proposed | Changed by a deterministic layer | Model failed → fail-closed HOLD | **Intervention rate** (of woken, body complete) | Proposed swaps | Of which blocked | **B4** (≥ 20%) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Trend Follower | 433 | 415 | 396 | 19 | 18 | **4.4%** | 33 | 19 (58%) | not flagged |
| Contrarian | 94 | 89 | 88 | 1 | 5 | **1.1%** | 8 | 1 (13%) | not flagged |
| Diversifier | 24 | 24 | 10 | 14 | 0 | **58.3%** | 15 | 14 (93%) | **flagged** |
| Speculator · Capital Preserver · Fundamental Investor | 0 | — | — | — | — | unmeasurable | — | — | — |

Counting every woken check (bodies incomplete included, all timeouts): Trend Follower 19 of 486 (3.9%), Contrarian 1 of 98, Diversifier 14 of 39 (35.9%, still flagged). The 72 extra checks are all model timeouts (Trend Follower 53, Contrarian 4, Diversifier 15), which hold by default and have no proposal to overrule.

### 5.2 Causes, as the record carries them

| Cause | Trend Follower | Contrarian | Diversifier | What it is |
|---|---:|---:|---:|---|
| `pair_validation:asset_class_mix` | 12 | 0 | 14 | "Cannot swap stock for crypto or vice versa" (`agentSwapExecution.js:68-76`). The prompt shows BTC's sector as "Crypto" in the positions and bench tables, but no text in any of the 528 requests states the rule — system, messages or tool schema (`facts.json`: rule-phrase probe 0 everywhere; "crypto" in 0 system prompts and 0 tool schemas). **All 26 are the model proposing to sell its BTC position for a stock** (BTC→AMD 7, BTC→LLY 7, BTC→CEG 4, BTC→AFRM 4, BTC→PWR 2, BTC→MPC 1, BTC→META 1). The word "crypto" appears in no system prompt (0 of 528). |
| `hurdle:below_floor` | 6 | 1 | 0 | The incoming name's daily move does not clear the hurdle over the outgoing one (`api/_utils/agentRiskManager.js:337-382`; gate `agent-evaluate.js:3536-3590`). The prompt mentions "hurdle floors" only in passing (`agentEvalPromptAssembly.js:107-111`). |
| `hurdle:bench_not_positive` | 1 | 0 | 0 | The incoming name is not up on the day — a step inside the same hurdle check (`agentRiskManager.js:363-364`). |
| lock, distressed veto, swap cap, reservation, execution refusal, guardrail block / forced swap / fault, swap executed on other symbols | 0 | 0 | 0 | — The 22 swaps executed as proposed were checked against the committed trade: all 22 executed exactly the proposed pair (a separate read-only check of `actions[]`; the census now compares `checks.execution` itself). |
| *Model failed → fail-closed HOLD (not an overruling)* | | | | |
| `model_failed:400` | 10 | 5 | 0 | HTTP 400 — the 8 Oct API usage-limit cluster |
| `model_failed:invalid_tool_result` | 8 | 0 | 0 | the reply failed production's validator |
| *timeouts (no complete body, so outside this table's scope)* | 53 | 4 | 15 | the call timed out; held by default |

**Platform actions before the model (same tick, not overrulings).** Forced exits run before the call (risk verdicts `agent-evaluate.js:1795-1831`, the forced-swap loop `:1833-2398`, the model call `:2885`) and the model then sees the post-exit book. On woken checks: Trend Follower 16 `archetype:stagnation` + 3 `risk_manager:bust_avoidance` (on 19 checks), Contrarian 5 `archetype:stagnation`, Diversifier 1 `archetype:stagnation`. They are not in the intervention rate.

### 5.3 Directive gate (in the window)

| Archetype | Filed | Refused | Fit-mismatch | Note |
|---|---:|---:|---:|---|
| Trend Follower | 3 | 0 | 0 | All 3 filed by answering an agent call in the Cockpit (`call-response.js:111-131`), which never runs the chat gate. |
| Contrarian | 0 | 0 | 0 | No gated chat turns and no filings in the window. |
| Diversifier | 0 | 0 | 0 | 2 gated chat turns, both classified `research_only` → `no_change` (`directiveGate.js:76, :141-145`): research questions, not refused asks. |

`fit_mismatch` is 0 by construction (`DIRECTIVE_FIT_CHECK_ENABLED = false`).

### 5.4 B4 and the founder read

**B4 flags the Diversifier** (58.3% of woken checks with a full record; 35.9% of all woken). The 14 interventions come from 2 of its 3 battles (8 on 7 Oct, 6 on 6 Oct); the third battle (12 Oct) had 4 checks and none (`facts.json`). The Trend Follower's 19 come from 6 battles, 11 of them from one battle on 6 Oct. The Trend Follower (4.4%) and the Contrarian (1.1%) are not flagged. The rate is not the answer to "too restrictive"; the read is. The founder-read sample is in the exhibits, §3: 5 Trend Follower cases (of 19), 1 Contrarian (of 1) and 5 Diversifier (of 14), each with ids, what the model wanted, what the gate did and which rule did it, and a box for *right call / wrong call / can't tell*.

---

## §6 What this does NOT say

- **Nothing about decision quality.** A flip means an input is load-bearing for the decision, not that the decision got better or worse. No outcome was scored.
- **Nothing about production behavior over time.** It replays single captured moments on one model at temperature 0.4. Production also runs the deterministic layers after the model; Part A measures the model's proposal only.
- **Nothing about the Voice Layer.** Its market context and chat never reach the Trading Brain, and the cautious register renders nowhere at HEAD; this experiment does not look at what the Voice Layer does in chat.
- **Nothing about Speculator, Capital Preserver or Fundamental Investor.** They never woke the model in the window.
- **Not an archetype comparison.** Each measured archetype is one owner, one agent line and one rule set (§0 correction 2). "The Contrarian's learned text is load-bearing and the Trend Follower's is not" may be about those two paragraphs, not about the archetypes.
- **Not a statistical test.** The bars are frozen thresholds on point values. The sample sizes are small; the intervals and paired sign tests in §4 are descriptive. None of the paired comparisons reaches p < 0.05; the strongest is Contrarian A4 (6 records flipped only without the learned text, 1 only on the plain resend, p = 0.125).
- **The stories result rests on 12 records** for each of the Trend Follower and the Diversifier, and on none for the Contrarian (no stories in its sampled prompts).
- **A3 and A7 are not production's no-rules prompt.** They remove the rule lines; the rules part's trailer stays, and the news block keeps its rule-aware format (§3). The A7 result is for five Diversifier rules only, and on half the records the news block still quoted them.
- **The Diversifier's bars depend on a sampling reading** (§0, 18) that Flash or Fable should confirm.

---

## §7 Cost

| Item | Value |
|---|---|
| Estimate printed before the first call | 714 calls · ≈ 9.9 M input + 0.91 M output tokens · planned $7.24 · worst case (every reply at `max_tokens`) $10.38 · caps 4,000 calls / $25 |
| Model calls made | **714** (1 Message Batch; 0 errored, 0 retried) — A0–A7 as written: 594; secondary A6n: 120 |
| Tokens (from the replies' `usage`) | 10,003,145 input · 912,284 output |
| Spend | **$7.28** at Haiku 4.5 batch prices ($0.50 / $2.50 per million) |
| After the batch | no further model calls: the review fixes, `analyze` and `facts` work on the saved results; two one-off read-only Firestore checks (executed swap symbols; per-battle tick sequences) |
| Firestore | reads only (`select` / `get` / `getAll`); no write call exists in the script |

---

## §8 Observations the author wants to argue (opinion — bars untouched)

1. **The gate that does the most overruling guards a rule the prompt never states.** 26 of the 34 interventions in the window are the model trying to sell BTC for a stock. Every Diversifier intervention is this one move, repeated across checks, and the replay shows the model proposes it again when asked again (the Diversifier's captured swaps were 15 of 24, 14 of them BTC→stock). The model is told BTC's asset class ("Crypto" in the sector column) but not the rule, so it is not "too restricted"; it is uninformed about one rule. One line in the system prompt — a crypto slot swaps only for crypto — would probably remove most of B4's flag. That is a prompt-honesty fix, not a gate-narrowing one, and it touches the fenced assembler.
2. **Where does the archetype live, then? My reading, not a measurement.** No measured archetype's charter moved decisions past the bar, and for the Trend Follower and the Contrarian swapping the names too (A6n) did not either. The soft rules (A3) and the Diversifier's hard rules (A7) also stayed below the bar, and the learned paragraph passed for the Contrarian only. So at the decision, these agents behave more like "a generic trading brain shaped by its own learned paragraph, with gates after it" than like six distinct characters. Two cautions: each archetype here is one player's agent (a charter that does nothing for this Trend Follower might matter for an agent with no rules and no wisdom), and the Diversifier's brief names its archetype on every record, so its A6/A6n arms never fully hid it.
3. **The noise floor is mostly formatting, not indecision.** 3 of the Trend Follower's 4 resend flips are malformed replies; read as production's fail-closed HOLD, its floor is 1.7%. Under that reading every Trend Follower arm stays below the bar, so the conclusion does not move, but a future run might score malformed replies the way production does.
4. **Frozen-bar comparisons against a whole-sample floor favour arms that apply to a subset.** A1 for the Diversifier passes the bar against the full-sample floor (8.3%) but not against the floor on its own 12 records (16.7%). A future prompt could define the bar on matched records.
5. **The Contrarian finding agrees with the 8 Oct growth replay, but it is not an independent replication.** There, removing learned text moved decisions most in the Contrarian, and trades rose. Here, 5 of the 7 changes are holds turning into swaps. The two samples overlap: same agent, same wisdom paragraph, 5 of the same 6 battles, and 19 of these 36 records were in the 8 Oct sample (4 of the 7 A4 flips are on shared records). It is a second set of model draws on largely the same moments.
6. **Three archetypes have never been played by a human in the capture window.** Any per-archetype setup design for Speculator, Capital Preserver and Fundamental Investor will be untested against the Trading Brain until someone deploys one.
7. **15 of 39 Diversifier woken checks timed out** (38%, against 11% for the Trend Follower and 4% for the Contrarian). Outside this experiment's question; worth separate tasking.
8. **A faithful "no rules" arm is cheap but only partly possible.** Removing the whole FORGE RULES part when the removed chunk is its only one would match production's no-rules prompt except for the news block, whose bare-headline format cannot be rebuilt from the capture. About 120 calls (A3 for the Trend Follower and the Contrarian, A7 for the Diversifier), about $1.20. Not run: it would be an arm added after reading the results. Fable's call.
9. **Two rules the prompt could state next time.** (a) The sampling cap: say whether "available" is counted before or after the 6-per-battle cap (§0, 18). (b) A minimum n per arm cell, and whether a bar compares against the archetype's whole-sample A0 or the A0 on the same records: the Diversifier's stories arm passes one and fails the other.

---

## Appendix — method and re-run

```
node scripts/experiments/archetypeAblationReplay.mjs census        # Step 0, Step 1, Part B — reads only
node scripts/experiments/archetypeAblationReplay.mjs plan          # builds and verifies every arm request; prints the estimate; stops over a cap
node scripts/experiments/archetypeAblationReplay.mjs submit --go   # one Message Batch; refuses a plan over 4,000 calls or $25 worst case
node scripts/experiments/archetypeAblationReplay.mjs status --wait
node scripts/experiments/archetypeAblationReplay.mjs collect [--go] # saves results after checking every result id is this batch's own, deletes the batch; --go retries server errors once
node scripts/experiments/archetypeAblationReplay.mjs analyze [--ftqa owner-X]
node scripts/experiments/archetypeAblationReplay.mjs facts         # offline counts over the stored requests (facts.json)
node scripts/experiments/archetypeAblationReplay.mjs selftest      # synthetic checks: edits, verification, semantics, flip rules, bars, sampling, gate causes
```

**Which code wrote which file** (`manifest.json` → `commandLog`; script SHA-256 of the LF bytes):

| Step | When (UTC) | HEAD | Script | Note |
|---|---|---|---|---|
| census (first) | 23:31 | `433a19a4` | `88e70de8…` | superseded: its outputs were overwritten by the second census before any spend |
| **census** (`census.json`, `records.json`, `sources.jsonl`) | 23:39 | `433a19a4` | `c94d6f7f…` | working copy, byte-identical to the script committed 30 s later as `2f8af76e` |
| plan | 23:40 | `433a19a4` | `c94d6f7f…` | same bytes |
| submit | 23:40 | `2f8af76e` | `c94d6f7f…` | committed |
| collect | 23:44 | `2f8af76e` | `42239c52…` | an uncommitted working copy between `2f8af76e` and `a59dd4c1`; its collect path is unchanged from `2f8af76e` |
| **analyze**, **facts** (`analysis.json`, `facts.json`) | 14 Oct, after the review | `98612ed6` | `cca67681…` | the analysis of record, from the committed final code on a clean tree; `analyze` is logged in the manifest from this version on |

The census of record ran before the review fixes. Those fixes change the census only on paths this window never took (0 forced swaps, 0 executed-symbol mismatches, 0 ambiguous identities, 0 per-battle gaps), so it was not re-run: a re-run would overwrite the sample the batch was built from.

---

## §9 BUILD_RULES §2 review record

**Why it ran.** The branch adds about 1,800 lines of script and about 400 of report, over the 1,500-line threshold.

**What was reviewed.** Commit `a59dd4c1`, the script and the report at the time of the first push.

**Isolation.** Each reviewer and each refuter worked on its own `git archive` extraction of `a59dd4c1` under the session scratchpad. They were read-only on git, the worktree and the run folder, and were allowed to run only `selftest` and their own probes (loopback-only servers, a scratch `USERPROFILE`, a fake API key). The mutating lens ran last, on its own tree.

**Lenses.**
- **L1** — safety and budget: no Firestore writes, secrets, cap enforcement, batch bookkeeping, player text out of git, import graph.
- **L2** — Part A measurement: locators against the assembler, edit verification, flip rules, bars, sampling. It recomputed all 714 rows.
- **L3** — Part B and the corpus census: gate attribution against `agent-evaluate.js`, census counts, directives, owner classes. It recomputed every Part B figure.
- **L4** — report claims: every citation and every number against the code and the data.

**Refutation.** Every finding went to an independent refuter (R1–R4) instructed to disprove it with a concrete repro.

**Result:** 32 CONFIRMED, 8 REFUTED. No finding changed a bar outcome or a Part B number.

**Scope of the review, stated plainly.** The adversarial review and refutation covered `a59dd4c1`. The fix commits (`995771b4`, `98612ed6`, and the docs-only commits after them) were **not** put through a second reviewer-and-refuter pass. They were verified four ways:
- the 63-row selftest;
- the 18-mutant check on `98612ed6`;
- `assertArmSemantics` re-run over all 714 submitted requests;
- `analyze` re-run from the committed code, which reproduces every Part A number. Plus `vite build` on each commit.

A second adversarial pass over that delta (mainly the safety hardening in `submit` / `collect` / `reconcilePending`, which no run has exercised since) has not been done.

The finding ids below are the ones the script's comments cite.

### Findings and dispositions

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| L1 F1 | `plan` / `census` could rewrite a run that already had batches. `submit` then skips tasks by index and pairs old replies with new tasks. | CONFIRMED, medium. R1 reproduced the mispairing. The dollar overrun is smaller than claimed. | **Fixed.** `census` and `plan` refuse once a batch or pending create exists. Plans carry a hash and batches record it. `submit` checks cumulative calls. |
| L1 F2 | A non-finite worst case is stored as `null` and passes `null <= 25`. | CONFIRMED, lowered to low (no billable path). | **Fixed.** `planWithinCaps` requires every figure to be finite, within cap and with `withinCap === true`. `estimate` throws on non-finite values. `max_tokens` must be a positive integer. An over-cap plan is never stored as the active plan. |
| L1 F3 | `fetch` follows redirects, and Node forwards `x-api-key` to a new origin. | CONFIRMED (R1 probed it on loopback), lowered to low. | **Fixed.** Both fetches use `redirect: 'error'`. |
| L1 F4 | `collect`'s retry creates paid batches with no `--go` and no cap check. | CONFIRMED, low. | **Fixed.** The retry needs `--go` and passes the cumulative call cap. |
| L1 F5 | An interrupted create with zero matches is dropped silently. Adoption has no upper time bound, so an unrelated batch could be adopted and then deleted. | CONFIRMED, low. R1 reproduced both cases. | **Fixed.** Zero matches now STOP (`--forget-pending` to override). The window is bounded on both sides. `collect` refuses to save or delete a batch whose result ids are not its own tasks. |
| L2 #1 | Diversifier A1 is "load-bearing" on 12 records against the whole-sample floor. | REFUTED as a defect: the bar as written uses the archetype's A0 and has no arm-level minimum n. | **Disclosed** in §1 and §4.4 (n = 12, matched floor +8.3, the carried reading). The rule is argued in §8.9. The as-written outcome stands. |
| L2 #2 | The take-all branch drops the 6-per-battle cap. | REFUTED as a defect: it is the literal rule. R2 showed the rule is non-monotone (59 records → 59 taken, 60 → 18). | **Raised to Flash/Fable** in §0.18, §6 and §8.9. |
| L2 #3 | A3/A7 leave a FORGE RULES part with no rule lines. Production would render none, and would render bare-headline news. | CONFIRMED, medium (96/96 A3, 24/24 A7). | **Disclosed** in §3, §4.4 and §6. A costed follow-up is in §8.8; it was not run (it would be an arm added after the results). |
| L2 #4 | `verifyEdit` re-applies the same spans, so it cannot catch a wrong span. | CONFIRMED, low (R2: a zero-length span or an out-of-bounds record is still caught). | **Fixed.** `assertArmSemantics` runs on every task at plan and submit. All 714 submitted requests pass. |
| L2 #5a | An ambiguous identity block makes the rules locator report "absent". | CONFIRMED, latent. | **Fixed:** it now reports ambiguous. |
| L2 #5b | The bare-news block has no tail check. | REFUTED. The bare form has no tail, and the per-line check fails closed. | A belt-and-braces uniqueness check on the history header was added anyway. |
| L2 #5c | The residue regex misses an S quote that follows a C quote. | CONFIRMED, latent. | **Fixed.** |
| L2 #6 | Excess was computed from rounded percentages. | CONFIRMED, latent (no outcome within 0.1 of a bar). | **Fixed:** bars are computed from counts and §4 refreshed (Contrarian A4 +13.9). |
| L2 #7 | A6n leaves the archetype's name in the strategic brief. | CONFIRMED, low and wider than filed (TF 10/60, Contrarian 6/36, Diversifier 24/24). | **Disclosed** in §3, §4.4 and §8.2. |
| L3 #1 | For a SWAP, "as proposed" compares the proposal with itself; the executed symbols are on `checks.execution` / `actions[]`. | CONFIRMED, medium for the method. No data impact: a read-only check found all 22 executed swaps executed exactly the proposed pair. | **Fixed:** `classifyGate` compares the closed trade. |
| L3 #2 | §1 and §5 say "woken" for the body-complete denominators. Timeouts are missing from §5.2. | CONFIRMED, low. R3 refuted the timeout part as a scope matter. | **Fixed:** the denominators are labelled everywhere and a timeout row was added. |
| L3 #3 | Two `research_only` turns were counted as "refused" asks. | CONFIRMED, low. | **Fixed:** the directive table now shows 0 refused, with a note. |
| L3 #4 | The "crypto" claim is narrower than its evidence and not reproducible. | CONFIRMED, low. | **Fixed:** `facts.json` (crypto by part, rule-phrase probe) and scoped wording. |
| L3 #5 | Edge paths misattributed: (a) failed call + forced swap, (b) forced swap then blocked, (c) forced-then-blocked netting to HOLD, (d) unknown execution outcome. | (a), (b), (d) CONFIRMED, latent. (c) REFUTED: it is "as proposed" by definition. | (a) and (b) **fixed** as named causes. (c) is flagged as as-proposed. (d) is relabelled `execution_failed_or_outcome_unknown`. 0 of these paths occurred. |
| L3 #6 | Battles with no tick documents skip the gap check, and sums are compared instead of battles. | First half CONFIRMED (latent). Second half REFUTED (contiguous sequences make the sums sufficient). | **Fixed:** per-battle accounting. A read-only check found 0 gaps in every battle, and the 11 battles without ticks minted none. |
| L3 #7 | An owner with any CPU battle is classed CPU. | CONFIRMED, latent. | **Fixed:** each record is classed by its own battle. |
| L3 #8 | Census files came from the `2f8af76e` script, not `a59dd4c1`. | CONFIRMED, nit. | **Fixed:** provenance table in the appendix. |
| L4 F1 | §1's "clearest thing" stated opinion as fact (the rules arms also failed the bar). | CONFIRMED, high. | **Fixed:** §1 keeps only measured facts; the reading moved to §8.2, marked as opinion. |
| L4 F2 | "A6n moves no more than A6" is false for the Diversifier. | CONFIRMED. | **Fixed** in §4.4. |
| L4 F3 | "memory occurs 101 times" counts requests. | REFUTED: 101 requests and 101 occurrences, all in the wisdom (89) or the brief (12). | Wording made exact; `facts.json` backs it. |
| L4 F4 | The cautious register is dark in the Voice Layer too. | CONFIRMED. | **Fixed** in correction 11. |
| L4 F5 | "Two independent samples" — the growth replay used the same corpus. | CONFIRMED, medium. 19 of the 36 records and 4 of the 7 A4 flips are shared. | **Fixed** in §8.5. |
| L4 F6 | The "0 of 528" crypto figure had no file behind it, and the claim's scope was wider than the count. | REFUTED on substance: 0 rule-phrase hits anywhere. A provenance gap remained. | `facts.json` added and the wording scoped. |
| L4 F7 | "Refused" for `research_only`. | CONFIRMED. | Same fix as L3 #3. |
| L4 F8 | Provenance: `collect` ran from an uncommitted copy, and `analyze` was not logged. | CONFIRMED, low. | **Fixed:** appendix table; `analyze` is now stamped. |
| L4 F9 | Rounded excess values. | CONFIRMED, low. | Same fix as L2 #6. |
| L4 F10 | Three citations missed by a few lines. | Partly CONFIRMED (two of three). | **Fixed.** |
| L4 F11 | `swap_type` also persists on trades as `swapMotive`. | CONFIRMED, wording. | **Fixed** in correction 5. |
| L4 F12 | Hurdle wording and the woken denominators. | Partly CONFIRMED: the denominators. The hurdle wording was refuted as defensible. | Denominators **fixed**. The hurdle note now names the step. |
| L4 F13 | The B4 flag's clustering was not stated. | CONFIRMED. | **Fixed** in §5.4 (2 battles, 2 days). |
| L4 F14 | Rule, lean and register counts had no file behind them. | REFUTED: all are correct. A provenance gap remained. | `facts.json` added. |

R1 also noticed three adjacent gaps; all three are fixed: result ids not checked against the batch, an over-cap plan stored as active, and a retry rebuilt from the current plan.

### Build, selftest and mutation check

- **`vite build`** passed on `a59dd4c1` (exit 0, 51 s), on the final code commit `98612ed6` (exit 0, 13 s) and on the pushed head (docs only on top of `98612ed6`). Only the chunk-size warning appeared. Each build ran on an LF `git archive` extraction with `node_modules` linked by junction, unlinked afterwards. No test imports `App.jsx`. The script and report touch no bundled file, so the build guards against nothing in this change; it is run because the rule requires it.
- **Mutation check of the selftest** ran on its own extraction, each planted defect applied alone.
  - First run: 10 of 12 killed. M1 survived: "verifyEdit never compares" got through because the out-of-span row planted its change in an *untargeted* field. M7 crashed the selftest instead of failing a named row.
  - Both selftest gaps were fixed: a targeted-field row was added, and post-loop rows were guarded.
  - Re-run: 12 of 12 killed by named rows.
  - On the final code commit `98612ed6`, 18 mutants ran: the 12 above plus 6 for the review's own guards. These were semantics ignoring other markers, executed symbols not compared, the cap check dropping finiteness, bars from rounded percentages, a failed call plus forced swap counted as fail-closed, and an ambiguous identity read as absent. **18 of 18 killed by named rows.** Two of those six needed a new selftest row first (`null` planned spend; two wisdom headers).
- **The selftest grew** from 44 to 63 checks with the review fixes: semantics, gate edge paths, count-based bars, cap validation, the ambiguous identity.
- **After the fixes:** `assertArmSemantics` passes on all 714 submitted requests. `analyze` re-run from `98612ed6` reproduces every Part A number and bar outcome in §4.
