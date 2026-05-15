# Voice Layer Rework — Master Roadmap

**Date:** May 14, 2026
**Status:** Working roadmap. Path C sequencing locked. Phase specs deferred to implementation Claude Chats.
**Companions:**
- `FANTASYTRADES_PRODUCT_STATE_AND_DESIGN_SYNTHESIS.md` (product picture)
- `FANTASYTRADES_PRELAUNCH_SEQUENCE.md` (broader prelaunch sequence — this doc supersedes its Voice Layer items 4–5 specifically, keeps items 6–8)
- `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1.docx` + Addendum A (product stance — locked)
- `FANTASYTRADES_SPRINT2_TIERS_ROADMAP.md` V2 (the prior sequencing, partially superseded by this doc — see Section 2 reconciliation)
- `DOSSIER_SYSTEM_ROADMAP.md` (Sprint 2 design lives here, ships in Phase 5 of this roadmap)

---

## 1. Purpose

This is the working roadmap for the Voice Layer rework. It takes the foundations now in place (Layer 1 technical context, DRB sourcing fix, Tier 0 wrappers all shipped) and sequences the remaining work into six executable phases.

The audience is two-fold:

- **You returning to this work.** Anchor document. When planning paralysis returns, the answer is "execute the current phase."
- **Implementation Claude Chats.** Each phase becomes an implementation engagement with its own discovery + spec work. The roadmap is the contract; specs are downstream.

This is not a complete implementation spec. Per the team's discipline, specs come from proper discovery work in the implementation chat where the code can be read directly. The roadmap frames scope, dependencies, and done-when criteria with enough color that the implementation chat has a clean starting point.

---

## 2. Reconciliation with prior roadmaps

This roadmap reorders the work that lived in two prior documents:
- `FANTASYTRADES_SPRINT2_TIERS_ROADMAP.md` V2 (which had Sprint 2 before Tier 1 surfaces)
- `FANTASYTRADES_PRELAUNCH_SEQUENCE.md` (which had Voice Layer MVP before Dossier Sprint 2)

Both were right within their framing. The V2 roadmap optimized for "ship the dossier writers correctly the first time." The prelaunch sequence optimized for "ship user-facing product as early as possible for Users 1+2."

This roadmap (**Path C**) reconciles them by recognizing that "Voice Layer rework" and "Sprint 2 dossier work" aren't separate sequential blocks. Specifically:

- **Sprint 2 Item 1 (veto event capture) IS a Voice Layer feature.** When a user vetoes a co-pilot proposal, the agent following up with "want to tell me why?" is proactive voice. It plumbs into the same conversational infrastructure as trade narration.
- **Sprint 2 Item 3 (handoff artifact extraction) IS a Voice Layer feature.** It's the connective tissue between film room and next-day pre-battle gameplan — both conversational surfaces.
- **Sprint 2 Items 4 + 5 (conviction writer, partner writer) are dossier-internal.** They consolidate accumulated data into structured fields the Voice Layer reads. They benefit from accumulated data and should ship later, after surfaces have produced the conversational signal they consume.

Path C decomposes the work by user-facing payoff rather than by which document originally specced each piece. Items from both prior roadmaps interleave across phases.

---

## 3. The six phases at a glance

1. **Set the conversational floor** — mode-aware routing + first-message-on-deploy (~2-3 weeks)
2. **Trade narration + veto capture** — agent participates in trades (~2-3 weeks)
3. **Anticipation + handoff** — day-trading texture + day-over-day continuity (~2-3 weeks)
4. **First-class surfaces** — pre-battle gameplan + film room surface (~3-4 weeks)
5. **Dossier writers** — conviction + partner writers + pattern aggregator (~2 sprints / ~4 weeks)
6. **Polish + grading** — research register split, Mastery mode-gating, directional-clarity grading (~2-3 weeks)

Plus a **scheduled tools deep dive** (Section 4) between Phase 1 and Phase 2 — separate from the main phase sequence, used to think through which in-house tools to build and when.

Total runway: roughly 14-18 weeks for the rework itself. Post-Voice-Layer items (loadouts, onboarding, forge refinement) continue from the prelaunch sequence afterward.

---

## 4. The tools deep dive (scheduled between Phase 1 and Phase 2)

