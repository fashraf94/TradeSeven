# Quarterly Portfolio Restructure — Decision Charter V1.1

**Date:** August 5, 2026
**Status:** Charter — binding decision record, pre-spec. Not an implementation spec.
**Prepared by:** Claude (Anthropic), in collaboration with Flash
**Supersedes:** `QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1.md`
**Consumed by:** Specs 1–4 (see §10). Every spec in this arc cites this charter; any spec that contradicts a charter decision must call out the contradiction explicitly and get founder sign-off before proceeding.
**Commit location:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_1.md`

---

## Changelog V1 → V1.1

| Change | Summary |
|--------|---------|
| O-2 **RESOLVED** | Rolling per-user quarters (founder decision). New D-37; D-9 amended; new I-7. |
| V1 scope locked | The portfolio is a pure user/agent experience — no PVP, no social sharing in V1. New D-38, with don't-foreclose guardrail. |
| Loadout relocation | Loadout selection component moves from Command Center to the league section. New D-39; Spec 4 scope updated. |
| Voice Layer model decision promoted | From DEF-5 ("anytime") to **Prerequisite C** — settled by harness before Spec 3 begins. New D-40; DEF-5 superseded; §10 updated. |
| First Experience deliverable | The manager's first 72 hours becomes a named Spec 3 deliverable. New D-41; Spec 3 scope updated; new O-8. |

---

## 1. Purpose and Flagship Framing

The quarterly portfolio is the flagship feature of FantasyTrades and the final connecting piece of the engagement puzzle. It converts the disposable onboarding archetype label into the platform's retention spine, gives every user a living, personal surface they are dropped into without doing a thing, and productizes the core archetype-rotation thesis as a quarterly behavior.

**One-line description:** Every user is assigned an archetype at onboarding. That archetype's agent manages a virtual portfolio for a full quarter. The user lives with it, talks to it, argues with it, and — at quarter-end — chooses who manages the book next.

**V1 scope statement (binding):** The portfolio is a **user/agent experience**. V1 builds no PVP, no social sharing, no comparative surfaces. The goal is singular: create and deepen the user/agent connection through conversation — watching and observing a portfolio together, discussing the book, strategies, ideas, and anything else. The portfolio is private and personal; **the games are where the platform is communal** (tournaments start Mondays, drafts run Friday–Sunday). This split is the platform's identity architecture: your book is yours; the arena belongs to the crowd.

**Strategic roles this feature plays simultaneously:**
1. Retention spine — ambient, always-on reason to open the app (battles are episodic; the book is alive).
2. Horizon-bias fix — slow archetypes (fundamental investor, diversifier) finally get an arena at their natural clock.
3. Attribution engine — every user becomes a data point in archetype × regime cohorts (built by regime window; see I-7).
4. Rotation thesis productized — every rollover, each user confronts "which archetype for this market?"
5. Internal sim-to-real bridge — an honest, risk-adjusted live book inside the platform before any external bridge exists.

**Season mode boundary (standing guard):** This is relationship infrastructure, not a scored competition. The moment the quarterly portfolio grows leaderboards, brackets, or elimination stakes, it has become season mode (scrapped permanently, C-19). It stays a portfolio.

---

## 2. Decision Ledger — Portfolio Core

| # | Decision | Rationale |
|---|----------|-----------|
| D-1 | Onboarding questionnaire assigns the archetype; assignment auto-creates the quarterly portfolio. | Makes the first archetype encounter consequential instead of a flippable label. |
| D-2 | Full 3-month archetype lock. The archetype cannot be changed mid-quarter. | Commitment is the attachment mechanism; the rollover date is the visible release valve. |
| D-3 | One escape hatch: a single re-assignment, allowed only within the first two weeks, once ever per user. Cohort flagged in data. | Return policy, not exit door. Protects genuinely mismatched onboarding cases without weakening the lock. |
| D-4 | No Forge customization, no rule editing, no lean editing in the portfolio. Conversation (Vision, pivot signals, SignalDrop, debate) is the only influence surface. | (a) You don't edit your fund manager's config — you argue with them; conversational influence builds attachment settings can't. (b) Locked substrate keeps every user a clean data point in archetype × regime cohorts; per-user mutations kill attribution. |
| D-5 | Forge customization remains strictly the games' domain. | Gives the two surfaces distinct identities: the portfolio is where you live with an archetype; the Forge and games are where you tinker with them. |
| D-6 | Quarter-end re-choose ritual: user selects the managing archetype for the next quarter at their own rollover. | The rotation thesis as a behavior. Informed by arena experience + attribution data. Build deferred (§11) — required by day 90, not day 1. |
| D-37 | **Quarters are rolling and per-user**: each portfolio's quarter begins at creation and rolls over on its own anniversary. No calendar alignment. Quarter-end is a private ritual, not a platform event. | Founder decision (resolves O-2). The portfolio is a user-specific experience; the games carry the unified/communal rhythm (Monday tournaments, Friday–Sunday drafts). Private celebrations reinforce the personal nature of the manager relationship. |
| D-38 | **V1 is user/agent only.** No PVP, no sharing, no social surfaces on the portfolio in V1. Guardrail: build nothing social, but do **not foreclose** it — the schema must not bake "private forever" into the data model, so the door stays cheap to open later. | Protects the flagship from becoming a second social surface before the first relationship has proven itself. |

---

## 3. Decision Ledger — Identity Architecture

| # | Decision | Rationale |
|---|----------|-----------|
| D-7 | Separate agent identities: the portfolio manager and the user's arena agents are different agents. | A quarterly lock must not restrict arena exploration. Games are the risk-free space to research the rollover decision. |
| D-8 | Shared archetype substrate: "Fundamental Investor" is one class definition across both surfaces. | Game evidence transfers — lessons proven in battle inform how the manager class trades the book. |
| D-9 | Archetype vintages: substrate updates apply **per-user at each portfolio's own rollover**, never mid-quarter. Versioned like every other release (e.g., `Contrarian v1.4`). With rolling quarters (D-37), multiple vintages run live simultaneously; **every portfolio records the vintage it runs on** (schema requirement, Spec 1). | Mid-quarter changes contaminate the quarter's attribution. Per-user boundary application turns vintage releases into naturally staged rollouts instead of platform-wide flag days. |

---

## 4. Decision Ledger — Influence Boundary (Hard Lines)

| # | Decision | Rationale |
|---|----------|-----------|
| D-10 | All user influence routes through the bounded advisory channel: Vision injection plus pivot signals (clamped per existing precedent, TTL decay, identity persists). | Existing platform machinery; the quarter answers "who manages the book," the conversation answers "what we're leaning into this week." |
| D-11 | Drops (and all shared content) inform; they never compel. No dropped signal may directly cause a trade outside the advisory channel. | Otherwise SignalDrop is a remote control — manual trading with extra steps — and destroys the lock, the archetype, and the thesis in one gesture. |
| D-12 | The agent's refusal to act is product behavior, not failure. The manager must be able to say "I read it; here's my take; I'm not acting — here's why." | The pushback is the product. This is the archetype thesis made visible. |
| D-13 | The archetype identity-pushback fix is a **load-bearing flagship dependency**. It lands before or inside Spec 3 (Command Center), not after. | SignalDrop is the highest-volume vector of against-style pressure the platform will have. The manager holding its philosophy under that pressure IS the flagship. Note: model capability is half the pushback problem — see D-40 harness dimensions. |
| D-14 | The existing `suspectedInjection` flag hard-gates the SignalDrop reaction path, and the injection guard gates any external-content retrieval path (proactive enrichment included). | Dropped and retrieved content flows into the prompt of an agent with portfolio authority. Untrusted input rules apply everywhere content enters. |

---

## 5. Decision Ledger — Scoring and Honesty

| # | Decision | Rationale |
|---|----------|-----------|
| D-15 | The portfolio is scored on honest risk-adjusted P&L with realistic frictions. Arena/game points remain entertainment scoring. The platform embodies the distinction: arena points are sport; portfolio performance is truth. | Resolves the variance-seeking scoring bias without compromising game design. |
| D-16 | Shadow trading-quality scoring runs on battles (dual-label: game score + quietly computed risk-adjusted P&L). Shadow logger infrastructure is the capture mechanism. | Honest training signal from every battle; game design never has to bend for data purity again. |
| D-17 | The agent narrates underperformance honestly — drawdown protected, what history says about this regime for this posture — with the Rule Honesty Gate applied to its self-narrative: no spin, no claims the data doesn't support. | An agent honest about losing builds more trust than one that's winning. Requires attribution data to exist (§9). |
| D-18 | Lesson promotion gate: nothing reaches "proven" status without replication across at least two scoring contexts (e.g., BaggerBomb + Snake Draft + shadow P&L). Single-context lessons are labeled honestly as mode-specific. | Prevents the learning corpus from becoming a well-verified library of BaggerBomb exploits mistaken for trading wisdom. |

---

## 6. Decision Ledger — Trading Cadence, Cost, and Models

| # | Decision | Rationale |
|---|----------|-----------|
| D-19 | Cadence-tiered evaluation by archetype: slow archetypes ~1 eval/market day, fast archetypes ~3–4, all batched through shared dispatch. Cadence is an archetype property. | Cost control and archetype coherence point the same direction — a fundamental investor trading six times a day is incoherent anyway. Differentiated cadence is itself differentiated data. |
| D-20 | Portfolio evals run via Batch API with prompt caching on the stable scaffold. Portfolio decisions are not latency-sensitive. | ~50% + ~90% (cached input) cost reduction on the largest new run-rate line. |
| D-21 | Dormancy downshift: the portfolio always trades regardless of user activity; reflection depth and narration frequency reduce for users inactive ~2 weeks. | Trading integrity preserved; cost follows attention. Structural answer to the account-scaled cost shape. |
| D-22 | Run-rate budget: < $1.00 per active user per month all-in for the ambient portfolio (target band $0.35–0.75). Re-measure with real token counts in week one of production. | The restructure changes the cost model from engagement-scaled to account-scaled; the budget is set before the build, not discovered after. |
| D-23 | The portfolio eval path is built model-agnostic from day one: a single-constructor wrapper (per `wireModelCall` precedent) with provider and model as config. | New call site, zero calibration debt — the cheapest place model optionality will ever be. Future swaps become flag flips, not migrations. |
| D-24 | The battle Trading Brain (`decide.js` and fenced assembly) stays on Haiku pre-launch. A decision-model swap there is a full recalibration event under the fence (invalidates DR-13 drift baselines and the archetype calibration corpus). | The battle brain is Haiku **plus** a calibration corpus. It is the last place a new model enters, not the first. |
| D-25 | DeepSeek V4-Flash enters on evidence, not excitement: (a) background offline paired harness vs. Haiku on archived decision prompts (temperature-0, judged on decision quality, format compliance, archetype adherence — DR-13 harness pattern); (b) Voice Layer candidacy per D-40 / Prerequisite C. Per-layer allocation for decision surfaces settled post-launch on harness receipts. | Models depreciate; the restructure appreciates. Note in its favor: US market hours fall in DeepSeek's off-peak (Beijing night) pricing valley — though see D-40 serving requirement, which sidesteps first-party billing entirely. |
| D-40 | **Voice Layer model decision is Prerequisite C — settled by harness before Spec 3 begins.** The restructure changed the Voice Layer's job: from game-adjacent flavor conversation to debate endurance under sustained pushback, disposition discipline, verification narration, refusal-with-reasons, and quarter-long persona consistency while consuming untrusted content. V4-Flash is the lead candidate (higher reasoning ceiling than a 26B dense model; 1M context serves a three-month relationship's conversational memory; cost in Gemma's neighborhood). **Gemma runs the same gauntlet as incumbent and remains the fallback tier regardless of outcome.** Harness: 20–30 scripted scenarios across six dimensions — (1) debate endurance (holds archetype position through 6+ turns of pressure without caving — D-13 territory), (2) disposition compliance (D-27 schema adherence), (3) verification narration accuracy (represents what the data check found without overclaiming), (4) injection-resistance probes on the react path, (5) per-archetype tone consistency, (6) cost per conversation. **Serving requirement:** V4-Flash is MIT open weights — serve via US-hosted providers on OpenRouter, not DeepSeek's first-party API. User conversation content never routes through the vendor's infrastructure; peak-valley billing complexity is sidestepped entirely. | Spec 3 builds the archetype reaction prompt suites, and prompts are model-tuned assets — choosing the model after Spec 3 means rewriting that work. Decision timing is forced by the build order, so the harness runs during the Spec 1/2 window. |

---

## 7. Decision Ledger — SignalDrop Integration ("Show My Manager")

| # | Decision | Rationale |
|---|----------|-----------|
| D-26 | SignalDrop-to-manager is a **third fork** of the existing pipeline, not a migration. Forge keeps the watchlist/strategy forks. Parse, ticker validation, injection guard, content-hash cache, and shadow logging are reused as-is. | New consumer of paid-for infrastructure; added scope is roughly the reaction layer, not a feature. |
| D-27 | Every reaction terminates in a **disposition grounded in the book**: `relevant_to_holdings` (+how) \| `watching` (+trigger) \| `no_action` (+reason) \| `proposed_tilt` (routed through the advisory channel per D-10/D-11). | Personality without a position is a chatbot trick. The portfolio is what makes the reaction non-generic. |
| D-28 | Verification pass: extracted claims are cross-checked against internal data (EODHD, volume regime, index intelligence, DRB) before the agent asserts them. The agent distinguishes "this claims X" from "X is true," and says when its own data disagrees. | The Rule Honesty Gate as user-facing character. The differentiator vs. pasting a tweet into any chatbot; teaches the platform's epistemics by example. |
| D-29 | One flow, not two features: drop → reaction + disposition → user pushback → **debate mechanic escalates**. The reaction is the debate's opening statement when there's disagreement. The debate feature's home is the Command Center. | No parallel systems. |
| D-30 | Every reaction is timestamped, and disposition outcome tracking extends the existing drop-history outcome model — producing the agent's **call ledger** ("that article you dropped? I passed. Down 12% since."). | Receipts culture as a relationship feature. An agent that owns its right and wrong calls is one users trust with a quarter of commitment. Costs a schema field. |

---

## 8. Decision Ledger — Proactive Messaging, Command Center, and the Arena

| # | Decision | Rationale |
|---|----------|-----------|
| D-31 | Proactive messaging V1 runs on **internal triggers only**: Wire-entries × holdings join, portfolio events (price/volume anomalies on held names), DRB regime shifts against book posture, upcoming earnings on holdings. | Proactivity is a trigger problem, not a search problem. Portfolio relevance can only come from our own data. The Wire's typed channel was built for exactly this consumption. |
| D-32 | Ruthless rate limit on proactive messages (baseline ~2/week; tune from data). | An agent that pings twice a week with something real is a trader friend; one that pings daily is a notification. |
| D-33 | The enrichment layer ("the why behind the trigger") is built behind a **vendor-agnostic seam** and routed **through the newsroom/Wire at the platform level** — one research pass enriches a story once; all portfolios holding the ticker consume it. Bespoke per-agent research is trigger-gated and budget-capped per portfolio per week. | Platform-scaled flat cost (~$50–100/mo at any user count) instead of account-scaled cost. |
| D-34 | Enrichment vendor decided by harness, post-launch: Perplexity Sonar (incumbent, already paid for) vs. Exa (same triggers, judged on correctness and specificity of the retrieved "why"). Exa Monitors noted for future research-goal standing watches seeded from Vision. | Same philosophy as D-25: slots get vendors on receipts. No third data subscription pre-launch on excitement. |
| D-35 | BaggerBomb moves to an **Arena**: 1v1, anytime start, agent + user portfolio combination (league-game pattern), battleview largely unchanged. | Separates ambient (portfolio) from competitive (arena); removes scheduling friction. |
| D-36 | The House Battle System guarantees an opponent — the arena can always offer a house match. | Anytime 1v1 needs matchmaking liquidity the platform won't have at launch. |
| D-39 | **The Command Center identity remains as-is; the loadout selection component relocates to the league section of the app.** | Loadout is a game concern; the Command Center's spine is the portfolio and the manager relationship. Relocation lands in Spec 4 scope. |
| D-41 | **The First Experience is a named Spec 3 deliverable, not emergent behavior.** With rolling quarters, every portfolio begins the moment onboarding ends — the manager's opening move is the first impression of the entire product. Scope: the manager introduces itself, states what kind of book it intends to run and why, narrates its first buys as they happen, and establishes the conversational relationship — the "dropped into something alive" moment. Design bar set by founder: **the first experience should be magical.** | The flagship's front door. It deserves deliberate design, its own spec section, and its own review — not hope that it falls out of the proactive trigger system. |

---

## 9. Instrumentation and Data Commitments (Launch-Blocking)

Data not captured at launch cannot be recovered; the first cohort's behavior is the one dataset we only get once.

| # | Commitment |
|---|-----------|
| I-1 | **Coverage audit** pre-launch: map every game mode as horizon × scoring emphasis × universe; verify each launch archetype has at least one arena where its edge can express. Where one doesn't, pre-register the expectation in writing ("fundamental archetypes are expected to lag short formats — format fit, not archetype failure") so launch data isn't misread. Check whether EarningsGame scoring rewards fundamental prediction quality (it is the fundamental investor's natural arena). |
| I-2 | **Shadow trading-quality scoring** live from day one (D-16). |
| I-3 | **Cross-mode replication gate** on lesson promotion live from day one (D-18). |
| I-4 | **User-contribution counterfactual** instrumented from day one: battles/portfolios with Vision vs. without; veto outcomes vs. what the vetoed trade would have done; pivot outcomes vs. staying put. This is the datum that validates or falsifies "teaches users to think directionally by doing it with them." |
| I-5 | **Complement-assignment experiment**: onboarding deliberately assigns complementary archetypes (speculative user → defensive manager). The first rollover choice measures whether users keep the complement or flee to a mirror. |
| I-6 | **Run-rate telemetry**: per-user token/cost tracking from week one against the D-22 budget. |
| I-7 | **Regime-window cohorting** (consequence of D-37): with rolling quarters there is no shared boundary, so attribution cohorts are built by regime window at query time. Every portfolio's daily performance is regime-tagged at capture (already standard), and every portfolio carries its vintage stamp (D-9). Cohorting is a query-time construction, not a schema alignment — Spec 1 must guarantee the tags exist; nothing else changes. |

---

## 10. Build Sequence

**Step 0 — this charter.** Committed to `docs/` before rules work completes.

**Prerequisite A (parallel with rules completion): cron dispatcher consolidation.** Slots are at ~38–40/40; portfolio evals, rollover processing, and proactive triggers cannot land on the current budget. Standalone CC task: dispatcher cron fans out to handlers. Blocking for Spec 1.

**Prerequisite B: archetype identity-pushback fix (D-13).** Lands before or inside Spec 3.

**Prerequisite C: Voice Layer model decision (D-40).** Harness runs during the Spec 1/2 window; decision locked before Spec 3 begins, because Spec 3's archetype reaction prompt suites are model-tuned assets.

**Then, in dependency order — one spec, one branch, one merge at a time:**

| Spec | Scope | Process notes |
|------|-------|---------------|
| **Spec 1 — Portfolio Substrate** | Portfolio schema (including vintage stamp per D-9 and regime tagging per I-7, with D-38's don't-foreclose guardrail); lock + escape-hatch mechanics; rolling-quarter rollover mechanics (D-37); cadence-tiered eval extension of the eval pipeline; model-agnostic seam (D-23); honest risk-adjusted scoring; dormancy downshift flag; Batch API + caching wiring. | Touches fenced files → full §7 treatment: Phase 0 read-only discovery with `file:line` citations, hard STOP, founder review, **dual adversarial review at design lock**. Est. 2–3 weeks. |
| **Spec 2 — Onboarding Rework** | Questionnaire → assignment → portfolio creation; two-week single re-assignment hatch; complement-assignment experiment wiring (I-5). | Est. ~1 week. |
| **Spec 3 — Command Center** | Portfolio hotline (all existing functions retained, portfolio as the spine; Command Center identity unchanged per D-39); **First Experience sequence (D-41)**; debate feature installed; SignalDrop react fork (D-26–D-30); proactive trigger system V1 (D-31–D-32); enrichment seam stub (D-33); Voice Layer integration on the Prerequisite C model. | Requires Prerequisites B and C. Est. 2–3 weeks. |
| **Spec 4 — Arena Restructure** | BaggerBomb → Arena 1v1 anytime; agent + user portfolio combination; house-opponent wiring (D-35–D-36); **loadout selection relocation to league section (D-39)**. | Battleview survives. Est. 1–2 weeks. |

**Standing conventions apply throughout:** feature flags default `false`, merge dark, flag flips via separate one-line PRs; version-distinct filenames for all relay artifacts; push-at-STOP; CC never drives merges; live repo is authoritative over docs and memory.

**Timeline honesty:** ~6–9 weeks of focused work; realistically **~2 months** with review cycles and relay workflow. Games soft-launch untouched (on Haiku, current scoring) while this arc runs.

---

## 11. Deferred Ledger (Required by Day 90, Not Day 1)

The first rollovers arrive three months after each user's start. Quarter one is the build window, informed by real portfolio data.

| # | Item | Deadline |
|---|------|----------|
| DEF-1 | Rollover re-choose ritual UI (D-6) — per-user private ritual per D-37 | First user rollovers (~day 90) |
| DEF-2 | Archetype × regime attribution ledger displays (feeds D-17 narration and the rollover decision; built on I-7 regime-window cohorting) | First user rollovers (~day 90) |
| DEF-3 | Vintage-update machinery: per-user rollover substrate release process (D-9) | First user rollovers (~day 90) |
| DEF-4 | DeepSeek offline paired harness for decision surfaces (D-25a) | Background, non-blocking |
| DEF-5 | ~~Voice Layer A/B~~ **Superseded** — promoted to Prerequisite C (D-40) in V1.1 | — |
| DEF-6 | Enrichment vendor harness: Sonar vs. Exa (D-34) | Post-launch |
| DEF-7 | Research-goal standing monitors seeded from Vision (D-34) | Post-launch, after DEF-6 |
| DEF-8 | Agent call-ledger surfacing UI (D-30 data captured from day 1; display can follow) | Fast-follow |

---

## 12. Open Questions

| # | Question | Status / Recommendation |
|---|----------|------------------------|
| O-1 | **Flagship name.** "Quarterly portfolio" is a schema, not a hook. | **OPEN.** Candidates: **The Mandate** (you grant a manager a quarterly mandate — carries the lock, the trust, and the renewal in one word); **The Desk**; **The Book**; **Tenure**. Founder decision, pre-Spec 3 (the name shapes Command Center copy). Leaning: The Mandate. |
| O-2 | Calendar-aligned vs. rolling per-user quarters. | **RESOLVED V1.1** → Rolling per-user (D-37). |
| O-3 | Virtual starting capital amount; display currency conventions. | Spec 1. |
| O-4 | Portfolio universe: equities only at launch, or equities + crypto? Relationship to Universe Intelligence taxonomy. | Spec 1. Leaning equities-only V1 for scoring cleanliness. |
| O-5 | Position count and concentration caps for the book (platform sector-concentration cap spec exists — adopt, adapt, or exempt). | Spec 1. |
| O-6 | Escape-hatch UX framing (avoid advertising it as a free switch; frame as mismatch correction). | Spec 2. |
| O-7 | Proactive message delivery surface (in-app only vs. push notifications) and quiet hours. | Spec 3. |
| O-8 | Working name for the First Experience sequence (D-41) — internal label for specs and code. | **OPEN.** Suggestion: **Opening Bell** (the manager's opening bell — trading-native, and it names the moment, not the feature). Founder call; low stakes, settle by Spec 3. |

---

## 13. Charter Change Control

This charter is V1.1 and binding. Amendments follow the standing pattern: versioned successor documents (`_V1_2`, `_V2`) with an explicit changelog; no silent edits. Any spec, review, or build discussion that surfaces a conflict with a charter decision stops and escalates to founder review — the charter changes deliberately or the spec conforms.

*End of charter.*
