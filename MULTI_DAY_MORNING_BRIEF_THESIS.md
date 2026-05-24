# Multi-Day Morning Brief — Initial Thesis

**A potential future surface for daily re-anchoring in multi-day battles. Distinct from gameplan, distinct from Film Room. Captured here so the product instinct doesn't get lost.**

**Status:** Initial thesis. Not a spec, not designed in detail. Captured May 24, 2026 during Phase 4 design conversation when the gameplan workstream was being revisited.

---

## 1. The instinct

In multi-day battles (Snake Draft is 5 days; future formats may be longer), the agent currently has no formalized "new trading day" surface. It just keeps trading. Day 2 starts and the agent picks up where Day 1 ended without explicitly re-evaluating.

This is a real product gap. Strategies that worked on Day 1 might not work on Day 3 depending on:
- Score state (am I winning, losing, neck-and-neck?)
- Portfolio state (what's been rotated in/out, what's holding up, what's lagging?)
- Regime shift (did the macro picture change overnight? Is there pre-market news?)
- Position vs threshold (where are the ATR-based bonus/penalty bands?)

Today, none of this gets surfaced to the user at the start of each new trading day. The agent just executes.

A **morning brief** surface would mark each new trading day with explicit re-anchoring: here's where we stand, here's how the agent is reading the new day, here's what's shifting.

---

## 2. Why this is distinct from gameplan

The deferred gameplan thesis (see `GAMEPLAN_DEFERRED_THESIS.md`) was a *pre-deploy* surface — fired once, before the battle started. The morning brief would be a *mid-battle* surface — fires at the start of each new trading day within an active multi-day battle.

| Aspect | Gameplan (deferred) | Morning Brief (this thesis) |
|---|---|---|
| When it fires | Pre-deploy, once per battle | Start of Day 2+, repeating per trading day |
| Battle types | All battles | Multi-day only (Snake Draft, future formats) |
| Cognitive moment | "What's the plan for this battle?" | "How are we resetting for today?" |
| Content focus | Opening stance, regime read | Score, portfolio state, regime shift, today's adjustment |
| User input expected | None (in the deferred Option B variant) | None |
| Voice Layer infrastructure | Would reuse | Would reuse |

These are different surfaces serving different cognitive moments. They're not redundant with each other.

---

## 3. What a morning brief would contain

Hypothetical content (not a spec, not locked):

1. **Score check** — where the user stands relative to opponents (or vs S&P 500 in Season Mode), brief delta from yesterday's close
2. **Portfolio state** — what survived the close, what got rotated, what's the current tier composition
3. **Regime shift** — what's different about today vs yesterday (overnight news, pre-market action, sector rotation signals)
4. **Today's adjustment** — what the agent is planning to do differently (or the same) and why

Total: probably 4-6 sentences, possibly longer than other Voice Layer messages because it covers more ground.

---

## 4. Connection to existing infrastructure

If this becomes a real workstream, it would likely reuse a lot of existing Voice Layer machinery:

- **Trigger:** new cron or scheduled event at pre-market for active multi-day battles
- **Content source:** Haiku generates structure (score state, portfolio state, regime shift, planned adjustment), Gemma narrates — same pattern as Phase 3 anticipation and the deferred gameplan's "agent commitment" variant
- **Chat surface:** new `messageType: 'morning_brief'` value, reuses existing reactive rendering
- **Shadow logging:** add `logMorningBrief` to `shadowLogger.js`

Estimated scope: ~Phase 3-sized work if built straightforwardly.

---

## 5. Open design questions (for future spec work)

Captured here so they don't have to be re-discovered if this becomes real:

1. **Does morning brief replace or supplement Day-N first-message?** Currently first-message fires at deploy. If morning brief fires at Day 2+ pre-market, does Day 2's session also have a first-message moment? Or does morning brief subsume it?

2. **What's the trigger timing?** Pre-market open (4am ET)? At a fixed time (say 8am ET)? When the user opens the app on Day 2+? Different triggers have different implications for content freshness and user attention.

3. **How does morning brief handle silent days?** If Day 2's market context is genuinely identical to Day 1, does morning brief still fire (predictability) or skip (signal preservation)? Same trade-off as Phase 3 anticipation.

4. **Does the user have a way to opt out?** Some users may want quieter mornings; others may want the agent to lead them in. Toggleable, or always-on?

5. **How does morning brief interact with Film Room?** Film Room (Phase 4, in active design) is the post-battle debrief. Morning brief is the pre-day-N re-anchor. Are these conceptually related? Should morning brief reference the prior day's Film Room? Or stay independent?

6. **What about cross-battle morning brief?** If a user has multiple active multi-day battles simultaneously, does each get its own morning brief, or is there a consolidated view?

---

## 6. Trigger for becoming a real workstream

This thesis becomes a spec when:

- Snake Draft is shipping or has shipped with enough usage to see Day 2+ behavior in production
- Production data shows users disengaging on Day 2+ (fatigue, confusion, not opening the app) — indicating an explicit re-anchor would help
- Voice Layer rework is at a stable point (Phase 4 Film Room ships and stabilizes; possibly Phase 5 dossiers in flight)
- Bandwidth exists for a new design conversation arc

Until then, this thesis sits as captured product instinct. The gap is real but the solution may take a different form than what's sketched here.

---

## 7. What this thesis isn't

- **Not a Phase 4 dependency.** Phase 4 (Film Room) ships independently. Morning brief is a separate future workstream.
- **Not a renamed gameplan.** The gameplan thesis is a separate doc with different cognitive framing.
- **Not a commitment.** This is captured instinct, not roadmap commitment.
- **Not a polish item.** This is its own surface with its own design space, not something to fold into existing surfaces.

*Captured: May 24, 2026 — during Phase 4 design conversation, when the founder identified Day 2+ multi-day battle continuity as a real gap distinct from the deferred gameplan.*
