# Claude Design brief — FantasyTrades Backing, desktop

**Status:** the mobile design (revisions 1–3) is approved, built, and smoke-tested. It becomes the launch layout. This pass designs **desktop** for every surface. Read the original brief, rev2 and rev3 alongside this; the hard constraints are unchanged and absolute.

**Starting point:** your very first Backing pass *was* desktop — the three-column layout: pods on the left, the team card in the middle, "your backing so far" and the disclosures on the right. Keep that bones. Bring it up to everything rev2 and rev3 changed: the team leads (human + agent as one unit), the human's pitch and derived line, last week's portfolios on both layers, the first-week card as the primary case, the Monday draft reveal, no live standing on the card.

---

## 1. The League landing, desktop

The real desktop League today is three columns: **Live now · Follows** on the left, **Pick a draft slot** (the ranked-entry times) in the centre, **Leaderboard · The Field** on the right. The strip goes **in the centre column, directly under the draft slots** — the same "under the ranked-entry times" rule as mobile. Design all four week-states there.

Also design the landing for a player who is **already seated this week** (the centre shows their game instead of the slot picker). The strip still sits directly under whatever occupies the ranked-entry position — never pushed to the bottom of the page below "watch a live game" and the bracket line. This is a known issue on mobile; resolve it on both.

When no bracket exists (today's production), no empty space is reserved for the funnel. When one exists, the funnel takes its designed place and nothing else moves.

## 2. The Backing screen, desktop — five surfaces

- **Pod list (left column).** Every pod playing next week, sealed exactly as on mobile.
- **Team card (centre).** Room to breathe: the team unit, both lines, last week's two portfolios side by side rather than stacked, the tape. First-week card is the primary case — design it first.
- **Stake control.** Decide whether it lives in the centre column under the card or in the right column; the three disclosure lines stay directly above Confirm, visible without scrolling.
- **Your Backing (right column during the window; the whole screen Monday–Friday).** Include the Monday draft reveal, both layers.
- **Results (new — Surface E).** The Friday reveal for the pods you backed: who won, your stakes and payout, and — visible for the first time — backers per team, each team's share labeled as "X% of BP in this pool", and pays × per team; the loadout-changed marker where it applies. Plus **your private record**: net BP this season and career, pools backed and won, and accuracy against simply backing last week's best finisher. Private to the viewer; never a leaderboard.

## 3. Two small questions to resolve in the design

- **"Watch a live game · spectate a live pod"** on the landing: should this card also point toward backing, or stay plain watching? Propose one; we'll rule.
- **Pod rows' "Predictions" affordance** on desktop: same label as mobile.

## 4. Unchanged and still absolute

No pot, per-team amount or share, payout multiple, "most backed", or activity indicator while a pool is open. Backer count capped at three; both signals freeze once qualified. Loadout counts only. Vocabulary: back / backing / backer / pool / pot / pays × — never bet, wager, odds, cash out, gamble. No backer leaderboard, no reputation badges, no currency purchase, no in-week staking.

Deliver desktop and mobile of the landing side by side so placement can be compared directly.
