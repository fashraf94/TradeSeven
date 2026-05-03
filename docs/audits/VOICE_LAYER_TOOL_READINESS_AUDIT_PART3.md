# Voice Layer Tool Readiness Audit — Part 3 (Summary Sections)

**Date:** 2026-05-03
**Scope:** Read-only investigation. Aggregate findings, gap inventories, conversational warmth assessment, architectural observations, deferred-work dependencies, recommendation.
**Branch:** `claude/audit-voice-layer-HMUZg`
**Companion files:** Part 1 (requests 1–8), Part 2 (requests 9–15)
**Do not commit** (gitignored).

---

## 1. Aggregate readiness

Across 15 requests:

- **GREEN**: 0
- **YELLOW**: 8 — Requests 1, 3, 7, 8, 9, 10, 13, 14
- **RED**: 7 — Requests 2, 4, 5, 6, 11, 12, 15

**Read of the aggregate:** Zero requests are fully ready as-is. The Voice Layer cannot satisfy the agent-led / research-direction / analytical workload described in the 15 representative interactions without engineering work. The split between YELLOW (capability exists somewhere, needs exposure / wrapping / transformation) and RED (capability does not exist anywhere) is roughly 53 / 47 — meaning roughly half the build is exposure work on existing capability and half is net-new construction.

**YELLOW is not a uniform effort tier.** Of the 8 YELLOWs:
- **Prompt-design only** (no tool work): 13, 14 (score- and time-conditional templates).
- **Thin wrapper around clean output** (small backend lift): 7, 8 (theme-stocks query, institutional intelligence query).
- **Wrapper + transformation** (output exists in verdict-shaped form, needs reshaping): 1 (catalyst-on-holdings join), 3 (bench-vs-active), 9 (composite late-game filter), 10 (single-ticker deep dive — the heaviest transformation in the set).

**RED is also not uniform.** Of the 7 REDs:
- **Aggregation around existing primitives** (mechanical glue): 4 (battle-pattern aggregator), 12 (risk synthesis).
- **Net-new analytical capability**: 5 (divergence detector + universe screener), 6 (persisted ARCH + 200DMA storage), 11 (thesis pressure-test).
- **Cross-cutting infrastructure**: 2 (proactive surfacing — affects multiple requests), 15 (veto event capture — UI + API + prompt + storage).

---

## 2. Tool gap inventory ("doesn't exist" — priority order)

Priority weighting: (a) Sprint 2 dependency, (b) product-stance ROI, (c) blast radius across multiple requests, (d) current obstruction depth.

| # | Tool | Affected requests | Why this priority |
|---|------|-------------------|-------------------|
| 1 | **Veto event capture** (UI hook → server endpoint → prompt mode → Firestore field) | 15, 4 | Sprint 2 hard prerequisite. Without it, conviction & partner writers have execution-only signal. Cross-cutting. |
| 2 | **Cross-battle pattern aggregator** (reads `agent.battlePatterns`, synthesizes N-game trends) | 4, plus Sprint 2 conviction writer | Sprint 2 soft prerequisite. Pattern logging exists; aggregation does not. |
| 3 | **Portfolio risk synthesis tool** (concentration + threshold exposure + regime mismatch) | 12 | Highest product-stance ROI in the audit — observation-shaped output by construction. Components mostly exist. |
| 4 | **Universe screener API** (market-cap + technical condition filters; reads from `stockRankings`) | 5, 6, 9 | Unblocks all three user-led research-direction screens. |
| 5 | **Single-ticker deep-dive tool** (re-exposes `buildLiveContextBlock` with verdict layer stripped) | 10 | Most product-stance-defining surface. Transformation work matters more than wrapping. |
| 6 | **Divergence detector** (price vs RSI/momentum direction over rolling window) | 5 | Net-new analytical primitive. Reasonable scope. |
| 7 | **Persisted ARCH score** (per archetype × date in Firestore) | 6 | Computation exists in-memory; just needs a write path in `compute-rankings.js` cron. |
| 8 | **200DMA position field** in `stockRankings` | 6 | One-line addition to the cron's stored shape. |
| 9 | **Sector beta / market-correlation field** | 12 | Net-new data point. Not blocking; risk audit can ship without it and add it later. |
| 10 | **Thesis pressure-test tool** (parser + multi-source evidence retrieval + pro/contra synthesis) | 11 | Largest analytical build. Macro layer partially blocked by deferred quant/macro DKB. |
| 11 | **Proactive surfacing infrastructure** (event source + dispatcher + agent-led prompt mode) | 1, 2, 3, 4 (agent-led versions) | Largest architectural build. Blocks every agent-led request mode. |

