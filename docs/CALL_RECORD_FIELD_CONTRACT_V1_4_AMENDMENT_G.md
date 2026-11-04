# Call Record Field Contract V1.4 — Amendment G (revision 2)

**Date:** 2026-11-02 · **Revision 2:** 2026-11-04 · **Author:** Fable · **Status:** draft for blessing (framework chat). Blessing gates the fix's **merge**, not its build.
**Builds on:** contract V1.4 + Amendments A, B rev 2, C rev 3, D rev 4, E rev 4, F rev 3.
**Scope:** the chat calls block (`callsBlock.js`), which is model-visible to the chat model. Two clauses:
- G-1 adds one segment to a row whose command no longer stands. That is three new model-visible strings: the "fifth" string the Build 2b review left for a ruling.
- G-2 fixes a read race and adds no string.

No new field. Nothing changes on the screen.

**What revision 2 changes.** It folds in the build (PR #1023, `docs/audits/20261104_COCKPIT_CALLS_BLOCK_STANDING.md`) and the founder's rulings on its seven readings, 2026-11-04. No rule changes and no new strings.
- **One field path is corrected.** `{SYM}` is the stored retired event's top-level `symbol`. `extra` is only `buildCallEvent`'s argument, and it spreads to the top level.
- **Four edge cases, each built conservatively, are now stated** in G-1 and G-2:
  - an event that cannot fill its template gives no segment;
  - a tie between the two events goes to `superseded`;
  - which calls are read;
  - a re-read that succeeds but still finds no record.

---

## Evidence

- **The Build 2b report** (`docs/audits/20261021_BUILD2B_COCKPIT.md`, the fenced-class lens L2) recorded two issues:
  - **CB2-1:** the chat calls block shows a replaced or retired cockpit command as a standing "answered: …" row. Spec S-7 lists `callsBlock.js` among the readers that "handle `retired`", but it reads no events.
  - **CB2-2:** a rare read race can render a bare "answered: Bring in", with no name.
- **The founder's rulings of 2026-10-21** (Q4, Q5) made both a separate task after the 2b merge. CB2-1 goes through fenced-class review. CB2-2 is fixed by re-reading the battle after the calls read; the owner's nod for that read order is on record.
- **Live example, FT_QA, 2026-10-30.**
  - The CCI exit call was answered "Bring in DLTR" at 12:49 and heard at the 13:00 check.
  - At 13:46 the player replaced that command with "Hold off on the DLTR entry".
  - From then on, the CCI row read `answered: Bring in DLTR · heard at the 13:00 check`. That is exactly what a standing command reads. The DLTR row beside it also read answered and heard.
  - Nothing told the chat model which request still stood.

---

## G-1 · A row says when its command no longer stands

**Rule:** for a call whose `playerResponse` is a directive, the block reads that thread's two closing events by their ids: `${directiveThreadId}:superseded` (Amendment B §3) and `${directiveThreadId}:retired` (D-6). It reads them within the block's existing read budget. When one exists, the row gains **one segment after its §2 fact**:

| Event | Segment (model-visible) |
|---|---|
| `superseded` | `replaced by a later request at {HH:MM}` |
| `retired`, the stock left (`symbol_not_held`, `counterpart_not_held`, `swap_out_not_held`) | `retired at {check}: {SYM} left the book` |
| `retired`, a chosen or selected name came in another way (`pick_already_held`) | `retired at {check}: {SYM} came into the book another way` |

How the placeholders fill:
- `{HH:MM}` is the superseded event's `at`, on the server's 24-hour ET clock (the same clock as check labels).
- `{check}` is the retired event's own `checkLabel` (for example, "the 13:15 check").
- `{SYM}` is the retired event's stored `symbol`, the stock that moved. **(rev 2)** It sits at the event's top level, because `buildCallEvent` spreads its `extra` argument there.

Example row:
`- {callId} · CCI below $89.00 by today's close · open · answered: Bring in DLTR · heard at the 13:00 check · replaced by a later request at 13:46`

Notes:
- **Both events present** (not expected, since each one ends the command): the earlier one, by `at`, is shown. **(rev 2)** A tie goes to `superseded`.
- **(rev 2) An event that cannot fill its template** (no usable `at`, an unknown reason, no symbol or no check label) gives **no segment**. The row stays as it is today. No fourth string is ever invented. The writers fill these fields on their normal path, so such an event would be a malformed document.
- **(rev 2) Which calls are read:** every directive-answered call the block read, which is at most 11 calls and 22 event references in one batch. This includes calls whose rows the 1,200-character cut later drops, because the cut is known only after rendering.
- **Neither event present:** the row is **byte-identical** to today.
- **The heading, the 1,200-character cap and the whole-row truncation are unchanged.** A longer row can push an older history row into "… n more".
- **A failed or timed-out event read** degrades the whole block to null, as any calls-block read failure does today. The chat turn continues.
- **The words fit the block's own heading,** which frames "an answer [as] a request filed to the process, never a trade it has made". So the segment says the *request* was replaced or retired, and never that the agent did anything.

## G-2 · A named answer's row always carries its name (CB2-2)

**Rule:** a named answer's row (a pick, `replace`, or a named `go_now`) reads its chosen name from the directive record on the battle (`threads.js` `selectedPickOf`).
- When the battle document in hand predates that filing (the read race), the block re-reads the battle document **once**, after the calls read and within the same budget. It does so **only** when a named answer's record is not found.
- If the re-read fails, or finds no battle document, the block degrades to null.
- **(rev 2)** A re-read that succeeds but still finds no directive record renders the answer word without a name, as today ("answered: Bring in"). That is incomplete but not false. Hiding the whole block for one row would cost more than it saves. Founder ruling, 2026-11-04.
- No new string. The re-read happens inside the block's own builder; the chat route's read order elsewhere does not change.

---

## What stays as it is

- **Events still never reach a prompt** except through these segments. The cockpit screen is unchanged.
- **Other ways a command ends are out of scope:**
  - a kill ends a command's liveness (Amendment B);
  - a command whose call has resolved already shows its resolved state on the row.

  Each would be its own amendment if it turns out to matter.
- **At `'off'` and `'shadow'` nothing is read,** and the prompt is byte-identical (the voice goldens).

## Standing conditions

Unchanged:
- Records are frozen in place.
- The three segment templates are the only new model-visible text. They are pinned by frozen literals in the build.

## What the framework chat is asked to bless

1. **G-1:** the three segment templates, and the rule that reads a directive-answered call's `superseded` and `retired` events by id within the block's budget. If both exist, the earlier one shows. A failed read degrades the block to null.
2. **G-2:** the conditional single re-read of the battle document, inside the block's builder, so a named answer's row never renders without its name.
