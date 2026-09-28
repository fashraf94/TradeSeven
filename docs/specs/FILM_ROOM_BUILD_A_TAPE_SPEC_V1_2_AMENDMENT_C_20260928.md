# Film Room Build A Spec V1.2 — Amendment C

**Date:** 2026-09-28 · **Author:** Fable (Film Room chat) · **Amends:** V1.2, Amendment A and Amendment B · **Answers:** the round-2 executor review, build report §9.11 (R1-1, R2-3, R1-3, R3-3)
**Status:** build-governing with V1.2, A and B once committed. Where this amendment and an earlier one differ, this one governs. Approve-by-default for Flash.

## BA-36 — Per-point merge for plan prices and replay points (R1-1)

`keepBetter` merges plan prices and replay points fact by fact, the way BA-34 merges series. When the saved and new units share `builtFrom`: a saved non-null value is never replaced by null; otherwise the more complete unit wins; a tie keeps the stored unit. When they differ in `builtFrom`, BA-31 governs: the unit current with the tape's inputs wins whole, and a stale unit is kept only when no current unit exists. A merge that keeps any earlier fact carries `preservedFrom`.

## BA-37 — The writer assembles from the battle it re-reads (R2-3)

`writeTapeDay` re-reads the battle document inside its transaction (BA-27). It now assembles from that re-read document, not from the selection-time copy; reads of subcollections made before the transaction stand. When the re-read differs from the selection-time document, the writer re-assembles before merging. No read is added. A stale selection-time value can therefore never overwrite a newer recorded value, and BA-31's re-queue is never triggered by a stale copy.

## BA-25 amended — Outside the window, changed inputs expire the pass (R3-3)

Outside the candle window, a `written` pass whose inputs changed becomes `expired` with reason `inputs_changed_outside_window`. Its output stays, labeled stale; its coverage names what changed. It is never `partial`, because `partial` promises a retry that the window forbids, and the sweep never touches it. Inside the window, the BA-25 and BA-31 rules are unchanged.

## BA-24 confirmed — Wholeness by buckets, minutes shown as a fact (R1-3)

A series is whole by the calendar's bucket count with a fresh price at every check (BA-24). Minutes are not a completeness criterion: the provider omits minutes in which no trade printed, so a minutes rule would mark thinly traded names partial without limit and spend their retries. The read-out prints, per series, "N of M session minutes traded" from Σ `bars[].m` against the calendar's session minutes, class `market`, as a fact beside the coverage line, never as a verdict.

## Backlog carried (not blocking, recorded once)

R2-4 (terminal status keeps the "awaiting the candle pass" outlook wording), R2-5 (an identical limited re-read writes once more), R3-5 (a refresh could merge `skipped_mode` over a written day if a mode ever changed), R1-7 (series roles are descriptive, not in `builtFrom`), R1-8 (a sweep with exactly `maxMarks` closable tapes reports incomplete), R3-2 (refresh resumes by date only), and the replay-inputs tie at zero legs. Each carries the proposal in report §9.11.

## Out-of-scope fix authorized by the founder

`src/components/League/backing/backingDark.test.jsx` (the week-key row) computes its expectation from the real clock and fails on `main` from 2026-09-28. The founder authorizes pinning that row's clock in a test-only commit on this branch, so the PR's Linux CI is green. It is not a tape change.

## Exit criterion (unchanged from Amendment B)

Astra's next pass is a closure verification of DF1–DF8, the round-2 review fixes and BA-36, BA-37 and BA-25 amended, with adversarial review of only the code changed since `8e754eb8`. A new finding blocks the merge only if it produces a false `complete`, loses a saved fact, writes outside `agentBattles/*/tape/**`, or breaks flag-off. Anything else joins the backlog.

## Addendum — founder rulings on the round-3 review (2026-09-28)
- **L4-1 (BA-34 extended).** A series check sample's stale bar age is a saved fact, as for plan
  prices and replay legs (L1-4). When saved and new samples both lack a price, the one whose bar
  closed later is kept; a saved age is never replaced by a bare null.
- **L1-2 (display rule, no merge change).** Replay points and series samples are separate facts
  with their own merge rules; neither is corrected to the other. The A2 screen never pairs a
  replay point with the series price at that check as the price behind it; a replay point is
  shown only with its own sampled inputs.
- **L2-1 (kept).** Under the exit criterion, a newly found false `complete` in code the closure
  pass reviews blocks whatever its root; the narrow fix stays.
- **L3-1 (authorized).** The backingDark row clears its mock before mounting.