---

## 3. Wrapper inventory ("exists but needs wrapping" — including Forge-side capability not Voice-Layer-callable)

Each row: capability that exists in the codebase but is not currently callable from the Voice Layer.

| Capability | Lives at | Current consumer | Wrapper effort |
|------------|----------|------------------|----------------|
| **Stocks-by-theme query** | `/dkb/thematic/` (8 entries) → `discoverThemes` Firestore collection (seeded by `scripts/seed-discover-themes.js:184–226`) | Discover Tab UI only | **Afternoon.** New endpoint reads collection by themeId, returns primary/secondary/adjacent tickers + DKB narrative blocks. |
| **Theme performance overlay** | EODHD per-ticker prices already pulled by `voice-layer-cache.js`; theme tickers from above | None (would be new) | **Afternoon.** Equal-weight basket return per theme, joins to ticker list. |
| **Institutional flow / sector rotation storylines** | `api/_utils/institutionalIntelligence.js:247–360` (`generateStorylines` + `generateHeroHeadline`) | Generated nightly, written to Firestore for UI; not in Voice Layer prompt | **Few days.** Wrapper to pull priority-ranked storylines for a date; needs prompt-side transformation to drop conviction-tagged framing (`strong_accumulation` → "I'm seeing cluster accumulation"). |
| **Cross-sector relative strength** | `api/_utils/indexIntelligence.js:121–143` (`computeBreadthQuality`) + sector leadership classifier | Internal to index intelligence cron | **Day or two.** Extract structured rotation classification. |
| **Threshold proximity (quantitative, all-positions)** | `src/utils/baggerBombUtils.js:182–232` (`detectRedZone`); `agentScoring.js:97–99` | Used inside agent-evaluate; only qualitative `thresholdNote` reaches Voice Layer | **Few hours.** Map across positions, return `[{ symbol, targetThreshold, progress, direction }]`. |
| **Bench data exposure** | `agentBattles.portfolio.bench` (Firestore); `agentEvalPromptAssembly.js:696` flattener already exists | Agent-evaluate / Haiku only; not in `voice-layer-cache.js` `portfolioBriefs[]` | **Few hours.** Add a `benchBriefs[]` build to `voice-layer-cache.js` — small standalone improvement, unlocks Requests 3 + 9 simultaneously. |
| **Per-ticker context bundle (`buildLiveContextBlock`)** | `api/_utils/agentEvalPromptAssembly.js` (assembled per-turn for Haiku) | Agent-evaluate's prompt assembly | **Sprint.** Wrapping is small; transformation from verdict-shaped agent-eval output to evidence-shaped Voice-Layer-safe output is the real work. |
| **Game-state urgency primitive** | `api/_utils/agentNewsContext.js:78–112` (`computeGameContext`) → `urgency: 'high' if lastDay + score <-10` | Used by `battle-commentary.js`; not lifted into Voice Layer prompt | **Hours.** Inject as a structured field alongside score/time so the model reasons about frame, not raw numbers. |
| **`invalidationConditions[]` schema (Forge Signal Expansion)** | `voiceLayerPrompt.js:408–456` (Signal Expansion mode); `expand-signal.js` | Forge UI only | **Few days.** The schema is the right Voice-Layer-safe pattern; would need adaptation to take user theses (not parsed signals) as input. Reusable design starting point for Request 11. |
| **Daily regime brief** | `api/cron/compute-daily-regime-brief.js` + `api/_utils/dailyRegimeBriefPrompt.js`; output structured (`keyEvents[]`, `themes[]`) | Already injected as Block 3.5 anchor in Voice Layer prompt | **Already wired.** Listed for completeness — this is the model the other wrappers should follow. |

**Forge-side note:** `api/forge/workshop-chat.js` and `api/forge/expand-signal.js` are also Gemma endpoints calling `voiceLayerPrompt.js` in different modes. They are *not* tools the Voice Layer can call from inside battle mode — they are alternate session types, gated by Forge's UI flow. Reuse of their patterns (`activeThesis` schema, `invalidationConditions[]`) is encouraged; reuse of their endpoints from a battle session is not architecturally available.

---

