# Ruling sheet — BaggerBomb trader game, after the discovery

**Date:** 15 Nov 2026, revised the same evening · **Author:** Fable (the BaggerBomb revamp chat) · **Status:** proposed, approve by default. Answer "yes to all" or name the numbers · **Basis:** `docs/audits/20261115_PHASE0_BAGGERBOMB_TRADER_GAME.md` (draft PR #1070, head `d770cd20`) and the direction note "BaggerBomb as the trading game" (BB-1 to BB-22, adopted 15 Nov)
**Revision:** folds the cockpit chat's six recommendations of 15 Nov (§3), with two changes from Fable.
**Destination:** this project. It enters the repo with the first build it governs. No docs-only PR. On the founder's yes, the direction note is updated: BB-3, BB-7 and BB-21 amended, BB-23 added, §4 corrected.

## 1. What the discovery changed

No ruling in the direction note is contradicted as a goal. Three launch pieces are larger than the note's §5 estimated, and one cannot be used yet:

- **Battle length.** The note said "the multi-day engine exists". It is switched off and breaks at the first night, and the approved thresholds are pinned to one day.
- **Stops and targets.** No position has ever carried a level. The model returns none, every exit needs a replacement, and a stop does not run on a quiet check.
- **Bank on exit.** About 30 prompt lines and 15 readers assume bank on touch, and the lock near a bonus exists to protect it.
- **Agent vs Agent.** Three accounts played in the last 30 days. Pairing at the open will usually find nobody until the beta cohort exists.

## 2. New rulings

- **R-A. One new scoring version, "trader v1", carries BB-3 to BB-8 and BB-13.** It is built beside today's scoring and chosen per battle by a stamp, as the measured thresholds were. Battles without the stamp keep today's rules untouched. It builds on the measured path (per-position records, an exit refused without a dated quote), not the legacy path.
- **R-B. The stamp comes first.** Today any second stamp value makes a battle unscoreable. The first build lets two versions coexist and changes no battle's score.
- **R-C. Trader v1 battles hold stocks only at launch.** The crypto slot becomes a third Support stock. Crypto always scores on the legacy path, ends the battle at 8:00 PM with the evening unscored, and would let paired books end at different times.
- **R-D. Agent vs Agent uses two battle records that reference each other.** No rule change, the evaluator's loop is unchanged, and nothing private is exposed. The opponent's board comes from a server-built view with a fixed list of fields.
- **R-E. Agent vs Agent is built last in the launch set and switched on when the beta cohort exists.** Until then it is tested founder against FT_QA.
- **R-F. A security fix pack runs now, as its own small task:** the league view (a membership check, no full record at completion, no account ids), the unused `set-opponent` endpoint, and the update rule on the old `battles` collection.
- **R-G. Trader v1 pilots on the founder and FT_QA accounts** before any wider switch, as the measured thresholds did.

## 3. The cockpit chat's recommendations (15 Nov 2026)

| # | Recommendation | Fable | Becomes |
|---|---|---|---|
| C-1 | One ranked length at launch: 3 trading days, for Agent vs Agent. The one-day game stays as Agent vs CPU practice only. The 5-day format comes after launch. | Agree, with one change: **the one-day practice game also runs trader v1.** Practice on today's scoring would teach a game the ranked one no longer plays. It also reuses the approved one-day threshold policy, so only a 3-day policy is new. An unpaired 3-day agent plays the CPU, and that result counts as practice (BB-16). | BB-3 amended |
| C-2 | The close tasks (hold overnight, flatten) join the cockpit's launch set, beside the dials and the open-trade tasks. | Agree. In a 3-day battle the overnight decision is real every evening. | BB-21 amended |
| C-3 | Where stop and target prices come from is decided in the capacity lane's market-data plan. Stops are designed around "the shared price". Every battle gets its stop check every round, whether or not the model is called. | Agree. Trader v1 reads prices through one seam that returns today's evaluator quote with its time, and switches to the shared price when it lands. Building does not wait on the plan. | BB-7 amended |
| C-4 | Opening the beta to 25 players waits on the capacity lane's work (parallel battles, the market-data plan). Building does not wait on it. | Agree. | BB-21 amended |
| C-5 | Cost correction: measured, the trading agent calls the model about 20 times per battle-day at about 2.5 cents each on Haiku 4.5. About $0.50 per player per trading day, about $10 a month per player always in a battle, about $250 a month at 25 players. | Agree. The measured figure replaces the direction note's assumed one, which was six times lower. | Direction note §4 corrected |
| C-6 | New BB-23, measured before adopted: with code running stops and targets, the agent's scheduled check moves from every 15 minutes to every 30, plus event checks (a fill, a big move, a cockpit command). The BB-14 replay measures whether decisions get worse. | Agree with the ruling; **change the measurement.** The BB-14 rescore makes no model call, so it cannot tell whether decisions get worse. BB-23 gets its own measurement from stored checks, also with no model call: for every action the model took at a check a 30-minute schedule would skip, whether an event check would have caught it, and the price cost of acting 15 minutes later. A model replay follows only if that result is unclear. | BB-23, measured before adopted |

## 4. Answers to the discovery's 31 questions

Rows changed by §3 are marked †.

### The league (BB-1)

| # | Question | Recommended answer |
|---|---|---|
| 1 | What the one flag closes | A new flag, read by the client doors and the entry endpoints only. Jobs untouched. |
| 2 | Ranked rows in the hub | Keep as history. |
| 3 | The League loadout card | Hide it. The BaggerBomb card is the one loadout. If the build finds the main agent can only be edited through the League card, it stops and reports. |
| 4 | Training pods | Close with the league. None is running. |
| 5 | The nav slot | Label "BaggerBomb", a bomb icon. Yours to change. |
| 6 | Housekeeping | Yes: remove the Season banner and close the three web-address doors in the same change. |

### Battle length (BB-3)

| # | Question | Recommended answer |
|---|---|---|
| 7† | Thresholds over several days | The 3-day game counts from entry with a unit scaled to three days. A one-day unit over three days is crossed far more often. The one-day game keeps today's unit. |
| 8† | Measured thresholds | Approve one new policy version, for the 3-day game, before it runs. The policy task chooses the unit by measurement on history, as V2 did. The one-day game keeps V2. |
| 9 | Budgets | Commands per day (number set in the cockpit design round, BB-19). Chat 10 per day, the league's existing rule. Review chat stays 5 per battle. |
| 10† | League battles | Moot while the league is hidden. Length is set per mode: one day for practice, three for ranked. |
| 11† | Start and end | Practice keeps today's late-start rule. A ranked battle starts at the next open, where pairing happens. Trader v1 ends at the 4:00 PM close (R-C). |
| 12 | One battle per agent | Intended for launch. More than one is a later, premium candidate. |

### Stops and targets (BB-7)

| # | Question | Recommended answer |
|---|---|---|
| 13 | Sale to cash or swap | Sale to cash. The exit always happens; the slot holds its cash until the agent enters a replacement. |
| 14 | Who declares the levels | The model, at deploy and on its own swaps (two new number fields, held inside the archetype's range). Code sets them from the stock's volatility unit and the archetype's range everywhere else, and whenever the model's are missing or out of range. |
| 15 | What stays beside the declared stop | Retired for trader v1: bust avoidance, the battle-wide percentage, the lock near a bonus, the one-exit-per-check limit for stop and target exits. Kept: stagnation rotation and the model's own swaps. |
| 16† | Which quote counts as observed | Read through one seam (C-3): today the evaluator's own quote, with its time shown on the fill; the shared price when the capacity lane's plan lands. |

### Bank on exit (BB-8)

| # | Question | Recommended answer |
|---|---|---|
| 17 | End of the battle | Counts as an exit at the last scored price. |
| 18 | Wait for per-position stops | BB-7 and BB-8 ship together in trader v1. |
| 19 | The phone's own live score | Trader v1 has one authority, the server. Legacy battles are left as they are. |

### Rescoring (BB-14)

| # | Question | Recommended answer |
|---|---|---|
| 20 | May a script hand the real scorer a reset touch record | Yes. It edits nothing and has a precedent in the changed-moments experiment. |
| 21 | Scope | The exit rule only, on the 43 complete battles. |

### Version stamp and the trader's line (BB-13, BB-11)

| # | Question | Recommended answer |
|---|---|---|
| 22 | Which win rate | Trades won: closed positions with a gain, counting a position held to the end as closed at the last price. Battles won stays as the agent's record. |
| 23 | Past battles | No stamp keeps meaning the old rules. No backfill. |

### Agent vs Agent (BB-15, BB-16)

| # | Question | Recommended answer |
|---|---|---|
| 24 | Rank of what | A separate Agent vs Agent record on the agent. A rating comes later. |
| 25† | A deploy at 11 AM | The player picks the game at deploy. **Ranked:** three days, starts at the next open, paired then; unpaired plays the CPU as practice. **Practice:** one day against the CPU, starts now under today's late-start rule. |
| 26 | What an opponent sees | During the match: positions, score and closed trades. Chat, instructions, the list and reasoning: never at launch. |
| 27 | Same stock | Allowed. |
| 28 | Existing CPU records | Kept as the practice record. A practice game still counts toward games played and the level. |
| 29 | What the trading model learns of its opponent | Nothing new. Only the chat voice sees the score gap, as today. |

### Match cash (BB-4 to BB-6)

| # | Question | Recommended answer |
|---|---|---|
| 30 | Fixed slots or reinvested proceeds | Fixed slots: $200,000, $150,000, $100,000. |
| 31 | Flat bonuses | Stay as points. |

## 5. Cost (measured, from the cockpit chat)

The trading agent only. Chat, reflection, the daily review and the Huddle are extra.

| | Per player per trading day | Per month, always in a battle | 25 players |
|---|---|---|---|
| Today's 15-minute schedule | about $0.50 | about $10 | about $250 |
| BB-23: 30 minutes plus event checks | measured by the BB-23 task | | |

A 3-day battle does not change the cost per day. Stops, targets, cash and Agent vs Agent add no model calls.

## 6. Order of work

| Step | What | Who builds | Fable |
|---|---|---|---|
| 1 | Hide the league, BaggerBomb page (questions 1–6) | Sonnet with an Opus advisor | — |
| 1 | Security fix pack (R-F) | Opus | — |
| 1 | Replay pack: the BB-14 rescore and the BB-23 measurement, both from exported battles, no model calls | Opus, local | Reads the results here |
| 2 | The stamp: two scoring versions coexist (R-B) | Opus | Reviews |
| 2 | Threshold policy for the 3-day game (questions 7–8) | A measurement task, then your approval | Writes the task, reads the result |
| 3 | Trader v1, in three builds: length (one and three days); stops, targets, cash and the stop check every round through the price seam; bank on exit with the prompt rewrite. BB-23's schedule rides the second build if adopted. | Opus | Writes each spec, reviews each build; Astra reviews the spec |
| 4 | Readers: the board, score breakdown, Film Room, hub, the trader's line, cash sizes | Sonnet with an Opus advisor | — |
| 5 | Agent vs Agent (R-D, R-E) | Opus | Reviews |
| 6 | Cockpit tasks (dials, open trade, close), one reward track | Per their own design rounds | Cumulative review before the switch |

Step 1's three tasks run in parallel now. Step 2's two tasks run in parallel. The stops build in step 3 waits on the capacity lane's Build 1 merging, since both edit the evaluator. Opening to 25 players waits on the capacity lane (C-4).

Time: 9–12 weeks in series, 6–8 in two lanes. Dropping the 5-day format saves little; the close tasks add a little.

## 7. Left for later, recorded

- The 5-day format, after launch.
- The old human-battle jobs still run nightly against 76 stale records. A cleanup task after the hide.
- Season mode is scrapped but still wired. Same cleanup.
- The legacy executor can fill an exit at the entry price when a quote is missing, and accepts yesterday's close. Trader v1 does not use it.
- No cancel or forfeit exists. A 3-day battle holds an agent for three days. A forfeit is a candidate once multi-day is live.
- The discovery ran on Fable 5.2, not Opus as the prompt named.