A separate brainstorming session, not a phase. Scheduled here because by then Phase 1 has shipped, mode-aware routing exists, and you'll have a more concrete sense of what the agent's voice feels like with the foundations in place. Pre-Phase-1 abstract tool-discussion would be premature; mid-Phase-2 would be reactive.

**What the deep dive covers:**

- What in-house tools / signals / computations exist today (Layer 1 technical bundle, Tier 0 wrappers, FantasyTimes, DRB, scout alerts, etc.)
- What additional tools would meaningfully enhance the agent or user experience (universe screener, portfolio risk synthesis, single-ticker deep-dive, sector beta integration, etc.)
- For each candidate tool: who consumes it (Voice Layer / Trading Brain / both), what shape (numerical signal / structured object / narrative), what value
- The pre-cached vs on-demand invocation choice for tools that need to ship in Phase 4+ surfaces

**What the deep dive does NOT do:**

- Architect a tool-calling framework as a discrete project
- Build a registry / abstraction layer for tools
- Replace pre-cached blocks with on-demand calls everywhere

The framing is: tools as the moat (proprietary signals, computations, content products). Tool-calling pattern is just how the LLM accesses them. Don't conflate the two.

**Output:** A short companion doc listing tool candidates with phase-mapping, so Phases 2-6 know which tools they're building or consuming.

**Timing:** After Phase 1 ships (so you have real experience with mode-aware routing live in production) and before Phase 4's surfaces begin (so the surfaces can use the tools deep-dive output as input).

---

## 5. The six phases

### Phase 1 — Set the conversational floor

**Scope:** Two pieces of work that together establish the architectural prerequisite and the smallest visible proactive feature.

**A. Mode-aware routing.** The current `voiceLayerPrompt.js` dispatch reads phase (Discovery / Refinement / Mastery) but not authority mode (Auto-pilot / Co-pilot / Manual). Mode-aware routing lets every downstream surface and proactive moment behave differently based on the user's current authority mode.

**B. First-message-on-deploy.** When a battle deploys, the system writes one Gemma-generated message into `chatExchanges[]` so the user sees it when they open Command Center. Replaces the silent empty timeline. Uses what exists today: archetype, strategy brief, current portfolio, DRB anchor. Doesn't yet read handoff content (that arrives in Phase 3).

**In scope:**
- Authority mode plumbing through voiceLayerPrompt.js dispatch
- Phase rule selection now considers (phase × authority mode) pair
- New register variants for auto-pilot vs co-pilot vs manual where they meaningfully differ
- First-message-on-deploy trigger logic + prompt design + chatExchanges write
- Iteration on first-message voice with real Gemma output

**Out of scope:**
- Trade narration writes (Phase 2)
- Anticipation messages (Phase 3)
- Mastery rule rewrite (Phase 6)
- New-user welcoming sub-mode (cross-cutting, threads through phases 2-3 but gets full treatment in Phase 6)

**Dependencies:** None. Layer 1, DRB, Tier 0 all shipped. Path is clear.

**Done when:**
- voiceLayerPrompt.js dispatch reads phase + authority mode and routes accordingly
- Authority mode is exposed on agent and reads from agent state
- First-message-on-deploy fires for every new battle deployment
- First message feels like the agent (not a system notification) across all three authority modes
- Production stable for 1-2 weeks

**Why this position:** Mode-aware routing is the architectural prerequisite for every other proactive feature. Without it, trade narration in Phase 2 would need to make mode decisions inline which produces inconsistency. First-message-on-deploy is paired with it because it's the smallest possible proactive feature — proves the architecture works while shipping immediate visible product.

**Honest scope flag:** Prompt design for first-message is real craft. Each authority mode needs its own voice. Plan 1 week minimum for prompt iteration, not just 2-3 days. The architectural piece (mode-aware routing) is mechanical; the voice piece is iterative.

---

### Phase 2 — Trade narration + veto capture

**Scope:** Two paired pieces that together turn the agent from silent-and-reactive into participating-in-trades.

**A. Trade narration.** When the agent executes a SWAP_IN or SWAP_OUT during a battle, write a Gemma-generated message into chatExchanges. First person, cites Layer 1 technical evidence ("Selling AAPL — RSI hit 76, MACD just crossed bearish, dropped below VWAP for the first time today"). Mode-aware: auto-pilot transparency ("I just executed X"), co-pilot framing differs slightly.

