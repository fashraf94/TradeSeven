# Dossier System — Multi-Sprint Roadmap

**Purpose:** Master reference for the agent-context Dossier buildout. Capture the architectural principles, sprint sequence, locked decisions, and dependencies so that Flash and Claude Code can resume work in any session without losing context.

**Status:** Sprint 1 specced and locked. Sprints 2–6 scoped at intent level, full design deferred until predecessor sprint ships and observation period completes.

**Date initialized:** May 2026
**Last updated:** May 2026 (post-Phase 0 architecture lock)

---

## 1. Origin Story (Why This Exists)

The agent's context architecture had been built outward across multiple fronts (Forge expansion, Signal Drop, Index Intelligence, FantasyTimes) while two foundational systems — Vision-as-living-thing and the cross-battle Dossier — sat in a half-finished "scaffolded but not connected" state.

A full architecture audit (`/AGENT_CONTEXT_ARCHITECTURE_AUDIT_REPORT.md`) revealed the diagnosis:

- **The Dossier is already half-built.** `agents/{id}` already has the right field shape (`memory`, `lessons`, `convictions`, `partnerProfile`, `consolidatedInsight`, `evolutionCycle`, `pendingConsolidation`). Read-side wiring is in place — Voice Layer Block 3 reads `consolidatedInsight`, three other prompts read related fields. Write-side is missing — `consolidatedInsight` and `evolutionCycle` are read by three prompts but written by nobody. `pendingConsolidation` is set every 5 games and consumed by nobody. The orphaned `updateConsolidatedInsight()` function in `agentService.js:227` has zero callers.

- **Vision is a museum piece.** 5 of 6 lifecycle states are unreachable in production. Vision is born `unformed` and dies `retired-from-unformed` every time. Constraints array is fully empty in production. Haiku reads it but it's empty when read.

- **The Voice Layer is ~65% shipped.** Identity, partner model, convictions, market briefs, phase rules, output format are in place. The DKB cluster (3.5 partial, 3.6/3.7/3.8 missing entirely) is the biggest gap. External Intelligence Pipeline is spec-only.

The Dossier buildout is the foundation that completes the half-built cross-battle layer. Other foundational gaps (Vision lifecycle, DKB, External Intelligence) are real and important but parallel work, not blockers for this arc.

---

## 2. Architectural Principles (Locked)

These principles constrain every sprint. Do not violate without explicit reconsideration.

### 2.1 The Funnel Principle

**All inputs from features write to queue fields. The consolidation Sonnet is the only writer of dossier fields. Features add to queues. Consolidation curates queues into dossier. Dossier is never written by anything except consolidation.**

This means:
- Features (Forge backtests, debate sessions, user notes, external articles, lessons) write to `agent.dossierInputs.pending<Type>[]` queues
- Consolidation Sonnet reads queues, decides what graduates to dossier
- `agent.disciplines`, `agent.consolidatedInsight`, `agent.partnerProfile`, `agent.convictions` are never directly written by feature code
- Pending entries that don't graduate stay queued or decay over cycles

**Why it matters:** Prevents fragmented interpretation across multiple writers. Centralizes the discipline-vs-pattern judgment in one place. Enables clean provenance and audit trails. Eliminates field-drift risk. Protects against lessons-as-rigidity (the funnel filters pattern-shaped inputs before they can damage the dossier).

### 2.2 Two-Category Disciplines

**Disciplines are split into Selection (what to trade) and Execution (when/how to trade).**

- Selection disciplines evolve slowly across many cycles. They reflect the agent's accumulated worldview about what kinds of opportunities it understands and trusts.
- Execution disciplines evolve faster. They reflect ongoing self-correction about behavior under pressure.

Both are durable principles, not regime-bound patterns. The discipline-vs-pattern distinction operates within both categories.

### 2.3 Disciplines as Objects

