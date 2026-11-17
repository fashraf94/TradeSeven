# Film Room Build C spec V1 — Amendment D: rulings on the C2 build's readings (2026-11-16)

**Status:** the Film Room chat's rulings on the C2 build report's §9 (R1–R18). The founder approves them by sending them with Astra's C2 review. C2's fix round builds the five that need code (CD-3, CD-8, CD-14, CD-16 and CD-17) and commits this amendment.
**Answers:** `docs/audits/20261115_BUILD_FILM_ROOM_C2_EXCERPT.md` §9, one ruling per reading.
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_D_20261116.md`, with one `docs/README.md` row, committed by C2's fix round. No docs-only PR.

## Code changes (five)

- **CD-3. The sector is named, not coded (R3).** The excerpt and the subject line both carry the sector's name from the directory (`STOCK_UNIVERSE[id].name`, for example "Industrials"), not its fund code (`XLI`, which reads like another symbol beside the stock).
  - **Where:** one change in the shared projection, so the two sides still say the same thing.
  - **The bound:** "one word" becomes "the directory's name". A symbol the directory lacks, or a code with no name, has no sector.
- **CD-8. The idea is the one the battle carried (R8).** The excerpt and the subject line read the idea from the battle's own frozen carriage, `agentContext.equippedHypothesis` (`watchlistId`, `hypothesisVersion`, `contentHash`). The day's `calls[].hypothesisRef` is not read.
  - **Why:** "under your idea" says what the battle ran under. That is the battle's carriage, written at deploy and not client-writable. A day on which the agent minted no call still ran under the idea.
  - **The rest holds:**
    - a version document that is missing, another owner's or unreadable gives the idea without its statement, as built;
    - a battle with no carriage has no idea;
    - a tournament battle carries none.
  - **The tie rule goes:** CD-7's "two distinct refs give none" no longer applies, because one battle carries at most one idea.
- **CD-14. The note has one home (R14).** `card.note` goes. The card's note is carried once, as `inputQuote`. W-06's one quotation per input is then a property of the shape, not something the assembler has to remember.
- **CD-16. The meeting block leaves version 1 (R16).**
  - **Why:** the battle's owner may update `gameplanMeetingHistory` and `gameplanMeeting` (`firestore.rules`, the `agentBattles` update allowlist). So the block's outcome, legs and diagnosis can hold words the owner wrote, and the excerpt would carry them as recorded facts and as the platform's words, into a model call that admits ideas.
  - **The change:** the excerpt carries no `meeting` field, and the goldens move by that block.
  - **Every other field** the excerpt carries comes from server-written records. Astra confirms that for each.
  - **When it can come back:** in a later excerpt version, once meetings are server-written, or once the trader game reshapes them.
  - **The screen's Meetings section** keeps its quotation for now. It shows the owner their own battle, so only the owner's own edit can mislead them. The Film Room raises the field's writability with the BaggerBomb revamp chat.
- **CD-17. "Adopted" never stands alone (R17).** "Since last time"'s adopted line carries the same sentence as the chain: "Your agent doesn't act on your ideas yet." The Practice Field's ruling puts it on every idea surface until P4, and a one-line digest is one.

## Confirmed as built (thirteen)

- **CD-1 (R1).** A series bar carries the series document's own class, `market`. `barsAfter` is `derived`. "The tape's own class" governs over the spec's looser "(recorded)".
- **CD-2 (R2).** A quotation over its bound is absent, never cut, for every quoted field, the idea's statement included (BC-1: the agent's and the player's words are never rewritten). An idea's statement over 280 code points goes without its statement on the subject line too, so the line and the excerpt agree (CC-7).
- **CD-4 (R4).** `recurrences` is not carried in version 1. If the drafting call wants it, the Practice Field asks, and the counter's answer is passed in.
- **CD-5 (R5).** The two extra reads for a casual clone's battle, with the platform resolver's parent-ownership guard, pinned to the platform's own resolver.
- **CD-6 (R6).** The exit is a sale of the moment's symbol at the moment's last check, or at the first check the day ran after it.
- **CD-7 (R7).** The ties: the earliest heard directive. The meeting tie no longer applies under CD-16, and the idea tie no longer applies under CD-8.
- **CD-9 (R9).** The census as built, stricter than the table's letter: the exception admits the `drafting` path alone, and every other path is held to its whole closure.
- **CD-10 (R10).** The screen's one new read: under cards mode only, on the card's own day, with no line while it loads, after it fails, or when the rules deny it.
- **CD-11 (R11).** The harness's quotation binding extends to the subject line's declared 60-code-point cut, byte for byte against the version as read.
- **CD-12 (R12).** The derived Sep 23 fixture. Under CD-8 it carries the battle's `equippedHypothesis` instead of a call.
- **CD-13 (R13).** "Verbatim" trims the blank lines that frame the markers.
- **CD-15 (R15).** `excerptOfCard` answers for any of the owner's cards under that agent, whatever its stage. The drafting call chooses which to ask for.
- **CD-18 (R18).** `api/mandate/drain.js` is not a census root: it builds no prompt.

## For the Practice Field (no change to C2's contract beyond CD-3, CD-8, CD-14 and CD-16)

The report's §6 stays the excerpt's contract, with four changes:
- `sector` is a name;
- `idea` comes from the battle's carriage;
- `card.note` is gone, and the note is `inputQuote`;
- `meeting` is gone.

The fix round's report restates §6 with these changes, so T1b + T1d reads one current contract.
