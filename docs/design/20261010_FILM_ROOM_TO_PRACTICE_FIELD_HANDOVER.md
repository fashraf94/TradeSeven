# From the Film Room chat to the Agent training game chat: what the tape gives the Practice Field

**Date:** 2026-10-10 · **From:** the Film Room chat (Fable) · **For:** the Practice Field concept V2 and its discovery
**Status of the Film Room:** the new screen (Glance, Study, Deep dive) went live on 2026-10-09 for allowlisted owners only. A tape has been written for every battle day since 2026-10-01, and some earlier days from late September were backfilled.

## 1. What the tape records

Each battle day has one owner-only document, `agentBattles/{id}/tape/{etDate}`, plus one price series per symbol. Every number carries a class: **recorded** (written at the time), **derived** (computed from recorded values), **rebuilt** (recomputed from 1-minute bars at the check times) or **market** (EODHD bars).

| Section | What it holds | Why the Practice Field cares |
|---|---|---|
| Checks (about every 15 minutes) | The check's state (completed HOLD or SWAP, plan created, plan pending · awaiting approval, no trigger, or no usable model result, in which case the system held by default); the decision; risk decisions per holding; the recorded score; **evidence stamps**, meaning the quote the agent saw and when it saw it | Every decision point with what was known at that moment. The quotes run 15–20 minutes behind the market. |
| Swaps | Who made the exit (agent, platform rule, gameplan or unrecorded) and the rule (e.g. stagnation); the slot; banked points; a **replay**: the hold path against the swap path to the close, the gap, and the banked result split into scoring inputs versus price (the delayed-quote effect) | A deterministic, no-model scorer for "swap or hold". |
| Plans | Symbol, potential entry or exit, the agent's signal and threshold in its own words, the price at the plan and at the close | The ideas that were waiting on the bench, priced. |
| Rationale | The agent's hypothesis and reasoning at each check, verbatim | Predictions with deadlines ("within the next 2 hours"), written as free text. |
| Directives | The player's words, the filed directive, the agent's reply, and a receipt ("reached the agent's inputs at the next check") | Who asked for what, and when. |
| Series (per symbol) | 10-minute bars for the session (open, high, low, close, volume), the session open, and samples at each check. It covers holdings, swap-ins **and plan symbols**, plus SPY and the sector ETF as comparables | Settling calls against what happened. Relative strength against index and sector. |
| Coverage | Complete, partial or unavailable for each section, with the reason | Drills can refuse days with holes. |

**Not on the tape, as far as the Film Room chat knows (please verify in discovery):**
- **The opponent's score at each check.** The tape records our side's score at every check; the opponent's appears only in the final result. Without it the counter can't find "We are down" or "We have a good lead" moments.
- **Proposals the player declined or let expire,** with their symbols. The tape shows plans sitting "awaiting approval" but may not keep what was declined.
- **Structured predictions.** Hypotheses are prose, with no separate fields for the call, the window and the "wrong if" line.

## 2. One real day, read against V2's situations and partner qualities

On **Oct 9** (Trend Follower, one trading session, finished at +120):
- **"Our stocks are not moving" (situation 3) happened, and the platform pivoted before the agent did.** At 9:46 the agent's plans named ACN as its weak slot and AFRM and SHOP as replacements. AFRM went from 77.82 to 80.69 by the close, and SHOP from 167.06 to 170.87. The agent never swapped. At 3:01 the platform's stagnation rule forced ACN out into HUM. The replay shows holding ACN would have been +2 and HUM finished −12, a 14-point gap. About half of the −6 banked on the sale was the delayed quote.
- **Believable?** At 12:31 the agent predicted ZS would reach its target "within the next 2 hours." ZS went mostly sideways in that window and made its move after 2:30: right direction, late. At 12:16 it credited "Tech momentum," but the sector ETF (XLK) stayed below its open all day while ZS rose 5.6%: right pick, wrong reason. Its 12:16 rationale also gives ZS's target as +5.3%, while the plan from the same check says ZS was at +5.29% with a +7.3% target.
- **Whose call?** A plan sat "awaiting approval" for seven checks (10:16–11:46). The stagnation swap was a platform rule overriding both partners.

**The point:** game-day tapes can already measure all three partner qualities from V2 §3:
- **Predictable:** what it planned against what it did.
- **Believable:** each prediction with a deadline against the bars.
- **Knows whose call it is:** plans awaiting approval, directives and their receipts, and rule overrides.

The Film Room is where those qualities are measured. The Practice Field is where they get trained.

## 3. Doors for the Practice Field

1. **Drills with no hindsight, from your own film.** Every check freezes what the agent saw: the evidence stamps, plus bars up to that time. Stop the clock at 12:16 on Oct 9, show only what was known, collect both blind calls, then reveal the real afternoon.
   - Your own film is after the model's training cutoff, so the model can't know the outcome.
   - Decide whether a drill shows the true bars up to the check or what the agent actually saw (quotes 15–20 minutes old). The tape has both.
