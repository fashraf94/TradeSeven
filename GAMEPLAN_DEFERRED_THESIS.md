# Pre-Battle Gameplan — Deferred Thesis

**Why this surface was originally roadmapped, why it was deferred indefinitely on May 24, 2026, and what would trigger revisiting it.**

**Status:** Deferred indefinitely. Not killed. Captured here so the original instinct isn't lost and so future revisit decisions are informed by what was considered now.

---

## 1. The original instinct

When the Voice Layer rework roadmap was drafted, Phase 4 included a pre-battle gameplan surface. The original conception:

- A structured moment **before deploy** where the user could give input to the agent about how to maneuver the day
- Especially valuable in **multi-day battles** (Snake Draft) where strategy needs to shift day-by-day based on score, portfolio state, regime
- A place where users could **upload articles or other media** (parallel to Signal Drop) for the agent to analyze and incorporate into the day's strategy

The product framing at the time: gameplan was going to be the primary user-to-agent communication channel pre-battle, with the agent then committing to a strategy based on that input.

This was a strong instinct when conceived. The Voice Layer at that point had no robust bidirectional channels and user input to the agent was thin.

---

## 2. Why the original gameplan is now redundant

Between when the roadmap was drafted and May 2026, multiple features shipped that filled the user-to-agent input gap:

| Original gameplan purpose | What now fills this gap |
|---|---|
| User gives input to agent pre-battle | Watchlist Equip (specific stocks + signals), Workshop Mode (strategy conversation), Phase 1 first-message (directive elicitation at deploy) |
| User uploads articles for agent analysis | Signal Drop (article uploads processed by Workshop into rules) |
| Pre-day directive setting | Workshop Mode + first-message directive elicitation + active directive system persistence |
| Multi-day strategy adjustment | Active directive system carries through; directive expiry/refresh logic handles day-to-day continuity |

Adding gameplan in its original form would create a fifth user-input channel where four already exist. Each new channel dilutes the others and creates choice paralysis about *where* to put input.

The "feels like a job" concern is real and load-bearing: requiring user input before the agent acts contradicts the curious-but-intimidated user thesis from Addendum B. Every minute of pre-deploy form-filling is a minute the user isn't watching the agent work.

---

## 3. The narrower variant that might still have value

During the May 24 design conversation, a smaller variant of gameplan was identified that might still serve a real product gap:

**"Agent commits to a stance pre-battle" (read-only, no user input required).**

The framing:
- After Phase 1 first-message exchange completes
- Before the trading day begins
- Agent presents a structured commitment: regime read → stance → key conditions that would shift posture → optional light augmenter door
- User reads it; no input required; no friction added

This is additive rather than redundant — none of the existing channels do "agent committing to a plan, on record, before the day starts." The closest is first-message, which is more invitational than committal.

**The four-element structure** (preserved from May 24 design conversation in case this gets built later):

1. **Regime read** — 1 short sentence on what the day's market context looks like, anchored in DRB
2. **Stance** — 1-2 sentences declaring agent's posture (aggressive/defensive/balanced), what's leading the portfolio
3. **Key conditions** — 1-2 sentences on what would make the agent shift posture ("if X happens, I'll do Y")
4. **Optional augmenter door** — 1 short question or none ("anything on your radar I should weigh?")

Total: 4-5 sentences, hard cap 6.

**Content source recommendation** (preserved from May 24 design conversation): Haiku generates structured `gameplanStructure` (regimeRead, stance, primaryHoldings, keyConditions), Gemma narrates it. Same pattern as Phase 3 anticipationCandidates.

**Trigger:** fires on agent deploy, after the Phase 1 first-message exchange has had a chance to complete or timeout.

**Risk to weigh if revisiting:** two pre-battle messages from the agent (first-message + gameplan) might feel like the agent is talking too much before letting the user play. Need production observation to know whether this is a real concern or theoretical.

---

## 4. The revisit trigger

Gameplan stays deferred unless production observation surfaces a real signal that users want it. Specifically:

**Strong revisit signals (any one would justify a fresh design conversation):**
- Multiple users explicitly asking "what's the agent's plan?" or "what is the agent going to do?" in chat or feedback channels
- User behavior data showing repeated pre-battle confusion about agent posture (e.g., users opening Workshop or asking the agent clarifying questions immediately post-deploy)
- Film Room debrief data showing systematic gaps between what the agent did and what the user expected — suggesting a pre-commitment surface would set expectations correctly

**Weak signals (worth noting but not sufficient alone):**
- Users asking for more agent communication generally
- Multi-day battle users showing fatigue or disengagement on Day 2+ (this may be better addressed by the Multi-Day Morning Brief thesis instead — see separate doc)

**Without these signals, gameplan stays parked.** The discipline this rework has held throughout is to ship what demonstrably matters. Building gameplan without signal would be roadmap inertia rather than product discipline.

---

## 5. Connection to other future workstreams

- **Multi-Day Morning Brief** (`MULTI_DAY_MORNING_BRIEF_THESIS.md`): addresses a related but distinct cognitive moment — daily re-anchoring in multi-day battles. Some Day 2+ continuity concerns gameplan was originally meant to handle may be better served by morning brief.
- **Phase 5 Dossiers**: when shipped, dossiers will give the agent persistent knowledge of user preferences. This may further reduce the need for explicit pre-battle input, since the agent will increasingly "know" what the user wants without needing to ask.
- **Phase 6 Polish**: if some gameplan-adjacent need surfaces from production observation but doesn't warrant a full new surface, polish-phase work could address it within existing surfaces (e.g., adding more committed language to first-message).

---

## 6. What this thesis is and isn't

- **Is:** A captured record of why gameplan was deferred and what would justify revisiting. Preserves the smaller "agent commitment" variant in case future production data warrants building it.
- **Isn't:** A spec. A commitment. A guarantee that gameplan will ever ship.
- **Discipline:** When future-Claude or future-Flash considers gameplan, this doc should be read first. The deferral was deliberate, not accidental. The smaller variant exists as a fallback design if revisit is warranted.

*Captured: May 24, 2026 — during Phase 4 design conversation when the original gameplan scope was revisited and found redundant against the current product surface.*