**Each discipline is an object with id, statement, formedInCycle, reinforcedInCycles[], confidence, source.** Not free text inside a paragraph. This enables:
- Per-discipline confidence and provenance tracking
- Future Discipline Audit feature (user can review which disciplines are still earning their keep)
- Sprint 6 debate targeting a specific discipline
- Reinforcement tracking across cycles

### 2.4 Compatibility String

**The structured `disciplines` arrays are the source of truth. `consolidatedInsight` is a Sonnet-derived natural-language summary regenerated on every consolidation cycle for backward compatibility with existing prompt readers.**

Three prompts currently read `consolidatedInsight` as a string. Rewriting them all in Sprint 1 would couple multiple sprints together. Instead, Sonnet produces both representations in the same call, ensuring consistency. Voice Layer rework to read structured arrays directly is deferred to a later sprint.

### 2.5 Discipline-Shaped Insights Only

**Sonnet's consolidation prompt is engineered to extract discipline-shaped insights only and refuse pattern-shaped extractions.** Pattern-shaped lessons stay in the rolling memory window where they decay naturally. Discipline-shaped lessons graduate to the disciplines arrays.

This is the structural protection against the user's primary fear — lessons as restrictions that hinder adaptability. The funnel + the discipline-only filter together ensure the dossier accumulates wisdom rather than rigidity.

### 2.6 Vision↔Dossier Boundary (Locked Direction)

**Dossier seeds Vision at battle creation. Retired Vision feeds back into Dossier via Sonnet. In-flight Vision is sealed from Dossier mutation.**

This is the unidirectional contract that keeps battle-scoped and agent-scoped lifetimes properly isolated. Implementation lands in Sprint 5.

### 2.7 First-Person Voice

**The dossier is written in the agent's own first-person voice as a serious trader keeping an honest journal.** Not third-person analysis. Not second-person coaching. The user reads the dossier and encounters their agent's own developing voice — this deepens the "this is my agent" relationship.

### 2.8 Inline-with-Reflection Trigger

**Consolidation runs inline inside the post-battle reflection cron, gated on `gamesPlayed % 5 === 0`. Silent execution; ceremonial UI surfacing via Evolution Timeline.**

No new cron. No client-triggered consolidation. Co-located with the existing Sonnet reflection call.

---

## 3. Sprint Sequence

Each sprint ships independently and makes the product visibly better. None depends on a future sprint to be useful. **You can stop after any sprint and have a better product than today.**

Sprint cadence: ~1 sprint = 1 focused build session + audit + ship cycle. Estimates assume normal pace; longer if blocked or if observation period extends.

| Sprint | Title | Status | Estimate |
|--------|-------|--------|----------|
| 1 | Consolidation Writer | Specced & locked | Ready to build |
| 2 | Conviction & Partner Writers | Scoped, design deferred | After Sprint 1 ships + 1-2 weeks observation |
| 3 | Scout/Scan Pipeline | Scoped, design deferred | After Sprint 2 ships |
| 4 | Lesson Promotion Paths | Scoped, design deferred | After Sprint 3 ships |
| 5 | Vision↔Dossier Boundary | Scoped, design deferred | After Sprint 4 ships |
| 6 | Debate as a Writer | Scoped, design deferred | After Sprint 5 ships |

### Sprint 1 — Consolidation Writer ⚙️

**The foundation sprint. Builds the missing function that turns the half-wired Dossier into a living system.**

**Goal:** Build the consolidation Sonnet writer. Trigger inline with reflection every 5 games. Read `memory[]` + `lessons[]` + existing disciplines + previous consolidatedInsight. Produce updated structured disciplines arrays + regenerated consolidatedInsight + evolution event + lesson absorption decisions.

**Outcome users see:**
- Three currently-stale Voice Layer prompt blocks become live (Block 3 reads real consolidated insight)
- Evolution Timeline gets a real new entry every 5 games describing what shifted
- Agent dashboard shows "Cycle N complete" badge after consolidation
- Agents start feeling smarter across battles — the cross-battle wisdom layer is finally working

