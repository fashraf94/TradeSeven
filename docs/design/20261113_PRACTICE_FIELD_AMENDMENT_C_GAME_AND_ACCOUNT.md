# Practice Field Amendment C — the game and the account

**Date:** 13 Nov 2026 · **Author:** the Practice Field chat · **Amends:** concept V6.1 (`docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md`) and shared contract V2 with its Amendments A and B · **Source:** the founder's direction note "the game and the account", 13 Nov 2026 (`docs/design/20261113_DIRECTION_NOTE_GAME_AND_ACCOUNT.md`, SHA-256 `1cb831affce313fde41e8904603e5f7530079b32dfa75fca8f1d91b0d76c495a`), rulings 2–6, 10–15 and 17–20 · **Status:** the rulings are adopted. This document records how they land. Items marked ◇ are this chat's readings and stand unless the founder objects. Items marked **Astra first** are not built until Astra's pass (brief of 13 Nov) · **Destination:** `docs/design/20261113_PRACTICE_FIELD_AMENDMENT_C_GAME_AND_ACCOUNT.md`, committed by the T1a-1 build with the direction note. No docs-only PR.

Repo facts below were read at `main` `d9b4e3c1` (13 Nov 2026).

## 0. In plain terms

- **BaggerBomb is what you play; the idea book is what you check.** The idea book is the player's one paper account. Nothing else holds paper money.
- **The agent looks at the book five times a day** instead of two: a note before the open, three windows where it may act (11:00, 13:00 and 15:30 Eastern), and a note after the close. Code looks at every window; the model is called only when something needs a decision.
- **What the player sends is answered at once and read the same day.** A drop gets a receipt immediately, built by code. The agent reads it at the next intraday window. A running idea is never cut short to make room.
- **Two reports arrive in the Command Center:** one after every close, built by code, and one each weekend, written by the agent from the ledger's figures only.
- **Three accounting promises are now written requirements:** a missing price never produces a fill; a valuation is never reported as a sale; every book is valued from the same snapshot.

## 1. What does not change

V6.1's loop, the three slots and their lengths, the rails, the matched comparisons, the risk rule, the five-column result and its words, "no buttons in the book", the Forge as the only decision, the $100,000 book, the $3 monthly bound, and rulings 1–16 and 18–26 except where §2 names a change. T0a, T0b and T0c are untouched. T1a-1's accounting is unchanged; it gains three checks, one field and one assertion (§7).

## 2. Changes to concept V6.1

| V6.1 | Was | Now | Ruling |
|---|---|---|---|
| §1 promise | A portfolio that follows ideas | The same, named as **the player's one virtual account**. No second paper account, no revival of the quarterly Mandate product, no portfolio inside the league bracket | 3 |
| §2 "Two checks a day" | Two model checks, pinned for every archetype | **Five windows, the same for every archetype** (§3). One action per intraday window; the two notes never trade | 13 |
| §2, §13 manager cost | One model call per check | Code looks at every intraday window; **the model is called only on a trigger** (§3). Notes go by batch | 14, 15 |
| §3, §4 | Positions belong to ideas by construction | Stated as a rule and tested: **every position belongs to an idea.** How ideas combine stays code rails in release 1 | 4 |
| §5 sources, ruling 18 | Five sources | **Six:** research is added (deep-dive and Work an Idea records, with the attribution stamp those records already carry). **Every idea carries its origin** | 6 |
| §5 "How ideas enter" | Drafting runs when a slot opens | Drafting for an open slot runs **at the next intraday window** after a new input. **Astra first** | 19 |
| §7 "What the player sees" | The book screen | Adds: the two notes, the daily and weekend reports as read-only Command Center cards, and a receipt for every input | 10–12, 17, 18 |
| §9 the manager's inputs | Settings snapshot, book state, headroom | Adds: a player input about a held name, at the next intraday window. **Astra first** | 19 |
| §9, ruling 17 | Nothing from the book reaches any prompt outside the book | One narrow widening: the Huddle may **speak** the notes and reports. Voice only, never the trading brain, memory or consolidation. **Astra first** | 17 |
| §13 cost | Two-check table | §9 of this document | 13–15 |
| §15 order of work | T0–T6 | §10 of this document | — |
| §17 limits | — | Adds ruling 8: the account is **a trading record under paper conditions.** It shows discipline and risk handling per player; evidence about beating the market builds only across many players per archetype | 8 |

