# Claude Design brief — FantasyTrades Backing, revision 3

**Status:** revision 2 is approved except for the items below. Keep everything else exactly as it is — the team unit with its drawn bracket, both human lines, the first-week default, last week's portfolios, the Monday draft reveal, the seal, the three chairs, the disclosure block, the reveal. Read the original brief and revision 2 alongside this one; the hard constraints are unchanged and absolute.

---

## 1. The League landing strip — still missing, and the most important item

Revision 2 put the four week-states in the header *inside* the Backing screen. That's fine to keep there, but it doesn't answer the question the ruling was about: **where does a player first meet backing?** Right now they'd have to already know it exists.

Design the **League landing** with the strip on it. Show enough of the landing to make placement unambiguous: the ranked-entry times at the top, the strip directly beneath them, and the running pods/tournaments below that. The strip is the door into the Backing screen.

Four states, each designed:

| When | The strip says |
|---|---|
| Window open, you haven't staked | Backing open · N pods · closes Sun 11:59 PM ET |
| Window open, you've staked | Your backing · N pods · closes Sun 11:59 PM ET · your stakes |
| Monday–Friday | Your backing · day 3 of 5 · how your teams stand |
| Friday reveal until next window | Last week's result · pools open again Monday |

Requirements:
- It should read as a **premium, time-bound moment** — not a banner, not an ad, not a nag. A player who never backs should find it informative, not pushy.
- Its presence and wording change with the week; it is never static.
- The existing spectate affordance on pod rows below reads **"Predictions"** — same act, a reason attached.
- Design it for mobile first (the League is mobile-first), with a desktop variant.

## 2. Cut the live-standing line from the team card

Revision 2 added "Round 1 now · 2nd of 4 · +X" to the team card's known-facts strip. **Remove it.**

The card is for judging how a team *plays*, from completed weeks. A live standing pulls the eye toward whoever is winning at this moment, which is the shallow read the sealed pool exists to discourage. The card shows completed history only: career rank, tier, prior finishes, last week's tape. For a first-week team, the known-facts strip shows what's true — no weeks yet — rather than filling the gap with live data.

## 3. Where the pitch is edited

Revision 2 edits the player's scouting line in place on their own card. Keep that, but add **one other home**: the player's own agent/profile area, where they already manage their team. The card edit is the convenient path; the profile is where it lives. Show both entry points and make clear they edit the same line.

## 4. Unchanged and still absolute

No pot, per-team amount or share, payout multiple, "most backed," or activity indicator while a pool is open. Backer count capped at three; both signals freeze once qualified. Loadout counts only. Vocabulary: back / backing / backer / pool / pot / pays × — never bet, wager, odds, cash out, or gamble. No backer leaderboard, no reputation badges, no currency purchase.
