# Direction note — the game and the account

**Date:** 13 Nov 2026 · **Author:** Fable (the hybrid-scoring review chat) · **Status:** adopted by the founder, 13 Nov 2026 — rulings 1–15 and 17–22; ruling 16 withdrawn. Rulings 17 and 19 amend V6.1 and go to Astra before they are built · **Follows:** the "Portfolio-Backed BaggerBomb: First Prototype" handoff (FT-HYBRID-PROTOTYPE-001, 12 Nov) and Practice Field concept V6.1 (adopted 12 Nov)
**Destination:** the TradeSeven project, once it has room. The block in §5 is pasted once into the ChatGPT chat that wrote the hybrid handoff. It enters the repo with the next Practice Field build that carries documents. No docs-only PR.

## 1. The direction in one line

BaggerBomb is the thing you play. The idea book is the thing you check. One virtual account per player, and it is the idea book.

## 2. Proposed rulings

Answer "yes to all" or name the numbers.

1. **BaggerBomb scoring stays as it is.** Hybrid points-plus-portfolio scoring is not adopted.
2. **FT-HYBRID-PROTOTYPE-001 is parked, not built.** Its three accounting requirements become requirements on T1a, confirmed against the engine in T1a's source check: a missing price never produces a fill; an account mark is never reported as a liquidation fill; every book is valued at the same timestamp.
3. **The idea book (V6.1) is the player's one virtual account.** No second paper account, no revival of the quarterly Mandate product, no portfolio inside the league bracket.
4. **Every position belongs to an idea.** No holdings without a reason, a horizon and a line. Portfolio-level judgment (how much is at work, how ideas combine) stays as code rails in release 1 and is a candidate to hand to the agent in a later release.
5. **The player influences, never manages.** Influence runs through SignalDrop, conversations with the agent, game moments, Film Room cards and research. Slots stay scarce, the agent chooses, and it may decline with a reason. More drops do not mean more influence.
6. **Research joins the drafting sources (proposed sixth source).** Deep-dive and Work an Idea records, under the same verified-attribution rule as V6.1 ruling 18. Every idea carries its origin so the record can show whose ideas did what.
7. **A leaderboard on book return against SPY, on a monthly season clock, is a later ruling.** It is decided after the first books have run and is not part of T1a.
8. **What the account claims.** A trading record under paper conditions. It shows discipline and risk handling per player; evidence about beating the market builds only across many players per archetype. V6.1's result words stand.
9. **The Forge revamp is its own arc.** The book needs one thing from it: the typed offer slot in shared contract V2 §8. T1b's measurement of which settings move the agent's decisions is an input to the revamp.

## 3. What reaches battles

Release 1: "equip the idea and its list", through the Forge, at the next battle. This changes what the archetype trades, not how it plays a match. Settings and rule versions follow in release 2.

## 4. Cost (planning figures from V6.1 §13, unmeasured until T1b)

| Item | Per player per month |
|---|---|
| Manager, two checks a day | $0.63 |
| Drafting | about $0.05 |
| Hard bound per book (S9) | $3.00 |
| Market data | no added cost for names already on the shared price list |

About $70 a month at 100 players and $700 at 1,000. The limits that bind first are the shared price list's size (T5) and the untested capacity of about 50 books per check window, not dollars.

## 5. Block for the ChatGPT chat that wrote the hybrid handoff

> Founder direction, 13 Nov 2026. FT-HYBRID-PROTOTYPE-001 is parked and should not be built. BaggerBomb scoring stays unchanged. The portfolio side of the product is the Practice Field idea book (concept V6.1, adopted 12 Nov), which this chat did not have: one agent-run $100,000 paper book per player on the Mandate engine, fed by the player's SignalDrop picks, conversations, game moments, Film Room cards and research, with no player buttons and the Forge as the only decision. The handoff's accounting requirements (no fill from a missing price, marks kept apart from fills, one valuation timestamp) are carried into the idea book's T1a build. No reply is needed.

## 6. Book reports (founder request, 13 Nov 2026; design proposed)

The founder asked for an end-of-day report and a weekend report, delivered to the Command Center to be read at any time.

10. **The end-of-day report is assembled by code, with no model call.** After the daily close: the book's value and its change against SPY, each idea's state, the day's actions with the agent's stored reasons quoted as written, and what comes due next. Cost: none beyond the close that already runs.
11. **The weekend report is one model call per book per week,** counted inside the $3 monthly bound. It summarises the week per idea from the ledger and the stored reasons, and may state only figures the ledger holds. Planning figure: about $0.10 per player per month, measured before activation.
12. **Both are read-only cards in the Command Center.** Whether Shadow may discuss a report in conversation is a separate ruling, because that puts book content into a prompt (V6.1 ruling 17). Placement, including the partnership section, is settled with the book's screen package. Neither report is part of T1a.

