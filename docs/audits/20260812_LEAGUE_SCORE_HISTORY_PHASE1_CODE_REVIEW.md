# League Score History — Phase 1 Build + BUILD_RULES §2 Code Review

**Date:** 2026-08-12
**Branch:** `claude/league-score-history-spec-7x7h2g` (cut off `origin/main` @ `a17da59b`)
**Diff reviewed:** the Phase 1 build at commit `ba249e0c` — 17 files, +865/−28.
**Spec:** `20260808_LEAGUE_SCORE_HISTORY_BUILD_SPEC_V1` (Level 1 + swap history first, founder ruling — surface (b) Film Room).
**Review basis:** BUILD_RULES §2 (mandatory at ≥10 files): multi-lens, adversarial, independently verified, explicit `vite build`, mutation-checked, written down.

---

## Executive verdict

| Item | Result |
|---|---|
| Scope shipped | Level 1 per-day composite timeline + per-day agent swap ledger, in the Film Room, behind a new **dark** flag `LEAGUE_SCORE_HISTORY_ENABLED` (default false). |
| Fence (§1) | **No fenced file edited** (verified `git diff --name-only` against the §1 list). Recap is read-only over `trades[]`/`dailyScores`/`thresholdHistory`; `createAgentBattle` doc shape untouched. |
| Persistence | **No new persistence / no new Firestore writes** (read-only arc). No new index (reuses the `array-contains` member query). |
| §9 display-agreement | Swap totals reconcile with the live strip's SWAPS term **by construction** — one `buildSwapLedger` source, same `fmtScore` formatter. Bound by a cross-surface test. |
| Flag-off byte-identical | **Holds** — proven per path; the one unconditional refactor (`agentDeparted` via `buildSwapLedger`) is byte-identical. |
| Review | 6 lenses × adversarial refute (11 agents). **6 findings CONFIRMED → all fixed; 1 REFUTED.** |
| Suites / build / lint | New suites green; `vite build` ✓; lint clean on touched files. 8 pre-existing failures unrelated to this diff (filed below). |

---

## Method

A 6-lens adversarial review workflow (finder per lens → each finding handed to an independent skeptic instructed to **refute** it with a concrete repro; a claim survives only if it could not be broken). Lenses: flag-off byte-identical · §9 display-agreement · `buildScoreHistory` correctness · wiring/lifecycle/reachability · fence/persistence/rules · test-integrity/mutation. 11 agents, 0 errors. Then every CONFIRMED finding was fixed and the fixes re-verified (suites + build + lint).

---

## Findings, verdicts, dispositions

### CONFIRMED (all fixed)

**C1 [HIGH] §9 format mismatch — swap points printed as integer while the strip prints one-decimal.**
The recap rendered swap points with `fmtPoints` (signed integer) while the live decomposition strip renders its `SWAPS` term with `fmtScore` (signed one-decimal, `DecompositionStrip.jsx:92→41`) — so a fractional swap would read "−29" in the recap and "−29.0" on the strip, and the recap copy asserted they were "the same number."
**Fix:** `FilmRoomRecap.jsx` now uses `fmtScore` (and `tintScore`) for every swap value — per-swap rows, per-day subtotals, and the battle total — matching the strip's formatter exactly. `fmtPoints`/`tintPts` removed.

**C2 [HIGH] §9 source mismatch — two hosts mounted the arena without `battleChain`.**
`LeagueTrainingBattleView.jsx:159` and `leagueBattleViewRender.jsx:25` mounted `LeagueBattleArenaLive` without the day-chain, so the recap's swap source was empty (recap "No swaps yet") while the live strip still showed a non-zero SWAPS term — a same-screen source-level contradiction.
**Fix:** (a) `LeagueBattleArenaLive.jsx` now falls back to `[battle]` when no chain is threaded (`effectiveChain`) — every host's recap has at least the **current** day, which is the exact doc the strip reads, so the today-subtotal always matches the strip's SWAPS (prior days are simply absent, never a false "no swaps"). (b) `LeagueTrainingBattleView.jsx` now threads the full `chain` from `useMyTournamentBattle`.

