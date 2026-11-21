# Film Room Build D spec V1 — Amendment B: rulings on Astra's D1 review (2026-11-21)

**Status:** the Film Room chat's rulings on Astra's twelve findings, its long-quotation note and its qualifications of Amendment A. The founder approves them by sending them with the D1 fix prompt. D1's fix round builds them, with Amendment A's six code rulings, and commits this amendment.
**Answers:** `docs/audits/20261121_ASTRA_REVIEW_FILM_ROOM_D1_FLOW.md` §1, §4, §6 and §7.
**Destination:** `docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_B_20261121.md`, with one `docs/README.md` row. No docs-only PR.

## 0. In short

- **Astra's verdict stands:** DO NOT MERGE until the fix round closes F1 to F12.
- **Eight findings are fixed as Astra proposes:** F2 to F6 and F10 to F12.
- **Three are fixed another way:** F1, F7 and F8. Each ruling says why.
- **F9 is half a defect.** Its first case is fixed. Its second is DA-2 working as intended, and DA-2 is clarified.
- **The long-quotation note is fixed now,** with DA-16's prop, rather than left on the backlog.

## 1. The rulings

**DB-1. A margin needs both finals in the key (F1).**
- When the key shows no CPU entry, the heading is the result word alone: "Won", "Lost" (DA-4's forms) or "Draw".
- **Why not Astra's "Final {total}":** the result is recorded, and the tape view's result card shows it from the same tape. Dropping it on the front would make the two disagree (BUILD_RULES §9).
- **The harness:** its number oracle requires both bindings for a margin and no longer falls back to the raw opponent.
- **Tests:** the Sep 23 tape with `score.opponentBasis` removed (the shape of tapes written before Build B1), an unknown basis, and a normal CPU battle.

**DB-2. A day is final only on evidence (F2).**
- The front treats a tape day as the battle's final day when:
  - `isFinalDay` is `true`; or
  - the tape has no `isFinalDay` field at all, the battle is completed, and the battle's validated final trading day (`validFinalTradingDay`) is this date.
- `isFinalDay` `false` or `null` is any other day: its date, the last check's values, and no final endpoints.
- The model, its tests and the harness share one predicate.
- **Tests:** `true`, `false`, `null`, missing with and without a matching validated final day, and a completion on a later day.

**DB-3. The first-open mark (F3).** A notice that has shown is marked seen when any of these happens:
- the viewer dismisses it ("Got it");
- the screen opened at a moment, valid or rejected (that entry never shows the front, so its tape is settled from the first paint);
- the tape settles, as built.

DA-12's one declared difference stays: under `'allowlist'`, a viewer who leaves without interacting while the verdict is pending isn't marked.
- **Tests:** valid and rejected links; dismissal, then the verdict denied, failed and timed out; a remount; and DA-12's control.

**DB-4. A gesture in progress keeps the tape (F4).**
- From the first paint until the verdict lands, any of these keeps the tape for this visit:
  - a pointer-down inside the tape;
  - a key-down inside the tape;
  - a keyboard focus move onto a tape control.
- The gesture's own activation then runs once, natively.
- With no interaction, an admission still opens the front.
- This replaces the click guard.
- **Tests,** in a real browser: pointer down / verdict / up; Space down / verdict / up; Enter; Tab onto a tape control; an untouched page.

**DB-5. "This game" needs a known one-day battle (F5).** The counts' heading reads "This game" only when the battle's length is one day. The length is read from the same evidence the subtitle uses: the timeline, else a final tape's `dayNumber`. Otherwise the heading is "This day".
- **Tests:** the three-day fallback, an unknown length, and a confirmed one-day battle with the same rows.

**DB-6. Strict instants only (F6).**
- Every instant the front reads goes through `instantMs` (`src/utils/filmRoomSubject.js`, Build C CE-3): the checks', the actions', the directives' and the battle's completion. No second parser.
- A check whose instant isn't strict breaks its line.
- An event whose instant isn't strict is counted in "{n} more on the full tape" (DA-10).
- **Tests:** the same bytes under `TZ=UTC` and `TZ=America/Chicago` give identical pins, numbers, clocks and groups. The `Z`, offset and minutes-without-seconds forms are kept.

**DB-7. A single scored check is a point (F7).**
- A run of one scored check is drawn as a dot at its own instant, never as a path.
- A line's end at a break uses a butt cap, so no cap reaches into the gap.
- **No resolution-dependent treatment beyond that.** Real checks run about fifteen minutes apart, which is at least 9 px at the narrowest chart. Two checks closer than a dot's width remain a recorded limit.
- **Tests:** Astra's 8 / missing / 8 case, asserting that no path crosses the missing instant and both dots can be located; a fifteen-minute gap at 280 px wide stays visible.

**DB-8. No time basis, no chart (F8).**
- When the calendar doesn't know the session and the day has fewer than two distinct strict check instants:
  - the front draws no chart and no legend;
  - every event is counted in "{n} more on the full tape" (DA-10);
  - the key keeps a recorded final.
- With a known session, the calendar's axis stands as built.
- **When this applies:** the calendar is maintained through 2027, so only on a date it doesn't know.
- **Tests:** zero checks, one check, several checks at one instant, each with and without events.

**DB-9. Two placement rules made exact (F9).**
- **In a break,** the nearest scored check is chosen from the check rows only. The final endpoint isn't a check (DA-3).
- **DA-2 is clarified, not changed.** A pin sits at its own instant whenever the drawn axis covers it. Only an instant beyond the drawn axis sits at the edge.
  - Astra's 16:10 directive, on a day whose axis a 16:30 scored check extends, sits at 16:10. That half of F9 isn't a defect.
- **Tests:** both cases, an ordinary interpolation within a run, and an ordinary pin before the open.

**DB-10. "Game flow" only where there is a front (F10).** The tape's back control reads "Game flow" only while the day on screen has a written tape. A day with no tape, or a failed read, gets `main`'s back control.
- **Tests:** a definite miss, a failed read, and a miss arriving after a pending return.

**DB-11. A delayed return keeps the player's focus (F11).** The door's deferred jump carries the screen's existing focus-origin guard: the `from` the other deferred jumps hold.
- **Tests:** both endings.

**DB-12. The flow's answer belongs to one battle and one owner (F12).** The resolved state is keyed by the battle and by the owner key it was requested for. A mismatch reads as pending.
- **Tests:** owner A then B, and a missing then known owner, on an unchanged battle id.

**DB-13. No disclosure on the front (Astra §4, §7).**
- On the front, a quotation is clamped at three lines with no "Read more" or "Show less". The pin's link is the way to the rest (spec §7).
- **How:** one optional prop on the kit's `Quotation`, shared with DA-16. Set on the front, it hides the attribution line visually (keeping it for assistive technology and the oracle) and drops the disclosure. Omitted, every existing use is byte for byte unchanged.
- **The copy sweep's exemption** narrows to the bound quoted text and its attribution.
- **Tests:** a long quotation on the front, clamped in a browser, with no control; the tape's quotations unchanged.

**DB-14. Amendment A's code rulings, built as Astra qualified them (Astra §6).**
- **DA-4:** the zero decision is made on the two displayed values' hundredths, so +0 and −0 agree. An unnumbered result has no margin node.
- **DA-8:**
  - the drawn final takes part in the minimum but not in the count of three;
  - a tie with the final suppresses the mark;
  - when the final is higher, the earliest tied check still wins.
- **DA-9:** the heading, the key and both line endings share one decision, after DB-2.
- **DA-11:** one drawable x-range for everything that is placed on the time axis:
  - the SVG, the groups and the panel's stepper;
  - the drop line, the final dots and the labels;
  - the low mark's overlap test.

  The chart and the panel stop grouping separately. Checked at 280, 320, 390 and desktop widths.
- **DA-15:**
  - two bound ordinals and an en dash;
  - the mark may widen;
  - the hit target stays 44 px and never overlaps a neighbour's.
- **DA-16:** with DB-13.

## 2. The backlog, unchanged

- A width change that regroups the pins drops a focused pin's focus (DR-6).
- NUM-6's two rows at one millisecond.
- The low mark's absence on the Sep 23 fixture.
- The swap panel's room, for D2.
- DB-7's limit: two checks closer than a dot's width.
