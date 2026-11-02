# Call Record Field Contract V1.4 — Amendment F (revision 3)

**Date:** 2026-11-01 · **Revision 2:** 2026-11-02 · **Revision 3:** 2026-11-02 · **Author:** Fable · **Status:** **blessed** (framework chat, 2026-11-02). Revision 2 was blessed with two notes; both are folded in here. Built in PR #1020.
**Builds on:** contract V1.4 + Amendments A, B rev 2, C rev 3, D rev 4, E rev 4.
**Scope:** the entry-side mirror of Amendment E. Two clauses, one at mint and one at answer time, plus one row in D-9's display table and two refusal lines. No new field. One new refusal reason (`symbol_already_held`).

**What revision 3 changes** (the blessing; no rule changes):
- **"Held" for F-2 is a symbol test in multi-day battles too.** For an entry, any holding of the symbol makes the entry impossible, so Amendment E's condition 4 (position identity) does not apply to F-2. See "What stays as it is".
- **The forward note on one end-of-check book** for E-1 and F-1 is recorded (Blessing record, note 2).
- **The blessing record** is added at the end.

**What revision 2 changed.** It folded in the build of PR #1020 and its §2 review (`docs/audits/20261102_COCKPIT_ENTRY_ALREADY_HELD.md` and `…_REVIEW.md`). No rule changes.
- **The model-visible record is corrected.** Revision 1 said F-1 changes what the chat model reads. It does not. The upside line and the call line are byte-identical for these records (`callsBlock.js` pins the equality). The real model-visible effect is F-2's: answers that used to file on a held entry no longer can. Both are stated under Standing conditions.
- **The build's counts are added to Evidence.** Fourteen entries had their stock arrive after mint, through the stagnation-risk swap. F-2 is the only rule that covers those, so it is not theoretical.
- **Two of the founder's rulings are recorded:**
  - the card's chip word and silence line follow the tag, as in Amendment E;
  - F-1 does not read gameplan legs that run after the seam, because F-2 covers them.
---

## Evidence

**The live bug (R2-01).** On 2026-10-30, the FT_QA tester's second cockpit run found the following.
- At 12:46 PM ET, the 12:45 PM check swapped ZS for GILD in core.
- The same check minted an entry call: "Cipher calls GILD above $172.35 by today's close, and plans to wait", with counterpart ZS.
- The card offered "Bring it in". The server refused it: `400 ineligible_action`, `counterpart_not_held`, because ZS had left with the trade. The player saw the generic line "That answer isn't available for this call — nothing was filed."
- The card's free "Hold" would have filed. It agrees to a plan for a stock already in the book.

**The counts.** These come from the read-only audit of 2026-11-01, re-taken by the build on 2026-11-02. They cover both allowlisted accounts and every call minted at `'on'`. The matching rule is the 2026-10-29 count's, and it reproduced that count exactly. The rebuilt book agreed with the stored `heldAtMint` on every entry call.

| Measure | Count (build, Nov 2) |
|---|---|
| Entry calls at `'on'` | 144 (140 at the Nov 1 audit) |
| On the stock their own check had just bought (F-1) | **19**: 16 in League battles, 3 in agent-mode battles |
| … with no named counterpart | 14. By the code, a directive answer would have been **accepted** and spent a command on a stock already held. |
| … whose named counterpart is the trade's own outgoing stock | 5. The directive is refused (`counterpart_not_held`), but the acknowledgment would file. |
| … acted or answered | 0. The build's stop gate did not fire. |
| Entries whose stock came into the book **after** mint (F-2 only) | **14**, all through the stagnation-risk swap |
| Entries open after their named counterpart left while their own stock was out of the book | 0 |
| Entries on the stock their own check sold | 0 |
| Entries on a stock under the bench cooldown at mint | 1 (not changed here) |

---

## What is wrong today

Nothing requires an entry call's stock to be *out* of the book.

- **At mint:** C-2 makes an entry an upside call (`heldAtMint`) only when its stock is held in the seam's book. That book is the one *before* the check's own trade (Amendment E rev 3 states this). So an entry on the stock the check itself bought mints as an ordinary entry.
- **At the endpoint:** an entry's answers are never tested against whether its own stock is held.
  - Acknowledgments always file.
  - A directive files unless its named counterpart has left (`counterpart_not_held`, D-4).
  - So on a held stock with no named counterpart, "Bring it in" or "Hold off" spends a command on a trade that cannot happen.
- **In the cockpit:** such a card offers "Go if it triggers" / "Hold off" or "Hold" / "Bring it in" for a stock already in your book. Its silence line promises "it brings it in".

The same holds after mint for a stock that comes into the book by another route while the entry call is open. The stagnation-risk swap did this 14 times.

---

## F-1 · An entry on the stock its own check bought is an upside call (at mint)

