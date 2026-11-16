# Direction note — BaggerBomb as the trading game

**Date:** 13 Nov 2026 · **Author:** Fable (the BaggerBomb revamp chat) · **Status:** adopted by the founder, 15 Nov 2026 — rulings BB-1 to BB-22 · **Follows:** the direction note "the game and the account" (13 Nov 2026) and the exploration note "two desks in one book" (13 Nov 2026)
**Destination:** this project. §7 says what goes to which chat. It enters the repo with the first build it governs. No docs-only PR.

## 1. The direction in one line

The league is hidden for the beta. BaggerBomb becomes the game where the archetype trades: it opens positions with a stop and a target, is scored on what it closes, and plays another player's agent.

## 2. Rulings

### The league

- **BB-1. The league layer is hidden for the beta behind one flag,** and its screen becomes the BaggerBomb page and launcher. Nothing is deleted. The league week in progress settles first. A read-only discovery lists everything that reads league state (the hub's league door, career rank, the Friday tournament duty, directive charges) before the flag is built.
- **BB-2. The form the league returns in is decided after the beta.** No promise that it returns as Snake Draft.

### The game

- **BB-3. Battles run 3 or 5 trading days.** Open slot: whether the one-day game stays as a quick format.
- **BB-4. Each match starts with $1,000,000 of match cash.** It sizes trades and resets every battle. It is a match bankroll, not an account: the mandate portfolio stays the player's one account (ruling 3 of "the game and the account" stands).
- **BB-5. BaggerBomb points alone decide the winner.** Dollars are shown as size, risk and match profit, and never decide. If dollars decided, this would be the hybrid prototype parked on 13 Nov.
- **BB-6. Size sets the multiplier.** Proposed: Star 20% of match cash (2x), Core 15% (1.5x), Support 10% (1x), the tiers' original allocations. Exact sizes are a blessing slot.
- **BB-7. Every position carries a stop and a target, declared when it opens.** Code executes both at the first observed price after the level is crossed, never at the level itself. A missing price never produces a fill.
- **BB-8. Threshold bonuses bank on exit, not on touch.** A bonus counts when the position is closed beyond the level, or when its stop has been moved beyond the level. Penalties are unchanged and measured from entry.
- **BB-9. The archetype starts flat.** It opens the match in cash with the list it was handed and chooses when to enter each name. Points count from the entry price.
- **BB-10. Each archetype has its own permitted ranges** for stop distance, size and total open risk. The player picks inside the range with the dials. The ranges are authored with the archetype restructure.
- **BB-11. The scoreboard shows the trader's line:** win rate, average win against average loss, worst drawdown.
- **BB-12. Scoring in risk units (R) is not adopted yet.** It is decided after the replay of BB-14.
- **BB-13. Every battle is stamped with its scoring version.** Battles under different versions are never compared, in records, lessons or experiments.
- **BB-14. Measured before it is built.** BB-8 is rescored on past battles from the capture corpus. BB-9 is run offline on recorded sessions. Both report whether the rules separate the archetypes.

### Agent against agent

- **BB-15. An Agent vs Agent mode joins Agent vs CPU.** Agents deployed for the same battle length are paired at the open by rank. An unpaired agent plays the CPU. Nobody needs to be online.
- **BB-16. Agent vs CPU is labelled practice.** Agent vs Agent carries the rank.
- **BB-17. Rewards are cosmetic only:** finishes for the archetype armor, earned by trading feats per archetype (trades closed at target, a win with no stop-outs, a comeback). A reward never changes what an agent decides.

### The cockpit

- **BB-18. The cockpit keeps its record plumbing and changes its tasks** to trade-desk decisions, in four groups: the ticket (go, pass, smaller); the open trade (stop to breakeven, take half, let it run, cut); the match (press, protect); the close (hold overnight, flatten).
- **BB-19. The command budget becomes a daily budget.** The number is a blessing slot, set in the cockpit's design round. Today's budget is 7 per one-day battle.
- **BB-20. The cockpit's general release carries the launch task set of BB-21,** not the current swap-and-replace set.

### Order

- **BB-21. Launch set:** BB-1, BB-3, BB-7, BB-8, BB-11, BB-13, BB-15 to BB-17 with one reward track, and the cockpit's dials and open-trade tasks. Positions still open at the start of the match, sized in match cash (BB-4 to BB-6).
- **BB-22. After launch:** BB-9 (start flat) with the ticket tasks, then BB-12.

## 3. What this amends

- "The game and the account", ruling 1 (BaggerBomb scoring stays as it is): replaced by BB-5 to BB-9. Rulings 2 and 3 stand.
- The cockpit's ruling of 7 commands per battle: replaced by BB-19.

## 4. Cost (planning figures, unmeasured)

Assumes $0.015 per model check, the planning figure the mandate portfolio uses.

| Per player | Model checks a day (assumed) | Per trading day | Per month, in a battle every session |
|---|---|---|---|
| Today, one-day battles | 5 | $0.08 | about $1.70 |
| Launch set | 5 | $0.08 | about $1.70 |
| With start flat (BB-9) | 8 | $0.12 | about $2.50 |

- No added model cost: Agent vs Agent (it pairs two battles that already run), match cash, stops and targets (code), rewards.
- Saved: one post-battle reflection per 3 or 5 days in place of one a day.
- The limit that binds first is capacity, not dollars. The capacity lane (formerly the cockpit chat) owns it: the beta's planning target is 25 players in battles at once, its 15 Nov discovery measured 5–6 agent battles per evaluator run today, and market data is the wall beyond that. The launch set's flips wait on that lane's market-data plan for 25 players.

## 5. Time (rough, at the pace of the cockpit and hub arcs)

| Piece | Size | Time |
|---|---|---|
| Hide the league, BaggerBomb page | Small | 3–5 days |
| 3 and 5 day battles | Medium; the multi-day engine exists | about 1 week |
| Stop and target per position, bank on exit | Medium; touches fenced scoring | 1–2 weeks |
| Agent vs Agent, basic | Medium | 1–2 weeks |
| Cockpit dials and open-trade tasks | Medium | 1–2 weeks |
| One reward track | Small build, design-led | about 1 week |
| **Launch set** | | **5–7 weeks in series, about 4 in two lanes** |
| Start flat, tickets | Large; changes the battle record, the trading brain's tool and prompt, the trigger gate, the board, the Film Room tape | 3–4 weeks |

## 6. Risks

- Start flat is only as good as the archetypes' entries. It depends on the archetype restructure.
- The scoring core is fenced and many readers depend on it (Film Room, cockpit, reflection, capture). BB-13 is what keeps the old records honest.
- Rank attached to Agent vs Agent invites second accounts. Cosmetic rewards limit the gain; the rank guard is not alt detection.

## 7. Hand-offs

| What | Goes to | What that chat does with it |
|---|---|---|
| This note | The Practice Field chat ("Agent Training Game Design") | Records the amendment to ruling 1 and BB-4; no reply needed |
| §2 "The cockpit" | The capacity lane (formerly the cockpit chat) | Done 15 Nov: it held the cockpit's general release under BB-20 |
| BB-10 | The archetype chat | Adds the per-archetype ranges to the restructure |

The first task from this chat is the read-only discovery of the launch set: `claude/DISCOVERY_PROMPT_BAGGERBOMB_TRADER_GAME_NOV15_2026.md`.

Rulings BB-1 to BB-22 adopted by founder: 15 Nov 2026 ("I think this is it. I am ready to get started.")
