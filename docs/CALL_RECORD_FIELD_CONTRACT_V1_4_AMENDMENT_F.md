# Call Record Field Contract V1.4 — Amendment F

**Date:** 2026-11-01 · **Author:** Fable · **Status:** draft for blessing (framework chat). Blessing gates the fix's **merge**, not its build.
**Builds on:** contract V1.4 + Amendments A, B rev 2, C rev 3, D rev 4, E rev 4.
**Scope:** the entry-side mirror of Amendment E. Two clauses, one at mint and one at answer time, plus one row in D-9's display table and two refusal lines. No new field. One new refusal reason (`symbol_already_held`).

---

## Evidence

**The live bug (R2-01).** On 2026-10-30, the FT_QA tester's second cockpit run found the following.
- At 12:46 PM ET, the 12:45 PM check swapped ZS for GILD in core.
- The same check minted an entry call: "Cipher calls GILD above $172.35 by today's close, and plans to wait", with counterpart ZS.
- The card offered "Bring it in". The server refused it: `400 ineligible_action`, `counterpart_not_held`, because ZS had left with the trade. The player saw the generic line "That answer isn't available for this call — nothing was filed."
- The card's free "Hold" would have filed. It agrees to a plan for a stock already in the book.

**The read-only audit of 2026-11-01** covered both allowlisted accounts and every call minted at `'on'`. It used the matching rule of the 2026-10-29 count, which it reproduced exactly. Its rebuilt book agreed with the stored `heldAtMint` on 140 of 140 entry calls.

| Measure | Count |
|---|---|
| Entry calls at `'on'` | 140 |
| On the stock their own check had just bought | **19 (13.6%)**: 16 in League battles, 3 in agent-mode battles |
| … with no named counterpart | 14. By the code, a directive answer would have been **accepted** and spent a command on a stock already held. |
| … whose named counterpart is the trade's own outgoing stock | 5. The directive is refused (`counterpart_not_held`), but the acknowledgment would file. |
| … answered | 0 |
| `heldAtMint` on those 19 | false on all 19, by construction: the seam's book predates the check's own trade |

---

## What is wrong today

Nothing requires an entry call's stock to be *out* of the book.

- **At mint:** C-2 makes an entry an upside call (`heldAtMint`) only when its stock is held in the seam's book. That book is the one *before* the check's own trade (Amendment E rev 3 states this). So an entry on the stock the check itself bought mints as an ordinary entry.
- **At the endpoint:** an entry's answers are never tested against whether its own stock is held.
  - Acknowledgments always file.
  - A directive files unless its named counterpart has left (`counterpart_not_held`, D-4).
  - So on a held stock with no named counterpart, "Bring it in" or "Hold off" spends a command on a trade that cannot happen.
- **In the cockpit:** such a card offers "Go if it triggers" / "Hold off" or "Hold" / "Bring it in" for a stock already in your book. Its silence line promises "it brings it in".

The same holds after mint for a stock that comes into the book by another route while the entry call is open.

---

## F-1 · An entry on the stock its own check bought is an upside call (at mint)

**Rule:** C-2's `heldAtMint` is true for an entry when **either** of these holds:
- its symbol is held in the seam's book (as today);
- **or** its symbol is the incoming stock of the check's own committed trade. This is the executor's `symbolIn`, read exactly as Amendment E-1 rev 3 reads it. A trade that did not commit has no incoming stock, and a missing value matches nothing.

Notes:
- **The effect is C-2's existing treatment:** no answer is legal (`illegal_answer`, `upside_call`), the cockpit shows the upside chip, and the call never leads the Now card. The agent's plan stays on record as an upside line, and it can still resolve `hit` (7 of the 19 did).
- **Model-visible, data-dependent:** no template, wording or registry entry changes. The chat calls block (`callsBlock.js`) renders such a call through the existing upside line (`renderUpsideLine`) instead of the call line. This is a change in what the chat model reads for these records, named here for the fenced-class record.
- **An unknown executor outcome** (Amendment E's Q1 case) leaves no incoming stock, so F-1 does not mark the call. F-2 still withdraws its answers at answer time, because the live book holds the stock.
- Records already minted stay as written. Mint mode `'off'` writes nothing, as before.

## F-2 · An entry call is answerable only while its stock is not in the book (at answer time)

**Rule:** while an entry call's symbol is held **in any tier** of the book, **no answer is legal on it**.

- **The endpoint** refuses acknowledgments and directives alike, with `400 ineligible_action`, reason **`symbol_already_held`**, before any write. It reads the transaction's fresh parent, as eligibility does.
  - For a directive, the check runs **before** D-4's eligibility test. So when the stock came in and the counterpart left in the same trade (the GILD case), the reason names the stock that came in.
- **Displays** use the same test, read from the battle document the screen already has (Amendment E's wiring):
  - no buttons;
  - no silence line;
  - the strip chip reads "already in your book";
  - the tag reads **"Already in your book"**. This is a row in **D-9's display table** (the Build 2b spec, §7.1). As in E-2, the tag replaces only the bare live tag: a recorded answer, an act, a retirement, a replacement or a recorded event keeps its own tag.
- Upside calls keep their own treatment.
- An answer already recorded stays as recorded.

**Refusal lines** (the Build 2b spec, §7.3, flag on):
- `symbol_already_held` → "{SYM} is already in your book — nothing was filed."
- `counterpart_not_held` → "{CP} has already left your book — nothing was filed."

Today both of these show the generic line.

---

## What stays as it is

- **D-4's filing check** (`counterpart_not_held`, in the call's slot tier) and **D-6's retirement** are unchanged. `symbol_already_held` is not a D-6 book reason.
- **"Held" is a symbol test**, as in Amendment E. The same multi-day caveat applies (E's condition 4): before multi-day battles reach the allowlist, "held" becomes "the same holding".
- **League battles:** both rules apply there too, since the mint does not depend on the mode. The cockpit never shows League battles (Amendment E's routing wall).
- **Not changed here, and counted by the build:**
  - an entry whose named counterpart has left while its stock is not in the book. The directive is refused, now with its own line, and the acknowledgment still files;
  - an entry on the stock its own check sold, or on a stock under the bench cooldown at mint.

  Each becomes a follow-up only if the counts say it matters.

---

## Standing conditions

Unchanged:
- Records are frozen in place.
- No template, wording or registry entry changes.
- The one model-visible effect is the data-dependent upside rendering named in F-1.

## What the framework chat is asked to bless

1. **F-1:** an entry on the incoming stock of its own check's committed trade mints with `heldAtMint: true`, so it is an upside call.
2. **F-2:** no answer, acknowledgments included, on an entry call whose stock is held in any tier of the book at answer time. The refusal is `400 ineligible_action` / `symbol_already_held`, run before D-4's eligibility test.
3. **D-9's display table** gains the row "Already in your book".
