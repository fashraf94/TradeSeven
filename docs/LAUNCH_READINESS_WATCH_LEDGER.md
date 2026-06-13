# Launch-Readiness Watch Ledger (P9 inherits this)

**Created:** P8 (2026-06-13), at the integration sweep. **Owner of action:** P9 (flag flip + launch checklist).
**Status of the build at creation:** P0–P8 merged/in-flight; League is feature-complete behind `TOURNAMENT_TAB_ENABLED` (still `false`). The P8 integration sweep found **no producer/consumer seam mismatch** (the seam map is in `docs/audits/2026-06-13_P8_STAGE0_SWEEP_REPORT.md`).

This file is the consolidated list of known, founder-acknowledged, **deferred** items the build carried to launch — the things P9 must check, deploy, or watch. It is a record, not a backlog of bugs: each item is launch-safe at V1 scale with a stated trigger for when it stops being so. Nothing here blocks the flag flip **except the items marked 🚩 BLOCKING**.

---

## 🚩 BLOCKING gates for the flag flip (P9 must clear these first)

### G1 — Deploy the Firestore rules for the tournament collections
Every client read in `LeagueScreen` (group, claims, boards, streams, ledger, bracket, leaderboard, rank) depends on rules blocks that are **in the repo but carry "inert until manual Console deploy."** If they are not deployed before `TOURNAMENT_TAB_ENABLED` flips, every client read 403s.
- Blocks (all in `firestore.rules`): `tournamentGroups` (`:302`), `tournamentGroups/{groupId}/{document=**}` (`:312`), `tournamentBrackets` (`:322`), `tournamentLeaderboards` (`:334`), `tournamentRanks` (`:339`).
- **Action:** confirm all five are deployed in the Firebase Console, then flip the flag.

---

## Document-and-watch items (launch-safe now; each has a trigger)

### W1 — `subscribeMyGroup` has no composite index (ledger item 3)
`src/services/tournamentGroupService.js:145-160` queries `groupMembers array-contains uid` with **client-side** status filtering and **no `limit`** — it reads *every* group the player was ever in (completed included), growing monotonically over a career. Deliberate, to dodge a composite index (founder note 3).
- **Launch-safe:** early-round players are in 1–few groups.
- **Trigger:** a long-lived player accumulates many completed groups (order tens) → noticeable read cost / latency.
- **Fix when triggered:** add the composite index (`groupMembers array-contains` + `status in [forming,battle]`) and switch the query to server-side status filtering. **This is a Console index deploy — flag it in the PR; never improvise the index from a session.**

### W2 — Seasonal leaderboard is one whole-doc month board (ledger item 4)
`api/_utils/tournamentLeaderboard.js` read-modify-writes one `tournamentLeaderboards/{YYYY-MM}` doc per upsert. At ~250–400 bytes/entry the Firestore **1 MiB doc cap** lands around **3–5k active players/month**, at which point every upsert for that month fails together (header `:31-37`).
- **Launch-safe:** V1 scale is tens of rows (one bracket + base layer).
- **Trigger:** approaching open registration / a few-thousand monthly actives.
- **Fix when triggered:** land the designed **per-entry subcollection sharding** *before* open registration.

### W3 — Claim/flip transaction read budget (ledger item 2) — verified bounded
Documented here so it is not re-litigated. The claims resolution transaction is **per group** (`process-draft-claims.js` loops `processClaimsForTournamentGroup`, one tx each — never a combined cross-group batch). Per-group reads: `groupRef` + `pendingQuery` (≤12 pending docs at 4-player × 3-cap) + `ledger` ≈ **14 reads**, ~14 writes. The flip tx is ≤2 reads. Both sit far under Firestore's practical per-transaction constraints (10 MiB total, reads-before-writes), and the budget is bounded by group size, **not** registration scale. The `subscribeClaims limit(20)` cap-count is bounded (≤12 pending) because the pending cap is **transaction-enforced** at placement — the cap-check, duplicate-check, and the write share one `runTransaction` (`place-claim.js:125-142`), so parallel submissions cannot both land over the cap (claims resolution honors it as a backstop). **No code change; re-confirm only if group size or pending-cap config grows materially.** (Locked-by-construction; a per-group read-budget test can be added if desired.)

### W4 — streams/boards collection literals (ledger item 6) — value-consistent, no split
The user-board collection `'boards'` and the user-draft stream `'streams'`/`'userDraft'` are referenced by **string literal** at several writers/readers (`commit-board.js:67`, `seed-tournament-group.js:108`, `tournamentCpu.js:143`, `tournamentBoardAutoCommit.js:124,182`, `resolve-user-draft.js:145,173`, client `subscribeOwnBoard`). All values **agree today — there is no live split** (verified). There is no `USER_BOARDS_SUBCOLLECTION` constant.
- **Risk:** future-rename hazard only (a rename of one literal would split a collection). Not a current defect.
- **Disposition:** document-and-watch (founder ruling, P8). If converged later, define `USER_BOARDS_SUBCOLLECTION` in the zero-import schema module, replace the literals, and lock the value with a test (the convergence spans ~6 writer/reader files, where a typo is severe — do it deliberately, not casually).

