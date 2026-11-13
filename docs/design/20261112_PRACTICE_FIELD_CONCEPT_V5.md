# Practice Field — concept V5: the test portfolio loop

**Date:** 12 Nov 2026 · **Author:** the Practice Field chat (Fable) · **Status:** awaiting the founder's rulings in §11 · **Supersedes on adoption:** concept V3 (14 Oct) and Amendment A (21 Oct). The V4 draft of 11 Nov was withdrawn before adoption and was never sent anywhere.
**Rests on:** the founder's loop (12 Nov), the test portfolio audit (`docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md`, branch `claude/practice-field-test-portfolio-phase0`, HEAD `1e041a0`), V3 and Amendment A, the architecture chat's design revision (11 Nov), the KB focus brief (9 Nov), Growth Loop Map V1.2.
**Scope:** design only. It authorises no build. Each build keeps its own task and prompt.
**Destination:** `docs/design/20261112_PRACTICE_FIELD_CONCEPT_V5.md`, carried by the P0 build's commit together with the audit report. No docs-only PR.

## 0. What changed

- **The Practice Field is a test portfolio, not a drill camp.** A player opens it and sees a paper-money portfolio running a test, with live prices, the gap to its twin and the agent's notes.
- **The loop is the product.** Game → Film Room finds the item → Practice Field tests it → Forge applies the result. Every piece hands something to the next.
- **It is built on the Mandate engine,** which the audit found complete and switched on with no book ever created. Season Mode is dead and stays dead.
- **One test at a time.** More becomes a premium feature later.
- **Drills become optional and later.** "Chase or hold" survives as a side activity.
- **The agent's reasoning is kept.** The engine already makes it write two to five sentences per decision and throws them away. Stored, they are the running notes.

## 1. The loop

| Stage | What happens | Owner | State on `main`, 12 Nov |
|---|---|---|---|
| Game | BaggerBomb, as today | Cockpit | Live |
| Film Room | Shows what went wrong and a likely why. Ends in an **item**: a card the player sends to test | Film Room | Cards built, allowlist only, none in production yet. No "send to test" |
| Practice Field | Opens as the **test portfolio**: the item's stocks, live prices, paper money, the gap to the twin, the agent's notes. One test at a time | Practice Field | No screen. The engine exists (the Mandate), never run |
| Result | When the test ends: ahead or behind the twin after costs, the worst drop, trades made, the agent's closing note. Labelled as one test | Practice Field | Risk scores exist; no result record |
| Forge | The result arrives as an **offer**: equip the idea and its list, set a control, or (rarely) a new rule version. The player confirms or declines | Forge | Equip endpoints exist; no offer |

## 2. What a test is

| Part | V1 | Later |
|---|---|---|
| **Item** | A Film Room card (Drill or Watch), or an idea record (a list with a horizon), or a subject the founder enters by hand | The agent proposes items of its own |
| **Subject** | A single stock, a sector or an industry, from stocks the shared price list carries; a theme from the seeded lists | A catalyst (earnings, an event). Needs an event record the platform does not have |
| **Twin** | A benchmark that starts with the same paper money at the same instant: SPY, or the sector fund when the subject is a sector or industry. Benchmark prices are already collected | "The agent as it is today": a second book whose manager carries the player's equipped list, leans and rules |
| **Paper money** | $100,000 per test (decision 6) | — |
| **Length** | 10, 30 or 60 sessions, fixed before the start. Default 10 | — |
| **Headline** | Chosen before the start: *ahead of the twin* (default) or *protected better than the twin* (a smaller worst drop) | *Calls that checked out*, for research tests that need no trades |
| **Manager** | The agent, through the engine's model call: two checks a day, one action each, paper fills at delayed quotes with modelled costs. The player watches and cannot trade the test | Rule-managed books for coded-rule tests, one note a day |
| **Notes** | The agent's written reason on every decision, stored and shown with its time | — |
| **Backstory** | For a Trend Follower: each stock's setup verdict as of the last close (valid, invalid or unknown) on day one | Other archetypes, as their rule sets exist |

## 3. What the player sees

- **The portfolio.** Value today, the gap to the twin in dollars and percent, the stocks held with their moves, cash, and days left. The gap is the number worth checking.
- **The notes.** The agent's latest reason, with earlier ones below. Quoted as its recorded words, never rewritten.
- **The chart.** Test against twin from the same start (the Season Mode chart, reused).
- **The result.** On the last day: the headline, the worst drop, trades and costs, the agent's closing note, and the honest label. Then the Forge offer.
- **The record.** Past tests of the same item: "ahead in 3 of 4 tests".
- **The limit.** One test running. Sending a second item queues it.

## 4. Honesty rules

