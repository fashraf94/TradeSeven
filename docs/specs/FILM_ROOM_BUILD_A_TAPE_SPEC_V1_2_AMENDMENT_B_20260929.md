# Film Room Build A Spec V1.2 — Amendment B

**Date:** 2026-09-29 · **Author:** Fable (Film Room chat) · **Amends:** `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md` and Amendment A (`…_AMENDMENT_A_20260928.md`) · **Answers:** `docs/audits/20260929_ASTRA_DELTA_REVIEW_FILM_TAPE_A1.md` (verdict DO NOT MERGE at `8e754eb8`; DF1–DF8; the BA-26 contest)
**Status:** build-governing with V1.2 and Amendment A once committed. Where this amendment and Amendment A differ, this one governs. Approve-by-default for Flash.

Every finding in the delta review is accepted. Astra's contest of the BA-26 reading is accepted; the Film Room chat's provisional acceptance of that reading was too broad and is withdrawn. Astra's ruling on the BA-25 reading (a terminal tape keeps its status when inputs change) stands.

## BA-31 — Every candle output records what it was built from (DF1, DF2)

The candle input identity is **value-sensitive**. It is a canonical serialization of every value the replay, reconciliation, plan prices and series consume — per action: both legs' `replayInputs` values (entry, ATR, tier, threshold history, baseline), `lockedPoints`, the swap instant, `subsequentTradesInSlot`; per check: id, `capturedAt`, `stageReached`; the evidence values `boughtVsEvidence` reads; per plan: id, instant, symbol; the symbol-role set. Provenance and bookkeeping (`preservedFrom`, `writtenAt`, `copiedAt`, coverage objects) are excluded, so preserving a fact never changes the identity.

Each output **unit** — each action's `replay`, each plan's `price`, each series document — stores `builtFrom`, the hash of that unit's own inputs at the time it was built. A unit is **current** only when its `builtFrom` equals the hash of its inputs on the tape now. Replay, plan-price and series coverage are `complete` only when every unit is current. A unit kept by `keepBetter` or `keepSeries` keeps its own `builtFrom` and its stale label until a unit built from the current inputs replaces it; a retry that could not rebuild it never relabels it current. `passes.candles.inputFingerprint` remains the re-queue trigger, now computed from the same value-sensitive identity. `builtFrom` is a string and carries no number class.

## BA-26 amended — a limit preserves coverage only for unchanged dependencies (DF3)

Caveats are unchanged: sticky, unioned, status at most `partial`. A **limit** (a source unreadable on this read, an array at its cap) preserves stored coverage **only when the section's dependency identity is unchanged since that coverage was saved**. Each section stores `dependsOn`, the hash of the ids it depends on (check and eval ids, declaration expectations, action keys, directive thread ids, as applicable). When the merged dependencies differ from the stored `dependsOn` and the current read hit a limit, that limit becomes the caveat `unresolved_dependency`, naming the source; it holds status at most `partial` and is sticky until a read observes the new dependencies. The earlier reading — "a limit never overrides stored coverage" — is withdrawn.

## BA-32 — Terminal candle work leaves the queues (DF4)

Terminal candle states get their own status values: `expired` (formerly `failed` with `retry_window_elapsed`) and `exhausted` (formerly `failed` after the third attempt), each keeping its reason. `failed` now means retryable only. Every candle query — the sweep and the selection — selects only non-terminal statuses, so a terminal tape never occupies a query result; this is what makes the sweep resumable. The 60-session look-back for retryable failures is removed, since its only purpose was bounding re-reads of terminal rows. The declared composite index serves the new queries. No production tape exists (the writer is dark), so no migration.

The BA-25 reading carries over: a terminal tape whose inputs change keeps its terminal status, records `changedInputs`, and its coverage label names the change.

A query result whose path fails BA-23 is still skipped, counted in `summary.invalid` and never written. No sanctioned writer can create one (BA-35), so it gets no cursor; a non-zero `summary.invalid` in production is an alert, not a steady state. This is the accepted residual of Astra's D05.

## BA-33 — The sweep has its own clock (DF5)

The sweep checks the remaining time before every close-out, not only before each page, and may spend at most **60 seconds** of a run; the rest belongs to enrichment. When its share or the run's floor is reached it stops, reports `incomplete`, and resumes the next morning.

## BA-34 — Series merge by fact, not by count (DF6)

Each 10-minute bar stores `m`, the number of 1-minute bars it was built from (class `market`). A retry merges fact by fact: per bucket, the bar built from more minutes wins, and a tie keeps the stored bar; per check, a non-null `atChecks` sample is never replaced by null, and is replaced by another non-null sample only when that sample's bar completed later while still inside BA-24's freshness rule. A series that retains any earlier fact carries `preservedFrom`. Coverage is computed from the merged series. A true superset still replaces cleanly and clears `preservedFrom`.

## BA-27 amended — on a tie, the canonical battle wins (DF7)

On equal lifecycle rank, the battle document re-read inside the write transaction is authoritative for the whole completion block — `status`, `completedAt`, `final`, `result`, `battleStatusAtWrite` — which moves as one unit. A stale assembly never replaces a stored completion block that the re-read contradicts.

## BA-29 amended — backfill refresh is the repair path (DF8)

The backfill entry gains an explicit **refresh** mode (`refresh=1`, admin-only like the rest of the entry) that re-merges written days in the range through `writeTapeDay`. It is merge-monotone and idempotent: a day whose sources did not change writes nothing, and the response lists `refreshed` and `unchanged` separately. The default backfill is unchanged. Refresh does not reopen candle work outside the candle window; such a day keeps its labeled candle state (BA-25). Refresh, not the default backfill, is the founder's repair path for a written day whose sources grew.

## BA-35 — Malformed targets are rejected before any write (delta review §4)

The close pass validates the target `etDate` as a calendar session before calling `writeTapeDay` or `markCloseFailed`. An invalid target is counted in `summary.invalid` and nothing is written.

## Exit criterion for this branch (process ruling)

The next Astra pass is a **closure verification**: its own repros D01–D13 and controls C01–C16 against the fixed tip, each Amendment B ruling checked in code, and adversarial review of **only the code this round changes**. A new finding blocks the merge only if it produces a false `complete`, loses a saved fact, writes outside `agentBattles/*/tape/**`, or breaks flag-off. Every other finding is recorded in the review as a post-merge backlog item and does not block. The branch is dark; the writer flip and the A2 screen each have their own gates.