**B. Veto event capture (Sprint 2 Item 1 from V2 roadmap).** When user vetoes a co-pilot proposal, capture the veto with structured reason. Agent follows up: "want to tell me why?" Captured veto data flows to `agentBattles/{battleId}.vetoEvents[]` for later consumption by Phase 5's writers.

These pair because they're two sides of the same product moment: the agent makes (or proposes) trades, the user responds, the agent narrates or follows up. Both are proactive voice features.

**In scope:**
- Trade narration trigger logic (on swap execution)
- Trade narration prompt design citing Layer 1 evidence
- Differentiated voice across auto-pilot (transparency), co-pilot (proposal confirmation), manual (notification only)
- Veto capture UI hook + API endpoint + Firestore field
- Veto follow-up prompt mode
- Veto reason categorization (free-text + optional structured category)
- Cross-battle veto data available for Phase 5 writers

**Out of scope:**
- Cross-battle pattern recognition messages (needs aggregator from Phase 5)
- Anticipation moments (Phase 3)
- Strategy effectiveness self-assessment (post-launch)

**Dependencies:** Phase 1 (mode-aware routing). Tools deep dive (which may surface that this phase needs Portfolio risk synthesis or other tools).

**Done when:**
- Every trade execution produces a narration message
- Narrations cite Layer 1 evidence accurately
- Co-pilot vetoes produce structured vetoEvent records
- Agent follow-up after vetoes feels warm, not interrogative
- Production stable for 1-2 weeks

**Why this position:** Trade narration is the highest-frequency proactive moment in the product. Auto-pilot users (the expected majority) experience trade narration constantly. Pairing veto capture means co-pilot users also get a meaningful proactive moment, and the data infrastructure for Phase 5 starts accumulating immediately.

**Honest scope flag:** Trade narration prompt design is harder than first-message because trades happen with different contexts (winning vs losing, early vs late battle, conviction trades vs reactive trades). Each variant needs its own voice. Plan for substantive iteration.

---

### Phase 3 — Anticipation + handoff extraction

**Scope:** Two pieces that together build day-trading texture and day-over-day continuity.

**A. Basic anticipation.** When the eval cron detects threshold proximity, RS classifier triggers, or breakout-setup conditions, write a Gemma-generated message flagging what the agent is watching. "Tracking META — if it breaks above 250, I'll consider rotating in." Uses Layer 1 + Tier 0 data (threshold proximity wrapper, sector RS, etc.).

**B. Handoff artifact extraction (Sprint 2 Item 3 from V2 roadmap).** Co-tenant write inside `agent-batch-review.js`. After the existing auto-debrief lands, extract the 6-field handoff structure (lessons[], tensions[], open_questions[], partnerObservations[], carryover_directives[], agent_self_reflection) and write to `agentBattles/{battleId}.handoff`. Schema is already locked in V1.1 product stance Section 5.

