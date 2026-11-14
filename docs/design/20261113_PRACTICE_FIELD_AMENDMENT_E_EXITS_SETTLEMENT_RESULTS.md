# Practice Field Amendment E — exits, settlement and results

**Date:** 13 Nov 2026 · **Author:** the Practice Field chat · **Amends:** concept V6.1 §4 and §8, shared contract V2 §4.3, §4.4 and §14, as amended by A to D · **Status:** proposed rulings. Items marked ◇ are this chat's leans and stand unless the founder objects before T1a-2a runs · **Destination:** `docs/design/20261113_PRACTICE_FIELD_AMENDMENT_E_EXITS_SETTLEMENT_RESULTS.md`, committed by the T1a-2a build. No docs-only PR.

## 0. In plain terms

- **A price line is a stop on one stock, not on the whole idea.** If one of three names closes below its line, code sells that name the next morning. The other two keep running to the review date. The idea's record says its line was breached, and when.
- **The comparison never trades.** It just holds what it bought on day one. So every stop is judged against simply holding.
- **An idea is judged at its review date, or earlier if it has no stocks left.** Both sides are valued the same way at the same close: what they would fetch if sold at that close, after modelled costs.
- **No clean price, no verdict.** If a price the verdict needs is missing, the result reads inconclusive, and a sale that has no price waits rather than using an old one.
- **A missed day is filled in from stored prices or marked unobserved.** A clock is never extended.

## 1. The rulings

| # | Ruling |
|---|---|
| E1 ◇ | **A line exits its own holding only.** When a full-quality completed-session close of a held name is strictly below that holding's line, that holding, and no other, is sold by code at the next eligible observation. The idea keeps its other holdings and runs to its due session. Its contract condition reads `breached` from that close, with the holding and the session recorded. *The alternative, which the founder may choose instead: any line ends the whole idea.* |
| E2 | **An idea with no holdings left resolves early.** When its last holding has exited, its endpoint is the close of the session in which that exit filled. Its result is written at that close and its slot frees. |
| E3 | **The comparison and SPY never trade after entry.** They hold their entry quantities to the endpoint, changed only by corporate actions. |
| E4 | **The endpoint is a liquidation value, computed the same way on all three ledgers:** cash, plus the remaining holdings at the endpoint close's marks, less the modelled cost each ledger's own cost policy would charge to sell them at those marks. The idea's real sale the next morning has its own receipts. The difference between its proceeds and its endpoint value is recorded as liquidation slippage and is not part of the result. |
| E5 | **Each holding keeps the cost tier it entered with,** for its line exit, its settlement sale and the endpoint. Since Amendment D's Q-1 lean, no holding enters with an unknown tier. |
| E6 | **Lines are read only on full-quality closes.** A session whose close for a held name is not full quality records that line as unobserved for that session. The contract condition is `breached` if any line was recognised; otherwise `unobserved` if any line went unobserved on any session from entry to the endpoint; otherwise `met`. The number of unobserved line-sessions is recorded. |
| E7 | **On the due session the due date wins.** A close below a line on the due session is recorded as `breached`, and there is one sale: the settlement liquidation. |
| E8 | **Within a window, sales come first:** line exits and settlement sales, then entries (B-ORDER). |
| E9 | **A sale with no eligible price waits.** It never fills at a carried mark or at cost. The idea keeps its slot and shows "waiting for a price"; its process quality reads `blocked`. After five sessions waiting, an alert fires. A founder tool to resolve it is T5. |
| E10 | **An economic label needs full-quality endpoint marks.** If any endpoint mark of the idea or its comparison is not full quality, the economic result is `unmeasurable`, shown as inconclusive. SPY is context and carries no label. |
| E11 | **Corporate actions.** A ticker change renames the holding on every ledger, its line and its coverage, with no cash change. A delisting is never applied as a sale. With a cash amount per share it is credited as a receipted corporate action, like a dividend, on every ledger that holds the name, and the holding closes. Without one, the holding becomes a waiting sale (E9). |
| E12 | **Missed closes are caught up before the next close, from stored snapshots only.** A session with no stored close snapshot gets an `unobserved` row. Nothing is fetched or invented. A breach found while catching up is recognised late, and recorded as late; its sale fills at the next eligible observation. Clocks are never extended: an idea whose due session fell in the gap is settled from that session's stored snapshot, or its economic result is `unmeasurable`. |
| E13 | **A draining book gets every code duty** (sales, settlement, valuation, catch-up) and no entries or admissions. |
| E14 | **Status flow.** `holding → line_hit_exit_pending → holding` while other holdings remain. `→ settled` at the endpoint, when the endpoint and the result are written. `→ resulted` when the liquidation has filled, the cash is back in the treasury and the slot is free. An idea that resolves early with nothing left to sell goes `settled → resulted` at the same close. |
| E15 | **Process quality in release 1, before any model acts:** `followed_plan` when every code action filled at its first eligible window; `blocked` when any line exit, settlement sale or endpoint valuation waited for data. `deviated` is reserved for the manager's own actions (T1b). |
| E16 | **Fixed in release 1:** `evidenceScope: single_forward_observation`; `adoption: no_offer` until T3; `closingNote: null` until T1b writes it. |
| E17 | **Admission's calendar check covers the session after the due session,** where the settlement sale fills. |

## 2. New acceptance cases

33. **B-EXIT-ONE.** One of three names closes below its line: only that name is sold, at the next eligible observation; the other two and the comparison are unchanged; the condition reads `breached`.
34. **B-EARLY.** The last remaining holding exits: the result is written at that session's close against the comparison's value at the same close, and the slot frees.
35. **B-ENDPOINT.** The idea, the comparison and SPY are each valued at the endpoint as cash plus holdings at the close's marks, less their own modelled exit costs. An idea that never traded after entry with a same-stock comparison ties to the cent.
36. **B-WAIT.** A sale with no eligible price fills nothing, keeps the slot, alerts after five sessions, and the result reads `blocked`.
37. **B-CATCHUP.** Two missed sessions are caught up in order from stored snapshots before the next close. A missing snapshot gives an `unobserved` row. A due session in the gap settles from its own stored snapshot, or reads `unmeasurable`. No clock moves.
38. **B-DUE-BREACH.** A close below a line on the due session records `breached` and produces exactly one sale.

## 3. How T1a-2 is split

| Build | Delivers | Runs on |
|---|---|---|
| **T1a-2a** | Line recognition, line exits, settlement, early resolution, the five-column result, waiting sales, ticker change and delisting, catch-up of missed closes, draining books, Amendment D's Q-1 to Q-3, T1A-C01, FR-A7, T1A-07, lifting T1a-1's two no-sale bounds | Fable |
| **T1a-2b** | Owner read access (rules) and the index deploy with T0b's reason-field exemption; the evidence packet; the spend reservation (B9); the window ledger; founder endpoints to create a book, admit a fixture idea, and pause or wind down; T1A-05 (fresh admission marks); T1A-06 (the top-up race); FR-A5 / RF-A2 (re-dated actions) | Opus, with Astra's review |

T1a-2b starts after T1a-2a merges. T0b's record of a malformed direct answer moves to T1b, where the manager first runs on an idea book.
