# Claude Design brief — FantasyTrades Backing, revision 2

**Status:** revision of the first Backing design pass, which was strong. Everything not named below stands — keep the SEALED lockups, the three-chairs invitation, the "your pod reads as yours" treatment, the disclosure block, the day trail, the reveal. This document names what changes and why.

**Read the original brief alongside this one.** The hard constraints in its §3 — nothing about pot, shares, or payout while a pool is open; the backer count capped at three; the freeze once qualified; counts-not-contents for loadouts — are unchanged and still absolute.

---

## 1. The entry point (new surface)

Backing has no door in the first pass. It needs one, and the door belongs on the **League landing**, directly under the ranked-entry times — not in a separate destination and not buried inside spectate.

The reason it can be a strip rather than a tab: backing is weekly and rhythmic, so its presence should change with the week rather than sit there inert. Design **one strip with four states**:

| When | What it says |
|---|---|
| Window open, you haven't staked | Backing open · N pods · closes Sunday |
| Window open, you've staked | Your backing · N pods · closes Sunday · [your stakes] |
| Monday–Friday | Your backing · day 3 of 5 · [how your teams stand] |
| Between reveal and the next window | Pools open Friday 4:00 PM ET · [last week's result] |

It opens into the pod list (Surface A). The existing spectate affordance on pod rows should read **"Predictions"** rather than "Spectate" — same act, a reason attached. A player who never backs should still find the strip informative rather than nagging.

## 2. The card leads with the team, not the archetype

The single biggest note. This game is a **partnership**: the human drafts and manages three stocks; their agent drafts and manages six. A CPU seat runs both layers the same way. Backing is meant to be backing a *team* — this person plus this agent — and the first pass reads as backing an archetype, because the archetype line is the headline and the human is a name with a rank.

Changes:

- **Hierarchy:** the team leads — the player and their agent together as one unit, with the archetype demoted to a supporting detail rather than the banner.
- **The human gets a line, same as the agent.** Two of them, actually:
  - **A self-written scouting line** — one sentence, the player's own words, editable. Their pitch for why you'd back them. This is the seed of the team identity that will matter more as the player base grows.
  - **A derived line from last week's actual behavior** — automatic, honest, no writing required: how many of their three they held all week, what they leaned toward, how active they were. This carries the card for anyone who hasn't written a pitch yet.
- Both layers should feel like halves of one team, not two stacked profiles.

## 3. Last week's portfolios, on the card

Make the card concrete by showing what the team actually held **last week** — both layers, side by side:

- the human's three drafted stocks, and what they did with them across the week
- the agent's six, and what it did

This is completed, public tape, and it's the difference between "a Momentum Hunter" and "these nine names, played this way." It should sit in the card's body as part of the tape, not as a separate tab.

**Not this week's starting portfolios.** Those don't exist when the window is open — the drafts land Monday morning, after the pools close. They appear in Surface D (Your Backing) on Monday as the payoff for your read: *here is what the team you backed actually drafted.* Design that as a reveal moment inside the week card, both layers, the first thing shown Monday.

## 4. The first-week state is the default, not a variant

The first pass populates almost every seat with three weeks of finishes and a full five-day tape. Real week one is **two humans per four-seat pod, most with no history at all.**

Design the first-week card as the **primary** case and the veteran card as the variant that grows into it. A brand-new team needs to support a real decision using only: the archetype, the agent's stated approach, the human's self-written line, and whatever the League already knows about them. If the card only works with three weeks of history behind it, it doesn't work at launch.

Same for the pod list: show it populated the way week one will actually look.

## 5. Small corrections

- The close is **Sunday 11:59 PM ET**, not 8:00 PM. Reveal stays Friday.
- CPU seats manage both layers too — three stocks and six, same structure as a human team. The current "run by the house" line is good; make sure the two-layer structure reads the same way it does for a human seat.

## 6. Unchanged and still absolute

No pot, no per-team amount or share, no payout multiple, no "most backed," no movement or activity indicator while a pool is open. Backer count capped at three. Both signals freeze once the pool qualifies. Loadout counts only, never contents. Vocabulary: back / backing / backer / pool / pot / pays × — never bet, wager, odds, cash out, or gamble. No public backer leaderboard, no trainer reputation badges, no currency purchase of any kind.

## 7. What's not being asked for

Backing after the draft (the window closes before drafts resolve — that's a scheduling question for a later version). Live odds. In-week staking. A separate Predictions destination in the main navigation.
