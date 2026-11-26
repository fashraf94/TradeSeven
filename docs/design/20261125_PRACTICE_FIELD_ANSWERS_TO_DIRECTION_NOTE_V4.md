# Practice Field answers to direction note V4 (the Ideas portfolio as the agents' training ground)

**Date:** 25 Nov 2026 · **Author:** Fable (the Practice Field chat) · **For:** the founder.
**Answers:** `DIRECTION_NOTE_IDEAS_PORTFOLIO_TRAINING_GROUND_V4_NOV25_2026.md`, §5 and §6 (Q1 to Q6).
**Destination:** read here by the founder. He may attach it once to the Command Center and Forge direction chat, one way. It enters the repo with build B4 as `docs/design/20261125_PRACTICE_FIELD_ANSWERS_TO_DIRECTION_NOTE_V4.md`.
**Checked against:** `main` at `1cb1c627` (the agent on), and the founder's live book after its first agent close, 25 Nov.

## 1. In plain terms

- **Nothing in the note is built today, and nothing in it blocks the beta.** The book that launches on Dec 4 is the one running now: three slots, one idea each, the archetype frozen when the book is made.
- **Five of the six questions lead to the same piece of work.** Changing the archetype, running several setups, and setting the split all need the book to open a second "epoch". An epoch is the frozen settings record every idea runs under. The contract foresaw it; it was never built.
- **The chart evidence the archetype desk lacks already exists in production.** A nightly job stores a setup verdict for 228 stocks every session. The desk doesn't read it yet.
- **Several setups cost nothing extra in model calls.** A desk makes one call a night whatever it holds. Tonight that call cost 2 cents.
- **One finding the note didn't ask about:** the archetype's sector limit binds the Shadow desk's ideas too (Q1).

## 2. The six answers

### Q1. What happens today when the player changes the portfolio's archetype?

**Nothing happens, because there is no way to change it.**

- **As built:** the archetype is chosen once, when the book is created, and frozen in the book's epoch. Every idea records the epoch it was admitted under.
- **A game loadout never touches the book,** and the book never touches a game. That half of IP-3 already holds.
- **The only change available today** is the founder winding the whole book down and creating a new one. That is V6.1 §10's "whole book", and it is a founder action, not a player's.
- **What IP-2 and IP-3 need:** an archetype change that opens a new epoch for the short side only. Running ideas keep the epoch they started under and finish there.

**A finding for the founder's ruling.** The epoch takes its sector limit from the archetype, and that limit applies to all three slots. Tonight the Shadow desk's long idea was sized at exactly one-third of the book, not the long slot's 40%, because the Diversifier's sector limit is one-third and all three names are health care.
- So today a different archetype would change what the Shadow desk may hold.
- IP-3 and IP-7 need the opposite. **My lean:** the Shadow desk gets its own fixed sector limit, and the archetype's limit applies to the short side alone.

### Q2. When does the new archetype start?

- **Under option (a), one short slot:** at the first close after the running short idea ends, with its first buy the session after. The worst case is about 11 sessions.
- **Under option (b), several setups:** at the next close, in any free place.
- **My lean is (b).** It comes with Q5, in the same build.

**One detail either way.** Today the nightly check of a short idea speaks with the book's current archetype, not the one the idea started under. After a switch, the old idea must not be judged by the new archetype (IP-2). Two ways:
- the old idea gets its own check under its own frozen archetype, at about 2 cents a night while the two overlap; or
- the old idea runs to its end under code alone: its line and its end date.

**My lean:** code alone, once a setup carries a plan (Q4). A plan needs no nightly judgment.

### Q3. Can the player's view reach a desk?

**Not today.** A desk reads the book, the price list and, once switched on, the player's saved theses. Its only calls are hold and exit.

