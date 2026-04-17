# Audit 02a — Part 3: Rules 26–37 (Risk Status, Forge Rules, Anti-Thrash, Survival Mode, Institutional Lag)

**Source locations:**
- `api/_utils/agentEvalPromptAssembly.js:138–183` — system prompt (RISK STATUS, FORGE RULES, ANTI-THRASH, SURVIVAL MODE).
- `api/_utils/agentEvalPromptAssembly.js:272–290` — identity block (C_INST lag + Forge trade checklist, conditional on active rules).

## Rules 26–28 — Risk Status block

Heading: `RISK STATUS:` (lines 138–141). Not a `━━━`-delimited block, but a distinct behavioral group injected by the prompt.

### Rule 26 — LOCKED positions cannot be swapped out

- **Quote** (line 139): "LOCKED positions CANNOT be swapped out. Only hard stops override locks."
- **Classification:** `risk_management`.
- **Trigger:** `riskStatus[symbol].action === 'LOCK'`.
- **Action:** forbid SWAP-out of the locked symbol.
- **R-map:** R1 (Bonus Lock-In) — LOCK fires when a position is near a bonus threshold (risk manager's ATR lock).
- **Enforcement:** reinforced at `agent-evaluate.js:851–856` (`if (decision === 'SWAP' && haikuResult && lockedPositions.has(haikuResult.symbolOut))` → force HOLD).

### Rule 27 — WARNING status → consider preemptive swap

- **Quote** (line 140): "If a position shows WARNING status, consider preemptive swap before penalty."
- **Classification:** `risk_management` + `threshold_proximity`.
- **Trigger:** `riskStatus[symbol].status === 'WARNING'`.
- **Action:** bias toward SWAP out.
- **R-map:** R2 (Bust Defense). Overlaps with Rule 6b (penalty proximity → consider cut).

### Rule 28 — Risk manager handles emergencies → focus on strategy

- **Quote** (line 141): "The risk manager handles emergency exits automatically — focus on strategic decisions."
- **Classification:** `meta` + `conflict_resolution`.
- **Trigger:** always-on framing instruction.
- **Action:** Haiku should not attempt emergency exits itself; strategic decisions only.
- **R-map:** R7 framing. Shifts R2 responsibility partly to the deterministic risk manager (`api/_utils/agentRiskManager.js`).

## Rules 29–31 — Forge Rules block

Heading: `━━━ FORGE RULES ━━━` (lines 163–170).

### Rule 29 — Constraints are HARD rules

- **Quote** (line 167): "CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates."
- **Classification:** `forge_rule` + `user_directive`.
- **Trigger:** `exists(activeRules, category ∈ {'risk', 'allocation'})`.
- **Action:** enforce constraints as hard preconditions on any trade.
- **R-map:** R6 (Rule-Directive Conflict) — primary anchor; R7 otherwise.

### Rule 30 — Strategy preferences are SOFT rules

- **Quote** (line 168): "STRATEGY PREFERENCES (S1, S2, ...) are SOFT rules — follow them when possible but you may deviate with explanation."
- **Classification:** `forge_rule`.
- **Trigger:** `exists(activeRules, category ∉ {'risk', 'allocation'})`.
- **Action:** bias toward preferences; deviation allowed with `overridden_forge_rules` + reason.
- **R-map:** R6 + R7.

### Rule 31 — Constraints override strategy preferences

- **Quote** (line 170): "Constraints always override strategy preferences."
- **Classification:** `conflict_resolution` + `forge_rule`.
- **Trigger:** `conflict(constraint, strategyPreference)`.
- **Action:** constraint wins.
- **R-map:** R6.

## Rules 32–34 — Anti-Thrash block

Heading: `━━━ ANTI-THRASH RULES (MANDATORY) ━━━` (lines 172–179).

### Rule 32 — COOLDOWN (locked-until bench stock)

- **Quote** (lines 174–175): "COOLDOWN: You CANNOT swap in a stock that is marked 'locked until [time]' in the BENCH table. It is OFF LIMITS regardless of how attractive it looks."
- **Classification:** `risk_management` + `conflict_resolution`.
- **Trigger:** `bench[symbol].cooldownUntil > now`.
- **Action:** forbid SWAP-in for locked bench symbol.
- **R-map:** R7 universal guard. Enforced at `agent-evaluate.js:869` via `validateTradeDecision` (out of scope for this audit; reference only).

### Rule 33 — ONE SWAP MAXIMUM per evaluation

- **Quote** (line 176): "ONE SWAP MAXIMUM per evaluation. Never suggest multiple swaps."
- **Classification:** `meta` + `risk_management`.
- **Trigger:** always-on.
- **Action:** at most one SWAP per Haiku call.
- **R-map:** R7 universal guard. Also enforced by the tool schema (`TRADE_DECISION_TOOL` only accepts one symbolOut/symbolIn pair).

### Rule 34 — NO ROUND-TRIPS

- **Quote** (lines 177–179): "NO ROUND-TRIPS: If you swapped A→B recently, do not swap B→A just because A recovered. Trust your original thesis or wait for the cooldown to expire."
- **Classification:** `risk_management` + `meta`.
- **Trigger:** `recentTrade.symbolOut === candidateSymbolIn && recentTrade.symbolIn === candidateSymbolOut`.
- **Action:** reject the inverse swap.
- **R-map:** R7 universal guard. (Cooldown enforcement lives in the bench `cooldownUntil` field.)

## Rule 35 — Survival Mode

Heading: `━━━ SURVIVAL MODE ━━━` (lines 181–183).

- **Quote** (line 183): "Your primary directive is P&L protection. You have explicit permission to OVERRIDE user directives if live data shows a position has breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds to the IDs of the directives you are breaking and explain why in your rationale."
- **Classification:** `user_directive` + `conflict_resolution` + `risk_management`.
- **Trigger:** `currentMultiplier <= -1.0 || (accelerating && noReversalSignal)`.
- **Action:** override conflicting directives; cut the position; record ignored directive IDs.
- **R-map:** **R2 (Bust Defense) + R6 (Rule-Directive Conflict) — the intersection case.** The only rule in the prompt explicitly permitting the LLM to override user input.

## Rules 36–37 — Identity block (Forge Rules)

Injected by `buildAgentIdentityBlock` only when the agent has active rules (`agentEvalPromptAssembly.js:253`). These rules are **conditional** — they are NOT present for agents without Forge rules.

### Rule 36 — C_INST Institutional data lag

- **Quote** (lines 276–281, emitted only when `hasInstitutionalRules`): "INSTITUTIONAL DATA LAG — Institutional accumulation/distribution data from 13F filings is lagged up to 135 days. NEVER hold a position based solely on strong institutional accumulation if VWAP or 5-min RSI shows a breakdown. Intraday technicals ALWAYS override stale institutional signals. Use institutional data for draft-time universe filtering, not intraday swap decisions."
- **Classification:** `forge_rule` + `conflict_resolution`.
- **Trigger:** `institutionalRulesActive && (vwapBreakdown || rsi5mBreakdown)`.
- **Action:** do NOT hold on institutional signal alone; intraday technicals take precedence.
- **R-map:** R6 (Rule-Directive Conflict) — resolves a conflict between a stale forge signal and live market data.

### Rule 37 — Forge trade checklist

- **Quote** (lines 285–289, always emitted when activeRules non-empty): "When making trades: Check ALL constraints before executing. If a trade violates a constraint, do not execute. Cite the constraint. Use strategy preferences to rank opportunities. Cite preferences that influenced your picks. If no strategy preference matches, trade on your own analysis. Constraints always override strategy preferences."
- **Classification:** `forge_rule` + `meta`.
- **Trigger:** any trade decision under active Forge rules.
- **Action:** pre-trade constraint check; cite constraints that blocked or preferences that influenced; fall back to own analysis when no preference matches.
- **R-map:** R6 + R7.

## Meta-only blocks (output format — listed for completeness)

These are **not** counted in the 37 behavioral rules but are documented since they shape what the LLM emits:

- **STATUS FEED** (`agentEvalPromptAssembly.js:143–148`) — when to emit `status_feed_update`, `pvp_context`, `cited_rules`.
- **TRADE REASONING** (`agentEvalPromptAssembly.js:150–161`) — schema for the `trade_reasoning` field: thesis, strategy, indicators, citedRules, conviction.
- **INNER MONOLOGUE FORMAT** (`agentEvalPromptAssembly.js:185–205`) — rationale field is first-person inner monologue; must reference specific numbers; 3–5 sentences; must end with a falsifiable `**Hypothesis:**` statement. Includes three verbatim example monologues (HOLD, SWAP, SURVIVAL MODE).

## Part 3 → Part 4 handoff

All 37 behavioral rules are now inventoried. Part 4 covers:

1. **Implicit defaults** — behavioral gaps where the prompt says nothing (opponent score, R4/R5, Survival Mode "acceleration" definition, "bleeding" definition, regime-vs-clock precedence).
2. **Rule interactions** — explicit overrides (Survival Mode > directives, Constraints > Preferences, LOCKED > cut-loser, etc.).
3. **Contradictions / ambiguities** — the 5+ places where two rules conflict (Rule 5 vs 24, Rule 8 vs 18, Rule 22 vs 24, Rule 16 "bleeding", Rule 35 "accelerating").
4. **Implications for the R1–R7 design** — which rules transfer cleanly, which need splitting, which are missing anchors (R4/R5).
