# Call Record Field Contract V1.4 — Amendment E

**Date:** 2026-10-25 · **Author:** Fable · **Status:** draft for blessing (framework chat). Blessing gates the fix's **merge**, not its build.
**Builds on:** contract V1.4 + Amendments A, B rev 2, C rev 3, D rev 4.
**Evidence:** the FT_QA live test of 2026-10-23 (Cockpit Build 2b's first live day). The cockpit offered "Confirm exit" on a CVX exit call. The FT_QA agent (Cipher) did not hold CVX. The check that wrote the call had proposed swapping EOG for CVX, and a guardrail blocked that swap. The agent wrote an exit plan for a stock it expected to hold, and nothing checked that it held it.

**Scope:** two clauses, one at mint and one at answer time. No new field. One new value for D-9's `invalidatedReason`.

---

## What is wrong today

Nothing requires an exit call's stock to be in the book.

- **At mint:** an exit call on a stock that is not held is minted `open`, provided the stock has a price at the check. Its price line is checked; whether it is held is not.
- **The endpoint:** for that call it refuses every directive (`symbol_not_held`), but it **accepts the acknowledgment** (`go`), because the acknowledgment path checks only that the call is open and inside its deadline.
- **The cockpit:** it therefore shows "Confirm exit", and under 2b, "Who comes in?" as well, for a stock you do not own. A "Hold off" or a pick on that card is refused. A "Confirm exit" is recorded, though it agrees to nothing that can happen.

The same holds, after mint, for an exit call whose stock leaves the book by a route that does not act the call, such as the risk loop. D-6 retires a command on that stock, but the call itself stays open and answerable until its deadline.

---

## E-1 · An exit call must be about a stock in the book (at mint)

**Rule:** a called shot or Confirmation with `direction: 'exit'` is minted `invalidated`, with **`invalidatedReason: 'exit_not_held'`**, when its symbol is not held **in the call's own slot tier** in the book frozen at the model seam. That is the same frozen book D-7 uses, and the same test the filing check applies (`symbol_not_held`).

- The record is kept, as for every invalidated call, so the Film Room can show what the agent said.
- D-3: an invalidated call carries no `replacementOptions` (unchanged).
- D-9's display table gains one row: `exit_not_held` → "Dropped · not in your book".
- Mint mode `'off'` writes nothing, as before.

## E-2 · An exit call is answerable only while its stock is in the book (at answer time)

**Rule:** while an exit call's symbol is not held in its slot tier, **no answer is legal on it**.
- **The endpoint:** acknowledgments are refused too, with the directive path's existing response: `400 ineligible_action`, reason `symbol_not_held`. The check reads the transaction's fresh parent, as eligibility does today.
- **Displays:** they offer no buttons and no "Who comes in?" step, and read "Not in your book", by the same test.
- An answer already recorded stays as recorded.

This applies the standing rule that a card never offers an answer the endpoint would refuse. Here it is applied in both directions: the endpoint no longer accepts an answer whose premise is false.

---

## Standing conditions

Unchanged. Records are frozen in place. No model-visible text changes: the calls block renders states and answers, and an invalidated call is already rendered as such.

## What the framework chat is asked to bless

1. E-1: exit calls on stocks not held in their slot tier at the model seam mint `invalidated`, `exit_not_held`.
2. E-2: no answer, acknowledgments included, on an exit call whose stock is not held in its slot tier at answer time.
