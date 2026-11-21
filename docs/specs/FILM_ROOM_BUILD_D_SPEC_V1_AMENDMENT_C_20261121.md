# Film Room Build D spec V1 — Amendment C: rulings on the D1 fix round's questions (2026-11-21)

**Status:** the Film Room chat's rulings on the fix round's twelve questions (`docs/audits/20261121_BUILD_FILM_ROOM_D1_FLOW.md` §11). The founder approves them by sending them with Astra's D1 confirmation review.
- **Nine need no code in D1.**
- **Three are small code changes that ride Build D2,** the next Film Room build, which commits this amendment: DC-1, DC-4 and DC-8. None of them changes what a player sees on real tapes before the flow is `'on'` for everyone, and D2 merges before that flip.

**Checked against:** the head `9d7d1955`, rendered from the Sep 23 fixture at 390 and 320 wide.
**Destination:** `docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_C_20261121.md`, with one `docs/README.md` row, committed by D2. No docs-only PR.

## Code changes, built in D2 (three)

- **DC-1. A final day also needs a completed battle (Q1).** DB-2's first branch becomes: `isFinalDay` is `true` **and** the tape's battle block says `completed`.
  - **Why:** the tape view's result card states a result only for a completed battle, and the front must not state one where the tape view doesn't.
  - **Tests:** `isFinalDay: true` with the battle active reads as any other day.
- **DC-4. A click is a fourth trigger (Q4).** A click inside the tape before the verdict lands keeps the tape, beside DB-4's pointer-down, key-down and focus move.
  - **Why:** assistive technology and voice control can send a click with nothing before it.
  - **Tests:** a synthetic click with no pointer or key event before it, then an admission. The tape stays, and the click's action ran once.
- **DC-8. Ties at the low are decided on displayed values (Q8).** Checks and the final alike are compared on their displayed hundredths (BUILD_RULES §9).
  - **Tests:** two checks whose raw values differ below a hundredth and display equal. The earliest is the low.

## Confirmed as built (nine)

- **DC-2 (Q2).** DB-1's letter stands over DA-9's note. A recorded result with no CPU entry in the key reads "Won", "Lost" or "Draw". "Final {total}" is for a final day whose result isn't one of the three.
- **DC-3 (Q3).** "Game flow" stays while the day is loading, and becomes `main`'s back control once the read settles as missing or failed.
- **DC-5 (Q5).** A scroll counts as interaction: a page scrolled before the verdict keeps the tape for this visit.
- **DC-6 (Q6).** The low label as drawn at 390 wide is the treatment. The selected pin's drop line stops short of it.
- **DC-7 (Q7).** DB-7's figure is corrected: fifteen minutes is about 8 px on the narrowest chart (256 px), and the break stays visible.
- **DC-9 (Q9). A declared limit.**
  - **What it is:** the swap link's number comes from the tape view's `swapOrdinals`, which reads times with `Date.parse`.
  - **Why it holds:** the link and Study read the same function in the same browser, so the link always lands on its card. An action with no strict instant is never a pin (DB-6).
  - **Later:** a strict parser for `swapOrdinals` is a tape-view change for a later build.
- **DC-10 (Q10).** The `VISUALLY_HIDDEN` style constant serves the one prop, so it is within the fence.
- **DC-11 (Q11). A declared difference under `'on'`.** A viewer who leaves while the day is still loading isn't marked, and sees the notice on the next visit.
- **DC-12 (Q12). Backlog, for the tape writer.** A zoneless directive's order depends on the writer's time zone. Production functions run in UTC, so the order is stable there. On the front such a directive is never a pin (DB-6).