## 4. Response-shape risk inventory (HIGH-risk tools and required transformations)

The Voice Layer's product stance — *"here's what I'm seeing and why," not "here's what you should do"* — sets a hard constraint: tool outputs that are verdict-shaped cannot be surfaced raw. This section catalogs the HIGH-risk capabilities and what would need to change.

| Capability | Current output shape | Where verdict framing lives | Required transformation |
|------------|----------------------|-----------------------------|-------------------------|
| **Agent-evaluate swap decision** (`agentEvalToolSchema.js:4–148`) | `{ action: SWAP/HOLD, conviction: 0–100, symbolOut, symbolIn, ... }` — explicit verdict + numeric confidence. | Conviction score + binary action label. | Drop conviction score from any Voice-Layer-bound surface. Drop SWAP/HOLD label. Surface the *evidence layer that fed the decision* (technical, fundamental, news, regime fit) without the verdict overlay. Pattern: borrow `invalidationConditions[]` from Forge's Signal Expansion mode — present what would falsify the setup, let the user weigh in. |
| **`detectRedZone` swap-lock messages** | `{ locked: true/false, message: "approaching BaggerBomb" }` | The lock IS in-game game-mechanic per the product stance — fine to surface directly. The risk surface is when proximity is paired with implied recommendation ("we're locked, you can't swap"). | Surface as game-state observation. Frame action-confirmation ("want me to make sure we don't accidentally swap it?") rather than directive. |
| **Institutional intelligence storylines** | `{ priority: 60–90, headline: "Smart money rotating out of Finance into Tech", convictionLevel: 'strong_accumulation' / 'strong_distribution' }` | Conviction-tagged level + narrative that implies smart-money-knows-best framing. | Strip the conviction-tagged framing; keep the observational facts ("three institutions entered new positions in [sector] this week"). The "smart money" narrative shouldn't reach the user — it's a heuristic, not evidence. |
| **Persisted ARCH score** (Request 6) | Composite 0–100 score per (archetype, ticker). Output is "high-ARCH = good fit." | The score itself is a ranking abstraction, not evidence. | Frame as "stocks fitting your archetype's profile" — observation about *fit*, not verdict about *quality*. Optionally surface the component scores (fundamental, technical, BB-fit, ATR percentile) so the user sees what's driving the fit. |
| **Per-ticker tier-appropriateness flags** (`agentEvalPromptAssembly.js`) | "AAPL is more appropriate for Core than Star given current ATR regime" — verdict on placement. | Direct prescriptive language. | Reframe as observation: "AAPL's ATR regime is closer to what we'd see in Core-tier holds" — describes the data, doesn't prescribe the action. |
| **Risk-band labels** (`agentRiskManager.js`: `low | medium | high`) | Single-bucket labels on the portfolio. | The bucket itself is verdict-shaped. | Decompose into the underlying observations (concentration percent, sector weights, threshold exposure count, regime-mismatch count). Bucket label optional or hidden. |
| **Mastery-phase prompt rules** (`voiceLayerPrompt.js:114–142`) | Prompt itself prescribes: *"Lead EVERY conversation with a complete, pre-formed plan. Not options — a plan."* + *"NEVER present multiple options. Present your plan."* | The prompt is *actively shaping the agent toward directive language* in Mastery phase. | This is the most important transformation in the audit. The phase rules need to be rewritten to preserve directness without prescribing advice-shaped language. See Section 5 for detail. |

**Architectural pattern across the table:** every HIGH-risk surface is a place where the codebase has a *decision-making* capability that was originally designed for Haiku (an agent that *executes*) and is being considered for Voice Layer (an agent that *researches with the user*). The transformation is consistent: drop the verdict layer, keep the evidence layer, hand the user the choice.

---

## 5. Conversational warmth assessment

Direct read of `voiceLayerPrompt.js` end-to-end (1071 lines). Findings keyed to the four questions in the brief.

### 5.1 Does the prompt distinguish between new/passive users and experienced/directive users?

**Largely no.** The prompt has phase logic, but it is *agent-phase* logic, not user-persona logic.