### W5 — ET-today client helpers not converged (ledger item 5, client half)
The server `toIso` copies were converged at P8 (→ `tournamentTime.toIso`). The **client** ET-today helpers (`etToday` `TournamentDevScreen.jsx:182`, `etTodayStr` `ClaimFlipWindow.jsx:30`, `toEtDate` `flat6BattleEnrichment.js:42`, `etMonthKey` `tournamentSurfaces.js:112`) are **intentionally left**: converging across the client/server SDK boundary is not clean (`tournamentTime` is server-side via `marketSchedule`), and `flat6BattleEnrichment` keeps its copy deliberately node-clean. The ~30 ET-date inlines elsewhere in `src/` predate the tournament (out of scope). Low priority; revisit only if a client-side ET-date drift bug appears.

---

## Cross-cron timing & calendar awareness (operate-and-watch)

### O1 — Holiday-week advancement waits for founder intervention
A 4-trading-day week banks only day-4, so the ruled day-5 `isWeekBanked` check never satisfies and Friday advancement no-ops "banking pending" indefinitely (`tournamentAdvancement.js:35-38`). **By design — not a bug.** On any holiday-shortened week, the founder must either bank manually or apply a founder-cited rule change. P9 launch calendar should note upcoming short weeks.

### O2 — Banking → advancement is deferral-coupled (verified composes)
Friday advancement requires day-5 banking (lands ~17:15 ET nightly); the Friday duty fires in the evening UTC window. If banking hasn't landed, advancement defers and re-ticks; Monday runs an advancement catch-up. No action — documented so the first live Friday's "banking pending" logs are understood as normal.

---

## Security-pass agenda (P9 owns; enumerated here so nothing is missed)

1. **🚩 G1 (above)** — deploy the five tournament rules blocks before the flip.
2. **Claim-window enforcement** — server-authoritative: `place-claim.js:65-70` (403 `window_closed`), day-5 cutoff `:101-102`, pending cap **transaction-enforced** (`place-claim.js:125-142` — cap-check + duplicate-check + write share one `runTransaction`, so parallel submissions cannot both land over the cap; claims resolution honors it as a backstop). Flip cap server-enforced inside the flip transaction (`flip.js:150`). Client mirror is display-only (parity-locked).
3. **The WHY projection** — non-owner active reads are concealed **server-side** via `api/tournament/battle-view.js` + the `projectTournamentBattle` allowlist; full WHY at completion. Re-verify the allowlist still covers the doc shape at P9.
4. **Client mutation callers** — the only client writers are `src/services/tournamentActions.js` (`placeClaim`/`flipPick` → authed endpoints); `tournamentGroupService.js` is reads-only by contract. Deploy auth: `decide.js` internal `CRON_SECRET` + ownership assertion (`:129-136`); `TOURNAMENT_ONLY_FIELDS` refused from browser callers (`:46-53`).
5. **Known best-effort gaps** — the eliminated-interstitial localStorage pointer (`roundBoundaryAck.js`) is best-effort by design. (The earlier "advisory claim-cap race" is closed: the placement transaction at `place-claim.js:125-142` makes the cap authoritative — see item 2.) Documented, not a leak.

---

## Out-of-build pointers (NOT tournament items — separate tickets)

### X1 — 🎫 [HIGH] Live training-game short scoring (separate ticket, founder-opened)
`BaggerBombTrainingBattleViewV4.jsx:396-420` carries the **same** short double-negation that P8 fixed in `AgentBattleScreen` (ledger item 1) — pre-negate at `:396-398`/`:406-408`, then forward `direction` to `calculateAssetScoreV3` at `:417`. Unlike AgentBattleScreen (long-only agents → dormant), **users can select crypto shorts** in the training game (`AssetPickerModal.jsx:155`), so this may be a **live scoring sign-flip**. This is a shipped-game correctness bug, **not** a tournament-build item. Founder is opening a separate ticket: verify reachability, then apply the same fix (call the scorer without `direction`). (`BaggerBombTrainingBattleViewV3.jsx` is unaffected — no such code.)

### X2 — [LOW] `seed-tournament-group.js` pool floor re-confirm (dev-only)
P3b flagged a 12-vs-15 floor mismatch in the dev group seeder; P5 reported fixing seed floors. Dev/admin endpoint only (no production risk). Worth a one-line re-confirmation in a future tidy pass; not actioned.

---

*Maintained as current state (like `BUILD_RULES.md`). When an item's trigger fires and it is resolved, strike it here in the same PR with the founder decision cited.*