- **One test is one observation.** The result reads "ahead of SPY by $1,240 after costs in this test", never "proven". Repeats build the record.
- **The twin keeps it honest.** Both start with the same money at the same instant and see the same prices. A rising market lifts both.
- **Costs are real-ish and said so.** Fills use a quote up to about 30 minutes old plus the vendor's delay, with modelled trading costs. The screen says "paper fills at delayed quotes".
- **Size with counts.** The worst drop and the costs are shown beside the gap.
- **The gap is computed from the rounded values the player sees.**
- **Unknown is a result.** A missing price pauses marking and says so; a stock the data does not cover reads unknown.
- **Market and game stay apart.** A test measures market results in dollars. It says nothing about BaggerBomb points.
- **Test notes never reach a battle prompt.** Only the Forge changes the agent, and only when the player confirms.
- **A test cannot be stopped early for a good day.** It ends at its length. A player may abandon one; that is recorded as abandoned, not as a result.

## 5. Hand-offs

**Film Room → test.** A Drill card is already "nominated for the Practice Field". A new card operation, *send to test*, moves a Drill or Watch card from `card` or `nominated` to `testing`, and the test is keyed on the card's entry. When the test ends, the card moves to `tested` with the result. Set cards stay a Forge control as today. The ledger's reserved stages `drilled → drafted → proven` are replaced by `testing → tested`; `installed` and `retired` stay. That is shared contract V2 (decision 16).

**Test → Forge.** The result shows in the Forge as an offer, never an automatic change. The offers use writers that exist:

| Offer | Writer | Takes effect |
|---|---|---|
| Equip the idea and its list for battles | the watchlist and idea endpoints | next battle |
| Set a lean, the tempo dial or a rule setting | the equip-lean, tempo-dial and equip-bundle endpoints | next battle |
| A new rule version | none for players; a founder PR under the fence | by the archetype arc's install route |
| Retire the item | the card ledger | at once |

**Backed weeks stay frozen.** Nothing applied from a test changes a battle already running.

## 6. What exists and what is missing

| Piece | Status |
|---|---|
| Paper book, fills with costs, splits and dividends, daily close and rows, risk scores | Exists (the Mandate, 58 files, switched on, no book ever created) |
| One shared price snapshot for every book | Exists. The twin property comes free |
| Benchmark prices (SPY, QQQ, DIA, IWM, the sector funds) | Collected already by two other jobs. No dated daily series kept |
| The agent's written reason per decision | Produced on every call, then discarded |
| Idea record with a list, a horizon and a review against SPY | Exists, allowlist only |
| Film Room cards | Built, allowlist only, none in production |
| Forge equip endpoints | Exist |
| Test-shaped book: $100k, chosen length, more than one book per player, stocks limited to the subject | Missing. The engine allows one $10M three-month book per player |
| Twin pairing, dated benchmark series, the gap | Missing |
| Result record, the Forge offer, the Practice Field screen | Missing |
| Catalyst record, industry lists, versioned themes | Missing |
| Premium or entitlement system | Missing |
| **Bug:** the engine's sector cap is copied as a count (2 to 4) and checked as a share, so a cap of 3 allows 300% | Must be fixed before any book trades |

## 7. Ownership and limits

- **A test and its result belong to the player's archetype that ran it.** Switching archetype shelves them and switching back restores them, as the ledger already does for cards.
- **The partnership record stays with Shadow and the player** and is not shelved on a switch.
- **Private experience never crosses** to another archetype or player, with or without names.
- **One test per player in V1,** read from one limit function. Premium raises the count when an entitlement system exists; none does today.
- **A test's stocks must sit in the shared price list** while it runs. Stocks the subject brings join the list for the test's length.

## 8. Cost

| | Per test per day | Per test per month (21 sessions) |
|---|---|---|
| Model, two checks a day, direct | $0.03 | $0.63 |
| Model, batched | $0.015 | $0.32 |
| Market data | flat while the stocks sit in the shared list; about 6 to 16 units a day per stock outside it | — |

- **100 players with one test each:** about $63 a month direct, half batched.
- **The engine's own ceiling:** about 50 books evaluated per slot and 175 closed per day as written. Beyond that, books silently miss checks. This is a build item (P5) before tests approach 50 at once.
- **Today's waste:** the engine downloads data for 136 stocks every trading day for books that do not exist, about 1,700 units a day. P0 stops that without switching the engine off.

## 9. What carries forward from V3 and Amendment A

