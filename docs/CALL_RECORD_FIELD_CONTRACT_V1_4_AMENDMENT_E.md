# Call Record Field Contract V1.4 — Amendment E (revision 3)

**Date:** 2026-10-25 · **Revision 2:** 2026-10-29 · **Revision 3:** 2026-10-29 · **Author:** Fable · **Status:** draft for blessing (framework chat). Blessing gates the fix's **merge**, not its build.
**Builds on:** contract V1.4 + Amendments A, B rev 2, C rev 3, D rev 4.

**Evidence:**
- **The live bug.** On 2026-10-23, Cockpit Build 2b's first live day, the FT_QA account tested the cockpit. It offered "Confirm exit" on a CVX exit call, but the FT_QA agent (Cipher) did not hold CVX. The check that wrote the call had proposed swapping EOG for CVX, and a guardrail blocked that swap. The agent wrote an exit plan for a stock it expected to hold, and nothing checked that it held it.
- **The count, taken before building** (`docs/audits/20261029_COCKPIT_EXIT_NOT_HELD.md`). It covers all 284 exit calls minted at `'on'` for the founder and FT_QA accounts.
  - 1 call (0.35%) was on a stock held in no tier at the minting check. It is the CVX call above.
  - 60 calls (21.1%) were on stocks the agent held, but in a different tier from the call's `slot`. All 60 are in League battles, 60 of the 127 exit calls there. The League prompt shows no tiers, by design, but `slot` is a required field, so the agent has to guess it. In agent-mode battles the count is 0 of 157.

**What revision 2 changed:**
- In E-1 and E-2, "held" means held **in any tier** of the book, not in the call's own slot tier. Revision 1's test would have dropped those 60 calls as "not in your book", and that text is false for every one of them.
- E-1 says which reason wins when a call has two.
- A new section, "What stays as it is", covers the directive filing check (D-4) and retirement (D-6).
- Two errata to Amendment D are folded in, as the founder's Build 2b rulings of 2026-10-21 asked.

**What revision 3 changes** (found reviewing the build of revision 2):
- **E-1 counts the check's own committed trade.** The book frozen at the model seam is the book *before* the check's own trade: the swap commits after the prompt seam and before the mint. An agent that buys a stock and declares an exit plan for it at the same check is writing about a stock that is in the book once the check ends. Under revision 2 that plan would have been dropped as "not in your book", which is false. The CVX call is this pattern with the trade blocked: no trade committed, so it is still dropped. In the count, no exit call named its own check's committed incoming stock, so this changes no counted record.
- **Standing conditions:** the sentence about the calls block is corrected. An invalidated call is not rendered there at all.

**Scope:** two clauses, one at mint and one at answer time, plus two errata. No new field. One new value for D-9's `invalidatedReason`.

---

## What is wrong today

Nothing requires an exit call's stock to be in the book.

- **At mint:** an exit call on a stock that is not held is minted `open`, provided the stock has a price at the check. Its price line is checked. Whether it is held is not.
- **At the endpoint:** for that call, every directive is refused (`symbol_not_held`), but the **acknowledgment is accepted** (`go`). The acknowledgment path checks only that the call is open and inside its deadline.
- **In the cockpit:** "Confirm exit" therefore shows for a stock you do not own, and under 2b so does "Who comes in?". A "Hold off" or a pick on that card is refused. A "Confirm exit" is recorded, though it agrees to nothing that can happen.

The same goes for a stock that leaves the book after the call is minted, by a route that does not act the call (such as the risk loop). D-6 retires a command on that stock, but the call itself stays open and answerable until its deadline.

---

## E-1 · An exit call must be about a stock in the book (at mint)

**Rule:** a called shot or Confirmation with `direction: 'exit'` is minted `invalidated`, with **`invalidatedReason: 'exit_not_held'`**, when both of these hold:
- its symbol is **not held in any tier** of the book frozen at the model seam. That is the same frozen book D-7 uses;
- **(rev 3)** its symbol is **not the incoming stock of the check's own committed trade**. That stock is the executor's result (`symbolIn`), carried as the flips and the heard pass already read it. It is never rebuilt from the proposal. A trade that did not commit has no incoming stock, and a missing value matches nothing.

