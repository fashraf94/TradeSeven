# Voice Layer Tool Readiness Audit — Part 2 (Requests 9–15)

**Date:** 2026-05-03
**Scope:** Read-only investigation. Per-request mapping of required tools → existing capability → readiness + response-shape risk.
**Branch:** `claude/audit-voice-layer-HMUZg`
**Companion files:** Part 1 (requests 1–8), Part 3 (summary sections)
**Do not commit** (gitignored).

---

## Conventions (carried from Part 1)

- **GREEN / YELLOW / RED** — readiness for Voice Layer surfacing.
- For YELLOW, Notes distinguish **thin wrapper** (clean output, just needs an endpoint) vs **wrapper + transformation** (output exists but needs reshaping to be product-stance-compliant) vs **prompt-design** (data is in, conditional logic shallow).
- Response-shape risk: **LOW / MEDIUM / HIGH** based on whether existing output is evidence-shaped, ranking-shaped, or verdict-shaped.

---

## Request 9 — Game-state-aware screen

> "We're down 25 with 4 hours left — find me aggressive plays that could close the gap."

### Required tools

- **Tool 1**: Live point-differential read (current).
- **Tool 2**: Remaining-time read (current session, current battle).
- **Tool 3**: ATR / volatility threshold filter (high-ATR universe).
- **Tool 4**: Risk-profile shift logic (when behind + late, expand acceptable risk band).
- **Tool 5**: Candidate universe to screen against (bench + scout alerts + broader universe).

### Existing capability

- **Point differential & remaining time** → **Already in the Voice Layer prompt.** `currentScore` / `opponentScore` / `timeRemaining` are read fresh per-turn from `agentBattles/{battleId}` and injected at `voiceLayerPrompt.js:574–576`. Caveat: fresh only on user message — no streaming.
- **ATR / volatility data** → **Exists, partially exposed.** `technicalCalculations.js:234–272` (`calculateATR`) returns `{ value, percent, regime: 'extreme' | 'high' | 'normal' | 'low' }`. Active positions surface `atrPercent` via `portfolioBriefs[]` (`voice-layer-cache.js:85–174`). Universe-wide ATR ranking is computed nightly into `stockRankings` but not exposed as a filter API.
- **Risk-profile shift logic** → **Exists in agent-evaluate, not in Voice Layer.** `agentRiskManager.js` (`evaluateRisk`, `pickEmergencyReplacement`) computes `low | medium | high` risk bands and uses them internally to gate swap proposals. `agentNewsContext.js:78–112` (`computeGameContext`) computes `urgency: 'high' if lastDay + score <-10`. None of this branching is in the Voice Layer prompt.
- **Candidate universe** → **Bench is structured but uncached.** `agentBattles.portfolio.bench = { stocks, crypto }` exists in Firestore. `agentEvalPromptAssembly.js:696` (`flattenBenchServer`) and `:873` (`buildBenchCSV`) consume it for Haiku. **Voice Layer cache (`voice-layer-cache.js`) does not include bench** — only active positions (`portfolioBriefs[]`) and watchlist scout alerts (`scoutAlerts[]`). Bench would need to be added to the cache or fetched live by a tool. Broader-universe screening (beyond bench) requires the same screener gap as Request 5.

### Voice Layer readiness for this request

- **YELLOW.** All inputs exist somewhere; the composite "aggressive plays for late-game catch-up" filter does not. Two things are needed: (a) bench data added to Voice Layer cache or accessible via tool, (b) a composite filter that combines high-ATR + high-momentum candidates against the bench/scout/universe, (c) prompt-side conditional logic so the agent recognizes "down 25 + 4h left" as triggering an "aggressive frame" rather than treating the question generically.

### Response-shape risk

- **MEDIUM.** Game-state framing (down X / time Y) is in-game game-mechanic territory and is in-bounds per the product stance. The risky surface is "aggressive plays" — if the screener returns ranked candidates with conviction scores, that drifts toward verdict. Voice-Layer-safe framing: "given the game frame (down 25, 4h left), here are three high-ATR setups visible right now — let's look at which fits your read."

### Notes

- **YELLOW classification: wrapper + transformation.** The composite filter is non-trivial (combines three data sources + new "late-game urgency" rule logic) AND its output needs framing care to avoid sounding like recommendations.
- Bench data being unavailable to the Voice Layer is a recurring blocker (also Request 3). Adding bench to `voice-layer-cache.js`'s `portfolioBriefs` build is a small standalone improvement — would unlock multiple requests at once.
- The `urgency` flag in `agentNewsContext.js` already exists as a primitive — could be lifted into the Voice Layer prompt as a structured input (alongside score / time) without much work.

---

## Request 10 — Single-ticker deep dive

> "Should I trust this NEE setup?"

### Required tools

