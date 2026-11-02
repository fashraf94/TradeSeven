# Cut for the Stock Research Modal chat — the Command Center's record in the modal

**From:** the Command Center chat · **Date:** Nov 2, 2026 (revised the same day: §4 now says how each capability is worked in, and the Phase 0 addendum gained question N) · **Status:** the founder's direction, for the modal chat to fold into its documents of record (a V2 amendment and the Phase 0 prompt). The modal chat owns the modal; this cut proposes, it does not rule.
**Governing document:** `COMMAND_CENTER_PURPOSE_V1_1.md` (attached; project copy `claude/COMMAND_CENTER_PURPOSE_V1_1_NOV02_2026.md`). The loop is Discover → Decide → Deploy → Debrief; the unit is the idea; **the lens is the pilot's idea record** (`watchlists/{id}/hypothesisVersions`); Shadow explains and proposes in Shared Research; the archetype trades.

## 1. The founder's split, confirmed

Two modals by entry point, as R-1 already rules:
- **In battle:** the archetype's lens. Its voice is the equipped archetype (R-12), its charts include Bomb mode because the thresholds hang off the entry price, and its door is **→ Cockpit**.
- **Browse** (search, Discover, FantasyTimes, the hub): the research modal. No Bomb charts. Its door is **→ Shared Research**, once that exists.

Each mode has one partner and one door. Shadow's conversation happens in Shared Research, not inside the modal; the modal shows Shadow's *work* as records with provenance ("proposed in research · Nov 2"). R-12 and S-4 stand.

## 2. Proposed rulings (the modal chat's numbering continues from R-18)

**R-19 · The loop's record is a record source, not a tab.** Everything the Command Center writes about a stock is already a record. The modal reads them where its design already has a place for them; no "Shadow" tab.