**Files touched:**
- `api/agent/reflect.js` — wire consolidation call after reflection write
- `api/_utils/agentConsolidationPrompt.js` — NEW, Sonnet prompt assembly
- `api/_utils/agentConsolidationToolSchema.js` — NEW, `submit_consolidation` tool
- `src/services/agentService.js` — schema additions for `disciplines` field
- `api/_utils/shadowLogger.js` — extend for consolidation logging
- `src/components/Agent/AgentEvolutionTab.jsx` — surface evolution events

**Won't touch:**
- `voiceLayerPrompt.js` — backward compatibility via consolidatedInsight string preserves existing behavior
- Vision schema or Vision lifecycle code
- Forge bundle/rule deploy paths
- `partnerProfile` or `convictions[]` writers (Sprint 2)
- Any new UI surfaces beyond the existing Evolution Timeline

**Success criteria:**
- Consolidation runs successfully on a real agent's 5th, 10th, 15th... battle
- Sonnet output passes tool validation on first attempt >95% of the time
- `consolidatedInsight` text reads as the agent's first-person voice and sounds like a real trader
- Disciplines extracted are discipline-shaped (transferable), not pattern-shaped (regime-bound)
- Shadow logs capture every call with full input/output for future analysis
- Existing Voice Layer behavior unchanged — no regressions

**Dependencies:** None. All inputs already exist in production.

**Risks:**
- Sonnet may produce pattern-shaped outputs despite the prompt's anti-pattern guidance → mitigated by review of first 10 production runs, prompt iteration
- Disciplines may fragment into near-duplicates over many cycles → mitigated by reinforcement-prefer guidance in prompt; will require observation
- Tone may drift toward research-analyst voice → mitigated by tonal anchors in prompt; observable in shadow logs

**Defer until after ship:**
- Discipline Audit UI (lets user review which disciplines are still earning alpha)
- Full Voice Layer rework to read structured disciplines directly (kept as compatibility string for now)

---

### Sprint 2 — Conviction & Partner Writers 🤝

**Makes the agent feel like it knows its user.**

**Goal:** Build production writers for `agent.partnerProfile` (15 dimensions) and `agent.convictions[]`. Voice Layer Blocks 2 and 3 currently read these fields and operate on empty data. After this sprint, the agent demonstrably knows who its user is and what beliefs the user holds.

**Hard dependency:** Sprint 2 depends on veto event capture + battle-pattern aggregator landing first per `docs/audits/VOICE_LAYER_TOOL_READINESS_AUDIT_PART3.md` Section 8.4. Estimated half-sprint of cross-cutting work before Sprint 2 implementation can begin.

**Likely architecture:** Gemma extends its chat output JSON with `_partnerProfileUpdate` and `_convictionUpdate` fields. `chat.js` applies them to `agents/{id}` using the same writer pattern as `_lesson` and `_forgeSuggestion`. Per the funnel principle, these updates land in pending queues that consolidation Sonnet curates — they don't directly mutate the dossier fields.

**Pre-design questions to settle:**
- Per-dimension confidence vs single profile-level confidence?
- Are convictions ticker-specific, sector-specific, or thesis-specific?
- How does Gemma decide a dimension is worth updating vs leaving stable?
- Do user explicit corrections (e.g., "actually I'm more aggressive than that") get special weight?

**Don't design until:** Sprint 1 has shipped and ~2 weeks of consolidation behavior observed. Sonnet's actual consolidation patterns will inform what shape these writers should take.

**Success criteria (preview):**
- Voice Layer Block 2 demonstrably references real partner profile dimensions in conversation
- Voice Layer Block 3 cites real convictions in trade discussions
- Agent says things like "I know you tend to lean defensive in choppy tape, so..." and the user recognizes it as accurate
- Funnel principle preserved — no direct writes to dossier fields, all flows through consolidation

---

### Sprint 3 — Scout/Scan Pipeline 🔍