**Rule:** C-2's `heldAtMint` is true for an entry when **either** of these holds:
- its symbol is held in the seam's book (as today);
- **or** its symbol is the incoming stock of the check's own committed trade. This is the executor's `symbolIn`, read exactly as Amendment E-1 rev 3 reads it. A trade that did not commit has no incoming stock, and a missing value matches nothing.

Notes:
- **The effect is C-2's existing treatment:** no answer is legal (`illegal_answer`, `upside_call`), the cockpit shows the upside chip, and the call never leads the Now card. The agent's plan stays on record and can still resolve `hit` (7 of the 19 did).
- **(rev 2) Only the agent's own committed trade counts.** A stock that a later step of the same check brings in (an approved gameplan meeting's leg, for example) is not read at mint. F-2 withdraws the answers on such a call at answer time.
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
  - the tag reads **"Already in your book"**. This is a row in **D-9's display table** (the Build 2b spec, §7.1).
- **(rev 2) Recorded facts keep their tags.** As in E-2, the "Already in your book" tag replaces only the bare live tag. A recorded answer, an act, a retirement, a replacement or a recorded event keeps its own tag, and the chip word and silence line follow whichever tag shows. "Already in your book" beside "Acted" would mislead, so it never appears there. Founder ruling, 2026-11-02.
- Upside calls keep their own treatment.
- An answer already recorded stays as recorded.

**Refusal lines** (the Build 2b spec, §7.3, flag on):
- `symbol_already_held` → "{SYM} is already in your book — nothing was filed."
- `counterpart_not_held` → "{CP} has already left your book — nothing was filed."

Before this amendment, both showed the generic line.

---

## What stays as it is

- **D-4's filing check** (`counterpart_not_held`, in the call's slot tier) and **D-6's retirement** are unchanged. `symbol_already_held` is not a D-6 book reason.
- **(rev 3) "Held" is a symbol test, and it stays one in multi-day battles.** For an entry, any holding of the symbol makes the entry impossible, whichever position it is. So Amendment E's condition 4, which moves an exit's "held" to position identity before multi-day battles reach the allowlist, does **not** apply to F-2. The multi-day format arc leaves F-2 as written.
- **League battles:** both rules apply there too, since the mint does not depend on the mode. The cockpit never shows League battles (Amendment E's routing wall).
- **Not changed here.** The build's counts settle each case:
  - an entry whose named counterpart has left while its stock is out of the book: 0 found, so no follow-up. Its directive is refused, now with its own line;
  - an entry on the stock its own check sold: 0 found;
  - an entry on a stock under the bench cooldown at mint: 1 found. It is left as found, not fixed.

---

## Standing conditions

Unchanged:
- Records are frozen in place.
- No template, wording or registry entry changes.

**(rev 2) What the model can read, stated exactly:**
- **F-1 changes no byte.** The chat calls block renders an upside call through `renderUpsideLine` and an ordinary call through `renderCallLine`. For a shot or Confirmation, both produce the same condition line: symbol, side, level and deadline, with no action clause. `callsBlock.test.js` pins the equality.
- **F-2 removes two paths; it adds no text.** Before F-2, an answer on a held entry could file in two ways:
  - a directive with no named counterpart, which put its canonical directive text into the agent's next prompt;
  - an acknowledgment, which became an `answered:` row in the chat calls block.

  Neither can file now. So what the model can read shrinks, and nothing new is written. This is named here for the fenced-class record.

## What the framework chat is asked to bless

1. **F-1:** an entry on the incoming stock of its own check's committed trade mints with `heldAtMint: true`, so it is an upside call.
2. **F-2:** no answer, acknowledgments included, on an entry call whose stock is held in any tier of the book at answer time. The refusal is `400 ineligible_action` / `symbol_already_held`, run before D-4's eligibility test.
3. **D-9's display table** gains the row "Already in your book".

---

## Blessing record

**Framework chat, 2026-11-02: revision 2 blessed** (F-1, F-2, the D-9 row "Already in your book", and the two refusal lines). PR #1020 may merge on green CI. There were two notes, neither blocking:
1. **Multi-day.** E's condition 4 does not apply to F-2. For an entry, any holding of the symbol makes the entry impossible, so the symbol test is the right test in multi-day battles too. It is recorded that way in "What stays as it is", so the multi-day arc does not change F-2.
2. **One end-of-check book.** When Amendment E's follow-up lands (the end-of-check book for exits, bundled with the League slot label), E-1 and F-1 will read one shared helper. That helper gives the book when the check ends: the seam's book, plus the committed incoming stock, minus the committed outgoing stock. Exits and entries then cannot drift apart.
   - Under that helper, an entry on the stock its own check sold (0 found) reads as not held.
   - Whether such an entry is answerable stays with the parked bench-cooldown case (1 found).