- `getAgentPhase(gamesPlayed)` at `voiceLayerPrompt.js:502–506` returns `'discovery'` for ≤10 games, `'refinement'` for ≤30, `'mastery'` for >30. **All three branches are about how much the agent knows the user, not about who the user is.** A first-time user playing game 1 with a brand-new agent gets `DISCOVERY_RULES` — but so does an experienced trader who happens to be on a fresh agent.
- The 15-dimension `partnerProfile` (`DIMENSIONS` array at lines 475–491: `risk_appetite`, `concentration_tolerance`, `autonomy_preference`, `feedback_style`, `learning_orientation`, etc.) populates over time through elicitation and in principle could reflect "this user is new to trading" — but only after enough games to elicit those dimensions. **The very first session — when warmth matters most for retention — is the session where the partner profile is empty.**
- **One legitimate user-persona branch exists, but only in Workshop mode**: `WORKSHOP_PHASE_RULES` at line 216 has an `EXPERT BUILDER MODE` that activates when the user signals they lack technical knowledge ("I don't know technicals," "you're the expert"). When triggered, the agent stops asking technical-choice questions and proposes specific approaches with thumbs-up/down framing. This exists **only in workshop**, not battle mode. Adjacent: `PLAIN LANGUAGE MANDATE` at line 217 forces jargon translation in workshop mode.
- **Battle mode has no equivalent.** A new user in battle mode gets `DISCOVERY_RULES` regardless of their stated comfort level — and `DISCOVERY_RULES` already assumes a peer-trader register ("Like a trading buddy who just joined the desk and is figuring out your vibe").

### 5.2 Are there proactive-exploration patterns? "Propose an exploration" / "invite the user to try" framing?

**Battle mode: essentially no.** Every battle-mode rule block (`DISCOVERY_RULES`, `REFINEMENT_RULES`, `MASTERY_RULES`) contains the constraint **"NEVER greet the user. Open with substance."** at lines 62, 98, and 130 respectively. The agent is structurally barred from a soft opener.

The closest battle-mode patterns to "invite an exploration":
- `DISCOVERY_RULES:55` — *"If the user has agreed with you 2-3 turns in a row, present a valid but contrarian option."* This is a probe within a conversation, not a session opener, and it's framed as a profile-test ("If they reject it, their profile is confirmed"), not as an invitation to explore.
- `DISCOVERY_RULES:50` (gated explanations) — *"Start with a casual headline take, then offer the details. Example: 'Want me to break down what I'm seeing, or should we just pick a direction and go?'"* — this is the warmest battle-mode pattern in the prompt, but it still drives toward closure ("pick a direction and go"), not open exploration.

**Workshop mode: yes, but in a constrained register.** The `THESIS MOMENTUM` rule (line 218) and `Ask ONE focused question per turn` (line 209) frame workshop as collaborative thesis-building. This is *exploration-shaped* (the user and agent jointly construct an artifact) but is goal-directed (compile a strategy), not open-ended ("let's just look at this together").

**Review mode: somewhat.** `REVIEW_PHASE_RULES:330` — *"Lead with the headline. Open on the big win, the painful loss, or the surprise move of the day."* This is the closest the prompt gets to "agent-led with warmth" — but it requires a closed market and a daily review payload to even activate.

**No mode supports "want to walk through how I look at sector rotation?" as a session opener.** The product stance described in the brief — encouragement to explore together, surface interesting setups for joint investigation — has no register in the prompt today.

### 5.3 Where does advice-shaped language drift in?

The prompt does not literally say "you should buy X" — Agent A's earlier audit confirmed those exact phrases are absent. But advice-shaped language drifts in through several explicit instructions:

- `DISCOVERY_RULES:57` (CLOSING RULE) — *"NEVER end your message by asking the user what they want to do. Instead, state which option YOU lean toward and ask if they're on board. Example — Bad: 'How do you want to approach this?' Good: 'I'm leaning aggressive here — CF and EIX are set up well in Star and the momentum is there.'"* This is opinionated partnership; it is also functionally advice ("here's what I think you should do").
- `REFINEMENT_RULES:92` — *"Propose complete strategies: 'Based on how we've been running this, I'd go aggressive-momentum with a 3-stock sector cap.'"* Direct strategy proposal.
- `MASTERY_RULES:119` — *"Lead EVERY conversation with a complete, pre-formed plan. Not options — a plan. 'Here's what I'm running and why.'"*
- `MASTERY_RULES:128` — *"NEVER present multiple options. Present your plan. They'll push back if they disagree."*
- `MASTERY_EXAMPLE:155` — agent says: *"I want to drop AMD from Core and bring in AVGO ... I'm pulling the trigger at open unless you've got something."*
- `DISCOVERY_EXAMPLE:149` — agent says: *"I like it. When the setup's this clean, spreading just dilutes the upside. Let's load up on semis."*