**Makes the agent feel proactive. The "magic moment" sprint.**

**Goal:** Build the server-side scanning that surfaces specific tradeable opportunities into Voice Layer's context. Powers the agent's ability to make proposals like "AAPL has broken its 50DMA — here are three candidates at their 200DMA, want me to walk you through how they differ fundamentally vs momentum-wise?"

**The audit found:** `voiceLayerCache.scoutAlerts[]` exists but does not do active swap-candidate generation. This is the missing piece that makes Voice Layer's existing proposal infrastructure (suggestedActions, OUTPUT_FORMAT) actually impressive in production.

**Architecture intent:**
- New scan logic in `voiceLayerCache` cron computes:
  - Swap candidates for current portfolio positions (when current position is broken or weakening)
  - Regime-shift alerts (when current portfolio is poorly positioned for an emerging regime)
  - "Interesting things happening right now" beyond the user's portfolio
- Scan output respects the agent's selection disciplines (filters candidates that violate them)
- Voice Layer prompt is extended to format scout proposals as user-facing chat with suggestedActions

**Pre-design questions:**
- How many candidates per swap proposal? (3 feels right but worth testing)
- How does the scanner respect selection disciplines without becoming brittle?
- What's the autopilot-vs-confirmation behavior for proposed swaps?
- How does this interact with existing Risk Manager LOCK/SWAP_OUT logic?

**Don't design until:** Sprint 2 ships. Partner profile + convictions inform what kinds of proposals to surface — without them, the scanner is blind to user preferences.

**This is where the dossier earns its keep.** Sprints 1–2 build the agent's mind. Sprint 3 lets the agent *use* that mind to actively help the user. After Sprint 3 ships, the user-agent interaction crosses the threshold from "configured tool" to "thinking partner."

---

### Sprint 4 — Lesson Promotion Paths 📈

**Decides and enforces the rules for how lessons graduate.**

**Goal:** Specify and build the explicit promotion paths between lesson types and dossier fields. Today only the lesson→Forge path is gated and explicit. The other paths need rules.

**Promotion paths to design:**
- Lesson → Selection discipline (handled by consolidation Sonnet, locked in Sprint 1 — verify behavior in production)
- Lesson → Execution discipline (same — verify in production)
- Lesson → Conviction update (designed in Sprint 2 — formalize the rule here)
- Lesson → Partner profile dimension update (Sprint 2 — formalize)
- Lesson → Forge suggestion (already shipped, explicit user gating — verify rules still hold)
- Backtest finding → Selection discipline (designed when backtest pipeline lands)
- Debate resolution → Conviction update (Sprint 6 territory — preview here)
- User note → Pending input (notes hub, future)

**Outcome users see:**
- Discipline Audit UI ships (review which disciplines are still earning their keep)
- "Why is this in my dossier?" trace works for any item — provenance is visible
- Pattern-shaped lessons that don't graduate are visible to user with explanation
- Promotion rules are stable enough to document in user-facing help

**Don't design until:** Sprint 3 ships. Real consolidation behavior + real partner/conviction behavior + real proposing behavior will all inform what the promotion rules should be.

---

### Sprint 5 — Vision↔Dossier Boundary 🔄

**Connects the cross-battle Dossier with the per-battle Vision.**

**Goal:** Wire the unidirectional contract between Vision (battle-scoped) and Dossier (agent-scoped).

**Wire-up direction:**
- **Battle creation:** Dossier reads (consolidatedInsight, dominant disciplines, partner profile) seed the new Vision's `evidenceTrail` and `thesis` defaults. The agent enters battle pre-armed with what it has learned.
- **Battle end:** Sonnet retirement of Vision extracts durable insights and writes them to `agent.dossierInputs.pendingBattleInsights[]`. Next consolidation picks them up.
- **Mid-battle:** Vision and Dossier are sealed from each other. Vision mutations don't touch Dossier. Dossier reads don't mutate Vision.

