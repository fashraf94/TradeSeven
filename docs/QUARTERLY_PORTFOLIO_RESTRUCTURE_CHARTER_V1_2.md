# The Mandate — Restructure Decision Charter V1.2

**Date:** August 7, 2026
**Status:** Charter — binding decision record. Not an implementation spec.
**Supersedes:** `QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_1.md`
**Consumed by:** Specs 1–4. Every spec cites this charter; any spec contradicting a charter decision must call out the contradiction explicitly and get founder sign-off.
**Commit location:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`

---

## Changelog V1.1 → V1.2

| Change | Summary |
|---|---|
| **O-1 RESOLVED** | The feature is **The Mandate**. Terminology fixed: a manager is *granted a mandate* (the term and the entity) and *runs a book* under it (the portfolio). New D-42. |
| **Starting capital ruled** | $10,000,000 virtual USD — deliberately near-fictional for entertainment and attachment value, with a mandatory friction-honesty caveat. New D-43. |
| **Vintage boundary ratified** | Model identity and gate configuration are absorbed into the pinned vintage; staged per-user rollout accepted; break-glass override documented. New D-44 (amends D-9). |
| **Relationship memory committed** | Strategic commitment: the archetype never diverges, the *relationship* does. Memory is an input, never an identity mutation. New D-45, D-46; Spec 1 lands foreclosure-prevention hooks only. |
| **Spec 1 locked** | Three review rounds complete; V1.4 is the lock candidate. §10 updated with actuals. |
| **Prerequisite A downgraded** | Founder allocated 2 of 3 free cron slots; dispatcher consolidation is now optional post-launch cleanup, not a blocker. Amends §10. |
| **O-8 resolved** | First Experience internal label: **Opening Bell**. |

---

## 1. Purpose and Flagship Framing

**The Mandate** is the flagship feature of FantasyTrades and the final connecting piece of the engagement puzzle. It converts the disposable onboarding archetype label into the platform's retention spine, gives every user a living, personal surface they are dropped into without doing a thing, and productizes the archetype-rotation thesis as a quarterly behavior.

**One-line description:** Every user is assigned an archetype at onboarding. That archetype's agent is granted a three-month mandate to run the user's book. The user lives with it, talks to it, argues with it, and — at rollover — decides who holds the mandate next.

**V1 scope statement (binding):** The Mandate is a **user/agent experience**. V1 builds no PVP, no social sharing, no comparative surfaces. The goal is singular: create and deepen the user/agent connection through conversation — watching a book together, discussing strategies and ideas. The mandate is private and personal; **the games are where the platform is communal** (tournaments Mondays, drafts Friday–Sunday). Your book is yours; the arena belongs to the crowd.

**Strategic roles:** retention spine · horizon-bias fix (slow archetypes get an arena at their natural clock) · attribution engine (archetype × regime cohorts) · rotation thesis productized · internal sim-to-real bridge.

**Season mode boundary (standing guard):** relationship infrastructure, not a scored competition. Leaderboards, brackets, or elimination stakes would rebuild the scrapped season mode (C-19). It stays a book.

---

## 2. Portfolio Core

| # | Decision |
|---|---|
| D-1 | Onboarding questionnaire assigns the archetype; assignment auto-creates the mandate. |
| D-2 | **Full 3-month archetype lock.** No change mid-term. Commitment is the attachment mechanism; rollover is the visible release valve. |
| D-3 | **One escape hatch:** a single re-assignment, within the first two weeks, once ever per user. Cohort-flagged. Return policy, not exit door. **Never blockable by plumbing** (Spec 1 §5.4 disposes of in-flight work rather than refusing). |
| D-4 | **No Forge, no rule editing, no lean editing in the mandate.** Conversation (Vision, pivot signals, SignalDrop, debate) is the only influence surface — bounded, clamped, identity-preserving. Rationale: you don't edit your fund manager's config, you argue with them; and a locked substrate keeps every user a clean data point for attribution. |
| D-5 | Forge customization remains strictly the games' domain. |
| D-6 | **Rollover ritual:** the user selects who holds the next mandate. Build deferred (§11), required by day 90. |
| D-37 | **Rolling per-user quarters.** Each mandate runs on its own clock; rollover is a private ritual, not a platform event. The games carry the communal rhythm. |
| D-38 | **V1 is user/agent only.** No PVP, no sharing. Guardrail: build nothing social, but do **not foreclose** it in the data model. |
| **D-42** | **The feature is "The Mandate."** Terminology is binding and non-interchangeable: the **mandate** is the relationship and its term (entity: `mandates/{mandateId}`); the **book** is the money (the portfolio it governs). Product copy across Specs 2–4 uses this vocabulary — "your mandate," "mandate renewal," "the manager's mandate ends in three weeks." |
| **D-43** | **Starting capital: $10,000,000 virtual USD.** Deliberately near-fictional. Rationale: the mandate is entertainment as well as instruction, and scale drives attachment — "my manager made $340K this quarter" is a story users retell; "$3,400" isn't. Mechanically scale-invariant (all metrics are ratios). **Binding caveat:** at this scale, fixed-bps frictions no longer approximate real execution cost, so frictions are **idealized** — labeled as such on every receipt and never described as realistic. D-15's honesty promise is satisfied by accurate labeling, not by overstating the model. |

---

## 3. Identity Architecture

| # | Decision |
|---|---|
| D-7 | **Separate agent identities:** the mandate's manager and the user's arena agents are different agents. A mandate lock must not restrict arena exploration — games are the risk-free space to research the rollover decision. |
| D-8 | **Shared archetype substrate:** one class definition across both surfaces, so game evidence transfers. |
| D-9 | **Archetype vintages:** substrate updates apply per-user at rollover, never mid-term. Multiple vintages run live simultaneously — a naturally staged rollout. *(Scope extended by D-44.)* |
| **D-44** | **Vintage boundary ratified (amends D-9).** The pin absorbs **model identity** (provider, model id, generation params) and **gate configuration** (cash floor, position bounds, max weight, decision-tool verb set) alongside archetype content. A mid-quarter model swap cannot reach an active mandate; changes propagate per-user at rollover. **Accepted cost:** a bake-off winner reaches full adoption over ~3 months. **Break-glass:** an emergency override exists for provider outages and model-safety events; using it is a logged platform event stamped on every affected receipt. **Outside the pin, under declared change control with per-receipt version stamps:** prompt-template logic, friction model, snapshot/calendar machinery. Rationale: D-9 promised behavior *wouldn't* drift; provenance alone only proves that it did. A user who commits three months to a manager gets the same manager for three months. |

---

## 4. Influence Boundary (Hard Lines)

| # | Decision |
|---|---|
| D-10 | All user influence routes through the bounded advisory channel: Vision injection plus pivot signals (clamped, TTL decay, identity persists). |
| D-11 | Drops and shared content **inform; they never compel.** No dropped signal may directly cause a trade outside the advisory channel — otherwise SignalDrop is a remote control and the archetype is theater. |
| D-12 | **The agent's refusal to act is product behavior, not failure.** "I read it; here's my take; I'm not acting — here's why." |
| D-13 | The archetype identity-pushback fix is a **load-bearing flagship dependency**, landing before or inside Spec 3. SignalDrop is the highest-volume vector of against-style pressure the platform will have. |
| D-14 | `suspectedInjection` hard-gates the SignalDrop reaction path and any external-content retrieval path. Untrusted input rules apply wherever content enters. |
| **D-45** | **Prompt-assembly inputs are a closed, test-enforced allowlist.** A census is not a gate. Adding an influence path is a deliberate review event, not a quiet import. Every decision receipt carries an `influenceStateRef` — **provably null in V1** — so the substrate can prove today that non-market influence is "none, by construction," and so Spec 3's advisory state has a binding point that already exists. |

---

## 5. Relationship Memory (New — Strategic Commitment)

| # | Decision |
|---|---|
| **D-46** | **The archetype never diverges; the relationship does.** Governing invariant: *identical class + identical inputs ⇒ identical behavior; divergence happens only through inputs.* Memory is an **input**, like market data — never an identity mutation. Twenty users on the same archetype run identical philosophies with different shared histories: different drops, debates, theses, and calls on the record. A fundamentalist still refuses the no-fundamentals meme stock — but refuses it *personally*: "I know you've been watching this one. I still can't own it. Here's the closest thing that passes my screen." Same guardrail, unique relationship. This is compatible with D-9/D-44 by construction: the vintage pins who the manager **is**; memory accumulates what the manager **knows**. |
| **D-46.1** | **Two-layer storage.** (a) **Partner profile** at `users/{uid}` — facts about the *user* (goals, temperament, sectors, standing convictions, communication preferences), shared across archetypes, because a newly hired manager should know the client even though it inherits none of the previous manager's opinions. (b) **Working history** keyed per **user × archetype** — distilled debates, co-built theses, the manager's call ledger, its reflections. This is what makes twenty speculators different from one another, and it unlocks the re-hire moment: leave an archetype, come back a year later, and the manager resumes the relationship. |
| **D-46.2** | **Three disciplines, binding on Spec 3.** *Distillation, not transcripts* — raw conversation never enters a prompt; a consolidation pass produces structured memory objects inside a fixed token budget. *Provenance on every memory* — the Rule Honesty Gate extends here: the manager may never claim "you told me X" without a traceable entry. *Receipts* — every decision records the memory state it executed under (D-45's `influenceStateRef`), so influence stays auditable and the I-4 counterfactual gets its dataset. |
| **D-46.3** | **Spec 1 lands hooks only, not the system.** (1) `managerAgentId` is **stable per user × archetype** — the manager is someone you can re-hire. (2) `influenceStateRef` on every receipt, null in V1. (3) Keying reservation per D-46.1. The memory system itself — consolidation, memory objects, conviction tracking, the returning-manager moment — is Spec 3, where it becomes the heart of the spec rather than an add-on. |

**Strategic note.** Opening Bell (§8, D-41) creates attachment in 72 hours; relationship memory is what makes attachment compound for years. It is the platform's answer to "what do I lose if I leave?" — and the answer is a manager who knows you, which no competitor can export.

---

## 6. Scoring and Honesty

| # | Decision |
|---|---|
| D-15 | The book is scored on **honest risk-adjusted P&L with frictions**; arena points remain entertainment scoring. Arena points are sport; mandate performance is truth. *(Per D-43, frictions at $10M scale are idealized and must be labeled as such — honesty by accurate labeling.)* |
| D-16 | Shadow trading-quality scoring runs on battles (dual-label: game score + risk-adjusted P&L). |
| D-17 | The agent narrates underperformance **honestly** — drawdown protected, what history says about this regime for this posture — with the Rule Honesty Gate applied to self-narrative. Substrate obligation: the record must distinguish *"the manager chose to hold"* from *"the manager was not permitted to act"* (Spec 1's per-session agency state). An agent honest about losing builds more trust than one that's winning. |
| D-18 | **Lesson promotion gate:** nothing reaches "proven" without replication across at least two scoring contexts. Single-context lessons are labeled mode-specific. |
| FR-1 | **Capital carries forward at rollover — same archetype or different.** The book belongs to the user; managers are hired and fired. Switching must never cost capital, because charging for rotation penalizes the exact behavior the rotation thesis exists to encourage. *(Transaction-asserted in Spec 1, not merely documented.)* |
| FR-2 | **Scoring is tenure-scoped, not lifetime-blended.** Each mandate's summary records what that archetype did during its own term. The user's history reads as a manager ledger — the artifact that makes the rollover choice informed. |
| FR-3 | **The escape hatch voids the term.** Not a manager change — a correction of a bad assignment. The old mandate closes flagged and non-scoring; the replacement starts fresh at full starting capital. |
| FR-5 | **Comparability rule (forward-looking):** when social surfaces exist, the comparable unit is tenure performance, never absolute balance. |
| **C-21** | **Action-Precedence Contract (constitutional).** Deterministic risk lines preempt advisory rules **always**. Nothing advisory, and no data-quality or ops-hygiene mechanism, may suppress an exit. Corollary ratified in Spec 1: fail-closed governs *entries* and *acting on bad data*; it never suppresses exits on fresh data, and no exit-suppressing state may be indefinite. |

---

## 7. Cadence, Cost, and Models

| # | Decision |
|---|---|
| D-19 | **Cadence-tiered evaluation by archetype** — cadence is an archetype property. Cost control and archetype coherence point the same way. |
| D-20 | Batch API + prompt caching on the stable scaffold; mandate decisions are not latency-sensitive. |
| D-21 | **Dormancy downshift:** the book always trades; reflection and narration depth reduce for inactive users. Trading integrity preserved; cost follows attention. |
| D-22 | **Run-rate budget:** < $1.00 per active user per month all-in; re-measured with real token counts in week one. |
| D-23 | Model-agnostic seam from day one — sole-importer wrapper, provider and model as config. |
| D-24 | The **battle** Trading Brain stays on Haiku pre-launch; a swap there is a full recalibration event under the fence. |
| D-25 | **DeepSeek V4-Flash enters on evidence, not excitement:** offline paired harness for decision surfaces; Voice Layer candidacy per D-40. *(Interaction with D-44: any winner propagates to mandates per-user at rollover, not platform-wide overnight.)* |
| D-40 | **Voice Layer model decision is Prerequisite C** — settled by harness before Spec 3 begins, because Spec 3's prompt suites are model-tuned assets. Six harness dimensions: debate endurance, disposition compliance, verification-narration accuracy, injection resistance, per-archetype tone consistency, cost per conversation. Gemma runs as incumbent and remains the fallback tier. **Serving:** US-hosted providers via OpenRouter, never the vendor's first-party API. |

---

## 8. SignalDrop, Command Center, Proactive, Arena

| # | Decision |
|---|---|
| D-26 | SignalDrop-to-manager is a **third fork** of the existing pipeline, not a migration. Parse, ticker validation, injection guard, content-hash cache, shadow logging reused as-is. |
| D-27 | Every reaction terminates in a **disposition grounded in the book**: relevant-to-holdings / watching / no-action / proposed-tilt (routed through the advisory channel). Personality without a position is a chatbot trick. |
| D-28 | **Verification pass:** extracted claims are cross-checked against internal data before the agent asserts them. The agent distinguishes "this claims X" from "X is true." |
| D-29 | **One flow, not two features:** drop → reaction + disposition → user pushback → debate escalates. |
| D-30 | Every reaction is timestamped; disposition outcomes extend drop history into the agent's **call ledger**. |
| D-31 | **Proactive messaging V1 runs on internal triggers only:** Wire × holdings join, portfolio events, DRB regime shifts against posture, upcoming earnings. Proactivity is a trigger problem, not a search problem. |
| D-32 | **Ruthless rate limit** (~2/week baseline). A trader friend, not a notification. |
| D-33 | Enrichment is **vendor-agnostic and platform-routed** through the newsroom — one research pass per story, consumed by all mandates holding the ticker. Bespoke per-agent research is trigger-gated and budget-capped. |
| D-34 | Enrichment vendor decided by harness post-launch: Sonar (incumbent) vs Exa. |
| D-35 | BaggerBomb moves to an **Arena**: 1v1, anytime start, agent + user portfolio combination. |
| D-36 | The House Battle System guarantees an opponent. |
| D-39 | Command Center identity unchanged; **loadout selection relocates to the league section** (Spec 4). |
| D-41 | **Opening Bell** (O-8 resolved) — the First Experience is a named Spec 3 deliverable: the manager introduces itself, states what book it intends to run and why, narrates its first buys, and establishes the relationship. Founder design bar: **magical.** |

---

## 9. Instrumentation (Launch-Blocking)

Data not captured at launch cannot be recovered.

| # | Commitment |
|---|---|
| I-1 | **Coverage audit:** map every mode as horizon × scoring emphasis × universe; verify each archetype has an arena where its edge can express; pre-register expectations where it doesn't. |
| I-2 | Shadow trading-quality scoring live day one. |
| I-3 | Cross-mode replication gate on lesson promotion live day one. |
| I-4 | **User-contribution counterfactual:** with-Vision vs without; veto outcomes vs the vetoed trade; pivot outcomes vs staying put. The datum that validates or falsifies the platform's core claim. |
| I-5 | **Complement-assignment experiment:** onboarding deliberately assigns complements; the first rollover measures whether users keep or flee. |
| I-6 | Per-user run-rate telemetry against D-22. |
| I-7 | **Regime-window cohorting:** rolling quarters mean no shared boundary, so cohorts are built by regime window at query time. Rows carry regime and vintage stamps at write time. |

---

## 10. Build Sequence

**Prerequisite A — cron dispatcher consolidation: DOWNGRADED.** Founder allocated 2 of 3 free slots (37→39) to mandate eval and rollover; §6's two-slot tournament reserve knowingly spent. Consolidation is optional post-launch cleanup; a future slot need triggers a full audit.
**Prerequisite B — archetype identity-pushback fix (D-13):** before or inside Spec 3.
**Prerequisite C — Voice Layer model decision (D-40):** harness during the Spec 1/2 window; locked before Spec 3.

| Spec | Scope | Status |
|---|---|---|
| **Spec 1 — Mandate Substrate** | Schema, lifecycle, eval loop, execution contract, scoring, instrumentation. Headless, flag-dark. | **LOCKED V1.4.** Three review rounds complete: ChatGPT defect pass (38 findings), micro-verification (6 repo contracts), Fable invariant review (17 findings). Zero fenced edits. 6 phases, 3–4 weeks. |
| **Spec 2 — Onboarding** | Questionnaire → assignment → mandate creation; escape hatch; complement experiment. | Next. ~1 week. |
| **Spec 3 — Command Center** | Hotline; Opening Bell (D-41); debate; SignalDrop react fork; proactive V1; enrichment seam; **relationship memory system (D-46)**. | Requires Prereqs B, C. Scope grew with D-46 — re-estimate at spec time. |
| **Spec 4 — Arena** | BaggerBomb → Arena 1v1; house opponent; loadout relocation. | 1–2 weeks. |

**Standing conventions:** flags default false, merge dark; flag flips are separate one-line PRs; one task = one branch; CC never drives merges; hard STOP after discovery; live repo authoritative over docs.

**Model allocation for build:** Opus in Claude Code for implementation phases (settled specs, live repo access, reliability). Fable reserved for design-stage invariant reasoning, adversarial review rounds, and any BUILD_RULES §7 fence escalation. A stronger reasoning model given a locked spec is more likely to improve on it mid-build — which is precisely what an executor should not do.

---

## 11. Deferred Ledger (Required by Day 90)

| # | Item |
|---|---|
| DEF-1 | Rollover ritual UI (D-6) |
| DEF-2 | Archetype × regime attribution displays (feeds D-17 narration and the rollover choice) |
| DEF-3 | Vintage release workflow (storage primitive exists in Spec 1 §5.1) |
| DEF-4 | DeepSeek offline paired harness for decision surfaces |
| DEF-6 | Enrichment vendor harness: Sonar vs Exa |
| DEF-7 | Research-goal standing monitors seeded from Vision |
| DEF-8 | Call-ledger surfacing UI (data captured day one) |

---

## 12. Open Questions

| # | Question | Status |
|---|---|---|
| O-1 | Flagship name | **RESOLVED V1.2** → The Mandate (D-42) |
| O-2 | Calendar vs rolling quarters | RESOLVED V1.1 → rolling (D-37) |
| O-3 | Starting capital | **RESOLVED V1.2** → $10M with friction-honesty caveat (D-43) |
| O-4 | Universe scope | Spec 1 → equities-only V1 |
| O-5 | Position bounds and sector caps | Spec 1 → own fail-closed enforcer; 5–15 target; entry gates only, never exit blockers |
| O-6 | Escape-hatch UX framing (mismatch correction, not a free switch) | Spec 2 |
| O-7 | Proactive delivery surface and quiet hours | Spec 3 |
| O-8 | First Experience label | **RESOLVED V1.2** → Opening Bell (D-41) |

---

## 13. Charter Change Control

V1.2 is binding. Amendments follow the standing pattern: versioned successor documents with explicit changelogs; no silent edits. Any spec, review, or build discussion surfacing a conflict stops and escalates to founder review — the charter changes deliberately or the spec conforms.

*End of charter.*
