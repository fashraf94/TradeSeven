# Film Room Build D spec V1 — Amendment A: rulings on the D1 build's questions (2026-11-21)

**Status:** the Film Room chat's rulings on the D1 build report's §10 (Q-1 to Q-14), and two rulings from the Film Room chat's own look at the built page (DA-15, DA-16). The founder approves them by sending them with Astra's D1 review. D1's fix round builds the six that need code and commits this amendment.
**Answers:** `docs/audits/20261121_BUILD_FILM_ROOM_D1_FLOW.md` §10, one ruling per question.
**Checked against:** the head `368dc113`, rendered from the Sep 23 fixture at 390, 320 and 1440 wide.
**Destination:** `docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_A_20261121.md`, with one `docs/README.md` row, committed by D1's fix round. No docs-only PR.

## Code changes (six)

- **DA-4. Equal finals show no margin (Q-4).** When the two displayed finals are equal and the recorded result is a win or a loss, the heading reads "Won" or "Lost", with no number.
  - **Why:** "Won by 0" says something the reader can see is odd, and the result is the tape's to state.
  - **Copy:** spec §11's heading row gains "Won" and "Lost".
- **DA-8. The low is the line's lowest point, the final point included (Q-8).** When the final point is the lowest, or ties the lowest check, no low mark is drawn: the rule that the low isn't the line's last point then applies.
  - **Why:** a "Low −92" label can't stand above a line that ends lower.
- **DA-9. A final day with no recorded final total reads as any other day (Q-9).** Its heading is the day's date, and its key holds the last check's values.
  - **Why:** "Final —" and "You —" show an empty value as if it were a result.
  - **What stays:** "Final {total}" appears when the total is recorded and the result or the opponent's final isn't.
- **DA-11. A pin at the axis's edge keeps its whole touch area on screen (Q-11).** The chart's time range is inset on both sides, so that a pin at either end of the axis has its full 44 px inside the page at every width. The lines, the labels and the low mark move with the inset.
  - **Why:** a directive filed the evening before sits at the edge (DA-2), and that will be common. Exit criterion 10 asks for 44 px.
  - **What it changes:** the groups at each width. F-FIXTURE's pinned groups are re-pinned.
- **DA-15. A merged pin shows its range.** It reads "2–4", its first and last numbers, in place of "2+". The pin widens to hold it.
  - **Why:** the panel names the selected member's number ("3"), and with "2+" no pin on the chart shows that number. With "2–4" the reader can place it.
  - **Copy:** spec §6's "+" is replaced by the range's dash.
- **DA-16. On the front, a quotation's attribution line isn't shown.** The speaker's mark ("You", or the agent's mark) and the fact line's time already say who spoke and when.
  - **How:** the kit's `Quotation` gains one optional prop that hides the attribution line visually and keeps it for assistive technology and for the harness's quotation oracle. Its default leaves every existing use byte for byte as it is.
  - **Why:** the line repeats the two facts beside it, in the monospace record style the front was designed to leave on the tape.
  - **The fence:** `FilmRoomKit.jsx` is in the fix round's diff for this prop only.

## Confirmed as built (ten)

- **DA-1 (Q-1).** The flow's own verdict request stands. An allowlist can't resolve without asking. At the shipped values there is no extra request. In any other combination of the two modes, the one cached request per battle is a declared difference under exit criterion 1.
- **DA-2 (Q-2).** A pin whose instant falls outside the session sits at the axis's edge, and its fact line names its date. It isn't moved into "n more".
- **DA-3 (Q-3).** A pin in a break of the line takes the nearest check's height. Nothing is interpolated across a break. Spec §6's "interpolated between the neighbouring checks" applies inside a run only.
- **DA-5 (Q-5).** A directive pin's link opens Study at its directives section. An anchor per directive is a Study change for a later build.
- **DA-6 (Q-6).** Clocks on the front go through `etWhen`, which adds the date when the instant fell on another day. FL-13 is amended to name it.
- **DA-7 (Q-7).** CF-5 is as built.
  - The sentence appears once under My cards' "Adopted" heading.
  - The "Your cards, latest first" digest keeps its sentence on each line (Build C, CD-17), and the receipt's chain keeps its own.
  - CF-5 is not behind the flow's gate: it belongs to the cards.
- **DA-10 (Q-10).** With no pin that can be placed and rows that hold no instant, the panel's place reads "{n} more on the full tape". "Nothing stood out in this game." is for a day with no rows at all.
- **DA-12 (Q-12).** The first-open notice renders only on the tape and is marked seen once it has shown on a settled tape.
  - **The declared difference:** under `'allowlist'` only, a viewer who leaves while the verdict is still pending isn't marked, and sees the notice on the next visit. Under `'off'` and `'on'` there is no pending verdict.
  - **A viewer who only sees the front** meets the notice the first time they open the tape. That is intended.
- **DA-13 (Q-13).** A rejected `openAt` still counts as opened at a moment: the screen opens on the tape.
- **DA-14 (Q-14).** The five suites' flag pins are within the fences. The fences name the goldens and the fixtures. A suite that tests the tape may pin `FILM_ROOM_FLOW_MODE` to `'off'` in its flag mock, provided no assertion changes.

## Accepted for D1, on the backlog

- **A width change that regroups the pins drops a focused pin's focus** (DR-6).
- **Two check rows at the same millisecond, one without a sequence,** can order the key and the line's last point differently (NUM-6).
- **The low mark doesn't appear on the Sep 23 fixture** at any of the three widths. Its check sits beside the merged pin, so spec §5's overlap rule leaves it out.
- **The swap pin's panel has empty room under its link.** D2's words fill it.
