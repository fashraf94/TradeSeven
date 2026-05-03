# Voice Layer Tool Readiness Audit — Part 1 (Requests 1–8)

**Date:** 2026-05-03
**Scope:** Read-only investigation. Per-request mapping of required tools → existing capability → readiness + response-shape risk.
**Branch:** `claude/audit-voice-layer-HMUZg`
**Companion files:** Part 2 (requests 9–15), Part 3 (summary sections)
**Do not commit** (same gitignore convention as `REFLECTION_WRITER_INVESTIGATION.md`).

---

## Conventions

- **GREEN** = all required tools exist and are already callable from the Voice Layer.
- **YELLOW** = capability exists in code but needs a tool wrapper, OR exists in another module (e.g., Forge, agent-evaluate, cron pipeline) and isn't exposed to the Voice Layer surface.
- **RED** = one or more required tools doesn't exist; needs to be built.
- Response-shape risk: **LOW** = output is evidence/observation/data; **MEDIUM** = output includes rankings or conviction scores that need careful prompt-side framing; **HIGH** = output includes explicit verdicts/recommendations that would need a transformation layer.

---

## Request 1 — Pre-market briefing

> Agent opens with: "Three things worth knowing before today's session: [X regime shift], [Y catalyst on a position you hold], [Z sector showing relative strength]."

### Required tools

- **Tool 1**: Market regime classifier (current regime + delta vs prior session).
- **Tool 2**: Calendar of catalysts filtered against the user's current portfolio holdings.
- **Tool 3**: Cross-sector relative-strength scan (which sector is leading today, which is lagging).
- **Tool 4** (architectural): Agent-led "session opener" delivery mechanism (the Voice Layer is currently purely reactive; no first-message-on-entry hook).

### Existing capability

- **Regime classifier** → **Exists, already injected.** `api/_utils/agentRegimeClassifier.js` produces regime + market posture; `api/cron/compute-daily-regime-brief.js` + `api/_utils/dailyRegimeBriefPrompt.js` produce a forward-looking desk-brief paragraph plus `keyEvents[]` and `themes[]`. This is already injected into the Voice Layer prompt as Block 3.5 (anchor) at `voiceLayerPrompt.js:1024`. Regime delta vs prior session is implicit in the brief but not isolated as a structured field.
- **Catalyst-on-holdings join** → **Components exist, join doesn't.** Catalyst data exists in `api/_utils/sonarCatalystFetch.js`, `api/_utils/validatedCatalystCache.js`, `api/week-ahead-events.js`, `api/week-ahead-earnings.js`, and the daily regime brief's `keyEvents[].tickers`. Portfolio holdings exist in `agentBattles/{battleId}.star/core/support`. There is no function or endpoint that intersects the two and returns "catalysts that touch your current positions."
- **Cross-sector relative strength** → **Exists but buried.** `api/_utils/indexIntelligence.js:121–143` (`computeBreadthQuality`) plus index leadership detection (rotation / narrow_participation / small_cap_momentum) — produced nightly in `compute-index-intelligence.js`, stored in Firestore. **Not exposed as a Voice Layer tool.** Voice Layer's pre-cached `marketContext` (voice-layer-cache.js:246–278) includes `topSector` / `worstSector` but not the structured rotation classification.
- **Agent-led opener mechanism** → **Doesn't exist.** `api/agent/chat.js` is purely reactive — POST in / response out. `api/cron/voice-layer-cache.js` warms cache but does not deliver a message. No socket, no push, no on-session-start hook.

### Voice Layer readiness for this request

- **YELLOW** — regime brief is already in. Catalyst-on-holdings needs a thin wrapper (intersect existing catalyst calendar with battle positions). Sector RS needs extraction from `indexIntelligence.js` outputs into a Voice-Layer-callable surface. The harder gap is architectural: there is no "agent-led opener" delivery mechanism. The data could be ready and the prompt could still not produce this interaction without a session-start trigger.

### Response-shape risk

- **LOW.** Daily regime brief is already framed as observation/narrative. Sector RS is structured data. Catalysts are events with `whyItMatters` text — fact-shaped, not verdict-shaped.