- **Tool 1**: Per-ticker context bundle: technical + fundamental + news + regime fit + position-tier appropriateness.

### Existing capability

- **All components exist; assembly is buried inside agent-evaluate.** `api/_utils/agentEvalPromptAssembly.js` (`buildLiveContextBlock`) assembles a per-position narrative block (~300 tokens) with: technical positioning (SMA, RSI, VWAP), recent momentum, volatility regime, nearest threshold, news context (recent catalysts + matched Forge rules), scoring (current multiplier, badges, baseATR), regime fit (per-stock regime + market posture alignment), ranking metrics (fundamentalScore, technicalScore, baggerBombFit, atrPercentile). This assembly is built per-turn for Haiku's decision context — not exposed as a standalone tool, not callable from Voice Layer.
- **Underlying data sources** all exist: `technicalCalculations.js` (technicals), `stockRankings` Firestore collection (fundamentals), `sonarCatalystFetch.js` + `validatedCatalystCache.js` + `agentNewsContext.js` (news + catalysts), `agentRegimeClassifier.js` (per-stock regime), tier multipliers in `agentScoring.js`.
- **What "trust this setup" implies** → an evaluative judgment. The agent-evaluate version of this answers it with a SWAP/HOLD verdict + conviction score (`agentEvalToolSchema.js:4–148`) — explicitly verdict-shaped output that is **not** Voice-Layer-safe under the product stance.

### Voice Layer readiness for this request

- **YELLOW.** All ingredients exist; the assembly exists in code (just for a different consumer); a Voice-Layer-callable per-ticker deep-dive tool needs to be wrapped, AND the output needs transformation from "verdict + conviction" to "here's what's lining up for and against this setup."

### Response-shape risk

- **HIGH.** This is the request that most directly invites a verdict ("should I trust"), and the closest existing capability (agent-evaluate's per-ticker context block) feeds a verdict pipeline. Surfacing the raw context block is fine; surfacing the verdict overlay is not. Transformation: drop the SWAP conviction layer; keep the technical / fundamental / news / regime-fit observations; add explicit framing of what would invalidate the setup (mirrors the `invalidationConditions[]` pattern from Forge's Signal Expansion mode at `voiceLayerPrompt.js:408–456`).

### Notes

- **YELLOW classification: wrapper + heavy transformation.** Wrapping `buildLiveContextBlock` is small. The transformation work — extracting the evidence layer cleanly from the verdict layer — is real and product-defining.
- This is the highest-value research interaction in the audit. Getting it right shapes how the entire Voice Layer reads on substantive ticker questions.
- The `invalidationConditions[]` pattern from Signal Expansion is the strongest Voice-Layer-safe model already living in the codebase. Worth borrowing wholesale.

---

## Request 11 — Thesis pressure test

> "I think semis are due for a reversion. Talk me through whether that holds up."

### Required tools

- **Tool 1**: Thesis parser (extract claim, asset class / sector, direction, timeframe).
- **Tool 2**: Evidence retriever — pull supporting and contradicting signals across technical, fundamental, news, thematic, and macro layers.
- **Tool 3**: Pro/contra synthesis — present both sides honestly without picking a side.

### Existing capability

- **Thesis parser** → **Doesn't exist as a standalone primitive.** Forge's Signal Expansion (`api/forge/expand-signal.js` + `voiceLayerPrompt.js:408–456` Signal Expansion mode) does something adjacent: it takes a parsed signal and produces `{ thesisSummary, apparentDriver, relatedTickers, invalidationConditions, confidence }`. But it's input-shaped for signals, not user-stated theses, and is gated to Forge's UI flow.
- **Evidence retrieval across layers** → **Components exist, no aggregator.** Sector data: `indexIntelligence.js`. News: `agentNewsContext.js` + Sonar catalysts. Thematic: `discoverThemes` (8 thematic DKB entries — including no semi-specific theme; closest are AI infrastructure and reshoring). Macro: **NOT uploaded** (per user, quant/macro DKB entries are deferred work). Technical / momentum: `momentumScoring.js` + `technicalCalculations.js`. None of these is reachable from a single "give me everything for/against this thesis" call.
- **Pro/contra synthesis** → **The pattern exists in Signal Expansion's `invalidationConditions[]` framing** but is not a generalized primitive. No code today takes "X is due for a reversion" and returns "here's why it might / here's why it might not."

### Voice Layer readiness for this request

- **RED.** Thesis pressure-testing is one of the cleanest expressions of the product stance ("research and idea-exploration tool, not financial advisor") — and it doesn't exist as a tool. The closest infrastructure (Signal Expansion) is mode-locked to Forge and parses signals, not user theses. Build cost: large (parsing + multi-source retrieval + synthesis). Macro evidence layer is partially blocked by deferred quant/macro DKB work.

### Response-shape risk