## 7. Five windows a day (founder request, 13 Nov 2026; design proposed)

The founder asked for five checks a day in place of two: pre-market (tied to the Huddle), 11:00, 13:00 and 15:30 Eastern, and the close (tied to the end-of-day report, a status check on positions). This amends V6.1's "two checks a day, pinned for every archetype". It does not change T1a's accounting.

13. **Five windows, the same for every archetype.** Pre-market and the close write notes and take no trade. The three intraday windows are where the agent may act, one action per window as today.
14. **Code looks at every intraday window; the model wakes only on a trigger.** Triggers: a held name near its line, a move beyond a set band, an idea coming due, a new source for an open slot. No trigger is recorded as "no change" with no model call. The trigger thresholds are a blessing slot, set from T1b's measurements.
15. **The pre-market and close notes go by batch** at half price, with a code-built fallback line when a batch has not returned in time. The close note feeds the end-of-day report of ruling 10, which stays code-built for its figures.
16. **Withdrawn, 13 Nov 2026.** A daily trade limit was proposed; the founder accepts that more checks mean more trading. Trading costs still apply to every fill and show in each idea's result.
17. **The Huddle and the Command Center show the notes and reports as cards.** Shadow speaking them aloud puts book content into the voice prompt, which narrowly amends V6.1 ruling 17 (voice only, never the trading brain, memory or consolidation). Flagged for Astra's next pass before it is built.

| Per player per month, 21 sessions (planning figures at $0.015 per check, measured in T1b) | Checks | With drafting and the weekend report |
|---|---|---|
| Two checks, as V6.1 | $0.63 | about $0.78 |
| Five checks, all direct | $1.58 | about $1.73 |
| Five windows under rulings 14–15, model woken at one in three intraday windows | about $0.63 | about $0.80 |
| Five windows under rulings 14–15, model woken at every intraday window | about $1.26 | about $1.40 |

Further reductions to measure in T1b: order the prompt so the part shared by every book on an archetype comes first and is cached across books in the same sweep; send a smaller prompt at windows where only prices changed. Three added windows also load the engine's schedule and its untested per-window capacity.

## 8. When the agent reads what the player sends (proposed)

As V6.1 stands, the checks manage what is held and do not read new player input. New input is read only by the drafting call, which runs when a slot opens, once per slot per session. A SignalDrop at 09:00 is therefore not acted on at 11:00; with all three slots full it waits until one opens.

18. **Every drop gets a receipt at once, built by code.** Heard; where it stands (which slot, when that slot opens, or which window will consider it); and later what the agent did with it and why.
19. **Player input is read at the next intraday window.** Input about a held name goes to the manager at that window, which may act or decline with a reason. Input for an open slot is drafted at that window; the bound of one refill attempt per slot per session stays. Entry still needs reserved data coverage, so a name outside the shared price list may enter a session later. This widens what the manager reads (V6.1 §9) and goes to Astra with ruling 17.
20. **A running idea is never cut short to make room.** With full slots the receipt says when the next one opens. Input not considered within 10 sessions expires with that reason, as shared contract V2 already says for nominations.

## 9. Direction for the Huddle (for the DRB chat, with its S2 spec; not built from this chat)

21. **The Huddle is the one daily meeting where the games and the book are both on the table,** in three beats. *Report:* what the agent did in the book and why, what is due, how yesterday's plan graded. *Disagree:* one topic a day where the player and the agent differ, each stating what would prove them wrong. *Decide:* today's game plan, plus what the player offers the book.
22. **A disagreement that is not settled in talk becomes a nomination to the book,** with both positions recorded. Its result is written to the partnership record that stays with Shadow. Winning the argument never forces a trade, and agreement is never evidence. The agent's side must come from its stored reasons and positions, not from invented opposition.

## 10. Hand-offs

| What | Goes to | When | What that chat does with it |
|---|---|---|---|
| The §5 block | The ChatGPT chat that wrote the hybrid handoff | Now, pasted once | Nothing; no reply needed |
| This whole note | The Practice Field chat (owner of concept V6.1, shared contract V2 and T1a) | Now, attached once | Folds rulings 2–6, 10–15 and 17–20 into a V6.1 amendment and the contract; writes the Astra brief for rulings 17 and 19; adds the three accounting requirements of ruling 2 to T1a |
| §9 (rulings 21–22) | The DRB chat | When its S2 spec is started | Takes it as direction for the Huddle's S2 |

The T0a, T0b and T0c build prompts are unchanged by this note and can run as planned.

Rulings 1–9 adopted by founder: 13 Nov 2026
Rulings 10–12 adopted by founder: 13 Nov 2026
Rulings 13–15 and 17–22 adopted by founder: 13 Nov 2026 ("Yes to all of the rulings"). Ruling 16 withdrawn.