**Read of the pattern:** the prompt is built around a "trading partner with directive authority" model — the agent has opinions, expresses them confidently, and (in Mastery phase) executes without asking permission on routine calls. This is in direct tension with the product stance the brief describes ("research and idea-exploration tool, not financial advisor ... here's what I'm seeing and why — not here's what you should do"). The tension is most visible in Mastery phase, where the prompt explicitly prescribes "Present your plan. They'll push back if they disagree" — a recommendation-shaped pattern by design.

The disclaimer at `voiceLayerPrompt.js:1013` — *"talk like a sharp friend who happens to be great with markets, not like a financial advisor or an assistant"* — is doing thematic work but is not load-bearing against the directive-language patterns elsewhere. A friend who says "I'm pulling the trigger at open unless you've got something" is still giving advice. The friend frame doesn't dissolve the directive register.

**The phrase "You and the user are PARTNERS"** (`voiceLayerPrompt.js:1011`) is repeated across all four mode identity blocks. It's the prompt's primary stance against advisory framing — but "partner" is ambiguous. A senior partner who runs the play and lets the junior push back is still in the advice-giving register. The prompt does not currently distinguish *partner who explores* from *partner who decides*.

### 5.4 What would a "new user welcoming mode" need that doesn't exist today?

Five specific things that don't exist in the prompt as written:

1. **A pre-Discovery onboarding register, keyed on `gamesPlayed === 0` or `partnerProfile.knownDimensions === 0`.** Today, game 1 and game 10 both get `DISCOVERY_RULES`. A new user in their first session needs an explicitly softer opening register — *"Want me to walk you through what I'm seeing and how I think about it?"* — that's distinct from `DISCOVERY_RULES`'s peer-trader assumption.
2. **Permission to leave a turn open-ended without closure pressure.** Every battle-mode rule pushes toward "state your lean and ask for buy-in." A welcoming mode needs a register that explicitly allows "let's just look at this together" without an action-confirmation closer.
3. **Proactive invitations to research directions the user hasn't asked for.** The example in the brief — *"there's a contrast in these two energy plays I find interesting — want to dig in?"* — requires both (a) the proactive surfacing infrastructure (architectural gap, see Section 2 priority 11) and (b) a softer prompt register for the invitation itself, distinct from "Open with substance" / "Lead with the headline."
4. **A teaching/exploring register for "how I think about X" framings.** The brief's example *"want to walk through how I look at sector rotation?"* is a different speech act from anything in the prompt today. Workshop's `EXPERT BUILDER MODE` is the closest analog (proposing a specific approach for users who lack technical knowledge), but it's mode-locked to thesis-building and triggers on user-stated unfamiliarity, not on session start. A welcoming mode would extend this teaching register to battle mode and key it on user phase, not user-stated incapability.
5. **Explicit anti-advice constraints in tension with current Mastery rules.** A welcoming mode (or a rewritten Mastery phase) needs constraints like *"surface the evidence, name what would falsify the read, hand the user the choice"* in place of *"present your plan, they'll push back if they disagree."* The `invalidationConditions[]` pattern from Signal Expansion mode is the right model — it's already proven in code.

**Net read:** the prompt today is well-constructed for an experienced, directive-comfortable user partnered with a confident agent. It is not constructed for warmth toward new users, and several of its load-bearing rules (Mastery's plan-first directive, Discovery's "state your lean" closing rule, the across-the-board "NEVER greet" constraint) actively work *against* a warm welcoming register. A rework that adds warmth without addressing those existing rules will produce internal contradictions in the prompt.

---

## 6. Architectural observations

Patterns visible across the investigation, not specific to any one request:

1. **The "exists in agent-evaluate / scoring loop, not exposed elsewhere" pattern is dominant.** Per-position context assembly, regime classification, swap decision logic, risk bands, threshold proximity — all live inside `api/cron/agent-evaluate.js` (72KB) and its support files in `api/_utils/agent*.js`. Each was designed for one consumer (Haiku) with one shape (verdict-driven decision). Voice Layer needs the *same primitives* in a different shape. This is the single largest pattern in the audit and it implies a shared design choice ahead: build a *primitive library* (regime, proximity, risk components, news context) that both Haiku and the Voice Layer call into, with output shaped per-consumer. Today, those primitives are entangled with their consumers.