**In scope:**
- Anticipation trigger logic (uses existing Tier 0 wrappers + Layer 1 signals)
- Anticipation prompt design with mode-aware framing
- Rate limiting (don't spam anticipation messages)
- Handoff extraction prompt inside agent-batch-review.js
- Handoff Firestore write
- Handoff schema validation
- partnerObservations[] dimension-tagging (15 dimensions per voiceLayerPrompt.js:475-491)
- 5-battle tension decay logic

**Out of scope:**
- Pre-battle gameplan reading handoff (Phase 4)
- Conviction/partner writers reading handoff (Phase 5)
- Reaction-to-market-events feature (post-launch)
- Bench/opportunity surfacing as standalone feature (basic anticipation covers some of this)

**Dependencies:** Phase 1 (mode-aware routing), Phase 2 (trade narration in place — anticipation must coexist with narration without overlapping). Tools deep dive output should inform anticipation tool needs.

**Done when:**
- Anticipation messages fire on threshold proximity, RS classifier hits, breakout setups
- Anticipation rate-limited appropriately (no spam)
- Handoff artifacts written nightly per battle
- Handoff data spot-checked across multiple battles for quality
- Production stable for 1-2 weeks

**Why this position:** Anticipation is the texture that makes the in-battle experience feel alive between trades. Handoff is what gives day-over-day continuity to the agent's relationship with the user. Both are foundations for Phase 4's first-class surfaces (pre-battle gameplan reads handoff; film room reads handoff outputs).

**Honest scope flag:** Anticipation triggers need careful tuning. Too aggressive = spam. Too conservative = silence. Expect a tuning pass after initial deployment. Handoff extraction prompt design is its own iterative work because the auto-debrief output varies day-to-day.

---

### Phase 4 — First-class surfaces (pre-battle gameplan + film room surface)

**Scope:** Two new conversational modes that bookend the trading day. Both ship as their own modes in voiceLayerPrompt.js, joining the existing 5+1 mode system.

**A. Film room surface.** Per V1.1 stance Section 4.4. Co-exists with (or replaces) the existing 'review' mode. Reads handoff artifact from Phase 3, full battle record, agent's reflection, day's gameplan brief. Produces handoff (writes more directly than auto-debrief did), grades the user (Phase 6 hook — grading deferred), feeds Sprint 2 writers (Phase 5).

**B. Pre-battle gameplan mode.** Per V1.1 stance Section 4.1. Workshop-inspired but time-aware. Reads handoff artifact from previous battle, current portfolio, market regime, recent partnerProfile. Produces directional brief that the trading engine reads in auto-pilot and that Voice Layer references during the day in co-pilot. First-class case to support: "continue what we did yesterday."

These pair because they're the two ends of a day-arc — film room debrief one evening, pre-battle gameplan the next morning. Build them together so the handoff contract between them is consistent.

**In scope:**
- New mode dispatch in voiceLayerPrompt.js (gameplan + film_room_v2 modes)
- Pre-battle gameplan prompt construction
- Film room surface prompt construction (richer than current review mode)
- "Continue what we did yesterday" as first-class case
- Directional brief schema + Firestore write
- Film room reading handoff data and producing structured outputs
- Tool integration (Portfolio risk synthesis + Single-ticker deep-dive + Universe screener as available)
- Sequencing within phase: film room first (Phase 5 dependency), then pre-battle gameplan

**Out of scope:**
- User directional-clarity grading function (Phase 6)
- New-user welcoming sub-mode treatment (Phase 6)
- Mid-battle research register split (Phase 6)
- Mastery rule mode-gating rewrite (Phase 6)
- Conviction/partner writers reading film room output (Phase 5)

**Dependencies:** Phase 3 (handoff artifact exists). Tools deep dive output (which tools ship in this phase). Phase 1-2-3 foundations.

**Done when:**
- Pre-battle gameplan mode dispatches and produces directional briefs
- "Continue what we did yesterday" works as a recognized request
- Film room surface produces structured handoff + auto-debrief output
- Users in production successfully engage with both surfaces
- Tool integration (whatever tools are wired in this phase) functional
- Production stable for 2-3 weeks (longer than other phases — these are the highest-stakes surfaces)

**Why this position:** Phase 3 produced the handoff data. Phase 4 is the conversational pair that produces handoff + reads it. Without this phase, handoff is data sitting unused. With it, the day-over-day continuity becomes user-visible.

**Honest scope flag:** This is the largest phase (3-4 weeks). Two new modes, tool integration, prompt design iteration on the highest-stakes surfaces in the product. Don't underscope. Sequence within the phase: film room first (smaller, Sprint 2 dependency, Layer 1 already enables rich film room conversations), then pre-battle gameplan (highest-stakes new surface, most product-defining work).

---

### Phase 5 — Dossier writers (conviction + partner + pattern aggregator)

**Scope:** The remaining Sprint 2 items that didn't get pulled into earlier phases. These are dossier-internal — they consolidate accumulated data into structured fields that Phases 1-4 surfaces read at runtime.

**A. Battle pattern aggregator (Sprint 2 Item 2).** Cron or on-read function that synthesizes `agent.battlePatterns` subcollection across recent N battles. Output: structured behavioral patterns the writers consume.

**B. Conviction writer (Sprint 2 Item 4).** Sonnet consolidation pass populates `agent.convictions[]` every 5 games. Reads veto events (from Phase 2), handoff artifacts (from Phase 3), battle patterns (from A above), Layer 1 technical snapshots. Produces ticker/sector/thesis-specific convictions.

**C. Partner writer (Sprint 2 Item 5).** Sonnet consolidation pass populates `agent.partnerProfile` every 5 games. Reads handoff partnerObservations[], lessons, conversation transcripts. Produces per-dimension partnerProfile updates (15 dimensions).

**In scope:**
- Battle pattern aggregator implementation
- Conviction writer following Sprint 1 consolidation template
- Partner writer following Sprint 1 consolidation template (with funnel principle — single canonical writer)
- Reading paths from Phases 2-4 outputs (veto events, handoff, etc.)
- Writing to dossier fields per funnel principle
- 5-game consolidation cycle integration

**Out of scope:**
- Sprint 3 (Scout/Scan Pipeline) — full design deferred per dossier roadmap
- Vision↔Dossier boundary (Sprint 5 in dossier roadmap, deferred)
- External Intelligence Pipeline integration (separate workstream)
- Surface changes — surfaces from Phase 4 already read these fields; they just read more content once writers ship

**Dependencies:** Phases 2-4 (the writers need accumulated data from veto events, handoff artifacts, conversation transcripts).

**Done when:**
- Battle pattern aggregator produces queryable patterns
- Conviction writer populates agent.convictions[] in real production cycles
- Partner writer populates agent.partnerProfile across 15 dimensions
- Voice Layer surfaces (Phases 1-4) successfully read enriched dossier content
- Funnel principle held (single canonical writer per derived field)
- Production stable for 2 sprints

**Why this position:** Writers benefit from accumulated data. By Phase 5, you have weeks/months of veto events, handoff artifacts, and conversation transcripts. Writers ship against rich foundation, not synthetic data. The surfaces in Phases 1-4 are read-from-empty initially and read-from-rich after Phase 5 — same surface architecture, more content.

**Honest scope flag:** ~2 sprints (4 weeks) is the Sprint 2 estimate from V2 roadmap. Conviction is the template; partner adds multi-source synthesis on top. Both follow Sprint 1's consolidation writer pattern, which was validated in production. Lower architectural risk than earlier phases; higher craft risk in prompt design for the writers.

---

### Phase 6 — Polish + grading

**Scope:** Final pass items that polish the rework into launch-ready shape. These are the remaining Tier 1 items from V2 roadmap.

**A. Mid-battle research register split.** Per V1.1 stance Section 4.3. Battle mode currently mixes decision-shaped and learning-shaped conversation. Phase 6 splits them into distinct register variants within battle mode. User asking "what's happening with semis today?" gets learning-shaped response; user saying "should I sell NVDA?" gets decision-shaped response.

**B. Mastery rule mode-gating rewrite.** Per V1.1 stance Section 7.2. Current Mastery rules contain directive language ("Lead EVERY conversation with a complete, pre-formed plan") that contradicts the product stance. Fix: mode-gate Mastery rules so they only apply in Auto-pilot. Replace plan-first / options-banned directives with evidence-first / falsifiability-driven framing where users are in Co-pilot or Manual.

**C. New-user welcoming sub-mode.** Per V1.1 stance and audit. Keyed on `gamesPlayed === 0` or empty partnerProfile. Softer opening register, permission for open-ended turns, proactive-invitation patterns. Cross-cutting addition (touches multiple modes).

**D. Score- and time-conditional templates.** Per audit Requests 13, 14. Late in battle + losing + close to threshold = different agent register than early in battle + winning.

**E. Promote invalidationConditions[] schema.** Per V1.1 stance and audit. Currently Forge-only. Promote to foundational primitive across evaluative interactions.

**F. User directional-clarity grading.** Per V1.1 stance Section 6. Grading function: input = battle record + conversation transcripts, output = grade + evidence. Surfaces in film room and user profile. Design specifics are still loose (scale, weighting, recoverability, beta visibility) per V1.1 — Phase 6 produces both the design pass and the implementation.

**In scope:** All of the above.

**Out of scope:**
- Proactive surfacing infrastructure (full version) — V2 roadmap Tier 2, post-launch
- Thesis pressure-test tool (full version) — Tier 2, post-launch
- Sector beta data integration — Tier 2
- Quant/macro DKB upload campaign — separate workstream

**Dependencies:** Phases 1-5. Phase 6 polishes the existing surfaces; without them, there's nothing to polish.

**Done when:**
- Mastery rules mode-gated; production stable across all three authority modes
- Research vs decision register split detectable in real conversations
- New users (first 5-10 battles) experience welcoming register
- Score/time-conditional templates fire appropriately
- invalidationConditions[] schema in use across multiple surfaces
- User directional-clarity grading shipping per-battle grades, rolling averages, XP bar
- Voice Layer rework is launch-ready

**Why this position:** Polish work depends on the rework existing first. Grading is itself a real design pass that benefits from observing how users actually engage with the surfaces.

**Honest scope flag:** This phase has 6 sub-items that could individually justify their own focused sessions. Plan ~2-3 weeks across all of them; don't try to design grading exhaustively pre-implementation. The V1.1 stance explicitly defers grading design specifics to a focused session — that focused session is part of Phase 6, not Phase 0.

---

## 6. What the rework produces

At the end of Phase 6, FantasyTrades has:

- An agent that talks first when battles deploy
- An agent that narrates its trades with technical evidence
- An agent that flags what it's watching for during the day
- An agent that follows up when users veto its proposals
- A pre-battle gameplan conversation that reads yesterday's context
- A film room debrief that produces structured handoff data
- A dossier that grows automatically from accumulated user-agent interactions
- A grading system that gives users a sense of their own development
- Mode-aware behavior across auto-pilot, co-pilot, and manual
- A new-user welcoming experience that doesn't dump complexity on first contact
- Research and decision conversations that don't get muddled together

This is the launch-ready Voice Layer.

---

## 7. What this rework does NOT do (deferred post-launch)

Explicit non-goals to prevent scope creep:

- **Full proactive surfacing infrastructure** (per V2 roadmap Tier 2). The proactive features in Phases 1-3 are the MVP; the broader event-source + dispatcher + agent-led monologue architecture is post-launch.
- **Thesis pressure-test tool full version.** Tier 2.
- **Cross-battle pattern recognition as narrative output** ("you've sold AAPL three times in similar setups"). Phase 5's writers produce the data; surfacing it as natural narrative is post-launch refinement.
- **Strategy effectiveness self-assessment.** Mid-battle reflection on whether the current strategy fits today's conditions. Post-launch.
- **Time-aware contextualization with microstructure rules.** Some game-state urgency is in place; time-of-day microstructure (opening 30 min, lunch lull, power hour as distinct register triggers) is post-launch.
- **Reaction to market events as separate stream.** Anticipation in Phase 3 covers some of this; full reaction-to-events is post-launch.
- **External article injection into Voice Layer prompts.** Signal Drop V2 handles user-shared content via separate surface. Voice Layer prompt-side integration is post-launch.
- **Quant/macro DKB upload campaign.** Affects fullness of mid-battle research register but doesn't block its implementation.
- **Universe screener API beyond basic version.** Tier 1 includes a basic screener; full divergence detection + complex composite filters are post-launch.
- **Sector beta data integration.** Tier 2.

---

## 8. Post-Voice-Layer items (from prelaunch sequence, unchanged)

After Phase 6 ships, the original prelaunch sequence items 6-8 continue:

- **Item 6: Default classes + Loadout abstraction.** Settle defaults, build thin loadout layer.
- **Item 7: Onboarding redesign.** Comprehensive new-user journey now that defaults + Voice Layer exist.
- **Item 8: Forge component refinement** (post-launch).

These remain as described in `FANTASYTRADES_PRELAUNCH_SEQUENCE.md`. The Voice Layer rework supersedes prelaunch items 4-5 but leaves 6-8 intact.

---

## 9. The watchlist parallel work

The other Claude Chat is working on Watchlist (Phase 4 save endpoint + integration). This work continues in parallel with this rework. No hard dependency on this roadmap's sequencing; watchlist ships when it ships.

When watchlist lands, the Voice Layer prompts can read it as additional context (already partially in place via voiceLayerCache). No phase in this roadmap blocks on watchlist; no phase in this roadmap blocks watchlist.

---

## 10. Execution discipline

These principles are inherited from the broader prelaunch sequence document but worth restating for this rework:

**One phase at a time.** Don't have multiple Voice Layer phases in flight simultaneously. Phase N+1 starts when Phase N is done.

**Discovery first per phase.** Each phase begins with a discovery audit by the implementation Claude Chat. Spec follows discovery. Implementation follows spec. STOP points between sub-phases.

**No reopening the sequence mid-execution.** Six phases is the contract. Tools deep dive is the only scheduled detour. If something genuinely changes the picture (launch deadline shift, infrastructure surprise), revisit. Not otherwise.

**Cross-context review.** Per the May 13 DRB session, implementation Claude and review Claude are different roles. Apply that discipline here — implementation chat builds, review chat (this conversation's lineage, or a fresh one) reviews before merge.

**One task = one branch.** Phase 1 mode-aware routing is one branch. First-message-on-deploy is another. Etc.

**Honest deviation reporting.** When a phase's implementation surfaces unexpected complications, report them, don't paper over them. Burnout-friendly framing: deviation is signal, not failure.

**Recognize planning paralysis.** If you finish Phase 1 and find yourself wondering whether the sequence is still right, the answer is execute Phase 2. Not replan. The plan exists. Trust it.

---

## 11. Honest meta-notes

A few things worth being explicit about:

**This roadmap is more interleaved than the V2 roadmap.** That's a real choice. It optimizes for Users 1+2 experience over write-once correctness. The cost is that some surfaces (Phase 4) ship against initial empty fields and read richer content once Phase 5 lands. That's acceptable because the surface architecture doesn't change — only what they read does.

**The tools deep dive is a real piece of work, not a parking lot item.** Schedule it explicitly between Phase 1 and Phase 2. Its output should be a short companion doc that informs Phases 2-6. If the deep dive surfaces that new tools are needed, those tools become work items inside the phases that consume them.

**14-18 weeks is substantial.** Solo founder pre-launch effort. Don't try to compress it. The earlier "4-8 week MVP" framing was too small once the four conversational surfaces and mode-aware routing are properly accounted for.

**This roadmap doesn't replace product stance.** V1.1 product stance (four surfaces, three authority modes, handoff schema, grading principles) remains the authoritative product document. This roadmap is the sequencing/execution document. Read both.

**The implementation chats will produce their own specs.** Each phase's discovery work produces a phase spec. This roadmap is the contract; specs are downstream artifacts. Don't pre-spec what hasn't been discovered yet.

---

## 12. Companion documents

**Authoritative product stance:**
- `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1.docx` + Addendum A

**Other roadmaps:**
- `FANTASYTRADES_PRELAUNCH_SEQUENCE.md` — broader prelaunch sequence (items 6-8 still apply post-Voice-Layer)
- `FANTASYTRADES_SPRINT2_TIERS_ROADMAP.md` V2 — partially superseded by this doc (its Sprint 2 items are now distributed across Phases 2, 3, 5)
- `DOSSIER_SYSTEM_ROADMAP.md` — Sprint 2 design (now Phase 5 of this roadmap)

**Foundation references (shipped):**
- `FANTASYTRADES_LAYER1_FOUNDATION_REFERENCE.md` — Layer 1 technical context bundle
- `DRB_SOURCING_TECHNICAL_REFERENCE.md` — Daily Regime Brief deterministic pipeline
- `FANTASYTRADES_TIER_0_COMPLETION_SUMMARY.md` — Tier 0 wrappers (assumed complete based on your update)

**Voice Layer technical references:**
- `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` — Voice Layer prompt architecture spec
- `VOICE_LAYER_ROADMAP_V6_FINAL.docx` — earlier roadmap version (superseded)

**Process discipline:**
- `AI_ASSISTED_INFRASTRUCTURE_PLAYBOOK.md` — cross-context review + STOP-point + phase-report workflow

**Synthesis:**
- `FANTASYTRADES_PRODUCT_STATE_AND_DESIGN_SYNTHESIS.md` — overall product picture and design landings

---

## 13. Final framing

The Voice Layer rework is the largest pre-launch work remaining. Six phases, ~14-18 weeks, with a scheduled tools deep dive in the middle.

The first phase is well-scoped and ready for implementation. Mode-aware routing + first-message-on-deploy is the right starting point. After it ships, the tools deep dive surfaces what new in-house capabilities to build. Then Phase 2 begins.

Trust the sequence. Execute one phase at a time. Resist the urge to replan mid-phase. The plan is good enough. The work is the work.
