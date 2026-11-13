# Practice Field — concept V6: the idea book

**Date:** 12 Nov 2026 · **Author:** the Practice Field chat (Fable) · **Status:** direction approved by the founder on 12 Nov 2026 (one agent-filled book per player, ideas in three horizon slots, hedging as one rule, the Forge as the player's only decision); this text and the rulings in §16 await his adoption after Astra's review · **Supersedes on adoption:** concept V3 (14 Oct) and Amendment A (21 Oct). V4, V5 and V5.1 were withdrawn before adoption; V6 keeps V5.1's contracts and changes its shape.
**Rests on:** V5.1 and Astra's two reviews of it (12 Nov), the test portfolio audit (`docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md`), the architecture chat's design revision (11 Nov) and its current work on agent-originated proposals, the KB focus brief (9 Nov), Growth Loop Map V1.2, the Mandate substrate spec V1.4 and its acceptance report.
**Scope:** design only. Adoption authorises no implementation, deployment, PR closure, model spending or production change. Each build keeps its own task and prompt.
**Destination:** `docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6.md`, carried by the first build's commit (T0a) with the audit report and Astra's reviews in `docs/audits/`. No docs-only PR.

## 0. What changed since V5.1

- **One continuous book per player, not discrete tests.** The Practice Field is a paper-money portfolio the player's agent manages around ideas. It is always running. A "test" from V5.1 becomes an **idea** in the book, with the same contract.
- **The agent fills the book itself.** Ideas can come from anywhere the player's own activity produces them: a SignalDrop pick, a game, a conversation with the agent, a Film Room review, or the agent's own proposal. The agent drafts, enters, sizes, hedges, exits and judges. The player's one decision is at the Forge: equip a validated idea or not.
- **Three slots by horizon.** Short (10 sessions), medium (30) and long (60). Every player runs one idea in each slot at all times. Premium adds slots, in any horizon.
- **Rails per horizon.** How much of the book an idea may take, how wide its "wrong if" line may be, and when it is judged. A long-term idea is judged at its review, not by a bad Tuesday.
- **Hedging as one rule.** A cap on the book's planned loss if every idea's line is hit, met with cash or one offset fund. Each idea shows its risk at the line.
- **The player reads, and decides only at the Forge.** No buttons inside the book in release 1.
- **Astra's second-pass edits are folded in** (Appendix A). Everything else from V5.1 stands: matched comparisons per idea, the price labels, the fill-timing rule, the result vocabulary, ownership, the Forge as the only door to the games, release 2 as separate branch books, the T-packages.
- **The idea book is what the Mandate engine runs.** Its quarterly product (Spec 1) was switched on in August and never given a book. V6 proposes the idea book as that engine's product (§16, ruling 2).

## 1. The loop

| Stage | What happens | Owner | State on `main`, 12 Nov |
|---|---|---|---|
| Sources | The player plays, picks in SignalDrop, talks to the agent, reviews in the Film Room. Each leaves a record | Cockpit, SignalDrop, chat, Film Room | Live or allowlist; cards not yet in production |
| Idea | The agent drafts an idea from those records: one sentence, a horizon, names, a comparison, the line that proves it wrong. If it passes the shape test and a slot is open, it enters the book | Practice Field | The idea record exists (list, horizon, review date); drafting does not |
| Book | The agent manages the book twice a day within the rails: sizing, exits, the offset. Every decision carries its written reason | Practice Field, on the Mandate engine | Engine built and switched on; never run |
| Verdict | At each idea's review date, or when its line is hit: validated, invalidated or inconclusive, against its own stated conditions | Practice Field | Risk metrics exist; no verdict |
| Forge | A validated idea arrives as an offer: equip it and its list for battles, or not | Forge, from a Practice Field build declared once to the hub chat | Equip endpoints exist; no offer |
| Film Room | A verdict links back to the review that produced the idea; the agent reads its own completed ideas when drafting the next | Film Room, Practice Field | — |

## 2. The book

- **One book per player,** $100,000 of paper money, on the Mandate engine, which already enforces one book per user and marks every book from one shared price snapshot.
- **The manager is the test version of the player's agent:** the engine's model seat running a frozen snapshot of the agent's settings (archetype identity, equipped list and idea version, leans, tempo, rule bundles), with a manifest of what it received and a check of which settings actually move its decisions (T1b). Not carried in release 1: game memory and the wisdom paragraph. The screen calls it "Test version of your Trend Follower" until behaviour matches the declared settings.
- **Two checks a day.** One action per check across the whole book (buy, add, trim, sell, hold, or set the offset) with two to five sentences of reason. Checks fall in the engine's windows after the open and at midday; the day's valuation runs after the close.
- **The book never trades a battle and a battle never reads the book.**
- **It keeps running.** Ideas resolve and are replaced. There is no end date; the record accumulates.

## 3. Slots and rails

| Slot | Horizon | Share of the book an idea may take | "Wrong if" width | Judged |
|---|---|---|---|---|
| Short | 10 sessions | up to 20% (S1) | tight: a price line close to entry | at session 10, or earlier if the line is hit |
| Medium | 30 sessions | up to 30% (S1) | moderate | at session 30, or at the line |
| Long | 60 sessions | up to 40% (S1) | wide; may be an event or a thesis condition as well as a price | at session 60, or at the line. Daily swings change nothing |
| Cash | — | at least 10% (S2) | — | — |
| Offset | — | sized by the hedge rule (§6) | — | — |

- **The archetype's own limits still apply inside a slot:** the single-position cap and the sector cap. The tighter limit binds, and the screen says which. A Diversifier's sector idea will be smaller than a Trend Follower's, by design.
- **Intraday ideas (2 sessions) are excluded.** A book checked twice a day cannot honour them.
- **Premium adds slots** in any horizon when an entitlement system exists. The slot count is read from one function.
- **Horizons map onto the idea record's existing classes** (swing 10, positional 30, long-term 60) and their review dates.

## 4. An idea

Every idea carries a contract, frozen when it enters and shown on the screen.

| Part | What it is |
|---|---|
| Thesis | One sentence in the agent's words, labelled as such. "Data-center power demand lifts the utilities that serve it over the next quarter." |
| Slot | Short, medium or long |
| Names | One to eight stocks from the shared price list (S3) |
| Comparison | Matched to the subject (V5.1 §3): a single stock against holding it at the same fixed shares; a sector against its fund; a theme against a frozen basket of its own names; an industry against its fund or a frozen basket. SPY is a second line for context |
| Wrong if | A checkable line: a price the names close below, or a dated event with a stated outcome. Checked by rules where it is a price |
| Allocation | Within the slot's cap and the archetype's limits; fixed shares once bought, so the comparison needs no rebalancing |
| Risk at the line | Allocation × distance to the line: what the book loses if this idea is wrong at its current size |
| Sources | Where it came from: the SignalDrop pick, the game moment, the chat exchange, the Film Room card, or "agent's own", with ids |
| Entered | The start mark and its time, the first eligible fill after the decision |
| Review | The session on which it is judged |

**Status:** drafted → entered → holding → under review (line hit) → validated, invalidated or inconclusive → offered (if validated) → retired. Run status, result and adoption state are kept apart, as in V5.1.

**What the verdicts mean.**

- **Validated:** the line was never hit and the idea finished ahead of its comparison after modelled costs at its review. It is a statement about this idea's stated conditions in this run, one observation, and the result card says so.
- **Invalidated:** the line was hit, or the idea finished behind its comparison at review.
- **Inconclusive:** data quality fell short, or the gap sat inside the no-difference band (S4).
- The words "proven" and "supported" do not appear.

## 5. How ideas enter

- **The agent drafts, nobody approves.** When a slot opens (a verdict, or the book's first day), the agent drafts the next idea for that horizon from the player's own records and its own completed ideas, in one drafting call. Up to three drafts per refill (S5).
- **The shape test replaces the player's yes.** An idea enters only if it has a one-sentence thesis, a horizon that fits the slot, names in the shared price list, a matched comparison, a checkable "wrong if", an allocation inside the rails and the archetype's limits, and no name that would breach a running idea's limits. A draft that fails is kept in a private "considered" list with the reason.
- **If nothing passes, the slot sits in cash and says so.** "No idea passed the test today" is an honest state, not a failure.
- **Sources are the player's own.** SignalDrop picks, game moments, the player's conversations with their agent, their Film Room cards, and the agent's own completed ideas for this archetype. Never another player's, never another archetype's.
- **Later:** a player-approval mode, if wanted, is one ruling, not a redesign.

## 6. Hedging, as one rule

- **The rule.** The book's **risk at the lines** (the sum of every idea's risk at the line) may not exceed S6 of the book's value (lean 8%). When it would, the agent must hold an offset sized to bring it under: cash, or one broad inverse fund (S7, lean a single short-S&P fund), which a long-only paper book can hold.
- **What the player sees.** Each idea's risk at the line. The book's total. The offset row: its size, what it offsets, the agent's reason, and its cost so far. A one-sentence explanation of the rule on the screen.
- **What it is not.** Inverse funds are blunt and decay; options are out of reach. The screen says "offset", never "insured".
- **Why it is worth it.** It is the first place a player sees risk sized before the outcome, and it is the seed of hedging the agent can refine in release 2 with a branch book that runs without it.
- **The scrap test.** If the rule cannot be explained in one sentence on the screen, or over the first three months the offsets cost more than they protected, the rule comes out and the book runs on cash alone.

## 7. What the player sees

- **The book.** Value, the gap to SPY, risk at the lines, cash, the offset.
- **Three rows, one per slot.** The thesis, the names, the sleeve's gap to its own comparison, the horizon clock ("day 12 of 60, not judged yet"), the status chip, the agent's latest note. A long-term idea's row does not change colour on a bad day.
- **The offset row,** when on.
- **The chart.** The book against SPY; tap a row for the sleeve against its comparison.
- **The verdict card,** when an idea resolves: the result, the gap after costs, the largest decline between recorded closes, trades and costs, invested exposure, data quality, the agent's closing note, the one-observation label, and the Forge offer if validated.
- **The record, by horizon.** "Short ideas: 4 of 9 validated, 1 inconclusive. Long ideas: 1 of 1, 1 running." All attempts from the first; a repeat line after two comparable completed runs.
- **The next idea,** announced when a slot refills: the thesis and where it came from.
- **No buttons.** The player reads. The only decision is in the Forge. The screen says so once.
- **Ways in:** the card in the hub's Archetype area ("Idea book · $101,240 · 3 ideas running"), the Film Room receipt on a card the agent took into the book, and the Forge when an offer waits.

## 8. Honesty rules

- **One idea is one observation.** "Validated" means its stated conditions were met in this run.
- **Comparisons are matched, not merely simultaneous.** Same start mark, same cost policy, fixed shares, same corporate-action treatment, same end mark, as V5.1 §3.
- **Prices are labelled for what they are.** Fills are simulated at the first eligible observation after the decision, never at a price older than the information the decision used. End-of-day values are "post-close snapshot values" until an official-close source is verified. Observation and receipt times are recorded.
- **Missing data stays visible** and prevents a full-quality verdict.
- **Size with counts.** The largest decline, costs and exposure sit beside every gap. The engine's composite risk score is not shown as confidence. Conviction is a diagnostic, never a probability.
- **Market and game stay apart.** The book measures dollars and says nothing about BaggerBomb points.
- **Horizon is respected.** An idea is judged at its review or at its line, never because the player is bored or the market is loud.
- **The agent's words are quoted, not rewritten,** with their time, unverified.
- **An outage never extends an idea.** Actions after a review cutoff are refused; a missed final valuation is recovered from the scheduled session's prices or recorded as inconclusive.
- **The book changes the agent only through the Forge, only when the player confirms.**

## 9. What reaches the agent

| Where | What it may see |
|---|---|
| **The deployed agent's battle and draft prompts, memory, consolidation** | Nothing from the book: not the ideas, the decisions, the reasons or the verdicts. Adopted changes arrive only through their install route |
| **The book's manager** | Its frozen settings snapshot and the book's own state. The one exception to "nothing reaches a prompt before installed", granting no deployed-agent, memory, cross-player or cross-archetype access |
| **The drafting call** | The player's own sources, the agent's own completed ideas for this archetype, and a small versioned packet of approved methods from the knowledge base |
| **Another player, another archetype, the shared knowledge base** | Nothing. Removing names does not make private experience shareable |

The player's own instructions keep the doors they have. The legacy wisdom-paragraph route is governed separately (its reset is pending; its future is decided with P4).

## 10. Ownership and the Charter

- **The book and its record belong to the player's archetype.** On an archetype switch, running ideas finish under the original archetype's frozen manager and no new idea enters; when the last resolves, the cash passes to the new archetype's book and the record stays with the old one, in its archive, where the new archetype cannot read or adopt it. The slots refill under the new manager from then on.
- **The partnership record stays with Shadow and the player.**
- **Release 1 claims no learning.** A validated idea supports one offer the player could make today: equip the idea and its list. That is a player instruction under the Learning Charter, not a learned strategy. No Charter revision is needed.
- **The player no longer chooses what gets tested; the player chooses what gets adopted.** The standing rule moves from entry to the Forge, and the shared contract V2 says so.
- **Release 2 claims improvement** (a change to the agent against the unchanged agent, in separate branch books) and the Charter and Amendment A govern it: development and confirmation kept apart, forward runs typed as forward observations, no private market-alpha claim promoted to a strategy under the current Charter.

## 11. The record

- **The book** lives where the engine keeps books, with a kind marker and the settings snapshot.
- **An idea** is a record under the book: its contract, sources, decisions, valuation rows with cash and positions, the pre-action start value, costs, corporate-action receipts, the verdict, and links to its sources (a card's entry id, a hypothesis version, a SignalDrop id, a chat exchange id). It duplicates none of them.
- **A Film Room card** the agent takes into the book moves to `testing` when the idea enters and to `tested` at the verdict; a running `testing` card counts as open; a `tested` card counts until parked or retired. The reserved `drilled → drafted → proven` stages are dropped. Historical stage history is never rewritten.
- **Three states kept apart:** run status, result, adoption.
- **The packet needed to reproduce a verdict is retained** beyond the engine's 120-day snapshot retention.
- **Shared contract V2** specifies the idea record, the card stages and the Forge offer; this chat writes it.

## 12. Hand-offs

**Sources → book.** Automatic, through the drafting call and the shape test. A Film Room "send to test" becomes "offer to the agent": the card joins the agent's candidate sources with priority at the next refill.

**Book → Forge.** A validated idea shows in the Forge as a typed offer, never an automatic change, through writers that exist and within their checks (no change to a running battle):

| Offer | Writer | Takes effect |
|---|---|---|
| Equip the idea and its list | the watchlist and idea endpoints, naming the exact version | next battle |
| Retire the idea | the book and the card ledger | at once |
| Set a lean, dial or bundle (release 2) | the equip endpoints | next battle |
| A new rule version (release 2) | the archetype arc's install route (ID-4) | by that route |

**Book → Film Room.** A verdict links back to the review that produced the idea. The agent's drafting reads its own completed ideas, which is how one review's question becomes the next idea.

## 13. Cost and capacity

| | Per player per day | Per player per month (21 sessions) |
|---|---|---|
| Manager, two checks, direct | $0.03 | $0.63 |
| Drafting, about 8 refills a month at 3 drafts each | — | about $0.10 |
| Release 2 branch book, when running | $0.03 | $0.63 |
| Market data | flat while names sit in the shared list; about 6 to 16 units a day per name outside it | — |

- **100 players: about $75 a month** on direct calls. The $0.015 per check is a planning figure until the real prompt, with the settings snapshot, is measured (T1b).
- **The shared price list is capped at 300 names.** A hundred players' ideas plus offset funds can exceed it; T5 raises or partitions it before that. Until then, the shape test refuses names that would breach the cap, and says so.
- **Capacity is a ceiling, not a tested figure:** about 50 book visits per check window as written, which is about 50 players. A founder capacity cap, a per-book spend bound and an expected-versus-observed check ledger ship with the first book (T1a).
- **Today's waste** (data bought daily for books that do not exist) stops in T0c without switching the engine off.

## 14. What exists and what is missing

| Piece | Status |
|---|---|
| One paper book per player, fills with costs, splits and dividends, daily close and rows, risk metrics, one shared snapshot | Exists: the Mandate engine, switched on, no book ever created. The idea book fits its one-book-per-user shape better than V5.1's discrete tests did |
| Idea record with a list, a horizon class and a review date | Exists, allowlist only |
| SignalDrop picks, game moments, chat exchanges, Film Room cards as source records | Exist in their own stores; cards not yet in production |
| Benchmark and offset fund prices | Collected by other jobs as latest values; must join the engine's own valuation build with a dated series and an ETF cost classification |
| The agent's written reason per decision | Produced and dropped |
| Sleeves inside a book, horizon rails, the hedge rule, drafting and the shape test, the review pass and verdicts, the settings snapshot into the manager, the screen | Missing |
| Catalyst records, industry lists, versioned themes, one sector list, an entitlement system | Missing |
| **Bug:** the sector cap copied as a count and checked as a share | Confirmed; fixed in T0a |

## 15. Order of work

| # | Package | Delivers | Size |
|---|---|---|---|
| **Design lock** | V6 adopted after Astra's review; shared contract V2; the Charter boundaries in §10 | — | — |
| T0a | Sector-cap translation at the frozen-config boundary, versioned, new vintage, boundary tests. Carries this concept and the reviews into the repo | Correct limits | Small |
| T0b | Store the agent's reason and conviction on the decision record, bounded, attributed, direct and batch | The notes | Small |
| T0c | Skip idle data acquisition when no active book exists; recheck every fire; never write an empty snapshot | Waste stops | Small |
| T1a | The book and its ideas: sleeve records, horizon rails, review cutoffs and recovery, verdicts, run/result/adoption states, one-book reservation, immutable manager config, name membership the session before entry, calendar check, spend bound, check ledger, owner access, retention | The plumbing | Medium to large |
| T1b | Test version of your agent: the settings snapshot into the manager's prompt, the input manifest, the check of which settings move decisions, the small KB packet | An honest manager | Medium |
| T1c | Matched comparisons: fixed-share passive sleeves, benchmark and offset funds in the valuation build, ETF cost classification, the fill-timing rule, the inception row, price labels | Fair gaps | Medium |
| T1d | Drafting: the sources, the drafting call, the shape test, the "considered" list, slot refill, "no idea passed" | The agent fills the book | Medium |
| T1e | The hedge rule: risk at the line, the book cap, the offset instrument, the one-sentence explanation, the scrap test's measurements | Risk made visible | Small to medium |
| T1f | Founder-only screen behind its own flag and server-only uid list; the first end-to-end weeks on the founder's and FT_QA's accounts, labelled a feasibility observation | The first watchable book | Medium |
| T2 | Film Room ↔ book: "offer to the agent", `testing`/`tested`, the return link, slot version, shelving | Cards feed the book | Small to medium |
| T3 | Verdict → Forge: typed offers, adoption and rollback record, proof of no running-battle mutation; its Forge slot declared once to the hub chat | The loop closes | Medium |
| T4 | Release 2: branch books for changes to the agent (a bundle, a lean, the dial, a rule version, the hedge rule itself), consuming the archetype arc's candidates | Tests of changes | Large |
| T5 | Scale: measured capacity, the 300-name list, paging, the slot-count function and premium, calendar maintenance | More players | Medium |
| T6 | Subject records: catalyst events, industry lists, versioned themes, one sector list | More kinds of idea | Medium each |

After T1f the screen's design round runs from real book days. Each package is its own build task with its own prompt and review.

## 16. Rulings for the founder

Proposed rulings awaiting explicit approval. Answer "yes to all" or name the numbers. ◆ marks items new since V5.1.

1. **Adopt V6** in place of V3 and Amendment A; V4, V5 and V5.1 withdrawn.
2. ◆ **The idea book is the Mandate engine's product.** The quarterly Spec 1 format is retired as a product; its engine, acceptance harness and runbook stay. Books created by the idea book use the engine's one-book-per-user slot.
3. **Stop the idle data buying by the narrow skip** (T0c), not by switching the engine off.
4. **Close PRs #760, #761 and #762.**
5. **Season Mode stays dead;** keep only its "you vs SPY" chart.
6. ◆ **The agent fills the book without approval.** The shape test (§5) is the only gate. A player-approval mode is a later ruling.
7. ◆ **No buttons in the book in release 1.** The player reads; the Forge is the only decision. A long-term idea holds its slot to its review.
8. ◆ **Three slots: short 10, medium 30, long 60 sessions,** one each for every player; intraday excluded; premium adds slots in any horizon when an entitlement system exists.
9. ◆ **Rails (slots S1, S2):** an idea may take up to 20% (short), 30% (medium), 40% (long) of the book; cash at least 10%; the archetype's own caps bind where tighter.
10. **The manager is the test version of the player's agent:** the frozen settings snapshot on the engine's model seat; game memory and the wisdom paragraph not carried; labelled "Test version of your Trend Follower" until behaviour matches the declared settings.
11. **Starting paper money: $100,000** per book.
12. **Comparisons per subject as V5.1 §3,** fixed shares, same cost policy, cash earns nothing, end marked to market, SPY as a second line.
13. ◆ **Names per idea: one to eight (S3),** from the shared price list; names and comparison funds join the list the session before entry.
14. ◆ **The hedge rule (S6, S7):** risk at the lines capped at 8% of the book, met with cash or one broad inverse fund; "offset", never "insured"; the scrap test in §6 applies at three months.
15. ◆ **Verdict words:** validated, invalidated, inconclusive, as defined in §4; "proven" and "supported" never appear; the no-difference band (S4) is 0.25% of starting money.
16. **Store the agent's reasons,** quoted and unverified; conviction stored as a diagnostic, never shown as confidence.
17. **Nothing from the book reaches the deployed agent's prompts, memory or consolidation.** The book's manager and the drafting call read only what §9 lists.
18. ◆ **Sources for drafting:** the player's SignalDrop picks, game moments, conversations with their agent, Film Room cards, and the agent's own completed ideas for this archetype. Nothing from another player or archetype.
19. **The Forge receives a typed offer, never an automatic change.** Release 1 offers: equip the idea and its list; retire the idea.
20. ◆ **Archetype switch:** running ideas finish under the original manager with no new entries; the cash passes to the new archetype's book when the last resolves; the record stays with the old archetype.
21. **Price labels:** "post-close snapshot value" until an official-close source is verified; fills "simulated" at the first eligible observation after the decision.
22. **Pilot controls:** direct transport; a founder capacity cap of 4 books (S8); a per-book spend bound of $3 a month (S9).
23. **Release 2 follows release 1** and consumes the archetype arc's offline candidates; the hedge rule is among the first things it tests in a branch book.
24. **This chat writes shared contract V2,** handed once to the Film Room chat and once to the architecture chat; the hub chat receives one note about the Forge offer slot when T3 is specified.
25. **Sector-cap translation 2 → 1/3, 3 → 1/2, 4 → 2/3,** versioned, new vintage; new-book admission rejects an uncorrected profile; the fenced archetype table is not touched.

## 17. Limits

- **A verdict is one observation.** The record over repeats, by horizon, is where a player learns what their agent is good at.
- **Fills are paper:** delayed quotes and modelled costs, no real liquidity.
- **Hedging is an offset, not insurance,** and may be scrapped.
- **The agent's ideas will sometimes be dull or wrong.** The shape test keeps them honest, not clever. "No idea passed the test today" will happen.
- **The shared price list caps the universe** until T5.
- **The prompt size is unmeasured** until T1b; the cost figures are planning numbers.
- **Everything so far is founder and tester play.**

## Appendix A. Disposition of Astra's second-pass edits (V5.1)

| Edit | Disposition | Where |
|---|---|---|
| Keep agent-generated ideas in release 1 | Accepted and extended: the agent originates and enters every idea | §5, ruling 6 |
| Let the originating agent review its own completed experiments and propose follow-ups | Accepted | §9, §12 |
| Verify which settings influence decisions; a small versioned KB input contract; label "Test version of your Trend Follower" | Accepted | §2, T1b, ruling 10 |
| Match exposure to the effective permitted allocation; fixed shares, not fixed weight; apply to sector and theme ideas | Accepted | §3, §4, ruling 12 |
| A fill-timing rule tying information cutoff to the eligible fill | Accepted | §8, T1c |
| "Proposed rulings awaiting explicit approval" | Accepted | §16 |
| Keep the 50-visit ceiling and the founder cap separate | Accepted | §13 |
| `testing` only when execution starts; the result record with the first runnable experiment | Accepted | §11, T1a |

## Appendix B. What carries forward from V3 and Amendment A

| From | Now |
|---|---|
| §3 what a better partner is | Stands |
| §6 three fixed situations and the cockpit button | Stand; `down` and `good_lead` are release 2 game-state tests |
| §8 the drill, the vote, the reveal with the swap tax | Stand as an optional later activity ("Chase or hold") |
| §8.5 proof as fidelity + no harm; A4 control plays | Replaced by §4, §8 and §10 |
| §9 one door | Replaced by §9 here |
| §10 league film | Parked under §10 ownership |
| A1 two information sets; A2 five fields; A3 vote agreement and "can't tell"; A5 development and confirmation; A6 `thesis_broken` | Stand, for the drill and for release 2 |
| A4 rule-version plays | Stand as the release 2 "new rule version" offer by the archetype arc's route |
| The 10 Oct rulings | Stand except where this document says otherwise; ruling 4 of 10 Oct (the player picks the moment) and the player-chooses-what-is-tested rule move to the Forge (§10) |
| The reset of the failure-built paragraphs | Still to run, on a weekend |