2. **Voice Layer is loosely coupled and write-only.** Per Agent A's audit (Section D): the Voice Layer writes a `directive` field to `agentBattles`, Haiku reads it asynchronously at its next evaluation window. There is no callback, no execution acknowledgment, no Voice Layer visibility into whether Haiku acted. This is a clean boundary architecturally but it means the Voice Layer cannot close the loop on "I proposed X, did it happen, did it work?" — which is the natural feedback signal for Sprint 2's writers.

3. **The Voice Layer is purely reactive at the protocol level.** `api/agent/chat.js` is request/response. There is no socket, no push, no scheduled tick. Every interaction starts with a user POST. This is the architectural source of the "no proactive surfacing" finding and it cuts across four requests (all four agent-led modes).

4. **The 15-mode `voiceLayerPrompt.js` is shared across Battle, Review, Workshop, and Signal Expansion.** Modes are selected at the `buildVoiceLayerPrompt` call site (`voiceLayerPrompt.js:822–1071`) by the `mode` parameter and dispatched into different block assemblies. This is a clean abstraction — but it means *any rework to add a "welcoming mode" is either a fifth mode or a sub-mode within Battle*, and the choice has implications for state management (welcoming mode probably needs its own elicitation rules and message budget).

5. **Pre-cached context is the Voice Layer's only tool surface.** Per Agent A: Voice Layer has no tool-calling capability — outputs are JSON fields, not tool invocations. All "tools" today are pre-cached blocks injected into the prompt by `voice-layer-cache.js` (cron-warmed every 15 min). This shapes the build options: adding a "tool" to the Voice Layer means either (a) adding a new pre-cached block, (b) introducing genuine tool-calling at the model layer, or (c) adding a new turn-time fetch in `api/agent/chat.js`. Option (a) is the path of least resistance for slow-changing data; (c) is required for anything responsive to user query inside a turn.

6. **DKB thematic data is in Firestore but UI-locked.** The 8 thematic entries seeded to `discoverThemes` are queryable via Firestore client SDK from the Discover Tab UI directly — no backend mediation. There is no `api/discover/stocks-by-theme.js` endpoint. This is a one-afternoon gap that has high leverage (Request 7 + thematic context injection at session start).

7. **The `invalidationConditions[]` schema in Signal Expansion mode is the single best Voice-Layer-safe design pattern in the codebase.** It is concrete (specific observable falsifying events), evidence-shaped, and structurally invites the user to weigh in. It deserves to be promoted from a Forge-only pattern to a foundational primitive for any "evaluative" Voice Layer interaction (Requests 10, 11, 12 all benefit).

8. **Bench data being absent from `voice-layer-cache.js` is a small but recurring blocker.** Bench is fully structured (`agentBattles.portfolio.bench = { stocks, crypto }`); the only thing missing is a `benchBriefs[]` build in the cache. Adding it unlocks Requests 3 and 9 simultaneously and is a few hours of work.

9. **The Mastery-phase prompt rules are the strongest internal contradiction with the stated product stance.** `MASTERY_RULES:117–142` actively prescribes plan-first, options-banned, directive-authority behavior. Any rework that aims for "research and exploration tool" stance must reckon with rewriting these rules — there is no path that adds warmth or evidence-framing on top of Mastery as written without producing internal contradictions in the prompt.

---

## 7. Dependencies on deferred work

Items in the audit whose answers depend on work not yet done:

| Dependency | What's deferred | Affected requests | Severity |
|------------|-----------------|-------------------|----------|
| **Quant DKB entries not uploaded** | User confirmed; only 8 thematic entries exist in `/dkb/thematic/` | Request 11 (thesis pressure-test, technical/quantitative evidence layer) — *partial* | Medium. A thesis pressure-test built today on thematic + technical + news (no quant) is useful but feels hollow on quant-shaped theses ("X is overbought historically"). |
| **Macro DKB entries not uploaded** | User confirmed | Request 11 (macro evidence layer) | Medium. "Semis are due for a reversion" is partly a cycle/macro call. Without macro DKB, the macro side of pressure-testing is unsupported. |
| **Vision Phase 2b** | Mentioned in brief as work-in-progress; investigation surfaced `api/_utils/visionRuntime.js` (2KB) as a stub-shaped module | None of the 15 requests directly | Low. Vision capabilities don't gate any request in the current set, but if Phase 2b will introduce screenshot/chart parsing, that affects Signal Expansion mode (Request 11 adjacent). |
| **`agent.battlePatterns` aggregation** | Logging exists (`battlePatternLogger.js`), aggregation does not | Requests 4, 15 (Sprint 2 inputs) | High. Sprint 2's writers depend on this. Not strictly "deferred" — just unbuilt. |
| **Veto-event capture** | Not deferred — does not exist in the codebase at all | Requests 4, 15 (Sprint 2 inputs) | Highest. Sprint 2 hard prerequisite. |
| **Sector beta data point** | Not in `stockRankings`; no current source | Request 12 (risk audit, sector-beta dimension) | Low. Risk audit can ship without it on the other three dimensions and add sector beta later. |