**C3 [MEDIUM] Swap "DAY N" used a parallel day axis (chain ordinal) from the timeline's banked dayN.**
The Level 1 timeline numbered days from `dailyScores` keys (the real banked dayN); the swap ledger numbered days by `createdAt`-sorted chain position (`i+1`). A chain gap (a daily deploy gated/failed while banking still increments dayN) would print two different DAY numbers for the same day in one recap.
**Fix:** `buildScoreHistory.js` now maps each daily doc to its banked dayN via `recordedDate` (`dailyScores.dayN.recordedDate` ↔ the doc's `timing.tradingDays`), so the swap ledger shares the timeline's day axis. Falls back to the chain ordinal (flagged `dayIsOrdinalFallback`) only when a doc has no mappable date.

**C4 [MEDIUM] Post-bank recap rendered live-only copy.**
`FilmRoomRecap` was phase-blind: on a completed battle (the survives-the-bank card) it still said "· today" and "the SWAPS term on the live strip" — but there is no today and no strip after the bank.
**Fix:** `FilmRoomRecap.jsx` now consumes `history.phase`; the "· today" marker and the live-strip footnote render only when `phase === 'live'`; the completed path shows banked-standing copy instead.

**C5 [HIGH] The §9 parity was asserted by name only — no test exercised both call sites.**
The two suites each pinned the swap total against their own literal fixture, so a reintroduced divergent local swap copy (the §4 anti-pattern) in either `buildArenaModel` or the recap would slip CI.
**Fix:** `buildArenaModel.test.js` adds a **cross-surface** test asserting `buildArenaModel(...).decomposition.swaps === buildScoreHistory({...}).currentSwapSubtotal` for the same battle (fractional points) — the two surfaces bound on one input.

**C6 [MEDIUM] No mid-battle zero-swap-day fixture pinned the day labeling.**
A filter-before-number refactor would mislabel post-gap days yet pass all existing fixtures (every one gap-free or trailing-empty).
**Fix:** `buildScoreHistory.test.js` adds a fixture with a mid-battle no-swap day (`recordedDate` axis), asserting the day-3 swap stays DAY 3 (not DAY 2), that swap days are a subset of timeline days, and that the ordinal fallback flag is set only when a date can't be mapped.

### REFUTED

**R1 [LOW] `leagueSwapLedger` `isCrypto === true` / degraded display fields unguarded** — claimed to leak to a recap crypto badge / name-tier chips. **Refuted:** the recap does not render `isCrypto`/`name`/`tier`; the `=== true` coercion has no consumer that would misbehave. No change.

---

## Flag-off byte-identical (acceptance #8) — no findings

The flag-off lens returned zero findings and its residual proves each path inert: `LEAGUE_SCORE_HISTORY_ON` false ⇒ no completed-group subscription, the second `useMyTournamentBattle` receives `null` (hook early-returns, no listener), `history` is `null` (no chip, no overlay change, original Film Room placeholder), and `recapEntry` is `null`. The one unconditional change — `agentDeparted` via `buildSwapLedger` — is byte-identical (same filter truthiness, same `pts` extraction, same order, same `total`; extra ledger keys stripped before assignment). Rules-of-hooks intact (new hooks precede the first early return). The `done && filmOpen → filmOpen` mount-gate change is behaviorally identical off-gate (the only non-gated `onFilm` setter is complete-state-only in `DockStatePanel`/`MComplete`, and the `[state,mode]` effect + `key={state+md}` reset `filmOpen`).

---

## Verification

- **`vite build`** — ✓ built (the §2-mandated build; the only check that catches an import/syntax error the suite would miss). Re-run green after the fixes.
- **Suites** — new suites (`leagueSwapLedger`, `buildScoreHistory` incl. the recordedDate day-axis tests, the `selectMyMostRecentCompletedGroup` block, the cross-surface parity test) all pass. Full suite: **7465 passed / 8 pre-existing failures / 53 skipped**.
- **Mutation sense-check** — the parity test (C5) fails if either call site stops using `buildSwapLedger`; the day-label test (C6) fails under a filter-then-ordinal numbering; the format fix (C1) is exercised via the arena render smokes.
- **Lint** — clean on all touched files (repo-wide `eslint .` noise is pre-existing, in `tracer/`, `vite.config.js`, etc.).

## Pre-existing failures (NOT this diff — filed for separate tasking, BUILD_RULES §3)

Confirmed identical on the pristine branch (stash-and-run):
- `buildArenaModel.test.js` (4) — stale `LEAGUE_LIVE_ORB_ENABLED` "flag off = today" tests assert off-behavior while the flag ships `true`.
- `flagPinGuard.test.js` (2) + `api/_utils/wireFlags.test.js` (2) — `WIRE_METRICS_ENABLED` was flipped `true` without reconciling `wireFlags.test.js:15` (pins `false`) or dropping it from `DARK_BY_DESIGN` (the §2 flag-flip-reconciliation rule). One flip-reconciliation task fixes all four.

These were not introduced or touched by this work and, per BUILD_RULES §3, are reported rather than fixed here.

---

## File map (Phase 1)

New: `leagueSwapLedger.js` (+test) · `buildScoreHistory.js` (+test) · `FilmRoomRecap.jsx` · `LeagueRecapEntry.jsx`.
Edited: `featureFlags.js` (dark flag + resolved gate) · `leagueTournament.js` (`selectMyMostRecentCompletedGroup`) (+test) · `tournamentGroupService.js` (`subscribeMyMostRecentCompletedGroup`) · `useMyTournamentBattle.js` (returns `chain`) · `buildArenaModel.js` (§9 `buildSwapLedger` refactor, byte-identical) · `ArenaOverlays.jsx` (Film Room renders `history`) · `ArenaMobile.jsx` / `ArenaDesktop.jsx` (live entry + `history`) · `LeagueBattleArenaLive.jsx` (computes `history`, chain fallback) · `LeagueTrainingBattleView.jsx` (threads chain) · `LeagueParticipantView.jsx` (completed-group wiring).

**Status:** built dark, reviewed, fixed, green. Flag flip is a separate one-line PR after the founder's preview smoke (`?leagueScoreHistory=1`).
