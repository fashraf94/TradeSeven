# Practice Field — concept V2

**Date:** 10 Oct 2026 · **Status:** concept, nothing to build yet · **Supersedes:** V1 (9 Oct) · **Rests on:** Growth Replay run `gr-20261008T181724` and its batch-check addendum

## 1. The problem

BaggerBomb is a game to win, and the agent's growth is supposed to come from playing it. The growth replay shows that play has produced almost no usable learning.

## 2. What the replay showed

- **Learning reaches decisions.** Removing what an agent learned changed its usual call on 29 of 280 moments, against about 2% from noise. A second run got the same 29.
- **There is almost none of it.** Every agent shares three learned paragraphs, and those say most post-game reflections failed to generate.
- **The one clear lesson is about the game.** After 20 battles the Trend Follower holds one discipline: the swap penalty is punishing, so hold.
- **Nobody knows if it helps.** The replay measures whether calls change, not whether they improve.

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
| Film Room | Review the week and pick its hard moments |

## 5. What training leaves you with: a playbook

- **Five slots.** Three are fixed situations every pair must answer. Two are open, for a signature play or a tie-breaker between your own rules.
- **A carry limit.** A sixth play means dropping one.
- **A counting limit.** One camp between battle weeks, about ten drills, one play at most. Replaying drills for fun does not count.

## 6. The three fixed situations (Flash, 10 Oct)

| Situation | Question | What needs a number |
|---|---|---|
| We are down | How do we catch up? | Down by how much, with how long left |
| We have a good lead | How do we preserve it? | Ahead by how much |
| Our stocks are not moving | How do we pivot to new ideas? | Flat for how long |

- **The first two are game plays.** They stay with BaggerBomb. Catching up by swinging bigger wins games and is a habit real trading punishes.
- **The third depends on scouting.** A pivot needs ideas waiting on the watchlist.

## 7. What a play is made of

| Part | What it is |
|---|---|
| Situation | When the play is live, as something the system can check |
| Call | What you do |
| Whose call | Agent alone, ask first, or the player's |
| Wrong if | The line that calls it off |
| Record | How it has gone in camp and on game day |

Plays come in three families: **technical** (what a chart setup means, and these can travel to future games), **allocation** (tiers and the bench), and **game-dynamic** (score, clock and swap penalty).

## 8. One camp

1. **The film.** The Film Room picks last week's hard moments for one situation. A new pair with no film uses league film.
2. **The drill.** Agent and player each make a blind call with a time window and a "wrong if" line. Then the reveal. Both calls, whether they agreed and who was right go on the record.
3. **The play.** After about ten drills the agent proposes at most one play. The player accepts, edits or rejects it.
4. **The proof.** The play is replayed on moments it has not seen, with and without it. It is kept only if calls change and the changed calls did better. The Agent Learning Charter still sets the bar.
5. **The install.** A kept play takes effect at the next week's open, so backed weeks stay frozen.

## 9. Where moments and ideas come from

- **Your own film (moments).** The main source.
- **League film (moments).** Hard moments from every battle, market situation only, never another player's rules or text.
- **Today's market (moments).** One blind call a day, settled at the close. The model cannot know the outcome.
- **Public research (ideas).** Books, published setups, news, filings. An idea enters through scouting and the camp tests it.
- **Setups already in the Forge (ideas).** The TradingView-style rules built in April are untested candidate plays. Two of them are equipped on the Trend Follower in the replay.
- **Past market days (moments).** The weakest source, because the model may know what happened.
- **No scraping of TradingView as a live source.** Its terms prohibit automated data collection. Players can bring their own setups.

## 10. Decisions for Flash

1. **What "did better" means.** Lean: both BaggerBomb points and plain price movement, with each play tagged game or trading.
2. **Who grows.** Lean: who-was-right-when-we-split goes to Shadow, trading plays go to the archetype, nothing crosses archetypes.
3. **One door.** Lean: battles and scrimmages supply moments, and a play enters the agent only through the proof in section 8.
4. **The limits.** Lean: five slots and one counting camp a week, as in section 5.
5. **Watchlist creation moves from the Forge to scouting (Flash's proposal).** Lean: yes, as a screen move decided inside the Command Center redesign. The idea records just built do not change.
6. **The numbers in section 6.**

## 11. Limits

- **Ten drills do not prove a play.** Each play shows its record and is dropped when game days go against it.
- **Some plays must be enforced.** "Whose call" and tie-breaker plays can be enforced by the system. Signature plays are prompt text and will be the weakest at first.
- **Cost.** Each ask costs one to two cents, and the proof asks about ten times per moment.
- **Small numbers.** The replay is founder and tester play. Real players may differ.
- **It has to be fun.** If a camp feels like homework, nobody generates the data.

## 12. Order

1. Finish the record slice now in progress.
2. Score the 29 changed moments against what happened next. It needs no model spend.
3. Confirm the archetype carry-over from V1 section 2, and whether reflections still fail to generate.
4. Then a read-only discovery for the practice field.