### Notes

- The "three things worth knowing" framing is a *delivery* problem, not a *data* problem. Most of the data is already cached for the Voice Layer.
- Architectural gap (proactive surfacing / session opener) is shared with Requests 2, 3, 4 — solving once unlocks four interactions.
- Sector RS extraction is one of the cheapest wrappers on the list.

---

## Request 2 — Mid-battle proactive alert (BaggerBomb threshold proximity)

> Agent says: "MS is sitting 0.07x from the BaggerBomb threshold — want me to make sure we don't accidentally swap it?"

### Required tools

- **Tool 1**: Real-time, quantitative threshold-proximity awareness across all positions (not just qualitative "high ATR" hint).
- **Tool 2**: Proactive surfacing mechanism (agent observes a state change and speaks first, without user prompt).

### Existing capability

- **Quantitative threshold proximity** → **Exists, partially exposed.** `src/utils/baggerBombUtils.js:182–232` (`detectRedZone`) returns `{ targetThreshold, targetMultiple, direction, progress }` per position; swap-lock detection at `baggerBombUtils.js:244–278` returns `{ locked, direction, distancePercent, message }`. `agentScoring.js:97–99` (`calculatePointsServer`) uses the same math. The Voice Layer cache (`voice-layer-cache.js:152`) only surfaces a qualitative `thresholdNote` ("High ATR — could hit thresholds quickly") on `portfolioBriefs[]` — the precise "0.07x from threshold" number is computed inside agent-evaluate / scoring and is not in Voice Layer's prompt.
- **Proactive surfacing** → **Doesn't exist.** Voice Layer is purely reactive (Agent A, voiceLayerPrompt audit, Section C: "No alert or proactive surfacing. Gemma only responds to incoming user message"). There is no callback on score changes, position changes, or volatility spikes. No event bus, no scheduled tick.

### Voice Layer readiness for this request

- **RED.** Quantitative proximity is small to wrap (one new tool around `detectRedZone`). Proactive-surfacing infrastructure is a much larger build: needs an event source (websocket subscription to score/price changes, or a polling cron with thresholding), a dispatch mechanism that triggers a Voice Layer turn, and a prompt mode for "agent-initiated open."

### Response-shape risk

- **LOW.** Threshold proximity is in-game game-mechanic data — explicitly in-bounds under the product stance ("in-game game-mechanic actions can be discussed directly"). The "want me to make sure we don't accidentally swap it" framing is action-confirmation, not advice-giving.

### Notes

- The proactive-surfacing gap is the most architecturally expensive item in the audit. It blocks Requests 1 (pre-market opener), 2 (threshold alert), 3 (bench outperformance flag), and 4 (post-battle observation) — i.e., every agent-led interaction.
- Lock detection (`isSwapLocked`) is already game-mechanically authoritative — a Voice-Layer-safe place to start.

---

## Request 3 — Bench outperformance flag

> Agent says: "MTCH on the bench is up 3.5% today while META is flat. Worth a swap discussion?"

### Required tools

- **Tool 1**: Live bench-vs-active comparison (per-position changePercent for both active and bench slots, with delta).
- **Tool 2**: Conviction-weighted recommendation surfacing.

### Existing capability

- **Live bench-vs-active comparison** → **Partial.** `voice-layer-cache.js:85–174` populates `portfolioBriefs[]` for active positions (changePercent, technicalScore, etc.). `voice-layer-cache.js:181–240` populates `scoutAlerts[]` for watchlist opportunities (rs_breakout, volume_surge, game_fit) — but "scout / watchlist" is broader than the user's drafted bench specifically. There is no structured `bench[]` array with per-position changePercent in the Voice Layer cache, and no comparison/delta tool.
- **Conviction-weighted recommendation** → **Exists in scoring loop, verdict-shaped.** Tier multipliers (Star 2x, Core 1.5x, Support 1x) live in `agentScoring.js:114–190`. Agent-evaluate produces `SWAP / HOLD` directives with explicit conviction scores (`agentEvalToolSchema.js:4–148` — "SWAP conviction 82%; symbolOut INTC → symbolIn AVGO"). This output is **explicitly verdict-shaped** and would not be Voice-Layer-safe without transformation.