**Outcome users see:**
- Battles feel continuous rather than reset-each-time
- Agent enters every battle saying things like "Last cycle I learned X — I'll be watching for setups that test that"
- Post-battle reflection visibly ties what happened in the battle to what's in the dossier
- The 5-of-6 unreachable Vision lifecycle states start mattering, because Dossier-seeded Visions actually have content worth proposing/debating/staling

**Pre-design questions:**
- Which dossier fields feed Vision creation? All of them, or a curated subset?
- How does Sonnet's Vision retirement decide what's worth promoting back to dossier inputs?
- What's the failure mode if Dossier is empty (early-game agents)?

**Don't design until:** Sprint 4 ships AND the Voice Layer rewrite for Vision lifecycle (Spec C, currently 65% shipped per audit) is closer to complete. The Vision lifecycle gap is real — designing the boundary against a museum-piece Vision wastes work.

---

### Sprint 6 — Debate as a Writer 💬

**Gives users a high-agency way to shape their agent.**

**Goal:** Build the debate UI and Gemma debate prompts. Debate sessions extract conviction updates and partner-profile refinements that flow through the funnel into the dossier.

**Per the funnel principle:** Debate output writes to `agent.dossierInputs.pendingDebateResolutions[]`. Consolidation Sonnet decides which resolutions graduate.

**The "I built this" sprint.** Combined with the Discipline Audit (Sprint 4), debate gives the user explicit agency over what their agent believes and how it filters opportunities. The user trains the agent through articulated argument rather than configuration.

