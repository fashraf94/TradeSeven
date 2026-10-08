# Film Room Build A Spec V1.2 — Amendment E (A2: the screen)

**Date:** 2026-10-08 · **Author:** Fable (Film Room chat) · **Amends:** V1.2 §7 and §11, Amendments A–D · **Status:** build-governing once committed. Where it differs from an earlier document, this one governs. Approve-by-default for Flash (approved 2026-10-08).

## BA-40 — The gate: off, allowlist, on
`FILM_ROOM_V2_MODE ∈ {'off', 'allowlist', 'on'}` replaces `FILM_ROOM_V2_ENABLED`, pinned `'off'` and in `DARK_BY_DESIGN`, with an allowed-values suite. It resolves **per battle owner**: `'allowlist'` admits only owners the cockpit's server-side allowlist admits, answered by the existing cockpit-status verdict (one added response field if needed; no new endpoint; no uids in the client bundle). Where v2 does not resolve on, the legacy Film Room renders byte-identical to the pre-build commit. The hub helper (§11) keeps its signature's output — exactly `{ ready, target, availability }` — and uses Stage 3 only when v2 resolves on for the battle's owner; at most one bounded tape read and one cached verdict. Route and entry points are unchanged.

## BA-41 — The design of record, with six fidelity fixes
The Claude Design mock-up committed at `docs/design/20261008_FILM_ROOM_A2_MOCKUP.html` is the design of record for structure, behavior and vocabulary; the skin comes from the shipped Battle View V4 tokens and components. Its data are placeholders; the screen renders only tape values. Fixes:
- **F1** The split by cause always shows the **sold leg's sale**: recorded exit vs the bar at the swap, the rescore at the recorded exit, the inputs part and the price part (BA-38). The fill (`boughtAtSale`) is its own row group and never takes the sale's place.
- **F2** Number-kind markers come from the tape's `numberClasses` for each rendered path, never from a per-widget constant. (Bars and plan prices are `market`; the price part and gap are `rebuilt`; the inputs part and rescore are `derived` per BA-48.)
- **F3** No placeholder text. A check whose model call failed renders as the check's state at its time ("model call failed · the system held by default"), sourced from the check, labeled as the platform's, never as agent words. The tape does not store the platform's placeholder sentence and the screen does not invent one.
- **F4** The Diagnostic area holds only `diagnostics.intradayViews`, labeled "Diagnostic · recorded at the check · not seen by the agent", never under a "Why?" heading.
- **F5** Glance combines option B's score path with option C's grouped check runs (state, time span, count).
- **F6** The directive card's three states render from tape directive rows; the explainer ("How a directive card reads") may use clearly labeled fixtures.
Sign colors appear only on recorded scores, per the app's convention; never on rebuilt or derived hypotheticals, plan prices, or markers.

## BA-42 — Every number, its marker
Every numeric value on screen carries the marker of its declared class (recorded, derived, rebuilt, market) with one legend per screen. A rendered number without a declared class is a defect.

## BA-43 — The evidence overlay
On the Deep dive price chart, for a held symbol, each check that carries an evidence stamp shows a marker at the stamp's recorded `px` at `evidenceAt`. Opening a marker lists the stamp (`px`, `chg`, `atrX`, `vwapDev`, `bbPct`, `nr7`, `regime`, `risk`), labeled "Recorded at the check · what the agent was given · the platform's quote". A marker may sit off the bar line; that difference is the quote delay and is stated, not smoothed. A replay point is never presented as the price behind a check.

## BA-44 — Check detail
Tapping a check (strip or timeline) shows its time, state, decision, recorded risk decisions ("Risk decision recorded: HOLD", or the recorded action with its reason), scores and evidence stamp. The note "This does not show which protections were armed or checked." appears once per screen.

## BA-45 — Holdings at start and end
The grid shows the day's first and last held sets, with who entered each changed slot (the agent or a platform rule) and the time. If no stored field carries them, they are derived from the first and last checks' risk-verdict keys and `actions[]`, labeled derived; if neither is possible, the grid is omitted behind a coverage line.

## BA-46 — Rationale timeline
Recorded rationale renders as "Recorded rationale at HH:MM · the agent's words at the time · not verified", collapsed by default. Check states without agent text (model failures, budget skips, deferrals) appear in time order as states. The coverage line keeps the tape's count of platform-written entries not copied.

## BA-47 — Reserved slots
The screen has named, empty header and footer regions for the later "Since last time", "Prepared case", "Your call" and "Receipt" content, and every swap card is addressable as `#swap-n`. No later-release content ships in A2.

## BA-48 — AD4-10 resolved
`actions[].replay.reconciliation.soldAtSale.rescoredAtRecordedPx` and `.inputsDelta` are classed `derived`: every operand is recorded (the rule that a value takes its least-certain operand's class). The declaration golden updates; tapes written before the change keep their stored declaration, and every reader labels by the tape's own declaration.

## BA-49 — First open
The first-open notice from §7 shows once per viewer, then never again for that viewer, using the app's existing seen-once convention.

## Out of scope for A2
Take-home cards, the pattern counter, the Ledger, retiring the legacy proposal writers (R2), preferences, any agent voice, the later-release header and footer content, and deleting legacy components. They belong to the cards build and its contract, or later.

## Exit criterion for review (fixed now)
One review of the draft PR. A finding blocks the merge only if: a rendered number shows the wrong class or none; a verdict, ranking or forbidden word appears; a stated fact contradicts the tape; a non-owner can read a tape or series document; the off or non-allowlisted path is not byte-identical to legacy; or the hub helper returns anything but its three keys. Everything else goes to a backlog in the review and does not block.