- **Size:** a short player note is a new source with its own rules, though a modest one. The saved-thesis reader is the pattern: player text is quoted as untrusted, and it can lead only to a call that code validates.
- **The product problem is bigger than the build.** A note saying "the market looks risky" that makes a desk exit is the player closing an idea by proxy. That cuts against IP-1, and it blurs whose result it is (IP-4).
- **My lean:** don't build it as a way to exit. If the founder wants it later, the note shapes the next draft only, never a running idea. It isn't needed for launch.

### Q4. What does a short-slot test with a strategy and a plan take?

**What the book can reuse today**
- **The setup detector exists and is pure** (`tf-setup-v1`): Pullback and Resume, and Trend Breakout, each with a verdict and a rule version.
- **The nightly setup store exists.** It writes a verdict for each of 228 stocks after every close. This is the chart evidence the archetype desk lacks.
- **Trader v1's plan check does not exist yet.** It is trader v1's Build 3, and Build 1 hasn't started. So there is nothing to share yet.
  - To honour A-5, the book's build should write the price arithmetic of a plan once, in a neutral place: risk at the stop, reward at the target, reward against risk, and the share of wins needed to break even. Trader v1 then adds its points on top.
  - That needs a one-way note to the BaggerBomb revamp chat before either side builds.

**The smallest first step, S1: the label and the plan on the record, exits unchanged**
1. The archetype desk's candidates become the names with a valid setup at that close, among the stocks the book prices.
2. A short draft names one strategy from the closed list and carries a plan. Code checks the label against the detector, and relabels to "No Recognized Setup" where it disagrees, as trader v1 §5.4 does.
3. The idea records the strategy, the detector's verdict and rule version, and the plan as filled (the note's §5.4).
4. **Exits stay as they are.** The stop is the book's line, which code already sells at. The test ends at session 10. The target, the time limit and the progress action are recorded, not carried out.

**The second step, S2: the plan's own exits**
- A target exit, a time limit and a progress action are three new kinds of sale. Each is a money path and needs the full review the line exit had.
- **S1 alone doesn't grade "was the plan followed".** That needs S2.

**The plan template for 10 sessions**
- Every number needs measuring, as the note says. That is one read-only experiment, like the 18 Nov payoff check, over a 10-session horizon: how far a valid Pullback and Resume name moves against and for the entry, in the stock's own units.
- It also settles IP-8's open point with data: whether a sound stop fits inside today's short range of 3% to 8% below entry.

**Timing**
- **It matches "valid at the prior close".** The desk drafts after session T's close on T's verdict, and code buys at the first window of T+1. The frequency count found 97% still enterable at the next open, inside the shelf life it supports.
- **Two details the build must solve:**
  - the setup job's first run is 5:30 PM Eastern, and a desk can check from 4:15 PM. The desk must wait for that session's verdicts, or compute them itself with the same pure detector. It must never read the day before's.
  - the setup job covers 228 stocks and the book's price list holds 136. A setup counts only on a stock the book prices. The overlap needs one count.

### Q5. Pace: could the short desk hold several single-name setups at once?

**Yes in design. As built it is a structural change.** The book has exactly three slots, each holding one idea, frozen in the epoch. Several setups means the new epoch (Q1) and a change everywhere "one slot, one idea" is assumed: admission, reconciliation, the desk's drafting and the screen. It is a medium build on the money path, with a full review.

| The founder asked for | Answer |
|---|---|
| **The 20% cap** | Keep the short side at 20% of the book, in three places of about 6.7% each: roughly $6,660 a setup on a $100,000 book. No other limit binds at that size |
| **The 15-position limit** | No effect. Today's most is 12 (four names in each of three ideas). With three single-name setups it is 11. Seven setups would fit before the limit binds |
| **The $3 monthly bound** | No effect. One call per desk per night, whatever it holds. Tonight: 2 cents a call, 3 cents for the book |
| **A new archetype taking a free setup at once** | Yes. That answers Q2: it starts at the next close if a place is free, otherwise when the first one ends |

