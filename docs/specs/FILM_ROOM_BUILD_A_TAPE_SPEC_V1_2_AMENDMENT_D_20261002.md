# Film Room Build A Spec V1.2 — Amendment D

**Date:** 2026-10-02 · **Author:** Fable (Film Room chat) · **Amends:** V1.2 and Amendments A–C ·
**Answers:** docs/audits/20261002_FILM_TAPE_FIRST_SMOKE_DISCOVERY.md (Q1, Q2) · **Status:**
build-governing with V1.2 and A–C once committed. Where this amendment and an earlier one differ,
this one governs. Approve-by-default for Flash.

## BA-38 — The reconciliation names its two causes (Q1)

The platform banks a sale and records a bought entry at its own quote, which runs about 15–20
minutes behind. The tape rebuilds the same instant from completed 1-minute bars (BA-11). These are
two vintages of the same moment, so closedLegDelta mixes a price-vintage difference with any genuine
scoring-input difference. The tape now separates them.

Each action's replay gains:

- `reconciliation.soldAtSale`:
  - `recordedPx`: the trade's exit price.
  - `rebuiltPx` and `barClosedAt`: the sold name's price at the swap instant under BA-24.
  - `pxDelta`: rebuiltPx − recordedPx.
  - `rescoredAtRecordedPx`: the imported calculateAssetScoreServer with the ghost leg's inputs at
    recordedPx. No local scoring math (BUILD_RULES §4).
  - `inputsDelta`: rescoredAtRecordedPx − lockedPoints.
  - `priceDelta`: ghost.atSwap − rescoredAtRecordedPx.

  When all parts exist, inputsDelta + priceDelta = closedLegDelta exactly. A missing part is null,
  with its input named; it is never 0.
- `reconciliation.boughtAtSale`: `recordedPx` (the bought entry, inBasis.price), `rebuiltPx` and
  `barClosedAt` at the swap instant, and `pxDelta`.
- `lockedBasis: 'eodhd_realtime_delayed'`, with the fixed note: "Banked points and the bought entry
  use the platform's quote, delayed about 15–20 minutes; rebuilt values use completed 1-minute
  bars." The gap label carries the same note, because the gap combines both bases.

Classes (BA-21):
- recordedPx: `recorded`.
- rebuiltPx: `market`.
- pxDelta, rescoredAtRecordedPx, inputsDelta and priceDelta: `rebuilt`.

**Replay logic version.** Each replay's builtFrom includes a replay-logic version, bumped by this
change. A logic-version change is not an input change:
- Inside the candle window, a re-merge re-queues the pass with reason `replay_logic_updated`, and
  the next candle run rebuilds it.
- Outside the window, the pass status is unchanged, and the replay's note says "built by an earlier
  replay version; the reconciliation split was not computed".

**The smoke check, amended.** "closedLegDelta small" is replaced by "inputsDelta = 0 on every
action; priceDelta reported, not judged". A non-zero inputsDelta is a finding.

## BA-39 — No result from a missing score, and the platform's own words (Q2)

- A battle result is derived only when both final scores are recorded finite numbers. Otherwise its
  value is null, its basis is `unavailable`, and its note names the missing score (for example
  "opponent score never recorded").
- The result is recomputed from the merged final scores on every merge, never kept by rank alone. A
  `stored` basis (a result field written by the platform) still wins when one exists.
- `battle.completionMessage`: the platform's battle_complete status-feed message is copied verbatim
  with its time, as recorded platform text. It is never presented as the agent's words. The read-out
  labels it "Platform recorded at completion". A player whose career stats show a draw can then see
  where that draw came from, beside the tape's "unavailable".

## Out of scope, routed

The 15–20-minute quote delay itself is the Intraday arc's price-source stage. Persisting the
quote's own timestamp on trades touches the fenced executor. The born-finished battles and the
completion's missing-score-as-zero rule belong to the Command Center arc, which has already been
sent them. None is changed here.
