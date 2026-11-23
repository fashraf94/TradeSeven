# Film Room Build D spec V1 — Amendment E: rulings on the D2 build's questions (2026-11-22)

**Status:** the Film Room chat's rulings on the D2 build report's §14 (R1 and Q-2 to Q-14). The founder approves them by sending them with Astra's D2 review. D2's fix round builds the three that need code and commits this amendment.
**Answers:** `docs/audits/20261122_BUILD_FILM_ROOM_D2_WORDS.md` §14, one ruling per question, numbered as the questions are.
**Checked against:** the head `1ef468b0`. The front was rendered from the Sep 23 fixture at 390 wide with a hand-written record.
**Destination:** `docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_E_20261122.md`, with one `docs/README.md` row, committed by D2's fix round. No docs-only PR.

## Code changes (three)

- **DE-7. "This one" is not a number (Q-7, with Q-4).** Check 4 lets the word "one" pass when the word before it is "this", "that" or "no". Every other use of "one" is still dropped.
  - **Why:** DW-4 exists to keep quantities out of the words. "This one wasn't my call" states no quantity, and it is the most natural way to speak about a swap. Most swaps are a rule's, so dropping that phrasing would cost many true lines.
  - **What stays dropped:** "the one swap I chose", "one of my swaps", "only one". Those are counts.
  - **The system text is unchanged.** It still asks for no number words; the check is only less strict than the instruction.
  - **Tests:** the D2 spec's own example passes. "The one swap I chose" and "one of them" are dropped.
- **DE-8. The sample pack is a census root (Q-8).** `scripts/film-room-debrief-sample.mjs` joins the `debrief` model path's roots, so the path has three roots and the census 23.
  - **Why:** it calls a model, so the one-door rule should hold for it as it does for the job.
  - **Tests:** a planted import of the ledger from the script fails the census.
- **DE-10. The digest names the swap's own check (Q-10).** For each swap the digest carries:
  - **`atSwap`:** the agent's recorded words at the swap's own check, the `rationale[]` row whose `tickSeq` is the action's;
  - **`before`:** the same at the nearest earlier check that recorded words.

  **`after` is removed.**
  - **Why:** the tape stamps a check's instant after its swap is dispatched. Matching by time put the deciding check's words under "after", and the system text then told the model they were said after the swap. For the agent's own swap those words are the decision itself.
  - **An action with no `tickSeq`** falls back to time: `before` is the latest check at or before the swap's instant, and there is no `atSwap`.
  - **The system text** says "at the check before the swap and at the swap's own check".
  - **`DAY_DIGEST_VERSION` stays 1.** No record has been written yet. The Sep 23 golden is re-pinned, and the report shows the new digest in full.
  - **Tests:**
    - Sep 23's swap by the agent carries "PLTR held into the check, so DE goes out…" as `atSwap`;
    - a swap whose own check recorded no words has no `atSwap`;
    - the fallback.

## Confirmed as built (eleven)

- **DE-1 (R1). Overlapping runs are a declared limit, not built against.**
  - **The fact:** Vercel's documentation says a scheduled run can occasionally be delivered more than once. So an overlap doesn't need a manual trigger.
  - **What an overlap costs:** each duplicated battle day gets one extra call, about a third of a cent. The record is still created once, and no line is repaired or re-asked after an answer is seen. The extra call's cost is in its own run's logged total.
  - **How criteria 4 and 8 read:** "one ask per battle day" holds for each run. A duplicated delivery can at most double a night's calls, and each run still obeys the caps.
  - **Why no claim record:** a claim left behind by a run that died would leave that day with no words at all. That is worse than a duplicate call.
- **DE-2 (Q-2).** DD-2's letter stands: a wheel or trackpad scroll holds the tape. A keyboard scroll with the focus on the page, and a scrollbar drag, don't. Declared for the `'allowlist'` period, which is the only time a verdict is pending. A wheel that scrolls nothing still holds.
- **DE-3 (Q-3).** The archetype is named only from the display table. Any other code reads "You are the agent:". No legacy mapping is added.
- **DE-4 (Q-4).** The checks' additions beyond the D2 spec's §5 all stand, since each only drops more. "NOW." is dropped as a symbol, by §5's letter. DE-7 is the one loosening.
- **DE-5 (Q-5).** The platform's default name, "Agent", isn't player text. A chosen name that holds the word is.
- **DE-6 (Q-6).** A call aborted at its deadline records null usage and cost. Nothing is estimated: a cost is recorded or it is null.
- **DE-9 (Q-9).** With the flow `'on'` and the words `'allowlist'`, the one cached verdict request is a declared difference, as DA-1's is.
- **DE-11 (Q-11).** Both edits are approved: the four `.js` import specifiers in `filmRoomModel.js`, and the one line in `archetypeImportBoundaryBaseline.json`.
- **DE-12 (Q-12).**
  - The record's date sits under the words. The D2 spec's "beside" is amended to "under".
  - The words are never clamped.
  - The harness is within the fences. "Every existing fixture" means the goldens and the JSON fixtures.
- **DE-13 (Q-13).** An id split by a combining mark is the limit Build C already accepted (CF-2). `promptBoundText.js` isn't changed in D2. Backlog for that module.
- **DE-14 (Q-14).** N6's rule is kept, and DE-10 narrows it to the time fallback. Matching by `tickSeq` doesn't depend on any other check's instant.

## The fix round also commits

- `docs/design/20261120_FILM_ROOM_REPLY_TO_BETA_LAUNCH_DEBRIEF.md`: the Film Room's Nov 20 reply to the beta launch chat, which a first commit was to carry and none did.
- `docs/design/20261122_FILM_ROOM_TO_BETA_LAUNCH_UPDATE.md`: the Nov 22 update to that reply.