| Record | What it says about this stock | Lands in the modal as | Mode | Exists today |
|---|---|---|---|---|
| Idea record(s) whose list holds the stock | the statement, when it's live, what proves it wrong, status, grade | the **stance line** (*In your idea "{statement}" · testing since Tue · can't tell yet* / *Not in an idea yet*) and the lines on the chart (R-20) | both | yes, allowlist-only |
| `symbolDayEvidence/{etDate}_{SYMBOL}` | what moved and why, typed, dated, sourced | the tucked row's **News it read** (replacing the raw feed) and event pins on the chart (§4, #1) | both | Huddle S1 writes price/news; reporters slice types the rest |
| `themeDayEvidence` | the theme it moves with | a **Theme** chip beside Sector (§4, #5) | browse | reporters slice (owner: FantasyTimes/Wire arc) |
| Today's Huddle plan item naming the stock | the player's instruction, with its receipt | the existing **What you told it** row, *from this morning's huddle* | in battle | Huddle S1 |
| `setupEvidence` (per session, per stock) | what the archetype's setup rule said | the Technical tab's Daily-setup row (R-17) and its history (§4, #2) | both | on main (PR #1018) |
| Research record (`researchWork`) cited by the idea | the investigation behind it | the stance line's *from research ›* disclosure; the six-lens card's first source (§4, #6) | browse | yes (pilot P2) |

**R-20 · The idea on the chart.** An idea record's conditions are typed price levels (`{symbol, side: above|below, level, basis: daily_close}`, `hypothesisRecords/model.js:100–110`). When the stock sits in one of the player's ideas, the chart draws them:
- two lines, labeled in plain words: *live above $154 · wrong below $147*;
- each daily close since the idea's first deploy as a dot on the right or wrong side of its line;
- the stance reads the running record (*held 3 of 4 days* / *can't tell yet*), from the idea record's review evidence, never computed in the modal.

One drawing on all three clocks (R-16): live in the modal, replay in the Film Room (where the lens is graded), drill in the Practice Field. No model call, no new store.

**R-21 · "My read" is the seed of an idea record.** V2 §2.2 stores My read on the agent's record with user provenance. Purpose V1.1 §6 says one record per idea. A player's read on a stock *is* a draft idea, and the record already has an origin for it (`manual`) and a state reason (`player_authored`). Build D files My read as a draft version on a one-stock list through the existing route (`api/forge/watchlists/[id]/hypothesis-versions.js`), with the direction and horizon chips mapping to `horizonEnum`. Browse's action row becomes *Watchlist · Work this idea*. Until Shared Research exists, *Work this idea* files the draft and stops; after, it opens Shared Research with the stock preset.

**Honesty, unchanged:** the review's line ("[AGENT] doesn't act on your ideas yet…", `src/constants/hypothesisRecords.js:208`) governs every surface above until a receipt shows a game picked from the idea's universe (Huddle S2). The modal says how the idea's names did, never "your agent traded your idea."

## 3. Phase 0 addendum (paste after the Phase 0 prompt, in the same session)

Attach `COMMAND_CENTER_PURPOSE_V1_1.md` as a ninth attachment. Read it after the build plan. Then answer four more questions under the same rules (cite `file:line` at HEAD; VERIFIED / REPORTED / UNKNOWN):

**K. Ideas by symbol.** Idea records hang off a watchlist (`watchlists/{id}/hypothesisVersions`, read by `listHypothesisVersions(watchlistId)`). For one symbol, how would the modal find every idea of the player's whose list holds it, and the newest version of each? Does an index or a collection-group query exist, or is it "the player's lists, then filter"? What does the hub's reader (`src/components/CommandCenter/hub/useHubResearch.js`) do today, and can the modal share it under the mount guard's one-reader rule? What does a battle carry (`equippedHypothesis`, `hypothesisRecords/carriage.js`) that the in-battle modal can read without a second query?

**L. The idea on the chart.** The conditions' shape (`model.js:100–110`) and the review evidence's shape (`review.js` ≈ :41, `{computedAt, source, window, names[], list, market}`). Can `src/components/Research/StockChart.jsx` draw a condition as a level through the same path as support/resistance and the receipt's stop and target (the W-1 `onToggleSR` prop)? Which daily-bar source gives the closes since the idea's first deploy, and is it already loaded for the 1D/1W chart? Report whether the "held / didn't / can't tell" mark exists anywhere yet (expected: it does not; the Film Room's slice adds it), so the modal's stance in V1 reads *testing since {date}* and the review's names-vs-market line, nothing more.

**M. The other per-symbol records.** `symbolDayEvidence`'s shape (from the Huddle S1 branch `claude/huddle-s1` if pushed; else from its spec Amendment C V1.1, which the founder attaches), `setupEvidence` by symbol (§G already), and whether a Huddle plan item names a symbol in a way the in-battle modal can match. **Re-target §I:** map "my read" onto the idea record (origin `manual`, R-21) and list what the record lacks for it; map the modal's Ask exchange onto `researchWork` and `chatExchanges[]` and say which one an investigation in Shared Research would share.

**N. The doors for §4's capabilities.** Check only that each door exists; design nothing.
- **Dated markers on the chart:** `StockChart.jsx` already sets bomb-crossing markers on a series (`setMarkers`, ≈ :484–489). Can the candlestick series take dated markers from a record source the same way, and what does the News row read today (`agentNewsContext.js`, the FantasyTimes feed, or something else)?
- **Setup evidence by symbol across sessions:** the snapshot's id is `${session}__${symbol}__${ruleKey}` and the document stores the triple as fields (shape note V1.5 §3; verify in `setupEvidence/acquire.js` ≈ :128). Does a by-symbol, by-rule-set query need only an index, and which one? What does "what followed" need: the next sessions' snapshots, or the chart's own daily bars?
- **Research records by symbol:** `researchWork.symbols[]` is an array of objects (`researchRecords/model.js:18–19`). Can a record be found by `userId` and symbol today, or would it need a plain `symbolKeys` array? Report, don't add.
- **The pack's two loop items:** confirm that `equippedHypothesis` on the battle and a plan item naming the symbol can be rendered as R-15 pack items (fact · source · timestamp · pin) with no new shape.

Add the K–N rows to the verdict table. Everything else in the prompt stands.

## 4. How the six capabilities are worked in

The founder asked which capabilities a research agent opens up for the modal, and wants them worked in. The rule that makes this cheap: **every one is a reader in the modal over a record another arc writes.** None adds a model call beyond the ones the design already budgets, and none adds a store. So each lands as a small reader slice in the modal when its writer lands, and Phase 0 checks the door now (§3 N) so no build has to reopen the chart.

| # | Capability | Who writes the record | Where it lands in the modal | Modal build | Gate | What the writer must carry |
|---|---|---|---|---|---|---|
| 1 | **Event pins on the chart.** Tap a candle, see the typed cause: *earnings · beat by 4% · source* | reporters → evidence (FantasyTimes/Wire arc) into `symbolDayEvidence` | browse and in battle: markers on the candlestick series; the News row lists the same items | **E** (new, small) | reporters → evidence on main | each item: `etDate`, symbol(s), a kind (earnings / release / press_wire / fantasytimes_story / macro), a source, one short label |
| 2 | **Setup history.** *This rule read BREAKOUT on 3 of the last 10 sessions*, each with what followed; the activation pointer *Trend Follower entered this name under the Oct 21 snapshot* | framework (ID-1): the store, on main; the observer (Build 2, pending) | the Technical tab, under the Daily-setup row (R-17) | **B** (extended) | ID-1 store (done) for the history; the observer for the pointer | a by-symbol index on `setupEvidence`; filed by Build B as a cut to the framework chat if N finds it missing |
| 3 | **The pack carries the loop.** The in-battle pack gains the idea's statement and today's plan item; the Ask answers with both in view | none new: the battle's `equippedHypothesis` (carriage) and the Huddle plan record | the evidence pack, two deterministic items (R-15) | **C** | C's own gate; the plan item needs Huddle S1 on main | nothing |
| 4 | **The idea's reading, replayed.** *How would this idea have read over the last 20 sessions*: the conditions against stored daily bars, a dot per day. Labeled *how it would have read, not how it would have traded* | none new: the idea record and the daily bars | the drill clock (R-16) | Practice Field's arc, after C ships the boundary | C merged; the Practice Field arc resumed | nothing |
| 5 | **Theme membership.** *Moves with {peers} this week*, beside the static Sector tab | reporters (themes beat) into `themeDayEvidence` | browse: a Theme chip beside Sector | **E** (with #1) | `themeDayEvidence` spec'd and on main | a theme record listing member symbols by `etDate` |
| 6 | **Read the loop's research instead of buying new.** When an investigation already covers the stock, the six-lens card shows its result before any cached voice call (R-3) | Shared Research into `researchWork` | browse: the six-lens card's first source | **D** | D's gate plus Shared Research's first slice | `researchWork` findable by `userId` and symbol (N says whether that needs a `symbolKeys` array; filed by Build D) |

Three notes:
- **Build E is the only new build**, and it is small: two readers (event pins, the Theme chip) on surfaces C already built, gated on the reporters' slice. Everything else rides C, B and D as written.
- **The writer requirements** in the last column are the modal's only asks of other arcs. The reporters' two go into that slice's spec when it is written (the Command Center chat carries them until then). The framework chat's two are filed by the modal build that needs them, with Phase 0's N answer attached, not now.
- **Nothing above gives the modal a voice or a store of its own.** That is what keeps the six cheap and honest.

## 5. Sequence

1. **Phase 0 with the addendum (K–N)**, now. It is read-only and needs no other arc.
2. **The Shared Research feasibility review** (Command Center chat), with the Phase 0 report read from its branch. Its kickoff V2 is already amended for this.
3. **Build A (Bomb mode):** unchanged, no dependence.
4. **Build C (the sheet):** its record source now includes the loop's records (R-19, R-20) and the pack's two loop items (#3). Its gate stays as the plan writes it, plus the feasibility report.
5. **Build B (Technical):** R-17 plus setup history (#2), once Phase 0's N says how the store is read by symbol.
6. **Build D (six lenses + My read):** R-21 and research-first (#6).
7. **Build E (event pins, Theme chip):** #1 and #5, when the reporters' slice lands.
8. **The replay (#4):** the Practice Field's arc, on the drill clock.