2. **Free scoring for swap-or-hold calls.** The replay engine scores a swap against holding from 1-minute bars, in points and in price, with no model spend. That covers V2 §10 decision 1, "did better": both currencies are already in the tape's number classes. Its limits:
   - It replays one step to the close; later trades in the slot are not replayed.
   - It can only score symbols whose bars the tape holds (holdings, swap-ins, plan symbols, comparables).
   - Crypto legs get no replay.
3. **A game-day prediction record before any camp exists.** Every hypothesis with a deadline is a drill the agent already took. Counting them gives the "when it says it's sure, it's usually right" record from real games. It becomes far cheaper if predictions are stored as fields (call, window, wrong-if) rather than prose. That change is in the decide path, a fenced file, so it's a framework-arc item.
4. **Who was right when you split, from real games.** If declined or expired proposals are on the tape with their symbols, the same replay engine scores them. That record is what V2 §3 says a partner should use to push back "where you have been wrong before."
5. **League film, cleanly.** Tapes are owner-read only and must stay that way. League film needs a server-side extract that keeps the market situation and the numbers. It must drop every field holding someone's words: rationale, hypothesis, plan signal and threshold, the player's text, filed and retained directive text, agent replies, and completion messages. The Film Room already treats exactly those as one list.
6. **Settling "today's market" calls.** The candle pass already fetches the session's 1-minute bars and settles at the close. A daily blind call can be settled by the same pass instead of new plumbing.

## 4. On the overlap question: the Film Room chat's position

**Agreed:**
- The card nominates.
- The play is what survives camp.
- One counter serves both.

**Four refinements:**

1. **One situation registry, not just one counter.** The counter, the Film Room's question menu, camp's moment picker, a play's "Situation" field and its game-day "Record" should all read one set of system-checkable definitions. Two details:
   - "Flat for how long" should use the **platform's stagnation definition**, or be checked against it. On Oct 9 the rule beat the agent to the pivot, so a pivot play that ignores the rule will lose the race.
   - "Down/lead by how much" needs the opponent's per-check score (see the gap in §1).
2. **The Film Room lists; the player picks.** The Film Room can't call a moment "hard" because it never judges. It lists the moments where a situation was live, ordered by a stated, neutral measure, such as time spent in the situation or the size of the replay gap. The player's pick is the card. That keeps V2's "the Film Room picks the hard moments" without giving the Film Room a verdict voice.
3. **A card stands on its own before camp exists.** The Film Room's card build comes before the Practice Field. A card is a moment, a question from the menu, and the player's own note in their own words. It has three routes:
   - **Watch:** the counter reports when the situation happens again, and the card can be shown to the player during the next game.
   - **Drill:** nominate it for camp, once camp exists.
   - **Set:** the player changes an existing setting themselves.
4. **One door, strictly.** No card reaches the agent's prompt; only a play that passed the proof does. The growth replay found that text in the prompt changes calls without showing they improve, which is the case for keeping unproven cards out. The Film Room chat's earlier design had a "Watch" card enter the next deployment through the idea records. Under one door, that route closes. **Decision for Flash.**

With those, the chain is: tape → counter (one registry) → card (the player's pick) → camp → play (passed the proof) → game-day record. **One ledger** holds the card and the play as stages of the same entry, so a play's record starts with the film that nominated it.

## 5. Constraints the Practice Field inherits

- **Owner-only access.** Tape rules are never relaxed for league use; extract server-side instead.
- **A hindsight rule.** The Film Room removed session high and low from its facts because they're known only afterwards. Drills need the same discipline.
- **Delayed quotes.** The agent decides on quotes 15–20 minutes old, so a play triggered at a price level fires late. A play's "Situation" must be checkable on what the agent sees at the moment it decides.
- **A 10-session window.** The candle pass can build a day's bars only within 10 sessions. A day that misses the window stays without bars, so drills must check coverage.
- **A short library.** Tapes exist only from late September onward, so league film is thin at first.
- **Classes on everything.** A play's record should keep the number classes, so it shows which results were recorded and which were rebuilt.

## 6. Questions to check against the discovery report

1. Is the opponent's score at each check stored anywhere: battle evaluations, status-feed context or cockpit call records? If so, can the tape writer copy it as a recorded field?
2. Are declined or expired proposals stored with their symbols and times?
3. Does the stagnation rule's definition live in one place the counter can import?
4. Is there a server-side path for a de-identified league-moments extract that never touches the tape's owner-only rules?
5. Which existing pieces can host the shared situation registry and the one ledger: the hypothesis or idea records, or something new?

**Proposed next step:** once your discovery report lands, the two chats write one shared contract covering the situation registry, the counter, the card-to-play ledger and the one-door rule. The Film Room's card build and the Practice Field both build from it, so nothing gets built twice.
