# Claude Design brief — the idea book, round 2: positions first

**Date:** 23 Nov 2026 · **From:** the Practice Field chat · **For:** Claude Design, run by the founder · **Due:** Wed Nov 25.
**Attach with this brief:**
- your round 1 file (`Idea Book - Round 1`);
- the founder's reference screenshot of a brokerage positions screen (thinkorswim).

**Deliver:** one HTML mock-up, phone first (390 and 320), then desktop.

## 1. What round 1 got right — keep all of it

- **The two voices.** An agent's words are quoted, signed and dated. The book's numbers are mono and never look like speech.
- **The two desks,** each with its own mark and lane.
- **The colour rule.** Up and down colours sit on numbers only, never on an agent's words or its call.
- **The line track** (entry, now, line, and the distance to the line).
- **Every state and every fixed string** from round 1.

## 2. What changes: the front page is a positions table

**The founder's direction:** people open the app wanting the result, clean and plain, in a shape they already know: **a brokerage positions list.** Everything else hangs off the positions: tap a row and it opens.

**The feeling to design for:** the player wakes up and thinks, *"What did my agents do, and where's the next opportunity?"* The front page answers the first half in one glance and makes the second half one tap away.

Round 1's front page was a long read: two ideas filled two screens. **Round 2's front page fits a full three-idea book on one phone screen.**

## 3. The front page, top to bottom

**A. The book line (compact)**
- Book value, large.
- Today's change, in dollars and percent.
- Since open, and SPY since open, smaller.
- Cash.
- "Paper money. Your agents run this book; you watch." as small print.

**B. The tab bar**
- **Positions** (the default) · **Desks** · **History**.
- **Leave room for two more tabs** to arrive later without a redesign. Draw the bar so five fit at 320 wide, or scroll. Draw one annotated variant with two later tabs greyed and labelled "later": **Growth** and **Meetings**. Don't design their content.

**C. The "since yesterday" strip**

One line per desk, saying what it did at the last close. For example:
- "Archetype desk · opened XOM, CVX"
- "Shadow desk · held 3 · passed on 3 drafts"

Tapping a line opens the Desks tab at that desk. **This strip is the hook: it changes every day.**

**D. The positions table**

The columns, as in the reference: **Symbol · Mark · P/L Open · P/L Day.**

- **Rows are grouped by idea.** Each group has a slim header row:
  - the slot (Short, Medium or Long);
  - the desk's mark;
  - "Day 4 of 30";
  - the idea's gap against its comparison ("+$84.20 vs XLF").
- **Under the header, one row per name:**
  - the symbol;
  - the mark;
  - open P/L in dollars;
  - the day's P/L.
- **A "NEW" tag** on any name bought since the last session. It should be small and clear, and gone the next day.
- **An empty slot** is one slim row: "Long · open · the Shadow desk looks tonight."
- **A cash row** at the foot.
- **A quiet timestamp:** "Marks as of the close, 27 Nov." These are not live prices. Don't imply they tick.

**E. Tap to expand**
- **Tap a name:** it opens in place to show:
  - entry, now and line, with the line track and distance;
  - the idea's thesis, quoted;
  - today's call and reason, quoted;
  - the source chip.
- **Tap an idea's header:** the whole idea opens: every name, the gap against its comparison and against SPY, sessions left, and the call.
- One row open at a time. The table must stay readable with one row open.

## 4. The other tabs

- **Desks:**
  - each desk's note for today, quoted and dated;
  - its call on each idea;
  - **"Ideas the desk passed on"**, the drafts it considered and why each was admitted, not chosen or refused.

  This is the "where's the opportunity" page, so give it some life.
- **History:** finished ideas, each with its result words and its gap. Tap for the five-column result.

## 5. The states, redrawn in the table

Draw all ten states from round 1 in the new front page. Pay most attention to:
1. **A full book** on one screen at 390 and 320.
2. **A new book:** one idea entering, two open slots. Entering names show "Buys at the next session's first window" in place of a mark.
3. **New today:** two names with the NEW tag, and the strip naming them.
4. **Near a line:** the row draws the eye without alarm. Use weight, not red.
5. **A line hit:** the row reads "Sold at its line by code · {date}", dimmed, in its group.
6. **An exit called:** the header row reads "Exit · sells at the next session's first window".
7. **Waiting on data:** the row shows "Waiting on data" in place of its P/L, and it's quiet.
8. **A failed check:** the strip reads "The agent could not complete today's check; nothing changed."
9. **Paused.**
10. **One row expanded,** for a name and for an idea header.

## 6. Rules the design must keep

Everything in round 1's §6 still holds. Plus:
- **Four columns at 320 wide,** with a four-name idea, a NEW tag and five-figure dollar amounts. If something must give, drop cents before dropping a column.
- **No buttons that trade,** in the table or the expansion.
- **The desk's mark appears on every group header,** so the team is visible without leaving the front page.
- **Nothing on the front page needs reading to be understood.** Words live one tap in.

## 7. What comes back

One HTML file holding:
- the front page at 390 and 320, for all ten states;
- the Desks and History tabs at 390;
- the desktop layout for states 1 and 2;
- the Command Center entry card, updated if the front page changes it;
- a short note on any place where the fit rule forced a choice.