Rulings 1, 7 and 9 need no change here: BaggerBomb scoring is outside this arc, the leaderboard is a later ruling, and the Forge revamp is its own arc that needs only contract §8's offer slot.

## 3. Five windows

| Window | Eastern time, regular session | Who acts | May trade |
|---|---|---|---|
| Pre-market note | Before the open, ready for the Huddle | Model by batch; a code-built line if the batch has not returned | No |
| Intraday 1 | 11:00 | Code always; the model on a trigger | Yes, one model action |
| Intraday 2 | 13:00 | Code always; the model on a trigger | Yes, one model action |
| Intraday 3 | 15:30 | Code always; the model on a trigger | Yes, one model action |
| Close note | After the close snapshot | Model by batch; a code-built line if the batch has not returned | No |

**Code's duties at every intraday window, with or without the model:** basket entry, line exits, settlement liquidation, and risk-budget trims. These never wait for a trigger.

**Triggers that call the model** (ruling 14), each recorded on the window's row:
1. a held name within the near-line threshold of its line;
2. a held name or an idea moved beyond the band since the last window the model saw;
3. an idea coming due within the due-soon threshold;
4. a new source for an open slot (this calls drafting, not the manager);
5. ◇ a queued player input about a held name (follows from ruling 19; **Astra first**).

**No trigger** writes "no change" on the window's row and makes no model call. The thresholds are blessing slot B10 (§8), unset until T1b measures them.

**The check ledger becomes the window ledger:** one row per book per window per session — the window, the triggers that fired, whether the model was called, what it did, what code did. Expected five rows a session; a missing row is visible.

**Notes.** `mandates/{bookId}/notes/{sessionDate}_{pre|close}`: the text (at most 600 code points), `source: 'model_batch' | 'code_fallback'`, the model and epoch, the times. Written by the book's own manager seat. A batch result that arrives after its fallback was shown is recorded as late and labelled; it never silently replaces what the player already read.

**Engine facts T1b must design around.** The engine's three slots sit at 10:00, 12:45 and 15:30 Eastern, each open for 30 minutes; only the last matches a founder window. Its cron fires from 14:00 UTC, which is 10:00 Eastern in summer, so a pre-market job needs earlier hours or another worker. The batch transport exists and has never run in production. A sweep pages 25 books. An early-close session ends at 13:00.

