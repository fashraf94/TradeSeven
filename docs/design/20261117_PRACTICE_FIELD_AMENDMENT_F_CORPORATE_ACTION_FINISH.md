# Practice Field — Amendment F: the corporate-action finish

**Date:** 17 Nov 2026 · **Author:** the Practice Field chat · **Status:** the founder's rulings for T1a-2b-3; built dark, then given Astra's final review of the corporate-action path before `PRACTICE_FIELD_MODE` leaves `'off'`.
**Amends:** Amendment E (exits, settlement, results) and the T1a-2a share-basis class rule. Where this amendment and an earlier one disagree on the items below, this one wins.
**Destination:** `docs/design/20261117_PRACTICE_FIELD_AMENDMENT_F_CORPORATE_ACTION_FINISH.md`, committed as the first commit of the T1a-2b-3 branch (no docs-only PR).

## In plain terms

A held stock's share count is only as good as the corporate-action data behind it. This amendment closes the last ways a wrong count could slip through:
- **A day with no data now counts as a day of doubt,** not a day with nothing to report.
- **Actions missed during an outage are fetched later,** without disturbing the quarterly game.
- **A doubt holds only what it actually touches.**
- **The founder can rule on a hold the data will never clear.**
- **A dividend the vendor re-dates is paid once.**

Nothing here changes how money moves when the data is complete.

## F-1 · A day with no corporate-action data is a day of doubt (refuter R8, T1A-08's residual)

- **The close reads the session's daily document** (`mandateUniverseDaily/{session}`) in its own transaction, as admission and the sales already do.
- **Each idea records, per held symbol, the last session its corporate-action data covered** (`caCoveredThrough`). A session covers a symbol when that session's daily document holds a valid entry for it (F-6).
- **An uncovered session is a doubt about the symbol's share basis,** under the existing class rule. On that session's close:
  - nothing count-dependent runs for the symbol, on any ledger of the idea;
  - the close **carries** the previous mark, with a quality naming the missing coverage, instead of writing a fresh price over a count it cannot trust;
  - an in-session sale already waits on such a day; admission already refuses.
- **The doubt clears** when the data covers every session since `caCoveredThrough`.
  - If the gap fits the normal fetch window (`MANDATE_CA_FETCH_LOOKBACK_DAYS`), today's daily entry covers it, and the close applies what it lists in date, phase and id order.
  - If the gap is longer, the idea book asks the daily builder for a **backfill** of that symbol's actions from the day after `caCoveredThrough`. **Backfill rows are stored where only the idea book reads them; no quarterly reader ever sees them.** The doubt stays until the backfill succeeds.
- **From the fifth session of doubt, alert** `PRACTICE_FIELD_CA_COVERAGE_GAP` once per session. The founder may resolve the gap (F-5).
- **The time the flag was `'off'` is a gap like any other.** When the idea book returns, its first close finds the gap and backfills it.

## F-2 · Corporate-action rows come from the daily document (refuter R7a, R7b, R7d)

For admission, sales and the close, a symbol's action rows are **the union** of the session's daily document, read in the same transaction, and the snapshot's own copy. No row is dropped.

A price snapshot whose `dailyRef` does not name that session's daily document is not used. Admission refuses, a sale waits, and the close carries the mark.

## F-3 · The gap screen dates a gap from the mark's own session

A suspicion's window starts after the session the frozen mark actually came from: the holding's `lastMarkProvenance`. It no longer starts from `lastMarkAsOf`, which can keep an older quote's time (Astra, T2B-01's confirmation).

## F-4 · A doubt holds only what it touches (Q-O, Q-M)

- **A doubt about a symbol holds that symbol on every ledger of the idea,** as today. That covers a feed conflict, an unapplied or held action, a split-shaped price move, or a coverage gap.
- **A doubt in one paper ledger's own count holds only that ledger.** The idea's own cash and sale go on. Refuter 2's case is the example: a frozen-basket holding that a correct reverse split rounds to nothing.
- **At the endpoint:**
  - a comparison still in doubt makes the result `unmeasurable`, as today;
  - SPY in doubt leaves the result measurable, but the result names it: the symbol, the reason, and any paper dividend held and not paid.

## F-5 · The founder's resolution (Q-U, C-6)

One new founder action, **`resolve_hold`**, on the existing endpoint. It has the same two gates, idempotency on `requestKey`, and the uid taken from the token. It names the exact record it covers.

| Kind | What the founder rules | Effect |
|---|---|---|
| `suspicion` | `price_move`: the move was real. Or `split` with a ratio matching the recorded shape | It covers **exactly the recorded move:** its session, ratio and frozen mark. `price_move` pays the held cash once on the current count. `split` applies the split once at the next close, with a founder receipt. **Any later split-shaped gap, even an identical one, raises a new record** (closes Z1). A listed split applied after the ruling does not re-suspect the ruled move (Y4). A later move is judged against the fresh mark (N3) |
| `conflict` | One recorded payload, or `none` | Applied once at the next close, in date, phase and id order. This covers a conflict the feed has dropped (C-6) and a possible re-date (F-7) |
| `coverage_gap` | No action in the gap's dates, or one recorded backfill row | The doubt clears; the chosen row, if any, applies once at the next close |

The action refuses a record that does not exist, one already resolved, or one on a closed book. Every resolution records who, when, the request key and the record it covers. **A stuck sale with no quote is not in scope;** that is T5's tool.

## F-6 · One rule for a daily entry (refuter R3, R7c)

For admission, sales and the close alike:
- **A daily entry counts as covered** only when it is a plain object and `caFetchFailed` is absent or exactly `false`. Any other value (`false`, `0`, `''`, `'true'`, `1`, an array) is not covered.
- **A daily document whose own `date` differs from its key counts as missing.**

## F-7 · Re-dated and late actions (FR-A5, RF-A2, C-16)

- **A possible re-date.** A row with the same symbol, kind and amount or ratio as an action already applied or held, under a different id and with an ex-date within 5 sessions of it, is **not applied.** It is recorded `possible_redate`, naming both ids, and alerted. The founder may apply it through `resolve_hold` (`conflict`).
- **A conflict settled under a moved date.** A row under a new id, within 5 sessions, whose payload matches one of an unsettled conflict's payloads settles that conflict. It is applied once, and the old id is recorded as settled by it.
- **A late cash action.** A cash action dated before a share-basis action already applied, but first listed after it, is paid on the count the holding had **on its own ex-date.** That count is derived from the holding's applied share-basis receipts.

## F-8 · The receipt link

A share-basis row that explains a suspicion records the record it explained, and the record names the row. A suspicion closed by a founder ruling names the ruling.

## F-9 · The idea document's size (T2C-04)

At each close, measure the idea document before writing it. From 768 KiB, alert `PRACTICE_FIELD_IDEA_DOC_LARGE`. Receipts stay on the idea document unless Astra's review asks for them to move.

## F-10 · One register of open corporate-action items

The build report lists every corporate-action item raised since T1a-1, with its status: fixed in T1a-2b-3, closed earlier, accepted by ruling, or carried with a home. That covers C-5 to C-17, Q-P to Q-V, FR-A3/A5/A7, RF-A2 to A4, R7a to R7d, R8 and T2C-04. **This register is what Astra's final review starts from.**
