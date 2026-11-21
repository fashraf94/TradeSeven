# Film Room Build D spec V1 — Amendment D: rulings on Astra's D1 confirmation (2026-11-21)

**Status:** the Film Room chat's rulings on Astra's confirmation review, N1 to N5. The founder approves them by merging PR #1102 at `9d7d1955` over the review's DO NOT MERGE, which the review names as the founder's call ("a founder decision is needed only if one of these criterion breaches is to become a declared exception").
**Answers:** `docs/audits/20261121_ASTRA_CONFIRMATION_FILM_ROOM_D1.md` §3 and §5.
**Destination:** `docs/specs/FILM_ROOM_BUILD_D_SPEC_V1_AMENDMENT_D_20261121.md`, with one `docs/README.md` row, committed by Build D2 with Astra's confirmation and Amendment C. No docs-only PR.

## 0. In short

- **Astra's reproductions are accepted as facts.** All five are real.
- **None blocks the merge.** Four of them (N1 to N4) exist only while a verdict is pending, which happens only under `'allowlist'`. Under `'on'`, the launch setting from Dec 3, no verdict is pending and the window doesn't exist. N5 is a rounding error at an exact boundary, and its result is still deterministic.
- **D2 fixes N2 to N5,** with Amendment C's three, before the flip to `'on'`. N1 is the cards' own behaviour on `main`, and goes to the cards' backlog.

## 1. The rulings

**DD-1. N1 is the cards' layout shift, not a D1 defect.**
- When the shared verdict admits an owner, the card regions appear above the depth control and move it under a held pointer. `main` does the same for every allowlisted owner today.
- D1's own part of F4, the front replacing a held tape, is fixed.
- The shift exists only while the cards' verdict is pending, so it ends when cards go `'on'` on Dec 3.
- **Backlog, for the cards:** hold the regions' first paint during a pressed gesture, if cards ever return to `'allowlist'`.

**DD-2. N2: scrolling counts. D2 fixes it; declared until then.**
- **D2:** a wheel or trackpad scroll of the tape's own scroll container, the document included, is interaction (DC-5). It keeps the tape and marks the notice, as a touch swipe already does.
- **Declared under criterion 1 until D2,** under `'allowlist'` only: a viewer who wheel-scrolls and leaves within the pending window may see the welcome notice once more.

**DD-3. N3 and N4: one identity. D2 fixes both; declared until then.**
- **D2:** one identity record, the battle id and the nullable owner, compared with strict equality, serves three things:
  - the verdict;
  - the front-seen marker;
  - the "Game flow" return, which renders only for the identity that was admitted.
- **Declared until D2,** under `'allowlist'` only. Both need an owner change on a battle that is already mounted.

**DD-4. N5: exact grouping. D2 fixes it.**
- **D2:** the grouping compares the clamped elapsed-time separation with 44 px exactly, by integer cross-products, before any coordinate is computed. "Closer than" stays strict.
- **Tests:** the 369, 370 and 371 px rows, with the first member away from the axis origin.
- **Until D2:** at a width where two pins sit exactly 44 px apart, they show as one group. The output is the same every time.

**DD-5. The copy sweep's limit (Astra §5).** A control planted inside the attribution span escapes the copy-only sweep, and the quotation oracle catches it. This goes to the backlog as a test-helper limit.

## 2. What D2 carries from D1

- **Code:**
  - DC-1, DC-4 and DC-8 (Amendment C);
  - DD-2, DD-3 and DD-4 (this amendment).
- **Docs, committed verbatim:**
  - Astra's D1 confirmation → `docs/audits/20261121_ASTRA_CONFIRMATION_FILM_ROOM_D1.md`;
  - Amendment C;
  - Amendment D.
