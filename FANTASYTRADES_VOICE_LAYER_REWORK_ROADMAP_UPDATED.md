# FantasyTrades Voice Layer Rework — Roadmap (Updated)

**Status:** Living document. Reflects Phase 4 scope revision per May 24, 2026 design conversation.

**Parent documents:**
- `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1.docx`
- `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1_ADDENDUM_B.md`
- Individual phase specs: Phase 1, Phase 2, Phase 2.5, Phase 3 (locked)

---

## Completed phases

### Phase 1 — First-message on deploy ✓
**Shipped:** May 2026. Production-verified.
**Scope:** Mode-aware routing, first-message-on-deploy, typed-message schema foundation.
**Status:** Stable. Demonstrating two-sided loop in production.

### Phase 2 — Trade narration ✓
**Shipped:** May 2026. Production-verified.
**Scope:** Per-swap narration with provenance-aware framing. Risk-triggered and Haiku-decided swaps both narrate.
**Status:** Stable. Directive-expiry cross-cutting fix landed during Phase 2.

### Phase 2.5 — Term modals ✓
**Shipped:** May 2026. Production-verified.
**Scope:** Educational layer foundation — clickable definitions for ~12 single-token financial terms (VWAP, RSI, MACD, ATR, SMA, EMA, PCE, CPI, FOMC, NFP, PPI, GDP).
**Status:** Stable. Working alongside ticker modals in chat surface.

### Phase 3 — Anticipation messages ✓
**Shipped:** May 2026. Production-verified.
**Scope:** Pre-action watching surface. Haiku tags candidates via `anticipationCandidates` field; Gemma narrates each. State-transition trigger with deliberate quietness as default.
**Status:** Stable. Three follow-up items filed (PHASE_RULES inconsistency, observability gap, undefined directive behavior).

---

## Active phase

### Phase 4 — Film Room (post-battle debrief)
**Status:** Design in progress. Discovery pass on existing Film Room codebase preceding spec.
**Scope:** Structured post-battle reflection surface. Shows what happened, what was watched, what was learned. Distinct from chat — likely its own component/screen.
**Why this is the active workstream:** Post-battle reflection is a known-empty product moment. Users currently have no way to review what happened in a battle after it ends. Multiple cohorts benefit (curious-but-intimidated users learn by reviewing, advanced users want analytics, all users want closure).

**Workflow ahead:**
1. Discovery pass on existing Film Room infrastructure (what's already in the codebase, what data is available, what UX patterns exist)
2. Six-decision design conversation
3. Spec drafted, locked
4. Implementation prompt with discovery-first stop
5. Implementation
6. Custom audit
7. PR → CI → merge → deploy
8. Production qualitative verification

---

## Deferred indefinitely (with revisit triggers)

### Phase 4a — Pre-battle gameplan (originally roadmapped)
**Status:** Deferred indefinitely. See `GAMEPLAN_DEFERRED_THESIS.md`.
**Why deferred:** The originally-conceived gameplan was designed to be the user-to-agent input channel pre-battle. The user-input gap it was designed to fill has been closed by features that didn't exist when the roadmap was written: Watchlist Equip, Signal Drop article uploads, Workshop Mode, Phase 1 first-message directive elicitation, active directive system.

A potentially-valuable smaller variant exists ("agent commitment" framing — read-only pre-battle agent stance, no user input required). Filed in thesis doc for future consideration.

**Revisit trigger:** Production observation after Phase 4 (Film Room) ships shows users actively asking "what's the agent's plan?" or showing confusion about agent posture pre-battle. Without that signal, gameplan stays parked.

---

## Queued phases (post-Phase 4)

### Phase 5 — Dossiers
**Status:** Planned. Not yet designed.
**Scope:** Cross-battle pattern recognition. The agent develops a "dossier" on the user (their style, preferences, recurring directives) and on themselves (what's worked, what's failed, recurring patterns). Informs future agent behavior.
**Depends on:** Phase 4 Film Room ships and produces enough debrief data to support pattern recognition.

### Phase 6 — Polish
**Status:** Planned. Not yet scoped.
**Scope:** Post-launch refinement informed by production observation across all phases. Likely includes addressing follow-up items accumulated across Phases 1-5, visual differentiation of proactive message types if useful, and any product-instinct refinements that emerge.

---

## Future workstreams (sibling to Voice Layer rework)

These are not Voice Layer phases but are related product instincts captured during Voice Layer design conversations. They have their own thesis docs and will become real workstreams when their time comes.

### Universe Screener
**Thesis doc:** `UNIVERSE_SCREENER_INITIAL_THESIS.md`
**Connection to Voice Layer:** Screener-discovered candidates will arrive in chat via `messageType: 'anticipation'` with `anticipationSource: 'universe_screener'`. The Phase 3 schema already accommodates this.
**Trigger for becoming real:** Voice Layer rework completes or pauses, founder has clearer sense of which scanning patterns deliver value vs which are speculative.

### Multi-day morning brief
**Thesis doc:** `MULTI_DAY_MORNING_BRIEF_THESIS.md` (new, drafted alongside this update)
**Connection to Voice Layer:** A pre-market re-evaluation surface for Day 2+ of multi-day battles (Snake Draft, future formats). Distinct from gameplan (gameplan was a pre-deploy moment; morning brief is a daily re-anchor mid-battle). May share Voice Layer infrastructure (proactive message, Gemma narration) but addresses a different cognitive moment.
**Trigger for becoming real:** Snake Draft is shipping or has shipped with enough usage to see whether Day 2+ continuity feels broken without an explicit re-anchor.

---

## Meta: what this roadmap is and isn't

- **Is:** Current best read of what's worth shipping next in the Voice Layer rework, grounded in evidence from prior phases and product instinct refined by production observation.
- **Isn't:** A fixed commitment. Phase order and scope have been revised before (Phase 4a deferral is the most recent example) and will be revised again as production data informs priorities.
- **Discipline:** Ship what demonstrably matters. Defer what doesn't have signal. Capture what might matter later as thesis docs rather than premature workstreams.

*Last updated: May 24, 2026 — Phase 4 scope revised to Film Room only; Phase 4a (gameplan) deferred indefinitely.*
