# Practice Field — concept V3

**Date:** 14 Oct 2026 · **Status:** adopted by founder (rulings of 10 and 14 Oct 2026) · **Supersedes:** V2 (10 Oct) · **Rests on:** the growth replay (8 Oct), the Practice Field discovery and Addendum A (10 Oct), ruling sheet V1.1 (10 Oct), the shared contract V1 (10 Oct), the reflection outage fixes (PRs #953 and #960), and the changed-moments score (14 Oct, PR #965)

## 0. What changed since V2

- **Proof means fidelity and no harm.** "Did it make money" is a running record on the play, not a gate (14 Oct).
- **Points are the only measure inside BaggerBomb.** Price is kept only for plays tagged as trading plays (14 Oct).
- **The agent's drill call is a vote of five asks,** shown as its confidence (14 Oct).
- **The reveal shows the swap tax** as its own number (14 Oct).
- **From the 10 Oct rulings:** the first camp is "our stocks are not moving"; the Film Room lists the moments and the player picks; a play is assembled from menus, never written from a blank page; on the player's own film only the agent's call counts; plays and learning stay with the archetype they were earned on; one door.
- **The score may be told to the agent on request,** through a button per situation in the cockpit (10 Oct).
- **Contract V1, sections 6 and 7, are superseded by sections 8 and 9 here** for the Practice Field builds. The Film Room's sections 1 to 5 are unchanged, and nothing goes back to that chat.

## 1. The problem

BaggerBomb is a game to win, and the agent's growth was supposed to come from playing it. The evidence below shows that play has produced almost no usable learning, and that what it produced cannot be shown to help.

## 2. What the evidence shows

- **Learning reaches decisions.** Removing an agent's learned paragraph changed its usual call on 29 of 280 moments, against about 2% from noise.
- **The learning was an outage.** 72 of 87 post-game reflections were the line written when the reflection call failed, and the wisdom paragraphs were built from those lines. Fixed on 11 and 14 Oct; the paragraphs are reset the weekend of 17 Oct.
- **Those paragraphs did not help or hurt.** Scored against what the market did next, the learned call did better on 11 moments, worse on 12, tied on 5.
- **The swap tax.** In every cut, the agent's swaps lost to holding more often than they won. On the 20 trades the agent made with or without learning, 7 won and 13 lost. Not statistically firm, and one market window, but the same lean everywhere. A swap banks at a quote 15 to 20 minutes old and the new stock starts with no badge history.
- **The agent's own noise.** Asked the same question ten times, it disagrees with itself about 6% of the time. About 5 of the 29 changes were noise.
- **Small samples prove nothing.** 28 moments can only show a large effect. Ten drills cannot show whether a play makes money.

## 3. What a better partner is

- **You can predict it.** You know what it will do before it does it.
- **You can believe it.** When it says it is sure, it is usually right.
- **It knows whose call it is.** It acts alone where it has earned that, asks where you are the better judge, and pushes back where you have been wrong before.

## 4. Five places, five jobs

| Place | Job |
|---|---|
| Scouting | Research ideas and build the watchlist |
| Practice field | Turn hard moments into plays |
| Game day (BaggerBomb PvP, backed weeks) | Prove what the pair can do |
| Scrimmage (BaggerBomb vs CPU) | Practice the game at no risk, and say so on the label |
| Film Room | Review the week and list its moments |

## 5. What training leaves you with: a playbook

- **Five slots.** Three are fixed situations every pair must answer. Two are open, for a signature play or a tie-breaker between the player's own rules.
- **A carry limit.** A sixth play means dropping one.
- **A counting limit.** One camp between battle weeks, about ten drills, one play at most. Replaying drills for fun does not count.

## 6. The three fixed situations

| Situation | Question | State |
|---|---|---|
| Our stocks are not moving (`stalled`) | How do we pivot? | First camp. Live when a holding is within 2 checks of the platform's own stagnation rule firing (slot S1). |
| We are down (`down`) | How do we catch up? | Reserved. Needs the opponent's score at each check (built with the Film Room's B1) and a threshold (slot S6). |
| We have a good lead (`good_lead`) | How do we preserve it? | Reserved. Same, slot S7. |

- **The player can call `down` and `good_lead`** from a cockpit button. At its next check the agent sees the gap and comes back with picks for the player to choose from. Built after the first camp.
- **The first two are game plays** and stay with BaggerBomb. The third depends on scouting: a pivot needs ideas waiting on the watchlist, and it has to clear the swap tax.

## 7. What a play is made of

| Part | What it is |
|---|---|
| Situation | When the play is live, from the one situation list every screen reads |
| Call | What you do |
| Whose call | Agent alone, ask first, or the player's. "Ask first" is not offered until the cockpit can honour it |
| Wrong if | The line that calls it off |
| Record | Followed or not, and helped, hurt or tied, in counts, from camp and from game days |

