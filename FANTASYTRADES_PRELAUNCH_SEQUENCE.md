# FantasyTrades — Pre-Launch Execution Sequence

**Date:** May 12, 2026
**Purpose:** Grounding document for what to build, in what order, with enough context that you can return to it cold and know where you are.
**Companion:** `FANTASYTRADES_PRODUCT_STATE_AND_DESIGN_SYNTHESIS.md` (the why behind the what)
**Status:** Working sequence. Not perfect, but executable.

---

## How to use this document

When you feel the planning-paralysis return — when you're juggling too many directions or unsure what's next — come back here. The sequence is the contract. The current item is the next item. Don't reopen the question of order unless real new context emerges (launch deadline change, infrastructure surprise, etc.).

Each item below has:

- **What it is** — concise scope
- **In scope** — what gets built
- **Out of scope** — what deliberately doesn't get built in this item
- **Dependencies** — what needs to be done first
- **Done when** — explicit completion signal
- **Why this position** — why it sits where it sits

When you finish an item, the next item is automatic. No reconsideration.

---

## The sequence at a glance

1. Finish Layer 1
2. Finish Watchlist (parallel — other Claude Chat)
3. Fix DRB sourcing
4. Voice Layer Rework MVP
5. Dossier Sprint 2
6. Default Classes + Loadout Abstraction
7. Onboarding Redesign
8. Forge Component Refinement (post-launch)

Items 1-2 are mostly already in flight. Items 3-4 are the major pre-launch work. Items 5-7 round out the launch surface. Item 8 is iterative polish post-launch.

---

## Item 1: Finish Layer 1

**What it is:** Complete the in-flight Layer 1 implementation work for the Dossier system.

**In scope:**
- Whatever specific Layer 1 deliverables were defined when work started
- Closing open loops in the current implementation
- Ensuring it ships clean enough to not block downstream Sprint 2 work

**Out of scope:**
- Expanding Layer 1 scope to fit emerging ideas
- Starting Sprint 2 work prematurely
- Pivoting to other Dossier categories not in original Layer 1 plan

**Dependencies:** None — this is the current work.

**Done when:** Layer 1 deliverables are merged to main, tests pass, the implementation is ready to feed downstream Sprint 2 work.

**Why this position:** You're already most of the way through. Finishing in-flight work before starting anything new is psychologically and practically important. Open loops are exhausting. Close this one before anything else.

---

## Item 2: Finish Watchlist (parallel work in other Claude Chat)

**What it is:** Land the watchlist persistence and integration work happening in your other Claude Chat. Anchored by `HELMET_WATCHLIST_VISION_AND_IMPLEMENTATION_CONTEXT.md`.

**In scope:**
- Phase 4 save endpoint (turning the existing dialogue infrastructure into persistable watchlists)
- The "My Watchlists" surface for viewing, editing, equipping saved watchlists
- Manual build entry point (search and add tickers without AI)
- Integration: when watchlist tickers meet loadout criteria, prioritize as swap candidates
- Decide and implement the hotBench layering relationship (layer on top, not replace)
- Equip flow — watchlist equipped persistently on the agent (no per-deploy selection)

**Out of scope:**
- Building a "Loadout" abstraction that wraps watchlists (deferred to item 6)
- Loadout synthesis layer
- Watchlist-driven UI for Voice Layer (mid-battle watchlist references)

**Dependencies:** None — runs in parallel with item 1. Your job here is mostly to stay out of the way of the implementing chat and escalate open product questions when they surface.

**Done when:** Users can build watchlists (any of the three entry points), save them, view their library, equip one on their agent, and see them affect battle behavior through swap priority.

**Why this position:** Parallel work, no critical path conflict with Layer 1. Your other chat is driving it. Treat as background until they escalate or finish.

---

## Item 3: Fix DRB sourcing

**What it is:** Resolve the underlying inaccuracy in Daily Regime Brief event data by augmenting (or replacing) Perplexity Sonar as the sourcing API.

**In scope:**
- Investigate the Sonar API vs Perplexity-app discrepancy to understand why interactive chat works but API doesn't (may inform whether augmenting or replacing is right)
- Investigate EODHD calendar endpoints — you're already paying for All-In-One, calendar data may be included and underused
- Evaluate dedicated event APIs: Financial Modeling Prep, alternative providers for earnings/economic calendars
- Implement augmented sourcing — Sonar continues as writer; new source provides accurate event data
- Verify the DRB output is accurate for calendar events, earnings, FOMC dates, economic releases
- Fix the shadow logger bug as part of this work (silent training-data loss to GCS)

