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

## Addendum — founder rulings on the A2 build report (2026-10-08)

- **R1 — digits inside stored notes.** Stored coverage notes and missing-input lists render verbatim as the tape's own words, as quotation, without markers. The counts inside them become classed fields when a later build touches the tape writers (backlog for the cards build).
- **R2 — held by default.** The screen's wording "no usable model result · the system held by default" is adopted. F3's "model call failed" waits until the tape records the failure class.
- **R3 — the mode and DARK_BY_DESIGN.** `FILM_ROOM_V2_MODE` is pinned directly and named in the DARK_BY_DESIGN block, per the `CALL_RECORDS_MODE` precedent. Adopted as built.
- **R4 — BA-42 applies to claims, not to scaffolding or sequence.**
  - (a) A number the screen computes is allowed when it is declared in `SCREEN_AGGREGATE_CLASSES` with a class by the least-certain-operand rule: section counts and "n of m" are `derived`; swap ordinals are `derived` and express sequence only; open-to-close change and session volume computed from series bars are `market`.
  - (b) Chart scaffolding (gridlines, axis tick labels, a percent axis, time ticks) carries no per-tick marker; each axis names its class once in its caption.
  - (c) The day change shows its stored reference value with that value's own marker.
  - (d) Display names (company names) may come from the app's existing symbol directory; absent that, the symbol alone.
- **R5 — "takeaway".** Not a verdict word. The forbidden list stands as written; the surviving mutant L2 is accepted.
- **R6 — rationale preview.** A clamped preview of the first lines with "Read more" satisfies BA-46's "collapsed by default".
- **The admitted owner's first open.** Showing the legacy screen for up to 8 s while the verdict lands, under `'allowlist'` only, is accepted; it follows from the byte-identity requirement and disappears at `'on'`.

## Addendum 2 — founder rulings on Astra's A2 review (2026-10-09)

- **R7 — Recorded words are quotation, not the screen's voice.** Text the tape stores as someone's words (the agent's rationale and hypothesis, the player's directive text, the agent's replies, plan prose) renders verbatim inside an attributed quotation: who (as the tape records it; "the stored plan" when the tape records no author, never a guess) and when. The forbidden-word boundary governs the screen's own voice: every string outside an attributed quotation, including headings, labels, notices, `aria-label` and `title` text, and company names. Inside a quotation the words are the record; the screen does not rewrite, mask or omit them.
  - *Guard.* A quotation takes a tape path, not a string. Its text equals the stored value at that path, byte for byte; the clamped preview clamps with CSS over the full value. The screen composes nothing inside a quotation and copies recorded text into no other element or attribute.
  - *Exit criterion 2 now reads:* "a verdict, ranking or forbidden word in the screen's own voice (any text outside an attributed quotation bound to a tape path)."
  - *Why.* An agent that wrote "best entry" on a day the swap lost is exactly what a player comes to the Film Room to see; hiding the word would show a more careful agent than the one that played. Omitting the player's own directive because of a word they typed would show them a different record from the one they made.
- **R8 — A spelled-out quantity is a number.** BA-42, as narrowed by R4, covers counts written as words. The subtitle's battle length renders through a `derived` aggregate declared in `SCREEN_AGGREGATE_CLASSES` (the count of `timing.tradingDays`) with its marker; on the fallback to the final tape's `dayNumber`, it takes that document's declared class and marker. The word styling stays. The A2 build report's proposed duration exception is not adopted.
- **F2 needs no ruling.** Under R4(b) scaffolding may go unmarked, but it may not contradict the series: "close" names the calendar's session-close instant, never the end of the last available bar.

## Addendum 3 — founder rulings on the round-1 fixes (2026-10-09)

- **R9 — Number words in stored platform text.** R1's exemption covers spelled-out numbers as well as digits: stored coverage notes, missing-input lists and each replay's stored `label` render verbatim. The forbidden-word boundary still applies to them. The screen's own fallback for BA-11's sentence is the screen's voice and is reworded to say the same thing without a number word ("a hypothetical of this swap alone, through the day's close; …").
- **R10 — Stored directive fields.** `canonicalText` and `retainedDirectiveText` render as R7 quotations credited "the stored directive", with the directive row's `filedAt`. The tape records no author for either, so none is guessed. The retained directive's time is its own row's instant, the only instant the tape records for it; the card's "No new directive filed" line keeps that time from reading as a filing time.
- **R11 — The replay sentence without a replay.** Accepted for the allowlist phase: the screen's sentence shows on a swap card whose replay is not written yet (from the close pass until the candle pass) or never will be (a crypto leg, a tape outside the candle window), and a crypto card carries the caveat twice in two wordings. Before `'on'`: a card shows the sentence only beside a drawn replay, and a card without one shows its replay coverage line alone. The follow-up pass does this.
- **R12 — R8's reach.** R8 covers quantities: counts and durations written as words. Ordinals and positional words ("first", "last") name a place in a recorded sequence, and "shown once" describes the screen's own behaviour. Neither is a quantity claim, so neither takes a marker. A positional word is still a stated fact: a "first" or "last" that doesn't match the tape breaches criterion 3.

## Addendum 4 — founder ruling for the follow-up pass (2026-10-10)

- **R13 — The agent's name.** The agent's name is a stored display name chosen for the agent, not the screen's voice. It renders exactly as stored, bound to its stored field (its text equals the stored value), and is exempt from the forbidden-word and number-word sweeps on that binding alone, as a bound quotation is under R7. The screen never composes it into other copy, never alters it, and never uses it in an `aria-label` or `title` other than its own element's. When no name is stored, the subtitle starts with the archetype, as before.