**Pre-design questions:**
- Is debate adversarial (Gemma plays devil's advocate)? Socratic (Gemma asks questions to elicit reasoning)? Collaborative (Gemma helps user refine)?
- Does debate run as a focused session (modal) or as a thread inside AgentChat?
- What's the debate "ending" — explicit commit, timeout, or user-initiated wrap?
- How are debate-derived conviction updates surfaced to the user before commit?

**Don't design until:** Sprint 5 ships. Debate's value depends on having rich disciplines + active proposals to debate against. Without those, debate is conversation-for-its-own-sake.

---

## 4. Cross-Cutting Concerns

### 4.1 Shadow Logging

Mandatory on every new writer. Every consolidation, every conviction update, every debate resolution gets logged with full input + output + execution time + token counts. This dataset is one of the most valuable training corpora the platform produces — it captures the actual judgment process for fine-tuning later.

### 4.2 The Funnel Discipline

Every sprint must be reviewed against the funnel principle before merge. If a feature is tempted to write directly to a dossier field, the design is wrong. The right question is: "what queue does this write to, and which consolidation cycle picks it up?"

### 4.3 Backward Compatibility

`consolidatedInsight` as a string field exists for backward compatibility with three current prompt readers. Do not delete or restructure this field until the Voice Layer has been reworked to read structured disciplines directly. That rework is a separate focused sprint, not bundled into any of Sprints 1–6.

### 4.4 Observation Periods Between Sprints

After each sprint ships, a 1-2 week observation period precedes design of the next sprint. Real production data informs the next sprint's design choices. **Do not skip this.** The Forge buildout pain came partly from designing multiple sprints upfront based on assumptions that didn't survive contact with production.

### 4.5 Audit Posture

The audit (`/AGENT_CONTEXT_ARCHITECTURE_AUDIT_REPORT.md`) is the canonical reference for current codebase state. Re-run a focused audit (specific files / specific subsystems) before any sprint that touches files outside the sprint's primary scope. Especially before Sprints 5 and 6, which touch Vision and the Voice Layer respectively.

### 4.6 Branch Hygiene

One task = one branch. All sprint phases continue on the same branch. Discovery → Implementation → Audit → Merge. Discovery phase verifies audit findings are still accurate before any code changes.

---

## 5. Open Questions Carried Across Sprints

These questions surfaced during architecture work but don't block Sprint 1. They will need answers as later sprints land.

1. **Per-dimension partner profile confidence vs flat?** — Sprint 2
2. **Are convictions ticker-specific, sector-specific, or thesis-specific?** — Sprint 2
3. **Scanner's discipline-respecting filter logic — how to balance respect for disciplines with avoidance of brittleness?** — Sprint 3
4. **Discipline Audit UI shape — table view? Card stack? Timeline?** — Sprint 4
5. **Vision retirement → dossier promotion criteria — what makes a battle insight "worth promoting"?** — Sprint 5
6. **Debate format — adversarial, Socratic, or collaborative?** — Sprint 6
7. **When to schedule the Voice Layer rework that retires the compatibility `consolidatedInsight` string?** — Post-Sprint 6, separate sprint
8. **External Intelligence Pipeline integration — does it slot in as another funnel input source (notes-hub-shaped)?** — Future, not in this arc

---

## 6. What This Roadmap Is Not

- **Not a Vision lifecycle completion plan.** The audit found Vision is mostly a museum piece. That's a separate workstream (Spec B/C/E completion). Sprint 5 connects Dossier to Vision but does not complete Vision's own gaps.
- **Not a DKB completion plan.** The 8 thematic JSONs are unread. That's a separate workstream.
- **Not a comprehensive agent intelligence roadmap.** It is specifically the Dossier completion arc.
- **Not a UI design document.** UI surfaces are noted where they ship in each sprint but full design lives in separate UI specs (Discipline Audit spec when Sprint 4 designs, Debate UI spec when Sprint 6 designs).

---

## 7. Decision Log

A running record of locked decisions. Every change to this list is a substantive architectural choice — re-derive context if changing.

| # | Decision | Sprint | Date | Rationale |
|---|----------|--------|------|-----------|
| 1 | Funnel architecture (single-writer dossier) | All | May 2026 | Centralizes interpretation; prevents drift; protects against rigidity |
| 2 | Two-category disciplines (selection + execution) | 1+ | May 2026 | Maps to real trader practice; enables differentiated reinforcement |
| 3 | Disciplines as objects with provenance | 1+ | May 2026 | Enables audit, reinforcement tracking, debate targeting |
| 4 | Compatibility string for backward compat | 1 | May 2026 | Decouples Sprint 1 from Voice Layer rewrite |
| 5 | Discipline-shaped extraction only (refuse patterns) | 1+ | May 2026 | Structural protection against lessons-as-rigidity |
| 6 | First-person agent voice | 1+ | May 2026 | Builds "this is my agent" identification |
| 7 | Inline-with-reflection trigger | 1 | May 2026 | No new cron; user-experience: consolidation co-located with battle end |
| 8 | Scout pipeline as Sprint 3 | 3 | May 2026 | The "magic moment" needs both rich dossier and active proposing |
| 9 | Vision↔Dossier as unidirectional | 5 | May 2026 | Prevents cross-scope mutation leaks |
| 10 | Sonnet prompt lives as JS module (Option A) | 1 | May 2026 | Consistency with existing prompt-assembly pattern |

---

## 8. How to Use This Document

**At the start of any sprint:**
1. Read Section 2 (Architectural Principles) in full
2. Read the relevant sprint section
3. Re-read Section 4 (Cross-Cutting Concerns)
4. If touching files outside the sprint's primary scope, run a focused audit first

**At the end of any sprint:**
1. Update the sprint's status in Section 3
2. Add observations to the next sprint's "Pre-design questions"
3. Add any newly locked decisions to the Decision Log
4. Resolve open questions in Section 5 if the sprint produced answers

**When confused about why we made a decision:**
1. Check the Decision Log first
2. If not there, check `/AGENT_CONTEXT_ARCHITECTURE_AUDIT_REPORT.md` for codebase ground truth
3. If still not clear, the decision wasn't actually locked — surface it as an open question

**When tempted to skip an observation period:**
Don't. The Forge buildout demonstrated what happens when multiple sprints get designed before earlier ones ship. Production data is the only reliable input to next-sprint design.