◇ **Early-close sessions:** intraday windows at 11:00 and 12:30 (30 minutes before the close, the engine's own rule), then the close note. The 13:00 and 15:30 windows do not run.

◇ **Entry timing is unchanged in T1a-1:** an admitted idea enters at the first window of the next session. Whether an idea whose every symbol is already on the shared price list may enter at a later window the same session is asked of Astra with ruling 19.

## 4. Player input and receipts (rulings 18–20)

**One record serves all of it: the nomination** (contract §5.2), which already names SignalDrop ids and card ids as sources.

◇ **What counts as a player input:** a deliberate offer — a SignalDrop pick, a Film Room card offered to the agent, a research record sent to the agent, and later a Huddle disagreement (direction note ruling 22). Conversations and game moments stay passive sources: drafting reads them when a slot is open, and they get no receipt.

**The receipt is built by code in the same request, with no model call** (ruling 18). It is the nomination's `standing`, shown to the player:

| `standing.route` | When | What the receipt says |
|---|---|---|
| `open_slot` | A slot the input fits is open | Heard; the agent considers it at the next intraday window, named |
| `held_name` | The input names a ticker an idea holds | Heard; the agent reads it at the next intraday window and may act or decline |
| `waiting_for_slot` | Every fitting slot is full | Heard; the slot opens by a named session at the latest, sooner if the idea exits at its line |

Later the same record carries what the agent did and why: `accepted` (with `outcome: { kind: 'idea', ideaId }` or `{ kind: 'management_action', decisionId }`), `deferred` or `declined` with the reason, as Amendment B's order table already has it.

**Timing (ruling 19, Astra first).** An input is read at the next intraday window; outside market hours, at the first window of the next session. Input for an open slot is drafted at that window, and the bound of one refill attempt per slot per session stays. Input about a held name goes to the manager at that window as one trigger. Entry still needs reserved coverage, so a name outside the shared price list may enter a session later.

**Bounds (ruling 5: more drops do not mean more influence).** Receipts are unlimited and free. Reading is bounded by slot B12 (§8): one held-name input per idea per window; one drafting call per open slot per session reading the newest inputs inside the existing source envelope. An input past a bound says so on its receipt.

**Never cut short (ruling 20).** No input changes a running idea's due session or exits it. An input not considered within 10 sessions expires with `not_considered`, as B6 already says.

◇ **This changes Amendment A R6 and Amendment B item 7 in one respect:** the consideration call for a Film Room card runs at the next intraday window, not at the moment of nomination. The Film Room's built code is unaffected: its nominate transaction writes `queued`, and the receipt text comes from `standing`.

◇ **In release 1 the `held_name` route takes SignalDrop and research inputs.** A card naming a held ticker is settled in T2's prompt.

## 5. Reports (rulings 10–12, 15, 17)

| Report | Built by | When | Holds |
|---|---|---|---|
| End of day | Code, no model call | After the close's rows | The book's value and its change against SPY; each idea's state; the day's actions with the agent's stored reasons quoted as written; what comes due next; the close note beside it |
| Weekend | One model call per book per week, inside the $3 bound | The weekend | The week per idea, from the ledger and the stored reasons. It may state only figures the ledger holds |

**Home.** `mandates/{bookId}/reports/{daily_YYYY-MM-DD | weekly_YYYY-Www}`, server-write, owner-read.

**"Only figures the ledger holds" is enforced by code, not by instruction:** the weekend prompt receives a figures table; every number in the returned text must match a figure in that table; a report that fails the check is not shown, and the code-built weekly version is shown in its place and labelled.

**Both are read-only cards in the Command Center** (ruling 12). Placement is settled with the book's screen package. Neither is part of T1a.

**The stored reasons gain their first readers.** T0b's tripwire (`api/_utils/mandateRationale.imports.test.js`) pins that nothing reads a stored reason. The end-of-day report reads it for display to the owner. The weekend report and, if Astra agrees, the notes read the same book's reasons into a book-side prompt. Each new reader is a deliberate change to that pin, made in the build that adds it, and each prompt assembler joins the Mandate honesty registry.

**Voice (ruling 17, Astra first).** ◇ This chat's lean, put to Astra: the Huddle speaks the notes and reports as **a beat narrated by code**, the way its plan beat already is (`api/_utils/huddle/scriptPrompt.js`: "the plan beat is never written by the model"). Stored text is spoken as written and the Huddle's script model never receives it. Under that design ruling 17 of V6.1 needs no widening for the Huddle, and book content cannot shape the plan the Huddle proposes for battles. Whether Shadow may discuss a report in conversation remains a separate ruling (direction note ruling 12).

## 6. Changes to shared contract V2

| Contract | Change |
|---|---|
| §3 table, `cadenceTier` | Not used by an idea book. The epoch carries `windows` instead: `null` until T1b writes the five-window schedule version |
| §3.1 epoch | Adds the windows version and the trigger-threshold version (B10) |
| §4.1 contract | Adds **`origin: { kind, initiatedBy }`**, frozen at admission. `kind` is one of `signaldrop`, `conversation`, `game_moment`, `film_room_card`, `research`, `agent_prior_ideas`, `founder_fixture`. `initiatedBy` is `player` when the idea answers a nomination, otherwise `agent`. Each source reference becomes `{ kind, ref }`, and the origin's kind must match at least one source, except `founder_fixture` |
| §4.2 sub-ledger | Every row carries the close snapshot's key and time; every mark carries its own observation time; a row is a mark and is named as one |
| §4.3 lifecycle | Entry, line exits and settlement liquidation happen at intraday windows by code and use one shared eligible-mark rule. No fallback to a carried mark or to cost basis |
| §5.1 sources | Adds research: deep-dive records and Work an Idea records (`researchWork`, `sharedResearchSessions`), using the attribution those records stamp at source time |
| §5.2 nominations | Adds `standing` (§4 here) and `outcome`; adds the source kinds `signaldrop` and `research`; consideration at the next intraday window |
| §9 one-door exception | Two widenings, both **Astra first**: a player input about a held name may reach the manager's prompt; the Huddle may speak notes and reports. Adds the weekend report's assembler and the notes' assembler as book-side prompt paths, registered like the other two |
| §12 capacity | The check ledger is the window ledger (§3 here) |
| §13 slots | Adds B10–B12 (§8 here) |
| §14 acceptance | Adds cases 19–29 (§7 here) |

## 7. New acceptance cases

19. **B-NOFILL.** With no eligible mark for a symbol, no fill of any kind happens on it: not an entry, a trim, a line exit or a settlement sale. The engine's exit fallback to a carried mark or to cost basis never applies to an idea book.
20. **B-MARK.** A valuation row never changes any ledger's cash and is never reported as a sale. Sale proceeds appear only from a fill with its own receipt.
21. **B-STAMP.** Every ledger of every idea book valued for a session date carries the same close snapshot key. A replayed or late close for that date reads the same snapshot or writes nothing.
22. **B-OWNED.** Every position in an idea book carries the id of an existing idea. A fill without one is refused.
23. **B-ORIGIN.** An idea without a valid origin, or whose origin matches none of its sources, is refused at admission.
24. **B-WINDOW.** A window with no trigger records "no change" and makes no model call. A window with a trigger makes at most one model action. The pre-market and close windows never trade.
25. **B-NOTE.** A note whose batch has not returned by its deadline shows the code-built line, labelled. A late batch result is recorded as late.
26. **B-RECEIPT.** A deliberate input has a receipt in the same request, with no model call, and its standing matches the book's state at that moment.
27. **B-NOCUT.** With every slot full, no input changes a running idea's due session or exits it. The receipt names when the slot opens. An unconsidered input expires at 10 sessions with `not_considered`.
28. **B-FIGURES.** A weekend report containing a number absent from its figures table is not shown; the code-built version is.
29. **B-VOICE** (Astra first). With a populated book whose notes are spoken, the deployed agent's battle and draft prompts, memory and consolidation writes, and the Huddle's proposed plan are identical to the empty-book case.

T1a-1 covers 19–23. The rest belong to the packages in §10.

## 8. New founder slots

| Slot | Meaning | Value |
|---|---|---|
| B10 | Trigger thresholds: near-line, move band, due-soon | Unset. Set from T1b's measurements, then blessed |
| B11 | Text bounds: a note; a weekend report | 600 code points; ◇ 2,000 code points |
| B12 | Input reading bounds: held-name inputs read per idea per window | ◇ 1 |

## 9. Cost (planning figures at $0.015 per check, measured in T1b)

| Per player per month, 21 sessions | Checks | With drafting and the weekend report |
|---|---|---|
| Two checks, as V6.1 | $0.63 | about $0.78 |
| Five checks, all direct | $1.58 | about $1.73 |
| Five windows, model called at one in three intraday windows | about $0.63 | about $0.80 |
| Five windows, model called at every intraday window | about $1.26 | about $1.40 |

Every row sits inside the $3 bound. T1b also measures two reductions: ordering the prompt so the part shared by every book on an archetype is cached across the sweep, and a smaller prompt at windows where only prices changed. The limits that bind first remain the shared price list's size and the untested number of books per window, not dollars.

## 10. Order of work, revised

| # | What changes |
|---|---|
| T1a-1 + T1c | Gains ruling 2's three requirements with a source check against the engine, the idea's origin, and the every-position-owned assertion. The epoch no longer pins two checks. Accounting otherwise as written |
| T1a-2 | The check ledger is built as the window ledger. Line exits and settlement sales use the shared eligible-mark rule. States the policy for a holding that never gets a price |
| T1b + T1d | Gains the five-window schedule, the triggers and their measured thresholds, batch notes with the code-built fallback, the two prompt-cost reductions, research as a source, and origin set by drafting. Reading a player input at a window, by the manager or by drafting, is built only after Astra's pass |
| T1e | Unchanged. Trims run at intraday windows |
| T1f | Unchanged |
| **T1g (new)** | The end-of-day report by code, the weekend report with its figures check, and the read-only Command Center cards for notes and reports. After T1b, alongside T1f |
| T2 | Nominations widen to SignalDrop and research inputs, with the code-built receipt and consideration at the next window |
| T3–T6 | Unchanged. The leaderboard (ruling 7) is ruled on after the first books have run |
| Huddle voice | The DRB chat's S2, after Astra's pass on ruling 17 |

## 11. One-way notes. No reply needed

- **Film Room chat:** §4's change to the consideration call's timing. Nothing in C1 changes.
- **DRB chat (Huddle S2):** §5's lean that the book beat is narrated by code, pending Astra.
- **Hub chat:** two read-only Command Center cards (notes and reports) are coming in T1g; placement is settled with the book's screen package.