Notes:
- **Why any tier:** a stock is held at most once, so the only question is whether it is in the book. The call's `slot` is the agent's own label. In League battles that label is a guess (see Evidence).
- **Why the committed trade:** the seam's book is the book before this check's own trade. A stock the check bought is in the book when the call goes live.
- **When a call has two reasons:** a reason that already invalidates at mint, such as a price-line reason, is kept. `exit_not_held` applies only to a call that would otherwise mint valid.
- The record is kept, as for every invalidated call, so the Film Room can show what the agent said.
- D-3: an invalidated call carries no `replacementOptions` (unchanged).
- D-9's display table gains one row: `exit_not_held` → "Dropped · not in your book".
- Mint mode `'off'` writes nothing, as before.

## E-2 · An exit call is answerable only while its stock is in the book (at answer time)

**Rule:** while an exit call's symbol is not held in any tier of the book, **no answer is legal on it**.
- **The endpoint** refuses acknowledgments too, with the response the directive path already gives: `400 ineligible_action`, reason `symbol_not_held`. The check reads the transaction's fresh parent, as eligibility does today.
- **Displays** use the same test, read from the battle document the screen already has. They offer no buttons and no "Who comes in?" step, and read "Not in your book".
- An answer already recorded stays as recorded.

This applies the standing rule that a card never offers an answer the endpoint would refuse. It is applied in both directions here: the endpoint also stops accepting an answer whose premise is false.

---

## What stays as it is

- **The directive filing check (D-4)** keeps its own test: the call's symbol must still be held in the call's slot (`symbol_not_held`). **D-6's retirement**, which reads that check, is also unchanged.
- **Where a player can answer, the two tests agree.** League battles never reach the cockpit (D-1). The build confirmed the routing: `BattleViewScreen.jsx` sends a League battle to the League Arena while `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` is on. In agent-mode battles, the call's slot matched the book in 157 of 157 exit calls. The tests differ only on a League call whose slot the agent guessed wrong, and no cockpit shows those.
- **That routing flag is the only wall.** It must stay on until the League slot label is fixed.
- **The League slot label is a separate follow-up** and is not changed here. The agent is asked for a tier its prompt does not show.

---

## Errata to Amendment D

These come from the founder's rulings of 2026-10-21 on the Build 2b report (§11, Q1 and Q6).

- **D-3, labels:** the `'agent'` options read **"From {Agent}'s lists"**, or "On {Agent}'s list" for a single name. They do not read "{Agent} is eyeing". The agent is not awake between checks, so no label gives it a present-tense verb. In the standing conditions, "'eyeing' only for names on its own lists" now reads "the agent's-lists label only for names on its own lists".
- **D-4, a stray pick:** a `pickSymbol` sent with an answer that takes none returns `400 invalid_request` (Build 2b spec S-5), as built. It does not return `400 illegal_answer`.

---

## Standing conditions

Unchanged.
- Records are frozen in place.
- **No model-visible text changes (rev 3, corrected).** The calls block (`callsBlock.js`) renders open calls and the three resolved states only, and an invalidated call is not rendered at all. A call minted `exit_not_held` therefore never appears in the agent's calls block, the same as a call dropped for its price line. A refused acknowledgment is never recorded, so it never becomes an `answered:` row. No template, wording or registry entry changes.

## What the framework chat is asked to bless

1. **E-1:** an exit call mints `invalidated`, with `exit_not_held`, when its stock is neither held in any tier of the book at the model seam nor the incoming stock of the check's own committed trade. A reason that already invalidates at mint takes precedence.
2. **E-2:** no answer, acknowledgments included, on an exit call whose stock is not held in any tier of the book at answer time.
3. **The two errata to Amendment D**, recorded.