**Out of scope:**
- Rewriting DRB compilation logic entirely (only touch what's needed for sourcing accuracy)
- Adding new sections to the DRB while you're in there
- Building current events UI in app (that was the work blocked by this; build it after sourcing is fixed)

**Dependencies:** Items 1 and 2 finishing first (so your attention isn't split).

**Done when:** DRB output passes accuracy checks for the next two weeks (calendar events appear correctly, earnings dates match reality, economic releases tracked accurately). Shadow logger writes to GCS daily without silent failures.

**Why this position:** The DRB is foundational. It feeds voiceLayerCache via marketContext, which feeds the Voice Layer prompt. The Voice Layer rework (item 4) cannot reliably build proactive event-aware features on top of compromised event data. Fixing sourcing here unblocks everything downstream that depends on accurate market intelligence.

**Honest scope flag:** This could be one Claude Chat session (swap an API call, validate output) or it could be a deeper rabbit hole (DRB compilation logic needs revisiting). Scope it carefully at the start. If it looks like it's deepening, pause and decide whether to expand scope or ship a minimal fix.

---

## Item 4: Voice Layer Rework MVP

**What it is:** The centerpiece pre-launch work. Transform the Voice Layer from reactive-only to proactively participatory in battles. MVP-level, not the full rework.

**In scope (the three MVP features):**

**A. First-message-on-deploy.** When a battle deploys, write one Gemma-generated message into `chatExchanges[]` that the user sees when they open Command Center. The agent introduces itself with strategy context, tickers being watched, opening posture. Replaces the silent empty timeline.

**B. Trade narration.** When the agent executes a SWAP_IN or SWAP_OUT during a battle, write a Gemma-generated message into chatExchanges explaining the trade in first person. "Selling AAPL — momentum's fading. Picking up NVDA on volume confirmation."

**C. Basic anticipation.** When the eval cron detects threshold proximity, near-breakout setups, or similar tractable triggers, write a Gemma-generated message flagging what the agent is watching. "Tracking META — if it breaks above 250, I'll consider rotating in."

**Each MVP feature includes:**
- Trigger logic (when to write)
- Prompt design (what the agent actually says — this requires real iteration, not one-shot drafting)
- Integration with existing chatExchanges write path
- Testing with real Gemma output for voice consistency
- Budget management (these new messages count against or coexist with the existing 10-msg user budget — needs design decision)

**Out of scope:**
- Cross-battle pattern recognition (needs dossier infrastructure not in MVP)
- Strategy effectiveness self-assessment (deeper dossier dependency)
- Bench/opportunity surfacing as full feature (basic anticipation covers some of this; full surfacing is post-MVP)
- Time-aware contextualization with microstructure rules
- Reaction to market events as separate stream
- Lifting OpenChatPanel directive-veto pattern into AgentChat (separate work)

**Dependencies:** Items 1, 2, 3 complete. Specifically:
- Layer 1 done so Dossier infrastructure isn't churning
- Watchlist done so the agent has user-authored preference data to reference
- DRB fixed so the agent doesn't hallucinate about upcoming events

**Done when:**
- Every battle deployment produces a first message in chat before user interaction
- Every trade execution produces a narration message
- Basic anticipation messages fire when thresholds are detected
- All three feel like the agent (not system notifications) per user testing with real output
- Production stable for 1-2 weeks

**Why this position:** This is the single most important pre-launch work. The Voice Layer is the user-experience product. Per the Voice Layer Tool Readiness audit and the synthesis doc, proactive voice is the largest acknowledged gap. The MVP is the smallest meaningful version. Without it, the agent feels silent during battles regardless of how good everything else is.

**Honest scope flag:** This is 4-8 weeks of focused work, including prompt iteration. The prompt design is real craft — each message has to feel like the agent, be useful without overwhelming, and feel proactive without feeling spammy. Plan accordingly. Don't underscope this.

---

## Item 5: Dossier Sprint 2

**What it is:** Resume the originally-planned Dossier system Sprint 2 — partner profile writers, conviction writers, additional discipline categories.

**In scope:**
- Partner profile writers (the consolidation logic that populates `agent.partnerProfile` from accumulated lessons and conversation patterns)
- Conviction writers (the consolidation logic that populates `agent.convictions` about specific stocks, sectors, themes)
- Additional discipline categories (selection + execution + whatever else Sprint 2 scoped originally)
- Veto event capture (audit identified as Sprint 2 prerequisite — when users veto agent proposals, capture the event for pattern aggregation)
- Cross-battle pattern aggregator infrastructure (reads battlePatterns, synthesizes N-game trends)

**Out of scope:**
- New dossier categories not in Sprint 2 plan
- UI surfaces for displaying dossier content directly (separate work)
- Connecting forgeSuggestions[] to a redeem UI (separate work)

**Dependencies:** Item 4 (Voice Layer MVP). The dossier develops faster with proactive Voice Layer engagement. Lessons, partnerProfile, and patterns all benefit from the conversational data the rework generates.

**Done when:** Sprint 2 deliverables (per the Dossier Roadmap doc that already exists) ship and integrate. The consolidation cron writes to the new fields. Voice Layer prompts can read them.

**Why this position:** Originally planned to come after Layer 1. Got delayed. Now resumes with the benefit of having Voice Layer infrastructure that better feeds dossier development. The two systems are intertwined more than the original sequencing assumed.

---

## Item 6: Default Classes + Loadout Abstraction

**What it is:** Settle the "great defaults" question and build the thin loadout abstraction layer.

**In scope:**

**A. Default classes.** Decide and implement the platform-curated default loadouts that new users can choose from or get auto-equipped. These are the "Assault, Recon, etc." starter classes from your COD analogy. Specific decisions:
- How many default classes (probably 3-6)
- What each represents (trading style + risk profile + starting watchlist + starting strategy)
- Visual identity (icon, color, name)
- How they map onto existing archetypes (do they replace? augment?)

**B. Loadout abstraction.** Build the thin presentation/library layer over existing infrastructure:
- A "Loadout" entity that references a deployedStrategy + a watchlist + a name
- Save / equip / switch / archive flows
- The "My Loadouts" UI surface
- 3 free, paid for more (per locked decision)
- Persistent equip pattern (no per-deploy selection)

**Out of scope:**
- The full helmet/sword/shield three-slot UI metaphor unless it's earning its complexity
- Loadout synthesis layer (LLM-generated narrative tying pieces together) — defer to V2
- Visual robot integration with loadout state — defer
- Multi-watchlist-per-loadout — single watchlist per loadout in V1

**Dependencies:** Items 2 (watchlist) and 4 (Voice Layer MVP) at minimum. Item 5 helpful but not strictly required.

**Done when:** Users can save loadouts, equip them, switch between them. New users can choose from default classes. Default classes produce coherent agent behavior.

**Why this position:** Defaults need to settle before onboarding can be built coherently. The loadout abstraction needs the underlying pieces (watchlist, strategy) to be working in production. By this point in the sequence, both exist.

**Honest scope flag:** The structural question (two-slot vs three-slot loadout) is still open in our design conversations. When you reach this item, that decision will need to be made. The answer depends on whether the helmet/sword/shield metaphor is doing real product work for users by then. You'll have better data by this point than you do now.

---

## Item 7: Onboarding Redesign

**What it is:** Comprehensive new-user journey design and implementation. Not a "fix the gap" patch — a coherent end-to-end onboarding flow that integrates with everything built in items 1-6.

**In scope:**
- The empty-dashboard-no-nudge fix (route new users to agent creation)
- Default class selection or auto-equip during agent creation
- Optional Workshop intro for users who want to design their own strategy
- First-battle scaffolding (a tutorial overlay or guided moment for the first battle specifically)
- Education within the flow (light tooltips, plain-language explanations of what an archetype means, what a battle is, etc.)
- The post-creation-pre-first-battle moment (does the agent greet the user before they hit Deploy? what's the bridge?)

**Out of scope:**
- Full SpotlightTour configuration for all features (V2)
- Academy video integration into onboarding (V2)
- Multi-session onboarding (the new-user journey should be self-contained in their first session)

**Dependencies:** Items 1-6 complete. You need defaults, loadouts, and Voice Layer working before designing the onboarding around them.

**Done when:** A brand-new user can go from signup to first battle running with a clear, supportive flow. The empty dashboard problem is gone. The agent's first interaction with the user feels intentional, not accidental.

**Why this position:** Onboarding orchestrates everything before it. Building onboarding before defaults are settled means building around a hypothetical product. With items 1-6 done, the onboarding designer (you, plus a Claude Chat) has a real product to onboard users into.

---

## Item 8: Forge Component Refinement (post-launch)

**What it is:** Iterative polish on the Forge ecosystem — Playbooks, Mech Bay, Workshop Chat, Pit Stop, Intel Codex, traits/DNA.

**In scope (post-launch, prioritized by real user feedback):**
- Whatever specific refinements emerge from real usage
- Forge Category A/B bifurcation (mentioned in userMemories as pending)
- Forge Season Mode implementation (specced, not built)
- Discover tab build-out (architecture decided, not built)
- TradingView signal bridge (spec complete, not built)
- Mini-ARCH / Playbook UX evolution based on what users actually do

**Out of scope:**
- Anything not driven by post-launch usage data
- Speculative redesign of working surfaces

**Dependencies:** Launch.

**Done when:** Iterative. There's no done state — Forge refinement continues as long as the product evolves.

**Why this position:** Pre-launch, the Forge works. It's rich and shipped. Refinement matters but doesn't make or break launch. Real user data is more valuable than pre-launch speculation about what to refine.

---

## What's deliberately excluded from this sequence

A few things that came up in design conversations but aren't in the sequence, with honest framing:

**The full Voice Layer proactive voice rework** (cross-battle pattern, strategy self-assessment, full reaction to market events, time-aware contextualization). These are real value but the MVP captures most of the user-experience impact. Add incrementally post-launch.

**Pipeline Contract V1.1 / Skill Schema / earlier architecture work.** Set aside as reference. Not in active execution.

**Two-pipeline consolidation** (Mech Bay rules + DeployedStrategy unification). Technical debt. Real but not blocking launch. Address post-launch when real usage data informs which pipeline matters most.

**Loadout synthesis layer** (LLM-generated narrative). Deferred to V2 unless clear it adds user value beyond simple presentation.

**Most half-built features** (forgeSuggestions UI, OpenChatPanel revival, DKB Semantic RAG, External article injection, etc.). Per the Voice Layer audit's full 11-priority list. Address incrementally post-launch.

These aren't forgotten — they're parked. If a specific one becomes pre-launch-critical, it can be reintegrated. But the default is "post-launch."

---

## Discipline for executing this sequence

A few real principles for actually doing this work without burning out:

**One thing at a time.** Don't have multiple major items in flight simultaneously. Layer 1 → Watchlist → DRB → Voice Layer → etc. Item N+1 starts when item N is done.

**Items 1 and 2 run in parallel.** Layer 1 is your work, Watchlist is the other chat's work. They don't compete for your attention much. After item 2, items are sequential.

**No reopening the sequence mid-execution.** If you finish item 3 and find yourself wondering "should I do item 5 before item 4," the answer is no. The sequence is the contract. Execute. If new context genuinely changes the picture (launch deadline shift, infrastructure surprise), then revisit. Not otherwise.

**Smaller wins between bigger pieces.** Items vary in size:
- Item 1 (Layer 1) — already most of the way done
- Item 2 (Watchlist) — handled in parallel, your involvement is light
- Item 3 (DRB) — medium, well-scoped, satisfying small win
- Item 4 (Voice Layer MVP) — the big one, 4-8 weeks
- Item 5 (Dossier Sprint 2) — medium
- Item 6 (Defaults + Loadout) — medium-large
- Item 7 (Onboarding) — medium
- Item 8 (Forge refinement) — ongoing iterative

The sequence naturally alternates between heavy and lighter items. Use that. After item 4 (the big one), item 5 feels like a return to familiar work. After item 6 (design-heavy), item 7 is a more contained build.

**Recognize planning paralysis when it returns.** The instinct to replan is the burnout pattern returning. When you feel it, come back to this document. Execute the current item.

**Use vision docs as anchors for parallel chats.** When you deploy a Claude Chat to work on an item, give them the relevant vision document (Helmet for watchlist, Forge Rules vision for forge work, etc.) plus the relevant recon. They'll produce more focused output than starting cold.

---

## Final framing

The work ahead is substantial but tractable. Eight items, with the first two mostly done and the last one post-launch. That leaves five major pre-launch items.

The hardest one is item 4 (Voice Layer MVP). The most foundational one is item 3 (DRB fix). The most architecturally clean one is item 6 (Loadouts). The most user-facing critical one is item 7 (Onboarding).

You don't have to plan further than this. You don't have to optimize further than this. You just have to execute the current item, finish it cleanly, and move to the next.

That's the discipline. The plan exists. Trust it.
