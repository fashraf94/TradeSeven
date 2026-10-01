# Film Room Build A Spec V1.2 — Amendment A

**Date:** 2026-09-28 · **Author:** Fable (Film Room chat) · **Amends:** `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md` · **Answers:** `docs/audits/20260928_ASTRA_REVIEW_FILM_TAPE_A1_BRANCH.md` (verdict DO NOT MERGE, findings F1–F9, §6.9 confirmed)
**Status:** build-governing with V1.2 once committed. Approve-by-default for Flash. No further spec round; the fix branch's delta review verifies these in code.

Every finding in the review is accepted. The class rulings in its §6 are confirmed. This amendment adds the rulings the fixes need and disposes of the one interpretation question the review raised.

## BA-23 — Write-path validation (F1, F9)

A collection-group query result is never written to on the strength of its collection name. Before any write, expiry, failure record or fetch, the pass validates that the reference's path is exactly `agentBattles/{battleId}/tape/{etDate}` with a well-formed `etDate`, and constructs every downstream reference from those validated identifiers. A reference that fails validation is skipped and counted, never written. Every physical write site is routed through a named writer the protected-store scanner can see; the allowlist and the human review cover the full physical census — seven sites at the reviewed tip, plus any the fix adds.

## BA-24 — Sample freshness and session completeness (F2, mutant M11)

The price at an instant remains the close of the last 1-minute bar that completed at or before it (BA-11). A sample is **valid only if that bar completed within 5 minutes of the instant**; the close sample is valid only if its bar completed at or after the session's calendar close minus 5 minutes. An invalid sample is `null` with `price:SYMBOL@<tickSeq | swap | close>` in `missingInputs`, and carries the stale bar's `barClosedAt` beside the null so the age is visible. A replay with any null sample is not `complete`; a series whose bar count is below the session calendar's expected bucket count (39 regular, 21 early-close, derived from the calendar, never a constant) is `partial`. A tape with invalid samples stays retryable within the window. `symbolsMissing` empty is not evidence that bars were complete.

## BA-25 — Nothing shrinks on retry; candle output tracks its inputs (F3, F4)

The candle pass reads the stored series inside its transaction and keeps, per symbol, the better of stored and new by minutes covered and non-null `atChecks`; a shorter non-empty response never replaces a longer saved one, and the kept series carries `preservedFrom`. The candle pass stores an **input fingerprint** — check ids and times, `stageReached`, evidence presence, action ids and their replay-input presence, plan ids, the symbol-role set — in `passes.candles.inputFingerprint`. When a close pass changes the fingerprint: inside the window the candle status returns to `pending` with `reason: 'inputs_changed'`; outside it, `partial` with the note naming what changed. Previous replay and series stay in place, labeled, until replaced.

## BA-26 — Coverage is evidence, not rank (F5)

A section is `complete` only when every source it depends on was present for the whole day and nothing it depends on is unknown. A minted check with no tick, no entry or no run record makes every section that would have read that check at most `partial`, with `unknownChecks: n` in its coverage; the calls note reads "no model check recorded among the N known checks; M checks have no record," never a categorical claim about the day. When tapes merge, facts keep their earlier rank with `preservedFrom`, but **a caveat learned later always lowers coverage**: reasons and notes are unioned, `deferralsTruncated` and similar flags are sticky, and status is the lower of what the later run can vouch for and what the earlier run recorded. Directive coverage accounts for missing entries the same way.

**BA-20 amended (review R13).** An `evaluations[]`-sourced section is at most `partial` when the array was at its cap **and** its oldest surviving entry is on or after the day's start, or when the day's first entry is absent. When the oldest surviving entry predates the day, nothing from the day was evicted, and the cap alone does not lower coverage. The build's rule was correct and is now the spec's.

## BA-27 — Completion is terminal (F7)

The battle block is merged as an ordered lifecycle: `completed` never regresses to `active`, and `battleStatusAtWrite`, `completedAt`, `final` and `result` move together. The writer re-reads the battle document's status inside its transaction and uses the later of the assembled and re-read lifecycle states. A stale assembly can add facts; it cannot move the battle backward.

## BA-28 — One calendar, one eligibility rule (F6)

The session calendar is a dependency-free module imported by both the server passes and the hub helper; the helper never carries its own holiday list. The helper answers `pending` only when the writer's own selection would tape the battle: it validates every `timing.tradingDays` entry as a calendar session, treats a malformed or unmaintained-year timeline as `unavailable`, and uses the same owning-pass rule as `tapeDateFor`. Stage 3 stays unreachable until `FILM_ROOM_V2_ENABLED` flips; the fix ships now so the helper and the writer cannot drift apart later.

## BA-29 — Expiry is a sweep (F8)

Each candle run also sweeps, in a bounded batch, non-terminal tapes older than the retry window and marks them `failed` with `reason: 'retry_window_elapsed'`. No pending tape is left behind the scan forever. The founder's repair path for such a day is the backfill entry, which re-merges a written day when its sources have grown (BA-19).

## BA-30 — Aftermath counts use every merged boundary (review R08, unpromoted)

A directive's `after` counts are recounted from the merged check and action rows bounded by **all** merged directives, including ones preserved from an earlier run. A latent seam, closed now because it is cheap.

## Out of scope, routed

The live-scoring defect Astra confirmed (review §7; the build report's §6.9): after the nightly reset, a position swapped in on an earlier day scores at the zero-change fallback. Not the tape's to fix; routed to the Command Center arc as a scoring bug with Astra's repro R21. The tape's `ghost.entryPrice` handling (missing, named, never guessed) already accounts for it.
