# Forge Rules Product Thesis V1.2

**Status:** Locked — May 25, 2026 (V1.0). Updated with Session 1 outputs — May 25, 2026 (V1.1). Updated with second-opinion fixes — May 25, 2026 (V1.2).
**Owner:** Flash
**Workstream:** Forge System Revamp (pre-launch, blocks Dossier Sprint 2)
**Companion documents:**
- `FORGE_AUDIT_REPORT_MAY2026.md` — discovery audit that informed this thesis
- `DOSSIER_AUDIT_REPORT_MAY2026.md` — adjacent audit; Dossier work resumes after Forge revamp ships
- `DOSSIER_SYSTEM_ROADMAP.md` — paused until Forge thesis is implemented

**Version notes:**
- **V1.0** (May 25, 2026): Initial thesis lock. Sections 1-8.
- **V1.1** (May 25, 2026): Added Section 9 (Behavioral Ownership Matrix from Stream B Session 1). Updated Section 4 (Deferred) with items surfaced during session. Updated Section 8 (Locked Decisions).
- **V1.2** (May 25, 2026): Incorporated ChatGPT second-opinion critique. Added Section 9.5 (Global Precedence Ladder). Added Concerns 14-17 to ownership matrix. Fixed precedence wording in Concerns 3, 5, 9 and Pattern 1. Added canonical rule manifest as Stream D foundational requirement. Added novice-facing affordances (Risk Preview, "What your agent will do" card, Film Room rule attribution). Added Section 10 (Considered and Not Adopted).

---

## 1. The thesis

> **A Forge rule is a user-or-archetype authored, operationalizable, execution-layer behavior that creates strategic differentiation between agents. Rules are the shared vocabulary through which users and the Voice Layer collaborate on agent behavior — pre-battle for foundational strategy, evolving over time as the rule corpus matures into a live conversational instrument.**

---

## 2. What the thesis commits us to

Seven principles. Every downstream design decision is measured against these.

### 2.1 Rules are authored, not learned

Rules are explicitly authored — by the user directly, or by an archetype the user adopts. They are distinct from disciplines and lessons, which are agent-generated artifacts that emerge from accumulated battle experience. Rules are pre-game declarations of intent; disciplines and lessons are post-game extractions of pattern. They can coexist because they answer different questions.

### 2.2 Rules are operationalizable

Every rule must translate to a concrete, executable behavior. "Be aggressive" is not a rule. "Use a momentum filter requiring relative strength > 70" is. If a proposed rule cannot be expressed as a deterministic check or a clear threshold-driven preference, it does not qualify.

### 2.3 Rules are execution-layer

Rules influence what the agent *does* in markets — entry timing, exit timing, sector preference, technical-indicator priority, trade frequency, and similar concerns. Rules do NOT influence:
- How the agent talks (Voice Layer phase / register / tone)
- What authority mode is active (auto-pilot / co-pilot / manual)
- Platform safety mechanisms (guardrails)
- User-facing UI state