### Voice Layer readiness for this request

- **YELLOW.** Bench data is partially cached in scout alerts but not as a clean bench-vs-active comparison. The "swap recommendation" capability exists in agent-evaluate's scoring loop but its raw output is verdict-shaped. To be Voice-Layer-safe, it needs both wrapping (to surface the comparison) and transformation (to strip verdict framing in favor of observation framing).

### Response-shape risk

- **MEDIUM-to-HIGH.** Existing scoring output ("SWAP conviction 82%") is high-risk if surfaced raw. The product-stance-compliant version is observation-shaped: "MTCH is up 3.5% while META is flat — want to dig in?" — which is mostly a prompt-side framing problem on top of a clean delta tool. The conviction scoring would need to be hidden or recast as "I'm noticing this contrast" rather than "I recommend the swap."

### Notes

- Per the product stance, the *swap action itself* is in-game (game-mechanic), but the *judgment about whether to swap* is out-of-game (research/exploration). The agent should surface the contrast and invite a joint look — not deliver a verdict.
- The `scoutAlerts[].relevance` field already includes a ranking-shaped signal — that's a small risk vector to be careful about in prompt design.

---

## Request 4 — Post-battle pattern observation

> Agent says: "We've held through three consecutive bench-outperformance signals this week and been right each time. Building conviction in your patience here."

### Required tools

- **Tool 1**: Cross-battle pattern recognition — read recent battle history.
- **Tool 2**: Behavioral pattern extractor (specific patterns: "held through bench signals," "patience under drawdown," "preset-switching under pressure," etc.).

### Existing capability

- **Per-battle logging** → **Exists.** `api/_utils/battlePatternLogger.js:15–71` (`logBattlePattern`) writes per-battle records to the `agent.battlePatterns` subcollection: activeRuleIds, executionMode (with history), strategyPreset (with history), threshold hits/penalties, market regime context. This logging is functioning.
- **Cross-battle aggregation / query** → **Doesn't exist.** No endpoint or function reads `agent.battlePatterns` for the last N battles and synthesizes trends. `api/_utils/agentReflectionUtils.js` exists and handles reflection synthesis at the per-battle level but does not aggregate across battles.
- **Behavioral pattern extractors** → **Don't exist as named primitives.** "Held through bench-outperformance signal" specifically requires joining bench-vs-active history with veto/no-action records — and there is no veto-event capture in the codebase (see Request 15).

### Voice Layer readiness for this request

- **RED.** The raw log exists; the aggregation layer, the named pattern detectors, and the upstream signal (veto capture) all need to be built. This is also where Sprint 2's conviction/partner writers will pull their inputs from — the build is not a Voice-Layer-only investment.

### Response-shape risk

- **LOW.** Pattern observations are inherently evidence-shaped when framed as "here's what I'm seeing in your behavior" rather than "you should keep doing this." The "building conviction in your patience" framing in the example is exactly the right shape.

### Notes