- **LOW once built.** "Here's what supports your read; here's what argues against it" is naturally evidence-shaped and is the canonical example of product-stance-compliant agent behavior.

### Notes

- This is the single most product-defining capability missing from the Voice Layer. The product stance is essentially "the agent is good at thesis pressure-testing" — and there is no thesis pressure-test tool.
- Macro layer dependence on deferred DKB entries means the *full* version of this is gated on Sprint-X uploading quant/macro entries. A *partial* version (thematic + technical + news, no macro) is buildable today but would feel hollow on macro-heavy theses (like "semis reversion," which is partly a macro/cycle call).
- Reusing Signal Expansion's `invalidationConditions[]` schema is the right design starting point.

---

## Request 12 — Risk audit

> "What's our biggest risk right now?"

### Required tools

- **Tool 1**: Concentration analysis (single-ticker weight, sector weight).
- **Tool 2**: Sector beta / market-correlation snapshot.
- **Tool 3**: Threshold exposure aggregator (how many positions near downside thresholds).
- **Tool 4**: Regime-fit mismatch detector (positions whose stock-level regime doesn't match the market regime).
- **Tool 5**: Synthesis — combine into a portfolio-wide risk narrative.

### Existing capability

- **Concentration** → **Computable, not built.** Position weights are derivable from `agentBattles.portfolio` + tier multipliers. No function does it today.
- **Sector beta / correlation** → **Not found.** Sector data exists per ticker in `stockIntelligenceData.js`; beta is not a tracked field; portfolio-level beta is not computed.
- **Threshold exposure aggregator** → **Per-position primitive exists (Request 2); aggregator doesn't.** `detectRedZone` (`baggerBombUtils.js:182–232`) is per-position. No "how many of your positions are within Xx of a downside threshold" rollup.
- **Regime-fit mismatch** → **Per-stock primitive exists; portfolio mismatch aggregator doesn't.** `agentRegimeClassifier.js:25–112` produces per-stock regime + market posture; agent-evaluate uses internally to flag distressed positions. No portfolio-wide "X of your N positions are misfit to the current regime" summary.
- **Synthesis** → `agentRiskManager.js` (`evaluateRisk`) returns `low | medium | high` for swap-decision contexts — a single-bucket label, not a narrative breakdown.

### Voice Layer readiness for this request

- **RED.** Each component is ~50% built (per-position primitives mostly exist; aggregations and synthesis don't). Sector beta is the only missing ground-truth data point. Build cost: medium — mostly aggregation glue around existing primitives, plus one new stat (sector beta) that needs a data source.

### Response-shape risk

- **LOW.** Risk synthesis is naturally evidence-shaped: "you're 60% in tech, three positions sitting within 0.3x of downside thresholds, and your two largest positions are misfit to the current choppy regime." Facts, not advice.

### Notes

- This is the **highest product-stance-compliant return per build dollar** in the audit. Components exist; aggregation is mechanical; output is naturally observation-shaped.
- It's also a perfect demonstration surface for the "research tool, not advisor" stance — the agent can be substantively useful (here is your concrete risk exposure) without ever telling the user what to do about it.
- Worth bundling with Request 11's evidence retriever — the same multi-layer aggregation infrastructure serves both.

---

## Request 13 — Score-aware advice

> User says "what should I be focused on right now?" Agent's answer should differ meaningfully if you're +50 vs. -20 vs. tied.

### Required tools

- **Tool 1**: Live score read.
- **Tool 2**: Conditional logic in the prompt about what matters at different point states.

### Existing capability

- **Live score read** → **Already in the Voice Layer prompt.** `currentScore` / `opponentScore` injected at `voiceLayerPrompt.js:574`.
- **Conditional logic about score states** → **Partially exists, shallow.** `voiceLayerPrompt.js:383–389` (Block 3.6 state-triggered) has "GAME THEORY: Leading by 50+..." with limited branching. Not fully fleshed for the "+50 vs -20 vs tied" spectrum. `agentNewsContext.js:78–112` computes `gameState` + `urgency` flags that could feed structured branches, but those flags are not in the Voice Layer prompt today.

### Voice Layer readiness for this request

- **YELLOW.** Score data is in. The gap is primarily a prompt-design problem: the conditional templates need to be richer (lead-protect frame vs urgency frame vs neutral frame, each with corresponding focus areas). A small data add (lift `gameState` / `urgency` from `agentNewsContext` into the prompt) helps the model reason about the frame rather than re-deriving from raw score every turn.

### Response-shape risk

- **LOW.** Game-state framing is in-game game-mechanic territory per the product stance — "you're leading, focus on protecting your high-tier positions" is a game observation, not financial advice.

### Notes

- **YELLOW classification: prompt-design + small data lift.** No new tools needed; existing primitives just need to be wired into the prompt and the prompt's conditional-logic blocks need to be rewritten with more depth. Cheapest YELLOW on the list.
- Bundles naturally with Request 14 (time-aware) — same prompt-design effort.

---

## Request 14 — Time-aware recommendation

> "Should we make a move?" Agent's answer should differ at hour 1 vs. hour 7.

### Required tools

- **Tool 1**: Remaining-time read.
- **Tool 2**: Conditional logic about late-game vs early-game decision frames.

### Existing capability

- **Remaining-time read** → **Already in the Voice Layer prompt.** `timeRemaining` injected at `voiceLayerPrompt.js:576`. `marketOpen` boolean at line 575.
- **Conditional logic about time frames** → **Shallow in the prompt, richer outside.** `battle-commentary.js:143–155` enriches battle state with session timing + urgency triggers. The example response at `agentEvalPromptAssembly.js:199` ("with only 1h 45m left in the trading day, a new position won't have time to reach the 1.0x ATR bonus. I'm holding.") shows the kind of late-game frame the *agent-evaluate* prompt encodes — but the Voice Layer prompt doesn't have analogous early-vs-late templates.

### Voice Layer readiness for this request

- **YELLOW.** Same shape as Request 13 — data is in, prompt needs richer conditional templates. The time-frame logic exists in `agentEvalPromptAssembly.js`'s few-shot examples and could be ported to the Voice Layer prompt directly.

### Response-shape risk

- **LOW.** Time-frame framing is in-game game-mechanic; surfacing "with 4 hours left, even a successful new position has limited runway to compound" is observational.

### Notes

- **YELLOW classification: prompt-design.** No new tools. Same effort bucket as Request 13 — combine into one prompt-rework pass.
- The `agentEvalPromptAssembly.js:199` example is essentially a reusable template — port it.

---

## Request 15 — Veto follow-up

> When user vetoes an agent proposal, agent asks: "Want to tell me why? I'd rather understand your read than just back off."

### Required tools

- **Tool 1**: Veto-event hook (UI signals when user declines a proposal — distinct from "no response" or "different topic").
- **Tool 2**: Server-side capture endpoint to log veto + structured reason.
- **Tool 3**: Voice Layer prompt mode for "user just declined X — ask why" (conversational follow-up).
- **Tool 4**: Storage / aggregation surface for downstream Sprint 2 writers to consume.

### Existing capability

- **Veto-event hook** → **DOES NOT EXIST anywhere in the codebase.** Verified across UI components and API. `agentBattles` writes track *executed* trades but not *declined* proposals. Per Agent A's audit (Section C): "When user declines a proposal (doesn't click button, says 'no'), there is NO special capture of their reasoning. The message history passes forward; the elicitation dimension selection shifts (`chat.js:379` `recentElicitationTargets: [...].slice(-3)`), but no explicit 'user rejected X because...' logging."
- **Capture endpoint** → Doesn't exist (depends on hook).
- **Prompt mode** → Doesn't exist. The Voice Layer prompt has no "follow up on a veto" template; it has phase rules (Discovery / Refinement / Mastery) and mode rules (battle / review / workshop / signal-expansion) but nothing keyed to "the user just said no to your last proposal."
- **Storage / aggregation** → No collection or document field for veto reasons exists. No reflection or pattern-extraction passes consume veto data because there's no veto data.

### Voice Layer readiness for this request

- **RED.** Every layer is missing: UI hook, server endpoint, prompt mode, storage. Build cost: medium overall but spread across UI, API, prompt, and Firestore — cross-cutting, multiple touchpoints.

### Response-shape risk

- **LOW.** The follow-up text itself ("I'd rather understand your read than just back off") is purely conversational and warm-by-construction. No verdict surface.

### Notes

- **This is the most consequential gap for Sprint 2.** The conviction and partner writers in Sprint 2 are predicated on having signal about user reasoning. Without veto capture, the writers have execution data only ("user accepted swap" / "user did not accept swap") — they can't access the *why*, which is the entire point of conviction extraction.
- Cross-cuts with Request 4 (post-battle pattern observation): "we've held through three bench-outperformance signals" requires veto/declination data to be meaningful — otherwise "held" is indistinguishable from "didn't see the alert."
- Lowest-effort partial win: even a free-text "what made you decide that?" follow-up *with no structured capture* would feed conversation transcripts that downstream writers (or analysts) could mine. The structured capture is the durable version, but the warm follow-up itself is purely a prompt change.
- Recommend treating this as the **first priority Sprint 2 dependency.** Without it, conviction-writer inputs are shallow.

---

**End of Part 2.** Pausing for confirmation before writing Part 3 (eight summary sections: aggregate readiness, tool gap inventory, wrapper inventory, response-shape risk inventory, conversational warmth assessment, architectural observations, deferred-work dependencies, recommendation).