(Note: position sizing is execution-layer by principle, but per Concern 12 it stays a gap for the precursor — the BaggerBomb tier-assignment mechanic is today's de facto sizing surface.)

### 2.4 Rules create variability

A rule that doesn't meaningfully differentiate Agent A from Agent B doesn't earn its place in the corpus. The product goal is strategic variability across users — two users with the same starting conditions but different rule assemblies should produce visibly different trading behavior. Rules that duplicate hardcoded defaults, duplicate disciplines, or duplicate guardrails fail this test.

### 2.5 Voice Layer is a first-class consumer

Rules are not just Haiku input. They are the vocabulary through which Gemma and the user discuss strategy. Voice Layer reads active rules, references them in narration, and (eventually) proposes rule changes through conversation. The audit's biggest finding — Voice Layer asymmetry where Haiku reads rules and Gemma does not — is resolved by making rule-awareness a first-class Voice Layer responsibility, not an afterthought.

**Critical V1.2 addition:** Voice Layer and Haiku must read from a *canonical rule manifest* — a single shared representation of active rules. If Gemma and Haiku read different serialized forms, the asymmetry is rebuilt under a nicer name. See Section 9.5 and Section 9.6.

### 2.6 Guardrails are separate

Guardrails are platform-level safety enforcement that prevents catastrophic outcomes regardless of which rules the user authored. They are:
- Deterministic (not advisory)
- Largely invisible to the user (not surfaced in Forge UI)
- Not user-configurable in the same flow as rules
- **Explainable after the fact** — when a guardrail intervenes, the Film Room must surface what happened ("Your stop-loss rule allowed deeper losses, but platform protection stopped the position at the safety floor")

A given behavioral concern (e.g., stop-loss) may exist as both a rule (user-authored, variability-creating) and a guardrail (platform floor, catastrophe-preventing). They are different mechanisms with different semantics. Precedence is governed by Section 9.5's global ladder, not by per-concern improvisation.

### 2.7 The destination is a live conversational instrument

The full vision is: rules become live instruments that the agent and user reach for together during the day. Voice Layer proposes rule swaps when conditions change; users adjust rules mid-battle as new information arrives; the rule corpus becomes the language of mid-battle strategic adaptation.

**The pre-launch precursor ships a meaningful subset of this vision. The full live-instrument experience is post-launch.**

---

## 3. Pre-launch precursor scope

What ships before launch.

### 3.1 Pre-battle

- **Rule authoring** — existing Forge flows, with one fix: archetype identity must be preserved on Discover-tab "Use This Playbook" application (currently lost — `archetypeId` / `sourceCollection` field becomes a write target downstream).
- **Curated rule corpus** — every rule in the production corpus passes the thesis filter. Duplicates merged or retired. Each surviving rule has a clear "this rule exists because [behavioral gap]" justification. Output of Stream B.
- **Hardcoded behavior promotion** — a small number of high-value Haiku-hardcoded behaviors are promoted to rules. Confirmed candidates per Session 1: trade frequency, profit-taking policy (not ATR thresholds themselves), volatility-window preferences, sector preference (new category). Exact rule shapes designed in Stream B.
- **Archetype components** — DNA traits retire as currently implemented; the mid-granularity authoring concept survives as named "components" that compose into archetypes. Stream B designs the component-archetype relationship. **UX requirement:** every archetype component must display its generated rules in plain English before battle deployment, so users see what behavior they've actually configured.
- **"What your agent will do" pre-battle card** — a derived summary shown after archetype/rule selection and before deployment. Summarizes frequency, entry strictness, stop-loss posture, profit-taking posture, sector lean, volatility preference. Plain language, not jargon. Read-only — this is explanatory, not a configuration surface.
- **Risk Preview readout** — a derived label (Conservative / Balanced / Aggressive / Chaos) computed from active rule combinations. Read-only. Does not violate "no second source of truth" because it's a *derived view* of the rule set, not a separate setting. Helps novices understand the aggregate behavior they've configured.

### 3.2 Mid-battle

- **Voice Layer reads rules from canonical manifest** — Gemma's prompt assembly includes active rules from the same source Haiku reads. Phase 1 (first-message), Phase 2 (trade narration), Phase 3 (anticipation) prompts updated to reference rules where relevant.
- **Two labeled mid-battle conversation entry points** in the battle UI, surfaced based on game state:
  - **"I'm losing — let's discuss a change in strategy"** — opens a catch-up conversation
  - **"I'm winning — let's discuss how to protect this"** — opens a maintain-lead conversation
- **Each entry point opens a focused Voice Layer conversation** with a specific shape. Gemma comes in knowing the conversation type, frames the situation, proposes rule swaps in plain language, and confirms with the user.
- **Confirmed swaps are user-initiated only.** Gemma proposes within the conversation; the user makes the final call. No agent-initiated rule swap proposals outside these entry points.
- **Mid-battle rule mutation infrastructure** — confirmed rule swaps update both `agent.activeRules` and `battle.agentContext.activeRules`, with atomic versioning so every Haiku evaluation knows which rule-set version it operated against. A logged rationale event captures the swap. New rules take effect at the next Haiku evaluation.
- **Boundary between rules and conversations (V1.2 clarification per Concern 5):** Rules define preferred market windows and persistent execution preferences. Conversations propose strategic posture changes in response to game state. Haiku executes only after a confirmed rule swap — conversations do not directly mutate execution behavior; they produce rule swaps that then take effect.

### 3.3 Post-battle

- **Rule swap events visible in Film Room** — the auto-debrief and Film Room Q&A reference rule changes that occurred during the battle, framing them as part of the battle narrative.
- **Per-trade rule attribution in Film Room** — for each trade, surface: which rule(s) were followed, which were blocked by guardrail, which were overridden by higher-priority rule, which were ignored because required signal was unavailable. Plain language. This is the "agent decision receipt" backbone for user trust and debugging.

---

## 4. Deferred to post-launch

Explicit non-scope items. These are NOT being abandoned — they are being sequenced after launch.

### 4.1 Live-instrument fullness

- **Agent-initiated rule swap proposals** — Gemma proactively surfacing rule change suggestions outside the labeled entry points. Powerful but requires more sophisticated trigger discipline.
- **"Explore" / neutral mid-battle conversation mode** — the third entry point for research-oriented exploration. Overlaps with the mid-battle research surface already specced in Voice Layer V1.1 stance Section 4.3. Comes after the catch-up and maintain conversations are validated in production.
- **Conversational rule discovery** — users discovering new rules through Voice Layer conversation rather than browsing the Forge UI.

### 4.2 Rule corpus evolution mechanisms

- **Disciplines and lessons re-framing** — the audit found Sprint 1's disciplines and the lessons artifact may need re-thinking now that rules are getting a proper thesis. The right "evolution metric" — what the agent generates from accumulated experience — is an open product question. Resolved after Forge ships.
- **Laboratory → Forge auto-refinement** — the Strategy Laboratory measures per-rule performance (`timesFollowed`, `timesBlocked`, `timesOverridden`) but does not feed back into rule tunings. Auto-refinement loop is post-launch.
- **Forge Score v1.1 / BaggerBomb Fitness Score** — specced in `FORGE_STRATEGY_LABORATORY_QUICK_REFERENCE_V1_1.md` but not implemented. Decision deferred: implement, retire spec, or replace with a simpler metric.

### 4.3 Open architectural questions (resolved in Session 1)

The following were open in V1.0 and are now resolved — see Section 9 for full ownership decisions:
- ~~**DNA traits resolution**~~ → Locked: retire current implementation; reframe as archetype components (Concern 13)
- ~~**Stop-loss precedence model**~~ → Locked: Forge rule + hidden guardrail floor; retire deployedStrategy.guardrails config, retire Survival Mode, ATR penalties become scoring only (Concern 9)
- ~~**Risk tolerance ownership**~~ → Locked: emerges from rule combinations; kill `agent.config.risk` orphan field (Concern 11)
- ~~**Entry timing precedence**~~ → Locked: Haiku 70% conviction floor as platform default; Forge rules override (Concern 10)

### 4.4 Cheap fixes pending Stream D

- **Un-gate Workshop Chat visibility** — currently hidden behind `landingState === 'testing'` at `ForgeLanding.jsx:2212`. One-line fix; do during Stream D execution.
- **Standardize legacy rule naming** — `tech-*` / `t-NN` / `tv-NN` coexist. Cleanup work; post-launch polish.

### 4.5 Net-new deferred items

- **Risk-tolerance configurable shortcut for first-time users** — Option C-style archetype-level risk dial as onboarding affordance. Note: the *derived* Risk Preview readout ships in the precursor (Section 3.1); the *configurable* version is the post-launch item. Consider during Onboarding Redesign work (prelaunch sequence Item 7).
- **Position sizing as first-class rule category** — out of precursor scope. Consider during post-launch portfolio management work. Today's `allocation` category likely largely retires in Stream B as the underlying concept doesn't match the BaggerBomb tier-assignment game mechanic.
- **Detection infrastructure cross-reference for Stream B** — multiple rule categories were authored before their detection infrastructure existed (most notably `technical` predating Layer 1). Stream B curation must include a "is this rule actually executable today with existing primitives?" check for `technical`, `fundamental`, `institutional`, `game_state` categories. Verify rankings cron as detection source for `fundamental`.

### 4.6 Items surfaced in second-opinion pass (V1.2)

- **Progressive reveal authoring model UX** — first-time user sees archetype only; intermediate user sees component swaps; advanced user sees individual rule editing. The infrastructure for all three layers ships in the precursor (per Section 3.1), but the *progressive reveal UX* — how the layers are presented to increase fluency over time — is its own design pass. Likely post-launch onboarding work.
- **Rule telemetry event schema** — `rule_considered`, `rule_applied`, `rule_blocked_by_guardrail`, `rule_blocked_by_conflict`, `rule_skipped_missing_signal`, `rule_mutated_mid_battle`. Stream D ships the per-trade attribution surface (Section 3.3); the full structured event-logging schema for post-launch analytics is a follow-up Stream D item, not blocking precursor launch.

---

## 5. Stream structure

The Forge revamp work is organized into four streams.

### Stream A — Define what Forge rules are FOR
**Status:** ✅ Locked (this document).

### Stream B — Curate the rule corpus
**Status:** Session 1 complete. Approach:
1. ✅ **Session 1: Behavioral ownership matrix.** Resolved canonical ownership for each behavioral concern. Outputs in Section 9.
2. **Sessions 2-5: Category-by-category curation.** For each of 13 rule categories, state its purpose under the thesis and evaluate each rule. Suggested order:
   - **Session 2:** institutional → fundamental → tier_strategy → game_state (cleaner categories first)
   - **Session 3:** technical (own session — biggest, needs detection-infrastructure cross-reference)
   - **Session 4:** threshold → mid_battle → entry_criteria → exit_stops
   - **Session 5:** rebalancing → season_state → risk → allocation, plus promotion design for new rules
3. **Stream C cleanup** (folded into Session 5): finalize Survival Mode retirement, `deployedStrategy.guardrails.stopLoss` migration plan, `agent.config.risk` removal.

Stream B Session 2+ must also produce: rule-quality checklist application (rules must have category, gameMode metadata, priority/conflict metadata, requiresSignal declaration, fallback behavior, novice-readable explanation) for every surviving rule.

### Stream C — Resolve contested ownership zones
**Status:** ✅ Resolved during Stream B Session 1 (folded in). See Section 9.

### Stream D — Execute
**Status:** Planning. Stream D cannot begin until the rule manifest, conflict resolver, and global precedence ladder are implemented as the foundational layer. After that, the remaining items can be sequenced.

**Sequencing (V1.2, adopted from second-opinion pass with adjustments):**
1. **Canonical rule manifest + rule metadata schema** — the single source of truth that all downstream readers consume. Rule shape: category, gameMode, priority, conflictGroup, requiresSignal, fallbackBehavior, plain-English summary.
2. **Rule compiler + conflict resolver** — transforms the user's authored rules into the resolved instruction set Haiku and Gemma both read. Owns Concern 14 (rule conflict resolution).
3. **Global precedence ladder enforcement** — Section 9.5 implemented as runtime logic, not prompt suggestion.
4. **Archetype identity persistence** — write `archetypeId` / `sourceCollection` on Discover-tab apply.
5. **Archetype component schema + component-to-rule compilation** — replaces DNA traits as the mid-granularity authoring layer.
6. **Orphan field removal + data migration** — remove `agent.config.risk`, `agent.equippedTraits`, retire `deployedStrategy.guardrails.stopLoss` user config (migrate values to Forge stop-loss rule).
7. **Runtime enforcement of hidden platform limits** — trade frequency ceiling, stop-loss floor. Enforced outside the prompt, not as Haiku-prompt language.
8. **Voice Layer reads from canonical manifest** — Gemma's prompt assembly updated. Phases 1, 2, 3 prompts integrated with rule context.
9. **Mid-battle rule mutation with atomic versioning** — atomic dual-write to agent + battle docs, version tagging on every Haiku evaluation.
10. **Two-conversation-mode UI + Voice Layer prompts** — catch-up and maintain entry points.
11. **Per-trade rule attribution + Film Room rule-event display** — "agent decision receipt" surfaces.
12. **Novice-facing summaries** — "What your agent will do" pre-battle card; Risk Preview readout; guardrail-intervention explanations in Film Room.
13. **Voice Layer hardcoded behavior retirements** — remove Survival Mode, hardcoded clock bands; reframe ATR penalties as scoring-only.
14. **Workshop Chat un-gating + UI polish** — final cleanup.

Items 1-3 are foundational. Items 4-7 are state/data plumbing. Items 8-11 are user-facing surfaces. Items 12-14 are polish and removal work.

---

## 6. What this document is NOT

- **Not a rule corpus.** The curated corpus is the output of Stream B.
- **Not an implementation spec.** Implementation specs are drafted from Stream B/C outputs.
- **Not a Voice Layer rework.** Voice Layer rework Phases 1-4 are already shipped; Phase 5 (Dossier writers) is paused pending Forge completion. Voice Layer integration with Forge in this revamp is incremental, not a re-rework.
- **Not a Dossier replacement.** Dossier Sprint 2 resumes after Forge ships. The thesis is intentionally bounded to Forge; it does not commit Dossier to anything.

---

## 7. How to use this document

**At the start of any Forge-related design session:** read Section 2 (the seven principles) and Section 9.5 (global precedence ladder) in full. They are the test for every downstream decision.

**At the start of any Forge-related implementation chat:** read Section 3 (precursor scope), Section 4 (deferred items), Section 9 (ownership matrix), and Section 9.5 (precedence ladder). Anything in Section 4 is explicitly out of scope; do not let it creep in.

**When a design decision feels hard:** trace it back to Section 2, Section 9, and Section 9.5. If a principle, ownership decision, or precedence rule resolves it, those win. If multiple principles conflict, surface the conflict to Flash explicitly — don't resolve it by guessing.

**When tempted to add scope:** check Section 4 and Section 10. If it's in either, it's been considered and excluded for a reason. Bring it up for explicit reconsideration; don't quietly absorb it.

---

## 8. Locked decisions

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| 1 | Forge rules thesis V1.0 (Section 1) | 2026-05-25 | Resolves the "no clear identity" problem flagged in Forge audit |
| 2 | Precursor scope = two user-initiated conversation modes (catch-up, maintain) + Voice Layer reading rules + curated corpus + hardcoded promotion | 2026-05-25 | Ships meaningful subset of live-instrument vision without committing launch to full architecture |
| 3 | Explore mode deferred to post-launch | 2026-05-25 | Structurally different from catch-up/maintain; overlaps with mid-battle research surface specced elsewhere |
| 4 | Agent-initiated rule proposals deferred to post-launch | 2026-05-25 | Hard prompt-design problem (when to propose, how often); user-initiated is more tractable and accessible to novice users |
| 5 | Disciplines/lessons re-framing deferred until after Forge ships | 2026-05-25 | Open question on evolution metric; do not let it block Forge revamp |
| 6 | DNA traits reframed as archetype components (Concern 13) | 2026-05-25 | Preserves novice authoring affordance without elevating broken implementation; folds into archetype identity work |
| 7 | Stop-loss = Forge rule + hidden guardrail floor (Concern 9) | 2026-05-25 | Four-way ownership collapses to two with clean precedence; Survival Mode retires |
| 8 | ChatGPT replaces Gemini for second-opinion passes | 2026-05-25 | Subscription change; pattern is the same |
| 9 | Dossier Sprint 2 paused until Forge revamp ships | 2026-05-25 | Sprint 2 writers would encode assumptions about rule/discipline relationship that have to be settled by this revamp first |
| 10 | Voice Layer + executionMode own user-message register and propose/execute behavior; rules do not influence (Concerns 1, 2) | 2026-05-25 | Thesis principle 2.3 — rules are execution-layer only |
| 11 | Trade frequency promoted to rule with hidden platform ceiling (Concern 3) | 2026-05-25 | Establishes hardcoded-behavior promotion pattern |
| 12 | Profit-taking policy (not ATR thresholds) promoted to rule (Concern 4) | 2026-05-25 | "Promote the policy, not the mechanic" — ATR thresholds remain scoring mechanics |
| 13 | Hardcoded clock-management bands retire; volatility-window preferences promoted to rules (Concern 5) | 2026-05-25 | Game-state aggression handled by mid-battle conversations, not rules; clock bands built on wrong primary axis |
| 14 | Sector preference becomes first-class rule category (Concern 6) | 2026-05-25 | Precedence per Section 9.5. Institutional rules stay separate. |
| 15 | Technical setups: Forge rules > Haiku regime defaults > Dossier disciplines (Concern 7) | 2026-05-25 | 25-rule category needs deep curation + Layer 1 detection-infrastructure check in Stream B Session 3 |
| 16 | Fundamental signals: Forge rules canonical, Haiku data-lag warning stays as safety logic (Concern 8) | 2026-05-25 | Verify rankings cron as detection source in Stream B |
| 17 | Entry timing: Haiku 70% conviction floor default; Forge rules override; data-validity floor only (Concern 10) | 2026-05-25 | Variability allowed at low conviction — failure is recoverable; data-validity is non-negotiable |
| 18 | Risk tolerance emerges from rule combinations; `agent.config.risk` orphan field removed (Concern 11) | 2026-05-25 | No second source of truth; derived Risk Preview readout ships for novice comprehension |
| 19 | Position sizing stays a precursor gap; `allocation` category likely largely retires in Stream B (Concern 12) | 2026-05-25 | Concept doesn't map cleanly to BaggerBomb tier-assignment mechanic; defer to post-launch portfolio work |
| 20 | Global precedence ladder is the canonical conflict-resolution authority (V1.2) | 2026-05-25 | Replaces 13 per-concern precedence improvisations with a single ladder all systems reference |
| 21 | Canonical rule manifest is Stream D's foundational deliverable (V1.2) | 2026-05-25 | Voice Layer and Haiku must read from same source; otherwise the asymmetry is rebuilt under a nicer name |
| 22 | Rule conflict resolution owned by rule compiler (Concern 14, V1.2) | 2026-05-25 | Centralized resolution prevents implicit/inconsistent precedence in runtime |
| 23 | Rule eligibility by game mode owned by rule metadata (Concern 15, V1.2) | 2026-05-25 | Mode-tag exists in schema; thesis now requires explicit enforcement at activation time |
| 24 | Missing/stale signal handling owned by platform data layer (Concern 16, V1.2) | 2026-05-25 | Critical for auto-pilot launch — Haiku needs explicit signal status, not implicit interpretation |
| 25 | Market-structure exceptions owned by platform execution layer (Concern 17, V1.2) | 2026-05-25 | Halts/delistings/early closes are platform concerns, not rule concerns |
| 26 | Novice-facing readout surfaces ship in precursor: Risk Preview + "What your agent will do" card + Film Room rule attribution (V1.2) | 2026-05-25 | Architectural cleanness without novice comprehension produces user-facing failure; readouts are derived (not authoritative) so they don't violate "no second source of truth" |

---

## 9. Behavioral Ownership Matrix (Stream B Session 1 + V1.2 amendments)

The authoritative reference for which system owns which behavior.

### 9.1 Decisions summary

| # | Concern | Canonical Owner | Precedence (references Section 9.5 ladder) | Notes |
|---|---------|----------------|---------------------------------------------|-------|
| 1 | How agent responds to user messages (register, tone, pacing) | Voice Layer | exclusive | Rules cannot influence |
| 2 | Whether to propose vs. execute (authority behavior) | Voice Layer + executionMode | exclusive | Rules cannot influence |
| 3 | Trade frequency (swap rate per evaluation) | **Forge rule (promoted)** | User rule sets target; hidden platform ceiling (3-5 swaps target) overrides only when rule would produce pathological frequency | Establishes promotion pattern |
| 4 | Profit-taking policy near scoring thresholds | **Forge rule (promoted)** | User rule sets policy; ATR thresholds remain scoring mechanics (not behavioral guidance) | "Promote the policy, not the mechanic" |
| 5 | Time horizon / clock management | **Forge rule (replaced)** | User rule sets volatility-window preferences; minimal late-battle data-validity floor only; game-state aggression handled by conversations (which produce rule swaps, not direct execution changes) | Hardcoded clock bands retire |
| 6 | Sector preference | **Forge rule (new category)** | Game eligibility (battle theme, eligible universe) > User Forge sector rules > Dossier convictions inform | Institutional category stays separate |
| 7 | Technical setups | Forge rule | User Forge rules > Haiku regime defaults (S1-S5) > Dossier disciplines inform | 25-rule category, biggest curation lift |
| 8 | Fundamental signals | Forge rule | User Forge rules canonical; Haiku data-lag warning = safety logic (always enforced) | Verify rankings cron in Stream B |
| 9 | Stop-loss thresholds | **Forge rule + invisible guardrail** | User rule = primary; hidden guardrail floor (~-15%) overrides only when rule would allow catastrophic behavior | deployedStrategy.guardrails.stopLoss config retires; Survival Mode retires; ATR penalties = scoring only |
| 10 | Entry timing | Haiku default + Forge rule override | User Forge rules override Haiku 70% conviction default when authored; no conviction-score floor; data-validity floor enforced (no entry if required signal is stale, unavailable, or contradictory) | Variability allowed at low conviction |
| 11 | Risk tolerance / aggressiveness | **Emerges from rule combinations** | No standalone owner; `agent.config.risk` orphan retires; derived Risk Preview readout ships | Configurable archetype-level dial noted for future onboarding work |
| 12 | Position sizing | **Gap (precursor)** | Tier-assignment is the only sizing surface today; remains as-is | `allocation` category likely largely retires; revisit post-launch |
| 13 | DNA traits / mid-granularity authoring | **Archetype components** | Components compose archetypes; produce rules; downstream sees rules only; UX shows generated rules in plain English before deployment | Current DNA traits implementation retires; UX-level authoring layer survives |
| **14** | **Rule conflict resolution (V1.2)** | **Rule compiler** | Compiler resolves conflicts before Haiku receives instruction set; resolution metadata surfaced to user as "primary / secondary / blocked" | Without this, multi-rule combinations produce silent inconsistency |
| **15** | **Rule eligibility by game mode (V1.2)** | **Rule metadata** | Rules carry `gameMode` field; ineligible rules deactivate at battle creation with explanation; user sees which rules apply to which game type | Mode-tag schema exists; enforcement was implicit |
| **16** | **Missing/stale/contradictory signal handling (V1.2)** | **Platform data layer** | Data layer provides explicit signal status (fresh / stale / unavailable / contradictory) to Haiku; rules requiring missing signals report fallbackBehavior; data-validity floor at Concern 10 references this | Critical for auto-pilot trust |
| **17** | **Market-structure exceptions (V1.2)** | **Platform execution layer** | Halts, delistings, early closes, thin liquidity owned by execution layer; rules cannot override; Voice Layer narrates the constraint | Likely already handled in execution code; thesis makes ownership explicit |

### 9.2 Cross-cutting patterns

These patterns emerged from Session 1 and should be applied consistently across Stream B curation and Stream D execution.

**Pattern 1 (V1.2 corrected): Hardcoded-behavior promotion with hidden platform limit.** When promoting a hardcoded behavior to a rule (Concerns 3, 4, 5, 6):
- Behavior becomes rule-tunable
- Default value lives in rule definition (users who don't author the rule get the sensible default)
- A hidden platform limit (ceiling, floor, or both — context-dependent) exists at the platform layer, invisible to users
- The limit prevents pathological rule combinations without restricting any reasonable strategy
- The limit is enforced as runtime logic, not as Haiku-prompt suggestion — a "ceiling" written into the prompt that Haiku can interpret away is not a ceiling

Per-concern limit types:
- Concern 3 (trade frequency): platform **ceiling** prevents excessive frequency
- Concern 5 (volatility windows): platform **floor** on late-battle data-validity
- Concern 9 (stop-loss): platform **floor** prevents catastrophic losses

**Pattern 2: Promote the policy, not the mechanic.** When something is fixed game/platform logic (Concern 4), promote the agent's *stance toward it* rather than the mechanic itself. ATR thresholds stay as scoring mechanics; the agent's policy about *how to behave near them* becomes the rule.

**Pattern 3: Retire and replace, not promote-as-is.** When a hardcoded behavior is built on the wrong primary axis (Concern 5 — clock bands built on time-of-day when the right axis is game state), the correct move is retirement + replacement, not promotion of the existing logic.

**Pattern 4 (V1.2 corrected): Multi-system precedence via global ladder.** When multiple systems touch a concern, precedence is governed by Section 9.5's global ladder, not by per-concern improvisation. The ladder explicitly includes game eligibility, platform guardrails, data validity, user-authored rules, conflict resolution, Haiku defaults, and Dossier patterns as distinct layers. (Voice Layer is not on the execution-precedence ladder — it narrates and proposes, but does not execute.)

**Pattern 5: Rule + guardrail clean separation.** When a behavior has both variability (rule-shaped) and catastrophe-prevention (guardrail-shaped) dimensions (Concern 9): the rule owns user-facing variability; the guardrail is a hidden platform floor. Different mechanisms, different semantics. The user authors freely; the platform protects only against the worst case. Guardrail interventions must be explainable in Film Room.

**Pattern 6: Variability over safety where stakes allow.** Not every concern needs a guardrail (Concern 10). When the worst-case outcome is recoverable (e.g., entering trades at lower conviction), let variability happen — even "entertainingly bad" variability is more product than safety-clamped mediocrity. (Caveat: "recoverable" is bounded by data validity, which is non-negotiable per Concern 16.)

**Pattern 7: No second source of truth (with derived readouts allowed).** When a concern can be expressed through rule combinations (Concern 11), don't add a parallel standalone *configurable* dial. Risk tolerance is the aggregate of the user's rule choices, not a separate setting. **However**: derived *read-only* views of that aggregate (e.g., Risk Preview label) are allowed and encouraged — they aid comprehension without becoming a competing source of truth.

**Pattern 8: Hold scope when uncertain.** Not every gap needs to be filled in the same revamp (Concern 12). When a concern doesn't map cleanly to existing game mechanics, let it remain a gap and revisit in a future workstream where it gets proper design attention.

**Pattern 9: Authoring layers preserve novice access.** The user progression is archetype → archetype with swapped components → individual rules (Concern 13). Each layer is a fluency level. The product serves users at every level, not just experts. Critical: every authoring layer must produce *visible behavioral consequence* the user can read before deployment — components without their generated rules visible become a second fuzzy authoring language.

**Pattern 10 (V1.2 new): Auditability and explanation as first-class output.** Every agent decision must be reconstructible: what rules were active, which fired, which were blocked, what guardrails intervened, what signal data was used. This isn't optional infrastructure — it's the backbone of user trust, Voice Layer narration fidelity, Film Room storytelling, and post-launch debugging. The per-trade attribution surface in Section 3.3 is the user-facing expression of this pattern; the full event log (Section 4.6) is the analytical expression.

### 9.3 Implications for Stream B curation

Based on Session 1 outputs and V1.2 amendments, Stream B's category-by-category work will produce these expected changes:

**Categories likely to retire largely:**
- `allocation` (11 rules) — concept doesn't map to BaggerBomb tier-assignment mechanic (Concern 12)

**Categories needing detection-infrastructure cross-reference:**
- `technical` (25 rules) — authored before Layer 1 detection existed (Concern 7)
- `fundamental` (14 rules) — verify rankings cron as detection source (Concern 8)
- `institutional` (10 rules) — verify Institutional Intelligence as detection source
- `game_state` (11 rules) — verify clash-phase detection

**Categories likely to require curation but stay roughly intact:**
- `tier_strategy` (10 rules)
- `threshold` (8 rules)
- `mid_battle` (16 rules)
- `entry_criteria`, `exit_stops`, `rebalancing`, `season_state` (season-only rules)

**Categories likely to be promoted into (new or expanded):**
- New: sector preference category (Concern 6)
- New: volatility-window preferences (Concern 5)
- Expansion: trade-frequency rules (Concern 3)
- Expansion: profit-taking policy rules (Concern 4)

**Categories needing precedence cleanup with hardcoded behavior:**
- `risk` (12 rules) — stop-loss subset gets the rule + guardrail treatment per Concern 9

### 9.4 Stream B rule-quality checklist (V1.2)

Every surviving rule (and every promoted-from-hardcoded rule) must satisfy:

- ✅ **Executable** with current detection infrastructure (or with infrastructure that Stream D will ship — explicitly tagged if so)
- ✅ **Creates visible behavior difference** — fails if it duplicates a hardcoded default, a discipline, or a guardrail
- ✅ **Has clear owner and precedence** — locatable in Section 9.1 matrix, references Section 9.5 ladder
- ✅ **Has novice-readable explanation** — plain-English description that surfaces in Risk Preview, "What your agent will do" card, and Film Room attribution
- ✅ **Has conflict metadata** — declares its conflictGroup (rules in the same group cannot coexist active) and priority within the user's rule set
- ✅ **Has game-mode eligibility** — `gameMode` field set; rules that only apply in some modes deactivate cleanly in others
- ✅ **Has fallback behavior** — declares what happens when its required signal is unavailable (skip, fall back to alternative, raise to user, etc.)

A rule that fails any of these gets either rewritten or retired in Stream B.

### 9.5 Global Precedence Ladder (V1.2)

The canonical conflict-resolution authority. When multiple systems touch the same behavioral concern, resolution proceeds in this order:

1. **Game eligibility and market availability** — Can this action happen at all? (Battle theme, eligible universe, market hours, symbol available, no halts.) Owned by platform execution layer (Concern 17).
2. **Platform guardrails and data validity** — Is this action catastrophically unsafe, or required by safety logic? Is required data fresh and valid? (Stop-loss floor, data-lag warnings, signal-freshness checks.) Owned by guardrails (Concern 9) and platform data layer (Concern 16).
3. **User-confirmed active Forge rules** — What has the user authored? (Resolved through the rule compiler at #4.)
4. **Rule conflict resolver** — When user rules contradict each other, the compiler produces a resolved instruction set with explicit primary/secondary/blocked metadata. (Concern 14.)
5. **Haiku platform defaults** — When no user rule speaks to a concern, what's the sensible default? (Conviction floor, regime-scoped strategy preferences, hardcoded clock-management retirements notwithstanding.)
6. **Dossier disciplines and convictions** — Learned patterns inform Haiku's reasoning but do not override layers 1-5.

**Voice Layer narration is not on this ladder.** Voice Layer reads the resolved state from the manifest and narrates it. Voice Layer does not execute; it conveys.

**Per-concern rules in Section 9.1 reference this ladder by layer number rather than improvising precedence locally.** When Section 9.1 says "Forge rule > Haiku default > Dossier disciplines," it means layers 3-4 > layer 5 > layer 6. When it says "guardrail overrides rule," it means layer 2 > layer 3.

### 9.6 Canonical Rule Manifest (V1.2)

Stream D's foundational deliverable. A single shared data structure representing the user's currently-active rule set, produced by the rule compiler and consumed by Haiku, Voice Layer, Film Room, and battle logs.

**Required properties:**
- Resolved (post-conflict-resolution) — readers do not see raw user rules, they see the compiled instruction set
- Versioned — every Haiku evaluation and every Voice Layer prompt records which manifest version it operated against
- Plain-language summaries included — Voice Layer doesn't need to re-translate rule logic into prose
- Status tags per rule (active, conflict-suppressed, mode-ineligible, signal-unavailable) — Film Room reads these directly for attribution

**Why this matters:** Without a canonical manifest, Voice Layer and Haiku can read different serialized forms of the same rules and produce inconsistent behavior. The "Voice Layer reads rules" promise in Section 2.5 is meaningless unless they read the *same* rules in the *same* form. The manifest is the contract.

### 9.7 Implications for Stream D execution

Stream D delivers per Section 5's 14-step sequence. The first three items (manifest, compiler, ladder enforcement) are non-negotiable prerequisites for everything else. Mid-battle rule mutation (item 9) cannot ship without atomic versioning. Voice Layer integration (item 8) cannot ship without the canonical manifest (item 1).

---

## 10. Considered and not adopted (V1.2)

The second-opinion pass surfaced several recommendations that were considered and deliberately not adopted. Captured here to protect the thesis from re-relitigation.

**Not adopted: Full position sizing in precursor.** ChatGPT flagged deferring position sizing as risky for auto-pilot. We considered and rejected. Rationale: the BaggerBomb tier-assignment mechanic is the de facto sizing surface and works today. Forcing a position-sizing rule category into the precursor would produce rule shapes that don't match the actual game mechanic. Post-launch portfolio management work will revisit when there's a clearer product context. *Mitigating action:* the "What your agent will do" card will explicitly state "Sizing is determined by tier assignment, not Forge rules" so users aren't surprised by the absence.

**Not adopted: Configurable risk-tolerance dial in precursor.** ChatGPT recommended including a novice risk-tolerance dial. We considered and rejected the *configurable* version. Rationale: violates Pattern 7 (no second source of truth). *Mitigating action:* the *derived* Risk Preview readout ships in the precursor as an explanatory view, not a configurable input. The configurable dial remains a post-launch onboarding consideration.

**Not adopted: Trust-boundary language between entertainment and financial advice.** ChatGPT raised this as a thesis-level concern. Considered and rejected as out of scope. Rationale: this is a product/legal/marketing concern that applies platform-wide, not specifically to Forge architecture. Belongs in product framing documents, not in the Forge thesis.

**Not adopted: Battle fairness mechanism balancing advanced vs. novice users.** ChatGPT flagged that hidden ceilings/floors might cause advanced users to feel their rules don't matter. Considered and rejected. Rationale: rule-assembly sophistication producing differentiated outcomes IS the product. Hidden floors only intervene at catastrophic thresholds, not at strategy levels. Advanced users assembling sophisticated rule sets will see their rules matter at every layer above the safety floor.

**Not adopted: Full rule telemetry event schema in precursor.** ChatGPT proposed a six-event schema (`rule_considered`, `rule_applied`, etc.). The per-trade attribution surface ships in the precursor (Section 3.3), which delivers user-facing value. The structured analytics-grade event schema is captured as a Section 4.6 deferred item — useful for post-launch learning but not blocking launch.

**Adopted with adjustment: Stream D sequencing.** ChatGPT proposed a 10-step Stream D sequence. We adopted with extensions to 14 steps, integrating items it omitted (Voice Layer hardcoded retirements, novice-facing summaries as their own step). The core ordering — manifest first, compiler second, runtime enforcement third — is preserved as the foundational prerequisite chain.

---

**End of Forge Rules Product Thesis V1.2.**