- **Menus, not blank pages.** Every part is chosen from a short menu the camp builds from the drills, and the agent explains each choice in plain words with the drill numbers beside it.
- **Families:** technical (a chart setup; may travel to other games), allocation (tiers and the bench), game-dynamic (score, clock and the swap tax).
- **In V1 a play installs only through controls that already exist:** a lean, a rule setting or a dial. Plays that need prompt text wait for a later founder-gated build.

## 8. One camp

1. **The film.** The Film Room lists last week's moments in the situation, ordered by time spent in it, longest first. The player picks one. A day with missing bars is listed as unavailable and a drill refuses it. Nothing known only afterwards is shown.
2. **The drill.** The agent's call is a vote: the stored request for that check is re-sent unchanged to the production model five times, on the drills' own key, and the split is shown ("would swap 4 of 5"). That split is the agent's confidence. The player makes a call too. On the player's own film the player's call is recorded but not counted. Only checks from the last 120 days can be asked.
3. **The reveal.** Hold against swap, in points, to that day's close. The swap tax is shown as its own number: what the sale banked at the delayed quote and what the badge history was worth, separate from what the new stock did. The quote delay is stated. A crypto leg or a missing bar reads "not scored".
4. **The play.** After about ten drills the agent proposes at most one play, and the player assembles it from the menus.
5. **The proof.** Two parts, on moments the pair has not seen:
   - **Fidelity.** With the play inserted, the agent's vote moves the way the play says when its situation is live, and does not move when it is not. About 20 unseen moments at five asks each, roughly $2 to $3 on the production model.
   - **No harm.** On those moments, following the play does not lose to holding more often than the agent's own swaps already do.
   - A play that passes is installed. A play that fails is kept on the shelf with its result.
6. **The install.** Through existing controls, taking effect at the next battle's creation. Backed weeks stay frozen.
7. **The record.** On game days: followed or not, helped, hurt or tied, in counts. It is shown on the play. A play is retired when its game-day record goes against it (the number is slot S9).

## 9. Measures and honesty rules

- **Points only inside BaggerBomb.** Points are about ten times the price move, so price adds nothing. Price is kept for plays tagged as trading plays.
- **Counts, not sums.** Tier multipliers make a few moments dominate any sum.
- **A tie is within 1 point.**
- **Every number carries its class** (recorded, derived, rebuilt, market). The camp may say who was closer; the tape never does.
- **One door.** No card, drill, draft or unproven play reaches any model prompt. The player's own instructions keep the doors they have.
- **Same bar.** The Agent Learning Charter still governs anything that claims to improve trading.

## 10. Where moments and ideas come from

- **Your own film.** The main source. Moments are replayable to the agent for 120 days.
- **League film.** Moments from every battle, market situation only, as a filtered view with every person's and agent's words dropped. Later milestone.
- **Today's market.** One blind call a day, settled at the close by the candle pass. Later milestone.
- **Public research and the setups already in the Forge.** Ideas enter through scouting and the camp tests them. No scraping of TradingView.
- **Past market days.** The weakest source, because the model may know what happened.

## 11. Limits

- **Ten drills prove fidelity, not profit.** Profit is the running record, over weeks.
- **The swap tax may be the game, not the agent.** If trading is mostly a losing move in BaggerBomb as scored today, that is the scoring's economics. It bears on the points-versus-cash question and is not a Practice Field decision.
- **Noise.** One ask can differ from the production call by chance. That is why the drill votes.
- **Cost.** About two cents an ask; a drill about ten cents; a proof two to three dollars.
- **Small numbers.** Everything so far is founder and tester play.
- **It has to be fun.** If a camp feels like homework, nobody generates the data.

## 12. Still open

- **Slots:** S1 (2 checks), S2 (6 checks at 0.30% for an archetype with the rule off), S3 (10 drills), S4 (1 camp a week), S5 (5 slots), S6 to S8 (`down` and `good_lead` thresholds), S9 (retirement).
- **The wisdom paragraph and the trading brain.** The rewrite keeps running under its floor of 3 real lessons. Whether its paragraph should keep reaching the trading brain is decided when the first real paragraph is about to be written, which the shadow line will show. Lean: leave it until the first play is installed, then cut it over.
- **A separate API key and spending limit for drills** (Flash, in the Console).
- **Moving watchlist creation out of the Forge** (the Command Center redesign decides it).
- **Whether archetypes can ever share plays or learning.**

## 13. Order of work

1. Reset the failure-built paragraphs, the weekend of 17 Oct.
2. Archetype carry-over: shelve on change, restore on return.
3. The Film Room's B1 and B2 from the shared contract.
4. The first camp: the drill, the vote, the reveal with the swap tax, the menus, on top of B2.
5. The proof build, then the install.
6. `down` and `good_lead` with the cockpit button; league film; today's market.
