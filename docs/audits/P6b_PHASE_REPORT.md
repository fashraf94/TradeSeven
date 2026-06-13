# P6b Phase Report — Competitive Surfaces

**Phase:** P6b — Leaderboard · Rank · Spectator Hierarchy · Feeds · User-Side Double-Down
**Branch:** `claude/jolly-keller-g6ci11` (fresh off the P6a merge, HEAD `841963e`)
**Posture:** consumes P6a's docs; adds the one remaining writer (user-side double-down) and the surfaces. **NO cron, NO rules — the merge needs no Console deploy.**

---

## Executive verdict

| Item | Status |
|---|---|
| A — Leaderboard surface (month nav, signed rows, CPU chips, you-row, consensus/contrarian) | ✅ Built (`LeaderboardCard`) |
| B — Rank surface (tier/floor/progress/audit, CPU shown-but-frozen per §7.1) | ✅ Built (`RankCard`) |
| C — Spectator hierarchy (bracket → standings → theater → honest P7 battle degrade) | ✅ Built (`SpectatorView`) |
| D — User-side double-down (flip `flipped`, claim `formed`/`broken`, `side:'user'`) | ✅ In the flip + claims transactions, atomic |
| E — §7.1 CPU non-ratchet + §7.2 degraded-lock refusal | ✅ Both with tests |
| Feeds (C-1) consensus + contrarian — derived fields on the month doc | ✅ Reorder + thread (founder Option 1), zero new reads |
| Cron budget | **38/40 — ZERO added** |
| Firestore rules | **ZERO added** |
| Fence contact | **None** (read-only calls only) |
| Tests | **2659 pass** (full suite); build green |
| `/code-review` (max effort) | 0 correctness bugs, 0 integration breaks; 4 cleanups applied |

---

## What shipped (file:line)

### A — Leaderboard surface
- `src/components/Tournament/LeaderboardCard.jsx` — month nav by doc key (chevrons over `YYYY-MM`, boundary-clamped via `monthNavState`), signed rows sorted where they fall (negatives red), CPU chips, you-row teal, row → `SpectatorView` via `currentGroupId`. The C-1 consensus/contrarian cards read `doc.feeds`.
- Pure helpers: `shiftMonthKey` (`leagueTournament.js`), `etMonthKey`/`monthNavState` (`tournamentSurfaces.js`).

### B — Rank surface
- `src/components/Tournament/RankCard.jsx` — current tier + floor + within-tier progress bar (`rankProgress`, the ratchet made legible), per-week `raw · guard · Δ → RP` audit, peak. **CPU rows shown-but-frozen** (founder-chosen): RP shown, no progress bar, "bots don't climb (§7.1)".

### C — Spectator hierarchy
- `src/components/Tournament/SpectatorView.jsx` — one `subscribeBracket` + round/advancers context, group standings (composite of record, CPU marks, you-highlight), the existing `DraftPlaybackTheater` CTA, and a battle CTA that **degrades honestly** (`spectatorBattleSummary`: per-player user/agent/composite + live pick directions, labeled "full battle view arrives with the tournament battle screen"). Never a dead button.

### D — User-side double-down (D-1)
- `api/_utils/tournamentAgentLedger.js` — `detectUserDoubleDownEvents` (pure, `side:'user'`, cross-market guard `heldBy===ownAgentId`), `buildOwnerAgentMap` / `readOwnerAgentMap` (odUserId→agentId from the immutable stream), `buildUserDoubleDownWrites` (the shared ledger-slice + feed-entry recorder — one home so flip and claims never drift).
- `api/tournament/flip.js` — a flip on an own-agent-held symbol emits `flipped`; ledger `doubleDowns` + `double_down` group-feed entry in the SAME transaction (reads-before-writes verified).
- `api/_utils/tournamentClaims.js` — approvals emit `formed` (won name) / `broken` (dropped name) against own-agent holdings, atomic with resolution.
- Renderer: `feedEventText` (`tournamentSurfaces.js`) gains the `double_down` case — both sides, **absent `side` reads as agent**; `GroupFeed.jsx` extracted from `LeagueScreen` and mounted on both surfaces.

### E — Finalization rulings
- **§7.1** (`api/_utils/tournamentRank.js:80`, `applyRankWeekFrozen` in `leagueTournament.js`): the rank writer skips the ratchet for `isCpu` seats — RP computes for display, `floorRp` pinned 0. Human ladder untouched.
- **§7.2** (`api/_utils/tournamentAdvancement.js`, `isFinalSnapshotDegraded` in `leagueTournament.js`): the lock is gated BEFORE `lockTopTwo` in both the cohort and base-layer paths — a degraded final snapshot (`agentScoresCarried`) refuses to lock, counts `degradedLocks`, defers; banking self-heals and the idempotent lock lands clean next pass.

### Feeds (C-1) — founder Option 1
- `api/_utils/tournamentLeaderboard.js` `buildLeaderboardFeeds` (pure): consensus = per-symbol user + agent holder counts; contrarian = ≤2-holder symbols whose best user holder beats the day's upper composite quartile (named, open cards; empty for cohorts < 4). Computed once, outside the transaction.
- `api/cron/snake-draft-daily-scores.js` reordered to **banking → reconcile → leaderboard**; `reconcileAllTournamentLedgers` now returns `heldByGroup` (read-only reuse of its existing ledger reads), threaded into `aggregateTournamentLeaderboards`. **Branch fire-walling preserved** (each try/catch independent; reconcile failure → `heldByGroup = {}` → feeds degrade honestly, no cascade).

---

## Tests
2659 pass. New/changed: §7.1 frozen (writer + pure), §7.2 refusal + self-heal (the prior "proceeds" test flipped), double-down detection (formed/broken/flipped, cross-market guard, pre-draft absence) + end-to-end flip atomicity, feed derivations on fixtures, month-nav boundaries, rank progress math, spectator honest-degrade, feed-text both-sides. Mocks in 4 claim/flip suites extended to model the new ledger/stream reads.

## Guardrails honored
Zero fence contact · **zero new cron** (feeds ride the nightly branch; double-down rides flip/claims) · **zero new rules** (all surfaces covered by P6a's read blocks; ledger writes are server-side) · riders awaited/atomic · all UI flag-gated (`TOURNAMENT_TAB_ENABLED` stays false), tokens-native, reduced-motion-aware · one branch.

## Flag carried from Stage 0
The **P6a phase report is absent from `docs/audits/`** (latest is P5). Per BUILD_RULES §3 it was not reconstructed; the P6a doc shapes were verified directly against the merged code (no drift). Recommend uploading the P6a report original.