- This is the highest-leverage build on the list because it feeds both the Voice Layer warmth target (agent recognizing the user's style) AND Sprint 2's writer inputs.
- Requires Request 15 (veto capture) to land first if "held through signal" is to mean anything more than "didn't swap."

---

## Request 5 — Technical screen (oversold large caps + momentum divergence)

> "Find me three oversold large caps with positive momentum divergence."

### Required tools

- **Tool 1**: Universe filter by market cap.
- **Tool 2**: Technical indicator filter (RSI / momentum thresholds).
- **Tool 3**: Divergence detector (price vs RSI/momentum direction over a window).

### Existing capability

- **Universe filter by market cap** → **Data exists, no filter API.** Market cap data is present in `api/_utils/stockIntelligenceData.js` (550KB blob) and elsewhere; there is no endpoint or function that returns "stocks with marketCap > X."
- **RSI / momentum filter** → **Components exist, no filter API.** `api/_utils/technicalCalculations.js` computes RSI, ATR, SMA per stock. `api/_utils/momentumScoring.js:451–568` (`computeMomentumRankings`) produces per-stock momentum scores (residual momentum, intermediate RS, acceleration, KER, fip, turnover momentum) — stored nightly in the `stockRankings` collection by `compute-rankings.js`. Not exposed as a queryable filter; consumers (agent-evaluate) read the whole table and filter in-process.
- **Divergence detection** → **Doesn't exist.** No function compares price direction vs RSI/momentum direction over a rolling window. Would be net-new logic.

### Voice Layer readiness for this request

- **RED.** All three components either need extraction (market cap filter, RSI/momentum filter on top of stored rankings) or net-new build (divergence). Build cost is medium — the underlying indicator data is ready, the screening API is not.

### Response-shape risk

- **LOW.** Screening output is data: a list of tickers matching criteria. Voice Layer can frame as "here are three I'm seeing" — observation-shaped by default.

### Notes

- This is the canonical user-led research interaction and is currently impossible. Build effort is concentrated on a generic universe-screener API that would also serve Requests 6 and 9.
- Divergence is the most novel piece — not in the codebase at all.

---

## Request 6 — Fundamental screen (high-ARCH under 200DMA)

> "Show me high-ARCH stocks under their 200DMA — value setups in trending names."

### Required tools

- **Tool 1**: ARCH score query (filter by archetype score).
- **Tool 2**: Technical condition (price relative to 200DMA).
- **Tool 3**: Result ranking.

### Existing capability

- **ARCH score** → **Computed but ephemeral.** `api/_utils/archetypeScoring.js:107–141` (`computeArchetypeRankings`) computes ARCH per archetype (momentum_chaser, contrarian, diversifier, degen, analyst, guardian) as a weighted blend of fundamentalScore, technicalScore, baggerBombFit, atrPercentile, inverseComposite, sectorDiversity. **Not persisted** — computed in-memory per agent shortlist generation in `api/agent/strategy.js`. There is no `arch_score` field in `stockRankings`, no historical series, no filter index.
- **200DMA condition** → **Computable, not stored.** `technicalCalculations.js` can compute SMA. `stockRankings` does not currently include a 200DMA field or a "price vs 200DMA" boolean (per Agent C inventory of stockRankings metadata).
- **Result ranking** → Trivial once the prior two exist.

### Voice Layer readiness for this request

- **RED.** Two of three required inputs (persisted ARCH, stored 200DMA position) don't exist. Filter API doesn't exist. Build cost: medium-large because it touches the ranking-storage schema and the cron that populates it.

### Response-shape risk

- **MEDIUM.** ARCH is itself a ranking score; surfacing it raw is verdict-shaped ("high-ARCH = good"). Voice-Layer-safe framing needs to recast it as "stocks fitting your archetype's profile" — observation about fit, not verdict about quality. This is a prompt-side framing problem on top of a real tool gap.

### Notes

- ARCH being archetype-specific is a feature-or-bug depending on framing. It can be a clean way to anchor research in the user's agent identity ("here's what fits your read") or it can confuse the user who doesn't think of themselves as "an analyst archetype."
- Persisting ARCH is the lowest-cost piece — it's already computed in pipelines.

---

## Request 7 — Thematic screen (energy transition working now)

> "What's working in the energy transition theme right now?"

### Required tools

- **Tool 1**: Thematic taxonomy lookup (theme → tickers).
- **Tool 2**: Recent performance overlay on theme constituents.
- **Tool 3**: Narrative synthesis layer.

### Existing capability

- **Thematic taxonomy** → **Data exists, UI-locked.** `/dkb/thematic/` contains 8 JSON files (ai-infrastructure-buildout, reshoring, energy-transition, aging-demographics, housing-cycle, consumer-bifurcation, cybersecurity-buildout, dollar-strength-regimes), all seeded to the `discoverThemes` Firestore collection via `scripts/seed-discover-themes.js:184–226`. Each entry has full structure: `tagline`, `chain.layers`, `tickerEcosystem.{primary, secondary, adjacent}`, `subAngles`, `workshopSeedPrompt`. Currently consumed by the Discover Tab UI directly from Firestore. **No backend query endpoint** — confirmed search of `api/discover/` returned only `current-events.js`. The Voice Layer prompt does not inject thematic context.
- **Recent performance overlay** → **Achievable, not built.** EODHD provides per-ticker prices; `voice-layer-cache.js` already pulls position prices. Theme-level performance (e.g., equal-weight basket return for the theme's primary tickers) does not exist as a function.
- **Narrative synthesis** → **DKB entries already supply the narrative material.** `tagline`, `chain`, `subAngles` are pre-written narrative blocks ready to drop into a Voice Layer response.

### Voice Layer readiness for this request

- **YELLOW.** Data is in Firestore. Narrative is pre-written. The single missing piece is a `stocks-by-theme` query endpoint plus a thin performance overlay. Build cost: small-to-medium. This directly answers the user's audit question — *"thematic DKB entries are uploaded; whether they're accessible from the Voice Layer surface is part of what this audit needs to determine"* — answer: **NOT currently accessible to the Voice Layer.**

### Response-shape risk

- **LOW.** Theme-level analysis is naturally observation/narrative-shaped. The DKB taglines and chain layers are already evidence-toned, not advice-toned.

### Notes

- This is the cleanest "data exists, just needs plumbing" item on the entire list.
- Once the stocks-by-theme endpoint exists, the Voice Layer can also do thematic context injection at session start — adjacent capability, free win.
- Quant/macro DKB entries are confirmed not present (only thematic) — this request would not be blocked by that gap.

---

## Request 8 — Sector rotation read (institutional accumulation)

> "Which sectors are showing institutional accumulation this week?"

### Required tools

- **Tool 1**: Sector-level rotation analysis.
- **Tool 2**: Institutional flow data.

### Existing capability

- **Sector rotation analysis** → **Exists, not exposed.** `api/_utils/indexIntelligence.js:121–143` (`computeBreadthQuality`) and the sector leadership detection in the same module produce signals like `rotation`, `narrow_participation`, `small_cap_momentum`. `api/_utils/storySignals.js` has theme cluster detection. Stored in Firestore via `compute-index-intelligence.js` cron. Not wired into the Voice Layer prompt or accessible via tool.
- **Institutional flow data** → **Exists, not exposed.** `api/_utils/institutionalIntelligence.js:247–360` (`generateStorylines` + `generateHeroHeadline`) produces narratives: cluster buy signals (3+ institutions entering), new positions (Berkshire / Fidelity / ARK), exits, high-conviction accumulation (>5% portfolio weight + increasing), significant trimming (>10% by a major holder), sector rotation hero headline ("Smart money rotating out of Finance into Tech"). Conviction levels: `strong_accumulation`, `mild_accumulation`, `neutral`, `mild_distribution`, `strong_distribution` (`institutionalIntelligence.js:130–153`). Storylines are generated but **not delivered to the Voice Layer.**

### Voice Layer readiness for this request

- **YELLOW.** Both pieces exist as fully-formed analyses; neither is wrapped as a Voice Layer tool. Build cost is small — the narratives are already produced and just need a query/read surface.

### Response-shape risk

- **MEDIUM.** Institutional intelligence outputs are conviction-tagged (`strong_accumulation`, `strong_distribution`) and ranked by priority (60–90). Surfaced raw, the framing edges into "smart money is buying X — you should too." Voice-Layer-safe framing: "I'm seeing cluster accumulation in [sector] this week — three institutions have entered new positions" — keep the observation, drop the implied verdict.

### Notes

- Answering the user's direct sub-question — *"institutional flow data — do you have this?"* — yes, the codebase has a substantial institutional-intelligence module (`institutionalIntelligence.js`, ~25KB) that is functioning and producing storylines today. It is simply not connected to the Voice Layer.
- Of the four "exists in another module, not wired to Voice Layer" items in this audit, this is the largest cached body of analysis going to waste.

---

**End of Part 1.** Pausing for confirmation before writing Part 2 (requests 9–15).