**Why it matters more than pace**
- **The record needs volume.** "Too few to tell" lifts at 20 closed trades (TV-17). At about two tests a month that is ten months for one archetype. At about six a month it is a little over three, and sooner once S2's targets and time limits end tests early.
- **Supply differs by archetype.** The frequency count found about 6 valid names a morning for the Trend Follower, 4 for the Speculator, 1 for the Capital Preserver, and almost none for the Fundamental Investor. Some archetypes will often have a place sitting in cash, or will use "No Recognized Setup".

### Q6. The split between the two desks

**It isn't built.** The shares are fixed numbers frozen in the epoch: short 20%, medium 30%, long 40%, cash 10%. So today the archetype's share is 20% of the book and the agent's is 70%.

- **The smallest version:** a few presets, not a slider. For example 20 / 70 (today), 30 / 60 and 40 / 50, with the 10% cash floor unchanged.
  - The founder's example of 33% and 67% is, of the 90% that can be invested, the 30 / 60 preset.
  - A change opens a new epoch and applies to ideas admitted after it. Running ideas keep their size (IP-2).
- **Reporting how much is at work: yes, with no engine change.** The screen's view can work out each desk's share and its use from figures the book already stores. Tonight:
  - the archetype: $19,981 of $19,981, all of it, from Friday's buys;
  - the agent: $58,301 of $69,933, or 83%. The gap is the sector limit of Q1.

## 3. What the record carries today (the note's §5)

| # | Asked | As built |
|---|---|---|
| 1 | The desk, the archetype and its frozen settings on every idea | **Mostly.** Every idea records its epoch, and the epoch holds the archetype, its identity version, the limits and the rails. An agent-drafted idea also records its desk. **A founder-entered idea records no desk** (it is read from its slot). A small fix |
| 2 | The market's context at a line exit (IP-9) | **Not built.** The data is there: every idea keeps SPY's line and its comparison's line from entry to exit. Code can derive the tag at settlement. The threshold needs measuring |
| 3 | The risk at the line, on the screen, before entry | **Partly.** An entering idea knows each name's line distance, and the status shows it. The screen's "Entering" state doesn't show it yet, nor the dollars at risk. A small change to the view |
| 4 | On a short-slot test: the strategy, the verdict, the rule version, the plan | **Not built.** It is S1 |

## 4. The order I'd build it in

**Before Dec 4: nothing from the note.** Only B4, the first group's books.

**After launch:**

| # | Work | Kind |
|---|---|---|
| 1 | Measure the 10-session plan numbers, and count the overlap of the two stock lists | Read-only experiment |
| 2 | **Epoch 2:** the archetype switch for the short side, several setup places, the split presets, the Shadow desk's own sector limit, the desk on every idea | Build, money path, full review |
| 3 | **S1:** setups as the archetype desk's source; the label and plan on the record | Build |
| 4 | **S2:** the plan's own exits | Build, money path, after the measurement |
| 5 | The market-context tag at a line exit | Small build, after its own measurement |

- **Books created for players on Dec 2 start on epoch 1,** like the founder's. Epoch 2 must move existing books forward in any case, so creating them now adds no work.
- **The hub's redesign fits what is built.** The server builds the whole view and the client only draws it, so folding the Idea book into the Command Center is a client change plus a few new fields: the split bar's figures and the setup rows.

## 5. Rulings I'd bring the founder before step 2

| # | Question | My lean |
|---|---|---|
| R-a | How many setup places on the short side? | Three, as the hub's design draws |
| R-b | The split presets | 20 / 70, 30 / 60, 40 / 50 |
| R-c | Does the Shadow desk get its own sector limit? | Yes |
| R-d | After a switch, is the old short idea judged by its own archetype, or run by code alone? | Code alone, once plans exist |
| R-e | May an archetype's stop sit outside today's 3% to 8% short range (IP-8's open point)? | Decide from the measurement in step 1 |
| R-f | Does a player note ever reach a desk (Q3)? | Not as a way to exit |