| From | Now |
|---|---|
| §3 what a better partner is | Stands |
| §6 three fixed situations and the cockpit button | Stand; `down` and `good_lead` are game-state tests, later |
| §8 the drill, the vote, the reveal with the swap tax | Stand as an optional later activity ("Chase or hold") |
| §8.5 proof as fidelity + no harm; A4 control plays | Replaced by §4 and §5 here |
| §9 one door | Replaced by §4 "test notes never reach a battle prompt" |
| §10 league film | Parked under §7 ownership |
| A1 two information sets; A2 five fields; A3 vote agreement and "can't tell"; A5 development and confirmation; A6 `thesis_broken` | Stand, for the drill and for coded-rule candidates |
| A4 rule-version plays | Stand as the "new rule version" offer, by the archetype arc's route |
| The 10 Oct rulings | Stand except where this table says otherwise |
| The reset of the failure-built paragraphs | Still to run, on a weekend |

**The architecture chat's revision** maps onto this loop: its experiment record is the test entry; its proposal review is sending an item; its implementation check is the engine's test contract; its forward observation is the test; its adoption decision is the Forge offer. Its historical development and confirmation steps apply to coded-rule candidates, which stay with the archetype arc.

## 10. Order of work

| # | Package | What the player gets | Size |
|---|---|---|---|
| P0 | Housekeeping: fix the sector-cap units; store the agent's reason and conviction on the decision record; skip the daily data build while no active book exists. Carries this concept and the audit report into the repo | Nothing yet | Small |
| P1 | Founder-only test against a benchmark: a $100k book of a chosen length limited to a subject's stocks, a daily benchmark row, the gap, the notes, a read-only screen behind its own flag and a server-only uid list | The first watchable test | Medium |
| P2 | Film Room → test: the *send to test* operation, `testing` and `tested` stages | Cards become tests | Small to medium |
| P3 | The result record and the Forge offer | The loop closes | Medium |
| P4 | The agent twin | "My agent as-is against the idea" | Medium |
| P5 | Scale: paging past 50 books a slot, the per-player limit function, the calendar past 2027 | More players | Medium |
| P6 | Subject records: catalyst events, industry lists, versioned themes, one sector list | More kinds of test | Medium each |

Between P1 and P2: the founder runs one or two tests on his own account and FT_QA, and the screen's design round runs from a real test day.

## 11. Decisions for the founder

Approved unless you object. Answer "yes to all" or name the numbers. The first fourteen are the audit's; 15 and 16 are mine.

1. **Stop the wasted data buying without switching the engine off.** Lean: P0 skips the daily build while no active book exists. No flag flip.
2. **Close PRs #760, #761 and #762.** Lean: yes, all three. Each is a one-line switch from August; one no longer merges.
3. **Build on the Mandate engine, not Season Mode.** Lean: yes. Keep only Season Mode's "you vs SPY" chart.
4. **Who manages the test.** Lean: the agent, through the engine's model call, two checks a day. Watching it reason is the point. Rule-managed books come later for coded-rule tests.
5. **The default twin.** Lean: a benchmark in V1: SPY, or the sector fund for a sector or industry subject. The agent twin is P4.
6. **Starting paper money.** Lean: $100,000 per test.
7. **Stocks must sit in the shared price list.** Lean: yes in V1; a subject's stocks join the list for the test's length. One house list instead of today's three is a separate task.
8. **Show the agent's own words as the running note.** Lean: yes, stored on the decision record, shown as its recorded words with the time, under Shadow's voice and honesty labels.
9. **Test notes never reach a battle prompt.** Lean: yes, a standing rule.
10. **Which cards can be sent to test.** Lean: Drill and Watch cards. Set cards stay a Forge control.
11. **The Forge receives an offer, never an automatic change.** Lean: yes.
12. **Test lengths.** Lean: 10, 30 or 60 sessions, default 10. The holiday calendar ends in 2027 and is extended in P5.
13. **One test per player or per archetype, and premium.** Lean: per player in V1, from one limit function; the test belongs to the archetype that ran it; premium waits for an entitlement system.
14. **Fix the sector-cap bug first.** Lean: yes, in P0.
15. **The player watches and cannot trade the test.** Lean: yes. The stake is choosing, watching and applying. A player who trades it muddies the result.
16. **This chat writes shared contract V2** (the `testing` and `tested` stages, the test entry, the Forge offer), handed once to the Film Room chat and once to the architecture chat.

## 12. Limits

- **A 10-session test with a few stocks is one observation.** The product value is the watchable experience and the record built over repeats, not a proof.
- **The engine's fills are paper.** Delayed quotes and modelled costs; no real liquidity.
- **Catalysts wait.** The platform keeps no event record, so "test this earnings reaction" is P6.
- **The engine's scale ceiling** is about 50 concurrent tests until P5.
- **Everything so far is founder and tester play.**
- **It has to be worth checking.** If the gap never moves, nobody opens it. Ten-session tests on a handful of stocks move daily.