**Read of dependencies:** the largest deferred-work obstacle in the audit is *not* the missing DKB content but the missing *plumbing around already-uploaded data and already-logged events* — specifically veto capture (doesn't exist) and battle-pattern aggregation (logged but unaggregated). Quant/macro DKB matters for one specific request (11) and only partially.

---

## 8. Recommendation

The audit produces a tiered ordering keyed to two questions: *what unblocks Sprint 2* and *what does the Voice Layer rework actually need to ship against*.

### 8.1 Tier 0 — Pre-rework foundations (do first)

Work that should ship **before** the formal Voice Layer rework so the rework builds on better data and a cleaner exposure surface. Mostly small, mostly mechanical.

- **Add bench data to `voice-layer-cache.js`** — `benchBriefs[]` build mirroring existing `portfolioBriefs[]`. Unlocks Requests 3, 9. *Effort: afternoon.*
- **Stocks-by-theme query endpoint** (`api/discover/stocks-by-theme.js`) + theme performance overlay. Unlocks Request 7 + thematic context injection. *Effort: afternoon to a day.*
- **Persist ARCH score** per (archetype, ticker, date) in `stockRankings`. Add `sma200_position` field while you're there. Cron edit in `compute-rankings.js`. Unlocks Request 6's filter side. *Effort: half a day.*
- **Quantitative threshold-proximity wrapper** — surface `detectRedZone` results across all positions as a structured field in `voice-layer-cache.js`. Unlocks Request 2's data side (architectural side still RED). *Effort: half a day.*
- **Sector RS extraction** — lift `computeBreadthQuality` output and sector leadership classifier into a structured Voice Layer cache field. Unlocks Request 1's third tool. *Effort: half a day.*
- **Lift `urgency` flag** from `agentNewsContext.js` into the Voice Layer prompt as a structured field. *Effort: hour.*
- **Institutional intelligence query wrapper** — pull priority-ranked storylines for date as a callable. Unlocks Request 8. *Effort: day or two; transformation work belongs in Tier 1.*

**Tier 0 total effort: ~1 sprint of focused work, parallelizable.** Outcome: 7 of the 8 YELLOW requests have their data/exposure side ready when the rework begins.

### 8.2 Tier 1 — The Voice Layer rework itself

This is what *is* the rework, not what comes before or after. Three components that should ship together because they interact.

**1.1 Tools (the real new builds the rework depends on):**
- **Veto event capture (full stack)** — UI hook → server endpoint → prompt mode → Firestore field. Sprint 2 hard prerequisite. *Effort: ~half a sprint, cross-cutting (UI + API + prompt + storage).*
- **Cross-battle pattern aggregator** — cron job over `agent.battlePatterns` producing recent-N-game synthesis. Sprint 2 soft prerequisite + Request 4. *Effort: few days.*
- **Portfolio risk synthesis tool** — concentration, threshold exposure, regime-mismatch aggregations. Highest product-stance ROI; output naturally observation-shaped. *Effort: few days.*
- **Single-ticker deep-dive tool** with verdict-stripping transformation. Most product-defining surface. *Effort: ~half a sprint — wrapping is small, transformation is the work.*
- **Universe screener API** — covers Requests 5, 6, 9. *Effort: few days, scope-dependent (basic screener vs divergence-included).*

**1.2 Prompt rework:**
- **Rewrite Mastery-phase rules** to remove plan-first / options-banned directives. Replace with evidence-first / falsifiability-driven framing. *Effort: prompt-design pass + few-shot rewriting; days.*
- **Add new-user welcoming sub-mode** keyed on `gamesPlayed === 0` or empty `partnerProfile`. Softer opening register, permission for open-ended turns, proactive-invitation patterns. *Effort: prompt-design pass + few-shot examples; days.*
- **Score- and time-conditional templates** — Requests 13, 14. *Effort: prompt-design pass; day or two.*
- **Promote `invalidationConditions[]` schema** from Forge-only to foundational primitive across evaluative interactions (Requests 10, 11, 12). *Effort: schema port + prompt integration; couple of days.*

**1.3 Tooling pattern decision (architectural):**
- Decide the path for tool-calling: pre-cached block vs in-turn fetch vs genuine model-side tool calls. The decision shapes how Tier 1 tools are exposed. (See Architectural Observation #5.) *Effort: design decision before Tier 1 tools land; not separate work.*

**Tier 1 total effort: ~1.5–2 sprints depending on screener scope.** Outcome: Voice Layer is product-stance-compliant, has the new evaluative tools (risk audit, ticker deep-dive, screener), supports new-user warmth, and has Sprint-2 prerequisites in place.

### 8.3 Tier 2 — Post-rework / post-launch

Larger builds that aren't required for the rework to ship something real but unlock significant capability afterward.

- **Proactive surfacing infrastructure** — event source, dispatcher, agent-led prompt mode. Unlocks the *agent-led* sides of Requests 1, 2, 3, 4. Architecturally largest single build in the audit. *Effort: multi-sprint.*
- **Thesis pressure-test tool** (Request 11). Largest analytical build. Macro layer dependent on quant/macro DKB upload. *Effort: multi-sprint, gated by DKB readiness.*
- **Sector beta data integration** (Request 12 enhancement). *Effort: depends on data source choice.*
- **Quant/macro DKB upload campaign** (separate from Voice Layer rework, but blocks Request 11 fullness). *Effort: content work, separate workstream.*

### 8.4 Sprint 2 readiness — minimum work required

This is the question that determines the immediate next step after this audit.

**Sprint 2 (conviction & partner writers) hard prerequisite: veto event capture.** Without it, conviction extraction has only execute / no-execute as signal — which is the wrong granularity. The conviction writer needs the *reasoned-declination* pattern: user said no AND said why. That's the high-value signal Sprint 2 is meant to convert into conviction primitives.

**Sprint 2 soft prerequisite: cross-battle pattern aggregator.** Conviction is multi-game by definition; you can't write conviction primitives from a single battle's data. The aggregator over `agent.battlePatterns` is the input shape Sprint 2's partner writer needs.

**Concretely, the minimum work before Sprint 2 becomes a real possibility:**

1. **Veto event capture (full stack).** UI veto detection (button-decline + free-text "no, because..."), server endpoint, Firestore field on `agentBattles.vetoEvents[]`, prompt-side follow-up template ("Want to tell me why? I'd rather understand your read than just back off"). *Effort: ~half a sprint cross-cutting work.*
2. **Battle-pattern aggregator.** Cron or on-read function that synthesizes the last N games' patterns into agent-readable summaries. *Effort: few days.*
3. **Optionally (recommended): Risk audit synthesis tool.** Not Sprint-2-required, but it's the highest product-stance ROI in the audit and gives the Voice Layer something concrete to do that demonstrates the new register before the larger rework lands. *Effort: few days.*

**Total minimum-Sprint-2-prep effort: ~half a sprint to a sprint of focused work.** This is the recommended **immediate next step after this audit.** Tier 1's full Voice Layer rework can follow.

### 8.5 Effort summary

| Tier | Description | Effort estimate |
|------|-------------|-----------------|
| **Tier 0** | Pre-rework foundations (wrappers, exposures, small data lifts) | ~1 sprint, parallelizable |
| **Tier 1** | Voice Layer rework (new tools + prompt rework + architectural tool-calling decision) | 1.5–2 sprints |
| **Tier 2** | Post-launch larger builds (proactive surfacing, thesis pressure-test, DKB upload) | Multi-sprint per item |
| **Sprint 2 minimum** | Veto capture + battle-pattern aggregator (subset of Tier 1) | ~half a sprint to a sprint |

**Read of the totals:** between today and a Voice Layer that is real, product-stance-compliant, and warm enough for new users, the floor is roughly 2.5–3 sprints if Tier 0 and Tier 1 are sequenced cleanly. Sprint 2 specifically requires roughly half a sprint of focused work to clear its hard prerequisites — which is the cheapest, highest-leverage immediate move.

---

**End of Part 3. End of audit.**
