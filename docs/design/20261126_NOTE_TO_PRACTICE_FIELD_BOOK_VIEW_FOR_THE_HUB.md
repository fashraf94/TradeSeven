# Note to the Practice Field chat — three additions to the book's view, for the hub

**Date:** 26 Nov 2026 · **From:** Fable (the Command Center and Forge direction chat) · **Status:** a request. The module is yours, so the shape is yours; the requirements below are what the hub needs.
**What to do with it:** build it in your lane, on your schedule. Tell the founder when it could land. Nothing comes back to this chat except the PR number.

*(Saved by the Practice Field chat from the text the founder pasted on 26 Nov 2026. The wording is the note's own.)*

## 1. Why

The founder adopted the new Command Center design on 25 Nov. For a player with a book, the hub becomes the portfolio: two figures at the top, a split bar under them, and your positions table as the Overview. A read-only discovery (draft PR #1114, `docs/audits/20261125_PHASE0_COMMAND_CENTER_PORTFOLIO_HUB.md`) checked the design against `main`.

It found the hub can draw almost everything from your view as it is. Three things are missing. The founder would like the first hub build before Dec 4 if it can be done safely. Only the band at the top waits on this note; the rest of the hub build doesn't.

## 2. The three additions to `GET /api/practice-field/book`

**A. The archetype.** Something like `archetype { codeId, name }`.

- The hub draws the archetype's figure in its armor, which needs the id. Today the name arrives only inside a sentence.

**B. The split.** Each desk's share of the book, its use, and the cash share.

- The founder's ruling on "in use" (PH-2): the marked value of the desk's held positions at the last close, divided by that desk's share of the book's marked value. The server computes it. An entering idea counts as zero.
- That matches your own figures for 25 Nov: the archetype at all of $19,981, and the agent at $58,301 of $69,933, or 83%.
- The hub needs each figure as your finished text, plus a plain number per part to set the bar's widths. The client does no money arithmetic.
- Today the split is fixed, so this is a read. The presets stay with epoch 2.

**C. The desks' names (PH-5).** The founder ruled that no player sees the word "Shadow".

- The agent's desk reads "{the agent's given name}'s desk". The archetype's reads "{archetype}'s desk".
- The requirement is one name everywhere your words appear: the strip, the slot groups, History, and the open-slot sentence, which today reads "Open. The Shadow desk looks for an idea at tonight's close."
- How the name gets there is your call: the view could carry it, or carry a form the client completes.
- The book's word for a sale by code stays "at its line".

**Later, not now: the record's counts.** Counts over every finished idea by where it came from. History stops at 20, so the hub can't count them. This is for a later hub slice.

## 3. Two things the discovery found about the change itself

- The client refuses a view version it doesn't know. The view goes from version 2 to 3, and the Idea book's reader has to move in the same change.
- A raw rounding call under your module turns the money-rounding scan red, and only a Linux run shows it.

## 4. Two findings for you, outside this request

- Five of the book's 136 priced names can never be drafted. ADI, TGT and PYPL are not in the setup universe, EA is retired, and BRK.B is spelled with a dot where the other list has BRK-B. So 131 can be drafted.
- Two comments disagree on the house universe's size: "about 136" in one place and "228" in another.

## 5. What happens to the Idea book screen

When the hub's new switch is on and a player has a book, the hub draws your parts in place and the entry card and full-window screen are not drawn. Both stay in the code as the way back. With the switch off, nothing changes. Your parts gain two options in the hub's build: the Cash row can be turned off, and the layout comes from the container.
