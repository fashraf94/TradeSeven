# Claude Design brief — FantasyTrades Backing (the predictions layer)

**What this is for:** visual design of five surfaces before they get built. The logic behind them is already built, merged, and dark. This brief is the contract those designs have to hold to — the constraints in §3 are not preferences, they are rules the system already enforces, and a design that breaks one can't ship.

---

## 1. What backing is, in one paragraph

The League runs four-seat pods each week: a player and their AI agent form one team, up to four teams per pod, CPUs filling empty seats, battling Monday through Friday. **Backing** is a second way to play, for the weeks you're watching rather than competing. Every player gets 1,000 Backing Points a week, free, non-purchasable, expiring. You spend them on teams in pods you are *not* seated in, before the week starts. Each pod's stakes form one pot. Friday, the backers of the pod's winning team split the whole pot in proportion to what they staked; everyone else loses theirs. Your record is private.

**The point of the feature is scouting.** Reading somebody else's strategy — their archetype, their record, and the actual tape of what their agent did last week and why — and judging whether it will win. That is the skill the platform exists to teach. The design succeeds if people read before they stake.

---

## 2. The five surfaces

**A. Upcoming pods (the browse list).** The pods playing next week. Each row: the four seats, who's human and who's CPU, whether backing is open, and how close the pool is to being valid. The viewer's own pod appears but is not backable — it should read as *yours*, not as *disabled*.

**B. The team card.** One seat, opened from a pod row. Everything a person needs to judge them: name, agent name, archetype, career rank and tier, prior weeks' finishes, a loadout summary (**counts only** — "4 traits, 7 rules" — never the rule contents), and last week's tape: what their agent picked, what it did, what it said about why. A link deeper into the full film room. **This card is the feature.** Its hierarchy should make the tape the destination, not a footnote under the stats.

**C. The stake control.** Preset amounts (100 / 250 / 500), a custom amount, the per-team cap and remaining allowance, and three lines of disclosure directly above Confirm: loadouts can change nightly during the week; the payout isn't known until the pool closes and moves as others back; the stake only counts if the pool reaches its participation minimum, otherwise it's void. These three lines are honesty requirements — they can be beautiful but they cannot be buried, collapsed, or reduced to an info icon.

**D. Your backing (Monday–Friday).** One card per pod you're invested in: which team you backed, where the pod stands, what day of five, one tap into the tape. No new actions — backing is closed for the week. This surface's only job is to make the week you have money on worth watching.

**E. Results (after Friday).** The reveal. Who won, what you backed, what you got, and — now visible for the first time — how many people backed each team, what share of the pot each team held, and the multiple each paid. If the team's loadout changed during the week, that's marked.

---

## 3. Hard constraints — the sealed pool

While a pool is **open**, these are the only things that may appear on screen:

- whether backing is open, and when it closes
- **backers: n of 3** — capped, never 4, 5, 6
- **team spread: needs another team / threshold met**
- the viewer's own stakes
- and once both thresholds are met, those two signals **freeze** and stop changing entirely

**Never, while a pool is open:** the pot total, any per-team amount or share, any payout multiple, any "most backed" indicator, any movement, ticker, sparkline, or animation implying activity, and the true backer count above three. All of it appears at close, not before.

This exists because at four seats a live number is one person's stake — an observer could reconstruct who backed whom for how much. The design cannot smuggle the information back in through motion, ordering, or emphasis.

Other rules: rule contents are never shown (counts only, as above); a team with no history shows a first-week state, not an empty card; CPU seats show archetype and "no history."

---

## 4. The real design problems

These are the interesting parts, and where judgment is wanted rather than compliance.

1. **A sealed pool is an absence.** Betting interfaces are normally dense with numbers. This one, while open, has almost none. Make that read as a deliberate rule — the way a blind auction, a sealed bid, or a simultaneous-reveal board game does — rather than as a screen that failed to load or a feature that isn't finished.
2. **Make the tape the destination.** If the team card can be judged at a glance from archetype and record, people will stake on vibes and learn nothing. The hierarchy should reward reading.
3. **"Backers 2 of 3" is an invitation, not a metric.** It exists so a spectator knows their participation would rescue a pool that's about to die thin. It should feel like a call, not a progress bar.
4. **Week one has no tape.** Most teams will be brand new at launch. The first-week state is the majority case, not an edge case, and it still has to support a decision.
5. **Close is a reveal moment.** Everything hidden becomes visible at once, for every pod, at the same instant. That's a beat worth designing rather than a state change.
6. **Monday to Friday, there is nothing to click.** Surface D has to hold attention for five days with no actions available.

---

## 5. House anchors

These attach to existing League surfaces, not a blank canvas. The pod list and team card mount on the existing pod row / pod card / pod sheet components and in the spectate view; the results surface lives in spectate's finished state. Match the existing design tokens and the League's current visual language. Snake Draft (the draft battle screen, altitude map, tactical pod) is the project's gold standard for density, motion, and competitive feel — that bar, not a fintech dashboard.

Tone: this is a game about judgment, not a sportsbook. The vocabulary is **back / backing / backer / pool / pot / pays ×**. Never bet, wager, odds, cash out, or gamble — anywhere, including microcopy.

---

## 6. Out of scope

No public leaderboard of backers (deliberately absent in this version). No trainer reputation badges or rankings. No live odds or crowd percentages while open. No currency purchase, top-up, or balance-increase flow of any kind. No in-week staking. Nothing that implies real money.
